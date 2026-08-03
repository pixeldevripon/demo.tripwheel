'use client';

import { Bus01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { findEnglish, numOrNull, numOrUndef, strOrNull } from '@/lib/trips/forms';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useAddPickupLocation,
    usePickupLocations,
    useRemovePickupLocation,
    useUpdatePickupLocation,
    useUpsertPickupLocationTranslation,
} from '@/hooks/trips/use-trips';
import { formatPriceFrom } from '@/lib/currency/current';
import type {
    CreatePickupLocationPayload,
    Currency,
    PickupLocation,
    PickupModel,
    UpdatePickupLocationPayload,
} from '@/types/trip';
import { EditableListSection } from './editable-list-section';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeField = z.string().regex(HHMM, 'Use HH:MM').optional().or(z.literal(''));
// Same money shape as the Pricing tab add-on price (2 dp max).
const priceField = z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Use a number like 17 or 17.50')
    .optional()
    .or(z.literal(''));

/**
 * A zone asks for what the traveller is told, in the order they are told it.
 *
 * `latitude` / `longitude` are gone. A zone's coordinates are read by nothing:
 * the tour page shows the title, window and directions as text, and the
 * confirmation email's map link is built from the snapshotted `pickupAddress`
 * string, not a pin (`booking-email.context.ts` -> `mapsUrl(null, null,
 * booking.pickupAddress)`). Two number fields and a map pin per zone bought an
 * operator nothing.
 *
 * What moved up is what actually reaches a traveller: `address` is the pickup
 * line AND the map link in their confirmation, and `minutesPrior` is both the
 * "be ready N minutes before" line and the fallback pickup time when no window
 * is set. Both used to sit below the coordinates.
 *
 * The columns stay - the update endpoint keys off `'field' in dto`, so
 * omitting latitude/longitude leaves any stored pin untouched.
 */
const addPickupSchema = z.object({
    name: z.string().min(2, 'At least 2 characters').max(160),
    address: z.string().max(240).optional().or(z.literal('')),
    directions: z.string().max(500).optional().or(z.literal('')),
    price: priceField,
    minutesPrior: z.string().optional(),
    windowStart: timeField,
    windowEnd: timeField,
});
type AddPickupFormValues = z.infer<typeof addPickupSchema>;

const editPickupSchema = z.object({
    name: z.string().min(2, 'At least 2 characters').max(160),
    address: z.string().max(240).optional().or(z.literal('')),
    directions: z.string().max(500).optional().or(z.literal('')),
    price: priceField,
    minutesPrior: z.string().optional(),
    windowStart: timeField,
    windowEnd: timeField,
    displayOrder: z.string().optional(),
    isActive: z.boolean(),
});
type EditPickupFormValues = z.infer<typeof editPickupSchema>;

// numOrNull/numOrUndef/strOrNull now live in lib/trips/forms (shared).

