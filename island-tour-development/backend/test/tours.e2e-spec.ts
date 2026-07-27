/**
 * Tours E2E Test Suite
 *
 * Boots the real NestJS app (mirrors main.ts: global prefix 'api/v1' excluding
 * 'api/auth/*path', AllExceptionsFilter, ValidationPipe with
 * whitelist/forbidNonWhitelisted/transform, enableShutdownHooks) and drives every
 * request through Supertest against the in-memory HTTP server, exactly like
 * `test/auth.e2e-spec.ts`.
 *
 * ── Auth note (read before touching this file) ────────────────────────────────
 * `src/auth/auth.instance.ts` currently sets `emailAndPassword.disableSignUp: true`
 * ("Public self-registration is disabled. Operator accounts are created by an
 * admin ... There is no sign-up endpoint"). `POST /api/auth/sign-up/email` is
 * therefore NOT usable to provision test users (unlike the older pattern in
 * `auth.e2e-spec.ts`, which predates this change and is stale on that point).
 *
 * Instead this file reproduces exactly what `OperatorsService.create()` does to
 * provision a real, sign-in-able account: use Better Auth's `internalAdapter` to
 * create the `User` row and link a `credential` `Account` row with a real password
 * hash (`auth.$context` → `.password.hash()` / `.internalAdapter.createUser()` /
 * `.internalAdapter.linkAccount()`), then call the real, still-enabled
 * `POST /api/auth/sign-in/email` endpoint to obtain a genuine, signed session
 * cookie via `set-cookie` (see `signIn` / `extractSessionCookie`, copied from
 * `auth.e2e-spec.ts`). ADMIN accounts cannot be created via Better Auth at all
 * (`databaseHooks.user.create.before` throws on `role: 'ADMIN'` - seed-only, per
 * master rule). So admin test users are created as TOUR_OPERATOR first, then
 * promoted with a direct Prisma `user.update` BEFORE signing in.
 *
 * Coverage:
 *   BUG #1 regression - `POST .../age-bands` requires `bandType` (400 without it);
 *     accepts it with a default PARTICIPANT participation; a SPECTATOR band
 *     round-trips through GET.
 *   BUG #2 regression - hub/category mismatch error names the hub (never a raw
 *     UUID) and explains the category conflict; the matching-category happy path
 *     attaches cleanly.
 *   BUG #3 regression - `isBookable` listing gate: a freshly published tour with
 *     no departures is LIVE but NOT bookable and is excluded from `GET /tours`;
 *     adding a real OPEN departure and recomputing (via pause/unpause, which both
 *     call `AvailabilityService.computeIsBookable`) flips it bookable and visible.
 *   Publish guard - publishing a tour with no images/highlights/overview/price
 *     returns 400 with all four readiness errors.
 *   Create/read/update - DRAFT defaults (tierKey=standard, commissionTier=20),
 *     GET by id, PATCH persistence, the mandatory TOUR slug_registry row, and
 *     slug-based public lookup once LIVE.
 *   Child CRUD smoke - highlights, inclusions, a feature + non-en translation
 *     upsert, and an image with width/height.
 *   RBAC - unauthenticated POST /tours -> 401; a second operator (no ownership)
 *     acting on another operator's tour -> 403.
 *   Lifecycle - publish -> pause -> unpause -> archive -> restore (-> DRAFT, not
 *     LIVE - `restore()` intentionally sends a tour back to DRAFT).
 *
 * Cleanup: every created Tour/Hub/Category/Destination/User/Operator row is
 * removed in `afterAll`, in FK-safe order (Tours before Hub/Category/Destination;
 * Operator before User), each wrapped in try/catch so a partial failure never
 * masks a real test failure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  DepartureStatus,
  HubStatus,
  PrismaClient,
  Region,
  Role,
  SlugEntityType,
  TourStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { auth } from './../src/auth/auth.instance';

// ── Constants ────────────────────────────────────────────────────────────────

const API = '/api/v1';

/** Minimum-length password that satisfies Better Auth's minPasswordLength: 12 */
const VALID_PASSWORD = 'TestPass@1234!';

// ── Helpers (auth) ───────────────────────────────────────────────────────────
// `signIn` / `extractSessionCookie` copied verbatim from `test/auth.e2e-spec.ts`.

