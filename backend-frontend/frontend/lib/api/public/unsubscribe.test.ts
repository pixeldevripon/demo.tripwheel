import { afterEach, describe, expect, it, vi } from 'vitest';

// `server-only` resolves via the empty-module alias in `vitest.config.ts`.
import { getUnsubscribeInfo } from './unsubscribe';

/**
 * The token resolver's contract is small and load-bearing: 200 passes the
 * backend's shape through untouched, and EVERYTHING else - 404 (unknown), 400
 * (non-UUID), a down backend - collapses to `null`, because the page renders
 * one shared "no longer valid" state and must not become an oracle by
 * treating those cases differently.
 */

const INFO = {
    email: 'j***@example.com',
    audience: 'TRAVELLER',
    stream: 'MARKETING',
    optedOut: false,
};

function stubFetch(impl: (input: RequestInfo | URL) => Promise<Response>) {
    const spy = vi.fn(impl);
    vi.stubGlobal('fetch', spy);
    return spy;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getUnsubscribeInfo', () => {
    it('returns the backend payload on 200', async () => {
        stubFetch(async () => new Response(JSON.stringify(INFO), { status: 200 }));
        await expect(getUnsubscribeInfo('tok-1')).resolves.toEqual(INFO);
    });

    it('never caches - a stale "not yet opted out" would keep acting on old state', async () => {
        const spy = stubFetch(
            async () => new Response(JSON.stringify(INFO), { status: 200 }),
        );
        await getUnsubscribeInfo('tok-1');
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('/email/unsubscribe/tok-1'),
            expect.objectContaining({ cache: 'no-store' }),
        );
    });

    it('returns null on 404 (unknown token)', async () => {
        stubFetch(async () => new Response('{"statusCode":404}', { status: 404 }));
        await expect(getUnsubscribeInfo('unknown')).resolves.toBeNull();
    });

    it('returns null on 400 (malformed token) - same empty hands as 404', async () => {
        stubFetch(async () => new Response('{"statusCode":400}', { status: 400 }));
        await expect(getUnsubscribeInfo('not-a-uuid')).resolves.toBeNull();
    });

    it('returns null when the backend is unreachable', async () => {
        stubFetch(async () => {
            throw new Error('ECONNREFUSED');
        });
        await expect(getUnsubscribeInfo('tok-1')).resolves.toBeNull();
    });

    it('encodes the token as ONE path segment - a crafted token cannot relocate the request', async () => {
        const spy = stubFetch(
            async () => new Response('{"statusCode":404}', { status: 404 }),
        );
        await getUnsubscribeInfo('../../auth/session');
        const url = spy.mock.calls[0][0] as string;
        expect(url).toContain('/email/unsubscribe/..%2F..%2Fauth%2Fsession');
        expect(new URL(url).pathname).toContain('/email/unsubscribe/');
    });
});
