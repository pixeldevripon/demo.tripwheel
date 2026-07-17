'use client';

/**
 * Tour create - 4 questions, nothing else (04 §2.2 A, Phase 16).
 *
 * Replaces the 704-line `trip-form.tsx` that asked ~30 questions to collect 4
 * required answers. Everything it used to collect (pricing, duration, pickup,
 * payment, audience, ...) already lives in the editor's Details/Pricing tabs,
 * has a backend default, and is guided post-create by the readiness rail.
 * `CreateTripPayload` marks all of it optional, so the payload here is exactly
 * what the operator answered - no hidden defaults, no contract change.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { useCreateTrip } from '@/hooks/trips/use-trips';
import { toSlug } from '@/lib/utils';

const createTripSchema = z.object({
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

type CreateTripFormValues = z.infer<typeof createTripSchema>;

export function TripCreateForm() {
    const router = useRouter();
    const { mutate: createTrip, isPending } = useCreateTrip();
    const [slugTouched, setSlugTouched] = useState(false);

    const { data: destinations } = useActiveDestinations();
    const { data: categories } = useActiveCategories();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        formState: { errors },
    } = useForm<CreateTripFormValues>({
        resolver: zodResolver(createTripSchema),
        defaultValues: {
            name: '',
            slug: '',
            destinationId: '',
            categoryIds: [],
            primaryCategoryId: '',
        },
    });

    const nameValue = watch('name');
    const categoryIds = watch('categoryIds');
    const primaryCategoryId = watch('primaryCategoryId');

    useEffect(() => {
        if (!slugTouched) {
            setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
        }
    }, [nameValue, slugTouched, setValue]);

    useEffect(() => {
        if (categoryIds.length === 0) {
            if (primaryCategoryId) setValue('primaryCategoryId', '');
        } else if (!categoryIds.includes(primaryCategoryId ?? '')) {
            setValue('primaryCategoryId', categoryIds[0]);
        }
    }, [categoryIds, primaryCategoryId, setValue]);

    function onSubmit(values: CreateTripFormValues) {
        createTrip(
            {
                name: values.name,
                slug: values.slug || undefined,
                destinationId: values.destinationId,
                categoryIds: values.categoryIds,
                primaryCategoryId:
                    values.primaryCategoryId || values.categoryIds[0],
            },
            {
                onSuccess: created => {
                    toast.success('Trip created successfully.');
                    router.push(`/trips/${created.id}/edit`);
                },
                onError: err => {
                    const message =
                        err instanceof Error
                            ? err.message
                            : 'Failed to create trip.';
                    if (
                        message.includes('409') ||
                        message.toLowerCase().includes('slug')
                    ) {
                        toast.error(
                            'A trip with this slug already exists in this destination.',
                        );
                    } else {
                        toast.error(message);
                    }
                },
            },
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}>
            <Card>
                <CardHeader className='border-b pb-6'>
                    <CardTitle>Start with the essentials</CardTitle>
                    <CardDescription>
                        Four answers create the draft. Pricing, schedules,
                        images and everything else come next in the editor,
                        guided by the readiness checklist.
                    </CardDescription>
                </CardHeader>
                <CardContent className='pt-6'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-6'>
                        <Field>
                            <Label className='text-sm font-medium'>
                                Name{' '}
                                <span
                                    aria-hidden
                                    className='text-danger-fg'>
                                    *
                                </span>
                            </Label>
                            <Input
                                {...register('name')}
                                placeholder='Sunset Catamaran Cruise'
                                aria-invalid={!!errors.name}
                                autoFocus
                            />
                            <FieldError>{errors.name?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label className='text-sm font-medium'>Slug</Label>
                            <Input
                                {...register('slug')}
                                placeholder='sunset-catamaran-cruise'
                                aria-invalid={!!errors.slug}
                                onChange={e => {
                                    setSlugTouched(true);
                                    setValue('slug', e.target.value, {
                                        shouldValidate: true,
                                    });
                                }}
                            />
                            <FieldDescription>
                                Used in the URL. Auto-generated from the name,
                                but you can customise it.
                            </FieldDescription>
                            <FieldError>{errors.slug?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label className='text-sm font-medium'>
                                Destination{' '}
                                <span
                                    aria-hidden
                                    className='text-danger-fg'>
                                    *
                                </span>
                            </Label>
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
                            <FieldDescription>
                                Cannot be changed after creation.
                            </FieldDescription>
                            <FieldError>
                                {errors.destinationId?.message}
                            </FieldError>
                        </Field>

                        <Field>
                            <Label className='text-sm font-medium'>
                                Categories{' '}
                                <span
                                    aria-hidden
                                    className='text-danger-fg'>
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
                                            setValue('primaryCategoryId', v)
                                        }
                                    />
                                )}
                            />
                            <FieldDescription>
                                The starred category is the primary (used for
                                the breadcrumb &amp; canonical URL).
                            </FieldDescription>
                            <FieldError>
                                {errors.categoryIds?.message}
                            </FieldError>
                        </Field>

                        <div className='flex items-center justify-end gap-4 border-t border-line pt-6'>
                            <p className='text-xs text-content-muted mr-auto'>
                                You can refine everything after the draft
                                exists.
                            </p>
                            <Button type='submit' disabled={isPending}>
                                {isPending ? 'Creating...' : 'Create Trip'}
                                <HugeiconsIcon
                                    icon={ArrowRight01Icon}
                                    size={16}
                                    data-icon='inline-end'
                                />
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </motion.div>
    );
}
