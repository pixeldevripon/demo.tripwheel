/**
 * Traveler session token (master 6.4 + login spec §1).
 *
 * The `/bookings` surface has no passwords: a successful email + booking-
 * reference lookup IS the login. This util turns a verification event into a
 * compact HMAC-signed, 24h token the frontend stores in a first-party
 * HttpOnly cookie and replays via the `x-traveler-session` header.
 *
 * TWO SCOPES - matched to how much the caller actually proved:
 *
 * - EMAIL scope (`{ e }`): issued ONLY by the pair lookup, where the caller
 *   proved knowledge of email + booking reference (both delivered to that
 *   inbox). Unlocks every booking whose contactEmail matches.
 * - BOOKING scope (`{ b }`): issued by checkout's contact PATCH. The caller
 *   proved nothing about the email (it is caller-supplied!), only possession
 *   of the unguessable booking id it just created - so the token unlocks
 *   exactly THAT booking and nothing else. Minting an email-scoped token
 *   here would let anyone reserve a throwaway booking, type a victim's
 *   email, and unlock the victim's real bookings.
 *
 * Deliberately stateless (no DB session table): the token grants nothing by
 * itself - every use re-checks it against the specific booking - and 24h
 * expiry bounds the exposure window. Signing secret is TRAVELER_SESSION_SECRET,
 * a REQUIRED, dedicated key (env.validate.ts enforces it at boot) - no fallback
 * to BETTER_AUTH_SECRET, so the two token systems stay cryptographically
 * separate and either can be rotated without touching the other.
 */
import { createHmac, timingSafeEqual } from 'crypto';

/** Login spec: traveler sessions last 24 hours. */
export const TRAVELER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Replayed by the frontend on TYP reads and the cancellation request. */
export const TRAVELER_SESSION_HEADER = 'x-traveler-session';

function secret(): string {
  const value = process.env.TRAVELER_SESSION_SECRET;
  if (!value) {
    // env.validate.ts requires TRAVELER_SESSION_SECRET, so this is unreachable
    // in a booted app - it guards direct util use in scripts/tests.
    throw new Error('TRAVELER_SESSION_SECRET is not set');
  }
  return value;
}

function sign(payload: string): Buffer {
  return createHmac('sha256', secret()).update(payload).digest();
}

/** What a verified token proves. Exactly one of the two fields is set. */
export interface TravelerSessionClaims {
  /** Pair-login proof: unlocks every booking with this contactEmail. */
  email: string | null;
  /** Checkout proof: unlocks exactly this booking id. */
  bookingId: string | null;
}

function issue(payload: Record<string, string | number>): string {
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TRAVELER_SESSION_TTL_MS }),
  ).toString('base64url');
  return `v1.${encoded}.${sign(encoded).toString('base64url')}`;
}

/**
 * EMAIL-scoped token. Only call after the caller PROVED the email + booking
 * reference pair (the /bookings lookup) - never from caller-supplied contact
 * data. Format: `v1.<base64url({ e, exp })>.<base64url(hmac)>`.
 */
export function issueTravelerSession(email: string): string {
  return issue({ e: email.trim().toLowerCase() });
}

/**
 * BOOKING-scoped token for the checkout flow: proves only "I authored this
 * booking" (possession of its unguessable id), so it unlocks that one
 * booking. Format: `v1.<base64url({ b, exp })>.<base64url(hmac)>`.
 */
export function issueBookingSession(bookingId: string): string {
  return issue({ b: bookingId });
}

/**
 * Verify a token and return its claims, or null for any failure - malformed,
 * tampered, or expired. Never throws on bad input.
 */
export function verifyTravelerSession(
  token: string | null | undefined,
): TravelerSessionClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, payload, signature] = parts;
  try {
    const expected = sign(payload);
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { e?: unknown; b?: unknown; exp?: unknown };
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    const email = typeof parsed.e === 'string' && parsed.e ? parsed.e : null;
    const bookingId =
      typeof parsed.b === 'string' && parsed.b ? parsed.b : null;
    if (!email && !bookingId) return null;
    return { email, bookingId };
  } catch {
    return null;
  }
}

// ── PII masking (unverified TYP mode) ────────────────────────────────────────
// The bare publicRef link stays a permanent *viewing* capability (master 8.2),
// but without a verified session the payload must not leak identity: mask,
// never omit, so the page keeps its shape and shows the traveler something IS
// there behind verification.

/** ada@example.com -> a•••@e•••.com (keeps first chars + TLD only). */
export function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.slice(0, 1)}•••@${domain.slice(0, 1)}•••${tld}`;
}

/**
 * +599 9 123 4567 -> ••• •• 67 (last two digits only). A value with fewer
 * than 4 digits is masked outright - "last two" of a 2-digit value would BE
 * the value.
 */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••• •• ••';
  return `••• •• ${digits.slice(-2)}`;
}

/** Smith -> S. */
export function maskLastName(last: string | null): string | null {
  if (!last) return last;
  return `${last.slice(0, 1)}.`;
}

/**
 * Do these session claims own this booking?
 * - BOOKING scope: exact id match - the token was minted for this record.
 * - EMAIL scope: case-insensitive contactEmail match; a booking without a
 *   contact email can never be email-owned (no credential exists for it).
 */
export function sessionOwnsBooking(
  claims: TravelerSessionClaims | null,
  booking: { id: string; contactEmail: string | null | undefined },
): boolean {
  if (!claims) return false;
  if (claims.bookingId) return claims.bookingId === booking.id;
  return (
    !!claims.email &&
    !!booking.contactEmail &&
    claims.email === booking.contactEmail.trim().toLowerCase()
  );
}
