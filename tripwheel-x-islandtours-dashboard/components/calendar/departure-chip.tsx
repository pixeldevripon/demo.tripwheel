'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverCloseButton,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useRole } from '@/contexts/role-context';
import {
    useCreateException,
    useRemoveException,
} from '@/hooks/trips/use-trips';
import { springPop } from '@/lib/motion';
import { islandTime } from '@/lib/island-time';
import { cn } from '@/lib/utils';
import type { OverviewDeparture, TourClosureReason } from '@/types/trip';
import { chipState, keyToDate, seatsLabel } from './calendar-utils';
import { useCalendarTourMeta } from './calendar-tour-meta';
import {
    DEPARTURE_CHIP_CLASS,
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
 * One departure as a calendar event chip. Click opens the management card:
 * status + seats + audit line (reason, who, which side), stop-sell/reopen,
 * and the two deep links (bookings pre-filtered to this tour + day, the tour
 * timetable).
 *
 * The card dismisses by its own X, Esc, or a click outside - never by the
 * stop-sell button (pastel 9). That button used to read "Close", so the one
 * control on the card that looked like a way out halted sales instead.
 *
 * No capacity control here, deliberately (MCK-16 change 3, review §5.5):
 * capacity is a set-once property on the Details tab, and the wizard's day
 * panel carries none either. The stop-sell rules mirror the backend split:
 * close/reopen ride MANAGE_AVAILABILITY OR STOP_SELL - the card hides what
 * the seat cannot do rather than serving a 403.
 */
export function DepartureChip({
    dep,
    operatorName,
    variant = 'row',
    className,
}: {
    dep: OverviewDeparture;
    /** Shown for admins, where one grid mixes operators. */
    operatorName?: string;
    /** row = month cells + day peek · block = week/day time grid. */
    variant?: 'row' | 'block';
    className?: string;
}) {
    const reduceMotion = useReducedMotion();
    const state = chipState(dep);
    const meta = useCalendarTourMeta(dep.tourId);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <motion.button
                    type='button'
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                    transition={springPop}
                    className={cn(
                        'flex w-full min-w-0 items-center gap-1 rounded-sm text-left text-xs transition-colors duration-normal outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40',
                        variant === 'row'
                            ? 'px-1.5 py-0.5'
                            : 'h-full flex-col items-start gap-0.5 rounded-lg px-2 py-1',
                        DEPARTURE_CHIP_CLASS[state],
                        state === 'past' && 'opacity-70',
                        className,
                    )}>
                    {/* The operator rides the ROW for platform seats (MCK-16
                        change 12) - a departure must be traceable to a
                        company without opening the card. */}
                    {variant === 'row' ? (
                        <>
                            <span className='shrink-0 font-medium tabular-nums'>
                                {dep.startTime}
                            </span>
                            <span className='min-w-0 flex-1 truncate'>
                                {dep.tourName}
                                {operatorName ? ` · ${operatorName}` : ''}
                            </span>
                            <span className='shrink-0 tabular-nums text-2xs'>
                                {seatsLabel(dep, meta.wholeUnitType)}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className='w-full truncate font-medium'>
                                {dep.tourName}
                            </span>
                            <span className='w-full truncate whitespace-nowrap tabular-nums text-2xs'>
                                {dep.startTime} ·{' '}
                                {seatsLabel(dep, meta.wholeUnitType)}
                                {operatorName ? ` · ${operatorName}` : ''}
                            </span>
                        </>
                    )}
                </motion.button>
            </PopoverTrigger>
            <PopoverContent
                className='w-80 p-0'
                align='start'
                collisionPadding={12}>
                <DepartureCard dep={dep} operatorName={operatorName} />
            </PopoverContent>
        </Popover>
    );
}

