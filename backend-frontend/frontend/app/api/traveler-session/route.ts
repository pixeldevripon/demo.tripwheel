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
        if (token) revalidateTag(travellerCacheTag(token), { expire: 0 });
    }
}

/**
 * The token's own claims, DECODED not verified - this route has no secret.
 * Safe here because the only decision it feeds is "keep the cookie the browser
 * already has", which can never grant more than the browser already had. The
 * backend re-verifies the signature on every single use.
 */
function claims(
    token: string | null,
): { email: string | null; bookingScoped: boolean; live: boolean } | null {
    if (!token) return null;
    try {
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
        ) as { e?: unknown; b?: unknown; exp?: unknown };
        return {
            email:
                typeof payload.e === 'string' && payload.e
                    ? payload.e.toLowerCase()
                    : null,
            bookingScoped: typeof payload.b === 'string' && !!payload.b,
            live: typeof payload.exp === 'number' && payload.exp > Date.now(),
        };
    } catch {
        return null;
    }
}

/**
 * NEVER DOWNGRADE (test report 2026-08-01 §Traveler.4).
 *
 * Checkout's contact step mints a BOOKING-scoped token: it proves "I authored
 * this booking" and unlocks exactly that booking. A traveller who was already
 * signed in holds an EMAIL- or HISTORY-scoped token, which unlocks every
 * booking on their address - and, for HISTORY, the account area itself.
 *
 * Storing the narrower token over the wider one is what made booking a second
 * trip log the traveller out: `/traveller` demands a HISTORY-scoped session,
 * so it 401'd the moment checkout finished, while the TYP still worked (its
 * booking-scoped token covers that one booking) and the navbar still showed the
 * old email. The three surfaces disagreed because the credential had silently
 * narrowed underneath them.
 *
 * So keep the existing session when it is email-scoped, still live, and bound
 * to the SAME address the new booking was made under - because it already owns
 * that booking, and more besides. A different address is a genuinely different
 * traveller, and the new token wins.
 */
function keepsExisting(
    existing: string | null,
    incoming: string,
    forEmail: string | null,
): boolean {
    if (!forEmail) return false;
    const now = claims(incoming);
    if (!now?.bookingScoped) return false;
    const had = claims(existing);
    return !!had?.live && had.email === forEmail.toLowerCase();
}

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }
    let token: unknown;
    let forEmail: unknown;
    try {
        ({ token, forEmail } = (await req.json()) as {
            token?: unknown;
            forEmail?: unknown;
        });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (forEmail !== undefined && typeof forEmail !== 'string') {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const existing = await getTravelerSessionToken();
    if (keepsExisting(existing, token, (forEmail as string) ?? null)) {
        // The kept session's cached account reads still have to be busted:
        // the traveller just made a booking that must appear on their account
        // page immediately, not after the cache window.
        bustTraveller(existing);
        return NextResponse.json({ ok: true, kept: true });
    }

    bustTraveller(existing, token);

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
