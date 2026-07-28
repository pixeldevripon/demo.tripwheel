/**
 * backfill-booking-island.ts - repairs `bookings.island` rows that hold
 * something other than the destination SLUG.
 *
 * WHY: `island` is the denormalized destination slug and it builds the
 * thank-you deep link `/{island}/thank-you/{publicRef}`. The TYP compares it
 * against the `[destination]` URL segment and `notFound()`s on a mismatch, so a
 * row holding a display NAME ('Curaçao') instead of a slug ('curacao') makes
 * that booking's thank-you page 404 forever - for the traveller, for the
 * confirmation-email link, and for every later visit. Two sources could write
 * one: the reserve fallback (fixed) and the column's own
 * `@default("Curaçao")`, which still stands in the schema.
 *
 * Run:  pnpm booking:island:backfill            (from backend/)
 *       pnpm booking:island:backfill -- --dry   (report only, writes nothing)
 *
 * Notes:
 *  - The tour's CURRENT destination slug is the source of truth; each booking
 *    is repaired from its own tour, never from a guessed default.
 *  - Idempotent: rows already holding their tour's slug are skipped, so this
 *    is safe to re-run and safe to run before/after a deploy.
 *  - Read-only for anything it cannot resolve (tour or destination missing) -
 *    those are logged and left untouched rather than stamped with a guess.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DRY_RUN = process.argv.includes('--dry');

/** Page size - bookings tables grow unbounded, so never load them all at once. */
const BATCH = 500;

async function main(): Promise<void> {
  console.log(
    `Backfilling bookings.island${DRY_RUN ? ' (DRY RUN - no writes)' : ''}...`,
  );

  let cursor: string | undefined;
  let scanned = 0;
  let repaired = 0;
  let unresolved = 0;

  for (;;) {
    const rows = await prisma.booking.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        displayRef: true,
        island: true,
        tour: { select: { destination: { select: { slug: true } } } },
      },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    for (const row of rows) {
      const slug = row.tour?.destination?.slug;
      if (!slug) {
        // No resolvable destination - leave it alone rather than guess wrong.
        unresolved += 1;
        console.warn(
          `  ? ${row.displayRef}: cannot resolve a destination slug (island='${row.island}') - skipped`,
        );
        continue;
      }
      if (row.island === slug) continue; // already correct

      console.log(`  - ${row.displayRef}: '${row.island}' -> '${slug}'`);
      if (!DRY_RUN) {
        await prisma.booking.update({
          where: { id: row.id },
          data: { island: slug },
        });
      }
      repaired += 1;
    }
  }

  console.log(
    `\nScanned ${scanned} booking(s): ${repaired} ${
      DRY_RUN ? 'would be repaired' : 'repaired'
    }, ${unresolved} unresolved, ${scanned - repaired - unresolved} already correct.`,
  );
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
