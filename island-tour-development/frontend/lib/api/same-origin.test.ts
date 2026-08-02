import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { isSameOrigin } from './same-origin';

/**
 * The CSRF guard in front of every state-changing Route Handler. Its whole job
 * is to answer one question correctly, so every branch is exercised here -
 * including the two deliberate ALLOW branches, which are the ones a future
 * "tightening" is most likely to break without understanding why they exist.
 */

function request(
    headers: Record<string, string>,
    url = 'https://islandtours.test/api/traveler-session',
): NextRequest {
    return new NextRequest(new Request(url, { method: 'POST', headers }));
}

describe('isSameOrigin', () => {
    describe('Sec-Fetch-Site (the modern path)', () => {
        it('allows a same-origin fetch', () => {
            expect(isSameOrigin(request({ 'sec-fetch-site': 'same-origin' }))).toBe(
                true,
            );
        });

        it('allows a user-typed navigation (`none`)', () => {
            expect(isSameOrigin(request({ 'sec-fetch-site': 'none' }))).toBe(true);
        });

        it('rejects a cross-site post - the CSRF case', () => {
            expect(isSameOrigin(request({ 'sec-fetch-site': 'cross-site' }))).toBe(
                false,
            );
        });

        it('rejects a same-SITE but cross-ORIGIN post (a sibling subdomain)', () => {
            expect(isSameOrigin(request({ 'sec-fetch-site': 'same-site' }))).toBe(
                false,
            );
        });

        it('wins over a spoofable Origin header when both are present', () => {
            // Origin says friendly, Sec-Fetch-Site says otherwise. The browser
            // controls both, but only Sec-Fetch-Site is forbidden to scripts.
            expect(
                isSameOrigin(
                    request({
                        'sec-fetch-site': 'cross-site',
                        origin: 'https://islandtours.test',
                    }),
                ),
            ).toBe(false);
        });
    });

    describe('Origin fallback (older browsers)', () => {
        it('allows a matching host', () => {
            expect(
                isSameOrigin(request({ origin: 'https://islandtours.test' })),
            ).toBe(true);
        });

        it('rejects an attacker origin', () => {
            expect(isSameOrigin(request({ origin: 'https://evil.test' }))).toBe(
                false,
            );
        });

        it('rejects a lookalike host that merely shares a prefix', () => {
            expect(
                isSameOrigin(request({ origin: 'https://islandtours.test.evil.test' })),
            ).toBe(false);
        });

        it('compares host including port, so a different port is cross-origin', () => {
            expect(
                isSameOrigin(
                    request(
                        { origin: 'https://islandtours.test:8443' },
                        'https://islandtours.test/api/x',
                    ),
                ),
            ).toBe(false);
        });

        it('rejects an unparseable Origin rather than throwing', () => {
            expect(isSameOrigin(request({ origin: 'not a url' }))).toBe(false);
        });

        it('rejects the literal `null` origin (sandboxed iframe / opaque origin)', () => {
            // `new URL('null')` throws, so this lands in the catch. Worth
            // pinning: an opaque origin is exactly what a sandboxed attacker
            // frame sends, and it must not be mistaken for "no origin".
            expect(isSameOrigin(request({ origin: 'null' }))).toBe(false);
        });
    });

    describe('neither header (non-browser clients)', () => {
        it('allows the request', () => {
            // DELIBERATE. curl/Postman can already set their own cookies, so
            // there is no session to forge on their behalf - the guard defends
            // against a BROWSER being driven by another site, and every browser
            // that can be so driven sends at least one of the two headers.
            expect(isSameOrigin(request({}))).toBe(true);
        });
    });
});
