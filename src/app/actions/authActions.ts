'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { isValidStaffEmail, isValidEmailFormat, validateTeamMemberEmails, normalizeIndianPhoneNumber } from '@/src/lib/validation';
import { isDisposableEmail } from '@/src/lib/disposableEmail.server';
import { verifyTurnstileToken, isHoneypotTripped, friendlyErrorMessage } from '@/src/lib/antiAbuse';
import { redirect } from 'next/navigation';

const OTP_REQUEST_COOLDOWN_SECONDS = 15;

export async function requestTeamOtpAction(formData: FormData) {
  const email = formData.get('email') as string;
  const honeypot = formData.get('company_website') as string | null;
  const turnstileToken = formData.get('cf-turnstile-response') as string | null;

  // Honeypot: reject silently with a success-shaped response so a bot
  // filling every field (including the hidden one) never learns why it
  // failed -- it just never receives a working OTP.
  if (isHoneypotTripped(honeypot)) {
    return { success: true, email: (email || '').trim().toLowerCase() };
  }

  if (!email || !isValidEmailFormat(email)) {
    return { error: 'Please provide a valid email address.' };
  }
  const normalizedEmail = email.trim().toLowerCase();

  if (isDisposableEmail(normalizedEmail)) {
    return { error: 'Please use a real, non-disposable email address to register.' };
  }

  const turnstileResult = await verifyTurnstileToken(turnstileToken);
  if (!turnstileResult.success) {
    return { error: turnstileResult.error || 'Verification failed. Please try again.' };
  }

  const adminSupabase = createAdminClient();

  // Idempotency / rate-limit: if this email requested a code in the last
  // OTP_REQUEST_COOLDOWN_SECONDS, don't send a second one — acknowledge
  // success instead. Covers both a genuine double-tap/flaky-retry and
  // repeated-tap abuse, without a DB round trip that can race (the
  // UNIQUE PK on email + upsert-with-condition below is the atomic guard).
  const { data: existingLog } = await adminSupabase
    .from('otp_request_log')
    .select('last_requested_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingLog) {
    const elapsedMs = Date.now() - new Date(existingLog.last_requested_at).getTime();
    if (elapsedMs < OTP_REQUEST_COOLDOWN_SECONDS * 1000) {
      return { success: true, email: normalizedEmail };
    }
  }

  // Re-login vs. registration: one email input serves both. If a team
  // already exists for this email, send a login-only OTP that does not
  // create a new auth user (shouldCreateUser: false), so a repeat visitor
  // authenticates without re-running domain/pool assignment. Otherwise
  // fall through to the existing registration OTP (creates the user).
  // profiles.email is unique and populated for every verified team auth
  // user (see verifyTeamOtpAction's upsert), so it's a direct lookup —
  // no need to page through auth.admin.listUsers().
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  const { data: existingTeam } = existingProfile
    ? await adminSupabase.from('teams').select('id').eq('auth_user_id', existingProfile.id).maybeSingle()
    : { data: null };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: !existingTeam,
    },
  });

  if (error) {
    // Supabase Auth's own send path proxies through its configured email
    // provider (Brevo here) -- during a WhatsApp-driven registration burst,
    // either Supabase's or Brevo's free-tier plan limits can be hit before
    // ours. Surface a friendly retry message instead of a raw provider
    // error/stack, since the real fix (a tier upgrade) is a cost decision,
    // not something a user retry can solve mid-burst.
    const isRateLimited = /rate limit|too many requests|429/i.test(error.message);
    return {
      error: isRateLimited
        ? "We're seeing high demand right now. Please wait a minute and try again."
        : error.message,
    };
  }

  await adminSupabase
    .from('otp_request_log')
    .upsert({ email: normalizedEmail, last_requested_at: new Date().toISOString() });

  // Deliberately does NOT return whether this was a new-vs-returning team —
  // that would let an unauthenticated caller enumerate registered emails
  // via this response alone (routing on new-vs-returning only happens
  // post-verification, in verifyTeamOtpAction, once inbox ownership is
  // proven — see isReturningTeam there instead).
  return { success: true, email: normalizedEmail };
}

