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
    sourceCurrency: Currency.EUR,
    bookingCurrency: Currency.EUR,
    sourceFxRateToBooking: D('1'),
    fxRateToEur: D('1'),
    paymentModel: PaymentModel.OPERATOR_LINK,
    depositPct: D('20'),
    commissionTier: D('20'),
    ...over,
  });
}

describe('computeBookingPricing', () => {
  it('sums unit retail/net and expands one item per seat', () => {
    const p = compute();
    expect(p.totalRetail.toString()).toBe('210');
    expect(p.totalNet?.toString()).toBe('167.97'); // 63.99*2 + 39.99
    expect(p.unitItems).toHaveLength(3);
    expect(p.pax).toBe(3);
  });

  it('OPERATOR_LINK splits deposit (pct) and balance', () => {
    const p = compute({
      paymentModel: PaymentModel.OPERATOR_LINK,
      depositPct: D('20'),
    });
    expect(p.depositAmount.toString()).toBe('42'); // ceil(209.97 * 0.20)
    expect(p.balanceAmount.toString()).toBe('168');
  });

  it('PAID_IN_FULL charges the whole total up front', () => {
    const p = compute({ paymentModel: PaymentModel.PAID_IN_FULL });
    expect(p.depositAmount.toString()).toBe('210');
    expect(p.balanceAmount.toString()).toBe('0');
  });

  it('ON_ARRIVAL is a deposit model (deposit pct + balance, guide §20.6)', () => {
    const p = compute({
      paymentModel: PaymentModel.ON_ARRIVAL,
      depositPct: D('20'),
    });
    expect(p.depositAmount.toString()).toBe('42'); // ceil(209.97 * 0.20)
    expect(p.balanceAmount.toString()).toBe('168');
  });

  it('OPERATOR_FULL takes no deposit (whole amount settled with the operator)', () => {
    const p = compute({ paymentModel: PaymentModel.OPERATOR_FULL });
    expect(p.depositAmount.toString()).toBe('0');
    expect(p.balanceAmount.toString()).toBe('210');
  });

  it('snapshots an EUR commission (rate + amount)', () => {
    const p = compute({ commissionTier: D('27.5') });
    expect(p.commissionRate.toString()).toBe('0.275');
    expect(p.fxRateToEur?.toString()).toBe('1');
    expect(p.totalEur?.toString()).toBe('210');
    expect(p.commissionAmount?.toString()).toBe('57.74'); // 209.97 * 0.275 = 57.74175
  });

  it('leaves commissionAmount null when the EUR rate is unresolved', () => {
    const p = compute({ fxRateToEur: null });
    expect(p.commissionRate.toString()).toBe('0.2'); // rate still snapshotted
    expect(p.totalEur).toBeNull();
    expect(p.commissionAmount).toBeNull();
  });

  it('snapshots source == booking when not converting (rate 1)', () => {
    const p = compute();
    expect(p.sourceFxRateToBooking.toString()).toBe('1');
    expect(p.sourceTotalRetail.toString()).toBe(p.totalRetail.toString());
    expect(p.sourceDepositAmount.toString()).toBe(p.depositAmount.toString());
    expect(p.sourceBalanceAmount.toString()).toBe(p.balanceAmount.toString());
  });

  it('converts a USD tour to an EUR booking (source snapshot + EUR commission)', () => {
    // USD tour, EUR shopper: source 209.97 USD -> booking EUR at 0.9, EUR rate 1.
    const p = compute({
      sourceCurrency: Currency.USD,
      bookingCurrency: Currency.EUR,
      sourceFxRateToBooking: D('0.9'),
      fxRateToEur: D('1'),
    });
    // Per-line conversion (guide §20.5): 79.99*0.9=71.99 (x2) + 49.99*0.9=44.99 = 188.97 -> ceil 189
    expect(p.totalRetail.toString()).toBe('189');
    expect(p.sourceTotalRetail.toString()).toBe('210'); // original USD preserved
    expect(p.sourceFxRateToBooking.toString()).toBe('0.9');
    expect(p.commissionAmount?.toString()).toBe('37.79'); // 188.97 * 0.20
    expect(p.unitItems[0].priceRetail.toString()).toBe('71.99'); // booking currency
  });

  it('converts an EUR tour to a USD booking, EUR commission via booking->EUR rate', () => {
    // EUR tour, USD shopper: source 209.97 EUR -> USD at 1.1; USD->EUR at 0.9.
    const p = compute({
      sourceCurrency: Currency.EUR,
      bookingCurrency: Currency.USD,
      sourceFxRateToBooking: D('1.1'),
      fxRateToEur: D('0.9'),
    });
    // 79.99*1.1=87.99 (x2) + 49.99*1.1=54.99 = 230.97 -> ceil 231
    expect(p.totalRetail.toString()).toBe('231');
    expect(p.sourceTotalRetail.toString()).toBe('210');
    // EUR commission is taken on the UNROUNDED tour base, so it is unchanged
    // by the rounding: 230.97 * 0.9 = 207.873 -> 207.87; *0.2 = 41.57
    expect(p.totalEur?.toString()).toBe('207.9');
    expect(p.commissionAmount?.toString()).toBe('41.57');
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
    // base 209.97 + lunch 10*3 + transfer 25 = 264.97 -> ceil 265
    expect(p.totalRetail.toString()).toBe('265');
    expect(p.addOns[0].totalPrice.toString()).toBe('30');
    expect(p.addOns[1].totalPrice.toString()).toBe('25');
  });

  it('charges a priced pickup per person (unitPrice × pax) into the totals', () => {
    const p = compute({ pickup: { unitPrice: D('17') } });
    // base 209.97 + pickup 17*3 = 260.97 -> ceil 261
    expect(p.totalRetail.toString()).toBe('261');
    expect(p.sourceTotalRetail.toString()).toBe('261');
    expect(p.pickup?.unitPrice.toString()).toBe('17');
    expect(p.pickup?.totalPrice.toString()).toBe('51');
    // Deposit % applies to the TOUR only and extras ride the operator balance
    // in full (founder 2026-07-25): deposit = ceil(209.97 * 0.20) = 42. The
    // balance is the REMAINDER of the rounded total (261 - 42 = 219), never
    // computed on its own - that is what keeps the two summing to the total.
    expect(p.depositAmount.toString()).toBe('42');
    expect(p.balanceAmount.toString()).toBe('219');
  });

  it('excludes extras from the commission base (tour-only %)', () => {
    const p = compute({
      pickup: { unitPrice: D('17') },
      addOns: [
        {
          addOnId: 'a1',
          name: 'Lunch',
          unit: AddOnUnit.FLAT,
          quantity: 1,
          unitPrice: D('30'),
        },
      ],
    });
    // Full booking total (master booking_total_eur): 209.97 + 51 + 30 = 290.97 -> ceil 291.
    expect(p.totalRetail.toString()).toBe('291');
    expect(p.totalEur?.toString()).toBe('291');
    // Commission = 20% of the TOUR price only (209.97 -> 41.99), never of extras.
    expect(p.commissionAmount?.toString()).toBe('41.99');
  });

  it('PAID_IN_FULL still charges tour + extras entirely up front', () => {
    const p = compute({
      paymentModel: PaymentModel.PAID_IN_FULL,
      pickup: { unitPrice: D('17') },
    });
    expect(p.depositAmount.toString()).toBe('261');
    expect(p.balanceAmount.toString()).toBe('0');
  });

  it('converts the pickup line to booking currency like every other line', () => {
    const p = compute({
      sourceCurrency: Currency.USD,
      bookingCurrency: Currency.EUR,
      sourceFxRateToBooking: D('0.9'),
      pickup: { unitPrice: D('17') },
    });
    // pickup unit 17*0.9=15.30; total 15.30*3=45.90; base (converted) 188.97;
    // total 234.87 -> ceil 235
    expect(p.pickup?.unitPrice.toString()).toBe('15.3');
    expect(p.pickup?.totalPrice.toString()).toBe('45.9');
    expect(p.totalRetail.toString()).toBe('235');
    expect(p.sourceTotalRetail.toString()).toBe('261'); // 209.97 + 17*3 in USD
  });

  it('ignores a zero/free pickup (no line, no charge)', () => {
    const p = compute({ pickup: { unitPrice: D('0') } });
    expect(p.pickup).toBeNull();
    expect(p.totalRetail.toString()).toBe('210');
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
      sourceCurrency: Currency.EUR,
      bookingCurrency: Currency.EUR,
      sourceFxRateToBooking: D('1'),
      fxRateToEur: D('1'),
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
        sourceCurrency: Currency.EUR,
        bookingCurrency: Currency.EUR,
        sourceFxRateToBooking: D('1'),
        fxRateToEur: D('1'),
        paymentModel: PaymentModel.OPERATOR_LINK,
        depositPct: D('20'),
        commissionTier: D('20'),
      }),
    ).toThrow(/lines or unit/);
  });

  /**
   * The founder's two rules for converted money (2026-08-05):
   *   "round every euro amount up to a whole number ... Never down"
   *   "Round the total first, then derive the deposit and balance from it,
   *    so the lines add up"
   *
   * These are asserted as INVARIANTS rather than as fixed numbers, so a future
   * change to the rate, the deposit % or the extras rule cannot quietly
   * reintroduce cents or a total that its own two lines do not sum to.
   */
  describe('whole-unit retail (founder 2026-08-05)', () => {
    const isWhole = (d: { toString(): string }) => !d.toString().includes('.');

    const CASES: Array<[string, Parameters<typeof compute>[0]]> = [
      ['same currency', {}],
      [
        'USD -> EUR',
        {
          sourceCurrency: Currency.USD,
          bookingCurrency: Currency.EUR,
          sourceFxRateToBooking: D('0.9'),
          fxRateToEur: D('1'),
        },
      ],
      [
        'EUR -> USD with extras',
        {
          sourceCurrency: Currency.EUR,
          bookingCurrency: Currency.USD,
          sourceFxRateToBooking: D('1.1'),
          fxRateToEur: D('0.9'),
          pickup: { unitPrice: D('17') },
        },
      ],
      [
        'awkward rate (0.8637) - the case that produced 120.71',
        {
          sourceCurrency: Currency.USD,
          bookingCurrency: Currency.EUR,
          sourceFxRateToBooking: D('0.8637'),
          fxRateToEur: D('1'),
        },
      ],
    ];

    const MODELS = [
      PaymentModel.OPERATOR_LINK,
      PaymentModel.ON_ARRIVAL,
      PaymentModel.PAID_IN_FULL,
      PaymentModel.OPERATOR_FULL,
    ];

    for (const [name, over] of CASES) {
      for (const paymentModel of MODELS) {
        it(`${name} / ${paymentModel}: whole amounts that sum to the total`, () => {
          const p = compute({ ...over, paymentModel, depositPct: D('20') });

          expect(isWhole(p.totalRetail)).toBe(true);
          expect(isWhole(p.depositAmount)).toBe(true);
          expect(isWhole(p.balanceAmount)).toBe(true);
          expect(isWhole(p.sourceTotalRetail)).toBe(true);

          // The whole point of rounding the total FIRST.
          expect(
            p.depositAmount.plus(p.balanceAmount).toString(),
          ).toBe(p.totalRetail.toString());

          // Never down: the rounded total is at least the raw total, and less
          // than a whole unit above it.
          const raw = p.unitItems
            .reduce((acc, u) => acc.plus(u.priceRetail), D('0'))
            .plus(p.addOns.reduce((acc, a) => acc.plus(a.totalPrice), D('0')))
            .plus(p.pickup?.totalPrice ?? D('0'));
          expect(p.totalRetail.greaterThanOrEqualTo(raw)).toBe(true);
          expect(p.totalRetail.minus(raw).lessThan(1)).toBe(true);
        });
      }
    }

    it('leaves an already-whole total alone (no free unit)', () => {
      const p = compute({
        lines: [
          {
            ageBandId: 'ad',
            quantity: 2,
            priceRetail: D('50'),
            priceNet: null,
          },
        ],
        paymentModel: PaymentModel.PAID_IN_FULL,
      });
      expect(p.totalRetail.toString()).toBe('100');
    });
  });
});
