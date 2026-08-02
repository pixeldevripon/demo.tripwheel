import { describe, expect, it } from 'vitest';

import {
    filtersToTourQuery,
    PRICE_MAX,
    PRICE_MIN,
    type ToursFilterState,
} from './filters';

/**
 * The price half of the tours filter.
 *
 * `PRICE_MAX` (560) is a STATIC default; the real ceiling is per-destination
 * and arrives as `priceMax` from the facets. Every consumer that compares
 * against the wrong one of those two either over-filters silently or renders a
 * slider handle off its track — so the boundary is what these tests pin.
 */

const state = (price: [number, number]): ToursFilterState =>
    ({
        categories: [],
        sort: 'recommended',
        price,
        rating: null,
        durations: [],
        cancellation: null,
        pickup: false,
        date: null,
        guests: {},
        timeOfDay: [],
        attributes: {},
        page: 1,
    }) as unknown as ToursFilterState;

describe('filtersToTourQuery - price bounds', () => {
    it('omits both bounds at the full range', () => {
        const q = filtersToTourQuery(state([PRICE_MIN, PRICE_MAX]), PRICE_MAX);
        expect(q.minPrice).toBeUndefined();
        expect(q.maxPrice).toBeUndefined();
    });

    it('omits both bounds at a DESTINATION range wider than the static default', () => {
        // REGRESSION. The modal's "Clear all" reset to the static
        // [0, 560] while the destination's ceiling was 800. `560 < 800` is
        // true, so `maxPrice=560` was still sent - clearing the filters left
        // every tour over $560 hidden, and the toolbar badge still read 1.
        const q = filtersToTourQuery(state([PRICE_MIN, 800]), 800);
        expect(q.maxPrice).toBeUndefined();
    });

    it('still sends a genuine max below the destination ceiling', () => {
        expect(filtersToTourQuery(state([PRICE_MIN, 300]), 800).maxPrice).toBe(300);
    });

    it('sends a genuine min above zero', () => {
        expect(filtersToTourQuery(state([50, 800]), 800).minPrice).toBe(50);
    });

    it('sends both when the range is narrowed on both ends', () => {
        const q = filtersToTourQuery(state([50, 300]), 800);
        expect(q).toMatchObject({ minPrice: 50, maxPrice: 300 });
    });

    it('omits the max when the range exceeds the ceiling, never over-filtering', () => {
        // A stale URL can carry a max above the current ceiling; treating that
        // as an active filter would hide the most expensive tours.
        expect(filtersToTourQuery(state([PRICE_MIN, 900]), 800).maxPrice).toBeUndefined();
    });

    it('defaults the ceiling to the static PRICE_MAX when none is given', () => {
        expect(filtersToTourQuery(state([PRICE_MIN, PRICE_MAX])).maxPrice).toBeUndefined();
        expect(filtersToTourQuery(state([PRICE_MIN, 300])).maxPrice).toBe(300);
    });
});
