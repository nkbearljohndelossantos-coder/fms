import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('admin@nkb.com');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) {
          login(d.user, d.accessToken, d.refreshToken);
        } else {
          setError(d.message);
        }
      })
      .catch(err => {
        setLoading(false);
        setError(err.message || 'Login connection error');
      });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        {/* Official NKB Golden Logo Header */}
        <div className="text-center space-y-3">
          <img
            src="/nkb-logo.png"
            alt="NKB Manufacturing Corp. Logo"
            className="w-44 h-auto mx-auto object-contain drop-shadow-sm"
          />
          <p className="text-xs text-slate-500 font-medium">
            Cosmetics • Perfumes • Food Supplements
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Username or Email</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={usernameOrEmail}
                onChange={e => setUsernameOrEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs"
          >
            {loading ? 'Authenticating...' : 'Sign In to Formulation Hub'}
          </button>
        </form>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Default Super Admin Credentials:
          </p>
          <p className="font-mono text-slate-700">Email: <span className="font-bold text-slate-900">admin@nkb.com</span></p>
          <p className="font-mono text-slate-700">Password: <span className="font-bold text-slate-900">Admin@123456</span></p>
        </div>
      </div>
    </div>
  );
}
