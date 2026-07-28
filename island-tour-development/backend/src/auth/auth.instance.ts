import { parseCorsOrigins } from '@/common/utils/parse-cors-origins';
import { mailService } from '@/mail/mail.singleton';
import { authPrismaClient } from '@/auth/auth-prisma.client';
import {
  SURFACE_HEADER,
  SURFACE_USER_SELECT,
  isLoginSurface,
  surfacesForUser,
} from '@/auth/login-surfaces';
import { Role, UserStatus } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, openAPI } from 'better-auth/plugins';
import 'dotenv/config';

// Re-exported so AuthModule can disconnect it on app shutdown (the client now
// lives in auth-prisma.client.ts so mail.service can share it cycle-free).
export { authPrismaClient };

const trustedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

/**
 * Fire-and-forget email send for auth hooks. The hooks deliberately do not
 * await (a slow provider must not block sign-in), but a bare `void` on a
 * rejecting promise is an unhandled rejection - which crashes the whole
 * process on modern Node. Log and move on instead.
 */
const sendInBackground = (kind: string, p: Promise<void>): void => {
  p.catch((err) => console.error(`[auth] ${kind} email failed to send:`, err));
};

/**
 * Decode a JWT payload WITHOUT verifying the signature. Display-only: the
 * verification hook below uses it to pick email copy by `requestType`; the
 * token itself is only ever trusted after better-auth's own jwtVerify when
 * the link is opened.
 */
