import 'dotenv/config';
import process from 'node:process';
import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: 'prisma/',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
    // Only needed by `prisma migrate diff --from/to-migrations` (the
    // re-baseline procedure in prisma/MIGRATION-BASELINE.md). Optional:
    // unset for all normal commands.
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
