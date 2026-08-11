import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The traveler-session route is the only place this app writes the credential
 * that unlocks other people's bookings. It never verifies the token (it has no
 * secret - the backend is the sole verifier), so what IS testable here is
 * exactly what matters: the CSRF gate, the shape gate, the never-downgrade
 * rule, and the cache busting that has to happen on every hand-off.
 */

// `server-only` throws outside an RSC graph; the module under test reaches it
// through `lib/traveler-session.server`.

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({
    revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

vi.mock('@/lib/api/public/traveller', () => ({
    travellerCacheTag: (token: string) => `traveller:${token}`,
}));

const getTravelerSessionToken = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/traveler-session.server', () => ({
    getTravelerSessionToken: () => getTravelerSessionToken(),
    TRAVELER_SESSION_COOKIE: 'it.travelerSession',
    TRAVELER_SESSION_MAX_AGE: 24 * 60 * 60,
}));

const { DELETE, POST } = await import('./route');

const COOKIE = 'it.travelerSession';
const HOUR = 60 * 60 * 1000;

/** Build a structurally valid token. The signature is never checked here. */
function token(
    payload: Record<string, unknown>,
    signature = 'c2lnbmF0dXJl',
): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `v1.${body}.${signature}`;
}

const emailToken = (email: string, offsetMs = HOUR) =>
    token({ e: email, exp: Date.now() + offsetMs });
const historyToken = (email: string, offsetMs = HOUR) =>
    token({ e: email, h: 1, exp: Date.now() + offsetMs });
const bookingToken = (id = 'bk_123', offsetMs = HOUR) =>
    token({ b: id, exp: Date.now() + offsetMs });

