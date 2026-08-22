import { ListPageSkeleton } from '@/components/skeletons/list-page-skeleton';

/** Suspense boundary for the Payments segment - see `bookings/loading.tsx`. */
export default function PaymentsLoading() {
    return (
        <ListPageSkeleton
            title='Payments'
            description='Platform charges per booking (deposits, full payments, refunds) with their provider status. Operators see payments on their own tours only.'
            columns={6}
            filters={4}
        />
    );
}
