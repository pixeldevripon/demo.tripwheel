import type {
    BookingDisplayStatus,
    BookingPaymentStatus,
    BookingStatus,
    PaymentStatus,
    RefundStatus,
    SettlementMethod,
    SettlementStatus,
} from '@/types/booking';
import type { EmailSendStatus, EmailStream } from '@/types/email';
import type { EmailAudience } from '@/types/email-centre';
import type { OperatorVerificationStatus } from '@/types/operator';
import type {
    AvailabilityScheduleStatus,
    TripApprovalStatus,
    TripStatus,
} from '@/types/trip';
import type { ReviewModerationStatus } from '@/types/review';
import type { CollectionStatus, CollectionType } from '@/types/enums';
import type { PageStatus } from '@/types/pages';
import { SPOTLIGHT_STATUS_LABELS, type SpotlightStatus } from '@/types/tier';
import type { StatusVariant } from './status-badge';

/**
 * One map per domain enum - label AND variant together (03 §5.1).
 *
 * These replace the four incompatible conventions that used to live in
 * booking-columns, payment-columns, spotlight-columns and destination-columns
 * (three parallel Records each: variant + dot + label). A status added to a
 * backend enum gets ONE line here and renders identically on every screen.
 */

export interface StatusMeta {
    label: string;
    variant: StatusVariant;
    /** One-line plain-English meaning, shown as a hover tooltip on the chip. */
    hint?: string;
}

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
    ON_HOLD: {
        label: 'On hold',
        variant: 'warning',
        hint: 'Seats held during checkout; not yet paid',
    },
    PENDING: {
        label: 'Pending',
        variant: 'warning',
        hint: 'Payment started; awaiting confirmation',
    },
    CONFIRMED: {
        label: 'Confirmed',
        variant: 'success',
        hint: 'Paid and confirmed',
    },
    REDEEMED: {
        label: 'Redeemed',
        variant: 'success',
        hint: 'Guest has taken the tour',
    },
    EXPIRED: {
        label: 'Expired',
        variant: 'neutral',
        hint: 'Checkout hold lapsed; seats released',
    },
    CANCELLED: {
        label: 'Cancelled',
        variant: 'danger',
        hint: 'Cancelled; refund handled per policy',
    },
    REJECTED: {
        label: 'Rejected',
        variant: 'danger',
        hint: 'Booking declined; no charge kept',
    },
};

/**
 * Display-status map: every BookingStatus plus the derived CANCELLATION_REQUESTED
 * overlay (a CONFIRMED booking whose traveller has asked to cancel, pending an
 * admin decision). Render `booking.displayStatus` through this map in status
 * chips; the raw `booking.status` stays CONFIRMED for logic. Mirrors the backend
 * `deriveBookingDisplayStatus`.
 */
export const BOOKING_DISPLAY_STATUS: Record<BookingDisplayStatus, StatusMeta> = {
    ...BOOKING_STATUS,
    CANCELLATION_REQUESTED: {
        label: 'Cancellation requested',
        variant: 'warning',
        hint: 'Traveller asked to cancel; awaiting an admin decision',
    },
    OPERATOR_CANCELLATION_REPORTED: {
        label: 'Operator cancellation',
        variant: 'warning',
        hint: 'Operator reported they must cancel; an admin executes the refund or dismisses',
    },
    NON_PAYMENT_REPORTED: {
        label: 'Non-payment reported',
        variant: 'warning',
        hint: 'Operator reported the balance unpaid; awaiting an admin decision',
    },
    FORFEITED: {
        label: 'Forfeited',
        variant: 'danger',
        hint: 'Non-payment confirmed by an admin - deposit kept, spot released',
    },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
    REQUIRES_PAYMENT: {
        label: 'Requires payment',
        variant: 'warning',
        hint: 'Awaiting a successful charge',
    },
    PROCESSING: {
        label: 'Processing',
        variant: 'info',
        hint: 'Charge submitted; awaiting settlement',
    },
    SUCCEEDED: {
        label: 'Succeeded',
        variant: 'success',
        hint: 'Charge captured',
    },
    FAILED: {
        label: 'Failed',
        variant: 'danger',
        hint: 'Charge attempt failed',
    },
    REFUNDED: {
        label: 'Refunded',
        variant: 'neutral',
        hint: 'Full amount refunded to the guest',
    },
    PARTIALLY_REFUNDED: {
        label: 'Partially refunded',
        variant: 'neutral',
        hint: 'Part of the charge refunded to the guest',
    },
    CANCELLED: {
        label: 'Cancelled',
        variant: 'danger',
        hint: 'Payment cancelled before capture',
    },
};

