'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { DatePickerField } from '@/components/date-picker-field';
import { Button } from '@/components/ui/button';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useCloseRange,
    useRangeImpact,
    useReopenRange,
} from '@/hooks/trips/use-trips';
import type { OverviewTour, RangeImpact, TourClosureReason } from '@/types/trip';
import {
    CLOSURE_REASON_LABEL,
    ClosureReasonTabs,
} from '@/components/common/closure-reason-panel';

/**
 * The global calendar's bulk blackout tool - the per-tour calendar's
 * dual-mode Close/Reopen range dialog with one addition: a tour picker,
 * since this surface spans every tour (the backend range writes are
 * per-tour). Close writes one CLOSE_DATE per day (toast Undo reopens the
 * same bounds); Reopen removes whole-day closures only - single-departure
 * closures and sold-out days are untouched.
 */
const ALL_TOURS = '__all__';

/**
 * The consequence, stated before the button (client review #5): departures,
 * tours and the guests who keep their bookings. Zero departures is still
 * said out loud - closing empty days is legitimate (they stay closed when a
 * schedule later fills them) but the operator should know nothing is hit yet.
 */
export function impactSentence(
    impact: RangeImpact,
    spansTours: boolean,
): string {
    if (impact.departures === 0) {
        return 'No departures are scheduled in these days yet - the days still close.';
    }
    const deps = `${impact.departures} departure${impact.departures === 1 ? '' : 's'}`;
    const tours = spansTours
        ? ` across ${impact.tours} tour${impact.tours === 1 ? '' : 's'}`
        : '';
    const g = impact.bookedGuests;
    const guests =
        g > 0
            ? ` ${g} booked guest${g === 1 ? '' : 's'} keep${g === 1 ? 's' : ''} their booking${g === 1 ? '' : 's'}.`
            : '';
    return `This closes ${deps}${tours}.${guests}`;
}

