import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // Refresh session token
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Protect Portal Routes
  if (pathname.startsWith('/portal')) {
    const staffRoute = pathname.startsWith('/portal/organiser') || pathname.startsWith('/portal/judge');

    if (!user) {
      url.pathname = staffRoute ? '/auth/staff' : '/auth/team';
      return NextResponse.redirect(url);
    }

    // ROLE CHECK: being logged in is not enough -- a Team account must not
    // be able to reach /portal/organiser or /portal/judge just by typing
    // the URL, and a Judge account must not reach /portal/organiser. The
    // portal pages themselves are 'use client' components that never
    // checked the caller's actual role (Navbar's userRole prop is
    // hardcoded per-page, not derived from the session) -- this was the
    // only enforcement point, and it never checked role at all before this
    // fix. Every mutating action is still safe (server actions all call
    // requireRole independently), but a Team account could directly render
    // the Judge/Organiser page shells and read data exposed to those
    // client-side fetches. Verified live against the real Supabase project
    // with fresh team/judge/organiser test sessions.
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = profile?.role;

    if (pathname.startsWith('/portal/organiser') && role !== 'organiser') {
      url.pathname = role === 'judge' ? '/portal/judge' : role === 'team' ? '/portal/team' : '/auth/staff';
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/portal/judge') && role !== 'judge' && role !== 'organiser') {
      url.pathname = role === 'team' ? '/portal/team' : '/auth/staff';
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/portal/team') && role !== 'team') {
      url.pathname = role === 'organiser' ? '/portal/organiser' : role === 'judge' ? '/portal/judge' : '/auth/team';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
