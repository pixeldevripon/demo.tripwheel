import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A temporary diagnostic that, left switched on, would hand any caller the
 * process-wide error ring buffer - including request URLs, which on this site
 * ARE credentials (`/review/<writeToken>`, `/cancel/<publicRef>`,
 * `/traveller/receipt/<paymentId>`). Every gate below is load-bearing.
 */

const readServerErrors = vi.fn();
vi.mock('@/lib/debug/server-error-log', () => ({
    readServerErrors: (digest?: string) => readServerErrors(digest),
}));

const { GET } = await import('./route');

const ORIGIN = 'https://islandtours.test';

function get(
    query = '',
    headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
): NextRequest {
    return new NextRequest(
        new Request(`${ORIGIN}/api/debug/errors${query}`, { headers }),
    );
}

const ENTRY = {
    at: '2026-08-02T10:00:00.000Z',
    digest: 'abc123',
    name: 'Error',
    message: 'boom',
    path: '/en/review/tok_secret',
};

beforeEach(() => {
    readServerErrors.mockReset().mockReturnValue([ENTRY]);
    vi.stubEnv('NEXT_PUBLIC_ERROR_DEBUG', '1');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('GET /api/debug/errors', () => {
    describe('the feature flag', () => {
        it('answers 404 - indistinguishable from not existing - when unset', () => {
            vi.stubEnv('NEXT_PUBLIC_ERROR_DEBUG', '');
            expect(GET(get('?digest=abc123')).status).toBe(404);
        });

        it('answers 404 for any value other than exactly "1"', () => {
            vi.stubEnv('NEXT_PUBLIC_ERROR_DEBUG', 'true');
            expect(GET(get('?digest=abc123')).status).toBe(404);
        });

        it('never reads the buffer while the flag is off', () => {
            vi.stubEnv('NEXT_PUBLIC_ERROR_DEBUG', '0');
            GET(get('?digest=abc123'));
            expect(readServerErrors).not.toHaveBeenCalled();
        });
    });

    describe('same-origin gate', () => {
        it('rejects a cross-site read', () => {
            const res = GET(get('?digest=abc123', {
                'sec-fetch-site': 'cross-site',
            }));

            expect(res.status).toBe(403);
            expect(readServerErrors).not.toHaveBeenCalled();
        });

        it('rejects a foreign Origin', () => {
            expect(
                GET(get('?digest=abc123', { origin: 'https://evil.test' })).status,
            ).toBe(403);
        });
    });

    describe('the digest requirement', () => {
        it('refuses a bulk read', async () => {
            // REGRESSION. Without a digest `readServerErrors` returns the whole
            // buffer - the last 50 errors from EVERY visitor on this instance.
            // Polling it would harvest review write-tokens and booking refs out
            // of the recorded request paths.
            const res = GET(get());

            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: 'digest_required' });
            expect(readServerErrors).not.toHaveBeenCalled();
        });

        it('refuses an empty digest, which would read as "no digest" downstream', () => {
            expect(GET(get('?digest=')).status).toBe(400);
            expect(readServerErrors).not.toHaveBeenCalled();
        });
    });

    describe('the legitimate lookup', () => {
        it('returns the matching entries for a digest', async () => {
            const res = GET(get('?digest=abc123'));

            expect(res.status).toBe(200);
            expect(readServerErrors).toHaveBeenCalledWith('abc123');
            expect(await res.json()).toEqual({ matched: 1, entries: [ENTRY] });
        });

        it('reports a miss as a count rather than an empty success', () => {
            // A miss is meaningful: the request that threw may have been served
            // by a different instance than this lookup landed on.
            readServerErrors.mockReturnValue([]);
            expect(GET(get('?digest=nope')).status).toBe(200);
        });

        it('caps the response at ten entries', async () => {
            readServerErrors.mockReturnValue(
                Array.from({ length: 25 }, () => ENTRY),
            );

            const body = (await GET(get('?digest=abc123')).json()) as {
                matched: number;
                entries: unknown[];
            };

            expect(body.matched).toBe(25);
            expect(body.entries).toHaveLength(10);
        });

        it('is never cached', () => {
            expect(GET(get('?digest=abc123')).headers.get('cache-control')).toBe(
                'no-store',
            );
        });
    });
});
