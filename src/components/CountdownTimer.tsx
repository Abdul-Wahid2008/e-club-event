'use client';

import { useEffect, useState } from 'react';
import { Clock, Play, Pause, RotateCcw, Square } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, TimerStatus } from '@/src/lib/types';

interface CountdownTimerProps {
  initialState?: EventState | null;
  showControls?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onEnd?: () => void;
}

export default function CountdownTimer({
  initialState,
  showControls = false,
  onStart,
  onPause,
  onReset,
  onEnd,
}: CountdownTimerProps) {
  const [eventState, setEventState] = useState<EventState | null>(initialState || null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    setEventState(initialState || null);
  }, [initialState]);

  // Subscribe to Supabase Realtime on `event_state`
  useEffect(() => {
    const supabase = createClient();

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

  // Compute countdown ticker. timer_status defaults to 'idle' and only
  // ever becomes 'running' via an explicit Start Timer action elsewhere —
  // this component never starts the timer on its own.
  useEffect(() => {
    if (!eventState) return;

    const { timer_status, timer_started_at, timer_duration_seconds, timer_paused_remaining } = eventState;

    if (timer_status === 'idle' || timer_status === 'ended') {
      setSecondsLeft(timer_duration_seconds || 180);
      return;
    }

    if (timer_status === 'paused') {
      setSecondsLeft(timer_paused_remaining ?? 0);
      return;
    }

    const calculateRemaining = () => {
      if (!timer_started_at) return timer_duration_seconds;
      const startTime = new Date(timer_started_at).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      return Math.max(0, timer_duration_seconds - elapsed);
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

  const getStatusBadge = (status?: TimerStatus) => {
    switch (status) {
      case 'running':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40">RUNNING</span>;
      case 'paused':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-600/30 text-gray-400 border border-gray-600/40">PAUSED</span>;
      case 'ended':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink/20 text-brand-pink border border-brand-pink/40">ENDED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-800 text-gray-400">IDLE</span>;
    }
  };

  const isLowTime = secondsLeft <= 30 && eventState?.timer_status === 'running';

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-surface-border">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLowTime ? 'bg-red-500/20 text-red-400 animate-bounce' : 'bg-brand-cyan/10 text-brand-cyan'}`}>
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-mono">Pitch Timer</span>
            {getStatusBadge(eventState?.timer_status)}
          </div>
          <p className="text-xs text-gray-400">Synced across Team, Judge, Organiser screens</p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className={`font-mono text-3xl md:text-4xl font-extrabold tracking-widest ${isLowTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {formatTime(secondsLeft)}
        </div>

        {showControls && (
          <div className="flex items-center space-x-1.5 bg-gray-900/80 p-1.5 rounded-lg border border-gray-800">
            <button
              onClick={onStart}
              disabled={eventState?.timer_status === 'running'}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 disabled:opacity-40 rounded transition-colors flex items-center space-x-1"
              title="Start Timer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start</span>
            </button>
            <button
              onClick={onPause}
              disabled={eventState?.timer_status !== 'running'}
              className="px-2 py-1 text-[11px] font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 rounded transition-colors"
              title="Pause Timer"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onReset}
              className="px-2 py-1 text-[11px] font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onEnd}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-pink/20 text-brand-pink hover:bg-brand-pink/30 rounded transition-colors flex items-center space-x-1"
              title="End Pitch"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Pitch</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
