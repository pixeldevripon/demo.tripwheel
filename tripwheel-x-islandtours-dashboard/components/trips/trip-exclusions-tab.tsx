'use client';

/**
 * Exclusions: a label, plus the two fields that actually reach a traveller.
 *
 * The icon picker is gone (2026-07-29). The public tour page renders a
 * hardcoded `/icons/exclude-cross.svg` beside EVERY exclusion
 * (`tour-detail-content.tsx:601`), and the mapping above it keeps `label`,
 * `type` and `priceText` only. Nothing else reads the icon either - not the
 * JSON-LD, not the confirmation email, and not the OCTO serializer, which does
 * not even SELECT it. Its one display was this file's own row badge, printing
 * the raw string "x".
 *
 * `type` and `priceText` stay because they ARE read: `exclusionSuffix()` builds
 * the "$15 per person" / "pay on the day" tail from them. That is also why this
 * list keeps its add panel while inclusions and highlights compose inline -
 * three questions do not fit on a bullet.
 *
 * The column stays, `@default("x")`, filled by the create path's
 * `dto.icon ?? 'x'`. No migration, nothing nulled.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
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
    useAddExclusion,
    useExclusions,
    useRemoveExclusion,
    useUpdateExclusion,
} from '@/hooks/trips/use-trips';
import type { ExclusionType, TourExclusion } from '@/types/trip';
import { EditableListSection } from './editable-list-section';

const EXCLUSION_TYPE_OPTIONS = [
    { value: 'UNAVAILABLE', label: 'Not provided' },
    { value: 'NOT_PERMITTED', label: 'Not permitted' },
    { value: 'PAID_ADVANCE', label: 'Available - pay in advance' },
    { value: 'PAID_ONSITE', label: 'Available - pay on site' },
] as const;

const addExclusionSchema = z.object({
    label: z.string().min(2, 'At least 2 characters').max(100),
    type: z
        .enum(['UNAVAILABLE', 'NOT_PERMITTED', 'PAID_ADVANCE', 'PAID_ONSITE'])
        .optional()
        .or(z.literal('')),
    priceText: z.string().max(120).optional(),
});

type AddExclusionFormValues = z.infer<typeof addExclusionSchema>;

/**
 * Structured handling of one exclusion (LD18): how the excluded item is dealt
 * with (`type`) and, for paid add-ons, the operator's price note
 * (`priceText`). The public "What's Included" column derives its
 * "(available - $X)" / "(pay on the day)" suffix from exactly these two
 * fields. `priceText` is cleared when the type is not a paid one; `imageUrl`
 * is hidden from the UI but preserved on save (sent unchanged).
 */
function ExclusionHandlingEditor({
    exclusion,
    tripId,
}: {
    exclusion: TourExclusion;
    tripId: string;
}) {
    const [typeVal, setTypeVal] = useState<string>(exclusion.type ?? '');
    const [priceVal, setPriceVal] = useState<string>(exclusion.priceText ?? '');
    const { mutate: saveHandling, isPending } = useUpdateExclusion();

    const isPaidType = typeVal === 'PAID_ADVANCE' || typeVal === 'PAID_ONSITE';

    function handleSave() {
        saveHandling(
            {
                tripId,
                exclusionId: exclusion.id,
                payload: {
                    type: (typeVal || undefined) as ExclusionType | undefined,
                    priceText: isPaidType ? priceVal || null : null,
                    imageUrl: exclusion.imageUrl || null,
                },
            },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to save.'
                    ),
            }
        );
    }

    return (
        <div className='space-y-3'>
            <p className='text-2xs font-medium tracking-caps uppercase text-content-subtle'>
                Handling
            </p>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <Field>
                    <Label>
                        Type{' '}
                        <span className='font-light text-content-muted'>
                            (optional)
                        </span>
                    </Label>
                    <Select value={typeVal || ''} onValueChange={setTypeVal}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='How is it handled?' />
                        </SelectTrigger>
                        <SelectContent>
                            {EXCLUSION_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                {isPaidType && (
                    <Field>
                        <Label>Price Text</Label>
                        <Input
                            value={priceVal}
                            onChange={e => setPriceVal(e.target.value)}
                            placeholder='$15 per person'
                        />
                    </Field>
                )}
            </div>
            <div className='flex justify-end'>
                <Button
                    type='button'
                    size='sm'
                    onClick={handleSave}
                    disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Handling'}
                </Button>
            </div>
        </div>
    );
}

