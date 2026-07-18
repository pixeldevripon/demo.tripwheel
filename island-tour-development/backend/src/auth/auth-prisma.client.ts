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
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const authPrismaClient = new PrismaClient({ adapter });