function uniqueEmail(prefix = 'test'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example-e2e.com`;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signIn(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  password: string,
  surface = 'portal',
) {
  // Sign-in requires the x-login-surface header (per-door enforcement in
  // auth.instance.ts). USER-role accounts belong at 'account'; everyone the
  // suites create passes 'portal' (ADMIN is allowed at every door).
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

/**
 * Provisions a real, sign-in-able user account (public sign-up is disabled - see
 * the file-level comment) and returns a genuine session cookie obtained through
 * the real `POST /api/auth/sign-in/email` endpoint.
 */
async function createSignedInUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  prisma: PrismaClient,
  opts: { name: string; email: string; role?: Role },
): Promise<{ userId: string; cookie: string }> {
  const authCtx = await auth.$context;
  const hashedPassword = await authCtx.password.hash(VALID_PASSWORD);

  // The `databaseHooks.user.create.before` guard in auth.instance.ts rejects
  // `role: 'ADMIN'` at creation time (ADMIN is seed-only). Create as
  // TOUR_OPERATOR (the allowed default) and promote via a direct Prisma update
  // BEFORE signing in, so the session that gets minted already reflects the
  // final role.
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

  const signInRes = await signIn(
    server,
    opts.email,
    VALID_PASSWORD,
    opts.role === Role.USER ? 'account' : 'portal',
  );
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

// ── Helpers (availability - direct Prisma, no HTTP round-trip) ───────────────

/** `YYYY-MM-DD` UTC-midnight `Date`, N days from now - matches the `@db.Date` storage form. */
function futureDateOnly(daysFromNow: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${day}T00:00:00.000Z`);
}

