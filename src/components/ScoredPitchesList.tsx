'use client';

import { CheckCircle2 } from 'lucide-react';
import { PitchLeaderboardEntry } from '@/src/lib/types';

interface ScoredPitchesListProps {
  entries: PitchLeaderboardEntry[];
}

export default function ScoredPitchesList({ entries }: ScoredPitchesListProps) {
  const scored = entries.filter((e) => e.queue_status === 'scored');

  if (scored.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center border border-surface-border">
        <CheckCircle2 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
        <h3 className="text-base font-bold text-gray-300">No Pitches Scored Yet</h3>
        <p className="text-xs text-gray-400 mt-1">Scored pitches will appear here read-only. Corrections go through Manual Override.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 border border-surface-border overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider font-mono">
            <th className="py-3 px-3">Team</th>
            <th className="py-3 px-3">Domain / Pool</th>
            <th className="py-3 px-3">Problem (20)</th>
            <th className="py-3 px-3">Solution (20)</th>
            <th className="py-3 px-3">Feasibility (15)</th>
            <th className="py-3 px-3">Storytelling (15)</th>
            <th className="py-3 px-3">Weighted Total</th>
            <th className="py-3 px-3">Submitted By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {scored.map((e) => (
            <tr key={e.pitch_id} className="hover:bg-gray-900/50 transition-colors">
              <td className="py-3 px-3 font-bold text-white">{e.team_name}</td>
              <td className="py-3 px-3 text-gray-300">
                <span className="text-brand-gold">{e.domain}</span> • Pool {e.pool}
              </td>
              <td className="py-3 px-3 font-mono text-gray-300">{(e.problem_market_score / 5).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-gray-300">{(e.solution_innovation_score / 5).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-gray-300">{(e.feasibility_score / (100 / 15)).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-gray-300">{(e.pitch_storytelling_score / (100 / 15)).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono font-bold text-brand-cyan">{(e.total_weighted_score ?? 0).toFixed(2)}</td>
              <td className="py-3 px-3 text-gray-400">{e.submitted_by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
