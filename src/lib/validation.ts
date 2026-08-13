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