/** Inline details editor for one pickup - payload identical to the old tab. */
function PickupDetailsEditor({
    pickup,
    tripId,
    isPaidPickup,
    currency,
}: {
    pickup: PickupLocation;
    tripId: string;
    isPaidPickup: boolean;
    currency: Currency;
}) {
    const { mutate: updatePickup, isPending: isUpdating } =
        useUpdatePickupLocation();
    const { mutate: upsertPickupTranslation } =
        useUpsertPickupLocationTranslation();

    // Directions live on the pickup's ENGLISH translation row, not the base
    // row - the create form writes them there, so the editor must read (and
    // save) them from the same place or a just-created pickup looks empty.
    const enTranslation = findEnglish(pickup.translations);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<EditPickupFormValues>({
        resolver: zodResolver(editPickupSchema),
        defaultValues: {
            name: pickup.name,
            address: pickup.address ?? '',
            directions: enTranslation?.directions ?? '',
            price: pickup.price ?? '',
            minutesPrior:
                pickup.minutesPrior != null ? String(pickup.minutesPrior) : '',
            windowStart: pickup.windowStart ?? '',
            windowEnd: pickup.windowEnd ?? '',
            displayOrder: String(pickup.displayOrder),
            isActive: pickup.isActive,
        },
    });

    const isActive = watch('isActive');

    function onSaveDetails(values: EditPickupFormValues) {
        // No latitude/longitude keys: absent means "leave the stored pin
        // alone", where null would erase it.
        const payload: UpdatePickupLocationPayload = {
            name: values.name,
            address: strOrNull(values.address),
            minutesPrior: numOrNull(values.minutesPrior),
            windowStart: strOrNull(values.windowStart),
            windowEnd: strOrNull(values.windowEnd),
            displayOrder: numOrUndef(values.displayOrder),
            isActive: values.isActive,
        };
        // Only a PAID_ADDON tour edits zone prices; never touch the field otherwise
        // so switching the model back and forth keeps previously entered prices.
        if (isPaidPickup) payload.price = strOrNull(values.price);
        updatePickup(
            { tripId, pickupLocationId: pickup.id, payload },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.',
                    ),
            },
        );
        // Directions belong to the EN translation row - save them there when
        // changed (title required by the endpoint; keep the existing one).
        if ((values.directions ?? '') !== (enTranslation?.directions ?? '')) {
            upsertPickupTranslation(
                {
                    tripId,
                    pickupLocationId: pickup.id,
                    locale: 'en',
                    payload: {
                        title: enTranslation?.title ?? values.name,
                        directions: values.directions || undefined,
                    },
                } as never,
                {
                    onError: err =>
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to save directions.',
                        ),
                },
            );
        }
    }

    return (
        <form onSubmit={handleSubmit(onSaveDetails)} className='space-y-3'>
            <Field>
                <Label>Name</Label>
                <Input {...register('name')} aria-invalid={!!errors.name} />
                <FieldError>{errors.name?.message}</FieldError>
            </Field>
            <Field>
                <Label>Address</Label>
                <Input
                    {...register('address')}
                    placeholder='Hotel / street address'
                />
                <FieldDescription>
                    Used for the &ldquo;open in maps&rdquo; link on the
                    traveller&rsquo;s confirmation. If left empty, the zone name
                    is used instead.
                </FieldDescription>
            </Field>
            <Field>
                <Label>Directions (English)</Label>
                <Input
                    {...register('directions')}
                    placeholder='Wait near the concierge desk.'
                />
                <FieldDescription>
                    Shown to travellers with their pickup details; translated
                    per language in the Translation Console.
                </FieldDescription>
            </Field>
            {isPaidPickup && (
                <Field>
                    <Label>Price per person ({currency})</Label>
                    <Input
                        {...register('price')}
                        inputMode='decimal'
                        placeholder='17.00'
                        aria-invalid={!!errors.price}
                    />
                    <FieldDescription>
                        Charged per traveler when this zone is picked at
                        checkout. Leave empty for a free zone.
                    </FieldDescription>
                    <FieldError>{errors.price?.message}</FieldError>
                </Field>
            )}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <Field>
                    <Label>Window start</Label>
                    <Input
                        {...register('windowStart')}
                        type='time'
                        aria-invalid={!!errors.windowStart}
                    />
                    <FieldDescription>
                        Earliest the pickup may arrive.
                    </FieldDescription>
                </Field>
                <Field>
                    <Label>Window end</Label>
                    <Input
                        {...register('windowEnd')}
                        type='time'
                        aria-invalid={!!errors.windowEnd}
                    />
                    <FieldDescription>
                        Latest the pickup may arrive.
                    </FieldDescription>
                </Field>
                <Field>
                    <Label>Mins prior</Label>
                    <Input
                        {...register('minutesPrior')}
                        type='number'
                        min={0}
                        placeholder='30'
                    />
                    <FieldDescription>
                        Drives &ldquo;be ready N minutes before pickup&rdquo;,
                        and stands in as the pickup time when no window is set.
                    </FieldDescription>
                </Field>
            </div>
            <div className='flex items-center justify-between'>
                <Field className='max-w-32'>
                    <Label>Order</Label>
                    <Input
                        {...register('displayOrder')}
                        type='number'
                        min={0}
                    />
                </Field>
                <label className='flex cursor-pointer items-center gap-2 pt-6'>
                    <Checkbox
                        checked={isActive}
                        onCheckedChange={c => setValue('isActive', !!c)}
                    />
                    <span className='text-sm font-medium'>Active</span>
                </label>
            </div>
            <div className='flex justify-end'>
                <Button type='submit' size='sm' disabled={isUpdating}>
                    {isUpdating ? 'Saving...' : 'Save Details'}
                </Button>
            </div>
        </form>
    );
}

interface TripPickupLocationsTabProps {
    tripId: string;
    /** Tour pickup model (Details tab) - PAID_ADDON zones carry per-person prices. */
    pickupModel: PickupModel;
    /** Tour currency the zone prices are entered in. */
    currency: Currency;
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
}

/**
 * Only the FIRST zone appears on the public tour page - `tour-detail-content`
 * reads `pickupLocations[0]` for its "Hotel pickup" block. The rest are real,
 * but they surface at checkout, in the pickup dropdown. Worth saying out loud:
 * an operator who adds five zones and then checks their live page otherwise
 * concludes four of them failed to save.
 */
const MODEL_DESCRIPTION: Record<PickupModel, string> = {
    INCLUDED:
        'Hotel / meeting points where travelers can be collected, with pickup windows. Pickup is included in the tour price, so zones here are free to select. Travelers choose their zone at checkout; the tour page previews the first one.',
    PAID_ADDON:
        'Pickup zones travelers can buy at checkout. Each zone carries a per-person price ("Pickup location (From X p.p.)" in the tour currency); free zones are allowed too. Travelers choose their zone at checkout; the tour page previews the first one.',
    NONE: 'Pickup is disabled for this tour (Pickup model on the Details tab is "None"), so these locations are NOT offered at checkout. Switch the model to Included or Paid add-on to use them.',
};

