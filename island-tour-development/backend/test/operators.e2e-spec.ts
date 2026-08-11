/**
 * Operators verification E2E (WP-C, EMAIL-IMPLEMENTATION-PLAN §2.5 row 1).
 *
 * Boots the real NestJS app exactly like `test/tours.e2e-spec.ts` (same global
 * prefix, filter, ValidationPipe flags) and drives the new verification
 * endpoint through Supertest with REAL session cookies:
 *
 *   POST /api/v1/operators/:id/verification { decision }
 *     - 401 unauthenticated, 403 for a non-admin
 *     - 400 for a decision outside VERIFIED|REJECTED (@IsIn on the DTO)
 *     - 201 approve: VERIFIED + verificationDecidedAt stamped
 *     - 409 double-decide (the guarded updateMany lost its PENDING guard)
 *     - 201 reject on a second PENDING operator
 *
 *   PATCH /api/v1/operators/:id
 *     - 400 when the body still carries `verificationStatus` - the field was
 *       removed from UpdateOperatorDto (C-09) and the global ValidationPipe
 *       (whitelist + forbidNonWhitelisted) must refuse it, closing the old
 *       blanket write at operators.service.ts update().
 *
 *   GET /api/v1/operators?verificationStatus=
 *     - filter honoured; rows carry the WP-C list fields (toursSubmitted,
 *       firstTourLiveAt, verificationDecidedAt) for the dashboard pipeline.
 *
 * User provisioning matches tours.e2e-spec.ts: public sign-up is disabled, so
 * accounts are created through Better Auth's internalAdapter and promoted to
 * ADMIN via direct Prisma update BEFORE sign-in (ADMIN creation is seed-only).
 * Operator rows under test are created directly via Prisma so no invite email
 * fires from setup.
 *
 * Cleanup removes every created row in FK-safe order, each delete wrapped so a
 * partial failure never masks a real test failure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  OperatorVerificationStatus,
  PrismaClient,
  Region,
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

async function signIn(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  password: string,
  surface = 'portal',
) {
  return request(server)
    .post('/api/auth/sign-in/email')
    .set('Content-Type', 'application/json')
    .set('x-login-surface', surface)
    .send({ email, password });
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
  if (!sessionCookie) return undefined;
  return sessionCookie.split(';')[0];
}

async function createSignedInUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  prisma: PrismaClient,
  opts: { name: string; email: string; role?: Role },
): Promise<{ userId: string; cookie: string }> {
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

  const signInRes = await signIn(server, opts.email, VALID_PASSWORD, 'portal');
  if (signInRes.status !== 200) {
    throw new Error(
      `Test setup: sign-in failed for ${opts.email}: ${JSON.stringify(signInRes.body)}`,
    );
  }
  const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
  if (!cookie) {
    throw new Error(`Test setup: no session cookie returned for ${opts.email}`);
  }
  return { userId: user.id, cookie };
}

/** Creates a bare (no seat) user + PENDING operator row directly via Prisma. */
async function createPendingOperator(
  prisma: PrismaClient,
  name: string,
): Promise<{ operatorId: string; userId: string }> {
  const authCtx = await auth.$context;
  const user = await authCtx.internalAdapter.createUser({
    email: uniqueEmail('e2e-target-op'),
    name,
    role: Role.TOUR_OPERATOR,
    emailVerified: true,
  });
  const operator = await prisma.operator.create({
    data: {
      userId: user.id,
      verificationStatus: OperatorVerificationStatus.PENDING,
    },
    select: { id: true },
  });
  return { operatorId: operator.id, userId: user.id };
}

