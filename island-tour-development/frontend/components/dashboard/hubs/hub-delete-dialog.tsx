'use client';

import { toast } from 'sonner';
import { useDeleteHub } from '@/hooks/hubs/use-hubs';
import type { HubLocalized } from '@/types/hub';
import { DeactivateDialog } from '@/components/dashboard/common/deactivate-dialog';

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

  function handleConfirm() {
    deleteHub(hub.id, {
      onSuccess: () => {
        toast.success(`"${hub.name}" deactivated successfully.`);
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
