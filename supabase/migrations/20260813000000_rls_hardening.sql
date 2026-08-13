-- Migration: RLS Hardening for Security Audit
-- Tightens two over-broad "public read" policies that allowed any
-- authenticated client (anon key) to read data beyond what the UI shows:
--
-- 1. judge_scores: previously readable by ANY authenticated user, so a team
--    account could query raw per-judge, per-criterion scores directly,
--    bypassing the app's UI-level filtering / reveal gating. Now restricted
--    to the organiser and the judge who owns the row.
--
-- 2. team_members: previously readable by ANY authenticated user, exposing
--    every team member's name + email (including the CSV export data) to
--    anyone with the anon key, not just the organiser. Now restricted to
--    the organiser and the team's own members (via auth_user_id). The
--    parent `teams` table (name/domain/pool, no emails) remains public
--    read since it's needed for pool/domain display across all portals.

-- 1. judge_scores: restrict SELECT
DROP POLICY IF EXISTS "Judge read judge scores" ON public.judge_scores;
CREATE POLICY "Judge read own scores, organiser reads all" ON public.judge_scores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.judges j
    WHERE j.id = judge_id AND j.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);

-- 2. team_members: restrict SELECT
DROP POLICY IF EXISTS "Public read team members" ON public.team_members;
CREATE POLICY "Team reads own members, organiser reads all" ON public.team_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser'
  )
);
