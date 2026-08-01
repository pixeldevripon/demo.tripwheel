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
 * `unknown` = the address has no bookings, so no code was sent - surfaced as
 * a validation message (founder 2026-07-30, deliberately trading the
 * anti-enumeration lock for honest UX; the endpoint's throttles bound
 * probing). The two 429 shapes are DELIBERATELY distinct:
 *
 * - `otp-pending`: the backend's per-EMAIL cap, thrown only AFTER the email
 *   passed the existence check - a code for this inbox is genuinely live, so
 *   advancing to the code screen is always correct.
 * - `throttled`: the generic per-IP guard, which fires before the handler
 *   ever checks the email. It proves nothing (unknown addresses hit it too),
 *   so the caller must stay on the email step. Collapsing these two into one
 *   value is the bug that let an address with no bookings "log in" to a code
 *   screen by clicking twice (or reloading and clicking again).
 */
export type RequestCodeResult =
    | 'sent'
    | 'unknown'
    | 'invalid'
    | 'otp-pending'
    | 'throttled';

export async function requestTravellerCodeClient(
    email: string
): Promise<RequestCodeResult> {
    try {
        const res = await fetch(`${BASE_URL}/bookings/traveller/request-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (res.status === 429) {
            try {
                const body = (await res.json()) as { reason?: string };
                if (body.reason === 'otp-pending') return 'otp-pending';
            } catch {
                // Bodyless 429 (proxy, guard) - treat as the generic form.
            }
            return 'throttled';
        }
        // The backend's @IsEmail() is the AUTHORITY on address validity - the
        // client-side shape check is only a typo-catcher and is deliberately
        // looser. Without this branch a shape-passing-but-invalid address
        // (e.g. `a@b..com`) fell through to the `sent` fallback and advanced
        // to a code screen that could never succeed.
        if (res.status === 400) return 'invalid';
        if (res.ok) {
            const body = (await res.json()) as { sent?: boolean };
            if (body.sent === false) return 'unknown';
        }
        return 'sent';
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
