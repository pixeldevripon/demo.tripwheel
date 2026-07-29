'use client';

/**
 * Age bands (07 §3, step 2).
 *
 * Lifted out of `trip-pricing-tab.tsx` with the mutations, payloads, price
 * regex and enum option lists unchanged. Two UI changes only:
 *
 * - the strike-through price and the operator net price move behind a "More
 *   price options" disclosure. Both are optional, one is internal-only, and
 *   together they doubled the height of every band form;
 * - the empty state says what a band is FOR instead of "No age bands defined
 *   yet." - it is the first thing an operator sees on this section.
 *
 * Bands are a PER_PERSON construct. UNIT tours are priced by the unit formula
 * and the backend rejects bands on them, so the step hides this entirely.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowDown01Icon,
    Delete02Icon,
    PlusSignIcon,
    StarIcon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useAgeBands,
    useCreateAgeBand,
    useRemoveAgeBand,
    useUpdateAgeBand,
} from '@/hooks/trips/use-trips';
import { formatPriceFrom } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import type {
    AgeBandType,
    BandParticipation,
    Currency,
    TourAgeBand,
} from '@/types/trip';
import { FieldGrid, MoreOptions, SelectField } from '../wizard-fields';

const priceRegex = /^\d+(\.\d{1,2})?$/;

const AGE_BAND_TYPES: { value: AgeBandType; label: string }[] = [
    { value: 'ADULT', label: 'Adult' },
    { value: 'CHILD', label: 'Child' },
    { value: 'INFANT', label: 'Infant' },
    { value: 'YOUTH', label: 'Youth' },
    { value: 'SENIOR', label: 'Senior' },
];

/** Spectators are banded ride-alongs: they take a seat but skip the activity. */
const PARTICIPATION_TYPES: { value: BandParticipation; label: string }[] = [
    { value: 'PARTICIPANT', label: 'Participant' },
    { value: 'SPECTATOR', label: 'Spectator' },
];

const bandSchema = z
    .object({
        bandType: z.enum(['ADULT', 'CHILD', 'INFANT', 'YOUTH', 'SENIOR']),
        participation: z.enum(['PARTICIPANT', 'SPECTATOR']),
        label: z.string().min(1, 'Label is required').max(60),
        minAge: z.string().optional().or(z.literal('')),
        maxAge: z.string().optional().or(z.literal('')),
        price: z.string().regex(priceRegex, 'Must be a valid price'),
        priceOriginal: z
            .string()
            .regex(priceRegex, 'Must be a valid price')
            .optional()
            .or(z.literal('')),
        priceNet: z
            .string()
            .regex(priceRegex, 'Must be a valid price')
            .optional()
            .or(z.literal('')),
        isDefault: z.boolean(),
    })
    .refine(
        v => !v.minAge || !v.maxAge || Number(v.maxAge) >= Number(v.minAge),
        {
            message: 'Max age must be greater than or equal to min age',
            path: ['maxAge'],
        }
    );

type BandValues = {
    bandType: AgeBandType;
    participation: BandParticipation;
    label: string;
    minAge: string;
    maxAge: string;
    price: string;
    priceOriginal: string;
    priceNet: string;
    isDefault: boolean;
};

const EMPTY: BandValues = {
    bandType: 'ADULT',
    participation: 'PARTICIPANT',
    label: '',
    minAge: '',
    maxAge: '',
    price: '',
    priceOriginal: '',
    priceNet: '',
    isDefault: false,
};

function formatAgeRange(minAge: number | null, maxAge: number | null): string {
    if (minAge == null && maxAge == null) return 'All ages';
    if (minAge != null && maxAge == null) return `${minAge}+`;
    if (minAge == null && maxAge != null) return `Up to ${maxAge}`;
    return `${minAge}-${maxAge}`;
}

interface AgeBandsManagerProps {
    tripId: string;
    currency: Currency;
}

