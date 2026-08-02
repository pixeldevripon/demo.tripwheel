'use client';

/**
 * Inclusions: a label, and nothing else.
 *
 * The icon picker is gone (2026-07-29). It offered eight choices - Check,
 * Drink, Food, Transport, Gear, Guide, Photo, Ticket - none of which reached a
 * traveller. The public tour page renders a hardcoded `/icons/check-green.svg`
 * beside EVERY inclusion (`tour-detail-content.tsx:581`), and its mapping keeps
 * only `label`. No other consumer reads the value either: it is absent from the
 * JSON-LD and the confirmation email, and the OCTO serializer does not even
 * SELECT it - `include:` takes `translations.label` alone. The one thing that
 * ever displayed it was this file's own row badge, printing the raw string
 * "check".
 *
 * The column stays. It is `@default("check")`, the create path already writes
 * `dto.icon ?? 'check'`, and update only touches it when the key is present -
 * so omitting it costs nothing and needs no migration.
 *
 * With the second field gone this becomes a one-field list, which is what
 * `quickAdd` is for: the row is composed inline as a bullet instead of opening
 * a panel.
 */

import { toast } from 'sonner';
import { findEnglish } from '@/lib/trips/forms';
import { z } from 'zod';

import {
    useAddInclusion,
    useInclusions,
    useRemoveInclusion,
} from '@/hooks/trips/use-trips';
import { EditableListSection } from './editable-list-section';

const addInclusionSchema = z.object({
    label: z.string().min(2, 'At least 2 characters').max(100),
});

interface TripInclusionsTabProps {
    /** Drop the Card chrome - the wizard section header names this list. */
    bare?: boolean;
    tripId: string;
}

export function TripInclusionsTab({ tripId, bare }: TripInclusionsTabProps) {
    const { data: inclusions, isLoading } = useInclusions(tripId);
    const { mutate: addInclusion, isPending: isAdding } = useAddInclusion();
    const { mutate: removeInclusion, isPending: isRemoving } =
        useRemoveInclusion();

    function onAdd(label: string): string | null {
        const parsed = addInclusionSchema.safeParse({ label });
        if (!parsed.success) {
            return parsed.error.issues[0]?.message ?? 'Invalid inclusion.';
        }
        addInclusion(
            {
                tripId,
                payload: {
                    label: parsed.data.label,
                    // The old form appended at the end via a hidden field -
                    // preserved so ordering behavior is unchanged.
                    displayOrder: inclusions?.length ?? 0,
                },
            },
            {
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add inclusion.',
                    ),
            },
        );
        return null;
    }

    return (
        <EditableListSection
            bare={bare}
            title='Inclusions'
            items={inclusions}
            isLoading={isLoading}
            getId={inc => inc.id}
            renderSummary={inc => {
                const en = findEnglish(inc.translations);
                return (
                    <span className='truncate'>
                        {en?.label ?? '(no EN translation)'}
                    </span>
                );
            }}
            onDelete={inc =>
                removeInclusion(
                    { tripId, inclusionId: inc.id },
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
            emptyText='No inclusions yet.'
            quickAdd={{
                addLabel: 'Add inclusion',
                placeholder: 'Welcome drink on arrival',
                ariaLabel: 'New inclusion (English)',
                disabled: isAdding,
                onAdd,
            }}
        />
    );
}
