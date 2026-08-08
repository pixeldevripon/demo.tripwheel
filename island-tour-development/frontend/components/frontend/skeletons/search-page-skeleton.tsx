import { ToursToolbarSkeleton } from './tours-page-skeleton';
import {
    Bar,
    GRID_PAGE_SIZE,
    PaginationSkeleton,
    TOUR_CARD_GRID,
} from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeleton for the streamed body of the global search page
 * (`/[locale]/search`). Mirrors the result-count line, the filter/sort toolbar
 * and the result grid so the page streams in without layout shift and never goes
 * blank while its results load. The heading above it is part of the prerendered
 * shell, so it is not repeated here.
 *
 * Reuses the listing toolbar's skeleton outright - the page mounts that same
 * toolbar the same way (Pastel #44), so a second copy here would be a second
 * thing to keep in step.
 */
export function SearchResultsSkeleton() {
    return (
        <>
            <div className='it-container'>
                <Bar className='h-5 w-48 md:h-6' />
            </div>
            <ToursToolbarSkeleton />
            <div className='it-container flex flex-col gap-7.5'>
                <div className={TOUR_CARD_GRID}>
                    {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
                        <TourCardSkeleton key={i} mobileRow />
                    ))}
                </div>
                <PaginationSkeleton />
            </div>
        </>
    );
}
