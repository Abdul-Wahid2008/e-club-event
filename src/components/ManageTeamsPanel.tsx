'use client';

import { useState, useMemo, useRef } from 'react';
import { Users, UserPlus, GitMerge, Lock, ArrowRightLeft, Plus, Phone, GripVertical } from 'lucide-react';
import Toast, { ToastMessage } from '@/src/components/Toast';
import PoolBadge from '@/src/components/PoolBadge';
import { Team, TeamMember, RosterAuditLog, TeamContactInfo } from '@/src/lib/types';
import { moveTeamMemberAction, mergeTeamsAction, createEmptyTeamAction } from '@/src/app/actions/rosterActions';

interface ManageTeamsPanelProps {
  teams: Team[];
  teamMembers: TeamMember[];
  lockedTeamIds: Set<string>;
  domains: { id: string; name: string }[];
  rosterAuditLogs: RosterAuditLog[];
  contactInfo: TeamContactInfo[];
  onDataChange: () => void;
}

export default function ManageTeamsPanel({ teams, teamMembers, lockedTeamIds, domains, rosterAuditLogs, contactInfo, onDataChange }: ManageTeamsPanelProps) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(false);

  const [moveMemberId, setMoveMemberId] = useState('');
  const [moveDestTeamId, setMoveDestTeamId] = useState('');

  // Drag-and-drop board state: which member is currently being dragged, and
  // which team card the pointer is currently hovering over (for a visual
  // drop-target highlight). draggedMemberId also doubles as the dataTransfer
  // payload's source of truth -- dataTransfer.getData is unreliable during
  // dragover in some browsers, so the actual move logic reads this ref
  // instead of relying on the drop event's dataTransfer contents.
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

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

  const phoneByTeam = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contactInfo) map.set(c.team_id, c.phone_number);
    return map;
  }, [contactInfo]);

  const sourceTeam = teams.find((t) => t.id === mergeSourceId);
  const destTeam = teams.find((t) => t.id === mergeDestId);
  const domainMismatch = sourceTeam && destTeam && sourceTeam.domain !== destTeam.domain;
  const poolMismatch = sourceTeam && destTeam && sourceTeam.pool !== destTeam.pool;

  // Shared by both the drag-and-drop board and the select-based fallback
  // below it, so a move made either way gets identical validation,
  // messaging, and audit-log behavior (moveTeamMemberAction itself re-checks
  // the 4-member cap and roster lock server-side regardless of which UI
  // path triggered it).
  const performMove = async (memberId: string, destinationTeamId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (member && member.team_id === destinationTeamId) return;

    setLoading(true);
    setMessage(null);
    const res = await moveTeamMemberAction({ memberId, destinationTeamId });
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

  const handleMove = () => {
    if (!moveMemberId || !moveDestTeamId) {
      setMessage({ type: 'error', text: 'Select both a member and a destination team.' });
      return;
    }
    performMove(moveMemberId, moveDestTeamId);
  };

  const handleDragStart = (memberId: string, sourceTeamId: string) => (e: React.DragEvent) => {
    if (lockedTeamIds.has(sourceTeamId)) {
      e.preventDefault();
      return;
    }
    draggingRef.current = memberId;
    setDraggedMemberId(memberId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', memberId);
  };

  const handleDragEnd = () => {
    draggingRef.current = null;
    setDraggedMemberId(null);
    setDragOverTeamId(null);
  };

  const handleDragOverTeam = (teamId: string) => (e: React.DragEvent) => {
    if (!draggingRef.current) return;
    if (lockedTeamIds.has(teamId)) return;
    const memberCount = (membersByTeam.get(teamId) || []).length;
    const draggedMember = teamMembers.find((m) => m.id === draggingRef.current);
    // Already-full destination is still a valid dragover target visually
    // (so the user gets the "team full" error from the server on drop
    // rather than a confusing no-op), UNLESS it's the member's own current
    // team, which is always a no-op drop.
    if (draggedMember?.team_id === teamId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = memberCount >= 4 ? 'none' : 'move';
    setDragOverTeamId(teamId);
  };

  const handleDropOnTeam = (teamId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTeamId(null);
    const memberId = draggingRef.current || e.dataTransfer.getData('text/plain');
    draggingRef.current = null;
    setDraggedMemberId(null);
    if (!memberId) return;
    performMove(memberId, teamId);
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
                style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
              >
                <option value="" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Select domain...</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.name} style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>{d.name}</option>
                ))}
              </select>
              <select
                value={newTeamPool}
                onChange={(e) => setNewTeamPool(e.target.value as 'A' | 'B')}
                className="bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
                style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
              >
                <option value="A" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Pool A</option>
                <option value="B" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Pool B</option>
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
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {teams.map((t) => {
                const members = membersByTeam.get(t.id) || [];
                const locked = lockedTeamIds.has(t.id);
                const phone = phoneByTeam.get(t.id);
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
                            <li key={m.id}>
                              {m.name} {m.is_leader && <span className="text-brand-500">(Leader)</span>}
                              <div className="text-[10px] text-text-secondary/70 font-mono">{m.email}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-mono">
                      {phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-brand-500 shrink-0" />
                          {phone}
                        </span>
                      ) : (
                        <span className="italic text-text-secondary/50">—</span>
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
                  <td colSpan={7} className="py-8 text-center text-text-secondary/70 italic">No teams registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAG-AND-DROP BOARD: drag any member's pill onto another team's
          card to move them there. Multiple members (from the same or
          different teams) can be moved one after another, in any order --
          each drag is an independent performMove call, there's no "commit"
          step. Locked teams render dimmed and are not valid drop targets
          (their members also can't be picked up). The select-based flow
          below remains as a guaranteed-reliable fallback if a drag
          interaction ever misbehaves on a given browser/device. */}
      <div className="card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
            <GripVertical className="w-5 h-5 text-brand-500" />
            <span>Drag & Drop Board</span>
          </h2>
          <p className="text-xs text-text-secondary">Drag a member&apos;s name onto another team&apos;s card to move them there. Works across any teams, any number of times.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => {
            const members = membersByTeam.get(t.id) || [];
            const locked = lockedTeamIds.has(t.id);
            const isDragOver = dragOverTeamId === t.id;
            const isFull = members.length >= 4;

            return (
              <div
                key={t.id}
                onDragOver={handleDragOverTeam(t.id)}
                onDragLeave={() => setDragOverTeamId((cur) => (cur === t.id ? null : cur))}
                onDrop={handleDropOnTeam(t.id)}
                className={`rounded-xl border p-3.5 space-y-2 transition-colors min-h-[120px] ${
                  locked
                    ? 'opacity-50 border-panel-border bg-white/[0.02]'
                    : isDragOver
                      ? isFull
                        ? 'border-danger-500 bg-danger-500/10'
                        : 'border-brand-500 bg-brand-500/10'
                      : 'border-panel-border bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary truncate">{t.team_name}</span>
                  <span className="text-[10px] font-mono text-text-secondary shrink-0 ml-2">{members.length}/4</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PoolBadge pool={t.pool} />
                  <span className="text-[10px] text-accent-warm font-mono truncate">{t.domain}</span>
                </div>

                {locked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-live/15 text-accent-live border border-accent-live/40">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}

                <div className="space-y-1 pt-1">
                  {members.length === 0 && (
                    <span className="text-[10px] italic text-text-secondary/60">No members — drop someone here</span>
                  )}
                  {members.map((m) => (
                    <div
                      key={m.id}
                      draggable={!locked}
                      onDragStart={handleDragStart(m.id, t.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-opacity ${
                        locked
                          ? 'cursor-not-allowed bg-white/[0.02] border-panel-border text-text-secondary/50'
                          : `cursor-grab active:cursor-grabbing bg-white/5 border-panel-border text-text-primary hover:border-brand-500/50 ${
                              draggedMemberId === m.id ? 'opacity-30' : ''
                            }`
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-text-secondary/50 shrink-0" />
                      <span className="truncate">{m.name}</span>
                      {m.is_leader && <span className="text-brand-500 font-bold shrink-0">★</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {teams.length === 0 && (
            <p className="text-xs text-text-secondary/70 italic col-span-full text-center py-6">No teams registered yet.</p>
          )}
        </div>
      </div>

      {/* MOVE MEMBER (select-based fallback) */}
      <div className="card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-text-primary flex items-center space-x-2">
          <ArrowRightLeft className="w-5 h-5 text-brand-500" />
          <span>Move a Member Between Teams (fallback)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] text-text-secondary mb-1">Member</label>
            <select
              value={moveMemberId}
              onChange={(e) => setMoveMemberId(e.target.value)}
              className="w-full bg-white/5 border border-panel-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
              style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
            >
              <option value="" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Select member...</option>
              {teamMembers.map((m) => {
                const t = teams.find((team) => team.id === m.team_id);
                const disabled = t ? lockedTeamIds.has(t.id) : false;
                return (
                  <option key={m.id} value={m.id} disabled={disabled} style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>
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
              style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
            >
              <option value="" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Select team...</option>
              {teams.map((t) => {
                const memberCount = (membersByTeam.get(t.id) || []).length;
                const disabled = lockedTeamIds.has(t.id) || memberCount >= 4;
                return (
                  <option key={t.id} value={t.id} disabled={disabled} style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>
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
              style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
            >
              <option value="" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={lockedTeamIds.has(t.id)} style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>
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
              style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}
            >
              <option value="" style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={lockedTeamIds.has(t.id)} style={{ backgroundColor: '#0D111C', color: '#F7F8FC' }}>
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
