import { Bar } from '@/components/frontend/skeletons/skeleton-bar';
import { WishlistSkeleton } from '@/components/frontend/skeletons/wishlist-skeleton';

/**
 * Route-level loading state for the wishlist. Same frame as `WishlistView`
 * (white section, container, page-title slot at the h1's real size) with
 * the SAME grid skeleton the view shows while the saved tours load.
 */
export default function WishlistLoading() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                {/* The h1 is text-[26px] md:text-[38px] with 1.2 leading. */}
                <Bar className='h-8 w-44 md:h-12 md:w-60' />
                <WishlistSkeleton />
            </div>
        </section>
    );
}
