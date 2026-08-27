'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import Toast, { ToastMessage } from '@/src/components/Toast';
import HoneypotField from '@/src/components/HoneypotField';
import { Users2, ArrowRight, PartyPopper } from 'lucide-react';
import { joinTeamWithCodeAction } from '@/src/app/actions/authActions';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

export default function JoinTeamPage() {
  const router = useRouter();

  const [memberName, setMemberName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [teamFull, setTeamFull] = useState<string | null>(null);
  const [joinedTeamName, setJoinedTeamName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (!user) {
        router.push('/auth/team?intent=join');
      } else if (user.email) {
        setMemberName(user.email.split('@')[0]);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setTeamFull(null);

    if (!joinCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a join code.' });
      return;
    }

    setLoading(true);
    const res = await joinTeamWithCodeAction({ joinCode, memberName, honeypot });
    setLoading(false);

    if (res.error === 'team_full') {
      setTeamFull((res as any).teamName || 'This team');
    } else if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else if (res.success) {
      setJoinedTeamName(res.teamName || null);
    }
  };

  if (joinedTeamName) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-10 w-full">
          <div className="panel rounded-3xl p-8 border border-brand-500/40 text-center space-y-6 shadow-brand-glow">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/40 shadow-brand-glow">
              <PartyPopper className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold text-text-primary">You&apos;re in!</h1>
              <p className="text-sm text-text-secondary">
                You&apos;ve joined <span className="text-brand-500 font-bold">{joinedTeamName}</span>.
              </p>
            </div>
            <button
              onClick={() => router.push('/portal/team')}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-all shadow-brand-glow flex items-center justify-center space-x-2"
            >
              <span>Go to Team Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-lg mx-auto px-4 py-10 w-full">
        <div className="panel rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/30">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">Join a Team</h1>
              <p className="text-xs text-text-secondary">Enter the join code your teammate shared with you.</p>
            </div>
          </div>

          {teamFull && (
            <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-text-primary">
              <strong>{teamFull}</strong> is already full (4/4 members). Ask them to check with an organiser, or register your own team.
            </div>
          )}

          <Toast message={message} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <HoneypotField value={honeypot} onChange={setHoneypot} />

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">
                Your Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Your Full Name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full bg-white/5 border border-panel-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">
                Team Join Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-white/5 border border-panel-border rounded-xl px-4 py-3 text-center text-lg tracking-widest font-mono text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-all shadow-brand-glow flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Joining...' : 'Join Team'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
