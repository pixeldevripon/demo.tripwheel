'use client';

import { toast } from 'sonner';

import {
    QuickEditSheet,
    type QuickEditValues,
} from '@/components/common/quick-edit-sheet';
import { useUpdateDestination } from '@/hooks/destinations/use-destinations';
import type { DestinationLocalized } from '@/types/destination';

interface DestinationQuickEditSheetProps {
    destination: DestinationLocalized;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DestinationQuickEditSheet({
    destination,
    open,
    onOpenChange,
}: DestinationQuickEditSheetProps) {
    const { mutate: updateDestination, isPending } = useUpdateDestination();

    function handleSave(values: QuickEditValues) {
        updateDestination(
            {
                id: destination.id,
                payload: {
                    name: values.name,
                    heroImage: values.secondary || null,
                    isActive: values.isActive,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Destination updated successfully.');
                    onOpenChange(false);
                },
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update destination.',
                    );
                },
            },
        );
    }

    return (
        <QuickEditSheet
            open={open}
            onOpenChange={onOpenChange}
            entityNoun='destination'
            entityName={destination.name}
            defaults={{
                name: destination.name,
                secondary: destination.heroImage ?? '',
                isActive: destination.isActive,
            }}
            secondaryField={{
                label: 'Hero Image URL',
                placeholder: 'https://example.com/image.jpg',
                kind: 'url',
            }}
            isPending={isPending}
            onSave={handleSave}
        />
    );
}
