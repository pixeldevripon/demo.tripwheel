import type {
    BookingPaymentStatus,
    BookingStatus,
    PaymentStatus,
} from '@/types/booking';
import type { OperatorVerificationStatus } from '@/types/operator';
import type {
    AvailabilityScheduleStatus,
    TripStatus,
} from '@/types/trip';
import type { ReviewModerationStatus } from '@/types/review';
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
}

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
    ON_HOLD: { label: 'On hold', variant: 'warning' },
    PENDING: { label: 'Pending', variant: 'warning' },
    CONFIRMED: { label: 'Confirmed', variant: 'success' },
    REDEEMED: { label: 'Redeemed', variant: 'success' },
    EXPIRED: { label: 'Expired', variant: 'neutral' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
    REQUIRES_PAYMENT: { label: 'Requires payment', variant: 'warning' },
    PROCESSING: { label: 'Processing', variant: 'info' },
    SUCCEEDED: { label: 'Succeeded', variant: 'success' },
    FAILED: { label: 'Failed', variant: 'danger' },
    REFUNDED: { label: 'Refunded', variant: 'neutral' },
    PARTIALLY_REFUNDED: { label: 'Partially refunded', variant: 'neutral' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

/**
 * Ledger-derived per-booking payment state (`BookingListItem.paymentStatus`,
 * computed by the backend's derivePaymentState) - shared by the customer
 * views and available to the operator bookings table.
 */
export const BOOKING_PAYMENT_STATE: Record<BookingPaymentStatus, StatusMeta> = {
    PAID: { label: 'Paid', variant: 'success' },
    PARTIALLY_PAID: { label: 'Partially paid', variant: 'warning' },
    UNPAID: { label: 'Unpaid', variant: 'neutral' },
    REFUNDED: { label: 'Refunded', variant: 'info' },
};

export const TRIP_STATUS: Record<TripStatus, StatusMeta> = {
    DRAFT: { label: 'Draft', variant: 'neutral' },
    LIVE: { label: 'Live', variant: 'success' },
    PAUSED: { label: 'Paused', variant: 'warning' },
    ARCHIVED: { label: 'Archived', variant: 'neutral' },
};

export const SCHEDULE_STATUS: Record<AvailabilityScheduleStatus, StatusMeta> = {
    ACTIVE: { label: 'Active', variant: 'success' },
    PAUSED: { label: 'Paused', variant: 'warning' },
};

/** Labels stay in types/tier.ts (SPOTLIGHT_STATUS_LABELS has other importers). */
export const SPOTLIGHT_STATUS: Record<SpotlightStatus, StatusMeta> = {
    REQUESTED: { label: SPOTLIGHT_STATUS_LABELS.REQUESTED, variant: 'warning' },
    APPROVED: { label: SPOTLIGHT_STATUS_LABELS.APPROVED, variant: 'info' },
    ACTIVE: { label: SPOTLIGHT_STATUS_LABELS.ACTIVE, variant: 'success' },
    REJECTED: { label: SPOTLIGHT_STATUS_LABELS.REJECTED, variant: 'danger' },
    EXPIRED: { label: SPOTLIGHT_STATUS_LABELS.EXPIRED, variant: 'neutral' },
};

export const OPERATOR_VERIFICATION: Record<
    OperatorVerificationStatus,
    StatusMeta
> = {
    VERIFIED: { label: 'Verified', variant: 'success' },
    PENDING: { label: 'Pending', variant: 'warning' },
    UNVERIFIED: { label: 'Unverified', variant: 'neutral' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
};

/** Boolean actives (destinations, hubs, categories, collections, operators). */
export const ACTIVE_STATUS: Record<'active' | 'inactive', StatusMeta> = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'neutral' },
};

/** Staff members / team seats (types/staff.ts StaffStatus). */
export const STAFF_MEMBER_STATUS: Record<
    'INVITED' | 'ACTIVE' | 'SUSPENDED',
    StatusMeta
> = {
    INVITED: { label: 'Invited', variant: 'info' },
    ACTIVE: { label: 'Active', variant: 'success' },
    SUSPENDED: { label: 'Suspended', variant: 'danger' },
};

/**
 * Review moderation states.
 *
 * HELD is `info`, not `danger`: it means "needs a second look", not "rejected".
 * A moderator parking a review they cannot decide alone must not read on the
 * screen as one they have thrown out.
 */
export const REVIEW_STATUS: Record<ReviewModerationStatus, StatusMeta> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    APPROVED: { label: 'Approved', variant: 'success' },
    HELD: { label: 'Held', variant: 'info' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
};

/**
 * Customer lifecycle, derived from the booking count rather than a stored
 * column - "how many times have they come back" is the whole of it, so a column
 * would only be a second copy that can go stale.
 */
export type CustomerTier = 'new' | 'repeat' | 'loyal';

export const CUSTOMER_TIER: Record<CustomerTier, StatusMeta> = {
    new: { label: 'New', variant: 'neutral' },
    repeat: { label: 'Repeat', variant: 'info' },
    loyal: { label: 'Loyal', variant: 'success' },
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
    awaiting: { label: 'Awaiting', variant: 'warning' },
    all_reviewed: { label: 'All reviewed', variant: 'success' },
    none: { label: 'No reviews', variant: 'neutral' },
};
