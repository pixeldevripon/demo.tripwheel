import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  PaymentKind,
  PaymentModel,
  PaymentStatus,
  Prisma,
  Role,
  SettlementStatus,
  TourStatus,
} from '@prisma/client';

import { Currency } from '@prisma/client';

import { maskEmail } from '@/bookings/traveler-session.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';

import type {
  DashboardStatsDto,
  DashboardStatsQueryDto,
  ReviewStatsDto,
  TrendPointDto,
} from './dto/analytics.dto';

/**
 * Roles whose analytics are platform-wide rather than operator-scoped. Mirrors
 * `isPlatformWideBookingRole` in bookings.service - the two must agree, or an
 * operator could see a KPI total that its own booking list cannot justify.
 */
function isPlatformWideRole(role: Role): boolean {
  return role === Role.ADMIN || role === Role.STAFF || role === Role.EDITOR;
}

/** Payment kinds that represent money coming IN (a REFUND row is money going out). */
const INBOUND_KINDS = Prisma.sql`('DEPOSIT', 'BALANCE', 'FULL')`;

/**
 * The platform only ever touches its own half of a booking. On these two models
 * the operator collects the balance on their own rails and the platform does
 * NOT track that payment in v1 (master conflict log 84-85), so any figure
 * derived from them is "expected", never "received".
 */
const OPERATOR_RAIL_MODELS = Prisma.sql`('OPERATOR_LINK', 'ON_ARRIVAL')`;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type BucketRow = { bucket: Date; value: number | string | null };

/** Longest trend series the axis stays legible at, and the DTO's `buckets` cap. */
const MAX_TREND_BUCKETS = 24;

/**
 * The reporting window, resolved once per request and threaded into every
 * aggregate.
 *
 * Three windows live here because the dashboard asks three different questions
 * and conflating them is exactly how a KPI stops meaning anything:
 *
 * - `from`/`to` is the SELECTED RANGE. It filters FLOWS only (money recognized,
 *   bookings created, customers acquired). It is never applied to a STOCK -
 *   "how many tours exist" has no meaningful answer "between 1 and 20 July".
 *   Null/null means all time.
 * - `currentFrom`/`currentTo` is the window the growth comparison measures. It
 *   IS the selected range when one is set; with no range it falls back to the
 *   current calendar month, which keeps the default view identical to what it
 *   was before ranges existed.
 * - `previousFrom`/`previousTo` is the window of EQUAL LENGTH immediately
 *   before `current` (the previous calendar month in all-time mode). Comparing
 *   a 7-day range against a 30-day one would manufacture growth out of nothing.
 *
 * Every `*To` bound is EXCLUSIVE internally, because a date-only `to` means
 * "through the end of that day" and `< next midnight` is the only bound that
 * says so without dropping same-day rows.
 */
