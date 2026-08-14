'use client';

import { useState } from 'react';
import Navbar from '@/src/components/Navbar';
import Toast, { ToastMessage } from '@/src/components/Toast';
import { Award, Lock, Mail, ArrowRight } from 'lucide-react';
import { staffLoginAction } from '@/src/app/actions/authActions';

export default function StaffAuthPage() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    // NOTE: server is authoritative on the domain check (staffLoginAction),
    // including the temporary test-account allowlist, so we don't hard-block
    // here — only the server response below drives the error message.
    const formData = new FormData(e.currentTarget);
    const res = await staffLoginAction(formData);

    if (res?.error) {
      setMessage({ type: 'error', text: res.error });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md panel rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/30 shadow-brand-glow">
              <Award className="w-6 h-6" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">Staff Portal Login</h1>
            <p className="text-xs text-text-secondary">
              For Judges & Organisers with pre-seeded accounts.
            </p>
          </div>

          <Toast message={message} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="judge@student.nitw.ac.in or organiser@student.nitw.ac.in"
                  className="w-full bg-white/5 border border-panel-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-panel-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-all shadow-brand-glow flex items-center justify-center space-x-2"
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
