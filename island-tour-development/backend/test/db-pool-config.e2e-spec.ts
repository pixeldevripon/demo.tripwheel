/**
 * DB pool + timeout configuration e2e (hardening F6 of
 * technical-doc/03-implementation/BOOKING-CONCURRENCY-HARDENING.md).
 *
 * Two things only real Postgres can prove:
 *
 *  1. The timeouts configured in PrismaService actually reach the pool's
 *     connections (node-pg applies them per session - a typo'd option name
 *     would be silently ignored, and no unit test would ever notice).
 *  2. A reserve whose claim waits too long on a locked departure row is shed
 *     as a retryable 503 by the lock_timeout, not a 500 - the full HTTP path
 *     of the 55P03 mapping.
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
import { PrismaService } from './../src/prisma/prisma.service';

const API = '/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('DB pool config (F6) - real Postgres', () => {
  let app: INestApplication<App>;
  let server: App;
  let appPrisma: PrismaService;
  /** Side client OUTSIDE the app's pool, used to hold locks against it. */
  let rival: PrismaClient;

  let destinationId: string;
  let userId: string;
  let operatorId: string;
  let tourId: string;
  let departureId: string;

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
    appPrisma = app.get(PrismaService);

    rival = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await rival.$connect();

    const destination = await rival.destination.create({
      data: {
        name: `E2E Pool Dest ${suffix}`,
        slug: `e2e-pool-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
    });
    destinationId = destination.id;
    const user = await rival.user.create({
      data: {
        name: 'E2E Pool Operator',
        email: `pool+${suffix}@example-e2e.com`,
      },
    });
    userId = user.id;
    const operator = await rival.operator.create({ data: { userId } });
    operatorId = operator.id;
    const tour = await rival.tour.create({
      data: {
        name: `E2E Pool Tour ${suffix}`,
        slug: `e2e-pool-tour-${suffix}`,
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
    const dep = await rival.departure.create({
      data: {
        tourId,
        date: new Date('2031-07-01'),
        startTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
        capacity: 10,
      },
    });
    departureId = dep.id;
  }, 60_000);

  afterAll(async () => {
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* cleanup only */
      }
    };
    await safe(() =>
      rival.bookingUnitItem.deleteMany({ where: { booking: { tourId } } }),
    );
    await safe(() => rival.booking.deleteMany({ where: { tourId } }));
    await safe(() => rival.departure.deleteMany({ where: { tourId } }));
    await safe(() => rival.tour.delete({ where: { id: tourId } }));
    await safe(() => rival.operator.delete({ where: { id: operatorId } }));
    await safe(() => rival.user.delete({ where: { id: userId } }));
    await safe(() =>
      rival.destination.delete({ where: { id: destinationId } }),
    );
    await rival.$disconnect();
    await app.close();
  });

  it('applies every session timeout to the pool connections', async () => {
    // current_setting through the APP's PrismaService - proves the options
    // survived the PrismaPg -> pg.Pool handoff by their exact names.
    const [row] = await appPrisma.$queryRaw<
      {
        lock_timeout: string;
        statement_timeout: string;
        idle_in_transaction_session_timeout: string;
      }[]
    >`SELECT current_setting('lock_timeout') AS lock_timeout,
             current_setting('statement_timeout') AS statement_timeout,
             current_setting('idle_in_transaction_session_timeout')
               AS idle_in_transaction_session_timeout`;
    expect(row.lock_timeout).toBe('3s');
    expect(row.statement_timeout).toBe('10s');
    expect(row.idle_in_transaction_session_timeout).toBe('15s');
  });

  it('sheds a reserve stuck behind a held row lock as 503, not 500', async () => {
    // A rival holds the departure row lock for longer than lock_timeout; the
    // reserve's claim (last statement of its txn) queues behind it and must
    // be aborted by Postgres at ~3s and answered as "try again".
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const rivalTxn = rival.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "departures" WHERE "id" = ${departureId} FOR UPDATE`;
        await hold;
      },
      { timeout: 15_000 },
    );
    // Let the rival acquire the lock before firing the booking.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const started = Date.now();
    const res = await request(server)
      .post(`${API}/bookings`)
      .send({ id: randomUUID(), tourId, departureId, guests: 2 });
    const elapsed = Date.now() - started;

    release();
    await rivalTxn;

    expect(res.status).toBe(503);
    // Aborted by lock_timeout (~3s), not by the 5s txn timeout or a hang.
    expect(elapsed).toBeGreaterThan(2_500);
    expect(elapsed).toBeLessThan(5_000);
    // The shed request claimed nothing and left no booking behind.
    expect(await rival.booking.count({ where: { departureId } })).toBe(0);
    const dep = await rival.departure.findUniqueOrThrow({
      where: { id: departureId },
      select: { bookedCount: true },
    });
    expect(dep.bookedCount).toBe(0);
  }, 20_000);
});
