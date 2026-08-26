'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { isValidStaffEmail, isValidEmailFormat, validateTeamMemberEmails } from '@/src/lib/validation';
import { redirect } from 'next/navigation';

export async function requestTeamOtpAction(formData: FormData) {
  const email = formData.get('email') as string;

  if (!email || !isValidEmailFormat(email)) {
    return { error: 'Please provide a valid email address.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, email };
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
    return { error: error.message };
  }

  if (data.user) {
    // Ensure profile row exists
    const adminSupabase = createAdminClient();
    await adminSupabase.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email!,
      role: 'team',
      full_name: email.split('@')[0],
    });
  }

  return { success: true };
}

export async function registerTeamAction(payload: {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  members: { name: string; email: string }[];
}) {
  const { teamName, leaderName, leaderEmail, members } = payload;

  // 1. Collect all member emails including leader
  const allEmails = [leaderEmail, ...members.map((m) => m.email)];
  
  // 2. Validate team size (2 to 4 members total)
  if (allEmails.length < 2 || allEmails.length > 4) {
    return { error: 'A team must have between 2 and 4 total members.' };
  }

  // 3. SERVER-SIDE VALIDATION: Check EVERY member email is a syntactically valid address (any domain allowed)
  const validation = validateTeamMemberEmails(allEmails);
  if (!validation.valid) {
    return {
      error: `All team member emails must be valid. Invalid emails found: ${validation.invalidEmails.join(', ')}`,
    };
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
  // Backed by the team_members_email_unique DB constraint; this is just a
  // friendlier pre-check with a clear error naming which email collided.
  const { data: existingMembers } = await adminSupabase
    .from('team_members')
    .select('email')
    .in('email', allEmails);

  if (existingMembers && existingMembers.length > 0) {
    const collided = existingMembers.map((m) => m.email).join(', ');
    return { error: `These emails are already registered on another team: ${collided}. Each person may only be a member of one team.` };
  }

  // 4. Random Domain Selection from `domains` table
  const { data: domains, error: domainErr } = await adminSupabase.from('domains').select('name');
  if (domainErr || !domains || domains.length === 0) {
    return { error: 'Failed to fetch domains from database.' };
  }
  const randomDomain = domains[Math.floor(Math.random() * domains.length)].name;

  // 5. Pool assignment: leave `pool` unset here and let the
  // assign_balanced_pool DB trigger decide it atomically inside the same
  // insert transaction. Deciding it here via two separate SELECT count
  // round-trips is race-prone — two concurrent registrations can both read
  // the same under-filled pool and both land in it, which is exactly what
  // happened live during the dry run (two teams registered in the same
  // millisecond both went to Pool A).

  // 6. Insert Team
  const { data: team, error: teamErr } = await adminSupabase
    .from('teams')
    .insert({
      auth_user_id: user.id,
      team_name: teamName,
      domain: randomDomain,
      status: 'registered',
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
    return { error: teamErr?.message || 'Failed to create team.' };
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

  // Pitch record creation for the prelim round is handled by the
  // trg_create_prelim_pitch_for_team DB trigger (fires on the team insert
  // above), which owns queue_status/pitch_order — do not duplicate it
  // here, that would race the trigger's UNIQUE(team_id, round_id) insert.

  return {
    success: true,
    team,
    domain: randomDomain,
    pool: team.pool,
  };
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
