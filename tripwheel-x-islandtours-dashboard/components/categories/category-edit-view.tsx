'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityTabs, type EntityTab } from '@/components/common/entity-tabs';
import { FaqManager } from '@/components/common/faq-manager';
import { useCategory } from '@/hooks/categories/use-categories';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryForm } from './category-form';
import { CategorySubcategoriesManager } from './category-subcategories-manager';
import { EnglishContentEditor } from '@/components/common/english-content-editor';
import { CategoryPageContentForm } from './category-page-content-form';
import { CategorySeoTab } from '@/components/common/entity-seo-tab';

interface CategoryEditViewProps {
  id: string;
  initialTab?: string;
}

export function CategoryEditView({ id, initialTab }: CategoryEditViewProps) {
  const { data: category, isLoading } = useCategory(id, 'en');

  if (isLoading) {
    return (
      <CategoryDetailShell id={id} name={undefined} isLoading subtitle="Edit category">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      </CategoryDetailShell>
    );
  }

  if (!category) {
    return (
      <CategoryDetailShell id={id} name={undefined} isLoading={false} subtitle="Edit category">
        <p className="text-sm text-muted-foreground">Category not found.</p>
      </CategoryDetailShell>
    );
  }

  // Sub-categories are single-level, so only top-level categories manage children.
  const isTopLevel = !category.parentCategoryId;

  return (
    <CategoryDetailShell id={id} name={category.name} isLoading={false} subtitle="Edit category">
      <EntityTabs
        basePath={`/categories/${id}/edit`}
        initialTab={initialTab}
        aliases={{ translations: 'page-content' }}
        tabs={[
          {
            value: 'details',
            label: 'Details',
            content: <CategoryForm category={category} />,
          },
          ...(isTopLevel
            ? ([
                {
                  value: 'sub-categories',
                  label: 'Sub-categories',
                  content: <CategorySubcategoriesManager parent={category} />,
                },
              ] satisfies EntityTab[])
            : []),
          {
            value: 'page-content',
            label: 'Page Content',
            content: (
              <div className="space-y-6">
                <EnglishContentEditor type="category" id={id} />
                <CategoryPageContentForm categoryId={id} />
              </div>
            ),
          },
          {
            value: 'faqs',
            label: 'FAQs',
            content: (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold">FAQs</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <FaqManager basePath="/categories" entityId={id} />
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'seo',
            label: 'SEO',
            content: <CategorySeoTab category={category} />,
          },
        ]}
      />
    </CategoryDetailShell>
  );
}
