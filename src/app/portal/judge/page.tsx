'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import { Award, Flame, Lock, CheckCircle2, HelpCircle, ShieldAlert, Users } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, Judge } from '@/src/lib/types';
import { submitJudgeScoresAction } from '@/src/app/actions/judgeActions';

const MOCK_PITCHING_TEAM: Team = {
  id: 'mock-team-1',
  auth_user_id: 'mock-user-1',
  team_name: 'MedPulse AI',
  domain: 'Healthcare',
  pool: 'A',
  status: 'registered',
  created_at: new Date().toISOString(),
};

const MOCK_CURRENT_PITCH: Pitch & { teams?: Team } = {
  id: 'mock-pitch-1',
  team_id: 'mock-team-1',
  round_id: 'mock-round-1',
  status: 'live',
  pitch_order: 1,
  teams: MOCK_PITCHING_TEAM,
};

const MOCK_EVENT_STATE: EventState = {
  id: 1,
  current_pitch_id: 'mock-pitch-1',
  current_round_id: 'mock-round-1',
  timer_phase: 'pitch',
  timer_duration_seconds: 180,
  timer_started_at: new Date(Date.now() - 45000).toISOString(),
  timer_paused_remaining: null,
  updated_at: new Date().toISOString(),
};

const MOCK_APPROVED_QUESTIONS: Question[] = [
  {
    id: 'mock-q-101',
    asking_team_id: 'mock-team-3',
    pitch_id: 'mock-pitch-1',
    question_text: 'How do you train your diagnostic model while ensuring compliance with HIPAA & DPDP laws in India?',
    status: 'approved',
    outcome: 'team_answered_well',
    points_to_team: 1,
    points_to_asker: 0,
    created_at: new Date(Date.now() - 120000).toISOString(),
    asking_team: {
      id: 'mock-team-3',
      auth_user_id: 'mock-user-3',
      team_name: 'FinFlex Pay',
      domain: 'FinTech',
      pool: 'A',
      status: 'registered',
      created_at: new Date().toISOString(),
    },
  },
];

