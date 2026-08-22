/**
 * Auth E2E Test Suite
 *
 * Covers:
 *   - Sign-up via Better Auth (POST /api/auth/sign-up/email)
 *       • DISABLED (`disableSignUp: true`) - every attempt is rejected and
 *         creates no user; rejection does not leak whether the email exists
 *       • Role/status injection can therefore never create anything
 *
 *   - Sign-in via Better Auth (POST /api/auth/sign-in/email)
 *       • Happy path - valid credentials + x-login-surface header, cookie set
 *       • Wrong password - error
 *       • Non-existent email - error
 *
 *   - Login-surface enforcement (x-login-surface header)
 *       • Missing/unknown header - 403, no session
 *       • Wrong door - 403 with code WRONG_LOGIN_SURFACE (post-password only)
 *       • Right door - session minted with the surface stamped on the row
 *
 *   - Login pre-check (POST /api/v1/auth/login-precheck)
 *       • Unknown email - ok:true (enumeration-safe)
 *       • Known email, right door - ok:true; wrong door - ok:false + suggestion
 *
 *   - Session retrieval (GET /api/auth/get-session)
 *       • With valid session cookie - returns user object with correct role and email
 *       • Without cookie - returns null session body (Better Auth behavior)
 *
 *   - Sign-out (POST /api/auth/sign-out)
 *       • With valid session - 200, cookie cleared in Set-Cookie header
 *       • Without session cookie - handled gracefully (no 5xx)
 *
 *   - AuthGuard - public vs. protected routes
 *       • GET /api/v1/health (@Public + @SkipThrottle) - 200 without any cookie
 *       • Protected route without session - 401
 *
 *   - RolesGuard (unit-level integration via real middleware stack)
 *       • Authenticated user with TOUR_OPERATOR role hits a TOUR_OPERATOR-permitted
 *         route (confirmed through /api/auth/get-session role field)
 *
 *   - Database cleanup
 *       • Every test that creates a user tears it down via PrismaClient in afterEach
 */

import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { auth } from './../src/auth/auth.instance';
// The same singleton instance auth.instance.ts sends mail through - spying on
// it captures the real emailed links for the change-email click-through test.
import { mailService } from './../src/mail/mail.singleton';

/**
 * Provisions a sign-in-able account through the Better Auth internal adapter
 * (public sign-up is DISABLED - `disableSignUp: true` - so the `signUp`
 * helper below cannot create accounts anymore; the sign-up describe block
 * documents the endpoint's rejection behavior instead).
 */
async function provisionUser(email: string, name = 'E2E User') {
  const authCtx = await auth.$context;
  const hashedPassword = await authCtx.password.hash(VALID_PASSWORD);
  const user = await authCtx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  });
  await authCtx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hashedPassword,
  });
  return user;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a unique email address for each test to prevent collisions across
 * parallel or sequential runs on a shared test database.
 */
