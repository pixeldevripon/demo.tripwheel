'use client';

import { isValidIanaTimeZone } from '@/utils/intl-utils';
import { ImageSelectorField } from '@/components/dashboard/media/image-selector-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useActiveDestinations,
    useCreateDestination,
    useUpdateDestination,
} from '@/hooks/destinations/use-destinations';
import type { DestinationDetail } from '@/types/destination';
import { REGION_VALUES, CURRENCY_VALUES, CURRENCY_LABELS } from '@/types/enums';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DestinationDeleteDialog } from './destination-delete-dialog';
import { useRole } from '@/contexts/role-context';

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const destinationSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
    heroImage: z.string().optional(),
    region: z.enum(REGION_VALUES as [string, ...string[]], { message: 'Region is required' }),
    country: z.string().optional(),
    latitude: z
        .string()
        .optional()
        .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90), 'Latitude must be between -90 and 90'),
    longitude: z
        .string()
        .optional()
        .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180), 'Longitude must be between -180 and 180'),
    timezone: z
        .string()
        .min(1, 'Timezone is required')
        .refine(
            isValidIanaTimeZone,
            'Must be a valid IANA timezone (e.g. America/Curacao), not an offset like UTC-4'
        ),
    currency: z.enum(CURRENCY_VALUES as [string, ...string[]]).optional().or(z.literal('')),
    language: z.string().optional(),
    galleryImages: z.array(z.string()).optional(),
    parentDestinationId: z.string().optional(),
    isActive: z.boolean().optional(),
});

type DestinationFormValues = z.infer<typeof destinationSchema>;

interface DestinationFormProps {
    destination?: DestinationDetail;
    onSuccess?: (destination: DestinationDetail) => void;
}

