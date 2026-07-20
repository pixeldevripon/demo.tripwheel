import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

// ── Response ────────────────────────────────────────────────────────────────

/**
 * Money on this surface is ALWAYS EUR-normalized. Bookings snapshot
 * `fxRateToEur` at creation, so every payment is converted with the rate that
 * was actually applied to its booking - never a live rate, never a raw mixed
 * currency sum. Callers render these with a euro symbol.
 *
 * Every figure in this payload is also either a FLOW or a STOCK. A FLOW
 * happened during a period (money recognized, bookings created, customers
 * acquired), so the `from`/`to` range filters it on the column that defines it.
 * A STOCK is current state (tours that exist, departures still upcoming,
 * registered accounts) and is NEVER range-filtered, because a stock "between
 * two dates" is not a quantity. Each field says which it is, and the response's
 * `range` block states the window that was applied.
 */
export class RevenueStatsDto {
  @ApiProperty({
    example: 8914.3,
    description:
      'FLOW, ranged on utcRedeemedAt. Recognized earnings in EUR, on COMPLETED (REDEEMED) bookings only, per the master rule that revenue is recognized on tour completion. ADMIN: commission. OPERATOR: retail minus commission.',
  })
  earnedEur!: number;

  @ApiProperty({
    example: 3568.3,
    description:
      'FLOW, ranged on createdAt (nothing is recognized yet, so booking date is the only honest basis). Same measure on CONFIRMED bookings that have not travelled yet - never add it to earnedEur.',
  })
  pendingEur!: number;

  @ApiProperty({
    example: 8914.3,
    description:
      'FLOW. earnedEur recognized inside the comparison window: the selected range, or the current month when no range is set.',
  })
  earnedInRangeEur!: number;

  @ApiProperty({
    example: 0,
    description:
      'FLOW. The same measure over the equal-length window immediately before it (the previous month when no range is set). Zero when no prior window is defined.',
  })
  earnedInPreviousRangeEur!: number;

  @ApiProperty({
    example: 50154.14,
    description:
      'FLOW, ranged on createdAt. Gross merchandise value in EUR across CONFIRMED + REDEEMED bookings.',
  })
  gmvEur!: number;

  @ApiProperty({
    example: 8914.3,
    description:
      'FLOW, ranged on utcRedeemedAt (same recognition basis as earnedEur). Commission on completed bookings. ADMIN: what the marketplace earned. OPERATOR: what they paid the marketplace.',
  })
  commissionEur!: number;

  @ApiProperty({
    example: 11419.19,
    description:
      "FLOW, ranged on utcRedeemedAt. Net owed on completed PAID_IN_FULL bookings, where the platform collected 100% and holds the operator's share. ADMIN: a liability owed OUT. OPERATOR: money owed TO them. No settlements ledger exists yet, so this is the amount earned and not yet settled.",
  })
  payoutDueEur!: number;

  @ApiProperty({
    example: 20404.53,
    description:
      "FLOW, ranged on createdAt (there is no receipt date to window on). Balance on OPERATOR_LINK / ON_ARRIVAL bookings, collected on the operator's own rails. The platform does NOT track whether this was received (master conflict log 84-85), so it is EXPECTED, never confirmed. Surfaces must label it as untracked.",
  })
  untrackedBalanceEur!: number;

  @ApiPropertyOptional({
    example: 23874.29,
    nullable: true,
    description:
      "FLOW, ranged on the payment's createdAt. Cash actually collected through Stripe in EUR. Platform scope only - on the deposit models an operator's takings never flow through this ledger, so it is null for them rather than misleadingly zero.",
  })
  cashCollectedEur!: number | null;

  @ApiPropertyOptional({
    example: 2006.68,
    nullable: true,
    description:
      "FLOW, ranged on the payment's createdAt. Refunded out in EUR (REFUND-kind rows only). Platform scope only.",
  })
  refundedEur!: number | null;
}

/**
 * The booking lifecycle the platform can genuinely observe. Deliberately not a
 * marketing funnel: only the CURRENT status of each booking is stored and there
 * is no view/cart event store, so pre-booking steps cannot be reported honestly.
 */
