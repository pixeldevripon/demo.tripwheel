import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/**
 * The Suspense boundary for this segment - the real title/description paint
 * immediately so the navigation reads as finished while the rows arrive.
 */
export default function PagesLoading() {
    return (
        <ListPageSkeleton
            title='Pages'
            description='Legal & policy pages with their own permalinks on the public site'
            columns={5}
            filters={0}
        />
    );
}
