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
 * "Lost your reference?" recovery. The backend always acks `{ sent: true }`
 * (enumeration-proof), so callers show the same "if that email has bookings"
 * note no matter what - including on throttle or network failure.
 */
export async function recoverReferenceClient(email: string): Promise<void> {
    try {
        await fetch(`${BASE_URL}/bookings/lookup/recover-reference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
    } catch {
        // Deliberately swallowed - the UI response is identical either way.
    }
}
