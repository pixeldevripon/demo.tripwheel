import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';

describe('Settings Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'short', ttl: 1000, limit: 20 }, // High burst to avoid noise
            { name: 'medium', ttl: 60000, limit: 3 }, // Sustained limit of 3 for testing
          ],
        }),
      ],
    })
      .overrideModule(ThrottlerModule)
      .useModule(
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'short', ttl: 1000, limit: 20 },
            { name: 'medium', ttl: 60000, limit: 3 },
          ],
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Utility to hit an endpoint multiple times and check for 429
  async function testRateLimit(
    method: 'get' | 'post' | 'patch',
    endpoint: string,
    limit: number,
    payload: any = {},
  ) {
    for (let i = 0; i < limit; i++) {
      const req = request(app.getHttpServer())[method](endpoint);
      if (method !== 'get') req.send(payload);
      
      await req.expect((res) => {
        expect(res.status).not.toBe(429);
      });
    }

    const finalReq = request(app.getHttpServer())[method](endpoint);
    if (method !== 'get') finalReq.send(payload);
    await finalReq.expect(429);
  }

  describe('Core Site & SEO (Global Limits - 3 req/min)', () => {
    it('GET /settings/site is throttled after 3 requests', () => 
      testRateLimit('get', '/api/v1/settings/site', 3)
    );

    it('PATCH /settings/site is throttled after 3 requests', () => 
      testRateLimit('patch', '/api/v1/settings/site', 3, { siteName: 'Test' })
    );

    it('GET /settings/seo is throttled after 3 requests', () => 
      testRateLimit('get', '/api/v1/settings/seo', 3)
    );
  });

  describe('Stripe Configuration (Specific Override - 5 req/min)', () => {
    it('POST /settings/payment/stripe is throttled after 5 requests', () => 
      testRateLimit('post', '/api/v1/settings/payment/stripe', 5, { secretKey: 'sk_test' })
    );

    it('PATCH /settings/payment/stripe is throttled after 5 requests', () => 
      testRateLimit('patch', '/api/v1/settings/payment/stripe', 5, { publishableKey: 'pk_test' })
    );
  });

  describe('Mollie Configuration (Specific Override - 5 req/min)', () => {
    it('POST /settings/payment/mollie is throttled after 5 requests', () => 
      testRateLimit('post', '/api/v1/settings/payment/mollie', 5, { apiKey: 'key_1' })
    );

    it('PATCH /settings/payment/mollie is throttled after 5 requests', () => 
      testRateLimit('patch', '/api/v1/settings/payment/mollie', 5, { apiKey: 'key_2' })
    );
  });

  describe('Company Profile (Specific Override - 10 req/min)', () => {
    it('POST /api/company is throttled after 10 requests', () => 
      testRateLimit('post', '/api/v1/settings/company', 10, { companyName: 'Name' })
    );

    it('PATCH /api/company is throttled after 10 requests', () => 
      testRateLimit('patch', '/api/v1/settings/company', 10, { companyEmail: 'a@b.com' })
    );
  });
});
