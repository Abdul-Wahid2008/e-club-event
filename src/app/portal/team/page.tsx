'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import { Users, Flame, Send, CheckCircle2, ShieldAlert, Trophy, Award, HelpCircle } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question } from '@/src/lib/types';
import { submitAudienceRatingAction, submitQuestionAction } from '@/src/app/actions/teamActions';

const MOCK_TEAM: Team = {
  id: 'mock-team-4',
  auth_user_id: 'mock-user-4',
  team_name: 'AgriGrow Tech',
  domain: 'Agriculture',
  pool: 'B',
  status: 'registered',
  created_at: new Date().toISOString(),
};

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
  queue_status: 'pitching',
  pitch_order: 1,
  queue_position_override: null,
  teams: MOCK_PITCHING_TEAM,
};

const MOCK_EVENT_STATE: EventState = {
  id: 1,
  current_pitch_id: 'mock-pitch-1',
  current_round_id: 'mock-round-1',
  timer_status: 'running',
  timer_duration_seconds: 180,
  timer_started_at: new Date(Date.now() - 45000).toISOString(),
  timer_paused_remaining: null,
  updated_at: new Date().toISOString(),
};

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'mock-q-1',
    asking_team_id: 'mock-team-4',
    pitch_id: 'mock-pitch-2',
    question_text: 'What is your unit cost per EV charging station in tier-2 cities?',
    status: 'approved',
    outcome: 'team_answered_well',
    points_to_team: 1,
    points_to_asker: 0,
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
];

