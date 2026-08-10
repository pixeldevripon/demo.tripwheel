/**
 * Booking seat-claim / seat-release concurrency tests (F1/F2 of
 * technical-doc/03-implementation/BOOKING-CONCURRENCY-HARDENING.md).
 *
 * These MUST run against real Postgres: every property under test lives below
 * the level a mocked Prisma can see - raw SQL, row locks, and READ COMMITTED
 * re-evaluation of UPDATE guards. Historical failure modes this file pins:
 *
 * - `releaseSeats` was a read-modify-write; two concurrent releases both read
 *   the same `bookedCount` and the later commit erased the earlier decrement,
 *   leaking seats (phantom sold-out). The old code fails the release race
 *   below within a few iterations.
 * - The claim guard compared `bookedCount` against a JS literal computed from
 *   a pre-read `capacity`; a capacity reduction committed between that read
 *   and the claim was invisible, so the claim could exceed the new capacity.
 *
 * The methods are exercised straight off `BookingsService.prototype`:
 * `claimSeats` / `releaseSeats` / `recomputeStoredStatus` operate purely on
 * the transaction client they are handed and touch no other service state, so
 * booting the full Nest DI graph (Redis, Stripe, mail, ...) would add nothing
 * to what is a database-behaviour test.
 */
import { DepartureStatus, Prisma, PrismaClient, Region } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BookingsService } from '../src/bookings/bookings.service';

type Tx = Prisma.TransactionClient;
type ClaimArgs = {
  departureId: string;
  tourId: string;
  seats: number;
  exclusive: boolean;
  intoSticky?: boolean;
};

// Real prototype methods, no DI. The `any` hop is deliberate: the methods are
// private because application code must never call them outside a transaction
// - this suite IS the transaction-behaviour test.
const svc: any = Object.create(BookingsService.prototype);
const claimSeats = (tx: Tx, args: ClaimArgs): Promise<boolean> =>
  svc.claimSeats(tx, args);
