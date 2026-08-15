'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/src/components/Navbar';
import PitchQueuePanel from '@/src/components/PitchQueuePanel';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import ManualOverrideModal from '@/src/components/ManualOverrideModal';
import { triggerConfetti } from '@/src/components/ConfettiEffect';
import { ShieldAlert, Flame, Users, HelpCircle, Trophy, Sparkles, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry, ScoreAuditLog } from '@/src/lib/types';
import {
  reviewQuestionAction,
  qualifyFinalFourAction,
  exportRegistrationsCsvAction,
} from '@/src/app/actions/organiserActions';

export default function OrganiserPortalPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'registrations' | 'questions' | 'leaderboard' | 'audit'>('control');

  const [eventState, setEventState] = useState<EventState | null>(null);
  const [pitches, setPitches] = useState<(Pitch & { teams?: Team })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedOverrideEntry, setSelectedOverrideEntry] = useState<PitchLeaderboardEntry | null>(null);
  const [qualifySuccessMsg, setQualifySuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard] = useState<PitchLeaderboardEntry[]>([]);

  const fetchOrganiserData = useCallback(async () => {
    const supabase = createClient();

    // Event State
    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    setEventState((es as EventState) || null);

    // Pitches with Team info
    const { data: pData } = await supabase
      .from('pitches')
      .select('*, teams(*)')
      .order('pitch_order', { ascending: true });
    setPitches((pData as any) || []);

    // Teams
    const { data: tData } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    setTeams((tData as Team[]) || []);

    // Team Members
    const { data: tmData } = await supabase.from('team_members').select('*');
    setTeamMembers(tmData || []);

    // Pending Questions Queue
    const { data: qData } = await supabase
      .from('questions')
      .select('*, asking_team:teams(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingQuestions((qData as any) || []);

    // Approved Q&A context for the currently-called pitch
    if (es?.current_pitch_id) {
      const { data: aqData } = await supabase
        .from('questions')
        .select('*, asking_team:teams(*)')
        .eq('pitch_id', es.current_pitch_id)
        .eq('status', 'approved');
      setApprovedQuestions((aqData as any) || []);
    } else {
      setApprovedQuestions([]);
    }

    // Leaderboard (for Scored info surfaced via PitchQueuePanel + Manual Override)
    const { data: lbData } = await supabase.from('pitch_leaderboard').select('*').eq('round_name', 'prelim');
    setLeaderboard((lbData as PitchLeaderboardEntry[]) || []);

    // Audit Log
    const { data: auditData } = await supabase
      .from('score_audit_log')
      .select('*')
      .order('timestamp', { ascending: false });
    setAuditLogs((auditData as ScoreAuditLog[]) || []);

    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchOrganiserData();

    const supabase = createClient();
    const channel = supabase
      .channel('organiser_portal_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_scores' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_audit_log' }, () => fetchOrganiserData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrganiserData]);

  const handleQuestionReview = async (
    questionId: string,
    status: 'approved' | 'rejected',
    outcome?: 'team_answered_well' | 'team_answered_poorly' | null
  ) => {
    await reviewQuestionAction(questionId, status, outcome);
    fetchOrganiserData();
  };

  const handleQualifyFinalFour = async () => {
    setLoadingAction(true);
    setQualifySuccessMsg(null);

    const res = await qualifyFinalFourAction();
    setLoadingAction(false);

    if (res.success) {
      triggerConfetti();
      setQualifySuccessMsg('Top 2 Pool A & Top 2 Pool B Qualified for Final 4!');
      fetchOrganiserData();
    }
  };

  const exportRegistrationsCSV = async () => {
    const res = await exportRegistrationsCsvAction();
    if (res.error || !res.csv) {
      alert(res.error || 'Failed to export CSV.');
      return;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + res.csv;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pitch_under_pressure_teams_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-gray-100">
        <Navbar userRole="organiser" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 font-mono">Loading control room...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole="organiser" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* ORGANISER TABS HEADER */}
        <div className="glass-panel rounded-2xl p-2 border border-surface-border flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'control'
                ? 'bg-brand-cyan text-black shadow-cyan-glow'
                : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Live Control Room</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 relative ${
              activeTab === 'questions'
                ? 'bg-brand-pink text-white shadow-purple-glow'
                : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Question Queue</span>
            {pendingQuestions.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white font-mono font-bold text-[10px] flex items-center justify-center animate-pulse">
                {pendingQuestions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'leaderboard'
                ? 'bg-brand-gold text-black shadow-gold-glow'
                : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Live Leaderboard & Overrides</span>
          </button>

          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'registrations'
                ? 'bg-brand-purple text-white shadow-purple-glow'
                : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Registrations ({teams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Score Audit Log ({auditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: LIVE CONTROL PANEL — reuses the exact same PitchQueuePanel
            component as the Judge Portal so queue/timer/scoring controls
            can never drift out of sync between the two roles. */}
        {activeTab === 'control' && (
          <div className="space-y-8">
            <div className="flex items-center justify-end">
              <button
                onClick={handleQualifyFinalFour}
                disabled={loadingAction}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-brand-gold via-amber-500 to-yellow-400 text-black shadow-gold-glow hover:scale-105 transition-all flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Reveal Final 4 & Qualify</span>
              </button>
            </div>

            {qualifySuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold text-center">
                {qualifySuccessMsg}
              </div>
            )}

            <PitchQueuePanel
              eventState={eventState}
              pitches={pitches}
              approvedQuestions={approvedQuestions}
              onDataChange={fetchOrganiserData}
            />
          </div>
        )}

        {/* TAB 2: QUESTION QUEUE */}
        {activeTab === 'questions' && (
          <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-brand-pink" />
                  <span>Incoming Question Queue</span>
                </h2>
                <p className="text-xs text-gray-400">Review rival team questions and score their Q&A performance.</p>
              </div>
              <span className="text-xs font-mono font-bold text-brand-pink">{pendingQuestions.length} Pending</span>
            </div>

            {pendingQuestions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-gray-300">Question Queue Clear</h4>
                <p className="text-xs text-gray-500">Incoming questions submitted by teams will appear here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingQuestions.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-gray-900/90 border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Asked by: <strong className="text-brand-cyan font-bold">{q.asking_team?.team_name}</strong></span>
                      <span className="text-gray-500 font-mono">{new Date(q.created_at).toLocaleTimeString()}</span>
                    </div>

                    <p className="text-sm text-white font-medium bg-gray-950 p-3 rounded-lg border border-gray-800">
                      &ldquo;{q.question_text}&rdquo;
                    </p>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleQuestionReview(q.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-gray-700 transition-colors flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_well')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Team Answered Well (+1 Team / 0 Asker)</span>
                      </button>

                      <button
                        onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_poorly')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-pink/20 hover:bg-brand-pink/30 text-brand-pink border border-brand-pink/40 transition-colors flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Poor Answer (+1 Asker / -1 Team)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE LEADERBOARD & MANUAL OVERRIDES */}
        {activeTab === 'leaderboard' && (
          <LiveLeaderboard
            roundName="prelim"
            showOverrideButton={true}
            onOverrideClick={(entry) => setSelectedOverrideEntry(entry)}
          />
        )}

        {/* TAB 4: TEAM REGISTRATIONS TABLE */}
        {activeTab === 'registrations' && (
          <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-brand-purple" />
                  <span>Registered Startup Teams</span>
                </h2>
                <p className="text-xs text-gray-400">Full list of teams, assigned sector domains, pools, and members.</p>
              </div>

              <button
                onClick={exportRegistrationsCSV}
                className="px-4 py-2 rounded-xl font-bold text-xs bg-brand-purple hover:bg-brand-purple/90 text-white border border-brand-purple/40 shadow-purple-glow transition-all flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Pool</th>
                    <th className="py-3 px-4">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {teams.map((t) => {
                    const members = teamMembers.filter((m) => m.team_id === t.id);

                    return (
                      <tr key={t.id} className="hover:bg-gray-900/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{t.team_name}</td>
                        <td className="py-3 px-4 text-brand-gold">{t.domain}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                            Pool {t.pool}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {members.map((m) => (
                              <div key={m.id} className="text-gray-300">
                                <strong>{m.name}</strong> <span className="text-gray-500 font-mono text-[10px]">({m.email})</span>
                                {m.is_leader && <span className="ml-1 text-[10px] text-brand-cyan font-bold">[Leader]</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SCORE AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>Manual Override Audit Log</span>
                </h2>
                <p className="text-xs text-gray-400">Automated log of all organiser manual score overrides and judge score unlocks.</p>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-6 text-center">No manual overrides logged yet.</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">Table: {log.table_changed}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-200">Note: <strong className="text-white">{log.note}</strong></p>
                    <div className="text-[10px] text-gray-400 font-mono flex items-center space-x-4">
                      <span>Row ID: {log.row_id}</span>
                      <span>New Value: {JSON.stringify(log.new_value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Manual Override Modal */}
      {selectedOverrideEntry && (
        <ManualOverrideModal
          entry={selectedOverrideEntry}
          onClose={() => setSelectedOverrideEntry(null)}
        />
      )}
    </div>
  );
}
