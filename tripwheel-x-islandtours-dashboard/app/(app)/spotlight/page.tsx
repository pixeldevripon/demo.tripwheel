import { SpotlightQueueView } from '@/components/spotlight/spotlight-queue-view';

export default function SpotlightPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Spotlight</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Review and schedule Destination Spotlight requests (max
                        3 active per destination).
                    </p>
                </div>
            </div>
            <SpotlightQueueView />
        </div>
    );
}

