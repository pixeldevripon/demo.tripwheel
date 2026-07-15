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

  // ── UNIT (whole-unit / charter) pricing (D1 / D1a) ──────────────────────────
  function computeUnit(
    unit: Parameters<typeof computeBookingPricing>[0]['unit'],
    over: Partial<Parameters<typeof computeBookingPricing>[0]> = {},
  ) {
    return computeBookingPricing({
      unit,
      currency: Currency.EUR,
      paymentModel: PaymentModel.OPERATOR_LINK,
      depositPct: D('20'),
      commissionTier: D('20'),
      ...over,
    });
  }

  it('UNIT GROUP: base covers included guests, surcharge on the rest', () => {
    // base 1450 covers 10; 2 extra @ 220 => 1450 + 440 = 1890
    const p = computeUnit({
      guests: 12,
      basePrice: D('1450'),
      unitIncludedGuests: 10,
      extraPersonPrice: D('220'),
      priceNet: null,
    });
    expect(p.totalRetail.toString()).toBe('1890');
    expect(p.pax).toBe(12);
    // one item per guest for the manifest; whole-unit retail rides on the first
    expect(p.unitItems).toHaveLength(12);
    expect(p.unitItems.every((u) => u.ageBandId === null)).toBe(true);
    expect(p.unitItems[0].priceRetail.toString()).toBe('1890');
    const sum = p.unitItems.reduce((s, u) => s.plus(u.priceRetail), D('0'));
    expect(sum.toString()).toBe('1890');
  });

  it('UNIT GROUP: no surcharge when guests within the included count', () => {
    const p = computeUnit({
      guests: 4,
      basePrice: D('1450'),
      unitIncludedGuests: 10,
      extraPersonPrice: D('220'),
      priceNet: null,
    });
    expect(p.totalRetail.toString()).toBe('1450');
    expect(p.pax).toBe(4);
    expect(p.unitItems).toHaveLength(4);
  });

  it('UNIT flat (non-GROUP): a flat whole-unit price regardless of guests', () => {
    // boat/vehicle/aircraft/package pass null included/extra => flat basePrice
    const p = computeUnit({
      guests: 8,
      basePrice: D('1200'),
      unitIncludedGuests: null,
      extraPersonPrice: null,
      priceNet: null,
    });
    expect(p.totalRetail.toString()).toBe('1200');
    expect(p.pax).toBe(8);
    expect(p.unitItems).toHaveLength(8);
  });

  it('UNIT: PER_PERSON add-ons still multiply by the guest headcount', () => {
    const p = computeUnit(
      {
        guests: 5,
        basePrice: D('1000'),
        unitIncludedGuests: null,
        extraPersonPrice: null,
        priceNet: null,
      },
      {
        addOns: [
          {
            addOnId: 'a1',
            name: 'Lunch',
            unit: AddOnUnit.PER_PERSON,
            quantity: 1,
            unitPrice: D('10'),
          },
        ],
      },
    );
    // 1000 + 10*5 = 1050
    expect(p.totalRetail.toString()).toBe('1050');
  });

  it('throws when neither lines nor unit is supplied', () => {
    expect(() =>
      computeBookingPricing({
        lines: [],
        currency: Currency.EUR,
        paymentModel: PaymentModel.OPERATOR_LINK,
        depositPct: D('20'),
        commissionTier: D('20'),
      }),
    ).toThrow(/lines or unit/);
  });
});
