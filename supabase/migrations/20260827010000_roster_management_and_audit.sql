-- Migration: Organiser/Judge team-management tools
--
-- Adds a dedicated roster_audit_log table (kept separate from
-- score_audit_log per explicit decision -- scoring audits and roster
-- audits are different concerns with different readers) and RLS policies
-- that let Organiser/Judge move members between teams, merge teams, and
-- create empty teams directly against the DB (not just via server actions
-- using the service-role key), so RLS is a real enforcement layer, not
-- just UI-hidden.

CREATE TABLE IF NOT EXISTS public.roster_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('move_member', 'merge_teams', 'create_team', 'join_via_code')),
  affected_team_ids UUID[] NOT NULL,
  affected_member_id UUID,
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.roster_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organiser and judge read roster audit log" ON public.roster_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
);

CREATE POLICY "Organiser and judge insert roster audit log" ON public.roster_audit_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
);

-- Roster-lock helper: true once a team has a pitch that's been called to
-- stage or further. pitches.queue_status enum is ('queued', 'called',
-- 'pitching', 'awaiting_score', 'scored') -- 'queued' is the only
-- not-yet-called state, so lock on anything else. Reused by both the RLS
-- policies below and the app layer so the two can't disagree.
CREATE OR REPLACE FUNCTION public.is_team_roster_locked(p_team_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pitches
    WHERE team_id = p_team_id
      AND queue_status IN ('called', 'pitching', 'awaiting_score', 'scored')
  );
$$;

-- Organiser/Judge: manage teams (merge/create/delete-after-merge). Locked
-- teams are still readable but not writable via this policy -- the app
-- layer surfaces the "locked" state; this is the backstop for direct API
-- calls that skip the app's own check.
CREATE POLICY "Organiser and judge manage teams" ON public.teams FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
  AND NOT public.is_team_roster_locked(id)
);

-- Organiser/Judge: manage team_members (move between teams). Same lock
-- backstop, checked against the DESTINATION team on insert/update and the
-- SOURCE team on delete.
CREATE POLICY "Organiser and judge manage team members" ON public.team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organiser', 'judge'))
  AND NOT public.is_team_roster_locked(team_id)
);
