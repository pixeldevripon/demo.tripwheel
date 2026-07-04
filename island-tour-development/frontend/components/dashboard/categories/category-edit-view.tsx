'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryForm } from './category-form';
import { CategorySubcategoriesManager } from './category-subcategories-manager';
import { useCategory } from '@/hooks/categories/use-categories';

interface CategoryEditViewProps {
  id: string;
}

export function CategoryEditView({ id }: CategoryEditViewProps) {
  const { data: category, isLoading } = useCategory(id, 'en');

  return (
    <CategoryDetailShell
      id={id}
      name={category?.name}
      isLoading={isLoading}
      subtitle="Edit category details"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
        </div>
      ) : category ? (
        <div className="space-y-6">
          <CategoryForm category={category} />
          {/* Sub-categories are single-level, so only top-level categories
              manage children here. */}
          {!category.parentCategoryId && (
            <CategorySubcategoriesManager parent={category} />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Category not found.</p>
      )}
    </CategoryDetailShell>
  );
}
