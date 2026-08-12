'use server';

import { createAdminClient } from '@/src/lib/supabase/admin';
import { requireRole } from '@/src/lib/authHelpers';
import { sanitizeInput } from '@/src/lib/validation';
import { revalidatePath } from 'next/cache';

export async function submitJudgeScoresAction(payload: {
  pitchId: string;
  scores: {
    problem_market: number;
    solution_innovation: number;
    feasibility: number;
    pitch_storytelling: number;
  };
}) {
  let userCtx;
  try {
    userCtx = await requireRole(['judge', 'organiser']);
  } catch (err: any) {
    return { error: err.message || 'Not authenticated as a judge.' };
  }

  const { pitchId, scores } = payload;
  const sanitizedPitchId = sanitizeInput(pitchId);
  const adminSupabase = createAdminClient();

  // Find judge ID associated with authenticated user
  const { data: judge } = await adminSupabase
    .from('judges')
    .select('id')
    .eq('auth_user_id', userCtx.user.id)
    .single();

  if (!judge) {
    return { error: 'Judge profile not found for this account.' };
  }

  const scoreEntries = [
    { criterion: 'problem_market', score: Math.max(1, Math.min(Number(scores.problem_market) || 1, 10)) },
    { criterion: 'solution_innovation', score: Math.max(1, Math.min(Number(scores.solution_innovation) || 1, 10)) },
    { criterion: 'feasibility', score: Math.max(1, Math.min(Number(scores.feasibility) || 1, 10)) },
    { criterion: 'pitch_storytelling', score: Math.max(1, Math.min(Number(scores.pitch_storytelling) || 1, 10)) },
  ];

  for (const entry of scoreEntries) {
    const { error: scoreErr } = await adminSupabase
      .from('judge_scores')
      .upsert(
        {
          judge_id: judge.id,
          pitch_id: sanitizedPitchId,
          criterion: entry.criterion as any,
          score: entry.score,
          locked: true, // Submit locks the score!
        },
        { onConflict: 'judge_id,pitch_id,criterion' }
      );

    if (scoreErr) {
      return { error: 'Failed to submit score: ' + scoreErr.message };
    }
  }

  revalidatePath('/portal/judge');
  revalidatePath('/portal/organiser');
  return { success: true };
}
