'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryForm } from './category-form';
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
        <CategoryForm category={category} />
      ) : (
        <p className="text-sm text-muted-foreground">Category not found.</p>
      )}
    </CategoryDetailShell>
  );
}
