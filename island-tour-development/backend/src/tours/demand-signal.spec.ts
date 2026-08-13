import { DepartureStatus } from '@prisma/client';

import type { PrismaService } from '@/prisma/prisma.service';
import { DEMAND_MIN_AGE_DAYS, evaluateLikelyToSellOut } from './demand-signal';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-08-08T12:00:00.000Z');
const OLD_ENOUGH = new Date(
  NOW.getTime() - (DEMAND_MIN_AGE_DAYS + 10) * DAY_MS,
);

type ClosureRow = { id: string; closureBatchId: string | null };

/**
 * The three conditions are independent, so each test fixes two of them and
 * moves the third. `soldOut` is the count of departures that filled with us and
 * `closures` the operator's whole-day CLOSE_DATE rows in the window; the
 * upcoming departures default to 30% availability, i.e. condition 3 passing.
 */
function makePrisma({
  publishedAt = OLD_ENOUGH,
  soldOut = 0,
  closures = [] as ClosureRow[],
  upcoming = [{ capacity: 10, bookedCount: 7 }],
}: {
  publishedAt?: Date | null;
  soldOut?: number;
  closures?: ClosureRow[];
  upcoming?: { capacity: number; bookedCount: number }[];
} = {}) {
  return {
    tour: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          publishedAt && { firstPublishedAt: publishedAt, publishedAt },
        ),
    },
    departure: {
      count: jest.fn().mockResolvedValue(soldOut),
      findMany: jest.fn().mockResolvedValue(upcoming),
    },
    availabilityException: {
      findMany: jest.fn().mockResolvedValue(closures),
    },
  } as unknown as Pick<
    PrismaService,
    'tour' | 'departure' | 'availabilityException'
  >;
}

describe('evaluateLikelyToSellOut (master §3.7)', () => {
  it('fires when all three conditions hold', async () => {
    const prisma = makePrisma({ soldOut: 3 });
    await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
      true,
    );
  });

  it('does not fire below the 90-day age floor', async () => {
    const prisma = makePrisma({
      publishedAt: new Date(NOW.getTime() - 30 * DAY_MS),
      soldOut: 9,
    });
    await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
      false,
    );
  });

  it('does not fire on two sell-outs, fires on three', async () => {
    await expect(
      evaluateLikelyToSellOut(makePrisma({ soldOut: 2 }), 't1', NOW),
    ).resolves.toBe(false);
    await expect(
      evaluateLikelyToSellOut(makePrisma({ soldOut: 3 }), 't1', NOW),
    ).resolves.toBe(true);
  });

  it('does not fire at 40% or more availability ahead', async () => {
    const prisma = makePrisma({
      soldOut: 5,
      upcoming: [{ capacity: 10, bookedCount: 6 }], // exactly 0.40
    });
    await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
      false,
    );
  });

  // Condition 3 reads real departures, never calendar days - a tour that sails
  // three days a week must not qualify (or fail) on the days it never sails.
  it('measures availability across departures, not calendar days', async () => {
    const prisma = makePrisma({
      soldOut: 3,
      // 13 sailings in the next 30 days, all nearly full. A calendar-day
      // measure would see 17 empty days and call this 57% open.
      upcoming: Array.from({ length: 13 }, () => ({
        capacity: 12,
        bookedCount: 11,
      })),
    });
    await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
      true,
    );
  });

  it('has no signal when nothing is scheduled ahead', async () => {
    const prisma = makePrisma({ soldOut: 9, upcoming: [] });
    await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
      false,
    );
  });

  describe('sell-out counting', () => {
    it('counts operator date closures alongside departures that filled with us', async () => {
      const prisma = makePrisma({
        soldOut: 1,
        closures: [
          { id: 'c1', closureBatchId: null },
          { id: 'c2', closureBatchId: null },
        ],
      });
      await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
        true,
      );
    });

    it('counts a bulk blackout once, not once per closed date', async () => {
      // A 14-day haul-out: one operator action, so one event - not enough on
      // its own, which is the entire point of the batch id.
      const prisma = makePrisma({
        closures: Array.from({ length: 14 }, (_, i) => ({
          id: `c${i}`,
          closureBatchId: 'batch-1',
        })),
      });
      await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
        false,
      );
    });

    /**
     * Only a close the operator EXPLAINED as a sell-out is evidence of demand
     * (mck-15 §4: "An operator-marked sold out counts; a Not running does
     * not"). A "Not running" is weather, maintenance or a day off - the
     * opposite - and an unexplained close from before reasons existed cannot be
     * read either way without inventing intent.
     *
     * The filter lives in the query, so this asserts the query: the fixture
     * returns whatever it is handed regardless of the `where`.
     */
    it('counts only closures the operator marked Sold out', async () => {
      const prisma = makePrisma({ closures: [] });
      await evaluateLikelyToSellOut(prisma, 't1', NOW);
      expect(prisma.availabilityException.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // retiredAt: null - an undone (retired) closure is withdrawn
          // evidence, same semantics as when Undo hard-deleted the row.
          where: expect.objectContaining({
            closureReason: 'SOLD_OUT',
            retiredAt: null,
          }),
        }),
      );
    });

    it('counts three separate blackouts as three events', async () => {
      const prisma = makePrisma({
        closures: [
          { id: 'a1', closureBatchId: 'batch-1' },
          { id: 'a2', closureBatchId: 'batch-1' },
          { id: 'b1', closureBatchId: 'batch-2' },
          { id: 'c1', closureBatchId: null }, // a single-date close
        ],
      });
      await expect(evaluateLikelyToSellOut(prisma, 't1', NOW)).resolves.toBe(
        true,
      );
    });

    it('reads closures by when the operator acted, inside the 60-day window', async () => {
      const prisma = makePrisma({ soldOut: 3 });
      await evaluateLikelyToSellOut(prisma, 't1', NOW);
      const where = (prisma.availabilityException.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.type).toBe('CLOSE_DATE');
      expect(where.createdAt.gte).toEqual(
        new Date(NOW.getTime() - 60 * DAY_MS),
      );
      expect(where.createdAt.lte).toEqual(NOW);
    });
  });

  it('ignores cancelled departures when measuring what is left', async () => {
    const prisma = makePrisma({ soldOut: 3 });
    await evaluateLikelyToSellOut(prisma, 't1', NOW);
    const where = (prisma.departure.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.status).toEqual({ not: DepartureStatus.CANCELLED });
  });
});
