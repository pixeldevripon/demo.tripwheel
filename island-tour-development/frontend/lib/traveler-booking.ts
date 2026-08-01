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
    emitTravellerIdentityChange();
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

/**
 * Drop the two client-readable cookies. Does NOT touch the HttpOnly session -
 * signing out goes through `signOutTraveller`, which awaits that round trip.
 */
export function clearTravelerBooking(): void {
    document.cookie = `${TRAVELER_BOOKING_COOKIE}=;path=/;max-age=0;samesite=lax`;
    document.cookie = `${TRAVELLER_ACCOUNT_COOKIE}=;path=/;max-age=0;samesite=lax`;
    emitTravellerIdentityChange();
}

/**
 * Sign out for real: forget the display cookies, then wait for the server to
 * drop the HttpOnly session.
 *
 * The await is the whole point. The DELETE used to be fire-and-forget, so a
 * caller that navigated or refreshed straight after could race it - the next
 * server render still saw a live session and re-rendered the traveller signed
 * in, which read as "log out did nothing". Clearing the readable cookies first
 * lets the navbar flip immediately while the request is in flight.
 */
export async function signOutTraveller(): Promise<void> {
    clearTravelerBooking();
    try {
        await fetch('/api/traveler-session', { method: 'DELETE' });
    } catch {
        // Non-fatal: the token expires in 24h on its own. The traveller is
        // already signed out everywhere this browser can see.
    }
}

// ── Account-area identity (the OTP door) ────────────────────────────────────
// The navbar cannot ask the server whether someone is signed in: reading the
// HttpOnly cookie in the layout would make every page request-time and cost
// the prerendered shell. So the account door mirrors the pattern above with
// its own DISPLAY-ONLY cookie - the email, nothing else, authorizing nothing.
// Without it a traveller who signs in at /{locale}/traveller would still see
// the signed-out navbar.

export const TRAVELLER_ACCOUNT_COOKIE = 'it.travellerAccount';

/** Matches the 24h traveler session it shadows - never outlive the real one. */
const TRAVELLER_ACCOUNT_MAX_AGE = 60 * 60 * 24;

/** Remember who signed in at the account door (display identity only). */
export function saveTravellerAccount(email: string): void {
    document.cookie = `${TRAVELLER_ACCOUNT_COOKIE}=${encodeURIComponent(email)};path=/;max-age=${TRAVELLER_ACCOUNT_MAX_AGE};samesite=lax`;
    emitTravellerIdentityChange();
}

/** The signed-in account email, or null when absent / not email-shaped. */
export function readTravellerAccount(): string | null {
    const row = document.cookie
        .split('; ')
        .find(c => c.startsWith(`${TRAVELLER_ACCOUNT_COOKIE}=`));
    if (!row) return null;
    // The cookie is client-writable, so trust only an email-shaped value.
    const email = decodeURIComponent(row.slice(row.indexOf('=') + 1));
    return email.includes('@') && email.length <= 320 ? email : null;
}

/**
 * Make the navbar identity agree with the address a booking was just made
 * under (test report 2026-08-01 §Traveler.4).
 *
 * The chrome's identity is a client-readable cookie; the real credential is
 * the HttpOnly session. Checkout moves the session, and nothing used to move
 * the cookie - so after booking with a different address the header still
 * showed the previous traveller, while every server-rendered surface had
 * already moved on. Three views of one identity, disagreeing.
 *
 * Same address: nothing to do, the cookie is already right. A DIFFERENT one
 * means this booking belongs to someone else, and checkout's session is
 * booking-scoped - it opens this booking and nothing else, which is exactly
 * what "signed out" looks like. So the display cookies go, and the header
 * tells the truth instead of naming an account the browser can no longer open.
 */
export function reconcileTravellerIdentity(bookedEmail: string): void {
    const current = getTravellerIdentity().email;
    if (!current) return;
    if (current.trim().toLowerCase() === bookedEmail.trim().toLowerCase()) {
        return;
    }
    clearTravelerBooking();
}

