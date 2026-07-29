'use client';

/**
 * Add-ons (07 §3, step 2).
 *
 * Lifted out of `trip-pricing-tab.tsx` - same mutations, same payload keys,
 * same price regex. The list gains an honest empty state and an add form that
 * only appears when asked, so a tour with no add-ons (most of them) shows one
 * quiet line instead of a permanently open six-field form.
 */

import {
    ArrowDown01Icon,
    Delete02Icon,
    PlusSignIcon,
    ShoppingBag01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useAddOns,
    useCreateAddOn,
    useRemoveAddOn,
    useUpdateAddOn,
} from '@/hooks/trips/use-trips';
import { formatPriceFrom } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { AddOnUnit, Currency, TourAddOn } from '@/types/trip';
import { FieldGrid, SelectField } from '../wizard-fields';

const priceRegex = /^\d+(\.\d{1,2})?$/;

const addOnSchema = z.object({
    name: z.string().min(1, 'Name is required').max(80),
    description: z.string().optional().or(z.literal('')),
    price: z.string().regex(priceRegex, 'Must be a valid price'),
    unit: z.enum(['PER_PERSON', 'FLAT']),
    maxQuantity: z.string().optional().or(z.literal('')),
});

type AddOnValues = {
    name: string;
    description: string;
    price: string;
    unit: AddOnUnit;
    maxQuantity: string;
};

const EMPTY: AddOnValues = {
    name: '',
    description: '',
    price: '',
    unit: 'PER_PERSON',
    maxQuantity: '10',
};

const UNIT_OPTIONS = [
    { value: 'PER_PERSON', label: 'Per person' },
    { value: 'FLAT', label: 'Flat rate' },
];

interface AddOnsManagerProps {
    tripId: string;
    currency: Currency;
}

