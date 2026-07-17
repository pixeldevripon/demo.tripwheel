'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaqManager } from '@/components/faq/faq-manager';
import { useCategory } from '@/hooks/categories/use-categories';
import { CategoryDetailShell } from './category-detail-shell';
import { CategoryForm } from './category-form';
import { CategorySubcategoriesManager } from './category-subcategories-manager';
import { CategoryTranslationForm } from './category-translation-form';
import { CategoryPageContentForm } from './category-page-content-form';
import { CategorySeoTab } from './category-seo-tab';

// Priority order: identity first, then structure (sub-categories), then the
// localized content travelers see, then supplementary content and SEO polish.
const VALID_TABS = [
  'details',
  'sub-categories',
  'translations',
  'page-content',
  'faqs',
  'seo',
] as const;

interface CategoryEditViewProps {
  id: string;
  initialTab?: string;
}

export function CategoryEditView({ id, initialTab }: CategoryEditViewProps) {
  const activeTab =
    initialTab && (VALID_TABS as readonly string[]).includes(initialTab) ? initialTab : 'details';
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
      <Tabs defaultValue={activeTab}>
        <div className="pb-2 mb-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            {isTopLevel && (
              <TabsTrigger value="sub-categories">Sub-categories</TabsTrigger>
            )}
            <TabsTrigger value="translations">Translations</TabsTrigger>
            <TabsTrigger value="page-content">Page Content</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details">
          <CategoryForm category={category} />
        </TabsContent>

        {isTopLevel && (
          <TabsContent value="sub-categories">
            <CategorySubcategoriesManager parent={category} />
          </TabsContent>
        )}

        <TabsContent value="translations">
          <CategoryTranslationForm categoryId={id} categoryName={category.name} />
        </TabsContent>

        <TabsContent value="page-content">
          <CategoryPageContentForm categoryId={id} />
        </TabsContent>

        <TabsContent value="faqs">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg font-semibold">
                FAQs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FaqManager basePath="/categories" entityId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <CategorySeoTab category={category} />
        </TabsContent>
      </Tabs>
    </CategoryDetailShell>
  );
}
