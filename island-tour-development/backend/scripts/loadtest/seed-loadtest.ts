/**
 * Seed isolated data for the booking load test (hardening F7).
 *
 * Creates its own destination/operator/tour so nothing touches real rows:
 * - one HOT departure (capacity 20) - the 100-users-one-boat rush target
 * - 100 SPREAD departures (capacity 20 each) - independent-row parallelism
 *
 * The tour is UNIT-priced SHARED (flat basePrice, `guests` count) - the
 * smallest bookable surface, same as the idempotency e2e. Party size 1 per
 * request, per the F7 scenario table.
 *
 * Writes scripts/loadtest/.loadtest-env.json for rush.js / the assert and
 * cleanup scripts, and prints the k6 env exports.
 *
 * Run: pnpm loadtest:seed  (from backend/)
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const OUT = join(__dirname, '.loadtest-env.json');
const HOT_CAPACITY = 20;
const SPREAD_DEPARTURES = 100;

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const suffix = `${Date.now()}`;

  const destination = await prisma.destination.create({
    data: {
      name: `Loadtest Dest ${suffix}`,
      slug: `loadtest-dest-${suffix}`,
      region: 'CARIBBEAN',
      timezone: 'America/Curacao',
      isActive: true,
      isSeeded: false,
    },
  });
  const user = await prisma.user.create({
    data: {
      name: 'Loadtest Operator',
      email: `loadtest+${suffix}@example-loadtest.com`,
    },
  });
  const operator = await prisma.operator.create({
    data: { userId: user.id },
  });
  const tour = await prisma.tour.create({
    data: {
      name: `Loadtest Tour ${suffix}`,
      slug: `loadtest-tour-${suffix}`,
      destinationId: destination.id,
      operatorId: operator.id,
      status: 'LIVE',
      timeZone: 'America/Curacao',
      defaultCurrency: 'EUR',
      paymentModel: 'OPERATOR_LINK',
      pricingModel: 'UNIT',
      wholeUnitType: 'BOAT',
      bookingType: 'SHARED',
      basePrice: 100,
    },
  });

  const hot = await prisma.departure.create({
    data: {
      tourId: tour.id,
      date: new Date('2031-08-01'),
      startTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
      capacity: HOT_CAPACITY,
    },
  });

  const spreadIds: string[] = [];
  for (let i = 0; i < SPREAD_DEPARTURES; i++) {
    const dep = await prisma.departure.create({
      data: {
        tourId: tour.id,
        // Unique (date, startTime) per row: day 2-28, minute = i.
        date: new Date(
          `2031-08-${String((i % 27) + 2).padStart(2, '0')}T00:00:00.000Z`,
        ),
        startTime: new Date(
          Date.UTC(1970, 0, 1, 10 + Math.floor(i / 60), i % 60),
        ),
        capacity: HOT_CAPACITY,
      },
    });
    spreadIds.push(dep.id);
  }

  const env = {
    createdAt: new Date().toISOString(),
    destinationId: destination.id,
    userId: user.id,
    operatorId: operator.id,
    tourId: tour.id,
    hotDepartureId: hot.id,
    hotCapacity: HOT_CAPACITY,
    spreadDepartureIds: spreadIds,
  };
  writeFileSync(OUT, JSON.stringify(env, null, 2));

  console.log(`Seeded. Wrote ${OUT}\n`);
  console.log('k6 env for the rush scenarios:');
  console.log(`  export API=http://localhost:5050`);
  console.log(`  export TOUR_ID=${tour.id}`);
  console.log(`  export DEPARTURE_ID=${hot.id}`);
  console.log(`  export DEPARTURE_IDS=${spreadIds.join(',')}`);
  console.log(
    `  export INTERNAL_KEY=<backend INTERNAL_API_SECRET>  # bypasses the per-IP throttle`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
