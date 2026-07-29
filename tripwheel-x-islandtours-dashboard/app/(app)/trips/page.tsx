import { TripsListView } from '@/components/trips/trips-list-view';

export default function TripsPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>My Trips</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Manage your tour listings
                    </p>
                </div>
            </div>
            <TripsListView />
        </div>
    );
}