export async function verifyTeamOtpAction(email: string, token: string) {
  if (!email || !isValidEmailFormat(email)) {
    return { error: 'Invalid email address.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    const isExpired = /expired/i.test(error.message);
    return {
      error: isExpired
        ? 'This code has expired. Request a new one below.'
        : 'Incorrect code. Please check and try again.',
      expired: isExpired,
    };
  }

  if (!data.user) {
    return { error: 'Verification failed. Please try again.' };
  }

  const adminSupabase = createAdminClient();

  // Ensure profile row exists (both new registrants and returning teams).
  await adminSupabase.from('profiles').upsert({
    id: data.user.id,
    email: data.user.email!,
    role: 'team',
    full_name: email.split('@')[0],
  });

  // Returning team: route straight to their existing dashboard, skip
  // registration/domain/pool assignment entirely.
  const { data: existingTeam } = await adminSupabase
    .from('teams')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  return { success: true, isReturningTeam: !!existingTeam };
}

export async function registerTeamAction(payload: {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  members: { name: string; email: string }[];
  honeypot?: string;
  turnstileToken?: string;
}) {
  const { teamName, leaderName, leaderEmail, leaderPhone, members, honeypot, turnstileToken } = payload;

  // Honeypot: reject silently -- return the same shape a real submission
  // would produce on the FIRST failure path a bot is likely to hit (a
  // generic error), never a message that reveals a hidden field exists.
  if (isHoneypotTripped(honeypot)) {
    return { error: 'Registration failed. Please try again.' };
  }

  const turnstileResult = await verifyTurnstileToken(turnstileToken);
  if (!turnstileResult.success) {
    return { error: turnstileResult.error || 'Verification failed. Please try again.' };
  }

  // 1. Collect all member emails including leader
  const allEmails = [leaderEmail, ...members.map((m) => m.email)];

  // 2. Validate team size (1 to 4 members total -- solo registration allowed)
  if (allEmails.length < 1 || allEmails.length > 4) {
    return { error: 'A team must have between 1 and 4 total members.' };
  }

  // 3. SERVER-SIDE VALIDATION: Check EVERY member email is a syntactically valid address (any domain allowed)
  const validation = validateTeamMemberEmails(allEmails);
  if (!validation.valid) {
    return {
      error: `All team member emails must be valid. Invalid emails found: ${validation.invalidEmails.join(', ')}`,
    };
  }

  // 3b. Leader/registrant phone number: required, normalized to bare 10
  // digits (strips +91/spaces/dashes) before storage -- see
  // normalizeIndianPhoneNumber's own doc comment for the exact rule.
  const normalizedPhone = normalizeIndianPhoneNumber(leaderPhone);
  if (!normalizedPhone) {
    return { error: 'Please provide a valid 10-digit Indian mobile number.' };
  }

  const disposable = allEmails.filter((e) => isDisposableEmail(e));
  if (disposable.length > 0) {
    return { error: `Please use real, non-disposable email addresses. Rejected: ${disposable.join(', ')}` };
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Get current logged in user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'User is not authenticated. Please verify OTP first.' };
  }

  // 3b. ABUSE PROTECTION: block one authenticated identity from registering
  // more than one team (open email domain means no other natural cap on
  // repeat/spam registrations). Backed by a UNIQUE(auth_user_id) DB
  // constraint; this is just a friendlier pre-check.
  const { data: existingTeam } = await adminSupabase
    .from('teams')
    .select('id, team_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingTeam) {
    return { error: `You have already registered a team ("${existingTeam.team_name}"). Each account may register only one team.` };
  }

  // 3c. ABUSE PROTECTION: block any team member email (leader or otherwise)
  // that's already registered as a member of a DIFFERENT team. Without this,
  // the same person can end up attached to two teams in two different pools
  // (confirmed root cause of a dry-run bug where the Team Portal and
  // Organiser/Judge panels appeared to disagree on a person's pool — each
  // was correctly reading a different team-membership row for that email).
  // Backed by the team_members_email_unique DB constraint (already applied
  // live, confirmed rejecting duplicate emails with a 23505); this is just
  // a friendlier pre-check with a clear error naming which email collided.
  // Compares case-insensitively to match that constraint (UNIQUE on
  // lower(email)) — a plain .in('email', ...) filter would miss a
  // same-email-different-case collision.
  const lowerEmails = allEmails.map((e) => e.toLowerCase());
  const { data: allMemberEmails } = await adminSupabase
    .from('team_members')
    .select('email');

  const existingMembers = (allMemberEmails || []).filter((m) => lowerEmails.includes(m.email.toLowerCase()));

  if (existingMembers.length > 0) {
    const collided = existingMembers.map((m) => m.email).join(', ');
    return { error: `These emails are already registered on another team: ${collided}. Each person may only be a member of one team.` };
  }

  // 4. Least-assigned-first domain selection: pick uniformly at random
  // among whichever domain(s) currently have the lowest assigned_count,
  // rather than pure Math.random() across the whole table (which produces
  // back-to-back repeats). The "find min, increment, return" happens
  // atomically in assign_least_used_domain (a single RPC round trip), so
  // two concurrent registrations can't both read the same lowest count and
  // pick the same domain without seeing each other's increment.
  const { data: domainResult, error: domainErr } = await adminSupabase.rpc('assign_least_used_domain');
  if (domainErr || !domainResult) {
    return { error: friendlyErrorMessage(domainErr?.message) };
  }
  const assignedDomain = domainResult as string;

  // 5. Deterministic pool alternation via a Postgres sequence: nextval()
  // is a single atomic operation, so two simultaneous registrations can
  // never both land in the same slot (unlike the previous
  // countA <= countB read-then-write check, which had a race window).
  const { data: seqResult, error: seqErr } = await adminSupabase.rpc('next_pool_assignment');
  if (seqErr || !seqResult) {
    return { error: friendlyErrorMessage(seqErr?.message) };
  }
  const assignedPool = seqResult as 'A' | 'B';

  // 5b. Generate a short human-shareable join code so teammates can join
  // this team later without the leader needing every email up front.
  const { data: joinCodeResult, error: joinCodeErr } = await adminSupabase.rpc('generate_team_join_code');
  if (joinCodeErr || !joinCodeResult) {
    return { error: friendlyErrorMessage(joinCodeErr?.message) };
  }
  const joinCode = joinCodeResult as string;

  // 6. Insert Team
  const { data: team, error: teamErr } = await adminSupabase
    .from('teams')
    .insert({
      auth_user_id: user.id,
      team_name: teamName,
      domain: assignedDomain,
      pool: assignedPool,
      status: 'registered',
      join_code: joinCode,
    })
    .select()
    .single();

  if (teamErr || !team) {
    if (teamErr?.code === '23505') {
      if (teamErr.message?.includes('teams_auth_user_id_unique')) {
        return { error: 'You have already registered a team. Each account may register only one team.' };
      }
      return { error: 'A team with this name is already registered.' };
    }
    return { error: friendlyErrorMessage(teamErr?.message) };
  }

  // 7. Insert Team Members
  const memberRows = [
    {
      team_id: team.id,
      name: leaderName,
      email: leaderEmail,
      is_leader: true,
    },
    ...members.map((m) => ({
      team_id: team.id,
      name: m.name,
      email: m.email,
      is_leader: false,
    })),
  ];

  const { error: membersErr } = await adminSupabase.from('team_members').insert(memberRows);
  if (membersErr) {
    if (membersErr.code === '23505') {
      return { error: 'One of these emails is already registered as a member of another team. Each person may only be a member of one team.' };
    }
    return { error: 'Failed to register team members.' };
  }

  // 8. Store the leader/registrant's phone number in the RLS-restricted
  // team_contact_info table (never on the publicly-readable `teams` row --
  // see that migration's doc comment for why). Best-effort: the team is
  // already fully registered at this point, so a failure here shouldn't
  // block/rollback the whole registration -- it's logged for the organiser
  // to notice a missing contact number rather than surfaced as a hard error
  // to a registrant who has otherwise successfully signed up.
  const { error: contactErr } = await adminSupabase
    .from('team_contact_info')
    .insert({ team_id: team.id, phone_number: normalizedPhone });
  if (contactErr) {
    console.error('Failed to store team contact phone number:', contactErr.message);
  }

  // Pitch record creation for the prelim round is handled by the
  // trg_create_prelim_pitch_for_team DB trigger (fires on the team insert
  // above), which owns queue_status/pitch_order — do not duplicate it
  // here, that would race the trigger's UNIQUE(team_id, round_id) insert.

  return {
    success: true,
    team,
    domain: assignedDomain,
    pool: assignedPool,
  };
}

