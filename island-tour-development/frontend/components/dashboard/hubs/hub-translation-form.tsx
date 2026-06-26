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
  useHubTranslationByLocale,
  useUpsertHubTranslation,
  useDeleteHubTranslation,
} from '@/hooks/hubs/use-hubs';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

const translationSchema = z.object({
  name: z.string().min(1, 'Name is required').optional().or(z.literal('')),
  overview: z.string().optional().or(z.literal('')),
  h1Override: z.string().optional().or(z.literal('')),
  breadcrumbLabel: z.string().optional().or(z.literal('')),
});

type TranslationFormValues = z.infer<typeof translationSchema>;

interface LocaleTabProps {
  hubId: string;
  locale: Locale;
  disableNameField?: boolean;
}

function LocaleTab({ hubId, locale, disableNameField }: LocaleTabProps) {
  const { data: translation, isLoading } = useHubTranslationByLocale(hubId, locale);
  const { mutate: upsert, isPending: isUpserting } = useUpsertHubTranslation();
  const { mutate: deleteTranslation, isPending: isDeleting } = useDeleteHubTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TranslationFormValues>({
    resolver: zodResolver(translationSchema),
    defaultValues: { name: '', overview: '', h1Override: '', breadcrumbLabel: '' },
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
        id: hubId,
        locale,
        payload: {
          fields: {
            name: values.name || null,
            overview: values.overview || null,
            h1Override: values.h1Override || null,
            breadcrumbLabel: values.breadcrumbLabel || null,
          },
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
    if (disableNameField) {
      upsert(
        {
          id: hubId,
          locale,
          payload: { fields: { overview: null, h1Override: null, breadcrumbLabel: null } },
        },
        {
          onSuccess: () => {
            toast.success('English optional fields cleared.');
            setShowDeleteConfirm(false);
            reset((prev) => ({ ...prev, overview: '', h1Override: '', breadcrumbLabel: '' }));
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : 'Failed to clear fields.'),
        }
      );
    } else {
      deleteTranslation(
        { id: hubId, locale },
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
        <Input
          {...register('name')}
          placeholder={`Name in ${LOCALE_LABELS[locale]}`}
          aria-invalid={!!errors.name}
          readOnly={disableNameField}
          className={disableNameField ? 'opacity-60 cursor-not-allowed' : undefined}
        />
        {disableNameField ? (
          <FieldDescription>Name is managed in the Details tab.</FieldDescription>
        ) : (
          <FieldError>{errors.name?.message}</FieldError>
        )}
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
        <FieldDescription>Overrides the default H1 heading on the hub page.</FieldDescription>
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
              {disableNameField ? 'Clear Fields' : 'Delete Translation'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Are you sure?</span>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={handleDelete}
                disabled={disableNameField ? isUpserting : isDeleting}
              >
                {disableNameField
                  ? isUpserting ? 'Clearing...' : 'Yes, clear'
                  : isDeleting ? 'Deleting...' : 'Yes, delete'}
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

interface HubTranslationFormProps {
  hubId: string;
  hubName: string;
}

export function HubTranslationForm({ hubId, hubName }: HubTranslationFormProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Translations - {hubName}</CardTitle>
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

          <TabsContent value="en">
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
                English is the base locale. Name is read-only - edit it in the Details tab.
              </div>
              <LocaleTab hubId={hubId} locale="en" disableNameField />
            </div>
          </TabsContent>

          {(['es', 'nl', 'pt', 'fr', 'de', 'zh'] as Locale[]).map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocaleTab hubId={hubId} locale={locale} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
