-- ============================================================
-- Pre-Event Reset Script — Pitch Under Pressure
-- ============================================================
-- Run this MANUALLY in the Supabase SQL Editor between test runs, and
-- again right before the real event starts.
--
-- WHAT THIS CLEARS (test/mock state):
--   - pitch_scores        (all judge-entered scores, so pitches go back
--                           to "not yet scored")
--   - audience_scores     (all team pool-voting ratings)
--   - questions           (all Q&A submissions and their outcomes)
--   - score_audit_log     (all manual override / unlock history)
--   - pitches.queue_status, queue_position_override, started_at,
--     ended_at, status   (queue goes back to registration order, nothing
--                          called/pitching/scored)
--   - event_state         (timer and current_pitch_id reset to idle/null)
--
-- WHAT THIS DOES NOT TOUCH (real data, always preserved):
--   - teams               (all registrations)
--   - team_members
--   - profiles            (auth accounts / roles)
--   - domains, rounds
--
-- After running this, every registered team's prelim pitch returns to
-- 'queued' status in registration order (created_at), exactly as if the
-- event were starting fresh — but nobody has to re-register.
-- ============================================================

BEGIN;

-- 1. Clear all judge-entered scores
TRUNCATE public.pitch_scores;

-- 2. Clear all audience (team pool voting) ratings
TRUNCATE public.audience_scores;

-- 3. Clear all Q&A submissions
TRUNCATE public.questions;

-- 4. Clear manual override / unlock audit history
TRUNCATE public.score_audit_log;

-- 5. Reset every pitch's queue/status fields back to a fresh "queued" state,
--    reordered by team registration time (created_at), NOT touching the
--    teams themselves.
WITH ordered AS (
  SELECT p.id AS pitch_id, ROW_NUMBER() OVER (ORDER BY t.created_at ASC) AS new_order
  FROM public.pitches p
  JOIN public.teams t ON t.id = p.team_id
  JOIN public.rounds r ON r.id = p.round_id
  WHERE r.name = 'prelim'
)
UPDATE public.pitches p
SET
  status = 'upcoming',
  queue_status = 'queued',
  queue_position_override = NULL,
  pitch_order = ordered.new_order,
  started_at = NULL,
  ended_at = NULL
FROM ordered
WHERE p.id = ordered.pitch_id;

-- Also reset any Final-4 pitches back to 'upcoming'/'queued' so a repeat
-- test run of qualifyFinalFourAction can create them fresh again.
UPDATE public.pitches p
SET
  status = 'upcoming',
  queue_status = 'queued',
  queue_position_override = NULL,
  started_at = NULL,
  ended_at = NULL
FROM public.rounds r
WHERE p.round_id = r.id AND r.name = 'final';

-- 6. Reset event_state to idle with no active pitch. Never leave this
--    running/paused — the app must always boot into idle.
UPDATE public.event_state
SET
  current_pitch_id = NULL,
  timer_status = 'idle',
  timer_duration_seconds = 180,
  timer_started_at = NULL,
  timer_paused_remaining = NULL,
  updated_at = NOW()
WHERE id = 1;

COMMIT;