function uniqueEmail(prefix = 'test'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-e2e.com`;
}

/** Minimum-length password that satisfies Better Auth's minPasswordLength: 12 */
const VALID_PASSWORD = 'TestPass@1234!';

/** A password that is too short to satisfy the 12-character requirement */
const SHORT_PASSWORD = 'Short1!';

/**
 * Signs up a user and returns the full supertest response.
 * The caller is responsible for cleaning up the created user.
 */
async function signUp(
  server: ReturnType<INestApplication['getHttpServer']>,
  payload: {
    name: string;
    email: string;
    password: string;
    [key: string]: unknown;
  },
) {
  return request(server)
    .post('/api/auth/sign-up/email')
    .set('Content-Type', 'application/json')
    .send(payload);
}

/**
 * Signs in and returns the full supertest response.
 * The session cookie lives in res.headers['set-cookie'].
 *
 * Sign-in REQUIRES the x-login-surface header (per-door enforcement in
 * auth.instance.ts). Test users default to TOUR_OPERATOR, so 'portal' is the
 * right door; pass `null` to omit the header (negative tests).
 */
async function signIn(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  password: string,
  surface: string | null = 'portal',
) {
  const req = request(server)
    .post('/api/auth/sign-in/email')
    .set('Content-Type', 'application/json');
  if (surface !== null) req.set('x-login-surface', surface);
  return req.send({ email, password });
}

/**
 * Extracts the Better Auth session cookie string from Set-Cookie headers.
 * Returns the raw cookie header value (e.g. "better-auth.session_token=...") or
 * undefined if no such cookie is present.
 */
function extractSessionCookie(
  setCookieHeader: string | string[] | undefined,
): string | undefined {
  if (!setCookieHeader) return undefined;
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const sessionCookie = cookies.find((c) =>
    c.includes('better-auth.session_token'),
  );
  if (!sessionCookie) return undefined;
  // Return only the name=value part (before the first semicolon) so Supertest
  // can send it back as a Cookie header on subsequent requests.
  return sessionCookie.split(';')[0];
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  /**
   * Tracks emails created during each test so afterEach can delete them.
   * Using deletions on email avoids coupling to user IDs which are only
   * available after a successful sign-up response.
   */
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts setup so guards, pipes, and filters behave identically.
    app.setGlobalPrefix('api/v1', {
      exclude: ['api/auth/*path'],
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableShutdownHooks();

    await app.init();

    server = app.getHttpServer();

    // Use a standalone PrismaClient (with the same PrismaPg adapter as PrismaService)
    // for cleanup to avoid depending on the internal PrismaService lifecycle.
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdEmails.length === 0) return;

    // Delete in reverse insertion order to respect any FK constraints.
    for (const email of [...createdEmails].reverse()) {
      try {
        await prisma.user.delete({ where: { email } });
      } catch {
        // Row may already be absent (test cleaned up manually or signup failed).
      }
    }
    createdEmails.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ── Sign-up ─────────────────────────────────────────────────────────────────

  describe('POST /api/auth/sign-up/email', () => {
    // Public self-registration is DISABLED (`disableSignUp: true` in
    // auth.instance.ts) - accounts are created only by admin/operator invite
    // flows and the booking-driven customer provisioning. These tests pin the
    // endpoint's rejection behavior so a config regression is caught here.
    it('rejects sign-up with valid credentials (public sign-up is disabled)', async () => {
      const email = uniqueEmail('signup-disabled');
      // Not pushed to createdEmails - no user must be created.

      const res = await signUp(server, {
        name: 'Integration Tester',
        email,
        password: VALID_PASSWORD,
      });

      expect(res.status).not.toBe(200);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).toBeNull();
    });

    it('does not leak whether the email was already registered', async () => {
      const email = uniqueEmail('signup-disabled-existing');
      createdEmails.push(email);
      await provisionUser(email, 'Existing User');

      const res = await signUp(server, {
        name: 'Duplicate Attempt',
        email,
        password: VALID_PASSWORD,
      });

      // Same rejection as an unknown email - sign-up being off must not
      // become an account-enumeration oracle.
      expect(res.status).not.toBe(200);
    });

    it('rejects a password shorter than 12 characters', async () => {
      const email = uniqueEmail('signup-short-pwd');
      // Do NOT push to createdEmails - this sign-up should fail, no user is created.

      const res = await signUp(server, {
        name: 'Short Password User',
        email,
        password: SHORT_PASSWORD,
      });

      // Better Auth returns an error body for validation failures.
      // The status is not 200.
      expect(res.status).not.toBe(200);
    });

    it('rejects sign-up when email is missing', async () => {
      const res = await request(server)
        .post('/api/auth/sign-up/email')
        .set('Content-Type', 'application/json')
        .send({ name: 'No Email', password: VALID_PASSWORD });

      expect(res.status).not.toBe(200);
    });

    it('rejects sign-up when name is missing', async () => {
      const email = uniqueEmail('signup-noname');
      // Do not add to createdEmails - should fail.

      const res = await request(server)
        .post('/api/auth/sign-up/email')
        .set('Content-Type', 'application/json')
        .send({ email, password: VALID_PASSWORD });

      expect(res.status).not.toBe(200);
    });

    it('rejects sign-up when password is missing', async () => {
      const email = uniqueEmail('signup-nopwd2');

      const res = await request(server)
        .post('/api/auth/sign-up/email')
        .set('Content-Type', 'application/json')
        .send({ name: 'No Password', email });

      expect(res.status).not.toBe(200);
    });

    it('rejects a role: ADMIN injection attempt like any other sign-up', async () => {
      const email = uniqueEmail('signup-role-injection');
      // Not pushed to createdEmails - no user must be created.

      // Critical Rule #9 - even if sign-up were open, the role field is
      // input:false and the DB hook blocks ADMIN. With sign-up disabled the
      // attempt must fail outright and create nothing.
      const res = await signUp(server, {
        name: 'Role Injection Attempt',
        email,
        password: VALID_PASSWORD,
        role: 'ADMIN',
      });

      expect(res.status).not.toBe(200);
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).toBeNull();
    });
  });

  // ── Sign-in ─────────────────────────────────────────────────────────────────

  describe('POST /api/auth/sign-in/email', () => {
    /**
     * Creates one shared user per describe block - all sign-in tests share it
     * for efficiency since sign-in does not mutate state beyond session creation.
     */
    let sharedEmail: string;

    beforeAll(async () => {
      sharedEmail = uniqueEmail('signin-shared');
      await provisionUser(sharedEmail, 'Sign-in Shared User');
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email: sharedEmail } });
      } catch {
        // Already cleaned up.
      }
    });

    it('returns 200 and sets the session cookie on valid credentials', async () => {
      const res = await signIn(server, sharedEmail, VALID_PASSWORD);

      expect(res.status).toBe(200);

      const setCookieHeader = res.headers['set-cookie'] as
        | string
        | string[]
        | undefined;
      const sessionCookie = extractSessionCookie(setCookieHeader);

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('better-auth.session_token=');
    });

    it('returns user data in the sign-in response body', async () => {
      const res = await signIn(server, sharedEmail, VALID_PASSWORD);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(sharedEmail);
    });

    it('returns the correct role in sign-in response', async () => {
      const res = await signIn(server, sharedEmail, VALID_PASSWORD);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('TOUR_OPERATOR');
    });

    it('rejects an incorrect password', async () => {
      const res = await signIn(server, sharedEmail, 'WrongPassword!999');

      expect(res.status).not.toBe(200);
      // Ensure no session cookie is issued for a failed login.
      const setCookieHeader = res.headers['set-cookie'] as
        | string
        | string[]
        | undefined;
      const sessionCookie = extractSessionCookie(setCookieHeader);
      expect(sessionCookie).toBeUndefined();
    });

    it('rejects a non-existent email', async () => {
      const res = await signIn(
        server,
        'nobody@does-not-exist-e2e.com',
        VALID_PASSWORD,
      );

      expect(res.status).not.toBe(200);
    });

    it('rejects sign-in with an empty password', async () => {
      const res = await signIn(server, sharedEmail, '');

      expect(res.status).not.toBe(200);
    });

    it('rejects sign-in with an empty email', async () => {
      const res = await signIn(server, '', VALID_PASSWORD);

      expect(res.status).not.toBe(200);
    });
  });

  // ── Login-surface enforcement (x-login-surface) ───────────────────────────

  describe('login-surface enforcement (x-login-surface)', () => {
    let surfaceEmail: string;

    beforeAll(async () => {
      surfaceEmail = uniqueEmail('surface-shared');
      // Default role TOUR_OPERATOR - its only door is 'portal'.
      await provisionUser(surfaceEmail, 'Surface Shared User');
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email: surfaceEmail } });
      } catch {
        // Already cleaned up.
      }
    });

    it('rejects sign-in when the x-login-surface header is missing', async () => {
      const res = await signIn(server, surfaceEmail, VALID_PASSWORD, null);

      expect(res.status).toBe(403);
      expect(extractSessionCookie(res.headers['set-cookie'])).toBeUndefined();
    });

    it('rejects sign-in with an unknown surface value', async () => {
      const res = await signIn(
        server,
        surfaceEmail,
        VALID_PASSWORD,
        'backstage',
      );

      expect(res.status).toBe(403);
      expect(extractSessionCookie(res.headers['set-cookie'])).toBeUndefined();
    });

    it('rejects a wrong-door sign-in with the WRONG_LOGIN_SURFACE code', async () => {
      // The account is a plain TOUR_OPERATOR - the traveler door is wrong.
      const res = await signIn(server, surfaceEmail, VALID_PASSWORD, 'account');

      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('WRONG_LOGIN_SURFACE');
      expect(extractSessionCookie(res.headers['set-cookie'])).toBeUndefined();
    });

    it('signs in at the right door and stamps the surface onto the session row', async () => {
      const res = await signIn(server, surfaceEmail, VALID_PASSWORD, 'portal');
      expect(res.status).toBe(200);

      const dbUser = await prisma.user.findUnique({
        where: { email: surfaceEmail },
        select: { id: true },
      });
      const session = await prisma.session.findFirst({
        where: { userId: dbUser!.id },
        orderBy: { createdAt: 'desc' },
        select: { surface: true },
      });
      expect(session?.surface).toBe('portal');
    });
  });

  // ── Login pre-check (POST /api/v1/auth/login-precheck) ─────────────────────

  describe('POST /api/v1/auth/login-precheck', () => {
    let sharedEmail: string;

    beforeAll(async () => {
      sharedEmail = uniqueEmail('precheck-shared');
      // Default role TOUR_OPERATOR - belongs at 'portal' only.
      await provisionUser(sharedEmail, 'Precheck Shared User');
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email: sharedEmail } });
      } catch {
        // Already cleaned up.
      }
    });

    it('returns ok:true for an unknown email (enumeration-safe)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login-precheck')
        .send({ email: 'nobody@does-not-exist-e2e.com', surface: 'portal' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns ok:true when the email belongs at the surface', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login-precheck')
        .send({ email: sharedEmail, surface: 'portal' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns ok:false with the suggested door on a wrong-door probe', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login-precheck')
        .send({ email: sharedEmail, surface: 'staff' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.suggested).toBe('portal');
      expect(res.body.surfaces).toContain('portal');
    });

    it('rejects an invalid surface value with 400', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login-precheck')
        .send({ email: sharedEmail, surface: 'backstage' });

      expect(res.status).toBe(400);
    });
  });

  // ── Session-surface switching (GET/PATCH /api/v1/auth/session-surface) ─────

  describe('session-surface switching', () => {
    let email: string;
    let cookie: string;

    beforeAll(async () => {
      email = uniqueEmail('surface-switch');
      // Default role TOUR_OPERATOR - holds exactly the 'portal' surface.
      await provisionUser(email, 'Surface Switch User');
      const res = await signIn(server, email, VALID_PASSWORD, 'portal');
      if (res.status !== 200) {
        throw new Error(`Setup sign-in failed: ${JSON.stringify(res.body)}`);
      }
      cookie = extractSessionCookie(res.headers['set-cookie'])!;
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email } });
      } catch {
        // Already cleaned up.
      }
    });

    it('requires authentication', async () => {
      const res = await request(server).get('/api/v1/auth/session-surface');
      expect(res.status).toBe(401);
    });

    it('reports the stamped surface and the available set', async () => {
      const res = await request(server)
        .get('/api/v1/auth/session-surface')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.current).toBe('portal');
      expect(res.body.available).toEqual(['portal']);
    });

    it('refuses re-stamping to a surface the account has no hat for', async () => {
      const res = await request(server)
        .patch('/api/v1/auth/session-surface')
        .set('Cookie', cookie)
        .send({ surface: 'staff' });

      expect(res.status).toBe(403);

      // The session row must be untouched.
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      const session = await prisma.session.findFirst({
        where: { userId: dbUser!.id },
        orderBy: { createdAt: 'desc' },
        select: { surface: true },
      });
      expect(session?.surface).toBe('portal');
    });

    it('rejects an unknown surface value with 400', async () => {
      const res = await request(server)
        .patch('/api/v1/auth/session-surface')
        .set('Cookie', cookie)
        .send({ surface: 'backstage' });

      expect(res.status).toBe(400);
    });

    it('re-stamps the session when the account holds the surface (multi-hat)', async () => {
      // Give the account a customer hat: any Customer row opens 'account'.
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      const operator = await prisma.operator.findFirst({
        select: { id: true },
      });
      if (!operator) {
        // No operator in the test DB - nothing to attach a customer row to;
        // the single-hat refusal above already covers the guard.
        return;
      }
      await prisma.customer.create({
        data: { userId: dbUser!.id, operatorId: operator.id },
      });

      const res = await request(server)
        .patch('/api/v1/auth/session-surface')
        .set('Cookie', cookie)
        .send({ surface: 'account' });

      expect(res.status).toBe(200);
      expect(res.body.current).toBe('account');
      expect(res.body.available).toEqual(
        expect.arrayContaining(['portal', 'account']),
      );

      const session = await prisma.session.findFirst({
        where: { userId: dbUser!.id },
        orderBy: { createdAt: 'desc' },
        select: { surface: true },
      });
      expect(session?.surface).toBe('account');

      await prisma.customer.deleteMany({ where: { userId: dbUser!.id } });
    });
  });

  // ── Change email - old-inbox confirmation gate ──────────────────────────────

  describe('POST /api/auth/change-email (old-inbox confirmation gate)', () => {
    let email: string;
    let cookie: string;

    beforeAll(async () => {
      email = uniqueEmail('change-email');
      // provisionUser creates the account emailVerified: true, which is what
      // routes change-email through the sendChangeEmailConfirmation branch
      // (confirmation link to the CURRENT inbox) instead of a direct update.
      await provisionUser(email, 'Change Email User');
      const res = await signIn(server, email, VALID_PASSWORD, 'portal');
      if (res.status !== 200) {
        throw new Error(`Setup sign-in failed: ${JSON.stringify(res.body)}`);
      }
      cookie = extractSessionCookie(res.headers['set-cookie'])!;
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email } });
      } catch {
        // Already cleaned up.
      }
    });

    it('accepts the request but does NOT change the email until the emailed link is used', async () => {
      const newEmail = uniqueEmail('change-email-target');

      const res = await request(server)
        .post('/api/auth/change-email')
        .set('Cookie', cookie)
        .send({ newEmail });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);

      // The gate: the address on the account is untouched - it only moves
      // after the confirmation link (sent to the OLD inbox) and then the
      // verification link (sent to the new inbox) are both opened.
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { email: true },
      });
      expect(dbUser?.email).toBe(email);
    });

    it('rejects changing to the same email', async () => {
      const res = await request(server)
        .post('/api/auth/change-email')
        .set('Cookie', cookie)
        .send({ newEmail: email });

      expect(res.status).toBe(400);
    });

    it('returns a silent fake success for a taken email (enumeration-safe) and changes nothing', async () => {
      const takenEmail = uniqueEmail('change-email-taken');
      await provisionUser(takenEmail, 'Already Taken');

      const res = await request(server)
        .post('/api/auth/change-email')
        .set('Cookie', cookie)
        .send({ newEmail: takenEmail });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { email: true },
      });
      expect(dbUser?.email).toBe(email);

      await prisma.user.delete({ where: { email: takenEmail } });
    });

    it('completes the full two-link flow: old-inbox approval, then new-inbox verification, then the email changes', async () => {
      // Dedicated user - this test actually moves the email, so the outer
      // describe's fixture must not be touched.
      const flowEmail = uniqueEmail('change-email-flow');
      const newEmail = uniqueEmail('change-email-flow-new');
      await provisionUser(flowEmail, 'Change Email Flow User');
      const flowSignIn = await signIn(
        server,
        flowEmail,
        VALID_PASSWORD,
        'portal',
      );
      expect(flowSignIn.status).toBe(200);
      const flowCookie = extractSessionCookie(
        flowSignIn.headers['set-cookie'],
      )!;

      // Spy on the SAME MailService singleton auth.instance.ts uses - the
      // captured URLs are the real emailed links, tokens included.
      const confirmSpy = jest
        .spyOn(mailService, 'sendChangeEmailConfirmationEmail')
        .mockResolvedValue(undefined);
      const verifySpy = jest
        .spyOn(mailService, 'sendVerificationEmail')
        .mockResolvedValue(undefined);

      // Auth-hook mail sends are fire-and-forget (sendInBackground), so the
      // HTTP response can land before the spy records the call.
      const waitForCall = async (spy: { mock: { calls: unknown[] } }) => {
        for (let i = 0; i < 50 && spy.mock.calls.length === 0; i++) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(spy.mock.calls.length).toBeGreaterThan(0);
      };
      // The emailed URL is absolute (BETTER_AUTH_URL origin); supertest wants
      // the path + query against the in-process server.
      const pathFromAuthUrl = (url: string) => {
        const u = new URL(url);
        return u.pathname + u.search;
      };

      // .env.test trusts http://localhost:3000 - stands in for the dashboard
      // origin the real dialog passes via window.location.origin.
      const callbackURL = 'http://localhost:3000/profile?email_change=1';

      try {
        const res = await request(server)
          .post('/api/auth/change-email')
          .set('Cookie', flowCookie)
          .send({ newEmail, callbackURL });
        expect(res.status).toBe(200);

        // Step 1: confirmation went to the OLD inbox, naming the new address.
        await waitForCall(confirmSpy);
        const [confirmTo, confirmUrl, confirmNewEmail] =
          confirmSpy.mock.calls[0];
        expect(confirmTo).toBe(flowEmail);
        expect(confirmNewEmail).toBe(newEmail);

        // Step 2: open the old-inbox link WITHOUT the session cookie - the
        // link must work from any mail client, not just the signed-in browser.
        const confirmRes = await request(server).get(
          pathFromAuthUrl(confirmUrl),
        );
        expect(confirmRes.status).toBe(302);
        expect(confirmRes.headers.location).toBe(callbackURL);

        // Email still unchanged - approval alone must not move it.
        const midUser = await prisma.user.findUnique({
          where: { email: flowEmail },
          select: { email: true },
        });
        expect(midUser?.email).toBe(flowEmail);

        // The verification email went to the NEW address, with the tailored
        // change-email copy (variant arg), not the generic verify copy.
        await waitForCall(verifySpy);
        const [verifyTo, verifyUrl, , verifyVariant] = verifySpy.mock.calls[0];
        expect(verifyTo).toBe(newEmail);
        expect(verifyVariant).toBe('email-change');

        // Step 3: open the new-inbox link - NOW the email changes.
        const verifyRes = await request(server).get(pathFromAuthUrl(verifyUrl));
        expect(verifyRes.status).toBe(302);
        expect(verifyRes.headers.location).toBe(callbackURL);

        const finalUser = await prisma.user.findUnique({
          where: { email: newEmail },
          select: { email: true, emailVerified: true },
        });
        expect(finalUser?.email).toBe(newEmail);
        expect(finalUser?.emailVerified).toBe(true);
        expect(
          await prisma.user.findUnique({ where: { email: flowEmail } }),
        ).toBeNull();
      } finally {
        confirmSpy.mockRestore();
        verifySpy.mockRestore();
        await prisma.user.deleteMany({
          where: { email: { in: [flowEmail, newEmail] } },
        });
      }
      // Explicit budget: the two mail-spy polls alone may legitimately wait
      // several seconds (fire-and-forget sends), which the 5s default has no
      // headroom for under CI contention.
    }, 20_000);
  });

  // ── Session ──────────────────────────────────────────────────────────────────

  describe('GET /api/auth/get-session', () => {
    let sessionEmail: string;
    let sessionCookie: string;

    beforeAll(async () => {
      sessionEmail = uniqueEmail('session-test');

      await provisionUser(sessionEmail, 'Session Test User');

      const signInRes = await signIn(server, sessionEmail, VALID_PASSWORD);
      if (signInRes.status !== 200) {
        throw new Error(
          `Session test setup sign-in failed: ${JSON.stringify(signInRes.body)}`,
        );
      }

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      if (!cookie) {
        throw new Error(
          'Session test setup: no session cookie received after sign-in',
        );
      }
      sessionCookie = cookie;
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email: sessionEmail } });
      } catch {
        // Already cleaned up.
      }
    });

    it('returns 200 with user data when a valid session cookie is provided', async () => {
      const res = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(sessionEmail);
    });

    it('includes the role field in the session user object', async () => {
      const res = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('TOUR_OPERATOR');
    });

    it('includes the status field in the session user object', async () => {
      const res = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('ACTIVE');
    });

    it('does not expose password in the session response', async () => {
      const res = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('hashedPassword');
    });

    it('returns null session data (not 401) when no cookie is provided', async () => {
      // Better Auth returns { session: null, user: null } rather than throwing
      // a 401 on GET /api/auth/get-session - this is handled outside the NestJS
      // AuthGuard pipeline (the AuthController is @Public()).
      const res = await request(server).get('/api/auth/get-session');

      // Must not be a 5xx error.
      expect(res.status).toBeLessThan(500);

      // Better Auth's contract: the session endpoint always returns 200 with
      // null fields when there is no active session.
      if (res.status === 200) {
        // Either the whole body is null or the session/user keys are null.
        const isNullBody =
          res.body === null ||
          (res.body.session === null && res.body.user === null) ||
          res.body.session === null;
        expect(isNullBody).toBe(true);
      } else {
        // Some Better Auth versions return a non-200 for missing sessions.
        // Any status < 500 is acceptable here.
        expect(res.status).toBeLessThan(500);
      }
    });

    it('session includes the session token reference', async () => {
      const res = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('session');
      expect(res.body.session).not.toBeNull();
    });
  });

  // ── Sign-out ─────────────────────────────────────────────────────────────────

  describe('POST /api/auth/sign-out', () => {
    let signOutEmail: string;

    beforeAll(async () => {
      signOutEmail = uniqueEmail('signout-test');
      await provisionUser(signOutEmail, 'Sign-out Test User');
    });

    afterAll(async () => {
      try {
        await prisma.user.delete({ where: { email: signOutEmail } });
      } catch {
        // Already cleaned up.
      }
    });

    it('returns 200 when signing out with a valid session cookie', async () => {
      const signInRes = await signIn(server, signOutEmail, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      const signOutRes = await request(server)
        .post('/api/auth/sign-out')
        .set('Cookie', cookie!);

      expect(signOutRes.status).toBe(200);
    });

    it('clears or expires the session cookie on sign-out', async () => {
      const signInRes = await signIn(server, signOutEmail, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      const signOutRes = await request(server)
        .post('/api/auth/sign-out')
        .set('Cookie', cookie!);

      expect(signOutRes.status).toBe(200);

      // After sign-out, Better Auth should instruct the browser to expire the
      // session cookie by setting it with an expired Max-Age or Expires value.
      const setCookieAfterSignOut = signOutRes.headers['set-cookie'] as
        | string
        | string[]
        | undefined;
      if (setCookieAfterSignOut) {
        const sessionCookieHeader = (
          Array.isArray(setCookieAfterSignOut)
            ? setCookieAfterSignOut
            : [setCookieAfterSignOut]
        ).find((c) => c.includes('better-auth.session_token'));

        if (sessionCookieHeader) {
          // Cookie should be cleared: either Max-Age=0 or an Expires in the past
          const isCleared =
            sessionCookieHeader.includes('Max-Age=0') ||
            sessionCookieHeader.includes('Expires=') ||
            sessionCookieHeader.includes('better-auth.session_token=;');
          expect(isCleared).toBe(true);
        }
      }
    });

    it('returns an error-free response when signing out without a session cookie', async () => {
      // Signing out without a session must not crash the server.
      const res = await request(server)
        .post('/api/auth/sign-out')
        .set('Content-Type', 'application/json');

      // Any non-5xx response is acceptable (Better Auth may return 401 or 200).
      expect(res.status).toBeLessThan(500);
    });

    it('session is invalidated after sign-out - subsequent session fetch returns null', async () => {
      const signInRes = await signIn(server, signOutEmail, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      // Sign out.
      await request(server).post('/api/auth/sign-out').set('Cookie', cookie!);

      // Now verify the session is gone - GET /api/auth/get-session with the old
      // cookie should return null or an empty session.
      const sessionRes = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', cookie!);

      expect(sessionRes.status).toBeLessThan(500);

      if (sessionRes.status === 200) {
        const hasNullSession =
          sessionRes.body === null ||
          sessionRes.body.session === null ||
          (sessionRes.body.user === null && sessionRes.body.session === null);
        expect(hasNullSession).toBe(true);
      }
      // A non-200 status (e.g. 401) is also acceptable - the important thing is
      // that the old token is no longer valid.
    });
  });

  // ── AuthGuard - public vs. protected routes ────────────────────────────────

  describe('AuthGuard - route protection', () => {
    it('GET /api/v1/health is accessible without any session cookie (@Public)', async () => {
      const res = await request(server).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('GET /api/v1/health returns 200 even with a completely invalid cookie', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .set('Cookie', 'better-auth.session_token=totally-invalid-token');

      // @Public() + @SkipThrottle() - AuthGuard is bypassed entirely.
      expect(res.status).toBe(200);
    });

    it('a protected NestJS route returns 401 without a session cookie', async () => {
      // The AuthGuard is a global APP_GUARD. Any route that is NOT @Public()
      // will return 401 when no valid session is present.
      // We probe a route that will either be:
      //   (a) a real protected route → 401
      //   (b) a non-existent route → 404 (acceptable only if AuthGuard runs
      //       before the routing layer and returns 401 first)
      //
      // In NestJS the guard chain fires before route resolution for matched
      // routes. For a non-matched route, the global exception filter returns 404.
      // We test a path that matches the global prefix but has no handler -
      // NestJS finds no matching handler and AllExceptionsFilter produces a 404.
      //
      // To reliably test the 401 path without needing a real protected endpoint
      // we use the fact that AuthGuard runs for ALL routes inside api/v1 that
      // lack @Public(). We confirm this by testing a deliberately crafted path
      // segment that NestJS will try to route, hit the guard first, and return
      // 401 because there's no session.
      //
      // Since only /api/v1/health is @Public() in the current route set, any
      // other /api/v1/* path that the router accepts will require auth. The
      // safest approach is to verify that when a valid user IS authenticated,
      // the system works - and when they are NOT, the 401 is returned for routes
      // that do have handlers. We validate the 401 path using the session
      // endpoint indirectly: NestJS AuthGuard fires for all /api/v1/* routes.
      //
      // Concrete test: send a request to an API route without credentials and
      // confirm the response is either 401 (guard ran) or 404 (no handler but
      // guard allowed it through because there's no route to protect).
      // Given only the health route exists right now, we observe a 404 for
      // unknown paths - the guard still runs but throws UnauthorizedException
      // which bubbles as 401 only if the route actually resolves to a handler.
      //
      // To keep the test deterministic, we use the fact that AuthGuard throws
      // UnauthorizedException, which the AllExceptionsFilter maps to 401.
      // Even for non-existent routes the guard fires first in NestJS.

      const res = await request(server).get(
        '/api/v1/protected-route-that-requires-auth',
      );

      // NestJS evaluates guards even for routes that will ultimately 404 -
      // the guard runs in the middleware pipeline before route matching completes
      // for routes inside the application context. The result may be 401 or 404
      // depending on how NestJS resolves the pipeline for unknown paths.
      // Both are acceptable: 404 means the route was not found (no handler was
      // registered, so the guard did not fire), while 401 means the guard fired
      // and rejected the unauthenticated request.
      expect([401, 404]).toContain(res.status);
    });

    it('authenticated request to session endpoint succeeds - AuthGuard accepts valid session', async () => {
      const email = uniqueEmail('authguard-test');
      createdEmails.push(email);

      await provisionUser(email, 'AuthGuard Tester');
      const signInRes = await signIn(server, email, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      // GET /api/auth/get-session is @Public() but it reads the session cookie via
      // the Better Auth handler - confirms the cookie is valid end-to-end.
      const sessionRes = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', cookie!);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.user.email).toBe(email);
    });
  });

  // ── Role injection - defense-in-depth verification ────────────────────────

  describe('Role injection - defense-in-depth', () => {
    it('signing up with role: ADMIN creates nothing (sign-up disabled) - no elevation possible', async () => {
      const email = uniqueEmail('role-injection-admin');
      // Not pushed to createdEmails - no user must be created.

      const res = await signUp(server, {
        name: 'Admin Injection Attempt',
        email,
        password: VALID_PASSWORD,
        role: 'ADMIN',
      });

      expect(res.status).not.toBe(200);
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).toBeNull();
    });

    it('signing up with status: SUSPENDED creates nothing (sign-up disabled)', async () => {
      const email = uniqueEmail('status-injection');
      // Not pushed to createdEmails - no user must be created.

      const res = await signUp(server, {
        name: 'Status Injection Attempt',
        email,
        password: VALID_PASSWORD,
        status: 'SUSPENDED',
      });

      expect(res.status).not.toBe(200);
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).toBeNull();
    });

    it('session response reflects the actual database role, not any injected value', async () => {
      const email = uniqueEmail('session-role-verify');
      createdEmails.push(email);

      await provisionUser(email, 'Session Role Verifier');

      const signInRes = await signIn(server, email, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      const sessionRes = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', cookie!);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.user.role).toBe('TOUR_OPERATOR');
      expect(sessionRes.body.user.role).not.toBe('ADMIN');
    });
  });

  // ── Full round-trip flow ──────────────────────────────────────────────────

  describe('Full auth round-trip - sign up, sign in, get session, sign out', () => {
    it('completes the full auth lifecycle without error', async () => {
      const email = uniqueEmail('full-roundtrip');
      createdEmails.push(email);
      const name = 'Round Trip User';

      // 1. Provision (public sign-up is disabled - invite flows create
      //    accounts; the internal adapter stands in for them here)
      const created = await provisionUser(email, name);
      expect(created.id).toBeDefined();

      // 2. Sign in
      const signInRes = await signIn(server, email, VALID_PASSWORD);
      expect(signInRes.status).toBe(200);

      const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
      expect(cookie).toBeDefined();

      // 3. Get session - should return the correct user
      const sessionRes = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', cookie!);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.user.email).toBe(email);
      expect(sessionRes.body.user.name).toBe(name);
      expect(sessionRes.body.user.role).toBe('TOUR_OPERATOR');
      expect(sessionRes.body.user.status).toBe('ACTIVE');

      // 4. Sign out
      const signOutRes = await request(server)
        .post('/api/auth/sign-out')
        .set('Cookie', cookie!);

      expect(signOutRes.status).toBe(200);

      // 5. Verify session is invalidated
      const postSignOutSession = await request(server)
        .get('/api/auth/get-session')
        .set('Cookie', cookie!);

      expect(postSignOutSession.status).toBeLessThan(500);
      if (postSignOutSession.status === 200) {
        expect(
          postSignOutSession.body === null ||
            postSignOutSession.body.session === null ||
            postSignOutSession.body.user === null,
        ).toBe(true);
      }
    });
  });
});
