import { EntityPageSkeleton } from '@/components/frontend/skeletons/entity-page-skeleton';

/**
 * Segment loading UI for the polymorphic `/{locale}/{destination}/{slug}` route.
 * Shown while the page resolves the slug registry + dictionary + destination name
 * (before the entity component renders), so the body never goes blank on a cold
 * load or client navigation. Once the page renders, each entity's own `<Suspense>`
 * section skeletons take over.
 */
export default function Loading() {
    return <EntityPageSkeleton />;
}

