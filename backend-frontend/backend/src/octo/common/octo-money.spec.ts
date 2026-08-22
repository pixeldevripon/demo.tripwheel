import { Prisma } from '@prisma/client';
import { buildPricing, currencyPrecision, toMinorUnits } from './octo-money';

describe('octo-money', () => {
  describe('toMinorUnits', () => {
    it('converts a Decimal to integer minor units', () => {
      expect(toMinorUnits(new Prisma.Decimal('79.99'))).toBe(7999);
      expect(toMinorUnits(new Prisma.Decimal('100'))).toBe(10000);
    });

    it('accepts numbers and numeric strings', () => {
      expect(toMinorUnits(75)).toBe(7500);
      expect(toMinorUnits('12.50')).toBe(1250);
    });

    it('rounds to avoid float drift', () => {
      // 49.99 * 100 = 4998.9999… in IEEE-754 → must round to 4999
      expect(toMinorUnits(49.99)).toBe(4999);
    });

    it('returns null for null/undefined/NaN', () => {
      expect(toMinorUnits(null)).toBeNull();
      expect(toMinorUnits(undefined)).toBeNull();
      expect(toMinorUnits('not-a-number')).toBeNull();
    });

    it('honours an explicit precision', () => {
      expect(toMinorUnits(5, 0)).toBe(5);
      expect(toMinorUnits(5, 3)).toBe(5000);
    });
  });

  describe('currencyPrecision', () => {
    it('is 2 for USD and EUR', () => {
      expect(currencyPrecision('USD')).toBe(2);
      expect(currencyPrecision('EUR')).toBe(2);
    });
  });

  describe('buildPricing', () => {
    it('builds a full Pricing object with original defaulting to retail', () => {
      const p = buildPricing({
        retail: new Prisma.Decimal('75.00'),
        net: new Prisma.Decimal('60.00'),
        currency: 'EUR',
      });
      expect(p).toEqual({
        original: 7500,
        retail: 7500,
        net: 6000,
        currency: 'EUR',
        currencyPrecision: 2,
        includedTaxes: [],
      });
    });

    it('keeps a distinct original (discounted retail)', () => {
      const p = buildPricing({
        retail: new Prisma.Decimal('60.00'),
        original: new Prisma.Decimal('80.00'),
        currency: 'USD',
      });
      expect(p.retail).toBe(6000);
      expect(p.original).toBe(8000);
      expect(p.net).toBeNull();
    });

    it('normalizes the taxes JSON to minor units, dropping invalid lines', () => {
      const p = buildPricing({
        retail: new Prisma.Decimal('75.00'),
        currency: 'USD',
        taxes: [
          { name: 'OB', retail: 7.27, original: 7.5, net: 6 },
          { retail: 1 }, // no name → dropped
          { name: 'X' }, // no retail → dropped
          'garbage',
        ],
      });
      expect(p.includedTaxes).toEqual([
        { name: 'OB', retail: 727, original: 750, net: 600 },
      ]);
    });
  });
});
