/**
 * Unit tests for BookingsService. Prisma is mocked; `$transaction(cb)` runs the
 * callback against the same mock so atomic seat-claim/release paths are exercised.
 */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentModel,
  Prisma,
  PricingModel,
  Role,
  TourBookingType,
  WholeUnitType,
} from '@prisma/client';
import { BookingsService } from './bookings.service';

const D = (v: string | number) => new Prisma.Decimal(v);
const PAST = new Date('2020-01-01T00:00:00.000Z');

/** A @db.Time(0) storage value (time-only, epoch day). */
function time(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}
/** A @db.Date storage value. */
function day(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function mockPrisma() {
  const p: any = {
    booking: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    tour: { findUnique: jest.fn() },
    departure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      // The atomic seat claim is a guarded `updateMany` (master §5); default = 1 row
      // matched (claim succeeds). Release runs through `update` (read-modify-write).
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tourAgeBand: { findMany: jest.fn() },
    tourAddOn: { findMany: jest.fn() },
    bookingUnitItem: { updateMany: jest.fn() },
    pickupLocation: { findUnique: jest.fn() },
    operator: { findUnique: jest.fn() },
  };
  p.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(p)
      : Promise.all(arg as []),
  );
  return p;
}

function fakeBooking(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    uuid: 'u1',
    displayRef: 'IT-2030-AAAA',
    publicRef: 'p1',
    tourId: 't1',
    departureId: 'dep1',
    operatorId: 'op1',
    userId: null,
    status: BookingStatus.ON_HOLD,
    freesale: false,
    utcExpiresAt: new Date('2030-06-05T08:00:00.000Z'),
    utcConfirmedAt: null,
    localDate: new Date('2030-06-05T00:00:00.000Z'),
    startTime: '09:00',
    currency: 'EUR',
    totalRetail: D('159.98'),
    totalNet: D('127.98'),
    depositAmount: D('31.99'),
    balanceAmount: D('127.99'),
    commissionRate: D('0.2'),
    commissionAmount: D('31.99'),
    paymentModel: PaymentModel.OPERATOR_LINK,
    exclusiveDeparture: false,
    cancellationRefund: null,
    cancelledBy: null,
    cancellationReason: null,
    unitItems: [
      {
        id: 'ui1',
        uuid: 'uui1',
        ageBandId: 'adult',
        status: BookingStatus.ON_HOLD,
        priceRetail: D('79.99'),
      },
      {
        id: 'ui2',
        uuid: 'uui2',
        ageBandId: 'adult',
        status: BookingStatus.ON_HOLD,
        priceRetail: D('79.99'),
      },
    ],
    ...over,
  };
}

function setupReserveContext(prisma: any, over: Record<string, unknown> = {}) {
  const m = prisma;
  m.booking.findUnique.mockResolvedValue(null);
  m.tour.findUnique.mockResolvedValue({
    operatorId: 'op1',
    timeZone: 'America/Curacao',
    bookingCutoffMinutes: 120,
    defaultCurrency: 'EUR',
    paymentModel: PaymentModel.OPERATOR_LINK,
    depositPct: D('20'),
    commissionTier: D('20'),
    minPartySize: 1,
    maxPartySize: 10,
    durationMinutesFrom: 480,
    minAgeYears: null,
    destination: { slug: 'curacao' },
    ...over,
  });
  m.pickupLocation.findUnique.mockResolvedValue({
    tourId: 't1',
    name: 'Marriott Beach Resort',
    address: 'Piscadera Bay, Willemstad',
  });
  m.departure.findFirst.mockResolvedValue({
    id: 'dep1',
    date: day('2030-06-05'),
    startTime: time('09:00'),
  });
  m.tourAgeBand.findMany.mockResolvedValue([
    {
      id: 'adult',
      label: 'Adult',
      price: D('79.99'),
      priceNet: D('63.99'),
    },
  ]);
  m.departure.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds (1 row)
  m.departure.findUnique.mockResolvedValue({
    capacity: 10,
    bookedCount: 2,
    status: 'OPEN',
    soldOutAt: null,
  });
  m.booking.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      fakeBooking({ status: data.status, utcExpiresAt: data.utcExpiresAt }),
  );
  // finalizeConfirmation re-reads via booking.update (conversion backfill).
  m.booking.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => fakeBooking(data),
  );
}

