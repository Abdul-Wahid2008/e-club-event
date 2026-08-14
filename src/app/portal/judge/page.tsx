'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import { Award, Flame, Lock, HelpCircle } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, Judge } from '@/src/lib/types';
import { submitJudgeScoresAction } from '@/src/app/actions/judgeActions';
import PoolBadge from '@/src/components/PoolBadge';
import Toast, { ToastMessage } from '@/src/components/Toast';
import { SkeletonCard } from '@/src/components/Skeleton';

export default function JudgePortalPage() {
  const [judgeProfile, setJudgeProfile] = useState<Judge | null>(null);
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [currentPitch, setCurrentPitch] = useState<(Pitch & { teams?: Team }) | null>(null);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // 4 Rubric Sliders (1 to 10)
  const [probMarket, setProbMarket] = useState<number>(5);
  const [solInnovation, setSolInnovation] = useState<number>(5);
  const [feasibility, setFeasibility] = useState<number>(5);
  const [storytelling, setStorytelling] = useState<number>(5);

  const [isLocked, setIsLocked] = useState(false);
  const [judgesSubmittedCount, setJudgesSubmittedCount] = useState<number>(0);
  const [totalJudgesCount, setTotalJudgesCount] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: jData } = await supabase.from('judges').select('*').eq('auth_user_id', user.id).single();
      if (jData) setJudgeProfile(jData as Judge);

      // Total Judges
      const { data: allJudges } = await supabase.from('judges').select('id');
      if (allJudges) setTotalJudgesCount(allJudges.length || 1);

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

            // Count how many unique judges submitted for current pitch.
            // Uses the public pitch_leaderboard view (aggregated count only,
            // no raw scores) since judge_scores itself is now restricted to
            // the organiser and each judge's own rows.
            const { data: leaderboardRow } = await supabase
              .from('pitch_leaderboard')
              .select('judges_submitted_count')
              .eq('pitch_id', es.current_pitch_id)
              .single();

            if (leaderboardRow) {
              setJudgesSubmittedCount((leaderboardRow as any).judges_submitted_count || 0);
            }
          }
        } else {
          setCurrentPitch(null);
        }
      }
    }
    setInitialLoading(false);
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
    if (!currentPitch || loading) return;
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

  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
        <Navbar userRole="judge" />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar userRole="judge" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Timer */}
        <CountdownTimer initialState={eventState || undefined} />

        {/* CURRENT PITCHING TEAM BANNER */}
        <div className="card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-brand-700 border border-brand-600/30 text-xs font-semibold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Judging Panel &bull; Live Evaluation</span>
            </div>

            {pitchingTeam ? (
              <div>
                <h1 className="text-3xl sm:text-4xl font-semibold text-ink-900">{pitchingTeam.team_name}</h1>
                <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-ink-600 mt-1">
                  <span>Domain: <span className="text-ink-900 font-semibold">{pitchingTeam.domain}</span></span>
                  <PoolBadge pool={pitchingTeam.pool} />
                </div>
              </div>
            ) : (
              <h2 className="text-xl font-semibold text-ink-600">Waiting for Organiser to start pitch...</h2>
            )}
          </div>

          {/* JUDGE PROGRESS INDICATOR */}
          <div className="bg-surface-base p-4 rounded-2xl border border-ink-900/10 text-center shrink-0 min-w-[200px]">
            <span className="text-[11px] text-ink-600 uppercase tracking-wider block">Judges Submitted</span>
            <span className="tabular-nums text-2xl font-bold text-brand-700">
              {judgesSubmittedCount} / {totalJudgesCount}
            </span>
            <div className="w-full bg-ink-900/10 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-brand-600 h-full transition-all duration-500"
                style={{ width: `${(judgesSubmittedCount / totalJudgesCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* MAIN SCORING & QUESTIONS GRID */}
        {currentPitch && pitchingTeam ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 4 RUBRIC SCORING FORM (2 COLUMNS IN LG) */}
            <div className="lg:col-span-2 card rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-brand-600" />
                  <span>Evaluation Rubric (1-10 Scale)</span>
                </h3>
                {isLocked && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-ink-900 border border-accent-warm/50 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    <span>Locked</span>
                  </span>
                )}
              </div>

              <Toast message={message} />

              <form onSubmit={handleSubmitScores} className="space-y-5">
                {/* 1. Problem & Market Insight (20%) */}
                <div className="p-4 rounded-xl bg-surface-base border border-ink-900/10 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-ink-900">1. Problem &amp; Market Insight (20%)</span>
                    <span className="tabular-nums text-base font-bold text-brand-700">{probMarket} / 10</span>
                  </div>
                  <p className="text-[11px] text-ink-600">Clarity of problem statement, target audience size, customer pain points.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={probMarket}
                    onChange={(e) => setProbMarket(Number(e.target.value))}
                    className="w-full accent-brand-600 disabled:opacity-50"
                  />
                </div>

                {/* 2. Solution & Innovation (20%) */}
                <div className="p-4 rounded-xl bg-surface-base border border-ink-900/10 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-ink-900">2. Solution &amp; Innovation (20%)</span>
                    <span className="tabular-nums text-base font-bold text-brand-700">{solInnovation} / 10</span>
                  </div>
                  <p className="text-[11px] text-ink-600">Uniqueness, novelty, IP potential, technical defensibility.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={solInnovation}
                    onChange={(e) => setSolInnovation(Number(e.target.value))}
                    className="w-full accent-brand-600 disabled:opacity-50"
                  />
                </div>

                {/* 3. Feasibility & Business Model (15%) */}
                <div className="p-4 rounded-xl bg-surface-base border border-ink-900/10 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-ink-900">3. Feasibility &amp; Business Model (15%)</span>
                    <span className="tabular-nums text-base font-bold text-brand-700">{feasibility} / 10</span>
                  </div>
                  <p className="text-[11px] text-ink-600">Monetization strategy, go-to-market plan, unit economics, execution capability.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={feasibility}
                    onChange={(e) => setFeasibility(Number(e.target.value))}
                    className="w-full accent-brand-600 disabled:opacity-50"
                  />
                </div>

                {/* 4. Pitch & Storytelling (15%) */}
                <div className="p-4 rounded-xl bg-surface-base border border-ink-900/10 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-ink-900">4. Pitch &amp; Storytelling (15%)</span>
                    <span className="tabular-nums text-base font-bold text-brand-700">{storytelling} / 10</span>
                  </div>
                  <p className="text-[11px] text-ink-600">Presentation flow, confidence, slide design, time management.</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    disabled={isLocked}
                    value={storytelling}
                    onChange={(e) => setStorytelling(Number(e.target.value))}
                    className="w-full accent-brand-600 disabled:opacity-50"
                  />
                </div>

                {!isLocked ? (
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center space-x-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? 'Submitting & Locking...' : 'Submit & Lock Scores for this Pitch'}</span>
                  </button>
                ) : (
                  <div className="p-4 text-center bg-surface-base border border-ink-900/10 rounded-xl text-xs text-ink-600">
                    Your scores are locked for this pitch. Only the Organiser can unlock if an adjustment is required.
                  </div>
                )}
              </form>
            </div>

            {/* CONTEXT SIDEBAR: APPROVED AUDIENCE QUESTIONS */}
            <div className="card rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-ink-900 flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-accent-500" />
                <span>Approved Q&amp;A Context</span>
              </h3>

              {approvedQuestions.length === 0 ? (
                <p className="text-xs text-ink-600 italic">No approved audience questions for this pitch yet.</p>
              ) : (
                <div className="space-y-3">
                  {approvedQuestions.map((q) => (
                    <div key={q.id} className="p-3 rounded-xl bg-surface-base border border-ink-900/10 space-y-1.5">
                      <p className="text-xs text-ink-900 font-medium">{q.question_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-ink-600">
                        <span>Asked by: <strong className="text-ink-900">{q.asking_team?.team_name || 'Rival Team'}</strong></span>
                        {q.outcome && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                              q.outcome === 'team_answered_well'
                                ? 'bg-green-50 text-success-600'
                                : 'bg-red-50 text-danger-600'
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
          <div className="card rounded-2xl p-12 text-center">
            <Flame className="w-12 h-12 text-ink-900/20 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-ink-900">No Pitch Currently Live</h3>
            <p className="text-xs text-ink-600 mt-1">Please wait for the event organiser to activate the next pitch.</p>
          </div>
        )}
      </main>
    </div>
  );
}
