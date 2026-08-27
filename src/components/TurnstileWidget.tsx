'use client';

import dynamic from 'next/dynamic';

// Lazy-loaded (client-only, code-split out of the main registration/auth
// bundle) since it pulls in Cloudflare's own external widget script --
// there's no reason to ship that to every visitor of a public, high-traffic
// registration page before they've even started filling the form.
const Turnstile = dynamic(() => import('@marsidev/react-turnstile').then((m) => m.Turnstile), { ssr: false });

/**
 * Renders nothing (and the form works as before) when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set -- the matching server-side
 * check in verifyTurnstileToken() also passes automatically in that case,
 * so this is fully inert until real keys are added, not a broken control.
 */
export default function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) return null;

  return (
    <div className="flex justify-center py-1">
      <Turnstile
        siteKey={siteKey}
        onSuccess={(token: string) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
        options={{ theme: 'dark', size: 'normal' }}
      />
    </div>
  );
}
