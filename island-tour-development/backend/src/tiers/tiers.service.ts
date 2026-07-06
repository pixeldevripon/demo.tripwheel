import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  SpotlightStatus,
  TierKey,
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
   * Operator picks a tier: denormalizes commissionTier + tierRank from TIER_MAP and sets a
   * 30-day lock. Rejected while a prior lock is still in the future (COMMERCIAL-MODEL.md §2).
   */
  async changeTier(
    userId: string,
    role: Role,
    tourId: string,
    dto: ChangeTierDto,
  ): Promise<TierResponseDto> {
    await this.assertTourAccess(tourId, userId, role);
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { tierLockedUntil: true },
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
    const tierLockedUntil = new Date(
      now.getTime() + TIER_LOCK_DAYS * MS_PER_DAY,
    );
    const row = await this.prisma.tour.update({
      where: { id: tourId },
      data: {
        tierKey: dto.tierKey,
        commissionTier: new Prisma.Decimal(mapped.commission),
        tierRank: mapped.rank,
        tierLockedUntil,
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

  // ── internals ──────────────────────────────────────────────────────────────

  /** Asserts the actor may manage the tour; returns its operator + destination ids. */
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