// ── The identity as a subscribable store ────────────────────────────────────
// Cookies fire no events, so anything rendering the traveller identity used to
// read it once in a mount effect and then go stale for the life of the tab: the
// account door wrote its cookie and called `router.refresh()`, which re-runs the
// SERVER tree but keeps mounted client components exactly as they are - so the
// navbar still showed the signed-out state until a full browser reload.
//
// Every writer above notifies this store instead, and consumers subscribe
// through `useTravellerIdentity`. Focus and visibility changes re-read too, so a
// tab that was signed out in another tab catches up when you come back to it.

/** Everything the chrome needs to know about who is signed in. */
export interface TravellerIdentity {
    /** The account-door email, else the looked-up booking's, else null. */
    email: string | null;
    /** The saved `/bookings` lookup, when that is how they signed in. */
    booking: TravelerBooking | null;
}

/** Signed out - also the server snapshot, since SSR has no cookies to read. */
export const EMPTY_TRAVELLER_IDENTITY: TravellerIdentity = Object.freeze({
    email: null,
    booking: null,
});

const identityListeners = new Set<() => void>();

/** The raw cookie pair the cached snapshot was built from. */
let identityKey: string | null = null;
let identitySnapshot: TravellerIdentity = EMPTY_TRAVELLER_IDENTITY;

function rawCookie(name: string): string {
    return (
        document.cookie
            .split('; ')
            .find(c => c.startsWith(`${name}=`))
            ?.slice(name.length + 1) ?? ''
    );
}

/**
 * The current identity, as a REFERENTIALLY STABLE value.
 *
 * `useSyncExternalStore` re-renders whenever `getSnapshot` returns a new
 * reference, so parsing the cookies afresh on every call would loop forever.
 * The cheap raw-cookie string is the cache key; the parse only re-runs when the
 * cookies genuinely changed.
 */
export function getTravellerIdentity(): TravellerIdentity {
    const key = `${rawCookie(TRAVELLER_ACCOUNT_COOKIE)}|${rawCookie(TRAVELER_BOOKING_COOKIE)}`;
    if (key === identityKey) return identitySnapshot;
    identityKey = key;
    const booking = readTravelerBooking();
    identitySnapshot = {
        email: readTravellerAccount() ?? booking?.email ?? null,
        booking,
    };
    return identitySnapshot;
}

/** The SSR/hydration snapshot - always signed out, never a new reference. */
export function getServerTravellerIdentity(): TravellerIdentity {
    return EMPTY_TRAVELLER_IDENTITY;
}

/** Re-read the cookies and tell every subscriber. */
export function emitTravellerIdentityChange(): void {
    // Force the next getSnapshot to re-parse rather than trust its cache.
    identityKey = null;
    for (const listener of identityListeners) listener();
}

/** Subscribe to identity changes. Returns the unsubscribe. */
export function subscribeTravellerIdentity(onChange: () => void): () => void {
    identityListeners.add(onChange);
    if (identityListeners.size === 1) {
        window.addEventListener('focus', emitTravellerIdentityChange);
        document.addEventListener(
            'visibilitychange',
            emitTravellerIdentityChange,
        );
    }
    return () => {
        identityListeners.delete(onChange);
        if (identityListeners.size === 0) {
            window.removeEventListener('focus', emitTravellerIdentityChange);
            document.removeEventListener(
                'visibilitychange',
                emitTravellerIdentityChange,
            );
        }
    };
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
 *
 * `forEmail` is the contact email the token was minted for. Checkout passes
 * it so the route can refuse a DOWNGRADE: its token is booking-scoped (it
 * unlocks one booking), and overwriting an email-scoped session with it used
 * to sign the traveller out of their whole account the moment they booked
 * (test report 2026-08-01 §Traveler.4). See the route handler for the rule.
 */
export async function storeTravelerSession(
    token: string,
    forEmail?: string,
): Promise<void> {
    try {
        await fetch('/api/traveler-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(forEmail ? { token, forEmail } : { token }),
        });
    } catch {
        // Non-fatal: the TYP just renders masked with a "verify it's you"
        // card, which resolves through /bookings.
    }
}
