'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Calendar03Icon, CheckmarkCircle02Icon, Delete02Icon, File02Icon, Image02Icon, LinkSquare02Icon, MoreHorizontalIcon, PauseIcon, PencilEdit02Icon, PlayIcon, RotateLeft01Icon, SentIcon, Tag01Icon, TranslateIcon } from '@hugeicons/core-free-icons';

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
import { useRole } from '@/contexts/role-context';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { tourUrl } from '@/lib/public-site';
import type { TripListItem, TripStatus } from '@/types/trip';
import { TripDeleteDialog } from './trip-delete-dialog';
import { TripArchiveDialog } from './trip-archive-dialog';
import { RejectChangesDialog } from './lifecycle/reject-changes-dialog';

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

  // The live URL is `/{locale}/{destination}/{tour-slug}/`, and the destination
  // SLUG is not on the row (it carries `destinationId` only) - so resolve it from
  // the destinations query. No extra request: the trips table already holds this
  // exact query for its filter dropdown, so this is a cache read.
  const { data: destinations } = useActiveDestinations();
  const destinationSlug = destinations?.find(
    (d) => d.id === trip.destinationId,
  )?.slug;
  // ONLY for a LIVE trip. Every public tour read gates on `status: LIVE`, so a
  // draft, paused or archived trip 404s - and a menu item that leads to a 404 is
  // worse than no menu item. Same reason it needs the slug to have resolved.
  const publicUrl =
    trip.status === 'LIVE' && destinationSlug
      ? tourUrl(destinationSlug, trip.slug)
      : null;

  // Conflict #1: publishing is always Island Tours'. Operators (EDIT_TRIP
  // without MANAGE_TRIPS) submit a ready DRAFT for review; the admin
  // approves/rejects and publishes. Pause/archive stay available to the
  // operator (downward transitions are always safe).
  const isPlatform = can('MANAGE_TRIPS');
  // Every exit from PAUSED and ARCHIVED is MANAGE_TRIPS (unpause / restore /
  // publish), so an operator whose tour was paused had ONE action left -
  // archive it, i.e. further down - and one whose tour was archived had none
  // at all. A dead end they could not talk their way out of (operator test
  // report 2026-08-01 §02). Asking is the half of conflict #1 that belongs to
  // them: submitting stamps a request, it never moves the status.
  const REQUESTABLE: TripStatus[] = ['DRAFT', 'PAUSED', 'ARCHIVED'];
  const canSubmitForReview =
    !isPlatform &&
    can('EDIT_TRIP') &&
    REQUESTABLE.includes(trip.status) &&
    (trip.approvalStatus === 'NOT_SUBMITTED' ||
      trip.approvalStatus === 'REJECTED');
  const canDecideReview =
    isPlatform &&
    REQUESTABLE.includes(trip.status) &&
    trip.approvalStatus === 'PENDING';

  /**
   * The same request reads differently depending on where the tour is, and the
   * generic "Submit for review" told a paused-tour operator nothing about what
   * they were asking for.
   */
  const submitLabel =
    trip.status === 'PAUSED'
      ? 'Ask to go live again'
      : trip.status === 'ARCHIVED'
        ? 'Ask to bring this back'
        : trip.approvalStatus === 'REJECTED'
          ? 'Resubmit for review'
          : 'Submit for review';

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
      onSuccess: () =>
        toast.success(`"${trip.name}" paused.`, {
          duration: 10_000,
          action: {
            label: 'Undo',
            onClick: () =>
              unpauseTrip(trip.id, {
                onSuccess: () => toast.success(`"${trip.name}" resumed.`),
                onError: (err) =>
                  toast.error(
                    err instanceof Error ? err.message : 'Undo failed - the tour is still paused.',
                  ),
              }),
          },
        }),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to pause.'),
    });
  }

  function handleUnpause() {
    unpauseTrip(trip.id, {
      onSuccess: () =>
        toast.success(`"${trip.name}" resumed.`, {
          duration: 10_000,
          action: {
            label: 'Undo',
            onClick: () =>
              pauseTrip(trip.id, {
                onSuccess: () => toast.success(`"${trip.name}" paused again.`),
                onError: (err) =>
                  toast.error(
                    err instanceof Error ? err.message : 'Undo failed - the tour is still live.',
                  ),
              }),
          },
        }),
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

          {/* The live page LEADS the menu (founder 2026-07-30): seeing what
              travellers see is the most-reached-for action, and the Live pill
              doubles as the status cue. A real anchor, not router.push: this
              leaves the dashboard for the public site, so it opens in a new
              tab and keeps whatever the operator had open here. */}
          {publicUrl && (
            <DropdownMenuItem asChild>
              <a className='text-success-solid' href={publicUrl} target="_blank" rel="noopener noreferrer">
                <HugeiconsIcon icon={LinkSquare02Icon} />
                View trip page
              </a>
            </DropdownMenuItem>
          )}

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
                {submitLabel}
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
      <RejectChangesDialog
        tripName={trip.name}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        isPending={isRejecting}
        onConfirm={(note) =>
          rejectTrip(
            { id: trip.id, note },
            {
              onSuccess: () => {
                setRejectOpen(false);
                toast.success('Changes requested - the operator was notified in their dashboard.');
              },
              onError: (err) =>
                toast.error(
                  err instanceof Error ? err.message : 'Failed to reject.',
                ),
            },
          )
        }
      />

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
