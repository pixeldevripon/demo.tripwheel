import { UnsubscribeCardSkeleton } from '@/components/frontend/skeletons/unsubscribe-card-skeleton';

/**
 * Route-level loading state for the unsubscribe page. Reproduces the page's
 * EXACT frame (centred 70vh surface band, xl-capped column) around the same
 * card skeleton the page uses as its Suspense fallback.
 */
export default function UnsubscribeLoading() {
    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-xl'>
                <UnsubscribeCardSkeleton />
            </div>
        </section>
    );
}
