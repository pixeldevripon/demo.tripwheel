/**
 * Post-run assertions for the booking load test (hardening F7).
 * "Assert with SQL, not vibes" - the doc's words.
 *
 * PASS criteria, checked against the database the rush actually hit:
 *  1. Hot departure: bookedCount == active-booking seat ledger EXACTLY (no
 *     phantom seats, no lost claims) - and with EXPECT_FULL=1 (any hot
 *     scenario, where demand > capacity) bookedCount must equal capacity,
 *     so a run that never claimed a seat can NOT pass vacuously.
 *  2. Global invariant sweep: zero rows violate 0 <= bookedCount <= capacity.
 *  3. Every spread departure agrees with its ledger - including the rows
 *     claiming bookedCount 0, which is where a lost increment would hide.
 *  4. Every ON_HOLD/CONFIRMED booking on the loadtest tour has unit items
 *     (no half-written bookings escaped a transaction).
 *
 * The ledger definition (bookedCount == count of active unit items) is valid
 * for NON-EXCLUSIVE bookings only: an exclusive charter sets bookedCount =
 * capacity with fewer unit items by design. The seeded tour is SHARED and
 * `exclusiveDeparture` is server-derived, so the equality holds here - do
 * not copy this checker onto a PRIVATE/UNIT tour without changing it.
 *
 * Exits non-zero on any failure. Run: pnpm loadtest:assert
 *                        Hot runs: EXPECT_FULL=1 pnpm loadtest:assert
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const env = JSON.parse(
    readFileSync(join(__dirname, '.loadtest-env.json'), 'utf8'),
  ) as {
    tourId: string;
    hotDepartureId: string;
    hotCapacity: number;
    spreadDepartureIds: string[];
  };
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  let failed = false;
  const fail = (msg: string) => {
    failed = true;
    console.error(`FAIL  ${msg}`);
  };
  const pass = (msg: string) => console.log(`PASS  ${msg}`);

  // 1) Hot departure: stored fill == active ledger, and never past capacity.
  const hot = await prisma.departure.findUniqueOrThrow({
    where: { id: env.hotDepartureId },
    select: { capacity: true, bookedCount: true, status: true },
  });
  const activeSeats = await prisma.bookingUnitItem.count({
    where: {
      booking: {
        departureId: env.hotDepartureId,
        status: { in: ['ON_HOLD', 'CONFIRMED'] },
      },
    },
  });
  if (hot.bookedCount !== activeSeats) {
    fail(
      `hot departure bookedCount=${hot.bookedCount} != active seat ledger=${activeSeats}`,
    );
  } else {
    pass(`hot departure fill matches ledger exactly (${hot.bookedCount})`);
  }
  if (hot.bookedCount > hot.capacity) {
    fail(`hot departure OVERSOLD: ${hot.bookedCount}/${hot.capacity}`);
  } else {
    pass(`hot departure within capacity (${hot.bookedCount}/${hot.capacity})`);
  }
  if (hot.bookedCount === hot.capacity && hot.status !== 'SOLD_OUT') {
    fail(`hot departure full but status=${hot.status}, expected SOLD_OUT`);
  }
  if (hot.bookedCount < hot.capacity && hot.status === 'SOLD_OUT') {
    fail(
      `hot departure ${hot.bookedCount}/${hot.capacity} but status=SOLD_OUT (stale flip)`,
    );
  }
  // The anti-vacuous gate: a hot rush has demand > capacity by construction,
  // so anything short of a full departure means the run never really ran.
  if (process.env.EXPECT_FULL === '1' && hot.bookedCount !== hot.capacity) {
    fail(
      `EXPECT_FULL: hot departure not full (${hot.bookedCount}/${hot.capacity}) - did the rush reach the booking path at all?`,
    );
  }

  // 2) Global invariant sweep (0 rows expected).
  const violations = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "departures"
    WHERE "bookedCount" < 0 OR "bookedCount" > "capacity"`;
  if (violations.length > 0) {
    fail(`invariant sweep found ${violations.length} violating departure(s)`);
  } else {
    pass('global invariant sweep clean (0 rows)');
  }

  // 3) Spread departures: ledger equality on EVERY row - including the ones
  // claiming bookedCount 0. Filtering to bookedCount > 0 would hide exactly
  // the lost-increment drift this check exists to catch (a booking whose
  // rows committed but whose count write vanished sits at 0).
  const spread = await prisma.departure.findMany({
    where: { id: { in: env.spreadDepartureIds } },
    select: { id: true, bookedCount: true },
  });
  const activeBookings = await prisma.booking.findMany({
    where: {
      departureId: { in: env.spreadDepartureIds },
      status: { in: ['ON_HOLD', 'CONFIRMED'] },
    },
    select: { departureId: true, _count: { select: { unitItems: true } } },
  });
  const ledger = new Map<string, number>();
  for (const b of activeBookings) {
    if (!b.departureId) continue;
    ledger.set(
      b.departureId,
      (ledger.get(b.departureId) ?? 0) + b._count.unitItems,
    );
  }
  const spreadMismatch = spread.filter(
    (dep) => (ledger.get(dep.id) ?? 0) !== dep.bookedCount,
  );
  if (spreadMismatch.length > 0) {
    fail(
      `${spreadMismatch.length} spread departure(s) disagree with their ledger`,
    );
  } else {
    pass(
      `all ${spread.length} spread departures agree with their ledgers (` +
        `${[...ledger.values()].reduce((a, b) => a + b, 0)} seats accounted)`,
    );
  }

  // 4) No half-written bookings.
  const hollow = await prisma.booking.count({
    where: {
      tourId: env.tourId,
      status: { in: ['ON_HOLD', 'CONFIRMED'] },
      unitItems: { none: {} },
    },
  });
  if (hollow > 0) {
    fail(`${hollow} active booking(s) have no unit items`);
  } else {
    pass('no half-written bookings');
  }

  await prisma.$disconnect();
  if (failed) process.exit(1);
  console.log('\nAll postconditions hold.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