const reserveDto = {
  tourId: 't1',
  departureId: 'dep1',
  items: [{ ageBandId: 'adult', quantity: 2 }],
};

/**
 * Reserve context for a UNIT (whole-unit / charter) tour: no age bands, priced from
 * basePrice + per-guest surcharge. `over` tweaks the tour (e.g. bookingType, GROUP fields).
 */
function setupUnitReserveContext(
  prisma: any,
  over: Record<string, unknown> = {},
) {
  const m = prisma;
  m.booking.findUnique.mockResolvedValue(null);
  m.tour.findUnique.mockResolvedValue({
    operatorId: 'op1',
    timeZone: 'America/Curacao',
    bookingCutoffMinutes: 120,
    defaultCurrency: 'EUR',
    paymentModel: PaymentModel.OPERATOR_LINK,
    depositPct: D('20'),
    commissionTier: D('20'),
    minPartySize: 1,
    maxPartySize: 12,
    durationMinutesFrom: 180,
    minAgeYears: null,
    pricingModel: PricingModel.UNIT,
    wholeUnitType: WholeUnitType.BOAT,
    basePrice: D('1200'),
    unitIncludedGuests: null,
    extraPersonPrice: null,
    bookingType: TourBookingType.PRIVATE,
    destination: { slug: 'sint-maarten' },
    ...over,
  });
  m.departure.findFirst.mockResolvedValue({
    id: 'dep1',
    date: day('2030-06-05'),
    startTime: time('16:30'),
    capacity: 12,
    bookedCount: 0,
  });
  // Reserve re-reads capacity inside the txn to build the claim threshold.
  m.departure.findUnique.mockResolvedValue({
    capacity: 12,
    bookedCount: 0,
    status: 'OPEN',
    soldOutAt: null,
  });
  m.departure.updateMany.mockResolvedValue({ count: 1 });
  m.booking.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      fakeBooking({ status: data.status, utcExpiresAt: data.utcExpiresAt }),
  );
  m.booking.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => fakeBooking(data),
  );
}

/** Args of every guarded seat claim (`departure.updateMany`) that ran. */
function claimCalls(m: any): { where: any; data: any }[] {
  return m.departure.updateMany.mock.calls.map((c: any[]) => c[0]);
}

/** Args of every seat release / status write (`departure.update`) that ran. */
function releaseCalls(m: any): { where: any; data: any }[] {
  return m.departure.update.mock.calls.map((c: any[]) => c[0]);
}

const unitReserveDto = {
  tourId: 't1',
  departureId: 'dep1',
  guests: 6,
};

