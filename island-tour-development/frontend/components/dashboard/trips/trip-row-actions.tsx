'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PencilIcon,
  Trash2Icon,
  MoreHorizontalIcon,
  PlayIcon,
  PauseIcon,
  ArchiveIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  usePublishTrip,
  usePauseTrip,
  useUnpauseTrip,
  useArchiveTrip,
} from '@/hooks/trips/use-trips';
import { useRole } from '@/contexts/role-context';
import type { TripListItem } from '@/types/trip';
import { TripDeleteDialog } from './trip-delete-dialog';

interface TripRowActionsProps {
  trip: TripListItem;
}

export function TripRowActions({ trip }: TripRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { can } = useRole();
  const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
  const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
  const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();
  const { mutate: archiveTrip, isPending: isArchiving } = useArchiveTrip();

  const isLifecyclePending = isPublishing || isPausing || isUnpausing || isArchiving;

  function handlePublish() {
    publishTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" published successfully.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to publish.'),
    });
  }

  function handlePause() {
    pauseTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" paused.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to pause.'),
    });
  }

  function handleUnpause() {
    unpauseTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" resumed.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to unpause.'),
    });
  }

  function handleArchive() {
    archiveTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" archived.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to archive.'),
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit`)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>

          {can('MANAGE_TRIPS') && (
            <>
              <DropdownMenuSeparator />
              {trip.status === 'DRAFT' && (
                <DropdownMenuItem onClick={handlePublish} disabled={isLifecyclePending}>
                  <PlayIcon />
                  Publish
                </DropdownMenuItem>
              )}
              {trip.status === 'LIVE' && (
                <DropdownMenuItem onClick={handlePause} disabled={isLifecyclePending}>
                  <PauseIcon />
                  Pause
                </DropdownMenuItem>
              )}
              {trip.status === 'PAUSED' && (
                <DropdownMenuItem onClick={handleUnpause} disabled={isLifecyclePending}>
                  <RotateCcwIcon />
                  Unpause
                </DropdownMenuItem>
              )}
              {(trip.status === 'LIVE' || trip.status === 'PAUSED') && (
                <DropdownMenuItem onClick={handleArchive} disabled={isLifecyclePending}>
                  <ArchiveIcon />
                  Archive
                </DropdownMenuItem>
              )}
            </>
          )}

          {can('DELETE_TRIP') && trip.status === 'DRAFT' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TripDeleteDialog
        trip={trip}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
