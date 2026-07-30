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
import {
    DOT_CLASS,
    STATE_LABEL,
    dateToKey,
    keyToDate,
    rangeLabel,
    stepAnchor,
    viewWindow,
    type CalendarView,
    type ChipState,
} from './calendar-utils';
import { CalendarMonthView } from './calendar-month-view';
import { CalendarTimeGrid } from './calendar-time-grid';

const VIEW_STORAGE_KEY = 'it-global-calendar-view';
const OVERVIEW_STALE_MS = 60_000;

const LEGEND: ChipState[] = ['open', 'soldOut', 'closed', 'past'];

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
    const { role, can } = useRole();
    const isAdmin = role === 'ADMIN';
    const canShape = can('MANAGE_AVAILABILITY');
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
    // Add lands on the anchor day, unless it is already behind the island.
    const addDate = anchor >= today ? anchor : today;
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
        <div className='flex flex-col gap-4'>
            {/* ── Toolbar (Waton shape: big title, quiet controls) ─────── */}
            <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
                {/* Fixed width so label swaps never shove the controls -
                    sized for the longest week range ("Sep 28 - Oct 4, 2026"). */}
                <div className='relative h-8 w-64 overflow-hidden sm:w-80'>
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                            key={label}
                            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={swapFade}
                            className='absolute inset-0 truncate text-xl font-semibold leading-8 sm:text-2xl'>
                            {label}
                        </motion.span>
                    </AnimatePresence>
                </div>
                <Button
                    variant='outline'
                    className='h-9'
                    onClick={() => navigate(today)}>
                    Today
                </Button>
                <div className='flex items-center'>
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
                        className='size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground'
                    />
                )}

                <div className='ml-auto flex flex-wrap items-center gap-2'>
                    {/* Filters live in the sidebar; below xl the sidebar is
                        gone, so they surface here instead. */}
                    <div className='flex items-center gap-2 xl:hidden'>
                        {filters}
                    </div>
                    <Tabs
                        value={view}
                        onValueChange={(v) => changeView(v as CalendarView)}>
                        <TabsList className='h-9'>
                            <TabsTrigger value='day'>Day</TabsTrigger>
                            <TabsTrigger value='week'>Week</TabsTrigger>
                            <TabsTrigger value='month'>Month</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* ── Body: sidebar + grid ────────────────────────────────── */}
            <div className='flex items-start gap-4'>
                <aside className='hidden w-60 shrink-0 flex-col gap-4 xl:flex'>
                    {canShape && (
                        <AddEventPopover
                            date={addDate}
                            tours={addTours}
                            defaultTourId={tourId}>
                            <Button className='h-10 w-full justify-start gap-2'>
                                <HugeiconsIcon
                                    icon={PlusSignIcon}
                                    className='size-4'
                                />
                                Add departure or schedule
                            </Button>
                        </AddEventPopover>
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
                                        DOT_CLASS[state],
                                    )}
                                />
                                {STATE_LABEL[state]}
                            </span>
                        ))}
                    </div>
                    {data?.lastConfirmedAt && (
                        <p className='px-1 text-xs text-muted-foreground'>
                            Availability confirmed{' '}
                            {format(
                                new Date(data.lastConfirmedAt),
                                'd MMM, HH:mm',
                            )}
                        </p>
                    )}
                </aside>

                <div className='min-w-0 flex-1'>
                    {/* ONE frame height for every view (and the skeleton), so
                        switching Day/Week/Month never shifts the layout - the
                        views fill it and scroll inside themselves. */}
                    <div className='h-[calc(100dvh-270px)] min-h-[26rem]'>
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
                    <p className='mt-2 text-xs text-muted-foreground'>
                        All times are local to each tour&apos;s island. Counts
                        show Island Tours bookings only - closing never touches
                        booked guests.
                    </p>
                </div>
            </div>
        </div>
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