/**
 * Operator-payout lifecycle (`SettlementListItem.status`). Every row is a
 * paid_in_full booking; payout is MANUAL - PAID_OUT always means an admin
 * confirmed the transfer was actually made.
 */
export const SETTLEMENT_STATUS: Record<SettlementStatus, StatusMeta> = {
    RECORDED: {
        label: 'Payout due',
        variant: 'warning',
        hint: 'Island Tours holds this money; the operator has not been paid yet',
    },
    PAID_OUT: {
        label: 'Paid out',
        variant: 'success',
        hint: 'An admin confirmed the transfer to the operator was made',
    },
    INVOICED: {
        label: 'Invoiced',
        variant: 'info',
        hint: 'Commission invoice raised to the operator',
    },
    SETTLED: {
        label: 'Settled',
        variant: 'success',
        hint: 'Settlement closed; balance cleared',
    },
    REVERSED: {
        label: 'Reversed',
        variant: 'neutral',
        hint: 'Booking cancelled - nothing is owed (the traveller refund is tracked separately)',
    },
};

/**
 * TRUE refund state from the payment ledger (never assumed from the cancel
 * verdict). PENDING means a refund is owed but has not executed yet - the money
 * is still held. Only REFUNDED means it actually went back to the traveller.
 */
export const REFUND_STATUS: Record<RefundStatus, StatusMeta> = {
    NONE: {
        label: 'No refund',
        variant: 'neutral',
        hint: 'No refund is owed on this booking',
    },
    PENDING: {
        label: 'Refund pending',
        variant: 'warning',
        hint: 'A refund is owed but has not been processed yet; money still held',
    },
    PARTIAL: {
        label: 'Partially refunded',
        variant: 'info',
        hint: 'Part of the charge has been returned to the traveller',
    },
    REFUNDED: {
        label: 'Refunded',
        variant: 'success',
        hint: 'The charge was returned to the traveller',
    },
};

/** HOW a booking settles - short label (method is not a colored status). */
export const SETTLEMENT_METHOD_LABEL: Record<SettlementMethod, string> = {
    SELF_SETTLING: 'Self-settling',
    OPERATOR_PAYOUT: 'Operator payout',
    COMMISSION_INVOICE: 'Commission invoice',
};

/**
 * Ledger-derived per-booking payment state (`BookingListItem.paymentStatus`,
 * computed by the backend's derivePaymentState) - shared by the customer
 * views and available to the operator bookings table.
 */
export const BOOKING_PAYMENT_STATE: Record<BookingPaymentStatus, StatusMeta> = {
    PAID: { label: 'Paid', variant: 'success', hint: 'Full amount collected' },
    PARTIALLY_PAID: {
        label: 'Partially paid',
        variant: 'warning',
        hint: 'Deposit taken; balance still due',
    },
    UNPAID: {
        label: 'Unpaid',
        variant: 'neutral',
        hint: 'No payment collected yet',
    },
    REFUNDED: {
        label: 'Refunded',
        variant: 'info',
        hint: 'Amount returned to the guest',
    },
};

