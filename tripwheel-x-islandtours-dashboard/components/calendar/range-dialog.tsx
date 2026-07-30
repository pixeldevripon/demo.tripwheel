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
import { useCloseRange, useReopenRange } from '@/hooks/trips/use-trips';
import type { OverviewTour } from '@/types/trip';

/**
 * The global calendar's bulk blackout tool - the per-tour calendar's
 * dual-mode Close/Reopen range dialog with one addition: a tour picker,
 * since this surface spans every tour (the backend range writes are
 * per-tour). Close writes one CLOSE_DATE per day (toast Undo reopens the
 * same bounds); Reopen removes whole-day closures only - single-departure
 * closures and sold-out days are untouched.
 */
export function RangeDialog({
    open,
    onOpenChange,
    tours,
    defaultTourId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tours: OverviewTour[];
    defaultTourId?: string;
}) {
    const [mode, setMode] = useState<'close' | 'reopen'>('close');
    const [tourId, setTourId] = useState(
        defaultTourId ?? (tours.length === 1 ? tours[0].id : ''),
    );
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { mutate: closeRange, isPending: isClosing } = useCloseRange();
    const { mutate: reopenRange, isPending: isReopening } = useReopenRange();
    const busy = isClosing || isReopening;

    // Follow the active tour filter while the dialog is closed.
    const effectiveTourId =
        tourId || defaultTourId || (tours.length === 1 ? tours[0].id : '');

    function reset() {
        setFrom('');
        setTo('');
        setNote('');
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
        const tripId = effectiveTourId;
        const bounds = { from, to };
        if (mode === 'reopen') {
            // No Undo on a bulk reopen, deliberately: re-closing the same
            // bounds would also close days that were OPEN before.
            reopenRange(
                { tripId, payload: bounds },
                {
                    onSuccess: ({ reopened }) => {
                        onOpenChange(false);
                        reset();
                        toast.success(
                            reopened > 0
                                ? `Reopened ${reopened} day${reopened === 1 ? '' : 's'}. New sales are running again.`
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
            { tripId, payload: { ...bounds, note: note.trim() || undefined } },
            {
                onSuccess: ({ closed }) => {
                    onOpenChange(false);
                    reset();
                    toast.success(
                        closed > 0
                            ? `Closed ${closed} day${closed === 1 ? '' : 's'}. New sales stopped; existing bookings are kept.`
                            : 'Those days were already closed.',
                        closed > 0
                            ? {
                                  action: {
                                      label: 'Undo',
                                      onClick: () =>
                                          reopenRange(
                                              { tripId, payload: bounds },
                                              {
                                                  onSuccess: ({ reopened }) =>
                                                      toast.success(
                                                          `Reopened ${reopened} day${reopened === 1 ? '' : 's'}.`,
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
                    <Field>
                        <Label>Reason (optional)</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder='e.g. Maintenance haul-out'
                            maxLength={500}
                        />
                    </Field>
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
