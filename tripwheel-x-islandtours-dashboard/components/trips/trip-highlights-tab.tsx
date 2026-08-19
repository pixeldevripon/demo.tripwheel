'use client';

import { toast } from 'sonner';
import { findEnglish } from '@/lib/trips/forms';
import { z } from 'zod';

import { StatusBadge } from '@/components/common/status-badge';
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
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
    tripId: string;
}

export function TripHighlightsTab({ tripId, bare }: TripHighlightsTabProps) {
    const { data: highlights, isLoading } = useHighlights(tripId);
    const { mutate: addHighlight, isPending: isAdding } = useAddHighlight();
    const { mutate: removeHighlight, isPending: isRemoving } =
        useRemoveHighlight();

    const count = highlights?.length ?? 0;

    /**
     * Same schema, no form. `EditableListSection` composes the row inline now,
     * so this validates the one string and either rejects it with a message or
     * fires the identical mutation the panel form fired.
     */
    function onAdd(text: string): string | null {
        const parsed = addHighlightSchema.safeParse({ text });
        if (!parsed.success) {
            return parsed.error.issues[0]?.message ?? 'Invalid highlight.';
        }
        addHighlight(
            {
                tripId,
                payload: {
                    text: parsed.data.text,
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: count,
                },
            },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add highlight.',
                    ),
            },
        );
        return null;
    }

    return (
        <EditableListSection
            bare={bare}
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
                const en = findEnglish(h.translations);
                // No "#0" prefix. It printed the raw `displayOrder`, so the
                // first highlight read "#0" - which looks like a bug - and
                // beside a bullet an index says nothing the position does not.
                return (
                    <span className='truncate'>
                        {en?.text ?? '(no EN translation)'}
                    </span>
                );
            }}
            onDelete={h =>
                removeHighlight(
                    { tripId, highlightId: h.id },
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
            emptyText='No highlights yet.'
            quickAdd={{
                addLabel: 'Add highlight',
                placeholder: 'Snorkel with sea turtles at the reef',
                ariaLabel: 'New highlight (English)',
                disabled: isAdding || count >= 6,
                onAdd,
            }}
        />
    );
}
