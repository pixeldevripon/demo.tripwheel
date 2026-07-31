import { TravellerPageSkeleton } from '@/components/frontend/skeletons/traveller-page-skeleton';

/**
 * Route-level loading state for the account area. The SAME skeleton is also
 * the page's inline Suspense fallback (`traveller/page.tsx`), so the account
 * silhouette holds one stable shape from the moment a navigation starts -
 * e.g. Back from a receipt - until the streamed body lands.
 */
export default function TravellerLoading() {
    return <TravellerPageSkeleton />;
}
