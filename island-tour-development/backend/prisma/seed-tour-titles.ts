// Standalone runner for JUST the tour-title cleanup, so the redundant hub name
// can be taken out of the titles without re-running the whole demo graph (which
// would leave the rendered titles untouched anyway - see prisma/demo/tour-titles.ts).
//
//   pnpm prisma:seed:demo:tour-titles         apply
//   pnpm prisma:seed:demo:tour-titles:dry     print the diff, write nothing
//
// Idempotent: safe to run repeatedly, and a no-op once the titles are clean.
// Writes tour titles only - never slugs, prose, bookings or availability.

import 'dotenv/config';
import { prisma } from './demo/_shared';
import { stripHubNamesFromTourTitles } from './demo/tour-titles';

async function main() {
  const dryRun =
    process.argv.includes('--dry-run') || process.argv.includes('--dry');
  await stripHubNamesFromTourTitles({ dryRun });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
