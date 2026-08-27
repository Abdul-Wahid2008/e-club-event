import 'server-only';
import disposableDomains from 'disposable-email-domains';

// The disposable-email-domains package ships a ~120k-entry array. This file
// is server-only (see the server-only import above, which fails the build
// if a client component ever imports it) precisely so that list never ends
// up in the browser bundle -- it previously did, via validation.ts being
// imported by client registration/auth pages, ballooning their First Load
// JS by several hundred KB for a check that only ever needs to run
// server-side anyway.
const DISPOSABLE_DOMAIN_SET = new Set(disposableDomains.map((d) => d.toLowerCase()));

/**
 * Checks whether an email's domain is a known disposable/throwaway provider
 * (tempmail.com, etc.). Format validity is NOT checked here — call
 * isValidEmailFormat (from validation.ts) first.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  return DISPOSABLE_DOMAIN_SET.has(parts[1]);
}
