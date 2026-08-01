import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { travellerCacheTag } from '@/lib/api/public/traveller';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';

/**
 * Withdraws a pending cancellation request from the traveller account area,
 * forwarding the HttpOnly session server-side - the exact same proxy shape
 * (and reasons) as the cancellation-request route beside it: the HISTORY
 * session token must never be serialized into the page, and a user-triggered
 * write must not ride the internal key's throttle exemption. The backend owns
 * every decision; refusal here just means the state did not change.
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/** Booking public refs are uuid-shaped tokens; reject anything else early. */
const PUBLIC_REF_SHAPE = /^[A-Za-z0-9-]{1,64}$/;

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    let publicRef: unknown;
    try {
        ({ publicRef } = (await req.json()) as { publicRef?: unknown });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof publicRef !== 'string' || !PUBLIC_REF_SHAPE.test(publicRef)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sessionToken = await getTravelerSessionToken();
    if (!sessionToken) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    try {
        const res = await fetch(
            `${BASE_URL}/bookings/typ/${encodeURIComponent(publicRef)}/cancellation-request/withdraw`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [TRAVELER_SESSION_HEADER]: sessionToken,
                },
                body: JSON.stringify({}),
            }
        );
        // Bust this session's cached account reads BEFORE responding, so the
        // router.refresh() that follows sees the request gone, not a 30s-fresh
        // cache entry. (revalidateTag - updateTag throws in Route Handlers.)
        if (res.ok)
            revalidateTag(travellerCacheTag(sessionToken), { expire: 0 });
        return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
    } catch {
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}
