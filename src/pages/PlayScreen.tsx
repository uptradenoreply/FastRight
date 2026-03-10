import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/database.types';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, CheckCircle, XCircle, Timer, Loader2, LogOut } from 'lucide-react';

type Question = Database['public']['Tables']['questions']['Row'];

export default function PlayScreen() {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const participantId = location.state?.participantId;
  const playerName = location.state?.playerName;

  const quizSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [quizStatus, setQuizStatus] = useState<'waiting' | 'active' | 'finished'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<{isCorrect: boolean, points: number} | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  
  const questionStartTime = useRef<number>(0);

  // If user navigated directly without joining
  useEffect(() => {
    if (!participantId || !quizId) {
      navigate('/join');
    }
  }, [participantId, quizId, navigate]);

  useEffect(() => {
    if (!quizId) return;

    // Check initial quiz status
    fetchCurrentState();

    // Subscribe to Quiz changes (waiting -> active -> finished)
    const quizSub = supabase
      .channel('public:quizzes:play')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` }, payload => {
        const newStatus = payload.new.status;
        if (newStatus !== quizStatus) {
            setQuizStatus(newStatus);
            if (newStatus === 'active') {
                // When it becomes active, fetch the first (or current) question.
                // In a perfect system, host forces a specific current_question_id. 
                // Here we fetch questions and use answered state to find the next one.
                fetchNextUnansweredQuestion();
            }
        }
      })
      .subscribe();

    quizSubRef.current = quizSub;

    // We also need to know when the host moves to the NEXT question.
    // If the host just assumes active status = start timer, players need a trigger for Next Question.
    // A robust way without a 'current_question_id' on quizzes is to listen to the `questions` or rely
    // on a custom realtime channel for "NEXT_QUESTION" broadcast. 
    // Since we are using standard Postgres changes, let's subscribe to the 'questions' table?
    // Actually, host doesn't UPDATE questions. 
    // Let's implement a Broadcast channel for manual host triggers.
    
    // (For this specific simplified requirement without complex schema changes:
    // If we just need them to jump when Host clicks next, the easiest robust way is a Broadcast)
    const broadcastSub = supabase.channel(`quiz_${quizId}`)
      .on('broadcast', { event: 'next_question' }, (payload) => {
        // payload can contain new question ID or index
        if (payload.payload?.questionId) {
            fetchQuestionById(payload.payload.questionId);
            setHasAnswered(false);
            setAnswerResult(null);
            questionStartTime.current = Date.now();
        }
      })
      .on('broadcast', { event: 'show_leaderboard' }, () => {
         // The host ended the question early or time is up
         if (!hasAnswered) {
             setHasAnswered(true); // lock in no answer
         }
      })
      .subscribe();

    broadcastSubRef.current = broadcastSub;

    return () => {
      supabase.removeChannel(quizSub);
      supabase.removeChannel(broadcastSub);
    };
  }, [quizId, quizStatus, hasAnswered]);

  const handleLeaveRoom = async () => {
    try {
      if (quizSubRef.current) {
        supabase.removeChannel(quizSubRef.current);
        quizSubRef.current = null;
      }
      if (broadcastSubRef.current) {
        supabase.removeChannel(broadcastSubRef.current);
        broadcastSubRef.current = null;
      }

      if (participantId) {
        await supabase.from('participants').delete().eq('id', participantId);
      }
    } finally {
      navigate('/', { replace: true });
    }
  };

  const fetchCurrentState = async () => {
    const { data: q } = await supabase.from('quizzes').select('status').eq('id', quizId!).single();
    if (q) setQuizStatus(q.status);

    const { data: p } = await supabase.from('participants').select('score').eq('id', participantId).single();
    if (p) setTotalScore(p.score);
  };

  const fetchNextUnansweredQuestion = async () => {
     // Fetch all questions for this quiz
     const { data: questions } = await supabase
       .from('questions')
       .select('*')
       .eq('quiz_id', quizId!)
       .order('order_index', { ascending: true })
       .order('created_at');
     if (!questions) return;

     // Fetch answers by this participant
     const { data: answers } = await supabase.from('answers').select('question_id').eq('participant_id', participantId);
     const answeredQuestionIds = answers?.map(a => a.question_id) || [];

     // Find first unanswered
     const nextQ = questions.find(q => !answeredQuestionIds.includes(q.id));
     if (nextQ) {
         setCurrentQuestion(nextQ);
         setHasAnswered(false);
         setAnswerResult(null);
         questionStartTime.current = Date.now();
     }
  };

  const fetchQuestionById = async (qId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('id', qId).single();
    if (data) setCurrentQuestion(data);
  };

  const submitAnswer = async (selectedOption: string) => {
    if (hasAnswered || !currentQuestion) return;
    setHasAnswered(true);

    const timeTakenMs = Date.now() - questionStartTime.current;
    const isCorrect = selectedOption === currentQuestion.correct_option;
    
    // Calculate points (Kahoot style: max 1000, drops based on time. 0 if wrong)
    let points = 0;
    if (isCorrect) {
        // Max time limit in ms
        const maxTimeMs = currentQuestion.time_limit * 1000;
        // e.g., 1000 * (1 - (timeTaken / (maxTime / 2))) - simple decay
        const ratio = timeTakenMs / maxTimeMs;
        // Minimum 500 points if correct but slow
        points = Math.max(500, Math.round(1000 * (1 - (ratio / 2)))); 
    }

    setAnswerResult({ isCorrect, points });
    
    // Update local score
    setTotalScore(prev => prev + points);

    // Save answer to DB
    await supabase.from('answers').insert([{
        participant_id: participantId,
        question_id: currentQuestion.id,
        answered_option: selectedOption,
        is_correct: isCorrect,
        response_time: timeTakenMs
    }]);

    // Update participant total score in DB
    if (points > 0) {
        const { data: pData } = await supabase.from('participants').select('score').eq('id', participantId).single();
        if (pData) {
            await supabase.from('participants').update({ score: pData.score + points }).eq('id', participantId);
        }
    }
  };


  // Views

  if (quizStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-8 text-white text-center">
        <h1 className="text-3xl font-bold mb-8">You're in!</h1>
        <div className="bg-white/20 backdrop-blur-md p-8 rounded-2xl mb-8 animate-pulse">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-semibold">Waiting for host to start...</h2>
        </div>
        <p className="text-xl font-medium">Nickname: <strong className="bg-indigo-800 px-3 py-1 rounded-md ml-2">{playerName}</strong></p>
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="mt-10 bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
        >
          <LogOut size={18} /> Leave Room
        </button>
      </div>
    );
  }

  if (quizStatus === 'finished') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white text-center">
        <Trophy size={80} className="text-yellow-400 mb-6 drop-shadow-lg" />
        <h1 className="text-4xl font-black mb-2">Quiz Completed!</h1>
        <p className="text-xl text-slate-400 mb-8">Great job, {playerName}</p>
        
        <div className="bg-white/10 p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md">
          <h2 className="text-slate-300 font-bold mb-2 uppercase tracking-widest text-sm">Final Score</h2>
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            {totalScore}
          </div>
        </div>
        
        <button onClick={() => navigate('/')} className="mt-12 bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl font-bold transition-colors">
          Leave Game
        </button>
      </div>
    );
  }

  // Active Status but waiting for host to push next question
  if (!currentQuestion) {
     return (
        <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-8 text-center">
             <Loader2 size={40} className="text-indigo-600 animate-spin mb-4" />
             <h2 className="text-2xl font-bold text-slate-800">Get Ready...</h2>
             <p className="text-slate-500">Loading next question</p>
        </div>
     )
  }

  // Define Colors for 4 options to match Kahoot feel
  const bgColors = ['bg-red-500 hover:bg-red-600', 'bg-blue-500 hover:bg-blue-600', 'bg-yellow-500 hover:bg-yellow-600', 'bg-green-500 hover:bg-green-600'];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-white p-4 flex justify-between items-center shadow-sm relative z-10 w-full">
         <div className="font-bold hidden md:block text-slate-800">{playerName}</div>
         <button
           type="button"
           onClick={handleLeaveRoom}
           className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-2"
         >
           <LogOut size={16} /> Leave
         </button>
         <div className="bg-slate-800 text-white px-4 py-1.5 rounded-full font-bold flex items-center gap-2">
           <Trophy size={16} className="text-yellow-400"/> {totalScore}
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full">
        {!hasAnswered ? (
           // Active Play View
           <div className="w-full max-w-2xl mt-auto pb-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-slate-800 px-4">
                {currentQuestion.question_text}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[50vh] md:h-[40vh]">
                {(currentQuestion.options as string[]).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => submitAnswer(opt)}
                    className={`${bgColors[i % 4]} text-white h-full w-full rounded-2xl shadow-md text-2xl font-bold transition-transform active:scale-95`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
           </div>
        ) : (
           // Result View (Waiting for others)
           <div className={`w-full max-w-lg p-10 rounded-3xl shadow-2xl text-center text-white transition-all transform scale-100 ${
               !answerResult ? 'bg-slate-800' :
               answerResult.isCorrect ? 'bg-green-500' : 'bg-red-500'
           }`}>
               {!answerResult ? (
                   <div>
                       <Timer size={64} className="mx-auto mb-6 text-slate-400 animate-pulse" />
                       <h2 className="text-3xl font-bold mb-2">Answer Locked In</h2>
                       <p className="text-slate-300">Waiting for other players...</p>
                   </div>
               ) : (
                   <div>
                       {answerResult.isCorrect ? (
                           <CheckCircle size={80} className="mx-auto mb-6" />
                       ) : (
                           <XCircle size={80} className="mx-auto mb-6 opacity-90" />
                       )}
                       <h2 className="text-4xl font-black mb-4 tracking-wide">
                           {answerResult.isCorrect ? 'Correct!' : 'Incorrect'}
                       </h2>
                       {answerResult.isCorrect && (
                           <div className="inline-block bg-black/20 px-6 py-2 rounded-full font-bold text-xl">
                               +{answerResult.points} points
                           </div>
                       )}
                       <p className="mt-8 opacity-80 font-medium">Wait for host to proceed...</p>
                   </div>
               )}
           </div>
        )}
      </div>
    </div>
  );
}
