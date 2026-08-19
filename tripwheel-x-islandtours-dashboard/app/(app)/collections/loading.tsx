import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/**
 * The Suspense boundary for this segment. Without it the App Router cannot
 * commit the navigation until the whole RSC payload arrives, so a sidebar click
 * leaves the previous page on screen looking frozen.
 *
 * Title and description are the REAL strings - the server already knows them,
 * so painting them at once makes the navigation read as finished while only the
 * rows are still arriving.
 */
export default function CollectionsLoading() {
    return (
        <ListPageSkeleton
            title='Collections'
            description='Curated & dynamic editorial tour lists per destination'
            columns={7}
            filters={2}
        />
    );
}