function DepartureCard({
    dep,
    operatorName,
}: {
    dep: OverviewDeparture;
    operatorName?: string;
}) {
    const { canAny } = useRole();
    const canStopSell = canAny(['MANAGE_AVAILABILITY', 'STOP_SELL']);
    const state = chipState(dep);
    const meta = useCalendarTourMeta(dep.tourId);

    const createException = useCreateException();
    const removeException = useRemoveException();

    const [reasonOpen, setReasonOpen] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const dayLabel = format(keyToDate(dep.date), 'EEE d MMM yyyy');
    const closure = dep.closure;
    // A sold-out with no closure row filled through bookings: it reopens by
    // itself when a spot frees up, so the card offers no action for it.
    const derivedSoldOut = state === 'soldOut' && !closure;

    function handleClose(closureReason: TourClosureReason) {
        setError(null);
        createException.mutate(
            {
                tripId: dep.tourId,
                payload: {
                    date: dep.date,
                    type: 'CLOSE_SLOT',
                    startTime: dep.startTime,
                    closureReason,
                    note: note.trim() || undefined,
                },
            },
            {
                onSuccess: (row) => {
                    setReasonOpen(false);
                    setNote('');
                    toast.success(
                        `Closed ${dep.tourName} · ${dep.startTime} · ${CLOSURE_REASON_LABEL[closureReason]}. Booked guests keep their bookings.`,
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
                        e instanceof Error ? e.message : 'Could not close the departure.',
                    ),
            },
        );
    }

    function handleReopen() {
        if (!closure) return;
        removeException.mutate(
            { tripId: dep.tourId, exceptionId: closure.id },
            {
                onSuccess: () =>
                    toast.success(
                        `Reopened ${dep.tourName} · ${dep.startTime}. New sales are running again. Reopening is logged too.`,
                    ),
                onError: (e) =>
                    toast.error(
                        e instanceof Error ? e.message : 'Could not reopen the departure.',
                    ),
            },
        );
    }

    const busy = createException.isPending || removeException.isPending;
    const closedByPlatform = closure?.createdBySide === 'PLATFORM';
    const closerName =
        closure?.createdByName ??
        (closedByPlatform ? 'Island Tours' : 'your team');

    return (
        <div className='p-4'>
            <PopoverCloseButton />
            {/* The X owns the right 42px of the card; pr-8 on top of the
                wrapper's p-4 keeps the state pill clear of it. */}
            <div className='flex items-start justify-between gap-3 pr-8'>
                <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>{dep.tourName}</p>
                    {operatorName && (
                        <p className='truncate text-xs text-muted-foreground'>
                            {operatorName}
                        </p>
                    )}
                    <p className='mt-0.5 text-xs text-muted-foreground'>
                        {dayLabel} · {dep.startTime}
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
            </div>

            <p className='mt-3 text-sm'>
                {dep.pricingModel === 'UNIT'
                    ? dep.bookedCount > 0
                        ? `Booked - private hire, ${dep.bookedCount} ${dep.bookedCount === 1 ? 'guest' : 'guests'}`
                        : `Whole ${unitNoun(meta.wholeUnitType)}, one group takes it all`
                    : `${dep.bookedCount} of ${dep.capacity} seats booked`}
            </p>

            {derivedSoldOut && (
                <p className='mt-1.5 text-xs text-muted-foreground'>
                    Sold out from bookings. It reopens by itself if a spot
                    frees up, through a cancellation or a capacity raise. No
                    action needed.
                </p>
            )}

            {closure && (
                <div className='mt-1.5 space-y-1 text-xs text-muted-foreground'>
                    <p>
                        {/* The reason leads: it is what a traveller is being
                            told. A row without one says so - quietly, because
                            every closure written before the reason question
                            shipped lacks one, and a wall of red on day one
                            would read as breakage rather than old data. */}
                        <span
                            className={cn(
                                'font-medium',
                                closure.closureReason && 'text-foreground',
                            )}>
                            {closure.closureReason
                                ? CLOSURE_REASON_LABEL[closure.closureReason]
                                : 'No reason recorded'}
                        </span>
                        {closure.note ? ` · "${closure.note}"` : ''}
                    </p>
                    <p>
                        By {closerName}
                        {closedByPlatform && closure.createdByName
                            ? ' (Island Tours)'
                            : ''}{' '}
                        {/* Island clock, not the viewer's (E.9 one-clock rule)
                            - this line must agree with the register. */}
                        · {islandTime(closure.createdAt, meta.timeZone)}
                    </p>
                    {closedByPlatform && (
                        <p>
                            Island Tours closed this departure, and you can
                            reopen it - a close is an availability action, not
                            an enforcement one.
                        </p>
                    )}
                    {!closure.closureReason && (
                        <p>
                            Closed before the reason question existed, so
                            travellers see a plain &quot;Closed&quot;.
                        </p>
                    )}
                </div>
            )}

            <div className='mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3'>
                <div className='flex items-center gap-3'>
                    <Link
                        href={`/bookings?tourId=${dep.tourId}&from=${dep.date}&to=${dep.date}`}
                        className='text-xs font-medium text-primary hover:underline'>
                        Bookings
                    </Link>
                    <Link
                        href={`/trips/${dep.tourId}/edit?step=schedule&date=${dep.date}`}
                        className='text-xs font-medium text-primary hover:underline'>
                        Timetable
                    </Link>
                </div>
                {canStopSell &&
                    state !== 'past' &&
                    // Cancelled moves money and is an Island Tours act in v1 -
                    // this surface offers it no self-serve action.
                    state !== 'cancelled' &&
                    !derivedSoldOut &&
                    !reasonOpen &&
                    (closure ? (
                        <Button
                            size='sm'
                            className='h-8'
                            disabled={busy}
                            onClick={handleReopen}>
                            Reopen
                        </Button>
                    ) : (
                        /* Says what it does, not "Close" (pastel 9): the X
                           above is how the panel goes away, and the two must
                           never be confusable - one of them stops sales. */
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            title='Stops new sales for this departure only - booked guests keep their bookings'
                            disabled={busy}
                            onClick={() => {
                                // Fresh panel every time - a note abandoned on
                                // an earlier Cancel must never ride along.
                                setNote('');
                                setError(null);
                                setReasonOpen(true);
                            }}>
                            Stop sales
                        </Button>
                    ))}
            </div>

            {/* The close question (MCK-16 change 1): the reason IS the commit,
                same panel, same words as the wizard's Schedule calendar. */}
            {reasonOpen && (
                <div className='mt-3'>
                    <ClosureReasonPanel
                        question={`Why are you closing the ${dep.startTime} departure?`}
                        reassurance={closureReassurance(dep.bookedCount)}
                        note={note}
                        onNoteChange={setNote}
                        busy={busy}
                        pending={createException.isPending}
                        error={error}
                        onCommit={handleClose}
                        onCancel={() => {
                            setReasonOpen(false);
                            setNote('');
                            setError(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
