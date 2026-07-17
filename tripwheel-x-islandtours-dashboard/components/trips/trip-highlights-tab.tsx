'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useAddHighlight,
    useHighlights,
    useRemoveHighlight,
} from '@/hooks/trips/use-trips';
import { EditableListSection } from './editable-list-section';

const addHighlightSchema = z.object({
    text: z
        .string()
        .min(5, 'At least 5 characters')
        .max(100, 'Max 100 characters'),
});

type AddHighlightFormValues = z.infer<typeof addHighlightSchema>;

interface TripHighlightsTabProps {
    tripId: string;
}

export function TripHighlightsTab({ tripId }: TripHighlightsTabProps) {
    const { data: highlights, isLoading } = useHighlights(tripId);
    const { mutate: addHighlight, isPending: isAdding } = useAddHighlight();
    const { mutate: removeHighlight, isPending: isRemoving } =
        useRemoveHighlight();

    const count = highlights?.length ?? 0;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<AddHighlightFormValues>({
        resolver: zodResolver(addHighlightSchema),
        defaultValues: { text: '' },
    });

    function onAdd(values: AddHighlightFormValues) {
        addHighlight(
            {
                tripId,
                payload: {
                    text: values.text,
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: count,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Highlight added.');
                    reset({ text: '' });
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add highlight.',
                    ),
            },
        );
    }

    return (
        <EditableListSection
            title='Highlights'
            items={highlights}
            isLoading={isLoading}
            getId={h => h.id}
            headerMeta={
                <span className='flex items-center gap-1.5'>
                    <span className='rounded-full bg-surface-inset px-2 py-0.5 text-2xs font-medium tabular-nums text-content-muted'>
                        {count}/6
                    </span>
                    {count < 3 && (
                        <StatusBadge variant='warning'>
                            Need at least 3 to publish
                        </StatusBadge>
                    )}
                </span>
            }
            renderSummary={h => {
                const en = h.translations.find(t => t.locale === 'en');
                return (
                    <span className='flex min-w-0 items-center gap-2'>
                        <span className='shrink-0 text-xs text-content-subtle'>
                            #{h.displayOrder}
                        </span>
                        <span className='truncate'>
                            {en?.text ?? '(no EN translation)'}
                        </span>
                    </span>
                );
            }}
            onDelete={h =>
                removeHighlight(
                    { tripId, highlightId: h.id },
                    {
                        onSuccess: () => toast.success('Highlight removed.'),
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
            emptyText='No highlights yet.'
            addForm={{
                heading: 'Add Highlight',
                children: (
                    <form onSubmit={handleSubmit(onAdd)} className='space-y-3'>
                        <Field>
                            <Label>Highlight (English)</Label>
                            <Input
                                {...register('text')}
                                placeholder='Snorkel with sea turtles at the reef'
                                aria-invalid={!!errors.text}
                            />
                            <FieldError>{errors.text?.message}</FieldError>
                        </Field>
                        <div className='flex justify-end'>
                            <Button
                                type='submit'
                                size='sm'
                                disabled={isAdding || count >= 6}>
                                {isAdding ? 'Adding...' : 'Add Highlight'}
                            </Button>
                        </div>
                    </form>
                ),
            }}
        />
    );
}
