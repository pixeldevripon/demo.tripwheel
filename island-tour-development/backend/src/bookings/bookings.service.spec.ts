/**
 * Unit tests for BookingsService. Prisma is mocked; `$transaction(cb)` runs the
 * callback against the same mock so atomic seat-claim/release paths are exercised.
 */
// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (the service now imports CustomerProvisioningService,
// which reaches auth.instance; same approach as staff/operators specs).
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: jest.fn() },
      internalAdapter: {
        createUser: jest.fn(),
        linkAccount: jest.fn(),
        deleteUser: jest.fn(),
      },
    }),
    api: { requestPasswordReset: jest.fn() },
  },
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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
import { issueTravelerSession } from './traveler-session.util';

// traveler-session.util signs with TRAVELER_SESSION_SECRET (falling back to
// BETTER_AUTH_SECRET) - give the suite a deterministic one.
process.env.TRAVELER_SESSION_SECRET =
  'unit-test-traveler-secret-0123456789abcdef';

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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      // Atomic ON_HOLD->CONFIRMED + conversionFiredAt guards; default = this
      // caller wins the flip (count 1). Override to { count: 0 } to simulate
      // losing a race with the concurrent webhook/settle caller.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    tour: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    // The confirmation email reads site branding (logo + WhatsApp). Default to the
    // singleton being absent: the template's wordmark/no-WhatsApp fallbacks are the
    // correct render then, and no test should depend on real settings rows.
    siteInfo: { findFirst: jest.fn().mockResolvedValue(null) },
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
    // Customer summary reads the payment ledger per currency; confirm()
    // verifies the amount due was captured. Default = fully paid so the
    // transition tests exercise the transition, not the payment gate (the
    // gate has its own tests overriding this to unpaid).
    payment: {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: D('999999') } }),
    },
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
  let lookupLimiter: any;
  let targetLimiter: any;
  let customerProvisioning: any;
  let svc: BookingsService;

  beforeEach(() => {
    prisma = mockPrisma();
    m = prisma;
    mail = {
      sendBookingConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendOperatorBookingReceivedEmail: jest.fn().mockResolvedValue(undefined),
      sendCancellationRequestEmail: jest.fn().mockResolvedValue(undefined),
      sendBookingNoticeEmail: jest.fn().mockResolvedValue(undefined),
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
    lookupLimiter = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };
    targetLimiter = { consume: jest.fn() };
    customerProvisioning = {
      provisionForBooking: jest.fn().mockResolvedValue(undefined),
      recomputeAggregates: jest.fn().mockResolvedValue(undefined),
    };
    svc = new BookingsService(
      prisma,
      mail,
      tracking,
      notifications,
      tiers,
      fx,
      lookupLimiter,
      targetLimiter,
      customerProvisioning,
    );
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

    // reserve is @Public but AuthGuard still attaches a session, so whoever is
    // logged into the browser reaches this. Only a customer session may own a
    // booking - an admin/operator testing checkout is not the traveller, and
    // stamping them hides the booking from the real customer's dashboard.
    it('records a Role.USER session as the booking owner', async () => {
      setupReserveContext(prisma);
      await svc.reserve(reserveDto, { id: 'cust-1', role: Role.USER });
      expect(m.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'cust-1' }),
        }),
      );
    });

    it.each([Role.ADMIN, Role.TOUR_OPERATOR, Role.STAFF])(
      'never stamps a %s session as the booking owner',
      async (role) => {
        setupReserveContext(prisma);
        await svc.reserve(reserveDto, { id: 'ops-1', role });
        expect(m.booking.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ userId: null }),
          }),
        );
      },
    );

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
      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });
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

    it('402s an unpaid confirm - a raw booking id is not a free-confirmation capability', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      m.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      await expect(
        svc.confirm('b1', {
          contact: { firstName: 'A', lastName: 'B', email: 'a@b.io' },
        }),
      ).rejects.toMatchObject({ status: 402 });
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('402s a deposit paid short of the amount due', async () => {
      // Fixture: OPERATOR_LINK, depositAmount 31.99 - 10.00 captured is short.
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      m.payment.aggregate.mockResolvedValue({ _sum: { amount: D('10.00') } });
      await expect(
        svc.confirm('b1', {
          contact: { firstName: 'A', lastName: 'B', email: 'a@b.io' },
        }),
      ).rejects.toMatchObject({ status: 402 });
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

      const res = await svc.cancel(
        'b1',
        {},
        { id: 'admin-1', role: Role.ADMIN },
      );
      // Seats are released via the clamped count-down (master §3).
      expect(m.departure.update).toHaveBeenCalled();
      expect(res.cancellationRefund).toBe('FULL');
    });

    // The request ack promises "We'll email you to confirm once it's done".
    // Nothing used to send it, so a processed request reached the traveller as
    // silence.
    it('emails the traveller and the operator once the cancellation is processed', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          utcConfirmedAt: new Date('2026-07-01T00:00:00Z'),
          contactEmail: 'guest@example.test',
          publicRef: 'p1',
          island: 'curacao',
          operatorId: 'op1',
          customerLocale: 'en',
        }),
      );
      m.tour.findUnique.mockResolvedValue({
        name: 'Sunset Cruise',
        cancellationHours: 48,
        timeZone: 'America/Curacao',
      });
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 1,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.operator.findUnique.mockResolvedValue({
        contactEmail: 'supplier@op.test',
        companyInfo: {
          companyEmail: 'office@op.test',
          companyName: 'Miss Ann',
        },
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
          contactEmail: 'guest@example.test',
          publicRef: 'p1',
          island: 'curacao',
          operatorId: 'op1',
          customerLocale: 'en',
        }),
      );

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(mail.sendBookingNoticeEmail).toHaveBeenCalledTimes(2);
      const [travellerCall, operatorCall] =
        mail.sendBookingNoticeEmail.mock.calls;
      expect(travellerCall[0]).toBe('guest@example.test');
      expect(travellerCall[2].noticeTitle).toContain(
        'Your booking is cancelled',
      );
      // Company inbox first, same precedence as the request-time heads-up.
      expect(operatorCall[0]).toBe('office@op.test');
      expect(operatorCall[2].noticeTitle).toContain('Cancellation confirmed');
    });

    // Releasing an abandoned checkout hold is inventory housekeeping - nobody
    // ever confirmed anything, so nobody should get mail about it.
    it('sends nothing when releasing a hold that never confirmed', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.ON_HOLD,
          utcConfirmedAt: null,
          contactEmail: 'guest@example.test',
        }),
      );
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 0,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED }),
      );

      await svc.cancel('b1', {});

      expect(mail.sendBookingNoticeEmail).not.toHaveBeenCalled();
    });

    // The seats are already back in inventory by the time we mail anyone - a
    // dead mailbox must not surface to the admin as a failed cancellation.
    it('still cancels when the confirmation emails fail', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          utcConfirmedAt: new Date('2026-07-01T00:00:00Z'),
          contactEmail: 'guest@example.test',
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
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED }),
      );
      mail.sendBookingNoticeEmail.mockRejectedValue(new Error('smtp down'));

      await expect(
        svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN }),
      ).resolves.toBeDefined();
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
      const early = await svc.cancel(
        'b1',
        { requestedAt: '2030-06-02T12:00:00.000Z' },
        { id: 'admin-1', role: Role.ADMIN },
      );
      expect(early.cancellationRefund).toBe('FULL');

      // Requested ~13h before start → past the 48h window → NONE.
      setup();
      const late = await svc.cancel(
        'b1',
        { requestedAt: '2030-06-05T00:00:00.000Z' },
        { id: 'admin-1', role: Role.ADMIN },
      );
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
      await expect(
        svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Authorization outranks the status check: a 409 naming the status would
    // tell an anonymous caller what state someone else's booking is in.
    it('401s (not 409) an anonymous cancel of a redeemed booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.REDEEMED }),
      );
      await expect(svc.cancel('b1', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('401s an anonymous (or customer) cancel of a CONFIRMED booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
      );
      await expect(svc.cancel('b1', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        svc.cancel('b1', {}, { id: 'cust-1', role: Role.USER }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it("404s an operator cancelling ANOTHER operator's booking - no existence oracle", async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED, operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op-other' });
      await expect(
        svc.cancel('b1', {}, { id: 'user-9', role: Role.TOUR_OPERATOR }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // The idempotent CANCELLED early-return must sit BELOW the gate, or a raw
    // id alone hands an anonymous caller the whole booking payload.
    it('401s an anonymous re-cancel of a booking that was cancelled after confirming', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          utcConfirmedAt: new Date('2026-06-01T00:00:00Z'),
        }),
      );
      await expect(svc.cancel('b1', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('stays idempotent for an already-released hold (never confirmed)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          utcConfirmedAt: null,
        }),
      );
      const res = await svc.cancel('b1', {});
      expect(res.id).toBe('b1');
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('withholds commission from the traveler-facing cancel payload', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED, utcConfirmedAt: null }),
      );
      const res = await svc.cancel('b1', {});
      expect(res.commissionRate).toBeNull();
      expect(res.commissionAmount).toBeNull();
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

  // The /bookings pair login (master 6.4): credential caps + session issuance.
  describe('lookupBooking', () => {
    const dto = { email: 'guest@example.test', reference: 'IT-2030-AAAA' };

    it('returns TYP coordinates plus a session token owning the looked-up email', async () => {
      m.booking.findFirst.mockResolvedValue({
        publicRef: 'p1',
        displayRef: 'IT-2030-AAAA',
        tour: { destination: { slug: 'curacao' } },
      });

      const res = await svc.lookupBooking(dto, '1.2.3.4');

      expect(res.publicRef).toBe('p1');
      expect(lookupLimiter.assertAllowed).toHaveBeenCalledWith(
        dto.email,
        dto.reference,
        '1.2.3.4',
      );
      expect(lookupLimiter.recordSuccess).toHaveBeenCalled();
      // The token must satisfy the TYP ownership check for this email.
      const typ = typBookingFor('guest@example.test');
      m.booking.findUnique.mockResolvedValue(typ);
      const page = await svc.getThankYou('p1', res.sessionToken);
      expect(page.verified).toBe(true);
    });

    it('records the failure and stays enumeration-proof on a mismatch', async () => {
      m.booking.findFirst.mockResolvedValue(null);
      await expect(svc.lookupBooking(dto, '1.2.3.4')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(lookupLimiter.recordFailure).toHaveBeenCalledWith(
        dto.email,
        dto.reference,
        '1.2.3.4',
      );
      expect(lookupLimiter.recordSuccess).not.toHaveBeenCalled();
    });

    function typBookingFor(email: string) {
      return fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: email,
        tour: { name: 'T', ageBands: [], cancellationHours: 48 },
        tourStartDateTime: null,
        tourTimeZone: null,
        operator: null,
      });
    }
  });

  // Bare-link vs verified-session payloads (master 8.2: the publicRef URL is
  // a permanent VIEWING capability; identity renders only for the owner).
  describe('getThankYou verification & masking', () => {
    const typBooking = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Ripon',
        contactLastName: 'Mia',
        contactFullName: null,
        contactPhone: '+599 9 123 4567',
        pickupAddress: 'Marriott Beach Resort, Piscadera Bay',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
        tour: { name: 'T', ageBands: [], cancellationHours: 48 },
        tourStartDateTime: null,
        tourTimeZone: null,
        operator: {
          contactEmail: 'op@op.test',
          contactPhone: '+100000000',
          companyInfo: {
            companyName: 'Op',
            companyEmail: 'co@op.test',
            companyPhone: '+200000000',
          },
        },
      });

    it('withholds ALL identity on a bare link (no session) - null, not masked', async () => {
      m.booking.findUnique.mockResolvedValue(typBooking());
      const res = await svc.getThankYou('p1');

      expect(res.verified).toBe(false);
      // Guest + traveler contact: withheld entirely.
      expect(res.contactEmail).toBeNull();
      expect(res.contactPhone).toBeNull();
      expect(res.guestFirstName).toBeNull();
      expect(res.guestLastName).toBeNull();
      expect(res.guestFullName).toBeNull();
      // Operator direct support contact: withheld (name stays - it's public).
      expect(res.operator.email).toBeNull();
      expect(res.operator.phone).toBeNull();
      expect(res.operator.name).toBe('Op'); // public business name still shown
      // Pickup + card: withheld.
      expect(res.pickupAddress).toBeNull();
      expect(res.paymentMethodBrand).toBeNull();
      expect(res.paymentMethodLast4).toBeNull();
      // Non-identifying tour facts still present.
      expect(res.tourName).toBe('T');
      expect(res.partySize).toBeGreaterThan(0);
    });

    it("withholds identity for a session bound to someone ELSE's email", async () => {
      m.booking.findUnique.mockResolvedValue(typBooking());
      const res = await svc.getThankYou(
        'p1',
        issueTravelerSession('stranger@example.test'),
      );
      expect(res.verified).toBe(false);
      expect(res.contactEmail).toBeNull();
      expect(res.operator.email).toBeNull();
    });

    it('returns the full payload for the owning session (case-insensitive email)', async () => {
      m.booking.findUnique.mockResolvedValue(typBooking());
      const res = await svc.getThankYou(
        'p1',
        issueTravelerSession('Guest@Example.TEST'),
      );

      expect(res.verified).toBe(true);
      // Guest's own email is masked even for the verified owner (screenshots).
      expect(res.contactEmail).toBe('g•••@e•••.test');
      expect(res.contactPhone).toBe('+599 9 123 4567');
      expect(res.guestFirstName).toBe('Ripon');
      expect(res.guestLastName).toBe('Mia');
      expect(res.guestFullName).toBe('Ripon Mia');
      expect(res.operator.email).toBe('op@op.test');
      expect(res.operator.phone).toBe('+100000000');
      expect(res.pickupAddress).toBe('Marriott Beach Resort, Piscadera Bay');
      expect(res.paymentMethodLast4).toBe('4242');
    });
  });

  // The TYP used to ship no cancellation state at all, so it kept offering
  // "Cancel booking" to someone whose request was already pending, and showed
  // a green Confirmed chip on a booking an admin had already cancelled.
  describe('getThankYou cancellation state', () => {
    const typBooking = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        tour: { name: 'T', ageBands: [], cancellationHours: 48 },
        // Far-future start so DEPARTED never colours these cases.
        tourStartDateTime: new Date('2035-01-01T09:00:00Z'),
        tourTimeZone: 'America/Curacao',
        localDate: new Date('2035-01-01T00:00:00Z'),
        operator: null,
        ...over,
      });

    it('advertises a cancellable booking as requestable', async () => {
      m.booking.findUnique.mockResolvedValue(typBooking());
      const res = await svc.getThankYou('p1');
      expect(res.canRequestCancellation).toBe(true);
      expect(res.cancellationBlockedReason).toBeNull();
      expect(res.cancellationRequestedAt).toBeNull();
      expect(res.cancelledAt).toBeNull();
    });

    it('reports a pending request so the page stops offering the button', async () => {
      const requestedAt = new Date('2026-07-19T10:00:00Z');
      m.booking.findUnique.mockResolvedValue(
        typBooking({ utcCancellationRequestedAt: requestedAt }),
      );
      const res = await svc.getThankYou('p1');
      expect(res.canRequestCancellation).toBe(false);
      expect(res.cancellationBlockedReason).toBe('ALREADY_REQUESTED');
      expect(res.cancellationRequestedAt).toBe(requestedAt.toISOString());
    });

    it('reports a processed cancellation', async () => {
      const cancelledAt = new Date('2026-07-20T10:00:00Z');
      m.booking.findUnique.mockResolvedValue(
        typBooking({
          status: BookingStatus.CANCELLED,
          utcCancelledAt: cancelledAt,
          utcCancellationRequestedAt: new Date('2026-07-19T10:00:00Z'),
        }),
      );
      const res = await svc.getThankYou('p1');
      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(res.cancelledAt).toBe(cancelledAt.toISOString());
      expect(res.canRequestCancellation).toBe(false);
    });

    // A trip you have already taken cannot be cancelled - the page must not
    // offer it, and the endpoint refuses it.
    it('blocks a departed trip', async () => {
      m.booking.findUnique.mockResolvedValue(
        typBooking({
          tourStartDateTime: new Date('2020-01-01T09:00:00Z'),
          localDate: new Date('2020-01-01T00:00:00Z'),
        }),
      );
      const res = await svc.getThankYou('p1');
      expect(res.canRequestCancellation).toBe(false);
      expect(res.cancellationBlockedReason).toBe('DEPARTED');
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

  // Atomic, race-safe confirmation (settle-on-return vs the Stripe webhook can
  // both reach confirmFromPayment within the same second; exactly one must
  // emit emails + fire the conversion).
  describe('confirmFromPayment (race-safe)', () => {
    const confirmable = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED, // the re-read `current` after the flip
        contactEmail: 'guest@example.test',
        contactFirstName: 'Ada',
        contactFullName: 'Ada Byron',
        operatorId: 'op1',
        commissionRate: D('0.2'),
        commissionAmount: null,
        conversionFiredAt: null,
        currency: 'EUR',
        totalRetail: D('100'),
        ...over,
      });

    beforeEach(() => {
      m.operator.findUnique.mockResolvedValue({
        contactEmail: 'op@x.test',
        companyInfo: { companyEmail: 'co@x.test', companyName: 'Op' },
      });
      m.tour.findUnique.mockResolvedValue({
        name: 'Tour',
        destination: { slug: 'curacao' },
      });
    });

    it('the caller that WINS the flip fires the conversion + booking event once', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 }); // transition + guard both win
      m.booking.findUnique.mockResolvedValue(confirmable());

      await svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' });

      // Conversion + event emit are independent of the (swallowed) email sends.
      expect(tracking.fireBookingComplete).toHaveBeenCalledTimes(1);
      expect(notifications.emitBookingUpdate).toHaveBeenCalledTimes(1);
    });

    it('the caller that LOSES the status flip fires NO side effects (still backfills billing)', async () => {
      // Lost the ON_HOLD->CONFIRMED flip; the winner already stamped conversionFiredAt.
      m.booking.updateMany.mockResolvedValue({ count: 0 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({ conversionFiredAt: new Date('2030-01-01') }),
      );

      await svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' });

      expect(tracking.fireBookingComplete).not.toHaveBeenCalled();
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
      expect(notifications.emitBookingUpdate).not.toHaveBeenCalled();
      // The loser still backfills the card snapshot onto the confirmed row.
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentMethodLast4: '4242' }),
        }),
      );
    });

    it('won the flip but LOST the conversion guard -> no double conversion/email', async () => {
      m.booking.updateMany
        .mockResolvedValueOnce({ count: 1 }) // ON_HOLD -> CONFIRMED (won)
        .mockResolvedValueOnce({ count: 0 }); // conversionFiredAt guard (lost)
      m.booking.findUnique.mockResolvedValue(confirmable());

      await svc.confirmFromPayment('b1');

      expect(tracking.fireBookingComplete).not.toHaveBeenCalled();
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  // Dashboard list (DASH1/DASH3): filters, scoping, and the list-row mapping.
  describe('list (dashboard)', () => {
    const listRow = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        createdAt: new Date('2030-06-01T10:00:00.000Z'),
        tourStartDateTime: new Date('2030-06-05T09:00:00.000Z'),
        utcCancellationRequestedAt: null,
        contactFullName: 'Jane Doe',
        contactEmail: 'jane@example.test',
        tour: { name: 'Klein Curacao Day Trip', cancellationHours: 48 },
        payments: [], // included by list() for the paymentStatus derivation
        ...over,
      });

    it('maps the list row (tourName, partySize, deadline, window verdict)', async () => {
      prisma.booking.count.mockResolvedValue(1);
      prisma.booking.findMany.mockResolvedValue([
        // Requested 2030-06-02, deadline = start - 48h = 2030-06-03T09:00Z -> in window.
        listRow({
          utcCancellationRequestedAt: new Date('2030-06-02T12:00:00.000Z'),
        }),
      ]);
      const res = await svc.list({}, { id: 'admin-1', role: Role.ADMIN });
      expect(res.total).toBe(1);
      const row = res.data[0];
      expect(row.tourName).toBe('Klein Curacao Day Trip');
      expect(row.partySize).toBe(2);
      expect(row.contactFullName).toBe('Jane Doe');
      expect(row.freeCancelDeadline).toBe('2030-06-03T09:00:00.000Z');
      expect(row.requestedInFreeWindow).toBe(true);
    });

    it('scopes USER (customer) to their OWN bookings, never operator resolution', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list({}, { id: 'cust-1', role: Role.USER });
      const args = prisma.booking.findMany.mock.calls.at(-1)[0];
      expect(args.where.userId).toBe('cust-1');
      // A customer must never hit operator resolution (it would 4xx them).
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('nulls the commission snapshot on rows returned to a USER (customer)', async () => {
      prisma.booking.count.mockResolvedValue(1);
      prisma.booking.findMany.mockResolvedValue([
        listRow({ userId: 'cust-1', commissionRate: D('0.20') }),
      ]);
      const res = await svc.list({}, { id: 'cust-1', role: Role.USER });
      expect(res.data[0].commissionRate).toBeNull();
      expect(res.data[0].commissionAmount).toBeNull();

      // Operators/admins keep seeing it.
      const adminRes = await svc.list({}, { id: 'admin-1', role: Role.ADMIN });
      expect(adminRes.data[0].commissionRate).not.toBeNull();
    });

    it('judges an out-of-window request at the REQUEST instant (C23)', async () => {
      prisma.booking.count.mockResolvedValue(1);
      prisma.booking.findMany.mockResolvedValue([
        listRow({
          utcCancellationRequestedAt: new Date('2030-06-04T12:00:00.000Z'),
        }),
      ]);
      const res = await svc.list({}, { id: 'admin-1', role: Role.ADMIN });
      expect(res.data[0].requestedInFreeWindow).toBe(false);
    });

    it('applies search/paymentModel/cancellationRequested filters (queue = oldest first)', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list(
        {
          search: 'jane',
          paymentModel: PaymentModel.ON_ARRIVAL,
          cancellationRequested: true,
        },
        { id: 'admin-1', role: Role.ADMIN },
      );
      const args = prisma.booking.findMany.mock.calls.at(-1)[0];
      expect(args.where.paymentModel).toBe(PaymentModel.ON_ARRIVAL);
      expect(args.where.utcCancellationRequestedAt).toEqual({ not: null });
      expect(args.where.OR).toEqual(
        expect.arrayContaining([
          { displayRef: { contains: 'jane', mode: 'insensitive' } },
          { tour: { name: { contains: 'jane', mode: 'insensitive' } } },
        ]),
      );
      expect(args.orderBy).toEqual({ utcCancellationRequestedAt: 'asc' });
    });

    it('scopes TOUR_OPERATOR rows to their own operatorId', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-9' });
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list({}, { id: 'user-9', role: Role.TOUR_OPERATOR });
      const args = prisma.booking.findMany.mock.calls.at(-1)[0];
      expect(args.where.operatorId).toBe('op-9');
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

    /** The shape the confirmation-email loader selects (relations included). */
    const emailTour = (over: Record<string, unknown> = {}) => ({
      name: 'Klein Curacao Day Trip',
      slug: 'klein-curacao-day-trip',
      durationMinutesFrom: 540,
      cancellationHours: 48,
      checkInMinutesBefore: 30,
      meetingPointLat: null,
      meetingPointLng: null,
      destinationId: 'd1',
      destination: { name: 'Curacao', slug: 'curacao' },
      ageBands: [],
      images: [],
      languages: [],
      translations: [],
      locations: [],
      ...over,
    });

    it('resends to the address stored on the booking', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.tour.findUnique.mockResolvedValue(emailTour());

      await expect(svc.resendConfirmation('p1')).resolves.toEqual({
        sent: true,
      });

      expect(mail.sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
      const [to, subject, context] =
        mail.sendBookingConfirmationEmail.mock.calls[0];
      // The recipient must come from the record, never from the caller - this is
      // what stops a @Public endpoint being an open relay.
      expect(to).toBe('guest@example.test');
      expect(context.bookingRef).toBe('IT-2030-AAAA');
      expect(context.tourName).toBe('Klein Curacao Day Trip');
      expect(subject).toContain('Klein Curacao Day Trip');
    });

    it('looks the booking up by publicRef, not id', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.tour.findUnique.mockResolvedValue(emailTour());
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
      m.tour.findUnique.mockResolvedValue(emailTour());
      mail.sendBookingConfirmationEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );
      // The traveler asked - a silent success would be a lie.
      await expect(svc.resendConfirmation('p1')).rejects.toThrow('smtp down');
    });
  });

  // The tokenized /cancel/{publicRef} form (master 6.4/C1). It never cancels
  // anything itself: it emails the admin, who processes the refund.
  describe('update (contact ownership gate)', () => {
    const CONTACT = {
      firstName: 'Ada',
      lastName: 'Byron',
      email: 'new@example.test',
    };

    beforeEach(() => {
      m.booking.update.mockImplementation(({ data }: any) =>
        Promise.resolve(fakeBooking({ ...data })),
      );
    });

    it('sets the contact on an ON_HOLD booking with no session (checkout path)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.ON_HOLD }),
      );
      const res = await svc.update('b1', { contact: CONTACT });
      expect(res.sessionToken).toBeDefined();
    });

    it('401s a contact rewrite on a CONFIRMED booking without an owning session', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          contactEmail: 'guest@example.test',
        }),
      );
      await expect(
        svc.update('b1', { contact: CONTACT }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        svc.update(
          'b1',
          { contact: CONTACT },
          issueTravelerSession('stranger@example.test'),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('allows the owner (traveler session for the CURRENT contact) to update contact', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          contactEmail: 'guest@example.test',
        }),
      );
      await svc.update(
        'b1',
        { contact: CONTACT },
        issueTravelerSession('guest@example.test'),
      );
      expect(m.booking.update).toHaveBeenCalled();
    });

    it('leaves non-contact updates (notes/pickup) ungated on CONFIRMED', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
      );
      await svc.update('b1', { notes: 'gate 4' });
      expect(m.booking.update).toHaveBeenCalled();
    });
  });

  describe('requestCancellation', () => {
    const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    const confirmed = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Shahadat',
        utcCancellationRequestedAt: null,
        tour: { name: 'Klein Curacao Day Trip' },
        ...over,
      });

    /** A traveler session owning the fixture's contact email. */
    const ownerToken = () => issueTravelerSession('guest@example.test');

    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';
      m.booking.update.mockResolvedValue({});
    });

    afterAll(() => {
      process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    });

    it('emails the admin with the booking facts and the traveller note', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());

      await expect(
        svc.requestCancellation('p1', 'Cruise itinerary changed', ownerToken()),
      ).resolves.toEqual({ requested: true });

      expect(mail.sendCancellationRequestEmail).toHaveBeenCalledTimes(1);
      const [to, details] = mail.sendCancellationRequestEmail.mock.calls[0];
      expect(to).toBe('admin@islandtours.test');
      expect(details.displayRef).toBe('IT-2030-AAAA');
      expect(details.reason).toBe('Cruise itinerary changed');
      expect(details.guestEmail).toBe('guest@example.test');
    });

    it('stamps utcCancellationRequestedAt on the FIRST request, then refuses repeats', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      await svc.requestCancellation('p1', undefined, ownerToken());
      // Refund eligibility is judged at the instant the traveller asked (gap #16).
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { utcCancellationRequestedAt: expect.any(Date) },
        }),
      );

      m.booking.update.mockClear();
      mail.sendCancellationRequestEmail.mockClear();
      m.booking.findUnique.mockResolvedValue(
        confirmed({ utcCancellationRequestedAt: new Date('2026-07-01') }),
      );
      // A repeat submit is REFUSED, not waved through as idempotent: each one
      // used to re-send the admin email, the traveller ack and the operator
      // heads-up, so a single booking could spam three mailboxes on a loop.
      await expect(
        svc.requestCancellation('p1', undefined, ownerToken()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.booking.update).not.toHaveBeenCalled();
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('401s without a traveler session - link possession alone cannot cancel', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      await expect(
        svc.requestCancellation('p1', undefined, undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('401s a session bound to a DIFFERENT email - a leaked TYP link cannot cancel', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      await expect(
        svc.requestCancellation(
          'p1',
          undefined,
          issueTravelerSession('stranger@example.test'),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('404s an unknown publicRef', async () => {
      m.booking.findUnique.mockResolvedValue(null);
      await expect(svc.requestCancellation('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('409s a non-confirmed booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({ status: BookingStatus.CANCELLED }),
      );
      await expect(
        svc.requestCancellation('p1', undefined, ownerToken()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('acks the traveller and notifies the operator (best-effort, after the admin email)', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          publicRef: 'p1',
          island: 'curacao',
          operatorId: 'op1',
          customerLocale: 'en',
        }),
      );
      m.operator.findUnique.mockResolvedValue({
        contactEmail: 'supplier@op.test',
        companyInfo: {
          companyEmail: 'office@op.test',
          companyName: 'Miss Ann',
        },
      });

      await svc.requestCancellation('p1', 'Cruise changed', ownerToken());

      expect(mail.sendBookingNoticeEmail).toHaveBeenCalledTimes(2);
      const [travellerCall, operatorCall] =
        mail.sendBookingNoticeEmail.mock.calls;
      // Traveller ack goes to the booking's contact, and says it is in motion.
      expect(travellerCall[0]).toBe('guest@example.test');
      expect(travellerCall[2].noticeTitle).toContain(
        'We got your cancellation request',
      );
      // Operator heads-up goes to the COMPANY inbox first (founder decision).
      expect(operatorCall[0]).toBe('office@op.test');
      expect(operatorCall[2].noticeTitle).toContain('Cancellation requested');
    });

    it('still succeeds when the ack/notice sends fail - the admin already has it', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      mail.sendBookingNoticeEmail.mockRejectedValue(new Error('smtp down'));
      await expect(
        svc.requestCancellation('p1', undefined, ownerToken()),
      ).resolves.toEqual({
        requested: true,
      });
    });

    it('propagates a mail failure - a lost refund request must never look sent', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      mail.sendCancellationRequestEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );
      await expect(
        svc.requestCancellation('p1', undefined, ownerToken()),
      ).rejects.toThrow('smtp down');
    });

    it('503s when no admin inbox is configured instead of dropping the request', async () => {
      delete process.env.ADMIN_EMAIL;
      m.booking.findUnique.mockResolvedValue(confirmed());
      await expect(
        svc.requestCancellation('p1', undefined, ownerToken()),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });
  });

  describe('requestCancellationAsCustomer (dashboard /account)', () => {
    const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    const owned = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        utcCancellationRequestedAt: null,
        userId: 'u1',
        tour: { name: 'Klein Curacao Day Trip' },
        ...over,
      });

    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';
      m.booking.update.mockResolvedValue({});
    });

    afterAll(() => {
      process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    });

    it('submits for the owning customer - same downstream flow as the TYP route', async () => {
      m.booking.findUnique.mockResolvedValue(owned());
      await expect(
        svc.requestCancellationAsCustomer('b1', { id: 'u1' }, 'plans changed'),
      ).resolves.toEqual({ requested: true });
      expect(mail.sendCancellationRequestEmail).toHaveBeenCalledTimes(1);
    });

    it('404s (never 403s) a booking owned by someone else - no existence oracle', async () => {
      m.booking.findUnique.mockResolvedValue(owned({ userId: 'other-user' }));
      await expect(
        svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('404s an unlinked (guest) booking even for a logged-in customer', async () => {
      m.booking.findUnique.mockResolvedValue(owned({ userId: null }));
      await expect(
        svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s a non-confirmed booking through the shared core', async () => {
      m.booking.findUnique.mockResolvedValue(
        owned({ status: BookingStatus.CANCELLED }),
      );
      await expect(
        svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // You cannot ask to cancel a trip you have already taken. The start time
    // is a LOCAL wall clock, so these cases turn on the timezone snapshot.
    describe('departed trips', () => {
      const PAST = new Date('2020-01-01T10:00:00');
      const FUTURE = new Date('2999-01-01T10:00:00');

      it('409s a first request once the trip has started', async () => {
        m.booking.findUnique.mockResolvedValue(
          owned({
            tourStartDateTime: PAST,
            tourTimeZone: 'America/Curacao',
          }),
        );
        await expect(
          svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
      });

      it('allows a request for a trip still in the future', async () => {
        m.booking.findUnique.mockResolvedValue(
          owned({
            tourStartDateTime: FUTURE,
            tourTimeZone: 'America/Curacao',
          }),
        );
        await expect(
          svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
        ).resolves.toEqual({ requested: true });
      });

      // Legacy rows: a wall clock with no zone is not an instant, so we fall
      // back to the travel DAY and only block once it has ended everywhere.
      it('allows a request when the start has no timezone and the day is not long past', async () => {
        m.booking.findUnique.mockResolvedValue(
          owned({
            tourStartDateTime: PAST,
            tourTimeZone: null,
            localDate: new Date(Date.now() - 2 * 3_600_000),
          }),
        );
        await expect(
          svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
        ).resolves.toEqual({ requested: true });
      });

      it('409s a zoneless booking whose travel day ended everywhere', async () => {
        m.booking.findUnique.mockResolvedValue(
          owned({
            tourStartDateTime: null,
            tourTimeZone: null,
            localDate: new Date(Date.now() - 5 * 24 * 3_600_000),
          }),
        );
        await expect(
          svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      // A departed trip that ALREADY has a request is refused like any other
      // repeat: the stamp is set, so the request is safely on file and an
      // admin is working it. Re-submitting achieves nothing except re-sending
      // three emails, and the traveller is told exactly that.
      it('409s a re-submit on a departed trip already requested', async () => {
        m.booking.findUnique.mockResolvedValue(
          owned({
            tourStartDateTime: PAST,
            tourTimeZone: 'America/Curacao',
            utcCancellationRequestedAt: new Date('2020-01-01T00:00:00Z'),
          }),
        );
        await expect(
          svc.requestCancellationAsCustomer('b1', { id: 'u1' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
      });
    });
  });

  describe('getCustomerSummary', () => {
    it('nets refunds off per-currency spend and drops zeroed currencies', async () => {
      m.booking.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      m.payment.groupBy
        .mockResolvedValueOnce([
          { currency: 'USD', _sum: { amount: D('300.00') } },
          { currency: 'EUR', _sum: { amount: D('80.00') } },
        ])
        .mockResolvedValueOnce([
          { currency: 'USD', _sum: { amount: D('50.00') } },
          { currency: 'EUR', _sum: { amount: D('80.00') } },
        ]);

      const res = await svc.getCustomerSummary({ id: 'u1' });

      expect(res.bookingsCount).toBe(3);
      expect(res.upcomingCount).toBe(1);
      // USD 300 paid - 50 refunded = 250; EUR nets to zero and disappears.
      expect(res.totalSpend).toEqual([{ currency: 'USD', amount: '250' }]);
    });
  });
});
