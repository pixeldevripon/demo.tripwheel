import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';

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
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

const TOKEN_SHAPE = /^[A-Za-z0-9-]{1,64}$/;

export async function GET(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ options: [] }, { status: 403 });
    }
    const publicRef = req.nextUrl.searchParams.get('ref') ?? '';
    if (!TOKEN_SHAPE.test(publicRef)) {
        return NextResponse.json({ options: [] }, { status: 400 });
    }
    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ options: [] }, { status: 401 });
    }
    try {
        const res = await fetch(
            `${BASE_URL}/bookings/typ/${encodeURIComponent(publicRef)}/date-change-options`,
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
        !TOKEN_SHAPE.test(publicRef) ||
        typeof departureId !== 'string' ||
        !TOKEN_SHAPE.test(departureId)
    ) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    try {
        const res = await fetch(
            `${BASE_URL}/bookings/typ/${encodeURIComponent(publicRef)}/date-change`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [TRAVELER_SESSION_HEADER]: sessionToken,
                },
                body: JSON.stringify({ departureId }),
            }
        );
        return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
    } catch {
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}
