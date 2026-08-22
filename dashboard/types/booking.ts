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

/**
 * Server-derived status for display. Equals `status`, except a CONFIRMED
 * booking with a pending cancellation request reads CANCELLATION_REQUESTED.
 * Render this in status chips; use `status` for logic. Mirrors the backend
 * `deriveBookingDisplayStatus` in `src/bookings/dto/booking.dto.ts`.
 */
export type BookingDisplayStatus =
    | BookingStatus
    | 'CANCELLATION_REQUESTED'
    | 'OPERATOR_CANCELLATION_REPORTED'
    | 'NON_PAYMENT_REPORTED'
    | 'FORFEITED'
    | 'NO_SHOW_REPORTED'
    | 'NO_SHOW';

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
    /** Derived status for chips (CANCELLATION_REQUESTED overlay). Render this. */
    displayStatus: BookingDisplayStatus;
    freesale: boolean;
    utcExpiresAt: string | null;
    utcConfirmedAt: string | null;
    localDate: string;
    startTime: string | null;
    currency: string;
    /** Null on the MANIFEST projection (conflict #7). */
    totalRetail: string | null;
    depositAmount: string | null;
    balanceAmount: string | null;
    commissionRate: string | null;
    commissionAmount: string | null;
    paymentModel: BookingPaymentModel;
    cancellationRefund: string | null;
    unitItems: Array<{
        id: string;
        ageBandId: string | null;
        status: BookingStatus;
        priceRetail: string | null;
    }>;
    tourName: string;
    contactFullName: string | null;
    /**
     * Null for a manifest-only seat (conflict #7): a guide-level designation
     * without VIEW_BOOKING_FINANCIALS gets who/when/where, no money and no
     * traveler email. Every money field below is nulled the same way.
     */
    contactEmail: string | null;
    /** Manifest fields (conflict #7) - present even without VIEW_BOOKING_FINANCIALS. */
    contactPhone: string | null;
    notes: string | null;
    pickupAddress: string | null;
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    partySize: number;
    createdAt: string;
    utcCancellationRequestedAt: string | null;
    /** Non-payment forfeit lifecycle (guide s15) - drives report/forfeit actions. */
    utcNonPaymentReportedAt: string | null;
    utcForfeitedAt: string | null;
    /** Operator cancellation report (conflict #2) - operators report, admin executes. */
    utcOperatorCancellationReportedAt: string | null;
    operatorCancellationReason: string | null;
    /**
     * No-show (PRD phase 3f) - operators report, only an admin confirms.
     * Confirming records the fact and nothing else: no status change, no refund,
     * no settlement reversal, and nothing sent to the ad platforms (the kept
     * deposit IS the commission). It does suppress the traveller's marketing
     * email, which is why the confirm step is admin-only.
     */
    utcNoShowReportedAt: string | null;
    noShowReason: string | null;
    utcNoShowConfirmedAt: string | null;
    freeCancelDeadline: string | null;
    requestedInFreeWindow: boolean | null;
    /** Ledger-derived: net paid vs totalRetail (see backend derivePaymentState). */
    paymentStatus: BookingPaymentStatus | null;
    /** Net amount paid (SUCCEEDED payments minus refunds), exact decimal string. */
    paidAmount: string | null;
    /**
     * Server verdict on cancellation. Never re-derive this client-side: the
     * start time is a LOCAL wall clock and is meaningless without the tour
     * timezone, which the list payload does not carry.
     */
    canRequestCancellation: boolean;
    cancellationBlockedReason: CancellationBlockedReason | null;
    /** Payout-ledger status; only paid_in_full bookings have one (null otherwise). */
    settlementStatus: SettlementStatus | null;
    /** HOW this booking settles, derived from its payment model (always present). */
    settlementMethod: SettlementMethod;
    /** Payout held by a pending cancellation request (render "On hold"). */
    settlementHeld: boolean;
    /**
     * TRUE refund state from the payment ledger. PENDING = a cancel owes a refund
     * that has NOT executed yet (money still held - e.g. Stripe unconfigured);
     * REFUNDED = the charge was actually returned. Never assume "refunded" from
     * the cancel verdict - render this.
     */
    refundStatus: RefundStatus;
}

