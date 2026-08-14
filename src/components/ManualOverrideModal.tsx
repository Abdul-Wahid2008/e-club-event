'use client';

import { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { PitchLeaderboardEntry } from '@/src/lib/types';
import { manualOverrideScoreAction, unlockJudgeScoreAction } from '@/src/app/actions/organiserActions';
import PoolBadge from '@/src/components/PoolBadge';
import Toast, { ToastMessage } from '@/src/components/Toast';

interface ManualOverrideModalProps {
  entry: PitchLeaderboardEntry;
  onClose: () => void;
}

export default function ManualOverrideModal({ entry, onClose }: ManualOverrideModalProps) {
  const [activeTab, setActiveTab] = useState<'override' | 'unlock'>('override');
  const [tableChanged, setTableChanged] = useState<'judge_scores' | 'audience_scores' | 'questions'>('judge_scores');
  const [rowId, setRowId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [note, setNote] = useState('');
  const [unlockScoreId, setUnlockScoreId] = useState('');
  const [unlockNote, setUnlockNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);

    const res = await manualOverrideScoreAction({
      tableChanged,
      rowId,
      oldValue: null,
      newValue: { score: Number(newValue) },
      note,
    });

    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Score overridden successfully & logged to audit table!' });
      setTimeout(() => onClose(), 1500);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);

    const res = await unlockJudgeScoreAction(unlockScoreId, unlockNote);

    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Judge score unlocked successfully!' });
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
      <div className="card rounded-2xl w-full max-w-lg p-6 shadow-card-lg relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-ink-600 hover:text-ink-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-accent-warm flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink-900">Manual Override Control</h3>
            <div className="flex items-center gap-2 text-xs text-ink-600">
              <span>Team: <span className="text-ink-900 font-semibold">{entry.team_name}</span></span>
              <PoolBadge pool={entry.pool} />
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-ink-900/10 mb-5">
          <button
            onClick={() => setActiveTab('override')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'override'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
          >
            Direct Score Override
          </button>
          <button
            onClick={() => setActiveTab('unlock')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'unlock'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
          >
            Unlock Judge Score
          </button>
        </div>

        <div className="mb-4">
          <Toast message={message} />
        </div>

        {activeTab === 'override' ? (
          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Target Table</label>
              <select
                value={tableChanged}
                onChange={(e: any) => setTableChanged(e.target.value)}
                className="w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              >
                <option value="judge_scores">judge_scores</option>
                <option value="audience_scores">audience_scores</option>
                <option value="questions">questions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Target Row UUID</label>
              <input
                type="text"
                required
                placeholder="Enter score UUID"
                value={rowId}
                onChange={(e) => setRowId(e.target.value)}
                className="w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">New Value</label>
              <input
                type="number"
                required
                placeholder="New Score / Points"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="tabular-nums w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Mandatory Audit Note</label>
              <textarea
                required
                rows={2}
                placeholder="State reason for manual override..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
            >
              {loading ? 'Executing Override...' : 'Confirm Manual Override'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Judge Score ID to Unlock</label>
              <input
                type="text"
                required
                placeholder="Enter Judge Score UUID"
                value={unlockScoreId}
                onChange={(e) => setUnlockScoreId(e.target.value)}
                className="w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Audit Note for Unlock</label>
              <textarea
                required
                rows={2}
                placeholder="Explain why judge score is being unlocked..."
                value={unlockNote}
                onChange={(e) => setUnlockNote(e.target.value)}
                className="w-full bg-surface-base border border-ink-900/15 rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
            >
              {loading ? 'Unlocking...' : 'Unlock Judge Score'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
