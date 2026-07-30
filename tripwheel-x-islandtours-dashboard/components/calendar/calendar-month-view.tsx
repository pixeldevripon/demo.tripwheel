'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { getMonth } from 'date-fns';
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
    tours: OverviewTour[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canShape: boolean;
    onOpenDay: (date: string) => void;
}) {
    const anchorMonth = getMonth(keyToDate(anchor));
    return (
        <div className='overflow-hidden rounded-lg border border-border/70'>
            <div className='grid grid-cols-7'>
                {WEEKDAYS.map((d) => (
                    <div
                        key={d}
                        className='bg-muted/50 py-2 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground'>
                        {d}
                    </div>
                ))}
            </div>
            {/* The six auto-rows-fr weeks stretch to fill the viewport (the
                calc mirrors the time grid's), with the per-cell min-h as the
                floor on short screens. */}
            <div className='grid min-h-[calc(100dvh-310px)] grid-cols-7 auto-rows-fr gap-px border-t border-border/70 bg-border/70'>
                {days.map((day) => (
                    <MonthCell
                        key={day.date}
                        day={day}
                        inMonth={getMonth(keyToDate(day.date)) === anchorMonth}
                        isToday={day.date === today}
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
    );
}

function MonthCell({
    day,
    inMonth,
    isToday,
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
    isPast: boolean;
    tours: OverviewTour[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canShape: boolean;
    onOpenDay: (date: string) => void;
}) {
    const dayNumber = Number(day.date.slice(8, 10));
    const overflow = day.departures.length - MAX_CHIPS;
    return (
        <div
            className={cn(
                'group relative flex min-h-24 flex-col gap-1 bg-background p-1 md:min-h-28 md:p-1.5',
                !inMonth && 'bg-muted/30',
                isPast && inMonth && 'bg-muted/20',
            )}>
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
