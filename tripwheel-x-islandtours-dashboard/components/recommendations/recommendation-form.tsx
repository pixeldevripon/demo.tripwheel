'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ImageSelectorField } from '@/components/common/image-selector-field';
import { CheckboxField } from '@/components/settings/settings-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useCreateRecommendation,
    useUpdateRecommendation,
} from '@/hooks/recommendations/use-recommendations';
import { useRecommendationCategories } from '@/hooks/recommendations/use-recommendation-categories';
import {
    factFieldsForCategory,
    RECOMMENDATION_PLACEMENT_LABELS,
    RECOMMENDATION_PLACEMENTS,
    RECOMMENDATION_REF_TYPE_LABELS,
    RECOMMENDATION_REF_TYPES,
    type Recommendation,
    type RecommendationCurrency,
    type RecommendationPlacement,
    type RecommendationRefType,
    type RecommendationSource,
} from '@/types/recommendation';
import { RecommendationRefPicker } from './recommendation-ref-picker';

/** The platform prices in these two only (backend `Currency` enum). */
const CURRENCIES: { value: RecommendationCurrency; label: string }[] = [
    { value: 'USD', label: 'USD - US dollar ($)' },
    { value: 'EUR', label: 'EUR - euro (€)' },
];

const UNCATEGORISED = '__none__';

/**
 * Numeric fields are text inputs in the form and a number (or null) on the wire.
 * An empty box is a CLEAR, not a zero: "no rating yet" and "rated 0" are
 * different on the card, and `Number('')` is 0.
 */
interface RecommendationValues {
    source: RecommendationSource;
    categoryId: string;
    isEnabled: boolean;
    displayOrder: string;
    placements: RecommendationPlacement[];
    // Internal
    refType: RecommendationRefType;
    refId: string;
    // External record facts
    imageUrl: string;
    linkUrl: string;
    rating: string;
    reviewCount: string;
    sleeps: string;
    priceAmount: string;
    currency: RecommendationCurrency;
    /** Create only - on an existing recommendation the copy lives in the Content tab. */
    title: string;
}

function toFormValue(v: number | null): string {
    return v === null ? '' : String(v);
}

