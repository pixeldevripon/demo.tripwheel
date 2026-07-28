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
    BOOKING_DISPLAY_STATUS,
    BOOKING_PAYMENT_STATE,
} from '@/components/common/status-maps';
import { useRequestCancellation } from '@/hooks/bookings/use-bookings';
import {
    bookingMoney,
    isFreeWindowOpen,
    partyPriceLines,
    paymentModelLabel,
    refundDue,
} from '@/lib/bookings/format';
import { formatDate } from '@/lib/utils';
import { reviewUrl } from '@/lib/public-site';
import type { BookingListItem, BookingPaymentModel } from '@/types/booking';

/**
 * What each payment model means to the TRAVELLER, in their words - the enum
 * label alone ("Operator link") tells a customer nothing about whether they
 * still owe money or to whom.
 */
const PAYMENT_MODEL_NOTE: Record<BookingPaymentModel, string> = {
    OPERATOR_LINK:
        'You paid a deposit to Island Tours. The balance is settled directly with the operator.',
    ON_ARRIVAL: 'You pay the operator in full on the day of your trip.',
    PAID_IN_FULL: 'You paid the full amount to Island Tours up front.',
    OPERATOR_FULL: 'This booking is settled entirely with the operator.',
};

/**
 * Customer booking detail sheet: the trip, what was paid and to whom, and the
 * cancellation flow. Every value is a real field off the booking payload -
 * nothing here is inferred or estimated.
 *
 * The cancellation request NEVER cancels on click (master 6.4): it emails the
 * Island Tours admin, who processes the refund. The UI says so before the
 * traveller commits, and asks for an explicit confirm so a mis-click on a row
 * cannot fire a request.
 */
