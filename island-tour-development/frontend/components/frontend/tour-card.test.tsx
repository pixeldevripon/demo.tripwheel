import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TourCard, type TourCardDict, type TourListing } from './tour-card';

/**
 * The hub eyebrow (Pastel #49, master 3.5 "Title and hub context" / LD15).
 *
 * The point of these tests is the EQUIVALENCE: the default card and the ranked
 * collection card must treat `hub` identically. They diverged - the collection
 * variant rendered a bare title and no eyebrow, so the same tour looked
 * different on All Tours and on a collection page, hub name repeated into the
 * title on one of them.
 */

const DICT = {
    new: 'New',
    likelyToSellOut: 'Likely to sell out',
    mostPopular: 'Most popular',
    sponsored: 'Sponsored',
    from: 'From',
    per: 'per person',
    freeCancellation: 'Free cancellation',
    pickupAvailable: 'Pickup available',
    reviews: 'reviews',
} as unknown as TourCardDict;

const base: TourListing = {
    id: 't1',
    href: '/en/curacao/full-day-catamaran',
    images: [],
    badge: null,
    title: 'Klein Curaçao Full-Day Catamaran',
    hub: { name: 'Klein Curaçao', slug: 'klein-curacao' },
    duration: '8h',
    pickupAvailable: true,
    price: 139,
    currency: 'USD',
    priceDisplay: '$139',
    priceUnit: 'per',
} as unknown as TourListing;

/** Both variants: the ranked one is opted into with `rank`. */
const VARIANTS = [
    ['default', {} as Partial<TourListing>],
    ['ranked (collection)', { rank: 1, description: 'Our pick' }],
] as const;

describe.each(VARIANTS)('TourCard — %s variant', (_label, extra) => {
    const renderCard = (tour: Partial<TourListing> = {}) =>
        render(<TourCard tour={{ ...base, ...extra, ...tour }} dict={DICT} />);

    it('shows the hub name above the title', () => {
        renderCard();
        expect(screen.getByText('Klein Curaçao')).toBeInTheDocument();
    });

    it('strips the hub prefix, so the name is never said twice', () => {
        renderCard();
        expect(
            screen.getByRole('heading', { name: 'Full-Day Catamaran' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', {
                name: 'Klein Curaçao Full-Day Catamaran',
            }),
        ).not.toBeInTheDocument();
    });

    it('renders NO eyebrow when the tour has no hub', () => {
        // "No hub means no eyebrow" - and no empty space where it would be.
        const { container } = renderCard({ hub: null });
        expect(screen.queryByText('Klein Curaçao')).not.toBeInTheDocument();
        expect(container.textContent).toContain('Klein Curaçao Full-Day Catamaran');
    });

    it('is suppressed when `hub` is omitted entirely — the hub page case', () => {
        // The hub page leaves `hub` unset because the context is implicit there.
        const { hub: _omitted, ...noHub } = base;
        render(
            <TourCard tour={{ ...noHub, ...extra } as TourListing} dict={DICT} />,
        );
        expect(screen.queryByText('Klein Curaçao')).not.toBeInTheDocument();
    });

    it('keeps a title that is ONLY the hub name rather than emptying it', () => {
        renderCard({ title: 'Klein Curaçao' });
        expect(
            screen.getByRole('heading', { name: 'Klein Curaçao' }),
        ).toBeInTheDocument();
    });

    it('strips the prefix case-insensitively and drops the separator', () => {
        renderCard({ title: 'klein curaçao - Sunset Sail' });
        expect(
            screen.getByRole('heading', { name: 'Sunset Sail' }),
        ).toBeInTheDocument();
    });

    it('leaves an unrelated title untouched', () => {
        renderCard({ title: 'Sunset Sail from Willemstad' });
        expect(
            screen.getByRole('heading', { name: 'Sunset Sail from Willemstad' }),
        ).toBeInTheDocument();
    });
});

describe('TourCard — the two variants agree', () => {
    /** The rendered eyebrow text and heading text for a given variant. */
    function readCard(extra: Partial<TourListing>) {
        const { container, unmount } = render(
            <TourCard tour={{ ...base, ...extra }} dict={DICT} />,
        );
        const heading = within(container).getByRole('heading').textContent;
        const eyebrow = within(container).queryByText('Klein Curaçao')
            ? 'Klein Curaçao'
            : null;
        unmount();
        return { heading, eyebrow };
    }

    it('produces the same eyebrow and the same stripped title', () => {
        // This equivalence IS the issue: the same tour must read the same way on
        // All Tours and on a collection page.
        expect(readCard({})).toEqual(readCard({ rank: 1, description: 'Our pick' }));
    });
});