describe('BookingsService', () => {
  let prisma: any;
  let m: any;
  let mail: any;
  let tracking: any;
  let notifications: any;
  let tiers: any;
  let fx: any;
  let svc: BookingsService;

  beforeEach(() => {
    prisma = mockPrisma();
    m = prisma;
    mail = {
      sendBookingConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };
    tracking = { fireBookingComplete: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      emitAvailabilityUpdate: jest.fn(),
      emitBookingUpdate: jest.fn(),
    };
    // No active spotlight by default → effective rate = tour tier (0.20 in the mock).
    tiers = { effectiveCommissionRate: jest.fn().mockResolvedValue(0.2) };
    // Identity FX by default (same-currency, rate 1). Override per test for conversion.
    fx = {
      getRate: jest.fn().mockImplementation((from: any, to: any) =>
        Promise.resolve({
          baseCurrency: from,
          quoteCurrency: to,
          rate: D('1'),
          provider: 'same-currency',
          providerAsOf: PAST,
          fetchedAt: PAST,
          expiresAt: PAST,
        }),
      ),
    };
    svc = new BookingsService(prisma, mail, tracking, notifications, tiers, fx);
  });

  describe('reserve', () => {
    it('atomically claims seats and creates an ON_HOLD booking', async () => {
      setupReserveContext(prisma);
      const res = await svc.reserve(reserveDto);

      // The guarded count-up runs as one conditional updateMany (master §5).
      expect(m.departure.updateMany).toHaveBeenCalled();
      expect(m.booking.create).toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.ON_HOLD);
    });

    it('is idempotent - a prior booking with the same id is returned', async () => {
      setupReserveContext(prisma);
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      const res = await svc.reserve({ ...reserveDto, id: 'b1' });
      expect(res.id).toBe('b1');
      expect(m.booking.create).not.toHaveBeenCalled();
    });

    it('rejects when the atomic claim wins 0 rows (sold out)', async () => {
      setupReserveContext(prisma);
      m.departure.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects a party below the minimum size', async () => {
      setupReserveContext(prisma, { minPartySize: 5 });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects when the booking cutoff has passed', async () => {
      setupReserveContext(prisma);
      // A departure in the past is necessarily past its (live-computed) cutoff.
      m.departure.findFirst.mockResolvedValue({
        id: 'dep1',
        date: day('2020-01-01'),
        startTime: time('09:00'),
      });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects OPERATOR_FULL (dropped in v1 - would create an unpaid confirmed booking)', async () => {
      setupReserveContext(prisma, { paymentModel: PaymentModel.OPERATOR_FULL });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(m.booking.create).not.toHaveBeenCalled();
    });

    it('snapshots E.8 fields (tour window, pickup address, island, marketing opt-in)', async () => {
      setupReserveContext(prisma);
      await svc.reserve({
        ...reserveDto,
        pickupLocationId: 'pk1',
        newsletterOptIn: true,
      });
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.tourStartDateTime).toBeInstanceOf(Date);
      expect(data.tourEndDateTime).toBeInstanceOf(Date);
      // start + durationMinutesFrom (480) = end.
      expect(
        data.tourEndDateTime.getTime() - data.tourStartDateTime.getTime(),
      ).toBe(480 * 60_000);
      // Zone snapshot keeps cancellation/review math correct if the tour zone changes later.
      expect(data.tourTimeZone).toBe('America/Curacao');
      expect(data.pickupAddress).toBe('Piscadera Bay, Willemstad');
      expect(data.island).toBe('curacao');
      expect(data.newsletterOptIn).toBe(true);
      // Discount deferred (flaw #2): no client discount is ever written.
      expect(data.couponCode).toBeUndefined();
      expect(data.discountAmount).toBeUndefined();
    });

    it('persists per-seat travelerAge supplied on a reserve item', async () => {
      setupReserveContext(prisma);
      await svc.reserve({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2, travelerAge: 30 }],
      });
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.unitItems.create).toEqual([
        expect.objectContaining({ travelerAge: 30 }),
        expect.objectContaining({ travelerAge: 30 }),
      ]);
    });

    it('rejects a traveler below the tour minimum age', async () => {
      setupReserveContext(prisma, { minAgeYears: 12 });
      await expect(
        svc.reserve({
          tourId: 't1',
          departureId: 'dep1',
          items: [{ ageBandId: 'adult', quantity: 2, travelerAge: 8 }],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects an invalid pickupLocationId (wrong tour)', async () => {
      setupReserveContext(prisma);
      m.pickupLocation.findUnique.mockResolvedValue({
        tourId: 'OTHER',
        name: 'x',
        address: 'y',
      });
      await expect(
        svc.reserve({ ...reserveDto, pickupLocationId: 'pk1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('reserve (UNIT / charter)', () => {
    it('prices from basePrice + guests and creates one null-band item per guest', async () => {
      setupUnitReserveContext(prisma);
      await svc.reserve(unitReserveDto);
      const data = m.booking.create.mock.calls[0][0].data;
      // Flat BOAT charter: 6 guests still pay the flat basePrice 1200.
      expect(data.totalRetail.toString()).toBe('1200');
      expect(data.unitItems.create).toHaveLength(6);
      expect(
        data.unitItems.create.every((u: any) => u.ageBandId === null),
      ).toBe(true);
    });

    it('GROUP charter applies the per-guest surcharge beyond the included count', async () => {
      setupUnitReserveContext(prisma, {
        wholeUnitType: WholeUnitType.GROUP,
        basePrice: D('1450'),
        unitIncludedGuests: 10,
        extraPersonPrice: D('220'),
        maxPartySize: 12,
      });
      await svc.reserve({ ...unitReserveDto, guests: 12 });
      const data = m.booking.create.mock.calls[0][0].data;
      // 1450 + 2 extra * 220 = 1890
      expect(data.totalRetail.toString()).toBe('1890');
      expect(data.unitItems.create).toHaveLength(12);
    });

    it('PRIVATE unit claims the WHOLE departure (exclusive) and flags the booking', async () => {
      setupUnitReserveContext(prisma, { bookingType: TourBookingType.PRIVATE });
      await svc.reserve(unitReserveDto);
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.exclusiveDeparture).toBe(true);
      // The exclusive claim takes the WHOLE unit: it only matches a still-empty OPEN
      // departure and sets bookedCount to capacity (12), not the guest count.
      expect(
        claimCalls(m).some(
          (c) => c.where.bookedCount === 0 && c.data.bookedCount === 12,
        ),
      ).toBe(true);
    });

    it('SHARED unit consumes only the guest headcount (non-exclusive count-up)', async () => {
      setupUnitReserveContext(prisma, { bookingType: TourBookingType.SHARED });
      await svc.reserve(unitReserveDto);
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.exclusiveDeparture).toBe(false);
      // Shared: guarded count-up by the guest headcount, never a whole-unit claim.
      expect(
        claimCalls(m).some((c) => c.data.bookedCount?.increment !== undefined),
      ).toBe(true);
    });

    it('rejects age-band items on a unit tour', async () => {
      setupUnitReserveContext(prisma);
      await expect(svc.reserve({ ...reserveDto })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects a unit reserve with no guests count', async () => {
      setupUnitReserveContext(prisma);
      await expect(
        svc.reserve({ tourId: 't1', departureId: 'dep1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a guests count above the maximum party size', async () => {
      setupUnitReserveContext(prisma, { maxPartySize: 4 });
      await expect(
        svc.reserve({ ...unitReserveDto, guests: 6 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('quote', () => {
    it('prices a per-person booking with a per-band breakdown and no side effects', async () => {
      setupReserveContext(prisma);
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
      });
      // 2 adults * 79.99 = 159.98.
      expect(res.totalRetail).toBe('159.98');
      expect(res.pax).toBe(2);
      expect(res.paymentModel).toBe(PaymentModel.OPERATOR_LINK);
      expect(res.currency).toBe('EUR');
      expect(res.tourCurrency).toBe('EUR');
      expect(res.sourceTotalRetail).toBe(res.totalRetail);
      expect(res.sourceFxRateToBooking).toBe('1');
      expect(res.commissionRate).toBe('0.2');
      expect(res.lines).toEqual([
        {
          kind: 'participant',
          ageBandId: 'adult',
          label: 'Adult',
          quantity: 2,
          unitPrice: '79.99',
          lineTotal: '159.98',
        },
      ]);
      expect(res.quoteId).toEqual(expect.any(String));
      expect(res.expiresAt).toEqual(expect.any(String));
      // A quote is a preview: it never claims seats or writes a booking.
      expect(m.departure.updateMany).not.toHaveBeenCalled();
      expect(m.booking.create).not.toHaveBeenCalled();
    });

    it('applies the OPERATOR_LINK deposit split to the quote', async () => {
      setupReserveContext(prisma);
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
      });
      // 20% of 159.98 = 31.996 -> 32.00; balance = 127.98.
      expect(res.depositAmount).toBe('32');
      expect(res.balanceAmount).toBe('127.98');
    });

    it('prices a flat UNIT charter (basePrice, one line, pax = guests)', async () => {
      setupUnitReserveContext(prisma);
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        guests: 6,
      });
      expect(res.totalRetail).toBe('1200');
      expect(res.pax).toBe(6);
      expect(res.lines).toEqual([
        {
          kind: 'participant',
          ageBandId: null,
          label: 'Boat charter',
          quantity: 6,
          unitPrice: '1200',
          lineTotal: '1200',
        },
      ]);
    });

    it('applies the GROUP surcharge beyond the included count in a UNIT quote', async () => {
      setupUnitReserveContext(prisma, {
        wholeUnitType: WholeUnitType.GROUP,
        basePrice: D('1450'),
        unitIncludedGuests: 10,
        extraPersonPrice: D('220'),
        maxPartySize: 12,
      });
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        guests: 12,
      });
      // 1450 + 2 extra * 220 = 1890.
      expect(res.totalRetail).toBe('1890');
      expect(res.lines[0].label).toBe('Group charter');
      expect(res.lines[0].lineTotal).toBe('1890');
    });

    it('rejects a party below the minimum size (validated, not priced)', async () => {
      setupReserveContext(prisma, { minPartySize: 5 });
      await expect(
        svc.quote({
          tourId: 't1',
          departureId: 'dep1',
          items: [{ ageBandId: 'adult', quantity: 2 }],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('multi-currency (FX)', () => {
    // USD source -> EUR booking at 0.9; EUR->EUR at 1.
    function convertingFx() {
      fx.getRate.mockImplementation((from: any, to: any) =>
        Promise.resolve({
          baseCurrency: from,
          quoteCurrency: to,
          rate: from === to ? D('1') : D('0.9'),
          provider: from === to ? 'same-currency' : 'static-dev',
          providerAsOf: PAST,
          fetchedAt: PAST,
          expiresAt: PAST,
        }),
      );
    }

    it('quote: USD tour + EUR shopper returns EUR totals with a USD source snapshot', async () => {
      setupReserveContext(prisma, { defaultCurrency: 'USD' });
      convertingFx();
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
        currency: 'EUR',
      });
      expect(res.currency).toBe('EUR');
      expect(res.tourCurrency).toBe('USD');
      expect(res.sourceFxRateToBooking).toBe('0.9');
      // 79.99*0.9=71.99 (x2) = 143.98 EUR; source stays 159.98 USD.
      expect(res.totalRetail).toBe('143.98');
      expect(res.sourceTotalRetail).toBe('159.98');
      expect(res.lines[0].unitPrice).toBe('71.99');
    });

    it('reserve: USD tour + EUR shopper charges EUR and snapshots the source/rate', async () => {
      setupReserveContext(prisma, { defaultCurrency: 'USD' });
      convertingFx();
      await svc.reserve({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
        currency: 'EUR',
      });
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.currency).toBe('EUR');
      expect(data.totalRetail.toString()).toBe('143.98');
      expect(data.sourceCurrency).toBe('USD');
      expect(data.sourceTotalRetail.toString()).toBe('159.98');
      expect(data.sourceFxRateToBooking.toString()).toBe('0.9');
      expect(data.sourceFxProvider).toBe('static-dev');
    });

    it('reserve: defaults booking currency to the tour currency when none given', async () => {
      setupReserveContext(prisma, { defaultCurrency: 'USD' });
      convertingFx();
      await svc.reserve({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
      });
      const data = m.booking.create.mock.calls[0][0].data;
      // No dto.currency -> booking currency == source (USD), rate 1.
      expect(data.currency).toBe('USD');
      expect(data.sourceFxRateToBooking.toString()).toBe('1');
      expect(data.totalRetail.toString()).toBe('159.98');
    });
  });

  describe('cancel (exclusive charter)', () => {
    it('frees the WHOLE departure when releasing an exclusive booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          exclusiveDeparture: true,
        }),
      );
      m.tour.findUnique.mockResolvedValue({
        cancellationHours: 48,
        timeZone: 'America/Curacao',
      });
      m.departure.findUnique.mockResolvedValue({
        capacity: 12,
        bookedCount: 12,
        status: 'SOLD_OUT',
        soldOutAt: new Date('2030-06-04T00:00:00.000Z'),
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED }),
      );
      await svc.cancel('b1', {});
      // Release resets the fill to zero rather than counting down the headcount.
      expect(releaseCalls(m).some((c) => c.data.bookedCount === 0)).toBe(true);
    });
  });

  describe('confirm', () => {
    it('transitions ON_HOLD → CONFIRMED and persists contact', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      m.booking.update.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          utcConfirmedAt: new Date(),
        }),
      );
      const res = await svc.confirm('b1', {
        contact: { firstName: 'Ada', lastName: 'Byron', email: 'ada@x.io' },
      });
      expect(res.status).toBe(BookingStatus.CONFIRMED);
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CONFIRMED,
            contactEmail: 'ada@x.io',
            contactFullName: 'Ada Byron',
          }),
        }),
      );
    });

    it('rejects confirming an expired hold', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ utcExpiresAt: PAST }),
      );
      await expect(
        svc.confirm('b1', {
          contact: { firstName: 'A', lastName: 'B', email: 'a@b.io' },
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('is idempotent when already CONFIRMED', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
      );
      const res = await svc.confirm('b1', {
        contact: { firstName: 'A', lastName: 'B', email: 'a@b.io' },
      });
      expect(res.status).toBe(BookingStatus.CONFIRMED);
      expect(m.booking.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('releases seats and grants a FULL refund outside the cancellation window', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
      );
      m.tour.findUnique.mockResolvedValue({
        cancellationHours: 48,
        timeZone: 'America/Curacao',
      });
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 0,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );

      const res = await svc.cancel('b1', {});
      // Seats are released via the clamped count-down (master §3).
      expect(m.departure.update).toHaveBeenCalled();
      expect(res.cancellationRefund).toBe('FULL');
    });

    it('judges the refund window at the request instant, not the admin action time', async () => {
      // Tour departs 2030-06-05 09:00 Curaçao; free-cancel window is 48h before.
      const setup = () => {
        m.booking.findUnique.mockResolvedValue(
          fakeBooking({
            status: BookingStatus.CONFIRMED,
            tourTimeZone: 'America/Curacao',
          }),
        );
        m.tour.findUnique.mockResolvedValue({
          cancellationHours: 48,
          timeZone: 'America/Curacao',
        });
        m.departure.findUnique.mockResolvedValue({
          capacity: 10,
          bookedCount: 1,
          status: 'OPEN',
          soldOutAt: null,
        });
        m.booking.update.mockImplementation(({ data }: any) =>
          Promise.resolve(fakeBooking({ ...data })),
        );
      };

      // Requested ~73h before start → inside the free window → FULL, even though
      // the departure is only days away in local time.
      setup();
      const early = await svc.cancel('b1', {
        requestedAt: '2030-06-02T12:00:00.000Z',
      });
      expect(early.cancellationRefund).toBe('FULL');

      // Requested ~13h before start → past the 48h window → NONE.
      setup();
      const late = await svc.cancel('b1', {
        requestedAt: '2030-06-05T00:00:00.000Z',
      });
      expect(late.cancellationRefund).toBe('NONE');
    });

    it('refunds NONE for an on-hold cancellation (no payment taken)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.ON_HOLD }),
      );
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 0,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'NONE',
        }),
      );
      const res = await svc.cancel('b1', {});
      expect(res.cancellationRefund).toBe('NONE');
    });

    it('rejects cancelling an already-redeemed booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.REDEEMED }),
      );
      await expect(svc.cancel('b1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('extend', () => {
    it('pushes the hold window for an ON_HOLD booking', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      m.booking.update.mockResolvedValue(fakeBooking());
      await svc.extend('b1', { expirationMinutes: 30 });
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ utcExpiresAt: expect.any(Date) }),
        }),
      );
    });

    it('refuses to extend a confirmed booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
      );
      await expect(svc.extend('b1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('expireStaleHolds', () => {
    it('expires lapsed holds and restores their seats', async () => {
      m.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          departureId: 'dep1',
          tourId: 't1',
          localDate: new Date('2030-06-05T00:00:00.000Z'),
          operatorId: 'op1',
          publicRef: 'p1',
          _count: { unitItems: 2 },
        },
      ]);
      m.tour.findUnique.mockResolvedValue({ timeZone: 'America/Curacao' });
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 2,
        status: 'SOLD_OUT',
        soldOutAt: new Date('2030-06-04T00:00:00.000Z'),
      });
      const count = await svc.expireStaleHolds();
      expect(count).toBe(1);
      // Seats released via the clamped count-down; SOLD_OUT departure reopens to OPEN.
      expect(m.departure.update).toHaveBeenCalled();
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.EXPIRED } }),
      );
    });
  });

  describe('getById (auth scoping)', () => {
    it('allows the owning operator', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });
      const res = await svc.getById('b1', {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });
      expect(res.id).toBe('b1');
    });

    it('forbids an operator who does not own the booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ operatorId: 'opX' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.getById('b1', { id: 'u1', role: Role.TOUR_OPERATOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the booking owner (user)', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ userId: 'u9' }));
      const res = await svc.getById('b1', { id: 'u9', role: Role.USER });
      expect(res.id).toBe('b1');
    });

    it('404s an unknown booking', async () => {
      m.booking.findUnique.mockResolvedValue(null);
      await expect(
        svc.getById('nope', { id: 'u1', role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getThankYou party lines', () => {
    const typBooking = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Ripon',
        contactLastName: 'Mia',
        contactFullName: null,
        contactPhone: null,
        pickupRequested: false,
        tourStartDateTime: null,
        tourTimeZone: null,
        paymentMethodBrand: null,
        paymentMethodLast4: null,
        operator: null,
        ...over,
      });

    const item = (ageBandId: string | null) => ({
      id: `ui-${Math.abs(String(ageBandId).length)}-${ageBandId ?? 'null'}`,
      ageBandId,
    });

    it('labels an age-band-less (UNIT-priced) party with the SINGULAR "Guest"', async () => {
      // Regression: 'Guests' here rendered as "4 guestss" on the TYP - the client
      // pluralises the label, so the contract is singular.
      m.booking.findUnique.mockResolvedValue(
        typBooking({
          unitItems: [item(null), item(null), item(null), item(null)],
          tour: { name: 'Charter', ageBands: [], cancellationHours: 48 },
        }),
      );

      const res = await svc.getThankYou('p1');
      expect(res.party).toEqual([
        { ageBandId: null, label: 'Guest', quantity: 4 },
      ]);
    });

    it('groups age bands by their operator label', async () => {
      m.booking.findUnique.mockResolvedValue(
        typBooking({
          unitItems: [item('ab1'), item('ab1'), item('ab2')],
          tour: {
            name: 'Day Trip',
            ageBands: [
              { id: 'ab1', label: 'Adult' },
              { id: 'ab2', label: 'Child' },
            ],
            cancellationHours: 48,
          },
        }),
      );

      const res = await svc.getThankYou('p1');
      expect(res.party).toEqual([
        { ageBandId: 'ab1', label: 'Adult', quantity: 2 },
        { ageBandId: 'ab2', label: 'Child', quantity: 1 },
      ]);
    });

    it('falls back to the singular "Traveler" for an unknown band id', async () => {
      m.booking.findUnique.mockResolvedValue(
        typBooking({
          unitItems: [item('gone')],
          tour: { name: 'T', ageBands: [], cancellationHours: 48 },
        }),
      );

      const res = await svc.getThankYou('p1');
      expect(res.party).toEqual([
        { ageBandId: 'gone', label: 'Traveler', quantity: 1 },
      ]);
    });
  });

  // TYP "Don't see it? Check spam, or Resend email".
  describe('resendConfirmation', () => {
    const confirmed = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Shahadat',
        island: 'curacao',
        ...over,
      });

    it('resends to the address stored on the booking', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.tour.findUnique.mockResolvedValue({ name: 'Klein Curacao Day Trip' });

      await expect(svc.resendConfirmation('p1')).resolves.toEqual({
        sent: true,
      });

      expect(mail.sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
      const [to, props] = mail.sendBookingConfirmationEmail.mock.calls[0];
      // The recipient must come from the record, never from the caller - this is
      // what stops a @Public endpoint being an open relay.
      expect(to).toBe('guest@example.test');
      expect(props.displayRef).toBe('IT-2030-AAAA');
      expect(props.tourTitle).toBe('Klein Curacao Day Trip');
    });

    it('looks the booking up by publicRef, not id', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.tour.findUnique.mockResolvedValue({ name: 'T' });
      await svc.resendConfirmation('p1');
      expect(m.booking.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publicRef: 'p1' } }),
      );
    });

    it('404s an unknown publicRef', async () => {
      m.booking.findUnique.mockResolvedValue(null);
      await expect(svc.resendConfirmation('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    it.each([
      ['ON_HOLD', BookingStatus.ON_HOLD],
      ['CANCELLED', BookingStatus.CANCELLED],
      ['EXPIRED', BookingStatus.EXPIRED],
    ])('409s a %s booking and sends nothing', async (_label, status) => {
      m.booking.findUnique.mockResolvedValue(confirmed({ status }));
      await expect(svc.resendConfirmation('p1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      // A cancelled booking must never re-emit "You're booked".
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    it('422s when the booking has no contact email', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed({ contactEmail: null }));
      await expect(svc.resendConfirmation('p1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    it('propagates a send failure (unlike confirm, which swallows it)', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.tour.findUnique.mockResolvedValue({ name: 'T' });
      mail.sendBookingConfirmationEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );
      // The traveler asked - a silent success would be a lie.
      await expect(svc.resendConfirmation('p1')).rejects.toThrow('smtp down');
    });
  });
});
