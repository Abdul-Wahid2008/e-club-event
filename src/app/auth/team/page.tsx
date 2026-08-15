'use client';

import { useEffect, useRef, useState } from 'react';
import Navbar from '@/src/components/Navbar';
import { Mail, ShieldAlert, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react';
import { requestTeamOtpAction, verifyTeamOtpAction } from '@/src/app/actions/authActions';
import { isValidEmailFormat } from '@/src/lib/validation';
import { useRouter } from 'next/navigation';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function TeamAuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'verify') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      setDigits(Array(CODE_LENGTH).fill(''));
      setStep('verify');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const submitCode = async (code: string) => {
    if (code.length !== CODE_LENGTH || loading) return;
    setError(null);
    setLoading(true);
    const res = await verifyTeamOtpAction(email, code);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } else {
      setVerified(true);
      router.push('/register-team');
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Handle paste of multiple digits into one box
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      const lastFilled = Math.min(index + clean.length, CODE_LENGTH) - 1;
      inputRefs.current[lastFilled]?.focus();
      const joined = next.join('');
      if (joined.length === CODE_LENGTH) submitCode(joined);
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const joined = next.join('');
    if (joined.length === CODE_LENGTH) {
      submitCode(joined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(digits.join(''));
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    const formData = new FormData();
    formData.append('email', email);
    const res = await requestTeamOtpAction(formData);
    setResending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN_SECONDS);
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
              {step === 'request'
                ? 'Enter any valid email address to receive your 6-digit code.'
                : 'Enter the 6-digit code we sent to your inbox.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {verified && (
            <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Verified! Redirecting...</span>
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
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <span>{loading ? 'Sending code...' : 'Send Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-5">
              <p className="text-xs text-gray-400 text-center">
                Code sent to <span className="text-white font-semibold">{email}</span>
              </p>

              <div className="flex justify-center gap-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={CODE_LENGTH}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={loading}
                    className="w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-brand-cyan focus:shadow-cyan-glow transition-all disabled:opacity-60"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || digits.join('').length !== CODE_LENGTH}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setError(null);
                    setDigits(Array(CODE_LENGTH).fill(''));
                  }}
                  className="text-xs text-gray-400 hover:text-gray-200 underline"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="text-xs text-brand-cyan hover:text-brand-cyan/80 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-1.5 font-semibold"
                >
                  <RotateCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending...' : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
