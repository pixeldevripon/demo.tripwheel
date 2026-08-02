import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { travellerCacheTag } from '@/lib/api/public/traveller';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import {
    DEPARTURE_ID_SHAPE,
    PUBLIC_REF_SHAPE,
    TRAVELER_SESSION_HEADER,
} from '@/lib/traveler-session.shared';
import { perVisitorThrottleHeaders } from '@/lib/api/visitor-throttle';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Self-service date change (review 10.4), forwarding the HttpOnly traveler
 * session server-side - same proxy pattern (and the same reasons) as the
 * cancellation request: the HISTORY token must never reach client JS, and a
 * user-triggered write must not ride the SSR internal-key throttle exemption.
 *
 * GET  ?ref={publicRef}          -> the switchable departures
 * POST {publicRef, departureId}  -> the atomic move
 *
 * The backend owns every decision: ownership, CONFIRMED-only, the free-window
 * judgement, capacity, and the per-booking flip-flop cap.
 *
 * THROTTLE KEYING DIFFERS BY VERB HERE, deliberately:
 *
 * - POST `/date-change` declares its own `@Throttle({ long: 10/hr })`, so
 *   `perVisitorThrottleHeaders()` cannot bypass it and only re-keys the bucket
 *   from our egress IP to the individual traveller. Without that, ten date
 *   changes per hour was the whole platform's allowance.
 * - GET `/date-change-options` has NO `@Throttle()` override, which means the
 *   internal key would make `skipIf` true and remove its rate limit outright.
 *   So the GET deliberately does not send those headers and keeps sharing the
 *   egress bucket. See `lib/api/visitor-throttle.ts`.
 */

export async function GET(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ options: [] }, { status: 403 });
    }
    const publicRef = req.nextUrl.searchParams.get('ref') ?? '';
    if (!PUBLIC_REF_SHAPE.test(publicRef)) {
        return NextResponse.json({ options: [] }, { status: 400 });
    }
    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ options: [] }, { status: 401 });
    }
    try {
        const res = await fetch(
            `${BACKEND_API_BASE}/bookings/typ/${encodeURIComponent(publicRef)}/date-change-options`,
            { headers: { [TRAVELER_SESSION_HEADER]: sessionToken } }
        );
        if (!res.ok) {
            return NextResponse.json({ options: [] }, { status: 400 });
        }
        return NextResponse.json(await res.json(), { status: 200 });
    } catch {
        return NextResponse.json({ options: [] }, { status: 502 });
    }
}

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    let publicRef: unknown;
    let departureId: unknown;
    try {
        ({ publicRef, departureId } = (await req.json()) as {
            publicRef?: unknown;
            departureId?: unknown;
        });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (
        typeof publicRef !== 'string' ||
        !PUBLIC_REF_SHAPE.test(publicRef) ||
        typeof departureId !== 'string' ||
        !DEPARTURE_ID_SHAPE.test(departureId)
    ) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    try {
        const res = await fetch(
            `${BACKEND_API_BASE}/bookings/typ/${encodeURIComponent(publicRef)}/date-change`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [TRAVELER_SESSION_HEADER]: sessionToken,
                    ...(await perVisitorThrottleHeaders()),
                },
                body: JSON.stringify({ departureId }),
            }
        );
        // Same contract as the cancellation proxy: bust this session's cached
        // account reads so the follow-up router.refresh() sees the new date.
        if (res.ok) revalidateTag(travellerCacheTag(sessionToken), { expire: 0 });
        return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
    } catch {
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}