/** Epoch-day, `Z`-labelled time-of-day - matches the `@db.Time(0)` storage form. */
function timeOnly(hour: number, minute: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Tours (e2e)', () => {
  let app: INestApplication<App>;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  let destination: { id: string; slug: string; name: string };
  let category1: { id: string; name: string; slug: string };
  let category2: { id: string; name: string; slug: string };
  let hub: { id: string; name: string; slug: string };

  let adminUserId: string;
  let adminCookie: string;
  let operatorBUserId: string;
  let operatorBCookie: string;

  /**
   * Creates a tour (as admin) that satisfies every `publish()` readiness rule:
   * >=5 images (first is hero), >=3 highlights, an EN overview, and a price
   * (`basePrice`). Returns the created tour id.
   */
  async function createPublishReadyTour(
    categoryIds: string[],
    nameSuffix: string,
  ): Promise<string> {
    const createRes = await request(server)
      .post(`${API}/tours`)
      .set('Cookie', adminCookie)
      .send({
        name: `E2E Publish Ready Tour ${nameSuffix}`,
        destinationId: destination.id,
        categoryIds,
        basePrice: '75.00',
      });
    expect(createRes.status).toBe(201);
    const tourId: string = createRes.body.id;

    for (let i = 0; i < 5; i++) {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/images`)
        .set('Cookie', adminCookie)
        .send({
          url: `https://example.com/e2e-image-${nameSuffix}-${i}.jpg`,
          width: 1200,
          height: 800,
          isHero: i === 0,
        });
      expect(res.status).toBe(201);
    }

    for (let i = 0; i < 3; i++) {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/highlights`)
        .set('Cookie', adminCookie)
        .send({ text: `E2E highlight number ${i} for a wonderful tour` });
      expect(res.status).toBe(201);
    }

    const trRes = await request(server)
      .patch(`${API}/tours/${tourId}/translations/en`)
      .set('Cookie', adminCookie)
      .send({
        overview: 'A wonderful, sun-soaked adventure awaits every guest.',
      });
    expect(trRes.status).toBe(200);

    return tourId;
  }

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

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    // ── Prerequisite fixtures (created directly - not via the app seed) ──────
    const suffix = uniqueSuffix();

    destination = await prisma.destination.create({
      data: {
        name: `E2E Tours Destination ${suffix}`,
        slug: `e2e-tours-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
    });

    category1 = await prisma.category.create({
      data: {
        name: `E2E Category A ${suffix}`,
        slug: `e2e-cat-a-${suffix}`,
        isActive: true,
      },
    });

    category2 = await prisma.category.create({
      data: {
        name: `E2E Category B ${suffix}`,
        slug: `e2e-cat-b-${suffix}`,
        isActive: true,
      },
    });

    hub = await prisma.hub.create({
      data: {
        destinationId: destination.id,
        name: `E2E Hub ${suffix}`,
        slug: `e2e-hub-${suffix}`,
        isActive: true,
        status: HubStatus.PUBLISHED,
      },
    });

    // Hub allows ONLY category1 - category2 tours must be rejected (BUG #2).
    await prisma.hubAllowedCategory.create({
      data: { hubId: hub.id, categoryId: category1.id },
    });

    // ── Users ────────────────────────────────────────────────────────────────
    // Every tour in this suite is created/owned/published by the ADMIN user
    // (ADMIN is auto-provisioned an Operator row on first tour create - master
    // rule #19). The second TOUR_OPERATOR exists solely to exercise the
    // ownership-mismatch 403 path; it needs its own real Operator row up front
    // since nothing else will auto-provision one for a non-ADMIN role.
    const admin = await createSignedInUser(server, prisma, {
      name: 'E2E Tours Admin',
      email: uniqueEmail('tours-admin'),
      role: Role.ADMIN,
    });
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    const operatorB = await createSignedInUser(server, prisma, {
      name: 'E2E Tours Operator B',
      email: uniqueEmail('tours-operator-b'),
    });
    operatorBUserId = operatorB.userId;
    operatorBCookie = operatorB.cookie;
    await prisma.operator.create({ data: { userId: operatorBUserId } });
  });

  afterAll(async () => {
    // FK-safe order: Tours (cascades all children incl. departures/schedules)
    // -> Hub (cascades HubAllowedCategory) -> Categories -> Destination ->
    // Operators -> Users (cascades Session/Account). Each step is isolated so a
    // partial failure never masks a real test failure.
    try {
      await prisma.tour.deleteMany({
        where: { destinationId: destination.id },
      });
    } catch {
      // ignore
    }
    try {
      await prisma.slugRegistry.deleteMany({
        where: { destinationSlug: destination.slug },
      });
    } catch {
      // ignore
    }
    try {
      await prisma.hub.deleteMany({ where: { id: hub.id } });
    } catch {
      // ignore
    }
    try {
      await prisma.category.deleteMany({
        where: { id: { in: [category1.id, category2.id] } },
      });
    } catch {
      // ignore
    }
    try {
      await prisma.destination.delete({ where: { id: destination.id } });
    } catch {
      // ignore
    }
    try {
      await prisma.operator.deleteMany({
        where: { userId: { in: [adminUserId, operatorBUserId] } },
      });
    } catch {
      // ignore
    }
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, operatorBUserId] } },
      });
    } catch {
      // ignore
    }

    await prisma.$disconnect();
    await app.close();
  });

  // ── BUG #1 - age band bandType is required ───────────────────────────────

  describe('BUG #1 regression - age band bandType is required', () => {
    let tourId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Age Band Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id],
        });
      expect(res.status).toBe(201);
      tourId = res.body.id;
    });

    it('rejects an age band with no bandType (400)', async () => {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/age-bands`)
        .set('Cookie', adminCookie)
        .send({ label: 'Adult', price: '79.00' });

      expect(res.status).toBe(400);
    });

    it('creates an age band with bandType, defaulting participation to PARTICIPANT', async () => {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/age-bands`)
        .set('Cookie', adminCookie)
        .send({ bandType: 'ADULT', label: 'Adult', price: '79.00' });

      expect(res.status).toBe(201);
      expect(res.body.bandType).toBe('ADULT');
      expect(res.body.participation).toBe('PARTICIPANT');
    });

    it('creates a SPECTATOR band and round-trips both bands through GET', async () => {
      const createRes = await request(server)
        .post(`${API}/tours/${tourId}/age-bands`)
        .set('Cookie', adminCookie)
        .send({
          bandType: 'CHILD',
          participation: 'SPECTATOR',
          label: 'Kid Spectator',
          price: '10.00',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.bandType).toBe('CHILD');
      expect(createRes.body.participation).toBe('SPECTATOR');

      const listRes = await request(server)
        .get(`${API}/tours/${tourId}/age-bands`)
        .set('Cookie', adminCookie);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const adultBand = listRes.body.find(
        (b: { bandType: string }) => b.bandType === 'ADULT',
      );
      const childBand = listRes.body.find(
        (b: { bandType: string }) => b.bandType === 'CHILD',
      );
      expect(adultBand?.participation).toBe('PARTICIPANT');
      expect(childBand?.participation).toBe('SPECTATOR');
    });
  });

  // ── BUG #2 - hub/category validation names the hub, never a raw UUID ────

  describe('BUG #2 regression - hub/category mismatch error names the hub', () => {
    it('rejects attaching a hub whose allowed categories do not match the tour (400)', async () => {
      const createRes = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Hub Mismatch Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category2.id], // NOT in the hub's allowed list
        });
      expect(createRes.status).toBe(201);
      const tourId: string = createRes.body.id;

      const patchRes = await request(server)
        .patch(`${API}/tours/${tourId}`)
        .set('Cookie', adminCookie)
        .send({ hubIds: [hub.id] });

      expect(patchRes.status).toBe(400);
      expect(typeof patchRes.body.message).toBe('string');
      // Must name the hub - never a raw UUID.
      expect(patchRes.body.message).toContain(hub.name);
      expect(patchRes.body.message).not.toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
      expect(patchRes.body.message).toMatch(
        /only accepts tours in these categories|don't match/i,
      );
      expect(patchRes.body.message).toMatch(/categories/i);
    });

    it('attaches a hub whose allowed categories include the tour category (happy path)', async () => {
      const createRes = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Hub Match Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id], // allowed by the hub
          hubIds: [hub.id],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.hubIds).toContain(hub.id);
    });
  });

  // ── BUG #3 - isBookable listing gate ──────────────────────────────────────

  describe('BUG #3 regression - isBookable listing gate', () => {
    it('a freshly published tour with no departures is LIVE but not bookable, and hidden from listings; adding a departure and recomputing flips both', async () => {
      const tourId = await createPublishReadyTour(
        [category1.id],
        `bookable-${uniqueSuffix()}`,
      );

      const publishRes = await request(server)
        .post(`${API}/tours/${tourId}/publish`)
        .set('Cookie', adminCookie);
      expect(publishRes.status).toBe(201);
      expect(publishRes.body.status).toBe(TourStatus.LIVE);
      expect(publishRes.body.isBookable).toBe(false);

      const listBefore = await request(server)
        .get(`${API}/tours`)
        .query({ destinationId: destination.id });
      expect(listBefore.status).toBe(200);
      expect(
        listBefore.body.data.some((t: { id: string }) => t.id === tourId),
      ).toBe(false);

      // Materialize a real bookable departure directly (10 days out - safely
      // within the 30-day BOOKABLE_HORIZON_DAYS and far past any cutoff).
      await prisma.departure.create({
        data: {
          tourId,
          date: futureDateOnly(10),
          startTime: timeOnly(10, 0),
          capacity: 10,
          bookedCount: 0,
          status: DepartureStatus.OPEN,
        },
      });

      // pause() -> unpause() both persist AvailabilityService.computeIsBookable()
      // (per the prompt's suggested recompute trigger, no materialize call needed).
      const pauseRes = await request(server)
        .post(`${API}/tours/${tourId}/pause`)
        .set('Cookie', adminCookie);
      expect(pauseRes.status).toBe(201);
      expect(pauseRes.body.status).toBe(TourStatus.PAUSED);

      const unpauseRes = await request(server)
        .post(`${API}/tours/${tourId}/unpause`)
        .set('Cookie', adminCookie);
      expect(unpauseRes.status).toBe(201);
      expect(unpauseRes.body.status).toBe(TourStatus.LIVE);
      expect(unpauseRes.body.isBookable).toBe(true);

      const listAfter = await request(server)
        .get(`${API}/tours`)
        .query({ destinationId: destination.id });
      expect(listAfter.status).toBe(200);
      expect(
        listAfter.body.data.some((t: { id: string }) => t.id === tourId),
      ).toBe(true);
    });
  });

  // ── Publish guard - readiness errors ─────────────────────────────────────

  describe('Publish guard', () => {
    it('rejects publishing a tour missing images/hero/overview/highlights/price (400, all readiness errors)', async () => {
      const createRes = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Bare Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id],
        });
      expect(createRes.status).toBe(201);
      const tourId: string = createRes.body.id;

      const publishRes = await request(server)
        .post(`${API}/tours/${tourId}/publish`)
        .set('Cookie', adminCookie);

      expect(publishRes.status).toBe(400);
      expect(Array.isArray(publishRes.body.message)).toBe(true);
      const combined = (publishRes.body.message as string[])
        .join(' | ')
        .toLowerCase();
      expect(combined).toMatch(/at least 5 images/);
      expect(combined).toMatch(/hero image/);
      expect(combined).toMatch(/english overview/);
      expect(combined).toMatch(/at least 3 highlights/);
      expect(combined).toMatch(/price is required/);
    });
  });

  // ── Create / read / update ────────────────────────────────────────────────

  describe('Create / read / update', () => {
    // Sequential-dependency chain (create -> read -> update -> slug_registry
    // check) intentionally shares one tour across `it` blocks in this describe.
    let tourId: string;

    it('creates a DRAFT tour with standard-tier defaults', async () => {
      const res = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E CRUD Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(TourStatus.DRAFT);
      expect(res.body.tierKey).toBe('standard');
      expect(Number(res.body.commissionTier)).toBe(20);
      tourId = res.body.id;
    });

    it('reads the tour by id', async () => {
      const res = await request(server)
        .get(`${API}/tours/${tourId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tourId);
    });

    it('updates a field and persists it', async () => {
      const patchRes = await request(server)
        .patch(`${API}/tours/${tourId}`)
        .set('Cookie', adminCookie)
        .send({ departureCity: 'Willemstad' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.tour.departureCity).toBe('Willemstad');

      const getRes = await request(server)
        .get(`${API}/tours/${tourId}`)
        .set('Cookie', adminCookie);
      expect(getRes.body.departureCity).toBe('Willemstad');
    });

    it('writes a TOUR slug_registry row on create', async () => {
      const row = await prisma.slugRegistry.findFirst({
        where: { entityType: SlugEntityType.TOUR, entityId: tourId },
      });

      expect(row).not.toBeNull();
      expect(row?.isActive).toBe(true);
      expect(row?.destinationSlug).toBe(destination.slug);
    });

    it('resolves the tour by slug once LIVE (findBySlug only serves LIVE tours)', async () => {
      const readyId = await createPublishReadyTour(
        [category1.id],
        `slug-${uniqueSuffix()}`,
      );
      const publishRes = await request(server)
        .post(`${API}/tours/${readyId}/publish`)
        .set('Cookie', adminCookie);
      expect(publishRes.status).toBe(201);

      const slugRes = await request(server)
        .get(`${API}/tours/slug/${publishRes.body.slug}`)
        .query({ destinationSlug: destination.slug });

      expect(slugRes.status).toBe(200);
      expect(slugRes.body.id).toBe(readyId);
    });
  });

  // ── Child CRUD smoke ──────────────────────────────────────────────────────

  describe('Child CRUD smoke', () => {
    let tourId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Children Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id],
        });
      expect(res.status).toBe(201);
      tourId = res.body.id;
    });

    it('creates and lists highlights', async () => {
      const createRes = await request(server)
        .post(`${API}/tours/${tourId}/highlights`)
        .set('Cookie', adminCookie)
        .send({ text: 'A breathtaking sunset over the water' });
      expect(createRes.status).toBe(201);

      const listRes = await request(server)
        .get(`${API}/tours/${tourId}/highlights`)
        .set('Cookie', adminCookie);
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    });

    it('creates an inclusion', async () => {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/inclusions`)
        .set('Cookie', adminCookie)
        .send({ label: 'Open bar', icon: 'drink' });

      expect(res.status).toBe(201);
      expect(res.body.icon).toBe('drink');
    });

    it('creates a feature (ADDITIONAL_INFORMATION) and upserts a non-en translation', async () => {
      const createRes = await request(server)
        .post(`${API}/tours/${tourId}/features`)
        .set('Cookie', adminCookie)
        .send({
          type: 'ADDITIONAL_INFORMATION',
          text: 'Please bring your voucher and a valid ID.',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.type).toBe('ADDITIONAL_INFORMATION');
      const featureId: string = createRes.body.id;

      const trRes = await request(server)
        .patch(`${API}/tours/${tourId}/features/${featureId}/translations/nl`)
        .set('Cookie', adminCookie)
        .send({
          text: 'Breng uw voucher en een geldig identiteitsbewijs mee.',
        });

      expect(trRes.status).toBe(200);
      expect(trRes.body.locale).toBe('nl');
      expect(trRes.body.text).toBe(
        'Breng uw voucher en een geldig identiteitsbewijs mee.',
      );
    });

    it('adds an image with width and height', async () => {
      const res = await request(server)
        .post(`${API}/tours/${tourId}/images`)
        .set('Cookie', adminCookie)
        .send({
          url: 'https://example.com/e2e-smoke.jpg',
          width: 1600,
          height: 900,
        });

      expect(res.status).toBe(201);
      expect(res.body.width).toBe(1600);
      expect(res.body.height).toBe(900);
    });
  });

  // ── RBAC ──────────────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('rejects an unauthenticated POST /tours (401)', async () => {
      const res = await request(server)
        .post(`${API}/tours`)
        .send({
          name: 'Unauthenticated Attempt',
          destinationId: destination.id,
          categoryIds: [category1.id],
        });

      expect(res.status).toBe(401);
    });

    it('rejects a second operator acting on a tour they do not own (403)', async () => {
      const createRes = await request(server)
        .post(`${API}/tours`)
        .set('Cookie', adminCookie)
        .send({
          name: `E2E Ownership Tour ${uniqueSuffix()}`,
          destinationId: destination.id,
          categoryIds: [category1.id],
        });
      expect(createRes.status).toBe(201);
      const tourId: string = createRes.body.id;

      // TOUR_OPERATOR carries CREATE_TRIP/EDIT_TRIP/MANAGE_TRIPS (see
      // roles.config.ts) so the PermissionsGuard lets this through - the 403
      // comes from ToursService.assertOwnership, not the guard layer.
      const publishRes = await request(server)
        .post(`${API}/tours/${tourId}/publish`)
        .set('Cookie', operatorBCookie);
      expect(publishRes.status).toBe(403);

      const patchRes = await request(server)
        .patch(`${API}/tours/${tourId}`)
        .set('Cookie', operatorBCookie)
        .send({ departureCity: 'Nowhere' });
      expect(patchRes.status).toBe(403);
    });
  });

  // ── Lifecycle transitions ─────────────────────────────────────────────────

  describe('Lifecycle transitions', () => {
    it('publish -> pause -> unpause -> archive -> restore(DRAFT)', async () => {
      const tourId = await createPublishReadyTour(
        [category1.id],
        `lifecycle-${uniqueSuffix()}`,
      );

      const publishRes = await request(server)
        .post(`${API}/tours/${tourId}/publish`)
        .set('Cookie', adminCookie);
      expect(publishRes.status).toBe(201);
      expect(publishRes.body.status).toBe(TourStatus.LIVE);

      const pauseRes = await request(server)
        .post(`${API}/tours/${tourId}/pause`)
        .set('Cookie', adminCookie);
      expect(pauseRes.status).toBe(201);
      expect(pauseRes.body.status).toBe(TourStatus.PAUSED);

      const unpauseRes = await request(server)
        .post(`${API}/tours/${tourId}/unpause`)
        .set('Cookie', adminCookie);
      expect(unpauseRes.status).toBe(201);
      expect(unpauseRes.body.status).toBe(TourStatus.LIVE);

      const archiveRes = await request(server)
        .post(`${API}/tours/${tourId}/archive`)
        .set('Cookie', adminCookie);
      expect(archiveRes.status).toBe(201);
      expect(archiveRes.body.status).toBe(TourStatus.ARCHIVED);
      expect(archiveRes.body.isActive).toBe(false);

      // restore() intentionally sends a tour back to DRAFT, not LIVE - it must
      // be re-published deliberately (never silently re-listed).
      const restoreRes = await request(server)
        .post(`${API}/tours/${tourId}/restore`)
        .set('Cookie', adminCookie);
      expect(restoreRes.status).toBe(201);
      expect(restoreRes.body.status).toBe(TourStatus.DRAFT);
      expect(restoreRes.body.isActive).toBe(true);
    });
  });
});
