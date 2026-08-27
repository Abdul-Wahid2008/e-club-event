'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import Footer from '@/src/components/Footer';
import Toast, { ToastMessage } from '@/src/components/Toast';
import HoneypotField from '@/src/components/HoneypotField';
import TurnstileWidget from '@/src/components/TurnstileWidget';
import { Users, User, Plus, Trash2, Sparkles, ArrowRight, Copy, Check, MessageCircle } from 'lucide-react';
import { registerTeamAction } from '@/src/app/actions/authActions';
import { isValidEmailFormat } from '@/src/lib/validation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

type Mode = 'solo' | 'team';

export default function RegisterTeamPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('team');
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Additional members beyond the leader (0 to 3 -> total 1 to 4)
  const [members, setMembers] = useState<{ name: string; email: string }[]>([
    { name: '', email: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [copied, setCopied] = useState(false);
  const [assignedResult, setAssignedResult] = useState<{
    teamName: string;
    domain: string;
    pool: 'A' | 'B';
    joinCode: string | null;
  } | null>(null);

  // Check auth status on load
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (!user) {
        router.push('/auth/team');
      } else if (user.email) {
        setLeaderEmail(user.email);
        setLeaderName(user.email.split('@')[0]);
      }
    });
  }, [router]);

  const handleAddMember = () => {
    if (members.length < 3) {
      setMembers([...members, { name: '', email: '' }]);
    }
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleMemberChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === 'solo') {
      setMembers([]);
    } else if (members.length === 0) {
      setMembers([{ name: '', email: '' }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const activeMembers = mode === 'solo' ? [] : members;
    const allEmails = [leaderEmail, ...activeMembers.map((m) => m.email)];
    const invalidList = allEmails.filter((em) => !isValidEmailFormat(em));

    if (invalidList.length > 0) {
      setMessage({
        type: 'error',
        text: `All team member emails must be valid. Invalid email(s): ${invalidList.join(', ')}`,
      });
      return;
    }

    setLoading(true);
    const res = await registerTeamAction({
      teamName,
      leaderName,
      leaderEmail,
      members: activeMembers,
      honeypot,
      turnstileToken: turnstileToken || undefined,
    });
    setLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else if (res.success && res.domain && res.pool) {
      setAssignedResult({
        teamName,
        domain: res.domain,
        pool: res.pool,
        joinCode: res.team?.join_code ?? null,
      });
    }
  };

  const handleCopyCode = () => {
    if (!assignedResult?.joinCode) return;
    navigator.clipboard.writeText(assignedResult.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const whatsappShareText = assignedResult
    ? `I just registered "${assignedResult.teamName}" for The Pitch League at NIT Warangal! 🔥 Register your team (solo or squad) here: ${shareUrl}`
    : '';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full">
        {assignedResult ? (
          <div className="panel rounded-3xl p-8 border border-brand-500/40 text-center space-y-6 shadow-brand-glow">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-500 flex items-center justify-center mx-auto border border-brand-500/40 shadow-brand-glow">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-3xl font-bold text-text-primary">Team Successfully Registered!</h1>
              <p className="text-sm text-text-secondary">
                Welcome <span className="text-brand-500 font-bold">{assignedResult.teamName}</span> to The Pitch League!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
              <div className="card rounded-2xl p-5">
                <span className="text-xs uppercase font-mono tracking-wider text-text-secondary block mb-1">
                  Randomly Assigned Domain
                </span>
                <span className="text-lg font-extrabold text-accent-warm">{assignedResult.domain}</span>
              </div>

              <div className="card rounded-2xl p-5">
                <span className="text-xs uppercase font-mono tracking-wider text-text-secondary block mb-1">
                  Auto-Balanced Pool
                </span>
                <span className="text-lg font-extrabold text-brand-500">Pool {assignedResult.pool}</span>
              </div>
            </div>

            {assignedResult.joinCode && (
              <div className="card rounded-2xl p-5 text-left space-y-3 border border-accent-warm/30">
                <div>
                  <span className="text-xs uppercase font-mono tracking-wider text-text-secondary block mb-1">
                    Team Join Code
                  </span>
                  <p className="text-xs text-text-secondary mb-2">
                    Share this code with your teammates so they can join your team (up to 4 members total).
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="flex-1 text-center text-2xl font-mono font-extrabold tracking-[0.3em] text-accent-warm bg-white/5 border border-panel-border rounded-xl py-3">
                    {assignedResult.joinCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-3 rounded-xl bg-white/5 border border-panel-border hover:border-brand-500 transition-colors"
                    aria-label="Copy join code"
                  >
                    {copied ? <Check className="w-5 h-5 text-success-500" /> : <Copy className="w-5 h-5 text-text-secondary" />}
                  </button>
                </div>
              </div>
            )}

            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#25D366] hover:bg-[#25D366]/90 text-white transition-all flex items-center justify-center space-x-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share with Friends on WhatsApp</span>
            </a>

            <button
              onClick={() => router.push('/portal/team')}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-all shadow-brand-glow flex items-center justify-center space-x-2"
            >
              <span>Go to Team Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="panel rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/30">
                {mode === 'solo' ? <User className="w-6 h-6" /> : <Users className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">Register</h1>
                <p className="text-xs text-text-secondary">
                  Pitching solo or with a squad? Any valid email address is accepted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.03] border border-panel-border">
              <button
                type="button"
                onClick={() => handleModeChange('team')}
                className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'team' ? 'bg-brand-500 text-white shadow-brand-glow' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Register as a Team</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('solo')}
                className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'solo' ? 'bg-brand-500 text-white shadow-brand-glow' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Register Solo</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-panel-border text-[11px] text-text-secondary leading-relaxed space-y-1">
              <p><strong className="text-text-primary">Solo or team, no deadline:</strong> you can register alone and pitch by yourself, or as a team of up to 4. There&apos;s no cap on registrations and no closing date.</p>
              <p><strong className="text-text-primary">Domain & pool:</strong> every registrant (solo or team) is automatically assigned a startup domain and balanced into Pool A or B — this happens instantly on registration, no action needed.</p>
              {mode === 'team' && <p><strong className="text-text-primary">Adding teammates later:</strong> you&apos;ll get a join code after registering that you can share so teammates can join without you entering their emails now.</p>}
            </div>

            <Toast message={message} />

            <form onSubmit={handleSubmit} className="space-y-6">
              <HoneypotField value={honeypot} onChange={setHoneypot} />

              {/* Team Name */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">
                  {mode === 'solo' ? 'Your Pitch/Startup Name' : 'Startup Team Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Innovations"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-white/5 border border-panel-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              {/* Team Leader */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-panel-border space-y-3">
                <span className="text-xs font-bold text-brand-500 uppercase tracking-wider block">
                  {mode === 'solo' ? 'You' : 'Team Leader (You)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Your Email</label>
                    <input
                      type="email"
                      required
                      disabled
                      value={leaderEmail}
                      className="w-full bg-white/[0.02] border border-panel-border rounded-lg px-3 py-2 text-xs text-text-secondary cursor-not-allowed font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Team Members */}
              {mode === 'team' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Additional Team Members (optional, up to 3)
                    </span>
                    {members.length < 3 && (
                      <button
                        type="button"
                        onClick={handleAddMember}
                        className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 border border-brand-500/30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Member
                      </button>
                    )}
                  </div>

                  {members.length === 0 && (
                    <p className="text-[11px] text-text-secondary italic">
                      No teammates added yet — that&apos;s fine, you&apos;ll get a join code to invite them after registering.
                    </p>
                  )}

                  {members.map((member, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white/[0.03] border border-panel-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-secondary">Member #{idx + 2}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(idx)}
                          className="text-text-secondary hover:text-danger-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Member Name"
                          value={member.name}
                          onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                          className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
                        />
                        <input
                          type="email"
                          required
                          placeholder="member@example.com"
                          value={member.email}
                          onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                          className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <TurnstileWidget onToken={setTurnstileToken} />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-500/90 text-white transition-all shadow-brand-glow flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Assigning Domain & Pool...' : mode === 'solo' ? 'Register Solo & Assign Domain' : 'Register Team & Assign Domain'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
