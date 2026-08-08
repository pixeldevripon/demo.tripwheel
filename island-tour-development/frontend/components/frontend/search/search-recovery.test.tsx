import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TourCardDict, TourListing } from '@/components/frontend/tour-card';
import type { DestinationPopularLink } from '@/types/destination';
import {
    SearchRecovery,
    THIN_RESULTS_MAX,
    type SearchRecoveryDict,
} from './search-recovery';

/**
 * The search recovery band (Pastel #46, mck-12).
 *
 * The band's whole reason to exist is that a traveller who found nothing has
 * somewhere to go, so these tests are mostly about what is OFFERED and what is
 * correctly WITHHELD - an option that leads back to the same empty page is
 * worse than no option at all.
 */

const DICT: SearchRecoveryDict = {
    noMatchesOnDate: 'No matches on this date',
    noMatches: 'No matches',
    tryOneOfThese: 'Try one of these',
    onlyMatches: 'Only {count} matches',
    onlyMatchesOne: 'Only 1 match',
    keepLooking: 'Keep looking',
    dropDate: 'Drop the date and {count} “{query}” tours come back.',
    clearFilters: 'Clear all filters',
    popularSearches: 'Popular searches',
    seeAllDestinationTours: 'See all {destination} tours',
    seeAllDestinationToursCount: 'See all {count} {destination} tours',
};

const CARD_DICT = {
    from: 'From',
    per: 'per person',
    freeCancellation: 'Free cancellation',
    reviews: 'reviews',
} as unknown as TourCardDict;

const POPULAR: DestinationPopularLink[] = [
    { name: 'Klein Curaçao', slug: 'klein-curacao', kind: 'hub', tours: 12, image: null },
    { name: 'Snorkeling', slug: 'snorkeling-tours', kind: 'category', tours: 9, image: null },
];

const FAVOURITE: TourListing = {
    id: 't1',
    href: '/en/curacao/catamaran',
    images: [],
    badge: null,
    title: 'Catamaran Day Trip',
    hub: null,
    duration: '8h',
    pickupAvailable: true,
    price: 139,
    currency: 'USD',
    priceDisplay: '$139',
    priceUnit: 'per',
} as unknown as TourListing;

const base = {
    locale: 'en' as const,
    dict: DICT,
    localsDict: { kicker: 'Chosen by people who live here', title: "Locals' favorites" },
    cardDict: CARD_DICT,
    toursLabel: 'tours',
    query: 'boat',
    dateLabel: null,
    dateParam: null,
    withoutDateHref: null,
    withoutDateCount: 0,
    clearFiltersHref: null,
    popular: [] as DestinationPopularLink[],
    exploreTypes: [],
    localsFavourites: [] as TourListing[],
    destinationSlug: 'curacao',
    destinationName: 'Curaçao',
    destinationTourCount: 25,
};

const band = () => screen.getByRole('region');

