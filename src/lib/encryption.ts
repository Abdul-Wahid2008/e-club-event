import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const secret = process.env.DATABASE_ENCRYPTION_KEY || 'default_pitch_under_pressure_aes_key_2026_32bytes!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns base64 string formatted as: iv:ciphertext:authTag
 */
export function encryptAES(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload string.
 */
export function decryptAES(payload: string): string {
  if (!payload || !payload.includes(':')) return payload;

  try {
    const parts = payload.split(':');
    if (parts.length !== 3) return payload;

    const [ivHex, encryptedHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '[Decryption Failed]';
  }
}
