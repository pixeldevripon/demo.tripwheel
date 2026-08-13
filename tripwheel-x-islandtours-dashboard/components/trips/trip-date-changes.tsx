'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CLOSURE_REASON_LABEL } from '@/components/common/closure-reason-panel';
import { useExceptions, useRemoveException } from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import type { TourException } from '@/types/trip';

/**
 * The Date Changes register (review §3.2d): every one-off change to a specific
 * date - closures, added departures, capacity overrides - in operator language,
 * newest first, each with who/when and its undo. This is the audit surface
 * (dev spec §6.5: "I closed that date" disputes must be resolvable from the
 * screen) and the undo-later mechanism for changes whose calendar month you
 * are no longer looking at.
 */

function actionLabel(x: TourException): string {
    // The reason rides the closure label (MCK-16 change 5): "Whole day closed
    // · Not running" reads the register the way the traveller calendar reads
    // the date. A reasonless legacy closure stays a plain "closed".
    const reason = x.closureReason
        ? ` · ${CLOSURE_REASON_LABEL[x.closureReason]}`
        : '';
    switch (x.type) {
        case 'CLOSE_DATE':
            return `Whole day closed${reason}`;
        case 'CLOSE_SLOT':
            return `${x.startTime} departure closed${reason}`;
        case 'ADD_SLOT':
            return `${x.startTime} added (one-off)${x.capacity != null ? ` · ${x.capacity} seats` : ''}`;
        case 'SET_CAPACITY':
            return x.startTime
                ? `${x.startTime} capacity set to ${x.capacity}`
                : `Day capacity set to ${x.capacity}`;
    }
}

/** Reopen for stop-sells, Remove for things that were added on top. */
function undoLabel(x: TourException): string {
    return x.type === 'CLOSE_DATE' || x.type === 'CLOSE_SLOT'
        ? 'Reopen'
        : 'Remove';
}

// An audit timestamp in the ISLAND's clock (code-review M12): the viewer's
// zone and the island's can disagree near midnight, and this is a dispute
// surface. One helper for both the closure and the reopen line.
function islandTime(timeZone: string, iso: string): string {
    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(iso));
}

// 'YYYY-MM-DD' → 'Wed 12 Aug 2026'.
function formatDay(day: string): string {
    const parsed = new Date(`${day}T00:00:00`);
    return Number.isNaN(parsed.getTime())
        ? day
        : format(parsed, 'EEE d MMM yyyy');
}

interface TripDateChangesProps {
    tripId: string;
    /** Tour-local IANA zone - "past" must follow the ISLAND's clock. */
    timeZone: string;
}

export function TripDateChanges({ tripId, timeZone }: TripDateChangesProps) {
    const { data: exceptions, isLoading } = useExceptions(tripId);
    const { mutate: removeException, isPending } = useRemoveException();
    const [removingId, setRemovingId] = useState<string | null>(null);

    // The island's today (same construction as the calendar): the Reopen
    // control must not appear or vanish a few hours early for an operator
    // managing from another timezone.
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(
        new Date()
    );

    if (isLoading) return <Skeleton className='h-24 w-full rounded-lg' />;

    if (!exceptions || exceptions.length === 0) {
        return (
            <p className='text-sm text-muted-foreground'>
                No date changes yet. Tap a date on the calendar to close it or
                add an extra departure.
            </p>
        );
    }

    function undo(x: TourException) {
        setRemovingId(x.id);
        removeException(
            { tripId, exceptionId: x.id },
            {
                onSuccess: () =>
                    toast.success(
                        x.type === 'CLOSE_DATE' || x.type === 'CLOSE_SLOT'
                            ? `Reopened ${formatDay(x.date)}.`
                            : `Removed the change on ${formatDay(x.date)}.`
                    ),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'The change failed.'
                    ),
                onSettled: () => setRemovingId(null),
            }
        );
    }

    return (
        <div className='divide-y'>
            {exceptions.map(x => {
                // A retired row is history (MCK-16 change 10): the undo already
                // happened, and the register shows both the act and its
                // undoing rather than deleting the evidence.
                const retired = !!x.retiredAt;
                return (
                    <div
                        key={x.id}
                        className={cn(
                            'flex items-center justify-between gap-3 py-2.5',
                            retired && 'opacity-70'
                        )}>
                        <div className='min-w-0'>
                            <p className='text-sm'>
                                <span className='font-medium'>
                                    {formatDay(x.date)}
                                </span>{' '}
                                · {actionLabel(x)}
                                {x.note && (
                                    <span className='text-muted-foreground'>
                                        {' '}
                                        · “{x.note}”
                                    </span>
                                )}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                                {x.createdByName
                                    ? `By ${x.createdByName}`
                                    : 'By your team'}
                                {x.createdBySide === 'PLATFORM'
                                    ? ' (Island Tours)'
                                    : ''}{' '}
                                ·{' '}
                                {/* Render the audit time in the ISLAND zone, same as
                                    the todayKey/Reopen gate above — the old date-fns
                                    format used the viewer's zone, so on a dispute
                                    surface the two clocks could disagree near midnight
                                    (code-review M12). */}
                                {islandTime(timeZone, x.createdAt)}
                            </p>
                            {retired && x.retiredAt && (
                                <p className='text-xs text-muted-foreground'>
                                    {x.type === 'CLOSE_DATE' ||
                                    x.type === 'CLOSE_SLOT'
                                        ? 'Reopened'
                                        : 'Removed'}{' '}
                                    by{' '}
                                    {x.retiredByName ??
                                        (x.retiredBySide === 'PLATFORM'
                                            ? 'Island Tours'
                                            : 'your team')}
                                    {x.retiredBySide === 'PLATFORM' &&
                                    x.retiredByName
                                        ? ' (Island Tours)'
                                        : ''}{' '}
                                    · {islandTime(timeZone, x.retiredAt)}
                                </p>
                            )}
                        </div>
                        {x.date >= todayKey && !retired && (
                            <Button
                                size='sm'
                                variant='outline'
                                className='h-7 shrink-0 px-2 text-xs'
                                // Scope the disabled state to THIS row's in-flight
                                // undo, not the shared mutation flag (code-review L4).
                                disabled={isPending && removingId === x.id}
                                onClick={() => undo(x)}>
                                {isPending && removingId === x.id && (
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        className='size-3 animate-spin'
                                    />
                                )}
                                {undoLabel(x)}
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
