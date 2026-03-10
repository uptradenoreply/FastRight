import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/database.types';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Play, RotateCcw } from 'lucide-react';

type Quiz = Database['public']['Tables']['quizzes']['Row'];

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching quizzes:', error);
    else setQuizzes(data || []);
    setLoading(false);
  };

  const createQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;

    const pin = Math.floor(1000 + Math.random() * 9000);

    const { data, error } = await supabase
      .from('quizzes')
      .insert([{ title: newQuizTitle, pin }])
      .select()
      .single();

    if (error) {
      console.error('Error creating quiz:', error);
    } else if (data) {
      setNewQuizTitle('');
      navigate(`/admin/quiz/${data.id}`); // Go to question builder
    }
  };

  const deleteQuiz = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) console.error('Error deleting quiz:', error);
    else fetchQuizzes();
  };

  const reHostQuiz = async (id: string) => {
    // Delete all old participants (answers cascade)
    await supabase.from('participants').delete().eq('quiz_id', id);
    // New random 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000);
    // Reset quiz to waiting with new PIN
    await supabase.from('quizzes').update({ status: 'waiting', pin: newPin }).eq('id', id);
    navigate(`/host/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Host Dashboard</h1>
          <button onClick={() => navigate('/')} className="text-indigo-600 hover:underline">
            Back to Home
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Create New Quiz</h2>
          <form onSubmit={createQuiz} className="flex gap-4">
            <input
              type="text"
              value={newQuizTitle}
              onChange={(e) => setNewQuizTitle(e.target.value)}
              placeholder="e.g., General Knowledge Trivia"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={!newQuizTitle.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={20} /> Create
            </button>
          </form>
        </div>

        <h2 className="text-2xl font-semibold mb-4 text-slate-800">Your Quizzes</h2>
        {loading ? (
          <p className="text-slate-500">Loading quizzes...</p>
        ) : quizzes.length === 0 ? (
          <p className="text-slate-500 bg-white p-8 rounded-xl border border-slate-200 text-center">
            No quizzes found. Create one above!
          </p>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{quiz.title}</h3>
                  <div className="text-sm text-slate-500 flex gap-4 mt-1">
                    <span>Status: <span className={`font-medium capitalize ${
                      quiz.status === 'waiting' ? 'text-green-600' :
                      quiz.status === 'active' ? 'text-blue-600' : 'text-slate-400'
                    }`}>{quiz.status}</span></span>
                    {quiz.pin && <span>PIN: <span className="font-black text-indigo-700 font-mono">{quiz.pin}</span></span>}
                    <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    title="Edit Questions"
                  >
                    Edit
                  </button>
                  {quiz.status === 'finished' ? (
                    <button
                      onClick={() => reHostQuiz(quiz.id)}
                      className="px-4 py-2 bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                      <RotateCcw size={18} /> Re-host
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/host/${quiz.id}`)}
                      className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                      <Play size={18} /> Host
                    </button>
                  )}
                  <button
                    onClick={() => deleteQuiz(quiz.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="Delete Quiz"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
