import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

/**
 * The pre-DI Prisma client shared by everything that must run before the Nest
 * app exists (Better Auth in auth.instance.ts, the MailService singleton's
 * site-logo read). Lives in its own module so mail.service can import it
 * without a circular import through auth.instance -> mail.singleton.
 *
 * AuthModule disconnects it on app shutdown (via the auth.instance re-export).
 *
 * SECOND pool in the process (hardening F6): it carries the same fail-fast
 * timeouts as PrismaService - before this it ran the node-postgres defaults
 * (max 10, no timeouts), so during a rush with logged-in traffic the AUTH
 * path could exhibit exactly the infinite-queue behaviour F6 kills on the
 * booking path. Sized at a fixed 10: session validation is many tiny reads,
 * never lock-contended. The Postgres sizing rule must count BOTH pools:
 * max_connections >= (DB_POOL_MAX + 10) x app processes + headroom.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,
  idle_in_transaction_session_timeout: 15_000,
  lock_timeout: 3_000,
});

export const authPrismaClient = new PrismaClient({ adapter });
