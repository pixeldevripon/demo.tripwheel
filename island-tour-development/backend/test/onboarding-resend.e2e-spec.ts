/**
 * Admin resend e2e (WP-D, checklist D-20/D-21/D-27) — real HTTP, real
 * Postgres, real session cookies. Pins the endpoint contract:
 *
 *   POST /api/v1/operators/:id/emails/:templateKey/resend
 *     - 401 unauthenticated, 403 non-admin (MANAGE_OPERATORS)
 *     - 400 for a non-onboarding key (BK1) and for junk keys
 *     - 404 for an unknown operator
 *     - 201 happy path: a `#resend-{n}` EmailSend row is written and
 *       returned; a second resend writes `#resend-{n+1}` (the count-based
 *       scope rule) — both visible on the timeline read.
 *
 * The transport is NOT stubbed: RESEND_API_KEY is absent in the test env, so
 * MailService.sendMail throws, claimAndSend records the row FAILED — which
 * is exactly the claim-first contract (the slot is taken, the row tells the
 * truth). The assertions therefore accept SENT|FAILED and pin the scope ids.
 *
 * User provisioning matches operators.e2e-spec.ts (public sign-up disabled:
 * internalAdapter + role promotion before sign-in).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  EmailTemplateKey,
  OperatorVerificationStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { auth } from './../src/auth/auth.instance';

const API = '/api/v1';
const VALID_PASSWORD = 'TestPass@1234!';

function uniqueEmail(prefix = 'test'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-e2e.com`;
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

describe('Operator onboarding email resend (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  let adminUserId: string;
  let adminCookie: string;
  let operatorUserId: string;
  let operatorCookie: string;
  let operatorId: string; // the resend target (owned by a separate user)
  let targetUserId: string;

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

    const admin = await createSignedInUser({
      name: 'E2E Resend Admin',
      email: uniqueEmail('e2e-resend-admin'),
      role: Role.ADMIN,
    });
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    const operator = await createSignedInUser({
      name: 'E2E Resend NonAdmin',
      email: uniqueEmail('e2e-resend-op'),
    });
    operatorUserId = operator.userId;
    operatorCookie = operator.cookie;

    // The target operator (VERIFIED so every OB key renders).
    const authCtx = await auth.$context;
    const targetUser = await authCtx.internalAdapter.createUser({
      email: uniqueEmail('e2e-resend-target'),
      name: 'Mayra Martina',
      role: Role.TOUR_OPERATOR,
      emailVerified: true,
    });
    targetUserId = targetUser.id;
    const row = await prisma.operator.create({
      data: {
        userId: targetUser.id,
        verificationStatus: OperatorVerificationStatus.VERIFIED,
        verificationDecidedAt: new Date(),
      },
      select: { id: true },
    });
    operatorId = row.id;
  });

  afterAll(async () => {
    const authCtx = await auth.$context;
    try {
      await prisma.emailSend.deleteMany({
        where: { scopeId: { startsWith: operatorId } },
      });
    } catch {
      /* keep going */
    }
    try {
      await prisma.emailUnsubscribeToken.deleteMany({
        where: { audience: 'OPERATOR' },
      });
    } catch {
      /* rows may be shared; best-effort */
    }
    try {
      await prisma.operator.delete({ where: { id: operatorId } });
    } catch {
      /* already gone */
    }
    for (const id of [targetUserId, operatorUserId, adminUserId]) {
      try {
        await authCtx.internalAdapter.deleteUser(id);
      } catch {
        /* already gone */
      }
    }
    await prisma.$disconnect();
    await app.close();
  });

  const resendUrl = (key: string, id = operatorId) =>
    `${API}/operators/${id}/emails/${key}/resend`;

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it('401s unauthenticated', async () => {
    const res = await request(server).post(resendUrl('OB6_CHECK_IN'));
    expect(res.status).toBe(401);
  });

  it('403s a non-admin and writes no row', async () => {
    const res = await request(server)
      .post(resendUrl('OB6_CHECK_IN'))
      .set('Cookie', operatorCookie);
    expect(res.status).toBe(403);

    const rows = await prisma.emailSend.count({
      where: { scopeId: { startsWith: operatorId } },
    });
    expect(rows).toBe(0);
  });

  // ── Key validation (D-20) ────────────────────────────────────────────────

  it('400s a non-onboarding key (BK1) and junk keys', async () => {
    for (const key of ['BK1_CONFIRMATION', 'INT1_NEW_OPERATOR', 'nonsense']) {
      const res = await request(server)
        .post(resendUrl(key))
        .set('Cookie', adminCookie);
      expect(res.status).toBe(400);
    }
  });

  it('404s an unknown operator', async () => {
    const res = await request(server)
      .post(resendUrl('OB6_CHECK_IN', '00000000-0000-4000-8000-000000000000'))
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });

  // ── Happy path + the n / n+1 scope rule (D-27's substrate) ──────────────

  it('writes and returns the #resend-{n} row; a second resend gets n+1', async () => {
    const first = await request(server)
      .post(resendUrl('OB6_CHECK_IN'))
      .set('Cookie', adminCookie);
    expect(first.status).toBe(201);
    // No base row existed, so the count-based rule starts at #resend-0.
    expect(first.body.scopeId).toBe(`${operatorId}#resend-0`);
    expect(first.body.templateKey).toBe(EmailTemplateKey.OB6_CHECK_IN);
    // No RESEND_API_KEY in the test env: the claim survives as FAILED —
    // claim-first means the row exists and tells the truth either way.
    expect(['SENT', 'FAILED']).toContain(first.body.status);

    const second = await request(server)
      .post(resendUrl('OB6_CHECK_IN'))
      .set('Cookie', adminCookie);
    expect(second.status).toBe(201);
    expect(second.body.scopeId).toBe(`${operatorId}#resend-1`);

    // Both rows are on the operator's timeline read (base + #resend-*).
    const timeline = await request(server)
      .get(`${API}/operators/${operatorId}/emails`)
      .set('Cookie', adminCookie);
    expect(timeline.status).toBe(200);
    const scopeIds = (timeline.body as Array<{ scopeId: string }>).map(
      (r) => r.scopeId,
    );
    expect(scopeIds).toEqual(
      expect.arrayContaining([
        `${operatorId}#resend-0`,
        `${operatorId}#resend-1`,
      ]),
    );
  });

  it('a lifecycle resend minted a reusable unsubscribe token for the operator', async () => {
    const target = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { user: { select: { email: true } } },
    });
    const token = await prisma.emailUnsubscribeToken.findFirst({
      where: {
        email: target!.user.email.toLowerCase(),
        audience: 'OPERATOR',
        stream: 'LIFECYCLE',
      },
    });
    expect(token).not.toBeNull();
  });
});
