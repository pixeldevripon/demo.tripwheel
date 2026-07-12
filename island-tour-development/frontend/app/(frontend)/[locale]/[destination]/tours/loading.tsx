import { ToursPageSkeleton } from '@/components/skelitons/tours-page-skeleton';

/**
 * Route-level loading UI for `/[locale]/[destination]/tours`. Shown during client
 * navigation and on a cold island's first on-demand render. The header + shell are
 * cached-static; the tour grid streams via `searchParams`, so this full-page
 * skeleton covers the initial paint and hands off to the streamed listing.
 */
export default function Loading() {
    return <ToursPageSkeleton />;
}
