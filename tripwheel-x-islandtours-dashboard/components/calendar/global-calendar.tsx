'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OperatorFilterPopover } from '@/components/common/operator-filter-popover';
import { TourFilterPopover } from '@/components/common/tour-filter-popover';
import { useRole } from '@/contexts/role-context';
import { tripKeys, useAvailabilityOverview } from '@/hooks/trips/use-trips';
import { tripsApi } from '@/lib/api/trips';
import { crossFade, swapFade } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AddEventPopover } from './add-event-popover';
import { RangeDialog } from './range-dialog';
import {
    dateToKey,
    keyToDate,
    rangeLabel,
    stepAnchor,
    viewWindow,
    type CalendarView,
} from './calendar-utils';
import {
    DEPARTURE_DOT_CLASS,
    DEPARTURE_STATE_LABEL,
    type CalendarDepartureState,
} from '@/components/common/departure-states';
import { islandTime } from '@/lib/island-time';
import {
    CalendarTourMetaProvider,
    type CalendarTourMeta,
} from './calendar-tour-meta';
import { CalendarMonthView } from './calendar-month-view';
import { CalendarTimeGrid } from './calendar-time-grid';

const VIEW_STORAGE_KEY = 'it-global-calendar-view';
const OVERVIEW_STALE_MS = 60_000;

// The decided four states (MCK-16 change 9): cancelled is its own row - it is
// the one state that moves money - and "past fades" is a note, not a state.
const LEGEND: CalendarDepartureState[] = [
    'open',
    'soldOut',
    'closed',
    'cancelled',
];

/**
 * The global availability calendar: one full-width Month/Week/Day surface
 * over every departure the caller can manage - an operator's whole fleet,
 * or (for admins) the entire platform. Chips carry the management card
 * (stop-sell/reopen, capacity, deep links); empty space adds a one-off
 * departure or a weekly schedule.
 *
 * Speed choices, deliberate: the window fetch carries NO filters - tour and
 * operator narrowing happen client-side on the loaded window, so filter
 * clicks are instant. Adjacent windows prefetch after every move, so paging
 * is instant too; a 60s staleTime keeps back-paging off the network while
 * every availability mutation still busts overviewAll().
 */
