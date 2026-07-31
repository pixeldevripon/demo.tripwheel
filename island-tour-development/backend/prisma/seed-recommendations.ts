// Standalone runner for JUST the recommendations demo seed, so you can refresh the
// varied recommendation categories + items without re-running the whole demo graph.
//
//   pnpm prisma:seed:recommendations
//
// Idempotent (deterministic ids + upsert): safe to run repeatedly. Internal picks
// need the base seed (destinations/hubs) and the demo tours/collections to exist -
// any whose target is missing are skipped with a log. Remove these rows with
// `pnpm prisma:seed:recommendations:clean`.

import { prisma } from './demo/_shared';
import {
  cleanRecommendations,
  seedRecommendations,
} from './demo/recommendations';

async function main() {
  const clean = process.argv.includes('--clean');
  if (clean) {
    await cleanRecommendations();
  } else {
    await seedRecommendations();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
