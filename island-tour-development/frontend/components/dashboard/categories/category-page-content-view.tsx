'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryPageContentForm } from './category-page-content-form';
import { useCategory } from '@/hooks/categories/use-categories';

interface CategoryPageContentViewProps {
  id: string;
}

export function CategoryPageContentView({ id }: CategoryPageContentViewProps) {
  const { data: category, isLoading } = useCategory(id, 'en');

  return (
    <CategoryDetailShell
      id={id}
      name={category?.name}
      isLoading={isLoading}
      subtitle="Page Content"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-24 w-full rounded-none" />
        </div>
      ) : (
        <CategoryPageContentForm categoryId={id} />
      )}
    </CategoryDetailShell>
  );
}
