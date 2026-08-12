'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import ManualOverrideModal from '@/src/components/ManualOverrideModal';
import { triggerConfetti } from '@/src/components/ConfettiEffect';
import { ShieldAlert, Flame, Users, HelpCircle, Trophy, Download, Play, CheckCircle2, XCircle, Sparkles, Lock, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry, ScoreAuditLog } from '@/src/lib/types';
import {
  setLivePitchAction,
  updateTimerStateAction,
  reviewQuestionAction,
  qualifyFinalFourAction,
} from '@/src/app/actions/organiserActions';

const MOCK_TEAMS: Team[] = [
  { id: 'mock-team-1', auth_user_id: 'u1', team_name: 'MedPulse AI', domain: 'Healthcare', pool: 'A', status: 'registered', created_at: new Date().toISOString() },
  { id: 'mock-team-2', auth_user_id: 'u2', team_name: 'EcoDrive Mobility', domain: 'Mobility', pool: 'B', status: 'registered', created_at: new Date().toISOString() },
  { id: 'mock-team-3', auth_user_id: 'u3', team_name: 'FinFlex Pay', domain: 'FinTech', pool: 'A', status: 'registered', created_at: new Date().toISOString() },
  { id: 'mock-team-4', auth_user_id: 'u4', team_name: 'AgriGrow Tech', domain: 'Agriculture', pool: 'B', status: 'registered', created_at: new Date().toISOString() },
];

const MOCK_PITCHES: (Pitch & { teams?: Team })[] = [
  { id: 'mock-pitch-1', team_id: 'mock-team-1', round_id: 'r1', status: 'live', pitch_order: 1, teams: MOCK_TEAMS[0] },
  { id: 'mock-pitch-2', team_id: 'mock-team-2', round_id: 'r1', status: 'done', pitch_order: 2, teams: MOCK_TEAMS[1] },
  { id: 'mock-pitch-3', team_id: 'mock-team-3', round_id: 'r1', status: 'upcoming', pitch_order: 3, teams: MOCK_TEAMS[2] },
  { id: 'mock-pitch-4', team_id: 'mock-team-4', round_id: 'r1', status: 'upcoming', pitch_order: 4, teams: MOCK_TEAMS[3] },
];

const MOCK_EVENT_STATE: EventState = {
  id: 1,
  current_pitch_id: 'mock-pitch-1',
  current_round_id: 'r1',
  timer_phase: 'pitch',
  timer_duration_seconds: 180,
  timer_started_at: new Date(Date.now() - 45000).toISOString(),
  timer_paused_remaining: null,
  updated_at: new Date().toISOString(),
};

const MOCK_PENDING_QUESTIONS: Question[] = [
  {
    id: 'mock-q-201',
    asking_team_id: 'mock-team-2',
    pitch_id: 'mock-pitch-1',
    question_text: 'What is your customer acquisition cost strategy for onboarding rural hospital networks?',
    status: 'pending',
    outcome: null,
    points_to_team: 0,
    points_to_asker: 0,
    created_at: new Date(Date.now() - 60000).toISOString(),
    asking_team: MOCK_TEAMS[1],
  },
];

const MOCK_MEMBERS = [
  { id: 'm1', team_id: 'mock-team-1', name: 'Sai Varun', email: 'saivarun@student.nitw.ac.in', is_leader: true },
  { id: 'm2', team_id: 'mock-team-1', name: 'Rohan Sharma', email: 'rohan@student.nitw.ac.in', is_leader: false },
  { id: 'm3', team_id: 'mock-team-2', name: 'Ananya Rao', email: 'ananya@student.nitw.ac.in', is_leader: true },
  { id: 'm4', team_id: 'mock-team-2', name: 'Vikram Singh', email: 'vikram@student.nitw.ac.in', is_leader: false },
  { id: 'm5', team_id: 'mock-team-3', name: 'Kavya Patel', email: 'kavya@student.nitw.ac.in', is_leader: true },
  { id: 'm6', team_id: 'mock-team-4', name: 'Aditya Verma', email: 'aditya@student.nitw.ac.in', is_leader: true },
];

const MOCK_AUDIT_LOGS: ScoreAuditLog[] = [
  {
    id: 'a1',
    changed_by: 'org-1',
    table_changed: 'judge_scores',
    row_id: 'score-99',
    old_value: { score: 7, locked: true },
    new_value: { score: 9, locked: true },
    note: 'Corrected typo in Judge Dr. Sharma problem_market score.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export default function OrganiserPortalPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'registrations' | 'questions' | 'leaderboard' | 'audit'>('control');

  const [eventState, setEventState] = useState<EventState | null>(MOCK_EVENT_STATE);
  const [pitches, setPitches] = useState<(Pitch & { teams?: Team })[]>(MOCK_PITCHES);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [teamMembers, setTeamMembers] = useState<any[]>(MOCK_MEMBERS);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>(MOCK_PENDING_QUESTIONS);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>(MOCK_AUDIT_LOGS);

  const [selectedOverrideEntry, setSelectedOverrideEntry] = useState<PitchLeaderboardEntry | null>(null);
  const [qualifySuccessMsg, setQualifySuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

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

  const exportRegistrationsCSV = () => {
    const headers = ['Team Name', 'Domain', 'Pool', 'Member Name', 'Member Email', 'Is Leader'];
    const rows: string[] = [];

    teams.forEach((t) => {
      const members = teamMembers.filter((m) => m.team_id === t.id);
      members.forEach((m) => {
        rows.push([`"${t.team_name}"`, `"${t.domain}"`, `"${t.pool}"`, `"${m.name}"`, `"${m.email}"`, m.is_leader].join(','));
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pitch_under_pressure_teams_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole="organiser" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Timer with Organiser Controls */}
        <CountdownTimer
          initialState={eventState || undefined}
          showControls={true}
          onPhaseChange={handleTimerChange}
        />

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

        {/* TAB 1: LIVE CONTROL PANEL */}
        {activeTab === 'control' && (
          <div className="space-y-8">
            <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-brand-cyan" />
                    <span>Live Pitch Selector</span>
                  </h2>
                  <p className="text-xs text-gray-400">Selecting a pitch flips every Team and Judge screen instantly in real-time.</p>
                </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pitches.map((p) => {
                  const isLive = p.id === eventState?.current_pitch_id;
                  const team = p.teams;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isLive
                          ? 'bg-brand-cyan/10 border-brand-cyan shadow-cyan-glow'
                          : 'bg-gray-900/60 border-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-gray-400">Pitch #{p.pitch_order}</span>
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                            LIVE NOW
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-400 uppercase">
                            {p.status}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-white">{team?.team_name || 'Unassigned'}</h4>
                        <p className="text-xs text-gray-400">Domain: <span className="text-brand-gold">{team?.domain}</span> • Pool {team?.pool}</p>
                      </div>

                      {!isLive ? (
                        <button
                          onClick={() => handleSetLivePitch(p.id)}
                          className="w-full py-2 rounded-lg font-bold text-xs bg-gray-800 hover:bg-brand-cyan hover:text-black text-gray-200 border border-gray-700 transition-all flex items-center justify-center space-x-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Set Live Pitch</span>
                        </button>
                      ) : (
                        <div className="text-center py-1 text-xs font-bold text-brand-cyan">
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
                      "{q.question_text}"
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
