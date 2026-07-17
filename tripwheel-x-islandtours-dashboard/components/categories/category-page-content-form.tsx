'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCategoryPageContent,
  useUpsertCategoryPageContent,
} from '@/hooks/categories/use-categories';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

// metaTitle / metaDescription are managed in the dedicated SEO tab; this form
// only edits the editorial aboutText (the upsert merges field-by-field, so the
// meta fields are untouched by saves here).
const pageContentSchema = z.object({
  aboutText: z.string().optional().or(z.literal('')),
});

type PageContentFormValues = z.infer<typeof pageContentSchema>;

interface LocalePageContentTabProps {
  categoryId: string;
  locale: Locale;
}

function LocalePageContentTab({ categoryId, locale }: LocalePageContentTabProps) {
  const { data: content, isLoading } = useCategoryPageContent(categoryId, locale);
  const { mutate: upsert, isPending } = useUpsertCategoryPageContent();

  const { register, handleSubmit, reset } = useForm<PageContentFormValues>({
    resolver: zodResolver(pageContentSchema),
    defaultValues: { aboutText: '' },
  });

  useEffect(() => {
    if (content) {
      reset({ aboutText: content.aboutText ?? '' });
    }
  }, [content, reset]);

  function onSubmit(values: PageContentFormValues) {
    upsert(
      {
        id: categoryId,
        locale,
        payload: { aboutText: values.aboutText || null },
      },
      {
        onSuccess: () => toast.success(`${LOCALE_LABELS[locale]} page content saved.`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save page content.'),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field>
        <Label className="text-xs font-semibold">About Text</Label>
        <Textarea
          {...register('aboutText')}
          placeholder={`About this category in ${LOCALE_LABELS[locale]}...`}
          rows={8}
        />
        <FieldDescription>
          Rich editorial content displayed on the category&apos;s about section. Meta title and
          description are managed in the SEO tab.
        </FieldDescription>
      </Field>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving...' : `Save ${LOCALE_LABELS[locale]} Content`}
        </Button>
      </div>
    </form>
  );
}

interface CategoryPageContentFormProps {
  categoryId: string;
}

export function CategoryPageContentForm({ categoryId }: CategoryPageContentFormProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Page Content</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <Tabs defaultValue="en">
          <div className="pb-2 mb-6">
            <TabsList>
              {ALL_LOCALES.map((locale) => (
                <TabsTrigger key={locale} value={locale} className="px-2.5 sm:px-4">
                  <span className="sm:hidden">{locale}</span>
                  <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {ALL_LOCALES.map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocalePageContentTab categoryId={categoryId} locale={locale} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
