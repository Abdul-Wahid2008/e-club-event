'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/src/components/Navbar';
import CountdownTimer from '@/src/components/CountdownTimer';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import { Flame } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team } from '@/src/lib/types';

type PitchWithTeam = Pitch & { teams?: Team };

export default function DisplayPage() {
  const [eventState, setEventState] = useState<EventState | null>(null);
  const [currentPitch, setCurrentPitch] = useState<PitchWithTeam | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    if (es) setEventState(es as EventState);

    if (es?.current_pitch_id) {
      const { data: pData } = await supabase
        .from('pitches')
        .select('*, teams(*)')
        .eq('id', es.current_pitch_id)
        .single();
      setCurrentPitch((pData as any) || null);
    } else {
      setCurrentPitch(null);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel('display_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const pitchingTeam = currentPitch?.teams;

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole={null} />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 w-full">
        <CountdownTimer initialState={eventState || undefined} showControls={false} />

        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-surface-border text-center">
          {pitchingTeam ? (
            <>
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40 text-xs font-bold uppercase tracking-wider mb-4">
                <Flame className="w-4 h-4" />
                <span>NOW PITCHING</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold text-white">{pitchingTeam.team_name}</h1>
              <p className="text-sm text-gray-400 mt-3">
                Domain: <span className="text-brand-gold font-bold">{pitchingTeam.domain}</span> • Pool <span className="text-brand-cyan font-bold">{pitchingTeam.pool}</span>
              </p>
            </>
          ) : (
            <h2 className="text-2xl font-bold text-gray-400">Waiting for the next team to be called to stage...</h2>
          )}
        </div>

        <LiveLeaderboard roundName="prelim" />
      </main>
    </div>
  );
}