export function TripPickupLocationsTab({
    tripId,
    pickupModel,
    currency,
    bare,
}: TripPickupLocationsTabProps) {
    const isPaidPickup = pickupModel === 'PAID_ADDON';
    const { data: pickups, isLoading } = usePickupLocations(tripId);
    const { mutate: addPickup, isPending: isAdding } = useAddPickupLocation();
    const { mutate: removePickup, isPending: isRemoving } =
        useRemovePickupLocation();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<AddPickupFormValues>({
        resolver: zodResolver(addPickupSchema),
        defaultValues: {
            name: '',
            address: '',
            directions: '',
            price: '',
            minutesPrior: '',
            windowStart: '',
            windowEnd: '',
        },
    });

    function onAdd(values: AddPickupFormValues) {
        const payload: CreatePickupLocationPayload = {
            name: values.name,
            address: values.address || undefined,
            directions: values.directions || undefined,
            price: isPaidPickup ? values.price || undefined : undefined,
            minutesPrior: numOrUndef(values.minutesPrior),
            windowStart: values.windowStart || undefined,
            windowEnd: values.windowEnd || undefined,
            // The old form appended at the end via a hidden field -
            // preserved so ordering behavior is unchanged.
            displayOrder: pickups?.length ?? 0,
        };
        addPickup(
            { tripId, payload },
            {
                onSuccess: () => {
                    reset();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add pickup.',
                    ),
            },
        );
    }

    return (
        <EditableListSection
            bare={bare}
            title='Pickup Locations'
            description={MODEL_DESCRIPTION[pickupModel]}
            items={pickups}
            isLoading={isLoading}
            getId={p => p.id}
            renderSummary={p => (
                <span className='flex min-w-0 items-center gap-2'>
                    <HugeiconsIcon
                        icon={Bus01Icon}
                        className='size-4 shrink-0 text-content-muted'
                    />
                    <span className='truncate'>{p.name}</span>
                    {!p.isActive && (
                        <Badge variant='outline' className='shrink-0 text-xs'>
                            Inactive
                        </Badge>
                    )}
                    {isPaidPickup && (
                        <Badge variant='secondary' className='shrink-0 text-xs'>
                            {p.price != null && Number(p.price) > 0
                                ? `${formatPriceFrom(p.price, currency, 'en')} p.p.`
                                : 'Free'}
                        </Badge>
                    )}
                    {(p.windowStart || p.windowEnd) && (
                        <Badge variant='secondary' className='shrink-0 text-xs'>
                            {p.windowStart ?? '—'}–{p.windowEnd ?? '—'}
                        </Badge>
                    )}
                </span>
            )}
            renderExpanded={p => (
                <PickupDetailsEditor
                    pickup={p}
                    tripId={tripId}
                    isPaidPickup={isPaidPickup}
                    currency={currency}
                />
            )}
            onDelete={p =>
                removePickup(
                    { tripId, pickupLocationId: p.id },
                    {
                        onError: err =>
                            toast.error(
                                err instanceof Error
                                    ? err.message
                                    : 'Failed to remove.',
                            ),
                    },
                )
            }
            isDeleting={isRemoving}
            emptyText='No pickup locations yet.'
            addForm={{
                heading: 'Add pickup location',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Name</Label>
                            <Input
                                {...register('name')}
                                placeholder='Marriott Beach Resort - main lobby'
                                aria-invalid={!!errors.name}
                            />
                            <FieldError>{errors.name?.message}</FieldError>
                        </Field>
                        <Field>
                            <Label>Address</Label>
                            <Input
                                {...register('address')}
                                placeholder='Street address'
                            />
                            <FieldDescription>
                                Used for the &ldquo;open in maps&rdquo; link on
                                the traveller&rsquo;s confirmation. If left
                                empty, the zone name is used instead.
                            </FieldDescription>
                        </Field>
                        <Field>
                            <Label>Directions (English)</Label>
                            <Input
                                {...register('directions')}
                                placeholder='Wait near the concierge desk.'
                            />
                        </Field>
                        {isPaidPickup && (
                            <Field>
                                <Label>Price per person ({currency})</Label>
                                <Input
                                    {...register('price')}
                                    inputMode='decimal'
                                    placeholder='17.00'
                                    aria-invalid={!!errors.price}
                                />
                                <FieldDescription>
                                    Charged per traveler when this zone is
                                    picked at checkout. Leave empty for a free
                                    zone.
                                </FieldDescription>
                                <FieldError>{errors.price?.message}</FieldError>
                            </Field>
                        )}
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                            <Field>
                                <Label>Window start</Label>
                                <Input
                                    {...register('windowStart')}
                                    type='time'
                                    aria-invalid={!!errors.windowStart}
                                />
                            </Field>
                            <Field>
                                <Label>Window end</Label>
                                <Input
                                    {...register('windowEnd')}
                                    type='time'
                                    aria-invalid={!!errors.windowEnd}
                                />
                            </Field>
                            <Field>
                                <Label>Mins prior</Label>
                                <Input
                                    {...register('minutesPrior')}
                                    type='number'
                                    min={0}
                                    placeholder='30'
                                />
                            </Field>
                        </div>
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add pickup'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
