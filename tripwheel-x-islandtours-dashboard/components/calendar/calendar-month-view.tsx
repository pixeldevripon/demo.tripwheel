'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { motion, useReducedMotion } from 'framer-motion';
import { getMonth } from 'date-fns';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { OverviewDay, OverviewTour } from '@/types/trip';
import { AddEventPopover } from './add-event-popover';
import { DOT_CLASS, chipState, keyToDate } from './calendar-utils';
import { DayPeek } from './day-peek';
import { DepartureChip } from './departure-chip';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Chips shown inline per cell before collapsing into "+N more". */
const MAX_CHIPS = 3;

/**
 * The month grid: six full Mon-Sun weeks, departures as event chips. Desktop
 * cells list up to three chips + "+N more"; below md the chips collapse to
 * status dots and the whole cell opens the day peek (no horizontal overflow,
 * ever). The hover "+" adds a departure/schedule on that day.
 */
export function CalendarMonthView({
    days,
    anchor,
    today,
    selectedDate,
    tours,
    operatorNameById,
    isAdmin,
    canShape,
    onOpenDay,
}: {
    days: OverviewDay[];
    /** 'YYYY-MM-DD' inside the displayed month (dims other-month days). */
    anchor: string;
    today: string;
    /** The mini-calendar's picked date - ringed in the grid. */
    selectedDate?: string;
    tours: OverviewTour[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canShape: boolean;
    onOpenDay: (date: string) => void;
}) {
    const anchorMonth = getMonth(keyToDate(anchor));
    return (
        // Same frame language as the week/day time grid: white surface,
        // hairline borders, and the SAME h-11 header bar - never a tinted
        // band or a dark lattice. (No date numbers here: a month column
        // spans six dates, unlike a week column.)
        <div className='flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-background'>
            <div className='grid shrink-0 grid-cols-7 border-b border-border/50'>
                {WEEKDAYS.map((d) => (
                    <div
                        key={d}
                        className='flex h-11 items-center justify-center border-l border-border/50 text-2xs font-medium uppercase tracking-wider text-muted-foreground first:border-l-0'>
                        {d}
                    </div>
                ))}
            </div>
            {/* The six auto-rows-fr weeks split the frame height evenly; on
                short screens the per-cell min-h wins and the grid scrolls
                inside (scrollbar hidden, like every calendar scrollport). */}
            <div className='min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <div className='grid h-full min-h-[36rem] grid-cols-7 auto-rows-fr'>
                {days.map((day) => (
                    <MonthCell
                        key={day.date}
                        day={day}
                        inMonth={getMonth(keyToDate(day.date)) === anchorMonth}
                        isToday={day.date === today}
                        isSelected={day.date === selectedDate}
                        isPast={day.date < today}
                        tours={tours}
                        operatorNameById={operatorNameById}
                        isAdmin={isAdmin}
                        canShape={canShape}
                        onOpenDay={onOpenDay}
                    />
                ))}
            </div>
            </div>
        </div>
    );
}

function MonthCell({
    day,
    inMonth,
    isToday,
    isSelected,
    isPast,
    tours,
    operatorNameById,
    isAdmin,
    canShape,
    onOpenDay,
}: {
    day: OverviewDay;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
    tours: OverviewTour[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canShape: boolean;
    onOpenDay: (date: string) => void;
}) {
    const reduceMotion = useReducedMotion();
    const dayNumber = Number(day.date.slice(8, 10));
    const overflow = day.departures.length - MAX_CHIPS;
    return (
        <div
            className={cn(
                // Hairline cell borders matching the time grid (first column
                // and first row lean on the frame/header borders instead).
                'group relative flex min-h-24 flex-col gap-1 border-l border-t border-border/40 p-1 first:border-l-0 md:min-h-28 md:p-1.5 [&:nth-child(-n+7)]:border-t-0 [&:nth-child(7n+1)]:border-l-0',
                !inMonth && 'bg-muted/30',
                isPast && inMonth && 'bg-muted/20',
            )}>
            {/* Mirrors the mini calendar's picked date. A shared layoutId
                makes the ring GLIDE between cells instead of teleporting. */}
            {isSelected && (
                <motion.div
                    layoutId='calendar-selected-cell'
                    aria-hidden
                    transition={reduceMotion ? { duration: 0 } : springPop}
                    className='pointer-events-none absolute inset-0 z-10 ring-2 ring-inset ring-primary/60'
                />
            )}
            <div className='flex items-center justify-between'>
                <button
                    type='button'
                    onClick={() => onOpenDay(day.date)}
                    aria-label={`Open ${day.date} in day view`}
                    className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors duration-normal hover:bg-muted',
                        isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        !inMonth && 'text-muted-foreground/60',
                    )}>
                    {dayNumber}
                </button>
                {/* The Google-style hover "+": add a one-off departure or a
                    weekly schedule anchored on this day. Future days only -
                    the backend refuses writes into the past. */}
                {canShape && !isPast && (
                    <AddEventPopover date={day.date} tours={tours}>
                        <button
                            type='button'
                            aria-label={`Add on ${day.date}`}
                            className='hidden size-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity duration-normal hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 md:flex'>
                            <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                        </button>
                    </AddEventPopover>
                )}
            </div>

            {/* Desktop: real chips. */}
            <div className='hidden min-w-0 flex-col gap-0.5 md:flex'>
                {day.departures.slice(0, MAX_CHIPS).map((dep) => (
                    <DepartureChip
                        key={dep.id}
                        dep={dep}
                        operatorName={
                            isAdmin
                                ? operatorNameById.get(dep.operatorId)
                                : undefined
                        }
                    />
                ))}
                {overflow > 0 && (
                    <DayPeek
                        date={day.date}
                        departures={day.departures}
                        operatorNameById={operatorNameById}
                        isAdmin={isAdmin}>
                        <button
                            type='button'
                            className='rounded-sm px-1.5 py-0.5 text-left text-2xs font-medium text-muted-foreground transition-colors duration-normal hover:bg-muted'>
                            +{overflow} more
                        </button>
                    </DayPeek>
                )}
            </div>

            {/* Mobile: dots + count, whole area opens the day peek. */}
            {day.departures.length > 0 && (
                <DayPeek
                    date={day.date}
                    departures={day.departures}
                    operatorNameById={operatorNameById}
                    isAdmin={isAdmin}>
                    <button
                        type='button'
                        aria-label={`${day.departures.length} departures on ${day.date}`}
                        className='flex flex-1 flex-wrap content-start items-start gap-0.5 rounded-sm p-0.5 md:hidden'>
                        {day.departures.slice(0, 4).map((dep) => (
                            <span
                                key={dep.id}
                                className={cn(
                                    'size-1.5 rounded-full',
                                    DOT_CLASS[chipState(dep)],
                                )}
                            />
                        ))}
                        {day.departures.length > 4 && (
                            <span className='text-2xs leading-none text-muted-foreground'>
                                +{day.departures.length - 4}
                            </span>
                        )}
                    </button>
                </DayPeek>
            )}
        </div>
    );
}
