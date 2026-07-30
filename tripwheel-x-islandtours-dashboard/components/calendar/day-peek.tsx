'use client';

import { format } from 'date-fns';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { OverviewDeparture } from '@/types/trip';
import { keyToDate } from './calendar-utils';
import { DepartureChip } from './departure-chip';

/**
 * The day card's inner content - shared between the trigger-based DayPeek
 * ("+N more" buttons) and the month cell's click-anywhere controlled popover.
 */
export function DayPeekContent({
    date,
    departures,
    operatorNameById,
    isAdmin,
}: {
    date: string;
    departures: OverviewDeparture[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
}) {
    return (
        <>
            <div className='shrink-0 border-b border-border/70 px-3 py-2'>
                <p className='text-sm font-medium'>
                    {format(keyToDate(date), 'EEEE, d MMMM')}
                </p>
                <p className='text-xs text-muted-foreground'>
                    {departures.length}{' '}
                    {departures.length === 1 ? 'departure' : 'departures'}
                </p>
            </div>
            <div className='flex max-h-80 min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {departures.map((dep) => (
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
            </div>
        </>
    );
}

/**
 * The "+N more" / mobile day card: every departure of one day in a scrollable
 * list of the same chips the grid renders, so the actions are identical
 * wherever a departure is met.
 */
export function DayPeek({
    date,
    departures,
    operatorNameById,
    isAdmin,
    children,
}: {
    date: string;
    departures: OverviewDeparture[];
    operatorNameById: Map<string, string>;
    isAdmin: boolean;
    children: React.ReactNode;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                // Capped at Radix's measured available height so a long day
                // never pushes the card past a phone's screen edges.
                className='flex w-72 flex-col overflow-hidden p-0 max-h-(--radix-popover-content-available-height)'
                align='center'
                collisionPadding={12}
                // The chips inside open their own PORTALED popovers - their
                // content is outside this node, so without this guard a click
                // on a nested management card dismisses the whole peek.
                onInteractOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.closest("[data-slot='popover-content']")) {
                        e.preventDefault();
                    }
                }}>
                <DayPeekContent
                    date={date}
                    departures={departures}
                    operatorNameById={operatorNameById}
                    isAdmin={isAdmin}
                />
            </PopoverContent>
        </Popover>
    );
}
