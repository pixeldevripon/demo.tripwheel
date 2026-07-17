'use client';

import Link from 'next/link';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDestinationPageContent,
  useUpsertPageContent,
} from '@/hooks/destinations/use-destinations';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

const pageContentSchema = z.object({
  aboutText: z.string().optional().or(z.literal('')),
});

type PageContentFormValues = z.infer<typeof pageContentSchema>;

interface LocalePageContentTabProps {
  destinationId: string;
  locale: Locale;
}

function LocalePageContentTab({ destinationId, locale }: LocalePageContentTabProps) {
  const { data: content, isLoading } = useDestinationPageContent(destinationId, locale);
  const { mutate: upsert, isPending } = useUpsertPageContent();

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<PageContentFormValues>({
    resolver: zodResolver(pageContentSchema),
    defaultValues: {
      aboutText: '',
    },
  });

  useEffect(() => {
    if (content) {
      reset({
        aboutText: content.aboutText ?? '',
      });
    }
  }, [content, reset]);

  function onSubmit(values: PageContentFormValues) {
    upsert(
      {
        id: destinationId,
        locale,
        payload: {
          aboutText: values.aboutText || null,
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
        <Label>About Text</Label>
        <Textarea
          {...register('aboutText')}
          placeholder={`About this destination in ${LOCALE_LABELS[locale]}...`}
          rows={8}
        />
        <FieldDescription>
          Rich editorial content displayed on the destination&apos;s about section. Search-engine
          meta title and description live in the SEO tab.
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

interface DestinationPageContentFormProps {
  destinationId: string;
}

export function DestinationPageContentForm({ destinationId }: DestinationPageContentFormProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Page Content</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <LocalePageContentTab destinationId={destinationId} locale='en' />
        <p className="mt-4 text-xs text-content-muted">
          English only here - translate into the other languages in the{' '}
          <Link
            href={`/translations/destination/${destinationId}/es`}
            className="underline underline-offset-4 hover:text-primary"
          >
            Translation Console
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
