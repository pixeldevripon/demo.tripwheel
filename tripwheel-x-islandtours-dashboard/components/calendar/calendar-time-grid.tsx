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
import { DayPeek } from './day-peek';
import { DepartureChip } from './departure-chip';

// Keep in lockstep with the classes below: hour rows are h-20 (80px), chips
// h-12 (48px). The numbers exist only for position math.
const HOUR_PX = 80;

interface Positioned {
    dep: OverviewDeparture;
    top: number;
    lane: number;
    lanes: number;
}

/** A same-time cluster's hidden tail, rendered as one "+N" chip. */
interface OverflowGroup {
    key: string;
    top: number;
    lanes: number;
    deps: OverviewDeparture[];
}

function minutesOf(dep: OverviewDeparture): number {
    const [h, m] = dep.startTime.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Greedy lane assignment so same-time departures sit side by side. Lanes are
 * counted PER OVERLAP CLUSTER, not per day - a lone 15:00 departure renders
 * full-width even when the 09:00 rush needed three lanes. Clusters denser
 * than `maxLanes` keep the first lanes as chips and fold the rest into a
 * "+N" group - a platform-wide 07:00 rush must never shred the column into
 * sliver-wide chips. A chip occupies one visual hour for overlap purposes.
 */
function layoutDay(
    deps: OverviewDeparture[],
    startHour: number,
    maxLanes: number,
): { chips: Positioned[]; overflows: OverflowGroup[] } {
    const sorted = [...deps].sort(
        (a, b) => minutesOf(a) - minutesOf(b) || a.tourName.localeCompare(b.tourName),
    );
    const chips: Positioned[] = [];
    const overflows: OverflowGroup[] = [];
    let cluster: (Omit<Positioned, 'lanes'> & { start: number })[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -1;
    const flush = () => {
        if (cluster.length === 0) return;
        const lanes = Math.min(laneEnds.length, maxLanes);
        // With overflow, the last lane belongs to the "+N" chip.
        const laneCutoff =
            laneEnds.length > maxLanes ? maxLanes - 1 : maxLanes;
        const hidden = cluster.filter((c) => c.lane >= laneCutoff);
        for (const c of cluster) {
            if (c.lane < laneCutoff) {
                chips.push({ dep: c.dep, lane: c.lane, top: c.top, lanes });
            }
        }
        if (hidden.length > 0) {
            overflows.push({
                key: `${hidden[0].dep.id}-overflow`,
                top: Math.min(...hidden.map((c) => c.top)),
                lanes,
                deps: hidden.map((c) => c.dep),
            });
        }
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
            start,
            top: ((start - startHour * 60) / 60) * HOUR_PX,
        });
    }
    flush();
    return { chips, overflows };
}

/**
 * The Week/Day time grid: one column per day, departures positioned by start
 * time, click on empty space to add a departure/schedule at that hour. Week
 * and Day are the same component - a day is a one-column week. The day
 * header lives INSIDE the scrollport as a sticky row, so header and body
 * columns share one width and the scrollbar never misaligns them.
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
    // A lone day column has room for more side-by-side chips than a week's.
    const maxLanes = days.length === 1 ? 6 : 3;

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
            {/* One scrollport for header + grid: the sticky header row scrolls
                horizontally never (no x overflow) and vertically stays pinned,
                so columns always line up with their headers. Height tracks the
                viewport; the thin themed scrollbar stays visible inside the
                rounded frame. */}
            <div
                ref={scrollRef}
                className='max-h-[calc(100dvh-270px)] min-h-80 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border'>
                <div className='sticky top-0 z-20 flex border-b border-border/50 bg-background'>
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
                                        isToday && 'bg-foreground text-background',
                                    )}>
                                    {format(d, 'd')}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className='relative flex'>
                    {/* Hour gutter. */}
                    <div className='relative w-12 shrink-0 sm:w-14'>
                        {hours.map((h) => (
                            <div
                                key={h}
                                className='relative h-20 border-t border-border/40 first:border-t-0'>
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
                        const { chips, overflows } = layoutDay(
                            day.departures,
                            startHour,
                            maxLanes,
                        );
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
                                        className='h-20 border-t border-border/40 first:border-t-0'
                                    />
                                ))}

                                {/* 03 §8.3: runtime geometry travels through
                                    CSS custom properties; the spread keeps a
                                    literal `style` attribute out of the JSX. */}
                                {chips.map(({ dep, top, lane, lanes }) => (
                                    <div
                                        key={dep.id}
                                        className='absolute h-12 overflow-hidden px-0.5 top-(--dep-top) left-(--dep-left) w-(--dep-w)'
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

                                {/* Dense clusters fold their tail into a "+N"
                                    chip in the last lane - same peek card as
                                    the month view's "+N more". */}
                                {overflows.map((group) => (
                                    <div
                                        key={group.key}
                                        className='absolute h-12 px-0.5 top-(--dep-top) left-(--dep-left) w-(--dep-w)'
                                        {...{
                                            style: {
                                                '--dep-top': `${group.top + 1}px`,
                                                '--dep-left': `${((group.lanes - 1) / group.lanes) * 100}%`,
                                                '--dep-w': `${100 / group.lanes}%`,
                                            } as React.CSSProperties,
                                        }}>
                                        <DayPeek
                                            date={day.date}
                                            departures={group.deps}
                                            operatorNameById={operatorNameById}
                                            isAdmin={isAdmin}>
                                            <button
                                                type='button'
                                                className='flex h-full w-full items-center justify-center rounded-lg bg-muted/70 text-xs font-medium text-muted-foreground transition-colors duration-normal hover:bg-muted'>
                                                +{group.deps.length}
                                            </button>
                                        </DayPeek>
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
