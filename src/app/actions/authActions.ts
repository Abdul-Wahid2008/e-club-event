'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { isValidNitwEmail, validateTeamMemberEmails } from '@/src/lib/validation';
import { redirect } from 'next/navigation';

export async function requestTeamOtpAction(formData: FormData) {
  const email = formData.get('email') as string;

  if (!email || !isValidNitwEmail(email)) {
    return { error: 'Invalid email domain. Only official NIT Warangal emails ending with @student.nitw.ac.in (or @nitw.ac.in) are allowed.' };
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
  if (!email || !isValidNitwEmail(email)) {
    return { error: 'Invalid @student.nitw.ac.in email address.' };
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

  // 3. SERVER-SIDE STRICT VALIDATION: Check EVERY member email ends with @student.nitw.ac.in (or @nitw.ac.in)
  const validation = validateTeamMemberEmails(allEmails);
  if (!validation.valid) {
    return {
      error: `All team members must use official student emails ending with @student.nitw.ac.in. Invalid emails found: ${validation.invalidEmails.join(', ')}`,
    };
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Get current logged in user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'User is not authenticated. Please verify OTP first.' };
  }

  // 4. Random Domain Selection from `domains` table
  const { data: domains, error: domainErr } = await adminSupabase.from('domains').select('name');
  if (domainErr || !domains || domains.length === 0) {
    return { error: 'Failed to fetch domains from database.' };
  }
  const randomDomain = domains[Math.floor(Math.random() * domains.length)].name;

  // 5. Auto-Balanced Pool Assignment (A or B)
  const { data: poolACount } = await adminSupabase
    .from('teams')
    .select('id', { count: 'exact' })
    .eq('pool', 'A');
  
  const { data: poolBCount } = await adminSupabase
    .from('teams')
    .select('id', { count: 'exact' })
    .eq('pool', 'B');

  const countA = poolACount?.length || 0;
  const countB = poolBCount?.length || 0;
  const assignedPool: 'A' | 'B' = countA <= countB ? 'A' : 'B';

  // 6. Insert Team
  const { data: team, error: teamErr } = await adminSupabase
    .from('teams')
    .insert({
      auth_user_id: user.id,
      team_name: teamName,
      domain: randomDomain,
      pool: assignedPool,
      status: 'registered',
    })
    .select()
    .single();

  if (teamErr || !team) {
    if (teamErr?.code === '23505') {
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
    return { error: 'Failed to register team members.' };
  }

  // 8. Create Pitch record for Prelim round automatically
  const { data: prelimRound } = await adminSupabase
    .from('rounds')
    .select('id')
    .eq('name', 'prelim')
    .single();

  if (prelimRound) {
    await adminSupabase.from('pitches').insert({
      team_id: team.id,
      round_id: prelimRound.id,
      status: 'upcoming',
      pitch_order: countA + countB + 1,
    });
  }

  return {
    success: true,
    team,
    domain: randomDomain,
    pool: assignedPool,
  };
}

export async function staffLoginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
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
