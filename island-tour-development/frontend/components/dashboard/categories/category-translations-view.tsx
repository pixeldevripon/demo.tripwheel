'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryTranslationForm } from './category-translation-form';
import { useCategory } from '@/hooks/categories/use-categories';

interface CategoryTranslationsViewProps {
  id: string;
}

export function CategoryTranslationsView({ id }: CategoryTranslationsViewProps) {
  const { data: category, isLoading } = useCategory(id, 'en');

  return (
    <CategoryDetailShell
      id={id}
      name={category?.name}
      isLoading={isLoading}
      subtitle="Translations"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
        </div>
      ) : (
        <CategoryTranslationForm
          categoryId={id}
          categoryName={category?.name ?? ''}
        />
      )}
    </CategoryDetailShell>
  );
}
