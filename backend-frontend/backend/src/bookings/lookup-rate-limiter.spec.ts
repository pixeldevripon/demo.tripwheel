/**
 * Direct tests for the lookup + per-target abuse limiters. These are the
 * credential-protection layer of the /bookings pair login (login spec §1) -
 * the failure branches must be covered here, not just via service specs.
 */
import { HttpException } from '@nestjs/common';
import { LookupRateLimiter, TargetRateLimiter } from './lookup-rate-limiter';

const EMAIL = 'guest@example.test';
const REF = 'IT-2030-AAAA';

describe('LookupRateLimiter', () => {
  let limiter: LookupRateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    limiter = new LookupRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
    jest.useRealTimers();
  });

  const fail = (email = EMAIL, ref = REF) =>
    limiter.recordFailure(email, ref, '1.2.3.4');
  const assertAllowed = (email = EMAIL, ref = REF) =>
    limiter.assertAllowed(email, ref, '1.2.3.4');

  it('allows below the caps', () => {
    for (let i = 0; i < 4; i++) fail();
    expect(() => assertAllowed()).not.toThrow();
  });

  it('locks the EMAIL after 5 failures (429), regardless of reference', () => {
    for (let i = 0; i < 5; i++) fail(EMAIL, `IT-2030-${i}`);
    expect(() => assertAllowed(EMAIL, 'IT-2030-FRESH')).toThrow(HttpException);
  });

  it('locks the REFERENCE after 10 failures, regardless of email', () => {
    for (let i = 0; i < 10; i++) fail(`spray${i}@evil.test`, REF);
    expect(() => assertAllowed('fresh@evil.test', REF)).toThrow(HttpException);
  });

  it('is case/whitespace-insensitive on both credentials', () => {
    for (let i = 0; i < 5; i++) fail(' GUEST@Example.TEST ', REF);
    expect(() => assertAllowed(EMAIL, REF.toLowerCase())).toThrow(
      HttpException,
    );
  });

  it('a successful lookup clears the email counter', () => {
    for (let i = 0; i < 4; i++) fail();
    limiter.recordSuccess(EMAIL);
    fail();
    expect(() => assertAllowed()).not.toThrow();
  });

  it('failures age out after the 15-minute window', () => {
    for (let i = 0; i < 5; i++) fail();
    expect(() => assertAllowed()).toThrow(HttpException);
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(() => assertAllowed()).not.toThrow();
  });

  it('sweepStale drops one-shot keys after the window (no unbounded growth)', () => {
    fail('once@only.test', 'IT-2030-ONCE');
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    limiter.sweepStale();
    // Internal map must be empty again - reach in deliberately (leak test).
    expect((limiter as any).failures.size).toBe(0);
  });
});

describe('TargetRateLimiter', () => {
  let limiter: TargetRateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    limiter = new TargetRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
    jest.useRealTimers();
  });

  const HOUR = { max: 3, windowMs: 60 * 60 * 1000 };

  it('throws 429 once the window cap is reached', () => {
    for (let i = 0; i < 3; i++) limiter.consume('resend', 'ref-1', [HOUR]);
    expect(() => limiter.consume('resend', 'ref-1', [HOUR])).toThrow(
      HttpException,
    );
  });

  it('keys are per bucket AND per target', () => {
    for (let i = 0; i < 3; i++) limiter.consume('resend', 'ref-1', [HOUR]);
    expect(() => limiter.consume('resend', 'ref-2', [HOUR])).not.toThrow();
    expect(() => limiter.consume('cancel-req', 'ref-1', [HOUR])).not.toThrow();
  });

  it('enforces the strictest of multiple windows (1/min + 5/day)', () => {
    const windows = [
      { max: 1, windowMs: 60 * 1000 },
      { max: 5, windowMs: 24 * 60 * 60 * 1000 },
    ];
    limiter.consume('recover', EMAIL, windows);
    expect(() => limiter.consume('recover', EMAIL, windows)).toThrow(
      HttpException,
    );
    // A minute later the short window resets...
    jest.advanceTimersByTime(61 * 1000);
    expect(() => limiter.consume('recover', EMAIL, windows)).not.toThrow();
    // ...but the daily cap still bites after 5 total.
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(61 * 1000);
      limiter.consume('recover', EMAIL, windows);
    }
    jest.advanceTimersByTime(61 * 1000);
    expect(() => limiter.consume('recover', EMAIL, windows)).toThrow(
      HttpException,
    );
  });

  it('normalizes target casing', () => {
    for (let i = 0; i < 3; i++) limiter.consume('recover', 'A@B.CO', [HOUR]);
    expect(() => limiter.consume('recover', 'a@b.co', [HOUR])).toThrow(
      HttpException,
    );
  });

  it('sweepStale drops idle keys past the largest seen window', () => {
    limiter.consume('recover', EMAIL, [
      { max: 5, windowMs: 24 * 60 * 60 * 1000 },
    ]);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    limiter.sweepStale();
    expect((limiter as any).events.size).toBe(0);
  });
});
