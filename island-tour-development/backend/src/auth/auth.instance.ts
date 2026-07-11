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
  // Public self-registration is disabled. Operator accounts are created by an
  // admin (see OperatorsService.create) and the operator sets their own password
  // via the invite link below. There is no sign-up endpoint and no OAuth.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true, // enforced - verification email sent on every sign-in until verified
    minPasswordLength: 12,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({ user, url }, request) => {
      // A reset triggered without an HTTP request is server-initiated - the only
      // such caller is the admin operator-invite flow. Genuine "forgot password"
      // requests always carry the originating HTTP request.
      if (!request) {
        void mailService.sendOperatorInviteEmail(
          user.email,
          url,
          user.name ?? undefined,
        );
      } else {
        void mailService.sendPasswordResetEmail(user.email, url);
      }
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
        // Roles are assigned server-side only (operator creation / admin seed),
        // never accepted from a request body.
        input: false,
      },
      status: {
        type: 'string',
        defaultValue: UserStatus.ACTIVE,
        returned: true,
        input: false,
      },
      hasPassword: {
        type: 'boolean',
        defaultValue: false,
        returned: true,
        input: false,
      },
      passwordChangedAt: {
        type: 'date',
        returned: true,
        input: false,
      },
    },
  },

  // ── Database hooks - defense-in-depth ADMIN guard ──────────────────────────
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          const incomingRole = (userData as any).role ?? null;

          // ── Security: ADMIN accounts are seed-only ─────────────
          // never created at runtime, regardless of caller.
          if (incomingRole === Role.ADMIN) {
            throw new Error('ADMIN accounts cannot be created at runtime.');
          }

          // ── Validate or fall back to safe default ─────────────
          const allowedRoles: Role[] = [Role.USER, Role.TOUR_OPERATOR];
          const finalRole: Role = allowedRoles.includes(incomingRole as Role)
            ? (incomingRole as Role)
            : Role.TOUR_OPERATOR;
          return {
            data: { ...userData, role: finalRole },
          };
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          if (account.password) {
            await authPrismaClient.user.update({
              where: { id: account.userId },
              data: {
                hasPassword: true,
                passwordChangedAt: new Date(),
              },
            });
          }
        },
      },
      update: {
        after: async (account) => {
          if (account.password) {
            await authPrismaClient.user.update({
              where: { id: account.userId },
              data: {
                hasPassword: true,
                passwordChangedAt: new Date(),
              },
            });
          }
        },
      },
    },
  },

  // openAPI plugin exposes the auth schema - dev only, never in production
  plugins: [
    bearer(), // enables Authorization: Bearer <token> alongside cookie auth
    ...(process.env.NODE_ENV !== 'production' ? [openAPI()] : []),
  ],

  advanced: {
    // Cross-subdomain cookies are only correct in production, where the app and
    // API live on sibling subdomains under the SAME project apex
    // (islandtours.esenc.cloud / api.islandtours.esenc.cloud) and a
    // `Domain=.islandtours.esenc.cloud` cookie is shared between them. On
    // localhost the browser rejects such a cookie outright, so the session token
    // is never stored and every dashboard load bounces back to /login - gating on
    // NODE_ENV keeps prod behaviour while fixing local sign-in.
    //
    // Scope is the PROJECT apex, NOT the bare `.esenc.cloud`: a `.esenc.cloud`
    // cookie would be sent to every unrelated sibling under that apex (cookie
    // tossing / fixation blast radius). Override per-environment with
    // COOKIE_DOMAIN; the default stays scoped to this project's subtree.
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN ?? '.islandtours.esenc.cloud',
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
