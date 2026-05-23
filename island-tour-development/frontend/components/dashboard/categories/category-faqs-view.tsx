'use client';

import { CategoryDetailShell } from './category-detail-shell';
import { CategoryFaqManager } from './category-faq-manager';
import { useCategory } from '@/hooks/categories/use-categories';

interface CategoryFaqsViewProps {
  id: string;
}

export function CategoryFaqsView({ id }: CategoryFaqsViewProps) {
  const { data: category, isLoading } = useCategory(id, 'en');

  return (
    <CategoryDetailShell
      id={id}
      name={category?.name}
      isLoading={isLoading}
      subtitle="FAQs"
      maxWidth="lg"
    >
      <CategoryFaqManager categoryId={id} />
    </CategoryDetailShell>
  );
}
