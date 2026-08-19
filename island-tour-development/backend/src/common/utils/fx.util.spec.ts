import { Currency, Prisma } from '@prisma/client';
import { eurFxRate, toEur, usdToEurRate } from './fx.util';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('fx.util', () => {
  const ORIG = process.env.FX_USD_TO_EUR;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.FX_USD_TO_EUR;
    else process.env.FX_USD_TO_EUR = ORIG;
  });

  it('EUR rate is exactly 1', () => {
    expect(eurFxRate(Currency.EUR).toString()).toBe('1');
    expect(toEur(D('209.97'), Currency.EUR).toString()).toBe('209.97');
  });

  it('USD uses the configured rate', () => {
    process.env.FX_USD_TO_EUR = '0.9';
    expect(usdToEurRate().toString()).toBe('0.9');
    expect(toEur(D('100'), Currency.USD).toString()).toBe('90');
  });

  it('falls back to the default rate when env is missing or invalid', () => {
    delete process.env.FX_USD_TO_EUR;
    expect(usdToEurRate().toString()).toBe('0.92');
    process.env.FX_USD_TO_EUR = 'not-a-number';
    expect(usdToEurRate().toString()).toBe('0.92');
  });

  it('rounds the EUR amount HALF_UP to 2dp', () => {
    process.env.FX_USD_TO_EUR = '0.925';
    expect(toEur(D('209.97'), Currency.USD).toString()).toBe('194.22'); // 194.22225 → 194.22
  });

  // The compile-time `never` guard is the real protection - extend `Currency`
  // and eurFxRate stops compiling. This covers the other door: a value that
  // reached us from outside the type system (raw SQL, a stale client, a
  // half-applied migration). It must FAIL, never quietly price at the USD rate -
  // this number becomes the ad-platform conversion value (rule #22) and is
  // snapshotted onto the booking forever.
  it('refuses to guess a rate for a currency it does not know', () => {
    const unknown = 'GBP' as unknown as Currency;
    // The message must NAME the offending currency - the whole point is that
    // whoever reads the log can tell what arrived.
    expect(() => eurFxRate(unknown)).toThrow(/GBP/);
    expect(() => eurFxRate(unknown)).toThrow(/no EUR conversion rate/);
    // toEur must not swallow it into a NaN/garbage amount.
    expect(() => toEur(D('100'), unknown)).toThrow(/no EUR conversion rate/);
  });
});
