'use client';

import {
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { DatePickerField } from '@/components/date-picker-field';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useCloseRange,
    useCreateException,
    useManageCalendar,
    useRemoveException,
    useReopenRange,
} from '@/hooks/trips/use-trips';
import { crossFade, swapFade } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type {
    ManageCalendarDay,
    ManageCalendarDayStatus,
    PricingModel,
    TourDeparture,
} from '@/types/trip';
import { addMonths, format, startOfMonth } from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const STATUS_LABEL: Record<ManageCalendarDayStatus, string> = {
    open: 'Open',
    partial: 'Partially closed',
    closed: 'Closed',
    no_service: 'No departures',
};

interface TripAvailabilityCalendarProps {
    tripId: string;
    /** Tour-local IANA zone - "today"/"past" must follow the ISLAND's clock. */
    timeZone: string;
    /** Tour default capacity - NOT NULL, so ADD_SLOT can always omit one. */
    maxPartySize: number;
    /** The tour's declared start times - offered as one-tap chips when adding
      an extra departure (typing stays possible for a brand-new time). */
    declaredStartTimes: string[];
    /** F10: unit-priced charters get Open/Sold out labels, never seat math. */
    pricingModel?: PricingModel;
    /** Drop the Card chrome - the wizard section header names this calendar. */
    bare?: boolean;
    /**
     * Deep link (agenda row → this calendar): jump the grid to this date's
     * month and MARK the date - selection only, the day's action popup stays
     * closed until the operator clicks the cell themselves. Ignored when the
     * date is past or beyond the 12-month horizon.
     */
    initialDate?: string;
}

