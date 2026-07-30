'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { OverviewDay, OverviewDeparture, OverviewTour } from '@/types/trip';
import { AddEventForm } from './add-event-popover';
import { gmtLabel, keyToDate } from './calendar-utils';
import { DepartureChip } from './departure-chip';

// Keep in lockstep with the classes below: hour rows are h-14 (56px), chips
// h-12 (48px). The numbers exist only for position math.
const HOUR_PX = 56;

interface Positioned {
    dep: OverviewDeparture;
    top: number;
    lane: number;
    lanes: number;
}

function minutesOf(dep: OverviewDeparture): number {
    const [h, m] = dep.startTime.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Greedy lane assignment so same-time departures sit side by side. Lanes are
 * counted PER OVERLAP CLUSTER, not per day - a lone 15:00 departure renders
 * full-width even when the 09:00 rush needed three lanes. A chip occupies one
 * visual hour for overlap purposes.
 */
function layoutDay(deps: OverviewDeparture[], startHour: number): Positioned[] {
    const sorted = [...deps].sort(
        (a, b) => minutesOf(a) - minutesOf(b) || a.tourName.localeCompare(b.tourName),
    );
    const out: Positioned[] = [];
    let cluster: Omit<Positioned, 'lanes'>[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -1;
    const flush = () => {
        const lanes = laneEnds.length;
        out.push(...cluster.map((c) => ({ ...c, lanes })));
        cluster = [];
        laneEnds = [];
        clusterEnd = -1;
    };
    for (const dep of sorted) {
        const start = minutesOf(dep);
        if (cluster.length > 0 && start >= clusterEnd) flush();
        let lane = laneEnds.findIndex((end) => end <= start);
        if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(0);
        }
        laneEnds[lane] = start + 60;
        clusterEnd = Math.max(clusterEnd, start + 60);
        cluster.push({
            dep,
            lane,
            top: ((start - startHour * 60) / 60) * HOUR_PX,
        });
    }
    flush();
    return out;
}

/**
 * The Week/Day time grid: one column per day, departures positioned by start
 * time, click on empty space to add a departure/schedule at that hour. Week
 * and Day are the same component - a day is a one-column week.
 */
export function CalendarTimeGrid({
    days,
    today,
    tours,
    timeZone,
    operatorNameById,
    isAdmin,
    canShape,
    onOpenDay,
}: {
    days: OverviewDay[];
    today: string;
    tours: OverviewTour[];
    /** First tour's IANA zone - feeds the "GMT-4" gutter corner label. */
    timeZone?: string;
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    canShape: boolean;
    onOpenDay: (date: string) => void;
}) {
    // The visible hour span hugs the data but never collapses below 08-19,
    // so an empty week still looks like a working day.
    const [startHour, endHour] = useMemo(() => {
        let min = 8;
        let max = 19;
        for (const day of days) {
            for (const dep of day.departures) {
                const h = Math.floor(minutesOf(dep) / 60);
                if (h < min) min = h;
                if (h + 1 > max) max = h + 1;
            }
        }
        return [min, Math.min(max + 1, 24)];
    }, [days]);
    const hours = Array.from(
        { length: endHour - startHour },
        (_, i) => startHour + i,
    );

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        // Land the viewport on the morning, not 00:00-adjacent whitespace.
        scrollRef.current?.scrollTo({ top: (8 - startHour) * HOUR_PX });
    }, [startHour]);

    // One controlled popover for click-to-add: the anchor is an invisible dot
    // placed where the click landed, so the card opens right at the hour.
    const [addTarget, setAddTarget] = useState<{
        date: string;
        time: string;
        top: number;
        dayIndex: number;
    } | null>(null);

    function handleColumnClick(
        e: React.MouseEvent<HTMLDivElement>,
        day: OverviewDay,
        dayIndex: number,
    ) {
        if (!canShape || day.date < today) return;
        // Chips and their popovers handle their own clicks.
        if ((e.target as HTMLElement).closest('button')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const hour = Math.min(
            endHour - 1,
            Math.max(startHour, startHour + Math.floor(y / HOUR_PX)),
        );
        setAddTarget({
            date: day.date,
            time: `${String(hour).padStart(2, '0')}:00`,
            top: (hour - startHour) * HOUR_PX,
            dayIndex,
        });
    }

    // The now-line renders only when the browser's own date matches the
    // island's today - a founder browsing from another timezone gets no
    // misleading line rather than a wrong one.
    const [nowMinutes, setNowMinutes] = useState<number | null>(null);
    useEffect(() => {
        const update = () => {
            const now = new Date();
            setNowMinutes(
                format(now, 'yyyy-MM-dd') === today
                    ? now.getHours() * 60 + now.getMinutes()
                    : null,
            );
        };
        update();
        const id = window.setInterval(update, 60_000);
        return () => window.clearInterval(id);
    }, [today]);
    const nowTop =
        nowMinutes === null
            ? null
            : ((nowMinutes - startHour * 60) / 60) * HOUR_PX;
    const showNowLine =
        nowTop !== null && nowTop >= 0 && days.some((d) => d.date === today);

    return (
        <div className='overflow-hidden rounded-lg border border-border/70 bg-background'>
            {/* Day headers (outside the scrollport so they never leave). */}
            <div className='flex'>
                <div className='flex w-12 shrink-0 items-center justify-center sm:w-14'>
                    <span className='text-2xs text-muted-foreground'>
                        {gmtLabel(timeZone)}
                    </span>
                </div>
                {days.map((day) => {
                    const d = keyToDate(day.date);
                    const isToday = day.date === today;
                    return (
                        <button
                            key={day.date}
                            type='button'
                            onClick={() => onOpenDay(day.date)}
                            className='flex min-w-0 flex-1 items-center justify-center gap-1.5 border-l border-border/50 py-2.5 transition-colors duration-normal hover:bg-muted/50'>
                            <span className='text-2xs font-medium uppercase tracking-wider text-muted-foreground'>
                                {format(d, 'EEE')}
                            </span>
                            <span
                                className={cn(
                                    'flex size-6 items-center justify-center rounded-full text-sm font-medium',
                                    isToday &&
                                        'bg-foreground text-background',
                                )}>
                                {format(d, 'd')}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                ref={scrollRef}
                className='max-h-[62vh] overflow-y-auto overscroll-contain border-t border-border/50'>
                <div className='relative flex'>
                    {/* Hour gutter. */}
                    <div className='relative w-12 shrink-0 sm:w-14'>
                        {hours.map((h) => (
                            <div
                                key={h}
                                className='relative h-14 border-t border-border/40 first:border-t-0'>
                                <span className='absolute -top-2 right-1.5 bg-background px-0.5 text-2xs tabular-nums text-muted-foreground sm:right-2'>
                                    {h === startHour
                                        ? ''
                                        : `${String(h).padStart(2, '0')}:00`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Waton-style now-line: dashed across the whole grid,
                        with a solid dot pinned to today's column. */}
                    {showNowLine && (
                        <div
                            aria-hidden
                            className='pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-destructive/50 top-(--now-top)'
                            {...{
                                style: {
                                    '--now-top': `${nowTop}px`,
                                } as React.CSSProperties,
                            }}
                        />
                    )}

                    {days.map((day, dayIndex) => {
                        const positioned = layoutDay(day.departures, startHour);
                        const isPastDay = day.date < today;
                        return (
                            <div
                                key={day.date}
                                onClick={(e) => handleColumnClick(e, day, dayIndex)}
                                className={cn(
                                    'relative min-w-0 flex-1 border-l border-border/50',
                                    isPastDay && 'bg-muted/20',
                                    canShape && !isPastDay && 'cursor-pointer',
                                )}>
                                {hours.map((h) => (
                                    <div
                                        key={h}
                                        className='h-14 border-t border-border/40 first:border-t-0'
                                    />
                                ))}

                                {/* 03 §8.3: runtime geometry travels through
                                    CSS custom properties; the spread keeps a
                                    literal `style` attribute out of the JSX. */}
                                {positioned.map(({ dep, top, lane, lanes }) => (
                                    <div
                                        key={dep.id}
                                        className='absolute h-12 px-0.5 top-(--dep-top) left-(--dep-left) w-(--dep-w)'
                                        {...{
                                            style: {
                                                '--dep-top': `${top + 1}px`,
                                                '--dep-left': `${(lane / lanes) * 100}%`,
                                                '--dep-w': `${100 / lanes}%`,
                                            } as React.CSSProperties,
                                        }}>
                                        <DepartureChip
                                            dep={dep}
                                            variant='block'
                                            operatorName={
                                                isAdmin
                                                    ? operatorNameById.get(
                                                          dep.operatorId,
                                                      )
                                                    : undefined
                                            }
                                        />
                                    </div>
                                ))}

                                {day.date === today && nowTop !== null && (
                                    <div
                                        aria-hidden
                                        className='pointer-events-none absolute z-10 -ml-1 size-2 -translate-y-1/2 rounded-full bg-destructive top-(--now-top)'
                                        {...{
                                            style: {
                                                '--now-top': `${nowTop}px`,
                                            } as React.CSSProperties,
                                        }}
                                    />
                                )}

                                {addTarget?.dayIndex === dayIndex && (
                                    <Popover
                                        open
                                        onOpenChange={(o) => {
                                            if (!o) setAddTarget(null);
                                        }}>
                                        <PopoverAnchor asChild>
                                            <span
                                                className='absolute left-1/2 size-0 top-(--add-top)'
                                                {...{
                                                    style: {
                                                        '--add-top': `${addTarget.top}px`,
                                                    } as React.CSSProperties,
                                                }}
                                            />
                                        </PopoverAnchor>
                                        <PopoverContent
                                            className='w-80 p-0'
                                            align='start'
                                            collisionPadding={12}
                                            // A Select's portaled dropdown is
                                            // outside this content node; keep
                                            // the card open while it is used.
                                            onInteractOutside={(e) => {
                                                const t = e.target as
                                                    | HTMLElement
                                                    | null;
                                                if (
                                                    t?.closest(
                                                        "[data-slot='select-content']",
                                                    )
                                                ) {
                                                    e.preventDefault();
                                                }
                                            }}>
                                            <AddEventForm
                                                date={addTarget.date}
                                                tours={tours}
                                                defaultTime={addTarget.time}
                                                onDone={() => setAddTarget(null)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
