'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/src/components/Navbar';
import PitchQueuePanel from '@/src/components/PitchQueuePanel';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import ManualOverrideModal from '@/src/components/ManualOverrideModal';
import DataManagementPanel from '@/src/components/DataManagementPanel';
import { triggerConfetti } from '@/src/components/ConfettiEffect';
import { ShieldAlert, Flame, Users, HelpCircle, Trophy, CheckCircle2, XCircle, Sparkles, FileSpreadsheet, Database } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry, ScoreAuditLog } from '@/src/lib/types';
import {
  reviewQuestionAction,
  qualifyFinalFourAction,
  exportRegistrationsCsvAction,
  exportLeaderboardCsvAction,
} from '@/src/app/actions/organiserActions';

export default function OrganiserPortalPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'registrations' | 'questions' | 'leaderboard' | 'audit' | 'data'>('control');

  const [eventState, setEventState] = useState<EventState | null>(null);
  const [pitches, setPitches] = useState<(Pitch & { teams?: Team })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>([]);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedOverrideEntry, setSelectedOverrideEntry] = useState<PitchLeaderboardEntry | null>(null);
  const [qualifySuccessMsg, setQualifySuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const fetchOrganiserData = useCallback(async () => {
    const supabase = createClient();

    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    setEventState((es as EventState) || null);

    const { data: pData } = await supabase
      .from('pitches')
      .select('*, teams(*)')
      .order('pitch_order', { ascending: true });
    setPitches((pData as any) || []);

    const { data: tData } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    setTeams((tData as Team[]) || []);

    const { data: tmData } = await supabase.from('team_members').select('*');
    setTeamMembers(tmData || []);

    const { data: qData } = await supabase
      .from('questions')
      .select('*, asking_team:teams(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingQuestions((qData as any) || []);

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

  const downloadCsv = (csv: string, filename: string) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + csv;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRegistrationsCSV = async () => {
    const res = await exportRegistrationsCsvAction();
    if (res.error || !res.csv) {
      alert(res.error || 'Failed to export CSV.');
      return;
    }
    downloadCsv(res.csv, `the_pitch_league_teams_${Date.now()}.csv`);
  };

  const exportLeaderboardCSV = async () => {
    const res = await exportLeaderboardCsvAction('prelim');
    if (res.error || !res.csv) {
      alert(res.error || 'Failed to export leaderboard CSV.');
      return;
    }
    downloadCsv(res.csv, `the_pitch_league_results_${Date.now()}.csv`);
  };

  const tabs = [
    { key: 'control' as const, label: 'Live Control Room', icon: Flame, badge: null, active: 'bg-brand-500 text-white shadow-brand-glow' },
    { key: 'questions' as const, label: 'Question Queue', icon: HelpCircle, badge: pendingQuestions.length, active: 'bg-accent-live text-white shadow-live-glow' },
    { key: 'leaderboard' as const, label: 'Live Leaderboard & Overrides', icon: Trophy, badge: null, active: 'bg-accent-warm text-bg-base shadow-warm-glow' },
    { key: 'registrations' as const, label: `Team Registrations (${teams.length})`, icon: Users, badge: null, active: 'bg-brand-500 text-white shadow-brand-glow' },
    { key: 'audit' as const, label: `Score Audit Log (${auditLogs.length})`, icon: ShieldAlert, badge: null, active: 'bg-white/10 text-text-primary' },
    { key: 'data' as const, label: 'Data Management', icon: Database, badge: null, active: 'bg-danger-500 text-white' },
  ];

  if (loadingData) {
    return (
      <div className="min-h-screen flex flex-col" data-density="dense">
        <Navbar userRole="organiser" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-text-secondary font-mono">Loading control room...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" data-density="dense">
      <Navbar userRole="organiser" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* ORGANISER TABS HEADER */}
        <div className="panel rounded-2xl p-2 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 relative ${
                activeTab === tab.key ? tab.active : 'bg-white/5 text-text-secondary hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {!!tab.badge && (
                <span className="w-5 h-5 rounded-full bg-danger-500 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
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
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-accent-warm via-amber-500 to-yellow-400 text-bg-base shadow-warm-glow hover:scale-105 transition-all flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Reveal Final 4 & Qualify</span>
              </button>
            </div>

            {qualifySuccessMsg && (
              <div className="p-4 rounded-xl bg-success-500/15 text-success-500 border border-success-500/40 text-xs font-bold text-center">
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
          <div className="card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-accent-live" />
                  <span>Incoming Question Queue</span>
                </h2>
                <p className="text-xs text-text-secondary">Review rival team questions and score their Q&A performance.</p>
              </div>
              <span className="text-xs font-mono font-bold text-accent-live">{pendingQuestions.length} Pending</span>
            </div>

            {pendingQuestions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-success-500 mx-auto" />
                <h4 className="font-bold text-text-primary">Question Queue Clear</h4>
                <p className="text-xs text-text-secondary">Incoming questions submitted by teams will appear here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingQuestions.map((q) => (
                  <div key={q.id} className="p-4 rounded-xl bg-white/[0.03] border border-panel-border space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Asked by: <strong className="text-brand-500 font-bold">{q.asking_team?.team_name}</strong></span>
                      <span className="text-text-secondary/70 font-mono">{new Date(q.created_at).toLocaleTimeString()}</span>
                    </div>

                    <p className="text-sm text-text-primary font-medium bg-black/20 p-3 rounded-lg border border-panel-border">
                      &ldquo;{q.question_text}&rdquo;
                    </p>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleQuestionReview(q.id, 'rejected')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-danger-500/15 text-text-secondary hover:text-danger-500 border border-panel-border transition-colors flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_well')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success-500/15 hover:bg-success-500/25 text-success-500 border border-success-500/40 transition-colors flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Team Answered Well (+1 Team / 0 Asker)</span>
                      </button>

                      <button
                        onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_poorly')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-live/15 hover:bg-accent-live/25 text-accent-live border border-accent-live/40 transition-colors flex items-center space-x-1"
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
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={exportLeaderboardCSV}
                className="px-4 py-2 rounded-xl font-bold text-xs bg-accent-warm/15 hover:bg-accent-warm/25 text-accent-warm border border-accent-warm/40 transition-all flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Results CSV</span>
              </button>
            </div>
            <LiveLeaderboard
              roundName="prelim"
              showOverrideButton={true}
              onOverrideClick={(entry) => setSelectedOverrideEntry(entry)}
            />
          </div>
        )}

        {/* TAB 4: TEAM REGISTRATIONS TABLE */}
        {activeTab === 'registrations' && (
          <div className="card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
                  <Users className="w-5 h-5 text-brand-500" />
                  <span>Registered Startup Teams</span>
                </h2>
                <p className="text-xs text-text-secondary">Full list of teams, assigned sector domains, pools, and members.</p>
              </div>

              <button
                onClick={exportRegistrationsCSV}
                className="px-4 py-2 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white border border-brand-500/40 shadow-brand-glow transition-all flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-panel-border text-text-secondary uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Pool</th>
                    <th className="py-3 px-4">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel-border">
                  {teams.map((t) => {
                    const members = teamMembers.filter((m) => m.team_id === t.id);

                    return (
                      <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 font-bold text-text-primary">{t.team_name}</td>
                        <td className="py-3 px-4 text-accent-warm">{t.domain}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-bold bg-brand-500/15 text-brand-500 border border-brand-500/30">
                            Pool {t.pool}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {members.map((m) => (
                              <div key={m.id} className="text-text-secondary">
                                <strong className="text-text-primary/80">{m.name}</strong> <span className="text-text-secondary/70 font-mono text-[10px]">({m.email})</span>
                                {m.is_leader && <span className="ml-1 text-[10px] text-brand-500 font-bold">[Leader]</span>}
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

        {/* TAB 6: DATA MANAGEMENT (organiser-only; deleteTeamsAction /
            fullEventResetAction re-check requireRole('organiser') server-side
            regardless of this tab being reachable in the UI) */}
        {activeTab === 'data' && (
          <DataManagementPanel teams={teams} onDataChange={fetchOrganiserData} />
        )}

        {/* TAB 5: SCORE AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-accent-warm" />
                  <span>Manual Override Audit Log</span>
                </h2>
                <p className="text-xs text-text-secondary">Automated log of all organiser manual score overrides and judge score unlocks.</p>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-text-secondary/70 italic py-6 text-center">No manual overrides logged yet.</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-panel-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-accent-warm">Table: {log.table_changed}</span>
                      <span className="text-[10px] text-text-secondary font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-text-secondary">Note: <strong className="text-text-primary">{log.note}</strong></p>
                    <div className="text-[10px] text-text-secondary font-mono flex items-center space-x-4">
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