export const TRIP_STATUS: Record<TripStatus, StatusMeta> = {
    DRAFT: {
        label: 'Draft',
        variant: 'neutral',
        hint: 'Not published; hidden from travelers',
    },
    LIVE: { label: 'Live', variant: 'success', hint: 'Published and bookable' },
    PAUSED: {
        label: 'Paused',
        variant: 'warning',
        hint: 'Temporarily hidden; no new bookings. Island Tours resumes it - use "Ask to go live again" to request that',
    },
    ARCHIVED: {
        label: 'Archived',
        variant: 'neutral',
        hint: 'Retired; kept for records only',
    },
};

/**
 * Approval-workflow overlay (conflict #1). Rendered as a SECONDARY badge next
 * to the trip status while a tour moves through review, whatever status it was
 * submitted from (DRAFT, PAUSED or ARCHIVED - submitting never moves `status`).
 * APPROVED and NOT_SUBMITTED stay silent: the status badge already tells the
 * story.
 */
export const TRIP_APPROVAL_STATUS: Record<TripApprovalStatus, StatusMeta> = {
    NOT_SUBMITTED: {
        label: 'Not submitted',
        variant: 'neutral',
        hint: 'Not yet sent to Island Tours for review',
    },
    PENDING: {
        label: 'In review',
        variant: 'warning',
        hint: 'Awaiting Island Tours approval',
    },
    APPROVED: {
        label: 'Approved',
        variant: 'success',
        hint: 'Approved - Island Tours publishes it',
    },
    REJECTED: {
        label: 'Changes requested',
        variant: 'danger',
        hint: 'See the review note, fix, and resubmit',
    },
};

export const SCHEDULE_STATUS: Record<AvailabilityScheduleStatus, StatusMeta> = {
    ACTIVE: {
        label: 'Active',
        variant: 'success',
        hint: 'Generating departures',
    },
    PAUSED: {
        label: 'Paused',
        variant: 'warning',
        hint: 'Not generating new departures',
    },
};

/** Labels stay in types/tier.ts (SPOTLIGHT_STATUS_LABELS has other importers). */
export const SPOTLIGHT_STATUS: Record<SpotlightStatus, StatusMeta> = {
    REQUESTED: {
        label: SPOTLIGHT_STATUS_LABELS.REQUESTED,
        variant: 'warning',
        hint: 'Awaiting admin approval',
    },
    APPROVED: {
        label: SPOTLIGHT_STATUS_LABELS.APPROVED,
        variant: 'info',
        hint: 'Approved; not yet running',
    },
    ACTIVE: {
        label: SPOTLIGHT_STATUS_LABELS.ACTIVE,
        variant: 'success',
        hint: 'Currently featured in the destination spotlight',
    },
    REJECTED: {
        label: SPOTLIGHT_STATUS_LABELS.REJECTED,
        variant: 'danger',
        hint: 'Spotlight request declined',
    },
    EXPIRED: {
        label: SPOTLIGHT_STATUS_LABELS.EXPIRED,
        variant: 'neutral',
        hint: 'Spotlight run has ended',
    },
};

export const OPERATOR_VERIFICATION: Record<
    OperatorVerificationStatus,
    StatusMeta
> = {
    VERIFIED: {
        label: 'Verified',
        variant: 'success',
        hint: 'Identity and payout details confirmed',
    },
    PENDING: {
        label: 'Pending',
        variant: 'warning',
        hint: 'Verification in progress',
    },
    UNVERIFIED: {
        label: 'Unverified',
        variant: 'neutral',
        hint: 'Not yet submitted for verification',
    },
    REJECTED: {
        label: 'Rejected',
        variant: 'danger',
        hint: 'Verification declined',
    },
};