export default function JudgePortalPage() {
  const [judgeProfile, setJudgeProfile] = useState<Judge | null>({
    id: 'mock-judge-1',
    auth_user_id: 'mock-user-j1',
    name: 'Judge Dr. Sharma',
    email: 'judge1@student.nitw.ac.in',
  });
  const [eventState, setEventState] = useState<EventState | null>(MOCK_EVENT_STATE);
  const [currentPitch, setCurrentPitch] = useState<(Pitch & { teams?: Team }) | null>(MOCK_CURRENT_PITCH);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>(MOCK_APPROVED_QUESTIONS);

  // 4 Rubric Sliders (1 to 10)
  const [probMarket, setProbMarket] = useState<number>(8);
  const [solInnovation, setSolInnovation] = useState<number>(9);
  const [feasibility, setFeasibility] = useState<number>(8);
  const [storytelling, setStorytelling] = useState<number>(9);

  const [isLocked, setIsLocked] = useState(false);
  const [judgesSubmittedCount, setJudgesSubmittedCount] = useState<number>(4);
  const [totalJudgesCount, setTotalJudgesCount] = useState<number>(6);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: jData } = await supabase.from('judges').select('*').eq('auth_user_id', user.id).single();
      if (jData) setJudgeProfile(jData as Judge);

      // Total Judges
      const { data: allJudges } = await supabase.from('judges').select('id');
      if (allJudges) setTotalJudgesCount(allJudges.length || 6);

      // Event State & Current Pitch
      const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
      if (es) {
        setEventState(es as EventState);
        if (es.current_pitch_id) {
          const { data: pData } = await supabase
            .from('pitches')
            .select('*, teams(*)')
            .eq('id', es.current_pitch_id)
            .single();

          if (pData) {
            setCurrentPitch(pData as any);

            // Fetch approved questions for context
            const { data: qData } = await supabase
              .from('questions')
              .select('*, asking_team:teams(*)')
              .eq('pitch_id', es.current_pitch_id)
              .eq('status', 'approved');

            if (qData) setApprovedQuestions(qData as any);

            // Check if THIS judge already submitted & locked for this pitch
            if (jData) {
              const { data: existingScores } = await supabase
                .from('judge_scores')
                .select('*')
                .eq('judge_id', jData.id)
                .eq('pitch_id', es.current_pitch_id);

              if (existingScores && existingScores.length > 0) {
                const isAnyLocked = existingScores.some((s: any) => s.locked);
                setIsLocked(isAnyLocked);

                // Populate sliders with existing values
                for (const s of existingScores) {
                  if (s.criterion === 'problem_market') setProbMarket(s.score);
                  if (s.criterion === 'solution_innovation') setSolInnovation(s.score);
                  if (s.criterion === 'feasibility') setFeasibility(s.score);
                  if (s.criterion === 'pitch_storytelling') setStorytelling(s.score);
                }
              } else {
                setIsLocked(false);
              }
            }

            // Count how many unique judges submitted for current pitch
            const { data: subJudges } = await supabase
              .from('judge_scores')
              .select('judge_id')
              .eq('pitch_id', es.current_pitch_id);

            if (subJudges) {
              const unique = new Set(subJudges.map((s: any) => s.judge_id));
              setJudgesSubmittedCount(unique.size);
            }
          }
        } else {
          setCurrentPitch(null);
        }
      }
    }
  };

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel('judge_portal_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_scores' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmitScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPitch) return;
    setLoading(true);
    setMessage(null);

    const res = await submitJudgeScoresAction({
      pitchId: currentPitch.id,
      scores: {
        problem_market: probMarket,
        solution_innovation: solInnovation,
        feasibility,
        pitch_storytelling: storytelling,
      },
    });

    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Scores submitted & locked for this pitch!' });
      setIsLocked(true);
      fetchData();
    }
  };

  const pitchingTeam = currentPitch?.teams;

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole="judge" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Timer */}
        <CountdownTimer initialState={eventState || undefined} />

        {/* CURRENT PITCHING TEAM BANNER */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-surface-border flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40 text-xs font-bold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>JUDGING PANEL • LIVE EVALUATION</span>
            </div>

            {pitchingTeam ? (
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{pitchingTeam.team_name}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  Domain: <span className="text-brand-gold font-bold">{pitchingTeam.domain}</span> • Pool <span className="text-brand-cyan font-bold">{pitchingTeam.pool}</span>
                </p>
              </div>
            ) : (
              <h2 className="text-xl font-bold text-gray-400">Waiting for Organiser to start pitch...</h2>
            )}
          </div>

          {/* JUDGE PROGRESS INDICATOR */}
          <div className="bg-gray-900/80 p-4 rounded-2xl border border-gray-800 text-center shrink-0 min-w-[200px]">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider font-mono block">Judges Submitted</span>
            <span className="text-2xl font-black text-brand-cyan font-mono">
              {judgesSubmittedCount} / {totalJudgesCount}
            </span>
            <div className="w-full bg-gray-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-brand-cyan h-full transition-all duration-500"
                style={{ width: `${(judgesSubmittedCount / totalJudgesCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* MAIN SCORING & QUESTIONS GRID */}
        {currentPitch && pitchingTeam ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 4 RUBRIC SCORING FORM (2 COLUMNS IN LG) */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-surface-border space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Award className="w-5 h-5 text-brand-purple" />
                  <span>Evaluation Rubric (1–10 Scale)</span>
                </h3>
                {isLocked && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    <span>LOCKED</span>
                  </span>
                )}
              </div>

              {message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold border ${
                    message.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmitScores} className="space-y-5">
                {/* 1. Problem & Market Insight (20%) */}
                <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-gray-200">1. Problem & Market Insight (20%)</span>
                    <span className="text-base font-bold font-mono text-brand-purple">{probMarket} / 10</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Clarity of problem statement, target audience size, customer pain points.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={probMarket}
                    onChange={(e) => setProbMarket(Number(e.target.value))}
                    className="w-full accent-brand-purple disabled:opacity-50"
                  />
                </div>

                {/* 2. Solution & Innovation (20%) */}
                <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-gray-200">2. Solution & Innovation (20%)</span>
                    <span className="text-base font-bold font-mono text-brand-purple">{solInnovation} / 10</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Uniqueness, novelty, IP potential, technical defensibility.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={solInnovation}
                    onChange={(e) => setSolInnovation(Number(e.target.value))}
                    className="w-full accent-brand-purple disabled:opacity-50"
                  />
                </div>

                {/* 3. Feasibility & Business Model (15%) */}
                <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-gray-200">3. Feasibility & Business Model (15%)</span>
                    <span className="text-base font-bold font-mono text-brand-purple">{feasibility} / 10</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Monetization strategy, go-to-market plan, unit economics, execution capability.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={feasibility}
                    onChange={(e) => setFeasibility(Number(e.target.value))}
                    className="w-full accent-brand-purple disabled:opacity-50"
                  />
                </div>

                {/* 4. Pitch & Storytelling (15%) */}
                <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-gray-200">4. Pitch & Storytelling (15%)</span>
                    <span className="text-base font-bold font-mono text-brand-purple">{storytelling} / 10</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Presentation flow, confidence, slide design, time management.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={storytelling}
                    onChange={(e) => setStorytelling(Number(e.target.value))}
                    className="w-full accent-brand-purple disabled:opacity-50"
                  />
                </div>

                {!isLocked ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-purple hover:bg-brand-purple/90 text-white transition-all shadow-purple-glow flex items-center justify-center space-x-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? 'Submitting & Locking...' : 'Submit & Lock Scores for this Pitch'}</span>
                  </button>
                ) : (
                  <div className="p-4 text-center bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400">
                    Your scores are locked for this pitch. Only the Organiser can unlock if an adjustment is required.
                  </div>
                )}
              </form>
            </div>

            {/* CONTEXT SIDEBAR: APPROVED AUDIENCE QUESTIONS */}
            <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-brand-pink" />
                <span>Approved Q&A Context</span>
              </h3>

              {approvedQuestions.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No approved audience questions for this pitch yet.</p>
              ) : (
                <div className="space-y-3">
                  {approvedQuestions.map((q) => (
                    <div key={q.id} className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 space-y-1.5">
                      <p className="text-xs text-gray-200 font-medium">{q.question_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>Asked by: <strong className="text-gray-300">{q.asking_team?.team_name || 'Rival Team'}</strong></span>
                        {q.outcome && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                              q.outcome === 'team_answered_well'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {q.outcome === 'team_answered_well' ? 'Answered Well (+1)' : 'Poor Answer (-1)'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-12 text-center border border-surface-border">
            <Flame className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-300">No Pitch Currently Live</h3>
            <p className="text-xs text-gray-400 mt-1">Please wait for the event organiser to activate the next pitch.</p>
          </div>
        )}
      </main>
    </div>
  );
}
