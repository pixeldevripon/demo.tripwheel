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
});
