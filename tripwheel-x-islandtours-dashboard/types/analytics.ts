/**
 * Mirrors `backend/src/analytics/dto/analytics.dto.ts`. Keep the two in sync.
 *
 * Every money field is EUR-normalized backend-side using each booking's
 * snapshotted `fxRateToEur`, so a mixed-currency ledger sums correctly. All
 * counts are live aggregates - there is no placeholder or fallback value
 * anywhere in this payload, so a zero is a genuine zero.
 *
 * The payload is ROLE-SHAPED. The traveler pays the tier-driven deposit to
 * Island Tours (that deposit IS the platform commission) and the operator keeps
 * the balance, so the two audiences hold opposite halves of the same booking:
 * an admin's `earnedEur` is the commission the marketplace made, an operator's
 * is retail minus commission. Read `scope` before labelling anything.
 */

/** Live EUR to USD rate for dual-currency display. Null when none is fresh. */
export interface FxDisplay {
    base: string;
    quote: string;
    /** Multiply any EUR figure by this for its USD equivalent. */
    rate: number;
    asOf: string | null;
}

export interface RevenueStats {
    /**
     * Recognized earnings on COMPLETED (REDEEMED) bookings only - revenue is
     * recognized on tour completion, never at booking.
     * ADMIN: commission. OPERATOR: retail minus commission.
     */
    earnedEur: number;
    /**
     * The same measure on CONFIRMED bookings that have not travelled yet. Real
     * money, not yet earned - never add it into `earnedEur`.
     */
    pendingEur: number;
    /**
     * `earnedEur` recognized inside the comparison window: the selected range,
     * or the current month when no range is set.
     */
    earnedInRangeEur: number;
    /** The same over the equal-length window immediately before it. */
    earnedInPreviousRangeEur: number;
    /** Gross merchandise value across CONFIRMED + REDEEMED bookings. */
    gmvEur: number;
    /**
     * Commission on completed bookings. ADMIN: what the marketplace earned.
     * OPERATOR: what they paid the marketplace.
     */
    commissionEur: number;
    /**
     * Net owed on completed PAID_IN_FULL bookings, where the platform collected
     * 100% and holds the operator's share. No settlements ledger exists yet, so
     * this is strictly "earned and not yet settled".
     */
    payoutDueEur: number;
    /**
     * Balance on OPERATOR_LINK / ON_ARRIVAL bookings, collected on the
     * operator's own rails. The platform does NOT track whether it was
     * received, so it is EXPECTED and must always be labelled untracked.
     */
    untrackedBalanceEur: number;
    /**
     * Cash actually collected through Stripe. Platform scope only - on the
     * deposit models an operator's takings never flow through this ledger, so
     * it is null for them rather than a misleading zero.
     */
    cashCollectedEur: number | null;
    /** Refunded out (REFUND-kind rows only). Platform scope only. */
    refundedEur: number | null;
}

/**
 * The booking lifecycle the platform can genuinely observe. Deliberately NOT a
 * marketing funnel: only a booking's CURRENT status is stored and there is no
 * view/cart event store, so pre-booking steps cannot be reported honestly.
 */
export interface BookingFunnel {
    /** All bookings ever created in scope. */
    created: number;
    /** Currently holding inventory, awaiting payment. */
    held: number;
    /** Holds that timed out before payment. */
    expired: number;
    /** Reached commitment: confirmed + completed + cancelled. */
    committed: number;
    confirmed: number;
    /** Travelled (REDEEMED). */
    completed: number;
    cancelled: number;
    /** Percentage of created bookings that committed. */
    commitRate: number;
    /** Percentage of committed bookings that travelled. */
    completionRate: number;
    /** Percentage of created bookings that timed out. */
    expiryRate: number;
    cancellationRate: number;
}

export interface BookingStats {
    /** FLOW: bookings CREATED in the selected range. */
    total: number;
    inRange: number;
    inPreviousRange: number;
    /** STOCK: forward-looking, never range-filtered. */
    upcoming: number;
    /** Keyed by the real BookingStatus enum values - never relabel the keys. */
    byStatus: Record<string, number>;
    cancelled: number;
    /** Cancelled as a percentage of committed bookings. */
    cancellationRate: number;
    /**
     * Committed bookings per payment model. This is the platform's exposure
     * map: OPERATOR_LINK / ON_ARRIVAL balances are collected off-platform and
     * untracked, PAID_IN_FULL creates a payout liability.
     */
    byPaymentModel: Record<string, number>;
    funnel: BookingFunnel;
}

/** Everything here is a STOCK except the two `created*` flows. */
export interface TripStats {
    total: number;
    live: number;
    createdInRange: number;
    createdInPreviousRange: number;
    withBookings: number;
    /** Keyed by the real TourStatus enum values. */
    byStatus: Record<string, number>;
}

