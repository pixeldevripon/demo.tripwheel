/**
 * The traveller "session": a successful `/bookings` lookup saves its search
 * record - the email used and the booking's TYP path - in a cookie. The navbar
 * account menu is driven ONLY by this cookie (no Better Auth session on the
 * public site): the email is the displayed identity, "My bookings" deep-links
 * to the saved TYP path, and logging out simply clears the cookie.
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
}
