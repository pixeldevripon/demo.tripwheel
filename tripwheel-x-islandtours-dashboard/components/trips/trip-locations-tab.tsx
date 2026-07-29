'use client';

import { Location01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import {
    useAddLocation,
    useLocations,
    useRemoveLocation,
    useUpdateLocation,
    useUpsertLocationTranslation,
} from '@/hooks/trips/use-trips';
import type {
    CreateTourLocationPayload,
    TourLocation,
    UpdateTourLocationPayload,
} from '@/types/trip';
import { EditableListSection } from './editable-list-section';

const LOCATION_TYPE_OPTIONS = [
    { value: 'START', label: 'Start' },
    { value: 'ITINERARY_ITEM', label: 'Itinerary stop' },
    { value: 'END', label: 'End' },
    { value: 'POI', label: 'Point of interest' },
];

function typeLabel(value: string): string {
    return LOCATION_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value;
}

/** A form string that, when non-empty, must parse to a number within bounds. */
const numberString = (opts: {
    min?: number;
    max?: number;
    int?: boolean;
    message: string;
}) =>
    z
        .string()
        .optional()
        .refine(v => {
            if (v == null || v.trim() === '') return true;
            const n = Number(v);
            if (!Number.isFinite(n)) return false;
            if (opts.int && !Number.isInteger(n)) return false;
            if (opts.min != null && n < opts.min) return false;
            if (opts.max != null && n > opts.max) return false;
            return true;
        }, opts.message);

/**
 * A stop asks for what a traveller is shown, and nothing else.
 *
 * `TourLocation` also carries `streetAddress`, `addressLocality`,
 * `addressRegion`, `postalCode`, `addressCountry`, `minutesTo` and
 * `minutesAt`. Not one of them is read by the public tour page, the booking
 * widget, the confirmation email or the TouristTrip JSON-LD - their only
 * consumer is the OCTO product serializer, and OCTO is still pipeline. Seven
 * inputs per stop for a channel that has no partners yet is a tax on every
 * operator, so the form stopped asking (2026-07-29).
 *
 * The columns stay: they are nullable, the update endpoint keys off
 * `'field' in dto`, and omitting a key leaves the stored value untouched.
 * Nothing already entered is destroyed, and re-adding the block when OCTO goes
 * live is a UI change only.
 */
const locationFieldsSchema = {
    types: z.array(z.string()).min(1, 'Select at least one type'),
    latitude: numberString({
        min: -90,
        max: 90,
        message: 'Latitude must be a number between -90 and 90.',
    }),
    longitude: numberString({
        min: -180,
        max: 180,
        message: 'Longitude must be a number between -180 and 180.',
    }),
    displayOrder: numberString({
        min: 0,
        int: true,
        message: 'Enter a whole number (0 or more).',
    }),
};

const addLocationSchema = z.object({
    ...locationFieldsSchema,
    title: z.string().min(2, 'At least 2 characters').max(160),
    shortDescription: z.string().max(500).optional().or(z.literal('')),
});
type AddLocationFormValues = z.infer<typeof addLocationSchema>;

/**
 * The edit form carries the English title and description too.
 *
 * They live on the stop's `en` TourLocationTranslation row, not the base
 * record, which is why they were only ever on the add form - and why a stop
 * created with a typo in its title could not be corrected here at all. The
 * title is the whole stop as far as a traveller is concerned: the tour page
 * FILTERS OUT any stop without one. Same contract as the pickup editor's
 * Directions field - read from the `en` row, written back to it, and only when
 * it actually changed.
 */
const editLocationSchema = z.object({
    ...locationFieldsSchema,
    title: z.string().min(2, 'At least 2 characters').max(160),
    shortDescription: z.string().max(500).optional().or(z.literal('')),
});
type EditLocationFormValues = z.infer<typeof editLocationSchema>;

/**
 * Live draft coordinates, reported up so the route map beside the list can
 * redraw as the operator types - before anything is saved. Out-of-range or
 * half-typed values report `null` rather than a marker somewhere confidently
 * wrong.
 */
export function parseDraftPoint(
    lat: string | undefined,
    lng: string | undefined,
): { lat: number; lng: number } | null {
    const a = Number.parseFloat(lat ?? '');
    const b = Number.parseFloat(lng ?? '');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a < -90 || a > 90 || b < -180 || b > 180) return null;
    return { lat: a, lng: b };
}

/** Key the add form reports under - it has no id until it is saved. */
export const NEW_STOP_KEY = '__new__';

const numOrNull = (v: string | undefined): number | null =>
    v && v.trim() !== '' ? Number(v) : null;
const numOrUndef = (v: string | undefined): number | undefined =>
    v && v.trim() !== '' ? Number(v) : undefined;

