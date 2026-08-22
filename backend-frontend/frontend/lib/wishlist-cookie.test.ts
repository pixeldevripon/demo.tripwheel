import { describe, expect, it } from 'vitest';

import {
    MAX_SAVED_TOURS,
    readWishlistCookie,
    WISHLIST_COOKIE,
    type SavedTour,
} from './wishlist-cookie';

/**
 * The saved list lives in one cookie, and mck-17 added a price snapshot to it.
 * Two formats therefore exist in the wild at once: the bare id array every
 * existing shopper is carrying, and the v2 shape.
 *
 * Getting the reader wrong does not throw - it returns an empty list, which
 * reads as "you have saved nothing" to somebody who has saved twenty things.
 */
/** Wrap a raw cookie VALUE the way a browser presents it, with neighbours. */
const cookie = (value: string) =>
    `other=1; ${WISHLIST_COOKIE}=${encodeURIComponent(value)}; another=2`;

/** The v1 format: a JSON array of bare ids. */
const v1 = (ids: string[]) => cookie(JSON.stringify(ids));
/** The v2 format: `2!id!id~price~currency`. */
const v2 = (entries: string[]) => cookie(`2!${entries.join('!')}`);

describe('readWishlistCookie', () => {
    it('reads the v1 bare id array every existing shopper is carrying', () => {
        expect(readWishlistCookie(v1(['a', 'b']))).toEqual([
            { id: 'a' },
            { id: 'b' },
        ]);
    });

    it('reads v2 entries with their price snapshot', () => {
        expect(readWishlistCookie(v2(['a~140~USD', 'b']))).toEqual([
            { id: 'a', price: 140, currency: 'USD' },
            { id: 'b' },
        ]);
    });

    it('keeps order - the cookie is newest first and the page renders it that way', () => {
        expect(readWishlistCookie(v2(['c', 'a', 'b'])).map(t => t.id)).toEqual([
            'c',
            'a',
            'b',
        ]);
    });

    it('drops a half-written entry rather than the whole list', () => {
        expect(readWishlistCookie(v2(['a~140~USD', '', 'b'])).map(t => t.id)).toEqual(
            ['a', 'b']
        );
    });

    it('ignores a price with no currency - there is nothing to compare it to', () => {
        expect(readWishlistCookie(v2(['a~140']))).toEqual([{ id: 'a' }]);
        expect(readWishlistCookie(v2(['a~nonsense~USD']))).toEqual([{ id: 'a' }]);
    });

    it('returns an empty list for junk instead of throwing the page', () => {
        expect(readWishlistCookie(`${WISHLIST_COOKIE}=not-json`)).toEqual([]);
        expect(readWishlistCookie('unrelated=1')).toEqual([]);
        expect(readWishlistCookie(cookie('"a string"'))).toEqual([]);
        // A truncated percent escape - decodeURIComponent throws on it.
        expect(readWishlistCookie(`${WISHLIST_COOKIE}=%E0%A4%A`)).toEqual([]);
    });

    it("caps at the resolver's own limit", () => {
        const many = Array.from({ length: MAX_SAVED_TOURS + 20 }, (_, i) => `t${i}`);
        expect(readWishlistCookie(v2(many))).toHaveLength(MAX_SAVED_TOURS);
    });
});

describe('writeWishlistCookie', () => {
    it('round-trips through a real document.cookie', async () => {
        const jar = installCookieJar();
        const { writeWishlistCookie } = await import('./wishlist-cookie');

        const tours: SavedTour[] = [
            { id: 'a', price: 140, currency: 'USD' },
            { id: 'b' },
        ];
        writeWishlistCookie(tours);

        expect(readWishlistCookie(jar.value())).toEqual(tours);
        jar.restore();
    });

    it('sheds the OLDEST price snapshots to stay inside the cookie budget, never an id', async () => {
        const jar = installCookieJar();
        const { writeWishlistCookie } = await import('./wishlist-cookie');

        // 100 uuid-length ids with snapshots is well past 3KB, so something
        // has to give - and it must not be a saved tour.
        const tours: SavedTour[] = Array.from({ length: 100 }, (_, i) => ({
            id: `9f8e7d6c-5b4a-4938-8271-${String(i).padStart(12, '0')}`,
            price: 100 + i,
            currency: 'USD',
        }));
        writeWishlistCookie(tours);

        const read = readWishlistCookie(jar.value());
        expect(read).toHaveLength(100);
        expect(read.map(t => t.id)).toEqual(tours.map(t => t.id));
        // The newest kept its price; the oldest gave theirs up.
        expect(read[0].price).toBe(100);
        expect(read.at(-1)?.price).toBeUndefined();
        jar.restore();
    });
});

/**
 * jsdom's `document.cookie` accumulates rather than replaces, so a second write
 * in the same test file would be read back as the FIRST value. Swapping in a
 * single-slot jar keeps each case honest about what was actually persisted.
 */
function installCookieJar() {
    const original = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'cookie'
    );
    let stored = '';
    Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => stored,
        set: (value: string) => {
            stored = value.split(';')[0];
        },
    });
    return {
        value: () => stored,
        restore: () => {
            delete (document as unknown as Record<string, unknown>).cookie;
            if (original) Object.defineProperty(Document.prototype, 'cookie', original);
        },
    };
}
