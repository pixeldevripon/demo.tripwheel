/**
 * Dashboard booking / payment list types - mirror the backend DTOs
 * (`BookingListItemDto`, `PaymentListItemDto` in `src/bookings` / `src/payments`).
 */

export type BookingStatus =
    | 'ON_HOLD'
    | 'CONFIRMED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'REDEEMED'
    | 'PENDING'
    | 'REJECTED';

export type BookingPaymentModel =
    | 'OPERATOR_LINK'
    | 'ON_ARRIVAL'
    | 'PAID_IN_FULL'
    | 'OPERATOR_FULL';

/**
 * FE-12b review affordance. Present ONLY on the self-scoped customer branch of
 * `GET /bookings` - an admin or operator listing other people's bookings never
 * receives one, because `reviewToken` is a WRITE credential: anyone holding it
 * can submit a review as that traveller.
 */
export interface BookingReviewState {
    reviewed: boolean;
    /**
     * Same predicate the create endpoint enforces (completed + tour finished +
     * no existing review + a usable invitation). Gate the CTA on this alone -
     * never on `status`, or the button offers a review the API refuses.
     */
    canReview: boolean;
    reviewToken: string | null;
}

export interface BookingListItem {
    id: string;
    /** Undefined for admin/operator listings - see {@link BookingReviewState}. */
    review?: BookingReviewState;
    displayRef: string;
    publicRef: string;
    tourId: string;
    departureId: string | null;
    status: BookingStatus;
    freesale: boolean;
    utcExpiresAt: string | null;
    utcConfirmedAt: string | null;
    localDate: string;
    startTime: string | null;
    currency: string;
    totalRetail: string;
    depositAmount: string;
    balanceAmount: string;
    commissionRate: string | null;
    commissionAmount: string | null;
    paymentModel: BookingPaymentModel;
    cancellationRefund: string | null;
    unitItems: Array<{
        id: string;
        ageBandId: string | null;
        status: BookingStatus;
        priceRetail: string;
    }>;
    tourName: string;
    contactFullName: string | null;
    contactEmail: string | null;
    partySize: number;
    createdAt: string;
    utcCancellationRequestedAt: string | null;
    freeCancelDeadline: string | null;
    requestedInFreeWindow: boolean | null;
    /** Ledger-derived: net paid vs totalRetail (see backend derivePaymentState). */
    paymentStatus: BookingPaymentStatus;
    /** Net amount paid (SUCCEEDED payments minus refunds), exact decimal string. */
    paidAmount: string;
    /**
     * Server verdict on cancellation. Never re-derive this client-side: the
     * start time is a LOCAL wall clock and is meaningless without the tour
     * timezone, which the list payload does not carry.
     */
    canRequestCancellation: boolean;
    cancellationBlockedReason: CancellationBlockedReason | null;
}

export type CancellationBlockedReason =
    | 'ALREADY_REQUESTED'
    | 'NOT_CONFIRMED'
    | 'DEPARTED';

export type BookingPaymentStatus =
    | 'PAID'
    | 'PARTIALLY_PAID'
    | 'UNPAID'
    | 'REFUNDED';

/** GET /bookings/me/summary - the customer dashboard stat row. */
export interface CustomerBookingSummary {
    bookingsCount: number;
    upcomingCount: number;
    totalSpend: Array<{ currency: string; amount: string }>;
}

export interface PaginatedBookings {
    total: number;
    page: number;
    limit: number;
    data: BookingListItem[];
}

export interface BookingsQueryParams {
    page?: number;
    limit?: number;
    tourId?: string;
    status?: BookingStatus;
    paymentModel?: BookingPaymentModel;
    search?: string;
    /** Travel-date range (localDate), YYYY-MM-DD. */
    from?: string;
    to?: string;
    /** Only bookings with a traveller cancellation request (master 6.4). */
    cancellationRequested?: boolean;
}

export type PaymentProvider = 'STRIPE' | 'MOLLIE';
export type PaymentKind = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'REFUND';
export type PaymentStatus =
    | 'REQUIRES_PAYMENT'
    | 'PROCESSING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED'
    | 'CANCELLED';

export interface PaymentListItem {
    id: string;
    bookingId: string;
    provider: PaymentProvider;
    kind: PaymentKind;
    status: PaymentStatus;
    amount: string;
    currency: string;
    intentId: string | null;
    methodType: string | null;
    createdAt: string;
    updatedAt: string;
    bookingDisplayRef: string;
    bookingPublicRef: string;
    tourName: string;
    contactFullName: string | null;
    bookingLocalDate: string;
    paymentModel: BookingPaymentModel;
}

export interface PaginatedPayments {
    total: number;
    page: number;
    limit: number;
    data: PaymentListItem[];
}

export interface PaymentsQueryParams {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    kind?: PaymentKind;
    provider?: PaymentProvider;
    search?: string;
    /** Created-at range, YYYY-MM-DD (UTC days). */
    from?: string;
    to?: string;
}

export interface CancelBookingPayload {
    reason?: string;
    /** Admin override of the cancellation-window refund policy. */
    force?: boolean;
}
