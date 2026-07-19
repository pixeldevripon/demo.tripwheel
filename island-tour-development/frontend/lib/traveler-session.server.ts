/**
 * Server-side half of the traveler session (master 6.4 + login spec §1).
 *
 * The backend issues an HMAC-signed, email-bound, 24h token on a successful
 * email + booking-reference lookup (and at checkout's contact step). The
 * browser never keeps it in JS: `POST /api/traveler-session` moves it into
 * this first-party HttpOnly cookie, and Server Components read it here to
 * forward as `x-traveler-session` on the (uncached) TYP fetch. The backend is
 * the only verifier - a forged cookie simply fails verification there and the
 * page renders masked.
 *
 * Server-only: the client-readable `it.travelerBooking` cookie
 * (lib/traveler-booking.ts) stays as harmless display sugar for the navbar;
 * it authorizes nothing.
 */
import 'server-only';

import { cookies } from 'next/headers';

export const TRAVELER_SESSION_COOKIE = 'it.travelerSession';

/** Mirrors the backend TTL (traveler-session.util.ts): 24h. */
export const TRAVELER_SESSION_MAX_AGE = 24 * 60 * 60;

/** The raw session token from the HttpOnly cookie, or null. Dynamic - only
 * call after `connection()` / inside a request-scoped context. */
export async function getTravelerSessionToken(): Promise<string | null> {
    const store = await cookies();
    return store.get(TRAVELER_SESSION_COOKIE)?.value ?? null;
}

/**
 * Set by the /payment/processing page for a few minutes right after checkout
 * completes, holding the booking's publicRef. Lets the TYP tell the ONE-TIME
 * "you're booked!" moment (celebratory hero) apart from a later visit via the
 * /bookings login (the calmer booking-management view). Short-lived on purpose
 * so a return visit - even in the same browser - lands on the management view.
 */
export const JUST_BOOKED_COOKIE = 'it.justBooked';

/** Did the traveler just complete checkout for THIS booking? Dynamic. */
export async function isJustBooked(publicRef: string): Promise<boolean> {
    const store = await cookies();
    return store.get(JUST_BOOKED_COOKIE)?.value === publicRef;
}
