'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, Users, HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { PitchLeaderboardEntry } from '@/src/lib/types';

interface LiveLeaderboardProps {
  roundName?: 'prelim' | 'final';
  onOverrideClick?: (entry: PitchLeaderboardEntry) => void;
  showOverrideButton?: boolean;
}

export default function LiveLeaderboard({
  roundName = 'prelim',
  onOverrideClick,
  showOverrideButton = false,
}: LiveLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<PitchLeaderboardEntry[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('pitch_leaderboard')
        .select('*')
        .eq('round_name', roundName);

      if (!error && data) {
        setLeaderboard(data as PitchLeaderboardEntry[]);
      }
    } catch (e) {
      // Leave leaderboard as-is on transient error
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_scores' }, () => fetchLeaderboard())
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
      <div className="glass-card rounded-2xl p-8 text-center border border-surface-border">
        <div className="w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400 font-mono">Loading real-time leaderboard...</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center border border-surface-border">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-300">No Pitch Scores Yet</h3>
        <p className="text-sm text-gray-400 mt-1">Scores will appear in real-time as judges and audience vote.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 border border-surface-border">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-brand-gold/10 text-brand-gold flex items-center justify-center border border-brand-gold/30">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Live Leaderboard
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                {roundName} Round
              </span>
            </h2>
            <p className="text-xs text-gray-400">Weighted Total: Judge (70%) • Audience (20%) • Q&A (10%)</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 font-mono hidden sm:inline-block">Auto-updating via Supabase Realtime</span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {(() => {
            let scoredSeen = 0;
            return leaderboard.map((item) => {
            const isScored = item.total_weighted_score !== null;
            const rank = isScored ? ++scoredSeen : null;
            const isTop3 = rank !== null && rank <= 3;
            const isExpanded = expandedTeamId === item.team_id;

            let rankColor = 'bg-gray-800 text-gray-400 border-gray-700';
            if (rank === 1) rankColor = 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-amber-300 shadow-gold-glow';
            else if (rank === 2) rankColor = 'bg-slate-300 text-gray-900 border-white';
            else if (rank === 3) rankColor = 'bg-amber-700 text-amber-100 border-amber-600';

            return (
              <motion.div
                key={item.team_id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`rounded-xl border transition-all ${
                  isTop3
                    ? 'bg-surface-card/90 border-brand-gold/30 shadow-lg'
                    : 'bg-surface/60 border-surface-border hover:border-gray-700'
                }`}
              >
                <div
                  onClick={() => toggleExpand(item.team_id)}
                  className="p-3 sm:p-4 flex items-center justify-between cursor-pointer select-none gap-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-black text-sm border shrink-0 ${rankColor}`}>
                      {rank === null ? '—' : rank === 1 ? <Sparkles className="w-4 h-4" /> : `#${rank}`}
                    </div>

                    {/* Team Info */}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm sm:text-base truncate">{item.team_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300 border border-gray-700 shrink-0">
                          Pool {item.pool}
                        </span>
                        {item.pitch_status === 'live' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse shrink-0">
                            NOW PITCHING
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        Domain: <span className="text-gray-300 font-medium">{item.domain}</span>
                      </p>
                    </div>
                  </div>

                  {/* Score & Toggle */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="text-base sm:text-xl font-extrabold text-brand-cyan tracking-tight">
                        {item.total_weighted_score !== null
                          ? <>{item.total_weighted_score.toFixed(1)} <span className="text-xs font-normal text-gray-400">pts</span></>
                          : <span className="text-gray-500 text-sm font-semibold">Awaiting score</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {item.judges_submitted_count > 0 ? `Scored by ${item.submitted_by_name}` : 'Not scored yet'} • {item.total_voters} Voters
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Component Breakdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 pt-2 border-t border-gray-800/80 bg-gray-950/40 rounded-b-xl space-y-3"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Problem & Market (20%)</span>
                          <span className="font-mono font-bold text-gray-200 text-sm">{item.problem_market_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Solution & Innovation (20%)</span>
                          <span className="font-mono font-bold text-gray-200 text-sm">{item.solution_innovation_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Feasibility (15%)</span>
                          <span className="font-mono font-bold text-gray-200 text-sm">{item.feasibility_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Storytelling (15%)</span>
                          <span className="font-mono font-bold text-gray-200 text-sm">{item.pitch_storytelling_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Audience Rating (20%)</span>
                          <span className="font-mono font-bold text-brand-gold text-sm">{item.audience_rating_score.toFixed(1)} / 100</span>
                        </div>
                        <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Q&A Pressure Test (10%)</span>
                          <span className="font-mono font-bold text-brand-pink text-sm">{item.qa_pressure_score.toFixed(1)} / 100 ({item.total_qa_points > 0 ? `+${item.total_qa_points}` : item.total_qa_points} pts)</span>
                        </div>
                      </div>

                      {showOverrideButton && onOverrideClick && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOverrideClick(item);
                            }}
                            className="px-3 py-1.5 bg-brand-purple/20 hover:bg-brand-purple/30 text-brand-purple border border-brand-purple/40 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Manual Score Override / Unlock
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
            });
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
