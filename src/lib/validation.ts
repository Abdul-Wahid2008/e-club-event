/**
 * Validates if an email address belongs to the NIT Warangal STUDENT staff domain
 * (@student.nitw.ac.in only). Used to gate STAFF (judge/organiser) accounts.
 */
export function isValidStaffEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const staffRegex = /^[a-zA-Z0-9._%+-]+@student\.nitw\.ac\.in$/;
  return staffRegex.test(trimmed);
}

/**
 * Validates general email FORMAT only (no domain restriction). Used for TEAM
 * (fresher) registration/login, since incoming freshers may not yet have an
 * institute email address.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

/**
 * Validates an array of team member emails (format only, any domain allowed).
 */
export function validateTeamMemberEmails(emails: string[]): { valid: boolean; invalidEmails: string[] } {
  const invalidEmails: string[] = [];

  for (const email of emails) {
    if (!isValidEmailFormat(email)) {
      invalidEmails.push(email);
    }
  }

  return {
    valid: invalidEmails.length === 0,
    invalidEmails,
  };
}

/**
 * Normalizes an Indian mobile number to bare 10 digits for storage: strips
 * spaces/dashes/parens/an explicit "+", then requires exactly 10 digits
 * starting with 6-9 (the valid Indian mobile number range), OPTIONALLY
 * preceded by a 91 country code or a single leading 0 trunk prefix.
 *
 * Only strips the 91/0 prefix when the digit count actually implies one is
 * present (12 digits for 91+10, or 11 for 0+10) -- a naive "always strip a
 * leading 91" regex would wrongly mangle a real, valid 10-digit number that
 * itself starts with "91" (e.g. 9198765432 is a legitimate number, not
 * "91" + the 8-digit remainder "98765432"). Returns null if the input
 * doesn't match after normalization -- callers should treat null as
 * invalid, never store the raw input.
 */
export function normalizeIndianPhoneNumber(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let digits = input.replace(/[\s\-()]/g, '').replace(/^\+/, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

/**
 * Sanitizes user input string against HTML XSS, Null bytes, and SQL injection patterns.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/[<>]/g, (char) => (char === '<' ? '&lt;' : '&gt;')) // Escape angle brackets
    .trim();
}

/**
 * Validates UUID v4 format to prevent invalid ID injection in database queries.
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.trim());
}
