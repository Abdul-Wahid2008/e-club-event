'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { PitchLeaderboardEntry } from '@/src/lib/types';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';
import PoolBadge from '@/src/components/PoolBadge';
import { SkeletonLeaderboardRow } from '@/src/components/Skeleton';

interface LiveLeaderboardProps {
  roundName?: 'prelim' | 'final';
  onOverrideClick?: (entry: PitchLeaderboardEntry) => void;
  showOverrideButton?: boolean;
}

const MOCK_LEADERBOARD: PitchLeaderboardEntry[] = [
  {
    team_id: 'mock-team-1',
    team_name: 'MedPulse AI',
    domain: 'Healthcare',
    pool: 'A',
    pitch_id: 'mock-pitch-1',
    round_id: 'mock-round-1',
    round_name: 'prelim',
    pitch_status: 'live',
    problem_market_score: 90,
    solution_innovation_score: 85,
    feasibility_score: 85,
    pitch_storytelling_score: 90,
    audience_rating_score: 88,
    qa_pressure_score: 80,
    judges_submitted_count: 5,
    total_voters: 12,
    total_qa_points: 3,
    total_weighted_score: 86.85,
  },
  {
    team_id: 'mock-team-2',
    team_name: 'EcoDrive Mobility',
    domain: 'Mobility',
    pool: 'B',
    pitch_id: 'mock-pitch-2',
    round_id: 'mock-round-1',
    round_name: 'prelim',
    pitch_status: 'done',
    problem_market_score: 80,
    solution_innovation_score: 85,
    feasibility_score: 80,
    pitch_storytelling_score: 85,
    audience_rating_score: 84,
    qa_pressure_score: 70,
    judges_submitted_count: 6,
    total_voters: 10,
    total_qa_points: 2,
    total_weighted_score: 81.55,
  },
  {
    team_id: 'mock-team-3',
    team_name: 'FinFlex Pay',
    domain: 'FinTech',
    pool: 'A',
    pitch_id: 'mock-pitch-3',
    round_id: 'mock-round-1',
    round_name: 'prelim',
    pitch_status: 'upcoming',
    problem_market_score: 75,
    solution_innovation_score: 80,
    feasibility_score: 80,
    pitch_storytelling_score: 75,
    audience_rating_score: 78,
    qa_pressure_score: 60,
    judges_submitted_count: 4,
    total_voters: 8,
    total_qa_points: 1,
    total_weighted_score: 75.85,
  },
  {
    team_id: 'mock-team-4',
    team_name: 'AgriGrow Tech',
    domain: 'Agriculture',
    pool: 'B',
    pitch_id: 'mock-pitch-4',
    round_id: 'mock-round-1',
    round_name: 'prelim',
    pitch_status: 'upcoming',
    problem_market_score: 70,
    solution_innovation_score: 75,
    feasibility_score: 70,
    pitch_storytelling_score: 75,
    audience_rating_score: 72,
    qa_pressure_score: 50,
    judges_submitted_count: 3,
    total_voters: 6,
    total_qa_points: 0,
    total_weighted_score: 70.15,
  },
];