/** Email send-log rows (types/email.ts EmailSendStatus) - WP-E timelines. */
export const EMAIL_SEND: Record<EmailSendStatus, StatusMeta> = {
    SENT: {
        label: 'Sent',
        variant: 'success',
        hint: 'Handed to the email provider',
    },
    FAILED: {
        label: 'Failed',
        variant: 'danger',
        hint: 'Transport error - the email did not go out',
    },
    SUPPRESSED: {
        label: 'Suppressed',
        variant: 'neutral',
        hint: 'Deliberately not sent - see the recorded reason',
    },
};

/**
 * Email streams (types/email.ts EmailStream) - the WP-H activity log and
 * opt-out list. Categorisation, not health: each stream gets a distinct
 * variant so the mixed global list scans at a glance.
 */
export const EMAIL_STREAM: Record<EmailStream, StatusMeta> = {
    TRANSACTIONAL: {
        label: 'Transactional',
        variant: 'info',
        hint: 'Contractual booking emails - always on, no opt-out',
    },
    LIFECYCLE: {
        label: 'Lifecycle',
        variant: 'success',
        hint: 'Operator onboarding nudges and review requests',
    },
    MARKETING: {
        label: 'Marketing',
        variant: 'warning',
        hint: 'Consent-based promotions (MK-1) - opt-out honoured',
    },
    INTERNAL: {
        label: 'Internal',
        variant: 'neutral',
        hint: 'Sales-pipeline alerts to our own team',
    },
};

/** Crash-proof EMAIL_STREAM lookup - same contract as emailSendMeta below. */
export function emailStreamMeta(stream: string): StatusMeta {
    return (
        EMAIL_STREAM[stream as EmailStream] ?? {
            label: stream,
            variant: 'neutral' as const,
            hint: 'Unrecognized stream (newer backend?)',
        }
    );
}

/** Opt-out audiences (types/email-centre.ts EmailAudience). */
export const EMAIL_AUDIENCE: Record<EmailAudience, StatusMeta> = {
    TRAVELLER: {
        label: 'Traveller',
        variant: 'info',
        hint: 'A customer email address',
    },
    OPERATOR: {
        label: 'Operator',
        variant: 'neutral',
        hint: 'A tour-operator email address',
    },
};

/** Crash-proof EMAIL_AUDIENCE lookup. */
export function emailAudienceMeta(audience: string): StatusMeta {
    return (
        EMAIL_AUDIENCE[audience as EmailAudience] ?? {
            label: audience,
            variant: 'neutral' as const,
            hint: 'Unrecognized audience (newer backend?)',
        }
    );
}

/**
 * Crash-proof EMAIL_SEND lookup. `templateKey` is already widened to string
 * so unknown templates degrade to their raw key; an unknown STATUS from a
 * newer backend must degrade the same way instead of throwing on `.variant`
 * and taking the whole sheet down (the REFUND_STATUS[null] failure class,
 * test report 2026-08-01 §Admin.3).
 */
export function emailSendMeta(status: string): StatusMeta {
    return (
        EMAIL_SEND[status as EmailSendStatus] ?? {
            label: status,
            variant: 'neutral' as const,
            hint: 'Unrecognized send status (newer backend?)',
        }
    );
}

/** Boolean actives (destinations, hubs, categories, collections, operators). */
/** Legal & policy pages (types/pages.ts PageStatus). */
export const PAGE_STATUS: Record<PageStatus, StatusMeta> = {
    DRAFT: {
        label: 'Draft',
        variant: 'neutral',
        hint: 'Not published; the permalink 404s',
    },
    PUBLISHED: {
        label: 'Published',
        variant: 'success',
        hint: 'Live at its permalink on the public site',
    },
    ARCHIVED: {
        label: 'Archived',
        variant: 'neutral',
        hint: 'Retired; kept for records only',
    },
};

/** Collections (types/enums.ts CollectionStatus). */
export const COLLECTION_STATUS: Record<CollectionStatus, StatusMeta> = {
    DRAFT: {
        label: 'Draft',
        variant: 'neutral',
        hint: 'Not published; hidden from travelers',
    },
    PUBLISHED: {
        label: 'Published',
        variant: 'success',
        hint: 'Live on the public site',
    },
    ARCHIVED: {
        label: 'Archived',
        variant: 'neutral',
        hint: 'Retired; kept for records only',
    },
};

