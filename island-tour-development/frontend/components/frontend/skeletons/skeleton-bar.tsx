import { cn } from '@/lib/utils';

/**
 * Shared skeleton primitives for the public site. Every loading placeholder is
 * built from `<Bar>` (one shimmering block) so there is a single shimmer
 * definition instead of a per-file copy. The grid constants below are the exact
 * class strings the real list components use, so card skeletons can never drift
 * from the live grid they stand in for.
 */

/** A single shimmering placeholder bar (frontend-tokened, no layout of its own). */
export function Bar({ className }: { className?: string }) {
    return (
        <div className={cn('animate-pulse rounded-md bg-it-heading/10', className)} />
    );
}

/**
 * Canonical card-grid class strings - copied verbatim from the live list
 * components so a skeleton grid always matches the real grid (columns + gaps).
 *
 * - `CARD_GRID`   → `tours-listing`, `collection-tours-section`, related tours
 * - `SEARCH_GRID` → `search/search-results-section` (note the `gap-y-8` mobile gap)
 * - `HUB_GRID`    → `hub-trips-panel`
 */
export const CARD_GRID =
    'grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3';
export const SEARCH_GRID =
    'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10';
export const HUB_GRID =
    'grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10';

/**
 * Cards a full paginated page renders - kept equal to the real page limits
 * (`TOURS_LIMIT` in `tours-listing-section`, `PAGE_SIZE` in
 * `search-results-section`), so a skeleton grid is the same height as a full
 * first page and doesn't shift when the tours stream in.
 */
export const GRID_PAGE_SIZE = 12;

/**
 * Placeholder for the numbered `<Pagination>` row (‹ arrow · pages · arrow ›,
 * `flex items-center justify-center gap-5`, ~25.6px tall). Reserves the
 * pagination height beneath a grid so the following sections don't jump down
 * when a paginated result streams in.
 */
export function PaginationSkeleton() {
    return (
        <div className='flex items-center justify-center gap-5'>
            <Bar className='size-5 rounded-md' />
            <Bar className='h-6 w-40' />
            <Bar className='size-5 rounded-md' />
        </div>
    );
}

/**
 * The destination page's mobile swipe-carousel / lg 3-col grid, mirroring
 * `destination-listings` + `destination-collections`. The per-card width wrapper
 * (viewport fractions on mobile, auto in the grid) is `DESTINATION_CARD_CELL`.
 */
export const DESTINATION_RAIL =
    'flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:grid lg:snap-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden';
export const DESTINATION_CARD_CELL =
    'w-[82vw] min-[480px]:w-[64vw] sm:w-[42vw] shrink-0 snap-start lg:w-auto';
