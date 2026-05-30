'use client';

import { toast } from 'sonner';
import { useArchiveTrip } from '@/hooks/trips/use-trips';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArchiveIcon } from 'lucide-react';

interface TripArchiveDialogProps {
  tripId: string;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TripArchiveDialog({
  tripId,
  tripName,
  open,
  onOpenChange,
  onSuccess,
}: TripArchiveDialogProps) {
  const { mutate: archiveTrip, isPending } = useArchiveTrip();

  function handleConfirm() {
    archiveTrip(tripId, {
      onSuccess: () => {
        toast.success(`"${tripName}" archived.`);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to archive trip.');
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ArchiveIcon className="size-5 text-muted-foreground" />
            </div>
            <AlertDialogTitle>Archive Trip</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to archive{' '}
                <strong className="text-foreground">{tripName}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                Archived trips are hidden from travelers and cannot be booked. This action
                cannot be undone from the dashboard — contact support to restore a trip.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? 'Archiving...' : 'Archive Trip'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
