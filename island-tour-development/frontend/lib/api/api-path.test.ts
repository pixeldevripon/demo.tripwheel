import { describe, expect, it } from 'vitest';

import { BACKEND_API_BASE } from './backend-url';
import { assertBackendUrl, seg } from './api-path';

/**
 * Path-segment safety for backend URLs.
 *
 * Next decodes dynamic route params and does NOT strip dot segments, so
 * `GET /en/%2E%2E%2F%2E%2E%2Ftours` gives a page `params.destination ===
 * '../../tours'`. Interpolated raw, the WHATWG URL parser inside `fetch`
 * RESOLVES that - relocating a request that carries `x-internal-api-key` to an
 * endpoint the visitor chose.
 */

describe('seg', () => {
    it('encodes a slash, so a segment cannot become two', () => {
        expect(seg('../../tours')).toBe('..%2F..%2Ftours');
        expect(seg('a/b')).toBe('a%2Fb');
    });

    it('leaves an ordinary slug untouched', () => {
        expect(seg('klein-curacao-super-yacht')).toBe(
            'klein-curacao-super-yacht',
        );
    });

    it('encodes a query separator, so a segment cannot append params', () => {
        // The slug is interpolated BEFORE `buildQuery`, so an unencoded `?`
        // would let a visitor choose the backend query string too.
        expect(seg('x?q=expensive')).toBe('x%3Fq%3Dexpensive');
    });

    it('encodes an already-encoded traversal rather than decoding it', () => {
        expect(seg('%2E%2E%2F')).toBe('%252E%252E%252F');
    });

    it('accepts a number', () => {
        expect(seg(42)).toBe('42');
    });
});

describe('assertBackendUrl', () => {
    it('passes an ordinary path through, resolved', () => {
        expect(assertBackendUrl('/destinations/slug/curacao?locale=en')).toBe(
            `${BACKEND_API_BASE}/destinations/slug/curacao?locale=en`,
        );
    });

    it.each([
        ['climbs out of the API version prefix', '/destinations/slug/../../tours'],
        ['reaches the auth surface', '/tours/slug/../../../../api/auth/get-session'],
        ['climbs to the origin root', '/x/../../../../../../'],
    ])('throws when a path %s', (_label, path) => {
        // The whole point: this is the backstop for the NEXT path that forgets
        // to encode, because "remember to encode" already failed across ~15
        // call sites while `pages.ts` and the booking readers got it right.
        expect(() => assertBackendUrl(path)).toThrow();
    });

    it('rejects a dot segment even when it resolves back INSIDE the base', () => {
        // The weaker "does it still start with the base" check passes here -
        // and that is precisely the attack: `/destinations/slug/../../tours`
        // lands on `<base>/tours`, inside the base, having fetched a completely
        // different endpoint from the one the caller asked for. No legitimate
        // backend path contains a dot segment, so rejecting outright is free.
        expect(() => assertBackendUrl('/tours/../destinations/active')).toThrow(
            /dot segment/,
        );
    });

    it('rejects a path that would switch host entirely', () => {
        expect(() => assertBackendUrl('/../../evil.test/x')).toThrow();
    });

    describe('the two layers together', () => {
        it('an ENCODED traversal is inert, and stays inside the base', () => {
            const path = `/destinations/slug/${seg('../../tours')}?locale=en`;
            expect(assertBackendUrl(path)).toBe(
                `${BACKEND_API_BASE}/destinations/slug/..%2F..%2Ftours?locale=en`,
            );
        });

        it('the SAME value unencoded would have escaped - the regression', () => {
            expect(() =>
                assertBackendUrl('/destinations/slug/../../tours?locale=en'),
            ).toThrow();
        });
    });
});
