-- Migration: Fix premature leaderboard score before judging
--
-- Bug: pitch_leaderboard's qa_component gave every pitch a floor of
-- 50/100 on qa_pressure_score even with zero Q&A/judge activity
-- (LEAST(GREATEST(50 + ... * 10, 0), 100) always evaluates to at least
-- 50 when there are no approved questions). At 10% weight that alone
-- put 5.0 pts on the board for a team the instant it registered, before
-- any judge ever called it to stage. Teams and the public leaderboard
-- should show NO score for a pitch until a judge has actually submitted
-- one.
--
-- Fix:
--   1. qa_pressure_score now has a genuine 0 floor (only rises above 0
--      once there are approved Q&A points), instead of a fake 50 floor.
--   2. total_weighted_score is NULL until judges_submitted_count > 0 —
--      "not yet judged" is now representable instead of being a real
--      (wrong) number the UI has to know to ignore.

DROP VIEW IF EXISTS public.pitch_leaderboard;

CREATE VIEW public.pitch_leaderboard AS
WITH
judge_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(ps.problem_market_score * 5.0, 0) AS problem_market_score,
    COALESCE(ps.solution_innovation_score * 5.0, 0) AS solution_innovation_score,
    COALESCE(ps.feasibility_score * (100.0 / 15.0), 0) AS feasibility_score,
    COALESCE(ps.pitch_storytelling_score * (100.0 / 15.0), 0) AS pitch_storytelling_score,
    CASE WHEN ps.id IS NOT NULL THEN 1 ELSE 0 END AS judges_submitted_count,
    ps.submitted_by_name
  FROM public.pitches p
  LEFT JOIN public.pitch_scores ps ON ps.pitch_id = p.id
),

voter_pitch_averages AS (
  SELECT
    pitch_id,
    voting_team_id,
    (AVG(score) - 1.0) / 4.0 * 100.0 AS voter_normalized_score
  FROM public.audience_scores
  GROUP BY pitch_id, voting_team_id
),

audience_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(AVG(vpa.voter_normalized_score), 0) AS audience_rating_score,
    COUNT(DISTINCT vpa.voting_team_id) AS total_voters
  FROM public.pitches p
  LEFT JOIN voter_pitch_averages vpa ON vpa.pitch_id = p.id
  GROUP BY p.id
),

-- Q&A / Pressure Test points. Genuine 0 floor: a pitch with no approved
-- questions yet contributes 0, not a fabricated 50 baseline.
qa_component AS (
  SELECT
    p.id AS pitch_id,
    LEAST(GREATEST(COALESCE(SUM(q.points_to_team), 0) * 10, 0), 100) AS qa_pressure_score,
    COALESCE(SUM(q.points_to_team), 0) AS total_qa_points
  FROM public.pitches p
  LEFT JOIN public.questions q ON q.pitch_id = p.id AND q.status = 'approved'
  GROUP BY p.id
)

SELECT
  t.id AS team_id,
  t.team_name,
  t.domain,
  t.pool,
  p.id AS pitch_id,
  r.id AS round_id,
  r.name AS round_name,
  p.status AS pitch_status,
  p.queue_status,
  p.pitch_order,
  p.queue_position_override,

  jc.problem_market_score,
  jc.solution_innovation_score,
  jc.feasibility_score,
  jc.pitch_storytelling_score,
  ac.audience_rating_score,
  qc.qa_pressure_score,

  jc.judges_submitted_count,
  jc.submitted_by_name,
  ac.total_voters,
  qc.total_qa_points,

  -- NULL until a judge has actually scored the pitch. The weighted total
  -- is otherwise meaningless (it would just be the audience/QA floor
  -- showing up as a fake judge score before any judging happened).
  CASE WHEN jc.judges_submitted_count = 0 THEN NULL ELSE
    ROUND(
      (jc.problem_market_score * 0.20) +
      (jc.solution_innovation_score * 0.20) +
      (jc.feasibility_score * 0.15) +
      (jc.pitch_storytelling_score * 0.15) +
      (ac.audience_rating_score * 0.20) +
      (qc.qa_pressure_score * 0.10),
      2
    )
  END AS total_weighted_score
FROM public.pitches p
JOIN public.teams t ON t.id = p.team_id
JOIN public.rounds r ON r.id = p.round_id
JOIN judge_component jc ON jc.pitch_id = p.id
JOIN audience_component ac ON ac.pitch_id = p.id
JOIN qa_component qc ON qc.pitch_id = p.id
ORDER BY total_weighted_score DESC NULLS LAST;
