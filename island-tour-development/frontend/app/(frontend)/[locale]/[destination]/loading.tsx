import { DestinationPageSkeleton } from '@/components/frontend/skeletons/destination-page-skeleton';

/**
 * Route-level loading UI for `/[locale]/[destination]`. Shown during client
 * navigation and on a cold (non-prerendered / newly-activated) island's first
 * on-demand render - the page shell is fully cached-static, so this covers the
 * brief resolve of the cached loaders, then hands off to the rendered page.
 */
export default function Loading() {
    return <DestinationPageSkeleton />;
}
