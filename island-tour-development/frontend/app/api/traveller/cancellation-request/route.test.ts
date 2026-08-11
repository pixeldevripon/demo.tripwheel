import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cancellation-request proxy: the pattern all four traveller write proxies
 * follow. It exists so the HISTORY-scoped session never reaches client JS, and
 * it is the one surface where a bug costs a traveller real money - missing the
 * free-cancellation deadline because the request silently failed.
 */


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
}));

const perVisitorThrottleHeaders = vi.fn<() => Promise<Record<string, string>>>();
vi.mock('@/lib/api/visitor-throttle', () => ({
    perVisitorThrottleHeaders: () => perVisitorThrottleHeaders(),
}));

const { POST } = await import('./route');

const SESSION = 'v1.payload.sig';

function post(
    body: unknown,
    headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
): NextRequest {
    return new NextRequest(
        new Request('https://islandtours.test/api/traveller/cancellation-request', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
    );
}

/** The last `fetch` call's [url, init]. */
function lastFetch() {
    const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    return mock.mock.calls[mock.mock.calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
    revalidateTag.mockClear();
    getTravelerSessionToken.mockReset().mockResolvedValue(SESSION);
    perVisitorThrottleHeaders.mockReset().mockResolvedValue({});
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );
});

describe('POST /api/traveller/cancellation-request', () => {
    describe('gates, in order', () => {
        it('rejects a cross-site post before reading the body or the session', async () => {
            const res = await POST(
                post({ publicRef: 'BK-1' }, { 'sec-fetch-site': 'cross-site' }),
            );

            expect(res.status).toBe(403);
            expect(getTravelerSessionToken).not.toHaveBeenCalled();
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('rejects a malformed body', async () => {
            expect((await POST(post('not json'))).status).toBe(400);
        });

        it('answers 401 when there is no session, without calling the backend', async () => {
            getTravelerSessionToken.mockResolvedValue(null);

            const res = await POST(post({ publicRef: 'BK-1' }));

            expect(res.status).toBe(401);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });
    });

    describe('input validation', () => {
        it.each([
            ['a missing ref', {}],
            ['a non-string ref', { publicRef: 42 }],
            ['a ref with a path separator', { publicRef: '../../admin' }],
            ['a ref with a slash', { publicRef: 'BK/1' }],
            ['a ref with a dot', { publicRef: 'BK.1' }],
            ['an empty ref', { publicRef: '' }],
            ['an over-long ref', { publicRef: 'A'.repeat(65) }],
            ['a non-string reason', { publicRef: 'BK-1', reason: 42 }],
        ])('rejects %s', async (_label, body) => {
            const res = await POST(post(body));

            expect(res.status).toBe(400);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('accepts a well-formed ref with no reason', async () => {
            expect((await POST(post({ publicRef: 'BK-12345' }))).status).toBe(200);
        });
    });

    describe('the forwarded request', () => {
        it('replays the session as a header, never in the body or URL', async () => {
            await POST(post({ publicRef: 'BK-1' }));
            const [url, init] = lastFetch();

            expect(
                (init.headers as Record<string, string>)['x-traveler-session'],
            ).toBe(SESSION);
            expect(url).not.toContain(SESSION);
            expect(String(init.body)).not.toContain(SESSION);
        });

        it('encodes the ref into the path', async () => {
            await POST(post({ publicRef: 'BK-12345' }));
            expect(lastFetch()[0]).toContain(
                '/bookings/typ/BK-12345/cancellation-request',
            );
        });

        it('trims the reason, and omits it entirely when blank', async () => {
            await POST(post({ publicRef: 'BK-1', reason: '  changed plans  ' }));
            expect(JSON.parse(String(lastFetch()[1].body))).toEqual({
                reason: 'changed plans',
            });

            await POST(post({ publicRef: 'BK-1', reason: '   ' }));
            expect(JSON.parse(String(lastFetch()[1].body))).toEqual({});
        });

        it('forwards the per-visitor throttle headers', async () => {
            // REGRESSION. Without these the backend tracks by THIS app's egress
            // IP, so the route's `@Throttle({ long: 10/hr })` became ten
            // cancellation requests per hour for the entire platform - one
            // looping traveller could hold it empty while everyone else's
            // request failed inside their free-cancellation window.
            perVisitorThrottleHeaders.mockResolvedValue({
                'x-internal-api-key': 'secret',
                'x-real-client-ip': '203.0.113.7',
            });

            await POST(post({ publicRef: 'BK-1' }));

            expect(lastFetch()[1].headers).toMatchObject({
                'x-internal-api-key': 'secret',
                'x-real-client-ip': '203.0.113.7',
            });
        });

        it('still works when the throttle headers are unavailable', async () => {
            perVisitorThrottleHeaders.mockResolvedValue({});
            expect((await POST(post({ publicRef: 'BK-1' }))).status).toBe(200);
        });
    });

    describe('the response', () => {
        it('busts this session\'s cached account reads on success', async () => {
            // Before responding, so the caller's `router.refresh()` sees the
            // pending-cancellation state and not a 30s-fresh cache entry.
            await POST(post({ publicRef: 'BK-1' }));

            expect(revalidateTag).toHaveBeenCalledWith(`traveller:${SESSION}`, {
                expire: 0,
            });
        });

        it('does NOT bust the cache when the backend refused', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(new Response('{}', { status: 409 })),
            );

            const res = await POST(post({ publicRef: 'BK-1' }));

            expect(res.status).toBe(400);
            expect(revalidateTag).not.toHaveBeenCalled();
        });

        it('relays no backend detail - the status is all the caller learns', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(JSON.stringify({ message: 'Booking abc not found' }), {
                        status: 404,
                    }),
                ),
            );

            const res = await POST(post({ publicRef: 'BK-1' }));

            // A 404-vs-409 distinction would tell an attacker whether a booking
            // exists; both collapse to a flat 400 with no message.
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ ok: false });
        });

        it('answers 502 when the backend is unreachable', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

            const res = await POST(post({ publicRef: 'BK-1' }));

            expect(res.status).toBe(502);
            expect(await res.json()).toEqual({ ok: false });
        });
    });
});
