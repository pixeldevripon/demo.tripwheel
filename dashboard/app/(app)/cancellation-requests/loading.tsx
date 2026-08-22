import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/**
 * Suspense boundary for the Cancellation Requests queue - see
 * `bookings/loading.tsx`. The queue drops the status filter (it is pinned to
 * requested-only) and adds the request/window/refund columns.
 */
export default function CancellationRequestsLoading() {
    return (
        <ListPageSkeleton
            title='Cancellation Requests'
            description='Traveller cancellation requests, oldest first (master 6.4). Refund entitlement is judged at the request instant - mark a booking cancelled from the row actions to process it.'
            columns={11}
            filters={3}
        />
    );
}
