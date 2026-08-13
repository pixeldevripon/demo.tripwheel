'use client';

import { ArrowDown01Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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
import {
    CLOSURE_REASON_LABEL,
    ClosureReasonPanel,
    ClosureReasonTabs,
} from '@/components/common/closure-reason-panel';
import { springPop } from '@/lib/motion';
import { islandTime } from '@/lib/island-time';
import { cn } from '@/lib/utils';
import type { AgendaDeparture, TourClosureReason } from '@/types/trip';

/**
 * Surface B (availability review §3.3, matrix v1.6): the daily habit. One
 * operator, ALL tours, one chronological list - what runs, how full it is,
 * and can I stop or confirm it in one tap. A three-tour operator on a stormy
 * morning closes the day HERE, never in three tour editors.
 *
 * Thumb-first: every action is a >=44px target, nothing depends on hover,
 * and the deep detail (capacity, patterns, one-off additions) deliberately
 * lives on the tour's own Schedules step - a row links there, carrying its
 * date so the calendar opens on the exact day.
 */

function dayHeading(date: string, todayKey: string): string {
    if (date === todayKey) return 'Today';
    const tomorrow = new Date(`${todayKey}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (format(tomorrow, 'yyyy-MM-dd') === date) return 'Tomorrow';
    return format(new Date(`${date}T00:00:00`), 'EEEE');
}

// ── Date picker: the plain shadcn Calendar in a popover, nothing more ───────

interface AgendaDatePickerProps {
    todayKey: string;
    selected: string;
    onSelect: (date: string) => void;
}

/**
 * The agenda's date control, kept deliberately simple after two fancier
 * attempts (a 365-day scroll rail, then a week strip with paging) both read
 * as clutter: one bordered trigger showing the selected day, opening the
 * plain shadcn Calendar over the 12-month horizon - the same pattern as the
 * tour calendar's month-jump.
 */
function AgendaDatePicker({
    todayKey,
    selected,
    onSelect,
}: AgendaDatePickerProps) {
    const [jumpOpen, setJumpOpen] = useState(false);

    // Bounds: today through today+364, the materialization horizon (E.9).
    const today = new Date(`${todayKey}T00:00:00`);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 364);
    const selectedDate = new Date(`${selected}T00:00:00`);

    return (
        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
            <PopoverTrigger asChild>
                <button
                    type='button'
                    aria-label='Pick a date'
                    // h-10 + px-3: the SelectTrigger's default size, so the
                    // date and tour controls sit as one matched pair.
                    className='flex h-10 min-w-36 items-center justify-between gap-2 rounded-md border border-input bg-surface-raised px-3 text-sm font-medium tabular-nums shadow-xs transition-[color,border-color,box-shadow] outline-none hover:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25'>
                    <span>
                        {selected === todayKey
                            ? `Today · ${format(selectedDate, 'd MMM')}`
                            : format(selectedDate, 'EEE d MMM yyyy')}
                    </span>
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className='size-3.5 shrink-0 text-muted-foreground'
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-auto p-0'>
                <Calendar
                    mode='single'
                    selected={selectedDate}
                    onSelect={date => {
                        if (!date) return;
                        onSelect(format(date, 'yyyy-MM-dd'));
                        setJumpOpen(false);
                    }}
                    defaultMonth={selectedDate}
                    disabled={{ before: today, after: horizon }}
                    captionLayout='dropdown'
                    autoFocus
                />
                <p className='px-3 pb-2 text-2xs text-muted-foreground'>
                    The agenda covers 12 months ahead.
                </p>
            </PopoverContent>
        </Popover>
    );
}

export function AvailabilityAgenda() {
    // Forward paging grows the same window (7 → 14 → 21 → 28, the API cap).
    const [days, setDays] = useState(7);
    // Where the window starts: null = the island's today (the default view);
    // a date = the rail moved the window there.
    const [from, setFrom] = useState<string | null>(null);
    const [tourFilter, setTourFilter] = useState<string | null>(null);
    const { data, isLoading, isFetching } = useAgenda(from ?? undefined, days);
    const reduceMotion = useReducedMotion();

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
    // Default Not running: closing a whole day is almost always a not-running
    // act; weather is Not running plus a note (MCK-15 reason map).
    const [closeDayReason, setCloseDayReason] =
        useState<TourClosureReason>('NOT_RUNNING');
    // The one row a Close tap is asking the reason question about (MCK-16
    // change 1: the reason IS the commit, on every surface that closes).
    // Only the ID is stored - the row itself is re-derived from live data
    // each render, so a background refetch that closes/sells the departure
    // under the open dialog dismisses it instead of committing against
    // vanished state (the DayPopover panelStale convention).
    const [closeSlotId, setCloseSlotId] = useState<string | null>(null);
    const [closeSlotNote, setCloseSlotNote] = useState('');

    // Week-strip selection + collapsible day groups (both default to open /
    // today). Selecting a day scrolls to its group and force-opens it.
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
        () => new Set()
    );
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    const busy = isWriting || isRemoving || isClosingDay;
    // Re-derived from live data each render: a refetch that closed, filled or
    // dropped the row while the reason dialog was open makes the target null
    // and the dialog dismisses, instead of committing against vanished state.
    const closeSlotTarget = closeSlotId
        ? (data?.days
              .flatMap(d => d.departures)
              .find(r => r.id === closeSlotId && r.status === 'OPEN') ?? null)
        : null;
    // Island zone per tour (E.9 one-clock rule); optional while the backend
    // deploy catches up - islandTime falls back to the platform home zone.
    const tourZoneById = new Map(
        (data?.tours ?? [])
            .filter(t => !!t.timeZone)
            .map(t => [t.id, t.timeZone as string]),
    );
    // The island's REAL today - captured from the default (from=null) window,
    // whose first day the backend anchors on the island clock. It must
    // survive the rail moving the window into the future, or "Today"/"Close
    // all of today" would follow the window instead of the clock.
    const [islandToday, setIslandToday] = useState<string | null>(null);
    useEffect(() => {
        if (from === null && data?.days[0]?.date) {
            setIslandToday(data.days[0].date);
        }
    }, [from, data]);
    const todayKey =
        islandToday ?? data?.days[0]?.date ?? format(new Date(), 'yyyy-MM-dd');
    const multiTour = (data?.tours.length ?? 0) > 1;
    const filterName = data?.tours.find(t => t.id === tourFilter)?.name;

    const visibleRows = (rows: AgendaDeparture[]) =>
        tourFilter ? rows.filter(r => r.tourId === tourFilter) : rows;

    // What "Close all of today" will actually touch - stated in the dialog.
    // Looked up by DATE, not position: with the window moved ahead, the real
    // today may not be days[0] - or not be in the window at all.
    const todayGroup = data?.days.find(d => d.date === todayKey);
    const todayRows = visibleRows(todayGroup?.departures ?? []);
    const todayOpenRows = todayRows.filter(
        r => r.status === 'OPEN' || r.status === 'SOLD_OUT'
    );
    const todayBooked = todayRows.reduce((sum, r) => sum + r.bookedCount, 0);
    const todayTourCount = new Set(todayOpenRows.map(r => r.tourId)).size;

    function jumpToDay(date: string) {
        setSelectedDay(date);
        const windowStart = data?.days[0]?.date;
        const windowEnd = data?.days[data.days.length - 1]?.date;
        if (
            windowStart &&
            windowEnd &&
            date >= windowStart &&
            date <= windowEnd
        ) {
            // Already loaded: just open and scroll to that day's group.
            setCollapsedDays(prev => {
                if (!prev.has(date)) return prev;
                const next = new Set(prev);
                next.delete(date);
                return next;
            });
            sectionRefs.current[date]?.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start',
            });
            return;
        }
        // Outside the loaded window: move the window there (and back to the
        // default view when the pick is today itself). The previous list
        // stays on screen while the new window loads (placeholderData).
        setFrom(date === todayKey ? null : date);
        setDays(7);
    }

    function toggleDay(date: string) {
        setCollapsedDays(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    }

    function closeToday() {
        const date = todayKey;
        closeAgendaDay(
            {
                date,
                tourId: tourFilter ?? undefined,
                note: closeDayNote.trim() || undefined,
                closureReason: closeDayReason,
            },
            {
                onSuccess: ({ closed, tourIds }) => {
                    setCloseDayOpen(false);
                    setCloseDayNote('');
                    setCloseDayReason('NOT_RUNNING');
                    toast.success(
                        closed > 0
                            ? `Closed today across ${closed} tour${closed === 1 ? '' : 's'} · ${CLOSURE_REASON_LABEL[closeDayReason]}. New sales stopped; booked guests keep their bookings.`
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

    function closeRow(row: AgendaDeparture, closureReason: TourClosureReason) {
        createException(
            {
                tripId: row.tourId,
                payload: {
                    date: row.date,
                    type: 'CLOSE_SLOT',
                    startTime: row.startTime,
                    closureReason,
                    note: closeSlotNote.trim() || undefined,
                },
            },
            {
                onSuccess: () => {
                    setCloseSlotId(null);
                    setCloseSlotNote('');
                    toast.success(
                        `Closed the ${row.startTime} ${row.tourName} departure · ${CLOSURE_REASON_LABEL[closureReason]}. New sales stopped; booked guests keep their bookings.`
                    );
                },
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
            {/* Times are per tour's island; today's island date anchors it. */}
            <p className='text-xs text-muted-foreground'>
                All times are local to each tour&apos;s island ·{' '}
                {format(new Date(`${todayKey}T00:00:00`), 'EEE d MMM')}
            </p>

            {/* Freshness card (F14): the habit anchor. Confirming is a
                statement, not a change - the copy says so, because a button
                whose effect is unknown never gets pressed. */}
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3'>
                <div className='min-w-0'>
                    <p className='text-sm font-medium'>
                        Confirm today&apos;s availability
                    </p>
                    <p className='text-xs text-muted-foreground'>
                        Checked the list and it matches reality? Confirm to
                        stamp it fresh - nothing else changes.
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>
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

            {/* One control row: date picker then tour filter left, colour
                legend right. The filter is multi-tour operators only (matrix
                v1.6) - a few tours read fine as chips; a fleet of sixteen
                truncated pills wrapped into an unreadable band, so larger
                sets collapse into one Select. */}
            <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
                <AgendaDatePicker
                    todayKey={todayKey}
                    selected={selectedDay ?? todayKey}
                    onSelect={jumpToDay}
                />
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

                {/* Colour legend - same vocabulary as the tour calendar's,
                    named before the colours are met in the list below. */}
                <div className='ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground'>
                    <span className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full bg-success-solid' />
                        open
                    </span>
                    <span className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full bg-info-solid' />
                        sold out
                    </span>
                    <span className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full bg-destructive/60' />
                        closed by you
                    </span>
                    <span className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full bg-foreground/25' />
                        departed or cancelled
                    </span>
                </div>
            </div>

            {/* The list: day groups (collapsible, open by default), one card
                per departure, chronological across tours. */}
            <div className='space-y-6'>
                {data.days.map(d => {
                    const rows = visibleRows(d.departures);
                    const open = !collapsedDays.has(d.date);
                    return (
                        <section
                            key={d.date}
                            ref={el => {
                                sectionRefs.current[d.date] = el;
                            }}
                            className='scroll-mt-4'>
                            <div className='mb-1.5 flex flex-wrap items-center justify-between gap-2'>
                                <button
                                    type='button'
                                    aria-expanded={open}
                                    onClick={() => toggleDay(d.date)}
                                    className='group flex min-h-9 items-center gap-2 rounded-md text-left'>
                                    <h2 className='flex items-baseline gap-2 text-sm font-medium'>
                                        {dayHeading(d.date, todayKey)}
                                        <span className='text-xs font-normal text-muted-foreground'>
                                            {format(
                                                new Date(
                                                    `${d.date}T00:00:00`
                                                ),
                                                'd MMM'
                                            )}
                                        </span>
                                        {!open && rows.length > 0 && (
                                            <span className='text-xs font-normal text-muted-foreground'>
                                                {rows.length} departure
                                                {rows.length === 1 ? '' : 's'}
                                            </span>
                                        )}
                                    </h2>
                                    {isFetching &&
                                        d.date === data.days[0]?.date && (
                                        <HugeiconsIcon
                                            icon={Loading03Icon}
                                            className='size-3 animate-spin text-muted-foreground'
                                        />
                                    )}
                                    <motion.span
                                        animate={{ rotate: open ? 180 : 0 }}
                                        transition={
                                            reduceMotion
                                                ? { duration: 0 }
                                                : springPop
                                        }
                                        className='flex shrink-0'>
                                        <HugeiconsIcon
                                            icon={ArrowDown01Icon}
                                            className='size-3.5 text-muted-foreground'
                                        />
                                    </motion.span>
                                </button>
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
                            <motion.div
                                initial={false}
                                animate={{
                                    height: open ? 'auto' : 0,
                                    opacity: open ? 1 : 0,
                                }}
                                transition={
                                    reduceMotion
                                        ? { duration: 0 }
                                        : {
                                              height: {
                                                  duration: 0.28,
                                                  ease: [0.4, 0, 0.2, 1],
                                              },
                                              opacity: { duration: 0.18 },
                                          }
                                }
                                className='overflow-hidden'
                                inert={!open}
                                aria-hidden={!open}>
                                {rows.length === 0 ? (
                                    <p className='rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'>
                                        No departures.
                                    </p>
                                ) : (
                                    <div className='divide-y overflow-hidden rounded-lg border'>
                                        {rows.map(row => (
                                            <AgendaRow
                                                key={row.id}
                                                row={row}
                                                timeZone={
                                                    tourZoneById.get(
                                                        row.tourId,
                                                    ) ?? undefined
                                                }
                                                busy={busy}
                                                onClose={() =>
                                                    setCloseSlotId(row.id)
                                                }
                                                onReopen={() =>
                                                    reopenRow(row)
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
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

            <Dialog
                open={closeDayOpen}
                onOpenChange={open => {
                    setCloseDayOpen(open);
                    // A note or reason abandoned on Cancel must never ride
                    // along with the NEXT close (the openPanel convention).
                    if (!open) {
                        setCloseDayNote('');
                        setCloseDayReason('NOT_RUNNING');
                    }
                }}>
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
                    {/* The same two answers as every other close (MCK-16
                        change 1). Weather is Not running plus a note. */}
                    <ClosureReasonTabs
                        value={closeDayReason}
                        onValueChange={setCloseDayReason}
                    />
                    <Input
                        value={closeDayNote}
                        onChange={e => setCloseDayNote(e.target.value)}
                        placeholder='Note (optional), e.g. Weather'
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

            {/* The close question for a single row (MCK-16 change 1): the
                reason IS the commit - same shared panel as every close. */}
            <Dialog
                open={closeSlotTarget !== null}
                onOpenChange={open => {
                    if (!open) {
                        setCloseSlotId(null);
                        setCloseSlotNote('');
                    }
                }}>
                <DialogContent className='sm:max-w-sm'>
                    <DialogHeader>
                        <DialogTitle>
                            {closeSlotTarget
                                ? `Close ${closeSlotTarget.startTime} · ${closeSlotTarget.tourName}?`
                                : 'Close departure?'}
                        </DialogTitle>
                    </DialogHeader>
                    {closeSlotTarget && (
                        <ClosureReasonPanel
                            question={`Why are you closing the ${closeSlotTarget.startTime} departure?`}
                            reassurance={
                                closeSlotTarget.bookedCount > 0
                                    ? `${closeSlotTarget.bookedCount} booked guest${closeSlotTarget.bookedCount === 1 ? '' : 's'} keep their booking${closeSlotTarget.bookedCount === 1 ? '' : 's'}. Closing only stops new sales.`
                                    : 'This only stops new sales. Existing bookings are always kept.'
                            }
                            note={closeSlotNote}
                            onNoteChange={setCloseSlotNote}
                            busy={busy}
                            pending={isWriting}
                            onCommit={reason =>
                                closeRow(closeSlotTarget, reason)
                            }
                            onCancel={() => {
                                setCloseSlotId(null);
                                setCloseSlotNote('');
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── One departure row ─────────────────────────────────────────────────────────

interface AgendaRowProps {
    row: AgendaDeparture;
    /** The tour's island zone - audit times render on the ISLAND's clock. */
    timeZone?: string;
    busy: boolean;
    onClose: () => void;
    onReopen: () => void;
}

function AgendaRow({ row, timeZone, busy, onClose, onReopen }: AgendaRowProps) {
    const isUnit = row.pricingModel === 'UNIT';
    // A row that reads CLOSED with no closure behind it and a passed cutoff is
    // not closed at all - the boat simply left. Rendering it as "Closed"
    // turned every afternoon's list into a wall of struck-through alarm.
    const departed =
        row.cutoffPassed && !row.closure && row.status === 'CLOSED';
    const manuallyClosed = row.status === 'CLOSED' && !departed;

    // How full is it, in words a dock reads at a glance: nothing booked leads
    // with what is LEFT ("40 seats open"), a filling boat with the fraction.
    // The fraction is SEATS SOLD (summed across bookings) over capacity -
    // "34/40" is 34 seats taken, never a count of bookings. Private hire is
    // booking-count territory instead: one party takes the whole boat.
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
    // state chip, ONE action (§3.3 row anatomy). The tour name deep-links
    // into the tour's calendar with this date pre-marked.
    return (
        <div
            className={cn(
                'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2',
                // State as a translucent row wash PLUS the dot below: the
                // wash makes the state impossible to miss across a long list,
                // the dot anchors it at the line start.
                row.status === 'OPEN' && 'bg-success-subtle/15',
                row.status === 'SOLD_OUT' && 'bg-info-subtle/60',
                manuallyClosed && 'bg-destructive/5',
                row.status === 'CANCELLED' && 'bg-muted/40',
                departed && 'bg-transparent opacity-50'
            )}>
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
                href={`/trips/${row.tourId}/edit?step=schedule&date=${row.date}`}
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
                // Automatic and celebratory - no action needed (§3.5). Flips
                // back by itself if a spot frees up. Violet, the decided
                // sold-out colour (MCK-16 change 9).
                <span
                    title='Reopens automatically if a spot frees up'
                    className='rounded-sm bg-cal-sold-subtle px-1.5 py-0.5 text-2xs font-medium text-cal-sold-fg'>
                    Sold out
                </span>
            ) : row.status === 'CANCELLED' ? (
                <span className='rounded-sm border border-danger-border px-1.5 py-0.5 text-2xs font-medium text-danger-fg'>
                    Cancelled
                </span>
            ) : manuallyClosed ? (
                <>
                    <span className='text-xs text-muted-foreground'>
                        {row.closure
                            ? // The reason leads (MCK-16 change 5); the side
                              // labels a platform closure (change 10).
                              `${row.closure.closureReason ? `${CLOSURE_REASON_LABEL[row.closure.closureReason]} · ` : ''}Closed by ${
                                  row.closure.createdByName ??
                                  (row.closure.createdBySide === 'PLATFORM'
                                      ? 'Island Tours'
                                      : 'your team')
                              }${
                                  row.closure.createdBySide === 'PLATFORM' &&
                                  row.closure.createdByName
                                      ? ' (Island Tours)'
                                      : ''
                              }, ${islandTime(row.closure.createdAt, timeZone, { day: false })}${row.closure.note ? ` · ${row.closure.note}` : ''}`
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
                    title='Stops new sales for this departure only - booked guests keep their bookings'
                    onClick={onClose}>
                    Close
                </Button>
            )}
        </div>
    );
}
