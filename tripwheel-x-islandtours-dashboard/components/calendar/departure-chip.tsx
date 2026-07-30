'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useRole } from '@/contexts/role-context';
import {
    useCreateException,
    useRemoveException,
    useUpdateDeparture,
} from '@/hooks/trips/use-trips';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { OverviewDeparture } from '@/types/trip';
import {
    CHIP_CLASS,
    DOT_CLASS,
    STATE_LABEL,
    chipState,
    keyToDate,
    seatsLabel,
} from './calendar-utils';

/**
 * One departure as a calendar event chip. Click opens the management card:
 * status + seats + audit line, stop-sell/reopen, capacity edit, and the two
 * deep links (bookings pre-filtered to this tour + day, the tour timetable).
 *
 * The stop-sell rules mirror the backend split: close/reopen ride
 * MANAGE_AVAILABILITY OR STOP_SELL (the route guard), capacity edits are
 * MANAGE_AVAILABILITY only (assertCanShapeInventory) - the card hides what
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
                        CHIP_CLASS[state],
                        state === 'past' && 'opacity-70',
                        className,
                    )}>
                    {variant === 'row' ? (
                        <>
                            <span className='shrink-0 font-medium tabular-nums'>
                                {dep.startTime}
                            </span>
                            <span className='min-w-0 flex-1 truncate'>
                                {dep.tourName}
                            </span>
                            <span className='shrink-0 tabular-nums text-2xs'>
                                {seatsLabel(dep)}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className='w-full truncate font-medium'>
                                {dep.tourName}
                            </span>
                            <span className='tabular-nums text-2xs'>
                                {dep.startTime} · {seatsLabel(dep)}
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
    const { can, canAny } = useRole();
    const canStopSell = canAny(['MANAGE_AVAILABILITY', 'STOP_SELL']);
    const canShape = can('MANAGE_AVAILABILITY');
    const state = chipState(dep);

    const createException = useCreateException();
    const removeException = useRemoveException();
    const updateDeparture = useUpdateDeparture();

    const [capacity, setCapacity] = useState(String(dep.capacity));
    const capacityValue = Number(capacity);
    const capacityChanged =
        Number.isInteger(capacityValue) && capacityValue !== dep.capacity;
    const capacityTooLow =
        Number.isInteger(capacityValue) && capacityValue < dep.bookedCount;

    const dayLabel = format(keyToDate(dep.date), 'EEE d MMM yyyy');

    function handleClose() {
        createException.mutate(
            {
                tripId: dep.tourId,
                payload: {
                    date: dep.date,
                    type: 'CLOSE_SLOT',
                    startTime: dep.startTime,
                },
            },
            {
                onSuccess: (row) => {
                    toast.success(
                        `Closed ${dep.tourName} · ${dep.startTime}. Booked guests keep their bookings.`,
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
                    toast.error(
                        e instanceof Error ? e.message : 'Could not close the departure.',
                    ),
            },
        );
    }

    function handleReopen() {
        if (!dep.closure) return;
        removeException.mutate(
            { tripId: dep.tourId, exceptionId: dep.closure.id },
            {
                onSuccess: () =>
                    toast.success(
                        `Reopened ${dep.tourName} · ${dep.startTime}. New sales are running again.`,
                    ),
                onError: (e) =>
                    toast.error(
                        e instanceof Error ? e.message : 'Could not reopen the departure.',
                    ),
            },
        );
    }

    function handleCapacitySave() {
        if (!capacityChanged || capacityTooLow) return;
        updateDeparture.mutate(
            {
                tripId: dep.tourId,
                departureId: dep.id,
                payload: { capacity: capacityValue },
            },
            {
                onSuccess: () =>
                    toast.success(`Capacity set to ${capacityValue} seats.`),
                onError: (e) =>
                    toast.error(
                        e instanceof Error
                            ? e.message
                            : 'Could not change the capacity.',
                    ),
            },
        );
    }

    const busy =
        createException.isPending ||
        removeException.isPending ||
        updateDeparture.isPending;

    return (
        <div className='p-4'>
            <div className='flex items-start justify-between gap-3'>
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
                        className={cn('size-1.5 rounded-full', DOT_CLASS[state])}
                    />
                    {/* Neutral badge - the closer might be a teammate or (for
                        admins) another operator; the audit line below names
                        them. "Closed by you" stays a legend-only phrase. */}
                    {state === 'closed' ? 'Closed' : STATE_LABEL[state]}
                </span>
            </div>

            <p className='mt-3 text-sm'>
                {dep.pricingModel === 'UNIT'
                    ? dep.bookedCount > 0
                        ? `Booked - private hire, ${dep.bookedCount} ${dep.bookedCount === 1 ? 'guest' : 'guests'}`
                        : 'Free - whole unit, one group takes it all'
                    : `${dep.bookedCount} of ${dep.capacity} seats booked`}
            </p>

            {dep.closure && (
                <p className='mt-1.5 text-xs text-muted-foreground'>
                    Closed
                    {dep.closure.createdByName
                        ? ` by ${dep.closure.createdByName}`
                        : ''}{' '}
                    · {format(new Date(dep.closure.createdAt), 'd MMM, HH:mm')}
                    {dep.closure.note ? ` · "${dep.closure.note}"` : ''}
                </p>
            )}

            {/* Capacity edit - inventory shaping, so MANAGE_AVAILABILITY only.
                Unit charters have no seat math to edit. */}
            {canShape && dep.pricingModel !== 'UNIT' && state !== 'past' && (
                <div className='mt-3 flex items-center gap-2'>
                    <Input
                        type='number'
                        min={dep.bookedCount}
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        aria-label='Capacity'
                        aria-invalid={capacityTooLow || undefined}
                        className='h-8 w-20 text-sm'
                    />
                    <span className='text-xs text-muted-foreground'>seats</span>
                    {capacityChanged && (
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-8'
                            disabled={busy || capacityTooLow}
                            onClick={handleCapacitySave}>
                            Save
                        </Button>
                    )}
                    {capacityTooLow && (
                        <span className='text-xs text-destructive'>
                            {dep.bookedCount} already booked
                        </span>
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
                    (dep.closure ? (
                        <Button
                            size='sm'
                            className='h-8'
                            disabled={busy}
                            onClick={handleReopen}>
                            Reopen
                        </Button>
                    ) : (
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            title='Stops new sales for this departure only - booked guests keep their bookings'
                            disabled={busy}
                            onClick={handleClose}>
                            Close
                        </Button>
                    ))}
            </div>
        </div>
    );
}
