import { CategoriesListView } from '@/components/categories/categories-list-view';

export default function CategoriesPage() {
    return (
        <div className=''>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Categories</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Manage global tour activity categories
                    </p>
                </div>
            </div>
            <CategoriesListView />
        </div>
    );
}

