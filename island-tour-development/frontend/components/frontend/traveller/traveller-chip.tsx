/**
 * Status chips for the traveller account area, per DIT-7 (review F15):
 *
 * - BOOKING STATUS chips are white with an ink label, a hairline border and a
 *   small state dot - state is a fact, not an alarm, so no tinted panels.
 * - PAYMENT chips are green-tint (money settled) or paper (nothing owed /
 *   nothing taken). Colour is never the only cue - every chip carries its
 *   label, and the dot merely echoes it.
 */

type Tone = 'positive' | 'pending' | 'negative' | 'neutral';

/** State-dot colour per tone. Chip chrome itself stays white + hairline. */
const DOT_CLASS: Record<Tone, string> = {
    positive: 'bg-it-green',
    pending: 'bg-it-warning',
    negative: 'bg-it-text-muted',
    neutral: 'bg-it-text-muted',
};

/** Booking display statuses -> tone. Unknown values read neutral. */
const BOOKING_TONE: Record<string, Tone> = {
    CONFIRMED: 'positive',
    REDEEMED: 'neutral',
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
    PARTIALLY_PAID: 'positive',
    UNPAID: 'neutral',
    REFUNDED: 'neutral',
    SUCCEEDED: 'positive',
    PROCESSING: 'pending',
    REQUIRES_PAYMENT: 'pending',
    FAILED: 'negative',
    PARTIALLY_REFUNDED: 'neutral',
    // A voided/never-captured charge: a fact, not an alarm.
    CANCELLED: 'neutral',
};

export function bookingTone(status: string): Tone {
    return BOOKING_TONE[status] ?? 'neutral';
}

export function paymentTone(status: string): Tone {
    return PAYMENT_TONE[status] ?? 'neutral';
}

/** DIT-7 status chip: white, ink label, hairline, state dot. */
export function TravellerChip({
    label,
    tone = 'neutral',
}: {
    label: string;
    tone?: Tone;
}) {
    return (
        <span className='inline-flex items-center gap-1.5 rounded-full border border-it-heading/15 bg-it-white px-2.5 py-1 text-[12px] font-normal text-it-heading'>
            <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${DOT_CLASS[tone]}`}
            />
            {label}
        </span>
    );
}

/** DIT-7 payment chip: green-tint when money is settled, paper otherwise. */
export function TravellerPayChip({
    label,
    settled = true,
}: {
    label: string;
    /** false = "nothing owed / nothing taken" - paper, not green. */
    settled?: boolean;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-normal ${
                settled
                    ? 'bg-it-green-subtle text-it-green'
                    : 'border border-it-heading/15 bg-it-surface text-it-text-muted'
            }`}>
            {label}
        </span>
    );
}

