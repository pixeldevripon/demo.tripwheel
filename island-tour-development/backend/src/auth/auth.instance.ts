import { parseCorsOrigins } from '@/common/utils/parse-cors-origins';
import { mailService } from '@/mail/mail.singleton';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, openAPI } from 'better-auth/plugins';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Exported so AuthModule can disconnect it on app shutdown
export const authPrismaClient = new PrismaClient({ adapter });

const trustedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

export const auth = betterAuth({
  appName: 'Island Tours',

  database: prismaAdapter(authPrismaClient, {
    provider: 'postgresql',
  }),

  // BETTER_AUTH_URL and BETTER_AUTH_SECRET are read from env automatically.
  trustedOrigins,

  // ── Email & Password ───────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // enforced — verification email sent on every sign-in until verified
    minPasswordLength: 12,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({ user, url }) => {
      void mailService.sendPasswordResetEmail(user.email, url);
    },
  },

  // ── Email Verification ─────────────────────────────────────────────────────
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void mailService.sendVerificationEmail(
        user.email,
        url,
        user.name ?? undefined,
      );
    },
  },

  // ── Social Providers ───────────────────────────────────────────────────────
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
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/forget-password': { window: 60, max: 5 },
      '/reset-password': { window: 60, max: 5 },
    },
  },

  // ── User model mapping ─────────────────────────────────────────────────────
  user: {
    modelName: 'user',
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: Role.TOUR_OPERATOR,
        returned: true,
        // input: true — allows selecting TOUR_OPERATOR during signup.
        // The databaseHook below ensures no one can sign up as ADMIN.
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

  // ── Database hooks — defense-in-depth ADMIN guard ──────────────────────────
  databaseHooks: {
    user: {
      create: {
        before: async (userData, ctx) => {
          // ── Path 1: Email signup ───────────────────────────────
          // role comes via userData directly (input: true)
          let incomingRole = (userData as any).role ?? null;

          // ── Path 2: OAuth signup (first time only) ────────────
          // The hook only fires on CREATE — returning users never
          // reach this point. So reading the cookie here is safe:
          // it will only ever affect brand-new accounts.
          if (!incomingRole && ctx?.request) {
            const cookieHeader = ctx.request.headers.get('cookie') ?? '';
            const match = cookieHeader.match(/(?:^|;\s*)pending_role=([^;]+)/);
            incomingRole = match?.[1] ?? null;
          }

          // ── Security: block ADMIN self-registration ────────────
          if (incomingRole === Role.ADMIN) {
            throw new Error(
              'ADMIN accounts cannot be created through self-registration.',
            );
          }

          // ── Validate or fall back to safe default ─────────────
          const allowedRoles: Role[] = [Role.USER, Role.TOUR_OPERATOR];
          const finalRole: Role = allowedRoles.includes(incomingRole as Role)
            ? (incomingRole as Role)
            : Role.USER; // 👈 default to USER, not TOUR_OPERATOR
          //    (safer: elevated roles should be explicitly requested)

          return {
            data: { ...userData, role: finalRole },
          };
        },
      },
    },
  },

  // openAPI plugin exposes the auth schema — dev only, never in production
  plugins: [
    bearer(), // enables Authorization: Bearer <token> alongside cookie auth
    ...(process.env.NODE_ENV !== 'production' ? [openAPI()] : []),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
