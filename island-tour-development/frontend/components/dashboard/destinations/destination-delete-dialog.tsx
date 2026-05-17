'use client';

import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteDestination } from '@/hooks/destinations/use-destinations';
import type { DestinationLocalized } from '@/types/destination';

interface DestinationDeleteDialogProps {
  destination: DestinationLocalized;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function DestinationDeleteDialog({
  destination,
  open,
  onOpenChange,
  trigger,
  onSuccess,
}: DestinationDeleteDialogProps) {
  const { mutate: deleteDestination, isPending } = useDeleteDestination();

  function handleConfirm() {
    deleteDestination(destination.id, {
      onSuccess: () => {
        toast.success(`"${destination.name}" deleted successfully.`);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete destination.');
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon className="size-8 text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete Destination</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <strong className="text-foreground">{destination.name}</strong>? This action cannot be
            undone. All associated slug registry entries will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
