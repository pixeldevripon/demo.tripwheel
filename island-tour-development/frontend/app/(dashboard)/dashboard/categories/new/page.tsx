import { TagIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';
import { CategoryForm } from '@/components/dashboard/categories/category-form';

export default function NewCategoryPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Categories', href: '/dashboard/categories' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <TagIcon className="size-5 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          Add Category
        </h1>
      </div>

      <div className="max-w-6xl">
        <CategoryForm />
      </div>
    </div>
  );
}