export class BookingFunnelDto {
  @ApiProperty({
    example: 263,
    description: 'Bookings created in scope, within the range.',
  })
  created!: number;

  @ApiProperty({
    example: 40,
    description: 'Currently holding inventory, awaiting payment.',
  })
  held!: number;

  @ApiProperty({
    example: 11,
    description: 'Holds that timed out before payment.',
  })
  expired!: number;

  @ApiProperty({
    example: 212,
    description: 'Reached commitment: confirmed + completed + cancelled.',
  })
  committed!: number;

  @ApiProperty({ example: 43 })
  confirmed!: number;

  @ApiProperty({ example: 150, description: 'Travelled (REDEEMED).' })
  completed!: number;

  @ApiProperty({ example: 19 })
  cancelled!: number;

  @ApiProperty({
    example: 80.6,
    description: 'Percentage of created bookings that committed.',
  })
  commitRate!: number;

  @ApiProperty({
    example: 70.8,
    description: 'Percentage of committed bookings that travelled.',
  })
  completionRate!: number;

  @ApiProperty({
    example: 4.2,
    description: 'Percentage of created bookings that timed out.',
  })
  expiryRate!: number;

  @ApiProperty({ example: 8.9 })
  cancellationRate!: number;
}

export class BookingStatsDto {
  @ApiProperty({
    example: 263,
    description: 'FLOW, ranged on createdAt. Bookings created in the window.',
  })
  total!: number;

  @ApiProperty({
    example: 263,
    description:
      'FLOW. Created inside the comparison window: the selected range, or the current month when no range is set.',
  })
  inRange!: number;

  @ApiProperty({
    example: 0,
    description:
      'FLOW. Created in the equal-length window immediately before it (the previous month when no range is set).',
  })
  inPreviousRange!: number;

  @ApiProperty({
    example: 22,
    description:
      'STOCK, never range-filtered. CONFIRMED bookings whose travel date is still in the future - forward-looking by definition.',
  })
  upcoming!: number;

  @ApiProperty({
    example: {
      ON_HOLD: 40,
      CONFIRMED: 43,
      REDEEMED: 150,
      CANCELLED: 19,
      EXPIRED: 11,
    },
    description:
      'FLOW, ranged on createdAt. Count per BookingStatus for bookings created in the window. Keys are the real enum values - callers must not relabel REDEEMED as "completed" or ON_HOLD as "draft".',
    additionalProperties: { type: 'number' },
  })
  byStatus!: Record<string, number>;

  @ApiProperty({
    example: 19,
    description: 'Cancelled bookings in the window.',
  })
  cancelled!: number;

  @ApiProperty({
    example: 8.9,
    description:
      'Cancelled as a percentage of committed bookings (confirmed + completed + cancelled).',
  })
  cancellationRate!: number;

  @ApiProperty({
    example: {
      OPERATOR_LINK: 107,
      ON_ARRIVAL: 5,
      PAID_IN_FULL: 81,
      OPERATOR_FULL: 0,
    },
    description:
      "FLOW, ranged on createdAt. Committed bookings per payment model. This is the platform's exposure map: OPERATOR_LINK/ON_ARRIVAL balances are collected off-platform and untracked, PAID_IN_FULL creates a payout liability.",
    additionalProperties: { type: 'number' },
  })
  byPaymentModel!: Record<string, number>;

  @ApiProperty({
    type: BookingFunnelDto,
    description:
      'Where bookings end up, as the platform can actually observe it.',
  })
  funnel!: BookingFunnelDto;
}

export class TripStatsDto {
  @ApiProperty({
    example: 41,
    description:
      'STOCK, never range-filtered. All tours in scope, every status.',
  })
  total!: number;

  @ApiProperty({
    example: 28,
    description:
      'STOCK, never range-filtered. Tours with status LIVE - the genuinely active ones.',
  })
  live!: number;

  @ApiProperty({
    example: 3,
    description:
      'FLOW, ranged on the tour createdAt. Tours created in the comparison window (the current month when no range is set).',
  })
  createdInRange!: number;

  @ApiProperty({
    example: 2,
    description:
      'FLOW. Tours created in the equal-length window immediately before it.',
  })
  createdInPreviousRange!: number;

