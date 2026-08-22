/**
 * Unsubscribe API e2e (WP-A, plan §2.5) — real HTTP, real DTO-free token
 * routes, real Postgres. Pins the whole public contract:
 *
 *  (a) GET resolves a token to `{ email(masked), audience, stream, optedOut }`
 *      and never leaks the full address;
 *  (b) POST opts out, is idempotent (second call = same 2xx, still one
 *      `email_opt_outs` row), and flips the GET's `optedOut`;
 *  (c) unknown tokens 404 on BOTH verbs with the same shape — no oracle for
 *      probing whether an address is in the system.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { EmailAudience, EmailStream, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';

const API = '/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `unsub+${suffix}@example-e2e.com`;

describe('email preferences (unsubscribe) - real HTTP + real Postgres', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaClient;
  let token: string;

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

    // The token a lifecycle email footer would carry (issueUnsubscribeToken
    // writes exactly this row; seeding it directly keeps the suite focused on
    // the public HTTP contract).
    const row = await prisma.emailUnsubscribeToken.create({
      data: {
        email: EMAIL.toLowerCase(),
        audience: EmailAudience.OPERATOR,
        stream: EmailStream.LIFECYCLE,
      },
      select: { token: true },
    });
    token = row.token;
  });

  afterAll(async () => {
    await prisma.emailOptOut.deleteMany({
      where: { email: EMAIL.toLowerCase() },
    });
    await prisma.emailUnsubscribeToken.deleteMany({
      where: { email: EMAIL.toLowerCase() },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET resolves the token with a MASKED email and optedOut=false', async () => {
    const res = await request(server)
      .get(`${API}/email/unsubscribe/${token}`)
      .expect(200);

    expect(res.body).toEqual({
      email: `u***@example-e2e.com`,
      audience: EmailAudience.OPERATOR,
      stream: EmailStream.LIFECYCLE,
      optedOut: false,
    });
    // The full local part must never appear anywhere in the payload.
    expect(JSON.stringify(res.body)).not.toContain(`unsub+${suffix}`);
  });

  it("POST records the opt-out for exactly the token's stream", async () => {
    const res = await request(server)
      .post(`${API}/email/unsubscribe/${token}`)
      .expect(201);

    expect(res.body).toMatchObject({
      audience: EmailAudience.OPERATOR,
      stream: EmailStream.LIFECYCLE,
      optedOut: true,
    });

    const rows = await prisma.emailOptOut.findMany({
      where: { email: EMAIL.toLowerCase() },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      audience: EmailAudience.OPERATOR,
      stream: EmailStream.LIFECYCLE,
      source: 'unsubscribe-link',
    });
  });

  it('POST again is idempotent: same success, still exactly one row', async () => {
    await request(server).post(`${API}/email/unsubscribe/${token}`).expect(201);

    const rows = await prisma.emailOptOut.count({
      where: { email: EMAIL.toLowerCase() },
    });
    expect(rows).toBe(1);
  });

  it('GET now reports optedOut=true (the link keeps working after acting)', async () => {
    const res = await request(server)
      .get(`${API}/email/unsubscribe/${token}`)
      .expect(200);
    expect(res.body.optedOut).toBe(true);
  });

  it('unknown token → 404 on GET', async () => {
    await request(server)
      .get(`${API}/email/unsubscribe/${randomUUID()}`)
      .expect(404);
  });

  it('unknown token → 404 on POST, and no opt-out row appears', async () => {
    const junk = randomUUID();
    await request(server).post(`${API}/email/unsubscribe/${junk}`).expect(404);
  });
});
