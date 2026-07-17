'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
    useAddInclusion,
    useInclusions,
    useRemoveInclusion,
} from '@/hooks/trips/use-trips';
import { EditableListSection } from './editable-list-section';

const ICON_OPTIONS = [
    { value: 'check', label: 'Check' },
    { value: 'drink', label: 'Drink' },
    { value: 'food', label: 'Food' },
    { value: 'transport', label: 'Transport' },
    { value: 'gear', label: 'Gear' },
    { value: 'guide', label: 'Guide' },
    { value: 'photo', label: 'Photo' },
    { value: 'ticket', label: 'Ticket' },
];

const addInclusionSchema = z.object({
    label: z.string().min(2, 'At least 2 characters').max(100),
    icon: z.string().optional(),
});

type AddInclusionFormValues = z.infer<typeof addInclusionSchema>;

interface TripInclusionsTabProps {
    tripId: string;
}

export function TripInclusionsTab({ tripId }: TripInclusionsTabProps) {
    const { data: inclusions, isLoading } = useInclusions(tripId);
    const { mutate: addInclusion, isPending: isAdding } = useAddInclusion();
    const { mutate: removeInclusion, isPending: isRemoving } =
        useRemoveInclusion();

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<AddInclusionFormValues>({
        resolver: zodResolver(addInclusionSchema),
        defaultValues: { label: '', icon: 'check' },
    });

    function onAdd(values: AddInclusionFormValues) {
        addInclusion(
            {
                tripId,
                payload: {
                    label: values.label,
                    icon: values.icon || 'check',
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: inclusions?.length ?? 0,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Inclusion added.');
                    reset({ label: '', icon: 'check' });
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add inclusion.',
                    ),
            },
        );
    }

    return (
        <EditableListSection
            title='Inclusions'
            items={inclusions}
            isLoading={isLoading}
            getId={inc => inc.id}
            renderSummary={inc => {
                const en = inc.translations.find(t => t.locale === 'en');
                return (
                    <span className='flex min-w-0 items-center gap-2'>
                        <Badge variant='secondary' className='shrink-0 text-xs'>
                            {inc.icon}
                        </Badge>
                        <span className='truncate'>
                            {en?.label ?? '(no EN translation)'}
                        </span>
                    </span>
                );
            }}
            onDelete={inc =>
                removeInclusion(
                    { tripId, inclusionId: inc.id },
                    {
                        onSuccess: () => toast.success('Inclusion removed.'),
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
            emptyText='No inclusions yet.'
            addForm={{
                heading: 'Add Inclusion',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Label (English)</Label>
                            <Input
                                {...register('label')}
                                placeholder='Welcome drink included'
                                aria-invalid={!!errors.label}
                            />
                            <FieldError>{errors.label?.message}</FieldError>
                        </Field>
                        <Field>
                            <Label>Icon</Label>
                            <Select
                                defaultValue='check'
                                onValueChange={val => setValue('icon', val)}>
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder='Select icon...' />
                                </SelectTrigger>
                                <SelectContent>
                                    {ICON_OPTIONS.map(opt => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <div className='flex justify-end'>
                            <Button type='submit' size='sm' disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add Inclusion'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