function post(
    body: unknown,
    headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
): NextRequest {
    return new NextRequest(
        new Request('https://islandtours.test/api/traveler-session', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
    );
}

beforeEach(() => {
    revalidateTag.mockClear();
    getTravelerSessionToken.mockReset();
    getTravelerSessionToken.mockResolvedValue(null);
});

describe('POST /api/traveler-session', () => {
    describe('CSRF gate', () => {
        it('rejects a cross-site post before reading the body', async () => {
            const res = await POST(
                post({ token: emailToken('ada@example.com') }, {
                    'sec-fetch-site': 'cross-site',
                }),
            );

            expect(res.status).toBe(403);
            // The important half: nothing was written and no cache was touched.
            expect(res.cookies.get(COOKIE)).toBeUndefined();
            expect(revalidateTag).not.toHaveBeenCalled();
        });

        it('accepts a same-origin post', async () => {
            const res = await POST(post({ token: emailToken('ada@example.com') }));
            expect(res.status).toBe(200);
        });
    });

    describe('input validation', () => {
        it('rejects a body that is not JSON', async () => {
            expect((await POST(post('not json'))).status).toBe(400);
        });

        it('rejects a missing token', async () => {
            expect((await POST(post({}))).status).toBe(400);
        });

        it('rejects a non-string token', async () => {
            expect((await POST(post({ token: 42 }))).status).toBe(400);
        });

        it.each([
            ['wrong version prefix', 'v2.abc.def'],
            ['too few segments', 'v1.abc'],
            ['too many segments', 'v1.abc.def.ghi'],
            ['non-base64url payload', 'v1.a+b/c.def'],
            ['empty payload', 'v1..def'],
            ['empty signature', 'v1.abc.'],
            ['empty string', ''],
        ])('rejects a token with a %s', async (_label, value) => {
            const res = await POST(post({ token: value }));
            expect(res.status).toBe(400);
            expect(res.cookies.get(COOKIE)).toBeUndefined();
        });

        it('rejects an oversized payload rather than storing it', async () => {
            const res = await POST(post({ token: `v1.${'a'.repeat(513)}.sig` }));
            expect(res.status).toBe(400);
        });

        it('rejects a non-string forEmail', async () => {
            expect(
                (await POST(post({ token: bookingToken(), forEmail: 42 }))).status,
            ).toBe(400);
        });

        it('accepts an absent forEmail', async () => {
            expect(
                (await POST(post({ token: emailToken('ada@example.com') }))).status,
            ).toBe(200);
        });
    });

    describe('storing a session', () => {
        it('writes the token into a hardened HttpOnly cookie', async () => {
            const value = emailToken('ada@example.com');
            const res = await POST(post({ token: value }));

            const cookie = res.cookies.get(COOKIE);
            expect(cookie?.value).toBe(value);
            expect(cookie?.httpOnly).toBe(true);
            expect(cookie?.sameSite).toBe('lax');
            expect(cookie?.path).toBe('/');
            expect(cookie?.maxAge).toBe(24 * 60 * 60);
        });

        it('busts the cached account reads for BOTH the old and new token', async () => {
            // Otherwise a brand-new booking shows up only after the cache
            // window, and the outgoing session's entries linger.
            const previous = emailToken('old@example.com');
            const incoming = historyToken('ada@example.com');
            getTravelerSessionToken.mockResolvedValue(previous);

            await POST(post({ token: incoming }));

            expect(revalidateTag).toHaveBeenCalledWith(`traveller:${previous}`, {
                expire: 0,
            });
            expect(revalidateTag).toHaveBeenCalledWith(`traveller:${incoming}`, {
                expire: 0,
            });
        });

        it('busts only the incoming token when there was no session', async () => {
            const incoming = emailToken('ada@example.com');
            await POST(post({ token: incoming }));

            expect(revalidateTag).toHaveBeenCalledTimes(1);
            expect(revalidateTag).toHaveBeenCalledWith(`traveller:${incoming}`, {
                expire: 0,
            });
        });

        it('stores a token whose payload is undecodable, since it authorizes nothing', async () => {
            // Shape-valid but not JSON. The backend will reject it on use; the
            // page just renders masked. Refusing it here would buy nothing.
            const opaque = `v1.${Buffer.from('not json').toString('base64url')}.sig`;
            const res = await POST(post({ token: opaque }));

            expect(res.status).toBe(200);
            expect(res.cookies.get(COOKIE)?.value).toBe(opaque);
        });
    });

    describe('never downgrade (test report 2026-08-01 §Traveler.4)', () => {
        it('keeps a live email-scoped session when checkout mints a booking token for the same address', async () => {
            // The regression this guards: booking a second trip used to replace
            // the wide session with a narrow one, so `/traveller` 401'd while
            // the TYP still worked and the navbar still showed the old email.
            const existing = historyToken('ada@example.com');
            getTravelerSessionToken.mockResolvedValue(existing);

            const res = await POST(
                post({ token: bookingToken(), forEmail: 'ada@example.com' }),
            );

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ ok: true, kept: true });
            expect(res.cookies.get(COOKIE)).toBeUndefined();
        });

        it('still busts the kept session cache, so the new booking appears at once', async () => {
            const existing = historyToken('ada@example.com');
            getTravelerSessionToken.mockResolvedValue(existing);

            await POST(post({ token: bookingToken(), forEmail: 'ada@example.com' }));

            expect(revalidateTag).toHaveBeenCalledWith(`traveller:${existing}`, {
                expire: 0,
            });
        });

        it('matches the address case-insensitively', async () => {
            getTravelerSessionToken.mockResolvedValue(historyToken('ada@example.com'));

            const res = await POST(
                post({ token: bookingToken(), forEmail: 'Ada@Example.COM' }),
            );

            expect(await res.json()).toMatchObject({ kept: true });
        });

        it('takes the new token when the booking is for a DIFFERENT address', async () => {
            // A different address is a genuinely different traveller; keeping
            // the old session would show them someone else's bookings.
            getTravelerSessionToken.mockResolvedValue(historyToken('ada@example.com'));
            const incoming = bookingToken();

            const res = await POST(
                post({ token: incoming, forEmail: 'grace@example.com' }),
            );

            expect(res.cookies.get(COOKIE)?.value).toBe(incoming);
        });

        it('takes the new token when the existing session has expired', async () => {
            getTravelerSessionToken.mockResolvedValue(
                historyToken('ada@example.com', -HOUR),
            );
            const incoming = bookingToken();

            const res = await POST(
                post({ token: incoming, forEmail: 'ada@example.com' }),
            );

            expect(res.cookies.get(COOKIE)?.value).toBe(incoming);
        });

        it('treats `exp` as MILLISECONDS, matching the backend', async () => {
            // The backend issues `exp = Date.now() + TTL_MS`. A token whose exp
            // is a plausible SECONDS value is long past by ms reckoning, so it
            // must not count as live. If this ever flips, the never-downgrade
            // rule silently stops firing and the logout regression returns.
            getTravelerSessionToken.mockResolvedValue(
                token({ e: 'ada@example.com', exp: Math.floor(Date.now() / 1000) }),
            );
            const incoming = bookingToken();

            const res = await POST(
                post({ token: incoming, forEmail: 'ada@example.com' }),
            );

            expect(res.cookies.get(COOKIE)?.value).toBe(incoming);
        });

        it('does not keep the old session when there is no forEmail to compare', async () => {
            getTravelerSessionToken.mockResolvedValue(historyToken('ada@example.com'));
            const incoming = bookingToken();

            const res = await POST(post({ token: incoming }));

            expect(res.cookies.get(COOKIE)?.value).toBe(incoming);
        });

        it('always takes an incoming EMAIL-scoped token, even over a live session', async () => {
            // The keep rule is only for the NARROWER booking token. A fresh
            // pair-login or OTP is a deliberate sign-in and must take effect.
            getTravelerSessionToken.mockResolvedValue(historyToken('ada@example.com'));
            const incoming = emailToken('ada@example.com');

            const res = await POST(
                post({ token: incoming, forEmail: 'ada@example.com' }),
            );

            expect(res.cookies.get(COOKIE)?.value).toBe(incoming);
        });
    });
});

