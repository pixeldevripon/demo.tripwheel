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
                className='w-72 p-0'
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
                <div className='border-b border-border/70 px-3 py-2'>
                    <p className='text-sm font-medium'>
                        {format(keyToDate(date), 'EEEE, d MMMM')}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                        {departures.length}{' '}
                        {departures.length === 1 ? 'departure' : 'departures'}
                    </p>
                </div>
                <div className='flex max-h-80 flex-col gap-1 overflow-y-auto p-2'>
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
            </PopoverContent>
        </Popover>
    );
}
