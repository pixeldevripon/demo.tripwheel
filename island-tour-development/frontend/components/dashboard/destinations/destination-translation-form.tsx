'use client';

import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDestination,
  useDestinationTranslationByLocale,
  useUpsertTranslation,
  useDeleteTranslation,
} from '@/hooks/destinations/use-destinations';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

const translationSchema = z.object({
  name: z.string().min(1, 'Name is required').optional().or(z.literal('')),
  overview: z.string().optional().or(z.literal('')),
  h1Override: z.string().optional().or(z.literal('')),
  breadcrumbLabel: z.string().optional().or(z.literal('')),
});

type TranslationFormValues = z.infer<typeof translationSchema>;

interface LocaleTabProps {
  destinationId: string;
  locale: Locale;
}

function LocaleTab({ destinationId, locale }: LocaleTabProps) {
  const { data: translation, isLoading } = useDestinationTranslationByLocale(destinationId, locale);
  const { mutate: upsert, isPending: isUpserting } = useUpsertTranslation();
  const { mutate: deleteTranslation, isPending: isDeleting } = useDeleteTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TranslationFormValues>({
    resolver: zodResolver(translationSchema),
    defaultValues: {
      name: '',
      overview: '',
      h1Override: '',
      breadcrumbLabel: '',
    },
  });

  useEffect(() => {
    if (translation) {
      reset({
        name: translation.name ?? '',
        overview: translation.overview ?? '',
        h1Override: translation.h1Override ?? '',
        breadcrumbLabel: translation.breadcrumbLabel ?? '',
      });
    }
  }, [translation, reset]);

  function onSubmit(values: TranslationFormValues) {
    upsert(
      {
        id: destinationId,
        locale,
        payload: {
          name: values.name || null,
          overview: values.overview || null,
          h1Override: values.h1Override || null,
          breadcrumbLabel: values.breadcrumbLabel || null,
        },
      },
      {
        onSuccess: () => toast.success(`${LOCALE_LABELS[locale]} translation saved.`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save translation.'),
      }
    );
  }

  function handleDelete() {
    deleteTranslation(
      { id: destinationId, locale },
      {
        onSuccess: () => {
          toast.success(`${LOCALE_LABELS[locale]} translation deleted.`);
          setShowDeleteConfirm(false);
          reset({ name: '', overview: '', h1Override: '', breadcrumbLabel: '' });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to delete translation.'),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {translation?.isMachineTranslated && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2">
          <Badge variant="secondary">Machine Translated</Badge>
          <span>This translation was auto-generated.</span>
        </div>
      )}

      <Field>
        <Label className="text-xs font-semibold uppercase">Name</Label>
        <Input {...register('name')} placeholder={`Name in ${LOCALE_LABELS[locale]}`} aria-invalid={!!errors.name} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Overview</Label>
        <Textarea
          {...register('overview')}
          placeholder={`Overview in ${LOCALE_LABELS[locale]}`}
          rows={4}
        />
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">H1 Override</Label>
        <Input {...register('h1Override')} placeholder="Custom H1 heading" />
        <FieldDescription>Overrides the default H1 heading on the destination page.</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Breadcrumb Label</Label>
        <Input {...register('breadcrumbLabel')} placeholder="Custom breadcrumb text" />
        <FieldDescription>Short label used in breadcrumb navigation.</FieldDescription>
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div>
          {!showDeleteConfirm ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Translation
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Are you sure?</span>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
        <Button type="submit" size="sm" disabled={isUpserting}>
          {isUpserting ? 'Saving...' : 'Save Translation'}
        </Button>
      </div>
    </form>
  );
}

interface DestinationTranslationFormProps {
  destinationId: string;
  destinationName: string;
}

export function DestinationTranslationForm({
  destinationId,
  destinationName,
}: DestinationTranslationFormProps) {
  const { data: baseDestination, isLoading: isLoadingBase } = useDestination(destinationId, 'en');

  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Translations — {destinationName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <Tabs defaultValue="en">
          <TabsList variant="line" className="mb-6">
            {ALL_LOCALES.map((locale) => (
              <TabsTrigger key={locale} value={locale}>
                {LOCALE_LABELS[locale]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="en">
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
                English is the base locale. Edit the base values in the Details tab.
              </div>
              {isLoadingBase ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Name</Label>
                    <Input value={baseDestination?.name ?? ''} readOnly className="bg-muted" />
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Overview</Label>
                    <Textarea
                      value={baseDestination?.overview ?? ''}
                      readOnly
                      className="bg-muted"
                      rows={4}
                    />
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">H1 Override</Label>
                    <Input value={baseDestination?.h1Override ?? ''} readOnly className="bg-muted" />
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Breadcrumb Label</Label>
                    <Input value={baseDestination?.breadcrumbLabel ?? ''} readOnly className="bg-muted" />
                  </Field>
                </div>
              )}
            </div>
          </TabsContent>

          {(['es', 'nl', 'pt', 'fr', 'de', 'zh'] as Locale[]).map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocaleTab destinationId={destinationId} locale={locale} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
