import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/database.types';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Edit2, ArrowUp, ArrowDown, Shuffle } from 'lucide-react';

type Question = Database['public']['Tables']['questions']['Row'];

export default function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // New question form state
  // New/Edit question form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [timeLimit, setTimeLimit] = useState(20);

  useEffect(() => {
    if (quizId) {
      fetchQuizData();
    }
  }, [quizId]);

  const fetchQuizData = async () => {
    setLoading(true);
    // Fetch quiz info
    const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId!).single();
    if (quizData) setQuizDetails(quizData);

    // Fetch questions
    // Fetch questions
    const { data: qData } = await supabase.from('questions').select('*').eq('quiz_id', quizId!).order('order_index', { ascending: true }).order('created_at');
    if (qData) setQuestions(qData);
    setLoading(false);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOrUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || options.some(opt => !opt.trim())) {
      alert('Please fill out all question text and options.');
      return;
    }

    if (editingId) {
      // Update
      const { error } = await supabase.from('questions').update({
        question_text: questionText,
        options: options,
        correct_option: options[correctOptionIndex],
        time_limit: timeLimit
      }).eq('id', editingId);

      if (error) {
        console.error('Error updating question:', error);
        alert('Failed to update question');
      } else {
        resetForm();
        fetchQuizData();
      }
    } else {
      // Insert
      const newOrderIndex = questions.length > 0 ? Math.max(...questions.map(q => q.order_index || 0)) + 1 : 0;
      const { error } = await supabase.from('questions').insert([{
        quiz_id: quizId!,
        question_text: questionText,
        options: options,
        correct_option: options[correctOptionIndex],
        time_limit: timeLimit,
        order_index: newOrderIndex
      }]);

      if (error) {
        console.error('Error adding question:', error);
        alert('Failed to add question');
      } else {
        resetForm();
        fetchQuizData(); // refresh list
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectOptionIndex(0);
    setTimeLimit(20);
  };

  const editQuestion = (q: Question) => {
    setEditingId(q.id);
    setQuestionText(q.question_text);
    setOptions(q.options as string[]);
    setCorrectOptionIndex((q.options as string[]).indexOf(q.correct_option));
    setTimeLimit(q.time_limit);
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', id);
    if (editingId === id) resetForm();
    fetchQuizData();
  };

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newQuestions = [...questions];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap elements
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[swapIndex];
    newQuestions[swapIndex] = temp;

    // Assign new order_index
    const updates = newQuestions.map((q, i) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      time_limit: q.time_limit,
      order_index: i
    }));

    setQuestions(newQuestions); // Optimistic UI update
    
    // Update DB
    const { error } = await supabase.from('questions').upsert(updates);
    if (error) {
      console.error('Error reordering:', error);
      fetchQuizData(); // Revert on error
    }
  };

  const randomizeOrder = async () => {
    if (questions.length < 2) return;
    
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const updates = shuffled.map((q, i) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      time_limit: q.time_limit,
      order_index: i
    }));

    setQuestions(shuffled); // Optimistic UI update
    const { error } = await supabase.from('questions').upsert(updates);
    if (error) {
      console.error('Error shuffling:', error);
      fetchQuizData(); // Revert on error
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!quizDetails) return <div className="p-8 text-center">Quiz not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-indigo-600 hover:underline mb-6 font-medium">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">{quizDetails.title}</h1>
            <p className="text-slate-500">Add questions to your quiz before hosting.</p>
          </div>
          <button 
            onClick={() => navigate(`/host/${quizId}`)}
            disabled={questions.length === 0}
            className="bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Host This Quiz
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Question Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingId ? <Edit2 size={20} className="text-indigo-600" /> : <Plus size={20} className="text-green-600" />} 
                {editingId ? 'Edit Question' : 'Add Question'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-sm text-slate-500 hover:text-slate-800 underline">
                  Cancel Edit
                </button>
              )}
            </div>
            <form onSubmit={addOrUpdateQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question Text</label>
                <textarea 
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="What is the capital of France?"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Options & Correct Answer</label>
                {options.map((opt, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${correctOptionIndex === i ? 'bg-indigo-50 border-indigo-200' : 'border-transparent'}`}>
                    <input 
                      type="radio" 
                      name="correctOption" 
                      checked={correctOptionIndex === i}
                      onChange={() => setCorrectOptionIndex(i)}
                      className="w-5 h-5 text-indigo-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Limit (seconds)</label>
                <input 
                  type="number" 
                  min="5" max="120"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500"
                  required
                />
              </div>

              <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg pt-2 flex items-center justify-center gap-2 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {editingId ? <Save size={18} /> : <Plus size={18} />} 
                {editingId ? 'Update Question' : 'Add Question'}
              </button>
            </form>
          </div>

          {/* Question List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">Questions ({questions.length})</h2>
              {questions.length > 1 && (
                <button 
                  onClick={randomizeOrder}
                  className="flex items-center gap-2 text-sm bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200 font-medium transition-colors"
                >
                  <Shuffle size={16} /> Randomize Order
                </button>
              )}
            </div>
            {questions.length === 0 ? (
              <div className="bg-slate-100 p-8 rounded-xl text-center text-slate-500 border border-slate-200 border-dashed">
                No questions added yet.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className={`bg-white p-4 rounded-xl shadow-sm border relative group transition-colors ${editingId === q.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                    
                    {/* Action buttons (Right) */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
                       <button 
                        onClick={() => editQuestion(q)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Edit Question"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => deleteQuestion(q.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete Question"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex gap-4">
                      {/* Reorder controls (Left) */}
                      <div className="flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-6">
                        <button 
                          onClick={() => moveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          className="text-slate-400 hover:text-slate-800 disabled:opacity-30 transition-colors"
                        >
                          <ArrowUp size={20} />
                        </button>
                        <button 
                          onClick={() => moveQuestion(idx, 'down')}
                          disabled={idx === questions.length - 1}
                          className="text-slate-400 hover:text-slate-800 disabled:opacity-30 transition-colors"
                        >
                          <ArrowDown size={20} />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2 pr-12">
                          <span className="font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                          <p className="font-semibold text-slate-800">{q.question_text}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {(q.options as string[]).map((opt, i) => (
                            <div key={i} className={`p-1.5 rounded border ${opt === q.correct_option ? 'bg-green-100 border-green-200 text-green-800 font-medium' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                              {opt}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-slate-500 font-medium">
                          ⏱ {q.time_limit}s
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