export function GlobalCalendar() {
    const { role, can, canAny } = useRole();
    const isAdmin = role === 'ADMIN';
    const canShape = can('MANAGE_AVAILABILITY');
    const canStopSell = canAny(['MANAGE_AVAILABILITY', 'STOP_SELL']);
    const [rangeOpen, setRangeOpen] = useState(false);
    // Below xl the sidebar's mini calendar is gone - this popover replaces it.
    const [jumpOpen, setJumpOpen] = useState(false);
    const reduceMotion = useReducedMotion();
    const queryClient = useQueryClient();

    // View survives navigation (calendar habits are sticky); read after mount
    // so server and first client render agree.
    const [view, setView] = useState<CalendarView>('month');
    useEffect(() => {
        const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
        if (stored === 'day' || stored === 'week' || stored === 'month') {
            setView(stored);
        }
    }, []);
    function changeView(next: CalendarView) {
        setView(next);
        window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    }

    const [anchor, setAnchor] = useState(() => dateToKey(new Date()));
    // Once the backend reports the island's real today, snap the initial
    // anchor to it - unless the user already navigated somewhere on purpose.
    const navigatedRef = useRef(false);
    function navigate(date: string) {
        navigatedRef.current = true;
        setAnchor(date);
    }

    const [tourId, setTourId] = useState<string | undefined>(undefined);
    const [operatorId, setOperatorId] = useState<string | undefined>(undefined);

    const window_ = viewWindow(view, anchor);
    const { data, isLoading, isFetching } = useAvailabilityOverview({
        from: window_.from,
        days: window_.days,
    });

    const today = data?.today ?? dateToKey(new Date());
    useEffect(() => {
        if (!navigatedRef.current && data?.today) {
            setAnchor((a) => (a === data.today ? a : data.today));
        }
    }, [data?.today]);

    // Prefetch the previous/next window so paging never waits on the network.
    useEffect(() => {
        for (const dir of [-1, 1] as const) {
            const w = viewWindow(view, stepAnchor(view, anchor, dir));
            const params = { from: w.from, days: w.days };
            void queryClient.prefetchQuery({
                queryKey: tripKeys.overview(params),
                queryFn: () => tripsApi.getOverview(params),
                staleTime: OVERVIEW_STALE_MS,
            });
        }
    }, [view, anchor, queryClient]);

    const tours = useMemo(() => data?.tours ?? [], [data]);
    const operatorNameById = useMemo(
        () => new Map(tours.map((t) => [t.operatorId, t.operatorName])),
        [tours],
    );
    // Per-tour display meta for the chips: the island zone (one-clock audit
    // lines) and the whole-unit noun. Provided via context - see
    // calendar-tour-meta.tsx.
    const tourMetaById = useMemo(
        () =>
            new Map<string, CalendarTourMeta>(
                tours.map((t) => [
                    t.id,
                    {
                        timeZone: t.timeZone,
                        wholeUnitType: t.wholeUnitType ?? null,
                    },
                ]),
            ),
        [tours],
    );
    // Client-side narrowing of the loaded window - instant, no refetch.
    const filteredDays = useMemo(() => {
        const days = data?.days ?? [];
        if (!tourId && !operatorId) return days;
        return days.map((d) => ({
            ...d,
            departures: d.departures.filter(
                (dep) =>
                    (!tourId || dep.tourId === tourId) &&
                    (!operatorId || dep.operatorId === operatorId),
            ),
        }));
    }, [data, tourId, operatorId]);

    function openDay(date: string) {
        navigate(date);
        changeView('day');
    }

    const label = rangeLabel(view, anchor);
    // Adding targets the picked day; a past pick disables the button rather
    // than silently retargeting (the backend refuses writes into the past).
    const addDisabled = anchor < today;
    const addTours = tourId ? tours.filter((t) => t.id === tourId) : tours;

    const filters = (
        <>
            <TourFilterPopover value={tourId} onChange={setTourId} />
            {isAdmin && (
                <OperatorFilterPopover
                    value={operatorId}
                    onChange={setOperatorId}
                />
            )}
        </>
    );

    return (
        // At lg+ the page is exactly the leftover viewport: 100dvh minus the
        // header var minus 80px = the chrome ABOVE the calendar (inset margin
        // 8 + pane p-4 16 + page lg:p-8 32) plus ONE 16px + 8px margin kept
        // at the bottom - the page's own 56px of bottom padding is deliberately
        // reclaimed (founder 2026-07-31: no unused band under the grid). The
        // grid then FILLS the frame (flex-1), so the calendar always ends at
        // the viewport bottom at every screen height. The -mb-8 gives back the
        // 32px the taller frame borrows from the page's bottom padding - in
        // normal flow the padding would otherwise re-appear BELOW the frame
        // and put a scrollbar on the whole page. Below lg the page keeps its
        // natural flow and the grid keeps its own height calc.
        <CalendarTourMetaProvider value={tourMetaById}>
        <div className='flex flex-col gap-4 lg:-mb-8 lg:h-[calc(100dvh-var(--header-height)-80px)]'>
            {/* ── Toolbar (Waton shape: big title, quiet controls) ─────── */}
            <div className='flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2'>
                {/* ONE non-wrapping cluster: title + Today + arrows always
                    share a row (arrows can never orphan onto their own line).
                    The title is fluid on phones and fixed at sm+ so label
                    swaps never shove the controls. At xl the label column
                    matches the sidebar (w-60 + gap-4), so Today + arrows sit
                    exactly where the grid starts - no dead gap after the
                    title (founder sketch 2026-07-31). */}
                <div className='flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3 xl:gap-4'>
                    <div className='relative h-8 min-w-0 flex-1 overflow-hidden sm:w-80 sm:flex-none xl:w-60'>
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.span
                                key={label}
                                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                                transition={swapFade}
                                // xl steps back DOWN to text-xl: the label
                                // column narrows to the sidebar's w-60 there,
                                // and 2xl truncates even short-month labels.
                                className='absolute inset-0 truncate text-xl font-semibold leading-8 sm:text-2xl xl:text-xl'>
                                {label}
                            </motion.span>
                        </AnimatePresence>
                    </div>
                    <Button
                        variant='outline'
                        className='h-9 shrink-0'
                        onClick={() => navigate(today)}>
                        Today
                    </Button>
                    <div className='flex shrink-0 items-center'>
                        <Button
                            variant='ghost'
                            size='icon'
                            className='size-9'
                            aria-label='Previous'
                            onClick={() => navigate(stepAnchor(view, anchor, -1))}>
                            <HugeiconsIcon icon={ArrowLeft01Icon} className='size-4' />
                        </Button>
                        <Button
                            variant='ghost'
                            size='icon'
                            className='size-9'
                            aria-label='Next'
                            onClick={() => navigate(stepAnchor(view, anchor, 1))}>
                            <HugeiconsIcon icon={ArrowRight01Icon} className='size-4' />
                        </Button>
                    </div>
                    {isFetching && !isLoading && (
                        <span
                            aria-hidden
                            className='size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground'
                        />
                    )}
                </div>

                <div className='ml-auto flex flex-wrap items-center gap-2'>
                    {/* Filters + add + range tool + date jump live in the
                        sidebar; below xl the sidebar is gone, so they all
                        surface here - full feature parity on phones. */}
                    <div className='flex flex-wrap items-center gap-2 xl:hidden'>
                        {canShape && (
                            <AddEventPopover
                                date={anchor}
                                tours={addTours}
                                defaultTourId={tourId}>
                                <Button
                                    size='icon'
                                    className='size-10'
                                    disabled={addDisabled}
                                    aria-label='Add departure or schedule'
                                    title={
                                        addDisabled
                                            ? 'Pick today or a future date to add'
                                            : 'Add departure or schedule'
                                    }>
                                    <HugeiconsIcon
                                        icon={PlusSignIcon}
                                        className='size-4'
                                    />
                                </Button>
                            </AddEventPopover>
                        )}
                        <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
                            <PopoverTrigger asChild>
                                <Button variant='outline' className='h-10'>
                                    {format(keyToDate(anchor), 'd MMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className='w-auto p-0'
                                align='start'
                                collisionPadding={12}>
                                <Calendar
                                    mode='single'
                                    weekStartsOn={1}
                                    selected={keyToDate(anchor)}
                                    defaultMonth={keyToDate(anchor)}
                                    onSelect={(d) => {
                                        if (d) {
                                            navigate(dateToKey(d));
                                            setJumpOpen(false);
                                        }
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                        {filters}
                    </div>
                    <div className='flex items-center gap-2'>
                        <Tabs
                            value={view}
                            onValueChange={(v) => changeView(v as CalendarView)}>
                            <TabsList className='h-9'>
                                <TabsTrigger value='day'>Day</TabsTrigger>
                                <TabsTrigger value='week'>Week</TabsTrigger>
                                <TabsTrigger value='month'>Month</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        {/* Mobile Range rides the view-switch row, right of
                            the tabs (the sidebar owns it at xl+). */}
                        {canStopSell && (
                            <Button
                                variant='outline'
                                className='h-9 xl:hidden'
                                onClick={() => setRangeOpen(true)}>
                                Range
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Body: sidebar + grid ────────────────────────────────── */}
            <div className='flex items-start gap-4 lg:min-h-0 lg:flex-1'>
                {/* Scrolls inside itself when the fixed page height leaves it
                    less room than its stack needs (short viewports) - with the
                    rail HIDDEN (wheel/trackpad still scrolls), so no scrollbar
                    ever sits between the sidebar and the grid. */}
                <aside className='hidden max-h-full w-60 shrink-0 flex-col gap-3 overflow-y-auto scrollbar-none xl:flex'>
                    {canShape && (
                        <AddEventPopover
                            date={anchor}
                            tours={addTours}
                            defaultTourId={tourId}>
                            <Button
                                disabled={addDisabled}
                                title={
                                    addDisabled
                                        ? 'Pick today or a future date to add'
                                        : undefined
                                }
                                className='h-10 w-full justify-start gap-2'>
                                <HugeiconsIcon
                                    icon={PlusSignIcon}
                                    className='size-4'
                                />
                                Add departure or schedule
                            </Button>
                        </AddEventPopover>
                    )}
                    {/* Bulk blackout + its reverse - a STOP_SELL seat may
                        close/reopen even though it cannot add. */}
                    {canStopSell && (
                        <Button
                            variant='outline'
                            className='h-10 w-full justify-start'
                            onClick={() => setRangeOpen(true)}>
                            Close / reopen a range
                        </Button>
                    )}
                    {/* Mini calendar: remounts when the anchor month moves so
                        its visible month always follows the grid. */}
                    <div className='rounded-lg border border-border/70'>
                        <Calendar
                            key={anchor.slice(0, 7)}
                            mode='single'
                            weekStartsOn={1}
                            selected={keyToDate(anchor)}
                            defaultMonth={keyToDate(anchor)}
                            onSelect={(d) => {
                                if (d) navigate(dateToKey(d));
                            }}
                            className='w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-2'>
                        <p className='px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground'>
                            Filters
                        </p>
                        {filters}
                    </div>
                    <div className='flex flex-col gap-1.5 rounded-lg border border-border/70 p-3'>
                        {LEGEND.map((state) => (
                            <span
                                key={state}
                                className='flex items-center gap-2 text-xs text-muted-foreground'>
                                <span
                                    className={cn(
                                        'size-2 rounded-full',
                                        DEPARTURE_DOT_CLASS[state],
                                    )}
                                />
                                {DEPARTURE_STATE_LABEL[state]}
                            </span>
                        ))}
                        <p className='pt-1 text-2xs leading-relaxed text-muted-foreground/80'>
                            Past departures fade. Sold out is revenue, never an
                            error. Cancelling a booked departure triggers
                            refunds and is an Island Tours action - it never
                            starts from this surface.
                        </p>
                    </div>
                    {data?.lastConfirmedAt && (
                        <p className='px-1 text-xs text-muted-foreground'>
                            {/* Island clock (E.9 one-clock rule), borrowing
                                the first tour's zone - one operator, one
                                island in practice. */}
                            Availability confirmed{' '}
                            {islandTime(
                                data.lastConfirmedAt,
                                tours[0]?.timeZone,
                            )}
                        </p>
                    )}
                </aside>

                <div className='min-w-0 flex-1 lg:flex lg:min-h-0 lg:flex-col lg:self-stretch'>
                    {/* ONE frame height for every view (and the skeleton), so
                        switching Day/Week/Month never shifts the layout - the
                        views fill it and scroll inside themselves. At lg+ the
                        frame is the column's leftover height (exact viewport
                        fill); below lg it falls back to its own calc. */}
                    <div className='h-[calc(100dvh-270px)] min-h-104 lg:h-auto lg:flex-1'>
                    {isLoading ? (
                        <CalendarSkeleton view={view} />
                    ) : (
                        /* Cross-fade on VIEW switches only - window paging
                           updates in place (placeholderData keeps the old
                           window rendered while the next one loads). */
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.div
                                key={view}
                                className='h-full'
                                initial={reduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={reduceMotion ? undefined : { opacity: 0 }}
                                transition={crossFade}>
                                {view === 'month' ? (
                                    <CalendarMonthView
                                        days={filteredDays}
                                        anchor={anchor}
                                        today={today}
                                        selectedDate={anchor}
                                        tours={addTours}
                                        operatorNameById={operatorNameById}
                                        isAdmin={isAdmin}
                                        canShape={canShape}
                                        onOpenDay={openDay}
                                    />
                                ) : (
                                    <CalendarTimeGrid
                                        days={filteredDays}
                                        today={today}
                                        selectedDate={anchor}
                                        tours={addTours}
                                        timeZone={tours[0]?.timeZone}
                                        operatorNameById={operatorNameById}
                                        isAdmin={isAdmin}
                                        canShape={canShape}
                                        onOpenDay={openDay}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                    </div>
                    {/* The sidebar's legend + freshness line, for viewports
                        where the sidebar is gone. */}
                    <div className='mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 xl:hidden'>
                        {LEGEND.map((state) => (
                            <span
                                key={state}
                                className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                                <span
                                    className={cn(
                                        'size-2 rounded-full',
                                        DEPARTURE_DOT_CLASS[state],
                                    )}
                                />
                                {DEPARTURE_STATE_LABEL[state]}
                            </span>
                        ))}
                        {data?.lastConfirmedAt && (
                            <span className='text-xs text-muted-foreground'>
                                · Confirmed{' '}
                                {islandTime(
                                    data.lastConfirmedAt,
                                    tours[0]?.timeZone,
                                )}
                            </span>
                        )}
                    </div>
                    <p className='mt-2 text-xs text-muted-foreground'>
                        All times are local to each tour&apos;s island. Counts
                        show Island Tours bookings only - closing never touches
                        booked guests.
                    </p>
                </div>
            </div>

            {/* Keyed per open so every visit starts with fresh fields and the
                current tour filter as its default. */}
            <RangeDialog
                key={`${rangeOpen}-${tourId ?? 'all'}`}
                open={rangeOpen}
                onOpenChange={setRangeOpen}
                tours={tours}
                defaultTourId={tourId}
            />
        </div>
        </CalendarTourMetaProvider>
    );
}

function CalendarSkeleton({ view }: { view: CalendarView }) {
    if (view === 'month') {
        return (
            <div className='h-full overflow-hidden rounded-lg border border-border/70 bg-background'>
                <div className='grid h-full grid-cols-7 auto-rows-fr'>
                    {Array.from({ length: 42 }, (_, i) => (
                        <div
                            key={i}
                            className='min-h-16 border-l border-t border-border/40 p-2 first:border-l-0 [&:nth-child(-n+7)]:border-t-0 [&:nth-child(7n+1)]:border-l-0'>
                            <Skeleton className='size-6 rounded-full' />
                            {i % 3 === 0 && (
                                <Skeleton className='mt-2 h-4 w-full rounded-sm' />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return (
        <div className='flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-background'>
            {Array.from({ length: 10 }, (_, i) => (
                <div
                    key={i}
                    className='flex h-20 shrink-0 items-center gap-4 border-t border-border/40 px-4 first:border-t-0'>
                    <Skeleton className='h-3 w-10' />
                    {i % 2 === 0 && <Skeleton className='h-8 w-40 rounded-md' />}
                </div>
            ))}
        </div>
    );
}
