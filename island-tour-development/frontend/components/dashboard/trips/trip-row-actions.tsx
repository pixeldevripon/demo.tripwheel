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
  LanguagesIcon,
  ImageIcon,
  CalendarIcon,
  FileTextIcon,
  TagIcon,
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
  useRestoreTrip,
} from '@/hooks/trips/use-trips';
import { useRole } from '@/contexts/role-context';
import type { TripListItem } from '@/types/trip';
import { TripDeleteDialog } from './trip-delete-dialog';
import { TripArchiveDialog } from './trip-archive-dialog';

interface TripRowActionsProps {
  trip: TripListItem;
}

export function TripRowActions({ trip }: TripRowActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { can, role } = useRole();

  const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
  const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
  const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();
  const { mutate: restoreTrip, isPending: isRestoring } = useRestoreTrip();

  const isLifecyclePending = isPublishing || isPausing || isUnpausing || isRestoring;

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

  function handleRestore() {
    restoreTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" restored to draft.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to restore.'),
    });
  }

  const isArchived = trip.status === 'ARCHIVED';
  const isForceDelete = role === 'ADMIN' && !isArchived;

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

          {/* Navigation - hidden for archived trips */}
          {!isArchived && (
            <>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=details`)}>
                <PencilIcon />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=images`)}>
                <ImageIcon />
                Images
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=inclusions`)}>
                <FileTextIcon />
                Content
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=pricing`)}>
                <TagIcon />
                Pricing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=schedules`)}>
                <CalendarIcon />
                Schedules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/trips/${trip.id}/edit?tab=translations`)}>
                <LanguagesIcon />
                Translations
              </DropdownMenuItem>
            </>
          )}

          {/* Lifecycle */}
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
              {/* Archive - available for any non-archived trip */}
              {!isArchived && (
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  disabled={isLifecyclePending}
                >
                  <ArchiveIcon />
                  Archive
                </DropdownMenuItem>
              )}
              {/* Restore - only for archived trips */}
              {isArchived && (
                <DropdownMenuItem onClick={handleRestore} disabled={isLifecyclePending}>
                  <RotateCcwIcon />
                  Restore to Draft
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Destructive - permanently delete */}
          {can('DELETE_TRIP') && (isArchived || role === 'ADMIN') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
                {isForceDelete ? 'Force Delete' : 'Permanently Delete'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TripDeleteDialog
        trip={trip}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        isForce={isForceDelete}
      />

      <TripArchiveDialog
        tripId={trip.id}
        tripName={trip.name}
        tripStatus={trip.status}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </>
  );
}
