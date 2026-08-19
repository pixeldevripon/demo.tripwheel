'use client';

import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';
import { useToursListCopy } from '@/components/trips/tours-list-copy';

/**
 * The Suspense boundary for this segment. Without it the App Router cannot
 * commit the navigation until the whole RSC payload arrives, so a sidebar click
 * leaves the previous page on screen looking frozen.
 *
 * Title and description are the REAL role-aware strings (shared with the page
 * header), so painting them at once makes the navigation read as finished
 * while only the rows are still arriving.
 */
export default function TripsLoading() {
    const { title, description } = useToursListCopy();
    return (
        <ListPageSkeleton
            title={title}
            description={description}
            columns={8}
            filters={3}
        />
    );
}