interface TripExclusionsTabProps {
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
    tripId: string;
}

export function TripExclusionsTab({ tripId, bare }: TripExclusionsTabProps) {
    const { data: exclusions, isLoading } = useExclusions(tripId);
    const { mutate: addExclusion, isPending: isAdding } = useAddExclusion();
    const { mutate: removeExclusion, isPending: isRemoving } =
        useRemoveExclusion();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<AddExclusionFormValues>({
        resolver: zodResolver(addExclusionSchema),
        defaultValues: { label: '', type: '', priceText: '' },
    });

    const typeValue = watch('type');
    const isPaidType =
        typeValue === 'PAID_ADVANCE' || typeValue === 'PAID_ONSITE';

    function onAdd(values: AddExclusionFormValues) {
        addExclusion(
            {
                tripId,
                payload: {
                    label: values.label,
                    type: values.type || undefined,
                    priceText:
                        (values.type === 'PAID_ADVANCE' ||
                            values.type === 'PAID_ONSITE') &&
                        values.priceText
                            ? values.priceText
                            : undefined,
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: exclusions?.length ?? 0,
                },
            },
            {
                onSuccess: () => {
                    reset({ label: '', type: '', priceText: '' });
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add exclusion.'
                    ),
            }
        );
    }

    return (
        <EditableListSection
            bare={bare}
            title='Exclusions'
            items={exclusions}
            isLoading={isLoading}
            getId={exc => exc.id}
            renderSummary={exc => {
                const en = exc.translations.find(t => t.locale === 'en');
                const typeLabel = EXCLUSION_TYPE_OPTIONS.find(
                    o => o.value === exc.type
                )?.label;
                return (
                    <span className='flex min-w-0 items-center gap-2'>
                        <span className='truncate'>
                            {en?.label ?? '(no EN translation)'}
                        </span>
                        {typeLabel && (
                            <Badge
                                variant='outline'
                                className='hidden shrink-0 text-xs md:inline-flex'>
                                {typeLabel}
                                {exc.priceText ? ` · ${exc.priceText}` : ''}
                            </Badge>
                        )}
                    </span>
                );
            }}
            renderExpanded={exc => (
                <ExclusionHandlingEditor exclusion={exc} tripId={tripId} />
            )}
            onDelete={exc =>
                removeExclusion(
                    { tripId, exclusionId: exc.id },
                    {
                        onError: err =>
                            toast.error(
                                err instanceof Error
                                    ? err.message
                                    : 'Failed to remove.'
                            ),
                    }
                )
            }
            isDeleting={isRemoving}
            emptyText='No exclusions yet.'
            addForm={{
                heading: 'Add exclusion',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Label (English)</Label>
                            <Input
                                {...register('label')}
                                placeholder='Gratuities'
                                aria-invalid={!!errors.label}
                            />
                            <FieldError>{errors.label?.message}</FieldError>
                        </Field>
                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                            <Field>
                                <Label>
                                    Type{' '}
                                    <span className='font-light text-content-muted'>
                                        (optional)
                                    </span>
                                </Label>
                                <Select
                                    value={typeValue || ''}
                                    onValueChange={val =>
                                        setValue(
                                            'type',
                                            val as AddExclusionFormValues['type']
                                        )
                                    }>
                                    <SelectTrigger className='w-full'>
                                        <SelectValue placeholder='How is it handled?' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EXCLUSION_TYPE_OPTIONS.map(opt => (
                                            <SelectItem
                                                key={opt.value}
                                                value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        {isPaidType && (
                            <Field>
                                <Label>Price Text</Label>
                                <Input
                                    {...register('priceText')}
                                    placeholder='$15 per person'
                                />
                            </Field>
                        )}
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add exclusion'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}

