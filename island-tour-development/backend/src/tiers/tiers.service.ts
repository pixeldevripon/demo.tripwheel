import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancelledBy,
  EligibilityState,
  Prisma,
  Role,
  SpotlightStatus,
  TierKey,
  TourStatus,
  type SpotlightRequest,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import type {
  ApproveSpotlightDto,
  ChangeTierDto,
  CreateSpotlightRequestDto,
  RejectSpotlightDto,
  SpotlightQueueDto,
  SpotlightQueueQueryDto,
  SpotlightRequestResponseDto,
  TierResponseDto,
  TourSpotlightHistoryDto,
} from './dto/tiers.dto';

/**
 * TierKey → denormalized commission % + sort rank (COMMERCIAL-MODEL.md §1).
 * `standard` deliberately ranks below `organic`. Spotlight (+35%) is an overlay,
 * never a tier — its rate is resolved at booking time, never written into `commissionTier`.
 */
export const TIER_MAP: Record<TierKey, { rank: number; commission: number }> = {
  [TierKey.premium]: { rank: 1, commission: 30.0 },
  [TierKey.featured]: { rank: 2, commission: 27.5 },
  [TierKey.boosted]: { rank: 3, commission: 25.0 },
  [TierKey.organic]: { rank: 4, commission: 22.5 },
  [TierKey.standard]: { rank: 5, commission: 20.0 },
};

/**
 * Highest tier_rank that counts as a PAID placement (master §3.6 "Paid tiers
 * P1 to P3"): premium(1)/featured(2)/boosted(3). Tours at rank <= this wear the
 * Sponsored badge; organic(4)/standard(5) are the open baseline.
 */
export const PAID_TIER_MAX_RANK = 3;

/** Spotlight commission overlay while active (COMMERCIAL-MODEL.md §1, SPOTLIGHT-DATA.md §0). */
export const SPOTLIGHT_COMMISSION_PCT = 35.0;
const SPOTLIGHT_COMMISSION_RATE = 0.35;

/** Hard cap of simultaneous Spotlight placements per destination (SPOTLIGHT-DATA.md §3). */
const SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION = 3;

/** 30-day tier lock applied on every tier change (COMMERCIAL-MODEL.md §2). */
const TIER_LOCK_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Spotlight eligibility bar on top of the flat bar (COMMERCIAL-MODEL.md §6). */
const SPOTLIGHT_MIN_REVIEWS = 10;
const SPOTLIGHT_MIN_RATING = 4.5;

/**
 * Flat eligibility bar for the PAID tiers (master §7.2, locked June 10 2026):
 * ">= 5 reviews AND rating >= 4.0 AND operator 90-day cancellation rate <= 10%
 * (minimum 10 bookings, admin force-majeure pardons)". Opens boosted/featured/
 * premium; organic/standard stay open.
 */
const FLAT_BAR_MIN_REVIEWS = 5;
const FLAT_BAR_MIN_RATING = 4.0;
const FLAT_BAR_MAX_CANCEL_RATE_PCT = 10;
/** Below this many trailing-90d bookings the cancel-rate check passes (no data). */
const FLAT_BAR_MIN_BOOKINGS_90D = 10;
/** One-time window from first publish during which ANY tier may be held. */
const PROVISIONAL_WINDOW_DAYS = 90;
/** Grace period after a failed nightly check before automatic demotion. */
const ELIGIBILITY_GRACE_DAYS = 30;
/** Bookings that count toward the operator cancellation-rate denominator. */
const CANCEL_RATE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
  BookingStatus.CANCELLED,
];

/** Result of a flat-bar evaluation (`null` metric = bar passed). */
interface FlatBarResult {
  eligible: boolean;
  /** Which metric failed - mirrors `tour.graceMetric` values. */
  failedMetric: 'review_count' | 'rating' | 'cancellation_rate' | null;
  cancellationRatePct: number;
  bookingSample: number;
}

/** Requests that occupy a destination cap slot (not yet ended). */
const CAP_STATUSES: SpotlightStatus[] = [
  SpotlightStatus.APPROVED,
  SpotlightStatus.ACTIVE,
];

