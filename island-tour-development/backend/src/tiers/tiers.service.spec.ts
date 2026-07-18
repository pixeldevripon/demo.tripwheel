/**
 * Unit tests for TiersService. Prisma is mocked. Focus: the Spotlight eligibility gate,
 * the transactional max-3-per-destination cap, the 30-day tier lock, effectiveCommissionRate
 * (with/without an active spotlight), and the runSpotlightLifecycle transitions.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role, SpotlightStatus, TierKey } from '@prisma/client';
import { TiersService } from './tiers.service';

function mockPrisma() {
  return {
    tour: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    booking: { count: jest.fn() },
    operator: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    spotlightRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

/** An eligible tour owned by op1. */
const ELIGIBLE_TOUR = {
  operatorId: 'op1',
  destinationId: 'dest1',
  aggregateRating: 4.7,
  aggregateReviewCount: 12,
};

function spotlightRow(over: Record<string, unknown> = {}) {
  return {
    id: 'sr1',
    tourId: 't1',
    operatorId: 'op1',
    destinationId: 'dest1',
    status: SpotlightStatus.REQUESTED,
    requestedAt: new Date('2026-06-25T10:00:00.000Z'),
    approvedAt: null,
    approvedBy: null,
    startsAt: null,
    endsAt: null,
    note: null,
    requestedStartsAt: null,
    requestedDurationDays: null,
    rejectionReason: null,
    requestedBy: 'u1',
    ...over,
  };
}

