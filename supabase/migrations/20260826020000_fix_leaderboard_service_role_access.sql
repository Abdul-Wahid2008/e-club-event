-- Migration: fix pitch_leaderboard blocking service_role (run AFTER 20260826000000)
--
-- BUG FOUND DURING POST-DEPLOY VERIFICATION (2026-08-26): the previous
-- migration's pitch_leaderboard rewrite correctly blocked anon/team-role
-- access, but its WHERE clause checked ONLY auth.uid()-based judge/organiser
-- profile membership -- auth.uid() is null for the service_role client
-- (createAdminClient() in organiserActions.ts, used by
-- qualifyFinalFourAction and exportLeaderboardCsvAction), so the view
-- silently returned ZERO rows to service_role too. Confirmed live: a
-- service-role query for a known scored pitch returned [] instead of the
-- real row. This would have broken Final-4 qualification and the results
-- CSV export at the event without ever surfacing an error -- both just
-- would have seen "no leaderboard data."
--
-- Fix: add an explicit `auth.role() = 'service_role'` escape hatch
-- alongside the existing judge/organiser profile check. service_role is
-- never exposed to a browser -- it only runs inside trusted server
-- actions -- so this doesn't reopen the anon/team-role hole the prior
-- migration closed.
--
-- Safe to re-run: DROP VIEW + CREATE VIEW is idempotent regardless of
-- current state.

DROP VIEW IF EXISTS public.pitch_leaderboard;

CREATE VIEW public.pitch_leaderboard
WITH (security_invoker = true) AS
WITH
judge_component AS (
  SELECT
    p.id AS pitch_id,
    (COALESCE(ps.problem_market_raw, 0) * 5)::numeric AS problem_market_score,
    (COALESCE(ps.solution_innovation_raw, 0) * 5)::numeric AS solution_innovation_score,
    (COALESCE(ps.feasibility_raw, 0) * (100.0/15))::numeric AS feasibility_score,
    (COALESCE(ps.pitch_storytelling_raw, 0) * (100.0/15))::numeric AS pitch_storytelling_score,
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
    COALESCE(AVG(vpa.voter_normalized_score), 0)::numeric AS audience_rating_score,
    COUNT(DISTINCT vpa.voting_team_id) AS total_voters
  FROM public.pitches p
  LEFT JOIN voter_pitch_averages vpa ON vpa.pitch_id = p.id
  GROUP BY p.id
),

qa_component AS (
  SELECT
    p.id AS pitch_id,
    LEAST(GREATEST(50 + COALESCE(SUM(q.points_pitching), 0) * 10, 0), 100)::numeric AS qa_pressure_score,
    COALESCE(SUM(q.points_pitching), 0) AS total_qa_points
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

  CASE WHEN jc.judges_submitted_count > 0 THEN
    ROUND(
      (jc.problem_market_score * 0.20) +
      (jc.solution_innovation_score * 0.20) +
      (jc.feasibility_score * 0.15) +
      (jc.pitch_storytelling_score * 0.15) +
      (ac.audience_rating_score * 0.20) +
      (qc.qa_pressure_score * 0.10),
      2
    )
  ELSE NULL END AS total_weighted_score
FROM public.pitches p
JOIN public.teams t ON t.id = p.team_id
JOIN public.rounds r ON r.id = p.round_id
JOIN judge_component jc ON jc.pitch_id = p.id
JOIN audience_component ac ON ac.pitch_id = p.id
JOIN qa_component qc ON qc.pitch_id = p.id
WHERE (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role IN ('judge', 'organiser')
  )
)
ORDER BY total_weighted_score DESC NULLS LAST;

GRANT SELECT ON public.pitch_leaderboard TO authenticated;
REVOKE ALL ON public.pitch_leaderboard FROM anon;
