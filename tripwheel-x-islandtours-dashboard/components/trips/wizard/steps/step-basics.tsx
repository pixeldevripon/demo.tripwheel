'use client';

/**
 * Step 1 - Basics (07 §3).
 *
 * The only step that can mint a row, and therefore the only step whose shape
 * differs between create and edit:
 *
 * - **create** - asks exactly the four things `POST /tours` accepts and
 *   nothing more, then redirects into the draft at step 2. This is the same
 *   contract `TripCreateForm` had; the schema, the payload and every error
 *   string below are lifted from it unchanged.
 * - **edit** - the same four fields plus a read-only destination, saved
 *   through `tripToUpdatePayload` so the body stays byte-identical to what the
 *   old Details tab sent.
 *
 * Destination is deliberately not editable after creation: it is baked into
 * the canonical URL and the slug-registry row.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useCreateTrip, useUpdateTrip } from '@/hooks/trips/use-trips';
import { tripToUpdatePayload } from '@/lib/trips/update-payload';
import { tourUrl } from '@/lib/public-site';
import { toSlug } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { focusFirstInvalid, WizardStepBody, WizardStepHeader } from '../wizard-step';

// Lifted verbatim from `trip-create-form.tsx` - the messages are an e2e text
// contract and the rules are the backend's, not ours to tighten.
const basicsSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters').max(120),
    slug: z
        .string()
        .min(2)
        .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only')
        .optional()
        .or(z.literal('')),
    destinationId: z.string().min(1, 'Destination is required'),
    categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
    primaryCategoryId: z.string().optional(),
});

type BasicsValues = z.infer<typeof basicsSchema>;

/**
 * The address this tour will actually live at.
 *
 * Renders nothing until a destination is chosen - half a URL with a blank
 * segment teaches the wrong shape. The slug segment carries the readable
 * colour and the rest stays muted, so it is obvious which part the field below
 * controls. Once the tour is LIVE the whole thing becomes the real link.
 */
