import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { travellerCacheTag } from '@/lib/api/public/traveller';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import {
    PUBLIC_REF_SHAPE,
    TRAVELER_SESSION_HEADER,
} from '@/lib/traveler-session.shared';
import { perVisitorThrottleHeaders } from '@/lib/api/visitor-throttle';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Submits a cancellation request from the traveller account area, forwarding
 * the HttpOnly session server-side.
 *
 * WHY THIS PROXY EXISTS. The account area is unlocked by a HISTORY-scoped
 * session - the strongest traveller credential, good for 24h against every
 * booking on the email. Handing it to a client component to POST directly
 * would serialize it into the page payload, where any injected script could
 * read and exfiltrate it; that is exactly what the HttpOnly cookie is meant to
 * prevent. So the token never leaves the server: the browser calls this
 * same-origin route, and the route replays the cookie to the backend.
 *
 * The backend still owns every decision - ownership, eligibility, and the
 * per-booking rate cap. Nothing is cancelled here; the request goes to a
 * human, who confirms the outcome by email.
 *
 * NOTE: this deliberately does NOT use the `lib/api/public/fetch` helpers.
 * Those attach the internal API key AND nothing else, and on a route with no
 * `@Throttle()` of its own that key is a full rate-limit bypass - which a
 * user-triggered write has no business borrowing.
 *
 * It DOES send `perVisitorThrottleHeaders()`, which is the opposite thing.
 * This backend route declares `@Throttle({ short: 1/10s, medium: 3/min,
 * long: 10/hr })`, so `hasOwnThrottleOverride` keeps `skipIf` false and the
 * tight limit survives; the key only lets the backend track by the forwarded
 * visitor IP instead of our egress address. Without it, `req.ip` is this app's
 * single outbound address for every traveller on the platform, so "10 per hour"
 * meant ten cancellation requests per hour IN TOTAL - one looping traveller
 * could hold the bucket empty while everyone else's request failed inside their
 * free-cancellation window, seeing only a generic error. See
 * `lib/api/visitor-throttle.ts` for when this is and is not safe.
 */

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    let publicRef: unknown;
    let reason: unknown;
    try {
        ({ publicRef, reason } = (await req.json()) as {
            publicRef?: unknown;
            reason?: unknown;
        });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof publicRef !== 'string' || !PUBLIC_REF_SHAPE.test(publicRef)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (reason !== undefined && typeof reason !== 'string') {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    try {
        const res = await fetch(
            `${BACKEND_API_BASE}/bookings/typ/${encodeURIComponent(publicRef)}/cancellation-request`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [TRAVELER_SESSION_HEADER]: sessionToken,
                    ...(await perVisitorThrottleHeaders()),
                },
                body: JSON.stringify(
                    reason && reason.trim() ? { reason: reason.trim() } : {}
                ),
            }
        );
        // Bust this session's cached account reads BEFORE responding: the
        // caller follows success with router.refresh(), which must see the
        // pending-cancellation state, not a 30s-fresh cache entry.
        // (revalidateTag, not updateTag - updateTag throws in Route Handlers.)
        if (res.ok) revalidateTag(travellerCacheTag(sessionToken), { expire: 0 });
        // The backend's message is safe to relay (it explains WHY a request was
        // refused - already requested, departed, not confirmed) but the status
        // is what the caller branches on.
        return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
    } catch {
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}