  @ApiProperty({
    example: 17,
    description:
      'STOCK, never range-filtered. Distinct tours that have at least one booking.',
  })
  withBookings!: number;

  @ApiProperty({
    example: { DRAFT: 8, LIVE: 28, PAUSED: 2, ARCHIVED: 3 },
    description: 'STOCK, never range-filtered.',
    additionalProperties: { type: 'number' },
  })
  byStatus!: Record<string, number>;
}

/**
 * A customer is a distinct BOOKER, keyed by `COALESCE(userId, lower(contactEmail))`.
 * Guest checkout writes `userId: null` and keeps identity on the booking, so
 * counting User rows alone would report zero on real guest traffic while
 * bookings flow. `registered` is reported separately for the account view.
 */
export class CustomerStatsDto {
  @ApiProperty({
    example: 15,
    description:
      'FLOW, ranged on the booker FIRST booking date. Distinct bookers acquired in the window, guests included.',
  })
  total!: number;

  @ApiProperty({
    example: 15,
    description:
      'FLOW. Bookers whose FIRST booking falls in the comparison window (this month when no range is set).',
  })
  newInRange!: number;

  @ApiProperty({
    example: 0,
    description:
      'FLOW. The same over the equal-length window immediately before it.',
  })
  newInPreviousRange!: number;

  @ApiProperty({
    example: 11,
    description:
      'FLOW, ranged on first booking date. Bookers acquired in the window who have more than one booking.',
  })
  repeat!: number;

  @ApiProperty({
    example: 73.3,
    description: 'repeat as a percentage of total.',
  })
  repeatRate!: number;

  @ApiProperty({
    example: 15,
    description:
      'FLOW, ranged on the booker LAST booking date (activity, not acquisition). Bookers who booked inside the comparison window.',
  })
  activeInRange!: number;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      'STOCK, never range-filtered. USER-role accounts on the platform. Platform scope only - null for an operator caller, who cannot see the global account table.',
  })
  registered!: number | null;
}

export class PaymentStatsDto {
  @ApiProperty({
    example: { SUCCEEDED: 188, REQUIRES_PAYMENT: 10, REFUNDED: 34 },
    additionalProperties: { type: 'number' },
  })
  byStatus!: Record<string, number>;
}

export class TrendPointDto {
  @ApiProperty({
    example: '2026-07',
    description: 'Bucket key: YYYY-MM for month, YYYY-MM-DD for day.',
  })
  bucket!: string;

  @ApiProperty({
    example: 'Jul',
    description: 'Short display label for the bucket.',
  })
  label!: string;

  @ApiProperty({
    example: 8914.3,
    description:
      'Earnings RECOGNIZED in this bucket, bucketed by completion date (utcRedeemedAt) rather than booking date - crediting a month for a tour that has not happened would misstate revenue.',
  })
  earnedEur!: number;

  @ApiProperty({
    example: 50154.14,
    description:
      'Booking value created in this bucket, bucketed by booking date.',
  })
  gmvEur!: number;

  @ApiProperty({
    example: 263,
    description: 'Bookings created in this bucket.',
  })
  bookings!: number;
}

export class TrendDto {
  @ApiProperty({ example: 'month', enum: ['month', 'day'] })
  granularity!: 'month' | 'day';

  @ApiProperty({
    type: [TrendPointDto],
    description:
      'One point per bucket, oldest first, INCLUDING empty buckets so the axis is continuous. Every value is a real aggregate - buckets with no activity are genuinely zero.',
  })
  points!: TrendPointDto[];
}

export class RecentBookingDto {
  @ApiProperty({ example: 'c1f3...' })
  id!: string;

  @ApiProperty({ example: 'IT-8FQ2-K3' })
  displayRef!: string;

  @ApiProperty({ example: 'Klein Curacao Sunrise Sail' })
  tourName!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;

  @ApiProperty({ example: 412.5, description: 'Booking total in EUR.' })
  totalEur!: number;

  @ApiProperty({ example: '2026-07-19T09:12:44.000Z' })
  createdAt!: Date;
}

