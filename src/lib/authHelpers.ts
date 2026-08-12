import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';

export type UserRole = 'organiser' | 'judge' | 'team';

export interface AuthenticatedUserContext {
  user: {
    id: string;
    email: string;
  };
  role: UserRole;
}

/**
 * Retrieves authenticated user and their verified role from the profiles table.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUserContext | null> {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user || !user.email) {
    return null;
  }

  // Fetch verified role from profiles table using admin client to prevent RLS recursion
  const adminSupabase = createAdminClient();
  const { data: profile, error: profileErr } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    // Default fallback based on metadata or basic role
    return {
      user: { id: user.id, email: user.email },
      role: 'team',
    };
  }

  return {
    user: { id: user.id, email: user.email },
    role: profile.role as UserRole,
  };
}

/**
 * Asserts that the caller is authenticated and holds one of the specified roles.
 * Throws an error or returns context if valid.
 */
export async function requireRole(allowedRoles: UserRole | UserRole[]): Promise<AuthenticatedUserContext> {
  const authCtx = await getAuthenticatedUser();
  if (!authCtx) {
    throw new Error('Unauthorized: Authentication required.');
  }

  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!rolesArray.includes(authCtx.role)) {
    throw new Error(`Forbidden: Access denied. Required role: ${rolesArray.join(' or ')}.`);
  }

  return authCtx;
}