export function CustomerBookingDetails({
    booking,
    onOpenChange,
}: {
    booking: BookingListItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const requestCancellation = useRequestCancellation();

    // Fresh form per booking (the sheet is reused across rows).
    useEffect(() => {
        setReason('');
        setConfirming(false);
    }, [booking?.id]);

    if (!booking) return <Sheet open={false} onOpenChange={onOpenChange} />;

    const statusMeta = BOOKING_DISPLAY_STATUS[booking.displayStatus];
    // paymentStatus is null only on the manifest projection, which a
    // customer never receives for their own booking - guard anyway so the
    // component cannot crash on an unexpected payload.
    const payMeta = booking.paymentStatus
        ? BOOKING_PAYMENT_STATE[booking.paymentStatus]
        : null;
    const balance = Number(booking.balanceAmount);
    const deposit = Number(booking.depositAmount);
    const partyLines = partyPriceLines(booking);

    return (
        <Sheet open onOpenChange={onOpenChange}>
            <SheetContent className='overflow-y-auto sm:max-w-md'>
                <SheetHeader>
                    <SheetTitle className='flex flex-wrap items-center gap-2'>
                        <span className='font-mono'>{booking.displayRef}</span>
                        <StatusBadge
                            variant={statusMeta.variant}
                            hint={statusMeta.hint}>
                            {statusMeta.label}
                        </StatusBadge>
                        {payMeta && (
                            <StatusBadge
                                variant={payMeta.variant}
                                hint={payMeta.hint}>
                                {payMeta.label}
                            </StatusBadge>
                        )}
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
                        {partyLines.length ? (
                            <Row label='Tickets'>
                                <span className='block'>
                                    {partyLines
                                        .map(l => `${l.count} × ${l.each}`)
                                        .join(', ')}
                                </span>
                            </Row>
                        ) : null}
                        <Row label='Booked on'>
                            {formatDate(booking.createdAt)}
                        </Row>
                        {booking.utcConfirmedAt ? (
                            <Row label='Confirmed'>
                                {formatDate(booking.utcConfirmedAt)}
                            </Row>
                        ) : null}
                    </Section>

                    <Section label='Payment'>
                        <Row label='Trip total'>
                            {bookingMoney(
                                booking.totalRetail,
                                booking.currency,
                            )}
                        </Row>
                        {deposit > 0 ? (
                            <Row label='Deposit'>
                                {bookingMoney(
                                    booking.depositAmount,
                                    booking.currency,
                                )}
                            </Row>
                        ) : null}
                        <Row label='Paid so far'>
                            {bookingMoney(booking.paidAmount, booking.currency)}
                        </Row>
                        {balance > 0 ? (
                            <Row label='Due to operator'>
                                {bookingMoney(
                                    booking.balanceAmount,
                                    booking.currency,
                                )}
                            </Row>
                        ) : null}
                        <Row label='Method'>
                            {paymentModelLabel[booking.paymentModel]}
                        </Row>
                        <p className='m-0 pt-2 text-xs text-muted-foreground'>
                            {PAYMENT_MODEL_NOTE[booking.paymentModel]}
                        </p>
                    </Section>

                    {/* Only on a trip that has actually happened and can still
                        be reviewed - `canReview` is the server's own gate, so
                        this cannot offer a review the API would refuse. The
                        token is a write credential and reaches the client only
                        on the traveller's OWN bookings. */}
                    {booking.review?.canReview && booking.review.reviewToken ? (
                        <Section label='Review'>
                            <p className='m-0 pb-3 text-xs text-muted-foreground'>
                                How was this trip? It takes one tap, and the rest
                                is optional.
                            </p>
                            <Button asChild size='sm' className='w-full'>
                                <a
                                    href={reviewUrl(booking.review.reviewToken)}
                                    target='_blank'
                                    rel='noopener noreferrer'>
                                    Leave a review
                                </a>
                            </Button>
                        </Section>
                    ) : null}

                    {booking.review?.reviewed ? (
                        <Section label='Review'>
                            <p className='m-0 text-xs text-muted-foreground'>
                                Thanks - you have already reviewed this trip.
                            </p>
                        </Section>
                    ) : null}

                    <Section label='Cancellation'>
                        <CancellationPanel
                            booking={booking}
                            reason={reason}
                            onReasonChange={setReason}
                            confirming={confirming}
                            onConfirmingChange={setConfirming}
                            isPending={requestCancellation.isPending}
                            onSubmit={() =>
                                requestCancellation.mutate(
                                    {
                                        id: booking.id,
                                        reason: reason.trim() || undefined,
                                    },
                                    { onSuccess: () => setConfirming(false) },
                                )
                            }
                        />
                    </Section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

/**
 * The cancellation flow, in the four states a traveller can actually be in:
 * already requested, eligible, window closed, or not cancellable at all. Each
 * state says what happens to their money - the single thing they came here to
 * find out.
 */
function CancellationPanel({
    booking,
    reason,
    onReasonChange,
    confirming,
    onConfirmingChange,
    isPending,
    onSubmit,
}: {
    booking: BookingListItem;
    reason: string;
    onReasonChange: (v: string) => void;
    confirming: boolean;
    onConfirmingChange: (v: boolean) => void;
    isPending: boolean;
    onSubmit: () => void;
}) {
    // The server decides eligibility (it holds the tour timezone, which the
    // list payload does not); the UI only renders its verdict.
    const blocked = booking.cancellationBlockedReason;
    const windowOpen = isFreeWindowOpen(booking);

    if (blocked === 'ALREADY_REQUESTED') {
        const refund = refundDue(booking);
        return (
            <div className='space-y-2'>
                <StatusBadge variant='info'>Cancellation requested</StatusBadge>
                <p className='m-0 text-xs text-muted-foreground'>
                    Requested on{' '}
                    {formatDate(booking.utcCancellationRequestedAt)}. We&apos;ll
                    email you once it has been processed.
                </p>
                {booking.requestedInFreeWindow === true ? (
                    <p className='m-0 text-xs text-muted-foreground'>
                        Your request arrived inside the free-cancellation
                        window
                        {refund ? `, so ${refund} is due back to you` : ''}.
                    </p>
                ) : booking.requestedInFreeWindow === false ? (
                    <p className='m-0 text-xs text-muted-foreground'>
                        Your request arrived after the free-cancellation
                        deadline, so a refund is not guaranteed. Our team will
                        confirm the outcome by email.
                    </p>
                ) : null}
            </div>
        );
    }

    if (blocked === 'DEPARTED') {
        return (
            <p className='m-0 text-xs text-muted-foreground'>
                This trip has already departed, so it can no longer be
                cancelled. If something went wrong on the day, contact us and
                we&apos;ll look into it.
            </p>
        );
    }

    if (blocked === 'NOT_CONFIRMED') {
        return (
            <p className='m-0 text-xs text-muted-foreground'>
                Only confirmed bookings can request a cancellation.
            </p>
        );
    }

    return (
        <div className='space-y-2'>
            {windowOpen ? (
                <p className='m-0 text-xs text-muted-foreground'>
                    Free cancellation until{' '}
                    <span className='font-medium text-foreground'>
                        {formatDate(booking.freeCancelDeadline)}
                    </span>
                    . Request before then and you are due a full refund of what
                    you paid Island Tours.
                </p>
            ) : (
                <p className='m-0 text-xs text-muted-foreground'>
                    The free-cancellation deadline
                    {booking.freeCancelDeadline
                        ? ` (${formatDate(booking.freeCancelDeadline)})`
                        : ''}{' '}
                    has passed, so a refund is no longer guaranteed. You can
                    still ask - our team reviews every request.
                </p>
            )}

            {confirming ? (
                <div className='space-y-2'>
                    <Label htmlFor='cancel-reason' className='text-sm'>
                        Anything we should know? (optional)
                    </Label>
                    <Textarea
                        id='cancel-reason'
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={e => onReasonChange(e.target.value)}
                    />
                    <p className='m-0 text-xs text-muted-foreground'>
                        This sends a request to our team. Nothing is cancelled
                        and no money moves until we process it and email you the
                        outcome.
                    </p>
                    <div className='flex flex-wrap gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            disabled={isPending}
                            onClick={onSubmit}
                            className='text-destructive hover:text-destructive'>
                            {isPending
                                ? 'Sending request…'
                                : 'Confirm cancellation request'}
                        </Button>
                        <Button
                            variant='ghost'
                            size='sm'
                            disabled={isPending}
                            onClick={() => onConfirmingChange(false)}>
                            Keep my booking
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onConfirmingChange(true)}>
                    Request cancellation
                </Button>
            )}
        </div>
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
