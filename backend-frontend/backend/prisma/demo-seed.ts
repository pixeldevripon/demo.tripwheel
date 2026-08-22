// DEMO SEED ENTRYPOINT — `pnpm prisma:seed:demo` (add `-- --clean` to remove).
//
// Throwaway demo data for local/staging. NOT wired into the production build:
// `build:prod` only runs `pnpm prisma:seed` (prisma/seed.ts). Delete this file +
// the `prisma/demo/` folder + the `prisma:seed:demo` script to remove entirely.

import 'dotenv/config';
import { cleanDemo, runDemoSeed } from './demo/index';
import {
  linkBoatSubCategoriesToExistingTours,
  seedSubCategories,
} from './demo/sub-categories';
import { prisma } from './demo/_shared';

async function main() {
  const clean = process.argv.includes('--clean');
  // Targeted mode: (re)seed only the filter-only sub-categories + tag existing
  // demo tours. The full seed is now re-runnable, so this is a speed shortcut
  // rather than a safety one.
  const subCategoriesOnly = process.argv.includes('--subcategories');
  if (clean) {
    await cleanDemo();
  } else if (subCategoriesOnly) {
    await seedSubCategories();
    await linkBoatSubCategoriesToExistingTours();
  } else {
    await runDemoSeed();
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
