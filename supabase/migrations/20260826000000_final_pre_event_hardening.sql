-- Migration: Final Pre-Event Hardening
--
-- This migration documents and fixes the LIVE production schema, which had
-- drifted significantly from what's captured in the committed migration
-- files (20260809000000 initial_schema.sql etc. describe an EARLIER shape
-- of this schema). Sections 0 and 0b below are RECONSTRUCTED from the live
-- schema's REST/OpenAPI spec and behavioral testing (no direct Postgres
-- access was available to read the real DDL) -- they are best-effort
-- reconciliation so future migrations have an accurate starting point, not
-- a byte-for-byte dump of the live database. Every CREATE/ALTER below is
-- defensive (IF EXISTS / IF NOT EXISTS) so it's safe to run even where the
-- underlying object already exists from prior manual dashboard changes.
--
-- IMPORTANT — RLS POLICY CAVEAT: sections 0/0b intentionally do NOT attempt
-- to restate the exact CREATE POLICY statements currently live on teams,
-- team_members, questions, audience_scores, or event_state. Those were
-- only verified BEHAVIORALLY in this session (raw API calls confirming
-- e.g. cross-pool voting is accepted and same-pool is rejected) -- their
-- exact SQL text was never read, since that requires a direct Postgres
-- connection (pg_policies), which wasn't available. Section 5 below only
-- touches pitch_scores and judge_scores (the two tables this session's
-- testing proved needed a policy change or clarification) plus a
-- defensive RLS-enabled re-assertion on every table. Treat every OTHER
-- existing policy as untouched/authoritative on the live DB — this
-- migration does not attempt to redefine them, to avoid overwriting a
-- correct-but-undocumented policy with a guessed one.
--
-- DIFF RESULT (checked live on 2026-08-26, after a prior partial run of
-- an earlier draft of this file had already applied): the pitch_scores
-- judge/organiser-only read policy that's CURRENTLY ACTIVE in production
-- matches this file's intended logic exactly -- verified with fresh
-- organiser/judge/team test accounts: organiser and judge both see the
-- one real scored-pitch row, team sees zero rows. It is NOT a stale or
-- wrong version; it's already correct. judge_scores could not be diffed
-- the same way because that table has zero rows on every role (it's
-- unused dead weight left over from the pre-overhaul per-criterion
-- scoring model — current app code never reads or writes it), so an
-- empty result doesn't distinguish "policy blocks this role" from
-- "table has no rows for anyone." This file adds an explicit judge/
-- organiser-only read policy for it anyway, matching the same pattern,
-- so it's no longer ambiguous either way.
--
-- IDEMPOTENCY: every statement below was re-checked to run safely on a
-- SECOND execution against a DB where the first run already fully
-- succeeded. DROP POLICY IF EXISTS precedes every CREATE POLICY. The
-- trigger function/trigger use CREATE OR REPLACE / DROP...IF EXISTS
-- respectively. Table/column creation uses IF NOT EXISTS throughout.
-- teams_auth_user_id_unique is NOT touched here — it already exists from
-- migration 20260814000000_abuse_protection.sql and this file never
-- tried to recreate it; if you hit an "already exists" error on that
-- constraint specifically, it came from re-running an OLDER draft of
-- this migration (from before this idempotency pass), not this version.

-- ============================================================
-- 0. RECONCILE SCHEMA: columns/tables that exist live but were never
--    captured in any committed migration. All additive/defensive.
-- ============================================================

-- pitches: queue/timer-model columns added during the judge-panel-overhaul
-- work, never captured in a migration.
ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS queue_status TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS queue_position_override INT;

-- event_state: timer model was renamed from timer_phase (idle/prep/pitch/
-- qa/paused) to timer_status (idle/running/paused/ended), and a
-- results_revealed flag was added for gating the Final-4 reveal moment.
ALTER TABLE public.event_state
  ADD COLUMN IF NOT EXISTS timer_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS results_revealed BOOLEAN NOT NULL DEFAULT false;

-- questions: points_to_team/points_to_asker (original migration) were
-- renamed to points_pitching/points_asking live.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS points_pitching INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_asking INT NOT NULL DEFAULT 0;

-- domains: a per-domain assignment counter was added live. Not currently
-- read or written by any app code (registerTeamAction still picks a
-- uniformly random domain) -- captured here for schema completeness only;
-- see the note in the final summary about whether this is meant to be
-- wired up or is dead weight to drop later.
ALTER TABLE public.domains
  ADD COLUMN IF NOT EXISTS assigned_count INT NOT NULL DEFAULT 0;

-- pitch_scores: the single-authoritative-score-per-pitch table added by
-- the judge-panel-overhaul work, replacing the original per-judge/
-- per-criterion judge_scores model (judge_scores table still exists live
-- but is unused by current app code -- left in place, not dropped, in
-- case historical rows matter).
CREATE TABLE IF NOT EXISTS public.pitch_scores (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked BOOLEAN NOT NULL DEFAULT true,
  problem_market_raw INT NOT NULL,
  solution_innovation_raw INT NOT NULL,
  feasibility_raw INT NOT NULL,
  pitch_storytelling_raw INT NOT NULL,
  CONSTRAINT pitch_scores_pitch_id_unique UNIQUE (pitch_id)
);

