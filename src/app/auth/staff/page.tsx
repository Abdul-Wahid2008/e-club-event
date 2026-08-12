'use client';

import { useState } from 'react';
import Navbar from '@/src/components/Navbar';
import { Award, Lock, Mail, ArrowRight, ShieldAlert } from 'lucide-react';
import { staffLoginAction } from '@/src/app/actions/authActions';

export default function StaffAuthPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await staffLoginAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-surface-border space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 text-brand-purple flex items-center justify-center mx-auto border border-brand-purple/30 shadow-purple-glow">
              <Award className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Staff Portal Login</h1>
            <p className="text-xs text-gray-400">
              For Judges & Organisers with pre-seeded accounts.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="judge@nitw.ac.in or organiser@nitw.ac.in"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-purple transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-purple hover:bg-brand-purple/90 text-white transition-all shadow-purple-glow flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