describe('Operators verification (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  let adminUserId: string;
  let adminCookie: string;
  let operatorBUserId: string;
  let operatorBCookie: string;

  // The two operators the decisions act on + operator B's own row.
  let approveTarget: { operatorId: string; userId: string };
  let rejectTarget: { operatorId: string; userId: string };
  let operatorBOperatorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    const admin = await createSignedInUser(server, prisma, {
      name: 'E2E Verification Admin',
      email: uniqueEmail('e2e-verif-admin'),
      role: Role.ADMIN,
    });
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    // A signed-in NON-admin (plain TOUR_OPERATOR) with their own operator row.
    const operatorB = await createSignedInUser(server, prisma, {
      name: 'E2E Verification Operator B',
      email: uniqueEmail('e2e-verif-opb'),
    });
    operatorBUserId = operatorB.userId;
    operatorBCookie = operatorB.cookie;
    const opBRow = await prisma.operator.create({
      data: {
        userId: operatorBUserId,
        verificationStatus: OperatorVerificationStatus.PENDING,
      },
      select: { id: true },
    });
    operatorBOperatorId = opBRow.id;

    approveTarget = await createPendingOperator(prisma, 'E2E Approve Target');
    rejectTarget = await createPendingOperator(prisma, 'E2E Reject Target');
  });

  afterAll(async () => {
    const authCtx = await auth.$context;
    const operatorIds = [
      approveTarget?.operatorId,
      rejectTarget?.operatorId,
      operatorBOperatorId,
    ].filter(Boolean);
    for (const id of operatorIds) {
      try {
        await prisma.operator.delete({ where: { id } });
      } catch {
        /* already gone */
      }
    }
    const userIds = [
      approveTarget?.userId,
      rejectTarget?.userId,
      operatorBUserId,
      adminUserId,
    ].filter(Boolean);
    for (const id of userIds) {
      try {
        await authCtx.internalAdapter.deleteUser(id);
      } catch {
        /* already gone */
      }
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it('rejects an unauthenticated decision (401)', async () => {
    const res = await request(server)
      .post(`${API}/operators/${approveTarget.operatorId}/verification`)
      .send({ decision: 'VERIFIED' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin decision (403) and leaves the row PENDING', async () => {
    const res = await request(server)
      .post(`${API}/operators/${approveTarget.operatorId}/verification`)
      .set('Cookie', operatorBCookie)
      .send({ decision: 'VERIFIED' });
    expect(res.status).toBe(403);

    const row = await prisma.operator.findUnique({
      where: { id: approveTarget.operatorId },
      select: { verificationStatus: true, verificationDecidedAt: true },
    });
    expect(row?.verificationStatus).toBe(OperatorVerificationStatus.PENDING);
    expect(row?.verificationDecidedAt).toBeNull();
  });

  // ── DTO validation ───────────────────────────────────────────────────────

  it('rejects a decision outside VERIFIED|REJECTED (400)', async () => {
    for (const decision of ['PENDING', 'UNVERIFIED', 'approved', '']) {
      const res = await request(server)
        .post(`${API}/operators/${approveTarget.operatorId}/verification`)
        .set('Cookie', adminCookie)
        .send({ decision });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a PATCH that still carries verificationStatus (400, forbidNonWhitelisted)', async () => {
    const res = await request(server)
      .patch(`${API}/operators/${approveTarget.operatorId}`)
      .set('Cookie', adminCookie)
      .send({ verificationStatus: 'VERIFIED' });
    expect(res.status).toBe(400);

    // The blanket write is closed: the row did not move.
    const row = await prisma.operator.findUnique({
      where: { id: approveTarget.operatorId },
      select: { verificationStatus: true },
    });
    expect(row?.verificationStatus).toBe(OperatorVerificationStatus.PENDING);
  });

  // ── The decision itself ──────────────────────────────────────────────────

  it('approves a PENDING operator: VERIFIED + verificationDecidedAt stamped', async () => {
    const res = await request(server)
      .post(`${API}/operators/${approveTarget.operatorId}/verification`)
      .set('Cookie', adminCookie)
      .send({ decision: 'VERIFIED' });

    expect(res.status).toBe(201);
    expect(res.body.verificationStatus).toBe('VERIFIED');
    expect(res.body.verificationDecidedAt).toBeTruthy();

    const row = await prisma.operator.findUnique({
      where: { id: approveTarget.operatorId },
      select: { verificationStatus: true, verificationDecidedAt: true },
    });
    expect(row?.verificationStatus).toBe(OperatorVerificationStatus.VERIFIED);
    expect(row?.verificationDecidedAt).toBeInstanceOf(Date);
  });

  it('409s a double-decide (VERIFIED is terminal) and names the current status', async () => {
    const res = await request(server)
      .post(`${API}/operators/${approveTarget.operatorId}/verification`)
      .set('Cookie', adminCookie)
      .send({ decision: 'REJECTED' });

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('VERIFIED');

    // The losing decision must not have moved the row.
    const row = await prisma.operator.findUnique({
      where: { id: approveTarget.operatorId },
      select: { verificationStatus: true },
    });
    expect(row?.verificationStatus).toBe(OperatorVerificationStatus.VERIFIED);
  });

  it('rejects a PENDING operator: REJECTED + verificationDecidedAt stamped', async () => {
    const res = await request(server)
      .post(`${API}/operators/${rejectTarget.operatorId}/verification`)
      .set('Cookie', adminCookie)
      .send({ decision: 'REJECTED' });

    expect(res.status).toBe(201);
    expect(res.body.verificationStatus).toBe('REJECTED');
    expect(res.body.verificationDecidedAt).toBeTruthy();
  });

  it('404s for an unknown operator id', async () => {
    const res = await request(server)
      .post(
        `${API}/operators/00000000-0000-4000-8000-000000000000/verification`,
      )
      .set('Cookie', adminCookie)
      .send({ decision: 'VERIFIED' });
    expect(res.status).toBe(404);
  });

  // ── List API for the dashboard queue/pipeline (C-21/C-22) ────────────────

  it('filters the list by verificationStatus and exposes the WP-C fields', async () => {
    const res = await request(server)
      .get(`${API}/operators?verificationStatus=PENDING&limit=100`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const rows: Array<Record<string, unknown>> = res.body.data;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.verificationStatus).toBe('PENDING');
      expect(typeof row.toursSubmitted).toBe('number');
      expect(row).toHaveProperty('firstTourLiveAt');
      expect(row).toHaveProperty('verificationDecidedAt');
    }
    // Operator B is still PENDING and must be in the queue.
    expect(rows.map((r) => r.id)).toContain(operatorBOperatorId);
  });

  it('rejects an invalid verificationStatus filter (400)', async () => {
    const res = await request(server)
      .get(`${API}/operators?verificationStatus=NOT_A_STATUS`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(400);
  });

  it('derives toursSubmitted from submitted tours only (drafts excluded)', async () => {
    // One submitted + one draft tour for operator B: the count must be 1.
    // Guards the where({ submittedAt: { not: null } }) filter behind the
    // dashboard's "0 tours" facet - a regression here makes that facet lie.
    const suffix = Date.now().toString(36);
    const destination = await prisma.destination.create({
      data: {
        name: `E2E Verif Dest ${suffix}`,
        slug: `e2e-verif-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
      select: { id: true },
    });
    const tourBase = {
      destinationId: destination.id,
      operatorId: operatorBOperatorId,
      timeZone: 'America/Curacao',
    };
    const submitted = await prisma.tour.create({
      data: {
        ...tourBase,
        name: `E2E Verif Submitted ${suffix}`,
        slug: `e2e-verif-submitted-${suffix}`,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    const draft = await prisma.tour.create({
      data: {
        ...tourBase,
        name: `E2E Verif Draft ${suffix}`,
        slug: `e2e-verif-draft-${suffix}`,
      },
      select: { id: true },
    });

    try {
      const res = await request(server)
        .get(`${API}/operators?verificationStatus=PENDING&limit=100`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find(
        (r) => r.id === operatorBOperatorId,
      );
      expect(row).toBeDefined();
      expect(row?.toursSubmitted).toBe(1);
    } finally {
      await prisma.tour.deleteMany({
        where: { id: { in: [submitted.id, draft.id] } },
      });
      await prisma.destination.delete({ where: { id: destination.id } });
    }
  });
});
