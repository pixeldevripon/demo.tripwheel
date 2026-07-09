import { DestinationPageSkeleton } from '@/components/skelitons/destination-page-skeleton';

/**
 * Segment loading UI for `/{locale}/{destination}`. Shown while the page resolves
 * the dictionary + island (before the sections render), so the body never goes
 * blank. Mirrors the real page (hero + explore, listings, about) so the handoff to
 * the per-section `<Suspense>` boundaries is seamless.
 */
export default function Loading() {
    return <DestinationPageSkeleton />;
}

