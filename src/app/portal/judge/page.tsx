'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/src/components/Navbar';
import PitchQueuePanel from '@/src/components/PitchQueuePanel';
import ScoredPitchesList from '@/src/components/ScoredPitchesList';
import LiveLeaderboard from '@/src/components/LiveLeaderboard';
import { Flame, CheckCircle2, Trophy } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question, PitchLeaderboardEntry } from '@/src/lib/types';

type PitchWithTeam = Pitch & { teams?: Team };

export default function JudgePortalPage() {
  const [activeTab, setActiveTab] = useState<'live' | 'scored' | 'leaderboard'>('live');

  const [eventState, setEventState] = useState<EventState | null>(null);
  const [pitches, setPitches] = useState<PitchWithTeam[]>([]);
  const [approvedQuestions, setApprovedQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard] = useState<PitchLeaderboardEntry[]>([]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: es } = await supabase.from('event_state').select('*').eq('id', 1).single();
    if (es) setEventState(es as EventState);

    const { data: pData } = await supabase
      .from('pitches')
      .select('*, teams(*)')
      .order('pitch_order', { ascending: true });
    if (pData) setPitches(pData as any);

    if (es?.current_pitch_id) {
      const { data: qData } = await supabase
        .from('questions')
        .select('*, asking_team:teams(*)')
        .eq('pitch_id', es.current_pitch_id)
        .eq('status', 'approved');
      if (qData) setApprovedQuestions(qData as any);
    } else {
      setApprovedQuestions([]);
    }

    const { data: lbData } = await supabase.from('pitch_leaderboard').select('*').eq('round_name', 'prelim');
    if (lbData) setLeaderboard(lbData as PitchLeaderboardEntry[]);
  }, []);

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel('judge_portal_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitches' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pitch_scores' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Navbar userRole="judge" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        <div className="glass-panel rounded-2xl p-2 border border-surface-border flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'live' ? 'bg-brand-cyan text-black shadow-cyan-glow' : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Live / Up Next</span>
          </button>
          <button
            onClick={() => setActiveTab('scored')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'scored' ? 'bg-emerald-500 text-black shadow-lg' : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Scored</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 ${
              activeTab === 'leaderboard' ? 'bg-brand-gold text-black shadow-gold-glow' : 'bg-gray-900/60 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>
        </div>

        {activeTab === 'live' && (
          <PitchQueuePanel
            eventState={eventState}
            pitches={pitches}
            approvedQuestions={approvedQuestions}
            onDataChange={fetchData}
          />
        )}

        {activeTab === 'scored' && <ScoredPitchesList entries={leaderboard} />}

        {activeTab === 'leaderboard' && <LiveLeaderboard roundName="prelim" />}
      </main>
    </div>
  );
}
