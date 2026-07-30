/**
 * Client-side OTP login for the traveller account area (`/{locale}/traveller`).
 *
 * A deliberately STRONGER door than the `/bookings` pair lookup: that one
 * proves possession of a single (routinely forwarded) confirmation email,
 * which is the wrong credential for a person's whole booking and payment
 * history. Here the traveller proves live inbox ownership with a one-time
 * code, and the backend answers with a history-scoped session.
 *
 * MUST stay browser calls: both endpoints are throttled per IP, and the SSR
 * internal-key bypass would skip every one of those limits.
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/**
 * `sent` covers both "we mailed a code" and "that address has no bookings" -
 * the backend is enumeration-proof and never distinguishes the two, so the UI
 * must not either. `throttled` is surfaced only so the form can explain the
 * wait instead of looking broken.
 */
export type RequestCodeResult = 'sent' | 'throttled';

export async function requestTravellerCodeClient(
    email: string
): Promise<RequestCodeResult> {
    try {
        const res = await fetch(`${BASE_URL}/bookings/traveller/request-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        return res.status === 429 ? 'throttled' : 'sent';
    } catch {
        // Same ack on a network failure: the traveller's next step (check the
        // inbox) is identical, and a retry costs them nothing.
        return 'sent';
    }
}

/**
 * Redeem a code. Returns the history-scoped session token, or null for ANY
 * failure - wrong code, expired, already used, attempts exhausted, network.
 * The backend answers all of those with one generic 401 on purpose, so the
 * caller shows a single uniform message.
 */
export async function verifyTravellerCodeClient(
    email: string,
    code: string
): Promise<string | null> {
    try {
        const res = await fetch(`${BASE_URL}/bookings/traveller/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { sessionToken?: string };
        return body.sessionToken ?? null;
    } catch {
        return null;
    }
}

/**
 * Submit a cancellation request from the account area.
 *
 * Goes through our OWN route handler, not straight to the backend: that route
 * reads the HttpOnly session server-side, so the history token - which unlocks
 * the whole account for 24h - never has to be serialized into the page where a
 * script could read it. Nothing is cancelled on click; this opens a request our
 * team processes and confirms by email.
 */
export async function requestCancellationClient(
    publicRef: string,
    reason?: string
): Promise<boolean> {
    try {
        const res = await fetch('/api/traveller/cancellation-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicRef, reason }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** One switchable departure for the self-service date change (review 10.4). */
export interface DateChangeOption {
    departureId: string;
    date: string;
    startTime: string | null;
    seatsLeft: number;
}

/** The departures this booking can move to; [] on any refusal or outage. */
export async function getDateChangeOptionsClient(
    publicRef: string
): Promise<DateChangeOption[]> {
    try {
        const res = await fetch(
            `/api/traveller/date-change?ref=${encodeURIComponent(publicRef)}`
        );
        if (!res.ok) return [];
        const body = (await res.json()) as { options?: DateChangeOption[] };
        return Array.isArray(body.options) ? body.options : [];
    } catch {
        return [];
    }
}

/** Atomically move the booking; the backend owns every guard. */
export async function changeDateClient(
    publicRef: string,
    departureId: string
): Promise<boolean> {
    try {
        const res = await fetch('/api/traveller/date-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicRef, departureId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
