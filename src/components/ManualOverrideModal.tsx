'use client';

import { useState } from 'react';
import { X, ShieldAlert, Lock, Unlock, FileText } from 'lucide-react';
import { PitchLeaderboardEntry } from '@/src/lib/types';
import { manualOverrideScoreAction, unlockPitchScoreAction } from '@/src/app/actions/organiserActions';

interface ManualOverrideModalProps {
  entry: PitchLeaderboardEntry;
  onClose: () => void;
}

export default function ManualOverrideModal({ entry, onClose }: ManualOverrideModalProps) {
  const [activeTab, setActiveTab] = useState<'override' | 'unlock'>('override');
  const [tableChanged, setTableChanged] = useState<'pitch_scores' | 'audience_scores' | 'questions'>('pitch_scores');
  const [category, setCategory] = useState<'problem_market_score' | 'solution_innovation_score' | 'feasibility_score' | 'pitch_storytelling_score'>('problem_market_score');
  const [rowId, setRowId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [note, setNote] = useState('');
  const [unlockScoreId, setUnlockScoreId] = useState('');
  const [unlockNote, setUnlockNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await manualOverrideScoreAction({
      tableChanged,
      rowId,
      oldValue: null,
      newValue: tableChanged === 'pitch_scores' ? { category, score: Number(newValue) } : { score: Number(newValue) },
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
    setLoading(true);
    setMessage(null);

    const res = await unlockPitchScoreAction(unlockScoreId, unlockNote);

    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Pitch score unlocked successfully!' });
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-lg p-6 border border-brand-purple/40 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-purple/20 text-brand-purple flex items-center justify-center border border-brand-purple/40">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Manual Override Control</h3>
            <p className="text-xs text-gray-400">Team: <span className="text-brand-cyan font-bold">{entry.team_name}</span> (Pool {entry.pool})</p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-gray-800 mb-5">
          <button
            onClick={() => setActiveTab('override')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'override'
                ? 'border-brand-purple text-brand-purple'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Direct Score Override
          </button>
          <button
            onClick={() => setActiveTab('unlock')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'unlock'
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Unlock Judge Score
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold mb-4 border ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}
          >
            {message.text}
          </div>
        )}

        {activeTab === 'override' ? (
          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Target Table</label>
              <select
                value={tableChanged}
                onChange={(e: any) => setTableChanged(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-purple"
              >
                <option value="pitch_scores">pitch_scores</option>
                <option value="audience_scores">audience_scores</option>
                <option value="questions">questions</option>
              </select>
            </div>

            {tableChanged === 'pitch_scores' && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-purple"
                >
                  <option value="problem_market_score">Problem & Market (/20)</option>
                  <option value="solution_innovation_score">Solution & Innovation (/20)</option>
                  <option value="feasibility_score">Feasibility & Business (/15)</option>
                  <option value="pitch_storytelling_score">Pitch & Storytelling (/15)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Target Row UUID</label>
              <input
                type="text"
                required
                placeholder="Enter score UUID"
                value={rowId}
                onChange={(e) => setRowId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-purple"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">New Value</label>
              <input
                type="number"
                required
                placeholder="New Score / Points"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-purple"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Mandatory Audit Note</label>
              <textarea
                required
                rows={2}
                placeholder="State reason for manual override..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-purple"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs transition-colors shadow-purple-glow"
            >
              {loading ? 'Executing Override...' : 'Confirm Manual Override'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Judge Score ID to Unlock</label>
              <input
                type="text"
                required
                placeholder="Enter Judge Score UUID"
                value={unlockScoreId}
                onChange={(e) => setUnlockScoreId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Audit Note for Unlock</label>
              <textarea
                required
                rows={2}
                placeholder="Explain why judge score is being unlocked..."
                value={unlockNote}
                onChange={(e) => setUnlockNote(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold text-xs transition-colors shadow-cyan-glow"
            >
              {loading ? 'Unlocking...' : 'Unlock Judge Score'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
