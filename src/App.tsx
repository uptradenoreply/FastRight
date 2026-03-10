import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import QuizEditor from './pages/QuizEditor';
import HostController from './pages/HostController';
import JoinScreen from './pages/JoinScreen';
import PlayScreen from './pages/PlayScreen';

function AdminPinGate({ onAuthed }: { onAuthed: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (pin === '0904') {
      sessionStorage.setItem('admin_authed', '1');
      onAuthed();
      return;
    }
    setError('PIN salah');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 text-white p-6">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-black mb-2">Admin PIN</h1>
        <p className="text-slate-600 mb-6">Masukkan PIN untuk masuk ke tampilan admin.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center">{error}</div>}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setError('');
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
            }}
            placeholder="PIN (4 digit)"
            className="w-full px-4 py-3 bg-slate-100 rounded-xl text-center text-2xl font-black font-mono tracking-[0.4em] focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <button
            type="submit"
            disabled={pin.length !== 4}
            className="w-full bg-slate-900 text-white font-black text-lg py-3 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-indigo-700 font-semibold hover:underline"
          >
            Kembali
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedAdminDashboard() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(typeof window !== 'undefined' && sessionStorage.getItem('admin_authed') === '1');
  }, []);

  if (authed) return <AdminDashboard />;
  return <AdminPinGate onAuthed={() => setAuthed(true)} />;
}

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 text-white">
      <h1 className="text-5xl font-extrabold mb-8 drop-shadow-lg">Kahoot Clone</h1>
      <div className="flex gap-4">
        <Link to="/join" className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform">
          Join a Game
        </Link>
        <Link to="/admin" className="bg-indigo-800 text-white px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform">
          Host a Game
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* We will build these components next */}
        <Route path="/admin" element={<ProtectedAdminDashboard />} />
        <Route path="/admin/quiz/:quizId" element={<QuizEditor />} />
        <Route path="/host/:quizId" element={<HostController />} />
        <Route path="/join" element={<JoinScreen />} />
        <Route path="/play/:quizId" element={<PlayScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
