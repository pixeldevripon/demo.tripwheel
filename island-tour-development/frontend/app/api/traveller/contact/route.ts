import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';

/**
 * Checkout prefill for a signed-in traveller: name, phone and country from
 * their most recent booking, plus the session email itself.
 *
 * WHY A PROXY. Same reason as the sibling routes here - the HISTORY-scoped
 * session is the strongest traveller credential and lives in an HttpOnly
 * cookie precisely so browser JS can never read it. The checkout form is a
 * client component, so it calls this same-origin route and the token is
 * replayed server-side. The backend is still the only verifier.
 *
 * Signed out (or a weaker pair-login / checkout token) answers 401, which the
 * form treats as "nothing to prefill" - never an error the traveller sees.
 *
 * Deliberately NOT via `lib/api/public/fetch`: those attach the internal API
 * key, which the backend treats as a trusted origin and exempts from rate
 * limiting. A user-triggered read has no business borrowing that.
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

export async function GET(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    try {
        const res = await fetch(`${BASE_URL}/bookings/traveller/contact`, {
            headers: { [TRAVELER_SESSION_HEADER]: sessionToken },
            // Per-traveller and per-session: never cached, at any layer.
            cache: 'no-store',
        });
        if (!res.ok) {
            return NextResponse.json({ ok: false }, { status: res.status });
        }
        // Echoed as-is: the payload is the caller's own contact block, and the
        // backend already scoped it to the session email.
        return NextResponse.json(await res.json(), {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch {
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}
