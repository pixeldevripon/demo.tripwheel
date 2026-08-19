'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    useCreateException,
    useRemoveException,
} from '@/hooks/trips/use-trips';
import { islandTime } from '@/lib/island-time';
import { cn } from '@/lib/utils';
import type { OverviewDay, TourClosureReason } from '@/types/trip';
import { chipState, keyToDate } from './calendar-utils';
import { useCalendarTourMeta } from './calendar-tour-meta';
import {
    DEPARTURE_DOT_CLASS,
    DEPARTURE_STATE_LABEL,
    unitNoun,
} from '@/components/common/departure-states';
import {
    CLOSURE_REASON_LABEL,
    ClosureReasonPanel,
    closureReassurance,
} from '@/components/common/closure-reason-panel';

/**
 * The Day view as a chronological LIST (MCK-16 change 6, review July 29):
 * one day of departures spread over a twelve-hour axis answered a narrower
 * question than the operator has. Each row: time, tour, how full, state, and
 * the one-tap Close/Reopen - with the reason panel expanding inline under
 * the row, because the reason IS the commit on every surface that closes.
 */
export function CalendarDayList({
    day,
    today,
    loading = false,
    operatorNameById,
    isAdmin,
    canStopSell,
}: {
    day: OverviewDay | undefined;
    today: string;
    /** The 1-day window shares nothing with the previous one, so paging
     *  always misses the stale placeholder data - loading must never read
     *  as an empty day. */
    loading?: boolean;
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canStopSell: boolean;
}) {
    const [reasonRowId, setReasonRowId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    // A draft abandoned on one day must not re-expand when navigation comes
    // back to a row with the same id (departure ids are stable DB rows).
    const dayKey = day?.date;
    useEffect(() => {
        setReasonRowId(null);
        setNote('');
        setError(null);
    }, [dayKey]);
    const createException = useCreateException();
    const removeException = useRemoveException();
    const busy = createException.isPending || removeException.isPending;

    const rows = [...(day?.departures ?? [])].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
    );
    const openCount = rows.filter((r) => chipState(r) === 'open').length;

    return (
        <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background'>
            <div className='flex h-11 shrink-0 items-baseline justify-between border-b border-border/50 px-4'>
                <p className='self-center text-sm font-medium'>
                    {day ? format(keyToDate(day.date), 'EEEE, d MMMM') : ''}
                </p>
                <p className='self-center text-xs text-muted-foreground'>
                    {openCount} of {rows.length} open
                </p>
            </div>
            <div className='min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto'>
                {rows.length === 0 &&
                    (loading && !day ? (
                        <div className='space-y-2 p-4'>
                            {Array.from({ length: 6 }, (_, i) => (
                                <div
                                    key={i}
                                    className='h-10 animate-pulse rounded-md bg-muted/50'
                                />
                            ))}
                        </div>
                    ) : (
                        <p className='px-4 py-6 text-sm text-muted-foreground'>
                            Nothing runs this day.
                        </p>
                    ))}
                {rows.map((dep) => (
                    <DayListRow
                        key={dep.id}
                        dep={dep}
                        past={day ? day.date < today : false}
                        operatorName={
                            isAdmin
                                ? operatorNameById.get(dep.operatorId)
                                : undefined
                        }
                        canStopSell={canStopSell}
                        busy={busy}
                        reasonOpen={reasonRowId === dep.id}
                        note={note}
                        error={error}
                        onNoteChange={setNote}
                        onAskReason={() => {
                            setReasonRowId(dep.id);
                            setNote('');
                            setError(null);
                        }}
                        onCancelReason={() => {
                            setReasonRowId(null);
                            setNote('');
                            setError(null);
                        }}
                        onCommitClose={(reason) => {
                            setError(null);
                            createException.mutate(
                                {
                                    tripId: dep.tourId,
                                    payload: {
                                        date: dep.date,
                                        type: 'CLOSE_SLOT',
                                        startTime: dep.startTime,
                                        closureReason: reason,
                                        note: note.trim() || undefined,
                                    },
                                },
                                {
                                    onSuccess: (row) => {
                                        setReasonRowId(null);
                                        setNote('');
                                        toast.success(
                                            `Closed ${dep.tourName} · ${dep.startTime} · ${CLOSURE_REASON_LABEL[reason]}. Booked guests keep their bookings.`,
                                            {
                                                action: {
                                                    label: 'Undo',
                                                    onClick: () =>
                                                        removeException.mutate({
                                                            tripId: dep.tourId,
                                                            exceptionId: row.id,
                                                        }),
                                                },
                                            },
                                        );
                                    },
                                    onError: (e) =>
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : 'Could not close the departure.',
                                        ),
                                },
                            );
                        }}
                        onReopen={() => {
                            if (!dep.closure) return;
                            removeException.mutate(
                                {
                                    tripId: dep.tourId,
                                    exceptionId: dep.closure.id,
                                },
                                {
                                    onSuccess: () =>
                                        toast.success(
                                            `Reopened ${dep.tourName} · ${dep.startTime}. New sales are running again. Reopening is logged too.`,
                                        ),
                                    onError: (e) =>
                                        toast.error(
                                            e instanceof Error
                                                ? e.message
                                                : 'Could not reopen the departure.',
                                        ),
                                },
                            );
                        }}
                    />
                ))}
            </div>
            {/* No footer of its own - the page renders the one-clock/counts
                sentence right below this frame already. */}
        </div>
    );
}

