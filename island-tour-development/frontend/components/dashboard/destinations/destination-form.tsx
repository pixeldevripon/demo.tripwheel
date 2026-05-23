'use client';

import { ImageSelectorField } from '@/components/dashboard/media/image-selector-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useCreateDestination,
    useUpdateDestination,
} from '@/hooks/destinations/use-destinations';
import type { DestinationDetail } from '@/types/destination';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlertIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DestinationDeleteDialog } from './destination-delete-dialog';

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

    const { mutate: createDestination, isPending: isCreating } =
        useCreateDestination();
    const { mutate: updateDestination, isPending: isUpdating } =
        useUpdateDestination();
    const isPending = isCreating || isUpdating;

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
            isActive: destination?.isActive ?? true,
        },
    });

    const heroImageValue = watch('heroImage');
    const isActiveValue = watch('isActive');
    const nameValue = watch('name');

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
                { name: values.name, slug: values.slug, heroImage: values.heroImage || null },
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

            {isEditMode && destination && (
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
                                    Delete this destination
                                </p>
                                <p className='text-sm text-muted-foreground mt-1'>
                                    Permanently remove this destination and all
                                    associated slug registry entries. This
                                    action cannot be undone.
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

            {isEditMode && destination && (
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