export interface CustomerStats {
    /**
     * FLOW: distinct bookers ACQUIRED in the range (keyed by user id or contact
     * email so guests count), measured on their first booking.
     */
    total: number;
    newInRange: number;
    newInPreviousRange: number;
    repeat: number;
    /** `repeat` as a percentage of `total`. */
    repeatRate: number;
    /** FLOW measured on the LAST booking: bookers active in the window. */
    activeInRange: number;
    /** STOCK: USER-role accounts. Null for an operator caller. */
    registered: number | null;
}

export interface PaymentStats {
    byStatus: Record<string, number>;
}

export interface TrendPoint {
    bucket: string;
    label: string;
    /**
     * Earnings RECOGNIZED in this bucket, bucketed by completion date rather
     * than booking date - crediting a month for a tour that has not happened
     * would misstate revenue.
     */
    earnedEur: number;
    /** Booking value created in this bucket, bucketed by booking date. */
    gmvEur: number;
    /** Bookings created in this bucket. */
    bookings: number;
}

export interface Trend {
    granularity: 'month' | 'day';
    /** Oldest first, INCLUDING empty buckets so the axis stays continuous. */
    points: TrendPoint[];
}

export interface TopTour {
    id: string;
    name: string;
    bookings: number;
    /** Earnings for the VIEWING audience, in EUR. */
    earnedEur: number;
}

export interface TopOperator {
    id: string;
    name: string;
    bookings: number;
    /** Commission the platform earned from them, in EUR. */
    earnedEur: number;
}

export interface TopDestination {
    id: string;
    name: string;
    bookings: number;
    gmvEur: number;
}

export interface TierBreakdown {
    /** The TierKey the tour was on. */
    tier: string;
    bookings: number;
    /** Commission earned from this tier, in EUR. */
    earnedEur: number;
    /**
     * The rate ACTUALLY charged, averaged over this tier's bookings. Comes
     * from the rate snapshotted on each booking rather than the tier's current
     * headline rate, because tier changes are never retroactive - which is why
     * a tier holding Spotlight tours can read above its nominal rate. Null when
     * no booking carried a rate.
     */
    commissionPct: number | null;
}

/**
 * "Where is the business coming from" tables. The operator, destination and
 * tier leaderboards compare operators against one another, so they are PLATFORM
 * scope only and come back as empty arrays for an operator caller.
 */
export interface Breakdowns {
    topTours: TopTour[];
    topOperators: TopOperator[];
    topDestinations: TopDestination[];
    byTier: TierBreakdown[];
}

export interface RecentBooking {
    id: string;
    displayRef: string;
    tourName: string;
    status: string;
    totalEur: number;
    createdAt: string;
}

export interface RecentPayment {
    id: string;
    displayRef: string;
    status: string;
    kind: string;
    amountEur: number;
    createdAt: string;
}

export interface RecentCustomer {
    name: string;
    /** Masked backend-side - dashboard screens get screenshotted. */
    email: string;
    bookings: number;
    firstBookingAt: string;
}

export interface RecentCancellation {
    id: string;
    displayRef: string;
    tourName: string;
    /** Who cancelled: CUSTOMER / OPERATOR / ADMIN. */
    cancelledBy: string | null;
    /** The refund verdict at cancellation (FULL / NONE). */
    cancellationRefund: string | null;
    totalEur: number;
    cancelledAt: string;
}

export interface RecentRefund {
    id: string;
    displayRef: string;
    /** REFUNDED (settled) / PROCESSING (in flight) / FAILED. */
    status: string;
    amountEur: number;
    createdAt: string;
}

export interface RecentActivity {
    bookings: RecentBooking[];
    payments: RecentPayment[];
    customers: RecentCustomer[];
    cancellations: RecentCancellation[];
    refunds: RecentRefund[];
}

/**
 * The window the backend actually applied, so the UI can state it in plain
 * words instead of leaving every figure's period ambiguous. Dates are inclusive
 * `YYYY-MM-DD`; null means unbounded on that side.
 */
export interface DashboardRange {
    from: string | null;
    to: string | null;
    /** No range supplied: flows are unfiltered, growth is month over month. */
    isAllTime: boolean;
    previousFrom: string | null;
    previousTo: string | null;
}

export interface DashboardStats {
    /** Which slice the caller sees. Drives what every money label MEANS. */
    scope: 'platform' | 'operator';
    /** Currency every money field is expressed in. */
    currency: string;
    /**
     * One live EUR to USD rate so the UI converts from a single source and the
     * two readings can never disagree. Null when no fresh rate is available, in
     * which case surfaces show EUR alone rather than converting at a stale rate.
     */
    fx: FxDisplay | null;
    generatedAt: string;
    /** The window applied to every FLOW in this payload. */
    range: DashboardRange;
    revenue: RevenueStats;
    bookings: BookingStats;
    trips: TripStats;
    customers: CustomerStats;
    payments: PaymentStats;
    trend: Trend;
    breakdowns: Breakdowns;
    recent: RecentActivity;
}