interface ResolvedRange {
  from: Date | null;
  to: Date | null;
  currentFrom: Date | null;
  currentTo: Date | null;
  previousFrom: Date | null;
  previousTo: Date | null;
  isAllTime: boolean;
  /** Echoed back to the caller so the UI can state the window it is showing. */
  fromIso: string | null;
  toIso: string | null;
  previousFromIso: string | null;
  previousToIso: string | null;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxRatesService,
  ) {}

  /**
   * The EUR to USD rate for dual-currency display. Every money field in this
   * payload is EUR (the booking-snapshotted normalization currency); the UI
   * renders the USD equivalent from this ONE rate so the two readings can
   * never disagree with each other.
   *
   * This is a DISPLAY figure (the UI renders it as "≈"), so it uses the
   * display-grade lookup: fresh preferred, a stale rate within the display
   * window accepted - the ≈USD line must not vanish because one refresh cycle
   * failed. Only when not even a stale rate exists does it fall back to the
   * strict transactional path (which attempts an on-demand provider refresh -
   * the cold-database case). Returns null when no rate is available at all;
   * the UI then shows EUR alone rather than a figure from an invented rate.
   */
  private async getFxDisplay() {
    try {
      const quote =
        (await this.fx.getDisplayRate(Currency.EUR, Currency.USD)) ??
        (await this.fx.getRate(Currency.EUR, Currency.USD));
      return {
        base: Currency.EUR as string,
        quote: Currency.USD as string,
        rate: Number(quote.rate),
        asOf: quote.providerAsOf ?? null,
      };
    } catch {
      this.logger.warn(
        'No EUR->USD rate available (not even stale); dashboard will display EUR only',
      );
      return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Decimal | string | null out of Prisma or raw SQL becomes a plain number. */
  private num(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private startOfMonth(d: Date, offsetMonths = 0): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offsetMonths, 1),
    );
  }

  private startOfDay(d: Date, offsetDays = 0): Date {
    return new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() + offsetDays,
      ),
    );
  }

  /** `YYYY-MM-DD` in UTC - the same shape the query accepts. */
  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Parses a `YYYY-MM-DD` query value as UTC midnight, or rejects it. */
  private parseDate(value: string, field: string): Date {
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        `\`${field}\` must be a valid date in YYYY-MM-DD form.`,
      );
    }
    return d;
  }

  /**
   * `AND <column> >= from AND <column> < to` for whichever bounds exist, or
   * nothing at all when the window is unbounded.
   *
   * Returned as a fragment rather than a whole WHERE clause because most of
   * these aggregates are `FILTER (...)` expressions sharing one scan: each
   * measure carries its OWN dated column (recognition date for earnings,
   * creation date for volume), so a single query-level date predicate would be
   * wrong for at least one of them.
   */
  private rangeFilter(
    column: Prisma.Sql,
    from: Date | null,
    to: Date | null,
  ): Prisma.Sql {
    if (!from && !to) return Prisma.empty;
    const parts: Prisma.Sql[] = [];
    if (from) parts.push(Prisma.sql`AND ${column} >= ${from}`);
    if (to) parts.push(Prisma.sql`AND ${column} < ${to}`);
    return Prisma.join(parts, ' ');
  }

  /** `createdAt` window as a Prisma `where`, for the non-raw count queries. */
  private createdAtWhere(from: Date | null, to: Date | null) {
    if (!from && !to) return {};
    return {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lt: to } : {}),
      },
    };
  }

  private bookingRangeWhere(
    base: Prisma.BookingWhereInput,
    from: Date | null,
    to: Date | null,
  ): Prisma.BookingWhereInput {
    return { ...base, ...this.createdAtWhere(from, to) };
  }

  /**
   * The previous-period filter.
   *
   * When the range has no defined length (only `to` was supplied, so the start
   * is open) there is no equal-length prior window to compare against. This
   * excludes every row rather than degrading to "no filter", which would
   * quietly compare the selected range against the whole of history and report
   * that as period-over-period movement.
   */
  private previousFilter(column: Prisma.Sql, range: ResolvedRange): Prisma.Sql {
    if (!range.previousFrom || !range.previousTo) return Prisma.sql`AND false`;
    return this.rangeFilter(column, range.previousFrom, range.previousTo);
  }

  /**
   * Turns the optional `from`/`to` query pair into the three windows the
   * payload needs. See `ResolvedRange` for why there are three.
   *
   * With neither bound supplied this returns the pre-range behaviour exactly:
   * all-time totals, growth measured this month against last month.
   */
  private resolveRange(
    query: DashboardStatsQueryDto,
    now: Date,
  ): ResolvedRange {
    const fromRaw = query.from ?? null;
    const toRaw = query.to ?? null;

    if (!fromRaw && !toRaw) {
      const thisMonthStart = this.startOfMonth(now);
      return {
        from: null,
        to: null,
        currentFrom: thisMonthStart,
        currentTo: null,
        previousFrom: this.startOfMonth(now, -1),
        previousTo: thisMonthStart,
        isAllTime: true,
        fromIso: null,
        toIso: null,
        previousFromIso: null,
        previousToIso: null,
      };
    }

    const from = fromRaw ? this.parseDate(fromRaw, 'from') : null;
    // `to` names an inclusive DAY, so the exclusive bound is the next midnight.
    // Using the day itself would silently drop everything that happened on it.
    const to = toRaw ? this.startOfDay(this.parseDate(toRaw, 'to'), 1) : null;

    if (from && to && to <= from) {
      throw new BadRequestException('`to` must not be earlier than `from`.');
    }

    // An equal-length prior window needs a start to measure the length from.
    // With only `to` supplied the range is open-ended, so there is no defined
    // "previous period" and the comparison is reported as absent rather than
    // guessed at.
    let previousFrom: Date | null = null;
    let previousTo: Date | null = null;
    if (from) {
      const end = to ?? this.startOfDay(now, 1);
      previousTo = from;
      previousFrom = new Date(
        from.getTime() - (end.getTime() - from.getTime()),
      );
    }

    return {
      from,
      to,
      currentFrom: from,
      currentTo: to,
      previousFrom,
      previousTo,
      isAllTime: false,
      fromIso: fromRaw,
      toIso: toRaw,
      // Reported as INCLUSIVE dates, matching how `from`/`to` are supplied,
      // so the UI can print the previous window without re-deriving it.
      previousFromIso: previousFrom ? this.isoDate(previousFrom) : null,
      previousToIso: previousTo
        ? this.isoDate(new Date(previousTo.getTime() - 1))
        : null,
    };
  }

  /**
   * How many buckets it takes to span the selected range, so the chart covers
   * the window the KPIs above it describe instead of the last N periods from
   * today. Capped, because an axis with hundreds of ticks is not a chart.
   */
  private bucketsForRange(
    granularity: 'month' | 'day',
    from: Date,
    anchor: Date,
  ): number {
    const count =
      granularity === 'month'
        ? (anchor.getUTCFullYear() - from.getUTCFullYear()) * 12 +
          (anchor.getUTCMonth() - from.getUTCMonth()) +
          1
        : Math.floor(
            (this.startOfDay(anchor).getTime() -
              this.startOfDay(from).getTime()) /
              86_400_000,
          ) + 1;

    return Math.min(Math.max(count, 1), MAX_TREND_BUCKETS);
  }

  /**
   * Continuous bucket axis, oldest first, ending on `anchor`. Built in JS
   * rather than from the query result so quiet periods appear as genuine zeros
   * instead of silently collapsing the chart.
   */
  private buildBuckets(
    granularity: 'month' | 'day',
    count: number,
    anchor: Date,
  ) {
    const out: { key: string; label: string; start: Date }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      if (granularity === 'month') {
        const start = this.startOfMonth(anchor, -i);
        out.push({
          key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
          label: MONTH_LABELS[start.getUTCMonth()],
          start,
        });
      } else {
        const start = this.startOfDay(anchor, -i);
        out.push({
          key: start.toISOString().slice(0, 10),
          label: `${start.getUTCDate()} ${MONTH_LABELS[start.getUTCMonth()]}`,
          start,
        });
      }
    }
    return out;
  }

  private bucketKey(d: Date, granularity: 'month' | 'day'): string {
    const iso = d.toISOString();
    return granularity === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Every figure on the dashboard overview, computed from live rows in one
   * call. Nothing here is estimated, extrapolated or defaulted to a
   * placeholder: a zero means the underlying query genuinely returned zero.
   *
   * The payload is ROLE-SHAPED because the two audiences hold opposite ends
   * of the same booking. Per master 1.4/5.8 the traveler pays the tier-driven
   * deposit to Island Tours (which IS the platform commission) and the
   * operator keeps the balance, so "revenue" is a different number for each:
   *
   * - ADMIN    earned = commission. What the marketplace made.
   * - OPERATOR earned = retail minus commission. What the tour made.
   *
   * Both are recognized on COMPLETION (status REDEEMED), per the master's
   * "revenue is recognized on tour completion". Money on bookings that have
   * only been CONFIRMED is reported separately as `pendingEur` so a tour that
   * has not happened yet is never booked as earned.
   *
   * The optional `from`/`to` range applies to FLOWS only - money recognized,
   * bookings created, customers acquired, tours published. STOCKS (how many
   * tours exist, how many departures are still upcoming, how many accounts are
   * registered) are current state and are never date-filtered, because a stock
   * "between two dates" is not a quantity anything can be. The `range` block on
   * the response states which window was applied, so no figure on the screen is
   * left ambiguous about the period it covers.
   */
  /**
   * DASH-9 - review analytics, scoped like every other read here: an operator
   * sees only their own tours, a platform role sees everything.
   *
   * ## Why the trend is bucketed in SQL
   * A rating trend over a year is 12 numbers; pulling every review to average
   * them in JS would move thousands of rows to compute a dozen. `date_trunc`
   * does it in the database, which is also the only way `AVG` stays correct
   * without materialising the set.
   *
   * ## What "velocity" counts
   * Reviews CREATED per bucket, not approved - approval is our latency, not the
   * traveller's behaviour, and mixing them makes a moderation backlog look like
   * a collapse in review volume.
   *
   * Moderation counts are current STATE (how big is the queue right now), so
   * they deliberately ignore the date range - the same stock-vs-flow split the
   * dashboard stats already make.
   */
  async getReviewStats(
    query: DashboardStatsQueryDto,
    actor: { id: string; role: Role },
  ): Promise<ReviewStatsDto> {
    const platformWide = isPlatformWideRole(actor.role);
    const operatorId = platformWide
      ? null
      : await resolveOperatorId(this.prisma, actor.id, actor.role);

    const granularity = query.granularity ?? 'month';
    const range = this.resolveRange(query, new Date());

    const scope = operatorId
      ? Prisma.sql`AND r."operatorId" = ${operatorId}`
      : Prisma.empty;
    const fromClause = range.fromIso
      ? Prisma.sql`AND r."createdAt" >= ${range.fromIso}::timestamp`
      : Prisma.empty;
    const toClause = range.toIso
      ? Prisma.sql`AND r."createdAt" < ${range.toIso}::timestamp`
      : Prisma.empty;

    // Trend + velocity in ONE pass: both are per-bucket aggregates over the
    // same rows, so splitting them would be two scans for one answer.
    const trendRows = await this.prisma.$queryRaw<
      {
        bucket: Date;
        avgrating: number | null;
        created: bigint;
        approved: bigint;
      }[]
    >`
      SELECT date_trunc(${granularity}, r."createdAt") AS bucket,
             AVG(r.rating) FILTER (WHERE r."moderationStatus" = 'APPROVED') AS avgrating,
             COUNT(*) AS created,
             COUNT(*) FILTER (WHERE r."moderationStatus" = 'APPROVED') AS approved
      FROM reviews r
      WHERE 1 = 1 ${scope} ${fromClause} ${toClause}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const where: Prisma.ReviewWhereInput = operatorId ? { operatorId } : {};
    const [byStatus, themeRows, operator] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['moderationStatus'],
        where,
        _count: true,
      }),
      // Theme breakdown over APPROVED only - a rejected review's tags describe
      // something nobody can see.
      this.prisma.review.findMany({
        where: { ...where, moderationStatus: 'APPROVED' },
        select: { themeTags: true },
      }),
      operatorId
        ? this.prisma.operator.findUnique({
            where: { id: operatorId },
            select: {
              aggregateRating: true,
              aggregateReviewCount: true,
              cancellationRate90d: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const themeCounts = new Map<string, number>();
    for (const row of themeRows) {
      for (const tag of row.themeTags) {
        themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
      }
    }

    const statusCount = (status: string) =>
      byStatus.find((b) => b.moderationStatus === status)?._count ?? 0;

    return {
      granularity,
      trend: trendRows.map((r) => ({
        period: r.bucket.toISOString().slice(0, 10),
        avgRating:
          r.avgrating == null
            ? null
            : Math.round(Number(r.avgrating) * 10) / 10,
        created: Number(r.created),
        approved: Number(r.approved),
      })),
      moderation: {
        pending: statusCount('PENDING'),
        approved: statusCount('APPROVED'),
        held: statusCount('HELD'),
        rejected: statusCount('REJECTED'),
      },
      themes: [...themeCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
        .slice(0, 12),
      eligibility: operator
        ? {
            aggregateRating: operator.aggregateRating
              ? Number(operator.aggregateRating)
              : null,
            aggregateReviewCount: operator.aggregateReviewCount,
            cancellationRate90d: Number(operator.cancellationRate90d),
          }
        : null,
    };
  }

  async getDashboardStats(
    query: DashboardStatsQueryDto,
    actor: { id: string; role: Role },
  ): Promise<DashboardStatsDto> {
    const platformWide = isPlatformWideRole(actor.role);
    const operatorId = platformWide
      ? null
      : await resolveOperatorId(this.prisma, actor.id, actor.role);

    const granularity = query.granularity ?? 'month';

    const now = new Date();
    const range = this.resolveRange(query, now);

    const scopeB = operatorId
      ? Prisma.sql`AND b."operatorId" = ${operatorId}`
      : Prisma.empty;
    const bookingWhere: Prisma.BookingWhereInput = operatorId
      ? { operatorId }
      : {};

    // The trend covers the SELECTED window rather than the last N periods from
    // today, so the chart and the KPI cards above it describe the same span.
    // With no range it is unchanged: N buckets counting back from now.
    const trendAnchor = range.to ? new Date(range.to.getTime() - 1) : now;
    const buckets = range.from
      ? this.bucketsForRange(granularity, range.from, trendAnchor)
      : (query.buckets ?? 6);
    const trendStart = this.buildBuckets(granularity, buckets, trendAnchor)[0]
      .start;

    const [
      revenue,
      bookings,
      trips,
      customers,
      payments,
      trend,
      breakdowns,
      recent,
      fx,
    ] = await Promise.all([
      this.getRevenue(scopeB, operatorId, platformWide, range),
      this.getBookings(bookingWhere, scopeB, range, now),
      this.getTrips(operatorId, range),
      this.getCustomers(scopeB, range, platformWide),
      this.getPayments(scopeB, range),
      this.getTrend(
        scopeB,
        platformWide,
        granularity,
        buckets,
        trendStart,
        range.to,
        trendAnchor,
      ),
      this.getBreakdowns(scopeB, platformWide, range),
      this.getRecentActivity(scopeB, bookingWhere),
      this.getFxDisplay(),
    ]);

    return {
      scope: platformWide ? 'platform' : 'operator',
      currency: 'EUR',
      fx,
      generatedAt: now,
      range: {
        from: range.fromIso,
        to: range.toIso,
        isAllTime: range.isAllTime,
        previousFrom: range.previousFromIso,
        previousTo: range.previousToIso,
      },
      revenue,
      bookings,
      trips,
      customers,
      payments,
      trend,
      breakdowns,
      recent,
    };
  }

  /**
   * What "earned" means in SQL for this audience. Admin earns the commission;
   * the operator earns everything except the commission.
   */
  private earnedExpr(platformWide: boolean): Prisma.Sql {
    return platformWide
      ? Prisma.sql`b."commissionAmount"`
      : Prisma.sql`(b."totalEur" - b."commissionAmount")`;
  }

  // ── Revenue ─────────────────────────────────────────────────────────────

  private async getRevenue(
    scopeB: Prisma.Sql,
    operatorId: string | null,
    platformWide: boolean,
    range: ResolvedRange,
  ) {
    const earned = this.earnedExpr(platformWide);

    // Each measure is filtered on the column that DEFINES it. Earnings and the
    // payout liability are recognized on completion, so they key off
    // `utcRedeemedAt`; anything measured at commitment keys off `createdAt`.
    // Filtering both on one column would either credit a range for a tour that
    // has not happened or hide one that completed inside it.
    const redeemedIn = this.rangeFilter(
      Prisma.sql`b."utcRedeemedAt"`,
      range.from,
      range.to,
    );
    const createdIn = this.rangeFilter(
      Prisma.sql`b."createdAt"`,
      range.from,
      range.to,
    );
    const redeemedCurrent = this.rangeFilter(
      Prisma.sql`b."utcRedeemedAt"`,
      range.currentFrom,
      range.currentTo,
    );
    const redeemedPrevious = this.previousFilter(
      Prisma.sql`b."utcRedeemedAt"`,
      range,
    );
    const paidIn = this.rangeFilter(
      Prisma.sql`p."createdAt"`,
      range.from,
      range.to,
    );

    const [rows, ledger, owedOut] = await Promise.all([
      this.prisma.$queryRaw<
        {
          earned: string | null;
          pending: string | null;
          earned_in_range: string | null;
          earned_in_previous_range: string | null;
          gmv: string | null;
          commission: string | null;
          untracked_balance: string | null;
        }[]
      >(Prisma.sql`
                SELECT
                    -- Recognized on completion, per master "revenue is
                    -- recognized on tour completion", so the range applies to
                    -- the completion date and not the booking date.
                    COALESCE(SUM(${earned}) FILTER (WHERE b.status = 'REDEEMED'
                        ${redeemedIn}), 0) AS earned,
                    -- Confirmed but not yet travelled: real money, not yet
                    -- earned. Nothing has been recognized, so the only date
                    -- this can be windowed on is when it was booked.
                    COALESCE(SUM(${earned}) FILTER (WHERE b.status = 'CONFIRMED'
                        ${createdIn}), 0) AS pending,
                    COALESCE(SUM(${earned}) FILTER (WHERE b.status = 'REDEEMED'
                        ${redeemedCurrent}), 0) AS earned_in_range,
                    COALESCE(SUM(${earned}) FILTER (WHERE b.status = 'REDEEMED'
                        ${redeemedPrevious}), 0) AS earned_in_previous_range,
                    COALESCE(SUM(b."totalEur") FILTER (
                        WHERE b.status IN ('CONFIRMED', 'REDEEMED')
                          ${createdIn}), 0) AS gmv,
                    COALESCE(SUM(b."commissionAmount") FILTER (
                        WHERE b.status = 'REDEEMED' ${redeemedIn}), 0) AS commission,
                    -- Balance collected on the operator's own rails. The
                    -- platform never sees this money and does not track whether
                    -- it arrived - expected, never received. There is no
                    -- receipt date to window on, so it follows the booking.
                    COALESCE(SUM(b."balanceAmount" * COALESCE(b."fxRateToEur", 1)) FILTER (
                        WHERE b.status IN ('CONFIRMED', 'REDEEMED')
                          AND b."paymentModel"::text IN ${OPERATOR_RAIL_MODELS}
                          ${createdIn}), 0)
                        AS untracked_balance
                FROM bookings b
                WHERE 1 = 1 ${scopeB}
            `),
      // Stripe cash actually collected. Admin-only: an operator's own
      // takings never flow through this ledger on the deposit models.
      platformWide
        ? this.prisma.$queryRaw<
            { gross: string | null; refunded: string | null }[]
          >(
            Prisma.sql`
                        SELECT
                            -- A refunded charge WAS collected (the original row
                            -- flips SUCCEEDED -> REFUNDED when the refund
                            -- settles), so gross counts both statuses; the
                            -- refund itself is subtracted separately below.
                            COALESCE(SUM(p.amount * COALESCE(b."fxRateToEur", 1))
                                FILTER (WHERE p.status IN ('SUCCEEDED', 'REFUNDED')
                                          AND p.kind::text IN ${INBOUND_KINDS}
                                          ${paidIn}), 0) AS gross,
                            -- Refunds are written TWICE (the original payment
                            -- flips to REFUNDED and a REFUND row is added), so
                            -- only SETTLED REFUND rows are counted here -
                            -- never PROCESSING/FAILED attempts.
                            COALESCE(SUM(p.amount * COALESCE(b."fxRateToEur", 1))
                                FILTER (WHERE p.kind::text = 'REFUND'
                                          AND p.status IN ('SUCCEEDED', 'REFUNDED')
                                          ${paidIn}), 0) AS refunded
                        FROM payments p
                        JOIN bookings b ON b.id = p."bookingId"
                        WHERE 1 = 1 ${scopeB}
                    `,
          )
        : Promise.resolve(null),
      // Payouts due = the SETTLEMENTS LEDGER's owed-pending roll-up, verbatim
      // (same predicate as SettlementsService.summary): RECORDED paid_in_full
      // nets still owed to operators. It is a BALANCE, not a flow - deliberately
      // NOT windowed by the date range, and money an admin already marked paid
      // (PAID_OUT - payout is MANUAL in v1) is excluded - so this card and the
      // Settlements page always show the SAME number. The ledger is the
      // money-movement SSOT (SETTLEMENT-AND-PAYOUTS); analytics must never
      // re-derive owed money from raw bookings.
      this.prisma.settlement.aggregate({
        where: {
          status: SettlementStatus.RECORDED,
          paymentModel: PaymentModel.PAID_IN_FULL,
          netPosition: { gt: 0 },
          ...(operatorId ? { operatorId } : {}),
        },
        _sum: { netPosition: true },
      }),
    ]);

    const r = rows[0];
    return {
      earnedEur: this.num(r?.earned),
      pendingEur: this.num(r?.pending),
      earnedInRangeEur: this.num(r?.earned_in_range),
      earnedInPreviousRangeEur: this.num(r?.earned_in_previous_range),
      gmvEur: this.num(r?.gmv),
      commissionEur: this.num(r?.commission),
      payoutDueEur: this.num(owedOut._sum.netPosition?.toString()),
      untrackedBalanceEur: this.num(r?.untracked_balance),
      cashCollectedEur: ledger ? this.num(ledger[0]?.gross) : null,
      refundedEur: ledger ? this.num(ledger[0]?.refunded) : null,
    };
  }

  // ── Bookings ────────────────────────────────────────────────────────────

  private async getBookings(
    where: Prisma.BookingWhereInput,
    scopeB: Prisma.Sql,
    range: ResolvedRange,
    now: Date,
  ) {
    // Booking volume is a flow measured at COMMITMENT, so every count here
    // except `upcoming` is windowed on when the booking was created.
    const inRangeWhere = this.bookingRangeWhere(where, range.from, range.to);
    const createdIn = this.rangeFilter(
      Prisma.sql`b."createdAt"`,
      range.from,
      range.to,
    );

    const [total, inRange, inPreviousRange, upcoming, grouped, byModelRows] =
      await Promise.all([
        this.prisma.booking.count({ where: inRangeWhere }),
        this.prisma.booking.count({
          where: this.bookingRangeWhere(
            where,
            range.currentFrom,
            range.currentTo,
          ),
        }),
        range.previousFrom && range.previousTo
          ? this.prisma.booking.count({
              where: this.bookingRangeWhere(
                where,
                range.previousFrom,
                range.previousTo,
              ),
            })
          : Promise.resolve(0),
        // STOCK, never range-filtered: "upcoming" is forward-looking by
        // definition. It keys off the booking's own travel date, not the
        // departure relation, so freesale bookings (departureId null) count.
        this.prisma.booking.count({
          where: {
            ...where,
            status: BookingStatus.CONFIRMED,
            localDate: { gte: this.startOfDay(now) },
          },
        }),
        this.prisma.booking.groupBy({
          by: ['status'],
          where: inRangeWhere,
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<{ model: string; count: bigint }[]>(Prisma.sql`
                    SELECT b."paymentModel"::text AS model, COUNT(*) AS count
                    FROM bookings b
                    WHERE b.status IN ('CONFIRMED', 'REDEEMED') ${scopeB} ${createdIn}
                    GROUP BY 1
                `),
      ]);

    // Every enum member is present, so a status with no rows renders as a
    // real 0 rather than vanishing from the chart.
    const byStatus = Object.fromEntries(
      Object.values(BookingStatus).map((s) => [s as string, 0]),
    );
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const byPaymentModel = Object.fromEntries(
      Object.values(PaymentModel).map((m) => [m as string, 0]),
    );
    for (const r of byModelRows) byPaymentModel[r.model] = Number(r.count);

    // Cancellations as a share of everything that was ever committed.
    // ON_HOLD/EXPIRED never reached commitment so they are excluded.
    const cancelled = byStatus[BookingStatus.CANCELLED] ?? 0;
    const held = byStatus[BookingStatus.ON_HOLD] ?? 0;
    const expired = byStatus[BookingStatus.EXPIRED] ?? 0;
    const confirmed = byStatus[BookingStatus.CONFIRMED] ?? 0;
    const completed = byStatus[BookingStatus.REDEEMED] ?? 0;
    const committed = cancelled + confirmed + completed;
    const cancellationRate =
      committed > 0 ? Math.round((cancelled / committed) * 1000) / 10 : 0;

    const pct = (part: number, whole: number) =>
      whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

    /**
     * The booking lifecycle as the platform can actually observe it.
     *
     * This is deliberately NOT a marketing funnel: the platform stores a
     * booking's CURRENT status, not its history, and there is no
     * view/add-to-cart event store, so steps before "booking created"
     * cannot be reported honestly. What it does show is where committed
     * bookings end up, which is the part the data genuinely supports.
     */
    const funnel = {
      created: total,
      held,
      expired,
      committed,
      confirmed,
      completed,
      cancelled,
      /** Share of created bookings that survived the hold and committed. */
      commitRate: pct(committed, total),
      /** Share of committed bookings that were actually travelled. */
      completionRate: pct(completed, committed),
      /** Share of created bookings that timed out before payment. */
      expiryRate: pct(expired, total),
      cancellationRate,
    };

    return {
      total,
      inRange,
      inPreviousRange,
      upcoming,
      cancelled,
      cancellationRate,
      byStatus,
      byPaymentModel,
      funnel,
    };
  }

  // ── Trips ───────────────────────────────────────────────────────────────

  /**
   * `total`, `live`, `byStatus` and `withBookings` are STOCKS - what the
   * catalogue looks like right now - so the range never touches them. Only
   * "how many were created" is a flow.
   */
  private async getTrips(operatorId: string | null, range: ResolvedRange) {
    const where: Prisma.TourWhereInput = operatorId ? { operatorId } : {};

    const [
      total,
      createdInRange,
      createdInPreviousRange,
      grouped,
      withBookings,
    ] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.count({
        where: {
          ...where,
          ...this.createdAtWhere(range.currentFrom, range.currentTo),
        },
      }),
      range.previousFrom && range.previousTo
        ? this.prisma.tour.count({
            where: {
              ...where,
              ...this.createdAtWhere(range.previousFrom, range.previousTo),
            },
          })
        : Promise.resolve(0),
      this.prisma.tour.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.tour.count({ where: { ...where, bookings: { some: {} } } }),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(TourStatus).map((s) => [s as string, 0]),
    );
    for (const g of grouped) byStatus[g.status] = g._count._all;

    return {
      total,
      live: byStatus[TourStatus.LIVE] ?? 0,
      createdInRange,
      createdInPreviousRange,
      withBookings,
      byStatus,
    };
  }

  // ── Customers ───────────────────────────────────────────────────────────

  /**
   * A customer is a distinct BOOKER keyed by `COALESCE(userId, lower(contactEmail))`.
   * Guest checkout writes `userId: null` and keeps identity on the booking, so
   * counting User rows alone would report zero on live guest traffic while
   * bookings flow. "New" is measured from each booker's FIRST booking, which
   * is why it needs the CTE rather than a plain count.
   *
   * The CTE itself is deliberately NOT range-filtered: `first_at` has to be a
   * booker's genuine first booking, so restricting the rows going in would make
   * a returning customer look newly acquired. The range is applied to the
   * counts on top of it. `registered` is a STOCK and stays unfiltered.
   */
  private async getCustomers(
    scopeB: Prisma.Sql,
    range: ResolvedRange,
    platformWide: boolean,
  ) {
    const acquiredIn = this.rangeFilter(
      Prisma.sql`first_at`,
      range.from,
      range.to,
    );
    const acquiredCurrent = this.rangeFilter(
      Prisma.sql`first_at`,
      range.currentFrom,
      range.currentTo,
    );
    const acquiredPrevious = this.previousFilter(Prisma.sql`first_at`, range);
    // "Active" is about the last time they booked, not when they were acquired.
    const activeCurrent = this.rangeFilter(
      Prisma.sql`last_at`,
      range.currentFrom,
      range.currentTo,
    );

    const [rows, registered] = await Promise.all([
      this.prisma.$queryRaw<
        {
          total: bigint;
          new_in_range: bigint;
          new_in_previous_range: bigint;
          repeat_customers: bigint;
          active_in_range: bigint;
        }[]
      >(Prisma.sql`
                WITH per_customer AS (
                    SELECT
                        COALESCE(b."userId", lower(b."contactEmail")) AS customer_key,
                        MIN(b."createdAt") AS first_at,
                        MAX(b."createdAt") AS last_at,
                        COUNT(*) AS booking_count
                    FROM bookings b
                    WHERE COALESCE(b."userId", lower(b."contactEmail")) IS NOT NULL ${scopeB}
                    GROUP BY 1
                )
                SELECT
                    COUNT(*) FILTER (WHERE TRUE ${acquiredIn}) AS total,
                    COUNT(*) FILTER (WHERE TRUE ${acquiredCurrent}) AS new_in_range,
                    COUNT(*) FILTER (WHERE TRUE ${acquiredPrevious}) AS new_in_previous_range,
                    COUNT(*) FILTER (WHERE booking_count > 1 ${acquiredIn}) AS repeat_customers,
                    COUNT(*) FILTER (WHERE TRUE ${activeCurrent}) AS active_in_range
                FROM per_customer
            `),
      // The global account table is platform-only: an operator must not be
      // able to read how many travelers the marketplace has in total.
      platformWide
        ? this.prisma.user.count({ where: { role: Role.USER } })
        : Promise.resolve(null),
    ]);

    const r = rows[0];
    const total = Number(r?.total ?? 0);
    const repeat = Number(r?.repeat_customers ?? 0);

    return {
      total,
      newInRange: Number(r?.new_in_range ?? 0),
      newInPreviousRange: Number(r?.new_in_previous_range ?? 0),
      repeat,
      repeatRate: total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0,
      activeInRange: Number(r?.active_in_range ?? 0),
      registered,
    };
  }

  // ── Payments ────────────────────────────────────────────────────────────

  /** Windowed on `p."createdAt"`, the same basis as cash collected/refunded. */
  private async getPayments(scopeB: Prisma.Sql, range: ResolvedRange) {
    const paidIn = this.rangeFilter(
      Prisma.sql`p."createdAt"`,
      range.from,
      range.to,
    );

    const rows = await this.prisma.$queryRaw<
      { status: string; count: bigint }[]
    >(
      Prisma.sql`
                SELECT p.status::text AS status, COUNT(*) AS count
                FROM payments p
                JOIN bookings b ON b.id = p."bookingId"
                WHERE 1 = 1 ${scopeB} ${paidIn}
                GROUP BY 1
            `,
    );

    const byStatus = Object.fromEntries(
      Object.values(PaymentStatus).map((s) => [s as string, 0]),
    );
    for (const r of rows) byStatus[r.status] = Number(r.count);

    return { byStatus };
  }

  // ── Trend ───────────────────────────────────────────────────────────────

  /**
   * A REAL time series. Earnings are bucketed by RECOGNITION date
   * (`utcRedeemedAt`), not booking date, because revenue is recognized on
   * tour completion - bucketing by booking date would credit a month for a
   * tour that has not happened. Booking volume is bucketed by creation date,
   * which is the question that metric actually answers.
   *
   * Empty buckets stay at zero so the axis is continuous and honest.
   */
  private async getTrend(
    scopeB: Prisma.Sql,
    platformWide: boolean,
    granularity: 'month' | 'day',
    buckets: number,
    trendStart: Date,
    trendEnd: Date | null,
    anchor: Date,
  ) {
    const trunc =
      granularity === 'month' ? Prisma.sql`'month'` : Prisma.sql`'day'`;
    const earned = this.earnedExpr(platformWide);
    // Upper bound only when a range is set, so the default series still runs
    // to today.
    const redeemedEnd = this.rangeFilter(
      Prisma.sql`b."utcRedeemedAt"`,
      null,
      trendEnd,
    );
    const createdEnd = this.rangeFilter(
      Prisma.sql`b."createdAt"`,
      null,
      trendEnd,
    );

    const [earnedRows, gmvRows, bookingRows] = await Promise.all([
      this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
                SELECT date_trunc(${trunc}, b."utcRedeemedAt") AS bucket,
                       SUM(${earned}) AS value
                FROM bookings b
                WHERE b.status = 'REDEEMED'
                  AND b."utcRedeemedAt" >= ${trendStart} ${redeemedEnd} ${scopeB}
                GROUP BY 1
            `),
      this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
                SELECT date_trunc(${trunc}, b."createdAt") AS bucket,
                       SUM(b."totalEur") AS value
                FROM bookings b
                WHERE b.status IN ('CONFIRMED', 'REDEEMED')
                  AND b."createdAt" >= ${trendStart} ${createdEnd} ${scopeB}
                GROUP BY 1
            `),
      this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
                SELECT date_trunc(${trunc}, b."createdAt") AS bucket,
                       COUNT(*) AS value
                FROM bookings b
                WHERE b."createdAt" >= ${trendStart} ${createdEnd} ${scopeB}
                GROUP BY 1
            `),
    ]);

    const toMap = (rows: BucketRow[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (!r.bucket) continue;
        m.set(
          this.bucketKey(new Date(r.bucket), granularity),
          this.num(r.value),
        );
      }
      return m;
    };

    const earnedBy = toMap(earnedRows);
    const gmvBy = toMap(gmvRows);
    const bookingsBy = toMap(bookingRows);

    const points: TrendPointDto[] = this.buildBuckets(
      granularity,
      buckets,
      anchor,
    ).map((b) => ({
      bucket: b.key,
      label: b.label,
      earnedEur: earnedBy.get(b.key) ?? 0,
      gmvEur: gmvBy.get(b.key) ?? 0,
      bookings: bookingsBy.get(b.key) ?? 0,
    }));

    return { granularity, points };
  }

  // ── Breakdowns ──────────────────────────────────────────────────────────

  /**
   * "Where is the business coming from" tables. Operators get their own tours
   * only; the operator/destination/tier leaderboards are platform-only,
   * because they compare operators against each other.
   */
  private async getBreakdowns(
    scopeB: Prisma.Sql,
    platformWide: boolean,
    range: ResolvedRange,
  ) {
    const earned = this.earnedExpr(platformWide);
    const createdIn = this.rangeFilter(
      Prisma.sql`b."createdAt"`,
      range.from,
      range.to,
    );
    const committed = Prisma.sql`b.status IN ('CONFIRMED', 'REDEEMED') ${createdIn}`;

    const topTours = this.prisma.$queryRaw<
      { id: string; name: string; bookings: bigint; earned: string | null }[]
    >(Prisma.sql`
            SELECT t.id, t.name, COUNT(*) AS bookings, SUM(${earned}) AS earned
            FROM bookings b
            JOIN tours t ON t.id = b."tourId"
            WHERE ${committed} ${scopeB}
            GROUP BY t.id, t.name
            ORDER BY SUM(${earned}) DESC NULLS LAST
            LIMIT 5
        `);

    if (!platformWide) {
      const tours = await topTours;
      return {
        topTours: tours.map((t) => ({
          id: t.id,
          name: t.name,
          bookings: Number(t.bookings),
          earnedEur: this.num(t.earned),
        })),
        topOperators: [],
        topDestinations: [],
        byTier: [],
      };
    }

    const [tours, operators, destinations, tiers] = await Promise.all([
      topTours,
      this.prisma.$queryRaw<
        {
          id: string;
          name: string | null;
          bookings: bigint;
          earned: string | null;
        }[]
      >(Prisma.sql`
                SELECT o.id, u.name, COUNT(*) AS bookings, SUM(b."commissionAmount") AS earned
                FROM bookings b
                JOIN operators o ON o.id = b."operatorId"
                JOIN "user" u ON u.id = o."userId"
                WHERE ${committed}
                GROUP BY o.id, u.name
                ORDER BY SUM(b."commissionAmount") DESC NULLS LAST
                LIMIT 5
            `),
      this.prisma.$queryRaw<
        { id: string; name: string; bookings: bigint; gmv: string | null }[]
      >(Prisma.sql`
                SELECT d.id, d.name, COUNT(*) AS bookings, SUM(b."totalEur") AS gmv
                FROM bookings b
                JOIN tours t ON t.id = b."tourId"
                JOIN destinations d ON d.id = t."destinationId"
                WHERE ${committed}
                GROUP BY d.id, d.name
                ORDER BY COUNT(*) DESC
                LIMIT 5
            `),
      // Proof the tier economy is working: which commission tiers the
      // marketplace's earnings actually come from.
      this.prisma.$queryRaw<
        {
          tier: string;
          bookings: bigint;
          earned: string | null;
          rate: string | null;
        }[]
      >(Prisma.sql`
                SELECT t."tierKey"::text AS tier,
                       COUNT(*) AS bookings,
                       SUM(b."commissionAmount") AS earned,
                       -- The rate ACTUALLY charged, averaged over the bookings
                       -- in this tier, not the tier's current headline rate.
                       -- commissionRate is snapshotted on the booking and tier
                       -- changes are never retroactive, so a tour that moved
                       -- tiers keeps its old bookings at the old rate - this
                       -- reports what was really billed.
                       AVG(b."commissionRate") AS rate
                FROM bookings b
                JOIN tours t ON t.id = b."tourId"
                WHERE ${committed}
                GROUP BY 1
                ORDER BY SUM(b."commissionAmount") DESC NULLS LAST
            `),
    ]);

    return {
      topTours: tours.map((t) => ({
        id: t.id,
        name: t.name,
        bookings: Number(t.bookings),
        earnedEur: this.num(t.earned),
      })),
      topOperators: operators.map((o) => ({
        id: o.id,
        name: o.name ?? 'Unnamed operator',
        bookings: Number(o.bookings),
        earnedEur: this.num(o.earned),
      })),
      topDestinations: destinations.map((d) => ({
        id: d.id,
        name: d.name,
        bookings: Number(d.bookings),
        gmvEur: this.num(d.gmv),
      })),
      byTier: tiers.map((t) => ({
        tier: t.tier,
        bookings: Number(t.bookings),
        earnedEur: this.num(t.earned),
        // Stored as a fraction (0.2750 = 27.5%); surfaced as a percentage.
        // Null when no booking in the tier carried a snapshotted rate, so the
        // UI can omit it rather than print a fabricated 0%.
        commissionPct: t.rate === null ? null : this.num(Number(t.rate) * 100),
      })),
    };
  }

  // ── Recent activity ─────────────────────────────────────────────────────

  private async getRecentActivity(
    scopeB: Prisma.Sql,
    bookingWhere: Prisma.BookingWhereInput,
  ) {
    const [bookings, payments, cancellations, refunds, customers] =
      await Promise.all([
        this.prisma.booking.findMany({
          where: bookingWhere,
          select: {
            id: true,
            displayRef: true,
            status: true,
            totalEur: true,
            createdAt: true,
            tour: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.payment.findMany({
          where: { booking: bookingWhere },
          select: {
            id: true,
            status: true,
            kind: true,
            amount: true,
            createdAt: true,
            booking: { select: { displayRef: true, fxRateToEur: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        // Latest cancellations, by WHEN they were cancelled (not created).
        this.prisma.booking.findMany({
          where: {
            ...bookingWhere,
            status: BookingStatus.CANCELLED,
            utcCancelledAt: { not: null },
          },
          select: {
            id: true,
            displayRef: true,
            totalEur: true,
            cancelledBy: true,
            cancellationRefund: true,
            utcCancelledAt: true,
            tour: { select: { name: true } },
          },
          orderBy: { utcCancelledAt: 'desc' },
          take: 5,
        }),
        // Latest refunds - REFUND payment rows, whatever their outcome
        // (REFUNDED / PROCESSING / FAILED), so a stuck refund is visible here.
        this.prisma.payment.findMany({
          where: { booking: bookingWhere, kind: PaymentKind.REFUND },
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true,
            booking: { select: { displayRef: true, fxRateToEur: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.$queryRaw<
          {
            name: string | null;
            email: string | null;
            bookings: bigint;
            first_booking_at: Date;
          }[]
        >(Prisma.sql`
                SELECT
                    MAX(COALESCE(b."contactFullName", b."contactFirstName")) AS name,
                    MAX(b."contactEmail") AS email,
                    COUNT(*) AS bookings,
                    MIN(b."createdAt") AS first_booking_at
                FROM bookings b
                WHERE COALESCE(b."userId", lower(b."contactEmail")) IS NOT NULL ${scopeB}
                GROUP BY COALESCE(b."userId", lower(b."contactEmail"))
                ORDER BY MIN(b."createdAt") DESC
                LIMIT 5
            `),
      ]);

    return {
      bookings: bookings.map((b) => ({
        id: b.id,
        displayRef: b.displayRef,
        tourName: b.tour?.name ?? 'Unknown tour',
        status: b.status,
        totalEur: this.num(b.totalEur),
        createdAt: b.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        displayRef: p.booking?.displayRef ?? '',
        status: p.status,
        kind: p.kind,
        amountEur: this.num(
          Number(p.amount) * Number(p.booking?.fxRateToEur ?? 1),
        ),
        createdAt: p.createdAt,
      })),
      cancellations: cancellations.map((b) => ({
        id: b.id,
        displayRef: b.displayRef,
        tourName: b.tour?.name ?? 'Unknown tour',
        cancelledBy: b.cancelledBy,
        cancellationRefund: b.cancellationRefund,
        totalEur: this.num(b.totalEur),
        cancelledAt: b.utcCancelledAt as Date,
      })),
      refunds: refunds.map((p) => ({
        id: p.id,
        displayRef: p.booking?.displayRef ?? '',
        status: p.status,
        amountEur: this.num(
          Number(p.amount) * Number(p.booking?.fxRateToEur ?? 1),
        ),
        createdAt: p.createdAt,
      })),
      // Traveler addresses are masked here for the same reason the TYP
      // masks them: dashboard screens get screenshotted and shared.
      customers: customers.map((c) => ({
        name: c.name ?? 'Guest',
        email: maskEmail(c.email) ?? '',
        bookings: Number(c.bookings),
        firstBookingAt: c.first_booking_at,
      })),
    };
  }
}
