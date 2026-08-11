/**
 * Email centre e2e (WP-H, checklist H-09) — real HTTP, real Postgres, real
 * session cookies. Pins the dashboard-facing contract:
 *
 *   GET/PATCH /api/v1/email/settings
 *     - 401 unauthenticated · 403 non-admin (MANAGE_SYSTEM)
 *     - GET returns { effective, stored, defaults } with all-null stored and
 *       built-in effective values on a virgin database
 *     - PATCH roundtrip: stored value wins in `effective`; null clears back
 *       to the default; the review slice passes through to
 *       review_request_settings (and only there)
 *     - bounds: inverted window 400s on MERGED values; an unknown field
 *       (e.g. a booking-email switch, which deliberately does not exist)
 *       400s via forbidNonWhitelisted
 *   GET /email/sends|opt-outs|consents — pagination + filters
 *   POST /email/test-send — logs `test:<userId>#<n>` to the caller's own
 *       address (transport unconfigured in tests → the row is FAILED, which
 *       is exactly the claim-first contract).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
  PrismaClient,
  Role,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { auth } from './../src/auth/auth.instance';

const API = '/api/v1';
const VALID_PASSWORD = 'TestPass@1234!';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function uniqueEmail(prefix = 'centre'): string {
  return `${prefix}+${suffix}-${Math.random().toString(36).slice(2, 6)}@example-e2e.com`;
}

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
  return sessionCookie?.split(';')[0];
}

describe('Email centre (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  let adminUserId: string;
  let adminEmail: string;
  let adminCookie: string;
  let operatorCookie: string;

  const seededSendEmail = `send+${suffix}@example-e2e.com`;
  const seededOptOutEmail = `optout+${suffix}@example-e2e.com`;
  const seededConsentEmail = `consent+${suffix}@example-e2e.com`;

  async function createSignedInUser(opts: {
    name: string;
    email: string;
    role?: Role;
  }): Promise<{ userId: string; cookie: string }> {
    const authCtx = await auth.$context;
    const hashedPassword = await authCtx.password.hash(VALID_PASSWORD);
    const user = await authCtx.internalAdapter.createUser({
      email: opts.email,
      name: opts.name,
      role: Role.TOUR_OPERATOR,
      emailVerified: true,
    });
    await authCtx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hashedPassword,
    });
    if (opts.role && opts.role !== Role.TOUR_OPERATOR) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: opts.role },
      });
    }
    const res = await request(server)
      .post('/api/auth/sign-in/email')
      .set('Content-Type', 'application/json')
      .set('x-login-surface', 'portal')
      .send({ email: opts.email, password: VALID_PASSWORD });
    if (res.status !== 200) {
      throw new Error(`Test setup: sign-in failed for ${opts.email}`);
    }
    const cookie = extractSessionCookie(res.headers['set-cookie']);
    if (!cookie) throw new Error('Test setup: no session cookie');
    return { userId: user.id, cookie };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/auth/*path'] });
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

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    adminEmail = uniqueEmail('admin');
    const admin = await createSignedInUser({
      name: 'Centre Admin',
      email: adminEmail,
      role: Role.ADMIN,
    });
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    const operator = await createSignedInUser({
      name: 'Centre Operator',
      email: uniqueEmail('op'),
      role: Role.TOUR_OPERATOR,
    });
    operatorCookie = operator.cookie;

    // A virgin switchboard for the roundtrip assertions.
    await prisma.emailSettings.deleteMany({ where: { id: 'default' } });

    // Seed list rows the filters can bite on.
    await prisma.emailSend.createMany({
      data: [
        {
          templateKey: EmailTemplateKey.OB6_CHECK_IN,
          scopeId: `e2e-op-${suffix}`,
          toEmail: seededSendEmail,
          stream: EmailStream.LIFECYCLE,
          status: EmailSendStatus.SENT,
        },
        {
          templateKey: EmailTemplateKey.OB7_CONNECT_CALENDAR,
          scopeId: `e2e-op-${suffix}`,
          toEmail: seededSendEmail,
          stream: EmailStream.LIFECYCLE,
          status: EmailSendStatus.SUPPRESSED,
          suppressedReason: 'calendar-connected',
        },
      ],
    });
    await prisma.emailOptOut.create({
      data: {
        email: seededOptOutEmail,
        audience: EmailAudience.OPERATOR,
        stream: EmailStream.LIFECYCLE,
        source: 'admin',
      },
    });
    await prisma.emailConsent.create({
      data: {
        email: seededConsentEmail,
        source: 'checkout-newsletter-opt-in',
      },
    });
  });

  afterAll(async () => {
    await prisma.emailSend.deleteMany({
      where: {
        OR: [
          { scopeId: { startsWith: `e2e-op-${suffix}` } },
          { scopeId: { startsWith: `test:${adminUserId}#` } },
        ],
      },
    });
    await prisma.emailOptOut.deleteMany({
      where: { email: seededOptOutEmail },
    });
    await prisma.emailConsent.deleteMany({
      where: { email: seededConsentEmail },
    });
    await prisma.emailSettings.deleteMany({ where: { id: 'default' } });
    await prisma.reviewRequestSettings.updateMany({
      where: { id: 'default' },
      data: { enabled: false },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // ── Guards ──────────────────────────────────────────────────────────────────

  it('401 unauthenticated on every route', async () => {
    await request(server).get(`${API}/email/settings`).expect(401);
    await request(server).patch(`${API}/email/settings`).send({}).expect(401);
    await request(server).get(`${API}/email/sends`).expect(401);
    await request(server)
      .post(`${API}/email/test-send`)
      .send({ templateKey: 'OB6_CHECK_IN' })
      .expect(401);
  });

  it('403 for a non-admin (MANAGE_SYSTEM)', async () => {
    await request(server)
      .get(`${API}/email/settings`)
      .set('Cookie', operatorCookie)
      .expect(403);
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', operatorCookie)
      .send({ marketingEnabled: true })
      .expect(403);
    await request(server)
      .get(`${API}/email/sends`)
      .set('Cookie', operatorCookie)
      .expect(403);
    await request(server)
      .get(`${API}/email/opt-outs`)
      .set('Cookie', operatorCookie)
      .expect(403);
    await request(server)
      .get(`${API}/email/consents`)
      .set('Cookie', operatorCookie)
      .expect(403);
    await request(server)
      .post(`${API}/email/test-send`)
      .set('Cookie', operatorCookie)
      .send({ templateKey: 'OB6_CHECK_IN' })
      .expect(403);
  });

  // ── Settings roundtrip (H-04) ───────────────────────────────────────────────

  it('GET: virgin DB → all-null stored, built-in effective, defaults === effective', async () => {
    const res = await request(server)
      .get(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(res.body.stored.ob3DelayHours).toBeNull();
    expect(res.body.stored.marketingEnabled).toBeNull();
    expect(res.body.effective.ob3DelayHours).toBe(48);
    expect(res.body.effective.onboardingEnabled).toBe(true);
    expect(res.body.effective.windowWeekdays).toBe('tue,wed,thu');
    expect(res.body.defaults.ob3DelayHours).toBe(48);
    expect(res.body.effective.review).toMatchObject({
      firstSendLocalHour: expect.any(Number),
      firstSendDelayDays: expect.any(Number),
      reminderAfterDays: expect.any(Number),
      giveUpAfterDays: expect.any(Number),
    });
  });

  it('PATCH stores overrides; effective reflects them; review passes through to ITS table', async () => {
    const res = await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({
        ob3DelayHours: 12,
        marketingEnabled: true,
        windowWeekdays: 'MON,fri',
        review: { enabled: true, reminderAfterDays: 7 },
      })
      .expect(200);
    expect(res.body.stored.ob3DelayHours).toBe(12);
    expect(res.body.effective.ob3DelayHours).toBe(12);
    expect(res.body.effective.marketingEnabled).toBe(true);
    expect(res.body.stored.windowWeekdays).toBe('mon,fri'); // normalized
    expect(res.body.effective.review.enabled).toBe(true);
    expect(res.body.effective.review.reminderAfterDays).toBe(7);
    // defaults are NOT dragged along by stored values.
    expect(res.body.defaults.ob3DelayHours).toBe(48);

    // The review slice landed in review_request_settings…
    const reviewRow = await prisma.reviewRequestSettings.findUnique({
      where: { id: 'default' },
    });
    expect(reviewRow?.enabled).toBe(true);
    expect(reviewRow?.reminderAfterDays).toBe(7);
    // …and NOT in email_settings (no such columns — the row carries only
    // the email-programme fields).
    const settingsRow = await prisma.emailSettings.findUnique({
      where: { id: 'default' },
    });
    expect(settingsRow?.ob3DelayHours).toBe(12);
  });

  it('PATCH null clears an override back to the default', async () => {
    const res = await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ ob3DelayHours: null })
      .expect(200);
    expect(res.body.stored.ob3DelayHours).toBeNull();
    expect(res.body.effective.ob3DelayHours).toBe(48);
  });

  it('PATCH rejects an inverted window on MERGED values (400)', async () => {
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ windowStartHour: 11 }) // default end is 11 → empty window
      .expect(400);
  });

  it('PATCH rejects out-of-bounds values (400)', async () => {
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ ob3DelayHours: 0 })
      .expect(400);
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ windowWeekdays: '' })
      .expect(400);
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ salesEmail: 'not-an-email' })
      .expect(400);
  });

  it('there is NO booking-email switch: the field 400s as unknown', async () => {
    // Founder decision 2026-08-11: BK-1/BK-2/CX-1 are contractual. The DTO
    // carries no such field, so forbidNonWhitelisted rejects it.
    await request(server)
      .patch(`${API}/email/settings`)
      .set('Cookie', adminCookie)
      .send({ bookingEmailsEnabled: false })
      .expect(400);
  });

  // ── Lists (H-05/H-06) ──────────────────────────────────────────────────────

  it('GET /email/sends: paginated wrapper + status and toEmail filters', async () => {
    const all = await request(server)
      .get(`${API}/email/sends`)
      .query({ toEmail: seededSendEmail.toUpperCase() })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(all.body).toMatchObject({ total: 2, page: 1, limit: 20 });
    expect(all.body.data).toHaveLength(2);
    // Newest first, and the timeline projection carries scopeId.
    expect(all.body.data[0].scopeId).toBe(`e2e-op-${suffix}`);

    const suppressed = await request(server)
      .get(`${API}/email/sends`)
      .query({ toEmail: seededSendEmail, status: 'SUPPRESSED' })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(suppressed.body.total).toBe(1);
    expect(suppressed.body.data[0].suppressedReason).toBe('calendar-connected');

    const wrongTemplate = await request(server)
      .get(`${API}/email/sends`)
      .query({ toEmail: seededSendEmail, templateKey: 'MK1_NEXT_ADVENTURE' })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(wrongTemplate.body.total).toBe(0);
  });

  it('GET /email/opt-outs and /email/consents: email prefix search', async () => {
    const optOuts = await request(server)
      .get(`${API}/email/opt-outs`)
      .query({ email: `optout+${suffix}` })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(optOuts.body.total).toBe(1);
    expect(optOuts.body.data[0]).toMatchObject({
      email: seededOptOutEmail,
      audience: 'OPERATOR',
      stream: 'LIFECYCLE',
      source: 'admin',
    });

    const consents = await request(server)
      .get(`${API}/email/consents`)
      .query({ email: `consent+${suffix}` })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(consents.body.total).toBe(1);
    expect(consents.body.data[0].email).toBe(seededConsentEmail);

    const miss = await request(server)
      .get(`${API}/email/consents`)
      .query({ email: 'nobody@nowhere' })
      .set('Cookie', adminCookie)
      .expect(200);
    expect(miss.body.total).toBe(0);
  });

  // ── Test-send (H-07) ───────────────────────────────────────────────────────

  it('POST /email/test-send: logs test:<userId>#<n> to the caller, n increments', async () => {
    const first = await request(server)
      .post(`${API}/email/test-send`)
      .set('Cookie', adminCookie)
      .send({ templateKey: 'OB6_CHECK_IN' })
      .expect(201);
    // RESEND_API_KEY is absent in the test env: the claim-first contract
    // records the decision as FAILED — the slot is taken, the row is honest.
    expect(['SENT', 'FAILED']).toContain(first.body.status);
    expect(first.body.scopeId).toBe(`test:${adminUserId}#1`);
    expect(first.body.toEmail.toLowerCase()).toBe(adminEmail.toLowerCase());
    expect(first.body.templateKey).toBe('OB6_CHECK_IN');

    const second = await request(server)
      .post(`${API}/email/test-send`)
      .set('Cookie', adminCookie)
      .send({ templateKey: 'OB6_CHECK_IN' })
      .expect(201);
    expect(second.body.scopeId).toBe(`test:${adminUserId}#2`);

    // A booking template is allowed (test-send ≠ switch).
    const bk1 = await request(server)
      .post(`${API}/email/test-send`)
      .set('Cookie', adminCookie)
      .send({ templateKey: 'BK1_CONFIRMATION' })
      .expect(201);
    expect(bk1.body.scopeId).toBe(`test:${adminUserId}#1`);
    expect(bk1.body.stream).toBe('TRANSACTIONAL');

    // Junk keys 400 through the enum validation.
    await request(server)
      .post(`${API}/email/test-send`)
      .set('Cookie', adminCookie)
      .send({ templateKey: 'NOT_A_TEMPLATE' })
      .expect(400);
  });
});
