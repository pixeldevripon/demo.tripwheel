import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import { useIsMobile } from '@/hooks/use-mobile';

import { HeroSearch } from './hero-search';
import type { HeroDestination } from './lib/hero.types';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: vi.fn(() => false),
}));

vi.mock('@/lib/api/search', () => ({
    // Never resolves - these tests never type, so the suggest endpoint must
    // never matter.
    searchSuggestClient: vi.fn(() => new Promise(() => {})),
}));

/**
 * The homepage hero search.
 *
 * The `SearchPill` hands off to the mobile layer ONLY when its caller passes
 * `compact` - the pill cannot see the viewport itself. This caller forgot to,
 * so mobile taps focused the field in place under a panel that is
 * `max-md:hidden`: suggestions on desktop, nothing at all on a phone. The
 * pill's own tests kept passing the whole time, which is why the regression
 * test has to live at THIS level - the wiring is what broke.
 */

const DICT: SearchDict = {
    title: 'Search',
    closeSearch: 'Close search',
    searching: 'Searching…',
    seeAll: 'See all',
    noResults: 'No results',
    toursIn: 'Tours in {island}',
    categoriesAndHubs: 'Categories & spots',
    collections: 'Collections',
    topTours: 'Top tours',
    beyond: 'Beyond {island}',
    tourCount: '{count} tours',
    tourCountOne: '1 tour',
    seeAllTours: 'See all tours',
    hours: '{count} hours',
    hour: '1 hour',
    minutes: '{count} min',
    range: '{from}–{to}',
    pickupAvailable: 'Pickup available',
    freeCancellation: 'Free cancellation',
    from: 'From',
};

const DESTINATIONS: HeroDestination[] = [
    { name: 'Curaçao', slug: 'curacao', tours: 24, image: null },
    { name: 'Aruba', slug: 'aruba', tours: 10, image: null },
    { name: 'Sint Maarten', slug: 'sint-maarten', tours: 5, image: null },
];

const base = {
    destinations: DESTINATIONS,
    locale: 'en' as const,
    placeholder: 'Which island?',
    search: DICT,
};

describe('HeroSearch — where the suggestions open', () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
    });

    it('mobile: tapping the field opens the full-screen layer with the islands', async () => {
        vi.mocked(useIsMobile).mockReturnValue(true);
        const user = userEvent.setup();
        render(<HeroSearch {...base} />);

        await user.click(screen.getByRole('searchbox'));

        // The layer, not the inline dropdown, is where mobile suggestions live.
        const layer = screen.getByRole('dialog');
        for (const island of DESTINATIONS) {
            expect(within(layer).getByText(island.name)).toBeInTheDocument();
        }
    });

    it('desktop: focusing shows the inline dropdown and never the layer', async () => {
        const user = userEvent.setup();
        render(<HeroSearch {...base} />);

        await user.click(screen.getByRole('searchbox'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        for (const island of DESTINATIONS) {
            expect(screen.getByText(island.name)).toBeInTheDocument();
        }
    });
});
