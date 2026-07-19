/**
 * The traveller display record + session hand-off.
 *
 * A successful `/bookings` lookup saves its search record - the email used and
 * the booking's TYP path - in a client-readable cookie. The navbar account
 * menu is driven ONLY by this cookie: the email is the displayed identity and
 * "My bookings" deep-links to the saved TYP path. It is DISPLAY SUGAR and
 * authorizes nothing.
 *
 * The real credential is the backend-issued session token (24h, email-bound,
 * HMAC): `storeTravelerSession` moves it into a first-party HttpOnly cookie
 * via `POST /api/traveler-session`, where browser JS can never read it again.
 * Server Components replay it to the backend, which is the only verifier -
 * it unlocks the full TYP payload and the cancellation request.
 *
 * Client-only helpers (document.cookie) - do not import from Server Components.
 */

export const TRAVELER_BOOKING_COOKIE = 'it.travelerBooking';

/** 90 days - comfortably past any booked tour date. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export interface TravelerBooking {
    /** The email the traveller looked up with - shown as the account identity. */
    email: string;
    /** Human display reference (IT-2026-XXXX) - prefills the lookup form. */
    ref: string;
    /** Locale-less TYP path (served by the proxy rewrite). */
    path: string;
}

/** Locale-less TYP path (served by the proxy rewrite). */
export function travelerBookingPath(
    destinationSlug: string | null,
    publicRef: string,
): string {
    return `/${destinationSlug || 'curacao'}/thank-you/${publicRef}`;
}

export function saveTravelerBooking(record: {
    destinationSlug: string | null;
    publicRef: string;
    email: string;
    displayRef: string;
}): void {
    const value: TravelerBooking = {
        email: record.email,
        ref: record.displayRef,
        path: travelerBookingPath(record.destinationSlug, record.publicRef),
    };
    document.cookie = `${TRAVELER_BOOKING_COOKIE}=${encodeURIComponent(JSON.stringify(value))};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

/** The saved search record, or null when none / malformed. */
export function readTravelerBooking(): TravelerBooking | null {
    const row = document.cookie
        .split('; ')
        .find(c => c.startsWith(`${TRAVELER_BOOKING_COOKIE}=`));
    if (!row) return null;
    try {
        const parsed = JSON.parse(
            decodeURIComponent(row.slice(row.indexOf('=') + 1)),
        ) as Partial<TravelerBooking>;
        // Only trust values shaped like our record - the cookie is client-writable.
        if (
            typeof parsed.email === 'string' &&
            parsed.email.includes('@') &&
            typeof parsed.ref === 'string' &&
            /^[A-Za-z0-9-]{4,40}$/.test(parsed.ref) &&
            typeof parsed.path === 'string' &&
            /^\/[a-z0-9-]+\/thank-you\/[A-Za-z0-9-]+$/.test(parsed.path)
        ) {
            return { email: parsed.email, ref: parsed.ref, path: parsed.path };
        }
        return null;
    } catch {
        return null;
    }
}

export function clearTravelerBooking(): void {
    document.cookie = `${TRAVELER_BOOKING_COOKIE}=;path=/;max-age=0;samesite=lax`;
    // Also drop the HttpOnly session cookie (fire-and-forget: the token
    // expires in 24h anyway, so a lost delete is not a security hole).
    void fetch('/api/traveler-session', { method: 'DELETE' }).catch(() => {});
}

/**
 * One-time post-checkout "you're booked!" signal. Set by the
 * /payment/processing hop right after a fresh checkout so the TYP can show the
 * celebratory hero; mirrors the server-side `JUST_BOOKED_COOKIE`
 * (traveler-session.server.ts, read there via `isJustBooked`).
 */
export const JUST_BOOKED_COOKIE = 'it.justBooked';

/** 15 minutes - the celebratory hero lingers only for the immediate return. */
const JUST_BOOKED_MAX_AGE = 15 * 60;

/**
 * Flag the ONE-TIME celebratory moment (publicRef-scoped). The TYP shows the
 * "you're booked!" hero while this is set and falls back to the calmer
 * management view once it clears.
 */
export function markJustBooked(publicRef: string): void {
    document.cookie = `${JUST_BOOKED_COOKIE}=${encodeURIComponent(publicRef)};path=/;max-age=${JUST_BOOKED_MAX_AGE};samesite=lax`;
}

/**
 * Clear the celebratory signal. An explicit `/bookings` login is a deliberate
 * "manage my booking" visit, so the one-time "you're booked!" hero is over -
 * without this the TYP would keep rendering celebratory for up to 15 min after
 * a checkout even when the traveller came back through the login door.
 */
export function clearJustBooked(): void {
    document.cookie = `${JUST_BOOKED_COOKIE}=;path=/;max-age=0;samesite=lax`;
}

/**
 * Store the backend-issued traveler session token in the HttpOnly cookie.
 * Await it before navigating to the TYP so the very first server render is
 * already verified (unmasked).
 */
export async function storeTravelerSession(token: string): Promise<void> {
    try {
        await fetch('/api/traveler-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
    } catch {
        // Non-fatal: the TYP just renders masked with a "verify it's you"
        // card, which resolves through /bookings.
    }
}
