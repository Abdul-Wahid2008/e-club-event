'use server';

import { createAdminClient } from '@/src/lib/supabase/admin';
import { requireRole } from '@/src/lib/authHelpers';
import { sanitizeInput } from '@/src/lib/validation';
import { revalidatePath } from 'next/cache';

const LOCKED_QUEUE_STATUSES = ['called', 'pitching', 'awaiting_score', 'scored'];

async function isTeamLocked(adminSupabase: ReturnType<typeof createAdminClient>, teamId: string): Promise<boolean> {
  const { data } = await adminSupabase
    .from('pitches')
    .select('id')
    .eq('team_id', teamId)
    .in('queue_status', LOCKED_QUEUE_STATUSES)
    .maybeSingle();
  return !!data;
}

/**
 * Moves a single team member from their current team to a destination
 * team. Respects the 4-member cap (checked here as a friendly pre-check;
 * the trg_enforce_team_member_cap DB trigger is the real backstop under
 * concurrency) and the one-team-per-email constraint (irrelevant here
 * since we delete-then-insert the same email, but the destination team
 * must not already have this email as a separate row). Roster lock is
 * checked against BOTH the source and destination team.
 */
export async function moveTeamMemberAction(payload: {
  memberId: string;
  destinationTeamId: string;
}) {
  let userCtx;
  try {
    userCtx = await requireRole(['organiser', 'judge']);
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const memberId = sanitizeInput(payload.memberId);
  const destinationTeamId = sanitizeInput(payload.destinationTeamId);
  const adminSupabase = createAdminClient();

  const { data: member, error: memberErr } = await adminSupabase
    .from('team_members')
    .select('*, teams(id, team_name)')
    .eq('id', memberId)
    .single();

  if (memberErr || !member) return { error: 'Member not found.' };

  const sourceTeamId = member.team_id;
  if (sourceTeamId === destinationTeamId) return { error: 'Member is already on that team.' };

  const [sourceLocked, destLocked] = await Promise.all([
    isTeamLocked(adminSupabase, sourceTeamId),
    isTeamLocked(adminSupabase, destinationTeamId),
  ]);

  if (sourceLocked) return { error: 'This member\'s current team has already been called to stage and is locked.' };
  if (destLocked) return { error: 'The destination team has already been called to stage and is locked.' };

  const { data: destTeam, error: destTeamErr } = await adminSupabase
    .from('teams')
    .select('id, team_name')
    .eq('id', destinationTeamId)
    .single();

  if (destTeamErr || !destTeam) return { error: 'Destination team not found.' };

  const { count: destCount } = await adminSupabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', destinationTeamId);

  if ((destCount ?? 0) >= 4) {
    return { error: `"${destTeam.team_name}" already has the maximum of 4 members.` };
  }

  const { error: updateErr } = await adminSupabase
    .from('team_members')
    .update({ team_id: destinationTeamId })
    .eq('id', memberId);

  if (updateErr) {
    if (updateErr.message?.includes('TEAM_FULL')) {
      return { error: `"${destTeam.team_name}" already has the maximum of 4 members.` };
    }
    return { error: updateErr.message || 'Failed to move member.' };
  }

  await adminSupabase.from('roster_audit_log').insert({
    changed_by: userCtx.user.id,
    action: 'move_member',
    affected_team_ids: [sourceTeamId, destinationTeamId],
    affected_member_id: memberId,
    old_value: { team_id: sourceTeamId, team_name: (member.teams as any)?.team_name },
    new_value: { team_id: destinationTeamId, team_name: destTeam.team_name },
    note: `Moved ${member.name} (${member.email}) from "${(member.teams as any)?.team_name}" to "${destTeam.team_name}".`,
  });

  revalidatePath('/portal/organiser');
  revalidatePath('/portal/judge');
  return { success: true };
}

/**
 * Merges sourceTeamId into destinationTeamId: moves every member across
 * (respecting the 4-member cap on the combined roster), then deletes the
 * now-empty source team. If the two teams have different domain/pool, the
 * caller MUST pass which one to keep -- never silently picked here.
 */
export async function mergeTeamsAction(payload: {
  sourceTeamId: string;
  destinationTeamId: string;
  keepDomain: string;
  keepPool: 'A' | 'B';
}) {
  let userCtx;
  try {
    userCtx = await requireRole(['organiser', 'judge']);
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const sourceTeamId = sanitizeInput(payload.sourceTeamId);
  const destinationTeamId = sanitizeInput(payload.destinationTeamId);
  const adminSupabase = createAdminClient();

  if (sourceTeamId === destinationTeamId) return { error: 'Cannot merge a team into itself.' };

  const [sourceLocked, destLocked] = await Promise.all([
    isTeamLocked(adminSupabase, sourceTeamId),
    isTeamLocked(adminSupabase, destinationTeamId),
  ]);

  if (sourceLocked || destLocked) {
    return { error: 'One of these teams has already been called to stage and is locked from merging.' };
  }

  const [{ data: sourceTeam }, { data: destTeam }] = await Promise.all([
    adminSupabase.from('teams').select('*').eq('id', sourceTeamId).single(),
    adminSupabase.from('teams').select('*').eq('id', destinationTeamId).single(),
  ]);

  if (!sourceTeam || !destTeam) return { error: 'One or both teams not found.' };

  const [{ data: sourceMembers }, { count: destCount }] = await Promise.all([
    adminSupabase.from('team_members').select('*').eq('team_id', sourceTeamId),
    adminSupabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', destinationTeamId),
  ]);

  const combinedCount = (sourceMembers?.length ?? 0) + (destCount ?? 0);
  if (combinedCount > 4) {
    return { error: `Merging would create a team of ${combinedCount} members, exceeding the 4-member cap. Move members manually first.` };
  }

  if (payload.keepPool !== 'A' && payload.keepPool !== 'B') {
    return { error: 'Invalid pool selection for merged team.' };
  }
  if (!payload.keepDomain) {
    return { error: 'A domain must be selected for the merged team.' };
  }

  // 1. Move every member from source to destination.
  if (sourceMembers && sourceMembers.length > 0) {
    const { error: moveErr } = await adminSupabase
      .from('team_members')
      .update({ team_id: destinationTeamId })
      .eq('team_id', sourceTeamId);
    if (moveErr) return { error: moveErr.message || 'Failed to move members during merge.' };
  }

  // 2. Apply the explicitly chosen domain/pool to the destination team.
  const { error: updateDestErr } = await adminSupabase
    .from('teams')
    .update({ domain: payload.keepDomain, pool: payload.keepPool })
    .eq('id', destinationTeamId);
  if (updateDestErr) return { error: updateDestErr.message || 'Failed to update merged team.' };

  // 3. Delete the now-empty source team (cascades to its pitch/scores via
  // existing FK ON DELETE CASCADE).
  const { error: deleteErr } = await adminSupabase.from('teams').delete().eq('id', sourceTeamId);
  if (deleteErr) return { error: deleteErr.message || 'Failed to delete source team after merge.' };

  await adminSupabase.from('roster_audit_log').insert({
    changed_by: userCtx.user.id,
    action: 'merge_teams',
    affected_team_ids: [sourceTeamId, destinationTeamId],
    old_value: {
      source: { team_name: sourceTeam.team_name, domain: sourceTeam.domain, pool: sourceTeam.pool },
      destination: { team_name: destTeam.team_name, domain: destTeam.domain, pool: destTeam.pool },
    },
    new_value: { team_name: destTeam.team_name, domain: payload.keepDomain, pool: payload.keepPool },
    note: `Merged "${sourceTeam.team_name}" into "${destTeam.team_name}". Kept domain="${payload.keepDomain}", pool="${payload.keepPool}".`,
  });

  revalidatePath('/portal/organiser');
  revalidatePath('/portal/judge');
  return { success: true };
}

export async function createEmptyTeamAction(payload: {
  teamName: string;
  domain: string;
  pool: 'A' | 'B';
}) {
  let userCtx;
  try {
    userCtx = await requireRole(['organiser', 'judge']);
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const teamName = sanitizeInput(payload.teamName || '').trim();
  if (!teamName) return { error: 'Team name is required.' };
  if (payload.pool !== 'A' && payload.pool !== 'B') return { error: 'Invalid pool.' };
  if (!payload.domain) return { error: 'Domain is required.' };

  const adminSupabase = createAdminClient();

  const { data: team, error: teamErr } = await adminSupabase
    .from('teams')
    .insert({
      auth_user_id: null,
      team_name: teamName,
      domain: payload.domain,
      pool: payload.pool,
      status: 'registered',
    })
    .select()
    .single();

  if (teamErr || !team) {
    if (teamErr?.code === '23505') {
      return { error: 'A team with this name is already registered.' };
    }
    return { error: teamErr?.message || 'Failed to create team.' };
  }

  await adminSupabase.from('roster_audit_log').insert({
    changed_by: userCtx.user.id,
    action: 'create_team',
    affected_team_ids: [team.id],
    new_value: { team_name: teamName, domain: payload.domain, pool: payload.pool },
    note: `Manually created empty team "${teamName}" (${payload.domain}, Pool ${payload.pool}).`,
  });

  revalidatePath('/portal/organiser');
  revalidatePath('/portal/judge');
  return { success: true, team };
}
