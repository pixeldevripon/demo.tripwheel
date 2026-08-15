'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { relativeTime } from '@/components/common/inbox-copy';
import { RejectChangesDialog } from '@/components/trips/lifecycle/reject-changes-dialog';
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
import { useRole } from '@/contexts/role-context';
import {
    useApprovePendingChanges,
    useRejectPendingChanges,
    useTripPendingChange,
} from '@/hooks/trips/use-trips';
import { PENDING_AREA_LABELS } from '@/lib/trips/pending-change-labels';
import { cn } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import { PendingChangeDiff } from './pending-change-diff';

/**
 * Live-tour content gate (client review #19 / dashboard #80): the Review
 * step's window onto the tour's pending change set.
 *
 * - PENDING: warning header, per-field diff (both roles - the server ships
 *   `current`), decision actions for the platform, with a CONFIRMATION
 *   before approve (one click used to apply everything, client round 5).
 * - REJECTED: the diff STAYS, red-framed, with the admin's note above it -
 *   a note without the changes it is about is unreadable (client round 5).
 *   Both roles see it; only the operator gets the "edit and resubmit" cue.
 * - Approved or none: renders nothing - silence is the steady state.
 */
export function PendingChangesPanel({ trip }: { trip: TripListItem }) {
    const { can } = useRole();
    const isPlatform = can('MANAGE_TRIPS');
    const { data: change } = useTripPendingChange(trip.id);
    const { mutate: approveChanges, isPending: isApproving } =
        useApprovePendingChanges();
    const { mutate: rejectChanges, isPending: isRejecting } =
        useRejectPendingChanges();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);

    if (!change || change.status === 'APPROVED') return null;

    const rejected = change.status === 'REJECTED';
    const showCurrent = isPlatform || !!change.current;
    const areaSummary = change.changedAreas
        .map(area => PENDING_AREA_LABELS[area] ?? area)
        .join(', ');

    return (
        <div
            className={cn(
                'mt-4 overflow-hidden rounded-lg border',
                rejected ? 'border-danger-border' : 'border-warning-border'
            )}>
            {/* Header strip: the state, not the content. */}
            <div
                className={cn(
                    'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5',
                    rejected
                        ? 'border-danger-border bg-danger-subtle'
                        : 'border-warning-border bg-warning-subtle'
                )}>
                <p
                    className={cn(
                        'text-xs font-medium',
                        rejected ? 'text-danger-fg' : 'text-warning-fg'
                    )}>
                    {rejected
                        ? 'Island Tours requested changes on this proposal'
                        : isPlatform
                          ? 'Content changes awaiting your review'
                          : 'Waiting for Island Tours review'}
                </p>
                <span
                    className={cn(
                        'text-2xs',
                        rejected ? 'text-danger-fg/80' : 'text-warning-fg/80'
                    )}>
                    Submitted {relativeTime(change.submittedAt)}
                    {rejected && change.decidedAt
                        ? ` · sent back ${relativeTime(change.decidedAt)}`
                        : new Date(change.updatedAt).getTime() -
                                new Date(change.submittedAt).getTime() >
                            60_000
                          ? ` · last edited ${relativeTime(change.updatedAt)}`
                          : ''}
                </span>
            </div>

            {/* The admin's actionable note rides ABOVE the diff it is about. */}
            {rejected && change.reviewNote && (
                <div className='border-b border-danger-border/50 bg-danger-subtle/50 px-4 py-3'>
                    <p className='text-xs font-medium text-danger-fg'>
                        Note from Island Tours
                    </p>
                    <p className='mt-1 whitespace-pre-wrap text-sm text-danger-fg'>
                        {change.reviewNote}
                    </p>
                </div>
            )}

            {/* The diff itself, on a calm surface. Every row self-filters
                against the live values, so a set stashed before the
                diff-pruning fix can empty out entirely - the sibling note
                (shown via div:empty) says so instead of a silent void. */}
            <div className='px-4 py-2'>
                <div className='divide-y divide-line'>
                    <PendingChangeDiff
                        trip={trip}
                        change={change}
                        showCurrent={showCurrent}
                    />
                </div>
                <p className='hidden py-2 text-sm italic text-content-muted [div:empty+&]:block'>
                    Everything proposed here now matches the live content -
                    there is nothing left to review. Approving simply clears
                    this request.
                </p>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5'>
                <p className='text-xs text-content-muted'>
                    {rejected
                        ? isPlatform
                            ? 'The operator sees your note and can edit and resubmit.'
                            : 'Fix the sections named in the note and save again - saving sends a fresh proposal.'
                        : 'Travellers keep seeing the approved version until this is approved. The tour stays online throughout.'}
                </p>
                {isPlatform && !rejected && (
                    <div className='flex shrink-0 gap-2'>
                        <Button
                            size='sm'
                            variant='outline'
                            disabled={isApproving || isRejecting}
                            onClick={() => setRejectOpen(true)}>
                            Request changes
                        </Button>
                        <Button
                            size='sm'
                            disabled={isApproving || isRejecting}
                            onClick={() => setConfirmApproveOpen(true)}>
                            {isApproving ? 'Approving...' : 'Approve changes'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Approving publishes to travellers instantly - state the blast
                radius and ask once (client round 5). */}
            <AlertDialog
                open={confirmApproveOpen}
                onOpenChange={setConfirmApproveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Approve these changes?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {areaSummary
                                ? `${areaSummary} on `
                                : 'The proposed changes on '}
                            &ldquo;{trip.name}&rdquo; will replace the live
                            content and travellers see them immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isApproving}>
                            Back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isApproving}
                            onClick={() =>
                                approveChanges(
                                    { id: trip.id },
                                    {
                                        onSuccess: () => {
                                            setConfirmApproveOpen(false);
                                            toast.success(
                                                'Changes approved - travellers now see them.'
                                            );
                                        },
                                        onError: err => {
                                            setConfirmApproveOpen(false);
                                            toast.error(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to approve the changes.'
                                            );
                                        },
                                    }
                                )
                            }>
                            {isApproving ? 'Approving...' : 'Approve'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <RejectChangesDialog
                tripName={trip.name}
                open={rejectOpen}
                onOpenChange={setRejectOpen}
                isPending={isRejecting}
                onConfirm={note =>
                    rejectChanges(
                        { id: trip.id, note },
                        {
                            onSuccess: () => {
                                setRejectOpen(false);
                                toast.success(
                                    'Sent back - the operator sees your note.'
                                );
                            },
                            onError: err =>
                                toast.error(
                                    err instanceof Error
                                        ? err.message
                                        : 'Failed to send the changes back.'
                                ),
                        }
                    )
                }
            />
        </div>
    );
}
