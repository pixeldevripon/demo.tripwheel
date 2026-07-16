import { Bar, GRID_PAGE_SIZE, PaginationSkeleton, SEARCH_GRID } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeleton for the streamed body of the global search page
 * (`/[locale]/search`). Mirrors the result-count subtitle + result grid so the
 * page streams in without layout shift and never goes blank while its results
 * load. The heading above it is part of the prerendered shell, so it is not
 * repeated here. The grid + card exactly mirror `search/search-results-section`.
 */
export function SearchResultsSkeleton() {
    return (
        <>
            <Bar className='h-5 w-48 md:h-6' />
            <div className={SEARCH_GRID}>
                {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
                    <TourCardSkeleton key={i} />
                ))}
            </div>
            <PaginationSkeleton />
        </>
    );
}
