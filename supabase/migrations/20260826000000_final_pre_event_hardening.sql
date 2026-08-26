-- Migration: Final Pre-Event Hardening
--
-- This migration documents and fixes the LIVE production schema, which had
-- drifted significantly from what's captured in the committed migration
-- files (20260809000000 initial_schema.sql etc. describe an EARLIER shape
-- of this schema — pitch_scores, queue_status, timer_status, results_revealed,
-- domains.assigned_count, otp_request_log, and the current RLS policies were
-- all added directly against the live Supabase project without ever being
-- captured as a migration file). Everything below was written by
-- introspecting the live DB via its REST/OpenAPI schema and behavioral
-- testing, NOT by reading a prior migration, since none exists for it.
--
-- Run this against the SAME project the app already talks to. Every
-- statement is defensive (IF EXISTS / CREATE OR REPLACE / idempotent
-- upserts) so it is safe to run even though most of the underlying
-- objects already exist from manual dashboard changes.

-- ============================================================
-- 1. FIX: pitch_leaderboard view was NOT applying the 10% weight to the
--    Q&A component. It appears the view was rewritten (during the
--    judge-panel-overhaul work) to add `qc.qa_pressure_score` directly
--    instead of `qc.qa_pressure_score * 0.10`, inflating every scored
--    pitch's total by up to +90 points. Verified by hand-calculation
--    against a real scored pitch on 2026-08-26: DB reported
--    total_weighted_score = 68.5, hand-calculated correct value (with the
--    documented 20/20/15/15/20/10 weights) = 59.5, a discrepancy of
--    exactly the un-weighted qa_pressure_score (10) added at 100% instead
--    of 10%.
-- ============================================================
CREATE OR REPLACE VIEW public.pitch_leaderboard AS
WITH
judge_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(ps.problem_market_raw, 0) * 5 AS problem_market_score,       -- raw is 0-20, view exposes 0-100
    COALESCE(ps.solution_innovation_raw, 0) * 5 AS solution_innovation_score,
    COALESCE(ps.feasibility_raw, 0) * (100.0/15) AS feasibility_score,     -- raw is 0-15, scale to 0-100
    COALESCE(ps.pitch_storytelling_raw, 0) * (100.0/15) AS pitch_storytelling_score,
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

