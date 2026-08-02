import { describe, expect, it } from 'vitest';

import { bookingIdKey, UUID_SHAPE } from './checkout';

/**
 * The client idempotency key that stops a declined charge from claiming the
 * party's seats twice. Its two invariants are namespacing and shape-checking -
 * it comes back out of client-writable sessionStorage.
 */

describe('bookingIdKey', () => {
    it('namespaces per tour, so two tabs on two tours cannot collide', () => {
        expect(bookingIdKey('tour-a')).not.toBe(bookingIdKey('tour-b'));
    });

    it('shares the `it-` prefix of the other checkout storage keys', () => {
        expect(bookingIdKey('t1')).toBe('it-checkout-booking:t1');
    });
});

describe('UUID_SHAPE', () => {
    it('accepts what crypto.randomUUID actually produces', () => {
        for (let i = 0; i < 20; i++) {
            expect(UUID_SHAPE.test(crypto.randomUUID())).toBe(true);
        }
    });

    it('is case-insensitive', () => {
        const id = crypto.randomUUID();
        expect(UUID_SHAPE.test(id.toUpperCase())).toBe(true);
    });

    it.each([
        ['empty', ''],
        ['not a uuid', 'not-a-uuid'],
        ['a v1 uuid (wrong version nibble)', '9b1deb4d-3b7d-1bad-9bdd-2b0d7b3dcb6d'],
        ['a bad variant nibble', '9b1deb4d-3b7d-4bad-1bdd-2b0d7b3dcb6d'],
        ['truncated', '9b1deb4d-3b7d-4bad-9bdd'],
        ['trailing junk', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6dXX'],
        ['a path traversal attempt', '../../admin'],
    ])('rejects %s', (_label, value) => {
        // sessionStorage is client-writable: anything that fails this check is
        // discarded and a fresh key is minted, rather than posted to the API.
        expect(UUID_SHAPE.test(value)).toBe(false);
    });
});
