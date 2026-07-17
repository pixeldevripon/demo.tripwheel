'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageSelectorField } from '@/components/media/image-selector-field';
import {
  useDestinationPageContent,
  useDestinationTranslationByLocale,
  useUpdateDestination,
  useUpsertPageContent,
} from '@/hooks/destinations/use-destinations';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import type { DestinationDetail } from '@/types/destination';

// Recommended search-engine limits (soft caps).
const META_TITLE_MAX = 70;
const META_DESC_MAX = 170;

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:-]+$/, '')}...`;
}

// ── Social sharing (destination OG image) ───────────────────────────────────

const socialSchema = z.object({
  ogImage: z.string().max(500).optional().or(z.literal('')),
});
type SocialValues = z.infer<typeof socialSchema>;

function SocialCard({ destination }: { destination: DestinationDetail }) {
  const { mutate: updateDestination, isPending } = useUpdateDestination();

  const { handleSubmit, control, reset } = useForm<SocialValues>({
    resolver: zodResolver(socialSchema),
    defaultValues: { ogImage: destination.ogImage ?? '' },
  });

  useEffect(() => {
    reset({ ogImage: destination.ogImage ?? '' });
  }, [destination, reset]);

  function onSubmit(values: SocialValues) {
    updateDestination(
      { id: destination.id, payload: { ogImage: values.ogImage || null } },
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
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
          Social Sharing
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field>
            <Label className="text-xs font-semibold uppercase">Social Share Image (OG)</Label>
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
              Image shown when this destination is shared on social media (the Open Graph image).
              Falls back to the hero image when empty.
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

// ── Per-locale meta (search-engine listing) ─────────────────────────────────
// metaTitle / metaDescription live on DestinationPageContent; saved via a partial
// page-content upsert (the backend merges field-by-field, so aboutText is untouched).

const metaSchema = z.object({
  metaTitle: z.string().max(META_TITLE_MAX).optional().or(z.literal('')),
  metaDescription: z.string().max(META_DESC_MAX).optional().or(z.literal('')),
});
type MetaValues = z.infer<typeof metaSchema>;

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len > max;
  return (
    <span className={`text-xs tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
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
  return (
    <div className="border border-border bg-muted/30 px-4 py-3 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Search preview
      </p>
      <p className="text-[13px] leading-[1.4] text-success-fg truncate">
        islandtours.com › {slug || 'destination'}
      </p>
      <p className="text-[18px] leading-[1.3] text-[#1a0dab] truncate">
        {title || `${destinationName || 'Destination'} tours & activities`}
      </p>
      <p className="text-[13px] leading-[1.4] text-muted-foreground line-clamp-2">
        {description ||
          'Your meta description preview shows here. Keep it compelling and under the character limit.'}
      </p>
    </div>
  );
}

interface MetaLocalePanelProps {
  destination: DestinationDetail;
  locale: Locale;
  isEnglish?: boolean;
}

function MetaLocalePanel({ destination, locale, isEnglish = false }: MetaLocalePanelProps) {
  const { data: content, isLoading } = useDestinationPageContent(destination.id, locale);
  const { data: translation } = useDestinationTranslationByLocale(destination.id, locale);
  const { mutate: upsert, isPending } = useUpsertPageContent();

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

  // English falls back to the destination's canonical name/overview; other locales
  // use their translated name/overview when present.
  const localizedName = translation?.name || destination.name;
  const localizedOverview = isEnglish
    ? translation?.overview || destination.overview || ''
    : translation?.overview || '';

  const suggestedTitle = truncate(
    collapse(`${localizedName} Tours & Activities`),
    META_TITLE_MAX,
  );
  const suggestedDescription = truncate(collapse(localizedOverview), META_DESC_MAX);

  useEffect(() => {
    reset({
      metaTitle: content?.metaTitle ?? suggestedTitle,
      metaDescription: content?.metaDescription ?? suggestedDescription,
    });
    // suggested* derive from content/translation; those are the only triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, translation, reset]);

  const metaTitle = watch('metaTitle') ?? '';
  const metaDescription = watch('metaDescription') ?? '';

  function onSubmit(values: MetaValues) {
    upsert(
      {
        id: destination.id,
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
      <SerpPreview
        title={metaTitle}
        description={metaDescription}
        destinationName={localizedName}
        slug={destination.slug}
      />

      <Field>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase">Meta Title</Label>
          <CharCount value={metaTitle} max={META_TITLE_MAX} />
        </div>
        <Input
          {...register('metaTitle')}
          placeholder="Appears in the browser tab and search results"
          aria-invalid={!!errors.metaTitle}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription>
            Pre-filled from the {isEnglish ? 'destination name' : 'translated name'}. Edit to
            customize.
          </FieldDescription>
          <button
            type="button"
            onClick={() => setValue('metaTitle', suggestedTitle, { shouldDirty: true })}
            className="shrink-0 text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            Regenerate
          </button>
        </div>
        <FieldError>{errors.metaTitle?.message}</FieldError>
      </Field>

      <Field>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase">Meta Description</Label>
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
            className="shrink-0 text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
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

interface DestinationSeoTabProps {
  destination: DestinationDetail;
}

export function DestinationSeoTab({ destination }: DestinationSeoTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
            Search Engine Listing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground bg-muted px-3 py-2 mb-6 space-y-0.5">
            <p>
              <span className="font-semibold text-foreground">
                Meta title and description are per-locale.
              </span>{' '}
              They start pre-filled from each language&apos;s name and overview. Edit any locale to
              override, or leave the suggestion as-is.
            </p>
          </div>

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
              <MetaLocalePanel destination={destination} locale="en" isEnglish />
            </TabsContent>

            {ALL_LOCALES.filter((l) => l !== 'en').map((locale) => (
              <TabsContent key={locale} value={locale}>
                <MetaLocalePanel destination={destination} locale={locale} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <SocialCard destination={destination} />
    </div>
  );
}
