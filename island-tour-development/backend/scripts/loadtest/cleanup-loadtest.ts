/**
 * Remove everything seed-loadtest.ts created (FK-safe order), keyed off the
 * ids recorded in .loadtest-env.json - never by name patterns, so it cannot
 * touch real data. Run: pnpm loadtest:cleanup
 */
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const file = join(__dirname, '.loadtest-env.json');
  const env = JSON.parse(readFileSync(file, 'utf8')) as {
    destinationId: string;
    userId: string;
    operatorId: string;
    tourId: string;
  };
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const bookings = await prisma.booking.findMany({
    where: { tourId: env.tourId },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);
  await prisma.bookingAddOn.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
  await prisma.bookingUnitItem.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
  await prisma.settlement.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
  await prisma.payment.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.departure.deleteMany({ where: { tourId: env.tourId } });
  await prisma.tour.delete({ where: { id: env.tourId } });
  await prisma.operator.delete({ where: { id: env.operatorId } });
  await prisma.user.delete({ where: { id: env.userId } });
  await prisma.destination.delete({ where: { id: env.destinationId } });

  unlinkSync(file);
  console.log(
    `Cleaned up loadtest tour ${env.tourId} (${bookingIds.length} bookings).`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