function toNumberOrNull(v: string): number | null {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

/**
 * One recommendation's facts. A recommendation is EITHER a pointer at one of our
 * own entities (INTERNAL - the card is drawn live from the entity, so only the
 * reference is stored) or our own pick on someone else's site (EXTERNAL - it
 * carries its own photo, link, price and per-locale copy).
 *
 * CREATE MODE (`recommendation` omitted) adds one copy field for EXTERNAL: the
 * name. It is the render gate AND the only label the list can show, so an
 * external recommendation cannot be created without one - everything else is
 * filled in afterwards, on the same form or in the Content tab.
 */
export function RecommendationForm({
    recommendation,
}: {
    recommendation?: Recommendation;
}) {
    const router = useRouter();
    const isEdit = !!recommendation;

    const { data: categories } = useRecommendationCategories();
    const { mutate: create, isPending: creating } = useCreateRecommendation();
    const { mutate: update, isPending: updating } = useUpdateRecommendation();
    const isPending = creating || updating;

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<RecommendationValues>({
        defaultValues: {
            source: 'EXTERNAL',
            categoryId: '',
            isEnabled: true,
            displayOrder: '0',
            placements: ['THANK_YOU_PAGE'],
            refType: 'TOUR',
            refId: '',
            imageUrl: '',
            linkUrl: '',
            rating: '',
            reviewCount: '',
            sleeps: '',
            priceAmount: '',
            currency: 'USD',
            title: '',
        },
    });

    useEffect(() => {
        if (!recommendation) return;
        reset({
            source: recommendation.source,
            categoryId: recommendation.category?.id ?? '',
            isEnabled: recommendation.isEnabled,
            displayOrder: String(recommendation.displayOrder),
            placements: recommendation.placements,
            refType: recommendation.refType ?? 'TOUR',
            refId: recommendation.refId ?? '',
            imageUrl: recommendation.imageUrl ?? '',
            linkUrl: recommendation.linkUrl ?? '',
            rating: toFormValue(recommendation.rating),
            reviewCount: toFormValue(recommendation.reviewCount),
            sleeps: toFormValue(recommendation.sleeps),
            priceAmount: toFormValue(recommendation.priceAmount),
            currency: recommendation.currency,
            title: '',
        });
    }, [recommendation, reset]);

    const values = watch();
    const isInternal = values.source === 'INTERNAL';

    // Which fact fields to show depends on the CATEGORY: a hotel has Sleeps, a
    // restaurant does not, a shop has no price. Fields not relevant to the chosen
    // category are hidden, and cleared on save so a stale value never lingers.
    const selectedCategory = (categories ?? []).find(
        (c) => c.id === values.categoryId,
    );
    const visibleFacts = factFieldsForCategory(selectedCategory?.slug);
    const showRating = visibleFacts.includes('rating');
    const showReviewCount = visibleFacts.includes('reviewCount');
    const showSleeps = visibleFacts.includes('sleeps');
    const showPrice = visibleFacts.includes('priceAmount');

    // Changing the source of an EXISTING recommendation flips what the whole record
    // means (its own photo/copy vs a live entity), so it is confirmed first. On a
    // NEW one it switches freely.
    const [pendingSource, setPendingSource] =
        useState<RecommendationSource | null>(null);

    function handleSourceChange(next: RecommendationSource) {
        if (next === values.source) return;
        if (isEdit) {
            setPendingSource(next);
            return;
        }
        setValue('source', next);
    }

    function togglePlacement(p: RecommendationPlacement, on: boolean) {
        const next = on
            ? [...values.placements, p]
            : values.placements.filter((x) => x !== p);
        setValue('placements', next, { shouldValidate: true });
    }

    function onSubmit(v: RecommendationValues) {
        // Guards the API cannot express through the form types.
        if (isInternal && !v.refId) {
            toast.error(
                `Choose which ${RECOMMENDATION_REF_TYPE_LABELS[v.refType].toLowerCase()} this points at.`,
            );
            return;
        }
        if (!isInternal && !isEdit && !v.title.trim()) {
            toast.error('An external recommendation needs a name.');
            return;
        }

        const common = {
            source: v.source,
            categoryId: v.categoryId || null,
            isEnabled: v.isEnabled,
            displayOrder: toNumberOrNull(v.displayOrder) ?? 0,
            placements: v.placements,
        };

        // Only the fields that belong to the chosen source ride along - the other
        // half is left untouched (the backend ignores it for that source).
        const sourceFields = isInternal
            ? {
                  refType: v.refType,
                  refId: v.refId,
              }
            : {
                  refType: null,
                  refId: null,
                  imageUrl: v.imageUrl.trim() || null,
                  linkUrl: v.linkUrl.trim() || null,
                  // A fact not relevant to the category is hidden AND cleared, so a
                  // hotel's "Sleeps" does not linger after it becomes a restaurant.
                  rating: showRating ? toNumberOrNull(v.rating) : null,
                  reviewCount: showReviewCount
                      ? toNumberOrNull(v.reviewCount)
                      : null,
                  sleeps: showSleeps ? toNumberOrNull(v.sleeps) : null,
                  priceAmount: showPrice ? toNumberOrNull(v.priceAmount) : null,
                  currency: v.currency,
              };

        const base = { ...common, ...sourceFields };

        const onError = (err: unknown) =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to save the recommendation.',
            );

        if (recommendation) {
            update(
                { id: recommendation.id, payload: base },
                {
                    onSuccess: () =>
                        toast.success('Recommendation updated successfully.'),
                    onError,
                },
            );
            return;
        }

        create(
            {
                ...base,
                // English copy is only meaningful for an EXTERNAL card.
                ...(isInternal ? {} : { title: v.title.trim() }),
            },
            {
                onSuccess: (created) => {
                    toast.success('Recommendation created.');
                    // Straight into the editor: the rest of the copy lives there.
                    router.push(`/recommendations/${created.id}/edit`);
                },
                onError,
            },
        );
    }

    return (
        <div className='space-y-5'>
            {recommendation && <LiveNotice recommendation={recommendation} />}

            <Card>
                <CardHeader className='border-b pb-6'>
                    <CardTitle>
                        {isEdit
                            ? 'Recommendation Details'
                            : 'New Recommendation'}
                    </CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-5'>
                        {/* Source ─ the fork the whole form hangs off. Stays
                            mutable on edit: switching an existing pick between
                            internal and external is a legitimate change. */}
                        <Field>
                            <Label>Source</Label>
                            <RadioGroup
                                value={values.source}
                                onValueChange={(v) =>
                                    handleSourceChange(v as RecommendationSource)
                                }
                                className='flex flex-wrap items-center gap-6 pt-1'>
                                <div className='flex items-center gap-2'>
                                    <RadioGroupItem
                                        value='EXTERNAL'
                                        id='source-external'
                                    />
                                    <Label
                                        htmlFor='source-external'
                                        className='cursor-pointer font-normal'>
                                        External pick
                                    </Label>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <RadioGroupItem
                                        value='INTERNAL'
                                        id='source-internal'
                                    />
                                    <Label
                                        htmlFor='source-internal'
                                        className='cursor-pointer font-normal'>
                                        Our own entity
                                    </Label>
                                </div>
                            </RadioGroup>
                            <FieldDescription>
                                {isInternal
                                    ? 'Points at one of our own tours, destinations, collections or hubs. The card is drawn live from that entity.'
                                    : 'Our own pick on another site (an apartment, a restaurant, a shop). It carries its own photo, link and copy.'}
                            </FieldDescription>
                        </Field>

                        {/* Create-only name, external only. */}
                        {!isEdit && !isInternal && (
                            <Field>
                                <Label>
                                    Name{' '}
                                    <span className='text-destructive'>*</span>
                                </Label>
                                <Input
                                    {...register('title')}
                                    placeholder='e.g. Palm Suite Apartment'
                                    aria-invalid={!!errors.title}
                                />
                                <FieldDescription>
                                    The heading on the card, in English. Other
                                    languages are translated afterwards, in the
                                    Content tab.
                                </FieldDescription>
                            </Field>
                        )}

                        {/* Category + promotion priority ─ shared by both
                            sources, inlined to keep the form short. */}
                        <div className='grid gap-4 sm:grid-cols-2'>
                            <Field>
                                <Label>Category</Label>
                                <Select
                                    value={values.categoryId || UNCATEGORISED}
                                    onValueChange={(v) =>
                                        setValue(
                                            'categoryId',
                                            v === UNCATEGORISED ? '' : v,
                                        )
                                    }>
                                    <SelectTrigger>
                                        <SelectValue placeholder='Uncategorised' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={UNCATEGORISED}>
                                            Uncategorised
                                        </SelectItem>
                                        {(categories ?? []).map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    The bucket this pick is grouped under on the
                                    page. Manage the list on the Categories
                                    screen.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Label>Promotion priority</Label>
                                <Input
                                    type='number'
                                    min='0'
                                    step='1'
                                    {...register('displayOrder')}
                                    placeholder='0'
                                />
                                <FieldDescription>
                                    Which pick gets the card on a surface: the
                                    lowest number wins, among those switched on
                                    and complete.
                                </FieldDescription>
                            </Field>
                        </div>

                        {/* Placements ─ shared by both sources. */}
                        <Field>
                            <Label>Where it shows</Label>
                            <div className='space-y-2 pt-1'>
                                {RECOMMENDATION_PLACEMENTS.map((p) => (
                                    <div
                                        key={p}
                                        className='flex items-center gap-2'>
                                        <Checkbox
                                            id={`placement-${p}`}
                                            checked={values.placements.includes(
                                                p,
                                            )}
                                            onCheckedChange={(c) =>
                                                togglePlacement(p, !!c)
                                            }
                                        />
                                        <Label
                                            htmlFor={`placement-${p}`}
                                            className='cursor-pointer font-normal'>
                                            {
                                                RECOMMENDATION_PLACEMENT_LABELS[
                                                    p
                                                ]
                                            }
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <FieldDescription>
                                The post-booking surfaces this recommendation can
                                appear on. Pick at least one, or it shows nowhere.
                            </FieldDescription>
                        </Field>

                        <CheckboxField
                            id='recommendation-enabled'
                            label='Available to promote'
                            description='Off takes this recommendation out of the running without deleting anything. The card then goes to the next one in order.'
                            checked={values.isEnabled}
                            onChange={(c) => setValue('isEnabled', c)}
                        />

                        {/* ── Internal branch ─────────────────────────────── */}
                        {isInternal && (
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Field>
                                    <Label>Entity type</Label>
                                    <Select
                                        value={values.refType}
                                        onValueChange={(v) => {
                                            setValue(
                                                'refType',
                                                v as RecommendationRefType,
                                            );
                                            // The old id belongs to the old type.
                                            setValue('refId', '');
                                        }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RECOMMENDATION_REF_TYPES.map(
                                                (t) => (
                                                    <SelectItem
                                                        key={t}
                                                        value={t}>
                                                        {
                                                            RECOMMENDATION_REF_TYPE_LABELS[
                                                                t
                                                            ]
                                                        }
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field>
                                    <Label>
                                        {
                                            RECOMMENDATION_REF_TYPE_LABELS[
                                                values.refType
                                            ]
                                        }{' '}
                                        <span className='text-destructive'>
                                            *
                                        </span>
                                    </Label>
                                    <RecommendationRefPicker
                                        refType={values.refType}
                                        value={values.refId}
                                        currentLabel={
                                            recommendation?.refLabel ?? undefined
                                        }
                                        onChange={(id) =>
                                            setValue('refId', id, {
                                                shouldValidate: true,
                                            })
                                        }
                                    />
                                    <FieldDescription>
                                        The card&apos;s photo, name and link are
                                        drawn live from this entity.
                                    </FieldDescription>
                                </Field>
                            </div>
                        )}

                        {/* ── External branch ─────────────────────────────── */}
                        {!isInternal && (
                            <>
                                <Field>
                                    <Label>Photo</Label>
                                    <FieldDescription>
                                        Fills the left half of the card.
                                        Landscape, at least 1176px wide. Required
                                        - without it this recommendation cannot be
                                        promoted.
                                    </FieldDescription>
                                    <ImageSelectorField
                                        value={values.imageUrl || null}
                                        onChange={(url) =>
                                            setValue('imageUrl', url ?? '')
                                        }
                                    />
                                </Field>

                                <Field>
                                    <Label>Link</Label>
                                    <Input
                                        {...register('linkUrl', {
                                            validate: (v) =>
                                                !v.trim() ||
                                                v.trim().startsWith('https://') ||
                                                'Must be a full https:// address',
                                        })}
                                        placeholder='https://www.airbnb.com/rooms/...'
                                        aria-invalid={!!errors.linkUrl}
                                    />
                                    <FieldDescription>
                                        Where the button sends people. Required -
                                        the card&apos;s only action is this click.
                                        Set the button text per language in the
                                        Content tab if this is not Airbnb.
                                    </FieldDescription>
                                    <FieldError>
                                        {errors.linkUrl?.message}
                                    </FieldError>
                                </Field>

                                {/* The meta-row facts - only those relevant to the
                                    chosen category are shown. */}
                                {(showRating ||
                                    showReviewCount ||
                                    showSleeps ||
                                    showPrice) && (
                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        {showRating && (
                                            <Field>
                                                <Label>Rating</Label>
                                                <Input
                                                    type='number'
                                                    step='0.1'
                                                    min='0'
                                                    max='5'
                                                    {...register('rating', {
                                                        validate: (v) => {
                                                            if (!v.trim())
                                                                return true;
                                                            const n = Number(v);
                                                            if (
                                                                !Number.isFinite(
                                                                    n,
                                                                )
                                                            )
                                                                return 'Must be a number';
                                                            return (
                                                                (n >= 0 &&
                                                                    n <= 5) ||
                                                                'Must be between 0 and 5'
                                                            );
                                                        },
                                                    })}
                                                    placeholder='e.g. 4.8'
                                                    aria-invalid={!!errors.rating}
                                                />
                                                <FieldDescription>
                                                    The score from wherever it is
                                                    listed. Out of 5, one decimal.
                                                </FieldDescription>
                                                <FieldError>
                                                    {errors.rating?.message}
                                                </FieldError>
                                            </Field>
                                        )}

                                        {showReviewCount && (
                                            <Field>
                                                <Label>Number of reviews</Label>
                                                <Input
                                                    type='number'
                                                    min='0'
                                                    step='1'
                                                    {...register('reviewCount')}
                                                    placeholder='e.g. 1738'
                                                />
                                                <FieldDescription>
                                                    Shown in brackets after the
                                                    rating. Empty shows the rating
                                                    on its own.
                                                </FieldDescription>
                                            </Field>
                                        )}

                                        {showSleeps && (
                                            <Field>
                                                <Label>Sleeps</Label>
                                                <Input
                                                    type='number'
                                                    min='1'
                                                    step='1'
                                                    {...register('sleeps')}
                                                    placeholder='e.g. 4'
                                                />
                                                <FieldDescription>
                                                    How many guests. Renders as
                                                    &quot;Sleeps 4&quot;,
                                                    translated.
                                                </FieldDescription>
                                            </Field>
                                        )}

                                        {showPrice && (
                                            <Field>
                                                <Label>
                                                    Price ({values.currency})
                                                </Label>
                                                <Input
                                                    type='number'
                                                    min='0'
                                                    step='0.01'
                                                    {...register('priceAmount')}
                                                    placeholder='e.g. 160'
                                                />
                                                <FieldDescription>
                                                    Shown as &quot;from ...&quot;.
                                                    Enter the number only.
                                                </FieldDescription>
                                            </Field>
                                        )}
                                    </div>
                                )}

                                {showPrice && (
                                    <Field>
                                        <Label>Currency</Label>
                                        <Select
                                            value={values.currency}
                                            onValueChange={(v) =>
                                                setValue(
                                                    'currency',
                                                    v as RecommendationCurrency,
                                                )
                                            }>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CURRENCIES.map((c) => (
                                                    <SelectItem
                                                        key={c.value}
                                                        value={c.value}>
                                                        {c.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FieldDescription>
                                            The currency the price above is IN. It
                                            is never converted.
                                        </FieldDescription>
                                    </Field>
                                )}
                            </>
                        )}

                        <div className='flex justify-end pt-2'>
                            <Button type='submit' disabled={isPending}>
                                {isPending
                                    ? 'Saving...'
                                    : isEdit
                                      ? 'Save Changes'
                                      : 'Create Recommendation'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Changing an existing pick's source swaps its whole meaning, so it is
                confirmed before it takes effect. */}
            <AlertDialog
                open={!!pendingSource}
                onOpenChange={(o) => !o && setPendingSource(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change the source?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingSource === 'INTERNAL'
                                ? 'This will point the recommendation at one of our own entities and draw the card live from it. Its own photo, link and price stop being used.'
                                : "This will make the recommendation carry its own photo, link and copy again, and stop drawing from a linked entity. You'll need to fill those in."}{' '}
                            Save afterwards to apply the change.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep as is</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingSource)
                                    setValue('source', pendingSource);
                                setPendingSource(null);
                            }}>
                            Change source
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/**
 * Whether this recommendation is live, and what is missing if it is not.
 *
 * The verdict comes from the backend, computed with the same gate the public
 * read uses, so it cannot drift from reality. It exists because the failure mode
 * is silent: an admin who saves an external recommendation with no link gets a
 * success toast and a card that never appears, with nothing to explain why.
 */
function LiveNotice({ recommendation }: { recommendation: Recommendation }) {
    const { featuredPlacements, isEnabled, isComplete, placements, source } =
        recommendation;

    if (featuredPlacements.length > 0) {
        const where = featuredPlacements
            .map((p) => RECOMMENDATION_PLACEMENT_LABELS[p].toLowerCase())
            .join(' and ');
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                Showing on the {where} after a traveller books.
            </p>
        );
    }

    if (!isEnabled) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                Switched off - not in the running. Tick &ldquo;Available to
                promote&rdquo; to put it back.
            </p>
        );
    }

    if (placements.length === 0) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-danger-fg'>
                Not shown anywhere - choose at least one surface under
                &ldquo;Where it shows&rdquo;.
            </p>
        );
    }

    if (isComplete) {
        return (
            <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-content-muted'>
                Ready, but another recommendation has a higher promotion priority
                on every surface it is set for. Lower this one&apos;s number to
                promote it.
            </p>
        );
    }

    const missing =
        source === 'INTERNAL'
            ? ['a reference that still resolves (the linked entity may be gone)']
            : ([
                  !recommendation.imageUrl && 'a photo',
                  !recommendation.translations.find((t) => t.locale === 'en')
                      ?.title?.trim() && 'an English name (Content tab)',
                  !recommendation.linkUrl && 'a link',
              ].filter(Boolean) as string[]);

    return (
        <p className='rounded-md border border-line bg-surface-sunken px-4 py-3 text-sm text-danger-fg'>
            Not ready to show - it still needs {missing.join(', ')}.
        </p>
    );
}
