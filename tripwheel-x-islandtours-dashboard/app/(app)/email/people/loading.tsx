import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/** Suspense boundary for the Email People segment. */
export default function EmailPeopleLoading() {
    return (
        <ListPageSkeleton
            title='Email People'
            description='Who is opted out of which stream, and who consented to marketing - the compliance ledger behind every send decision.'
            columns={5}
            filters={1}
        />
    );
}
