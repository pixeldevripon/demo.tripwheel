import { TOUR_CARD_GRID } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeleton for the wishlist grid (`WishlistView`). Uses the exact grid
 * the real wishlist content renders (`SEARCH_GRID`) and `TourCardSkeleton`, so
 * the saved tours stream in with no layout shift.
 */
export function WishlistSkeleton() {
    return (
        <div className={TOUR_CARD_GRID}>
            {Array.from({ length: 6 }).map((_, i) => (
                <TourCardSkeleton key={i} mobileRow />
            ))}
        </div>
    );
}
