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
  tripStatus?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TripArchiveDialog({
  tripId,
  tripName,
  tripStatus,
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

  const isDraft = tripStatus === 'DRAFT';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <ArchiveIcon className="size-5 text-destructive" />
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
                {isDraft
                  ? 'The draft will be moved to your archive. You can restore it to draft later or permanently delete it from there.'
                  : 'Archived trips are hidden from travelers and cannot be booked. You can restore this trip to draft later, or permanently delete it from the archive.'}
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
            {isPending ? 'Archiving...' : 'Archive Trip'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
