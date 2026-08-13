'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateException, useCreateSchedule } from '@/hooks/trips/use-trips';
import type { OverviewTour } from '@/types/trip';
import { keyToDate } from './calendar-utils';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY_NAMES = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

/** Monday-zero weekday of a 'YYYY-MM-DD' key (platform schedule convention). */
function mondayZeroWeekday(dateKey: string): number {
    return (keyToDate(dateKey).getDay() + 6) % 7;
}

/**
 * The calendar's create popover (the Google-Calendar "add" card): either a
 * one-off extra departure (ADD_SLOT exception - any time, materialized
 * immediately) or a weekly schedule (recurring slot; startTime must be one of
 * the tour's slot times, weekday comes from the picked day). Rendered only
 * for MANAGE_AVAILABILITY - both writes are inventory shaping, which the
 * STOP_SELL-only seat cannot do.
 */
export function AddEventPopover({
    date,
    tours,
    defaultTourId,
    children,
}: {
    date: string;
    tours: OverviewTour[];
    defaultTourId?: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                className='w-80 p-0'
                align='start'
                collisionPadding={12}
                // The form's Selects portal their dropdowns outside this
                // content node; keep the card open while they are used.
                onInteractOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.closest("[data-slot='select-content']")) {
                        e.preventDefault();
                    }
                }}>
                {/* Remount per open: a fresh form every time, nothing stale. */}
                {open && (
                    <AddEventForm
                        date={date}
                        tours={tours}
                        defaultTourId={defaultTourId}
                        onDone={() => setOpen(false)}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}

/**
 * The bare create form, for surfaces that own their Popover (the time grid's
 * click-anywhere add). `defaultTime` prefills the one-off time from the
 * clicked hour row.
 */
export function AddEventForm({
    date,
    tours,
    defaultTourId,
    defaultTime,
    onDone,
}: {
    date: string;
    tours: OverviewTour[];
    defaultTourId?: string;
    defaultTime?: string;
    onDone: () => void;
}) {
    const [mode, setMode] = useState<'once' | 'weekly'>('once');
    const [tourId, setTourId] = useState(
        defaultTourId ?? (tours.length === 1 ? tours[0].id : ''),
    );
    const tour = useMemo(
        () => tours.find((t) => t.id === tourId),
        [tours, tourId],
    );

    const [time, setTime] = useState(defaultTime ?? '');
    const [capacity, setCapacity] = useState('');
    const [touched, setTouched] = useState(false);

    const createException = useCreateException();
    const createSchedule = useCreateSchedule();
    const busy = createException.isPending || createSchedule.isPending;

    const weekday = mondayZeroWeekday(date);
    const capacityValue = capacity === '' ? undefined : Number(capacity);
    const capacityInvalid =
        capacityValue !== undefined &&
        (!Number.isInteger(capacityValue) || capacityValue < 1);

    // Only a TYPED capacity is sent; blank resolves to the tour's
    // maxPartySize on the backend (NOT NULL there). Sending the default
    // explicitly would also turn a plain add into a "capacity change" for
    // the narrow stop-sell seat. UNIT charters never send one - the extra
    // departure IS the second boat (F10).
    const onceCapacity =
        tour?.pricingModel === 'UNIT' ? undefined : capacityValue;
    const timeInvalid =
        mode === 'once' ? !HHMM.test(time) : tour ? !time : true;

    const invalid = !tour || timeInvalid || capacityInvalid;

    function submit() {
        setTouched(true);
        if (invalid || !tour) return;
        if (mode === 'once') {
            createException.mutate(
                {
                    tripId: tour.id,
                    payload: {
                        date,
                        type: 'ADD_SLOT',
                        startTime: time,
                        capacity: onceCapacity,
                    },
                },
                {
                    onSuccess: () => {
                        toast.success(
                            `Extra departure added: ${tour.name} · ${format(keyToDate(date), 'd MMM')} · ${time}.`,
                        );
                        onDone();
                    },
                    onError: (e) =>
                        toast.error(
                            e instanceof Error
                                ? e.message
                                : 'Could not add the departure.',
                        ),
                },
            );
        } else {
            createSchedule.mutate(
                {
                    tripId: tour.id,
                    payload: {
                        weekday,
                        startTime: time,
                        ...(capacityValue !== undefined
                            ? { capacityOverride: capacityValue }
                            : {}),
                        validFrom: date,
                    },
                },
                {
                    onSuccess: () => {
                        toast.success(
                            `Weekly schedule added: ${tour.name}, every ${WEEKDAY_NAMES[weekday]} at ${time}.`,
                        );
                        onDone();
                    },
                    onError: (e) =>
                        toast.error(
                            e instanceof Error
                                ? e.message
                                : 'Could not create the schedule.',
                        ),
                },
            );
        }
    }

    return (
        <div className='p-4'>
            <p className='text-sm font-medium'>
                Add on {format(keyToDate(date), 'EEE d MMM yyyy')}
            </p>
            <Tabs
                value={mode}
                onValueChange={(v) => {
                    setMode(v as 'once' | 'weekly');
                    setTime('');
                    setTouched(false);
                }}
                className='mt-3'>
                <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='once'>One-off departure</TabsTrigger>
                    <TabsTrigger value='weekly'>Weekly schedule</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className='mt-3 flex flex-col gap-3'>
                <div className='flex flex-col gap-1.5'>
                    <Label className='text-xs'>Tour</Label>
                    <Select value={tourId} onValueChange={setTourId}>
                        <SelectTrigger
                            className='w-full'
                            aria-invalid={(touched && !tour) || undefined}>
                            <SelectValue placeholder='Pick a tour' />
                        </SelectTrigger>
                        <SelectContent>
                            {tours.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className='flex items-start gap-3'>
                    <div className='flex flex-1 flex-col gap-1.5'>
                        <Label className='text-xs'>
                            {mode === 'once' ? 'Time (24h)' : 'Slot time'}
                        </Label>
                        {mode === 'once' ? (
                            <Input
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                placeholder='14:30'
                                inputMode='numeric'
                                aria-invalid={(touched && timeInvalid) || undefined}
                                className='h-9'
                            />
                        ) : (
                            <Select
                                value={time}
                                onValueChange={setTime}
                                disabled={!tour || tour.startTimes.length === 0}>
                                <SelectTrigger
                                    className='w-full'
                                    aria-invalid={(touched && timeInvalid) || undefined}>
                                    <SelectValue placeholder='Time' />
                                </SelectTrigger>
                                <SelectContent>
                                    {(tour?.startTimes ?? []).map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    {/* No seat input on a private charter - the extra
                        departure IS the second boat (F10; the wizard's day
                        panel makes the same choice). */}
                    {tour?.pricingModel !== 'UNIT' && (
                        <div className='flex w-24 flex-col gap-1.5'>
                            <Label className='text-xs'>Seats</Label>
                            <Input
                                type='number'
                                min={1}
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                placeholder={
                                    tour ? String(tour.maxPartySize) : ''
                                }
                                aria-invalid={capacityInvalid || undefined}
                                className='h-9'
                            />
                        </div>
                    )}
                </div>
                {tour?.pricingModel === 'UNIT' && (
                    <p className='text-xs text-muted-foreground'>
                        Runs as its own private charter: one booking, up to{' '}
                        {tour.maxPartySize} guests.
                    </p>
                )}

                {mode === 'weekly' && (
                    <p className='text-xs text-muted-foreground'>
                        Repeats every {WEEKDAY_NAMES[weekday]} from{' '}
                        {format(keyToDate(date), 'd MMM yyyy')}, open-ended.
                        {tour && tour.startTimes.length === 0
                            ? ' This tour has no slot times yet - set them on its Schedule step first.'
                            : ''}
                    </p>
                )}

                <div className='flex justify-end'>
                    <Button size='sm' disabled={busy} onClick={submit}>
                        {mode === 'once' ? 'Add departure' : 'Add schedule'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
