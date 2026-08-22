'use client';

import { relativeTime } from '@/components/common/inbox-copy';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import { useTripPendingChange } from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import type { PendingChangeArea, TripListItem } from '@/types/trip';
import { PENDING_AREA_LABELS } from '@/lib/trips/pending-change-labels';

/**
 * The standing signal that a live tour has content in review (UX round 2:
 * the gate used to be silent everywhere but the Review step - an operator
 * saved, saw "All changes saved", and had no idea travellers still see the
 * old version). Renders on EVERY wizard step except Review, which carries
 * the full panel; appears the moment a gated save lands, because the gated
 * mutations invalidate this query.
 */
export function PendingReviewBanner({
    trip,
    hidden,
    onView,
}: {
    trip: TripListItem;
    hidden?: boolean;
    /** Guarded navigation to the Review step - the wizard's onStepChange,
     *  so leaving a dirty step still asks first (never a raw router call). */
    onView: () => void;
}) {
    const { can } = useRole();
    const isPlatform = can('MANAGE_TRIPS');
    const { data: change } = useTripPendingChange(trip.id);

    if (
        hidden ||
        trip.status !== 'LIVE' ||
        !change ||
        change.status === 'APPROVED'
    ) {
        return null;
    }

    const rejected = change.status === 'REJECTED';
    // A rejection is the OPERATOR's cue; the platform wrote the note.
    if (rejected && (isPlatform || !change.reviewNote)) return null;

    return (
        <div
            className={cn(
                'mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-4 py-2.5',
                rejected
                    ? 'border-danger-border bg-danger-subtle'
                    : 'border-warning-border bg-warning-subtle'
            )}>
            <span
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    rejected ? 'bg-danger-fg' : 'bg-warning-fg'
                )}
            />
            <p
                className={cn(
                    'text-xs font-medium',
                    rejected ? 'text-danger-fg' : 'text-warning-fg'
                )}>
                {rejected
                    ? 'Island Tours sent your content changes back'
                    : isPlatform
                      ? 'Content changes awaiting your review'
                      : 'Changes waiting for Island Tours review'}
            </p>
            {!rejected && (
                <div className='flex flex-wrap gap-1'>
                    {change.changedAreas.map(area => (
                        <span
                            key={area}
                            className='rounded-full bg-warning-fg/10 px-2 py-0.5 text-2xs font-medium text-warning-fg'>
                            {PENDING_AREA_LABELS[area] ?? area}
                        </span>
                    ))}
                </div>
            )}
            <span
                className={cn(
                    'text-2xs',
                    rejected ? 'text-danger-fg/75' : 'text-warning-fg/75'
                )}>
                {rejected
                    ? 'Read the note, fix and save again.'
                    : `Submitted ${relativeTime(change.submittedAt)}${isPlatform ? '' : ' · travellers still see the approved version'}`}
            </span>
            <Button
                size='sm'
                variant='ghost'
                className={cn(
                    'ml-auto h-6 shrink-0 px-2 text-xs',
                    rejected
                        ? 'text-danger-fg hover:text-danger-fg'
                        : 'text-warning-fg hover:text-warning-fg'
                )}
                onClick={onView}>
                {rejected ? 'Read the note' : isPlatform ? 'Review' : 'View'}
            </Button>
        </div>
    );
}
