import { CancelCardSkeleton } from '@/components/frontend/skeletons/cancel-card-skeleton';

/**
 * Route-level loading state for the cancel-request page. Reproduces the
 * page's EXACT frame (centred 70vh surface band) around the same card
 * skeleton the page uses as its Suspense fallback, so the silhouette never
 * changes shape between the navigation phase and the data stream.
 */
export default function CancelLoading() {
    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container flex justify-center'>
                <CancelCardSkeleton />
            </div>
        </section>
    );
}
