-- Migration: restore the correct pitch_leaderboard formula + add access control
--
-- CONTEXT: an earlier hardening attempt (since fully reverted -- see git
-- history) incorrectly rewrote this view assuming judge raw scores were on
-- a 0-20/0-15 scale. The real, correct scale (confirmed via the live
-- pitch_scores_raw_range CHECK constraint from
-- 20260816000000_post_dryrun_overhaul.sql) is 0-10 uniformly across all
-- four judge categories, with a team-scoped min-max normalized Q&A
-- component. That earlier attempt was applied to the live DB and then
-- fully reverted; this migration restores the CORRECT view from
-- 20260816000000 byte-for-byte, and additionally closes a real gap found
-- during that investigation: the view was readable by the unauthenticated
-- `anon` role with no login at all (confirmed via a raw REST request using
-- only the public anon key, before any access control existed on this
-- view). Judge/organiser-only access, service_role always allowed through
-- (server actions like qualifyFinalFourAction and exportLeaderboardCsvAction
-- run with the admin client, which has no auth.uid()).

DROP VIEW IF EXISTS public.pitch_leaderboard;

CREATE VIEW public.pitch_leaderboard
WITH (security_invoker = true) AS
WITH
-- 1. Judge-entered component: single official row per pitch. Raw 0-10
--    inputs are weighted here (x2 for 20% categories, x1.5 for 15%
--    categories), producing the same 0-100-per-category basis as before.
judge_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(ps.problem_market_raw * 10.0, 0) AS problem_market_score,
    COALESCE(ps.solution_innovation_raw * 10.0, 0) AS solution_innovation_score,
    COALESCE(ps.feasibility_raw * 10.0, 0) AS feasibility_score,
    COALESCE(ps.pitch_storytelling_raw * 10.0, 0) AS pitch_storytelling_score,
    CASE WHEN ps.id IS NOT NULL THEN 1 ELSE 0 END AS judges_submitted_count,
    ps.submitted_by_name
  FROM public.pitches p
  LEFT JOIN public.pitch_scores ps ON ps.pitch_id = p.id
),

-- 2. Voter average scores per pitch & voting team (1-5 scale normalized to 0-100)
voter_pitch_averages AS (
  SELECT
    pitch_id,
    voting_team_id,
    (AVG(score) - 1.0) / 4.0 * 100.0 AS voter_normalized_score
  FROM public.audience_scores
  GROUP BY pitch_id, voting_team_id
),

-- 3. Overall Audience score per pitch (average across voters, 0-100)
audience_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(AVG(vpa.voter_normalized_score), 0) AS audience_rating_score,
    COUNT(DISTINCT vpa.voting_team_id) AS total_voters
  FROM public.pitches p
  LEFT JOIN voter_pitch_averages vpa ON vpa.pitch_id = p.id
  GROUP BY p.id
),

-- 4. Q&A raw points per TEAM (not per pitch): sum of points earned while
--    being pitched-to (across all their questions received) plus points
--    earned while asking (across all pitches they asked questions at).
--    This is team-scoped because the same team's asking activity happens
--    at OTHER teams' pitches, not their own.
qa_points_pitching AS (
  SELECT p.team_id, COALESCE(SUM(q.points_pitching), 0) AS pts
  FROM public.questions q
  JOIN public.pitches p ON p.id = q.pitch_id
  GROUP BY p.team_id
),
qa_points_asking AS (
  SELECT q.asking_team_id AS team_id, COALESCE(SUM(q.points_asking), 0) AS pts
  FROM public.questions q
  GROUP BY q.asking_team_id
),
qa_raw_by_team AS (
  SELECT
    t.id AS team_id,
    COALESCE(qpp.pts, 0) + COALESCE(qpa.pts, 0) AS raw_qa_points
  FROM public.teams t
  LEFT JOIN qa_points_pitching qpp ON qpp.team_id = t.id
  LEFT JOIN qa_points_asking qpa ON qpa.team_id = t.id
),
qa_bounds AS (
  SELECT MIN(raw_qa_points) AS min_raw, MAX(raw_qa_points) AS max_raw
  FROM qa_raw_by_team
),
qa_component AS (
  SELECT
    q.team_id,
    q.raw_qa_points,
    CASE
      WHEN b.max_raw = b.min_raw THEN 0
      ELSE ((q.raw_qa_points - b.min_raw)::NUMERIC / (b.max_raw - b.min_raw)) * 10.0
    END AS qa_component_score
  FROM qa_raw_by_team q
  CROSS JOIN qa_bounds b
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
  qc.qa_component_score AS qa_pressure_score,

  jc.judges_submitted_count,
  jc.submitted_by_name,
  ac.total_voters,
  qc.raw_qa_points AS total_qa_points,

  -- Final Weighted Formula (0-100). NULL (not 0, not a fake baseline)
  -- until a judge/organiser has actually submitted pitch_scores for this
  -- pitch — the UI shows "Awaiting score" on NULL rather than a
  -- misleadingly low real number.
  CASE WHEN jc.judges_submitted_count = 0 THEN NULL ELSE
    ROUND(
      (jc.problem_market_score * 0.20) +
      (jc.solution_innovation_score * 0.20) +
      (jc.feasibility_score * 0.15) +
      (jc.pitch_storytelling_score * 0.15) +
      (ac.audience_rating_score * 0.20) +
      COALESCE(qc.qa_component_score, 0),
      2
    )
  END AS total_weighted_score
FROM public.pitches p
JOIN public.teams t ON t.id = p.team_id
JOIN public.rounds r ON r.id = p.round_id
JOIN judge_component jc ON jc.pitch_id = p.id
JOIN audience_component ac ON ac.pitch_id = p.id
LEFT JOIN qa_component qc ON qc.team_id = t.id
WHERE (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role IN ('judge', 'organiser')
  )
  -- BUG FOUND + FIXED (2026-08-27, post-deploy verification): the first
  -- version of this access-control fix only ever admitted service_role or
  -- judge/organiser, which silently broke the Top-3 reveal ceremony this
  -- same feature set ships -- revealTopThreeAction sets
  -- event_state.results_revealed = true specifically so the Team Portal
  -- (team-role client) and the public /display screen (anon client, no
  -- login, by design -- see that page's own doc comment) can show the
  -- final leaderboard/podium. Confirmed live: after flipping
  -- results_revealed, a team-role session got 200 with zero rows (looks
  -- like "no data", not an error) and the anon client got a hard 401 --
  -- both the Team Portal's reveal panel and the projector's podium
  -- ceremony would have shown nothing at the exact climactic moment of
  -- the event. Once results are revealed, everyone may read the
  -- leaderboard -- that is the entire point of "reveal".
  OR EXISTS (
    SELECT 1 FROM public.event_state es
    WHERE es.id = 1 AND es.results_revealed = true
  )
)
ORDER BY total_weighted_score DESC;

-- anon must be granted SELECT (not revoked) for the /display broadcast
-- screen's pre-login reveal to work at all -- the WHERE clause above is
-- what actually gates visibility (anon still gets zero rows before
-- results_revealed flips true, since none of the other three conditions
-- can ever be true for an anonymous caller).
GRANT SELECT ON public.pitch_leaderboard TO authenticated, anon;

-- event_state.results_revealed rides the existing supabase_realtime
-- publication membership (event_state was already added in the initial
-- migration) — no publication change needed here.