export default function TeamPortalPage() {
  const [myTeam, setMyTeam] = useState<Team | null>(MOCK_TEAM);
  const [eventState, setEventState] = useState<EventState | null>(MOCK_EVENT_STATE);
  const [currentPitch, setCurrentPitch] = useState<(Pitch & { teams?: Team }) | null>(MOCK_CURRENT_PITCH);
  const [myQuestions, setMyQuestions] = useState<Question[]>(MOCK_QUESTIONS);

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

  const [ratingError, setRatingError] = useState<string | null>(null);
  const [questionMessage, setQuestionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    if (!currentPitch) return;
    setLoadingRating(true);
    setRatingError(null);

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
      setRatingError(res.error);
    } else {
      setRatingSubmitted(true);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPitch) return;
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole="team" teamName={myTeam?.team_name} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Synced Countdown Timer */}
        <CountdownTimer initialState={eventState || undefined} />

        {/* BIG NOW PITCHING BANNER */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-surface-border text-center space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-extrabold tracking-widest uppercase">
            <Flame className="w-4 h-4 animate-pulse" />
            <span>NOW PITCHING LIVE</span>
          </div>

          {currentPitch && pitchingTeam ? (
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-brand-cyan">
                {pitchingTeam.team_name}
              </h1>
              <div className="flex items-center justify-center space-x-4 text-xs sm:text-sm text-gray-300">
                <span className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 font-bold">
                  Domain: <span className="text-brand-gold">{pitchingTeam.domain}</span>
                </span>
                <span className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 font-bold">
                  Pool <span className="text-brand-cyan">{pitchingTeam.pool}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 space-y-2">
              <h2 className="text-2xl font-bold text-gray-400">Waiting for next pitch to begin...</h2>
              <p className="text-xs text-gray-500">The Organiser will set the live pitching team shortly.</p>
            </div>
          )}
        </div>

        {/* AUDIENCE VOTING & QUESTION SUBMISSION PANEL */}
        {currentPitch && pitchingTeam && (
          <div>
            {canVote ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 5-CRITERIA SLIDERS FORM */}
                <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-5">
                  <div className="flex items-center space-x-3">
                    <Trophy className="w-5 h-5 text-brand-gold" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Rate Rivals&apos; Pitch</h3>
                      <p className="text-xs text-gray-400">Evaluate {pitchingTeam.team_name} (Pool {pitchingTeam.pool}) on 1–5 scale</p>
                    </div>
                  </div>

                  {ratingError && (
                    <div className="p-3 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                      {ratingError}
                    </div>
                  )}

                  {ratingSubmitted ? (
                    <div className="p-6 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                      <h4 className="font-bold text-white text-base">Rating Submitted!</h4>
                      <p className="text-xs text-gray-300">Your scores have been included in the normalized audience rating view.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRatingSubmit} className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-300 mb-1">
                          <span>Problem Relevance</span>
                          <span className="font-bold text-brand-cyan">{problemRel} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={problemRel}
                          onChange={(e) => setProblemRel(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-300 mb-1">
                          <span>Creativity & Originality</span>
                          <span className="font-bold text-brand-cyan">{creativity} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={creativity}
                          onChange={(e) => setCreativity(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-300 mb-1">
                          <span>Solution Quality</span>
                          <span className="font-bold text-brand-cyan">{solQuality} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={solQuality}
                          onChange={(e) => setSolQuality(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-300 mb-1">
                          <span>Pitch Quality & Clad</span>
                          <span className="font-bold text-brand-cyan">{pitchQuality} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={pitchQuality}
                          onChange={(e) => setPitchQuality(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-300 mb-1">
                          <span>Overall Potential</span>
                          <span className="font-bold text-brand-cyan">{overallPot} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={overallPot}
                          onChange={(e) => setOverallPot(Number(e.target.value))}
                          className="w-full accent-brand-cyan"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loadingRating}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-brand-cyan hover:bg-brand-cyan/90 text-black transition-colors shadow-cyan-glow"
                      >
                        {loadingRating ? 'Submitting...' : 'Submit Audience Rating'}
                      </button>
                    </form>
                  )}
                </div>

                {/* QUESTION SUBMISSION FORM */}
                <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-5">
                  <div className="flex items-center space-x-3">
                    <HelpCircle className="w-5 h-5 text-brand-pink" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Pressure Test Q&A</h3>
                      <p className="text-xs text-gray-400">Submit a challenging question for {pitchingTeam.team_name}</p>
                    </div>
                  </div>

                  {questionMessage && (
                    <div
                      className={`p-3 rounded-lg text-xs font-semibold border ${
                        questionMessage.type === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {questionMessage.text}
                    </div>
                  )}

                  <form onSubmit={handleQuestionSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Your Question</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Ask about unit economics, technical feasibility, scalability..."
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-pink transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingQuestion}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-brand-pink hover:bg-brand-pink/90 text-white transition-colors shadow-purple-glow flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{loadingQuestion ? 'Submitting Question...' : 'Submit Question for Review'}</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 border border-surface-border text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-gray-200">Voting Restricted for this Pitch</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
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
        <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand-cyan" />
            <span>Your Team&apos;s Event Journey</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800 space-y-2">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">Assigned Team Details</span>
              <p className="text-xs text-gray-400">Team Name: <span className="text-white font-bold">{myTeam?.team_name}</span></p>
              <p className="text-xs text-gray-400">Sector Domain: <span className="text-brand-gold font-bold">{myTeam?.domain}</span></p>
              <p className="text-xs text-gray-400">Assigned Pool: <span className="text-brand-cyan font-bold">Pool {myTeam?.pool}</span></p>
            </div>

            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800 space-y-2">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">Questions Asked ({myQuestions.length})</span>
              {myQuestions.length === 0 ? (
                <p className="text-xs text-gray-500">No questions submitted yet.</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {myQuestions.map((q) => (
                    <div key={q.id} className="p-2 rounded bg-gray-950 text-xs border border-gray-800">
                      <p className="text-gray-200 line-clamp-2">{q.question_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                        <span>Status: <strong className="text-brand-cyan uppercase">{q.status}</strong></span>
                        {q.points_to_asker > 0 && <span className="text-brand-gold font-bold">+{q.points_to_asker} pts earned</span>}
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
