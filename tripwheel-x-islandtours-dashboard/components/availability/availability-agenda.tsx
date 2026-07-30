'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useAgenda,
    useCloseAgendaDay,
    useConfirmAvailability,
    useCreateException,
    useRemoveException,
    useReopenRange,
} from '@/hooks/trips/use-trips';
import { cn } from '@/lib/utils';
import type { AgendaDeparture } from '@/types/trip';

/**
 * Surface B (availability review §3.3, matrix v1.6): the daily habit. One
 * operator, ALL tours, one chronological list - what runs, how full it is,
 * and can I stop or confirm it in one tap. A three-tour operator on a stormy
 * morning closes the day HERE, never in three tour editors.
 *
 * Thumb-first: every action is a >=44px target, nothing depends on hover,
 * and the deep detail (capacity, patterns, one-off additions) deliberately
 * lives on the tour's own Schedules step - a row links there.
 */

function dayHeading(date: string, todayKey: string): string {
    if (date === todayKey) return 'Today';
    const parsed = new Date(`${date}T00:00:00`);
    const tomorrow = new Date(`${todayKey}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (format(tomorrow, 'yyyy-MM-dd') === date) return 'Tomorrow';
    return format(parsed, 'EEEE d MMM');
}

export function AvailabilityAgenda() {
    // Forward paging grows the same window (7 → 14 → 21 → 28, the API cap).
    const [days, setDays] = useState(7);
    const [tourFilter, setTourFilter] = useState<string | null>(null);
    const { data, isLoading, isFetching } = useAgenda(undefined, days);

    const { mutate: confirmAvailability, isPending: isConfirming } =
        useConfirmAvailability();
    const { mutate: closeAgendaDay, isPending: isClosingDay } =
        useCloseAgendaDay();
    const { mutate: createException, isPending: isWriting } =
        useCreateException();
    const { mutate: removeException, isPending: isRemoving } =
        useRemoveException();
    const { mutateAsync: reopenRangeAsync } = useReopenRange();

    // Dev spec §6.4: visiting the surface stamps availability_confirmed_at.
    // The card below stays the explicit habit anchor the nudges point at.
    useEffect(() => {
        confirmAvailability(undefined);
    }, [confirmAvailability]);
    const [confirmedNow, setConfirmedNow] = useState<string | null>(null);

    const [closeDayOpen, setCloseDayOpen] = useState(false);
    const [closeDayNote, setCloseDayNote] = useState('');

    const busy = isWriting || isRemoving || isClosingDay;
    const todayKey = data?.days[0]?.date ?? format(new Date(), 'yyyy-MM-dd');
    const multiTour = (data?.tours.length ?? 0) > 1;
    const filterName = data?.tours.find(t => t.id === tourFilter)?.name;

    const visibleRows = (rows: AgendaDeparture[]) =>
        tourFilter ? rows.filter(r => r.tourId === tourFilter) : rows;

    // What "Close all of today" will actually touch - stated in the dialog.
    const todayRows = visibleRows(data?.days[0]?.departures ?? []);
    const todayOpenRows = todayRows.filter(
        r => r.status === 'OPEN' || r.status === 'SOLD_OUT'
    );
    const todayBooked = todayRows.reduce((sum, r) => sum + r.bookedCount, 0);
    const todayTourCount = new Set(todayOpenRows.map(r => r.tourId)).size;

    function closeToday() {
        const date = todayKey;
        closeAgendaDay(
            {
                date,
                tourId: tourFilter ?? undefined,
                note: closeDayNote.trim() || undefined,
            },
            {
                onSuccess: ({ closed, tourIds }) => {
                    setCloseDayOpen(false);
                    setCloseDayNote('');
                    toast.success(
                        closed > 0
                            ? `Closed today across ${closed} tour${closed === 1 ? '' : 's'}. New sales stopped; booked guests keep their bookings.`
                            : 'Today was already closed.',
                        closed > 0
                            ? {
                                  action: {
                                      label: 'Undo',
                                      // The exact set the close touched - never
                                      // pre-existing closures. Fan-out with a
                                      // verdict: a partial reopen must never
                                      // pass as silence.
                                      onClick: () =>
                                          void Promise.allSettled(
                                              tourIds.map(tripId =>
                                                  reopenRangeAsync({
                                                      tripId,
                                                      payload: {
                                                          from: date,
                                                          to: date,
                                                      },
                                                  })
                                              )
                                          ).then(results => {
                                              const failed = results.filter(
                                                  r =>
                                                      r.status === 'rejected'
                                              ).length;
                                              if (failed === 0) {
                                                  toast.success(
                                                      'Reopened today.'
                                                  );
                                              } else {
                                                  toast.error(
                                                      `Reopened ${results.length - failed} of ${results.length} tours - ${failed} failed. Check the closed rows and retry.`
                                                  );
                                              }
                                          }),
                                  },
                              }
                            : undefined
                    );
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to close the day.'
                    ),
            }
        );
    }

    function closeRow(row: AgendaDeparture) {
        createException(
            {
                tripId: row.tourId,
                payload: {
                    date: row.date,
                    type: 'CLOSE_SLOT',
                    startTime: row.startTime,
                },
            },
            {
                onSuccess: () =>
                    toast.success(
                        `Closed the ${row.startTime} ${row.tourName} departure.`
                    ),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to close.'
                    ),
            }
        );
    }

    function reopenRow(row: AgendaDeparture) {
        if (!row.closure) return;
        removeException(
            { tripId: row.tourId, exceptionId: row.closure.id },
            {
                onSuccess: () =>
                    toast.success(
                        `Reopened the ${row.startTime} ${row.tourName} departure.`
                    ),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to reopen.'
                    ),
            }
        );
    }

    if (isLoading) {
        return (
            <div className='space-y-3'>
                <Skeleton className='h-16 w-full rounded-lg' />
                <Skeleton className='h-64 w-full rounded-lg' />
            </div>
        );
    }

    if (!data || data.tours.length === 0) {
        return (
            <p className='py-12 text-center text-sm text-muted-foreground'>
                No tours yet. Availability appears here once your first tour
                has a schedule.
            </p>
        );
    }

    return (
        <div className='space-y-4'>
            {/* Freshness card (F14): the habit anchor. */}
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3'>
                <div>
                    <p className='text-sm font-medium'>
                        Confirm today&apos;s availability
                    </p>
                    <p className='text-xs text-muted-foreground'>
                        {confirmedNow
                            ? `Confirmed · today ${format(new Date(confirmedNow), 'HH:mm')} ✓`
                            : data.lastConfirmedAt
                              ? `Last confirmed ${format(new Date(data.lastConfirmedAt), 'EEE d MMM, HH:mm')}`
                              : 'Not confirmed yet'}
                    </p>
                </div>
                <Button
                    size='sm'
                    className='h-9'
                    disabled={isConfirming || !!confirmedNow}
                    onClick={() =>
                        confirmAvailability(undefined, {
                            onSuccess: res =>
                                setConfirmedNow(res.confirmedAt),
                        })
                    }>
                    {isConfirming && (
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                        />
                    )}
                    {confirmedNow ? 'Confirmed ✓' : 'Confirm'}
                </Button>
            </div>

            {/* Tour filter - multi-tour operators only (matrix v1.6). A few
                tours read fine as chips; a fleet of sixteen truncated pills
                wrapped into an unreadable band, so larger sets collapse into
                one Select. */}
            {multiTour &&
                (data.tours.length > 6 ? (
                    <Select
                        value={tourFilter ?? 'all'}
                        onValueChange={v =>
                            setTourFilter(v === 'all' ? null : v)
                        }>
                        <SelectTrigger className='w-full sm:w-72'>
                            <SelectValue placeholder='All tours' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>
                                All tours ({data.tours.length})
                            </SelectItem>
                            {data.tours.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className='flex flex-wrap items-center gap-1.5'>
                        <button
                            type='button'
                            onClick={() => setTourFilter(null)}
                            className={cn(
                                'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                                tourFilter === null
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-input hover:bg-muted'
                            )}>
                            All tours
                        </button>
                        {data.tours.map(t => (
                            <button
                                key={t.id}
                                type='button'
                                onClick={() =>
                                    setTourFilter(cur =>
                                        cur === t.id ? null : t.id
                                    )
                                }
                                className={cn(
                                    'h-8 max-w-48 truncate rounded-full border px-3 text-xs font-medium transition-colors',
                                    tourFilter === t.id
                                        ? 'border-foreground bg-foreground text-background'
                                        : 'border-input hover:bg-muted'
                                )}>
                                {t.name}
                            </button>
                        ))}
                    </div>
                ))}

            {/* The list: one row per departure, chronological across tours. */}
            <div className='space-y-6'>
                {data.days.map(d => {
                    const rows = visibleRows(d.departures);
                    return (
                        <section key={d.date}>
                            <div className='mb-1.5 flex flex-wrap items-center justify-between gap-2'>
                                <h2 className='flex items-baseline gap-2 text-sm font-medium'>
                                    {dayHeading(d.date, todayKey)}
                                    <span className='text-xs font-normal text-muted-foreground'>
                                        {format(
                                            new Date(`${d.date}T00:00:00`),
                                            'd MMM'
                                        )}
                                    </span>
                                    {isFetching && d.date === todayKey && (
                                        <HugeiconsIcon
                                            icon={Loading03Icon}
                                            className='size-3 animate-spin text-muted-foreground'
                                        />
                                    )}
                                </h2>
                                {/* The weather-day action lives WITH the day it
                                    acts on, not floating above the page. */}
                                {d.date === todayKey &&
                                    todayOpenRows.length > 0 && (
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            className='h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                                            disabled={busy}
                                            onClick={() =>
                                                setCloseDayOpen(true)
                                            }>
                                            {filterName
                                                ? `Close today · ${filterName}`
                                                : 'Close all of today'}
                                        </Button>
                                    )}
                            </div>
                            {rows.length === 0 ? (
                                <p className='rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'>
                                    No departures.
                                </p>
                            ) : (
                                <div className='divide-y rounded-lg border'>
                                    {rows.map(row => (
                                        <AgendaRow
                                            key={row.id}
                                            row={row}
                                            busy={busy}
                                            onClose={() => closeRow(row)}
                                            onReopen={() => reopenRow(row)}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            {days < 28 && (
                <Button
                    variant='ghost'
                    className='h-10 w-full text-muted-foreground'
                    disabled={isFetching}
                    onClick={() => setDays(d => Math.min(d + 7, 28))}>
                    Load more days
                </Button>
            )}

            {/* One-line channel explainer (review §3.4, counts contract). */}
            <p className='text-xs text-muted-foreground'>
                Counts show Island Tours bookings only. Full through another
                channel? Close the departure.
            </p>

            <Dialog open={closeDayOpen} onOpenChange={setCloseDayOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            {filterName
                                ? `Close today for ${filterName}?`
                                : 'Close all of today?'}
                        </DialogTitle>
                        <DialogDescription>
                            Stops new sales on {todayOpenRows.length} departure
                            {todayOpenRows.length === 1 ? '' : 's'}
                            {!filterName &&
                                todayTourCount > 1 &&
                                ` across ${todayTourCount} tours`}
                            .{' '}
                            {todayBooked > 0 &&
                                `${todayBooked} booked guest${todayBooked === 1 ? '' : 's'} keep their bookings. Guests are not notified - contact booked guests yourself if the day will not run.`}
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={closeDayNote}
                        onChange={e => setCloseDayNote(e.target.value)}
                        placeholder='Reason (optional), e.g. Weather'
                        maxLength={500}
                    />
                    <DialogFooter>
                        <Button
                            variant='ghost'
                            onClick={() => setCloseDayOpen(false)}
                            disabled={isClosingDay}>
                            Cancel
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={closeToday}
                            disabled={isClosingDay}>
                            {isClosingDay && (
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className='size-4 animate-spin'
                                />
                            )}
                            Close today
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── One departure row ─────────────────────────────────────────────────────────

interface AgendaRowProps {
    row: AgendaDeparture;
    busy: boolean;
    onClose: () => void;
    onReopen: () => void;
}

function AgendaRow({ row, busy, onClose, onReopen }: AgendaRowProps) {
    const isUnit = row.pricingModel === 'UNIT';
    // A row that reads CLOSED with no closure behind it and a passed cutoff is
    // not closed at all - the boat simply left. Rendering it as "Closed"
    // turned every afternoon's list into a wall of struck-through alarm.
    const departed =
        row.cutoffPassed && !row.closure && row.status === 'CLOSED';
    const manuallyClosed = row.status === 'CLOSED' && !departed;

    // How full is it, in words a dock reads at a glance: nothing booked leads
    // with what is LEFT ("40 seats open"), a filling boat with the fraction.
    const seatText = isUnit
        ? row.bookedCount > 0
            ? `${row.bookedCount} guest${row.bookedCount === 1 ? '' : 's'}`
            : departed || manuallyClosed
              ? ''
              : 'Open · private charter'
        : row.bookedCount === 0
          ? departed || manuallyClosed
              ? ''
              : `${row.capacity} seats open`
          : `${row.bookedCount}/${row.capacity} booked`;

    // time first (sorts by "what leaves next"), tour second, fullness third,
    // state chip, ONE action (§3.3 row anatomy).
    return (
        <div
            className={cn(
                'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2',
                departed && 'opacity-50'
            )}>
            {/* State dot: the list scans by colour before it reads by word. */}
            <span
                aria-hidden
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    row.status === 'OPEN' && 'bg-success-solid',
                    row.status === 'SOLD_OUT' && 'bg-info-solid',
                    manuallyClosed && 'bg-destructive/60',
                    (departed || row.status === 'CANCELLED') &&
                        'bg-foreground/25'
                )}
            />
            <span
                className={cn(
                    'text-sm font-medium tabular-nums',
                    manuallyClosed && 'text-muted-foreground line-through',
                    departed && 'text-muted-foreground'
                )}>
                {row.startTime}
            </span>
            <Link
                href={`/trips/${row.tourId}/edit?step=schedule`}
                className='min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline'>
                {row.tourName}
            </Link>
            {seatText && (
                <span className='text-xs tabular-nums text-muted-foreground'>
                    {seatText}
                </span>
            )}
            {departed ? (
                <span className='text-xs text-muted-foreground'>Departed</span>
            ) : row.status === 'SOLD_OUT' ? (
                // Automatic and celebratory - no action needed (§3.5).
                <span className='rounded-sm bg-info-subtle px-1.5 py-0.5 text-2xs font-medium text-info-fg'>
                    Sold out
                </span>
            ) : row.status === 'CANCELLED' ? (
                <span className='rounded-sm bg-destructive/10 px-1.5 py-0.5 text-2xs font-medium text-destructive'>
                    Cancelled
                </span>
            ) : manuallyClosed ? (
                <>
                    <span className='text-xs text-muted-foreground'>
                        {row.closure
                            ? `Closed by ${row.closure.createdByName ?? 'your team'}, ${format(new Date(row.closure.createdAt), 'HH:mm')}${row.closure.note ? ` · ${row.closure.note}` : ''}`
                            : 'Closed'}
                    </span>
                    {row.closure && (
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-9 px-3 text-xs'
                            disabled={busy}
                            onClick={onReopen}>
                            Reopen
                        </Button>
                    )}
                </>
            ) : (
                <Button
                    size='sm'
                    variant='ghost'
                    className='h-9 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive'
                    disabled={busy}
                    onClick={onClose}>
                    Close
                </Button>
            )}
        </div>
    );
}