export type RefundStatus = 'NONE' | 'PENDING' | 'PARTIAL' | 'REFUNDED';

export type CancellationBlockedReason =
    | 'ALREADY_REQUESTED'
    | 'NOT_CONFIRMED'
    | 'DEPARTED';

export type BookingPaymentStatus =
    | 'PAID'
    | 'PARTIALLY_PAID'
    | 'UNPAID'
    | 'REFUNDED';

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
    /** Accepts derived display statuses too (FORFEITED / NON_PAYMENT_REPORTED / CANCELLATION_REQUESTED). */
    status?: BookingDisplayStatus;
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
    /** Settlement status of the parent booking (null until confirmed). */
    settlementStatus: SettlementStatus | null;
    /** HOW the parent booking settles. */
    settlementMethod: SettlementMethod;
    /** Payout held by a pending cancellation request (render "On hold"). */
    settlementHeld: boolean;
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

// ── Settlements (operator-payout ledger; backend `SettlementListItemDto`) ───────
// Every row is a paid_in_full booking - the only model where Island Tours holds
// money it owes the operator. Payout is MANUAL: PAID_OUT is only ever set by an
// admin's "Mark as paid" after the actual transfer.

export type SettlementStatus =
    | 'RECORDED'
    | 'PAID_OUT'
    | 'INVOICED'
    | 'SETTLED'
    | 'REVERSED';

/** HOW a booking settles (derived from its payment model). */
export type SettlementMethod =
    | 'SELF_SETTLING'
    | 'OPERATOR_PAYOUT'
    | 'COMMISSION_INVOICE';

export interface SettlementSummary {
    /** EUR payout still due to operators (RECORDED nets). */
    owedPending: string;
    owedCount: number;
    /** EUR actually paid out (admin-confirmed). */
    released: string;
    releasedCount: number;
}

export interface SettlementListItem {
    id: string;
    bookingId: string;
    displayRef: string;
    operatorId: string;
    operatorName: string | null;
    tourName: string | null;
    /** All amounts EUR. */
    amountCollected: string;
    commissionOwed: string;
    /** The payout owed to the operator (collected - commission); 0 once REVERSED. */
    netPosition: string;
    /** The amount actually paid out (set when marked paid). */
    operatorPayout: string | null;
    status: SettlementStatus;
    currency: string;
    /** When the admin marked this payout as paid. */
    settledAt: string | null;
    createdAt: string;
    /** Ready to pay: RECORDED, booking stands, no pending request, window closed. */
    payoutEligible: boolean;
    /** WHEN the payout clears (free-cancel window close). */
    payoutReleaseAt: string | null;
    /**
     * RECORDED payout HELD by a pending cancellation request (a refund may
     * still be owed - master 6.4). Must not be paid until resolved - render
     * as "On hold", never "Ready to pay".
     */
    payoutHeld: boolean;
}

/** Result of the mark-paid / mark-unpaid row action. */
export interface SettlementActionResult {
    id: string;
    status: SettlementStatus;
    operatorPayout: string | null;
    settledAt: string | null;
}

export interface PaginatedSettlements {
    total: number;
    page: number;
    limit: number;
    data: SettlementListItem[];
}

export interface SettlementsQueryParams {
    page?: number;
    limit?: number;
    operatorId?: string;
    status?: SettlementStatus;
    /** Booking-reference search (case-insensitive contains). */
    search?: string;
    /** Recorded-at range, YYYY-MM-DD (UTC days). */
    from?: string;
    to?: string;
}

export interface CancelBookingPayload {
    reason?: string;
    /** Admin override of the cancellation-window refund policy. */
    force?: boolean;
}
