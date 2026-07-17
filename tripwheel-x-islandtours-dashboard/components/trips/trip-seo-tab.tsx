'use client';

import Link from 'next/link';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageSelectorField } from '@/components/media/image-selector-field';
import {
  useUpdateTrip,
  useTripTranslationByLocale,
  useUpsertTripTranslation,
} from '@/hooks/trips/use-trips';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import type { TripListItem } from '@/types/trip';

// Recommended search-engine limits (soft caps; the backend enforces the hard max).
const META_TITLE_MAX = 70;
const META_DESC_MAX = 170;

/** Collapse runs of whitespace to single spaces and trim. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Truncate at a word boundary near `max`, appending an ellipsis when cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:-]+$/, '')}...`;
}

// ── Social sharing (tour-wide OG image) ─────────────────────────────────────
// Lives on the Tour row; saves via useUpdateTrip (partial, field-by-field).

const socialSchema = z.object({
  ogImage: z.string().max(500).optional().or(z.literal('')),
});

type SocialValues = z.infer<typeof socialSchema>;

function SocialCard({ trip }: { trip: TripListItem }) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();

  const { handleSubmit, control, reset } = useForm<SocialValues>({
    resolver: zodResolver(socialSchema),
    defaultValues: { ogImage: trip.ogImage ?? '' },
  });

  useEffect(() => {
    reset({ ogImage: trip.ogImage ?? '' });
  }, [trip, reset]);

  function onSubmit(values: SocialValues) {
    updateTrip(
      { id: trip.id, payload: { ogImage: values.ogImage || null } },
      {
        onSuccess: () => toast.success('Social share image saved.'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-semibold">
          Social Sharing
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field>
            <Label>Social Share Image (OG)</Label>
            <Controller
              name="ogImage"
              control={control}
              render={({ field }) => (
                <ImageSelectorField
                  value={field.value || null}
                  onChange={(url) => field.onChange(url ?? '')}
                />
              )}
            />
            <FieldDescription>
              Image shown when this trip is shared on social media (the Open Graph image). Falls back
              to the hero image when empty.
            </FieldDescription>
          </Field>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Per-locale SEO (search-engine listing) ──────────────────────────────────
// metaTitle / metaDescription live on TourTranslation; save via a partial
// translation upsert (the backend merges field-by-field, so other translation
// fields are untouched). Both fields are pre-filled from the locale's display
// title / description so the operator starts from a sensible value.

const metaSchema = z.object({
  metaTitle: z.string().max(META_TITLE_MAX).optional().or(z.literal('')),
  metaDescription: z.string().max(META_DESC_MAX).optional().or(z.literal('')),
});

type MetaValues = z.infer<typeof metaSchema>;

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len > max;
  return (
    <span
      className={`text-xs tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {len}/{max}
    </span>
  );
}

function SerpPreview({
  title,
  description,
  destinationName,
  slug,
}: {
  title: string;
  description: string;
  destinationName: string;
  slug: string;
}) {
  const crumb = destinationName ? `${destinationName} › ${slug || 'tour'}` : slug || 'tour';
 return (
 <div className="border border-border bg-muted/30 px-4 py-3 space-y-1">
 <p className="text-xs font-semibold text-muted-foreground">
 Search preview
 </p>
 <p className="text-[13px] leading-[1.4] text-success-fg truncate">
 islandtours.com › {crumb}
 </p>
 <p className="text-[18px] leading-[1.3] text-[#1a0dab] truncate">
 {title ||'Your tour title will appear here'}
      </p>
      <p className="text-[13px] leading-[1.4] text-muted-foreground line-clamp-2">
        {description ||
          'Your meta description preview shows here. Keep it compelling and under the character limit.'}
      </p>
    </div>
  );
}

interface MetaLocalePanelProps {
  tripId: string;
  locale: Locale;
  tripName: string;
  destinationName: string;
  slug: string;
  isEnglish?: boolean;
}

function MetaLocalePanel({
  tripId,
  locale,
  tripName,
  destinationName,
  slug,
  isEnglish = false,
}: MetaLocalePanelProps) {
  const { data: translation, isLoading } = useTripTranslationByLocale(tripId, locale);
  const { mutate: upsert, isPending } = useUpsertTripTranslation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MetaValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: { metaTitle: '', metaDescription: '' },
  });

  // Suggested values calculated from the locale's display title + description.
  const suggestedTitle = truncate(collapse(translation?.title || tripName), META_TITLE_MAX);
  const suggestedDescription = truncate(
    collapse(translation?.shortDescription || translation?.overview || translation?.description || ''),
    META_DESC_MAX
  );

  useEffect(() => {
    reset({
      // Pre-fill with the calculated value when nothing has been saved yet.
      metaTitle: translation?.metaTitle ?? suggestedTitle,
      metaDescription: translation?.metaDescription ?? suggestedDescription,
    });
    // suggested* are derived from `translation`, so `translation` is the only trigger needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translation, reset]);

  const metaTitle = watch('metaTitle') ?? '';
  const metaDescription = watch('metaDescription') ?? '';

  function onSubmit(values: MetaValues) {
    upsert(
      {
        tripId,
        locale,
        payload: {
          metaTitle: values.metaTitle || null,
          metaDescription: values.metaDescription || null,
        },
      },
      {
        onSuccess: () => toast.success(`${LOCALE_LABELS[locale]} SEO saved.`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save SEO.'),
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
      {translation?.isMachineTranslated && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2">
          <Badge variant="secondary">Machine Translated</Badge>
          <span>This translation was auto-generated.</span>
        </div>
      )}

      <SerpPreview
        title={metaTitle}
        description={metaDescription}
        destinationName={destinationName}
        slug={slug}
      />

      <Field>
        <div className="flex items-center justify-between">
          <Label>Meta Title</Label>
          <CharCount value={metaTitle} max={META_TITLE_MAX} />
        </div>
        <Input
          {...register('metaTitle')}
          placeholder="Overrides the page title"
          aria-invalid={!!errors.metaTitle}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription>
            Pre-filled from the {isEnglish ? 'tour name' : 'display title'}. Edit to customize.
          </FieldDescription>
          <button
            type="button"
            onClick={() => setValue('metaTitle', suggestedTitle, { shouldDirty: true })}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Regenerate
          </button>
        </div>
        <FieldError>{errors.metaTitle?.message}</FieldError>
      </Field>

      <Field>
        <div className="flex items-center justify-between">
          <Label>Meta Description</Label>
          <CharCount value={metaDescription} max={META_DESC_MAX} />
        </div>
        <Textarea
          {...register('metaDescription')}
          rows={3}
          placeholder="Search-result snippet"
          aria-invalid={!!errors.metaDescription}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription>
            Pre-filled from the {isEnglish ? 'overview' : 'translated overview'}. Edit to customize.
          </FieldDescription>
          <button
            type="button"
            onClick={() =>
              setValue('metaDescription', suggestedDescription, { shouldDirty: true })
            }
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Regenerate
          </button>
        </div>
        <FieldError>{errors.metaDescription?.message}</FieldError>
      </Field>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save SEO'}
        </Button>
      </div>
    </form>
  );
}

// ── Tab entry point ─────────────────────────────────────────────────────────

interface TripSeoTabProps {
  trip: TripListItem;
}

export function TripSeoTab({ trip }: TripSeoTabProps) {
  const destinationName = trip.destinationName ?? '';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-semibold">
            Search Engine Listing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground bg-muted px-3 py-2 mb-6 space-y-0.5">
            <p>
              <span className="font-semibold text-foreground">
                Meta title and description are per-locale.
              </span>{' '}
              They start pre-filled from each language&apos;s title and overview. Edit any locale to
              override, or leave the suggestion as-is.
            </p>
          </div>

          <MetaLocalePanel
                  tripId={trip.id}
                  locale='en'
                  tripName={trip.name}
                  destinationName={destinationName}
                  slug={trip.slug}
                />
        <p className="mt-4 text-xs text-content-muted">
          English only here - translate into the other languages in the{' '}
          <Link
            href={`/translations/tour/${trip.id}/es`}
            className="underline underline-offset-4 hover:text-primary"
          >
            Translation Console
          </Link>
          .
        </p>
        </CardContent>
      </Card>

      <SocialCard trip={trip} />
    </div>
  );
}
