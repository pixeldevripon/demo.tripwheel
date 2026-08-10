/**
 * Reserve idempotency e2e (hardening F4 of
 * technical-doc/03-implementation/BOOKING-CONCURRENCY-HARDENING.md).
 *
 * `ReserveBookingDto.id` is the declared idempotency key. These tests pin the
 * whole contract end to end - real HTTP, real DTO validation, real Postgres:
 *
 *  (a) the same id twice sequentially returns the SAME booking, creates no
 *      second row, and claims no extra seats;
 *  (b) the same id twice in PARALLEL produces exactly one booking row and
 *      both responses carry its id (the in-flight P2002 catch - the loser's
 *      insert collides on the PK after the winner commits);
 *  (c) a reused id whose payload names a different reservation is refused
 *      with 409 rather than silently answered with an unrelated booking.
 *
 * The tour is UNIT-priced (flat basePrice, a bare `guests` count) because it
 * is the smallest seedable booking surface: no age bands, no add-ons, and
 * same-currency pricing rides the FX identity path.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import {
  Currency,
  PaymentModel,
  PricingModel,
  PrismaClient,
  Region,
  TourBookingType,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';

const API = '/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('reserve idempotency (F4) - real HTTP + real Postgres', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaClient;

  let destinationId: string;
  let userId: string;
  let operatorId: string;
  let tourId: string;
  let departureId: string;
  let otherDepartureId: string;

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
        name: `E2E Idem Dest ${suffix}`,
        slug: `e2e-idem-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
    });
    destinationId = destination.id;

    const user = await prisma.user.create({
      data: {
        name: 'E2E Idem Operator',
        email: `idem+${suffix}@example-e2e.com`,
      },
    });
    userId = user.id;
    const operator = await prisma.operator.create({ data: { userId } });
    operatorId = operator.id;

    // Smallest bookable surface: SHARED unit charter, flat price, EUR-on-EUR.
    const tour = await prisma.tour.create({
      data: {
        name: `E2E Idem Tour ${suffix}`,
        slug: `e2e-idem-tour-${suffix}`,
        destinationId,
        operatorId,
        status: TourStatus.LIVE,
        timeZone: 'America/Curacao',
        defaultCurrency: Currency.EUR,
        paymentModel: PaymentModel.OPERATOR_LINK,
        pricingModel: PricingModel.UNIT,
        wholeUnitType: WholeUnitType.BOAT,
        bookingType: TourBookingType.SHARED,
        basePrice: 100,
      },
    });
    tourId = tour.id;

    const [dep, otherDep] = await Promise.all([
      prisma.departure.create({
        data: {
          tourId,
          date: new Date('2031-06-05'),
          startTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
          capacity: 10,
        },
      }),
      prisma.departure.create({
        data: {
          tourId,
          date: new Date('2031-06-06'),
          startTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
          capacity: 10,
        },
      }),
    ]);
    departureId = dep.id;
    otherDepartureId = otherDep.id;
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
      prisma.bookingUnitItem.deleteMany({
        where: { booking: { tourId } },
      }),
    );
    await safe(() => prisma.booking.deleteMany({ where: { tourId } }));
    await safe(() => prisma.departure.deleteMany({ where: { tourId } }));
    await safe(() => prisma.tour.delete({ where: { id: tourId } }));
    await safe(() => prisma.operator.delete({ where: { id: operatorId } }));
    await safe(() => prisma.user.delete({ where: { id: userId } }));
    await safe(() =>
      prisma.destination.delete({ where: { id: destinationId } }),
    );
    await prisma.$disconnect();
    await app.close();
  });

  function reserve(body: Record<string, unknown>) {
    return request(server).post(`${API}/bookings`).send(body);
  }

  function bookedCount(depId: string) {
    return prisma.departure
      .findUniqueOrThrow({
        where: { id: depId },
        select: { bookedCount: true },
      })
      .then((d) => d.bookedCount);
  }

  it('(a) same id sequentially: same booking back, one row, seats claimed once', async () => {
    const id = randomUUID();
    const body = { id, tourId, departureId, guests: 2 };

    const first = await reserve(body).expect(201);
    expect(first.body.id).toBe(id);
    const countAfterFirst = await bookedCount(departureId);

    const second = await reserve(body).expect(201);
    expect(second.body.id).toBe(id);
    expect(second.body.publicRef).toBe(first.body.publicRef);

    expect(await bookedCount(departureId)).toBe(countAfterFirst); // no re-claim
    expect(await prisma.booking.count({ where: { id } })).toBe(1);
  });

  it('(b) same id in parallel: exactly one booking row, both responses carry it', async () => {
    const id = randomUUID();
    const body = { id, tourId, departureId, guests: 2 };
    const before = await bookedCount(departureId);

    const [r1, r2] = await Promise.all([reserve(body), reserve(body)]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).toBe(id);
    expect(r2.body.id).toBe(id);
    expect(r1.body.publicRef).toBe(r2.body.publicRef);

    expect(await prisma.booking.count({ where: { id } })).toBe(1);
    // Exactly ONE claim landed - the loser never touched the departure row.
    expect(await bookedCount(departureId)).toBe(before + 2);
  });

  it('(c) reused id with a different departure: 409, nothing created or claimed', async () => {
    const id = randomUUID();
    await reserve({ id, tourId, departureId, guests: 2 }).expect(201);
    const before = await bookedCount(otherDepartureId);

    const res = await reserve({
      id,
      tourId,
      departureId: otherDepartureId,
      guests: 2,
    });
    expect(res.status).toBe(409);

    expect(await bookedCount(otherDepartureId)).toBe(before);
    expect(await prisma.booking.count({ where: { id } })).toBe(1);
    // The original reservation is untouched by the refused reuse.
    const original = await prisma.booking.findUniqueOrThrow({
      where: { id },
      select: { departureId: true },
    });
    expect(original.departureId).toBe(departureId);
  });

  it('replay returns the booking in its CURRENT state, not a fresh hold', async () => {
    const id = randomUUID();
    const first = await reserve({ id, tourId, departureId, guests: 1 }).expect(
      201,
    );
    expect(first.body.status).toBe('ON_HOLD');

    // The hold lapses (swept elsewhere); the replay reports the truth.
    await prisma.booking.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    const replay = await reserve({ id, tourId, departureId, guests: 1 }).expect(
      201,
    );
    expect(replay.body.status).toBe('EXPIRED');
  });
});