-- otp_request_log: rate-limits repeated OTP requests per email. Exists
-- live, not currently read/written by any app code in this repo (no
-- rate-limit check calls it) -- captured for schema completeness; flagged
-- in the summary as a possible half-finished feature worth wiring up or
-- removing.
CREATE TABLE IF NOT EXISTS public.otp_request_log (
  email TEXT PRIMARY KEY,
  last_requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pitch_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_request_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 0b. NOTE ON UNCAPTURED TRIGGERS: app code comments reference a
--    trg_create_prelim_pitch_for_team trigger (fires on team insert to
--    auto-create that team's prelim-round pitch row) which clearly exists
--    live (every registered team has exactly one prelim pitch), but its
--    exact function body was never read -- introspecting a trigger
--    definition requires pg_proc/pg_trigger access via a direct Postgres
--    connection, which wasn't available this session either. NOT
--    recreated here to avoid DROP/replacing a working trigger with a
--    guessed one. If you ever need to rebuild this project from scratch
--    (not just apply forward migrations to the existing live DB), you
--    will need to pull this trigger's definition via the SQL Editor's
--    schema view first.
-- ============================================================

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
--
--    NOTE: the first attempt at this migration used CREATE OR REPLACE VIEW,
--    which Postgres rejects when a column's data type changes ("cannot
--    change data type of view column ... from numeric to integer") --
--    the live view's score columns are numeric, and an early draft of this
--    fix produced integer expressions instead. Using DROP VIEW + CREATE
--    VIEW instead, with explicit ::numeric casts, avoids that entirely.
-- ============================================================
DROP VIEW IF EXISTS public.pitch_leaderboard;

CREATE VIEW public.pitch_leaderboard
WITH (security_invoker = true) AS
WITH
judge_component AS (
  SELECT
    p.id AS pitch_id,
    (COALESCE(ps.problem_market_raw, 0) * 5)::numeric AS problem_market_score,       -- raw is 0-20, view exposes 0-100
    (COALESCE(ps.solution_innovation_raw, 0) * 5)::numeric AS solution_innovation_score,
    (COALESCE(ps.feasibility_raw, 0) * (100.0/15))::numeric AS feasibility_score,     -- raw is 0-15, scale to 0-100
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
WHERE EXISTS (
  -- ============================================================
  -- 2. FIX: pitch_leaderboard was readable by the unauthenticated `anon`
  --    role with no login at all (confirmed via a raw REST request using
  --    only the public anon key). Folded directly into the view body here
  --    (rather than a separate GRANT/REVOKE step) since `security_invoker
  --    = true` above means the view now runs with the QUERYING role's own
  --    privileges, and this WHERE clause is what actually restricts it to
  --    judge/organiser profiles — a plain anon or team-role caller gets
  --    zero rows back, satisfying section 10 (Team Portal must not be able
  --    to fetch leaderboard/ranking data) at the same time.
  -- ============================================================
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
--
--    NOTE: teams.pool is NOT NULL with no column default on the live DB
--    (confirmed: an insert omitting pool entirely fails with "null value
--    in column pool violates not-null constraint" until this trigger
--    exists). The trigger below fires BEFORE the NOT NULL check and fills
--    in NEW.pool, so callers (registerTeamAction) should stop specifying
--    pool at insert time and let this trigger own it exclusively.
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

-- NOTE: the team_members email-uniqueness fix (section 4 of this pass) is
-- deliberately NOT in this file — it depends on manually resolving existing
-- duplicate rows first. See
-- 20260826010000_team_members_email_unique.sql, run separately, after that
-- cleanup is done.

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
ALTER TABLE public.otp_request_log ENABLE ROW LEVEL SECURITY;

-- pitch_scores: public read was never appropriate once the leaderboard view
-- became the sanctioned read path; explicit judge/organiser-only read + the
-- existing insert-locks-the-row behavior stays enforced at the app layer via
-- the UNIQUE(pitch_id) constraint (already present live).
DROP POLICY IF EXISTS "Public read pitch scores" ON public.pitch_scores;
CREATE POLICY "Judge or organiser read pitch_scores" ON public.pitch_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('judge', 'organiser'))
);

-- Organiser/service-role need to write pitch_scores from server actions
-- (submitPitchScoreAction, manualOverrideScoreAction, unlockPitchScoreAction
-- all use the service-role admin client, which bypasses RLS entirely — this
-- INSERT/UPDATE/DELETE policy is defense-in-depth for any future direct
-- client-side write attempt, matching the SELECT policy above).
DROP POLICY IF EXISTS "Organiser manage pitch_scores" ON public.pitch_scores;
CREATE POLICY "Organiser manage pitch_scores" ON public.pitch_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);

-- judge_scores: unused by current app code (0 rows live; the app now uses
-- pitch_scores' single-authoritative-score model instead), but its
-- original migration's "Judge read own scores, organiser reads all" read
-- policy (from 20260813000000_rls_hardening.sql) already restricts SELECT
-- correctly. Adding this defense-in-depth policy anyway matching the same
-- judge/organiser-only pattern as pitch_scores, since this session
-- couldn't behaviorally distinguish "policy blocks team role" from
-- "table has 0 rows for everyone" (see the DIFF RESULT note at the top of
-- this file) — an explicit policy removes that ambiguity going forward.
DROP POLICY IF EXISTS "Judge or organiser read judge_scores (pre-event-hardening)" ON public.judge_scores;
CREATE POLICY "Judge or organiser read judge_scores (pre-event-hardening)" ON public.judge_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('judge', 'organiser'))
  OR EXISTS (SELECT 1 FROM public.judges j WHERE j.id = judge_id AND j.auth_user_id = auth.uid())
);
