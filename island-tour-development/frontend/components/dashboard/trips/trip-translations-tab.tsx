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
  useTripTranslationByLocale,
  useUpsertTripTranslation,
  useDeleteTripTranslation,
} from '@/hooks/trips/use-trips';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

const tripTranslationSchema = z.object({
  title: z.string().max(120).optional().or(z.literal('')),
  overview: z.string().max(3000).optional().or(z.literal('')),
  description: z.string().max(10000).optional().or(z.literal('')),
});

type TripTranslationFormValues = z.infer<typeof tripTranslationSchema>;

interface LocaleTabProps {
  tripId: string;
  locale: Locale;
  tripName: string;
  isEnglish?: boolean;
}

function LocaleTab({ tripId, locale, tripName, isEnglish = false }: LocaleTabProps) {
  const { data: translation, isLoading } = useTripTranslationByLocale(tripId, locale);
  const { mutate: upsert, isPending: isUpserting } = useUpsertTripTranslation();
  const { mutate: deleteTranslation, isPending: isDeleting } = useDeleteTripTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TripTranslationFormValues>({
    resolver: zodResolver(tripTranslationSchema),
    defaultValues: { title: isEnglish ? tripName : '', overview: '', description: '' },
  });

  useEffect(() => {
    reset({
      title: translation?.title ?? (isEnglish ? tripName : ''),
      overview: translation?.overview ?? '',
      description: translation?.description ?? '',
    });
  }, [translation, reset, isEnglish, tripName]);

  function onSubmit(values: TripTranslationFormValues) {
    upsert(
      {
        tripId,
        locale,
        payload: {
          title: values.title || null,
          overview: values.overview || null,
          description: values.description || null,
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
    if (isEnglish) {
      // Clear optional fields — backend blocks deleting EN
      upsert(
        {
          tripId,
          locale,
          payload: { title: null, overview: null, description: null },
        },
        {
          onSuccess: () => {
            toast.success('English translation fields cleared.');
            setShowDeleteConfirm(false);
            reset({ title: '', overview: '', description: '' });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : 'Failed to clear fields.'),
        }
      );
    } else {
      deleteTranslation(
        { tripId, locale },
        {
          onSuccess: () => {
            toast.success(`${LOCALE_LABELS[locale]} translation deleted.`);
            setShowDeleteConfirm(false);
            reset({ title: '', overview: '', description: '' });
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
        {Array.from({ length: 3 }).map((_, i) => (
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
        <Label className="text-xs font-semibold uppercase">Display Title</Label>
        <Input
          {...register('title')}
          placeholder={`${LOCALE_LABELS[locale]} name for this trip`}
          aria-invalid={!!errors.title}
        />
        <FieldDescription>
          The trip name shown to travelers in {LOCALE_LABELS[locale]}. When set, replaces
          &ldquo;{tripName}&rdquo; on the page title and H1. Leave blank to keep the English name.
        </FieldDescription>
        <FieldError>{errors.title?.message}</FieldError>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">
          Overview{isEnglish && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          {...register('overview')}
          placeholder={`Overview in ${LOCALE_LABELS[locale]}`}
          rows={4}
          aria-invalid={!!errors.overview}
        />
        {isEnglish && (
          <FieldDescription className="text-amber-600">
            Required for publishing. This overview appears on the trip listing.
          </FieldDescription>
        )}
        <FieldError>{errors.overview?.message}</FieldError>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Description</Label>
        <Textarea
          {...register('description')}
          placeholder={`Full description in ${LOCALE_LABELS[locale]}`}
          rows={8}
          aria-invalid={!!errors.description}
        />
        <FieldError>{errors.description?.message}</FieldError>
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
              {isEnglish ? 'Clear Fields' : 'Delete Translation'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Are you sure?</span>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={handleDelete}
                disabled={isEnglish ? isUpserting : isDeleting}
              >
                {isEnglish
                  ? isUpserting
                    ? 'Clearing...'
                    : 'Yes, clear'
                  : isDeleting
                  ? 'Deleting...'
                  : 'Yes, delete'}
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

interface TripTranslationsTabProps {
  tripId: string;
  tripName: string;
}

export function TripTranslationsTab({ tripId, tripName }: TripTranslationsTabProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Translations — {tripName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="en">
          <div className="overflow-x-auto pb-2 mb-6">
            <TabsList variant="line" className="w-max">
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
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 space-y-0.5">
                <p><span className="font-semibold text-foreground">English is the base locale.</span> Overview is required to publish.</p>
                <p>The canonical trip name (&ldquo;{tripName}&rdquo;) is set in the Details tab and is not edited here.</p>
              </div>
              <LocaleTab tripId={tripId} locale="en" tripName={tripName} isEnglish />
            </div>
          </TabsContent>

          {(['es', 'nl', 'pt', 'fr', 'de', 'zh'] as Locale[]).map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocaleTab tripId={tripId} locale={locale} tripName={tripName} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
