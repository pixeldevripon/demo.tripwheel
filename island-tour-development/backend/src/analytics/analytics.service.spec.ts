import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';

import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';

import { AnalyticsService } from './analytics.service';

/**
 * These tests pin the behaviour that is easy to regress and expensive to
 * notice: the customer definition, the honesty of the trend axis, operator
 * scoping, and the refund double-count trap. The SQL itself is exercised
 * against a real database by the e2e suite - here the raw calls are
 * dispatched by content so each aggregate can be driven independently.
 */

type RawFixtures = {
  revenue?: unknown[];
  customers?: unknown[];
  payments?: unknown[];
  trendRevenue?: unknown[];
  trendBookings?: unknown[];
  recentCustomers?: unknown[];
  ledger?: unknown[];
  byPaymentModel?: unknown[];
};

function createMockPrisma(fixtures: RawFixtures = {}) {
  const queryRaw = jest.fn((sql: Prisma.Sql) => {
    const text = sql.strings.join(' ');

    if (text.includes('AS earned')) {
      return Promise.resolve(
        fixtures.revenue ?? [
          {
            earned: '0',
            pending: '0',
            earned_in_range: '0',
            earned_in_previous_range: '0',
            gmv: '0',
            commission: '0',
            untracked_balance: '0',
          },
        ],
      );
    }
    if (text.includes('AS gross')) {
      return Promise.resolve(
        fixtures.ledger ?? [{ gross: '0', refunded: '0' }],
      );
    }
    if (text.includes('paymentModel"::text AS model')) {
      return Promise.resolve(fixtures.byPaymentModel ?? []);
    }
    if (text.includes('per_customer')) {
      return Promise.resolve(
        fixtures.customers ?? [
          {
            total: 0n,
            new_in_range: 0n,
            new_in_previous_range: 0n,
            repeat_customers: 0n,
            active_in_range: 0n,
          },
        ],
      );
    }
    if (text.includes('p.status::text AS status')) {
      return Promise.resolve(fixtures.payments ?? []);
    }
    if (text.includes('SUM(p.amount')) {
      return Promise.resolve(fixtures.trendRevenue ?? []);
    }
    if (text.includes('COUNT(*) AS value')) {
      return Promise.resolve(fixtures.trendBookings ?? []);
    }
    if (text.includes('first_booking_at')) {
      return Promise.resolve(fixtures.recentCustomers ?? []);
    }
    return Promise.resolve([]);
  });

  return {
    $queryRaw: queryRaw,
    booking: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { commissionAmount: null, totalEur: null },
      }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    tour: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    // Payouts due now reads the settlements LEDGER (owed-pending roll-up).
    settlement: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { netPosition: null } }),
    },
    user: { count: jest.fn().mockResolvedValue(0) },
    operator: { findUnique: jest.fn().mockResolvedValue({ id: 'op-1' }) },
  };
}

async function build(prisma: ReturnType<typeof createMockPrisma>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: FxRatesService,
        useValue: {
          getRate: jest.fn().mockResolvedValue({
            rate: 1.08695652,
            providerAsOf: new Date('2026-07-20T00:00:00Z'),
          }),
        },
      },
    ],
  }).compile();
  return module.get<AnalyticsService>(AnalyticsService);
}

const ADMIN = { id: 'admin-1', role: Role.ADMIN };

