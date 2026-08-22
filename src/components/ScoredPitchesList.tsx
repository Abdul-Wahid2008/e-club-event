'use client';

import PoolBadge from '@/src/components/PoolBadge';
import { PitchLeaderboardEntry } from '@/src/lib/types';

interface ScoredPitchesListProps {
  entries: PitchLeaderboardEntry[];
}

export default function ScoredPitchesList({ entries }: ScoredPitchesListProps) {
  const scored = entries.filter((e) => e.judges_submitted_count > 0);

  if (scored.length === 0) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <p className="text-sm text-text-secondary">No pitches scored yet.</p>
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-4 sm:p-6 overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-panel-border text-text-secondary uppercase tracking-wider font-mono">
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
        <tbody className="divide-y divide-panel-border">
          {scored.map((e) => (
            <tr key={e.pitch_id} className="hover:bg-white/[0.03] transition-colors">
              <td className="py-3 px-3 font-bold text-text-primary">{e.team_name}</td>
              <td className="py-3 px-3 text-text-secondary">
                <span className="text-accent-warm">{e.domain}</span> • <PoolBadge pool={e.pool} />
              </td>
              <td className="py-3 px-3 font-mono text-text-secondary">{(e.problem_market_score / 5).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-text-secondary">{(e.solution_innovation_score / 5).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-text-secondary">{(e.feasibility_score / (100 / 15)).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono text-text-secondary">{(e.pitch_storytelling_score / (100 / 15)).toFixed(1)}</td>
              <td className="py-3 px-3 font-mono font-bold text-brand-500">{(e.total_weighted_score ?? 0).toFixed(2)}</td>
              <td className="py-3 px-3 text-text-secondary">{e.submitted_by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
