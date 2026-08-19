import { Breadcrumb } from '@/components/breadcrumb';
import { CollectionForm } from '@/components/collections/collection-form';
import { Layers01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export default function NewCollectionPage() {
    return (
        <div className='w-full max-w-6xl'>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: 'Collections', href: '/collections' },
                    { label: 'New' },
                ]}
            />

            <div className='flex items-center gap-2 mb-6'>
                <HugeiconsIcon
                    icon={Layers01Icon}
                    className='size-5 text-muted-foreground'
                />
                <h1 className='text-2xl font-medium'>Add Collection</h1>
            </div>

            <div>
                <CollectionForm />
            </div>
        </div>
    );
}

