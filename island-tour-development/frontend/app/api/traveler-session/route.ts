import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/api/same-origin';
import { travellerCacheTag } from '@/lib/api/public/traveller';
import {
    getTravelerSessionToken,
    TRAVELER_SESSION_COOKIE,
    TRAVELER_SESSION_MAX_AGE,
} from '@/lib/traveler-session.server';

/**
 * Moves the backend-issued traveler session token (from a successful
 * /bookings lookup or checkout's contact step) into a first-party HttpOnly
 * cookie, so browser JS never holds it long-term and Server Components can
 * replay it on the TYP fetch.
 *
 * This handler does NOT verify the token - it has no secret. The backend is
 * the only verifier: a garbage value stored here just renders the TYP masked.
 * Same-origin browser calls only; no CORS handling on purpose.
 *
 * CACHE CONTRACT: the traveller account reads are cached per session token
 * (`lib/api/public/traveller.ts`). This route fires at every moment the
 * session CHANGES HANDS - a fresh login, checkout minting a new booking's
 * token, sign-out - so it busts the cached account reads for BOTH the token
 * being replaced and the one being stored. That is what makes a brand-new
 * booking (and its payment) show up on the account page immediately instead
 * of after the cache window.
 */

/** Tokens are `v1.<payload>.<sig>` and small; reject anything else early. */
const TOKEN_SHAPE = /^v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,128}$/;

/** Bust the cached account reads for every token involved in a change. */
function bustTraveller(...tokens: Array<string | null>) {
    for (const token of tokens) {
        if (token) revalidateTag(travellerCacheTag(token));
    }
}

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }
    let token: unknown;
    try {
        ({ token } = (await req.json()) as { token?: unknown });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    bustTraveller(await getTravelerSessionToken(), token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
        name: TRAVELER_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: TRAVELER_SESSION_MAX_AGE,
    });
    return res;
}

/** Sign-out: drop the session cookie (and its cached account reads). */
export async function DELETE(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }
    bustTraveller(await getTravelerSessionToken());
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
        name: TRAVELER_SESSION_COOKIE,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return res;
}
