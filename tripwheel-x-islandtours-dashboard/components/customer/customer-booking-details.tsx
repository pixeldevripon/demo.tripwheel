'use client';

import { useEffect, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/common/status-badge';
import {
    BOOKING_PAYMENT_STATE,
    BOOKING_STATUS,
} from '@/components/common/status-maps';
import { useRequestCancellation } from '@/hooks/bookings/use-bookings';
import { bookingMoney } from '@/lib/bookings/format';
import { formatDate } from '@/lib/utils';
import type { BookingListItem } from '@/types/booking';

/**
 * Customer booking quick view - a side sheet with the trip essentials, the
 * ledger-derived payment state, and the cancellation-request flow. The
 * request NEVER cancels on click: it emails the Island Tours admin, who
 * processes the refund (master 6.4) - the sheet says so explicitly.
 */
export function CustomerBookingDetails({
    booking,
    onOpenChange,
}: {
    booking: BookingListItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [reason, setReason] = useState('');
    const requestCancellation = useRequestCancellation();

    // Fresh form per booking (the sheet is reused across rows).
    useEffect(() => setReason(''), [booking?.id]);

    if (!booking) return <Sheet open={false} onOpenChange={onOpenChange} />;

    const statusMeta = BOOKING_STATUS[booking.status];
    const payMeta = BOOKING_PAYMENT_STATE[booking.paymentStatus];
    const alreadyRequested = booking.utcCancellationRequestedAt !== null;
    const canRequest = booking.status === 'CONFIRMED' && !alreadyRequested;

    return (
        <Sheet open onOpenChange={onOpenChange}>
            <SheetContent className='overflow-y-auto sm:max-w-md'>
                <SheetHeader>
                    <SheetTitle className='flex items-center gap-2'>
                        <span className='font-mono'>{booking.displayRef}</span>
                        <StatusBadge variant={statusMeta.variant}>
                            {statusMeta.label}
                        </StatusBadge>
                    </SheetTitle>
                    <SheetDescription>{booking.tourName}</SheetDescription>
                </SheetHeader>

                <div className='divide-y divide-border px-4'>
                    <Section label='Trip'>
                        <Row label='Date'>
                            {formatDate(booking.localDate)}
                            {booking.startTime ? ` · ${booking.startTime}` : ''}
                        </Row>
                        <Row label='Travelers'>{booking.partySize}</Row>
                        <Row label='Booked on'>
                            {formatDate(booking.createdAt)}
                        </Row>
                    </Section>

                    <Section label='Payment'>
                        <Row label='Total'>
                            {bookingMoney(
                                booking.totalRetail,
                                booking.currency,
                            )}
                        </Row>
                        <Row label='Paid'>
                            {bookingMoney(booking.paidAmount, booking.currency)}
                        </Row>
                        <Row label='State'>
                            <StatusBadge variant={payMeta.variant}>
                                {payMeta.label}
                            </StatusBadge>
                        </Row>
                    </Section>

                    <Section label='Cancellation'>
                        {alreadyRequested ? (
                            <div className='space-y-1'>
                                <StatusBadge variant='info'>
                                    Cancellation requested
                                </StatusBadge>
                                <p className='m-0 text-xs text-muted-foreground'>
                                    Requested on{' '}
                                    {formatDate(
                                        booking.utcCancellationRequestedAt!,
                                    )}
                                    . We&apos;ll email you once it has been
                                    processed.
                                </p>
                            </div>
                        ) : canRequest ? (
                            <div className='space-y-2'>
                                <p className='m-0 text-xs text-muted-foreground'>
                                    Requesting a cancellation notifies our team
                                    - nothing is cancelled until we process it
                                    and email you the outcome.
                                </p>
                                <Label
                                    htmlFor='cancel-reason'
                                    className='text-sm'>
                                    Anything we should know? (optional)
                                </Label>
                                <Textarea
                                    id='cancel-reason'
                                    rows={2}
                                    maxLength={500}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                                <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={requestCancellation.isPending}
                                    onClick={() =>
                                        requestCancellation.mutate({
                                            id: booking.id,
                                            reason: reason.trim() || undefined,
                                        })
                                    }
                                    className='text-destructive hover:text-destructive'>
                                    {requestCancellation.isPending
                                        ? 'Sending request…'
                                        : 'Request cancellation'}
                                </Button>
                            </div>
                        ) : (
                            <p className='m-0 text-xs text-muted-foreground'>
                                Only confirmed bookings can request a
                                cancellation.
                            </p>
                        )}
                    </Section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

/** Micro-label section wrapper - mirrors the ops details-sheet style. */
function Section({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className='py-4 first:pt-2'>
            <p className='m-0 mb-2 text-2xs font-semibold uppercase tracking-caps text-content-muted'>
                {label}
            </p>
            <div className='space-y-1'>{children}</div>
        </div>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex items-baseline justify-between gap-3 text-sm'>
            <span className='shrink-0 text-muted-foreground'>{label}</span>
            <span className='text-right font-medium text-foreground'>
                {children}
            </span>
        </div>
    );
}