function DayListRow({
    dep,
    past,
    operatorName,
    canStopSell,
    busy,
    reasonOpen,
    note,
    error,
    onNoteChange,
    onAskReason,
    onCancelReason,
    onCommitClose,
    onReopen,
}: {
    dep: OverviewDay['departures'][number];
    past: boolean;
    operatorName?: string;
    canStopSell: boolean;
    busy: boolean;
    reasonOpen: boolean;
    note: string;
    error: string | null;
    onNoteChange: (v: string) => void;
    onAskReason: () => void;
    onCancelReason: () => void;
    onCommitClose: (reason: TourClosureReason) => void;
    onReopen: () => void;
}) {
    const state = chipState(dep);
    const meta = useCalendarTourMeta(dep.tourId);
    const closure = dep.closure;
    const derivedSoldOut = state === 'soldOut' && !closure;

    const sub: string[] = [];
    if (operatorName) sub.push(operatorName);
    sub.push(
        dep.pricingModel === 'UNIT'
            ? `Whole ${unitNoun(meta.wholeUnitType)}, one group takes it all`
            : `${dep.bookedCount} of ${dep.capacity} booked`,
    );
    if (closure) {
        sub.push(
            closure.closureReason
                ? CLOSURE_REASON_LABEL[closure.closureReason]
                : 'No reason recorded',
        );
        sub.push(
            `by ${
                closure.createdByName ??
                (closure.createdBySide === 'PLATFORM'
                    ? 'Island Tours'
                    : 'your team')
            }${closure.createdBySide === 'PLATFORM' && closure.createdByName ? ' (Island Tours)' : ''}, ${islandTime(closure.createdAt, meta.timeZone)}`,
        );
    }

    return (
        <div className={cn('px-4 py-3', past && 'opacity-60')}>
            <div className='flex items-center gap-3'>
                <span className='w-12 shrink-0 text-sm font-semibold tabular-nums'>
                    {dep.startTime}
                </span>
                <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                        {dep.tourName}
                    </p>
                    <p className='truncate text-xs text-muted-foreground'>
                        {sub.join(' · ')}
                    </p>
                </div>
                <span className='flex shrink-0 items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-2xs font-medium'>
                    <span
                        className={cn(
                            'size-1.5 rounded-full',
                            DEPARTURE_DOT_CLASS[state],
                        )}
                    />
                    {DEPARTURE_STATE_LABEL[state]}
                </span>
                {past || state === 'past' ? (
                    // A past day, a departed boat, or a cancelled run - no
                    // action either way. Closing a departure whose cutoff
                    // passed would stop sales that already stopped.
                    <Button size='sm' variant='outline' className='h-8' disabled>
                        {past ? 'Past' : 'Departed'}
                    </Button>
                ) : derivedSoldOut ? (
                    <Button
                        size='sm'
                        variant='outline'
                        className='h-8'
                        disabled
                        title='Sold out from bookings - reopens by itself if a spot frees up'>
                        Automatic
                    </Button>
                ) : state === 'cancelled' ? null : canStopSell ? (
                    closure ? (
                        <Button
                            size='sm'
                            className='h-8'
                            disabled={busy}
                            onClick={onReopen}>
                            Reopen
                        </Button>
                    ) : (
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            disabled={busy}
                            onClick={onAskReason}>
                            Close
                        </Button>
                    )
                ) : null}
            </div>
            {reasonOpen && (
                <div className='mt-3 max-w-sm'>
                    <ClosureReasonPanel
                        question={`Why are you closing the ${dep.startTime} departure?`}
                        reassurance={closureReassurance(dep.bookedCount)}
                        note={note}
                        onNoteChange={onNoteChange}
                        busy={busy}
                        pending={busy}
                        error={error}
                        onCommit={onCommitClose}
                        onCancel={onCancelReason}
                    />
                </div>
            )}
        </div>
    );
}
