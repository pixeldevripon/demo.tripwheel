import { CategoriesListView } from '@/components/categories/categories-list-view';

export default function CategoriesPage() {
  return (
    <div className=''>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wider">
            Categories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage global tour activity categories
          </p>
        </div>
      </div>
      <CategoriesListView />
    </div>
  );
}
