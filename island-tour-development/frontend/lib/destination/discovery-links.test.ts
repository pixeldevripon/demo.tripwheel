import { describe, expect, it } from 'vitest';

import type { DestinationPopularLink } from '@/types/destination';
import { buildDiscoveryLinks } from './discovery-links';

/**
 * The island's discovery set.
 *
 * The point of this being one function is that TWO surfaces render it - the
 * hero search field's zero-state panel and the search recovery band's "Popular
 * searches" run - and the client's requirement is that they agree. So the tests
 * are about the CONTRACT both of them depend on: curation wins outright, and
 * the automatic order is fixed.
 */

const HUBS = [
    { name: 'Klein Curaçao', slug: 'klein-curacao', publishedTourCount: 12, heroImage: '/h.jpg' },
];
const CATEGORIES = [
    { name: 'Boat Tours & Cruises', slug: 'boat-tours', publishedTourCount: 15, heroImage: '/b.jpg' },
    { name: 'Snorkeling Tours', slug: 'snorkeling-tours', publishedTourCount: 9, heroImage: null },
];
const COLLECTIONS = [
    { name: 'Best Things to Do in Curaçao', slug: 'best-things-to-do', heroImage: '/c.jpg' },
];

const CURATED: DestinationPopularLink[] = [
    { name: 'Off-Road Tours', slug: 'off-road-tours', kind: 'category', tours: 4, image: null },
    { name: 'Day Trips', slug: 'day-trips', kind: 'category', tours: 9, image: null },
];

const sources = (curated: DestinationPopularLink[] = []) => ({
    curated,
    hubs: HUBS,
    categories: CATEGORIES,
    collections: COLLECTIONS,
});

const names = (links: { name: string }[]) => links.map(l => l.name);

describe('buildDiscoveryLinks — curation wins outright', () => {
    it('returns the curated list, in the admin’s order', () => {
        expect(names(buildDiscoveryLinks(sources(CURATED)))).toEqual([
            'Off-Road Tours',
            'Day Trips',
        ]);
    });

    it('does NOT append the automatic entries to it', () => {
        // Curation is an editorial claim; topping it up with whatever else the
        // island has would silently overrule the admin's choice of how many.
        expect(buildDiscoveryLinks(sources(CURATED))).toHaveLength(2);
    });

    it('carries each curated entry’s kind and count through unchanged', () => {
        const [first] = buildDiscoveryLinks(sources(CURATED));
        expect(first).toEqual({
            name: 'Off-Road Tours',
            slug: 'off-road-tours',
            kind: 'category',
            tours: 4,
            image: null,
        });
    });
});

describe('buildDiscoveryLinks — the automatic fallback', () => {
    it('is hubs, then activity types, then collections', () => {
        // An island's landmark is a better starting point than an activity
        // type; collections close it, being editorial rather than a place.
        expect(names(buildDiscoveryLinks(sources()))).toEqual([
            'Klein Curaçao',
            'Boat Tours & Cruises',
            'Snorkeling Tours',
            'Best Things to Do in Curaçao',
        ]);
    });

    it('gives collections a null count rather than 0', () => {
        // Membership is editorial. "0 tours" would be a claim; null prints
        // nothing.
        const collection = buildDiscoveryLinks(sources()).at(-1);
        expect(collection).toMatchObject({ kind: 'collection', tours: null });
    });

    it('keeps the live tour count on hubs and categories', () => {
        expect(buildDiscoveryLinks(sources())[0]).toMatchObject({
            kind: 'hub',
            tours: 12,
        });
    });

    it('returns an empty set when the island has nothing to offer', () => {
        expect(
            buildDiscoveryLinks({
                curated: [],
                hubs: [],
                categories: [],
                collections: [],
            }),
        ).toEqual([]);
    });
});
