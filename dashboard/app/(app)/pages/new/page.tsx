import { PageForm } from '@/components/pages/page-form';

export default function NewPagePage() {
    return (
        <div>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>New Page</h1>
                <p className='text-sm text-muted-foreground mt-1'>
                    Created as a draft - publish from the Pages list when ready
                </p>
            </div>
            <PageForm />
        </div>
    );
}