qa_component AS (
  SELECT
    p.id AS pitch_id,
    LEAST(GREATEST(50 + COALESCE(SUM(q.points_pitching), 0) * 10, 0), 100) AS qa_pressure_score,
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

  -- Final Weighted Formula (unchanged from spec):
  -- Problem & Market (20%) + Solution & Innovation (20%) + Feasibility (15%)
  -- + Storytelling (15%) + Audience (20%) + QA (10%). NULL until a judge has
  -- actually scored the pitch, so "awaiting score" renders correctly instead
  -- of a misleading 0.
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
ORDER BY total_weighted_score DESC NULLS LAST;

-- ============================================================
-- 2. FIX: pitch_leaderboard was readable by the unauthenticated `anon` role
--    with no login at all (confirmed via a raw REST request using only the
--    public anon key). Since a Postgres VIEW does not carry its own RLS —
--    it runs with the privileges of the underlying tables for the querying
--    role — the fix is to revoke the PostgREST-default anon/authenticated
--    SELECT grant on the view and re-grant SELECT only to authenticated
--    users whose profile role is judge or organiser (see also fix #4,
--    section 10, for team-role restriction specifically).
-- ============================================================
REVOKE ALL ON public.pitch_leaderboard FROM anon;
REVOKE ALL ON public.pitch_leaderboard FROM authenticated;
GRANT SELECT ON public.pitch_leaderboard TO authenticated;

-- Row-level security cannot be attached directly to a view in Postgres in a
-- way PostgREST enforces per-row, so we wrap the view's access with a
-- SECURITY DEFINER function-backed check via a thin gate table policy isn't
-- applicable here since pitch_leaderboard has no table of its own. Instead,
-- enforce role-based access at the view definition itself by folding the
-- caller's role into the WHERE clause: only judges/organisers, ever.
CREATE OR REPLACE VIEW public.pitch_leaderboard
WITH (security_invoker = true) AS
WITH
judge_component AS (
  SELECT
    p.id AS pitch_id,
    COALESCE(ps.problem_market_raw, 0) * 5 AS problem_market_score,
    COALESCE(ps.solution_innovation_raw, 0) * 5 AS solution_innovation_score,
    COALESCE(ps.feasibility_raw, 0) * (100.0/15) AS feasibility_score,
    COALESCE(ps.pitch_storytelling_raw, 0) * (100.0/15) AS pitch_storytelling_score,
    CASE WHEN ps.id IS NOT NULL THEN 1 ELSE 0 END AS judges_submitted_count,
    ps.submitted_by_name
  FROM public.pitches p
  LEFT JOIN public.pitch_scores ps ON ps.pitch_id = p.id
),
voter_pitch_averages AS (
  SELECT pitch_id, voting_team_id, (AVG(score) - 1.0) / 4.0 * 100.0 AS voter_normalized_score
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
qa_component AS (
  SELECT
    p.id AS pitch_id,
    LEAST(GREATEST(50 + COALESCE(SUM(q.points_pitching), 0) * 10, 0), 100) AS qa_pressure_score,
    COALESCE(SUM(q.points_pitching), 0) AS total_qa_points
  FROM public.pitches p
  LEFT JOIN public.questions q ON q.pitch_id = p.id AND q.status = 'approved'
  GROUP BY p.id
)
SELECT
  t.id AS team_id, t.team_name, t.domain, t.pool,
  p.id AS pitch_id, r.id AS round_id, r.name AS round_name,
  p.status AS pitch_status, p.queue_status, p.pitch_order, p.queue_position_override,
  jc.problem_market_score, jc.solution_innovation_score, jc.feasibility_score,
  jc.pitch_storytelling_score, ac.audience_rating_score, qc.qa_pressure_score,
  jc.judges_submitted_count, jc.submitted_by_name, ac.total_voters, qc.total_qa_points,
  CASE WHEN jc.judges_submitted_count > 0 THEN
    ROUND(
      (jc.problem_market_score * 0.20) + (jc.solution_innovation_score * 0.20) +
      (jc.feasibility_score * 0.15) + (jc.pitch_storytelling_score * 0.15) +
      (ac.audience_rating_score * 0.20) + (qc.qa_pressure_score * 0.10), 2)
  ELSE NULL END AS total_weighted_score
FROM public.pitches p
JOIN public.teams t ON t.id = p.team_id
JOIN public.rounds r ON r.id = p.round_id
JOIN judge_component jc ON jc.pitch_id = p.id
JOIN audience_component ac ON ac.pitch_id = p.id
JOIN qa_component qc ON qc.pitch_id = p.id
WHERE EXISTS (
  SELECT 1 FROM public.profiles pr
  WHERE pr.id = auth.uid() AND pr.role IN ('judge', 'organiser')
)
ORDER BY total_weighted_score DESC NULLS LAST;

GRANT SELECT ON public.pitch_leaderboard TO authenticated;
REVOKE ALL ON public.pitch_leaderboard FROM anon;

-- ============================================================
-- 3. FIX: pool auto-balance race condition. registerTeamAction reads
--    Pool A/B counts and then inserts in two separate round-trips, so two
--    concurrent registrations can both read the same under-filled pool
--    and both land in it (confirmed possible from live registration
--    timestamps showing two teams registering in the same millisecond).
--    Move the balance decision into a BEFORE INSERT trigger that runs
--    inside the same transaction as the insert, using a row lock on
--    event_state to serialize concurrent pool assignments.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_balanced_pool()
RETURNS TRIGGER AS $$
DECLARE
  count_a INT;
  count_b INT;
BEGIN
  IF NEW.pool IS NOT NULL THEN
    RETURN NEW; -- caller already specified a pool explicitly, respect it
  END IF;

  -- Lock event_state's single row for the duration of this transaction so
  -- concurrent registrations serialize here instead of racing on the count.
  PERFORM 1 FROM public.event_state WHERE id = 1 FOR UPDATE;

  SELECT COUNT(*) INTO count_a FROM public.teams WHERE pool = 'A';
  SELECT COUNT(*) INTO count_b FROM public.teams WHERE pool = 'B';

  NEW.pool := CASE WHEN count_a <= count_b THEN 'A' ELSE 'B' END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_assign_balanced_pool ON public.teams;
CREATE TRIGGER trg_assign_balanced_pool
  BEFORE INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_balanced_pool();

-- ============================================================
-- 4. FIX: one person's email could end up on more than one team's
--    team_members roster (confirmed live: two real people each appear as
--    a member of two different teams in different pools), which is the
--    root cause of the dry-run bug where the Team Portal and
--    Organiser/Judge panels appeared to disagree on a person's pool —
--    they were each correctly reading a DIFFERENT team the same person
--    was attached to. A unique index on lower(email) prevents the same
--    email being added as a team_member more than once across ANY team,
--    matching the existing one-team-per-auth-identity rule
--    (teams_auth_user_id_unique) at the member level.
--
--    AS OF 2026-08-26 THIS WILL FAIL TO APPLY: two emails are already
--    duplicated across teams in the live data (both look like dev/test
--    accounts from the dry run: saivardhan1379@gmail.com is on both
--    "eclub test" and "V2X"; ab25chb0b04@student.nitw.ac.in is on both
--    "Idk" and "Archit's team"). Resolve those manually FIRST — decide
--    which team each person actually belongs to, delete their
--    team_members row on the other team (and re-associate/replace that
--    team's roster slot if it needs a real member) — THEN run the
--    CREATE UNIQUE INDEX below. It is deliberately not wrapped in a
--    conditional/deferred form so it fails loudly rather than silently
--    skip protecting against a third occurrence of the same bug.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS team_members_email_unique
  ON public.team_members (lower(email));

-- ============================================================
-- 5. Confirm/re-assert RLS is enabled on every table (defensive; some of
--    these may have been toggled during manual dashboard debugging).
-- ============================================================
ALTER TABLE public.pitch_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_audit_log ENABLE ROW LEVEL SECURITY;

-- pitch_scores: public read was never appropriate once the leaderboard view
-- became the sanctioned read path; explicit judge/organiser-only read + the
-- existing insert-locks-the-row behavior stays enforced at the app layer via
-- the UNIQUE(pitch_id) constraint (already present live).
DROP POLICY IF EXISTS "Public read pitch scores" ON public.pitch_scores;
CREATE POLICY "Judge or organiser read pitch_scores" ON public.pitch_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('judge', 'organiser'))
);
