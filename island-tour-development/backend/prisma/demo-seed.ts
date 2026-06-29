// DEMO SEED ENTRYPOINT — `pnpm prisma:seed:demo` (add `-- --clean` to remove).
//
// Throwaway demo data for local/staging. NOT wired into the production build:
// `build:prod` only runs `pnpm prisma:seed` (prisma/seed.ts). Delete this file +
// the `prisma/demo/` folder + the `prisma:seed:demo` script to remove entirely.

import 'dotenv/config';
import { cleanDemo, runDemoSeed } from './demo/index';
import { prisma } from './demo/_shared';

async function main() {
  const clean = process.argv.includes('--clean');
  if (clean) {
    await cleanDemo();
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
