'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, HelpCircle } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry } from '@/src/lib/types';
import { triggerConfetti } from '@/src/components/ConfettiEffect';
import ConnectionStatus, { ConnState } from '@/src/components/ConnectionStatus';
import PoolBadge from '@/src/components/PoolBadge';
import QRCode from '@/src/components/QRCode';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';

/**
 * Public, read-only broadcast view for the projector/big-screen.
 *
 * Subscribes to the exact same tables the Organiser console already listens
 * to (event_state, pitches, questions, judge_scores/audience_scores via the
 * pitch_leaderboard view) — no schema/RLS changes, no new tables, no admin
 * controls rendered here. Requires no login.
 */

function formatClock(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function DisplayPage() {
  const reducedMotion = usePrefersReducedMotion();

  const [eventState, setEventState] = useState<EventState | null>(null);
  const [currentPitch, setCurrentPitch] = useState<(Pitch & { teams?: Team }) | null>(null);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard] = useState<PitchLeaderboardEntry[]>([]);
  const [finalFourRevealed, setFinalFourRevealed] = useState(false);
  const [finalRoundId, setFinalRoundId] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [siteUrl, setSiteUrl] = useState('');

  const hasFiredConfetti = useRef(false);

  useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();

    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    if (es) setEventState(es as EventState);

    // Detect Final-4 reveal: event_state.current_round_id flips to the
    // "final" round once qualifyFinalFourAction runs (read-only check here).
    const { data: finalRound } = await supabase.from('rounds').select('id').eq('name', 'final').single();
    if (finalRound) setFinalRoundId(finalRound.id);

    if (es?.current_pitch_id) {
      const { data: pData } = await supabase
        .from('pitches')
        .select('*, teams(*)')
        .eq('id', es.current_pitch_id)
        .single();
      if (pData) setCurrentPitch(pData as any);

      const { data: qData } = await supabase
        .from('questions')
        .select('*, asking_team:teams(*)')
        .eq('pitch_id', es.current_pitch_id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);
      if (qData) setApprovedQuestions(qData as any);
    } else {
      setCurrentPitch(null);
      setApprovedQuestions([]);
    }

    const { data: lbData } = await supabase
      .from('pitch_leaderboard')
      .select('*')
      .eq('round_name', 'prelim');
    if (lbData) {
      setLeaderboard(
        (lbData as PitchLeaderboardEntry[]).slice().sort((a, b) => b.total_weighted_score - a.total_weighted_score)
      );
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const supabase = createClient();
    const channel = supabase
      .channel('display_broadcast_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_scores' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audience_scores' }, () => fetchAll())
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnState('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnState('reconnecting');
        else setConnState('connecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // Final-4 reveal trigger: once event_state.current_round_id === the final
  // round id, show the reveal + fire confetti exactly once.
  useEffect(() => {
    if (eventState?.current_round_id && finalRoundId && eventState.current_round_id === finalRoundId) {
      setFinalFourRevealed(true);
      if (!hasFiredConfetti.current) {
        hasFiredConfetti.current = true;
        triggerConfetti();
      }
    }
  }, [eventState?.current_round_id, finalRoundId]);

  // Timer ticker (mirrors CountdownTimer's calculation, read-only)
  useEffect(() => {
    if (!eventState) return;
    const { timer_phase, timer_started_at, timer_duration_seconds, timer_paused_remaining } = eventState;

    if (timer_phase === 'idle') {
      setSecondsLeft(timer_duration_seconds || 0);
      return;
    }
    if (timer_phase === 'paused') {
      setSecondsLeft(timer_paused_remaining ?? 0);
      return;
    }

    const calc = () => {
      if (!timer_started_at) return timer_duration_seconds;
      const elapsed = Math.floor((Date.now() - new Date(timer_started_at).getTime()) / 1000);
      return Math.max(0, timer_duration_seconds - elapsed);
    };

    setSecondsLeft(calc());
    const interval = setInterval(() => {
      const remaining = calc();
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [eventState]);

  const pitchingTeam = currentPitch?.teams;
  const isLowTime = secondsLeft <= 30 && eventState?.timer_phase !== 'idle' && eventState?.timer_phase !== 'paused';
  const latestQuestion = approvedQuestions[0];
  const teamRegisterUrl = siteUrl ? `${siteUrl}/auth/team` : '';

  const topFour = leaderboard.filter((e) => e.pool === 'A').slice(0, 2).concat(leaderboard.filter((e) => e.pool === 'B').slice(0, 2));

  return (
    <div className="min-h-screen bg-surface-base text-ink-900 flex flex-col overflow-hidden">
      {/* Minimal chrome: logo + connection status only, visually calmer than the Organiser console */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-contain" priority />
          <span className="text-sm font-semibold text-ink-600">Pitch Under Pressure</span>
        </div>
        <ConnectionStatus state={connState} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 pb-10 space-y-10">
        <AnimatePresence mode="wait">
          {finalFourRevealed ? (
            <motion.section
              key="final-four"
              initial={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-5xl text-center space-y-8"
            >
              <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-700 to-accent-500">
                FINAL 4 REVEALED
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {topFour.map((t, i) => (
                  <motion.div
                    key={t.team_id}
                    initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reducedMotion ? 0 : i * 0.15, duration: 0.4 }}
                    className="card rounded-3xl p-8 shadow-card-lg space-y-3"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className="text-3xl sm:text-4xl font-semibold text-ink-900"
                        style={{ fontWeight: 600 }}
                      >
                        {t.team_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <PoolBadge pool={t.pool} className="text-sm px-3 py-1" />
                      <span className="tabular-nums text-sm text-ink-600">{t.total_weighted_score.toFixed(1)} pts</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ) : currentPitch && pitchingTeam ? (
            <motion.section
              key={currentPitch.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-5xl text-center space-y-10"
            >
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-accent-500 border border-accent-500/30 text-sm font-bold uppercase tracking-widest">
                  Now Pitching
                </span>
                {/* Minimum 32px+ at 1920x1080, weight 600+; Space Grotesk display face for this headline moment */}
                <h1 className="font-display font-semibold text-ink-900 leading-tight text-[clamp(2.5rem,7vw,6rem)]">
                  {pitchingTeam.team_name}
                </h1>
                <div className="flex items-center justify-center gap-3 text-lg">
                  <span className="text-ink-600">{pitchingTeam.domain}</span>
                  <PoolBadge pool={pitchingTeam.pool} className="text-base px-3 py-1" />
                </div>
              </div>

              {/* Timer */}
              <div className={`tabular-nums font-display font-semibold text-[clamp(3.5rem,12vw,10rem)] leading-none ${isLowTime ? 'text-accent-500' : 'text-ink-900'}`}>
                {formatClock(secondsLeft)}
              </div>

              {/* Approved Q&A banner during Q&A phase */}
              <AnimatePresence>
                {eventState?.timer_phase === 'qa' && latestQuestion && (
                  <motion.div
                    initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    className="max-w-3xl mx-auto card rounded-2xl p-6 text-left flex items-start gap-4"
                  >
                    <HelpCircle className="w-6 h-6 text-brand-600 shrink-0 mt-1" />
                    <div>
                      <p className="text-xs font-semibold text-ink-600 uppercase tracking-wider mb-1">
                        Approved Question &bull; from {latestQuestion.asking_team?.team_name || 'a rival team'}
                      </p>
                      <p className="text-xl text-ink-900 font-medium">&ldquo;{latestQuestion.question_text}&rdquo;</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          ) : (
            <motion.section
              key="idle"
              initial={reducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-3xl text-center space-y-8"
            >
              <Image src="/logo-icon.png" alt="Pitch Under Pressure" width={120} height={120} className="w-24 h-24 sm:w-32 sm:h-32 mx-auto object-contain" priority />
              <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-700 to-accent-500">
                PITCH UNDER PRESSURE
              </h1>
              <p className="text-ink-600 text-lg">Waiting for the next pitch to begin...</p>

              {teamRegisterUrl && (
                <div className="inline-flex flex-col items-center gap-3 card rounded-2xl p-6">
                  <QRCode value={teamRegisterUrl} size={180} />
                  <p className="text-xs text-ink-600 max-w-xs">Scan to open the Team Portal and register or log in</p>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Live leaderboard ticker — CSS marquee, no new dependency, paused under reduced-motion */}
        {!finalFourRevealed && leaderboard.length > 0 && (
          <div className="w-full max-w-6xl overflow-hidden border-t border-b border-ink-900/10 py-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-ink-600 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-accent-warm" />
              Live Leaderboard
            </div>
            <div className="overflow-hidden">
              <div className={`flex gap-6 w-max ${reducedMotion ? '' : 'marquee-track'}`}>
                {[...leaderboard, ...leaderboard].map((entry, i) => (
                  <div key={`${entry.team_id}-${i}`} className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-xl bg-white border border-ink-900/10">
                    <span className="tabular-nums text-sm font-semibold text-ink-900">#{leaderboard.findIndex((e) => e.team_id === entry.team_id) + 1}</span>
                    <span className="text-sm font-semibold text-ink-900">{entry.team_name}</span>
                    <PoolBadge pool={entry.pool} />
                    <span className="tabular-nums text-sm font-semibold text-brand-700">{entry.total_weighted_score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