export function DestinationForm({
    destination,
    onSuccess,
}: DestinationFormProps) {
    const router = useRouter();
    const isEditMode = !!destination;
    const [deleteOpen, setDeleteOpen] = useState(false);
    const { can } = useRole();

    const { mutate: createDestination, isPending: isCreating } =
        useCreateDestination();
    const { mutate: updateDestination, isPending: isUpdating } =
        useUpdateDestination();
    const isPending = isCreating || isUpdating;

    const { data: activeDestinations } = useActiveDestinations();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<DestinationFormValues>({
        resolver: zodResolver(destinationSchema),
        defaultValues: {
            name: destination?.name ?? '',
            slug: destination?.slug ?? '',
            heroImage: destination?.heroImage ?? '',
            region: destination?.region ?? undefined,
            country: destination?.country ?? '',
            latitude: destination?.latitude?.toString() ?? '',
            longitude: destination?.longitude?.toString() ?? '',
            timezone: destination?.timezone ?? '',
            currency: destination?.currency ?? '',
            language: destination?.language ?? '',
            galleryImages: destination?.galleryImages ?? [],
            parentDestinationId: destination?.parentDestinationId ?? '',
            isActive: destination?.isActive ?? true,
        },
    });

    const heroImageValue = watch('heroImage');
    const galleryValue = watch('galleryImages');
    const regionValue = watch('region');
    const currencyValue = watch('currency');
    const parentValue = watch('parentDestinationId');
    const isActiveValue = watch('isActive');
    const nameValue = watch('name');

    // Parent-destination options (exclude self in edit mode)
    const parentOptions = (activeDestinations ?? []).filter(
        d => d.id !== destination?.id,
    );

    // Normalize an optional numeric string field for the payload
    const num = (v: string | undefined) =>
        v === '' || v === undefined ? null : Number(v);

    // Auto-generate slug from name only in create mode and only when not manually edited
    const [slugTouched, setSlugTouched] = useState(false);
    useEffect(() => {
        if (!isEditMode && !slugTouched) {
            setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
        }
    }, [nameValue, isEditMode, slugTouched, setValue]);

    function onSubmit(values: DestinationFormValues) {
        if (isEditMode && destination) {
            updateDestination(
                {
                    id: destination.id,
                    payload: {
                        name: values.name,
                        heroImage: values.heroImage || null,
                        region: values.region as DestinationDetail['region'] ?? undefined,
                        country: values.country || null,
                        latitude: num(values.latitude),
                        longitude: num(values.longitude),
                        timezone: values.timezone,
                        currency: (values.currency || null) as import("@/types/enums").Currency | null,
                        language: values.language || null,
                        galleryImages: values.galleryImages ?? [],
                        isActive: values.isActive,
                    },
                },
                {
                    onSuccess: updated => {
                        toast.success('Destination updated successfully.');
                        onSuccess?.(updated);
                    },
                    onError: err => {
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to update destination.'
                        );
                    },
                }
            );
        } else {
            createDestination(
                {
                    name: values.name,
                    slug: values.slug,
                    heroImage: values.heroImage || null,
                    region: values.region as DestinationDetail['region'] as NonNullable<DestinationDetail['region']>,
                    country: values.country || null,
                    latitude: num(values.latitude),
                    longitude: num(values.longitude),
                    timezone: values.timezone,
                    currency: (values.currency || null) as import("@/types/enums").Currency | null,
                    language: values.language || null,
                    galleryImages: values.galleryImages ?? [],
                    parentDestinationId: values.parentDestinationId || null,
                },
                {
                    onSuccess: created => {
                        toast.success('Destination created successfully.');
                        onSuccess?.(created);
                        router.push(
                            `/dashboard/destinations/${created.id}/edit`
                        );
                    },
                    onError: err => {
                        toast.error(
                            err instanceof Error
                                ? err.message
                                : 'Failed to create destination.'
                        );
                    },
                }
            );
        }
    }

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>Destination Details</CardTitle>
                </CardHeader>
                <CardContent className='pt-8'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-6'>
                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Name <span className='text-destructive'>*</span>
                            </Label>
                            <Input
                                {...register('name')}
                                placeholder='e.g. Curaçao'
                                aria-invalid={!!errors.name}
                            />
                            <FieldError>{errors.name?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Slug {!isEditMode && <span className='text-destructive'>*</span>}
                            </Label>
                            {isEditMode ? (
                                <Input
                                    value={destination?.slug ?? ''}
                                    readOnly
                                    className='opacity-60 cursor-not-allowed'
                                />
                            ) : (
                                <Input
                                    {...register('slug')}
                                    placeholder='e.g. curacao'
                                    aria-invalid={!!errors.slug}
                                    onChange={(e) => {
                                        setSlugTouched(true);
                                        setValue('slug', e.target.value, { shouldValidate: true });
                                    }}
                                />
                            )}
                            <FieldDescription>
                                {isEditMode
                                    ? 'Slug cannot be changed after creation.'
                                    : 'Used in the URL. Auto-generated from the name, but you can customise it.'}
                            </FieldDescription>
                            {!isEditMode && <FieldError>{errors.slug?.message}</FieldError>}
                        </Field>

                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Hero Image
                            </Label>
                            <FieldDescription>
                                Destination&apos;s hero banner image. Select
                                from your media library.
                            </FieldDescription>
                            <ImageSelectorField
                                value={heroImageValue || null}
                                onChange={url =>
                                    setValue('heroImage', url ?? '', {
                                        shouldValidate: true,
                                    })
                                }
                            />
                            <FieldError>{errors.heroImage?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Region <span className='text-destructive'>*</span>
                            </Label>
                            <Select
                                value={regionValue ?? ''}
                                onValueChange={v =>
                                    setValue('region', v, { shouldValidate: true })
                                }>
                                <SelectTrigger aria-invalid={!!errors.region}>
                                    <SelectValue placeholder='Select a region' />
                                </SelectTrigger>
                                <SelectContent>
                                    {REGION_VALUES.map(r => (
                                        <SelectItem key={r} value={r}>
                                            {r.charAt(0) + r.slice(1).toLowerCase()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldDescription>
                                Used to group destinations (no URL effect).
                            </FieldDescription>
                            <FieldError>{errors.region?.message}</FieldError>
                        </Field>

                        <div className='grid gap-6 sm:grid-cols-2'>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>Country</Label>
                                <Input {...register('country')} placeholder='e.g. Curaçao' />
                            </Field>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>Currency</Label>
                                <Select
                                    value={currencyValue || '__none__'}
                                    onValueChange={v =>
                                        setValue('currency', v === '__none__' ? '' : v)
                                    }>
                                    <SelectTrigger>
                                        <SelectValue placeholder='Select a currency' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='__none__'>None</SelectItem>
                                        {CURRENCY_VALUES.map(c => (
                                            <SelectItem key={c} value={c}>
                                                {CURRENCY_LABELS[c]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>
                                    Timezone <span className='text-destructive'>*</span>
                                </Label>
                                <Input {...register('timezone')} placeholder='e.g. America/Curacao' aria-invalid={!!errors.timezone} />
                                <FieldDescription>IANA timezone (required) - anchors all local tour/departure/booking times for this destination.</FieldDescription>
                                {errors.timezone && <FieldError>{errors.timezone.message}</FieldError>}
                            </Field>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>Language</Label>
                                <Input {...register('language')} placeholder='e.g. en' />
                            </Field>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>Latitude</Label>
                                <Input
                                    type='number'
                                    step='any'
                                    {...register('latitude')}
                                    placeholder='e.g. 12.1696'
                                    aria-invalid={!!errors.latitude}
                                />
                                <FieldError>{errors.latitude?.message}</FieldError>
                            </Field>
                            <Field>
                                <Label className='text-xs font-semibold uppercase'>Longitude</Label>
                                <Input
                                    type='number'
                                    step='any'
                                    {...register('longitude')}
                                    placeholder='e.g. -68.9900'
                                    aria-invalid={!!errors.longitude}
                                />
                                <FieldError>{errors.longitude?.message}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Parent Destination
                            </Label>
                            <Select
                                value={parentValue || '__none__'}
                                onValueChange={v =>
                                    setValue(
                                        'parentDestinationId',
                                        v === '__none__' ? '' : v,
                                    )
                                }>
                                <SelectTrigger>
                                    <SelectValue placeholder='None' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='__none__'>None</SelectItem>
                                    {parentOptions.map(d => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldDescription>
                                Optional - for future sub-destinations.
                            </FieldDescription>
                        </Field>

                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
                                Gallery Images
                            </Label>
                            <FieldDescription>
                                Additional images shown on the destination page.
                            </FieldDescription>
                            <ImageSelectorField
                                multiple
                                value={galleryValue ?? []}
                                onChange={urls =>
                                    setValue('galleryImages', urls, { shouldValidate: true })
                                }
                            />
                        </Field>

                        {isEditMode && (
                            <Field>
                                <div className='flex items-center gap-2'>
                                    <Checkbox
                                        id='isActive'
                                        checked={isActiveValue}
                                        onCheckedChange={checked =>
                                            setValue('isActive', !!checked)
                                        }
                                    />
                                    <Label
                                        htmlFor='isActive'
                                        className='text-xs font-semibold uppercase cursor-pointer'>
                                        Active
                                    </Label>
                                </div>
                                <FieldDescription>
                                    Inactive destinations are hidden from the
                                    public site.
                                </FieldDescription>
                            </Field>
                        )}

                        <div className='flex justify-end pt-2'>
                            <Button type='submit' disabled={isPending}>
                                {isPending
                                    ? isEditMode
                                        ? 'Saving...'
                                        : 'Creating...'
                                    : isEditMode
                                      ? 'Save Changes'
                                      : 'Create Destination'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {isEditMode && destination && can('DELETE_DESTINATION') && (
                <Card className='border-destructive/30 ring-destructive/10'>
                    <CardHeader className='border-b pb-8'>
                        <CardTitle className='text-destructive'>
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='pt-8'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <p className='text-sm font-medium'>
                                    Deactivate this destination
                                </p>
                                <p className='text-sm text-muted-foreground mt-1'>
                                    Hides this destination from the public site.
                                    The record is preserved to protect its URL
                                    slug and booking history.
                                </p>
                                {destination.isSeeded && (
                                    <div className='mt-3 flex items-center gap-2 text-sm text-amber-600'>
                                        <ShieldAlertIcon className='size-4 shrink-0' />
                                        <span>
                                            This is a seeded destination and is
                                            protected from deletion.
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className='shrink-0'>
                                {destination.isSeeded ? (
                                    <div className='flex items-center gap-1.5'>
                                        <Badge variant='secondary'>
                                            Protected
                                        </Badge>
                                    </div>
                                ) : (
                                    <Button
                                        variant='destructive'
                                        size='sm'
                                        type='button'
                                        onClick={() => setDeleteOpen(true)}>
                                        <Trash2Icon />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isEditMode && destination && can('DELETE_DESTINATION') && (
                <DestinationDeleteDialog
                    destination={destination}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    onSuccess={() => router.push('/dashboard/destinations')}
                />
            )}
        </div>
    );
}

