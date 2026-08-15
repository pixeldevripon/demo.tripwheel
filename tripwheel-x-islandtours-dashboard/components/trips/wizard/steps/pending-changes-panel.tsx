'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { relativeTime } from '@/components/common/inbox-copy';
import { RejectChangesDialog } from '@/components/trips/lifecycle/reject-changes-dialog';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import {
    useApprovePendingChanges,
    useRejectPendingChanges,
    useTripPendingChange,
} from '@/hooks/trips/use-trips';
import type {
    PendingChangeArea,
    TripListItem,
    TripPendingChangePayload,
} from '@/types/trip';

const AREA_LABELS: Record<PendingChangeArea, string> = {
    title: 'Title',
    content: 'Description',
    photos: 'Photos',
};

/** One human line per proposed area - what the reviewer decides on. */
function proposalRows(trip: TripListItem, payload: TripPendingChangePayload) {
    const rows: Array<{ label: string; detail: string }> = [];
    if (payload.tour?.name !== undefined) {
        rows.push({
            label: 'Title',
            detail: `Current "${trip.name}" becomes "${payload.tour.name}"`,
        });
    }
    for (const [locale, fields] of Object.entries(payload.translations ?? {})) {
        rows.push({
            label: `Text (${locale.toUpperCase()})`,
            detail: Object.keys(fields).join(', '),
        });
    }
    if (payload.images) {
        const added = payload.images.filter(i => i.isNew).length;
        rows.push({
            label: 'Photos',
            detail: `${payload.images.length} photo${payload.images.length === 1 ? '' : 's'} in the proposed gallery${added ? ` (${added} new)` : ''}`,
        });
    }
    return rows;
}

/**
 * Live-tour content gate (client review #19 / dashboard #80): the Review
 * step's window onto the tour's pending change set.
 *
 * - Operator + open set: what is waiting, and the promise that travellers
 *   keep seeing the approved version meanwhile.
 * - Platform + open set: the proposal summary with Approve / Request changes.
 * - Sent-back set: the admin's actionable note until the operator edits again.
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

    if (!change || change.status === 'APPROVED') return null;

    if (change.status === 'REJECTED') {
        // The operator's cue to fix and re-edit; a platform seat needs no
        // reminder of its own verdict.
        if (isPlatform || !change.reviewNote) return null;
        return (
            <div className='rounded-lg border border-danger-border bg-danger-subtle px-4 py-3'>
                <p className='text-xs font-medium text-danger-fg'>
                    Content changes sent back by Island Tours
                </p>
                <p className='mt-1 text-sm text-danger-fg'>
                    {change.reviewNote}
                </p>
                <p className='mt-1 text-xs text-danger-fg/80'>
                    Travellers still see the approved version. Edit the
                    sections again to send a new proposal.
                </p>
            </div>
        );
    }

    const rows = proposalRows(trip, change.payload);

    return (
        <div className='rounded-lg border border-warning-border bg-warning-subtle px-4 py-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-xs font-medium text-warning-fg'>
                    {isPlatform
                        ? 'Content changes awaiting review'
                        : 'Changes waiting for Island Tours review'}
                </p>
                <span className='text-2xs text-warning-fg/80'>
                    Submitted {relativeTime(change.submittedAt)}
                </span>
            </div>
            <ul className='mt-2 space-y-1'>
                {rows.map(row => (
                    <li key={row.label} className='text-sm text-warning-fg'>
                        <span className='font-medium'>
                            {AREA_LABELS[row.label as PendingChangeArea] ??
                                row.label}
                            :
                        </span>{' '}
                        {row.detail}
                    </li>
                ))}
            </ul>
            <p className='mt-2 text-xs text-warning-fg/80'>
                Travellers keep seeing the approved version until these changes
                are approved. The tour stays online throughout.
            </p>
            {isPlatform && (
                <div className='mt-3 flex flex-wrap gap-2'>
                    <Button
                        size='sm'
                        disabled={isApproving || isRejecting}
                        onClick={() =>
                            approveChanges(
                                { id: trip.id },
                                {
                                    onSuccess: () =>
                                        toast.success(
                                            'Changes approved - travellers now see them.'
                                        ),
                                    onError: err =>
                                        toast.error(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to approve the changes.'
                                        ),
                                }
                            )
                        }>
                        {isApproving ? 'Approving...' : 'Approve changes'}
                    </Button>
                    <Button
                        size='sm'
                        variant='outline'
                        disabled={isApproving || isRejecting}
                        onClick={() => setRejectOpen(true)}>
                        Request changes
                    </Button>
                </div>
            )}
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