/** How a collection picks its tours (types/enums.ts CollectionType). */
export const COLLECTION_TYPE: Record<CollectionType, StatusMeta> = {
    MANUAL: {
        label: 'Manual',
        variant: 'neutral',
        hint: 'Tours curated by hand, in a fixed order',
    },
    DYNAMIC: {
        label: 'Dynamic',
        variant: 'info',
        hint: 'Tours selected automatically by rules',
    },
};

export const ACTIVE_STATUS: Record<'active' | 'inactive', StatusMeta> = {
    active: { label: 'Active', variant: 'success', hint: 'Visible and in use' },
    inactive: {
        label: 'Inactive',
        variant: 'neutral',
        hint: 'Hidden; not in use',
    },
};

/** Staff members / team seats (types/staff.ts StaffStatus). */
export const STAFF_MEMBER_STATUS: Record<
    'INVITED' | 'ACTIVE' | 'SUSPENDED',
    StatusMeta
> = {
    INVITED: {
        label: 'Invited',
        variant: 'info',
        hint: 'Invite sent; not yet accepted',
    },
    ACTIVE: {
        label: 'Active',
        variant: 'success',
        hint: 'Active team member',
    },
    SUSPENDED: {
        label: 'Suspended',
        variant: 'danger',
        hint: 'Access suspended',
    },
};

/**
 * Review moderation states.
 *
 * HELD is `info`, not `danger`: it means "needs a second look", not "rejected".
 * A moderator parking a review they cannot decide alone must not read on the
 * screen as one they have thrown out.
 */
export const REVIEW_STATUS: Record<ReviewModerationStatus, StatusMeta> = {
    PENDING: {
        label: 'Pending',
        variant: 'warning',
        hint: 'Awaiting moderation',
    },
    APPROVED: {
        label: 'Approved',
        variant: 'success',
        hint: 'Published on the site',
    },
    HELD: {
        label: 'Held',
        variant: 'info',
        hint: 'Parked for a second look; not yet decided',
    },
    REJECTED: { label: 'Rejected', variant: 'danger', hint: 'Not published' },
};

/**
 * Customer lifecycle, derived from the booking count rather than a stored
 * column - "how many times have they come back" is the whole of it, so a column
 * would only be a second copy that can go stale.
 */
export type CustomerTier = 'new' | 'repeat' | 'loyal';

export const CUSTOMER_TIER: Record<CustomerTier, StatusMeta> = {
    new: { label: 'New', variant: 'neutral', hint: 'First booking, or none yet' },
    repeat: { label: 'Repeat', variant: 'info', hint: 'Has booked 2-4 times' },
    loyal: {
        label: 'Loyal',
        variant: 'success',
        hint: 'Has booked 5 or more times',
    },
};

export function customerTier(bookingsCount: number): CustomerTier {
    if (bookingsCount >= 5) return 'loyal';
    if (bookingsCount >= 2) return 'repeat';
    return 'new';
}

/**
 * Review standing for a customer row.
 *
 * `warning` on "awaiting" is deliberate: it is the one state on this screen
 * that someone can act on, and the action is one click away in the same row.
 */
export const CUSTOMER_REVIEW_STATE: Record<
    'awaiting' | 'all_reviewed' | 'none',
    StatusMeta
> = {
    awaiting: {
        label: 'Awaiting',
        variant: 'warning',
        hint: 'Has a redeemed tour not yet reviewed',
    },
    all_reviewed: {
        label: 'All reviewed',
        variant: 'success',
        hint: 'Left a review for every eligible tour',
    },
    none: {
        label: 'No reviews',
        variant: 'neutral',
        hint: 'No reviews eligible yet',
    },
};
