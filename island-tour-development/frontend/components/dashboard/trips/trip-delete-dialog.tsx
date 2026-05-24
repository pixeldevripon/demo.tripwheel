'use client';

import { toast } from 'sonner';
import { useRemoveTrip } from '@/hooks/trips/use-trips';
import type { TripListItem } from '@/types/trip';
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
import { Trash2Icon } from 'lucide-react';

interface TripDeleteDialogProps {
  trip: TripListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TripDeleteDialog({
  trip,
  open,
  onOpenChange,
  onSuccess,
}: TripDeleteDialogProps) {
  const { mutate: removeTrip, isPending } = useRemoveTrip();

  function handleConfirm() {
    removeTrip(trip.id, {
      onSuccess: () => {
        toast.success(`"${trip.name}" deleted successfully.`);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete trip.');
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
              <Trash2Icon className="size-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-foreground">{trip.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. Only DRAFT trips can be deleted. All associated
                data (images, highlights, inclusions, age bands, add-ons, schedules) will also
                be permanently removed.
              </p>
            </div>
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
            {isPending ? 'Deleting...' : 'Delete Trip'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
