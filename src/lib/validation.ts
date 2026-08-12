/**
 * Validates if an email address belongs to NIT Warangal student/official domain (@student.nitw.ac.in or @nitw.ac.in)
 */
export function isValidNitwEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  // Accepts student emails like ab25chb0b26@student.nitw.ac.in as well as @nitw.ac.in
  const nitwRegex = /^[a-zA-Z0-9._%+-]+@(student\.)?nitw\.ac\.in$/;
  return nitwRegex.test(trimmed);
}

/**
 * Validates an array of team member emails
 */
export function validateTeamMemberEmails(emails: string[]): { valid: boolean; invalidEmails: string[] } {
  const invalidEmails: string[] = [];

  for (const email of emails) {
    if (!isValidNitwEmail(email)) {
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
