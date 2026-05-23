'use client';

import { toast } from 'sonner';
import { useDeleteDestination } from '@/hooks/destinations/use-destinations';
import type { DestinationLocalized } from '@/types/destination';
import { DeactivateDialog } from '@/components/dashboard/common/deactivate-dialog';

interface DestinationDeleteDialogProps {
  destination: DestinationLocalized;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DestinationDeleteDialog({
  destination,
  open,
  onOpenChange,
  onSuccess,
}: DestinationDeleteDialogProps) {
  const { mutate: deleteDestination, isPending } = useDeleteDestination();

  function handleConfirm() {
    deleteDestination(destination.id, {
      onSuccess: () => {
        toast.success(`"${destination.name}" deactivated successfully.`);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate destination.');
      },
    });
  }

  return (
    <DeactivateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Deactivate Destination"
      entityName={destination.name}
      preservationNote='The record is preserved in the database — not permanently deleted. This protects its URL slug from being reused and keeps all booking history intact. You can restore it at any time by switching the Status filter to "Inactive" and activating it again.'
      onConfirm={handleConfirm}
      isPending={isPending}
    />
  );
}
