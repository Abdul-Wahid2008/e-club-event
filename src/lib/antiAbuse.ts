/**
 * Server-side verification for Cloudflare Turnstile tokens. Inert (always
 * passes) when TURNSTILE_SECRET_KEY isn't set, so the app works before the
 * organiser adds real keys -- see NEXT_PUBLIC_TURNSTILE_SITE_KEY in
 * TurnstileWidget for the client-side half of this pair.
 */
export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Please complete the verification challenge.' };
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();

    if (!data.success) {
      return { success: false, error: 'Verification failed. Please try again.' };
    }
    return { success: true };
  } catch {
    // Turnstile's own service being down should not block real registrants
    // during a burst -- fail open rather than turning an upstream outage
    // into a hard registration outage.
    return { success: true };
  }
}

/**
 * Honeypot field check: a hidden form field real users never see or fill.
 * Any non-empty value here is a strong bot signal. Callers should reject
 * SILENTLY (return a generic success-shaped response) rather than an error
 * that would teach a bot what tripped the filter.
 */
export function isHoneypotTripped(honeypotValue: string | null | undefined): boolean {
  return !!honeypotValue && honeypotValue.trim().length > 0;
}

/**
 * During a registration burst, Supabase's or the email provider's (Brevo)
 * own free-tier plan limits can be hit before any limit of ours -- that
 * surfaces as a rate-limit-shaped error message from the underlying client,
 * not a normal validation error. Callers should show the friendly message
 * this returns instead of the raw provider error/stack.
 */
export function friendlyErrorMessage(rawMessage: string | null | undefined): string {
  if (rawMessage && /rate limit|too many requests|429|quota/i.test(rawMessage)) {
    return "We're seeing high demand right now. Please wait a minute and try again.";
  }
  return rawMessage || 'Something went wrong. Please try again.';
}
