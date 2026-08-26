'use server';

import { createAdminClient } from '@/src/lib/supabase/admin';
import { requireRole } from '@/src/lib/authHelpers';
import { sanitizeInput, isValidUUID } from '@/src/lib/validation';
import { revalidatePath } from 'next/cache';

function revalidateAllPortals() {
  revalidatePath('/portal/judge');
  revalidatePath('/portal/organiser');
  revalidatePath('/portal/team');
  revalidatePath('/display');
}

/**
 * Deletes one or more teams (and everything that references them via
 * ON DELETE CASCADE: team_members, pitches, pitch_scores, audience_scores,
 * questions). Organiser-only, enforced server-side via requireRole -- the
 * Data Management UI is hidden from other roles, but that's cosmetic; this
 * check is what actually stops a non-organiser request.
 */
export async function deleteTeamsAction(teamIds: string[]) {
  let userCtx;
  try {
    userCtx = await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  if (!Array.isArray(teamIds) || teamIds.length === 0) {
    return { error: 'No teams selected.' };
  }

  const sanitizedIds = teamIds.map((id) => sanitizeInput(id)).filter(isValidUUID);
  if (sanitizedIds.length === 0) {
    return { error: 'No valid team ids provided.' };
  }

  const adminSupabase = createAdminClient();

  const { data: deletedTeams } = await adminSupabase
    .from('teams')
    .select('id, team_name')
    .in('id', sanitizedIds);

  const { error } = await adminSupabase.from('teams').delete().in('id', sanitizedIds);
  if (error) return { error: error.message };

  await adminSupabase.from('score_audit_log').insert({
    changed_by: userCtx.user.id,
    table_changed: 'teams',
    row_id: sanitizedIds[0],
    old_value: deletedTeams,
    new_value: null,
    note: `Deleted ${sanitizedIds.length} team(s) via Data Management: ${(deletedTeams || []).map((t) => t.team_name).join(', ')}.`,
  });

  revalidateAllPortals();
  return { success: true, deletedCount: sanitizedIds.length };
}

/**
 * Full Event Reset: wipes ALL teams, scores, questions, and pitch/timer
 * state back to a fresh/empty event. This is the "right before doors open"
 * button -- everything, including real registrations, is gone after this
 * runs. Organiser-only. The UI gates this behind typing a confirmation
 * phrase; this action additionally requires that same phrase be passed
 * through so a stray/replayed request can't trigger it without the
 * confirmation ever having been shown.
 */
export async function fullEventResetAction(confirmationPhrase: string) {
  let userCtx;
  try {
    userCtx = await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  if (sanitizeInput(confirmationPhrase || '').trim().toUpperCase() !== 'RESET') {
    return { error: 'Confirmation phrase did not match. Type RESET exactly to confirm.' };
  }

  const adminSupabase = createAdminClient();

  // Order matters only for the ones without ON DELETE CASCADE back to
  // teams; deleting all teams cascades most of this already, but we clear
  // explicitly so a partial/legacy row (e.g. an orphaned question) doesn't
  // survive a reset.
  const steps: Array<{ table: string; filter: (q: any) => any }> = [
    { table: 'score_audit_log', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'questions', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'audience_scores', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'pitch_scores', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'pitches', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'team_members', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'teams', filter: (q) => q.neq('id', '00000000-0000-0000-0000-000000000000') },
  ];

  for (const step of steps) {
    const { error } = await step.filter(adminSupabase.from(step.table).delete());
    if (error) return { error: `Failed clearing ${step.table}: ${error.message}` };
  }

  // domains.assigned_count backs assign_least_used_domain()'s
  // least-used-first pick (see 20260816000000_post_dryrun_overhaul.sql).
  // It is NOT reset by deleting teams -- without this, a reset event would
  // start real registrations with the previous test run's skewed counts
  // still in place, badly unbalancing domain assignment from minute one
  // (confirmed live: a prior test run left some domains at 0 and others at
  // 3, which would have persisted through to raw event day).
  const { error: domainResetErr } = await adminSupabase
    .from('domains')
    .update({ assigned_count: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (domainResetErr) return { error: `Failed resetting domain counts: ${domainResetErr.message}` };

  const { data: prelimRound } = await adminSupabase.from('rounds').select('id').eq('name', 'prelim').single();

  const { error: stateErr } = await adminSupabase
    .from('event_state')
    .update({
      current_pitch_id: null,
      current_round_id: prelimRound?.id || null,
      timer_status: 'idle',
      timer_duration_seconds: 180,
      timer_started_at: null,
      timer_paused_remaining: null,
      results_revealed: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (stateErr) return { error: stateErr.message };

  await adminSupabase.from('score_audit_log').insert({
    changed_by: userCtx.user.id,
    table_changed: 'FULL_EVENT_RESET',
    row_id: '00000000-0000-0000-0000-000000000000',
    old_value: null,
    new_value: null,
    note: `Full event reset executed by ${userCtx.user.email} from Organiser Data Management panel.`,
  });

  revalidateAllPortals();
  return { success: true };
}
