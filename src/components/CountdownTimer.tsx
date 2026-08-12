'use client';

import { useEffect, useState } from 'react';
import { Clock, Play, Pause, AlertCircle } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, TimerPhase } from '@/src/lib/types';

interface CountdownTimerProps {
  initialState?: EventState | null;
  showControls?: boolean;
  onPhaseChange?: (phase: TimerPhase, durationSeconds?: number) => void;
}

export default function CountdownTimer({
  initialState,
  showControls = false,
  onPhaseChange,
}: CountdownTimerProps) {
  const [eventState, setEventState] = useState<EventState | null>(initialState || null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Subscribe to Supabase Realtime on `event_state`
  useEffect(() => {
    const supabase = createClient();

    // Initial fetch if missing
    if (!initialState) {
      supabase
        .from('event_state')
        .select('*')
        .eq('id', 1)
        .single()
        .then(({ data }: any) => {
          if (data) setEventState(data as EventState);
        });
    }

    const channel = supabase
      .channel('timer_event_state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_state', filter: 'id=eq.1' },
        (payload: any) => {
          setEventState(payload.new as EventState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialState]);

  // Compute countdown ticker
  useEffect(() => {
    if (!eventState) return;

    const { timer_phase, timer_started_at, timer_duration_seconds, timer_paused_remaining } = eventState;

    if (timer_phase === 'idle') {
      setSecondsLeft(timer_duration_seconds || 600);
      return;
    }

    if (timer_phase === 'paused') {
      setSecondsLeft(timer_paused_remaining ?? 0);
      return;
    }

    const calculateRemaining = () => {
      if (!timer_started_at) return timer_duration_seconds;
      const startTime = new Date(timer_started_at).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, timer_duration_seconds - elapsed);
      return remaining;
    };

    setSecondsLeft(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [eventState]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseBadge = (phase?: TimerPhase) => {
    switch (phase) {
      case 'prep':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">10-MIN PREP</span>;
      case 'pitch':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40">3-MIN PITCH</span>;
      case 'qa':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink/20 text-brand-pink border border-brand-pink/40">2-MIN Q&A</span>;
      case 'paused':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-600/30 text-gray-400 border border-gray-600/40">PAUSED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-800 text-gray-400">IDLE</span>;
    }
  };

  const isLowTime = secondsLeft <= 30 && eventState?.timer_phase !== 'idle' && eventState?.timer_phase !== 'paused';

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-surface-border">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLowTime ? 'bg-red-500/20 text-red-400 animate-bounce' : 'bg-brand-cyan/10 text-brand-cyan'}`}>
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-mono">Live Timer</span>
            {getPhaseBadge(eventState?.timer_phase)}
          </div>
          <p className="text-xs text-gray-400">Synced across Team, Judge, Organiser screens</p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className={`font-mono text-3xl md:text-4xl font-extrabold tracking-widest ${isLowTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {formatTime(secondsLeft)}
        </div>

        {showControls && onPhaseChange && (
          <div className="flex items-center space-x-1.5 bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
            <button
              onClick={() => onPhaseChange('prep', 600)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded transition-colors"
              title="10 Min Prep Phase"
            >
              Prep (10m)
            </button>
            <button
              onClick={() => onPhaseChange('pitch', 180)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 rounded transition-colors"
              title="3 Min Pitching Phase"
            >
              Pitch (3m)
            </button>
            <button
              onClick={() => onPhaseChange('qa', 120)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-pink/20 text-brand-pink hover:bg-brand-pink/30 rounded transition-colors"
              title="2 Min Q&A Phase"
            >
              Q&A (2m)
            </button>
            <button
              onClick={() => onPhaseChange('paused')}
              className="px-2 py-1 text-[11px] font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition-colors"
              title="Pause Timer"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onPhaseChange('idle')}
              className="px-2 py-1 text-[11px] font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition-colors"
              title="Reset Timer"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
