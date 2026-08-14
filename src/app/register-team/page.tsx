'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import { Users, Plus, Trash2, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { registerTeamAction } from '@/src/app/actions/authActions';
import { isValidEmailFormat } from '@/src/lib/validation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';
import PoolBadge from '@/src/components/PoolBadge';

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
    if (loading) return;
    setError(null);

    // CLIENT-SIDE VALIDATION FOR ALL TEAM MEMBERS: format only, any domain allowed
    const allEmails = [leaderEmail, ...members.map((m) => m.email)];
    const invalidList = allEmails.filter((em) => !isValidEmailFormat(em));

    if (invalidList.length > 0) {
      setError(
        `All team member emails must be valid. Invalid email(s): ${invalidList.join(', ')}`
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
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full">
        {assignedResult ? (
          <div className="card rounded-3xl p-8 text-center space-y-6 shadow-card-lg border-brand-600/20">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-ink-900">Team Successfully Registered!</h1>
              <p className="text-sm text-ink-600">
                Welcome <span className="text-brand-700 font-semibold">{assignedResult.teamName}</span> to Pitch Under Pressure!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
              <div className="card rounded-2xl p-5">
                <span className="text-xs uppercase tracking-wider text-ink-600 block mb-1">
                  Randomly Assigned Domain
                </span>
                <span className="text-lg font-semibold text-ink-900">{assignedResult.domain}</span>
              </div>

              <div className="card rounded-2xl p-5">
                <span className="text-xs uppercase tracking-wider text-ink-600 block mb-1">
                  Auto-Balanced Pool
                </span>
                <PoolBadge pool={assignedResult.pool} className="text-sm" />
              </div>
            </div>

            <button
              onClick={() => router.push('/portal/team')}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white transition-colors flex items-center justify-center space-x-2"
            >
              <span>Go to Team Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="card rounded-3xl p-8 space-y-6 shadow-card-lg">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Register Team</h1>
                <p className="text-xs text-ink-600">
                  Add 2 to 4 total members. Any valid email address is accepted.
                </p>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3.5 rounded-xl text-xs font-semibold bg-red-50 text-ink-900 border border-danger-600/30 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Team Name */}
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1 uppercase tracking-wider">
                  Startup Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Innovations"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-surface-base border border-ink-900/15 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 transition-colors"
                />
              </div>

              {/* Team Leader */}
              <div className="p-4 rounded-2xl bg-surface-base border border-ink-900/10 space-y-3">
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider block">
                  Team Leader (You)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-ink-600 mb-1">Leader Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full bg-white border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-600 mb-1">Leader Email</label>
                    <input
                      type="email"
                      required
                      disabled
                      value={leaderEmail}
                      className="w-full bg-ink-900/5 border border-ink-900/10 rounded-lg px-3 py-2 text-xs text-ink-600 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Team Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-600 uppercase tracking-wider">
                    Additional Team Members (1 to 3)
                  </span>
                  {members.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-brand-700 border border-brand-600/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Member
                    </button>
                  )}
                </div>

                {members.map((member, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-surface-base border border-ink-900/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-600">Member #{idx + 2}</span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(idx)}
                          aria-label={`Remove member ${idx + 2}`}
                          className="text-ink-600 hover:text-danger-600 transition-colors"
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
                        className="w-full bg-white border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
                      />
                      <input
                        type="email"
                        required
                        placeholder="member@example.com"
                        value={member.email}
                        onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                        className="w-full bg-white border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Assigning Domain & Pool...' : 'Register Team & Assign Domain'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
