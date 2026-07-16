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
  isForce?: boolean;
}

export function TripDeleteDialog({
  trip,
  open,
  onOpenChange,
  onSuccess,
  isForce = false,
}: TripDeleteDialogProps) {
  const { mutate: removeTrip, isPending } = useRemoveTrip();

  function handleConfirm() {
    removeTrip(trip.id, {
      onSuccess: () => {
        toast.success(`"${trip.name}" permanently deleted.`);
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
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <Trash2Icon className="size-5 text-destructive" />
            </div>
            <AlertDialogTitle>
              {isForce ? 'Force Delete Trip' : 'Permanently Delete Trip'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-foreground">{trip.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                {isForce
                  ? 'Admin force delete - the trip will be permanently removed regardless of its current status. All associated data (images, inclusions, age bands, add-ons, schedules) will also be permanently removed.'
                  : 'This archived trip will be permanently removed along with all its data (images, inclusions, age bands, add-ons, schedules). This cannot be undone.'}
              </p>
              <p className="text-xs font-medium text-destructive">
                This action is irreversible and cannot be undone.
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
            {isPending ? 'Deleting...' : isForce ? 'Force Delete' : 'Permanently Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
