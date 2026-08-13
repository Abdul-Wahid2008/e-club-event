'use server';

import { createAdminClient } from '@/src/lib/supabase/admin';
import { requireRole } from '@/src/lib/authHelpers';
import { sanitizeInput } from '@/src/lib/validation';
import { revalidatePath } from 'next/cache';
import { PitchLeaderboardEntry } from '@/src/lib/types';

export async function exportRegistrationsCsvAction() {
  try {
    await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const adminSupabase = createAdminClient();

  const { data: teams, error: teamsErr } = await adminSupabase
    .from('teams')
    .select('id, team_name, domain, pool')
    .order('created_at', { ascending: false });

  if (teamsErr || !teams) {
    return { error: teamsErr?.message || 'Failed to fetch teams.' };
  }

  const { data: members, error: membersErr } = await adminSupabase
    .from('team_members')
    .select('team_id, name, email, is_leader');

  if (membersErr || !members) {
    return { error: membersErr?.message || 'Failed to fetch team members.' };
  }

  const headers = ['Team Name', 'Domain', 'Pool', 'Member Name', 'Member Email', 'Is Leader'];
  const rows: string[] = [];

  teams.forEach((t) => {
    const teamMembers = members.filter((m) => m.team_id === t.id);
    teamMembers.forEach((m) => {
      rows.push(
        [`"${t.team_name}"`, `"${t.domain}"`, `"${t.pool}"`, `"${m.name}"`, `"${m.email}"`, m.is_leader].join(',')
      );
    });
  });

  const csv = [headers.join(','), ...rows].join('\n');
  return { success: true, csv };
}

export async function setLivePitchAction(pitchId: string | null) {
  try {
    await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const sanitizedPitchId = pitchId ? sanitizeInput(pitchId) : null;
  const adminSupabase = createAdminClient();

  // If a pitch is currently live, set its status to done
  const { data: currentState } = await adminSupabase
    .from('event_state')
    .select('current_pitch_id')
    .eq('id', 1)
    .single();

  if (currentState?.current_pitch_id && currentState.current_pitch_id !== sanitizedPitchId) {
    await adminSupabase
      .from('pitches')
      .update({ status: 'done', ended_at: new Date().toISOString() })
      .eq('id', currentState.current_pitch_id);
  }

  if (sanitizedPitchId) {
    // Set target pitch status to live
    await adminSupabase
      .from('pitches')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', sanitizedPitchId);
  }

  // Update single row event_state
  const { error } = await adminSupabase
    .from('event_state')
    .update({
      current_pitch_id: sanitizedPitchId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) return { error: error.message };

  revalidatePath('/portal/organiser');
  revalidatePath('/portal/judge');
  revalidatePath('/portal/team');
  return { success: true };
}

export async function updateTimerStateAction(
  phase: 'idle' | 'prep' | 'pitch' | 'qa' | 'paused',
  durationSeconds?: number
) {
  try {
    await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const validPhases = ['idle', 'prep', 'pitch', 'qa', 'paused'];
  if (!validPhases.includes(phase)) {
    return { error: 'Invalid timer phase.' };
  }

  const adminSupabase = createAdminClient();

  const updatePayload: any = {
    timer_phase: phase,
    updated_at: new Date().toISOString(),
  };

  if (phase === 'paused') {
    const { data: curr } = await adminSupabase
      .from('event_state')
      .select('timer_started_at, timer_duration_seconds')
      .eq('id', 1)
      .single();

    if (curr?.timer_started_at) {
      const elapsed = Math.floor((Date.now() - new Date(curr.timer_started_at).getTime()) / 1000);
      const remaining = Math.max(0, (curr.timer_duration_seconds || 0) - elapsed);
      updatePayload.timer_paused_remaining = remaining;
    }
  } else if (phase === 'idle') {
    updatePayload.timer_started_at = null;
    updatePayload.timer_paused_remaining = null;
  } else {
    updatePayload.timer_duration_seconds = Math.max(10, Math.min(durationSeconds ?? 600, 3600));
    updatePayload.timer_started_at = new Date().toISOString();
    updatePayload.timer_paused_remaining = null;
  }

  const { error } = await adminSupabase
    .from('event_state')
    .update(updatePayload)
    .eq('id', 1);

  if (error) return { error: error.message };

  return { success: true };
}

export async function reviewQuestionAction(
  questionId: string,
  status: 'approved' | 'rejected',
  outcome?: 'team_answered_well' | 'team_answered_poorly' | null
) {
  try {
    await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const sanitizedQuestionId = sanitizeInput(questionId);
  if (!['approved', 'rejected'].includes(status)) {
    return { error: 'Invalid question status.' };
  }

  const adminSupabase = createAdminClient();

  let pointsToTeam = 0;
  let pointsToAsker = 0;

  if (status === 'approved') {
    if (outcome === 'team_answered_well') {
      pointsToTeam = 1;
      pointsToAsker = 0;
    } else if (outcome === 'team_answered_poorly') {
      pointsToTeam = -1;
      pointsToAsker = 1;
    }
  }

  const { error } = await adminSupabase
    .from('questions')
    .update({
      status,
      outcome: outcome || null,
      points_to_team: pointsToTeam,
      points_to_asker: pointsToAsker,
    })
    .eq('id', sanitizedQuestionId);

  if (error) return { error: error.message };

  revalidatePath('/portal/organiser');
  return { success: true };
}

export async function manualOverrideScoreAction(payload: {
  tableChanged: 'judge_scores' | 'audience_scores' | 'questions';
  rowId: string;
  oldValue: any;
  newValue: any;
  note: string;
}) {
  let userCtx;
  try {
    userCtx = await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const { tableChanged, rowId, oldValue, newValue, note } = payload;
  const sanitizedNote = sanitizeInput(note || '');
  const sanitizedRowId = sanitizeInput(rowId || '');

  if (!['judge_scores', 'audience_scores', 'questions'].includes(tableChanged)) {
    return { error: 'Invalid target table for score override.' };
  }

  if (!sanitizedNote || sanitizedNote.trim().length < 3) {
    return { error: 'A short descriptive note is required for manual overrides.' };
  }

  const adminSupabase = createAdminClient();

  // 1. Apply modification to target table
  if (tableChanged === 'judge_scores') {
    const numScore = Math.max(1, Math.min(Number(newValue.score) || 1, 10));
    await adminSupabase
      .from('judge_scores')
      .update({ score: numScore, locked: newValue.locked ?? true })
      .eq('id', sanitizedRowId);
  } else if (tableChanged === 'audience_scores') {
    const numScore = Math.max(1, Math.min(Number(newValue.score) || 1, 5));
    await adminSupabase
      .from('audience_scores')
      .update({ score: numScore })
      .eq('id', sanitizedRowId);
  } else if (tableChanged === 'questions') {
    await adminSupabase
      .from('questions')
      .update({
        points_to_team: Number(newValue.points_to_team) || 0,
        points_to_asker: Number(newValue.points_to_asker) || 0,
      })
      .eq('id', sanitizedRowId);
  }

  // 2. Insert record into audit log
  const { error: auditErr } = await adminSupabase.from('score_audit_log').insert({
    changed_by: userCtx.user.id,
    table_changed: tableChanged,
    row_id: sanitizedRowId,
    old_value: oldValue,
    new_value: newValue,
    note: sanitizedNote,
  });

  if (auditErr) return { error: auditErr.message };

  revalidatePath('/portal/organiser');
  return { success: true };
}

export async function unlockJudgeScoreAction(judgeScoreId: string, note: string) {
  let userCtx;
  try {
    userCtx = await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const sanitizedId = sanitizeInput(judgeScoreId);
  const sanitizedNote = sanitizeInput(note || '');

  if (!sanitizedNote || sanitizedNote.trim().length < 3) {
    return { error: 'Please provide a note explaining why this judge score is being unlocked.' };
  }

  const adminSupabase = createAdminClient();

  // Fetch existing score
  const { data: oldRow } = await adminSupabase
    .from('judge_scores')
    .select('*')
    .eq('id', sanitizedId)
    .single();

  if (!oldRow) return { error: 'Judge score not found.' };

  // Unlock row
  const { error } = await adminSupabase
    .from('judge_scores')
    .update({ locked: false })
    .eq('id', sanitizedId);

  if (error) return { error: error.message };

  // Write to audit log
  await adminSupabase.from('score_audit_log').insert({
    changed_by: userCtx.user.id,
    table_changed: 'judge_scores',
    row_id: sanitizedId,
    old_value: { locked: oldRow.locked },
    new_value: { locked: false },
    note: `[UNLOCK SCORE]: ${sanitizedNote}`,
  });

  revalidatePath('/portal/organiser');
  revalidatePath('/portal/judge');
  return { success: true };
}

export async function qualifyFinalFourAction() {
  try {
    await requireRole('organiser');
  } catch (err: any) {
    return { error: err.message || 'Unauthorized action.' };
  }

  const adminSupabase = createAdminClient();

  // Fetch authoritative rankings for Prelim round
  const { data: leaderboard, error } = await adminSupabase
    .from('pitch_leaderboard')
    .select('*')
    .eq('round_name', 'prelim');

  if (error || !leaderboard) {
    return { error: 'Failed to fetch prelim leaderboard for qualification.' };
  }

  // Separate Pool A and Pool B rankings
  const poolA = (leaderboard as PitchLeaderboardEntry[])
    .filter((item) => item.pool === 'A')
    .sort((a, b) => b.total_weighted_score - a.total_weighted_score);
  const poolB = (leaderboard as PitchLeaderboardEntry[])
    .filter((item) => item.pool === 'B')
    .sort((a, b) => b.total_weighted_score - a.total_weighted_score);

  const topPoolA = poolA.slice(0, 2);
  const topPoolB = poolB.slice(0, 2);

  if (topPoolA.length < 2 || topPoolB.length < 2) {
    return { error: 'Need at least 2 registered teams in Pool A and 2 in Pool B to create Final 4.' };
  }

  const finalFourTeams = [...topPoolA, ...topPoolB];

  // Fetch or ensure Final Round ID exists
  const { data: finalRound } = await adminSupabase
    .from('rounds')
    .select('id')
    .eq('name', 'final')
    .single();

  if (!finalRound) {
    return { error: 'Final round configuration not found in rounds table.' };
  }

  // Insert Final Round pitches
  for (let i = 0; i < finalFourTeams.length; i++) {
    const team = finalFourTeams[i];
    await adminSupabase
      .from('pitches')
      .upsert(
        {
          team_id: team.team_id,
          round_id: finalRound.id,
          status: 'upcoming',
          pitch_order: i + 1,
        },
        { onConflict: 'team_id,round_id' }
      );
  }

  // Update event_state current_round_id to Final round
  await adminSupabase
    .from('event_state')
    .update({ current_round_id: finalRound.id })
    .eq('id', 1);

  revalidatePath('/portal/organiser');
  return {
    success: true,
    qualifiers: finalFourTeams.map((t) => ({
      team_name: t.team_name,
      pool: t.pool,
      score: t.total_weighted_score,
    })),
  };
}