describe('TiersService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let svc: TiersService;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new TiersService(prisma as never);
  });

  // ── eligibility gate ──────────────────────────────────────────────────────
  describe('requestSpotlight', () => {
    it('creates a REQUESTED row when the eligibility bar passes', async () => {
      prisma.tour.findUnique.mockResolvedValue(ELIGIBLE_TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.spotlightRequest.create.mockResolvedValue(spotlightRow());

      const res = await svc.requestSpotlight(
        'u1',
        Role.TOUR_OPERATOR,
        't1',
        {},
      );
      expect(res.status).toBe(SpotlightStatus.REQUESTED);
      expect(prisma.spotlightRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tourId: 't1',
            operatorId: 'op1',
            destinationId: 'dest1',
            requestedBy: 'u1',
          }),
        }),
      );
    });

    it('rejects when reviews < 10', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        ...ELIGIBLE_TOUR,
        aggregateReviewCount: 9,
      });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.requestSpotlight('u1', Role.TOUR_OPERATOR, 't1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.spotlightRequest.create).not.toHaveBeenCalled();
    });

    it('rejects when rating < 4.5', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        ...ELIGIBLE_TOUR,
        aggregateRating: 4.4,
      });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.requestSpotlight('u1', Role.TOUR_OPERATOR, 't1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forbids an operator who does not own the tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        ...ELIGIBLE_TOUR,
        operatorId: 'op2',
      });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.requestSpotlight('u1', Role.TOUR_OPERATOR, 't1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── max-3 cap ───────────────────────────────────────────────────────────────
  describe('approveSpotlight', () => {
    function wireTransaction() {
      // The service runs its body inside $transaction(cb); execute it with the same mock.
      prisma.$transaction.mockImplementation(
        (cb: (tx: typeof prisma) => unknown) => cb(prisma),
      );
    }

    const approveDto = {
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-31T00:00:00.000Z',
    };

    it('approves when the destination has fewer than 3 active', async () => {
      wireTransaction();
      prisma.spotlightRequest.findUnique.mockResolvedValue({
        id: 'sr1',
        destinationId: 'dest1',
        status: SpotlightStatus.REQUESTED,
        tour: { aggregateRating: 4.7, aggregateReviewCount: 12 },
      });
      prisma.spotlightRequest.count.mockResolvedValue(2);
      prisma.spotlightRequest.update.mockResolvedValue(
        spotlightRow({ status: SpotlightStatus.APPROVED, approvedBy: 'admin' }),
      );

      const res = await svc.approveSpotlight('admin', 'sr1', approveDto);
      expect(res.status).toBe(SpotlightStatus.APPROVED);
      expect(prisma.spotlightRequest.update).toHaveBeenCalled();
    });

    it('rejects approval when the destination cap (3) is reached', async () => {
      wireTransaction();
      prisma.spotlightRequest.findUnique.mockResolvedValue({
        id: 'sr1',
        destinationId: 'dest1',
        status: SpotlightStatus.REQUESTED,
        tour: { aggregateRating: 4.7, aggregateReviewCount: 12 },
      });
      prisma.spotlightRequest.count.mockResolvedValue(3);

      await expect(
        svc.approveSpotlight('admin', 'sr1', approveDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.spotlightRequest.update).not.toHaveBeenCalled();
    });

    it('re-checks eligibility at approve and rejects an ineligible tour', async () => {
      wireTransaction();
      prisma.spotlightRequest.findUnique.mockResolvedValue({
        id: 'sr1',
        destinationId: 'dest1',
        status: SpotlightStatus.REQUESTED,
        tour: { aggregateRating: 4.0, aggregateReviewCount: 5 },
      });
      prisma.spotlightRequest.count.mockResolvedValue(0);
      await expect(
        svc.approveSpotlight('admin', 'sr1', approveDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-REQUESTED request', async () => {
      wireTransaction();
      prisma.spotlightRequest.findUnique.mockResolvedValue({
        id: 'sr1',
        destinationId: 'dest1',
        status: SpotlightStatus.ACTIVE,
        tour: { aggregateRating: 4.7, aggregateReviewCount: 12 },
      });
      await expect(
        svc.approveSpotlight('admin', 'sr1', approveDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an inverted window (endsAt <= startsAt)', async () => {
      await expect(
        svc.approveSpotlight('admin', 'sr1', {
          startsAt: '2026-07-31T00:00:00.000Z',
          endsAt: '2026-07-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── tier change + 30-day lock ────────────────────────────────────────────────
  describe('changeTier', () => {
    it('denormalizes commission + rank and sets a 30-day lock', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(ELIGIBLE_TOUR) // assertTourAccess
        .mockResolvedValueOnce({ tierLockedUntil: null }); // lock check
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.tour.update.mockResolvedValue({
        id: 't1',
        tierKey: TierKey.premium,
        commissionTier: new Prisma.Decimal(30.0),
        tierRank: 1,
        tierLockedUntil: new Date('2026-07-25T00:00:00.000Z'),
      });

      const res = await svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
        tierKey: TierKey.premium,
      });
      expect(res.commissionTier).toBe(30.0);
      expect(res.tierRank).toBe(1);
      const updateArg = prisma.tour.update.mock.calls[0][0];
      expect(updateArg.data.tierKey).toBe(TierKey.premium);
      expect(updateArg.data.tierRank).toBe(1);
      expect(updateArg.data.tierLockedUntil).toBeInstanceOf(Date);
    });

    it('rejects a tier change while the lock is still in the future', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(ELIGIBLE_TOUR)
        .mockResolvedValueOnce({
          tierLockedUntil: new Date(Date.now() + 5 * 86_400_000),
        });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
          tierKey: TierKey.boosted,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('allows a change once an expired lock has passed', async () => {
      prisma.tour.findUnique
        .mockResolvedValueOnce(ELIGIBLE_TOUR)
        .mockResolvedValueOnce({
          tierLockedUntil: new Date(Date.now() - 86_400_000),
        });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.tour.update.mockResolvedValue({
        id: 't1',
        tierKey: TierKey.organic,
        commissionTier: new Prisma.Decimal(22.5),
        tierRank: 4,
        tierLockedUntil: new Date(),
      });
      const res = await svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
        tierKey: TierKey.organic,
      });
      expect(res.tierRank).toBe(4);
      expect(res.commissionTier).toBe(22.5);
    });
  });

  // ── effective commission rate ────────────────────────────────────────────────
  describe('effectiveCommissionRate', () => {
    it('is 0.35 when a spotlight is active in the window', async () => {
      prisma.spotlightRequest.findFirst.mockResolvedValue({ id: 'sr1' });
      const rate = await svc.effectiveCommissionRate(
        't1',
        new Date('2026-07-10'),
      );
      expect(rate).toBe(0.35);
      expect(prisma.tour.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to the tier rate when no spotlight is active', async () => {
      prisma.spotlightRequest.findFirst.mockResolvedValue(null);
      prisma.tour.findUnique.mockResolvedValue({
        commissionTier: new Prisma.Decimal(25.0),
      });
      const rate = await svc.effectiveCommissionRate('t1');
      expect(rate).toBe(0.25);
    });

    it('hasActiveSpotlight is false when none match the window', async () => {
      prisma.spotlightRequest.findFirst.mockResolvedValue(null);
      expect(await svc.hasActiveSpotlight('t1')).toBe(false);
    });
  });

  // ── lifecycle job ─────────────────────────────────────────────────────────────
  describe('runSpotlightLifecycle', () => {
    function wireTransaction() {
      prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    }

    it('activates APPROVED-past-start and expires ACTIVE-past-end', async () => {
      wireTransaction();
      prisma.spotlightRequest.findMany.mockResolvedValue([]); // activating, expiring
      prisma.spotlightRequest.updateMany
        .mockResolvedValueOnce({ count: 2 }) // activated
        .mockResolvedValueOnce({ count: 1 }); // expired

      const res = await svc.runSpotlightLifecycle(new Date('2026-07-15'));
      expect(res).toEqual({ activated: 2, expired: 1 });

      // updateMany was queued with the right status filters.
      const activateArg = prisma.spotlightRequest.updateMany.mock.calls[0][0];
      const expireArg = prisma.spotlightRequest.updateMany.mock.calls[1][0];
      expect(activateArg.where.status).toBe(SpotlightStatus.APPROVED);
      expect(activateArg.data.status).toBe(SpotlightStatus.ACTIVE);
      expect(expireArg.where.status).toBe(SpotlightStatus.ACTIVE);
      expect(expireArg.data.status).toBe(SpotlightStatus.EXPIRED);
    });

    it('reports zero transitions when nothing matches', async () => {
      wireTransaction();
      prisma.spotlightRequest.findMany.mockResolvedValue([]);
      prisma.spotlightRequest.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      expect(await svc.runSpotlightLifecycle()).toEqual({
        activated: 0,
        expired: 0,
      });
    });
  });

  // ── Master alignment 2026-07-18: flat bar + provisional window + lifecycle ──

  describe('changeTier eligibility (master §7.2 flat bar)', () => {
    const DAY = 86_400_000;
    const oldPublish = new Date(Date.now() - 120 * DAY); // outside 90d window
    const freshPublish = new Date(Date.now() - 10 * DAY); // inside 90d window

    function tourRow(over: Record<string, unknown> = {}) {
      return {
        tierLockedUntil: null,
        aggregateRating: 4.7,
        aggregateReviewCount: 12,
        firstPublishedAt: oldPublish,
        operatorId: 'op1',
        destinationId: 'dest1',
        ...over,
      };
    }

    beforeEach(() => {
      // assertTourAccess findUnique + changeTier findUnique share the mock.
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.booking.count.mockResolvedValue(0); // no bookings -> cancel check passes
      prisma.tour.update.mockResolvedValue({
        id: 't1',
        tierKey: TierKey.premium,
        commissionTier: new Prisma.Decimal(30),
        tierRank: 1,
        tierLockedUntil: new Date(),
      });
    });

    it('rejects a paid tier when the flat bar fails (too few reviews)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        tourRow({ aggregateReviewCount: 3 }),
      );
      await expect(
        svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
          tierKey: TierKey.premium,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('rejects a paid tier on a high operator cancellation rate (min 10 bookings)', async () => {
      prisma.tour.findUnique.mockResolvedValue(tourRow());
      // 12 counted bookings, 3 operator-cancelled -> 25% > 10%
      prisma.booking.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
      await expect(
        svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
          tierKey: TierKey.boosted,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows any tier inside the one-time 90-day provisional window', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        tourRow({ firstPublishedAt: freshPublish, aggregateReviewCount: 0 }),
      );
      const res = await svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
        tierKey: TierKey.premium,
      });
      expect(res.tierKey).toBe(TierKey.premium);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eligibilityState: 'PROVISIONAL',
            graceStartedAt: null,
            graceMetric: null,
          }),
        }),
      );
    });

    it('allows a paid tier when the bar passes (sets ELIGIBLE)', async () => {
      prisma.tour.findUnique.mockResolvedValue(tourRow());
      await svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
        tierKey: TierKey.featured,
      });
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eligibilityState: 'ELIGIBLE' }),
        }),
      );
    });

    it('open tiers stay ungated even when the bar fails', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        tourRow({ aggregateReviewCount: 0, aggregateRating: null }),
      );
      await expect(
        svc.changeTier('u1', Role.TOUR_OPERATOR, 't1', {
          tierKey: TierKey.organic,
        }),
      ).resolves.toBeDefined();
    });

    it('admins bypass the eligibility gate', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        tourRow({ aggregateReviewCount: 0 }),
      );
      await expect(
        svc.changeTier('admin', Role.ADMIN, 't1', {
          tierKey: TierKey.premium,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('runEligibilityLifecycle', () => {
    const DAY = 86_400_000;
    const now = new Date('2026-07-18T03:00:00.000Z');

    function liveTour(over: Record<string, unknown> = {}) {
      return {
        id: 't1',
        tierKey: TierKey.premium,
        tierRank: 1,
        eligibilityState: 'ELIGIBLE',
        graceStartedAt: null,
        aggregateRating: 4.8,
        aggregateReviewCount: 20,
        firstPublishedAt: new Date(now.getTime() - 200 * DAY),
        operatorId: 'op1',
        ...over,
      };
    }

    beforeEach(() => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.tour.update.mockResolvedValue({});
      prisma.operator.update.mockResolvedValue({});
    });

    it('moves a failing paid-tier tour into 30-day GRACE with the failed metric', async () => {
      prisma.tour.findMany.mockResolvedValue([
        liveTour({ aggregateReviewCount: 2 }),
      ]);
      const res = await svc.runEligibilityLifecycle(now);
      expect(res.graced).toBe(1);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eligibilityState: 'GRACE',
            graceStartedAt: now,
            graceMetric: 'review_count',
          }),
        }),
      );
    });

    it('demotes to organic after grace expires (tier trio updates together)', async () => {
      prisma.tour.findMany.mockResolvedValue([
        liveTour({
          aggregateReviewCount: 2,
          eligibilityState: 'GRACE',
          graceStartedAt: new Date(now.getTime() - 31 * DAY),
        }),
      ]);
      const res = await svc.runEligibilityLifecycle(now);
      expect(res.demoted).toBe(1);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tierKey: TierKey.organic,
            tierRank: 4,
            eligibilityState: 'DEMOTED',
          }),
        }),
      );
    });

    it('marks provisional-window tours PROVISIONAL and never grades them', async () => {
      prisma.tour.findMany.mockResolvedValue([
        liveTour({
          firstPublishedAt: new Date(now.getTime() - 10 * DAY),
          aggregateReviewCount: 0,
          eligibilityState: 'LOCKED',
        }),
      ]);
      const res = await svc.runEligibilityLifecycle(now);
      expect(res.provisional).toBe(1);
      expect(res.graced).toBe(0);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eligibilityState: 'PROVISIONAL' }),
        }),
      );
    });

    it('recovers a GRACE tour to ELIGIBLE when the bar passes again', async () => {
      prisma.tour.findMany.mockResolvedValue([
        liveTour({
          eligibilityState: 'GRACE',
          graceStartedAt: new Date(now.getTime() - 5 * DAY),
        }),
      ]);
      const res = await svc.runEligibilityLifecycle(now);
      expect(res.graced).toBe(0);
      expect(res.demoted).toBe(0);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eligibilityState: 'ELIGIBLE',
            graceStartedAt: null,
          }),
        }),
      );
    });

    it('refreshes the denormalized operator cancellationRate90d', async () => {
      prisma.tour.findMany.mockResolvedValue([liveTour()]);
      prisma.booking.count.mockResolvedValueOnce(20).mockResolvedValueOnce(1); // 5%
      await svc.runEligibilityLifecycle(now);
      expect(prisma.operator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'op1' },
        }),
      );
    });
  });
});
