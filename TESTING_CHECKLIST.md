# The Pitch League — Full End-to-End Test Checklist

Run these in order. Each track builds on the previous one (you need a live Supabase project + deployed app before anything else works). Use a spreadsheet or this file itself to tick things off — note the date/time and pass/fail next to each.

---

## Track 0 — Environment Setup (do this first, nothing else works without it)

- [ ] Create the actual Supabase project (not just `.env.example`) and copy real `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`
- [ ] Set `DATABASE_ENCRYPTION_KEY` to a real generated secret (not a placeholder)
- [ ] Run all migrations in order: `20260809000000_initial_schema.sql` → `20260810000000_security_encryption_pgcrypto.sql` → `20260813000000_rls_hardening.sql`
- [ ] Run `seed.sql` — confirm 14 domains, prelim round, and `event_state` row exist in the Supabase table editor
- [ ] Manually create the organiser account (`organiser@nitw.ac.in`) and all 6 judge accounts in Supabase Auth, and confirm each has the correct `role` in `profiles`
- [ ] Deploy to Vercel; confirm the live URL loads the landing page with no console errors
- [ ] Open browser dev tools → Network tab on the deployed site, check response headers include HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`

---

## Track 1 — Auth & Role Routing

- [ ] Go to `/portal/organiser` directly while logged out → confirm redirect to `/auth/staff` (middleware guard)
- [ ] Go to `/portal/judge` directly while logged out → confirm redirect to `/auth/staff`
- [ ] Go to `/portal/team` directly while logged out → confirm redirect to `/auth/team`
- [ ] Log in as organiser → confirm you land on `/portal/organiser` and NOT any other portal
- [ ] Log in as a judge → confirm you land on `/portal/judge` and cannot reach `/portal/organiser` (try typing the URL directly while logged in as judge — should be blocked, not just hidden from nav)
- [ ] Try registering/logging in a team with a `@gmail.com` (or any non-nitw) email → confirm rejection with a clear error, both when you have JS network throttled/blocked (tests server-side check, not just client-side)
- [ ] Try registering a team with one valid nitw.ac.in email and one invalid member email → confirm the whole submission is rejected, naming which member's email is invalid
- [ ] Confirm OTP actually arrives by email and expires/works as expected

---

## Track 2 — Team Registration Flow

- [ ] Register Team 1 (2 members, all nitw.ac.in) → confirm domain is randomly assigned and displayed, pool shown (A or B)
- [ ] Register Team 2, 3, 4 similarly → confirm pools roughly balance (not all landing in Pool A)
- [ ] Register a 5th team with only 1 member → confirm it's rejected (minimum 2 required)
- [ ] Try submitting a 5-member team → confirm it's rejected (maximum 4)
- [ ] Check Supabase table editor: confirm `teams` and `team_members` rows match exactly what was submitted, no duplicate/partial rows from retries

---

## Track 3 — Organiser: Registrations & Live Control

- [ ] Organiser → Registrations tab shows all 4 test teams with correct domain/pool/members
- [ ] Click CSV export → confirm downloaded file opens correctly and matches the table
- [ ] Set Team 1's pitch as "live" from the Live Control panel
- [ ] **With a second browser (or incognito window) logged in as Team 3 (opposite pool)**, confirm the "Now Pitching: Team 1" banner appears within a second or two, with NO manual refresh
- [ ] Start the countdown timer (10-min prep phase) from organiser → confirm the timer appears and counts down live on the Team 3 window and a Judge window simultaneously
- [ ] Test pause/reset on the timer → confirm both other windows reflect it in real time
- [ ] Switch live pitch to Team 2 → confirm all open windows update the banner instantly

---

## Track 4 — Team Portal: Voting & Questions

With Team 1 marked live:
- [ ] Log in as Team 3 (opposite pool) → confirm the rating panel (5 sliders) and question box are visible and usable
- [ ] Submit a rating → confirm it can't be submitted twice for the same pitch (button disables or shows "already voted")
- [ ] Log in as Team 1 (the pitching team itself) → confirm rating/question panel is HIDDEN, with the "you can't vote for this pitch" message
- [ ] Log in as Team 2 (assume same pool as Team 1, adjust based on actual pool assignment) → confirm rating/question panel is also hidden for same-pool
- [ ] From Team 3, submit a question → confirm it shows "Submitted — pending review" on Team 3's screen
- [ ] Directly attempt the vote/question server action for a same-pool or own-team scenario via browser dev tools (bypassing the UI) → confirm the backend (RLS) rejects it too, not just the UI

---

## Track 5 — Judge Portal

- [ ] Log in as Judge 1 while Team 1 is live → submit scores for all 4 criteria → confirm submission locks (fields become read-only or a "submitted" state shows)
- [ ] Log in as Judge 2 → confirm "1/6 Judges Submitted" (or similar) is visible and updates to 2/6 after their submission
- [ ] Repeat for Judges 3–6 → confirm the progress indicator updates in real time as each submits
- [ ] Confirm a submitted judge score cannot be edited by that judge again (only unlocked by organiser)
- [ ] Approve one of Team 3's questions from the organiser side → confirm it now appears in the judge's "approved questions" context panel for Team 1's pitch

---

## Track 6 — Organiser: Question Queue & Scoring Overrides

- [ ] Organiser → Question Queue shows Team 3's submitted question as "pending"
- [ ] Approve it and mark outcome "team answered well" → confirm `points_to_team` increments and the leaderboard updates within seconds
- [ ] Submit a second question, mark outcome "team answered poorly" → confirm `points_to_asker` increments and `points_to_team` decrements, and this reflects on the leaderboard
- [ ] Reject a question → confirm it does NOT affect any scores and is clearly marked rejected (not silently disappearing)
- [ ] Use Manual Override to change one judge's score directly → confirm a mandatory note is required (try submitting without one — should be blocked) and that a new row appears in `score_audit_log` with old value, new value, and your note
- [ ] Use "Unlock Judge Score" on a locked judge → log back in as that judge → confirm they can now resubmit
- [ ] Confirm the live leaderboard math after all the above roughly matches hand-calculated expected values using the stated weights (20/20/15/15/20/10) — do this arithmetic yourself for at least one team as a sanity check, don't just trust the UI number

---

## Track 7 — Qualification & Finale

- [ ] With all 4 test teams scored, click "Reveal Final 4 & Qualify"
- [ ] Confirm confetti fires
- [ ] Confirm it correctly picks top-2 from Pool A + top-2 from Pool B based on actual scores (verify against your manual leaderboard math, not just that 4 names appear)
- [ ] Confirm new `pitches` rows are created for the final round, and the qualified teams can see their new status on their dashboard
- [ ] Repeat Live Control + timer + judge scoring once for a "final round" pitch to confirm the full loop still works outside the prelim round

---

## Track 8 — Security-Specific Checks (from the hardening pass)

- [ ] Attempt SQL-injection-style input in the question text box and team name field (e.g. `'; DROP TABLE teams; --`) → confirm it's stored as harmless text, not executed, and rendered safely (no broken HTML/script execution when displayed back)
- [ ] Attempt an XSS payload in a text field (e.g. `<script>alert(1)</script>`) → confirm it displays as literal text, doesn't execute
- [ ] Try calling an organiser-only server action (e.g. `manualOverrideScoreAction`) while logged in as a team, using browser dev tools to trigger it directly → confirm it's rejected with a role error, not silently succeeding
- [ ] Confirm `encrypt_sensitive_data` / `decrypt_sensitive_data` functions are NOT callable by the `anon` role (test with the public anon key, should fail)
- [ ] Confirm `isValidUUID()` rejects a malformed ID if you manually alter a URL/query param that takes a UUID