function UrlPreview({
    destinationSlug,
    slug,
    live,
}: {
    destinationSlug: string | null;
    slug: string;
    live: boolean;
}) {
    if (!destinationSlug) return null;
    const finalSlug = toSlug(slug || '') || 'your-tour';
    const href = tourUrl(destinationSlug, finalSlug);
    const shown = href.replace(/^https?:\/\//, '');
    const [head, tail] = [
        shown.slice(0, shown.lastIndexOf(finalSlug)),
        shown.slice(shown.lastIndexOf(finalSlug)),
    ];

    const body = (
        <>
            <span className='text-content-subtle'>{head}</span>
            <span className='text-content'>{tail}</span>
        </>
    );

    return (
        <p className='truncate text-xs'>
            {live ? (
                <a
                    href={href}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline-offset-4 hover:underline'>
                    {body}
                </a>
            ) : (
                body
            )}
        </p>
    );
}

interface StepBasicsProps {
    trip: TripListItem | null;
}

export function StepBasics({ trip }: StepBasicsProps) {
    const router = useRouter();
    const isCreate = !trip;

    const { mutateAsync: createTrip, isPending: isCreating } = useCreateTrip();
    const { mutateAsync: updateTrip, isPending: isUpdating } = useUpdateTrip();

    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();

    const { data: destinations } = useActiveDestinations();
    const { data: categories } = useActiveCategories();

    const [slugTouched, setSlugTouched] = useState(!isCreate);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<BasicsValues>({
        resolver: zodResolver(basicsSchema),
        defaultValues: {
            name: trip?.name ?? '',
            slug: trip?.slug ?? '',
            destinationId: trip?.destinationId ?? '',
            categoryIds: trip?.categoryIds ?? [],
            primaryCategoryId:
                trip?.primaryCategoryId ?? trip?.categoryIds[0] ?? '',
        },
    });

    /*
     * This step had NO re-sync at all: `defaultValues` were read once at mount
     * and never revisited, so once any other step saved and the trip refetched,
     * Basics went on showing whatever it had loaded with - a title or category
     * set the server no longer had. Same guarded sync as every other step, so a
     * refetch updates it only while the operator has nothing unsaved in it.
     *
     * In create mode `trip` is null and stays null, so the key never changes and
     * this runs exactly once against the empty defaults, as before.
     */
    useSyncFormWhenPristine(
        reset,
        isDirty,
        () => ({
            name: trip?.name ?? '',
            slug: trip?.slug ?? '',
            destinationId: trip?.destinationId ?? '',
            categoryIds: trip?.categoryIds ?? [],
            primaryCategoryId:
                trip?.primaryCategoryId ?? trip?.categoryIds[0] ?? '',
        }),
        trip,
    );

    const nameValue = watch('name');
    const slugValue = watch('slug');
    const destinationIdValue = watch('destinationId');
    // From the list already fetched for the Select - no extra request, and it
    // tracks the picker live while creating.
    const destinationSlug =
        (destinations ?? []).find(d => d.id === destinationIdValue)?.slug ??
        null;
    const categoryIds = watch('categoryIds');
    const primaryCategoryId = watch('primaryCategoryId');

    // Auto-slug until the operator takes over, create only - renaming an
    // existing slug is a 301 + a 90-day cooldown, never a side effect of
    // editing the title.
    useEffect(() => {
        if (!slugTouched) {
            setValue('slug', toSlug(nameValue), {
                shouldValidate: !!nameValue,
            });
        }
    }, [nameValue, slugTouched, setValue]);

    // Keep the starred primary inside the selected set.
    useEffect(() => {
        if (categoryIds.length === 0) {
            if (primaryCategoryId) setValue('primaryCategoryId', '');
        } else if (!categoryIds.includes(primaryCategoryId ?? '')) {
            setValue('primaryCategoryId', categoryIds[0]);
        }
    }, [categoryIds, primaryCategoryId, setValue]);

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                const primary =
                    values.primaryCategoryId || values.categoryIds[0];
                try {
                    if (isCreate) {
                        const created = await createTrip({
                            name: values.name,
                            slug: values.slug || undefined,
                            destinationId: values.destinationId,
                            categoryIds: values.categoryIds,
                            primaryCategoryId: primary,
                        });
                        // The draft now exists, so every later step has
                        // something to save against. Replace (not push) so
                        // Back does not land on an empty create form.
                        router.replace(`/trips/${created.id}/edit?step=pricing`);
                        // Navigation owns what happens next; do not also let
                        // the footer advance.
                        ok = false;
                        return;
                    }

                    await updateTrip({
                        id: trip.id,
                        payload: {
                            ...tripToUpdatePayload(trip),
                            name: values.name,
                            slug: values.slug || trip.slug,
                            categoryIds: values.categoryIds,
                            primaryCategoryId: primary,
                        },
                    });
                    // Pristine at the values just persisted. Without this the
                    // step keeps saying "Unsaved changes" over work that is
                    // already saved, and the leave-this-step guard fires on
                    // every move away from a step the operator HAS saved.
                    // `primary` rather than `values.primaryCategoryId`: that is
                    // what was sent, and resetting to anything else would leave
                    // the form dirty against the server on the very next tick.
                    reset({ ...values, primaryCategoryId: primary });
                    ok = true;
                } catch (err) {
                    const message =
                        err instanceof Error ? err.message : 'Failed to save.';
                    setStepError(
                        message.includes('409') ||
                            message.toLowerCase().includes('slug')
                            ? 'A trip with this slug already exists in this destination. Pick a different slug.'
                            : message,
                    );
                    ok = false;
                }
            },
            () => {
                focusFirstInvalid();
                ok = false;
            },
        )();
        return ok;
    }, [handleSubmit, isCreate, createTrip, updateTrip, router, trip, setStepError, reset]);

    useStepCommit('basics', {
        submit,
        isPending: isCreating || isUpdating,
        isDirty,
    });

    return (
        <>
            <WizardStepHeader step='basics' />
            <WizardStepBody>
                {/* A real form, even though the primary button lives in the
                    sticky footer: it gives Enter-to-submit on the shortest
                    step in the journey, where an operator is typing anyway. */}
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        void submit();
                    }}>
                    <div className='space-y-6 py-6'>
                        <Field>
                            <Label>
                                Tour title{' '}
                                <span aria-hidden className='text-danger-fg'>
                                    *
                                </span>
                            </Label>
                            <Input
                                {...register('name')}
                                placeholder='Sunset Catamaran Cruise'
                                aria-invalid={!!errors.name}
                                autoFocus={isCreate}
                            />
                            <FieldDescription>
                                What travellers will see on the card and the
                                booking page.
                            </FieldDescription>
                            <FieldError>{errors.name?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label>Slug</Label>
                            <Input
                                {...register('slug')}
                                placeholder='sunset-catamaran-cruise'
                                aria-invalid={!!errors.slug}
                                onChange={e => {
                                    setSlugTouched(true);
                                    setValue('slug', e.target.value, {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                    });
                                }}
                            />
                            {/* The URL itself, live. Three fields on this
                                screen exist to build ONE address - the slug,
                                the destination and the primary category - and
                                each explained itself with a different sentence
                                about "the URL" that the operator could never
                                see. Showing it collapses all three into one
                                visible fact, and makes "fixed after creation"
                                self-evident rather than a warning. */}
                            <UrlPreview
                                destinationSlug={destinationSlug}
                                slug={slugValue ?? ''}
                                live={trip?.status === 'LIVE'}
                            />
                            <FieldDescription>
                                {isCreate
                                    ? 'Auto-generated from the name, but you can customise it.'
                                    : 'Renaming issues an automatic 301 redirect, and the old slug is reserved for 90 days before it can be reused.'}
                            </FieldDescription>
                            <FieldError>{errors.slug?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label>
                                Destination{' '}
                                <span aria-hidden className='text-danger-fg'>
                                    *
                                </span>
                            </Label>
                            {isCreate ? (
                                <Controller
                                    name='destinationId'
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}>
                                            <SelectTrigger
                                                className='w-full'
                                                aria-invalid={
                                                    !!errors.destinationId
                                                }>
                                                <SelectValue placeholder='Select a destination...' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(destinations ?? []).map(d => (
                                                    <SelectItem
                                                        key={d.id}
                                                        value={d.id}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            ) : (
                                // A STATED FACT, not a disabled input. A form
                                // control that can never be edited still looks
                                // like one you could try, and the greyed fill
                                // reads as "temporarily unavailable" rather
                                // than "decided". The URL above already shows
                                // why it cannot move.
                                <p className='py-1 text-sm text-content'>
                                    {trip.destinationName ?? trip.destinationId}
                                </p>
                            )}
                            <FieldDescription>
                                {isCreate
                                    ? 'Cannot be changed after creation - it is part of the tour URL.'
                                    : 'Fixed after creation.'}
                            </FieldDescription>
                            <FieldError>
                                {errors.destinationId?.message}
                            </FieldError>
                        </Field>

                        <Field>
                            <Label>
                                Categories{' '}
                                <span aria-hidden className='text-danger-fg'>
                                    *
                                </span>
                            </Label>
                            <Controller
                                name='categoryIds'
                                control={control}
                                render={({ field }) => (
                                    <MultiSelect
                                        options={(categories ?? []).map(c => ({
                                            value: c.id,
                                            label: c.name,
                                        }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder='Select categories…'
                                        searchPlaceholder='Search categories…'
                                        primaryValue={primaryCategoryId || null}
                                        onPrimaryChange={v =>
                                            setValue('primaryCategoryId', v, {
                                                shouldDirty: true,
                                            })
                                        }
                                    />
                                )}
                            />
                            <FieldDescription>
                                The starred category is the primary - it decides
                                the breadcrumb and the canonical URL.
                            </FieldDescription>
                            <FieldError>
                                {errors.categoryIds?.message}
                            </FieldError>
                        </Field>
                    </div>
                    {/* Implicit submission needs a default button in the form.
                        `hidden` keeps it out of the render and the a11y tree,
                        so it never competes with the footer's real button. */}
                    <button type='submit' hidden>
                        Save basics
                    </button>
                </form>

                {isCreate && (
                    <p className='text-xs text-content-muted'>
                        These four answers create the draft. Pricing, schedules,
                        photos and everything else come next - and you can
                        change any of them before publishing.
                    </p>
                )}
            </WizardStepBody>
        </>
    );
}