describe('AnalyticsService', () => {
  describe('scope', () => {
    it('reports platform scope and reads the global account count for an admin', async () => {
      const prisma = createMockPrisma();
      prisma.user.count.mockResolvedValue(12);
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      expect(res.scope).toBe('platform');
      expect(res.currency).toBe('EUR');
      expect(res.customers.registered).toBe(12);
    });

    it('withholds the global account count from an operator', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats(
        {},
        {
          id: 'u-1',
          role: Role.TOUR_OPERATOR,
        },
      );

      expect(res.scope).toBe('operator');
      // An operator must not learn how many travelers the whole
      // marketplace has - that is not their slice of the data.
      expect(res.customers.registered).toBeNull();
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('scopes tour counts to the operator', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await service.getDashboardStats(
        {},
        { id: 'u-1', role: Role.TOUR_OPERATOR },
      );

      expect(prisma.tour.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operatorId: 'op-1' }),
        }),
      );
    });
  });

  describe('customers', () => {
    it('counts distinct bookers, so guest bookings are not lost', async () => {
      const prisma = createMockPrisma({
        customers: [
          {
            total: 15n,
            new_in_range: 4n,
            new_in_previous_range: 2n,
            repeat_customers: 11n,
            active_in_range: 9n,
          },
        ],
      });
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      expect(res.customers).toMatchObject({
        total: 15,
        newInRange: 4,
        newInPreviousRange: 2,
        repeat: 11,
        activeInRange: 9,
      });
    });

    it('keys customers by userId OR contact email so guest checkout counts', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await service.getDashboardStats({}, ADMIN);

      const customerQuery = prisma.$queryRaw.mock.calls
        .map(([sql]) => sql.strings.join(' '))
        .find((t) => t.includes('per_customer'));

      // Guest bookings carry userId NULL; counting User rows alone would
      // report zero customers while bookings flow.
      expect(customerQuery).toContain(
        'COALESCE(b."userId", lower(b."contactEmail"))',
      );
    });
  });

  describe('revenue', () => {
    it('counts REFUND rows only for refunds, and keeps refunded charges in gross', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await service.getDashboardStats({}, ADMIN);

      const revenueQuery = prisma.$queryRaw.mock.calls
        .map(([sql]) => sql.strings.join(' '))
        .find((t) => t.includes('AS gross'));

      // A refund is written twice (original payment flips to REFUNDED and
      // a REFUND row is added). Refunds are counted from REFUND rows only;
      // gross keeps the refunded original (the money WAS collected) so
      // gross - refunded nets out correctly and nothing double counts.
      expect(revenueQuery).toContain("p.kind::text = 'REFUND'");
      expect(revenueQuery).toContain("p.status IN ('SUCCEEDED', 'REFUNDED')");
    });

    it('normalizes money with the booking snapshotted FX rate', async () => {
      const prisma = createMockPrisma({
        revenue: [
          {
            earned: '8914.2999',
            pending: '3568.30',
            earned_in_range: '100',
            earned_in_previous_range: '0',
            gmv: '50154.14',
            commission: '8914.30',
            untracked_balance: '20404.53',
          },
        ],
      });
      prisma.settlement.aggregate.mockResolvedValue({
        _sum: { netPosition: new Prisma.Decimal('11419.19') },
      });
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      // Rounded to cents, not left as a float artefact.
      expect(res.revenue.earnedEur).toBe(8914.3);
      // Ledger truth: payouts due mirrors the Settlements page owed-pending
      // roll-up (RECORDED paid_in_full nets), never re-derived from bookings.
      expect(res.revenue.payoutDueEur).toBe(11419.19);
      expect(prisma.settlement.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'RECORDED',
            paymentModel: 'PAID_IN_FULL',
          }),
        }),
      );
    });

    it('reports commission separately from GMV', async () => {
      const prisma = createMockPrisma({
        revenue: [
          {
            earned: '8914.30',
            pending: '0',
            earned_in_range: '0',
            earned_in_previous_range: '0',
            gmv: '50154.14',
            commission: '8914.30',
            untracked_balance: '0',
          },
        ],
      });
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      expect(res.revenue.commissionEur).toBe(8914.3);
      expect(res.revenue.gmvEur).toBe(50154.14);
    });

    it('earns COMMISSION for an admin but NET for an operator', async () => {
      const adminPrisma = createMockPrisma();
      const adminSvc = await build(adminPrisma);
      await adminSvc.getDashboardStats({}, ADMIN);
      const adminSql = adminPrisma.$queryRaw.mock.calls
        .map(([sql]) => sql.strings.join(' '))
        .find((t) => t.includes('AS earned'));

      const opPrisma = createMockPrisma();
      const opSvc = await build(opPrisma);
      await opSvc.getDashboardStats(
        {},
        { id: 'u-1', role: Role.TOUR_OPERATOR },
      );
      const opSqlValues = opPrisma.$queryRaw.mock.calls
        .map(([sql]) => sql)
        .find((s) => s.strings.join(' ').includes('AS earned'));

      // The deposit IS the platform commission, so the two audiences hold
      // opposite halves of the same booking and must never see the same
      // number labelled "revenue".
      expect(adminSql).toBeDefined();
      expect(opSqlValues).toBeDefined();
      expect(JSON.stringify(opSqlValues)).toContain('totalEur');
    });

    it('withholds Stripe cash collected from an operator', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats(
        {},
        {
          id: 'u-1',
          role: Role.TOUR_OPERATOR,
        },
      );

      // On the deposit models an operator's takings never touch the
      // platform ledger, so zero would be a lie - null says "not applicable".
      expect(res.revenue.cashCollectedEur).toBeNull();
      expect(res.revenue.refundedEur).toBeNull();
    });
  });

  describe('trend', () => {
    it('returns a continuous axis with genuinely empty buckets kept at zero', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats({ buckets: 6 }, ADMIN);

      expect(res.trend.granularity).toBe('month');
      expect(res.trend.points).toHaveLength(6);
      // Quiet months must render as real zeros rather than collapsing the
      // chart or being back-filled with invented values.
      expect(
        res.trend.points.every((p) => p.earnedEur === 0 && p.bookings === 0),
      ).toBe(true);
    });

    it('is ordered oldest first and ends on the current bucket', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats({ buckets: 3 }, ADMIN);
      const keys = res.trend.points.map((p) => p.bucket);

      expect([...keys].sort()).toEqual(keys);
      expect(keys[keys.length - 1]).toBe(new Date().toISOString().slice(0, 7));
    });

    it('supports day granularity', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats(
        { granularity: 'day', buckets: 10 },
        ADMIN,
      );

      expect(res.trend.granularity).toBe('day');
      expect(res.trend.points).toHaveLength(10);
      expect(res.trend.points[9].bucket).toBe(
        new Date().toISOString().slice(0, 10),
      );
    });
  });

  describe('byStatus maps', () => {
    it('includes every enum member so a zero status is visible, not missing', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      expect(res.bookings.byStatus).toMatchObject({
        ON_HOLD: 0,
        CONFIRMED: 0,
        REDEEMED: 0,
        CANCELLED: 0,
        EXPIRED: 0,
      });
      expect(res.trips.byStatus).toMatchObject({
        DRAFT: 0,
        LIVE: 0,
        ARCHIVED: 0,
      });
    });
  });

  /**
   * The range exists so that no figure on the dashboard has an ambiguous
   * window. These pin the distinction it rests on: a FLOW happened during a
   * period and is filtered; a STOCK is current state and a date-filtered stock
   * would be meaningless, so it must survive untouched.
   */
  describe('date range', () => {
    const RANGE = { from: '2026-07-01', to: '2026-07-10' };

    /** Prisma `where` objects passed to `booking.count`, call order preserved. */
    const bookingWheres = (prisma: ReturnType<typeof createMockPrisma>) =>
      prisma.booking.count.mock.calls.map(
        ([args]: [{ where: Record<string, unknown> }]) => args.where,
      );

    it('filters a FLOW by the range', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await service.getDashboardStats(RANGE, ADMIN);

      // First call is bookings.total, which counts bookings CREATED in the
      // window rather than every booking that has ever existed.
      const [total] = bookingWheres(prisma);
      expect(total.createdAt).toEqual({
        gte: new Date('2026-07-01T00:00:00.000Z'),
        // Exclusive next midnight: `to` names an inclusive DAY, so bounding at
        // the day itself would silently drop everything booked on it.
        lt: new Date('2026-07-11T00:00:00.000Z'),
      });
    });

    it('leaves a STOCK unfiltered', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await service.getDashboardStats(RANGE, ADMIN);

      // trips.total is the size of the catalogue right now. "How many tours
      // exist between 1 and 10 July" is not a question with an answer.
      const [tripsTotal] = prisma.tour.count.mock.calls.map(
        ([args]: [{ where: Record<string, unknown> }]) => args.where,
      );
      expect(tripsTotal).not.toHaveProperty('createdAt');

      // bookings.upcoming is forward-looking by definition.
      const upcoming = bookingWheres(prisma)[3];
      expect(upcoming).not.toHaveProperty('createdAt');
      expect(upcoming.status).toBe('CONFIRMED');
    });

    it('compares against an equal-length window immediately before the range', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats(RANGE, ADMIN);

      // 1-10 July is ten days, so the comparison window is the ten days
      // ending the day before it starts. Comparing a 10-day range against a
      // calendar month would manufacture growth out of the length difference.
      expect(res.range).toEqual({
        from: '2026-07-01',
        to: '2026-07-10',
        isAllTime: false,
        previousFrom: '2026-06-21',
        previousTo: '2026-06-30',
      });

      const previous = bookingWheres(prisma)[2];
      expect(previous.createdAt).toEqual({
        gte: new Date('2026-06-21T00:00:00.000Z'),
        lt: new Date('2026-07-01T00:00:00.000Z'),
      });
    });

    it('anchors the trend series to the range instead of today', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats(
        { ...RANGE, granularity: 'day' },
        ADMIN,
      );

      expect(res.trend.points).toHaveLength(10);
      expect(res.trend.points[0].bucket).toBe('2026-07-01');
      expect(res.trend.points[9].bucket).toBe('2026-07-10');
    });

    it('reports all time and keeps month-over-month growth when no range is set', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      expect(res.range).toEqual({
        from: null,
        to: null,
        isAllTime: true,
        previousFrom: null,
        previousTo: null,
      });

      // All-time totals stay unfiltered, so nothing regresses for the default
      // view; the growth pair still measures this month against last month.
      const [total, inRange, inPrevious] = bookingWheres(prisma);
      expect(total).not.toHaveProperty('createdAt');
      const now = new Date();
      const thisMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const lastMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      expect(inRange.createdAt).toEqual({ gte: thisMonth });
      expect(inPrevious.createdAt).toEqual({
        gte: lastMonth,
        lt: thisMonth,
      });
    });

    it('rejects a range that ends before it starts', async () => {
      const prisma = createMockPrisma();
      const service = await build(prisma);

      await expect(
        service.getDashboardStats(
          { from: '2026-07-10', to: '2026-07-01' },
          ADMIN,
        ),
      ).rejects.toThrow('`to` must not be earlier than `from`.');
    });
  });

  describe('recent activity', () => {
    it('masks traveler emails', async () => {
      const prisma = createMockPrisma({
        recentCustomers: [
          {
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            bookings: 3n,
            first_booking_at: new Date('2026-07-15T00:00:00Z'),
          },
        ],
      });
      const service = await build(prisma);

      const res = await service.getDashboardStats({}, ADMIN);

      // Dashboard screens get screenshotted and shared, same reasoning as
      // the thank-you page.
      expect(res.recent.customers[0].email).not.toContain('ada@example.com');
      expect(res.recent.customers[0].email).toBe('a•••@e•••.com');
      expect(res.recent.customers[0].bookings).toBe(3);
    });
  });
});
