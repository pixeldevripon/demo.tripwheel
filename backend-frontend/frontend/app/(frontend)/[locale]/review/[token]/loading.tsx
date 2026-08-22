import { ReviewCardSkeleton } from '@/components/frontend/skeletons/review-card-skeleton';

/**
 * Route-level loading state for the review-invitation page. Reproduces the
 * page's EXACT frame (centred 70vh surface band, xl-capped column) around
 * the same card skeleton the page uses as its Suspense fallback.
 */
export default function ReviewLoading() {
    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-xl'>
                <ReviewCardSkeleton />
            </div>
        </section>
    );
}
