'use client';

import { Location01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { zodResolver } from '@hookform/resolvers/zod';
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
    streetAddress: z.string().max(160).optional().or(z.literal('')),
    addressLocality: z.string().max(120).optional().or(z.literal('')),
    addressRegion: z.string().max(120).optional().or(z.literal('')),
    postalCode: z.string().max(40).optional().or(z.literal('')),
    addressCountry: z.string().max(80).optional().or(z.literal('')),
    minutesTo: numberString({
        min: 0,
        int: true,
        message: 'Enter minutes as a whole number (0 or more).',
    }),
    minutesAt: numberString({
        min: 0,
        int: true,
        message: 'Enter minutes as a whole number (0 or more).',
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

const editLocationSchema = z.object(locationFieldsSchema);
type EditLocationFormValues = z.infer<typeof editLocationSchema>;

const numOrNull = (v: string | undefined): number | null =>
    v && v.trim() !== '' ? Number(v) : null;
const numOrUndef = (v: string | undefined): number | undefined =>
    v && v.trim() !== '' ? Number(v) : undefined;
const strOrNull = (v: string | undefined): string | null =>
    v && v.trim() !== '' ? v : null;

/** Inline details editor for one stop - payload identical to the old tab. */
function LocationDetailsEditor({
    location,
    tripId,
}: {
    location: TourLocation;
    tripId: string;
}) {
    const { mutate: updateLocation, isPending: isUpdating } =
        useUpdateLocation();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<EditLocationFormValues>({
        resolver: zodResolver(editLocationSchema),
        defaultValues: {
            types: location.types,
            latitude: location.latitude != null ? String(location.latitude) : '',
            longitude:
                location.longitude != null ? String(location.longitude) : '',
            streetAddress: location.streetAddress ?? '',
            addressLocality: location.addressLocality ?? '',
            addressRegion: location.addressRegion ?? '',
            postalCode: location.postalCode ?? '',
            addressCountry: location.addressCountry ?? '',
            minutesTo:
                location.minutesTo != null ? String(location.minutesTo) : '',
            minutesAt:
                location.minutesAt != null ? String(location.minutesAt) : '',
            displayOrder: String(location.displayOrder),
        },
    });

    function onSaveDetails(values: EditLocationFormValues) {
        const payload: UpdateTourLocationPayload = {
            types: values.types,
            latitude: numOrNull(values.latitude),
            longitude: numOrNull(values.longitude),
            streetAddress: strOrNull(values.streetAddress),
            addressLocality: strOrNull(values.addressLocality),
            addressRegion: strOrNull(values.addressRegion),
            postalCode: strOrNull(values.postalCode),
            addressCountry: strOrNull(values.addressCountry),
            minutesTo: numOrNull(values.minutesTo),
            minutesAt: numOrNull(values.minutesAt),
            displayOrder: numOrUndef(values.displayOrder),
        };
        updateLocation(
            { tripId, locationId: location.id, payload },
            {
                onSuccess: () => toast.success('Location saved.'),
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.',
                    ),
            },
        );
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
            <Field>
                <Label>Street Address</Label>
                <Input
                    {...register('streetAddress')}
                    placeholder='Pier 3, Main Dock'
                />
            </Field>
            <div className='grid grid-cols-2 gap-3'>
                <Field>
                    <Label>Locality / City</Label>
                    <Input
                        {...register('addressLocality')}
                        placeholder='Willemstad'
                    />
                </Field>
                <Field>
                    <Label>Region</Label>
                    <Input
                        {...register('addressRegion')}
                        placeholder='Curaçao'
                    />
                </Field>
                <Field>
                    <Label>Postal Code</Label>
                    <Input {...register('postalCode')} />
                </Field>
                <Field>
                    <Label>Country</Label>
                    <Input
                        {...register('addressCountry')}
                        placeholder='Curaçao'
                    />
                </Field>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <Field>
                    <Label>Travel (mins)</Label>
                    <Input
                        {...register('minutesTo')}
                        type='number'
                        min={0}
                        placeholder='20'
                        aria-invalid={!!errors.minutesTo}
                    />
                    <FieldDescription>
                        Minutes to travel here from the previous stop.
                    </FieldDescription>
                    <FieldError>{errors.minutesTo?.message}</FieldError>
                </Field>
                <Field>
                    <Label>At Stop (mins)</Label>
                    <Input
                        {...register('minutesAt')}
                        type='number'
                        min={0}
                        placeholder='45'
                        aria-invalid={!!errors.minutesAt}
                    />
                    <FieldDescription>
                        Minutes spent at this stop.
                    </FieldDescription>
                    <FieldError>{errors.minutesAt?.message}</FieldError>
                </Field>
                <Field>
                    <Label>Order</Label>
                    <Input
                        {...register('displayOrder')}
                        type='number'
                        min={0}
                        aria-invalid={!!errors.displayOrder}
                    />
                    <FieldError>{errors.displayOrder?.message}</FieldError>
                </Field>
            </div>
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
}

export function TripLocationsTab({ tripId }: TripLocationsTabProps) {
    const { data: locations, isLoading } = useLocations(tripId);
    const { mutate: addLocation, isPending: isAdding } = useAddLocation();
    const { mutate: removeLocation, isPending: isRemoving } =
        useRemoveLocation();

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm<AddLocationFormValues>({
        resolver: zodResolver(addLocationSchema),
        defaultValues: {
            types: ['ITINERARY_ITEM'],
            title: '',
            shortDescription: '',
            latitude: '',
            longitude: '',
            streetAddress: '',
            addressLocality: '',
            addressRegion: '',
            postalCode: '',
            addressCountry: '',
            minutesTo: '',
            minutesAt: '',
        },
    });

    function onAdd(values: AddLocationFormValues) {
        const payload: CreateTourLocationPayload = {
            types: values.types,
            title: values.title,
            shortDescription: values.shortDescription || undefined,
            latitude: numOrUndef(values.latitude),
            longitude: numOrUndef(values.longitude),
            streetAddress: values.streetAddress || undefined,
            addressLocality: values.addressLocality || undefined,
            addressRegion: values.addressRegion || undefined,
            postalCode: values.postalCode || undefined,
            addressCountry: values.addressCountry || undefined,
            minutesTo: numOrUndef(values.minutesTo),
            minutesAt: numOrUndef(values.minutesAt),
            // The old form appended at the end via a hidden field -
            // preserved so ordering behavior is unchanged.
            displayOrder: locations?.length ?? 0,
        };
        addLocation(
            { tripId, payload },
            {
                onSuccess: () => {
                    toast.success('Location added.');
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
                <LocationDetailsEditor location={loc} tripId={tripId} />
            )}
            onDelete={loc =>
                removeLocation(
                    { tripId, locationId: loc.id },
                    {
                        onSuccess: () => toast.success('Location removed.'),
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
                heading: 'Add Location',
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
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                            <Field>
                                <Label>Travel (mins)</Label>
                                <Input
                                    {...register('minutesTo')}
                                    type='number'
                                    min={0}
                                    placeholder='20'
                                    aria-invalid={!!errors.minutesTo}
                                />
                                <FieldDescription>
                                    Minutes to travel here from the previous
                                    stop.
                                </FieldDescription>
                                <FieldError>
                                    {errors.minutesTo?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>At Stop (mins)</Label>
                                <Input
                                    {...register('minutesAt')}
                                    type='number'
                                    min={0}
                                    placeholder='45'
                                    aria-invalid={!!errors.minutesAt}
                                />
                                <FieldDescription>
                                    Minutes spent at this stop.
                                </FieldDescription>
                                <FieldError>
                                    {errors.minutesAt?.message}
                                </FieldError>
                            </Field>
                        </div>
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add Location'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
