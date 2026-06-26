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

// The three list fields are typed as `string[]` by the backend. We edit them as a
// textarea (one item per line) and convert on save / load.
const tripTranslationSchema = z.object({
  title: z.string().max(120).optional().or(z.literal('')),
  overview: z.string().max(3000).optional().or(z.literal('')),
  description: z.string().max(10000).optional().or(z.literal('')),
  shortDescription: z.string().max(200).optional().or(z.literal('')),
  whatToBring: z.string().max(2000).optional().or(z.literal('')),
  knowBeforeYouGo: z.string().max(2000).optional().or(z.literal('')),
  notSuitableFor: z.string().max(2000).optional().or(z.literal('')),
  whatToExpectIntro: z.string().max(1000).optional().or(z.literal('')),
  categoryDisplay: z.string().max(120).optional().or(z.literal('')),
  localTip: z.string().max(2000).optional().or(z.literal('')),
  meetingPointText: z.string().max(2000).optional().or(z.literal('')),
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(170).optional().or(z.literal('')),
});

type TripTranslationFormValues = z.infer<typeof tripTranslationSchema>;

const EMPTY_FORM: TripTranslationFormValues = {
  title: '',
  overview: '',
  description: '',
  shortDescription: '',
  whatToBring: '',
  knowBeforeYouGo: '',
  notSuitableFor: '',
  whatToExpectIntro: '',
  categoryDisplay: '',
  localTip: '',
  meetingPointText: '',
  metaTitle: '',
  metaDescription: '',
};

/** Textarea text (one item per line) → trimmed, de-blanked string array. */
function linesToArray(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** String array → newline-joined textarea text. */
function arrayToLines(value: string[] | null | undefined): string {
  return (value ?? []).join('\n');
}

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
    defaultValues: { ...EMPTY_FORM, title: isEnglish ? tripName : '' },
  });

  useEffect(() => {
    reset({
      title: translation?.title ?? (isEnglish ? tripName : ''),
      overview: translation?.overview ?? '',
      description: translation?.description ?? '',
      shortDescription: translation?.shortDescription ?? '',
      whatToBring: arrayToLines(translation?.whatToBring),
      knowBeforeYouGo: arrayToLines(translation?.knowBeforeYouGo),
      notSuitableFor: arrayToLines(translation?.notSuitableFor),
      whatToExpectIntro: translation?.whatToExpectIntro ?? '',
      categoryDisplay: translation?.categoryDisplay ?? '',
      localTip: translation?.localTip ?? '',
      meetingPointText: translation?.meetingPointText ?? '',
      metaTitle: translation?.metaTitle ?? '',
      metaDescription: translation?.metaDescription ?? '',
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
          shortDescription: values.shortDescription || null,
          whatToBring: linesToArray(values.whatToBring),
          knowBeforeYouGo: linesToArray(values.knowBeforeYouGo),
          notSuitableFor: linesToArray(values.notSuitableFor),
          whatToExpectIntro: values.whatToExpectIntro || null,
          categoryDisplay: values.categoryDisplay || null,
          localTip: values.localTip || null,
          meetingPointText: values.meetingPointText || null,
          metaTitle: values.metaTitle || null,
          metaDescription: values.metaDescription || null,
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
      // Clear optional fields - backend blocks deleting EN
      upsert(
        {
          tripId,
          locale,
          payload: {
            title: null,
            overview: null,
            description: null,
            shortDescription: null,
            whatToBring: [],
            knowBeforeYouGo: [],
            notSuitableFor: [],
            whatToExpectIntro: null,
            categoryDisplay: null,
            localTip: null,
            meetingPointText: null,
            metaTitle: null,
            metaDescription: null,
          },
        },
        {
          onSuccess: () => {
            toast.success('English translation fields cleared.');
            setShowDeleteConfirm(false);
            reset(EMPTY_FORM);
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
            reset(EMPTY_FORM);
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

      <Field>
        <Label className="text-xs font-semibold uppercase">Short Description</Label>
        <Input
          {...register('shortDescription')}
          placeholder="One-line teaser for cards"
          aria-invalid={!!errors.shortDescription}
        />
        <FieldDescription>Shown on listing cards. Keep it under ~200 characters.</FieldDescription>
        <FieldError>{errors.shortDescription?.message}</FieldError>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">What to Bring</Label>
        <Textarea {...register('whatToBring')} rows={4} placeholder={'Swimwear\nTowel\nReef-safe sunscreen'} />
        <FieldDescription>One item per line (max 8). Each line becomes a separate bullet.</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Know Before You Go</Label>
        <Textarea {...register('knowBeforeYouGo')} rows={4} placeholder={'Bring a valid photo ID\nTour runs rain or shine'} />
        <FieldDescription>One item per line (max 10).</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Not Suitable For</Label>
        <Textarea {...register('notSuitableFor')} rows={3} placeholder={'Travellers who are pregnant\nWheelchair users'} />
        <FieldDescription>One item per line (max 6).</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">What to Expect (intro)</Label>
        <Textarea {...register('whatToExpectIntro')} rows={3} placeholder="Short intro shown above the itinerary." />
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Category Display</Label>
        <Input {...register('categoryDisplay')} placeholder="e.g. Snorkeling Tours" />
        <FieldDescription>Plural noun phrase used in headings (e.g. &ldquo;Snorkeling Tours in Curaçao&rdquo;).</FieldDescription>
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Local Tip</Label>
        <Textarea {...register('localTip')} rows={2} placeholder="An insider tip from the operator" />
      </Field>

      <Field>
        <Label className="text-xs font-semibold uppercase">Meeting Point Text</Label>
        <Textarea {...register('meetingPointText')} rows={2} placeholder="e.g. Meet at the main dock, Pier 3, 15 minutes before departure" />
      </Field>

      <div className="border-t pt-5 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search engine listing (SEO)</p>
        <Field>
          <Label className="text-xs font-semibold uppercase">Meta Title</Label>
          <Input {...register('metaTitle')} placeholder="Overrides the page <title>" aria-invalid={!!errors.metaTitle} />
          <FieldDescription>Keep under 70 characters. Leave blank to auto-generate.</FieldDescription>
          <FieldError>{errors.metaTitle?.message}</FieldError>
        </Field>
        <Field>
          <Label className="text-xs font-semibold uppercase">Meta Description</Label>
          <Textarea {...register('metaDescription')} rows={2} placeholder="Search-result snippet" aria-invalid={!!errors.metaDescription} />
          <FieldDescription>Keep under 170 characters.</FieldDescription>
          <FieldError>{errors.metaDescription?.message}</FieldError>
        </Field>
      </div>

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
        <CardTitle>Translations - {tripName}</CardTitle>
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

          {ALL_LOCALES.filter((l) => l !== 'en').map((locale) => (
            <TabsContent key={locale} value={locale}>
              <LocaleTab tripId={tripId} locale={locale} tripName={tripName} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
