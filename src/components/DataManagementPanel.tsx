'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import Toast, { ToastMessage } from '@/src/components/Toast';
import PoolBadge from '@/src/components/PoolBadge';
import { Team } from '@/src/lib/types';
import { deleteTeamsAction, fullEventResetAction } from '@/src/app/actions/dataManagementActions';

interface DataManagementPanelProps {
  teams: Team[];
  onDataChange: () => void;
}

export default function DataManagementPanel({ teams, onDataChange }: DataManagementPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const [resetPhrase, setResetPhrase] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<ToastMessage | null>(null);
  const [resetArmed, setResetArmed] = useState(false);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === teams.length ? new Set() : new Set(teams.map((t) => t.id))));
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} team(s) and all their scores/questions/members? This cannot be undone.`)) return;

    setLoading(true);
    setMessage(null);
    const res = await deleteTeamsAction(Array.from(selected));
    setLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: `Deleted ${res.deletedCount} team(s).` });
      setSelected(new Set());
      onDataChange();
    }
  };

  const handleDeleteOne = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}" and all their scores/questions/members? This cannot be undone.`)) return;

    setLoading(true);
    setMessage(null);
    const res = await deleteTeamsAction([teamId]);
    setLoading(false);

    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: `Deleted "${teamName}".` });
      onDataChange();
    }
  };

  const handleFullReset = async () => {
    setResetLoading(true);
    setResetMessage(null);
    const res = await fullEventResetAction(resetPhrase);
    setResetLoading(false);

    if (res.error) {
      setResetMessage({ type: 'error', text: res.error });
    } else {
      setResetMessage({ type: 'success', text: 'Full event reset complete. Every team, score, question, and the timer have been cleared.' });
      setResetPhrase('');
      setResetArmed(false);
      onDataChange();
    }
  };

  return (
    <div className="space-y-8">
      {/* SELECTIVE CLEANUP */}
      <div className="card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-accent-warm" />
              <span>Registered Teams — Cleanup</span>
            </h2>
            <p className="text-xs text-text-secondary">Select one or more test/duplicate teams to remove. Deletes their members, pitches, scores, and questions too.</p>
          </div>
          <button
            onClick={handleDeleteSelected}
            disabled={loading || selected.size === 0}
            className="px-4 py-2 rounded-xl font-bold text-xs bg-danger-500/15 hover:bg-danger-500/25 text-danger-500 border border-danger-500/40 disabled:opacity-40 transition-colors flex items-center space-x-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected ({selected.size})</span>
          </button>
        </div>

        <Toast message={message} />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-panel-border text-text-secondary uppercase tracking-wider font-mono">
                <th className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={teams.length > 0 && selected.size === teams.length}
                    onChange={toggleAll}
                    className="accent-brand-500"
                  />
                </th>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Pool</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered At</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      className="accent-brand-500"
                    />
                  </td>
                  <td className="py-3 px-4 font-bold text-text-primary">{t.team_name}</td>
                  <td className="py-3 px-4 text-accent-warm">{t.domain}</td>
                  <td className="py-3 px-4"><PoolBadge pool={t.pool} /></td>
                  <td className="py-3 px-4 text-text-secondary">{t.status}</td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-[10px]">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDeleteOne(t.id, t.team_name)}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-lg font-semibold bg-white/5 hover:bg-danger-500/15 text-text-secondary hover:text-danger-500 border border-panel-border transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary/70 italic">No teams registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL EVENT RESET */}
      <div className="rounded-2xl p-6 space-y-4 border-2 border-danger-500/50 bg-danger-500/[0.04]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-danger-500/15 text-danger-500 flex items-center justify-center border border-danger-500/40 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-danger-500">Full Event Reset</h2>
            <p className="text-xs text-text-secondary">Wipes ALL teams, members, scores, questions, and pitch/timer state back to a completely fresh event. Use this right before doors open — there is no undo.</p>
          </div>
        </div>

        <Toast message={resetMessage} />

        {!resetArmed ? (
          <button
            onClick={() => setResetArmed(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-danger-500/15 hover:bg-danger-500/25 text-danger-500 border border-danger-500/40 transition-colors flex items-center space-x-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>I understand — proceed to reset</span>
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-black/20 border border-danger-500/30">
            <p className="text-xs text-text-primary font-semibold">
              Type <span className="font-mono text-danger-500">RESET</span> below to confirm. This immediately and permanently deletes every team, score, and question in the database.
            </p>
            <input
              type="text"
              value={resetPhrase}
              onChange={(e) => setResetPhrase(e.target.value)}
              placeholder="Type RESET to confirm"
              className="w-full bg-white/5 border border-danger-500/40 rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-danger-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleFullReset}
                disabled={resetLoading || resetPhrase.trim().toUpperCase() !== 'RESET'}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-danger-500 hover:bg-danger-500/90 text-white disabled:opacity-40 transition-colors"
              >
                {resetLoading ? 'Resetting Everything...' : 'Confirm Full Event Reset'}
              </button>
              <button
                onClick={() => { setResetArmed(false); setResetPhrase(''); }}
                disabled={resetLoading}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-text-secondary border border-panel-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
