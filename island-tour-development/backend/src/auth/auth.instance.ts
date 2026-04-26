import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient, Role, UserStatus } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import { openAPI } from 'better-auth/plugins';

/**
 * Standalone PrismaClient for Better Auth.
 * Better Auth manages its own DB connection — separate from NestJS PrismaService.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/**
 * Trusted origins built from CORS_ORIGINS env var (comma-separated).
 * Better Auth uses this list for CSRF protection.
 */
const trustedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'Island Tours',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // BETTER_AUTH_URL and BETTER_AUTH_SECRET are read from env automatically.
  // Only set baseURL/secret here if the env vars are NOT available.
  trustedOrigins,

  // ── Email & Password ───────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    // Email must be verified before operators can publish trips.
    // USER accounts are created programmatically (not via sign-up) so they
    // receive credentials by email and verify on first login.
    requireEmailVerification: false, // set true when mail service is wired (Phase 16)

    // Minimum password length
    minPasswordLength: 8,
  },

  // ── Social Providers ───────────────────────────────────────────────────────
  // Only included when credentials are present — prevents startup errors in dev
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }),
  },

  // ── Session ────────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh token if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5-minute client-side cache to reduce DB round-trips
    },
  },

  // ── Rate Limit ─────────────────────────────────────────────────────────────
  rateLimit: {
    window: 60, // 1 minute
    max: 100, // Default 100 req/min for general endpoints (e.g. session checks)
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: 5, // Tight limit for sign-ins to prevent brute force
      },
      '/sign-up/email': {
        window: 60,
        max: 5, // Tight limit for sign-ups
      },
      '/forget-password': {
        window: 60,
        max: 5,
      },
      '/reset-password': {
        window: 60,
        max: 5,
      },
    },
  },

  // ── User model mapping ─────────────────────────────────────────────────────
  user: {
    // Better Auth model name must match the Prisma model name (not the @@map table name).
    modelName: 'user',
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: Role.TOUR_OPERATOR,
        // Exposed in session so guards can read it without an extra DB query
        returned: true,
        // Allow passing role programmatically (e.g., USER)
        input: true,
      },
      status: {
        type: 'string',
        defaultValue: UserStatus.ACTIVE,
        returned: true,
        input: false,
      },
    },
  },

  // ── Database hooks — ADMIN sign-up guard ───────────────────────────────────
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // ADMIN accounts must NEVER be created via the public sign-up endpoint.
          // They are seeded programmatically via auth.api.createUser() in seed.ts.
          if ((userData as { role?: string }).role === Role.ADMIN && process.env.IS_SEEDING !== 'true') {
            throw new Error(
              'ADMIN accounts cannot be created through self-registration.',
            );
          }
          return { data: userData };
        },
      },
    },
  },

  plugins: [
    openAPI(),
  ],
});

// Export inferred session type for use in guards and decorators
export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
