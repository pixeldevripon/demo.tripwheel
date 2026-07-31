import { TravellerReceiptSkeleton } from '@/components/frontend/skeletons/traveller-receipt-skeleton';

/**
 * Route-level loading state for the receipt. The SAME receipt-shaped skeleton
 * is also the page's inline Suspense fallback, so from the moment the
 * navigation starts until the document streams in, the reader sees one stable
 * receipt silhouette - never a blank band, never two different placeholders.
 */
export default function TravellerReceiptLoading() {
    return <TravellerReceiptSkeleton />;
}
