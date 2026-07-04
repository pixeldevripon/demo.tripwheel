import { ToursPageSkeleton } from '@/components/skelitons/tours-page-skeleton';

/**
 * Route-level loading UI for `/[locale]/[destination]/tours`. Shown during
 * navigation while the shell resolves; mirrors the full page in section order so
 * the transition is seamless before the per-section <Suspense> boundaries take
 * over.
 */
export default function Loading() {
    return <ToursPageSkeleton />;
}
