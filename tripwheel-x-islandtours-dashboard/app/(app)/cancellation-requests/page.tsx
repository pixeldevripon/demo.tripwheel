import { BookingsListView } from '@/components/bookings/bookings-list-view';

/** Deliberately not opted into `unstable_instant` - see `bookings/page.tsx`. */
export default function CancellationRequestsPage() {
    return (
        <div className=''>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-semibold'>
                        Cancellation Requests
                    </h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Traveller cancellation requests, oldest first (master
                        6.4). Refund entitlement is judged at the request
                        instant - mark a booking cancelled from the row actions
                        to process it.
                    </p>
                </div>
            </div>
            <BookingsListView cancellationView />
        </div>
    );
}

