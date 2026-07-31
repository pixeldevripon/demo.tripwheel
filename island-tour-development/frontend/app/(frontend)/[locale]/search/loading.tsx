import { Bar } from '@/components/frontend/skeletons/skeleton-bar';
import { SearchResultsSkeleton } from '@/components/frontend/skeletons/search-page-skeleton';

/**
 * Route-level loading state for the search page. Same frame as the page
 * (white section, container, page-title slot at the h1's real size) with
 * the SAME results skeleton the page streams behind, so the grid holds one
 * stable shape from navigation start until the results land.
 */
export default function SearchLoading() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                {/* The h1 is text-[28px] md:text-[40px] with 1.2 leading. */}
                <Bar className='h-8 w-44 md:h-12 md:w-60' />
                <SearchResultsSkeleton />
            </div>
        </section>
    );
}
