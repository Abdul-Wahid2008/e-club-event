'use client';

import { useEffect, useState } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, Flame, Lock, HelpCircle, CheckCircle2 } from 'lucide-react';
import CountdownTimer from '@/src/components/CountdownTimer';
import { createClient } from '@/src/lib/supabase/client';
import { EventState, Pitch, Team, Question } from '@/src/lib/types';
import {
  callToStageAction,
  reorderQueueAction,
  startTimerAction,
  pauseTimerAction,
  resetTimerAction,
  endPitchAction,
  submitPitchScoreAction,
} from '@/src/app/actions/pitchQueueActions';

type PitchWithTeam = Pitch & { teams?: Team };

interface PitchQueuePanelProps {
  eventState: EventState | null;
  pitches: PitchWithTeam[];
  approvedQuestions: Question[];
  onDataChange: () => void;
}

function sortQueue(pitches: PitchWithTeam[]) {
  return [...pitches]
    .filter((p) => p.queue_status === 'queued')
    .sort((a, b) => {
      const aKey = a.queue_position_override ?? a.pitch_order;
      const bKey = b.queue_position_override ?? b.pitch_order;
      return aKey - bKey;
    });
}

export default function PitchQueuePanel({ eventState, pitches, approvedQuestions, onDataChange }: PitchQueuePanelProps) {
  const [queue, setQueue] = useState<PitchWithTeam[]>(sortQueue(pitches));
  const [loadingAction, setLoadingAction] = useState(false);
  const [scoreMessage, setScoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [probMarket, setProbMarket] = useState(15);
  const [solInnovation, setSolInnovation] = useState(15);
  const [feasibility, setFeasibility] = useState(11);
  const [storytelling, setStorytelling] = useState(11);

  useEffect(() => {
    setQueue(sortQueue(pitches));
  }, [pitches]);

  const currentPitch = pitches.find((p) => p.id === eventState?.current_pitch_id) || null;
  const pitchingTeam = currentPitch?.teams;

  const handleReorder = async (newOrder: PitchWithTeam[]) => {
    setQueue(newOrder);
    await reorderQueueAction(newOrder.map((p) => p.id));
    onDataChange();
  };

  const handleCallToStage = async (pitchId: string) => {
    setLoadingAction(true);
    setActionError(null);
    const res = await callToStageAction(pitchId);
    setLoadingAction(false);
    if (res.error) setActionError(res.error);
    onDataChange();
  };

  const handleSubmitScore = async () => {
    if (!currentPitch) return;
    setLoadingAction(true);
    setScoreMessage(null);

    const res = await submitPitchScoreAction({
      pitchId: currentPitch.id,
      scores: {
        problem_market: probMarket,
        solution_innovation: solInnovation,
        feasibility,
        pitch_storytelling: storytelling,
      },
    });

    setLoadingAction(false);
    if (res.error) {
      setScoreMessage({ type: 'error', text: res.error });
    } else {
      setScoreMessage({ type: 'success', text: 'Score submitted & locked!' });
      onDataChange();
    }
  };

  return (
    <div className="space-y-8">
      <CountdownTimer
        initialState={eventState || undefined}
        showControls={true}
        onStart={async () => { setActionError(null); const r = await startTimerAction(); if (r.error) setActionError(r.error); onDataChange(); }}
        onPause={async () => { setActionError(null); const r = await pauseTimerAction(); if (r.error) setActionError(r.error); onDataChange(); }}
        onReset={async () => { setActionError(null); const r = await resetTimerAction(); if (r.error) setActionError(r.error); onDataChange(); }}
        onEnd={async () => { setActionError(null); const r = await endPitchAction(); if (r.error) setActionError(r.error); onDataChange(); }}
      />

      {actionError && (
        <div className="p-3.5 rounded-xl text-xs font-semibold border bg-red-500/20 text-red-300 border-red-500/40">
          {actionError}
        </div>
      )}

      {/* CURRENT PITCH CONTEXT */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-surface-border">
        {pitchingTeam ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40 text-xs font-bold uppercase tracking-wider mb-2">
                  <Flame className="w-4 h-4" />
                  <span>ON STAGE • {currentPitch?.queue_status.toUpperCase()}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{pitchingTeam.team_name}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  Domain: <span className="text-brand-gold font-bold">{pitchingTeam.domain}</span> • Pool <span className="text-brand-cyan font-bold">{pitchingTeam.pool}</span>
                </p>
              </div>
            </div>

            {approvedQuestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-brand-pink" />
                  <span>Approved Q&A Context</span>
                </h3>
                <div className="space-y-2">
                  {approvedQuestions.map((q) => (
                    <div key={q.id} className="p-3 rounded-xl bg-gray-900/90 border border-gray-800 text-xs text-gray-200">
                      {q.question_text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPitch?.queue_status === 'awaiting_score' && (
              <div className="pt-4 border-t border-gray-800 space-y-5">
                {scoreMessage && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-semibold border ${
                      scoreMessage.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {scoreMessage.text}
                  </div>
                )}

                <ScoreSlider label="1. Problem & Market Insight (20%)" max={20} value={probMarket} onChange={setProbMarket} />
                <ScoreSlider label="2. Solution & Innovation (20%)" max={20} value={solInnovation} onChange={setSolInnovation} />
                <ScoreSlider label="3. Feasibility & Business Model (15%)" max={15} value={feasibility} onChange={setFeasibility} />
                <ScoreSlider label="4. Pitch & Storytelling (15%)" max={15} value={storytelling} onChange={setStorytelling} />

                <button
                  onClick={handleSubmitScore}
                  disabled={loadingAction}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-purple hover:bg-brand-purple/90 text-white transition-all shadow-purple-glow flex items-center justify-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loadingAction ? 'Submitting & Locking...' : 'Submit & Lock Score for this Pitch'}</span>
                </button>
              </div>
            )}

            {currentPitch?.queue_status === 'scored' && (
              <div className="p-4 text-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>This pitch has been scored. See the Scored tab.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Flame className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-gray-300">No Pitch Called to Stage</h3>
            <p className="text-xs text-gray-400 mt-1">Call the next team from the queue below.</p>
          </div>
        )}
      </div>

      {/* QUEUE */}
      <div className="glass-card rounded-2xl p-6 border border-surface-border space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Up Next Queue</h2>
          <p className="text-xs text-gray-400">Registration order by default — drag to reorder for real-world adjustments.</p>
        </div>

        {queue.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-4 text-center">No teams currently queued.</p>
        ) : (
          <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="space-y-2">
            {queue.map((p) => (
              <Reorder.Item
                key={p.id}
                value={p}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-900/70 border border-gray-800 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.teams?.team_name || 'Unassigned'}</p>
                    <p className="text-[11px] text-gray-400">
                      Domain: <span className="text-brand-gold">{p.teams?.domain}</span> • Pool {p.teams?.pool}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCallToStage(p.id)}
                  disabled={loadingAction}
                  className="px-3 py-1.5 rounded-lg font-bold text-xs bg-brand-cyan/20 hover:bg-brand-cyan hover:text-black text-brand-cyan border border-brand-cyan/40 transition-all shrink-0"
                >
                  Call to Stage
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  );
}

function ScoreSlider({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="text-gray-200">{label}</span>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min={0}
            max={max}
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(Number(e.target.value) || 0, max)))}
            className="w-14 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-brand-purple"
          />
          <span className="text-xs text-gray-400 font-mono">/ {max}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-purple"
      />
    </div>
  );
}