export function RangeDialog({
    open,
    onOpenChange,
    tours,
    defaultTourId,
    defaultDate,
    operatorId,
    isPlatform = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tours: OverviewTour[];
    defaultTourId?: string;
    /** The day being viewed - a full-day close is then three taps, not a
     *  fresh empty form (MCK-16 §3). */
    defaultDate?: string;
    /** Admin scope for the all-tours option (the backend refuses a
     *  platform-wide blackout without one). */
    operatorId?: string;
    isPlatform?: boolean;
}) {
    const [mode, setMode] = useState<'close' | 'reopen'>('close');
    // All tours preselected (MCK-16 §3: the range tool IS the weather-day
    // action) - unless a tour filter is active, which then scopes it. An
    // admin without an operator filter must pick a tour: the backend refuses
    // an unscoped platform-wide range, so the option is hidden.
    const allToursAllowed = !isPlatform || !!operatorId;
    const [tourId, setTourId] = useState(
        defaultTourId ?? (allToursAllowed ? ALL_TOURS : ''),
    );
    const [from, setFrom] = useState(defaultDate ?? '');
    const [to, setTo] = useState(defaultDate ?? '');
    const [note, setNote] = useState('');
    // Default Not running: a blackout is almost always a not-running act
    // (weather is Not running plus a note); Sold out stays one tap away for
    // the operator whose own channels filled the dates (MCK-15 reason map).
    const [reason, setReason] = useState<TourClosureReason>('NOT_RUNNING');
    const [error, setError] = useState<string | null>(null);
    const { mutate: closeRange, isPending: isClosing } = useCloseRange();
    const { mutate: reopenRange, isPending: isReopening } = useReopenRange();
    const busy = isClosing || isReopening;

    const effectiveTourId =
        tourId || defaultTourId || (allToursAllowed ? ALL_TOURS : '');
    const isAllTours = effectiveTourId === ALL_TOURS;

    // Live impact preview (client review #5) - same scope shape the close
    // itself will send, so the numbers describe exactly this action. Off
    // until the form is complete; an older backend 404s and the counts line
    // simply stays hidden (the locked no-notification line does not).
    const previewEnabled =
        open &&
        mode === 'close' &&
        !!effectiveTourId &&
        !!from &&
        !!to &&
        to >= from;
    const { data: impact, isError: impactUnavailable } = useRangeImpact(
        {
            ...(isAllTours ? {} : { tourId: effectiveTourId }),
            ...(isAllTours && operatorId ? { operatorId } : {}),
            from,
            to,
        },
        previewEnabled,
    );

    function reset() {
        setFrom(defaultDate ?? '');
        setTo(defaultDate ?? '');
        setNote('');
        setReason('NOT_RUNNING');
        setError(null);
    }

    function submit() {
        if (!effectiveTourId) {
            setError('Pick a tour first.');
            return;
        }
        if (!from || !to) {
            setError('Pick both a first and a last day.');
            return;
        }
        if (to < from) {
            setError('The last day cannot be before the first.');
            return;
        }
        setError(null);
        const tripId = isAllTours ? undefined : effectiveTourId;
        const scope = isAllTours && operatorId ? { operatorId } : {};
        const bounds = { from, to };
        if (mode === 'reopen') {
            // No Undo on a bulk reopen, deliberately: re-closing the same
            // bounds would also close days that were OPEN before.
            reopenRange(
                { tripId, payload: { ...bounds, ...scope } },
                {
                    onSuccess: ({ reopened }) => {
                        onOpenChange(false);
                        reset();
                        toast.success(
                            reopened > 0
                                ? `Reopened ${reopened} day-closure${reopened === 1 ? '' : 's'}. New sales are running again.`
                                : 'No day-closures in that range to reopen.',
                        );
                    },
                    onError: (err) =>
                        setError(
                            err instanceof Error
                                ? err.message
                                : 'Failed to reopen the range.',
                        ),
                },
            );
            return;
        }
        closeRange(
            {
                tripId,
                payload: {
                    ...bounds,
                    ...scope,
                    note: note.trim() || undefined,
                    closureReason: reason,
                },
            },
            {
                onSuccess: ({ closed, tourCount }) => {
                    onOpenChange(false);
                    reset();
                    const acrossTours =
                        tourCount != null && tourCount > 1
                            ? ` across ${tourCount} tours`
                            : '';
                    toast.success(
                        closed > 0
                            ? `Closed ${closed} day${closed === 1 ? '' : 's'}${acrossTours} · ${CLOSURE_REASON_LABEL[reason]}. New sales stopped; existing bookings are kept.`
                            : 'Those days were already closed.',
                        closed > 0
                            ? {
                                  action: {
                                      label: 'Undo',
                                      onClick: () =>
                                          reopenRange(
                                              {
                                                  tripId,
                                                  payload: {
                                                      ...bounds,
                                                      ...scope,
                                                  },
                                              },
                                              {
                                                  onSuccess: ({ reopened }) =>
                                                      toast.success(
                                                          `Reopened ${reopened} day-closure${reopened === 1 ? '' : 's'}.`,
                                                      ),
                                                  // A failed undo must never
                                                  // fail silently - the days
                                                  // are still closed.
                                                  onError: (err) =>
                                                      toast.error(
                                                          err instanceof Error
                                                              ? err.message
                                                              : 'Undo failed - the days are still closed.',
                                                      ),
                                              },
                                          ),
                                  },
                              }
                            : undefined,
                    );
                },
                onError: (err) =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to close the range.',
                    ),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'close'
                            ? 'Close a range of dates'
                            : 'Reopen a range of dates'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'close'
                            ? 'Stops new sales on every departure of the tour between the two days, inclusive. Existing bookings are kept.'
                            : 'Removes the day-closures between the two days, inclusive - new sales resume. Single-departure closures and sold-out days are untouched.'}
                    </DialogDescription>
                </DialogHeader>
                <Tabs
                    value={mode}
                    onValueChange={(v) => {
                        setMode(v as 'close' | 'reopen');
                        setError(null);
                    }}>
                    <TabsList>
                        <TabsTrigger value='close'>Close</TabsTrigger>
                        <TabsTrigger value='reopen'>Reopen</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Field>
                    <Label>Tour</Label>
                    <Select
                        value={effectiveTourId}
                        onValueChange={(v) => {
                            setTourId(v);
                            setError(null);
                        }}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Pick a tour' />
                        </SelectTrigger>
                        <SelectContent>
                            {allToursAllowed && (
                                <SelectItem value={ALL_TOURS}>
                                    All tours
                                </SelectItem>
                            )}
                            {tours.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <div className='grid grid-cols-2 gap-3'>
                    <Field>
                        <Label>First day</Label>
                        <DatePickerField
                            value={from}
                            onChange={(v) => {
                                setFrom(v);
                                setError(null);
                            }}
                        />
                    </Field>
                    <Field>
                        <Label>Last day</Label>
                        <DatePickerField
                            value={to}
                            onChange={(v) => {
                                setTo(v);
                                setError(null);
                            }}
                        />
                    </Field>
                </div>
                {mode === 'close' && (
                    <>
                        <Field>
                            <Label>Why</Label>
                            {/* Same two answers as every other close (MCK-16
                                change 1): the word decides what the register
                                and the traveller calendar say on every date
                                in the range. */}
                            <ClosureReasonTabs
                                value={reason}
                                onValueChange={setReason}
                            />
                        </Field>
                        <Field>
                            <Label>Note (optional)</Label>
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder='e.g. Maintenance haul-out'
                                maxLength={500}
                            />
                        </Field>
                        <div className='space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs'>
                            {previewEnabled &&
                                impact &&
                                !impactUnavailable && (
                                    <p className='text-foreground'>
                                        {impactSentence(
                                            impact,
                                            isAllTours || impact.tours > 1,
                                        )}
                                    </p>
                                )}
                            {/* Locked line (client review #5): stated on every
                                close, whatever the counts say - this action
                                never messages a traveller. */}
                            <p className='text-muted-foreground'>
                                Guests are not notified.
                            </p>
                        </div>
                    </>
                )}
                {error && <p className='text-xs text-destructive'>{error}</p>}
                <DialogFooter>
                    <Button
                        variant='ghost'
                        onClick={() => onOpenChange(false)}
                        disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        variant={mode === 'close' ? 'destructive' : 'default'}
                        onClick={submit}
                        disabled={busy}>
                        {busy && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {mode === 'close'
                            ? 'Close these days'
                            : 'Reopen these days'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
