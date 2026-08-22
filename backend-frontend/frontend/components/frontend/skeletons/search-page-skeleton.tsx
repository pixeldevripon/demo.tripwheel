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
 * (`/[locale]/search`). Mirrors the whole streamed block - scope pill, the `h1`
 * that states the outcome, the next-step line, the filter/sort toolbar and the
 * result grid - so the page streams in without layout shift and never goes blank
 * while its results load. The heading is part of THIS block, not the shell: it
 * carries the result count, which no prerender can know.
 *
 * Reuses the listing toolbar's skeleton outright - the page mounts that same
 * toolbar the same way (Pastel #44), so a second copy here would be a second
 * thing to keep in step.
 */
export function SearchResultsSkeleton() {
    return (
        <>
            <div className='it-container mb-7 flex flex-col gap-2.5'>
                <Bar className='h-6 w-28 rounded-it-full' />
                <Bar className='h-9 w-72 md:h-10 md:w-96' />
                <Bar className='h-5 w-56 md:w-80' />
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
