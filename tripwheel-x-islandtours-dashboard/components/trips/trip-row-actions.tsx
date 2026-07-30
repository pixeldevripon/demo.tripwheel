'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Calendar03Icon, CheckmarkCircle02Icon, Delete02Icon, File02Icon, Image02Icon, MoreHorizontalIcon, PauseIcon, PencilEdit02Icon, PlayIcon, RotateLeft01Icon, SentIcon, Tag01Icon, TranslateIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import {
  usePublishTrip,
  usePauseTrip,
  useUnpauseTrip,
  useRestoreTrip,
  useSubmitTripForReview,
  useApproveTrip,
  useRejectTrip,
} from '@/hooks/trips/use-trips';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  // F7: pause states its consequences before acting (what stops, what is kept).
  const [pauseOpen, setPauseOpen] = useState(false);
  const { can, role } = useRole();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
  const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
  const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();
  const { mutate: restoreTrip, isPending: isRestoring } = useRestoreTrip();
  const { mutate: submitForReview, isPending: isSubmitting } =
    useSubmitTripForReview();
  const { mutate: approveTrip, isPending: isApproving } = useApproveTrip();
  const { mutate: rejectTrip, isPending: isRejecting } = useRejectTrip();

  const isLifecyclePending =
    isPublishing || isPausing || isUnpausing || isRestoring ||
    isSubmitting || isApproving || isRejecting;

  // Conflict #1: publishing is always Island Tours'. Operators (EDIT_TRIP
  // without MANAGE_TRIPS) submit a ready DRAFT for review; the admin
  // approves/rejects and publishes. Pause/archive stay available to the
  // operator (downward transitions are always safe).
  const isPlatform = can('MANAGE_TRIPS');
  const canSubmitForReview =
    !isPlatform &&
    can('EDIT_TRIP') &&
    trip.status === 'DRAFT' &&
    (trip.approvalStatus === 'NOT_SUBMITTED' ||
      trip.approvalStatus === 'REJECTED');
  const canDecideReview =
    isPlatform && trip.status === 'DRAFT' && trip.approvalStatus === 'PENDING';

  function handleSubmitForReview() {
    submitForReview(trip.id, {
      onSuccess: () =>
        toast.success(`"${trip.name}" submitted - Island Tours will review it.`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to submit for review.',
        ),
    });
  }

  function handleApprove() {
    approveTrip(
      { id: trip.id },
      {
        onSuccess: () =>
          toast.success(`"${trip.name}" approved - publish when ready.`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to approve.'),
      },
    );
  }

  function handlePublish() {
    publishTrip(trip.id, {
      onSuccess: () => toast.success(`"${trip.name}" published successfully.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to publish.'),
    });
  }

  function handlePause() {
    setPauseOpen(false);
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
            <HugeiconsIcon icon={MoreHorizontalIcon} />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>

          {/* Navigation - hidden for archived trips */}
          {!isArchived && (
            <>
              {/* `?step=` is the canonical param now. Old `?tab=` links
                  still resolve through TAB_TO_STEP, so bookmarks survive. */}
              <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}/edit?step=review`)}>
                <HugeiconsIcon icon={PencilEdit02Icon} />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}/edit?step=media`)}>
                <HugeiconsIcon icon={Image02Icon} />
                Images
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}/edit?step=content`)}>
                <HugeiconsIcon icon={File02Icon} />
                Content
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}/edit?step=pricing`)}>
                <HugeiconsIcon icon={Tag01Icon} />
                Pricing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}/edit?step=schedule`)}>
                <HugeiconsIcon icon={Calendar03Icon} />
                Schedules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/translations/tour/${trip.id}/es`)}>
                <HugeiconsIcon icon={TranslateIcon} />
                Translations
              </DropdownMenuItem>
            </>
          )}

          {/* Review pipeline (conflict #1) */}
          {canSubmitForReview && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSubmitForReview}
                disabled={isLifecyclePending}
              >
                <HugeiconsIcon icon={SentIcon} />
                {trip.approvalStatus === 'REJECTED'
                  ? 'Resubmit for review'
                  : 'Submit for review'}
              </DropdownMenuItem>
            </>
          )}
          {canDecideReview && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleApprove}
                disabled={isLifecyclePending}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRejectOpen(true)}
                disabled={isLifecyclePending}
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Request changes
              </DropdownMenuItem>
            </>
          )}

          {/* Lifecycle */}
          {can('MANAGE_TRIPS') && (
            <>
              <DropdownMenuSeparator />
              {trip.status === 'DRAFT' && (
                <DropdownMenuItem
                  onClick={handlePublish}
                  disabled={
                    isLifecyclePending ||
                    (role !== 'ADMIN' && trip.approvalStatus !== 'APPROVED')
                  }
                >
                  <HugeiconsIcon icon={PlayIcon} />
                  Publish
                </DropdownMenuItem>
              )}
              {trip.status === 'LIVE' && (
                <DropdownMenuItem onClick={() => setPauseOpen(true)} disabled={isLifecyclePending}>
                  <HugeiconsIcon icon={PauseIcon} />
                  Pause
                </DropdownMenuItem>
              )}
              {trip.status === 'PAUSED' && (
                <DropdownMenuItem onClick={handleUnpause} disabled={isLifecyclePending}>
                  <HugeiconsIcon icon={RotateLeft01Icon} />
                  Unpause
                </DropdownMenuItem>
              )}
              {/* Archive - available for any non-archived trip */}
              {!isArchived && (
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  disabled={isLifecyclePending}
                >
                  <HugeiconsIcon icon={Archive02Icon} />
                  Archive
                </DropdownMenuItem>
              )}
              {/* Restore - only for archived trips */}
              {isArchived && (
                <DropdownMenuItem onClick={handleRestore} disabled={isLifecyclePending}>
                  <HugeiconsIcon icon={RotateLeft01Icon} />
                  Restore to Draft
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Operator downward transitions (safe: takes the tour OFFLINE) */}
          {!isPlatform && can('EDIT_TRIP') && (
            <>
              {!isArchived && <DropdownMenuSeparator />}
              {trip.status === 'LIVE' && (
                <DropdownMenuItem onClick={() => setPauseOpen(true)} disabled={isLifecyclePending}>
                  <HugeiconsIcon icon={PauseIcon} />
                  Pause
                </DropdownMenuItem>
              )}
              {!isArchived && (
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  disabled={isLifecyclePending}
                >
                  <HugeiconsIcon icon={Archive02Icon} />
                  Archive
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
                <HugeiconsIcon icon={Delete02Icon} />
                {isForceDelete ? 'Force Delete' : 'Permanently Delete'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reject with a REQUIRED actionable note (the operator sees it). */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes on "{trip.name}"?</DialogTitle>
            <DialogDescription>
              The note below is shown to the operator - tell them exactly what
              to fix so they can resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="e.g. The hero photo is blurry and the overview needs at least two paragraphs."
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isRejecting}
              onClick={() => setRejectOpen(false)}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={isRejecting || rejectNote.trim().length < 5}
              onClick={() =>
                rejectTrip(
                  { id: trip.id, note: rejectNote.trim() },
                  {
                    onSuccess: () => {
                      setRejectOpen(false);
                      setRejectNote('');
                      toast.success('Changes requested - the operator was notified in their dashboard.');
                    },
                    onError: (err) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Failed to reject.',
                      ),
                  },
                )
              }
            >
              Request changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* F7: pause states its consequences instead of acting on a bare click.
          This build's pause is a status gate - the tour leaves the public site
          whole, nothing is sellable while paused, and no departure or booking
          is touched. */}
      <AlertDialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause &ldquo;{trip.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The tour leaves the public site immediately and nothing can be
              booked while it is paused. Existing bookings are kept and stay
              valid - contact booked guests yourself if their departure will
              not run. Unpausing puts the tour back exactly as it was. To stop
              selling only specific dates, close them on the tour&apos;s
              calendar instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePause}>
              Pause tour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
