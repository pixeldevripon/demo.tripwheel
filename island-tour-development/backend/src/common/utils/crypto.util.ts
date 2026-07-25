import * as crypto from 'crypto';
import 'dotenv/config';
const ALGORITHM = 'aes-256-gcm';
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
  throw new Error('ENCRYPTION_KEY is not defined in environment variables');
}
const KEY = Buffer.from(encryptionKey, 'hex'); // 32 bytes = 64 hex chars

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag(); // GCM integrity tag

  // Store as iv:authTag:encrypted - all needed for decryption
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Decrypt without throwing. Returns the plaintext, or `null` when the value is
 * empty or cannot be decrypted (e.g. `ENCRYPTION_KEY` rotated). For read paths
 * that must degrade gracefully rather than 500 - the caller decides the fallback
 * (typically an env var) and should log the null.
 */
export function safeDecrypt(
  ciphertext: string | null | undefined,
): string | null {
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}
