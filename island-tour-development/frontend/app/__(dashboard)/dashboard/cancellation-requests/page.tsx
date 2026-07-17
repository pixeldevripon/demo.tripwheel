import { BookingsListView } from '@/components/dashboard/bookings/bookings-list-view';

export default function CancellationRequestsPage() {
    return (
        <div className=''>
            <div className='flex items-center justify-between mb-6'>
                <div>
                    <h1 className='font-heading text-2xl font-semibold uppercase tracking-wider'>
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

