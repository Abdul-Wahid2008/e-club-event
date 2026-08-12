'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import { Users, Plus, Trash2, ShieldAlert, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { registerTeamAction } from '@/src/app/actions/authActions';
import { isValidNitwEmail } from '@/src/lib/validation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

export default function RegisterTeamPage() {
  const router = useRouter();

  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');

  // Additional members (1 to 3 members -> total 2 to 4)
  const [members, setMembers] = useState<{ name: string; email: string }[]>([
    { name: '', email: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedResult, setAssignedResult] = useState<{
    teamName: string;
    domain: string;
    pool: 'A' | 'B';
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
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const handleMemberChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // CLIENT-SIDE VALIDATION FOR ALL TEAM MEMBERS (REQUIREMENT 1)
    const allEmails = [leaderEmail, ...members.map((m) => m.email)];
    const invalidList = allEmails.filter((em) => !isValidNitwEmail(em));

    if (invalidList.length > 0) {
      setError(
        `All team members must use official @nitw.ac.in emails. Invalid email(s): ${invalidList.join(', ')}`
      );
      return;
    }

    setLoading(true);
    const res = await registerTeamAction({
      teamName,
      leaderName,
      leaderEmail,
      members,
    });
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.success && res.domain && res.pool) {
      setAssignedResult({
        teamName,
        domain: res.domain,
        pool: res.pool,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full">
        {assignedResult ? (
          <div className="glass-panel rounded-3xl p-8 border border-brand-cyan/40 text-center space-y-6 shadow-cyan-glow">
            <div className="w-16 h-16 rounded-2xl bg-brand-cyan/20 text-brand-cyan flex items-center justify-center mx-auto border border-brand-cyan/40 shadow-cyan-glow">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-white">Team Successfully Registered!</h1>
              <p className="text-sm text-gray-300">
                Welcome <span className="text-brand-cyan font-bold">{assignedResult.teamName}</span> to Pitch Under Pressure!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
              <div className="glass-card rounded-2xl p-5 border border-surface-border">
                <span className="text-xs uppercase font-mono tracking-wider text-gray-400 block mb-1">
                  Randomly Assigned Domain
                </span>
                <span className="text-lg font-extrabold text-brand-gold">{assignedResult.domain}</span>
              </div>

              <div className="glass-card rounded-2xl p-5 border border-surface-border">
                <span className="text-xs uppercase font-mono tracking-wider text-gray-400 block mb-1">
                  Auto-Balanced Pool
                </span>
                <span className="text-lg font-extrabold text-brand-cyan">Pool {assignedResult.pool}</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/portal/team')}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2"
            >
              <span>Go to Team Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 border border-surface-border space-y-6 shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center border border-brand-cyan/30">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">Register Team</h1>
                <p className="text-xs text-gray-400">
                  Add 2 to 4 total members. All emails MUST end with <span className="text-brand-cyan font-bold font-mono">@student.nitw.ac.in</span>.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Team Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 uppercase tracking-wider">
                  Startup Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Innovations"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-cyan transition-colors"
                />
              </div>

              {/* Team Leader */}
              <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-3">
                <span className="text-xs font-bold text-brand-cyan uppercase tracking-wider block">
                  Team Leader (You)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Leader Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Leader @student.nitw.ac.in Email</label>
                    <input
                      type="email"
                      required
                      disabled
                      value={leaderEmail}
                      className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Team Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Additional Team Members (1 to 3)
                  </span>
                  {members.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Member
                    </button>
                  )}
                </div>

                {members.map((member, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400">Member #{idx + 2}</span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(idx)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Member Name"
                        value={member.name}
                        onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
                      />
                      <input
                        type="email"
                        required
                        placeholder="ab25chb0b26@student.nitw.ac.in"
                        value={member.email}
                        onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-all shadow-cyan-glow flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Assigning Domain & Pool...' : 'Register Team & Assign Domain'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