/** 'YYYY-MM-DD' within [island today, +12 months], else null. */
function normalizeInitialDate(
    initialDate: string | undefined,
    timeZone: string
): string | null {
    if (!initialDate || !/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return null;
    const islandToday = new Intl.DateTimeFormat('en-CA', { timeZone }).format(
        new Date()
    );
    const maxMonth = islandToday
        .slice(0, 7)
        .replace(/^\d{4}/, y => String(+y + 1));
    if (initialDate < islandToday || initialDate.slice(0, 7) > maxMonth)
        return null;
    return initialDate;
}

/**
 * One-tap availability layer over the schedules/exceptions system: a month
 * grid where the daily operational actions (close a day, close a slot, add a
 * departure, change capacity, reopen) are each one or two taps.
 *
 * **Closing is not cancelling.** A close writes a CLOSE_DATE / CLOSE_SLOT
 * exception, the materializer marks the departure CLOSED, and that stops NEW
 * sales only - booked departures keep their capacity, their booked count and
 * every existing booking (`availability-materializer.service.ts`: "CLOSED only
 * stops NEW sales; existing bookings stay"). Cancelling a departure that has
 * bookings is the separate refund-or-rebook flow, admin-executed in v1, and
 * deliberately has no self-serve control here.
 *
 * That distinction is the whole reason this surface exists: an operator who
 * fears close = cancel will not stop-sell, and the platform then sells seats
 * that do not exist. So the panel states the guarantee instead of warning
 * about a consequence that never happens.
 */
export function TripAvailabilityCalendar({
    tripId,
    timeZone,
    maxPartySize,
    declaredStartTimes,
    pricingModel = 'PER_PERSON',
    bare = false,
    initialDate,
}: TripAvailabilityCalendarProps) {
    const isUnit = pricingModel === 'UNIT';
    // Initial month from the ISLAND's clock, not the browser's: an operator
    // ahead of the tour's timezone opening this near their local midnight
    // would otherwise land one month past the island's actual today. A deep-
    // linked date (agenda row) anchors the month instead, when valid.
    const [monthDate, setMonthDate] = useState(() => {
        const islandToday = new Intl.DateTimeFormat('en-CA', {
            timeZone,
        }).format(new Date());
        const anchor =
            normalizeInitialDate(initialDate, timeZone) ?? islandToday;
        return new Date(`${anchor.slice(0, 7)}-01T00:00:00`);
    });
    const month = format(monthDate, 'yyyy-MM');
    const {
        data: days,
        isLoading,
        isFetching,
    } = useManageCalendar(tripId, month);
    // Two distinct states, deliberately: `selectedDate` MARKS a cell (a ring,
    // nothing more) - it is where jump-to-date and the agenda deep link land.
    // `openDate` is the day's action popup, and only a direct click on the
    // cell opens it.
    const [selectedDate, setSelectedDate] = useState<string | null>(() =>
        normalizeInitialDate(initialDate, timeZone)
    );
    const [openDate, setOpenDate] = useState<string | null>(null);
    const [jumpOpen, setJumpOpen] = useState(false);
    const reduceMotion = useReducedMotion();
    // F8 bulk blackout: a two-week haul-out is one dialog, not fourteen taps.
    // The same dialog runs in reverse ('reopen') - without it, a range close
    // could only be undone from the toast or day by day.
    const [rangeOpen, setRangeOpen] = useState(false);
    const [rangeMode, setRangeMode] = useState<'close' | 'reopen'>('close');
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [rangeNote, setRangeNote] = useState('');
    const [rangeError, setRangeError] = useState<string | null>(null);
    const { mutate: closeRange, isPending: isClosingRange } = useCloseRange();
    const { mutate: reopenRange, isPending: isReopeningRange } =
        useReopenRange();
    const rangeBusy = isClosingRange || isReopeningRange;

    function submitRange() {
        if (!rangeFrom || !rangeTo) {
            setRangeError('Pick both a first and a last day.');
            return;
        }
        if (rangeTo < rangeFrom) {
            setRangeError('The last day cannot be before the first.');
            return;
        }
        setRangeError(null);
        const from = rangeFrom;
        const to = rangeTo;
        if (rangeMode === 'reopen') {
            // No Undo on a bulk reopen, deliberately: re-closing the same
            // bounds would also close days that were OPEN before, which is
            // not an undo. The Date changes register handles corrections.
            reopenRange(
                { tripId, payload: { from, to } },
                {
                    onSuccess: ({ reopened }) => {
                        setRangeOpen(false);
                        setRangeFrom('');
                        setRangeTo('');
                        toast.success(
                            reopened > 0
                                ? `Reopened ${reopened} day${reopened === 1 ? '' : 's'}. New sales are running again.`
                                : 'No day-closures in that range to reopen.'
                        );
                    },
                    onError: err =>
                        setRangeError(
                            err instanceof Error
                                ? err.message
                                : 'Failed to reopen the range.'
                        ),
                }
            );
            return;
        }
        closeRange(
            {
                tripId,
                payload: { from, to, note: rangeNote.trim() || undefined },
            },
            {
                onSuccess: ({ closed }) => {
                    setRangeOpen(false);
                    setRangeFrom('');
                    setRangeTo('');
                    setRangeNote('');
                    toast.success(
                        closed > 0
                            ? `Closed ${closed} day${closed === 1 ? '' : 's'}. New sales stopped; existing bookings are kept.`
                            : 'Those days were already closed.',
                        closed > 0
                            ? {
                                  // The one-unit Undo (reopen-range over the
                                  // same bounds) - the cheapest safety net a
                                  // bulk action can have.
                                  action: {
                                      label: 'Undo',
                                      onClick: () =>
                                          reopenRange(
                                              { tripId, payload: { from, to } },
                                              {
                                                  onSuccess: ({ reopened }) =>
                                                      toast.success(
                                                          `Reopened ${reopened} day${reopened === 1 ? '' : 's'}.`
                                                      ),
                                              }
                                          ),
                                  },
                              }
                            : undefined
                    );
                },
                onError: err =>
                    setRangeError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to close the range.'
                    ),
            }
        );
    }

    // 'en-CA' renders YYYY-MM-DD directly; computed in the TOUR's zone so an
    // operator in Europe can still close the island's "today" after midnight CET.
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(
        new Date()
    );
    const canGoPrev = month > todayKey.slice(0, 7);
    // The nightly job materializes ~364 days ahead (master E.9: "12 rolling
    // months"), so departures genuinely stop there. Cap paging at that horizon
    // instead of letting month 13+ render an inexplicably empty grid.
    const maxMonth = todayKey.slice(0, 7).replace(/^\d{4}/, y => String(+y + 1));
    const canGoNext = month < maxMonth;

    // Monday-first offset of the month's first day (getDay(): 0=Sunday).
    const leadingBlanks = (monthDate.getDay() + 6) % 7;
    // Blank math uses the MONTH's own length, and cells only render rows that
    // belong to it: with placeholderData the previous month's rows linger while
    // the next streams in, and rendering them under the new month's weekday
    // offset would misalign the whole grid for that window.
    const daysInMonth = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0
    ).getDate();
    const monthDays = (days ?? []).filter(d => d.date.startsWith(month));
    const trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7;

    // Jump-to-date bounds: the island's today through the ~364-day horizon the
    // nightly job materializes. Outside that window there is nothing to manage.
    const jumpFrom = new Date(`${todayKey}T00:00:00`);
    const jumpTo = addMonths(new Date(`${todayKey.slice(0, 7)}-01T00:00:00`), 13);

    const monthNav = (
        <div className='flex items-center gap-1'>
            <Button
                size='icon-sm'
                variant='ghost'
                onClick={() => setMonthDate(m => addMonths(m, -1))}
                disabled={!canGoPrev}
                aria-label='Previous month'>
                <HugeiconsIcon icon={ArrowLeft01Icon} className='size-4' />
            </Button>
            {/* The month label IS the jump control (design-system popover, not
                a native month input): tap it, pick any of the 13 months the
                calendar covers. Next August is one tap, not twelve clicks. */}
            <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
                <PopoverTrigger asChild>
                    {/* Styled like the Select triggers beside it (border,
                        surface, chevron) so it READS as a control - a bare
                        text label hid the jump feature entirely. w-44 is
                        FIXED, sized to "September 2026": a min-width let
                        "November" grow the trigger and shove the arrows
                        sideways on every page. */}
                    <button
                        type='button'
                        aria-label='Jump to month'
                        className='flex h-8 w-44 items-center justify-between gap-1.5 rounded-md border border-input bg-surface-raised px-2.5 text-sm font-medium tabular-nums shadow-xs transition-[color,border-color,box-shadow] outline-none hover:border-line-strong focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25'>
                        <span className='flex items-center'>
                            {/* Label swaps with the house label-swap motion. */}
                            <AnimatePresence initial={false} mode='wait'>
                                <motion.span
                                    key={month}
                                    initial={
                                        reduceMotion ? false : { opacity: 0, y: 6 }
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={
                                        reduceMotion
                                            ? undefined
                                            : { opacity: 0, y: -6 }
                                    }
                                    transition={
                                        reduceMotion ? { duration: 0 } : swapFade
                                    }>
                                    {format(monthDate, 'MMMM yyyy')}
                                </motion.span>
                            </AnimatePresence>
                            {isFetching && !isLoading && (
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className='ml-1.5 inline size-3 animate-spin text-muted-foreground'
                                />
                            )}
                        </span>
                        <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            className='size-3.5 shrink-0 text-muted-foreground'
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent align='center' className='w-auto p-0'>
                    {/* Pick a DATE, not just a month (the reference mockup's
                        "Go"): the grid jumps to that month and the chosen day
                        is MARKED - the action popup stays closed until the
                        operator clicks the cell (auto-opening it made every
                        jump land in a dialog they did not ask for). */}
                    <Calendar
                        mode='single'
                        selected={
                            selectedDate
                                ? new Date(`${selectedDate}T00:00:00`)
                                : undefined
                        }
                        onSelect={date => {
                            if (!date) return;
                            setMonthDate(startOfMonth(date));
                            setSelectedDate(format(date, 'yyyy-MM-dd'));
                            setJumpOpen(false);
                        }}
                        defaultMonth={monthDate}
                        disabled={{ before: jumpFrom, after: jumpTo }}
                        captionLayout='dropdown'
                        autoFocus
                    />
                    <p className='px-3 pb-2 text-2xs text-muted-foreground'>
                        The calendar covers 12 months ahead.
                    </p>
                </PopoverContent>
            </Popover>
            <Button
                size='icon-sm'
                variant='ghost'
                onClick={() => setMonthDate(m => addMonths(m, 1))}
                disabled={!canGoNext}
                title={
                    canGoNext ? undefined : 'The calendar covers 12 months ahead.'
                }
                aria-label='Next month'>
                <HugeiconsIcon icon={ArrowRight01Icon} className='size-4' />
            </Button>
        </div>
    );

    const body = (
        <div className='space-y-3'>
            {bare && (
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    <Button
                        size='sm'
                        variant='outline'
                        className='h-8'
                        onClick={() => {
                            setRangeMode('close');
                            setRangeOpen(true);
                        }}>
                        Close / reopen a range
                    </Button>
                    {monthNav}
                </div>
            )}
            {isLoading ? (
                <Skeleton className='h-96 w-full rounded-lg' />
            ) : (
                <>
                    {/* Hairline grid: gap-px over the border color reads as ruled
                lines - calmer than a box around every day. The weekday header
                is its own static grid; the month body below remounts per
                month with a plain quick fade (crossFade). A directional
                slide was tried and pulled - on a grid this size it read as
                the whole table lurching, not as paging. */}
                    <div className='overflow-hidden rounded-lg border'>
                        <div className='grid grid-cols-7 gap-px bg-border/70'>
                            {WEEKDAY_HEADERS.map(h => (
                                <div
                                    key={h}
                                    className='bg-muted/50 py-2 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground'>
                                    {h}
                                </div>
                            ))}
                        </div>
                        <motion.div
                            key={month}
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={
                                reduceMotion ? { duration: 0 } : crossFade
                            }
                            className='grid grid-cols-7 gap-px border-t border-border/70 bg-border/70'>
                            {Array.from({ length: leadingBlanks }).map(
                                (_, i) => (
                                    <div
                                        key={`lead-${i}`}
                                        aria-hidden='true'
                                        className='bg-card'
                                    />
                                )
                            )}
                            {monthDays.length > 0
                                ? monthDays.map(day => (
                                      <DayCell
                                          key={day.date}
                                          day={day}
                                          isPast={day.date < todayKey}
                                          isToday={day.date === todayKey}
                                          marked={selectedDate === day.date}
                                          open={openDate === day.date}
                                          onOpenChange={next => {
                                              setOpenDate(
                                                  next ? day.date : null
                                              );
                                              // The mark follows a real click
                                              // too - one "you are here" cell.
                                              if (next)
                                                  setSelectedDate(day.date);
                                          }}
                                          tripId={tripId}
                                          maxPartySize={maxPartySize}
                                          declaredStartTimes={
                                              declaredStartTimes
                                          }
                                          isUnit={isUnit}
                                      />
                                  ))
                                : /* Streaming a fresh month: quiet numbered placeholders keep
                       the grid's height and alignment stable. */
                                  Array.from({ length: daysInMonth }).map(
                                      (_, i) => (
                                          <div
                                              key={`ph-${i}`}
                                              className='h-16 bg-card p-1.5 text-xs tabular-nums leading-none text-muted-foreground/40'>
                                              {i + 1}
                                          </div>
                                      )
                                  )}
                            {Array.from({ length: trailingBlanks }).map(
                                (_, i) => (
                                    <div
                                        key={`trail-${i}`}
                                        aria-hidden='true'
                                        className='bg-card'
                                    />
                                )
                            )}
                        </motion.div>
                    </div>

                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground'>
                        <span className='flex items-center gap-1.5'>
                            <span className='size-2 rounded-full bg-success-solid' />
                            open departure
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <span className='size-2 rounded-full bg-info-solid' />
                            sold out
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <span className='size-2.5 rounded-sm bg-warning-subtle ring-1 ring-warning-border' />
                            partially closed
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <span className='size-2.5 rounded-sm bg-destructive/15 ring-1 ring-destructive/30' />
                            closed
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <span className='rounded-sm bg-primary-subtle px-1 py-px text-2xs font-medium text-primary-subtle-content'>
                                3/26 booked
                            </span>
                            seats sold / day capacity
                        </span>
                    </div>
                </>
            )}

            {/* F8: bulk blackout dialog, dual-mode. Close writes one
                CLOSE_DATE per day server-side (the toast's Undo reopens the
                same bounds); Reopen removes the whole-day closures in the
                range - the answer to "I closed two weeks, the boat is fixed
                early". Single-departure closures and sold-out days are not
                touched by Reopen; those act from the day itself. */}
            <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            {rangeMode === 'close'
                                ? 'Close a range of dates'
                                : 'Reopen a range of dates'}
                        </DialogTitle>
                        <DialogDescription>
                            {rangeMode === 'close'
                                ? 'Stops new sales on every departure between the two days, inclusive. Existing bookings are kept.'
                                : 'Removes the day-closures between the two days, inclusive - new sales resume. Single-departure closures and sold-out days are untouched.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs
                        value={rangeMode}
                        onValueChange={v => {
                            setRangeMode(v as 'close' | 'reopen');
                            setRangeError(null);
                        }}>
                        <TabsList>
                            <TabsTrigger value='close'>Close</TabsTrigger>
                            <TabsTrigger value='reopen'>Reopen</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className='grid grid-cols-2 gap-3'>
                        <Field>
                            <Label>First day</Label>
                            <DatePickerField
                                value={rangeFrom}
                                onChange={v => {
                                    setRangeFrom(v);
                                    setRangeError(null);
                                }}
                            />
                        </Field>
                        <Field>
                            <Label>Last day</Label>
                            <DatePickerField
                                value={rangeTo}
                                onChange={v => {
                                    setRangeTo(v);
                                    setRangeError(null);
                                }}
                            />
                        </Field>
                    </div>
                    {rangeMode === 'close' && (
                        <Field>
                            <Label>Reason (optional)</Label>
                            <Input
                                value={rangeNote}
                                onChange={e => setRangeNote(e.target.value)}
                                placeholder='e.g. Maintenance haul-out'
                                maxLength={500}
                            />
                        </Field>
                    )}
                    {rangeError && (
                        <p className='text-xs text-destructive'>{rangeError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant='ghost'
                            onClick={() => setRangeOpen(false)}
                            disabled={rangeBusy}>
                            Cancel
                        </Button>
                        <Button
                            variant={
                                rangeMode === 'close'
                                    ? 'destructive'
                                    : 'default'
                            }
                            onClick={submitRange}
                            disabled={rangeBusy}>
                            {rangeBusy && (
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className='size-4 animate-spin'
                                />
                            )}
                            {rangeMode === 'close'
                                ? 'Close these days'
                                : 'Reopen these days'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <CardTitle className='text-lg font-medium'>
                            Availability
                        </CardTitle>
                        <p className='text-sm text-muted-foreground mt-1'>
                            Tap a day to close it, reopen it or add an extra
                            departure.
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-8'
                            onClick={() => {
                                setRangeMode('close');
                                setRangeOpen(true);
                            }}>
                            Close / reopen a range
                        </Button>
                        {monthNav}
                    </div>
                </div>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
    tripId: string;
    day: ManageCalendarDay;
    isPast: boolean;
    isToday: boolean;
    /** Marked via jump-to-date / deep link - a ring, no popup. */
    marked: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    maxPartySize: number;
    declaredStartTimes: string[];
    isUnit: boolean;
}

function DayCell({
    tripId,
    day,
    isPast,
    isToday,
    marked,
    open,
    onOpenChange,
    maxPartySize,
    declaredStartTimes,
    isUnit,
}: DayCellProps) {
    const dayNum = Number(day.date.slice(8, 10));
    // Every departure filled by bookings - the automatic, celebratory state
    // (§3.5), deliberately distinct from a manual close. Day-level only when the
    // whole day is full; a half-full day already reads from its dots.
    const allSoldOut =
        day.status !== 'closed' &&
        day.departures.length > 0 &&
        day.departures.every(d => d.status === 'SOLD_OUT');
    // `scheduled` keeps not-yet-materialized pattern days actionable, so an
    // operator can pre-close a date months out before the nightly sync fills it.
    const actionable =
        !isPast &&
        (day.departures.length > 0 ||
            day.exceptions.length > 0 ||
            day.scheduled);
    const offDay = day.status === 'no_service' && !day.scheduled;

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverAnchor asChild>
                <button
                    type='button'
                    disabled={!actionable}
                    onClick={() => onOpenChange(!open)}
                    aria-label={`${day.date} - ${STATUS_LABEL[day.status]}`}
                    className={cn(
                        'relative flex h-16 flex-col items-start justify-between p-1.5 text-left transition-colors',
                        // Base surface per state. Past days are always neutral: their
                        // departures fold to CLOSED after the cutoff, and painting
                        // history red is pure noise. Off days stay on the plain surface
                        // (a muted wash per weekday column read as a broken grid).
                        isPast
                            ? 'bg-muted/40'
                            : day.status === 'closed'
                              ? 'bg-destructive/10 hover:bg-destructive/15'
                              : day.status === 'partial'
                                ? 'bg-warning-subtle hover:bg-warning-subtle/80'
                                : 'bg-card',
                        actionable && 'cursor-pointer',
                        actionable &&
                            day.status !== 'closed' &&
                            day.status !== 'partial' &&
                            'hover:bg-muted/60',
                        // Selection mark (jump / deep link) vs the held popup
                        // ring: the mark is the primary colour so "the day I
                        // asked for" and "the day I have open" never blur.
                        marked && !open && 'ring-2 ring-inset ring-primary/60',
                        open && 'ring-2 ring-inset ring-foreground/30'
                    )}>
                    <span className='flex items-center gap-1.5'>
                        <span
                            className={cn(
                                'text-xs tabular-nums leading-none',
                                isPast || offDay
                                    ? 'text-muted-foreground/50'
                                    : 'font-medium',
                                isToday &&
                                    'grid size-5 -m-0.5 place-items-center rounded-full bg-foreground font-medium text-background',
                                !isPast &&
                                    !isToday &&
                                    day.status === 'closed' &&
                                    'text-destructive'
                            )}>
                            {dayNum}
                        </span>
                        {/* Explicit state words - a tint alone is easy to miss. */}
                        {!isPast && day.status === 'closed' && (
                            <span className='text-2xs font-medium uppercase leading-none text-destructive'>
                                Closed
                            </span>
                        )}
                        {!isPast && day.status === 'partial' && (
                            <span className='text-2xs font-medium uppercase leading-none text-warning-fg'>
                                Partial
                            </span>
                        )}
                        {!isPast && allSoldOut && (
                            <span className='text-2xs font-medium uppercase leading-none text-info-fg'>
                                Sold out
                            </span>
                        )}
                    </span>
                    <span className='flex w-full items-end justify-between gap-1'>
                        {day.departures.length > 0 ? (
                            <span className='flex items-center gap-0.5'>
                                {/* Sold out gets its own color (F17): it flips back by
                                    itself on a cancellation, a manual close only by
                                    hand. Painting both green hid the difference - and
                                    hid the good news. */}
                                {day.departures.slice(0, 3).map(d => (
                                    <span
                                        key={d.id}
                                        className={cn(
                                            'size-1.5 rounded-full',
                                            isPast
                                                ? 'bg-foreground/20'
                                                : d.status === 'SOLD_OUT'
                                                  ? 'bg-info-solid'
                                                  : d.status === 'OPEN'
                                                    ? 'bg-success-solid'
                                                    : 'bg-destructive/50'
                                        )}
                                    />
                                ))}
                                {day.departures.length > 3 && (
                                    <span className='text-2xs leading-none text-muted-foreground'>
                                        +{day.departures.length - 3}
                                    </span>
                                )}
                            </span>
                        ) : day.scheduled && !isPast ? (
                            /* Pattern covers this day but the engine hasn't filled it yet -
                 hollow dots, one per upcoming pattern time. */
                            <span className='flex items-center gap-0.5'>
                                {day.scheduledTimes.slice(0, 3).map(t => (
                                    <span
                                        key={t}
                                        className='size-1.5 rounded-full ring-1 ring-success-solid/60'
                                    />
                                ))}
                                {day.scheduledTimes.length > 3 && (
                                    <span className='text-2xs leading-none text-muted-foreground'>
                                        +{day.scheduledTimes.length - 3}
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span />
                        )}
                        {/* The seat picture, on every day that has materialized
                            departures - not only booked ones. "3/26 booked"
                            answers how full AND how big the day is in one
                            read; an untouched day shows its capacity quietly
                            (plain muted text, no chip) so an all-open month
                            does not become a wall of chips. Unit charters:
                            guests, never seat math (F10). */}
                        {isUnit
                            ? day.bookedTotal > 0 && (
                                  <span
                                      className={cn(
                                          'whitespace-nowrap rounded-sm px-1 py-px text-2xs font-medium tabular-nums leading-none',
                                          isPast
                                              ? 'text-muted-foreground/60'
                                              : 'bg-primary-subtle text-primary-subtle-content'
                                      )}>
                                      {day.bookedTotal}{' '}
                                      {day.bookedTotal === 1
                                          ? 'guest'
                                          : 'guests'}
                                  </span>
                              )
                            : day.departures.length > 0 &&
                              (day.bookedTotal > 0 ? (
                                  <span
                                      className={cn(
                                          'whitespace-nowrap rounded-sm px-1 py-px text-2xs font-medium tabular-nums leading-none',
                                          isPast
                                              ? 'text-muted-foreground/60'
                                              : 'bg-primary-subtle text-primary-subtle-content'
                                      )}>
                                      {day.bookedTotal}/
                                      {day.departures.reduce(
                                          (s, d) => s + d.capacity,
                                          0
                                      )}{' '}
                                      booked
                                  </span>
                              ) : (
                                  !isPast && (
                                      <span className='whitespace-nowrap text-2xs tabular-nums leading-none text-muted-foreground'>
                                          {day.departures.reduce(
                                              (s, d) => s + d.capacity,
                                              0
                                          )}{' '}
                                          seats
                                      </span>
                                  )
                              ))}
                    </span>
                </button>
            </PopoverAnchor>
            {open && (
                <DayPopover
                    tripId={tripId}
                    day={day}
                    maxPartySize={maxPartySize}
                    declaredStartTimes={declaredStartTimes}
                    isUnit={isUnit}
                    onClose={() => onOpenChange(false)}
                />
            )}
        </Popover>
    );
}

// ── Day popover: every exception type, one or two taps ───────────────────────

/**
 * No `set-capacity` panel, deliberately (review §3.2c and decided choice #5,
 * July 29): capacity is a set-once tour property, and operators manage channels
 * by closing departures rather than by editing numbers day to day. A SET_CAPACITY
 * row remains reachable through the timetable flow and the API for support and
 * allotment-style use, and any that exist still show here with a remove control -
 * this surface just stops minting new ones.
 */
type PanelState =
    | { kind: 'none' }
    | { kind: 'close-day' }
    | { kind: 'add-slot' };

interface DayPopoverProps {
    tripId: string;
    day: ManageCalendarDay;
    maxPartySize: number;
    declaredStartTimes: string[];
    isUnit: boolean;
    onClose: () => void;
}

function DayPopover({
    tripId,
    day,
    maxPartySize,
    declaredStartTimes,
    isUnit,
    onClose,
}: DayPopoverProps) {
    const { mutate: createException, isPending: isWriting } =
        useCreateException();
    const { mutate: removeException, isPending: isRemoving } =
        useRemoveException();
    const [panel, setPanel] = useState<PanelState>({ kind: 'none' });
    const [note, setNote] = useState('');
    const [timeDraft, setTimeDraft] = useState('');
    const [capDraft, setCapDraft] = useState('');
    const [error, setError] = useState<string | null>(null);

    const busy = isWriting || isRemoving;
    const closeDateException = day.exceptions.find(
        e => e.type === 'CLOSE_DATE'
    );
    const dayCapacityException = day.exceptions.find(
        e => e.type === 'SET_CAPACITY' && e.startTime === null
    );
    const slotException = (
        type: 'CLOSE_SLOT' | 'SET_CAPACITY',
        startTime: string
    ) => day.exceptions.find(e => e.type === type && e.startTime === startTime);

    // A background refetch can change the day under an open panel (another tab,
    // an admin, the plain exceptions form). Drop a panel its anchor no longer
    // supports so a stale draft can never submit against vanished state
    // (render-time reference-guarded reset, per repo convention).
    const panelStale = !!closeDateException && panel.kind !== 'none';
    if (panelStale) {
        setPanel({ kind: 'none' });
        setError(null);
        setCapDraft('');
        setTimeDraft('');
        setNote('');
    }

    function openPanel(next: PanelState) {
        setPanel(next);
        setError(null);
        setCapDraft('');
        setTimeDraft('');
        setNote('');
    }

    function write(
        payload: Parameters<typeof createException>[0]['payload'],
        successMsg: string
    ) {
        createException(
            { tripId, payload },
            {
                onSuccess: () => {
                    // The threaded successMsg was never surfaced, so closing a
                    // day / adding-closing-reopening a slot completed silently
                    // (code-review M8).
                    toast.success(successMsg);
                    onClose();
                },
                onError: err =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'The change failed.'
                    ),
            }
        );
    }

    function reopen(exceptionId: string, successMsg: string) {
        removeException(
            { tripId, exceptionId },
            {
                onSuccess: () => {
                    toast.success(successMsg);
                    onClose();
                },
                onError: err =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'The change failed.'
                    ),
            }
        );
    }

    function submitPanel() {
        setError(null);
        if (panel.kind === 'close-day') {
            write(
                {
                    date: day.date,
                    type: 'CLOSE_DATE',
                    note: note.trim() || undefined,
                },
                `Closed ${formatDayLong(day.date)}.`
            );
            return;
        }
        // add-slot, the only remaining panel that carries a number.
        const cap = capDraft.trim() ? Number(capDraft) : undefined;
        if (cap !== undefined && !Number.isInteger(cap)) {
            setError('Capacity must be a whole number.');
            return;
        }
        if (!HHMM.test(timeDraft.trim())) {
            setError('Time must be HH:MM, e.g. 14:30.');
            return;
        }
        // A 0-seat extra departure would materialize permanently sold out.
        if (cap !== undefined && cap < 1) {
            setError('An extra departure needs at least 1 seat.');
            return;
        }
        write(
            {
                date: day.date,
                type: 'ADD_SLOT',
                startTime: timeDraft.trim(),
                capacity: cap,
                note: note.trim() || undefined,
            },
            `Added a ${timeDraft.trim()} departure.`
        );
    }

    // The guarantee, not a warning. Shown on the close panel whether or not the
    // day has bookings: the operator who needs to read it most is the one who
    // has not yet dared to close a day that does.
    const closeReassurance =
        day.bookedTotal > 0
            ? `${day.bookedTotal} booked guest${day.bookedTotal === 1 ? '' : 's'} keep their booking${day.bookedTotal === 1 ? '' : 's'}. Closing only stops new sales.`
            : 'This only stops new sales. Existing bookings are always kept.';

    return (
        <PopoverContent align='start' sideOffset={6} className='w-80 p-0'>
            <div className='flex items-baseline justify-between gap-2 border-b px-4 py-3'>
                <p className='text-sm font-medium'>{formatDayLong(day.date)}</p>
                <p className='text-xs text-muted-foreground'>
                    {STATUS_LABEL[day.status]}
                    {day.bookedTotal > 0 && ` · ${day.bookedTotal} booked`}
                </p>
            </div>

            {/* Whole-day capacity override in force */}
            {dayCapacityException && (
                <div className='flex items-center justify-between gap-2 border-b px-4 py-2'>
                    <span className='text-xs text-muted-foreground'>
                        Day capacity override:{' '}
                        <span className='font-medium text-foreground'>
                            {dayCapacityException.capacity}
                        </span>
                    </span>
                    <Button
                        size='icon-sm'
                        variant='ghost'
                        disabled={busy}
                        aria-label='Remove day capacity override'
                        onClick={() =>
                            reopen(
                                dayCapacityException.id,
                                'Capacity override removed.'
                            )
                        }>
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className='size-3.5'
                        />
                    </Button>
                </div>
            )}

            {/* Not materialized yet: show what the weekly pattern WILL run on this
          date, so a far-future day never reads as empty (and adding one
          departure doesn't look like it conjured the others). */}
            {day.departures.length === 0 && day.scheduledTimes.length > 0 && (
                <div className='px-4 py-2.5 space-y-1.5'>
                    {day.scheduledTimes.map(t => (
                        <div key={t} className='flex h-7 items-center gap-2'>
                            <span className='size-1.5 shrink-0 rounded-full ring-1 ring-success-solid/60' />
                            <span className='text-sm font-medium tabular-nums'>
                                {t}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                                weekly pattern · opens for sale closer to the
                                date
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Slots */}
            {day.departures.length > 0 && (
                <div className='max-h-52 overflow-y-auto px-4 py-2.5 space-y-1.5'>
                    {day.departures.map(d => (
                        <SlotRow
                            key={d.id}
                            departure={d}
                            isUnit={isUnit}
                            dayClosed={!!closeDateException}
                            closeException={slotException(
                                'CLOSE_SLOT',
                                d.startTime
                            )}
                            capacityException={slotException(
                                'SET_CAPACITY',
                                d.startTime
                            )}
                            busy={busy}
                            onCloseSlot={() =>
                                write(
                                    {
                                        date: day.date,
                                        type: 'CLOSE_SLOT',
                                        startTime: d.startTime,
                                    },
                                    `Closed the ${d.startTime} departure.`
                                )
                            }
                            onReopenSlot={id =>
                                reopen(
                                    id,
                                    `Reopened the ${d.startTime} departure.`
                                )
                            }
                            onRemoveCapacity={id =>
                                reopen(id, 'Capacity override removed.')
                            }
                        />
                    ))}
                    {/* §3.2c: sold out explains itself, so nobody "fixes" it.
                        It is the automatic state - a cancellation or a support
                        capacity raise reopens it without anyone's help. */}
                    {day.departures.some(d => d.status === 'SOLD_OUT') && (
                        <p className='pt-0.5 text-xs text-muted-foreground'>
                            Sold out from bookings. Reopens automatically if a
                            spot frees up. No action needed.
                        </p>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className='border-t px-4 py-3 space-y-2'>
                {closeDateException ? (
                    <>
                        {closeDateException.note && (
                            <p className='text-xs text-muted-foreground truncate'>
                                {closeDateException.note}
                            </p>
                        )}
                        {/* Manual close wins: no nightly job, republish or (later)
                            API sync ever reopens this silently. Saying so is what
                            makes the one-tap trustworthy - and the who/when line
                            is the §6.5 audit surface. */}
                        <p className='text-xs text-muted-foreground'>
                            Closed by{' '}
                            {closeDateException.createdByName ?? 'your team'} ·{' '}
                            {format(
                                new Date(closeDateException.createdAt),
                                'MMM d, HH:mm'
                            )}
                            . Nothing reopens it automatically, only you or your
                            team can.
                        </p>
                        <Button
                            size='sm'
                            className='w-full'
                            disabled={busy}
                            onClick={() =>
                                reopen(
                                    closeDateException.id,
                                    `Reopened ${formatDayLong(day.date)}.`
                                )
                            }>
                            {isRemoving && (
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    className='size-4 animate-spin'
                                />
                            )}
                            Reopen this day
                        </Button>
                    </>
                ) : panel.kind === 'none' ? (
                    <>
                        <div className='grid grid-cols-2 gap-2'>
                            <Button
                                size='sm'
                                variant='outline'
                                disabled={busy}
                                onClick={() => openPanel({ kind: 'add-slot' })}>
                                Add departure
                            </Button>
                            <Button
                                size='sm'
                                variant='destructive'
                                disabled={busy}
                                onClick={() => openPanel({ kind: 'close-day' })}>
                                Close entire day
                            </Button>
                        </div>
                        {/* The other half of "close is not cancel": if the departure
                            genuinely will not run, the operator needs somewhere to
                            go. That somewhere is the booking's own report action
                            (Island Tours executes the refund or rebook), never a
                            self-serve cancel button here. */}
                        {day.bookedTotal > 0 && (
                            <p className='text-xs text-muted-foreground'>
                                Closing keeps every booking. If a departure truly
                                will not run, report it on the{' '}
                                {/* Deep-filtered: THIS tour, THIS day - the
                                    operator lands on exactly the bookings the
                                    closure touches, never the full list. */}
                                <Link
                                    href={`/bookings?tourId=${tripId}&from=${day.date}&to=${day.date}`}
                                    className='underline underline-offset-2 hover:text-foreground'>
                                    booking
                                </Link>{' '}
                                so Island Tours can refund or rebook the guests.
                            </p>
                        )}
                    </>
                ) : (
                    <div className='space-y-2'>
                        {panel.kind === 'add-slot' && (
                            <>
                                {(() => {
                                    // Declared times the day does not already run - one-tap
                                    // picks; the free input stays for a brand-new time.
                                    const taken = new Set([
                                        ...day.departures.map(d => d.startTime),
                                        ...day.scheduledTimes,
                                    ]);
                                    const quickTimes =
                                        declaredStartTimes.filter(
                                            t => !taken.has(t)
                                        );
                                    return quickTimes.length > 0 ? (
                                        <div className='flex flex-wrap gap-1.5'>
                                            {quickTimes.map(t => (
                                                <button
                                                    key={t}
                                                    type='button'
                                                    onClick={() =>
                                                        setTimeDraft(t)
                                                    }
                                                    className={cn(
                                                        'h-7 rounded-md border px-2 text-xs font-medium tabular-nums transition-colors',
                                                        timeDraft === t
                                                            ? 'border-foreground bg-foreground text-background'
                                                            : 'border-input hover:bg-muted'
                                                    )}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null;
                                })()}
                                <div className='flex gap-2'>
                                    <Input
                                        value={timeDraft}
                                        onChange={e =>
                                            setTimeDraft(e.target.value)
                                        }
                                        placeholder='HH:MM'
                                        inputMode='numeric'
                                        className='h-8 w-24 text-xs tabular-nums'
                                    />
                                    {/* No seat input on a private charter - the
                                        extra departure IS the second boat (F10). */}
                                    {!isUnit && (
                                        <Input
                                            value={capDraft}
                                            onChange={e =>
                                                setCapDraft(e.target.value)
                                            }
                                            type='number'
                                            min={1}
                                            placeholder={`Seats (${maxPartySize})`}
                                            className='h-8 flex-1 text-xs'
                                        />
                                    )}
                                </div>
                                {isUnit && (
                                    <p className='text-xs text-muted-foreground'>
                                        Runs as its own private charter: one
                                        booking, up to {maxPartySize} guests.
                                    </p>
                                )}
                            </>
                        )}
                        <Input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder='Note (optional), e.g. bad weather'
                            maxLength={500}
                            className='h-8 text-xs'
                        />
                        {panel.kind === 'close-day' && (
                            <p className='text-xs text-muted-foreground'>
                                {closeReassurance}
                            </p>
                        )}
                        {error && (
                            <p className='text-xs text-destructive'>{error}</p>
                        )}
                        <div className='flex gap-2'>
                            <Button
                                size='sm'
                                variant='ghost'
                                className='flex-1'
                                disabled={busy}
                                onClick={() => openPanel({ kind: 'none' })}>
                                Cancel
                            </Button>
                            <Button
                                size='sm'
                                variant={
                                    panel.kind === 'close-day'
                                        ? 'destructive'
                                        : 'default'
                                }
                                className='flex-1'
                                disabled={busy}
                                onClick={submitPanel}>
                                {isWriting && (
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        className='size-4 animate-spin'
                                    />
                                )}
                                {panel.kind === 'close-day' ? 'Close day' : 'Add'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </PopoverContent>
    );
}

// ── One slot row inside the popover ───────────────────────────────────────────

interface SlotRowProps {
    departure: TourDeparture;
    /** F10: private charters show Open/Booked states, never seat fractions. */
    isUnit: boolean;
    dayClosed: boolean;
    closeException?: { id: string };
    capacityException?: { id: string; capacity: number | null };
    busy: boolean;
    onCloseSlot: () => void;
    onReopenSlot: (exceptionId: string) => void;
    onRemoveCapacity: (exceptionId: string) => void;
}

function SlotRow({
    departure: d,
    isUnit,
    dayClosed,
    closeException,
    capacityException,
    busy,
    onCloseSlot,
    onReopenSlot,
    onRemoveCapacity,
}: SlotRowProps) {
    const stopped = d.status === 'CLOSED' || d.status === 'CANCELLED';

    return (
        <div className='flex h-8 items-center justify-between gap-2'>
            <div className='flex min-w-0 items-baseline gap-2'>
                <span
                    className={cn(
                        'text-sm font-medium tabular-nums',
                        stopped && 'text-muted-foreground line-through'
                    )}>
                    {d.startTime}
                </span>
                <span className='truncate text-xs text-muted-foreground'>
                    {/* One booking takes a private charter's whole departure -
                        a 2/12 fraction would read as "10 seats left" (F10). */}
                    {isUnit
                        ? d.status === 'OPEN'
                            ? 'Open'
                            : d.bookedCount > 0
                              ? `${d.bookedCount} guest${d.bookedCount === 1 ? '' : 's'}`
                              : ''
                        : `${d.bookedCount}/${d.capacity}`}
                    {stopped && !closeException && ' · closed'}
                </span>
                {d.status === 'SOLD_OUT' && (
                    <span className='rounded-sm bg-info-subtle px-1 py-px text-2xs font-medium text-info-fg'>
                        Sold out
                        {d.soldOutAt &&
                            ` ${format(new Date(d.soldOutAt), 'HH:mm')}`}
                    </span>
                )}
                {capacityException && capacityException.capacity != null && (
                    <button
                        type='button'
                        disabled={busy}
                        onClick={() => onRemoveCapacity(capacityException.id)}
                        title='Remove capacity override'
                        className='inline-flex items-center gap-0.5 rounded-sm bg-warning-subtle px-1 py-px text-2xs font-medium text-warning-fg hover:opacity-80'>
                        capacity {capacityException.capacity}
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className='size-2.5'
                        />
                    </button>
                )}
            </div>
            {!dayClosed &&
                (closeException ? (
                    <Button
                        size='sm'
                        variant='outline'
                        className='h-7 px-2 text-xs'
                        disabled={busy}
                        onClick={() => onReopenSlot(closeException.id)}>
                        Reopen
                    </Button>
                ) : (
                    !stopped && (
                        <Button
                            size='sm'
                            variant='ghost'
                            className='h-7 shrink-0 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10'
                            disabled={busy}
                            onClick={onCloseSlot}>
                            Close
                        </Button>
                    )
                ))}
        </div>
    );
}

// 'YYYY-MM-DD' → 'Wed 12 Aug 2026'.
function formatDayLong(day: string): string {
    const parsed = new Date(day + 'T00:00:00');
    return Number.isNaN(parsed.getTime())
        ? day
        : format(parsed, 'EEE d MMM yyyy');
}