/** Inline details editor for one stop - payload identical to the old tab. */
function LocationDetailsEditor({
    location,
    tripId,
    onDraftPoint,
}: {
    location: TourLocation;
    tripId: string;
    onDraftPoint?: (key: string, point: { lat: number; lng: number } | null) => void;
}) {
    const { mutate: updateLocation, isPending: isUpdating } =
        useUpdateLocation();
    const { mutate: upsertLocationTranslation } =
        useUpsertLocationTranslation();

    // Title and description live on the ENGLISH translation row, not the base
    // record - the create form writes them there, so the editor must read and
    // save them from the same place.
    const enTranslation = location.translations?.find(t => t.locale === 'en');

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm<EditLocationFormValues>({
        resolver: zodResolver(editLocationSchema),
        defaultValues: {
            types: location.types,
            title: enTranslation?.title ?? '',
            shortDescription: enTranslation?.shortDescription ?? '',
            latitude: location.latitude != null ? String(location.latitude) : '',
            longitude:
                location.longitude != null ? String(location.longitude) : '',
            displayOrder: String(location.displayOrder),
        },
    });

    // A drag on the route map writes straight to this record, so re-seed the
    // form when the saved coordinates change underneath it. Without this the
    // form holds its mount-time values and the next Save undoes the drag.
    useEffect(() => {
        setValue(
            'latitude',
            location.latitude != null ? String(location.latitude) : '',
        );
        setValue(
            'longitude',
            location.longitude != null ? String(location.longitude) : '',
        );
    }, [location.latitude, location.longitude, setValue]);

    const draftLat = watch('latitude');
    const draftLng = watch('longitude');
    useEffect(() => {
        onDraftPoint?.(location.id, parseDraftPoint(draftLat, draftLng));
    }, [onDraftPoint, location.id, draftLat, draftLng]);

    function onSaveDetails(values: EditLocationFormValues) {
        // The address and travel-minutes keys are deliberately absent, not
        // null: the endpoint only writes a column when its key is present, so
        // omitting them preserves whatever an operator entered before the
        // block was retired.
        const payload: UpdateTourLocationPayload = {
            types: values.types,
            latitude: numOrNull(values.latitude),
            longitude: numOrNull(values.longitude),
            displayOrder: numOrUndef(values.displayOrder),
        };
        updateLocation(
            { tripId, locationId: location.id, payload },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.',
                    ),
            },
        );
        // The English copy is a separate record - only write it when it moved,
        // so saving a coordinate does not churn the translation row (and, with
        // it, whatever the AI translation job derived from it).
        const titleChanged = values.title !== (enTranslation?.title ?? '');
        const descChanged =
            (values.shortDescription ?? '') !==
            (enTranslation?.shortDescription ?? '');
        if (titleChanged || descChanged) {
            upsertLocationTranslation(
                {
                    tripId,
                    locationId: location.id,
                    locale: 'en',
                    payload: {
                        title: values.title,
                        shortDescription: values.shortDescription || undefined,
                    },
                },
                {
                    onError: err =>
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to save the stop copy.',
                        ),
                },
            );
        }
    }

    return (
        <form onSubmit={handleSubmit(onSaveDetails)} className='space-y-3'>
            <Field>
                <Label>Types</Label>
                <Controller
                    name='types'
                    control={control}
                    render={({ field }) => (
                        <MultiSelect
                            options={LOCATION_TYPE_OPTIONS}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder='Select types…'
                        />
                    )}
                />
            </Field>
            <Field>
                <Label>Title (English)</Label>
                <Input
                    {...register('title')}
                    placeholder='Main Dock'
                    aria-invalid={!!errors.title}
                />
                <FieldDescription>
                    Names the stop in &ldquo;What to expect&rdquo;. A stop with
                    no title is left off the tour page entirely.
                </FieldDescription>
                <FieldError>{errors.title?.message}</FieldError>
            </Field>
            <Field>
                <Label>Short Description</Label>
                <Input
                    {...register('shortDescription')}
                    placeholder='Meet your crew beside the check-in counter.'
                    aria-invalid={!!errors.shortDescription}
                />
                <FieldError>{errors.shortDescription?.message}</FieldError>
            </Field>
            <div className='grid grid-cols-2 gap-3'>
                <Field>
                    <Label>Latitude</Label>
                    <Input
                        {...register('latitude')}
                        type='number'
                        step='any'
                        placeholder='12.1091'
                        aria-invalid={!!errors.latitude}
                    />
                    <FieldError>{errors.latitude?.message}</FieldError>
                </Field>
                <Field>
                    <Label>Longitude</Label>
                    <Input
                        {...register('longitude')}
                        type='number'
                        step='any'
                        placeholder='-68.9316'
                        aria-invalid={!!errors.longitude}
                    />
                    <FieldError>{errors.longitude?.message}</FieldError>
                </Field>
            </div>
            <Field className='max-w-32'>
                <Label>Order</Label>
                <Input
                    {...register('displayOrder')}
                    type='number'
                    min={0}
                    aria-invalid={!!errors.displayOrder}
                />
                <FieldError>{errors.displayOrder?.message}</FieldError>
            </Field>
            <div className='flex justify-end'>
                <Button type='submit' size='sm' disabled={isUpdating}>
                    {isUpdating ? 'Saving...' : 'Save Details'}
                </Button>
            </div>
        </form>
    );
}