@Injectable()
export class TiersService {
  private readonly logger = new Logger(TiersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════
  // Spotlight — operator
  // ════════════════════════════════════════════════════════════════════════

  /** Operator requests Spotlight for an owned tour (eligibility-gated → REQUESTED). */
  async requestSpotlight(
    userId: string,
    role: Role,
    tourId: string,
    dto: CreateSpotlightRequestDto,
  ): Promise<SpotlightRequestResponseDto> {
    const tour = await this.assertTourAccess(tourId, userId, role);
    await this.assertOwnerAuthority(tour.operatorId, userId, role);
    await this.assertSpotlightEligible(tour);

    const row = await this.prisma.spotlightRequest.create({
      data: {
        tourId,
        operatorId: tour.operatorId,
        destinationId: tour.destinationId,
        status: SpotlightStatus.REQUESTED,
        requestedBy: userId,
        requestedStartsAt: dto.requestedStartsAt
          ? new Date(dto.requestedStartsAt)
          : null,
        requestedDurationDays: dto.requestedDurationDays ?? null,
      },
      select: SPOTLIGHT_SELECT,
    });
    this.logger.log(
      `Spotlight requested ${row.id} for tour ${tourId} by user ${userId}`,
    );
    return mapSpotlight(row);
  }

  /** Current + historical Spotlight requests for a tour (operator owns / admin bypasses). */
  async getTourSpotlight(
    userId: string,
    role: Role,
    tourId: string,
  ): Promise<TourSpotlightHistoryDto> {
    await this.assertTourAccess(tourId, userId, role);
    const rows = await this.prisma.spotlightRequest.findMany({
      where: { tourId },
      orderBy: { requestedAt: 'desc' },
      select: SPOTLIGHT_SELECT,
    });
    const history = rows.map(mapSpotlight);
    return { current: pickCurrent(history), history };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Spotlight — admin
  // ════════════════════════════════════════════════════════════════════════

  /** Admin review queue + count of cap-occupying requests for the (optional) destination. */
  async listSpotlightQueue(
    query: SpotlightQueueQueryDto,
  ): Promise<SpotlightQueueDto> {
    const where: Prisma.SpotlightRequestWhereInput = {};
    if (query.destinationId) where.destinationId = query.destinationId;
    if (query.status) where.status = query.status;

    const [rows, activeCountsByDest] = await Promise.all([
      this.prisma.spotlightRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        select: SPOTLIGHT_SELECT,
      }),
      this.prisma.spotlightRequest.groupBy({
        by: ['destinationId'],
        where: {
          ...(query.destinationId && { destinationId: query.destinationId }),
          status: { in: CAP_STATUSES },
        },
        _count: { _all: true },
      }),
    ]);

    const activeCount = activeCountsByDest.reduce(
      (acc, curr) => acc + curr._count._all,
      0,
    );
    const activeCountByDestination = activeCountsByDest.reduce(
      (acc, curr) => {
        acc[curr.destinationId] = curr._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      activeCount,
      activeCountByDestination,
      data: rows.map(mapSpotlight),
    };
  }

  /**
   * Admin approves a request: sets the active window, re-checks eligibility, and enforces
   * the max-3-per-destination cap inside a transaction (serialized count to avoid a race).
   */
  async approveSpotlight(
    adminUserId: string,
    id: string,
    dto: ApproveSpotlightDto,
  ): Promise<SpotlightRequestResponseDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const req = await tx.spotlightRequest.findUnique({
        where: { id },
        select: {
          id: true,
          tourId: true,
          destinationId: true,
          status: true,
          tour: {
            select: { aggregateRating: true, aggregateReviewCount: true },
          },
        },
      });
      if (!req) throw new NotFoundException('Spotlight request not found');
      if (req.status !== SpotlightStatus.REQUESTED) {
        throw new ConflictException(
          `Only a REQUESTED spotlight can be approved (current: ${req.status})`,
        );
      }
      this.assertEligibleAggregates(
        req.tour.aggregateRating,
        req.tour.aggregateReviewCount,
      );

      const activeForDest = await tx.spotlightRequest.count({
        where: {
          destinationId: req.destinationId,
          status: { in: CAP_STATUSES },
          id: { not: id },
        },
      });
      if (activeForDest >= SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION) {
        throw new ConflictException(
          `Destination already has ${SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION} active spotlight placements (cap reached)`,
        );
      }

      // If the approved window is already open, go straight to ACTIVE so the
      // Sponsored badge (§3.6) shows immediately rather than waiting for the
      // nightly lifecycle; otherwise APPROVED and the lifecycle flips it at startsAt.
      const now = new Date();
      const activeNow = startsAt <= now && endsAt > now;

      const row = await tx.spotlightRequest.update({
        where: { id },
        data: {
          status: activeNow ? SpotlightStatus.ACTIVE : SpotlightStatus.APPROVED,
          approvedAt: now,
          approvedBy: adminUserId,
          startsAt,
          endsAt,
          note: dto.note ?? null,
          rejectionReason: null,
        },
        select: SPOTLIGHT_SELECT,
      });

      // Mirror an ACTIVE spotlight onto the tour so deriveTourBadge -> 'sponsored'.
      if (activeNow) {
        await tx.tour.update({
          where: { id: req.tourId },
          data: { isSponsored: true },
        });
      }
      return row;
    });

    this.logger.log(`Spotlight ${id} APPROVED by admin ${adminUserId}`);
    return mapSpotlight(updated);
  }

  /** Admin rejects a request → REJECTED + rejectionReason. */
  async rejectSpotlight(
    adminUserId: string,
    id: string,
    dto: RejectSpotlightDto,
  ): Promise<SpotlightRequestResponseDto> {
    const existing = await this.prisma.spotlightRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Spotlight request not found');
    if (existing.status !== SpotlightStatus.REQUESTED) {
      throw new ConflictException(
        `Only a REQUESTED spotlight can be rejected (current: ${existing.status})`,
      );
    }
    const row = await this.prisma.spotlightRequest.update({
      where: { id },
      data: {
        status: SpotlightStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
      },
      select: SPOTLIGHT_SELECT,
    });
    this.logger.log(`Spotlight ${id} REJECTED by admin ${adminUserId}`);
    return mapSpotlight(row);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Tier change — operator
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Operator 90-day cancellation rate (%) with its booking sample size. Counts
   * real bookings created in the trailing window (CONFIRMED/REDEEMED/CANCELLED -
   * holds/expiries/rejections never became bookings); operator-caused = status
   * CANCELLED with cancelledBy OPERATOR. Admin/customer cancellations and
   * force-majeure pardons (cancelledBy ADMIN) do not count against the bar.
   */
  private async operatorCancellationRate90d(
    operatorId: string,
    now: Date,
  ): Promise<{ ratePct: number; sample: number }> {
    const windowStart = new Date(now.getTime() - 90 * MS_PER_DAY);
    const [sample, cancelled] = await Promise.all([
      this.prisma.booking.count({
        where: {
          operatorId,
          createdAt: { gte: windowStart },
          status: { in: CANCEL_RATE_STATUSES },
        },
      }),
      this.prisma.booking.count({
        where: {
          operatorId,
          createdAt: { gte: windowStart },
          status: BookingStatus.CANCELLED,
          cancelledBy: CancelledBy.OPERATOR,
        },
      }),
    ]);
    return {
      ratePct: sample > 0 ? (cancelled / sample) * 100 : 0,
      sample,
    };
  }

  /**
   * The §7.2 FLAT eligibility bar for the paid tiers: >= 5 reviews AND rating
   * >= 4.0 AND operator 90d cancellation rate <= 10% (min 10 bookings - below
   * that the cancellation check passes for lack of data).
   */
  private async evaluateFlatBar(
    tour: {
      aggregateRating: number | null;
      aggregateReviewCount: number;
      operatorId: string;
    },
    now: Date,
    precomputedRate?: { ratePct: number; sample: number },
  ): Promise<FlatBarResult> {
    const { ratePct, sample } =
      precomputedRate ??
      (await this.operatorCancellationRate90d(tour.operatorId, now));
    let failedMetric: FlatBarResult['failedMetric'] = null;
    if (tour.aggregateReviewCount < FLAT_BAR_MIN_REVIEWS) {
      failedMetric = 'review_count';
    } else if ((tour.aggregateRating ?? 0) < FLAT_BAR_MIN_RATING) {
      failedMetric = 'rating';
    } else if (
      sample >= FLAT_BAR_MIN_BOOKINGS_90D &&
      ratePct > FLAT_BAR_MAX_CANCEL_RATE_PCT
    ) {
      failedMetric = 'cancellation_rate';
    }
    return {
      eligible: failedMetric === null,
      failedMetric,
      cancellationRatePct: ratePct,
      bookingSample: sample,
    };
  }

  /**
   * Whether `now` is inside the tour's one-time 90-day provisional window from
   * first publish (master §7.2: any tier may be held during it - no tour has
   * history at launch). An unpublished tour has no window yet; treat it as
   * provisional so operators can stage a tier before going LIVE.
   */
  private isInProvisionalWindow(
    firstPublishedAt: Date | null,
    now: Date,
  ): boolean {
    if (!firstPublishedAt) return true;
    return (
      now.getTime() - firstPublishedAt.getTime() <
      PROVISIONAL_WINDOW_DAYS * MS_PER_DAY
    );
  }

  /**
   * Operator picks a tier: denormalizes commissionTier + tierRank from TIER_MAP and sets a
   * 30-day lock. Rejected while a prior lock is still in the future (COMMERCIAL-MODEL.md §2).
   * Paid tiers (rank <= PAID_TIER_MAX_RANK) are eligibility-gated by the §7.2 flat bar
   * unless the tour is inside its one-time 90-day provisional window.
   */
  async changeTier(
    userId: string,
    role: Role,
    tourId: string,
    dto: ChangeTierDto,
  ): Promise<TierResponseDto> {
    const accessed = await this.assertTourAccess(tourId, userId, role);
    await this.assertOwnerAuthority(accessed.operatorId, userId, role);
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        tierLockedUntil: true,
        aggregateRating: true,
        aggregateReviewCount: true,
        firstPublishedAt: true,
        operatorId: true,
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const now = new Date();
    if (
      tour.tierLockedUntil &&
      tour.tierLockedUntil.getTime() > now.getTime()
    ) {
      throw new ConflictException(
        `Tier is locked until ${tour.tierLockedUntil.toISOString()}; changes are not allowed yet`,
      );
    }

    const mapped = TIER_MAP[dto.tierKey];

    // Eligibility gate for the paid tiers (§7.2). Admins bypass (force-majeure
    // pardons / manual placement are an admin capability).
    const provisional = this.isInProvisionalWindow(tour.firstPublishedAt, now);
    if (
      mapped.rank <= PAID_TIER_MAX_RANK &&
      role !== Role.ADMIN &&
      !provisional
    ) {
      const bar = await this.evaluateFlatBar(tour, now);
      if (!bar.eligible) {
        throw new ForbiddenException(
          `Tour is not eligible for the '${dto.tierKey}' tier (failed: ${bar.failedMetric}). ` +
            `Requires >=${FLAT_BAR_MIN_REVIEWS} reviews, rating >=${FLAT_BAR_MIN_RATING}, ` +
            `and an operator 90-day cancellation rate <=${FLAT_BAR_MAX_CANCEL_RATE_PCT}%.`,
        );
      }
    }

    const tierLockedUntil = new Date(
      now.getTime() + TIER_LOCK_DAYS * MS_PER_DAY,
    );
    const row = await this.prisma.tour.update({
      where: { id: tourId },
      data: {
        tierKey: dto.tierKey,
        commissionTier: new Prisma.Decimal(mapped.commission),
        tierRank: mapped.rank,
        // LD24: deposit_pct is TIER-DRIVEN - the deposit collected at checkout
        // IS the commission, so it must always equal the tier rate. A premium
        // (30%) tour taking the default 20% deposit under-collects Island
        // Tours' commission by 10 points on every deposit-model booking.
        depositPct: new Prisma.Decimal(mapped.commission),
        tierLockedUntil,
        // A successful pick resets the eligibility lifecycle for this tour.
        eligibilityState: provisional
          ? EligibilityState.PROVISIONAL
          : EligibilityState.ELIGIBLE,
        graceStartedAt: null,
        graceMetric: null,
      },
      select: {
        id: true,
        tierKey: true,
        commissionTier: true,
        tierRank: true,
        tierLockedUntil: true,
      },
    });
    this.logger.log(
      `Tour ${tourId} tier changed to ${dto.tierKey} (rank ${mapped.rank}) by user ${userId}`,
    );
    return {
      tourId: row.id,
      tierKey: row.tierKey,
      commissionTier: Number(row.commissionTier),
      tierRank: row.tierRank,
      tierLockedUntil: row.tierLockedUntil
        ? row.tierLockedUntil.toISOString()
        : null,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public helpers (imported by booking / ranking modules)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Whether the tour has an ACTIVE spotlight whose window contains `at` (default: now).
   * Booking/ranking call this to apply the overlay (SPOTLIGHT-DATA.md §3).
   */
  async hasActiveSpotlight(
    tourId: string,
    at: Date = new Date(),
  ): Promise<boolean> {
    const hit = await this.prisma.spotlightRequest.findFirst({
      where: {
        tourId,
        status: SpotlightStatus.ACTIVE,
        startsAt: { lte: at },
        endsAt: { gte: at },
      },
      select: { id: true },
    });
    return hit !== null;
  }

  /**
   * The effective commission **rate** (0–1) for a tour at `at`: 0.35 when a spotlight is
   * active, else the tour's tier rate (`commissionTier / 100`). The booking service
   * snapshots this onto the booking; it never changes retroactively (SPOTLIGHT-DATA.md §3).
   */
  async effectiveCommissionRate(
    tourId: string,
    at: Date = new Date(),
  ): Promise<number> {
    if (await this.hasActiveSpotlight(tourId, at))
      return SPOTLIGHT_COMMISSION_RATE;
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { commissionTier: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return Number(tour.commissionTier) / 100;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Lifecycle job (called by the nightly/clock worker — no cron wired here)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Flips APPROVED → ACTIVE when `now >= startsAt`, and ACTIVE → EXPIRED when `now > endsAt`
   * (freeing the destination cap slot). Returns the transition counts (SPOTLIGHT-DATA.md §4).
   */
  async runSpotlightLifecycle(
    now: Date = new Date(),
  ): Promise<{ activated: number; expired: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Capture the tours that change state so we can mirror `isSponsored` onto them
      // (the §3.6 "Sponsored" badge shows while a tour holds an ACTIVE spotlight).
      const activating = await tx.spotlightRequest.findMany({
        where: { status: SpotlightStatus.APPROVED, startsAt: { lte: now } },
        select: { tourId: true },
      });
      const expiring = await tx.spotlightRequest.findMany({
        where: { status: SpotlightStatus.ACTIVE, endsAt: { lt: now } },
        select: { tourId: true },
      });

      const activated = await tx.spotlightRequest.updateMany({
        where: { status: SpotlightStatus.APPROVED, startsAt: { lte: now } },
        data: { status: SpotlightStatus.ACTIVE },
      });
      const expired = await tx.spotlightRequest.updateMany({
        where: { status: SpotlightStatus.ACTIVE, endsAt: { lt: now } },
        data: { status: SpotlightStatus.EXPIRED },
      });

      // Recompute isSponsored from ground truth for every affected tour: true iff it
      // still has at least one ACTIVE spotlight (handles the rare multi-request case).
      const affected = [
        ...new Set([...activating, ...expiring].map((r) => r.tourId)),
      ];
      for (const tourId of affected) {
        const active = await tx.spotlightRequest.count({
          where: { tourId, status: SpotlightStatus.ACTIVE },
        });
        await tx.tour.update({
          where: { id: tourId },
          data: { isSponsored: active > 0 },
        });
      }

      if (activated.count || expired.count) {
        this.logger.log(
          `Spotlight lifecycle: ${activated.count} activated, ${expired.count} expired`,
        );
      }
      return { activated: activated.count, expired: expired.count };
    });
  }

  /**
   * Nightly §7.2 tier-eligibility lifecycle over every LIVE tour:
   *
   *   provisional window (90d from first publish, any tier)  → PROVISIONAL
   *   paid tier + flat bar passes                             → ELIGIBLE
   *   paid tier + flat bar fails (first night)                → GRACE (30 days)
   *   paid tier + GRACE older than 30 days                    → demote to the
   *     highest tier the tour still qualifies for (= organic, the best open
   *     tier, since the flat bar just failed) and mark DEMOTED.
   *
   * Open-tier tours normalize to PROVISIONAL/ELIGIBLE; a DEMOTED marker stays
   * until the bar passes again (so dashboards can surface it). Demotion updates
   * tierKey/commissionTier/tierRank together (rule #7) and never touches
   * existing bookings (their commission is snapshotted). The grace notice is
   * logged; the operator-email hook lands with the operator notification
   * templates (wireframe-gated).
   *
   * Also refreshes the denormalized `operator.cancellationRate90d` for every
   * operator seen in the sweep.
   */
  async runEligibilityLifecycle(now: Date = new Date()): Promise<{
    evaluated: number;
    provisional: number;
    graced: number;
    demoted: number;
  }> {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.LIVE, isActive: true },
      select: {
        id: true,
        tierKey: true,
        tierRank: true,
        eligibilityState: true,
        graceStartedAt: true,
        aggregateRating: true,
        aggregateReviewCount: true,
        firstPublishedAt: true,
        operatorId: true,
      },
    });

    // One cancellation-rate lookup per operator, reused across their tours.
    const rateByOperator = new Map<
      string,
      { ratePct: number; sample: number }
    >();
    const operatorRate = async (operatorId: string) => {
      let rate = rateByOperator.get(operatorId);
      if (!rate) {
        rate = await this.operatorCancellationRate90d(operatorId, now);
        rateByOperator.set(operatorId, rate);
      }
      return rate;
    };

    let provisional = 0;
    let graced = 0;
    let demoted = 0;

    for (const t of tours) {
      const inWindow = this.isInProvisionalWindow(t.firstPublishedAt, now);
      const isPaid = t.tierRank <= PAID_TIER_MAX_RANK;

      if (inWindow) {
        provisional++;
        if (t.eligibilityState !== EligibilityState.PROVISIONAL) {
          await this.prisma.tour.update({
            where: { id: t.id },
            data: {
              eligibilityState: EligibilityState.PROVISIONAL,
              graceStartedAt: null,
              graceMetric: null,
            },
          });
        }
        continue;
      }

      const bar = await this.evaluateFlatBar(
        t,
        now,
        await operatorRate(t.operatorId),
      );

      if (!isPaid) {
        // Open tiers carry no bar. Keep the DEMOTED marker visible until the
        // bar passes again; otherwise normalize to ELIGIBLE.
        const nextState =
          t.eligibilityState === EligibilityState.DEMOTED && !bar.eligible
            ? EligibilityState.DEMOTED
            : EligibilityState.ELIGIBLE;
        if (t.eligibilityState !== nextState) {
          await this.prisma.tour.update({
            where: { id: t.id },
            data: {
              eligibilityState: nextState,
              graceStartedAt: null,
              graceMetric: null,
            },
          });
        }
        continue;
      }

      if (bar.eligible) {
        if (t.eligibilityState !== EligibilityState.ELIGIBLE) {
          await this.prisma.tour.update({
            where: { id: t.id },
            data: {
              eligibilityState: EligibilityState.ELIGIBLE,
              graceStartedAt: null,
              graceMetric: null,
            },
          });
        }
        continue;
      }

      // Bar failed on a paid tier.
      const graceExpired =
        t.eligibilityState === EligibilityState.GRACE &&
        t.graceStartedAt !== null &&
        now.getTime() - t.graceStartedAt.getTime() >=
          ELIGIBILITY_GRACE_DAYS * MS_PER_DAY;

      if (graceExpired) {
        // Demote to the best tier the tour still qualifies for: the flat bar
        // gates all three paid tiers, so that is `organic` (the open baseline).
        const target = TIER_MAP[TierKey.organic];
        await this.prisma.tour.update({
          where: { id: t.id },
          data: {
            tierKey: TierKey.organic,
            commissionTier: new Prisma.Decimal(target.commission),
            tierRank: target.rank,
            depositPct: new Prisma.Decimal(target.commission), // LD24: tier-driven
            eligibilityState: EligibilityState.DEMOTED,
            graceStartedAt: null,
            graceMetric: null,
          },
        });
        demoted++;
        this.logger.warn(
          `Eligibility: tour ${t.id} demoted ${t.tierKey} -> organic (failed: ${bar.failedMetric})`,
        );
      } else if (t.eligibilityState !== EligibilityState.GRACE) {
        await this.prisma.tour.update({
          where: { id: t.id },
          data: {
            eligibilityState: EligibilityState.GRACE,
            graceStartedAt: now,
            graceMetric: bar.failedMetric,
          },
        });
        graced++;
        this.logger.warn(
          `Eligibility: tour ${t.id} entered 30-day grace (failed: ${bar.failedMetric})`,
        );
      }
    }

    // Refresh the denormalized operator cancellation rate for the dashboard.
    for (const [operatorId, rate] of rateByOperator) {
      await this.prisma.operator.update({
        where: { id: operatorId },
        data: { cancellationRate90d: new Prisma.Decimal(rate.ratePct) },
      });
    }

    if (graced || demoted) {
      this.logger.log(
        `Eligibility lifecycle: ${tours.length} evaluated, ${graced} graced, ${demoted} demoted`,
      );
    }
    return { evaluated: tours.length, provisional, graced, demoted };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Asserts the actor may manage the tour; returns its operator + destination ids. */
  /**
   * Commercial mutations (tier pick, Spotlight request) are OWNER-only: they
   * change the commission the operator pays, which the access-roles matrix
   * reserves for the account holding the agreement. Team seats (who reach the
   * tour via resolveOperatorId) may view commercial state but never change it.
   * ADMIN bypasses (manual placement / force-majeure handling).
   */
  private async assertOwnerAuthority(
    operatorId: string,
    userId: string,
    role: Role,
  ): Promise<void> {
    if (role === Role.ADMIN) return;
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: { userId: true },
    });
    if (!operator || operator.userId !== userId) {
      throw new ForbiddenException(
        'Only the operator owner can change commercial settings (commission tier / Spotlight)',
      );
    }
  }

  private async assertTourAccess(
    tourId: string,
    userId: string,
    role: Role,
  ): Promise<{
    operatorId: string;
    destinationId: string;
    aggregateRating: number | null;
    aggregateReviewCount: number;
  }> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        operatorId: true,
        destinationId: true,
        aggregateRating: true,
        aggregateReviewCount: true,
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    if (role === Role.ADMIN) return tour;
    const operatorId = await resolveOperatorId(this.prisma, userId, role);
    if (tour.operatorId !== operatorId) {
      throw new ForbiddenException(
        'You do not have permission to manage this tour',
      );
    }
    return tour;
  }

  /** Reads aggregates off an already-loaded tour and enforces the Spotlight bar. */
  private async assertSpotlightEligible(tour: {
    aggregateRating?: number | null;
    aggregateReviewCount?: number;
  }): Promise<void> {
    this.assertEligibleAggregates(
      tour.aggregateRating ?? null,
      tour.aggregateReviewCount ?? 0,
    );
  }

  /**
   * Spotlight eligibility bar: >=10 reviews AND rating >=4.5 (COMMERCIAL-MODEL.md §6).
   * TODO(operator-module gap E.6): also require operator.cancellation_rate_90d <= 10% once
   * that field exists; not yet modeled, so it is skipped here.
   */
  private assertEligibleAggregates(
    rating: number | null,
    reviewCount: number,
  ): void {
    if (
      reviewCount < SPOTLIGHT_MIN_REVIEWS ||
      (rating ?? 0) < SPOTLIGHT_MIN_RATING
    ) {
      throw new BadRequestException(
        `Tour is not eligible for Spotlight (needs >=${SPOTLIGHT_MIN_REVIEWS} reviews and rating >=${SPOTLIGHT_MIN_RATING}; ` +
          `has ${reviewCount} reviews, rating ${rating ?? 0})`,
      );
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping helpers
// ════════════════════════════════════════════════════════════════════════════

const SPOTLIGHT_SELECT = {
  id: true,
  tourId: true,
  operatorId: true,
  destinationId: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  approvedBy: true,
  startsAt: true,
  endsAt: true,
  note: true,
  requestedStartsAt: true,
  requestedDurationDays: true,
  rejectionReason: true,
  requestedBy: true,
} satisfies Prisma.SpotlightRequestSelect;

type SpotlightRow = Pick<SpotlightRequest, keyof typeof SPOTLIGHT_SELECT>;

function mapSpotlight(row: SpotlightRow): SpotlightRequestResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    operatorId: row.operatorId,
    destinationId: row.destinationId,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedBy: row.approvedBy ?? null,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    note: row.note ?? null,
    requestedStartsAt: row.requestedStartsAt
      ? row.requestedStartsAt.toISOString()
      : null,
    requestedDurationDays: row.requestedDurationDays ?? null,
    rejectionReason: row.rejectionReason ?? null,
    requestedBy: row.requestedBy ?? null,
  };
}

/** The most relevant live/pending request: ACTIVE > APPROVED > REQUESTED, newest first. */
function pickCurrent(
  history: SpotlightRequestResponseDto[],
): SpotlightRequestResponseDto | null {
  const rank: Partial<Record<SpotlightStatus, number>> = {
    [SpotlightStatus.ACTIVE]: 0,
    [SpotlightStatus.APPROVED]: 1,
    [SpotlightStatus.REQUESTED]: 2,
  };
  const live = history
    .filter((r) => rank[r.status] !== undefined)
    .sort((a, b) => (rank[a.status] as number) - (rank[b.status] as number));
  return live[0] ?? null;
}
