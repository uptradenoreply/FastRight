import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/database.types';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Users, Trophy, SkipForward, Copy, CheckCircle2, RotateCcw } from 'lucide-react';

type Quiz = Database['public']['Tables']['quizzes']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Answer = Database['public']['Tables']['answers']['Row'];

export default function HostController() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    fetchInitialData();

    // Subscribe to participants joining
    const participantsSubscription = supabase
      .channel('public:participants')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `quiz_id=eq.${quizId}` }, payload => {
        setParticipants(current => [...current, payload.new as Participant]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participants', filter: `quiz_id=eq.${quizId}` }, payload => {
        setParticipants(current => current.map(p => p.id === payload.new.id ? payload.new as Participant : p));
      })
      .subscribe();

    // Subscribe to answers
    const answersSubscription = supabase
      .channel('public:answers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, payload => {
        // We filter manually here because we only have question_id or participant_id on the answer
        // A more complex setup would join these, but for now we just fetch them all locally
        setAnswers(current => [...current, payload.new as Answer]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participantsSubscription);
      supabase.removeChannel(answersSubscription);
    };
  }, [quizId]);

  // Timer logic
  useEffect(() => {
    if (quiz?.status === 'active' && !showLeaderboard && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && quiz?.status === 'active' && !showLeaderboard) {
      // Time's up for current question
      handleShowLeaderboard();
    }
  }, [timeLeft, quiz?.status, showLeaderboard]);

  const fetchInitialData = async () => {
    const { data: qData } = await supabase.from('quizzes').select('*').eq('id', quizId!).single();
    if (qData) setQuiz(qData);

    const { data: qnsData } = await supabase.from('questions').select('*').eq('quiz_id', quizId!).order('order_index', { ascending: true }).order('created_at');
    if (qnsData) setQuestions(qnsData);

    const { data: pData } = await supabase.from('participants').select('*').eq('quiz_id', quizId!);
    if (pData) setParticipants(pData);
  };

  const startQuiz = async () => {
    if (questions.length === 0) return alert('Add questions first!');
    
    // Update quiz status
    await supabase.from('quizzes').update({ status: 'active' }).eq('id', quizId!);
    setQuiz(prev => prev ? { ...prev, status: 'active' } : null);
    
    // Start first question
    nextQuestion();
  };

  const nextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setTimeLeft(questions[nextIndex].time_limit);
      setShowLeaderboard(false);
      
      // Tell all clients to show next question
      supabase.channel(`quiz_${quizId}`).send({
        type: 'broadcast',
        event: 'next_question',
        payload: { questionId: questions[nextIndex].id }
      });
    } else {
      endQuiz();
    }
  };

  const endQuiz = async () => {
    await supabase.from('quizzes').update({ status: 'finished' }).eq('id', quizId!);
    setQuiz(prev => prev ? { ...prev, status: 'finished' } : null);
    setShowLeaderboard(true);
  };

  const handleShowLeaderboard = () => {
    setShowLeaderboard(true);
    // Tell clients to stop answering
    supabase.channel(`quiz_${quizId}`).send({
      type: 'broadcast',
      event: 'show_leaderboard',
    });
  };

  const cancelQuiz = () => {
    navigate(-1);
  };

  const reHostQuiz = async () => {
    // 1. Delete all participants (answers cascade)
    await supabase.from('participants').delete().eq('quiz_id', quizId!);
    // 2. Generate a new 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000);
    // 3. Reset quiz to waiting with new PIN
    await supabase.from('quizzes').update({ status: 'waiting', pin: newPin }).eq('id', quizId!);
    // 4. Hard reload so all state resets cleanly
    window.location.reload();
  };

  if (!quiz) return <div className="p-8 text-center text-slate-500">Loading Lobby...</div>;

  // Render Lobby
  if (quiz.status === 'waiting') {
    const handleCopyPin = () => {
      navigator.clipboard.writeText(String(quiz.pin ?? ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-8 text-white text-center">
        <h1 className="text-5xl font-black mb-4 drop-shadow-md">{quiz.title}</h1>
        <p className="text-xl mb-6 font-medium text-indigo-100">Join at <strong className="bg-white text-indigo-800 px-3 py-1 rounded-md shadow-sm">FastRightQuiz.app</strong> with Game PIN:</p>
        
        {/* PIN DISPLAY */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-12 max-w-2xl w-full mx-auto border-4 border-indigo-400">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <span className="text-indigo-400 font-bold uppercase tracking-widest text-sm mb-1 block">Game PIN</span>
              <span className="text-6xl md:text-7xl font-black text-slate-800 font-mono tracking-[0.2em] leading-tight">{quiz.pin ?? '----'}</span>
            </div>
            <button 
              onClick={handleCopyPin}
              className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md shrink-0 ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            >
              {copied ? <CheckCircle2 size={24} /> : <Copy size={24} />}
              {copied ? 'Copied!' : 'Copy PIN'}
            </button>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl w-full max-w-4xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold flex items-center gap-3"><Users size={32} /> Participants ({participants.length})</h2>
            <div className="flex gap-4">
              <button onClick={cancelQuiz} className="bg-red-500/20 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                Cancel
              </button>
              <button 
                onClick={startQuiz}
                disabled={participants.length === 0} 
                className="bg-green-500 hover:bg-green-400 text-white px-8 py-3 rounded-xl text-xl font-bold shadow-lg disabled:opacity-50 transition-transform hover:scale-105 flex items-center gap-2"
              >
                <Play fill="currentColor" /> Start Quiz
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {participants.map(p => (
              <div key={p.id} className="bg-white/20 py-3 px-4 rounded-xl font-semibold text-lg animate-fade-in truncate">
                {p.nim_or_name}
              </div>
            ))}
            {participants.length === 0 && (
              <div className="col-span-full py-12 text-white/50 italic text-xl">Waiting for players to join...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Final Leaderboard
  if (quiz.status === 'finished') {
    const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center">
        <Trophy size={80} className="text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        <h1 className="text-5xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">Final Leaderboard</h1>
        
        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
          {sortedParticipants.map((p, idx) => (
            <div key={p.id} className="flex justify-between items-center py-4 border-b border-white/10 last:border-0">
              <div className="flex items-center gap-4">
                <span className={`text-2xl font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                  #{idx + 1}
                </span>
                <span className="text-xl font-semibold">{p.nim_or_name}</span>
              </div>
              <span className="text-2xl font-black text-indigo-400">{p.score} pt</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-4">
          <button
            onClick={reHostQuiz}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg"
          >
            <RotateCcw size={20} /> Re-host Quiz
          </button>
          <button onClick={() => navigate('/admin')} className="bg-white/20 hover:bg-white/30 px-8 py-3 rounded-xl font-bold transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render Active Question
  const activeQuestion = questions[currentQuestionIndex];
  
  if (!activeQuestion) return <div>Loading question...</div>;

  // Find answers for this specific question
  const currentAnswers = answers.filter(a => a.question_id === activeQuestion.id);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
        <div className="font-bold text-slate-800">Q{currentQuestionIndex + 1} of {questions.length}</div>
        <div className="flex gap-4">
          <div className="bg-indigo-100 text-indigo-800 px-4 py-1 flex items-center rounded-full font-bold">
            Answers: {currentAnswers.length} / {participants.length}
          </div>
          <div className={`px-4 py-1 rounded-full font-bold flex items-center ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
            ⏱ {timeLeft}s
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
        {!showLeaderboard ? (
          <>
            <h2 className="text-4xl md:text-5xl font-black text-center mb-12 text-slate-800">{activeQuestion.question_text}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {(activeQuestion.options as string[]).map((opt, i) => (
                <div key={i} className="bg-indigo-600 text-white p-8 rounded-2xl text-2xl font-bold flex items-center justify-center text-center shadow-lg transition-transform hover:scale-[1.02]">
                  {opt}
                </div>
              ))}
            </div>
            
            <button 
              onClick={handleShowLeaderboard}
              className="mt-12 bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2"
            >
              Skip Timer <SkipForward size={20} />
            </button>
          </>
        ) : (
          <div className="w-full">
            <h2 className="text-3xl font-bold text-center mb-8">Question Results</h2>
            {/* Show correct answer visually */}
            <div className="bg-green-100 border-2 border-green-500 rounded-xl p-6 text-center mb-8 shadow-sm">
              <span className="text-green-800 font-bold block mb-1">Correct Answer</span>
              <span className="text-2xl font-black text-green-900">{activeQuestion.correct_option}</span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8 max-h-[40vh] overflow-y-auto">
               <h3 className="font-bold text-lg mb-4 text-slate-700">Fastest Correct Answers</h3>
               {currentAnswers
                 .filter(a => a.is_correct)
                 .sort((a, b) => a.response_time - b.response_time)
                 .map((a, idx) => {
                   const p = participants.find(p => p.id === a.participant_id);
                   return (
                     <div key={a.id} className="flex justify-between items-center py-2 border-b last:border-0">
                       <span className="font-semibold">{idx + 1}. {p?.nim_or_name || 'Unknown'}</span>
                       <span className="text-slate-500 font-mono">{a.response_time}ms</span>
                     </div>
                   );
                 })}
                 {currentAnswers.filter(a => a.is_correct).length === 0 && (
                   <div className="text-slate-500 italic text-center py-4">No one got it right!</div>
                 )}
            </div>

            <div className="flex justify-center">
              <button 
                onClick={nextQuestion}
                className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-3"
              >
                {currentQuestionIndex + 1 < questions.length ? 'Next Question' : 'End Quiz'} <SkipForward />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