export default function LiveLeaderboard({
  roundName = 'prelim',
  onOverrideClick,
  showOverrideButton = false,
}: LiveLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<PitchLeaderboardEntry[]>(MOCK_LEADERBOARD);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

  const fetchLeaderboard = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('pitch_leaderboard')
        .select('*')
        .eq('round_name', roundName);

      if (!error && data && data.length > 0) {
        setLeaderboard(data as PitchLeaderboardEntry[]);
      }
    } catch (e) {
      // Keep mock fallback on error
    } finally {
      setLoading(false);
    }
  }, [roundName]);

  useEffect(() => {
    fetchLeaderboard();

    const supabase = createClient();
    // Realtime subscriptions across all relevant tables
    const channel = supabase
      .channel('leaderboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_scores' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audience_scores' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchLeaderboard())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  const toggleExpand = (teamId: string) => {
    setExpandedTeamId(expandedTeamId === teamId ? null : teamId);
  };

  if (loading) {
    return (
      <div className="card rounded-2xl p-4 sm:p-6 space-y-3">
        <div className="flex items-center space-x-3 mb-3 pb-4 border-b border-ink-900/10">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-brand-600 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Live Leaderboard</h2>
        </div>
        <SkeletonLeaderboardRow />
        <SkeletonLeaderboardRow />
        <SkeletonLeaderboardRow />
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <Trophy className="w-12 h-12 text-ink-900/20 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-ink-900">No Pitch Scores Yet</h3>
        <p className="text-sm text-ink-600 mt-1">Scores will appear in real-time as judges and audience vote.</p>
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink-900/10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-brand-600 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
              Live Leaderboard
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface-base text-ink-600 border border-ink-900/10">
                {roundName} Round
              </span>
            </h2>
            <p className="text-xs text-ink-600">Weighted Total: Judge (70%) &bull; Audience (20%) &bull; Q&amp;A (10%)</p>
          </div>
        </div>
        <span className="text-xs text-ink-600 hidden sm:inline-block">Auto-updating via Supabase Realtime</span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {leaderboard.map((item, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const isExpanded = expandedTeamId === item.team_id;

            let rankColor = 'bg-surface-base text-ink-600 border-ink-900/10';
            if (rank === 1) rankColor = 'bg-accent-warm text-ink-900 border-accent-warm';
            else if (rank === 2) rankColor = 'bg-slate-200 text-ink-900 border-slate-300';
            else if (rank === 3) rankColor = 'bg-orange-100 text-ink-900 border-orange-200';

            return (
              <motion.div
                key={item.team_id}
                layout={!reducedMotion}
                initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className={`rounded-xl border transition-colors ${
                  isTop3
                    ? 'bg-white border-accent-warm/50 shadow-card'
                    : 'bg-white border-ink-900/10 hover:border-ink-900/20'
                }`}
              >
                <div
                  onClick={() => toggleExpand(item.team_id)}
                  className="p-3 sm:p-4 flex items-center justify-between cursor-pointer select-none gap-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-bold text-sm border shrink-0 ${rankColor}`}>
                      {rank === 1 ? <Sparkles className="w-4 h-4" /> : `#${rank}`}
                    </div>

                    {/* Team Info */}
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className="font-semibold text-ink-900 text-sm sm:text-base truncate">{item.team_name}</span>
                        <PoolBadge pool={item.pool} />
                        {item.pitch_status === 'live' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-500 text-white shrink-0">
                            NOW PITCHING
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-600 truncate mt-0.5">
                        Domain: <span className="text-ink-900 font-medium">{item.domain}</span>
                      </p>
                    </div>
                  </div>

                  {/* Score & Toggle */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="tabular-nums text-base sm:text-xl font-bold text-ink-900 tracking-tight">
                        {item.total_weighted_score.toFixed(1)} <span className="text-xs font-normal text-ink-600">pts</span>
                      </div>
                      <div className="tabular-nums text-[10px] text-ink-600">
                        {item.judges_submitted_count} Judges &bull; {item.total_voters} Voters
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse score breakdown' : 'Expand score breakdown'}
                      className="w-7 h-7 rounded-lg bg-surface-base hover:bg-ink-900/10 text-ink-600 flex items-center justify-center transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Component Breakdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                      className="px-4 pb-4 pt-2 border-t border-ink-900/10 bg-surface-base/60 rounded-b-xl space-y-3 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Problem &amp; Market (20%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.problem_market_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Solution &amp; Innovation (20%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.solution_innovation_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Feasibility (15%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.feasibility_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Storytelling (15%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.pitch_storytelling_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Audience Rating (20%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.audience_rating_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-ink-900/10">
                          <span className="text-ink-600 text-[10px] uppercase tracking-wider block">Q&amp;A Pressure Test (10%)</span>
                          <span className="tabular-nums font-semibold text-ink-900 text-sm">{item.qa_pressure_score.toFixed(1)} / 100 ({item.total_qa_points > 0 ? `+${item.total_qa_points}` : item.total_qa_points} pts)</span>
                        </div>
                      </div>

                      {showOverrideButton && onOverrideClick && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOverrideClick(item);
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-surface-base text-ink-900 border border-ink-900/15 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-ink-600" />
                            Manual Score Override / Unlock
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
