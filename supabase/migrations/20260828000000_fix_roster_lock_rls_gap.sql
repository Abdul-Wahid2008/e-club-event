-- Migration: Close roster-lock RLS gap found by
-- scripts/test-solo-registration-and-roster.js
--
-- BUG: the 20260827010000 migration added a restrictive team_members/teams
-- policy meant to block writes to a roster-locked team (already called to
-- stage), gated by NOT is_team_roster_locked(...). But Postgres RLS ORs
-- multiple PERMISSIVE policies together for the same command -- the
-- original 20260809000000 migration's unconditional policies
-- ("Team insert members" ON team_members FOR INSERT WITH CHECK (true),
-- and "Team insert own team" / "Team update own team" ON teams) were never
-- dropped, so they alone were sufficient to let the write through
-- regardless of the new restrictive policy. Confirmed live: an
-- organiser-role session could still INSERT a team_members row into a
-- locked team.
--
-- Verified in-session: registerTeamAction, joinTeamWithCodeAction, and
-- every roster-management action in rosterActions.ts all write via
-- createAdminClient() (service_role), which bypasses RLS entirely --
-- narrowing these policies does not affect any real registration/roster
-- flow in the app, only direct API calls using a user's own anon/
-- authenticated-role session token.

-- team_members: the unconditional insert-true policy is now redundant
-- (real inserts go through service_role) and is exactly what let a locked
-- team accept new members via a direct API call. Drop it -- the existing
-- "Organiser and judge manage team members" FOR ALL policy already covers
-- the only other legitimate INSERT path (organiser/judge server actions,
-- which also use service_role and are therefore unaffected).
DROP POLICY IF EXISTS "Team insert members" ON public.team_members;

-- teams: "Team insert own team" WITH CHECK (true) is left as-is -- it only
-- ever creates a brand-new row (a locked team already exists, so there's
-- nothing to "lock" against on insert). "Team update own team" is missing
-- the lock check entirely; without it, a Team-role session could directly
-- PATCH its own already-called-to-stage team (rename it, etc.) via the API
-- even though the UI never exposes that. Replace it with a version that
-- also requires the team not be locked.
DROP POLICY IF EXISTS "Team update own team" ON public.teams;
CREATE POLICY "Team update own unlocked team" ON public.teams FOR UPDATE USING (
  auth.uid() = auth_user_id AND NOT public.is_team_roster_locked(id)
);
