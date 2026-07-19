import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
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
 */

/** Tokens are `v1.<payload>.<sig>` and small; reject anything else early. */
const TOKEN_SHAPE = /^v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,128}$/;

/**
 * CSRF guard. Route Handlers get no automatic CSRF protection (unlike Server
 * Actions), and a cross-site `text/plain` form-post can deliver a JSON-ish
 * body without a preflight - enough to plant a shape-valid token in a
 * victim's cookie jar or force a logout. Modern browsers always send
 * `Sec-Fetch-Site`; fall back to an Origin host check, and allow requests
 * with neither header (non-browser clients can already set their own cookies).
 */
function isSameOrigin(req: NextRequest): boolean {
    const site = req.headers.get('sec-fetch-site');
    if (site) return site === 'same-origin' || site === 'none';
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try {
        return new URL(origin).host === req.nextUrl.host;
    } catch {
        return false;
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

/** Sign-out: drop the session cookie. */
export async function DELETE(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }
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