const decodeJwtPayloadUnsafe = (
  token: string,
): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
};

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
      // A reset triggered without an HTTP request is server-initiated - the
      // invite flows (operator create, staff invite, team-seat invite,
      // resend-invite). Genuine "forgot password" requests always carry the
      // originating HTTP request.
      if (!request) {
        // Every invite flow creates the staff_members row BEFORE firing this
        // reset, so the row tells us WHO is being invited - the email copy
        // must name the right role, never claim "tour operator" for staff.
        sendInBackground(
          'invite',
          (async () => {
            // Only staff/operator invites reach this arm. Customers used to
            // be greeted with a set-password welcome here; travellers are
            // passwordless since 2026-07-28, so booking provisioning no
            // longer requests a reset and a Role.USER can never arrive.
            const member = await authPrismaClient.staffMember.findUnique({
              where: { userId: user.id },
              select: {
                operatorId: true,
                seatRole: true,
                designation: { select: { name: true } },
                operator: {
                  select: {
                    companyInfo: { select: { companyName: true } },
                    contactEmail: true,
                  },
                },
              },
            });

            // OWNER seat (or no staff row at all, legacy) = the business
            // operator invite - unchanged copy.
            if (!member || (member.operatorId && member.seatRole === 'OWNER')) {
              await mailService.sendOperatorInviteEmail(
                user.email,
                url,
                user.name ?? undefined,
              );
              return;
            }

            const roleLabel =
              member.designation?.name ??
              (member.operatorId
                ? member.seatRole === 'MANAGER'
                  ? 'Manager'
                  : 'Staff'
                : null);

            await mailService.sendStaffInviteEmail(user.email, url, {
              name: user.name ?? undefined,
              variant: member.operatorId ? 'team' : 'platform',
              roleLabel,
              companyName: member.operator?.companyInfo?.companyName ?? null,
            });
          })(),
        );
      } else {
        sendInBackground(
          'password-reset',
          mailService.sendPasswordResetEmail(user.email, url),
        );
      }
    },
  },

  // ── Email Verification ─────────────────────────────────────────────────────
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      // The change-email flow reuses this hook for its second step: after the
      // OLD inbox approves, better-auth calls this with the NEW address and a
      // token whose payload carries requestType 'change-email-verification'.
      // Detect it (display-only decode) so that email explains the change
      // instead of reading like a random verification ask.
      const isEmailChange =
        decodeJwtPayloadUnsafe(token)?.requestType ===
        'change-email-verification';
      sendInBackground(
        'verification',
        mailService.sendVerificationEmail(
          user.email,
          url,
          user.name ?? undefined,
          isEmailChange ? 'email-change' : 'account',
        ),
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
    additionalFields: {
      // Which login door minted the session - stamped by the sign-in hook
      // below, never accepted from the request body. Returned so the
      // dashboard can shape its UI by entry door (customer vs staff view).
      surface: {
        type: 'string',
        required: false,
        returned: true,
        input: false,
      },
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

    // Self-service email change (dashboard profile). Two-step, two-mailbox:
    // a confirmation link goes to the CURRENT address; approving it triggers
    // the standard verification email to the NEW address (wired above via
    // emailVerification.sendVerificationEmail); only then does the email
    // update. A taken newEmail gets a silent fake success from Better Auth,
    // so this leaks nothing. Admins have no raw email-write path - this flow
    // is the only way an email changes.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        sendInBackground(
          'change-email-confirmation',
          mailService.sendChangeEmailConfirmationEmail(
            user.email,
            url,
            newEmail,
            user.name ?? undefined,
          ),
        );
      },
    },

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
          // STAFF is allowed ONLY because staff accounts are provisioned
          // server-side via the admin-gated staff invite flow (StaffService);
          // there is no public sign-up path that could reach this with STAFF.
          const allowedRoles: Role[] = [
            Role.USER,
            Role.TOUR_OPERATOR,
            Role.STAFF,
          ];
          const finalRole: Role = allowedRoles.includes(incomingRole as Role)
            ? (incomingRole as Role)
            : Role.TOUR_OPERATOR;
          return {
            data: { ...userData, role: finalRole },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          // A suspended/deleted account must not be able to sign in again -
          // AuthGuard blocks API access, but refusing the session here stops
          // the account at the door (staff suspension, banned users).
          const user = await authPrismaClient.user.findUnique({
            where: { id: session.userId },
            select: SURFACE_USER_SELECT,
          });
          // Runs only AFTER the password already verified, so naming the
          // suspension leaks nothing to an attacker without the credential.
          if (user?.status === 'SUSPENDED' || user?.status === 'DELETED') {
            throw new APIError('FORBIDDEN', {
              message: 'This account has been suspended.',
            });
          }

          // ── Login-surface enforcement ─────────────────────────
          // Only for password sign-in: sessions are ALSO created by the
          // verify-email / change-email flows, which carry no surface header
          // and must not be blocked. `ctx` comes from AsyncLocalStorage
          // (better-auth internals) and is typed nullable for EVERY create
          // path; no current path actually yields null (verified against
          // 1.6.9 - no autoSignIn flows, no server-side signInEmail calls),
          // so the `!ctx` arm is deliberate belt-and-suspenders: if it ever
          // fires, refuse rather than run silently unenforced.
          if (!ctx || ctx.path === '/sign-in/email') {
            const surface = ctx?.getHeader(SURFACE_HEADER);
            // Missing/unknown header = reject. Defaulting would let a caller
            // bypass the per-door validation by simply omitting the header.
            if (!isLoginSurface(surface)) {
              throw new APIError('FORBIDDEN', {
                message: 'Sign-in surface not recognized.',
              });
            }
            const allowed = user ? surfacesForUser(user) : [];
            if (!allowed.includes(surface)) {
              // Distinguishable machine code so login pages can render a
              // "use the other door" hint. Safe: reaching this point already
              // required the correct password.
              throw new APIError('FORBIDDEN', {
                message:
                  'This account cannot sign in here. Please use the login page for your account type.',
                code: 'WRONG_LOGIN_SURFACE',
              });
            }
            // Stamp the door onto the session so the dashboard can shape its
            // UI by how the user entered (null = route by role).
            return { data: { ...session, surface } };
          }
        },
        after: async (session) => {
          // Staff bookkeeping on login: stamp lastLoginAt and flip an INVITED
          // member to ACTIVE on their first successful sign-in. Non-staff
          // users match zero rows (updateMany = no-op). Never let bookkeeping
          // break a login.
          try {
            const now = new Date();
            await authPrismaClient.staffMember.updateMany({
              where: { userId: session.userId },
              data: { lastLoginAt: now },
            });
            await authPrismaClient.staffMember.updateMany({
              where: { userId: session.userId, status: 'INVITED' },
              data: { status: 'ACTIVE', activatedAt: now },
            });
          } catch (err) {
            console.error('[auth] staff login bookkeeping failed:', err);
          }
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
      enabled: process.env.NODE_ENV === 'production', // will use when we enable cross subdomain cookie
      domain: process.env.COOKIE_DOMAIN ?? '.islandtours.esenc.cloud',
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
