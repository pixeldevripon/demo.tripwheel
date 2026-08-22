import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TourCard, type TourCardDict, type TourListing } from './tour-card';

/**
 * The hub eyebrow (master 3.5 "Title and hub context" / LD15 / mck-18).
 *
 * The stored title is HUB-FREE (mck-18 §3: the data pass strips each tour's
 * prefix using its own hub) and the card renders it verbatim - there is no
 * render-time stripping left to compensate for dirty data. The default card
 * draws the eyebrow inline with the rating (founder, Aug 10 2026), but the
 * mck-18 §4 rule survives in behaviour: the eyebrow belongs to the SURFACE,
 * the rating to the review count, and each must render without the other.
 *
 * The equivalence tests matter too: the default card and the ranked collection
 * card must treat `hub` identically, so the same tour reads the same way on
 * All Tours and on a collection page.
 */

const DICT = {
    new: 'New',
    likelyToSellOut: 'Likely to sell out',
    mostPopular: 'Most popular',
    sponsored: 'Sponsored',
    saveAria: 'Save {title}',
    removeAria: 'Remove {title} from your saved tours',
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
    title: 'Full-Day Catamaran',
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

    it('shows the hub eyebrow above the bare stored title', () => {
        renderCard();
        expect(screen.getByText('Klein Curaçao')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Full-Day Catamaran' }),
        ).toBeInTheDocument();
    });

    it('renders the stored title verbatim — no render-time rewriting', () => {
        // The data pass owns title hygiene (mck-18 §3). A title that legitimately
        // contains the hub's words is the tour's NAME and must survive.
        renderCard({ title: 'Klein Curaçao Beach Escape' });
        expect(
            screen.getByRole('heading', { name: 'Klein Curaçao Beach Escape' }),
        ).toBeInTheDocument();
    });

    it('keeps the eyebrow when the tour has no rating', () => {
        // mck-18 §4: the eyebrow used to sit inside the rating row, so whether
        // the hub showed depended on the review count. It must not.
        renderCard({ rating: undefined, reviewCount: undefined });
        expect(screen.getByText('Klein Curaçao')).toBeInTheDocument();
    });

    it('renders NO eyebrow when the tour has no hub', () => {
        // "No hub means no eyebrow" - and no empty space where it would be.
        renderCard({ hub: null });
        expect(screen.queryByText('Klein Curaçao')).not.toBeInTheDocument();
    });

    it('is suppressed when `hub` is omitted entirely — the hub page case', () => {
        // The hub page leaves `hub` unset because the context is implicit there
        // (its own cards compose "{Hub} {Title}" instead - founder, Aug 6 2026).
        const { hub: _omitted, ...noHub } = base;
        render(
            <TourCard tour={{ ...noHub, ...extra } as TourListing} dict={DICT} />,
        );
        expect(screen.queryByText('Klein Curaçao')).not.toBeInTheDocument();
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

    it('produces the same eyebrow and the same title', () => {
        // This equivalence IS the issue: the same tour must read the same way on
        // All Tours and on a collection page.
        expect(readCard({})).toEqual(readCard({ rank: 1, description: 'Our pick' }));
    });
});

describe('TourCard — the hub attribute line', () => {
    const HUB_ATTRS = ['8h', 'Motorboat', 'Beach house', 'Family-friendly'];

    it('renders the attributes and DROPS the duration/pickup rows', () => {
        // The two are alternatives, not layers. The duration is already the
        // first attribute, so rendering both would print "8h" twice and hand a
        // hub card two competing meta blocks.
        render(
            <TourCard
                tour={{ ...base, attributes: HUB_ATTRS }}
                dict={DICT}
            />,
        );
        for (const attr of HUB_ATTRS) {
            expect(screen.getByText(attr)).toBeInTheDocument();
        }
        expect(screen.queryByText('Pickup available')).not.toBeInTheDocument();
    });

    it('keeps the standard rows when no attributes are supplied', () => {
        // Every non-hub surface passes none, and must be untouched by this.
        render(<TourCard tour={base} dict={DICT} />);
        expect(screen.getByText('Pickup available')).toBeInTheDocument();
    });

    it('treats an empty list as "no attributes", not as an empty line', () => {
        render(<TourCard tour={{ ...base, attributes: [] }} dict={DICT} />);
        expect(screen.getByText('Pickup available')).toBeInTheDocument();
    });
});
