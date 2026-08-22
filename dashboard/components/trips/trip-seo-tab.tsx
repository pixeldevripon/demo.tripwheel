'use client';

import Link from 'next/link';

import { useStepCommit } from '@/components/trips/wizard/use-step-commit';
import { truncateMeta } from '@/lib/trips/seo';
import { Badge } from '@/components/ui/badge';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    useTripTranslationByLocale,
    useUpdateTrip,
    useUpsertTripTranslation,
} from '@/hooks/trips/use-trips';
import { type Locale } from '@/lib/constants/locales';
import type { WizardStepId } from '@/lib/trips/wizard-steps';
import type { TripListItem } from '@/types/trip';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

// Recommended search-engine limits (soft caps; the backend enforces the hard max).
const META_TITLE_MAX = 70;
const META_DESC_MAX = 170;

/** Collapse runs of whitespace to single spaces and trim. */
function collapse(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

// Word-boundary meta truncation lives in lib/trips/seo (pure + unit-tested); the
// previous inline version could return max+2 chars and silently fail validation.

// ── Social sharing (tour-wide OG image) ─────────────────────────────────────
// Lives on the Tour row; saves via useUpdateTrip (partial, field-by-field).

// Meta title/description are stored per-locale on the tour TRANSLATION (the trip
// fields are untouched). Both are pre-filled from the locale's display title /
// description so the operator starts from a sensible value.

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
            className={`text-xs tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
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
    const crumb = destinationName
        ? `${destinationName} › ${slug || 'tour'}`
        : slug || 'tour';
    return (
        <div className='border border-border bg-muted/30 px-4 py-3 space-y-1'>
            <p className='text-xs font-medium text-muted-foreground'>
                Search preview
            </p>
            <p className='text-sm text-success-fg truncate'>
                islandtours.com › {crumb}
            </p>
            <p className='text-lg text-info-fg truncate'>
                {title || 'Your tour title will appear here'}
            </p>
            <p className='text-sm text-muted-foreground line-clamp-2'>
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
    /**
     * Wizard step this panel lives on. It registers its save with that step's
     * footer instead of drawing its own button - three primary buttons stacked
     * down one screen ("Save SEO", "Save Changes", "Save changes") gave the
     * operator no way to know which one meant "I am done with this step".
     */
    step: WizardStepId;
}

function MetaLocalePanel({
    tripId,
    locale,
    tripName,
    destinationName,
    slug,
    isEnglish = false,
    step,
}: MetaLocalePanelProps) {
    const { data: translation, isLoading } = useTripTranslationByLocale(
        tripId,
        locale
    );
    const { mutateAsync: upsertAsync, isPending } = useUpsertTripTranslation();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isDirty },
    } = useForm<MetaValues>({
        resolver: zodResolver(metaSchema),
        defaultValues: { metaTitle: '', metaDescription: '' },
    });

    // Suggested values calculated from the locale's display title + description.
    const suggestedTitle = truncateMeta(
        collapse(translation?.title || tripName),
        META_TITLE_MAX
    );
    const suggestedDescription = truncateMeta(
        collapse(
            translation?.shortDescription ||
                translation?.overview ||
                translation?.description ||
                ''
        ),
        META_DESC_MAX
    );

    // Sync from the loaded translation, but never over the operator's unsaved
    // edits: on the reach step a sibling tier/spotlight save (or a plain window
    // refocus after 30s) refetches this translation, and an unconditional reset
    // wiped the in-progress meta title/description AND cleared isDirty so the step
    // reported "clean" and Continue advanced without saving. (code-review C1.)
    useSyncFormWhenPristine(
        reset,
        isDirty,
        () => ({
            // Pre-fill with the calculated value when nothing has been saved yet.
            metaTitle: translation?.metaTitle ?? suggestedTitle,
            metaDescription:
                translation?.metaDescription ?? suggestedDescription,
        }),
        translation,
    );

    const metaTitle = watch('metaTitle') ?? '';
    const metaDescription = watch('metaDescription') ?? '';

    // The meta pair is its own record (the tour TRANSLATION for this locale),
    // so it stays a separate writer from the step's trip PATCH - it just no
    // longer has its own button. Disjoint payloads: `buildTourCopyPayload` on
    // the description step filters metaTitle/metaDescription out, so the two
    // translation writers never touch the same keys.
    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(async values => {
            try {
                await upsertAsync({
                    tripId,
                    locale,
                    payload: {
                        metaTitle: values.metaTitle || null,
                        metaDescription: values.metaDescription || null,
                    },
                } as never);
                // Pristine at the values just persisted. Without this the step
                // keeps saying "Unsaved changes" over work that is already
                // saved, and `useSyncFormWhenPristine` will not re-sync the
                // refetch either, because it (correctly) refuses to clobber a
                // dirty form.
                reset(values);
                ok = true;
            } catch (err) {
                toast.error(
                    err instanceof Error ? err.message : 'Failed to save SEO.'
                );
                ok = false;
            }
        })();
        return ok;
    }, [handleSubmit, upsertAsync, tripId, locale, reset]);

    useStepCommit(step, { submit, isPending, isDirty });

    if (isLoading) {
        return (
            <div className='space-y-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-10 w-full rounded-md' />
                ))}
            </div>
        );
    }

    return (
        // No onSubmit: this form is driven by the step footer, not by a button
        // of its own. A bare <form> keeps the fields grouped for assistive tech
        // and stops Enter from submitting something that no longer exists.
        <form
            onSubmit={e => e.preventDefault()}
            className='space-y-6'>
            {translation?.isMachineTranslated && (
                <div className='flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2'>
                    <Badge variant='secondary'>Machine Translated</Badge>
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
                <div className='flex items-center justify-between'>
                    <Label>Meta Title</Label>
                    <CharCount value={metaTitle} max={META_TITLE_MAX} />
                </div>
                <Input
                    {...register('metaTitle')}
                    placeholder='Overrides the page title'
                    aria-invalid={!!errors.metaTitle}
                />
                <div className='flex items-center justify-between gap-3'>
                    <FieldDescription>
                        Pre-filled from the{' '}
                        {isEnglish ? 'tour name' : 'display title'}. Edit to
                        customize.
                    </FieldDescription>
                    <button
                        type='button'
                        onClick={() =>
                            setValue('metaTitle', suggestedTitle, {
                                shouldDirty: true,
                            })
                        }
                        className='shrink-0 text-xs font-medium text-primary hover:underline'>
                        Regenerate
                    </button>
                </div>
                <FieldError>{errors.metaTitle?.message}</FieldError>
            </Field>

            <Field>
                <div className='flex items-center justify-between'>
                    <Label>Meta Description</Label>
                    <CharCount value={metaDescription} max={META_DESC_MAX} />
                </div>
                <Textarea
                    {...register('metaDescription')}
                    rows={3}
                    placeholder='Search-result snippet'
                    aria-invalid={!!errors.metaDescription}
                />
                <div className='flex items-center justify-between gap-3'>
                    <FieldDescription>
                        Pre-filled from the{' '}
                        {isEnglish ? 'overview' : 'translated overview'}. Edit
                        to customize.
                    </FieldDescription>
                    <button
                        type='button'
                        onClick={() =>
                            setValue('metaDescription', suggestedDescription, {
                                shouldDirty: true,
                            })
                        }
                        className='shrink-0 text-xs font-medium text-primary hover:underline'>
                        Regenerate
                    </button>
                </div>
                <FieldError>{errors.metaDescription?.message}</FieldError>
            </Field>

        </form>
    );
}

// ── Tab entry point ─────────────────────────────────────────────────────────

interface TripSeoTabProps {
    trip: TripListItem;
}

/**
 * The search-engine listing panel on its own, without the Card chrome or the
 * social block. Exported for the wizard's reach step, which gives each of the
 * two a section of its own.
 */
export function SeoListingSection({
    trip,
    step,
}: TripSeoTabProps & { step: WizardStepId }) {
    const destinationName = trip.destinationName ?? '';

    return (
        <div>
            <div className='text-xs text-muted-foreground bg-muted px-3 py-2 mb-6 space-y-0.5'>
                <p>
                    <span className='font-medium text-foreground'>
                        Meta title and description are per-locale.
                    </span>{' '}
                    They start pre-filled from each language&apos;s title and
                    overview. Edit any locale to override, or leave the
                    suggestion as-is.
                </p>
            </div>

            <MetaLocalePanel
                tripId={trip.id}
                locale='en'
                tripName={trip.name}
                destinationName={destinationName}
                slug={trip.slug}
                step={step}
            />
            <p className='mt-4 text-xs text-content-muted'>
                English only here - translate into the other languages in the{' '}
                <Link
                    href={`/translations/tour/${trip.id}/es`}
                    className='underline underline-offset-4 hover:text-primary'>
                    Translation Console
                </Link>
                .
            </p>
        </div>
    );
}

