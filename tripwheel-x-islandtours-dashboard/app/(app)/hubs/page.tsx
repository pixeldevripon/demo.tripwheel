import { HubsListView } from '@/components/hubs/hubs-list-view';

export default function HubsPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Hubs</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Manage destination-specific hub locations
                    </p>
                </div>
            </div>
            <HubsListView />
        </div>
    );
}

