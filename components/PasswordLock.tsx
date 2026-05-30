'use client';

import { useState } from 'react';
import { useKalenderStore } from '@/lib/store';

export default function PasswordLock() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuthenticated = useKalenderStore((s) => s.setAuthenticated);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (password === 'Mueller2026!') {
        setAuthenticated(true);
      } else {
        setError('Falsches Passwort. Bitte erneut versuchen.');
        setPassword('');
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm border border-white/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Müller Biegetechnik AG</h1>
          <p className="text-blue-300 mt-1 text-sm">Produktionskalender</p>
        </div>

        {/* Karte */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-2xl"
        >
          <div className="mb-5">
            <label className="block text-blue-100 text-sm font-medium mb-2">
              Zugangspasswort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Passwort eingeben…"
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white
                         placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-blue-400
                         focus:border-transparent text-sm"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-400/40 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                       disabled:cursor-not-allowed text-white font-medium rounded-xl
                       transition-colors duration-200 text-sm"
          >
            {loading ? 'Wird geprüft…' : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-blue-400/50 text-xs mt-6">
          Müller Biegetechnik AG · Internes Tool
        </p>
      </div>
    </div>
  );
}
