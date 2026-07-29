'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    useAddFeature,
    useFeatures,
    useRemoveFeature,
} from '@/hooks/trips/use-trips';
import type { FeatureType } from '@/types/trip';
import { EditableListSection } from './editable-list-section';

const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
    { value: 'PREBOOKING_INFORMATION', label: 'Pre-booking information' },
    { value: 'PREARRIVAL_INFORMATION', label: 'Pre-arrival information' },
    { value: 'REDEMPTION_INSTRUCTION', label: 'Redemption instructions' },
    { value: 'ACCESSIBILITY_INFORMATION', label: 'Accessibility information' },
    { value: 'ADDITIONAL_INFORMATION', label: 'Additional information' },
    { value: 'BOOKING_TERM', label: 'Booking terms' },
    { value: 'CANCELLATION_TERM', label: 'Cancellation terms' },
];

const FEATURE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    FEATURE_TYPES.map(t => [t.value, t.label]),
);

const addFeatureSchema = z.object({
    type: z.enum([
        'PREBOOKING_INFORMATION',
        'PREARRIVAL_INFORMATION',
        'REDEMPTION_INSTRUCTION',
        'ACCESSIBILITY_INFORMATION',
        'ADDITIONAL_INFORMATION',
        'BOOKING_TERM',
        'CANCELLATION_TERM',
    ]),
    text: z
        .string()
        .min(5, 'At least 5 characters')
        .max(2000, 'Max 2000 characters'),
});

type AddFeatureFormValues = z.infer<typeof addFeatureSchema>;

interface TripFeaturesTabProps {
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
    tripId: string;
}

export function TripFeaturesTab({ tripId, bare }: TripFeaturesTabProps) {
    const { data: features, isLoading } = useFeatures(tripId);
    const { mutate: addFeature, isPending: isAdding } = useAddFeature();
    const { mutate: removeFeature, isPending: isRemoving } =
        useRemoveFeature();

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
    } = useForm<AddFeatureFormValues>({
        resolver: zodResolver(addFeatureSchema),
        defaultValues: { type: 'ADDITIONAL_INFORMATION', text: '' },
    });

    function onAdd(values: AddFeatureFormValues) {
        addFeature(
            {
                tripId,
                payload: {
                    type: values.type,
                    text: values.text,
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: features?.length ?? 0,
                },
            },
            {
                onSuccess: () => {
                    reset({ type: 'ADDITIONAL_INFORMATION', text: '' });
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add feature.',
                    ),
            },
        );
    }

    return (
        <EditableListSection
            bare={bare}
            title='Info & Terms'
            items={features}
            isLoading={isLoading}
            getId={f => f.id}
            renderSummary={f => {
                const en = f.translations.find(t => t.locale === 'en');
                // Text first, category second - the same reading order as
                // What's included and What's not included. Leading with the
                // badge meant three lists on one step scanned three different
                // ways, and it put the least useful part of the row (a label
                // the operator picked from a dropdown) in the first column.
                return (
                    <span className='flex min-w-0 items-center gap-2'>
                        <span className='truncate'>
                            {en?.text ?? '(no EN translation)'}
                        </span>
                        <Badge
                            variant='outline'
                            className='hidden shrink-0 text-xs md:inline-flex'>
                            {FEATURE_TYPE_LABELS[f.type] ?? f.type}
                        </Badge>
                    </span>
                );
            }}
            onDelete={f =>
                removeFeature(
                    { tripId, featureId: f.id },
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
            emptyText='No info items yet.'
            addForm={{
                heading: 'Add info item',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Type</Label>
                            <Controller
                                name='type'
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FEATURE_TYPES.map(opt => (
                                                <SelectItem
                                                    key={opt.value}
                                                    value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>
                        <Field>
                            <Label>Text (English)</Label>
                            <Textarea
                                {...register('text')}
                                rows={3}
                                placeholder='Bring your passport for the border crossing.'
                                aria-invalid={!!errors.text}
                            />
                            <FieldError>{errors.text?.message}</FieldError>
                        </Field>
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add info item'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