---

## Track 9 — Load & Day-Of Simulation

- [ ] Open 6–8 browser tabs/devices simultaneously (simulating judges + a few teams watching) all pointed at a single live pitch → confirm realtime updates don't lag or drop for any of them
- [ ] Simulate a full round: prep timer → pitch timer → Q&A timer → next team, back to back for 3–4 teams without restarting the server, to catch any state that doesn't reset properly between pitches
- [ ] Check mobile browser (actual phone, not just dev tools resize) for both Team and Judge portals, since most attendees will use phones
- [ ] Confirm what happens if a team's device disconnects mid-vote and reconnects (Wi-Fi drop is likely at a college event) — does it recover the current live state correctly on reconnect?

---

## Track 10 — Final Pre-Event Checklist

- [ ] Delete/reset all test data (test teams, test scores, test questions) so the real event starts clean
- [ ] Re-run the seed script if needed to confirm domains/rounds are correct for the real event
- [ ] Confirm real judge accounts (not test ones) are set up with correct emails
- [ ] Do one final full dry run (Tracks 3–7) with 2 real people on their own phones, not just you across browser tabs — this catches issues single-device testing misses
- [ ] Have a fallback plan noted (e.g., organiser can manually re-enter a score if a judge's device fails) since this is what the Manual Override exists for

---

**If anything fails in Tracks 1–7, fix and re-test before touching Track 8 (security) — a broken core flow is a bigger event-day risk than a security edge case. If anything fails in Track 9, that's the one most likely to bite you live on stage, so don't skip it even if you're short on time.**