export function AddOnsManager({ tripId, currency }: AddOnsManagerProps) {
    const { data: addOns, isLoading } = useAddOns(tripId);
    const { mutateAsync: createAddOn, isPending: isCreating } =
        useCreateAddOn();
    const [adding, setAdding] = useState(false);
    const reduceMotion = useReducedMotion();

    async function handleAdd(values: AddOnValues) {
        await createAddOn({
            tripId,
            payload: {
                name: values.name,
                description: values.description || undefined,
                price: values.price,
                unit: values.unit,
                maxQuantity: values.maxQuantity
                    ? Number(values.maxQuantity)
                    : undefined,
            },
        });
        setAdding(false);
    }

    if (isLoading) {
        return (
            <div className='space-y-2'>
                {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 w-full rounded-lg' />
                ))}
            </div>
        );
    }

    const list = addOns ?? [];

    return (
        <div className='space-y-4'>
            {list.length === 0 && !adding ? (
                <div className='py-6 text-center'>
                    <span className='mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-surface-sunken'>
                        <HugeiconsIcon
                            icon={ShoppingBag01Icon}
                            className='size-4 text-content-subtle'
                        />
                    </span>
                    <p className='text-sm font-medium text-content'>
                        No add-ons
                    </p>
                    <p className='mx-auto mt-1 max-w-md text-xs text-content-muted'>
                        Extras a traveller can tick at checkout - equipment
                        hire, a photo package, hotel transfer. Most tours do not
                        need any.
                    </p>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='mt-4'
                        onClick={() => setAdding(true)}>
                        Add an extra
                    </Button>
                </div>
            ) : (
                <motion.div
                    // No leading rule. Every row already draws its own
                    // `border-b`, so a `border-t` here put a second hairline
                    // directly under the section header and boxed the list.
                    layout={!reduceMotion}>
                    <AnimatePresence initial={false}>
                        {list.map(addOn => (
                            <AddOnRow
                                key={addOn.id}
                                addOn={addOn}
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
                            reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}>
                        {/* Border only, no fill: a transient editing surface
                            gets an outline to separate it from the rows above,
                            and a background would make it a card. */}
                        <div className='space-y-4 rounded-lg border border-line p-4'>
                            <p className='text-sm font-semibold text-content'>
                                New extra
                            </p>
                            <AddOnForm
                                currency={currency}
                                submitLabel={
                                    isCreating ? 'Adding...' : 'Add extra'
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
                        Add another extra
                    </Button>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

function AddOnRow({
    addOn,
    tripId,
    currency,
}: {
    addOn: TourAddOn;
    tripId: string;
    currency: Currency;
}) {
    const { mutateAsync: updateAddOn, isPending: isUpdating } =
        useUpdateAddOn();
    const { mutate: removeAddOn, isPending: isRemoving } = useRemoveAddOn();
    const [editing, setEditing] = useState(false);
    const reduceMotion = useReducedMotion();

    async function handleSave(values: AddOnValues) {
        await updateAddOn({
            tripId,
            addOnId: addOn.id,
            payload: {
                name: values.name.trim(),
                description: values.description.trim(),
                price: values.price,
                unit: values.unit,
                maxQuantity: values.maxQuantity
                    ? Number(values.maxQuantity)
                    : undefined,
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
                <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-full ${
                        addOn.isActive ? 'bg-success-solid' : 'bg-content-subtle'
                    }`}
                />
                <span
                    className={cn(
                        'min-w-0 truncate text-sm font-medium transition-colors duration-fast',
                        editing ? 'text-primary' : 'text-content'
                    )}>
                    {addOn.name}
                </span>
                {/* Text first, one muted chip after, dropped on narrow
                    screens - the same row shape as What's not included and the
                    age bands beside it. */}
                <Badge
                    variant='outline'
                    className='hidden shrink-0 text-xs md:inline-flex'>
                    {addOn.unit === 'PER_PERSON' ? 'per person' : 'flat'}
                </Badge>

                <span
                    className='ml-auto flex items-center gap-2'
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}>
                    <span className='text-sm font-medium tabular-nums text-content'>
                        {formatPriceFrom(addOn.price, currency, 'en')}
                    </span>
                    <Button
                        size='sm'
                        variant='ghost'
                        className='text-xs text-content-muted'
                        disabled={isUpdating}
                        onClick={() =>
                            updateAddOn({
                                tripId,
                                addOnId: addOn.id,
                                payload: { isActive: !addOn.isActive },
                            })
                        }>
                        {addOn.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label='Remove add-on'
                        disabled={isRemoving}
                        // Quiet at rest, red on hover - one delete treatment
                        // across every list. `text-destructive` is the legacy
                        // token; the house one is danger-*.
                        className='text-content-subtle hover:bg-danger-subtle hover:text-danger-fg'
                        onClick={() =>
                            removeAddOn(
                                { tripId, addOnId: addOn.id },
                                {
                                    onError: err =>
                                        toast.error(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to remove.',
                                        ),
                                },
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
                            <AddOnForm
                                currency={currency}
                                initial={{
                                    name: addOn.name,
                                    description: addOn.description ?? '',
                                    price: addOn.price,
                                    unit: addOn.unit,
                                    maxQuantity: String(addOn.maxQuantity),
                                }}
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

function AddOnForm({
    currency,
    initial,
    submitLabel,
    disabled,
    onCancel,
    onSubmit,
}: {
    currency: Currency;
    initial?: AddOnValues;
    submitLabel: string;
    disabled: boolean;
    onCancel: () => void;
    onSubmit: (values: AddOnValues) => Promise<void>;
}) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<AddOnValues>({
        resolver: zodResolver(addOnSchema) as unknown as Resolver<AddOnValues>,
        defaultValues: initial ?? EMPTY,
    });

    return (
        <form
            onSubmit={handleSubmit(async values => {
                try {
                    await onSubmit(values);
                } catch (err) {
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.',
                    );
                }
            })}
            className='space-y-4'>
            <FieldGrid>
                <Field>
                    <Label>Name</Label>
                    <Input
                        {...register('name')}
                        placeholder='e.g. Snorkel equipment'
                        aria-invalid={!!errors.name}
                    />
                    <FieldError>{errors.name?.message}</FieldError>
                </Field>
                <Field>
                    <Label>Price ({currency})</Label>
                    <Input
                        {...register('price')}
                        placeholder='19.99'
                        aria-invalid={!!errors.price}
                    />
                    <FieldError>{errors.price?.message}</FieldError>
                </Field>
            </FieldGrid>

            <Field>
                <Label>Description</Label>
                <Input
                    {...register('description')}
                    placeholder='Optional - one line at checkout'
                />
            </Field>

            <FieldGrid>
                <SelectField
                    control={control}
                    name='unit'
                    label='Charged'
                    options={UNIT_OPTIONS}
                    error={errors.unit?.message}
                />
                <Field>
                    <Label>Maximum quantity</Label>
                    <Input
                        {...register('maxQuantity')}
                        type='number'
                        min={1}
                        placeholder='10'
                        aria-invalid={!!errors.maxQuantity}
                    />
                    <FieldError>{errors.maxQuantity?.message}</FieldError>
                </Field>
            </FieldGrid>

            <div className='flex justify-end gap-2 pt-2'>
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
        </form>
    );
}
