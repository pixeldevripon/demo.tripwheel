import { ThankYouPageSkeleton } from '@/components/skelitons/thank-you-page-skeleton';

/**
 * TYP route skeleton - the same `ThankYouPageSkeleton` the page uses as its
 * `<Suspense>` fallback, so navigating from checkout never flashes the parent
 * destination skeleton and first paint matches the streamed fill-in exactly.
 */
export default function ThankYouLoading() {
    return <ThankYouPageSkeleton />;
}
