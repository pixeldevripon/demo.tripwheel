import { Breadcrumb } from '@/components/breadcrumb';
import { HubForm } from '@/components/hubs/hub-form';
import { Navigation03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export default function NewHubPage() {
    return (
        <div className='w-full max-w-6xl'>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: 'Hubs', href: '/hubs' },
                    { label: 'New Hub' },
                ]}
            />
            <div className='mb-6 flex items-center gap-3'>
                <HugeiconsIcon
                    icon={Navigation03Icon}
                    className='size-6 text-muted-foreground'
                />
                <h1 className='text-2xl font-medium'>New Hub</h1>
            </div>
            <div>
                <HubForm />
            </div>
        </div>
    );
}