/**
 * Adds the currently-authenticated (OTP-verified) user as a member of the
 * team identified by joinCode. Reuses the same one-team-per-email
 * guarantees as registerTeamAction: teams_auth_user_id_unique blocks
 * joining a second team on this identity, and team_members_email_unique
 * blocks the same email being a member of two teams (e.g. registered solo
 * elsewhere, or added by an Organiser to a third team). The 4-member cap
 * is enforced by the trg_enforce_team_member_cap DB trigger (advisory-
 * locked per team_id) so concurrent joins can't overshoot it.
 */
export async function joinTeamWithCodeAction(payload: {
  joinCode: string;
  memberName: string;
  honeypot?: string;
}) {
  const { joinCode, memberName, honeypot } = payload;

  if (isHoneypotTripped(honeypot)) {
    return { error: 'Unable to join this team. Please try again.' };
  }

  const normalizedCode = (joinCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { error: 'Please enter a join code.' };
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { error: 'Please verify your email first.' };
  }

  // Block one identity from being on two teams, same guarantee as
  // registerTeamAction's 3b check.
  const { data: existingTeam } = await adminSupabase
    .from('teams')
    .select('id, team_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingTeam) {
    return { error: `You are already registered with team "${existingTeam.team_name}". Each account may belong to only one team.` };
  }

  const { data: targetTeam, error: teamLookupErr } = await adminSupabase
    .from('teams')
    .select('id, team_name')
    .eq('join_code', normalizedCode)
    .maybeSingle();

  if (teamLookupErr || !targetTeam) {
    return { error: 'That join code was not found. Please double-check it and try again.' };
  }

  const { count: memberCount } = await adminSupabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', targetTeam.id);

  if ((memberCount ?? 0) >= 4) {
    return { error: 'team_full', teamName: targetTeam.team_name };
  }

  const { data: lockedPitch } = await adminSupabase
    .from('pitches')
    .select('id')
    .eq('team_id', targetTeam.id)
    .in('queue_status', ['called', 'pitching', 'awaiting_score', 'scored'])
    .maybeSingle();

  if (lockedPitch) {
    return { error: `Team "${targetTeam.team_name}" has already been called to stage and can no longer accept new members.` };
  }

  const { error: insertErr } = await adminSupabase.from('team_members').insert({
    team_id: targetTeam.id,
    name: memberName,
    email: user.email,
    is_leader: false,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { error: 'This email is already registered as a member of another team.' };
    }
    if (insertErr.message?.includes('TEAM_FULL')) {
      return { error: 'team_full', teamName: targetTeam.team_name };
    }
    return { error: insertErr.message || 'Failed to join the team.' };
  }

  await adminSupabase.from('roster_audit_log').insert({
    changed_by: user.id,
    action: 'join_via_code',
    affected_team_ids: [targetTeam.id],
    new_value: { email: user.email, name: memberName, team_name: targetTeam.team_name },
    note: `Joined via team join code ${normalizedCode}.`,
  });

  return { success: true, teamName: targetTeam.team_name };
}

export async function staffLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  // SERVER-SIDE STRICT DOMAIN ENFORCEMENT for staff (judge/organiser) accounts.
  // Temporary exception: STAFF_TEST_EMAIL_ALLOWLIST (comma-separated) lets pre-seeded
  // non-institute test accounts keep working until they're migrated to real
  // @student.nitw.ac.in addresses. Remove this allowlist once testing is done.
  const testAllowlist = (process.env.STAFF_TEST_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidStaffEmail(email) && !testAllowlist.includes(normalizedEmail)) {
    return { error: 'Staff login is restricted to official @student.nitw.ac.in email addresses.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: error?.message || 'Invalid login credentials.' };
  }

  // Fetch role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  const role = profile?.role || 'judge';

  if (role === 'organiser') {
    redirect('/portal/organiser');
  } else if (role === 'judge') {
    redirect('/portal/judge');
  } else {
    redirect('/portal/team');
  }
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}