export class RecentPaymentDto {
  @ApiProperty({ example: 'p9a2...' })
  id!: string;

  @ApiProperty({ example: 'IT-8FQ2-K3' })
  displayRef!: string;

  @ApiProperty({ example: 'SUCCEEDED' })
  status!: string;

  @ApiProperty({ example: 'DEPOSIT' })
  kind!: string;

  @ApiProperty({ example: 123.75, description: 'Payment amount in EUR.' })
  amountEur!: number;

  @ApiProperty({ example: '2026-07-19T09:12:46.000Z' })
  createdAt!: Date;
}

export class RecentCustomerDto {
  @ApiProperty({ example: 'Ripon Devripon' })
  name!: string;

  @ApiProperty({
    example: 'd***@g***.com',
    description:
      'Masked - the dashboard never needs a traveler address in full.',
  })
  email!: string;

  @ApiProperty({ example: 2, description: 'Bookings this customer has made.' })
  bookings!: number;

  @ApiProperty({
    example: '2026-07-19T09:12:44.000Z',
    description: 'First booking timestamp.',
  })
  firstBookingAt!: Date;
}

export class RecentActivityDto {
  @ApiProperty({ type: [RecentBookingDto] })
  bookings!: RecentBookingDto[];

  @ApiProperty({ type: [RecentPaymentDto] })
  payments!: RecentPaymentDto[];

  @ApiProperty({ type: [RecentCustomerDto] })
  customers!: RecentCustomerDto[];
}

export class FxDisplayDto {
  @ApiProperty({ example: 'EUR' })
  base!: string;

  @ApiProperty({ example: 'USD' })
  quote!: string;

  @ApiProperty({
    example: 1.08695652,
    description: 'Multiply any EUR figure by this for USD.',
  })
  rate!: number;

  @ApiPropertyOptional({ example: '2026-07-20T00:00:00.000Z', nullable: true })
  asOf!: Date | null;
}

export class TopTourDto {
  @ApiProperty({ example: 'c1f3...' })
  id!: string;

  @ApiProperty({ example: 'Klein Curacao Sunrise Sail' })
  name!: string;

  @ApiProperty({ example: 34 })
  bookings!: number;

  @ApiProperty({
    example: 1820.4,
    description: 'Earnings for the VIEWING audience, in EUR.',
  })
  earnedEur!: number;
}

export class TopOperatorDto {
  @ApiProperty({ example: 'op-1' })
  id!: string;

  @ApiProperty({ example: 'Miss Ann Boat Trips' })
  name!: string;

  @ApiProperty({ example: 61 })
  bookings!: number;

  @ApiProperty({
    example: 2410.9,
    description: 'Commission the platform earned from them, EUR.',
  })
  earnedEur!: number;
}

export class TopDestinationDto {
  @ApiProperty({ example: 'dest-1' })
  id!: string;

  @ApiProperty({ example: 'Curacao' })
  name!: string;

  @ApiProperty({ example: 148 })
  bookings!: number;

  @ApiProperty({ example: 31022.5 })
  gmvEur!: number;
}

export class TierBreakdownDto {
  @ApiProperty({ example: 'premium', description: 'TierKey the tour was on.' })
  tier!: string;

  @ApiProperty({ example: 44 })
  bookings!: number;

  @ApiProperty({
    example: 3110.2,
    description: 'Commission earned from this tier, EUR.',
  })
  earnedEur!: number;
}

/**
 * "Where is the business coming from" tables. The operator/destination/tier
 * leaderboards compare operators against one another, so they are PLATFORM
 * scope only and come back empty for an operator caller.
 */
export class BreakdownsDto {
  @ApiProperty({ type: [TopTourDto] })
  topTours!: TopTourDto[];

  @ApiProperty({ type: [TopOperatorDto], description: 'Platform scope only.' })
  topOperators!: TopOperatorDto[];

  @ApiProperty({
    type: [TopDestinationDto],
    description: 'Platform scope only.',
  })
  topDestinations!: TopDestinationDto[];

  @ApiProperty({
    type: [TierBreakdownDto],
    description: 'Platform scope only.',
  })
  byTier!: TierBreakdownDto[];
}

