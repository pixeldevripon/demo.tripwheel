import { cn } from '@/lib/utils';

/**
 * Shared skeleton primitives for the public site. Every loading placeholder is
 * built from `<Bar>` (one shimmering block) so there is a single shimmer
 * definition instead of a per-file copy. The grid constants below are the exact
 * class strings the real list components use, so card skeletons can never drift
 * from the live grid they stand in for.
 */

/** A single shimmering placeholder bar (frontend-tokened, no layout of its
 *  own). The shimmer itself is the shared `.it-skeleton` utility (design v2
 *  light-sweep on the paper surface); pass a `rounded-*` class to override the
 *  default 12px radius. */
export function Bar({ className }: { className?: string }) {
    return <div className={cn('it-skeleton rounded-it-md', className)} />;
}

/**
 * Canonical card-grid class strings - copied verbatim from the live list
 * components so a skeleton grid always matches the real grid (columns + gaps).
 * Sitewide tour grid: 2-col mobile / 3-col sm / 4-col lg.
 *
 * - `CARD_GRID`   → `tours-listing`, related tours (tour page + thank-you)
 * - `SEARCH_GRID` → `search/search-results-section` + wishlist
 * - `HUB_GRID`    → `hub-trips-panel`
 */
export const CARD_GRID =
    'grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4';
export const SEARCH_GRID =
    'grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4';
export const HUB_GRID =
    'grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4';

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
 * The destination page's mobile swipe-carousel (edge-bleeding via -mx-4/px-4)
 * / sm 3-col / lg 4-col grid, mirroring `destination-listings` (TOUR cards).
 * The per-card width wrapper (viewport fractions on mobile, auto once the grid
 * starts at sm) is `DESTINATION_CARD_CELL`.
 */
export const DESTINATION_RAIL =
    '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden lg:grid-cols-4';

/**
 * The destination page's COLLECTION-card rail, mirroring
 * `destination-collections`: edge-bleeding swipe-carousel up to lg, max 3-col
 * grid from lg (collection cards never go 4-col). Cells:
 * `COLLECTION_CARD_CELL` (carousel widths persist until lg).
 */
export const COLLECTION_RAIL =
    '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden';

/**
 * The collection page's tour grid, mirroring `collection-tours-section`:
 * 2-col mobile, 3-col from sm - max 3 columns (no lg 4-col).
 */
export const COLLECTION_TOURS_GRID =
    'grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10';
export const DESTINATION_CARD_CELL =
    'w-[82vw] min-[480px]:w-[64vw] shrink-0 snap-start sm:w-auto';

/** Collection-rail cells keep carousel widths until the lg grid takes over. */
export const COLLECTION_CARD_CELL =
    'w-[82vw] min-[480px]:w-[64vw] sm:w-[42vw] shrink-0 snap-start lg:w-auto';
