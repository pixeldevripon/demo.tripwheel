'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TourClosureReason } from '@/types/trip';

/**
 * The two reasons an operator can give for closing (mck-15 §4), in the order
 * the mockup puts them. One word per idea: "Sold out" here, on the state pill,
 * on the traveller calendar and on the time chips - never "Fully booked".
 *
 * They are not cosmetic. Sold out shows a traveller a struck-through "Sold out"
 * and only the operator reopens it; Not running shows "No departure", plain,
 * because nothing was ever on sale that day. Only Sold out counts toward the
 * §3.7 demand signal.
 */
export const CLOSURE_REASONS = [
    'SOLD_OUT',
    'NOT_RUNNING',
] as const satisfies readonly TourClosureReason[];

export const CLOSURE_REASON_LABEL: Record<TourClosureReason, string> = {
    SOLD_OUT: 'Sold out',
    NOT_RUNNING: 'Not running',
};

/**
 * The reassurance line under the close question. When there are bookings the
 * COUNT is the reassurance: an operator hovering over Close is hesitating over
 * those guests, and a line that reads identically at 0 and at 46 never tells
 * them the blast radius of the act. Only when nothing is booked does the
 * generic guarantee say everything there is to say.
 *
 * Pass the count for the thing actually being closed - one departure's
 * bookedCount when closing that departure, the day's total when closing the
 * day. Quoting a day total on a single-departure close overstates it.
 */
export function closureReassurance(bookedCount: number): string {
    if (bookedCount <= 0) {
        return 'This only stops new sales. Existing bookings are always kept.';
    }
    const one = bookedCount === 1;
    return `${bookedCount} booked guest${one ? '' : 's'} ${
        one ? 'keeps' : 'keep'
    } their booking${one ? '' : 's'}. Closing only stops new sales.`;
}

/**
 * The reason picker for BATCH closes (a range, a whole day) - where the act
 * has its own submit button, so the reason is a field rather than the commit.
 * One component instead of three hand-written Tabs blocks: a third reason is
 * one array entry, everywhere at once. The runtime include() guard keeps a
 * future stray TabsTrigger from smuggling a non-enum value through the cast.
 */
export function ClosureReasonTabs({
    value,
    onValueChange,
}: {
    value: TourClosureReason;
    onValueChange: (reason: TourClosureReason) => void;
}) {
    return (
        <Tabs
            value={value}
            onValueChange={v => {
                if ((CLOSURE_REASONS as readonly string[]).includes(v)) {
                    onValueChange(v as TourClosureReason);
                }
            }}>
            <TabsList className='w-full'>
                {CLOSURE_REASONS.map(reason => (
                    <TabsTrigger
                        key={reason}
                        value={reason}
                        className='flex-1'>
                        {CLOSURE_REASON_LABEL[reason]}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

/**
 * The close question, shared by every surface that closes a departure or a
 * day (MCK-16 change 1): the reason IS the commit - two buttons, not a
 * dropdown plus a Close - with an optional note and a full-width way out.
 * Extracted from the trip wizard's Schedule calendar so the global calendar
 * asks the exact same question with the exact same words.
 */
export function ClosureReasonPanel({
    question,
    reassurance,
    note,
    onNoteChange,
    busy = false,
    pending = false,
    error,
    onCommit,
    onCancel,
}: {
    question: string;
    /**
     * The booked-guests guarantee - shown whether or not the day has bookings.
     * Build it with `closureReassurance()` so every surface says it the same
     * way and names the real count.
     */
    reassurance: string;
    note: string;
    onNoteChange: (value: string) => void;
    busy?: boolean;
    pending?: boolean;
    error?: string | null;
    onCommit: (reason: TourClosureReason) => void;
    onCancel: () => void;
}) {
    return (
        <div className='space-y-2'>
            <Input
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder='Note (optional), e.g. bad weather'
                maxLength={500}
                className='h-8 text-xs'
            />
            {error && <p className='text-xs text-destructive'>{error}</p>}
            <p className='text-xs font-medium'>{question}</p>
            <div className='flex gap-2'>
                {CLOSURE_REASONS.map(reason => (
                    <Button
                        key={reason}
                        size='sm'
                        variant='outline'
                        className='flex-1'
                        disabled={busy}
                        onClick={() => onCommit(reason)}>
                        {pending && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {CLOSURE_REASON_LABEL[reason]}
                    </Button>
                ))}
            </div>
            <p className='text-xs text-muted-foreground'>
                Sold out means the trip is full, however it filled. Not running
                covers weather, maintenance, a day off, anything else.
            </p>
            <p className='text-xs text-muted-foreground'>{reassurance}</p>
            {/* Tapping Stop sales by accident must never force a choice, so
                the way out is a full-width control rather than a small ×
                somewhere. (The panel's own × in the corner dismisses the
                whole card - a different act, and deliberately not this one.) */}
            <Button
                size='sm'
                variant='ghost'
                className='w-full'
                disabled={busy}
                onClick={onCancel}>
                Cancel, leave it open
            </Button>
        </div>
    );
}
