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
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-surface-border space-y-6 shadow-2xl relative">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mx-auto border border-brand-cyan/30 shadow-cyan-glow">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Team Authentication</h1>
            <p className="text-xs text-gray-400">
              Enter any valid email address to receive your OTP code.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Leader Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-cyan transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Sending OTP...' : 'Send Magic OTP Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Enter 6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-brand-cyan transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Proceed'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-200 underline pt-2"
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
