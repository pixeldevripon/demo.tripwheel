import * as crypto from 'crypto';

/**
 * OCTO notification webhook signing (our convention; spec §5.4 leaves it to implementers — D13).
 *
 * Each delivery body is signed with the subscription's per-subscriber `secret` using
 * HMAC-SHA256 over the EXACT JSON bytes we POST. The signature travels in the
 * `Octo-Signature` header as `sha256=<hex>`. Subscribers recompute the HMAC over the
 * raw request body with their shared secret and compare in constant time.
 */
export const OCTO_SIGNATURE_HEADER = 'Octo-Signature';
export const OCTO_NOTIFICATION_ID_HEADER = 'Octo-Notification-Id';

/** Returns `sha256=<hex>` for the given raw body and shared secret. */
export function signNotification(rawBody: string, secret: string): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  return `sha256=${digest}`;
}

/**
 * Constant-time verify of a received `Octo-Signature` against the raw body + secret.
 * Exposed so the platform (and tests) can validate the same way subscribers should.
 */
export function verifyNotification(
  rawBody: string,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = signNotification(rawBody, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Generates a fresh random subscription secret (64 hex chars). */
export function generateSubscriptionSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