/**
 * The window that was actually applied, echoed back so the UI can state it in
 * plain words. Without this a reader cannot tell whether a figure covers a week
 * or all of history, which is the whole point of having a range at all.
 */
export class DashboardRangeDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    nullable: true,
    description: 'Inclusive start, YYYY-MM-DD. Null when all time.',
  })
  from!: string | null;

  @ApiPropertyOptional({
    example: '2026-07-20',
    nullable: true,
    description: 'Inclusive end, YYYY-MM-DD. Null means up to now.',
  })
  to!: string | null;

  @ApiProperty({
    example: false,
    description:
      'True when no range was supplied. Flows are unfiltered and growth falls back to this month against last month.',
  })
  isAllTime!: boolean;

  @ApiPropertyOptional({
    example: '2026-06-11',
    nullable: true,
    description:
      'Inclusive start of the equal-length window the growth figures compare against. Null when no prior window is defined.',
  })
  previousFrom!: string | null;

  @ApiPropertyOptional({
    example: '2026-06-30',
    nullable: true,
    description: 'Inclusive end of that comparison window.',
  })
  previousTo!: string | null;
}

export class DashboardStatsDto {
  @ApiProperty({
    example: 'platform',
    enum: ['platform', 'operator'],
    description:
      'Which slice the caller is seeing. Operators get only their own tours, bookings and payments.',
  })
  scope!: 'platform' | 'operator';

  @ApiProperty({
    example: 'EUR',
    description: 'Currency every money field is expressed in.',
  })
  currency!: string;

  @ApiPropertyOptional({
    type: FxDisplayDto,
    nullable: true,
    description:
      'Live EUR->USD rate so the UI can show both currencies from ONE conversion. Null when no fresh rate is available, in which case surfaces show EUR alone rather than converting at a stale rate.',
  })
  fx!: FxDisplayDto | null;

  @ApiProperty({
    example: '2026-07-20T11:02:00.000Z',
    description: 'When these figures were computed.',
  })
  generatedAt!: Date;

  @ApiProperty({
    type: DashboardRangeDto,
    description: 'The reporting window applied to every FLOW in this payload.',
  })
  range!: DashboardRangeDto;

  @ApiProperty({ type: RevenueStatsDto })
  revenue!: RevenueStatsDto;

  @ApiProperty({ type: BookingStatsDto })
  bookings!: BookingStatsDto;

  @ApiProperty({ type: TripStatsDto })
  trips!: TripStatsDto;

  @ApiProperty({ type: CustomerStatsDto })
  customers!: CustomerStatsDto;

  @ApiProperty({ type: PaymentStatsDto })
  payments!: PaymentStatsDto;

  @ApiProperty({ type: TrendDto })
  trend!: TrendDto;

  @ApiProperty({ type: BreakdownsDto })
  breakdowns!: BreakdownsDto;

  @ApiProperty({ type: RecentActivityDto })
  recent!: RecentActivityDto;
}

// ── Query ───────────────────────────────────────────────────────────────────

export class DashboardStatsQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Inclusive start of the reporting window, YYYY-MM-DD. Filters FLOWS only (money recognized, bookings created, customers acquired, tours published); STOCKS such as trips.total, bookings.upcoming and customers.registered are current state and ignore it. Omit both bounds for all time.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a date in YYYY-MM-DD form',
  })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-20',
    description:
      'Inclusive end of the reporting window, YYYY-MM-DD. The whole of this day is included. Growth is measured against the equal-length window immediately before the range.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a date in YYYY-MM-DD form',
  })
  to?: string;

  @ApiPropertyOptional({
    enum: ['month', 'day'],
    default: 'month',
    description: 'Bucket size for the revenue/booking trend series.',
  })
  @IsOptional()
  @IsIn(['month', 'day'])
  granularity?: 'month' | 'day';

  @ApiPropertyOptional({
    example: 6,
    default: 6,
    minimum: 2,
    maximum: 24,
    description:
      'How many trend buckets to return, counting back from today. Ignored when `from` is set: the series is then sized to span the selected range (capped at 24 buckets).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(24)
  buckets?: number;
}