describe('DELETE /api/traveler-session (sign-out)', () => {
    it('rejects a cross-site call - forced logout is a real nuisance attack', async () => {
        const req = new NextRequest(
            new Request('https://islandtours.test/api/traveler-session', {
                method: 'DELETE',
                headers: { 'sec-fetch-site': 'cross-site' },
            }),
        );

        const res = await DELETE(req);

        expect(res.status).toBe(403);
        expect(res.cookies.get(COOKIE)).toBeUndefined();
    });

    it('expires the cookie with the same flags it was written with', async () => {
        getTravelerSessionToken.mockResolvedValue(historyToken('ada@example.com'));
        const req = new NextRequest(
            new Request('https://islandtours.test/api/traveler-session', {
                method: 'DELETE',
                headers: { 'sec-fetch-site': 'same-origin' },
            }),
        );

        const res = await DELETE(req);
        const cookie = res.cookies.get(COOKIE);

        // A mismatched flag set leaves the original cookie in place and the
        // traveller signed in after clicking sign out.
        expect(cookie?.value).toBe('');
        expect(cookie?.maxAge).toBe(0);
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.sameSite).toBe('lax');
        expect(cookie?.path).toBe('/');
    });

    it('busts the departing session\'s cached account reads', async () => {
        const existing = historyToken('ada@example.com');
        getTravelerSessionToken.mockResolvedValue(existing);
        const req = new NextRequest(
            new Request('https://islandtours.test/api/traveler-session', {
                method: 'DELETE',
                headers: { 'sec-fetch-site': 'same-origin' },
            }),
        );

        await DELETE(req);

        expect(revalidateTag).toHaveBeenCalledWith(`traveller:${existing}`, {
            expire: 0,
        });
    });

    it('is a no-op cache-wise when there was no session to drop', async () => {
        const req = new NextRequest(
            new Request('https://islandtours.test/api/traveler-session', {
                method: 'DELETE',
                headers: { 'sec-fetch-site': 'same-origin' },
            }),
        );

        await DELETE(req);

        expect(revalidateTag).not.toHaveBeenCalled();
    });
});
