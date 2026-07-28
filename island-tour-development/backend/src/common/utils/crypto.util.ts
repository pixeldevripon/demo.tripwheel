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

/**
 * How a stored secret is shown back to an admin: bullets + the last 4 plaintext
 * characters (`••••••••WQZD`). Enough to tell WHICH credential is stored,
 * useless as a credential.
 *
 * THE one masking rule for every secret on the platform - the Stripe and Mollie
 * keys, the Meta CAPI token, the translation API key, the Trustpilot/Google keys
 * and the Instagram access token all render through this, so the format can
 * never drift between settings cards. It lives here rather than on a service
 * because it belongs to the secret, not to any one module (it used to be four
 * private copies of the same three lines).
 *
 * Takes the CIPHERTEXT and goes through `safeDecrypt`: a value that no longer
 * decrypts (a rotated `ENCRYPTION_KEY`) masks to `null` instead of throwing a
 * 500 out of a settings GET. Pair it with the row's own "is it set" boolean when
 * the caller needs to tell "never set" from "set but unreadable".
 */
export function maskSecret(
  ciphertext: string | null | undefined,
): string | null {
  const plaintext = safeDecrypt(ciphertext)?.trim();
  if (!plaintext) return null;
  return '••••••••' + plaintext.slice(-4);
}

/**
 * Constant-time equality for two secrets. Use it anywhere a caller-supplied
 * value is compared against a stored one; `===` short-circuits on the first
 * differing byte and leaks how much of a guess was right.
 *
 * The length check is not constant-time and cannot be (`timingSafeEqual` throws
 * on a length mismatch), so this leaks length only.
 */
export function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
