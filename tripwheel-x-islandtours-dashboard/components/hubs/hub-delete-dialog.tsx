'use client';

import { toast } from 'sonner';
import { useDeleteHub, useUpdateHub } from '@/hooks/hubs/use-hubs';
import type { HubLocalized } from '@/types/hub';
import { DeactivateDialog } from '@/components/common/deactivate-dialog';

interface HubDeleteDialogProps {
  hub: HubLocalized;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HubDeleteDialog({
  hub,
  open,
  onOpenChange,
  onSuccess,
}: HubDeleteDialogProps) {
  const { mutate: deleteHub, isPending } = useDeleteHub();
  const { mutate: updateHub } = useUpdateHub();

  function handleConfirm() {
    deleteHub(hub.id, {
      onSuccess: () => {
        toast.success(`"${hub.name}" deactivated successfully.`, {
          duration: 10_000,
          action: {
            label: 'Undo',
            onClick: () =>
              updateHub(
                { id: hub.id, payload: { isActive: true } },
                {
                  onSuccess: () => toast.success(`"${hub.name}" reactivated.`),
                  onError: (err) =>
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : 'Undo failed - the hub is still inactive.',
                    ),
                },
              ),
          },
        });
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate hub.');
      },
    });
  }

  return (
    <DeactivateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Deactivate Hub"
      entityName={hub.name}
      preservationNote='The record is preserved in the database - not permanently deleted. This protects its URL slug from being reused and keeps all associated trip and booking data intact. You can restore it at any time by switching the Status filter to "Inactive" and activating it again.'
      onConfirm={handleConfirm}
      isPending={isPending}
    />
  );
}
