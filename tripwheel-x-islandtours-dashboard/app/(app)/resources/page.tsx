import { ResourcesListView } from '@/components/resources/resources-list-view';

export default function ResourcesPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Equipment &amp; Staff</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>
                        The boats, vehicles and guides your tours share, so two
                        tours are never sold onto the same one at the same time
                    </p>
                </div>
            </div>
            <ResourcesListView />
        </div>
    );
}
