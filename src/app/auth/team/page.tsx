'use client';

import { useState } from 'react';
import Navbar from '@/src/components/Navbar';
import { Mail, KeyRound, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { requestTeamOtpAction, verifyTeamOtpAction } from '@/src/app/actions/authActions';
import { isValidEmailFormat } from '@/src/lib/validation';
import { useRouter } from 'next/navigation';

export default function TeamAuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccessMsg(null);

    // Client-side format check (any email domain allowed for teams)
    if (!isValidEmailFormat(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('email', email);

    const res = await requestTeamOtpAction(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMsg('Magic code sent to your inbox! Enter the OTP below.');
      setStep('verify');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!otpToken || otpToken.trim().length < 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    const res = await verifyTeamOtpAction(email, otpToken.trim());
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      // Successfully authenticated. Direct user to register team form or team dashboard
      router.push('/register-team');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md card rounded-3xl p-8 space-y-6 shadow-card-lg relative">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Team Authentication</h1>
            <p className="text-xs text-ink-600">
              Enter any valid email address to receive your OTP code.
            </p>
          </div>

          {error && (
            <div role="alert" className="p-3.5 rounded-xl text-xs font-semibold bg-red-50 text-ink-900 border border-danger-600/30 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" className="p-3.5 rounded-xl text-xs font-semibold bg-green-50 text-ink-900 border border-success-600/30 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wider">
                  Leader Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-600/60 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                <span>{loading ? 'Sending OTP...' : 'Send Magic OTP Code'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1.5 uppercase tracking-wider">
                  Enter 6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-ink-600/60 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    className="tabular-nums w-full bg-surface-base border border-ink-900/15 rounded-xl pl-10 pr-4 py-3 text-center text-lg tracking-widest text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Proceed'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-full text-center text-xs text-ink-600 hover:text-ink-900 underline pt-2"
              >
                Change Email
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
