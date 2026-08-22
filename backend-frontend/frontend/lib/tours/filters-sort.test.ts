import { describe, expect, it } from 'vitest';

import {
    buildToursHref,
    DEFAULT_GUESTS,
    parseToursFilters,
    PRICE_MAX,
    PRICE_MIN,
    SEARCH_SORT_PROFILE,
    TOURS_SORT_PROFILE,
    type ToursFilterState,
} from './filters';

/**
 * The sort half of the tours filter, once `/search` started mounting the SAME
 * toolbar (Pastel #44) with a DIFFERENT default sort.
 *
 * Which value is the default is what decides whether `?sort=` appears in a URL
 * at all, so the two pages disagreeing about it is exactly where a shared
 * toolbar can silently produce a link that means something else on the other
 * page. These tests pin that boundary, plus the route-owned params (`q`,
 * `destination`) the toolbar has to carry but does not model.
 */

const state = (over: Partial<ToursFilterState> = {}): ToursFilterState => ({
    categories: [],
    sort: 'localsFavorites',
    price: [PRICE_MIN, PRICE_MAX],
    rating: null,
    durations: [],
    cancellation: null,
    pickup: false,
    date: null,
    guests: DEFAULT_GUESTS,
    timeOfDay: [],
    attributes: {},
    page: 1,
    ...over,
});

describe('sort profiles - the default is the value omitted from the URL', () => {
    it('drops the listing default, and the search default, from their own hrefs', () => {
        expect(buildToursHref('/en/curacao/tours', state())).toBe(
            '/en/curacao/tours'
        );
        expect(
            buildToursHref('/en/search', state({ sort: 'relevance' }), PRICE_MAX, {
                sortProfile: SEARCH_SORT_PROFILE,
            })
        ).toBe('/en/search');
    });

    it("writes Locals' favorites explicitly on search, where it is NOT the default", () => {
        // Omitting it there would parse back as `relevance` - the toolbar would
        // show the sort the traveler just left.
        expect(
            buildToursHref(
                '/en/search',
                state({ sort: 'localsFavorites' }),
                PRICE_MAX,
                { sortProfile: SEARCH_SORT_PROFILE }
            )
        ).toBe('/en/search?sort=recommended');
    });

    it('round-trips every sort a page offers', () => {
        for (const sort of SEARCH_SORT_PROFILE.options) {
            const href = buildToursHref('/en/search', state({ sort }), PRICE_MAX, {
                sortProfile: SEARCH_SORT_PROFILE,
            });
            const sp = Object.fromEntries(
                new URL(href, 'https://x').searchParams
            );
            expect(
                parseToursFilters(sp, PRICE_MAX, SEARCH_SORT_PROFILE).sort
            ).toBe(sort);
        }
    });

    it('falls back to the page default for a sort it does not offer', () => {
        // `?sort=relevance` hand-typed onto All Tours must not reach the listing
        // endpoint, which has no relevance to sort by and 400s on the value.
        expect(
            parseToursFilters({ sort: 'relevance' }, PRICE_MAX, TOURS_SORT_PROFILE)
                .sort
        ).toBe('localsFavorites');
        expect(parseToursFilters({ sort: 'nonsense' }).sort).toBe(
            'localsFavorites'
        );
        expect(
            parseToursFilters({}, PRICE_MAX, SEARCH_SORT_PROFILE).sort
        ).toBe('relevance');
    });
});

describe('route-owned params on the search page', () => {
    it('carries q and destination through a filter change', () => {
        const href = buildToursHref(
            '/en/search',
            state({ sort: 'relevance', date: '2026-09-01' }),
            PRICE_MAX,
            {
                sortProfile: SEARCH_SORT_PROFILE,
                extraParams: { q: 'catamaran', destination: 'curacao' },
            }
        );
        const sp = new URL(href, 'https://x').searchParams;
        expect(sp.get('q')).toBe('catamaran');
        expect(sp.get('destination')).toBe('curacao');
        expect(sp.get('date')).toBe('2026-09-01');
    });

    it('keeps the term when the date chip is cleared', () => {
        // Clearing the date rebuilds the whole query string; without
        // `extraParams` that navigates to a search with no term at all.
        const href = buildToursHref('/en/search', state({ date: null }), PRICE_MAX, {
            sortProfile: SEARCH_SORT_PROFILE,
            extraParams: { q: 'catamaran', destination: undefined },
        });
        const sp = new URL(href, 'https://x').searchParams;
        expect(sp.get('q')).toBe('catamaran');
        expect(sp.has('date')).toBe(false);
        expect(sp.has('destination')).toBe(false);
    });

    it('never mistakes q or destination for a dynamic attribute filter', () => {
        // Unreserved keys become `?key=v1,v2` attribute filters and are shipped
        // to the backend as such - the search term must not be one of them.
        const parsed = parseToursFilters({
            q: 'catamaran',
            destination: 'curacao',
            boat_type: 'catamaran,yacht',
        });
        expect(parsed.attributes).toEqual({ boat_type: ['catamaran', 'yacht'] });
    });
});
