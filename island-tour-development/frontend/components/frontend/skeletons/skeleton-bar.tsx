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
 * The listing grid, re-exported so skeleton files have one import for the whole
 * kit. It is NOT a copy: `TOUR_CARD_GRID` is the single string the real
 * listings use, which is the point.
 *
 * There used to be three constants here (`CARD_GRID`/`SEARCH_GRID`/`HUB_GRID`),
 * identical to each other and described as "copied verbatim from the live list
 * components". Copied strings do not stay verbatim - design v2 moved the
 * listings to one mobile column and every copy here kept the old two, so the
 * skeletons promised a layout the real grids no longer rendered.
 */
export { TOUR_CARD_GRID } from '@/lib/tours/listing';

/**
 * Cards a full paginated page renders - kept equal to `PAGE_SIZE` in
 * `search-results-section`, so a skeleton grid is the same height as a full
 * first page and doesn't shift when the results stream in. (The tours listing
 * pages use their own 8-block mockup skeleton - see `tours-page-skeleton`.)
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
 * The column count tracks `TOUR_CARD_GRID` exactly - a skeleton one column out
 * reflows the whole section the moment the real grid streams in. The per-card
 * width wrapper (viewport fractions on mobile, auto once the grid starts at sm)
 * is `DESTINATION_CARD_CELL`.
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
    'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-5';

export const DESTINATION_CARD_CELL =
    'w-[82vw] min-[480px]:w-[64vw] shrink-0 snap-start sm:w-auto';

/** Collection-rail cells: the grid owns sizing at every width now. */
export const COLLECTION_CARD_CELL = '';