export function AgeBandsManager({ tripId, currency }: AgeBandsManagerProps) {
    const { data: bands, isLoading } = useAgeBands(tripId);
    const { mutateAsync: createBand, isPending: isCreating } =
        useCreateAgeBand();
    const [adding, setAdding] = useState(false);
    const reduceMotion = useReducedMotion();

    async function handleAdd(values: BandValues) {
        await createBand({
            tripId,
            payload: {
                bandType: values.bandType,
                participation: values.participation,
                label: values.label,
                minAge:
                    values.minAge !== '' ? Number(values.minAge) : undefined,
                maxAge:
                    values.maxAge !== '' ? Number(values.maxAge) : undefined,
                price: values.price,
                priceOriginal: values.priceOriginal || undefined,
                priceNet: values.priceNet || undefined,
                isDefault: values.isDefault,
            },
        });
        setAdding(false);
    }

    if (isLoading) {
        return (
            <div className='space-y-2'>
                {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className='h-14 w-full rounded-lg' />
                ))}
            </div>
        );
    }

    const list = bands ?? [];

    return (
        <div className='space-y-4'>
            {list.length === 0 && !adding ? (
                <div className='py-6 text-center'>
                    <span className='mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-surface-sunken'>
                        <HugeiconsIcon
                            icon={UserGroupIcon}
                            className='size-4 text-content-subtle'
                        />
                    </span>
                    <p className='text-sm font-medium text-content'>
                        No price tiers yet
                    </p>
                    <p className='mx-auto mt-1 max-w-md text-xs text-content-muted'>
                        A band is one price for one kind of traveller. Most
                        tours start with a single Adult band; the cheapest one
                        becomes the &ldquo;from&rdquo; price on your card.
                    </p>
                    <Button
                        type='button'
                        size='sm'
                        className='mt-4'
                        onClick={() => setAdding(true)}>
                        Add the first band
                    </Button>
                </div>
            ) : (
                <motion.div
                    // No leading rule. Every row already draws its own
                    // `border-b`, so a `border-t` here put a second hairline
                    // directly under the section header and boxed the list.
                    layout={!reduceMotion}>
                    <AnimatePresence initial={false}>
                        {list.map(band => (
                            <AgeBandRow
                                key={band.id}
                                band={band}
                                tripId={tripId}
                                currency={currency}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            <AnimatePresence initial={false} mode='wait'>
                {adding ? (
                    <motion.div
                        key='form'
                        initial={
                            reduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, y: -4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                        transition={{ duration: 0.18 }}>
                        {/* Border only, no fill: a transient editing surface
                            gets an outline to separate it from the rows above,
                            and a background would make it a card. */}
                        <div className='space-y-4 rounded-lg border border-line p-4'>
                            <p className='text-sm font-semibold text-content'>
                                New price tier
                            </p>
                            <BandForm
                                currency={currency}
                                submitLabel={
                                    isCreating ? 'Adding...' : 'Add age band'
                                }
                                disabled={isCreating}
                                onCancel={() => setAdding(false)}
                                onSubmit={handleAdd}
                            />
                        </div>
                    </motion.div>
                ) : list.length > 0 ? (
                    // A quiet text action, not an outlined box. The
                    // outline gave a secondary "add another" the same visual
                    // weight as the step's primary Save.
                    <Button
                        key='button'
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setAdding(true)}
                        className='-ml-2 text-primary'>
                        <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                        Add another band
                    </Button>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

function AgeBandRow({
    band,
    tripId,
    currency,
}: {
    band: TourAgeBand;
    tripId: string;
    currency: Currency;
}) {
    const { mutateAsync: updateBand, isPending: isUpdating } =
        useUpdateAgeBand();
    const { mutate: removeBand, isPending: isRemoving } = useRemoveAgeBand();
    const [editing, setEditing] = useState(false);
    const reduceMotion = useReducedMotion();

    async function handleSave(values: BandValues) {
        await updateBand({
            tripId,
            ageBandId: band.id,
            payload: {
                bandType: values.bandType,
                participation: values.participation,
                label: values.label,
                price: values.price,
                minAge:
                    values.minAge !== '' ? Number(values.minAge) : undefined,
                maxAge:
                    values.maxAge !== '' ? Number(values.maxAge) : undefined,
                priceOriginal: values.priceOriginal || undefined,
                priceNet: values.priceNet || undefined,
            },
        });
        setEditing(false);
    }

    return (
        <motion.div
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : springPop}
            className='border-b border-line last:border-b-0'>
            <div
                role='button'
                tabIndex={0}
                aria-expanded={editing}
                onClick={() => setEditing(v => !v)}
                onKeyDown={e => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditing(v => !v);
                    }
                }}
                className='group -mx-3 flex cursor-pointer flex-wrap items-center gap-3 rounded-md px-3 py-3 outline-none transition-colors duration-fast select-none hover:bg-surface-sunken/50 focus-visible:bg-surface-sunken/50'>
                {band.isDefault && (
                    <HugeiconsIcon
                        icon={StarIcon}
                        className='size-3.5 shrink-0 fill-rating text-rating'
                    />
                )}
                <span className='min-w-0 truncate text-sm font-medium text-content'>
                    {band.label}
                </span>
                {/* ONE chip, not three. Type, age range and participation were
                    three separate badges, so every row read as a pile of chips
                    with a name attached - the same "mixed out" the description
                    step's lists had. Text first, one muted chip after, and it
                    drops off on narrow screens instead of squeezing the label:
                    the treatment What's not included already uses. */}
                <Badge
                    variant='outline'
                    className='hidden shrink-0 text-xs capitalize md:inline-flex'>
                    {[
                        band.bandType.toLowerCase(),
                        formatAgeRange(band.minAge, band.maxAge),
                        band.participation === 'SPECTATOR' ? 'spectator' : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </Badge>

                <span
                    className='ml-auto flex items-center gap-2'
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}>
                    {band.priceOriginal && (
                        <span className='text-xs text-content-subtle line-through'>
                            {formatPriceFrom(
                                band.priceOriginal,
                                currency,
                                'en'
                            )}
                        </span>
                    )}
                    <span className='text-sm font-medium tabular-nums text-content'>
                        {formatPriceFrom(band.price, currency, 'en')}
                    </span>
                    {!band.isDefault && (
                        <Button
                            size='sm'
                            variant='ghost'
                            className='text-xs text-content-muted'
                            disabled={isUpdating}
                            onClick={() =>
                                updateBand({
                                    tripId,
                                    ageBandId: band.id,
                                    payload: { isDefault: true },
                                })
                            }>
                            Make default
                        </Button>
                    )}
                    <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label='Remove band'
                        disabled={isRemoving}
                        // Same quiet delete as every other list on the screen:
                        // subtle at rest, red on hover. `text-destructive` is
                        // also the legacy token - the house one is danger-*.
                        className='text-content-subtle hover:bg-danger-subtle hover:text-danger-fg'
                        onClick={() =>
                            removeBand(
                                { tripId, ageBandId: band.id },
                                {
                                    onError: err =>
                                        toast.error(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to remove.'
                                        ),
                                }
                            )
                        }>
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            className='size-3.5'
                        />
                    </Button>
                </span>

                <motion.span
                    animate={{ rotate: editing ? 180 : 0 }}
                    transition={reduceMotion ? { duration: 0 } : springPop}
                    className='flex shrink-0'>
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className={
                            editing
                                ? 'size-4 text-primary'
                                : 'size-4 text-content-subtle group-hover:text-content-muted'
                        }
                    />
                </motion.span>
            </div>

            <AnimatePresence initial={false}>
                {editing && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={
                            reduceMotion
                                ? { duration: 0 }
                                : { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
                        }
                        className='overflow-hidden'>
                        <div className='rounded-lg border border-line p-4 mb-6'>
                            <BandForm
                                currency={currency}
                                initial={{
                                    bandType: band.bandType,
                                    participation: band.participation,
                                    label: band.label,
                                    minAge:
                                        band.minAge != null
                                            ? String(band.minAge)
                                            : '',
                                    maxAge:
                                        band.maxAge != null
                                            ? String(band.maxAge)
                                            : '',
                                    price: band.price,
                                    priceOriginal: band.priceOriginal ?? '',
                                    priceNet: band.priceNet ?? '',
                                    isDefault: band.isDefault,
                                }}
                                hideDefaultToggle
                                submitLabel={isUpdating ? 'Saving...' : 'Save'}
                                disabled={isUpdating}
                                onCancel={() => setEditing(false)}
                                onSubmit={handleSave}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function BandForm({
    currency,
    initial,
    hideDefaultToggle,
    submitLabel,
    disabled,
    onCancel,
    onSubmit,
}: {
    currency: Currency;
    initial?: BandValues;
    hideDefaultToggle?: boolean;
    submitLabel: string;
    disabled: boolean;
    onCancel: () => void;
    onSubmit: (values: BandValues) => Promise<void>;
}) {
    const defaultToggleId = useId();
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<BandValues>({
        resolver: zodResolver(bandSchema) as unknown as Resolver<BandValues>,
        defaultValues: initial ?? EMPTY,
    });

    return (
        <form
            onSubmit={handleSubmit(async values => {
                try {
                    await onSubmit(values);
                } catch (err) {
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.'
                    );
                }
            })}
            className='space-y-4'>
            <FieldGrid>
                <Field>
                    <Label>Label</Label>
                    <Input
                        {...register('label')}
                        placeholder='e.g. Adult (13+)'
                        aria-invalid={!!errors.label}
                    />
                    <FieldError>{errors.label?.message}</FieldError>
                </Field>
                <Field>
                    <Label>Price ({currency})</Label>
                    <Input
                        {...register('price')}
                        placeholder='79.00'
                        aria-invalid={!!errors.price}
                    />
                    <FieldError>{errors.price?.message}</FieldError>
                </Field>
            </FieldGrid>

            <FieldGrid>
                <SelectField
                    control={control}
                    name='bandType'
                    label='Age type'
                    options={AGE_BAND_TYPES}
                    error={errors.bandType?.message}
                />
                <SelectField
                    control={control}
                    name='participation'
                    label='Participation'
                    options={PARTICIPATION_TYPES}
                    error={errors.participation?.message}
                />
            </FieldGrid>

            <FieldGrid>
                <Field>
                    <Label>Minimum age</Label>
                    <Input
                        {...register('minAge')}
                        type='number'
                        min={0}
                        max={120}
                        placeholder='Any'
                        aria-invalid={!!errors.minAge}
                    />
                    <FieldError>{errors.minAge?.message}</FieldError>
                </Field>
                <Field>
                    <Label>Maximum age</Label>
                    <Input
                        {...register('maxAge')}
                        type='number'
                        min={0}
                        max={120}
                        placeholder='Any'
                        aria-invalid={!!errors.maxAge}
                    />
                    <FieldError>{errors.maxAge?.message}</FieldError>
                </Field>
            </FieldGrid>

            <MoreOptions label='More price options'>
                <FieldGrid>
                    <Field>
                        <Label>Original price ({currency})</Label>
                        <Input
                            {...register('priceOriginal')}
                            placeholder='Optional'
                            aria-invalid={!!errors.priceOriginal}
                        />
                        <p className='text-xs text-content-muted'>
                            Shown struck through to signal a deal.
                        </p>
                        <FieldError>{errors.priceOriginal?.message}</FieldError>
                    </Field>
                    <Field>
                        <Label>Net price ({currency})</Label>
                        <Input
                            {...register('priceNet')}
                            placeholder='Optional'
                            aria-invalid={!!errors.priceNet}
                        />
                        <p className='text-xs text-content-muted'>
                            What you keep. Internal only - never shown to
                            travellers.
                        </p>
                        <FieldError>{errors.priceNet?.message}</FieldError>
                    </Field>
                </FieldGrid>
            </MoreOptions>

            <div className='flex flex-wrap items-center justify-between gap-3 pt-2'>
                {!hideDefaultToggle ? (
                    <Controller
                        name='isDefault'
                        control={control}
                        render={({ field }) => (
                            <div className='flex items-center gap-2'>
                                <Checkbox
                                    id={defaultToggleId}
                                    checked={field.value}
                                    onCheckedChange={c => field.onChange(!!c)}
                                />
                                <Label
                                    htmlFor={defaultToggleId}
                                    className='cursor-pointer font-light normal-case'>
                                    Pre-select this band at booking
                                </Label>
                            </div>
                        )}
                    />
                ) : (
                    <span />
                )}
                <div className='flex gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={onCancel}
                        disabled={disabled}>
                        Cancel
                    </Button>
                    <Button type='submit' size='sm' disabled={disabled}>
                        {submitLabel}
                    </Button>
                </div>
            </div>
        </form>
    );
}

