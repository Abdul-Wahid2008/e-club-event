'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import ManualOverrideModal from '@/src/components/ManualOverrideModal';
import { triggerConfetti } from '@/src/components/ConfettiEffect';
import PoolBadge from '@/src/components/PoolBadge';
import { SkeletonCard } from '@/src/components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';
import { ShieldAlert, Flame, Users, HelpCircle, Trophy, Play, CheckCircle2, XCircle, Sparkles, FileSpreadsheet, Inbox } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry, ScoreAuditLog } from '@/src/lib/types';
import {
  setLivePitchAction,
  updateTimerStateAction,
  reviewQuestionAction,
  qualifyFinalFourAction,
  exportRegistrationsCsvAction,
} from '@/src/app/actions/organiserActions';

export default function OrganiserPortalPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'registrations' | 'questions' | 'leaderboard' | 'audit'>('control');
  const reducedMotion = usePrefersReducedMotion();

  const [eventState, setEventState] = useState<EventState | null>(null);
  const [pitches, setPitches] = useState<(Pitch & { teams?: Team })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [selectedOverrideEntry, setSelectedOverrideEntry] = useState<PitchLeaderboardEntry | null>(null);
  const [qualifySuccessMsg, setQualifySuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [reviewingQuestionId, setReviewingQuestionId] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const fetchOrganiserData = async () => {
    const supabase = createClient();

    // Event State
    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    if (es) setEventState(es as EventState);

    // Pitches with Team info
    const { data: pData } = await supabase
      .from('pitches')
      .select('*, teams(*)')
      .order('pitch_order', { ascending: true });
    if (pData) setPitches(pData as any);

    // Teams
    const { data: tData } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
    if (tData) setTeams(tData as Team[]);

    // Team Members
    const { data: tmData } = await supabase.from('team_members').select('*');
    if (tmData) setTeamMembers(tmData);

    // Pending Questions Queue
    const { data: qData } = await supabase
      .from('questions')
      .select('*, asking_team:teams(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (qData) setPendingQuestions(qData as any);

    // Audit Log
    const { data: auditData } = await supabase
      .from('score_audit_log')
      .select('*')
      .order('timestamp', { ascending: false });
    if (auditData) setAuditLogs(auditData as ScoreAuditLog[]);

    setInitialLoading(false);
  };

  useEffect(() => {
    fetchOrganiserData();

    const supabase = createClient();
    const channel = supabase
      .channel('organiser_portal_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchOrganiserData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_audit_log' }, () => fetchOrganiserData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSetLivePitch = async (pitchId: string) => {
    if (loadingAction) return;
    setLoadingAction(true);
    await setLivePitchAction(pitchId);
    setLoadingAction(false);
    fetchOrganiserData();
  };

  const handleTimerChange = async (phase: any, duration?: number) => {
    await updateTimerStateAction(phase, duration);
    fetchOrganiserData();
  };

  const handleQuestionReview = async (
    questionId: string,
    status: 'approved' | 'rejected',
    outcome?: 'team_answered_well' | 'team_answered_poorly' | null
  ) => {
    if (reviewingQuestionId) return; // in-flight guard against double taps
    setReviewingQuestionId(questionId);
    await reviewQuestionAction(questionId, status, outcome);
    setReviewingQuestionId(null);
    fetchOrganiserData();
  };

  const handleQualifyFinalFour = async () => {
    if (loadingAction) return;
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
    if (exportingCsv) return;
    setExportingCsv(true);
    const res = await exportRegistrationsCsvAction();
    setExportingCsv(false);

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

  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
        <Navbar userRole="organiser" />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar userRole="organiser" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Timer with Organiser Controls */}
        <CountdownTimer
          initialState={eventState || undefined}
          showControls={true}
          onPhaseChange={handleTimerChange}
        />

        {/* ORGANISER TABS HEADER — only one saturated accent (brand-600) active per tab */}
        <div className="card rounded-2xl p-2 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center space-x-2 ${
              activeTab === 'control'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-base text-ink-600 hover:bg-ink-900/10'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Live Control Room</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center space-x-2 relative ${
              activeTab === 'questions'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-base text-ink-600 hover:bg-ink-900/10'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Question Queue</span>
            {pendingQuestions.length > 0 && (
              <span className="tabular-nums w-5 h-5 rounded-full bg-accent-500 text-white font-bold text-[10px] flex items-center justify-center">
                {pendingQuestions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center space-x-2 ${
              activeTab === 'leaderboard'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-base text-ink-600 hover:bg-ink-900/10'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Live Leaderboard &amp; Overrides</span>
          </button>

          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center space-x-2 ${
              activeTab === 'registrations'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-base text-ink-600 hover:bg-ink-900/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Registrations ({teams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-base text-ink-600 hover:bg-ink-900/10'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Score Audit Log ({auditLogs.length})</span>
          </button>
        </div>

        {/* TAB 1: LIVE CONTROL PANEL */}
        {activeTab === 'control' && (
          <div className="space-y-8">
            <div className="card rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink-900 flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-brand-600" />
                    <span>Live Pitch Selector</span>
                  </h2>
                  <p className="text-xs text-ink-600">Selecting a pitch flips every Team and Judge screen instantly in real-time.</p>
                </div>

                <button
                  onClick={handleQualifyFinalFour}
                  disabled={loadingAction}
                  aria-busy={loadingAction}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-accent-warm text-ink-900 hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center space-x-2 shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loadingAction ? 'Qualifying...' : 'Reveal Final 4 & Qualify'}</span>
                </button>
              </div>

              <AnimatePresence>
                {qualifySuccessMsg && (
                  <motion.div
                    initial={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    role="status"
                    className="p-4 rounded-xl bg-green-50 text-ink-900 border border-success-600/30 text-xs font-semibold text-center"
                  >
                    {qualifySuccessMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pitches.map((p) => {
                  const isLive = p.id === eventState?.current_pitch_id;
                  const team = p.teams;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-colors space-y-3 ${
                        isLive
                          ? 'bg-blue-50 border-brand-600'
                          : 'bg-surface-base border-ink-900/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink-600">Pitch #{p.pitch_order}</span>
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-500 text-white">
                            LIVE NOW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white text-ink-600 border border-ink-900/10 uppercase">
                            {p.status}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-semibold text-ink-900">{team?.team_name || 'Unassigned'}</h4>
                        <div className="flex items-center gap-2 text-xs text-ink-600">
                          <span>Domain: {team?.domain}</span>
                          {team?.pool && <PoolBadge pool={team.pool} />}
                        </div>
                      </div>

                      {!isLive ? (
                        <button
                          onClick={() => handleSetLivePitch(p.id)}
                          disabled={loadingAction}
                          className="w-full py-2 rounded-lg font-semibold text-xs bg-white hover:bg-brand-600 hover:text-white text-ink-900 border border-ink-900/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Set Live Pitch</span>
                        </button>
                      ) : (
                        <div className="text-center py-1 text-xs font-semibold text-brand-700">
                          Active on All Devices
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUESTION QUEUE */}
        {activeTab === 'questions' && (
          <div className="card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink-900 flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-accent-500" />
                  <span>Incoming Question Queue</span>
                </h2>
                <p className="text-xs text-ink-600">Review rival team questions and score their Q&amp;A performance.</p>
              </div>
              <span className="tabular-nums text-xs font-semibold text-accent-500">{pendingQuestions.length} Pending</span>
            </div>

            {pendingQuestions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-success-600 mx-auto" />
                <h4 className="font-semibold text-ink-900">Question Queue Clear</h4>
                <p className="text-xs text-ink-600">Incoming questions submitted by teams will appear here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {pendingQuestions.map((q) => {
                    const isReviewing = reviewingQuestionId === q.id;
                    return (
                      <motion.div
                        key={q.id}
                        layout={!reducedMotion}
                        initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, x: 20 }}
                        className="p-4 rounded-xl bg-surface-base border border-ink-900/10 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink-600">Asked by: <strong className="text-brand-700 font-semibold">{q.asking_team?.team_name}</strong></span>
                          <span className="tabular-nums text-ink-600">{new Date(q.created_at).toLocaleTimeString()}</span>
                        </div>

                        <p className="text-sm text-ink-900 font-medium bg-white p-3 rounded-lg border border-ink-900/10">
                          &ldquo;{q.question_text}&rdquo;
                        </p>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleQuestionReview(q.id, 'rejected')}
                            disabled={isReviewing}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-ink-600 hover:text-danger-600 border border-ink-900/10 disabled:opacity-60 transition-colors flex items-center space-x-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_well')}
                            disabled={isReviewing}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 hover:bg-green-100 text-success-600 border border-success-600/30 disabled:opacity-60 transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isReviewing ? 'Saving...' : 'Approve & Team Answered Well (+1 Team / 0 Asker)'}</span>
                          </button>

                          <button
                            onClick={() => handleQuestionReview(q.id, 'approved', 'team_answered_poorly')}
                            disabled={isReviewing}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-accent-500 border border-accent-500/30 disabled:opacity-60 transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isReviewing ? 'Saving...' : 'Approve & Poor Answer (+1 Asker / -1 Team)'}</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
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
          <div className="card rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink-900 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-brand-600" />
                  <span>Registered Startup Teams</span>
                </h2>
                <p className="text-xs text-ink-600">Full list of teams, assigned sector domains, pools, and members.</p>
              </div>

              <button
                onClick={exportRegistrationsCSV}
                disabled={exportingCsv}
                aria-busy={exportingCsv}
                className="px-4 py-2 rounded-xl font-semibold text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center space-x-2 shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                <Inbox className="w-10 h-10 text-ink-900/20" />
                <h4 className="font-semibold text-ink-900">No Teams Registered Yet</h4>
                <p className="text-xs text-ink-600">Registered teams will appear here as they sign up.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-ink-900/10 text-ink-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Team Name</th>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Pool</th>
                      <th className="py-3 px-4">Members</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-900/10">
                    {teams.map((t) => {
                      const members = teamMembers.filter((m) => m.team_id === t.id);

                      return (
                        <tr key={t.id} className="hover:bg-surface-base transition-colors">
                          <td className="py-3 px-4 font-semibold text-ink-900">{t.team_name}</td>
                          <td className="py-3 px-4 text-ink-900">{t.domain}</td>
                          <td className="py-3 px-4">
                            <PoolBadge pool={t.pool} />
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {members.map((m) => (
                                <div key={m.id} className="text-ink-600">
                                  <strong className="text-ink-900">{m.name}</strong> <span className="text-[10px]">({m.email})</span>
                                  {m.is_leader && <span className="ml-1 text-[10px] text-brand-700 font-semibold">[Leader]</span>}
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
            )}
          </div>
        )}

        {/* TAB 5: SCORE AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="card rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-ink-900 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-accent-warm" />
                <span>Manual Override Audit Log</span>
              </h2>
              <p className="text-xs text-ink-600">Automated log of all organiser manual score overrides and judge score unlocks.</p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <Inbox className="w-10 h-10 text-ink-900/20" />
                <p className="text-xs text-ink-600">No manual overrides logged yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-surface-base border border-ink-900/10 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink-900">Table: {log.table_changed}</span>
                      <span className="tabular-nums text-[10px] text-ink-600">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-ink-600">Note: <strong className="text-ink-900">{log.note}</strong></p>
                    <div className="text-[10px] text-ink-600 flex items-center space-x-4">
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
