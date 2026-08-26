-- Migration: team_members email uniqueness
--
-- FIX: one person's email could end up on more than one team's
-- team_members roster (confirmed live: two real people each appeared as a
-- member of two different teams in different pools), which is the root
-- cause of a dry-run bug where the Team Portal and Organiser/Judge panels
-- appeared to disagree on a person's pool -- they were each correctly
-- reading a DIFFERENT team the same person was attached to.
--
-- Resolved live by deleting the duplicate team_members rows for the two
-- affected emails (see registerTeamAction's app-level pre-check for the
-- friendlier error message this backs). This index makes the same bug
-- impossible going forward.
--
-- If this ever needs to be re-applied against a DB with existing
-- duplicates, run this diagnostic first and resolve every row it returns
-- before the CREATE UNIQUE INDEX below will succeed:
--
-- SELECT tm.id, tm.team_id, t.team_name, t.pool, tm.name, tm.email, tm.is_leader, tm.created_at
-- FROM public.team_members tm
-- JOIN public.teams t ON t.id = tm.team_id
-- WHERE lower(tm.email) IN (
--   SELECT lower(email) FROM public.team_members GROUP BY lower(email) HAVING COUNT(*) > 1
-- )
-- ORDER BY tm.email, tm.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_email_unique
  ON public.team_members (lower(email));
