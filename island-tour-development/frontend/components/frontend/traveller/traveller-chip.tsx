/**
 * Status chips for the traveller account area.
 *
 * The public site has no dashboard `StatusBadge`, so these mirror the token
 * recipe already used by `BookingManageHeader` (green / error / warning
 * subtle). Colour is never the only cue - every chip carries its label.
 */

type Tone = 'positive' | 'pending' | 'negative' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
    positive: 'bg-it-green-subtle text-it-green',
    pending: 'bg-it-warning-subtle text-it-warning',
    negative: 'bg-it-error-subtle text-it-error',
    neutral: 'bg-it-surface text-it-text-muted',
};

/** Booking display statuses -> tone. Unknown values read neutral. */
const BOOKING_TONE: Record<string, Tone> = {
    CONFIRMED: 'positive',
    REDEEMED: 'positive',
    ON_HOLD: 'pending',
    PENDING: 'pending',
    CANCELLATION_REQUESTED: 'pending',
    NON_PAYMENT_REPORTED: 'pending',
    OPERATOR_CANCELLATION_REPORTED: 'pending',
    CANCELLED: 'negative',
    REJECTED: 'negative',
    FORFEITED: 'negative',
    EXPIRED: 'neutral',
};

const PAYMENT_TONE: Record<string, Tone> = {
    PAID: 'positive',
    PARTIALLY_PAID: 'pending',
    UNPAID: 'neutral',
    REFUNDED: 'neutral',
    SUCCEEDED: 'positive',
    PROCESSING: 'pending',
    REQUIRES_PAYMENT: 'pending',
    FAILED: 'negative',
    PARTIALLY_REFUNDED: 'neutral',
};

export function bookingTone(status: string): Tone {
    return BOOKING_TONE[status] ?? 'neutral';
}

export function paymentTone(status: string): Tone {
    return PAYMENT_TONE[status] ?? 'neutral';
}

export function TravellerChip({
    label,
    tone = 'neutral',
}: {
    label: string;
    tone?: Tone;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_CLASS[tone]}`}>
            {label}
        </span>
    );
}
