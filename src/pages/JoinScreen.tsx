import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, ArrowLeft } from 'lucide-react';

export default function JoinScreen() {
  const [pin, setPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!pin.trim() || !playerName.trim()) {
      setError('Please enter both Game PIN and your Name');
      return;
    }
    if (pin.length !== 4) {
      setError('Game PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);

    try {
      // 1. Look up quiz by 4-digit PIN
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('id, status')
        .eq('pin', parseInt(pin))
        .single();

      if (quizError || !quiz) {
        throw new Error('Game PIN not found. Please check and try again.');
      }

      if (quiz.status !== 'waiting') {
        throw new Error('This quiz has already started or finished.');
      }

      // 2. Add participant using the real quiz UUID
      const { data: participant, error: joinError } = await supabase
        .from('participants')
        .insert([{
          quiz_id: quiz.id,
          nim_or_name: playerName
        }])
        .select()
        .single();

      if (joinError || !participant) {
        throw new Error('Failed to join quiz. Try again.');
      }

      // 3. Navigate to play screen using the real quiz UUID
      navigate(`/play/${quiz.id}`, { state: { participantId: participant.id, playerName } });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-indigo-800 text-white text-center py-8 relative">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-4xl font-black tracking-tight">Kahoot Clone</h1>
        </div>
        
        <form onSubmit={handleJoin} className="p-8 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center">{error}</div>}
          
          <div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <KeyRound size={20} />
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Game PIN"
                className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-xl text-center text-3xl font-black font-mono tracking-[0.4em] focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <User size={20} />
              </span>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="NIM / Nickname"
                className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent rounded-xl text-center text-xl font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || pin.length !== 4 || !playerName.trim()}
            className="w-full bg-slate-900 text-white font-black text-xl py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-95 flex justify-center items-center"
          >
            {loading ? 'Joining...' : 'Enter Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
