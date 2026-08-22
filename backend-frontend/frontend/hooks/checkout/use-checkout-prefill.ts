'use client';

import { useEffect, useState } from 'react';

import { getTravellerIdentity } from '@/lib/traveler-booking';

/**
 * What checkout knows about the signed-in traveller (test report 2026-08-01
 * §Traveler.1 + §Traveler.4).
 *
 * Two jobs in one fetch:
 *
 *  - PREFILL. A returning traveller should not retype the name and phone we
 *    already have on their last booking.
 *  - IDENTITY. When `email` is set the traveller is signed in with a proven
 *    (HISTORY-scoped) session, and checkout LOCKS the email field to it, so
 *    the booking lands on their account instead of silently minting a second
 *    one under a typo'd address.
 *
 * The HttpOnly session is unreadable here, so the actual proof comes from the
 * server: `/api/traveller/contact` replays the cookie to the backend. The
 * client-readable identity cookie is used only to SKIP that round trip for a
 * traveller who is obviously signed out - it authorizes nothing on its own.
 */
export interface CheckoutPrefill {
    /** The proven session email. Null while loading, or when signed out. */
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    /** E.164 as stored; the form splits the dial code back out. */
    phone: string | null;
    /** ISO-2 country stored with the number. */
    country: string | null;
    /** False until the lookup settles - the form waits before locking email. */
    resolved: boolean;
}

const SIGNED_OUT: CheckoutPrefill = {
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    country: null,
    resolved: true,
};

const LOADING: CheckoutPrefill = { ...SIGNED_OUT, resolved: false };

interface ContactResponse {
    hasHistory?: unknown;
    email?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    country?: unknown;
}

const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * Fetches the prefill once per mount. Any failure - signed out (401), a weaker
 * pair-login token, backend down - resolves to SIGNED_OUT: checkout must stay
 * fully usable for a guest, so this can never surface an error.
 *
 * `reloadKey` re-runs the lookup; the form bumps it after "Use a different
 * email" signs the traveller out, so the lock lifts without a page reload.
 */
export function useCheckoutPrefill(reloadKey = 0): CheckoutPrefill {
    const [state, setState] = useState<CheckoutPrefill>(LOADING);

    useEffect(() => {
        // No identity cookie means no session to replay - skip the round trip.
        // (The cookie is display-only; the server still re-proves everything.)
        if (!getTravellerIdentity().email) {
            setState(SIGNED_OUT);
            return;
        }
        let alive = true;
        setState(LOADING);
        void (async () => {
            try {
                const res = await fetch('/api/traveller/contact', {
                    cache: 'no-store',
                });
                if (!alive) return;
                if (!res.ok) {
                    setState(SIGNED_OUT);
                    return;
                }
                const body = (await res.json()) as ContactResponse;
                if (!alive) return;
                const email = str(body.email);
                setState(
                    email
                        ? {
                              email,
                              firstName: str(body.firstName),
                              lastName: str(body.lastName),
                              phone: str(body.phone),
                              country: str(body.country),
                              resolved: true,
                          }
                        : SIGNED_OUT
                );
            } catch {
                if (alive) setState(SIGNED_OUT);
            }
        })();
        return () => {
            alive = false;
        };
    }, [reloadKey]);

    return state;
}
