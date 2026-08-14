'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import { Users, Flame, Send, ShieldAlert, Trophy, HelpCircle, Inbox } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question } from '@/src/lib/types';
import { submitAudienceRatingAction, submitQuestionAction } from '@/src/app/actions/teamActions';
import PoolBadge from '@/src/components/PoolBadge';
import Toast, { ToastMessage } from '@/src/components/Toast';
import { SkeletonCard } from '@/src/components/Skeleton';

export default function TeamPortalPage() {
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [currentPitch, setCurrentPitch] = useState<(Pitch & { teams?: Team }) | null>(null);
  const [myQuestions, setMyQuestions] = useState<Question[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Rating Sliders (1-5 scale)
  const [problemRel, setProblemRel] = useState<number>(3);
  const [creativity, setCreativity] = useState<number>(3);
  const [solQuality, setSolQuality] = useState<number>(3);
  const [pitchQuality, setPitchQuality] = useState<number>(3);
  const [overallPot, setOverallPot] = useState<number>(3);

  const [questionText, setQuestionText] = useState('');

  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const [ratingMessage, setRatingMessage] = useState<ToastMessage | null>(null);
  const [questionMessage, setQuestionMessage] = useState<ToastMessage | null>(null);

  const fetchTeamAndEventData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (team) {
        setMyTeam(team as Team);

        // Fetch questions asked by my team
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('asking_team_id', team.id)
          .order('created_at', { ascending: false });

        if (qData) setMyQuestions(qData as Question[]);
      }
    }

    // Fetch Event State & Current Pitch
    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    if (es) {
      setEventState(es as EventState);
      if (es.current_pitch_id) {
        const { data: pData } = await supabase
          .from('pitches')
          .select('*, teams(*)')
          .eq('id', es.current_pitch_id)
          .single();

        if (pData) setCurrentPitch(pData as any);
      } else {
        setCurrentPitch(null);
      }
    }
    setInitialLoading(false);
  };

  useEffect(() => {
    fetchTeamAndEventData();

    const supabase = createClient();
    const channel = supabase
      .channel('team_portal_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchTeamAndEventData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchTeamAndEventData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchTeamAndEventData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pitchingTeam = currentPitch?.teams;
  const isOwnTeam = pitchingTeam && myTeam && pitchingTeam.id === myTeam.id;
  const isSamePool = pitchingTeam && myTeam && pitchingTeam.pool === myTeam.pool;
  const canVote = currentPitch && pitchingTeam && myTeam && !isOwnTeam && !isSamePool;

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPitch || loadingRating) return;
    setLoadingRating(true);
    setRatingMessage(null);

    const res = await submitAudienceRatingAction({
      pitchId: currentPitch.id,
      scores: {
        problem_relevance: problemRel,
        creativity,
        solution_quality: solQuality,
        pitch_quality: pitchQuality,
        overall_potential: overallPot,
      },
    });

    setLoadingRating(false);
    if (res.error) {
      setRatingMessage({ type: 'error', text: res.error });
    } else {
      setRatingSubmitted(true);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPitch || loadingQuestion) return;
    setLoadingQuestion(true);
    setQuestionMessage(null);

    const res = await submitQuestionAction({
      pitchId: currentPitch.id,
      questionText,
    });

    setLoadingQuestion(false);
    if (res.error) {
      setQuestionMessage({ type: 'error', text: res.error });
    } else {
      setQuestionMessage({ type: 'success', text: 'Submitted — pending organiser review' });
      setQuestionText('');
      fetchTeamAndEventData();
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
        <Navbar userRole="team" />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-ink-900">
      <Navbar userRole="team" teamName={myTeam?.team_name} teamPool={myTeam?.pool} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Countdown Timer */}
        <CountdownTimer initialState={eventState || undefined} />

        {/* BIG NOW PITCHING BANNER */}
        <div className="card rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-card-lg">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-50 text-accent-500 border border-accent-500/30 text-xs font-bold tracking-widest uppercase">
            <Flame className="w-4 h-4" />
            <span>Now Pitching Live</span>
          </div>

          {currentPitch && pitchingTeam ? (
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-5xl font-semibold text-ink-900 tracking-tight">
                {pitchingTeam.team_name}
              </h1>
              <div className="flex items-center justify-center flex-wrap gap-3 text-xs sm:text-sm">
                <span className="px-3 py-1 rounded-lg bg-surface-base border border-ink-900/10 font-semibold text-ink-900">
                  Domain: {pitchingTeam.domain}
                </span>
                <PoolBadge pool={pitchingTeam.pool} className="text-sm px-3 py-1" />
              </div>
            </div>
          ) : (
            <div className="py-6 space-y-2">
              <h2 className="text-2xl font-semibold text-ink-600">Waiting for next pitch to begin...</h2>
              <p className="text-xs text-ink-600/70">The Organiser will set the live pitching team shortly.</p>
            </div>
          )}
        </div>

        {/* AUDIENCE VOTING & QUESTION SUBMISSION PANEL */}
        {currentPitch && pitchingTeam && (
          <div>
            {canVote ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 5-CRITERIA SLIDERS FORM */}
                <div className="card rounded-2xl p-6 space-y-5">
                  <div className="flex items-center space-x-3">
                    <Trophy className="w-5 h-5 text-accent-warm" />
                    <div>
                      <h3 className="text-lg font-semibold text-ink-900">Rate Rivals&apos; Pitch</h3>
                      <p className="text-xs text-ink-600">Evaluate {pitchingTeam.team_name} (Pool {pitchingTeam.pool}) on 1-5 scale</p>
                    </div>
                  </div>

                  <Toast message={ratingMessage} />

                  {ratingSubmitted ? (
                    <div className="p-6 text-center space-y-3 bg-green-50 border border-success-600/30 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-success-600 text-white flex items-center justify-center mx-auto">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold text-ink-900 text-base">Rating Submitted!</h4>
                      <p className="text-xs text-ink-600">Your scores have been included in the normalized audience rating view.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRatingSubmit} className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-ink-600 mb-1">
                          <span>Problem Relevance</span>
                          <span className="tabular-nums font-semibold text-brand-700">{problemRel} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={problemRel}
                          onChange={(e) => setProblemRel(Number(e.target.value))}
                          className="w-full accent-brand-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-ink-600 mb-1">
                          <span>Creativity &amp; Originality</span>
                          <span className="tabular-nums font-semibold text-brand-700">{creativity} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={creativity}
                          onChange={(e) => setCreativity(Number(e.target.value))}
                          className="w-full accent-brand-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-ink-600 mb-1">
                          <span>Solution Quality</span>
                          <span className="tabular-nums font-semibold text-brand-700">{solQuality} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={solQuality}
                          onChange={(e) => setSolQuality(Number(e.target.value))}
                          className="w-full accent-brand-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-ink-600 mb-1">
                          <span>Pitch Quality &amp; Clarity</span>
                          <span className="tabular-nums font-semibold text-brand-700">{pitchQuality} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={pitchQuality}
                          onChange={(e) => setPitchQuality(Number(e.target.value))}
                          className="w-full accent-brand-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-ink-600 mb-1">
                          <span>Overall Potential</span>
                          <span className="tabular-nums font-semibold text-brand-700">{overallPot} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={overallPot}
                          onChange={(e) => setOverallPot(Number(e.target.value))}
                          className="w-full accent-brand-600"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loadingRating}
                        aria-busy={loadingRating}
                        className="w-full py-2.5 rounded-xl font-semibold text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        {loadingRating ? 'Submitting...' : 'Submit Audience Rating'}
                      </button>
                    </form>
                  )}
                </div>

                {/* QUESTION SUBMISSION FORM */}
                <div className="card rounded-2xl p-6 space-y-5">
                  <div className="flex items-center space-x-3">
                    <HelpCircle className="w-5 h-5 text-accent-500" />
                    <div>
                      <h3 className="text-lg font-semibold text-ink-900">Pressure Test Q&amp;A</h3>
                      <p className="text-xs text-ink-600">Submit a challenging question for {pitchingTeam.team_name}</p>
                    </div>
                  </div>

                  <Toast message={questionMessage} />

                  <form onSubmit={handleQuestionSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Your Question</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Ask about unit economics, technical feasibility, scalability..."
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="w-full bg-surface-base border border-ink-900/15 rounded-xl p-3 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingQuestion}
                      aria-busy={loadingQuestion}
                      className="w-full py-2.5 rounded-xl font-semibold text-xs bg-accent-500 hover:bg-accent-500/90 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{loadingQuestion ? 'Submitting Question...' : 'Submit Question for Review'}</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="card rounded-2xl p-6 text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-accent-warm mx-auto" />
                <h3 className="text-base font-semibold text-ink-900">Voting Restricted for this Pitch</h3>
                <p className="text-xs text-ink-600 max-w-md mx-auto">
                  {isOwnTeam
                    ? 'This is your own team pitching! You cannot rate or ask questions on your own pitch.'
                    : `You are in Pool ${myTeam?.pool} alongside ${pitchingTeam.team_name}. Audience voting is only allowed for teams pitching from the opposite pool.`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* REALTIME LIVE LEADERBOARD */}
        <LiveLeaderboard roundName="prelim" />

        {/* YOUR TEAM'S JOURNEY SUMMARY */}
        <div className="card rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-ink-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand-600" />
            <span>Your Team&apos;s Event Journey</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10 space-y-2">
              <span className="text-xs font-semibold text-ink-600 uppercase tracking-wider block">Assigned Team Details</span>
              <p className="text-xs text-ink-600">Team Name: <span className="text-ink-900 font-semibold">{myTeam?.team_name}</span></p>
              <p className="text-xs text-ink-600">Sector Domain: <span className="text-ink-900 font-semibold">{myTeam?.domain}</span></p>
              <div className="text-xs text-ink-600 flex items-center gap-2">Assigned Pool: {myTeam && <PoolBadge pool={myTeam.pool} />}</div>
            </div>

            <div className="bg-surface-base p-4 rounded-xl border border-ink-900/10 space-y-2">
              <span className="text-xs font-semibold text-ink-600 uppercase tracking-wider block">Questions Asked ({myQuestions.length})</span>
              {myQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <Inbox className="w-8 h-8 text-ink-900/20" />
                  <p className="text-xs text-ink-600">No questions submitted yet.</p>
                  <p className="text-[11px] text-ink-600/70">Ask a pressure question during an opposite-pool pitch to see it here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {myQuestions.map((q) => (
                    <div key={q.id} className="p-2 rounded bg-white text-xs border border-ink-900/10">
                      <p className="text-ink-900 line-clamp-2">{q.question_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-ink-600 mt-1">
                        <span>Status: <strong className="text-brand-700 uppercase">{q.status}</strong></span>
                        {q.points_to_asker > 0 && <span className="tabular-nums text-accent-warm font-bold">+{q.points_to_asker} pts earned</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