const releaseSeats = (
  tx: Tx,
  departureId: string,
  seats: number,
  exclusive = false,
): Promise<void> => svc.releaseSeats(tx, departureId, seats, exclusive);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('booking seat claim/release under concurrency (real Postgres)', () => {
  let prisma: PrismaClient;
  let tourId: string;
  let userId: string;
  let operatorId: string;
  let destinationId: string;

  beforeAll(async () => {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    const destination = await prisma.destination.create({
      data: {
        name: `E2E Concurrency Dest ${suffix}`,
        slug: `e2e-concurrency-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
    });
    destinationId = destination.id;

    const user = await prisma.user.create({
      data: {
        name: 'E2E Concurrency Operator',
        email: `concurrency+${suffix}@example-e2e.com`,
      },
    });
    userId = user.id;
    const operator = await prisma.operator.create({ data: { userId } });
    operatorId = operator.id;

    const tour = await prisma.tour.create({
      data: {
        name: `E2E Concurrency Tour ${suffix}`,
        slug: `e2e-concurrency-tour-${suffix}`,
        destinationId,
        operatorId,
        timeZone: 'America/Curacao',
      },
    });
    tourId = tour.id;
  }, 60_000);

  afterAll(async () => {
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* a partial cleanup failure must not mask a real test failure */
      }
    };
    await safe(() => prisma.departure.deleteMany({ where: { tourId } }));
    await safe(() => prisma.tour.delete({ where: { id: tourId } }));
    await safe(() => prisma.operator.delete({ where: { id: operatorId } }));
    await safe(() => prisma.user.delete({ where: { id: userId } }));
    await safe(() =>
      prisma.destination.delete({ where: { id: destinationId } }),
    );
    await prisma.$disconnect();
  });

  /** A fresh departure per case; unique (date, startTime) via a counter. */
  let depSeq = 0;
  async function makeDeparture(over: {
    capacity: number;
    bookedCount?: number;
    status?: DepartureStatus;
    soldOutAt?: Date | null;
  }) {
    depSeq += 1;
    const dep = await prisma.departure.create({
      data: {
        tourId,
        date: new Date(`2031-03-${String((depSeq % 27) + 1).padStart(2, '0')}`),
        startTime: new Date(
          Date.UTC(1970, 0, 1, Math.floor(depSeq / 27) % 24, depSeq % 60),
        ),
        capacity: over.capacity,
        bookedCount: over.bookedCount ?? 0,
        status: over.status ?? DepartureStatus.OPEN,
        soldOutAt: over.soldOutAt ?? null,
      },
    });
    return dep;
  }

  function readDep(id: string) {
    return prisma.departure.findUniqueOrThrow({
      where: { id },
      select: {
        capacity: true,
        bookedCount: true,
        status: true,
        soldOutAt: true,
      },
    });
  }

  describe('F1 - releaseSeats is an atomic clamped decrement', () => {
    it('concurrent releases compose: 10 - 2 - 3 = 5, every time (50 runs)', async () => {
      // The old read-modify-write fails this within a few iterations: both
      // transactions read 10, one writes 8, the other overwrites with 7.
      for (let i = 0; i < 50; i++) {
        const dep = await makeDeparture({ capacity: 20, bookedCount: 10 });
        await Promise.all([
          prisma.$transaction((tx) => releaseSeats(tx, dep.id, 2)),
          prisma.$transaction((tx) => releaseSeats(tx, dep.id, 3)),
        ]);
        const after = await readDep(dep.id);
        expect(after.bookedCount).toBe(5);
        await prisma.departure.delete({ where: { id: dep.id } });
      }
    }, 120_000);

    it('clamps at zero instead of going negative', async () => {
      const dep = await makeDeparture({ capacity: 10, bookedCount: 2 });
      await prisma.$transaction((tx) => releaseSeats(tx, dep.id, 5));
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(0);
      expect(after.status).toBe(DepartureStatus.OPEN);
    });

    it('reopens a SOLD_OUT departure and preserves soldOutAt history', async () => {
      const soldOutAt = new Date('2030-01-01T00:00:00.000Z');
      const dep = await makeDeparture({
        capacity: 10,
        bookedCount: 10,
        status: DepartureStatus.SOLD_OUT,
        soldOutAt,
      });
      await prisma.$transaction((tx) => releaseSeats(tx, dep.id, 2));
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(8);
      expect(after.status).toBe(DepartureStatus.OPEN);
      expect(after.soldOutAt).toEqual(soldOutAt); // history, not a live flag
    });

    it('leaves sticky CLOSED untouched when seats free up', async () => {
      const dep = await makeDeparture({
        capacity: 10,
        bookedCount: 10,
        status: DepartureStatus.CLOSED,
      });
      await prisma.$transaction((tx) => releaseSeats(tx, dep.id, 4));
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(6);
      expect(after.status).toBe(DepartureStatus.CLOSED);
    });
  });

  describe('F2 - claimSeats: one guarded UPDATE is the overbooking backstop', () => {
    it('two rivals race the last seats: exactly one wins, exact capacity, fused SOLD_OUT flip', async () => {
      for (let i = 0; i < 25; i++) {
        const dep = await makeDeparture({ capacity: 20, bookedCount: 18 });
        const results = await Promise.all([
          prisma.$transaction((tx) =>
            claimSeats(tx, {
              departureId: dep.id,
              tourId,
              seats: 2,
              exclusive: false,
            }),
          ),
          prisma.$transaction((tx) =>
            claimSeats(tx, {
              departureId: dep.id,
              tourId,
              seats: 2,
              exclusive: false,
            }),
          ),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const after = await readDep(dep.id);
        expect(after.bookedCount).toBe(20); // never 22
        expect(after.status).toBe(DepartureStatus.SOLD_OUT);
        expect(after.soldOutAt).not.toBeNull();
        await prisma.departure.delete({ where: { id: dep.id } });
      }
    }, 120_000);

    it('party exceeding the remainder loses cleanly', async () => {
      const dep = await makeDeparture({ capacity: 10, bookedCount: 8 });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 3,
          exclusive: false,
        }),
      );
      expect(won).toBe(false);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(8);
      expect(after.status).toBe(DepartureStatus.OPEN);
    });

    it('honours a capacity reduction committed after the pre-transaction reads', async () => {
      // The scenario the old JS-literal guard missed: the booking flow read
      // capacity 10 (2 free seats for a party of 2), then an operator edit
      // committed capacity 8 before the claim ran. The guard must compare
      // against the LIVE column and lose.
      const dep = await makeDeparture({ capacity: 10, bookedCount: 8 });

      const won = await prisma.$transaction(async (tx) => {
        // Stale pre-read, exactly where reserve's context load sits.
        await tx.departure.findUniqueOrThrow({
          where: { id: dep.id },
          select: { capacity: true },
        });
        // A rival connection shrinks capacity to the current fill and COMMITS.
        await prisma.departure.update({
          where: { id: dep.id },
          data: { capacity: 8 },
        });
        return claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
        });
      });

      expect(won).toBe(false);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(8); // still within the new capacity
      expect(after.capacity).toBe(8);
    });

    it('wrong tour id claims nothing', async () => {
      const dep = await makeDeparture({ capacity: 10, bookedCount: 0 });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId: '00000000-0000-4000-8000-000000000000',
          seats: 1,
          exclusive: false,
        }),
      );
      expect(won).toBe(false);
    });

    it('exclusive charter takes the WHOLE unit, and only from empty', async () => {
      const dep = await makeDeparture({ capacity: 12, bookedCount: 0 });
      const [first, second] = await Promise.all([
        prisma.$transaction((tx) =>
          claimSeats(tx, {
            departureId: dep.id,
            tourId,
            seats: 6,
            exclusive: true,
          }),
        ),
        prisma.$transaction((tx) =>
          claimSeats(tx, {
            departureId: dep.id,
            tourId,
            seats: 4,
            exclusive: true,
          }),
        ),
      ]);
      expect([first, second].filter(Boolean)).toHaveLength(1);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(12);
      expect(after.status).toBe(DepartureStatus.SOLD_OUT);
      expect(after.soldOutAt).not.toBeNull();
    });

    it('a partially booked departure refuses an exclusive claim', async () => {
      const dep = await makeDeparture({ capacity: 12, bookedCount: 1 });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: true,
        }),
      );
      expect(won).toBe(false);
    });
  });

  describe('F2 - intoSticky (restore): sticky states accept a returning seat', () => {
    it('re-claims into a SOLD_OUT departure with room and re-derives OPEN', async () => {
      // Capacity was raised after the sell-out; the stored status is stale
      // SOLD_OUT. A restore may return seats, and the fill now says OPEN.
      const dep = await makeDeparture({
        capacity: 12,
        bookedCount: 8,
        status: DepartureStatus.SOLD_OUT,
        soldOutAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
          intoSticky: true,
        }),
      );
      expect(won).toBe(true);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(10);
      expect(after.status).toBe(DepartureStatus.OPEN);
    });

    it('fills a SOLD_OUT departure to the brim and keeps it SOLD_OUT', async () => {
      const dep = await makeDeparture({
        capacity: 10,
        bookedCount: 8,
        status: DepartureStatus.SOLD_OUT,
        soldOutAt: new Date('2030-01-01T00:00:00.000Z'),
      });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
          intoSticky: true,
        }),
      );
      expect(won).toBe(true);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(10);
      expect(after.status).toBe(DepartureStatus.SOLD_OUT);
      // The original stamp is history - never overwritten.
      expect(after.soldOutAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
    });

    it('keeps CLOSED sticky even when the restore fills the departure', async () => {
      const dep = await makeDeparture({
        capacity: 10,
        bookedCount: 8,
        status: DepartureStatus.CLOSED,
      });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
          intoSticky: true,
        }),
      );
      expect(won).toBe(true);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(10);
      expect(after.status).toBe(DepartureStatus.CLOSED);
      expect(after.soldOutAt).toBeNull();
    });

    it('refuses a CANCELLED departure - the one true dead end', async () => {
      const dep = await makeDeparture({
        capacity: 10,
        bookedCount: 0,
        status: DepartureStatus.CANCELLED,
      });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
          intoSticky: true,
        }),
      );
      expect(won).toBe(false);
      const after = await readDep(dep.id);
      expect(after.bookedCount).toBe(0);
      expect(after.status).toBe(DepartureStatus.CANCELLED);
    });

    it('still enforces the capacity guard - a resold departure refuses the return', async () => {
      const dep = await makeDeparture({ capacity: 10, bookedCount: 9 });
      const won = await prisma.$transaction((tx) =>
        claimSeats(tx, {
          departureId: dep.id,
          tourId,
          seats: 2,
          exclusive: false,
          intoSticky: true,
        }),
      );
      expect(won).toBe(false);
    });
  });

  describe('claim + release compose', () => {
    it('a rush then a cancel wave converges to the exact surviving count', async () => {
      const dep = await makeDeparture({ capacity: 10, bookedCount: 0 });
      // 8 rivals claim 2 seats each into 10 seats: exactly 5 can win.
      const claims = await Promise.all(
        Array.from({ length: 8 }, () =>
          prisma.$transaction((tx) =>
            claimSeats(tx, {
              departureId: dep.id,
              tourId,
              seats: 2,
              exclusive: false,
            }),
          ),
        ),
      );
      expect(claims.filter(Boolean)).toHaveLength(5);
      let state = await readDep(dep.id);
      expect(state.bookedCount).toBe(10);
      expect(state.status).toBe(DepartureStatus.SOLD_OUT);

      // Two winners cancel concurrently: both decrements must land.
      await Promise.all([
        prisma.$transaction((tx) => releaseSeats(tx, dep.id, 2)),
        prisma.$transaction((tx) => releaseSeats(tx, dep.id, 2)),
      ]);
      state = await readDep(dep.id);
      expect(state.bookedCount).toBe(6);
      expect(state.status).toBe(DepartureStatus.OPEN);
      expect(state.soldOutAt).not.toBeNull();
    }, 60_000);
  });

  describe('F5 - departures_booked_within_capacity CHECK backstop', () => {
    // After F1/F2 no application writer can violate the invariant; the
    // constraint exists to stop FUTURE code paths, admin scripts and console
    // sessions. These write raw SQL on purpose - the point is that even a
    // writer that bypasses every service guard is refused by the database.
    it('refuses bookedCount above capacity', async () => {
      const dep = await makeDeparture({ capacity: 4, bookedCount: 4 });
      await expect(
        prisma.$executeRaw`
          UPDATE "departures" SET "bookedCount" = "capacity" + 1
          WHERE "id" = ${dep.id}`,
      ).rejects.toThrow(/departures_booked_within_capacity/);
      expect((await readDep(dep.id)).bookedCount).toBe(4);
    });

    it('refuses a negative bookedCount', async () => {
      const dep = await makeDeparture({ capacity: 4, bookedCount: 0 });
      await expect(
        prisma.$executeRaw`
          UPDATE "departures" SET "bookedCount" = -1
          WHERE "id" = ${dep.id}`,
      ).rejects.toThrow(/departures_booked_within_capacity/);
      expect((await readDep(dep.id)).bookedCount).toBe(0);
    });

    it('refuses a capacity cut below the seats already sold', async () => {
      // The service guard (updateDeparture's floor + optimistic lock) answers
      // this politely at the API; the constraint is the last line for any
      // writer that skips the service.
      const dep = await makeDeparture({ capacity: 10, bookedCount: 8 });
      await expect(
        prisma.$executeRaw`
          UPDATE "departures" SET "capacity" = 6
          WHERE "id" = ${dep.id}`,
      ).rejects.toThrow(/departures_booked_within_capacity/);
      expect((await readDep(dep.id)).capacity).toBe(10);
    });

    it('refuses an out-of-invariant INSERT outright', async () => {
      await expect(
        prisma.departure.create({
          data: {
            tourId,
            date: new Date('2031-12-24'),
            startTime: new Date(Date.UTC(1970, 0, 1, 23, 45)),
            capacity: 2,
            bookedCount: 3,
          },
        }),
      ).rejects.toThrow();
    });
  });
});
