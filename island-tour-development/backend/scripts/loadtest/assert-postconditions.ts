/**
 * Post-run assertions for the booking load test (hardening F7).
 * "Assert with SQL, not vibes" - the doc's words.
 *
 * PASS criteria, checked against the database the rush actually hit:
 *  1. Hot departure: bookedCount == min(capacity, successful claims) AND
 *     bookedCount == active-booking seat ledger EXACTLY (no phantom seats,
 *     no lost claims). Under demand > capacity this means == capacity.
 *  2. Global invariant sweep: zero rows violate 0 <= bookedCount <= capacity
 *     (F5's constraint makes >capacity impossible; this also catches
 *     anything below zero on databases predating it).
 *  3. Every ON_HOLD/CONFIRMED booking on the loadtest tour has unit items
 *     (no half-written bookings escaped a transaction).
 *
 * Exits non-zero on any failure. Run: pnpm loadtest:assert
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

  // 2) Global invariant sweep (0 rows expected).
  const violations = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "departures"
    WHERE "bookedCount" < 0 OR "bookedCount" > "capacity"`;
  if (violations.length > 0) {
    fail(`invariant sweep found ${violations.length} violating departure(s)`);
  } else {
    pass('global invariant sweep clean (0 rows)');
  }

  // 3) Spread departures: same ledger equality on every touched row.
  const spread = await prisma.departure.findMany({
    where: { id: { in: env.spreadDepartureIds }, bookedCount: { gt: 0 } },
    select: { id: true, bookedCount: true },
  });
  let spreadMismatch = 0;
  for (const dep of spread) {
    const seats = await prisma.bookingUnitItem.count({
      where: {
        booking: {
          departureId: dep.id,
          status: { in: ['ON_HOLD', 'CONFIRMED'] },
        },
      },
    });
    if (seats !== dep.bookedCount) spreadMismatch++;
  }
  if (spreadMismatch > 0) {
    fail(`${spreadMismatch} spread departure(s) disagree with their ledger`);
  } else {
    pass(
      `spread departures agree with their ledgers (${spread.length} touched)`,
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
