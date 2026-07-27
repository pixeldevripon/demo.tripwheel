/**
 * Reviews E2E Test Suite
 *
 * Boots the real NestJS app (mirroring main.ts) and drives every request through
 * Supertest, following the provisioning pattern established in
 * `test/tours.e2e-spec.ts` - read its file-level comment for why public sign-up
 * cannot be used and ADMIN accounts must be promoted after creation.
 *
 * These cases are deliberately the ones that unit tests CANNOT prove, because
 * they are about wiring rather than logic: that the guard actually runs, that
 * the DTO actually rejects, and that the status code a client sees is the one
 * intended. A booking gate that returns 500 instead of 403 is still "blocked",
 * and only an e2e run can tell the difference.
 *
 * Coverage:
 *   Booking gate  - not the owner (403), wrong status (400), tour not yet
 *                   finished in the SNAPSHOTTED timezone (400), duplicate (409).
 *   Token         - valid -> spent -> dead, and a revoked token is
 *                   indistinguishable from an unknown one (both 404).
 *   RBAC          - an operator cannot delete, moderate or respond to any
 *                   review, and cannot read another operator's queue.
 *   Aggregates    - only APPROVED + source NATIVE reach a tour aggregate.
 *   Bulk moderate - transitions many, each with its own audit row.
 *
 * Cleanup: every created row is removed in `afterAll` in FK-safe order, each
 * wrapped in try/catch so a partial failure never masks a real test failure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BookingStatus,
  Currency,
  PaymentModel,
  PrismaClient,
  Region,
  ReviewModerationStatus,
  ReviewSource,
  Role,
  TourStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { auth } from './../src/auth/auth.instance';

const API = '/api/v1';
const VALID_PASSWORD = 'TestPass@1234!';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function uniqueEmail(prefix = 'rev'): string {
  return `${prefix}+${uniqueSuffix()}@example-e2e.com`;
}

function extractSessionCookie(
  setCookieHeader: string | string[] | undefined,
): string | undefined {
  if (!setCookieHeader) return undefined;
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  return cookies
    .find((c) => c.includes('better-auth.session_token'))
    ?.split(';')[0];
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

  // Sign-in requires the x-login-surface header (per-door enforcement in
  // auth.instance.ts). USER-role accounts belong at 'account'; everyone else
  // this suite creates passes 'portal' (ADMIN is allowed at every door).
  const signInRes = await request(server)
    .post('/api/auth/sign-in/email')
    .set('Content-Type', 'application/json')
    .set('x-login-surface', opts.role === Role.USER ? 'account' : 'portal')
    .send({ email: opts.email, password: VALID_PASSWORD });
  if (signInRes.status !== 200) {
    throw new Error(
      `Test setup: sign-in failed for ${opts.email}: ${JSON.stringify(signInRes.body)}`,
    );
  }
  const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
  if (!cookie) throw new Error(`Test setup: no cookie for ${opts.email}`);
  return { userId: user.id, cookie };
}

/** `YYYY-MM-DD` UTC-midnight Date, matching the `@db.Date` storage form. */
function dateOnly(daysFromNow: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return new Date(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}T00:00:00.000Z`,
  );
}

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  const suffix = uniqueSuffix();
  let destinationId: string;
  let tourId: string;
  let otherTourId: string;
  let operatorId: string;
  let otherOperatorId: string;

  let adminUserId: string;
  let adminCookie: string;
  let travelerUserId: string;
  let travelerCookie: string;
  let operatorUserId: string;
  let operatorCookie: string;

  const bookingIds: string[] = [];
  const reviewIds: string[] = [];

  /** A booking that satisfies every review gate unless told otherwise. */
  async function makeBooking(over: Record<string, any> = {}) {
    const b = await prisma.booking.create({
      data: {
        tourId,
        operatorId,
        userId: travelerUserId,
        displayRef: `IT-E2E-${uniqueSuffix()}`,
        status: BookingStatus.REDEEMED,
        paymentModel: PaymentModel.OPERATOR_LINK,
        currency: Currency.USD,
        localDate: dateOnly(-3),
        startTime: '09:00',
        tourStartDateTime: new Date(dateOnly(-3).getTime() + 9 * 3600e3),
        tourEndDateTime: new Date(dateOnly(-3).getTime() + 17 * 3600e3),
        tourTimeZone: 'America/Curacao',
        totalRetail: '100.00',
        depositAmount: '20.00',
        balanceAmount: '80.00',
        contactEmail: 'traveler@example-e2e.com',
        contactFirstName: 'Ada',
        contactLastName: 'Byron',
        contactCountry: 'NL',
        ...over,
      },
    });
    bookingIds.push(b.id);
    return b;
  }

  /**
   * A review written straight to the DB, bypassing the create gate so a test can
   * start from an arbitrary moderation state. Still needs its own booking:
   * `Review.bookingId` is a REQUIRED relation, which is the booking gate
   * expressed in the schema rather than in a service - there is no such thing as
   * a review without a booking, even one inserted directly.
   */
  async function makeReview(over: Record<string, any> = {}) {
    const b = await makeBooking(
      over.tourId
        ? {
            tourId: over.tourId,
            // Fall back rather than forwarding `undefined`: a test can move a
            // review to another TOUR without also moving it to another operator.
            operatorId: over.operatorId ?? operatorId,
          }
        : {},
    );
    const r = await prisma.review.create({
      data: {
        bookingId: b.id,
        tourId,
        operatorId,
        userId: travelerUserId,
        rating: 5,
        isVerified: true,
        moderationStatus: ReviewModerationStatus.PENDING,
        source: ReviewSource.NATIVE,
        ...over,
      },
    });
    reviewIds.push(r.id);
    return r;
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

    const destination = await prisma.destination.create({
      data: {
        name: `E2E Reviews Dest ${suffix}`,
        slug: `e2e-reviews-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
    });
    destinationId = destination.id;

    const admin = await createSignedInUser(server, prisma, {
      name: 'E2E Review Admin',
      email: uniqueEmail('admin'),
      role: Role.ADMIN,
    });
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    const traveler = await createSignedInUser(server, prisma, {
      name: 'E2E Traveler',
      email: uniqueEmail('traveler'),
      role: Role.USER,
    });
    travelerUserId = traveler.userId;
    travelerCookie = traveler.cookie;

    const operator = await createSignedInUser(server, prisma, {
      name: 'E2E Operator',
      email: uniqueEmail('operator'),
      role: Role.TOUR_OPERATOR,
    });
    operatorUserId = operator.userId;
    operatorCookie = operator.cookie;

    // `userId` is the only required column - everything else defaults.
    const op = await prisma.operator.create({
      data: { userId: operatorUserId },
    });
    operatorId = op.id;

    const otherOp = await prisma.operator.create({
      data: { userId: adminUserId },
    });
    otherOperatorId = otherOp.id;

    const tour = await prisma.tour.create({
      data: {
        name: `E2E Reviews Tour ${suffix}`,
        slug: `e2e-reviews-tour-${suffix}`,
        destinationId,
        operatorId,
        status: TourStatus.LIVE,
        timeZone: 'America/Curacao',
      },
    });
    tourId = tour.id;

    const otherTour = await prisma.tour.create({
      data: {
        name: `E2E Other Tour ${suffix}`,
        slug: `e2e-other-tour-${suffix}`,
        destinationId,
        operatorId: otherOperatorId,
        status: TourStatus.LIVE,
        timeZone: 'America/Curacao',
      },
    });
    otherTourId = otherTour.id;
  }, 60_000);

  afterAll(async () => {
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* a partial cleanup failure must not mask a real test failure */
      }
    };
    await safe(() =>
      prisma.reviewModerationLog.deleteMany({
        where: { reviewId: { in: reviewIds } },
      }),
    );
    await safe(() =>
      prisma.reviewInvitation.deleteMany({
        where: { bookingId: { in: bookingIds } },
      }),
    );
    await safe(() => prisma.review.deleteMany({ where: { tourId } }));
    await safe(() =>
      prisma.review.deleteMany({ where: { tourId: otherTourId } }),
    );
    await safe(() =>
      prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.tour.deleteMany({ where: { id: { in: [tourId, otherTourId] } } }),
    );
    await safe(() =>
      prisma.operator.deleteMany({
        where: { id: { in: [operatorId, otherOperatorId] } },
      }),
    );
    await safe(() =>
      prisma.user.deleteMany({
        where: { id: { in: [adminUserId, travelerUserId, operatorUserId] } },
      }),
    );
    await safe(() =>
      prisma.destination.delete({ where: { id: destinationId } }),
    );
    await safe(() => prisma.$disconnect());
    await app.close();
  }, 60_000);

  // ── 1-4. The booking gate ────────────────────────────────────────────────

  describe('booking gate', () => {
    it('403 when the booking belongs to someone else', async () => {
      const b = await makeBooking({ userId: operatorUserId });

      const res = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({
          bookingId: b.id,
          rating: 5,
          comment: 'Lovely day out on the water.',
        });

      expect(res.status).toBe(403);
    });

    it('400 when the booking is not in a completed state', async () => {
      const b = await makeBooking({ status: BookingStatus.ON_HOLD });

      const res = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({
          bookingId: b.id,
          rating: 5,
          comment: 'Lovely day out on the water.',
        });

      expect(res.status).toBe(400);
    });

    it('400 before the tour has finished in the SNAPSHOTTED timezone', async () => {
      const future = dateOnly(3);
      const b = await makeBooking({
        localDate: future,
        tourStartDateTime: new Date(future.getTime() + 9 * 3600e3),
        tourEndDateTime: new Date(future.getTime() + 17 * 3600e3),
      });

      const res = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({
          bookingId: b.id,
          rating: 5,
          comment: 'Lovely day out on the water.',
        });

      expect(res.status).toBe(400);
    });

    it('409 on a second review for the same booking', async () => {
      const b = await makeBooking();

      const first = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({
          bookingId: b.id,
          rating: 5,
          comment: 'Lovely day out on the water.',
        });
      expect(first.status).toBe(201);
      reviewIds.push(first.body.id);

      const second = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({
          bookingId: b.id,
          rating: 4,
          comment: 'Trying to review this twice.',
        });

      expect(second.status).toBe(409);
    });

    it('a created review is PENDING and NATIVE, never auto-published', async () => {
      const b = await makeBooking();
      const res = await request(server)
        .post(`${API}/reviews`)
        .set('Cookie', travelerCookie)
        .send({ bookingId: b.id, rating: 5, comment: 'Great crew.' });

      expect(res.status).toBe(201);
      reviewIds.push(res.body.id);
      expect(res.body.moderationStatus).toBe(ReviewModerationStatus.PENDING);
      expect(res.body.source).toBe(ReviewSource.NATIVE);
      expect(res.body.isVerified).toBe(true);
    });

    it('401 when unauthenticated', async () => {
      const b = await makeBooking();
      const res = await request(server).post(`${API}/reviews`).send({
        bookingId: b.id,
        rating: 5,
        comment: 'Lovely day out on the water.',
      });
      expect(res.status).toBe(401);
    });
  });

  // ── 5. Token lifecycle ───────────────────────────────────────────────────

  describe('invitation token lifecycle', () => {
    it('valid -> spent -> dead', async () => {
      const b = await makeBooking();
      const inv = await prisma.reviewInvitation.create({
        data: { bookingId: b.id },
      });

      // Valid: resolvable, and deliberately narrow - no price, no contact data.
      const before = await request(server).get(
        `${API}/reviews/invitation/${inv.token}`,
      );
      expect(before.status).toBe(200);
      expect(before.body.alreadyReviewed).toBe(false);
      expect(before.body).not.toHaveProperty('totalRetail');
      expect(before.body).not.toHaveProperty('contactEmail');

      // Spend it.
      const start = await request(server)
        .post(`${API}/reviews/invitation/${inv.token}`)
        .send({ rating: 5 });
      expect(start.status).toBe(201);
      reviewIds.push(start.body.reviewId);

      // Dead: a second start cannot create a second review.
      const again = await request(server)
        .post(`${API}/reviews/invitation/${inv.token}`)
        .send({ rating: 1 });
      expect(again.status).toBe(404);
    });

    it('an unknown token and a revoked one are indistinguishable (both 404)', async () => {
      const b = await makeBooking();
      const inv = await prisma.reviewInvitation.create({
        data: { bookingId: b.id },
      });
      await prisma.reviewInvitation.update({
        where: { id: inv.id },
        data: { revokedAt: new Date(), suppressedReason: 'e2e' },
      });

      const revoked = await request(server).get(
        `${API}/reviews/invitation/${inv.token}`,
      );
      const unknown = await request(server).get(
        `${API}/reviews/invitation/definitely-not-a-real-token`,
      );

      // Same status for both: distinguishing them would let anyone probe which
      // tokens ever existed.
      expect(revoked.status).toBe(404);
      expect(unknown.status).toBe(404);
    });

    it('needs no session - the token IS the credential', async () => {
      const b = await makeBooking();
      const inv = await prisma.reviewInvitation.create({
        data: { bookingId: b.id },
      });
      const res = await request(server).get(
        `${API}/reviews/invitation/${inv.token}`,
      );
      expect(res.status).toBe(200);
    });
  });

  // ── 6-7. Operator RBAC ───────────────────────────────────────────────────

  describe('operator permissions', () => {
    it('an operator cannot delete a review', async () => {
      const r = await makeReview({
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      const res = await request(server)
        .delete(`${API}/reviews/${r.id}`)
        .set('Cookie', operatorCookie)
        .send({ reason: 'I do not like it.' });

      expect([401, 403]).toContain(res.status);
      // Still there.
      expect(
        await prisma.review.findUnique({ where: { id: r.id } }),
      ).not.toBeNull();
    });

    it('an operator cannot moderate (unpublish) a review', async () => {
      const r = await makeReview({
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      const res = await request(server)
        .patch(`${API}/reviews/${r.id}/moderate`)
        .set('Cookie', operatorCookie)
        .send({
          status: ReviewModerationStatus.REJECTED,
          rejectionReason: 'No.',
        });

      expect([401, 403]).toContain(res.status);
      const after = await prisma.review.findUnique({ where: { id: r.id } });
      expect(after?.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
    });

    it('an operator cannot author a response at launch (LD37)', async () => {
      const r = await makeReview({
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      const res = await request(server)
        .post(`${API}/reviews/${r.id}/response`)
        .set('Cookie', operatorCookie)
        .send({ responseText: 'Thanks so much for the kind review!' });

      expect([401, 403]).toContain(res.status);
    });

    it("an operator cannot read another operator's reviews", async () => {
      // A review that belongs to a DIFFERENT operator.
      const foreign = await makeReview({
        tourId: otherTourId,
        operatorId: otherOperatorId,
        rating: 2,
      });

      const res = await request(server)
        .get(`${API}/reviews/admin`)
        .query({ operatorId: otherOperatorId })
        .set('Cookie', operatorCookie);

      if (res.status === 200) {
        // If the route is readable at all, the scope must still exclude the
        // other operator's rows - passing `operatorId` must not widen it.
        const ids = (res.body.data ?? []).map((x: any) => x.id);
        expect(ids).not.toContain(foreign.id);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    });
  });

  // ── 8. Aggregate hygiene ─────────────────────────────────────────────────

  describe('aggregates', () => {
    /**
     * Its own tour. The RBAC block above leaves APPROVED reviews on the shared
     * `tourId`, and an aggregate assertion that counts them is measuring test
     * order rather than the filter it claims to test.
     */
    let aggTourId: string;

    beforeAll(async () => {
      const t = await prisma.tour.create({
        data: {
          name: `E2E Agg Tour ${suffix}`,
          slug: `e2e-agg-tour-${suffix}`,
          destinationId,
          operatorId,
          status: TourStatus.LIVE,
          timeZone: 'America/Curacao',
        },
      });
      aggTourId = t.id;
    });

    afterAll(async () => {
      try {
        await prisma.review.deleteMany({ where: { tourId: aggTourId } });
        await prisma.tour.delete({ where: { id: aggTourId } });
      } catch {
        /* cleanup only */
      }
    });

    it('only APPROVED + NATIVE reviews reach the tour aggregate', async () => {
      // One of each state that must NOT count, plus two that must.
      await makeReview({
        tourId: aggTourId,
        rating: 5,
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      await makeReview({
        tourId: aggTourId,
        rating: 5,
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      await makeReview({
        tourId: aggTourId,
        rating: 1,
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      await makeReview({
        tourId: aggTourId,
        rating: 1,
        moderationStatus: ReviewModerationStatus.HELD,
      });
      await makeReview({
        tourId: aggTourId,
        rating: 1,
        moderationStatus: ReviewModerationStatus.REJECTED,
      });
      // Approved but IMPORTED - a syndicated review must never enter a
      // verified-booking aggregate.
      await makeReview({
        tourId: aggTourId,
        rating: 1,
        moderationStatus: ReviewModerationStatus.APPROVED,
        source: ReviewSource.IMPORTED_THIRD_PARTY,
      });

      // Force a recompute through the real moderation path.
      const trigger = await makeReview({
        tourId: aggTourId,
        rating: 5,
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      const mod = await request(server)
        .patch(`${API}/reviews/${trigger.id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ status: ReviewModerationStatus.APPROVED });
      expect(mod.status).toBe(200);

      const summary = await request(server)
        .get(`${API}/reviews/summary`)
        .query({ tourId: aggTourId });
      expect(summary.status).toBe(200);
      // 3 approved NATIVE 5-star reviews. Every 1-star above is excluded, so a
      // leak would drag this below 5.0 and show up here immediately.
      expect(summary.body.approvedCount).toBe(3);
      expect(summary.body.rating).toBe(5);

      const tour = await prisma.tour.findUnique({ where: { id: aggTourId } });
      expect(tour?.aggregateReviewCount).toBe(3);
      expect(Number(tour?.aggregateRating)).toBe(5);
    });

    /**
     * The single most important compliance assertion in the module: we publish
     * criticism. The seeded dataset contains no rating below 3, so a passing
     * suite could otherwise mean "we never tested a bad review" rather than
     * "bad reviews are published".
     */
    it('publishes a 1-star review, in full, alongside the rest', async () => {
      const harsh = await makeReview({
        tourId: aggTourId,
        rating: 1,
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      await prisma.reviewTranslation.create({
        data: {
          reviewId: harsh.id,
          locale: 'en',
          comment:
            'Badly organised, the guide was late and the boat was filthy. Would not book again.',
        },
      });

      const mod = await request(server)
        .patch(`${API}/reviews/${harsh.id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ status: ReviewModerationStatus.APPROVED });
      expect(mod.status).toBe(200);

      const list = await request(server)
        .get(`${API}/reviews`)
        .query({ tourId: aggTourId, limit: 50 });

      const found = list.body.data.find((r: any) => r.id === harsh.id);
      expect(found).toBeDefined();
      expect(found.rating).toBe(1);
      // Published in full - not truncated, not summarised, not softened.
      expect(found.comment).toContain('the boat was filthy');
    });

    it('the public list returns approved NATIVE reviews only', async () => {
      const res = await request(server)
        .get(`${API}/reviews`)
        .query({ tourId: aggTourId, limit: 50 });

      expect(res.status).toBe(200);
      for (const r of res.body.data) {
        expect(r.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
        expect(r.source).toBe(ReviewSource.NATIVE);
      }
    });
  });

  // ── 9. Bulk moderate ─────────────────────────────────────────────────────

  describe('bulk moderate', () => {
    it('transitions many and writes one audit row each', async () => {
      const a = await makeReview();
      const b = await makeReview();

      const res = await request(server)
        .patch(`${API}/reviews/bulk-moderate`)
        .set('Cookie', adminCookie)
        .send({ ids: [a.id, b.id], status: ReviewModerationStatus.APPROVED });

      expect(res.status).toBe(200);

      const after = await prisma.review.findMany({
        where: { id: { in: [a.id, b.id] } },
        select: { moderationStatus: true },
      });
      expect(after.every((r) => r.moderationStatus === 'APPROVED')).toBe(true);

      // Per-review audit rows, not one blanket updateMany - each carries its own
      // fromStatus, and that is the whole reason bulk is a loop.
      for (const id of [a.id, b.id]) {
        const logs = await prisma.reviewModerationLog.findMany({
          where: { reviewId: id },
        });
        expect(logs.length).toBeGreaterThanOrEqual(1);
        expect(logs.some((l) => l.toStatus === 'APPROVED')).toBe(true);
      }
    });

    it('rejects a bulk REJECT with no documented ground', async () => {
      const a = await makeReview();
      const res = await request(server)
        .patch(`${API}/reviews/bulk-moderate`)
        .set('Cookie', adminCookie)
        .send({ ids: [a.id], status: ReviewModerationStatus.REJECTED });

      expect(res.status).toBe(400);
    });

    it('an operator cannot bulk moderate', async () => {
      const a = await makeReview();
      const res = await request(server)
        .patch(`${API}/reviews/bulk-moderate`)
        .set('Cookie', operatorCookie)
        .send({ ids: [a.id], status: ReviewModerationStatus.APPROVED });

      expect([401, 403]).toContain(res.status);
    });
  });
});
