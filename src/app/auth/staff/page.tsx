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
    if (loading) return; // guard against double-submit on flaky wifi
    setError(null);
    setLoading(true);

    // NOTE: server is authoritative on the domain check (staffLoginAction),
    // including the temporary test-account allowlist, so we don't hard-block
    // here — only the server response below drives the error message.
    const formData = new FormData(e.currentTarget);
    const res = await staffLoginAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md card rounded-3xl p-8 space-y-6 shadow-card-lg">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Staff Portal Login</h1>
            <p className="text-xs text-ink-600">
              For Judges &amp; Organisers with pre-seeded accounts.
            </p>
          </div>

          {error && (
            <div role="alert" className="p-3.5 rounded-xl text-xs font-semibold bg-red-50 text-ink-900 border border-danger-600/30 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wider">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-600/60 absolute left-3.5 top-3.5" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="judge@student.nitw.ac.in or organiser@student.nitw.ac.in"
                  className="w-full bg-surface-base border border-ink-900/15 rounded-xl pl-10 pr-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-600/60 absolute left-3.5 top-3.5" />
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="********"
                  className="w-full bg-surface-base border border-ink-900/15 rounded-xl pl-10 pr-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
