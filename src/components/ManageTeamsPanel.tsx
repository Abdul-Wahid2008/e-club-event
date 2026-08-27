'use client';

import { useState, useMemo } from 'react';
import { Users, UserPlus, GitMerge, Lock, ArrowRightLeft, Plus } from 'lucide-react';
import Toast, { ToastMessage } from '@/src/components/Toast';
import PoolBadge from '@/src/components/PoolBadge';
import { Team, TeamMember, RosterAuditLog } from '@/src/lib/types';
import { moveTeamMemberAction, mergeTeamsAction, createEmptyTeamAction } from '@/src/app/actions/rosterActions';

interface ManageTeamsPanelProps {
  teams: Team[];
  teamMembers: TeamMember[];
  lockedTeamIds: Set<string>;
  domains: { id: string; name: string }[];
  rosterAuditLogs: RosterAuditLog[];
  onDataChange: () => void;
}

export default function ManageTeamsPanel({ teams, teamMembers, lockedTeamIds, domains, rosterAuditLogs, onDataChange }: ManageTeamsPanelProps) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(false);

  const [moveMemberId, setMoveMemberId] = useState('');
  const [moveDestTeamId, setMoveDestTeamId] = useState('');

  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeDestId, setMergeDestId] = useState('');
  const [mergeKeepDomain, setMergeKeepDomain] = useState('');
  const [mergeKeepPool, setMergeKeepPool] = useState<'A' | 'B'>('A');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDomain, setNewTeamDomain] = useState('');
  const [newTeamPool, setNewTeamPool] = useState<'A' | 'B'>('A');

  const membersByTeam = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const m of teamMembers) {
      if (!map.has(m.team_id)) map.set(m.team_id, []);
      map.get(m.team_id)!.push(m);
    }
    return map;
  }, [teamMembers]);

  const sourceTeam = teams.find((t) => t.id === mergeSourceId);
  const destTeam = teams.find((t) => t.id === mergeDestId);
  const domainMismatch = sourceTeam && destTeam && sourceTeam.domain !== destTeam.domain;
  const poolMismatch = sourceTeam && destTeam && sourceTeam.pool !== destTeam.pool;

  const handleMove = async () => {
    if (!moveMemberId || !moveDestTeamId) {
      setMessage({ type: 'error', text: 'Select both a member and a destination team.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await moveTeamMemberAction({ memberId: moveMemberId, destinationTeamId: moveDestTeamId });
    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Member moved successfully.' });
      setMoveMemberId('');
      setMoveDestTeamId('');
      onDataChange();
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeDestId) {
      setMessage({ type: 'error', text: 'Select both teams to merge.' });
      return;
    }
    if (mergeSourceId === mergeDestId) {
      setMessage({ type: 'error', text: 'Cannot merge a team into itself.' });
      return;
    }
    if (!mergeKeepDomain) {
      setMessage({ type: 'error', text: 'Choose which domain the merged team keeps.' });
      return;
    }
    if (!confirm(`Merge "${sourceTeam?.team_name}" into "${destTeam?.team_name}"? "${sourceTeam?.team_name}" will be deleted.`)) return;

    setLoading(true);
    setMessage(null);
    const res = await mergeTeamsAction({
      sourceTeamId: mergeSourceId,
      destinationTeamId: mergeDestId,
      keepDomain: mergeKeepDomain,
      keepPool: mergeKeepPool,
    });
    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Teams merged successfully.' });
      setMergeSourceId('');
      setMergeDestId('');
      setMergeKeepDomain('');
      onDataChange();
    }
  };

  const handleCreate = async () => {
    if (!newTeamName.trim() || !newTeamDomain) {
      setMessage({ type: 'error', text: 'Team name and domain are required.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await createEmptyTeamAction({ teamName: newTeamName.trim(), domain: newTeamDomain, pool: newTeamPool });
    setLoading(false);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: `Created team "${newTeamName}".` });
      setNewTeamName('');
      setNewTeamDomain('');
      setShowCreateForm(false);
      onDataChange();
    }
  };

  return (
    <div className="space-y-8">
      <Toast message={message} />

      {/* TEAM ROSTER LIST */}
      <div className="card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand-500" />
            <span>All Teams & Solo Pitchers ({teams.length})</span>
          </h2>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="px-4 py-2 rounded-xl font-bold text-xs bg-brand-500/15 hover:bg-brand-500/25 text-brand-500 border border-brand-500/40 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Empty Team</span>
          </button>
        </div>

        {showCreateForm && (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-panel-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
              />
              <select
                value={newTeamDomain}
                onChange={(e) => setNewTeamDomain(e.target.value)}
                className="bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
              >
                <option value="">Select domain...</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <select
                value={newTeamPool}
                onChange={(e) => setNewTeamPool(e.target.value as 'A' | 'B')}
                className="bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
              >
                <option value="A">Pool A</option>
                <option value="B">Pool B</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 rounded-lg font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white transition-colors"
              >
                Create Team
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg font-bold text-xs bg-white/5 hover:bg-white/10 text-text-secondary border border-panel-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-panel-border text-text-secondary uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Pool</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {teams.map((t) => {
                const members = membersByTeam.get(t.id) || [];
                const locked = lockedTeamIds.has(t.id);
                return (
                  <tr key={t.id} className="hover:bg-white/[0.03] transition-colors align-top">
                    <td className="py-3 px-4 font-bold text-text-primary">
                      {t.team_name}
                      {members.length === 1 && <span className="ml-2 text-[10px] font-mono text-text-secondary uppercase">(Solo)</span>}
                      {t.join_code && <div className="text-[10px] font-mono text-text-secondary mt-0.5">Code: {t.join_code}</div>}
                    </td>
                    <td className="py-3 px-4 text-accent-warm">{t.domain}</td>
                    <td className="py-3 px-4"><PoolBadge pool={t.pool} /></td>
                    <td className="py-3 px-4 text-text-secondary">
                      {members.length === 0 ? (
                        <span className="italic text-text-secondary/60">No members</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {members.map((m) => (
                            <li key={m.id}>{m.name} {m.is_leader && <span className="text-brand-500">(Leader)</span>}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-mono text-[10px]">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      {locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-live/15 text-accent-live border border-accent-live/40">
                          <Lock className="w-3 h-3" />
                          Locked — already pitched/pitching
                        </span>
                      ) : (
                        <span className="text-text-secondary/60 text-[10px]">Editable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-secondary/70 italic">No teams registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOVE MEMBER */}
      <div className="card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
          <ArrowRightLeft className="w-5 h-5 text-brand-500" />
          <span>Move a Member Between Teams</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] text-text-secondary mb-1">Member</label>
            <select
              value={moveMemberId}
              onChange={(e) => setMoveMemberId(e.target.value)}
              className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="">Select member...</option>
              {teamMembers.map((m) => {
                const t = teams.find((team) => team.id === m.team_id);
                const disabled = t ? lockedTeamIds.has(t.id) : false;
                return (
                  <option key={m.id} value={m.id} disabled={disabled}>
                    {m.name} ({t?.team_name}){disabled ? ' — locked' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-text-secondary mb-1">Destination Team</label>
            <select
              value={moveDestTeamId}
              onChange={(e) => setMoveDestTeamId(e.target.value)}
              className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="">Select team...</option>
              {teams.map((t) => {
                const memberCount = (membersByTeam.get(t.id) || []).length;
                const disabled = lockedTeamIds.has(t.id) || memberCount >= 4;
                return (
                  <option key={t.id} value={t.id} disabled={disabled}>
                    {t.team_name} ({memberCount}/4){disabled ? (lockedTeamIds.has(t.id) ? ' — locked' : ' — full') : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={handleMove}
            disabled={loading || !moveMemberId || !moveDestTeamId}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white disabled:opacity-40 transition-colors"
          >
            Move Member
          </button>
        </div>
      </div>

      {/* MERGE TEAMS */}
      <div className="card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
          <GitMerge className="w-5 h-5 text-brand-500" />
          <span>Merge Two Teams</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-text-secondary mb-1">Source Team (will be deleted after merge)</label>
            <select
              value={mergeSourceId}
              onChange={(e) => { setMergeSourceId(e.target.value); setMergeKeepDomain(''); }}
              className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="">Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={lockedTeamIds.has(t.id)}>
                  {t.team_name}{lockedTeamIds.has(t.id) ? ' — locked' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-text-secondary mb-1">Destination Team (keeps this name)</label>
            <select
              value={mergeDestId}
              onChange={(e) => { setMergeDestId(e.target.value); setMergeKeepDomain(''); }}
              className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
            >
              <option value="">Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={lockedTeamIds.has(t.id)}>
                  {t.team_name}{lockedTeamIds.has(t.id) ? ' — locked' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(domainMismatch || poolMismatch) && sourceTeam && destTeam && (
          <div className="p-4 rounded-xl bg-accent-warm/10 border border-accent-warm/40 space-y-3">
            <p className="text-xs font-semibold text-accent-warm">
              These teams have different {domainMismatch && 'domains'}{domainMismatch && poolMismatch && ' and '}{poolMismatch && 'pools'}. Choose what the merged team keeps:
            </p>
            {domainMismatch && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMergeKeepDomain(sourceTeam.domain)}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-colors ${mergeKeepDomain === sourceTeam.domain ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 text-text-secondary border-panel-border hover:border-brand-500'}`}
                >
                  Keep {sourceTeam.team_name}&apos;s: {sourceTeam.domain}
                </button>
                <button
                  onClick={() => setMergeKeepDomain(destTeam.domain)}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-colors ${mergeKeepDomain === destTeam.domain ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 text-text-secondary border-panel-border hover:border-brand-500'}`}
                >
                  Keep {destTeam.team_name}&apos;s: {destTeam.domain}
                </button>
              </div>
            )}
            {poolMismatch && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMergeKeepPool(sourceTeam.pool)}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-colors ${mergeKeepPool === sourceTeam.pool ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 text-text-secondary border-panel-border hover:border-brand-500'}`}
                >
                  Keep {sourceTeam.team_name}&apos;s: Pool {sourceTeam.pool}
                </button>
                <button
                  onClick={() => setMergeKeepPool(destTeam.pool)}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-colors ${mergeKeepPool === destTeam.pool ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 text-text-secondary border-panel-border hover:border-brand-500'}`}
                >
                  Keep {destTeam.team_name}&apos;s: Pool {destTeam.pool}
                </button>
              </div>
            )}
          </div>
        )}

        {sourceTeam && destTeam && !domainMismatch && (
          <p className="text-[11px] text-text-secondary">Both teams share domain <strong className="text-text-primary">{sourceTeam.domain}</strong> — no choice needed.</p>
        )}

        <button
          onClick={handleMerge}
          disabled={loading || !mergeSourceId || !mergeDestId || (domainMismatch && !mergeKeepDomain)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-500/90 text-white disabled:opacity-40 transition-colors"
        >
          Merge Teams
        </button>
      </div>

      {/* ROSTER AUDIT LOG */}
      <div className="card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
          <UserPlus className="w-5 h-5 text-brand-500" />
          <span>Roster Change Audit Log</span>
        </h2>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-panel-border text-text-secondary uppercase tracking-wider font-mono sticky top-0 bg-panel">
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {rosterAuditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-3 font-mono text-[10px] text-text-secondary">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2 px-3 font-semibold text-brand-500">{log.action}</td>
                  <td className="py-2 px-3 text-text-secondary">{log.note}</td>
                </tr>
              ))}
              {rosterAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-text-secondary/70 italic">No roster changes yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
