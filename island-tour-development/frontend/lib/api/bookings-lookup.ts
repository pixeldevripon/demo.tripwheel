/**
 * Client-side traveller booking lookup - backs the `/bookings` login surface
 * (browser, anonymous, NO auth cookie). Mirrors `lib/api/categories-public.ts`.
 *
 * MUST stay a browser call: the endpoint is strictly throttled per IP and the
 * SSR internal-key bypass would skip that limit.
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

export interface BookingLookupResult {
    publicRef: string;
    displayRef: string;
    destinationSlug: string | null;
    /**
     * Backend-issued 24h traveler session (email-bound HMAC). Hand it to
     * `storeTravelerSession` so the HttpOnly cookie unlocks the full TYP.
     */
    sessionToken: string;
}

/**
 * Verifies the email + booking-reference pair. Returns the TYP coordinates,
 * or `null` for any failure (mismatch, throttle, network) - the backend is
 * enumeration-proof, so there is no distinction worth surfacing.
 */
export async function lookupBookingClient(
    email: string,
    reference: string,
): Promise<BookingLookupResult | null> {
    try {
        const res = await fetch(`${BASE_URL}/bookings/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, reference }),
        });
        if (!res.ok) return null;
        return (await res.json()) as BookingLookupResult;
    } catch {
        return null;
    }
}

/**
 * "Lost your reference?" recovery. `sent: false` means the address has no
 * bookings and nothing was mailed - shown as a validation message, mirroring
 * the traveller OTP door (founder 2026-07-31, the honest UX over the
 * always-positive anti-enumeration ack; server throttles bound probing).
 * Throttle and network failures still ack positively: an earlier email may
 * genuinely be on its way, and a retry costs nothing.
 */
export async function recoverReferenceClient(
    email: string
): Promise<'sent' | 'unknown'> {
    try {
        const res = await fetch(`${BASE_URL}/bookings/lookup/recover-reference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (res.ok) {
            const body = (await res.json()) as { sent?: boolean };
            if (body.sent === false) return 'unknown';
        }
        return 'sent';
    } catch {
        return 'sent';
    }
}