interface TripLocationsTabProps {
    tripId: string;
    /**
     * Reports live coordinate edits so the route map beside this list can
     * redraw before a save. Stops no longer carry their own map - one map on
     * the right shows the whole route, which is the thing you are actually
     * checking when you type a coordinate.
     */
    onDraftPoint?: (
        key: string,
        point: { lat: number; lng: number } | null,
    ) => void;
    /**
     * A coordinate pushed IN from the map - dragging the pending pin, which
     * has no record to write to yet. Applied to the add form so the numbers
     * and the marker never disagree.
     */
    pendingPoint?: { lat: number; lng: number } | null;
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
}

export function TripLocationsTab({
    tripId,
    onDraftPoint,
    pendingPoint,
    bare,
}: TripLocationsTabProps) {
    const { data: locations, isLoading } = useLocations(tripId);
    const { mutate: addLocation, isPending: isAdding } = useAddLocation();
    const { mutate: removeLocation, isPending: isRemoving } =
        useRemoveLocation();

    const {
        register,
        handleSubmit,
        reset,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm<AddLocationFormValues>({
        resolver: zodResolver(addLocationSchema),
        defaultValues: {
            types: ['ITINERARY_ITEM'],
            title: '',
            shortDescription: '',
            latitude: '',
            longitude: '',
        },
    });

    const newLat = watch('latitude');
    const newLng = watch('longitude');
    useEffect(() => {
        onDraftPoint?.(NEW_STOP_KEY, parseDraftPoint(newLat, newLng));
    }, [onDraftPoint, newLat, newLng]);

    // Map -> form. Only fires when the pin is dragged, never on typing, so
    // the two directions cannot loop.
    useEffect(() => {
        if (!pendingPoint) return;
        setValue('latitude', String(pendingPoint.lat), { shouldDirty: true });
        setValue('longitude', String(pendingPoint.lng), { shouldDirty: true });
    }, [pendingPoint, setValue]);

    function onAdd(values: AddLocationFormValues) {
        const payload: CreateTourLocationPayload = {
            types: values.types,
            title: values.title,
            shortDescription: values.shortDescription || undefined,
            latitude: numOrUndef(values.latitude),
            longitude: numOrUndef(values.longitude),
            // The old form appended at the end via a hidden field -
            // preserved so ordering behavior is unchanged.
            displayOrder: locations?.length ?? 0,
        };
        addLocation(
            { tripId, payload },
            {
                onSuccess: () => {
                    reset();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add location.',
                    ),
            },
        );
    }

    return (
        <EditableListSection
            bare={bare}
            title='Itinerary & Locations'
            description='Start point, itinerary stops, end point and points of interest.'
            items={locations}
            isLoading={isLoading}
            getId={loc => loc.id}
            renderSummary={loc => {
                const en = loc.translations.find(t => t.locale === 'en');
                return (
                    <span className='flex min-w-0 items-center gap-2'>
                        <HugeiconsIcon
                            icon={Location01Icon}
                            className='size-4 shrink-0 text-content-muted'
                        />
                        <span className='flex shrink-0 gap-1'>
                            {loc.types.map(t => (
                                <Badge
                                    key={t}
                                    variant='secondary'
                                    className='text-xs'>
                                    {typeLabel(t)}
                                </Badge>
                            ))}
                        </span>
                        <span className='truncate'>
                            {en?.title ?? '(no EN title)'}
                        </span>
                    </span>
                );
            }}
            renderExpanded={loc => (
                <LocationDetailsEditor
                    location={loc}
                    tripId={tripId}
                    onDraftPoint={onDraftPoint}
                />
            )}
            onDelete={loc =>
                removeLocation(
                    { tripId, locationId: loc.id },
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
            emptyText='No locations yet.'
            addForm={{
                heading: 'Add location',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Types</Label>
                            <Controller
                                name='types'
                                control={control}
                                render={({ field }) => (
                                    <MultiSelect
                                        options={LOCATION_TYPE_OPTIONS}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder='Select types…'
                                    />
                                )}
                            />
                            <FieldError>{errors.types?.message}</FieldError>
                        </Field>
                        <Field>
                            <Label>Title (English)</Label>
                            <Input
                                {...register('title')}
                                placeholder='Main Dock'
                                aria-invalid={!!errors.title}
                            />
                            <FieldError>{errors.title?.message}</FieldError>
                        </Field>
                        <Field>
                            <Label>Short Description</Label>
                            <Input
                                {...register('shortDescription')}
                                placeholder='Meet your crew beside the check-in counter.'
                            />
                        </Field>
                        <div className='grid grid-cols-2 gap-3'>
                            <Field>
                                <Label>Latitude</Label>
                                <Input
                                    {...register('latitude')}
                                    type='number'
                                    step='any'
                                    placeholder='12.1091'
                                    aria-invalid={!!errors.latitude}
                                />
                                <FieldError>
                                    {errors.latitude?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>Longitude</Label>
                                <Input
                                    {...register('longitude')}
                                    type='number'
                                    step='any'
                                    placeholder='-68.9316'
                                    aria-invalid={!!errors.longitude}
                                />
                                <FieldError>
                                    {errors.longitude?.message}
                                </FieldError>
                            </Field>
                        </div>
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add location'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
