import { HugeiconsIcon } from '@hugeicons/react';
import { Tag01Icon } from '@hugeicons/core-free-icons';
import { Breadcrumb } from '@/components/breadcrumb';
import { CategoryForm } from '@/components/categories/category-form';

export default function NewCategoryPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Categories', href: '/categories' },
          { label: 'New' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <HugeiconsIcon icon={Tag01Icon} className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Add Category
        </h1>
      </div>

      <div className="max-w-6xl">
        <CategoryForm />
      </div>
    </div>
  );
}
