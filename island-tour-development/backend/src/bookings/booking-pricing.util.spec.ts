import { AddOnUnit, Currency, PaymentModel, Prisma } from '@prisma/client';
import { computeBookingPricing } from './booking-pricing.util';

const D = (v: string | number) => new Prisma.Decimal(v);

const lines = [
  {
    ageBandId: 'adult',
    quantity: 2,
    priceRetail: D('79.99'),
    priceNet: D('63.99'),
  },
  {
    ageBandId: 'child',
    quantity: 1,
    priceRetail: D('49.99'),
    priceNet: D('39.99'),
  },
];
// 79.99*2 + 49.99 = 209.97

function compute(
  over: Partial<Parameters<typeof computeBookingPricing>[0]> = {},
) {
  return computeBookingPricing({
    lines,
    currency: Currency.EUR,
    paymentModel: PaymentModel.OPERATOR_LINK,
    depositPct: D('20'),
    commissionTier: D('20'),
    ...over,
  });
}

describe('computeBookingPricing', () => {
  it('sums unit retail/net and expands one item per seat', () => {
    const p = compute();
    expect(p.totalRetail.toString()).toBe('209.97');
    expect(p.totalNet?.toString()).toBe('167.97'); // 63.99*2 + 39.99
    expect(p.unitItems).toHaveLength(3);
    expect(p.pax).toBe(3);
  });

  it('OPERATOR_LINK splits deposit (pct) and balance', () => {
    const p = compute({
      paymentModel: PaymentModel.OPERATOR_LINK,
      depositPct: D('20'),
    });
    expect(p.depositAmount.toString()).toBe('41.99'); // 209.97 * 0.20
    expect(p.balanceAmount.toString()).toBe('167.98');
  });

  it('PAID_IN_FULL charges the whole total up front', () => {
    const p = compute({ paymentModel: PaymentModel.PAID_IN_FULL });
    expect(p.depositAmount.toString()).toBe('209.97');
    expect(p.balanceAmount.toString()).toBe('0');
  });

  it('ON_ARRIVAL / OPERATOR_FULL take no deposit', () => {
    for (const pm of [PaymentModel.ON_ARRIVAL, PaymentModel.OPERATOR_FULL]) {
      const p = compute({ paymentModel: pm });
      expect(p.depositAmount.toString()).toBe('0');
      expect(p.balanceAmount.toString()).toBe('209.97');
    }
  });

  it('snapshots an EUR commission (rate + amount)', () => {
    const p = compute({ currency: Currency.EUR, commissionTier: D('27.5') });
    expect(p.commissionRate.toString()).toBe('0.275');
    expect(p.fxRateToEur?.toString()).toBe('1');
    expect(p.totalEur?.toString()).toBe('209.97');
    expect(p.commissionAmount?.toString()).toBe('57.74'); // 209.97 * 0.275 = 57.74175
  });

  it('leaves commissionAmount null for non-EUR (FX is Phase 6)', () => {
    const p = compute({ currency: Currency.USD });
    expect(p.commissionRate.toString()).toBe('0.2'); // rate still snapshotted
    expect(p.totalEur).toBeNull();
    expect(p.fxRateToEur).toBeNull();
    expect(p.commissionAmount).toBeNull();
  });

  it('multiplies PER_PERSON add-ons by pax; FLAT add-ons once', () => {
    const p = compute({
      addOns: [
        {
          addOnId: 'a1',
          name: 'Lunch',
          unit: AddOnUnit.PER_PERSON,
          quantity: 1,
          unitPrice: D('10'),
        },
        {
          addOnId: 'a2',
          name: 'Transfer',
          unit: AddOnUnit.FLAT,
          quantity: 1,
          unitPrice: D('25'),
        },
      ],
    });
    // base 209.97 + lunch 10*3 + transfer 25 = 264.97
    expect(p.totalRetail.toString()).toBe('264.97');
    expect(p.addOns[0].totalPrice.toString()).toBe('30');
    expect(p.addOns[1].totalPrice.toString()).toBe('25');
  });

  it('drops net when any line is missing a net price', () => {
    const p = compute({
      lines: [
        {
          ageBandId: 'adult',
          quantity: 1,
          priceRetail: D('79.99'),
          priceNet: null,
        },
      ],
    });
    expect(p.totalNet).toBeNull();
  });
});