describe('SearchRecovery — zero vs thin', () => {
    it('leads with "Try one of these" when nothing matched', () => {
        render(<SearchRecovery {...base} />);
        expect(
            screen.getByRole('heading', { name: 'Try one of these' }),
        ).toBeInTheDocument();
        expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    it('blames the date in the kicker when one is applied', () => {
        render(<SearchRecovery {...base} dateLabel='6 Aug' />);
        expect(screen.getByText('No matches on this date')).toBeInTheDocument();
    });

    it('switches to "Keep looking" and counts the thin matches', () => {
        render(<SearchRecovery {...base} thinCount={2} />);
        expect(
            screen.getByRole('heading', { name: 'Keep looking' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Only 2 matches')).toBeInTheDocument();
    });

    it('labels the band for assistive tech with whichever heading it used', () => {
        render(<SearchRecovery {...base} thinCount={2} />);
        expect(band()).toHaveAccessibleName('Keep looking');
    });

    it('says "Only 1 match", never "Only 1 matches"', () => {
        render(<SearchRecovery {...base} thinCount={1} />);
        expect(screen.getByText('Only 1 match')).toBeInTheDocument();
    });

    it('keeps the thin threshold generous enough to catch a dead end', () => {
        // Four matches for a broad term is still nowhere to go.
        expect(THIN_RESULTS_MAX).toBeGreaterThanOrEqual(3);
    });
});

describe('SearchRecovery — the date drop', () => {
    const withDate = {
        ...base,
        dateLabel: '6 Aug',
        dateParam: '2026-08-06',
        withoutDateHref: '/en/search?q=boat&destination=curacao',
    };

    it('offers the date-less search, and says how many come back', () => {
        render(<SearchRecovery {...withDate} withoutDateCount={12} />);
        expect(
            screen.getByRole('link', { name: /6 Aug/ }),
        ).toHaveAttribute('href', '/en/search?q=boat&destination=curacao');
        expect(
            screen.getByText('Drop the date and 12 “boat” tours come back.'),
        ).toBeInTheDocument();
    });

    it('WITHHOLDS it when dropping the date would change nothing', () => {
        // The line promises tours come back. Zero of them is a lie, and a link
        // straight back to the same empty page.
        render(<SearchRecovery {...withDate} withoutDateCount={0} />);
        expect(screen.queryByRole('link', { name: /6 Aug/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Drop the date/)).not.toBeInTheDocument();
    });

    it('renders nothing date-related when the query carried no date', () => {
        render(<SearchRecovery {...base} withoutDateCount={12} />);
        expect(screen.queryByText(/Drop the date/)).not.toBeInTheDocument();
    });
});

describe('SearchRecovery — clearing filters', () => {
    it('offers the escape hatch when a filter is active', () => {
        // The toolbar is hidden on the zero state, so this is the ONLY way out
        // for someone whose filter emptied the page.
        render(
            <SearchRecovery {...base} clearFiltersHref='/en/search?q=boat' />,
        );
        expect(
            screen.getByRole('link', { name: 'Clear all filters' }),
        ).toHaveAttribute('href', '/en/search?q=boat');
    });

    it('omits it when no filter is narrowing anything', () => {
        render(<SearchRecovery {...base} />);
        expect(
            screen.queryByRole('link', { name: 'Clear all filters' }),
        ).not.toBeInTheDocument();
    });
});

describe('SearchRecovery — the content groups', () => {
    it('links each popular search under the scoped island', () => {
        render(<SearchRecovery {...base} popular={POPULAR} />);
        expect(screen.getByText('Popular searches')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Klein Curaçao' }),
        ).toHaveAttribute('href', '/en/curacao/klein-curacao');
    });

    it('hides the whole group rather than leaving a label over nothing', () => {
        render(<SearchRecovery {...base} popular={[]} />);
        expect(screen.queryByText('Popular searches')).not.toBeInTheDocument();
    });

    it('renders the locals-favourites head only when there are tours', () => {
        const { rerender } = render(<SearchRecovery {...base} />);
        expect(
            screen.queryByRole('heading', { name: "Locals' favorites" }),
        ).not.toBeInTheDocument();

        rerender(<SearchRecovery {...base} localsFavourites={[FAVOURITE]} />);
        expect(
            screen.getByRole('heading', { name: "Locals' favorites" }),
        ).toBeInTheDocument();
        expect(screen.getByText('Catamaran Day Trip')).toBeInTheDocument();
    });
});

describe('SearchRecovery — the chosen date travels with the traveller', () => {
    const dated = { ...base, dateLabel: '6 Aug', dateParam: '2026-08-06' };

    it('carries the date onto every popular search', () => {
        // Otherwise the date they picked is dropped at the door and the
        // listing they land on shows every departure.
        render(<SearchRecovery {...dated} popular={POPULAR} />);
        expect(
            screen.getByRole('link', { name: 'Klein Curaçao' }),
        ).toHaveAttribute('href', '/en/curacao/klein-curacao?date=2026-08-06');
    });

    it('carries it onto "See all {destination} tours"', () => {
        render(<SearchRecovery {...dated} />);
        expect(
            screen.getAllByRole('link', { name: /See all 25 Curaçao tours/ })[0],
        ).toHaveAttribute('href', '/en/curacao/tours?date=2026-08-06');
    });

    it('leaves the links bare when no date is in play', () => {
        render(<SearchRecovery {...base} popular={POPULAR} />);
        expect(
            screen.getByRole('link', { name: 'Klein Curaçao' }),
        ).toHaveAttribute('href', '/en/curacao/klein-curacao');
    });

    it('does NOT put it back on the date-drop chip', () => {
        // Removing the date is that chip's entire purpose.
        render(
            <SearchRecovery
                {...dated}
                withoutDateHref='/en/search?q=boat&destination=curacao'
                withoutDateCount={12}
            />,
        );
        expect(screen.getByRole('link', { name: /6 Aug/ })).toHaveAttribute(
            'href',
            '/en/search?q=boat&destination=curacao',
        );
    });
});

describe('SearchRecovery — "See all {destination} tours"', () => {
    it('numbers the link when the island has enough tours to be compelling', () => {
        render(<SearchRecovery {...base} destinationTourCount={25} />);
        const links = screen.getAllByRole('link', {
            name: /See all 25 Curaçao tours/,
        });
        expect(links[0]).toHaveAttribute('href', '/en/curacao/tours');
    });

    it('drops the number when it would signal scarcity', () => {
        render(<SearchRecovery {...base} destinationTourCount={6} />);
        expect(
            screen.getAllByRole('link', { name: /See all Curaçao tours/ })[0],
        ).toBeInTheDocument();
    });

    it('is omitted entirely on an unscoped search', () => {
        // No island means no island tours page to point at.
        render(
            <SearchRecovery
                {...base}
                destinationSlug={undefined}
                destinationName={null}
            />,
        );
        expect(screen.queryByText(/See all/)).not.toBeInTheDocument();
    });

    it('has a mobile copy so the desktop-only head link is never the only one', () => {
        render(<SearchRecovery {...base} />);
        const links = within(band()).getAllByRole('link', {
            name: /See all 25 Curaçao tours/,
        });
        expect(links).toHaveLength(2);
    });
});
