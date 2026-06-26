'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCollectionPageContent,
  useUpsertCollectionPageContent,
} from '@/hooks/collections/use-collections';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

const pageContentSchema = z.object({
  aboutText: z.string().optional().or(z.literal('')),
  metaTitle: z.string().optional().or(z.literal('')),
  metaDescription: z
    .string()
    .max(160, 'Meta description must be 160 characters or fewer')
    .optional()
    .or(z.literal('')),
});

type PageContentFormValues = z.infer<typeof pageContentSchema>;

interface LocalePageContentTabProps {
  collectionId: string;
  locale: Locale;
}

function LocalePageContentTab({ collectionId, locale }: LocalePageContentTabProps) {
  const { data: content, isLoading } = useCollectionPageContent(collectionId, locale);
  const { mutate: upsert, isPending } = useUpsertCollectionPageContent();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PageContentFormValues>({
    resolver: zodResolver(pageContentSchema),
    defaultValues: { aboutText: '', metaTitle: '', metaDescription: '' },
  });

  const metaDescValue = watch('metaDescription') ?? '';

  useEffect(() => {
    if (content) {
      reset({
        aboutText: content.aboutText ?? '',
        metaTitle: content.metaTitle ?? '',
        metaDescription: content.metaDescription ?? '',
      });
    }
  }, [content, reset]);

  function onSubmit(values: PageContentFormValues) {
    upsert(
      {
        id: collectionId,
        locale,
        payload: {
          aboutText: values.aboutText || null,
          metaTitle: values.metaTitle || null,
          metaDescription: values.metaDescription || null,
        },
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
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field>
        <Label className="text-xs font-semibold uppercase">About Text</Label>
        <Textarea
          {...register('aboutText')}
          placeholder={`About this collection in ${LOCALE_LABELS[locale]}...`}
          rows={8}
        />
        <FieldDescription>
          Rich editorial content displayed on the collection&apos;s about section.
        </FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Meta Title</Label>
        <Input
          {...register('metaTitle')}
          placeholder="SEO page title"
          aria-invalid={!!errors.metaTitle}
        />
        <FieldError>{errors.metaTitle?.message}</FieldError>
        <FieldDescription>Appears in browser tab and search engine results.</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Meta Description</Label>
        <Textarea
          {...register('metaDescription')}
          placeholder="Brief description for search engines (max 160 characters)"
          rows={3}
          aria-invalid={!!errors.metaDescription}
        />
        <div className="flex items-center justify-between">
          <FieldError>{errors.metaDescription?.message}</FieldError>
          <span
            className={`text-xs tabular-nums ${
              metaDescValue.length > 160 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {metaDescValue.length}/160
          </span>
        </div>
      </Field>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving...' : `Save ${LOCALE_LABELS[locale]} Content`}
        </Button>
      </div>
    </form>
  );
}

interface CollectionPageContentFormProps {
  collectionId: string;
}

export function CollectionPageContentForm({ collectionId }: CollectionPageContentFormProps) {
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
                  <span className="sm:hidden uppercase">{locale}</span>
                  <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {ALL_LOCALES.map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocalePageContentTab collectionId={collectionId} locale={locale} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
