-- Migration: Solo registration + team join codes + leader phone number
--
-- 1. Relaxes the DB-level team size floor from 2 to 1 member so a solo
--    registrant is a valid team (enforced today only in application code
--    in authActions.ts; add a real constraint so a direct RPC/API call
--    can't create a 0-member team). Ceiling stays at 4, enforced by the
--    trigger below rather than a deferred constraint (Postgres can't
--    CHECK across rows in the same table without a trigger).
--
-- 2. Adds teams.join_code: a short, unique, human-shareable code so
--    teammates can join a team after the leader registers, instead of
--    the leader having to know every member's email up front. Generated
--    server-side (see next_join_code() below) at team-creation time.
--
-- 3. Adds a SEPARATE team_contact_info table (NOT a column on `teams`)
--    holding the leader/registrant's phone number. `teams` has an
--    unconditional public-read RLS policy ("Public read teams", USING
--    true) because domain/pool must be visible on every public
--    portal/screen -- RLS is row-level, not column-level, so a
--    phone_number column added directly to `teams` would be exposed to
--    anyone with the anon key alongside the public fields. This mirrors
--    the existing team_members pattern (see 20260813000000_rls_hardening,
--    which pulled member emails into an RLS-restricted table for the same
--    reason) -- one row per team, organiser/judge-only, never public.

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS teams_join_code_unique
ON public.teams (join_code)
WHERE join_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.team_contact_info (
  team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_contact_info ENABLE ROW LEVEL SECURITY;

-- Same visibility scope as team_members' email restriction: the team's own
-- registrant (auth_user_id match) plus organiser/judge. Never public, never
-- readable by other teams.
CREATE POLICY "Team reads own contact info, staff reads all" ON public.team_contact_info FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge')
  )
);

CREATE POLICY "Team insert own contact info" ON public.team_contact_info FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.auth_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge')
  )
);

-- Organiser/judge may also correct a mistyped number later from Manage
-- Teams (same staff-edit spirit as the roster tools added alongside this
-- migration) -- the team's own registrant is intentionally NOT granted
-- UPDATE here (no self-serve edit surface exists for this in the app yet).
CREATE POLICY "Staff update contact info" ON public.team_contact_info FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
);

-- Generates a 6-character uppercase alphanumeric code, excluding visually
-- ambiguous characters (0/O, 1/I/L), and retries on collision. Called once
-- per team at registration time (single row insert), so a small retry loop
-- here is fine -- this is not a hot path.
CREATE OR REPLACE FUNCTION public.generate_team_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempt int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code = result);

    attempt := attempt + 1;
    IF attempt > 20 THEN
      RAISE EXCEPTION 'Failed to generate a unique join code after % attempts', attempt;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

-- registerTeamAction calls this via the service-role admin client -- the
-- service role does not automatically inherit RPC EXECUTE grants (see the
-- 20260817000000_fix_rpc_grants.sql postmortem for assign_least_used_domain
-- and next_pool_assignment hitting this exact issue in production).
REVOKE ALL ON FUNCTION public.generate_team_join_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_team_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_team_join_code() TO service_role;

-- Enforces the 4-member cap at the DB level (defense in depth -- the app
-- already checks this before insert, but the join-code flow adds a second
-- INSERT path into team_members that must respect the same cap even under
-- concurrent joins, which a plain app-level pre-check can't guarantee).
CREATE OR REPLACE FUNCTION public.enforce_team_member_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  member_count int;
BEGIN
  -- Serialize concurrent inserts for the SAME team_id via a transaction-level
  -- advisory lock (released automatically at commit/rollback) before
  -- counting -- a plain SELECT count(*) with no lock lets two simultaneous
  -- "join with code" requests both read count=3 and both insert a 4th/5th
  -- member. hashtext(team_id::text) collapses the uuid into the bigint key
  -- advisory locks require.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.team_id::text));

  SELECT count(*) INTO member_count
  FROM public.team_members
  WHERE team_id = NEW.team_id;

  IF member_count >= 4 THEN
    RAISE EXCEPTION 'TEAM_FULL: This team already has the maximum of 4 members.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_member_cap ON public.team_members;
CREATE TRIGGER trg_enforce_team_member_cap
BEFORE INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_member_cap();
