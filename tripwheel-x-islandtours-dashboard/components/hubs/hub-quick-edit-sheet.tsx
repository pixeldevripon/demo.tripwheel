'use client';

import { toast } from 'sonner';

import {
    QuickEditSheet,
    type QuickEditValues,
} from '@/components/common/quick-edit-sheet';
import { useUpdateHub } from '@/hooks/hubs/use-hubs';
import type { HubLocalized } from '@/types/hub';

interface HubQuickEditSheetProps {
    hub: HubLocalized;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function HubQuickEditSheet({
    hub,
    open,
    onOpenChange,
}: HubQuickEditSheetProps) {
    const { mutate: updateHub, isPending } = useUpdateHub();

    function handleSave(values: QuickEditValues) {
        updateHub(
            {
                id: hub.id,
                payload: {
                    name: values.name,
                    description: values.secondary || null,
                    isActive: values.isActive,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Hub updated successfully.');
                    onOpenChange(false);
                },
                onError: err => {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update hub.',
                    );
                },
            },
        );
    }

    return (
        <QuickEditSheet
            open={open}
            onOpenChange={onOpenChange}
            entityNoun='hub'
            entityName={hub.name}
            defaults={{
                name: hub.name,
                secondary: hub.description ?? '',
                isActive: hub.isActive,
            }}
            secondaryField={{
                label: 'Description',
                placeholder: 'Brief description of this hub',
                kind: 'textarea',
            }}
            isPending={isPending}
            onSave={handleSave}
        />
    );
}
