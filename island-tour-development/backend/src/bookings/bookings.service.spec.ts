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
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationRefund,
  CancelledBy,
  DepartureStatus,
  InboxEvent,
  PaymentKind,
  PaymentModel,
  PaymentStatus,
  Permission,
  PickupModel,
  Prisma,
  PricingModel,
  Role,
  TourBookingType,
  WholeUnitType,
} from '@prisma/client';
import { BookingsService } from './bookings.service';
import {
  hashLoginCode,
  issueBookingSession,
  issueTravelerHistorySession,
  issueTravelerSession,
  verifyTravelerSession,
} from './traveler-session.util';

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
    // FE-12: `getThankYou` asks whether this booking can still produce a review.
    // Default to "no review, no invitation" so existing cases are unaffected -
    // a test that cares overrides these.
    review: { findUnique: jest.fn().mockResolvedValue(null) },
    reviewInvitation: { findUnique: jest.fn().mockResolvedValue(null) },
    booking: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
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
    // Settlement ledger (B3): one row per booking at confirmation.
    settlement: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      // restore()'s reinstatement reads the row first; default = none.
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    // B6 transactional outbox - written with the finalize guard / cancel tx.
    outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    // The confirmation email reads site branding (logo + WhatsApp). Default to the
    // singleton being absent: the template's wordmark/no-WhatsApp fallbacks are the
    // correct render then, and no test should depend on real settings rows.
    siteInfo: { findFirst: jest.fn().mockResolvedValue(null) },
    departure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      // Exclusive release (absolute bookedCount: 0) and status recompute
      // writes. The atomic claim + shared release are raw SQL ($executeRaw).
      update: jest.fn(),
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
      // executeRefund: default null -> no captured charge found -> refund no-ops,
      // so existing cancel tests are unaffected. Refund tests override per-case.
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      // executeRefund flips the ORIGINAL charge row to REFUNDED on success.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // executeRefund's failed-attempt counter (idempotency-key advance).
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Traveller account OTP login codes. Default = no live code, so a verify
    // without an explicit row is the "nothing outstanding" 401 path.
    travelerLoginCode: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  p.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(p)
      : Promise.all(arg as []),
  );
  // The atomic seat claim and the shared-branch release are raw guarded
  // UPDATEs on `departures` (claimSeats/releaseSeats). Default = 1 row
  // affected (claim wins / release lands). Override to 0 to simulate losing
  // the guard (sold out, capacity shrunk, cancelled departure).
  p.$executeRaw = jest.fn().mockResolvedValue(1);
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
    // Prisma always returns this; `extend()` measures the absolute hold
    // ceiling from it, so the fixture must carry a realistic (just-created)
    // value or every extend test would read a missing date.
    createdAt: new Date(),
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
    price: null,
    isActive: true,
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
  // The claim is a raw guarded UPDATE; $executeRaw defaults to 1 (claim wins).
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
  // The claim guard reads capacity in SQL; $executeRaw defaults to 1 (wins).
  m.departure.findUnique.mockResolvedValue({
    capacity: 12,
    bookedCount: 0,
    status: 'OPEN',
    soldOutAt: null,
  });
  m.booking.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      fakeBooking({ status: data.status, utcExpiresAt: data.utcExpiresAt }),
  );
  m.booking.update.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => fakeBooking(data),
  );
}

/**
 * Every raw statement (`$executeRaw` tagged template) that ran, flattened for
 * assertion: `sql` is the template joined with `?` placeholders, `values` the
 * interpolated params in order.
 *
 * INVARIANT the classifiers below lean on: the ONLY raw statements in
 * BookingsService are the `claimSeats` guarded UPDATEs and the `releaseSeats`
 * GREATEST decrement. If another raw statement is ever added to the service,
 * the `GREATEST` substring split stops being a valid claim/release separator
 * - revisit these helpers then.
 */
function rawCalls(m: any): { sql: string; values: any[] }[] {
  return m.$executeRaw.mock.calls.map((c: any[]) => ({
    sql: (c[0] as readonly string[]).join('?').replace(/\s+/g, ' '),
    values: c.slice(1),
  }));
}

/** Every guarded seat claim (raw UPDATE from `claimSeats`) that ran. */
function claimCalls(m: any): { sql: string; values: any[] }[] {
  return rawCalls(m).filter((c) => !c.sql.includes('GREATEST'));
}

/** Every shared-branch seat release (raw clamped decrement) that ran. */
function rawReleaseCalls(m: any): { sql: string; values: any[] }[] {
  return rawCalls(m).filter((c) => c.sql.includes('GREATEST'));
}

/** Args of every departure `update` (exclusive release / status write) that ran. */
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
  let stripe: any;
  let mollie: any;
  let staffPermissions: any;
  let inbox: any;
  let recommendations: any;
  let svc: BookingsService;

  beforeEach(() => {
    prisma = mockPrisma();
    m = prisma;
    mail = {
      sendBookingConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendOperatorBookingReceivedEmail: jest.fn().mockResolvedValue(undefined),
      sendCancellationRequestEmail: jest.fn().mockResolvedValue(undefined),
      sendBookingNoticeEmail: jest.fn().mockResolvedValue(undefined),
      sendTravellerLoginCodeEmail: jest.fn().mockResolvedValue(undefined),
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
    // Stripe configured by default; refundIntent returns a fake refund id.
    stripe = {
      isConfigured: jest.fn().mockResolvedValue(true),
      refundIntent: jest.fn().mockResolvedValue({ id: 're_test_123' }),
    };
    // Mollie configured too; refunds route by the charge row's provider.
    mollie = {
      isConfigured: jest.fn().mockResolvedValue(true),
      createRefund: jest
        .fn()
        .mockResolvedValue({ id: 're_mollie_1', status: 'pending' }),
    };
    // Conflict #7: full financial view by default; individual tests drop
    // VIEW_BOOKING_FINANCIALS to assert the manifest projection.
    // Fire-and-forget bell; these tests assert the booking, not the badge.
    inbox = { notify: jest.fn() };
    staffPermissions = {
      getEffectivePermissions: jest
        .fn()
        .mockResolvedValue([Permission.VIEW_BOOKING_FINANCIALS]),
    };
    // Confirmation-email recommendation block: default to "nothing placed" so the
    // email tests here are unaffected by it.
    recommendations = {
      getFeatured: jest.fn().mockResolvedValue([]),
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
      stripe,
      mollie,
      staffPermissions,
      inbox,
      recommendations,
    );
  });

  describe('reserve', () => {
    it('atomically claims seats and creates an ON_HOLD booking', async () => {
      setupReserveContext(prisma);
      const res = await svc.reserve(reserveDto);

      // The guarded count-up runs as ONE raw conditional UPDATE (master §5),
      // check + increment + SOLD_OUT flip fused.
      expect(claimCalls(m).length).toBe(1);
      expect(m.booking.create).toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.ON_HOLD);
    });

    // E.8 display_ref (review F11): IT-{tripYear}-XXXXX from a Crockford-style
    // alphabet - the ref is read aloud at check-in and typed into the login
    // door, so 0/O, 1/I/L and U are excluded.
    it('mints an unambiguous 5-char display reference', async () => {
      setupReserveContext(prisma);
      await svc.reserve(reserveDto);

      const data = m.booking.create.mock.calls[0][0].data as {
        displayRef: string;
      };
      expect(data.displayRef).toMatch(/^IT-\d{4}-[2-9A-HJKMNP-TV-Z]{5}$/);
    });

    // A 5-char code CAN collide; the allocator must retry, not crash the
    // seat-claim transaction with a P2002.
    it('regenerates the display reference when the first candidate is taken', async () => {
      setupReserveContext(prisma);
      m.booking.findUnique
        .mockResolvedValueOnce(null) // idempotency probe on the booking id
        .mockResolvedValueOnce({ id: 'clash' }) // first candidate taken
        .mockResolvedValueOnce(null); // second candidate free

      await svc.reserve(reserveDto);

      const refProbes = m.booking.findUnique.mock.calls.filter(
        (c: [{ where: { displayRef?: string } }]) => c[0].where.displayRef,
      );
      expect(refProbes.length).toBe(2);
      expect(m.booking.create).toHaveBeenCalled();
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

    it('snapshots attribution (click ids + UTM) at creation (master 8.1.6)', async () => {
      setupReserveContext(prisma);
      await svc.reserve({
        ...reserveDto,
        attribution: {
          gclid: 'Cj0aBc',
          fbclid: 'fb.1.123',
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'summer-2026',
        },
      });
      expect(m.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gclid: 'Cj0aBc',
            fbclid: 'fb.1.123',
            gbraid: null,
            wbraid: null,
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'summer-2026',
            utmTerm: null,
            utmContent: null,
          }),
        }),
      );
    });

    it('never overwrites original attribution on an idempotent re-reserve', async () => {
      setupReserveContext(prisma);
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      await svc.reserve({
        ...reserveDto,
        id: 'b1',
        attribution: { gclid: 'late-click' },
      });
      // The prior booking is returned untouched; no create, so no attribution write.
      expect(m.booking.create).not.toHaveBeenCalled();
    });

    it('writes null attribution when none is supplied (organic booking)', async () => {
      setupReserveContext(prisma);
      await svc.reserve(reserveDto);
      expect(m.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gclid: null, utmSource: null }),
        }),
      );
    });

    it('rejects when the atomic claim wins 0 rows (sold out)', async () => {
      setupReserveContext(prisma);
      m.$executeRaw.mockResolvedValue(0); // guard matched no row
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    // The materializer hard-deletes unbooked departures, so one can vanish
    // between loadContext and the insert. The FK violation IS that race and
    // must keep the old pre-read's clean 422 contract, never a 500.
    it('422s (not 500) when the departure was hard-deleted mid-flight', async () => {
      setupReserveContext(prisma);
      m.booking.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { constraint: 'bookings_departureId_fkey' },
        }),
      );
      await expect(svc.reserve(reserveDto)).rejects.toMatchObject({
        constructor: UnprocessableEntityException,
        message: 'Departure not found',
      });
    });

    it('rethrows a P2003 on any OTHER foreign key untouched', async () => {
      setupReserveContext(prisma);
      const fkErr = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: 'test',
        meta: { constraint: 'booking_unit_items_ageBandId_fkey' },
      });
      m.booking.create.mockRejectedValue(fkErr);
      await expect(svc.reserve(reserveDto)).rejects.toBe(fkErr);
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
        price: null,
        isActive: true,
      });
      await expect(
        svc.reserve({ ...reserveDto, pickupLocationId: 'pk1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a deactivated pickup location', async () => {
      setupReserveContext(prisma);
      m.pickupLocation.findUnique.mockResolvedValue({
        tourId: 't1',
        name: 'Old zone',
        address: 'Closed hotel',
        price: null,
        isActive: false,
      });
      await expect(
        svc.reserve({ ...reserveDto, pickupLocationId: 'pk1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('charges a PAID_ADDON pickup zone per person and snapshots the price', async () => {
      setupReserveContext(prisma, { pickupModel: PickupModel.PAID_ADDON });
      m.pickupLocation.findUnique.mockResolvedValue({
        tourId: 't1',
        name: 'Marriott Beach Resort',
        address: 'Piscadera Bay, Willemstad',
        price: D('17'),
        isActive: true,
      });
      await svc.reserve({
        ...reserveDto,
        pickupRequested: true,
        pickupLocationId: 'pk1',
      });
      const data = m.booking.create.mock.calls[0][0].data;
      // 2 adults * 79.99 + pickup 17 * 2 pax = 193.98 -> ceil 194. Deposit =
      // 20% of the TOUR price only (ceil(159.98 * .2) = 32); the balance is the
      // remainder of the rounded total (194 - 32 = 162), so the lines add up.
      expect(data.totalRetail.toString()).toBe('194');
      expect(data.depositAmount.toString()).toBe('32');
      expect(data.balanceAmount.toString()).toBe('162'); // 127.98 + 34
      expect(data.pickupUnitPrice.toString()).toBe('17');
      expect(data.pickupTotalPrice.toString()).toBe('34');
    });

    it('never charges the zone price when pickupModel is INCLUDED', async () => {
      setupReserveContext(prisma, { pickupModel: PickupModel.INCLUDED });
      m.pickupLocation.findUnique.mockResolvedValue({
        tourId: 't1',
        name: 'Marriott Beach Resort',
        address: 'Piscadera Bay, Willemstad',
        price: D('17'), // stale price value must be ignored on INCLUDED
        isActive: true,
      });
      await svc.reserve({
        ...reserveDto,
        pickupRequested: true,
        pickupLocationId: 'pk1',
      });
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.totalRetail.toString()).toBe('160');
      expect(data.pickupUnitPrice).toBeNull();
      expect(data.pickupTotalPrice).toBeNull();
    });

    it('rejects a reserve without pickup on a pickupRequired tour', async () => {
      setupReserveContext(prisma, { pickupRequired: true });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      // The "other location, confirm via WhatsApp" fallback (requested, no id) passes.
      await expect(
        svc.reserve({ ...reserveDto, pickupRequested: true }),
      ).resolves.toBeDefined();
    });

    it('caps an add-on at its operator-set maxQuantity', async () => {
      setupReserveContext(prisma);
      m.tourAddOn.findMany.mockResolvedValue([
        {
          id: 'a1',
          name: 'Lunch',
          unit: 'PER_PERSON',
          price: D('10'),
          maxQuantity: 2,
        },
      ]);
      await expect(
        svc.reserve({
          ...reserveDto,
          addOns: [{ addOnId: 'a1', quantity: 3 }],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(
        svc.reserve({
          ...reserveDto,
          addOns: [{ addOnId: 'a1', quantity: 2 }],
        }),
      ).resolves.toBeDefined();
    });

    it('caps a per-person add-on at the paying travellers (Pastel #58)', async () => {
      setupReserveContext(prisma);
      m.tourAddOn.findMany.mockResolvedValue([
        {
          id: 'a1',
          name: 'Open bar',
          unit: 'PER_PERSON',
          price: D('22'),
          maxQuantity: 10, // the operator allows ten; the party is two
        },
      ]);
      await expect(
        svc.reserve({
          ...reserveDto,
          addOns: [{ addOnId: 'a1', quantity: 3 }],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('charges one per-person add-on once, not once per traveller', async () => {
      setupReserveContext(prisma);
      m.tourAddOn.findMany.mockResolvedValue([
        {
          id: 'a1',
          name: 'Open bar',
          unit: 'PER_PERSON',
          price: D('22'),
          maxQuantity: 10,
        },
      ]);
      await svc.reserve({
        ...reserveDto,
        addOns: [{ addOnId: 'a1', quantity: 1 }],
      });
      const data = m.booking.create.mock.calls[0][0].data;
      // 2 adults * 79.99 = 159.98, + ONE open bar at 22 = 181.98 -> ceil 182.
      // The old maths multiplied the bar by the party and reached 204.
      expect(data.totalRetail.toString()).toBe('182');
    });

    it('caps a per-booking add-on at one, whatever the operator set', async () => {
      setupReserveContext(prisma);
      m.tourAddOn.findMany.mockResolvedValue([
        {
          id: 'a1',
          name: 'GoPro photo package',
          unit: 'FLAT',
          price: D('34'),
          maxQuantity: 5,
        },
      ]);
      await expect(
        svc.reserve({
          ...reserveDto,
          addOns: [{ addOnId: 'a1', quantity: 2 }],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(
        svc.reserve({
          ...reserveDto,
          addOns: [{ addOnId: 'a1', quantity: 1 }],
        }),
      ).resolves.toBeDefined();
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
      // The exclusive claim takes the WHOLE unit: it only matches a still-empty
      // OPEN departure and sets bookedCount to the LIVE capacity column, not
      // the guest count and not a frozen pre-read.
      expect(
        claimCalls(m).some(
          (c) =>
            c.sql.includes('SET "bookedCount" = "capacity"') &&
            c.sql.includes('AND "bookedCount" = 0') &&
            // Reserve is the STRICT variant - never restore's intoSticky.
            c.sql.includes(`"status" = 'open'::"departure_status"`),
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
        claimCalls(m).some(
          (c) =>
            c.sql.includes('SET "bookedCount" = "bookedCount" + ?') &&
            c.values.includes(6),
        ),
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
      // 2 adults * 79.99 = 159.98 -> ceil 160.
      expect(res.totalRetail).toBe('160');
      expect(res.pax).toBe(2);
      expect(res.paymentModel).toBe(PaymentModel.OPERATOR_LINK);
      expect(res.currency).toBe('EUR');
      expect(res.tourCurrency).toBe('EUR');
      expect(res.sourceTotalRetail).toBe(res.totalRetail);
      expect(res.sourceFxRateToBooking).toBe('1');
      // The commission snapshot never rides the PUBLIC quote response - an
      // anonymous caller must not learn the platform's take (it is still
      // computed and stored on the booking at reserve).
      expect(res.commissionRate).toBeNull();
      expect(res.commissionAmount).toBeNull();
      // Whole units, like every other traveller-facing amount (`retailWhole`).
      // These lines are the human-readable explanation of the price, so they
      // have to agree with the total sitting above them: 2 x 80 = 160, which is
      // `totalRetail`. At 2dp they read "2 x 79.99 = 159.98" under a "160"
      // total - the price contradicting itself inside one card (Pastel #41).
      expect(res.lines).toEqual([
        {
          kind: 'participant',
          ageBandId: 'adult',
          label: 'Adult',
          quantity: 2,
          unitPrice: '80',
          lineTotal: '160',
        },
      ]);
      expect(res.lines[0].lineTotal).toBe(res.totalRetail);
      expect(res.quoteId).toEqual(expect.any(String));
      expect(res.expiresAt).toEqual(expect.any(String));
      // A quote is a preview: it never claims seats or writes a booking.
      expect(m.$executeRaw).not.toHaveBeenCalled();
      expect(m.booking.create).not.toHaveBeenCalled();
    });

    it('applies the OPERATOR_LINK deposit split to the quote', async () => {
      setupReserveContext(prisma);
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
      });
      // 20% of 159.98 = 31.996 -> ceil 32; balance = 160 - 32 = 128.
      expect(res.depositAmount).toBe('32');
      expect(res.balanceAmount).toBe('128');
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

    it('adds a per-person pickup line for a priced PAID_ADDON zone', async () => {
      setupReserveContext(prisma, { pickupModel: PickupModel.PAID_ADDON });
      m.pickupLocation.findUnique.mockResolvedValue({
        tourId: 't1',
        name: 'Marriott Beach Resort',
        address: 'Piscadera Bay, Willemstad',
        price: D('17'),
        isActive: true,
      });
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
        pickupLocationId: 'pk1',
      });
      // 159.98 participants + 17 * 2 pax pickup = 193.98 -> ceil 194.
      expect(res.totalRetail).toBe('194');
      expect(res.lines).toContainEqual({
        kind: 'pickup',
        ageBandId: null,
        label: 'Marriott Beach Resort',
        quantity: 2,
        unitPrice: '17',
        lineTotal: '34',
      });
    });

    it('quotes a free zone with no pickup line (INCLUDED model)', async () => {
      setupReserveContext(prisma, { pickupModel: PickupModel.INCLUDED });
      const res = await svc.quote({
        tourId: 't1',
        departureId: 'dep1',
        items: [{ ageBandId: 'adult', quantity: 2 }],
        pickupLocationId: 'pk1',
      });
      expect(res.totalRetail).toBe('160');
      expect(res.lines.some((l) => l.kind === 'pickup')).toBe(false);
    });

    it('rejects a quote for a departure past the booking cutoff', async () => {
      setupReserveContext(prisma);
      // A departure in the past is by definition inside any cutoff window.
      m.departure.findFirst.mockResolvedValue({
        id: 'dep1',
        date: day('2020-06-05'),
        startTime: time('09:00'),
      });
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
      // 79.99*0.9=71.99 (x2) = 143.98 -> ceil 144 EUR; source 159.98 -> 160 USD.
      // The breakdown line is whole too, and reconciles with the total it
      // explains: 2 x 72 = 144. The charged figures are computed from the 2dp
      // maths in `pricing` and are unaffected by how the line is displayed.
      expect(res.totalRetail).toBe('144');
      expect(res.sourceTotalRetail).toBe('160');
      expect(res.lines[0].unitPrice).toBe('72');
      expect(res.lines[0].lineTotal).toBe('144');
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
      expect(data.totalRetail.toString()).toBe('144');
      expect(data.sourceCurrency).toBe('USD');
      expect(data.sourceTotalRetail.toString()).toBe('160');
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
      expect(data.totalRetail.toString()).toBe('160');
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

  // B6 queued-job consumers: idempotent (DB guard columns), state-revalidating.
  describe('platform job runners (B6)', () => {
    const confirmed = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Ada',
        contactFullName: 'Ada Byron',
        operatorId: 'op1',
        commissionAmount: D('18.40'),
        utcConfirmationEmailSentAt: null,
        utcOperatorNoticeSentAt: null,
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
      m.booking.updateMany.mockResolvedValue({ count: 1 });
    });

    it('confirmation-email job sends once, stamps its guard, and rethrows failures for retry', async () => {
      const send = jest
        .spyOn(svc as never, 'sendConfirmationEmail' as never)
        .mockResolvedValue(undefined as never);
      m.booking.findUnique.mockResolvedValue(confirmed());
      await svc.runConfirmationEmailJob('b1');
      // The job path must RETHROW send failures so BullMQ retries with backoff
      // (the inline path swallows them) - and stamp only after a clean send.
      expect(send).toHaveBeenCalledWith(expect.anything(), { rethrow: true });
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', utcConfirmationEmailSentAt: null },
          data: { utcConfirmationEmailSentAt: expect.any(Date) },
        }),
      );

      // Redelivered job: guard already stamped -> nothing sent again.
      send.mockClear();
      m.booking.findUnique.mockResolvedValue(
        confirmed({ utcConfirmationEmailSentAt: new Date() }),
      );
      await svc.runConfirmationEmailJob('b1');
      expect(send).not.toHaveBeenCalled();
    });

    it('confirmation-email job re-validates state - a cancelled booking gets NO email', async () => {
      const send = jest
        .spyOn(svc as never, 'sendConfirmationEmail' as never)
        .mockResolvedValue(undefined as never);
      m.booking.findUnique.mockResolvedValue(
        confirmed({ status: BookingStatus.CANCELLED }),
      );
      await svc.runConfirmationEmailJob('b1');
      expect(send).not.toHaveBeenCalled();
    });

    it('operator-notice job sends once and stamps its guard', async () => {
      const send = jest
        .spyOn(svc as never, 'sendOperatorNotification' as never)
        .mockResolvedValue(undefined as never);
      m.booking.findUnique.mockResolvedValue(confirmed());
      await svc.runOperatorNoticeJob('b1');
      expect(send).toHaveBeenCalledWith(expect.anything(), { rethrow: true });
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { utcOperatorNoticeSentAt: expect.any(Date) },
        }),
      );
    });

    it('CAPI job fires with event_id == publicRef (master 8.1.4 dedup contract)', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      await svc.runCapiConversionJob('b1');
      // The server CAPI event_id MUST equal the booking publicRef - the SAME id
      // the browser push carries - so Meta dedups the Pixel event against it.
      expect(tracking.fireBookingComplete).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'p1' }), // fakeBooking().publicRef
      );
    });

    it('CAPI job fails UNRECOVERABLY on a null commission (data corruption - no retry loop)', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({ commissionAmount: null }),
      );
      await expect(svc.runCapiConversionJob('b1')).rejects.toMatchObject({
        name: 'UnrecoverableError',
      });
      expect(tracking.fireBookingComplete).not.toHaveBeenCalled();
    });

    it('refund job re-invokes the idempotent executor only for a FULL verdict', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst
        .mockResolvedValueOnce(null) // no prior REFUND row
        .mockResolvedValueOnce({
          amount: D('41.99'),
          currency: 'EUR',
          intentId: 'pi_1',
          chargeId: 'ch_1',
          provider: 'STRIPE',
        });
      m.payment.count.mockResolvedValue(0);
      await svc.runRefundJob('b1');
      expect(stripe.refundIntent).toHaveBeenCalled();

      // NONE verdict -> nothing owed, executor never invoked.
      stripe.refundIntent.mockClear();
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'NONE',
        }),
      );
      await svc.runRefundJob('b1');
      expect(stripe.refundIntent).not.toHaveBeenCalled();
    });

    it('pre-tour reminder job is a state-checked stub until the template lands', async () => {
      m.booking.findUnique.mockResolvedValue({
        id: 'b1',
        displayRef: 'IT-2030-AAAA',
        status: BookingStatus.CONFIRMED,
        utcReminderSentAt: null,
      });
      await expect(svc.runPreTourReminderJob('b1')).resolves.toBeUndefined();
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  // Guide s15: operator reports non-payment of the OPERATOR_LINK balance; only an
  // admin confirmation forfeits the deposit (kept - no refund, settlement NOT
  // reversed) and releases the spot. Never automatic.
  describe('non-payment forfeit (guide s15)', () => {
    const admin = { id: 'admin-1', role: Role.ADMIN };
    const confirmedLink = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        utcConfirmedAt: new Date('2030-06-01T00:00:00Z'),
        utcNonPaymentReportedAt: null,
        utcForfeitedAt: null,
        ...over,
      });

    it('report stamps utcNonPaymentReportedAt (and repeats are idempotent no-ops)', async () => {
      m.booking.findUnique.mockResolvedValue(confirmedLink());
      m.booking.update.mockResolvedValue(
        confirmedLink({ utcNonPaymentReportedAt: new Date() }),
      );
      await svc.reportNonPayment('b1', admin);
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { utcNonPaymentReportedAt: expect.any(Date) },
        }),
      );

      // Second report: already stamped -> returns without writing.
      m.booking.update.mockClear();
      m.booking.findUnique.mockResolvedValue(
        confirmedLink({ utcNonPaymentReportedAt: new Date('2030-06-02') }),
      );
      await svc.reportNonPayment('b1', admin);
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('report rejects a non-OPERATOR_LINK booking (409)', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmedLink({ paymentModel: PaymentModel.PAID_IN_FULL }),
      );
      await expect(svc.reportNonPayment('b1', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('forfeit terminates CANCELLED+forfeited, keeps the deposit (no refund, no settlement reversal), releases seats', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmedLink({
          utcNonPaymentReportedAt: new Date('2030-06-02T00:00:00Z'),
        }),
      );
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 4,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.booking.update.mockResolvedValue(
        confirmedLink({
          status: BookingStatus.CANCELLED,
          utcForfeitedAt: new Date(),
          utcCancelledAt: new Date(),
        }),
      );

      await svc.confirmForfeit('b1', admin);

      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            utcForfeitedAt: expect.any(Date),
            cancellationRefund: CancellationRefund.NONE,
            cancelledBy: CancelledBy.ADMIN,
          }),
        }),
      );
      // Seats go back to inventory (clamped raw decrement)...
      expect(rawReleaseCalls(m).length).toBeGreaterThan(0);
      // ...but the money does NOT move: deposit kept, commission stays earned.
      expect(stripe.refundIntent).not.toHaveBeenCalled();
      expect(m.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('forfeit without a prior report is rejected (409, never automatic)', async () => {
      m.booking.findUnique.mockResolvedValue(confirmedLink());
      await expect(svc.confirmForfeit('b1', admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('dismiss clears the report; a forfeited booking cannot be dismissed', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmedLink({
          utcNonPaymentReportedAt: new Date('2030-06-02T00:00:00Z'),
        }),
      );
      m.booking.update.mockResolvedValue(confirmedLink());
      await svc.dismissNonPaymentReport('b1', admin);
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { utcNonPaymentReportedAt: null },
        }),
      );

      m.booking.update.mockClear();
      m.booking.findUnique.mockResolvedValue(
        confirmedLink({
          status: BookingStatus.CANCELLED,
          utcNonPaymentReportedAt: new Date('2030-06-02T00:00:00Z'),
          utcForfeitedAt: new Date('2030-06-03T00:00:00Z'),
        }),
      );
      await expect(
        svc.dismissNonPaymentReport('b1', admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.booking.update).not.toHaveBeenCalled();
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
      expect(rawReleaseCalls(m).length).toBeGreaterThan(0);
      expect(res.cancellationRefund).toBe('FULL');
    });

    // B5: a FULL-refund cancellation executes a real Stripe refund of the captured
    // charge and records a REFUND Payment row.
    it('executes a real Stripe refund + writes a REFUND row on a FULL cancellation', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
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
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst
        .mockResolvedValueOnce(null) // no prior REFUND (idempotency)
        .mockResolvedValueOnce({
          amount: D('31.99'),
          currency: 'EUR',
          intentId: 'pi_1',
          chargeId: 'ch_1',
        });

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      // Stable idempotency key so a retry never double-refunds.
      expect(stripe.refundIntent).toHaveBeenCalledWith('pi_1', 'refund-b1');
      // A settled refund is REFUNDED (never a green "Succeeded" in the list)...
      expect(m.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'REFUND',
            status: 'REFUNDED',
            amount: D('31.99'),
            refundId: 're_test_123',
          }),
        }),
      );
      // ...and the ORIGINAL charge row flips to REFUNDED with it.
      expect(m.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bookingId: 'b1',
            kind: { not: 'REFUND' },
            intentId: 'pi_1',
            status: 'SUCCEEDED',
          }),
          data: { status: 'REFUNDED' },
        }),
      );
    });

    // A charge captured through Mollie must be reversed through Mollie - the
    // Payment ROW's provider routes the refund, never the settings switch.
    it('routes the refund through Mollie when the charge row is MOLLIE', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
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
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst
        .mockResolvedValueOnce(null) // no prior REFUND (idempotency)
        .mockResolvedValueOnce({
          amount: D('31.99'),
          currency: 'EUR',
          intentId: 'tr_mollie_1',
          chargeId: null,
          provider: 'MOLLIE',
        });

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(mollie.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'tr_mollie_1',
          currency: 'EUR',
          idempotencyKey: 'refund-b1',
        }),
      );
      expect(stripe.refundIntent).not.toHaveBeenCalled();
      // Mollie refunds are ALWAYS async: `pending` records as PROCESSING, and
      // the payment webhook re-fetch settles it later. Never assume success.
      expect(m.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'REFUND',
            status: 'PROCESSING',
            refundId: 're_mollie_1',
            provider: 'MOLLIE',
          }),
        }),
      );
    });

    it('does NOT refund again when a SUCCEEDED refund already exists (idempotent)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
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
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst.mockResolvedValueOnce({ id: 'existing-refund' });

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(stripe.refundIntent).not.toHaveBeenCalled();
      expect(m.payment.create).not.toHaveBeenCalled();
    });

    // Stripe's answer is the row's truth: bank-method refunds (iDEAL/SEPA) are
    // created `pending` and must be recorded PROCESSING - the refund.updated
    // webhook settles them later. Never assume success.
    it('records a pending Stripe refund as PROCESSING, not SUCCEEDED', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
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
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        amount: D('31.99'),
        currency: 'EUR',
        intentId: 'pi_1',
        chargeId: 'ch_1',
      });
      stripe.refundIntent.mockResolvedValueOnce({
        id: 're_pending_1',
        status: 'pending',
      });

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(m.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'REFUND',
            status: 'PROCESSING',
            refundId: 're_pending_1',
          }),
        }),
      );
    });

    // A retry after an async FAILURE must not reuse the original idempotency
    // key - Stripe would replay the failed refund from its cache instead of
    // creating a new one.
    it('advances the idempotency key after a prior FAILED refund attempt', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED }),
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
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
        }),
      );
      m.payment.findFirst
        .mockResolvedValueOnce(null) // FAILED rows do not block the retry
        .mockResolvedValueOnce({
          amount: D('31.99'),
          currency: 'EUR',
          intentId: 'pi_1',
          chargeId: 'ch_1',
        });
      m.payment.count.mockResolvedValueOnce(1); // one FAILED attempt on record

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(stripe.refundIntent).toHaveBeenCalledWith('pi_1', 'refund-b1-r1');
    });

    // Pre-B6 retry hook: re-invoking cancel on an already-CANCELLED booking
    // that owes a FULL refund re-attempts the refund instead of only echoing
    // state (Stripe was down, or the async refund FAILED).
    it('re-attempts an owed refund when cancel() hits an already-CANCELLED booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
          utcConfirmedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
      m.payment.findFirst
        .mockResolvedValueOnce(null) // no SUCCEEDED/PROCESSING refund yet
        .mockResolvedValueOnce({
          amount: D('31.99'),
          currency: 'EUR',
          intentId: 'pi_1',
          chargeId: 'ch_1',
        });

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      expect(stripe.refundIntent).toHaveBeenCalledWith('pi_1', 'refund-b1');
      // Early return: the booking itself is not re-cancelled.
      expect(m.booking.update).not.toHaveBeenCalled();
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

    // Conflict #2 (access-roles matrix): cancelling a confirmed booking
    // executes a refund, so even the OWNING operator is blocked - they report,
    // the admin executes.
    it('403s the OWNING operator on a confirmed booking (report, never execute)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED, operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.cancel('b1', {}, { id: 'user-9', role: Role.TOUR_OPERATOR }),
      ).rejects.toThrow('Report cancellation');
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('stamps cancelledBy OPERATOR + a FULL refund when the admin executes a reported cancellation', async () => {
      // Tour date long PAST: the traveler window verdict would be NONE, but an
      // operator-reported cancellation must refund FULL regardless (enforced
      // server-side - never trust the client to send force:true).
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          localDate: new Date('2020-06-05T00:00:00.000Z'),
          utcOperatorCancellationReportedAt: new Date(
            '2020-06-01T00:00:00.000Z',
          ),
          operatorCancellationReason: 'Engine failure',
        }),
      );
      m.tour.findUnique.mockResolvedValue({
        cancellationHours: 48,
        timeZone: 'America/Curacao',
      });
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 2,
        status: 'OPEN',
        soldOutAt: null,
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CANCELLED,
          cancellationRefund: 'FULL',
          cancelledBy: CancelledBy.OPERATOR,
        }),
      );

      await svc.cancel('b1', {}, { id: 'admin-1', role: Role.ADMIN });

      // The cancellation ORIGINATED with the operator: the eligibility metric
      // (cancellation_rate_90d counts OPERATOR rows) must attribute it to
      // them, not to the admin pressing the button. The operator's stated
      // reason rides along when the admin gives none.
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelledBy: CancelledBy.OPERATOR,
            cancellationReason: 'Engine failure',
            cancellationRefund: 'FULL',
          }),
        }),
      );
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

    it('refuses to extend past the absolute hold ceiling', async () => {
      // A hold locks real inventory (a PRIVATE charter locks the WHOLE
      // departure) and `extend` is @Public() with no ownership proof, so the
      // ceiling - not the call count - is what stops an indefinite lock.
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ createdAt: new Date(Date.now() - 121 * 60_000) }),
      );
      await expect(
        svc.extend('b1', { expirationMinutes: 30 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('clamps the new expiry to the ceiling instead of overshooting it', async () => {
      // 110 minutes in, asking for another 30: only 10 remain before the
      // 120-minute ceiling, so the expiry must land at the ceiling, not past.
      const createdAt = new Date(Date.now() - 110 * 60_000);
      m.booking.findUnique.mockResolvedValue(fakeBooking({ createdAt }));
      m.booking.update.mockResolvedValue(fakeBooking());
      await svc.extend('b1', { expirationMinutes: 30 });
      const arg = m.booking.update.mock.calls[0][0] as {
        data: { utcExpiresAt: Date };
      };
      expect(arg.data.utcExpiresAt.getTime()).toBe(
        createdAt.getTime() + 120 * 60_000,
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

    it('withholds commission from the owning OPERATOR (platform-internal fields)', async () => {
      // Access-roles matrix, Bookings notes: commission fields are never
      // rendered in the operator portal - only platform-wide roles see them.
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });
      const res = await svc.getById('b1', {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });
      expect(res.commissionRate).toBeNull();
      expect(res.commissionAmount).toBeNull();
    });

    it('keeps commission for an ADMIN read', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      const res = await svc.getById('b1', { id: 'a1', role: Role.ADMIN });
      expect(res.commissionRate).not.toBeNull();
      expect(res.commissionAmount).not.toBeNull();
    });

    // Conflict #7: VIEW_BOOKINGS without VIEW_BOOKING_FINANCIALS = manifest.
    it('returns the MANIFEST projection to a seat without VIEW_BOOKING_FINANCIALS', async () => {
      staffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.VIEW_BOOKINGS,
      ]);
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });

      const res: any = await svc.getById('b1', {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });

      // Money is gone...
      expect(res.totalRetail).toBeNull();
      expect(res.depositAmount).toBeNull();
      expect(res.balanceAmount).toBeNull();
      expect(res.commissionAmount).toBeNull();
      // ...including the PER-TRAVELER prices (the row total is not the only
      // money on the payload).
      expect(res.unitItems).toHaveLength(2);
      for (const item of res.unitItems) expect(item.priceRetail).toBeNull();
      // The raw settled refund verdict is refund state too.
      expect(res.cancellationRefund).toBeNull();
      // ...but the manifest facts a guide needs on the day remain.
      expect(res.id).toBe('b1');
      expect(res.displayRef).toBe('IT-2030-AAAA');
      expect(res.localDate).toBe('2030-06-05');
      expect(res.startTime).toBe('09:00');
      expect(res.unitItems[0].ageBandId).toBe('adult');
    });

    it('keeps the amounts for a seat that HOLDS VIEW_BOOKING_FINANCIALS', async () => {
      staffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.VIEW_BOOKINGS,
        Permission.VIEW_BOOKING_FINANCIALS,
      ]);
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ operatorId: 'op1' }),
      );
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });

      const res: any = await svc.getById('b1', {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });
      expect(res.totalRetail).toBe('159.98');
    });

    it('always shows a traveler the money on their OWN booking', async () => {
      // The manifest rule is about seats reading other people's bookings.
      // Role.USER holds no VIEW_BOOKING_FINANCIALS, and granting it would
      // leak through the customer-hat union onto staff seats - so ownership
      // of the row is what decides here.
      staffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.VIEW_BOOKINGS,
      ]);
      m.booking.findUnique.mockResolvedValue(fakeBooking({ userId: 'u9' }));

      const res: any = await svc.getById('b1', {
        id: 'u9',
        role: Role.USER,
      });
      expect(res.totalRetail).toBe('159.98');
      expect(res.depositAmount).toBe('31.99');
      // Commission stays platform-internal even on your own receipt.
      expect(res.commissionAmount).toBeNull();
    });

    it('withholds commission from the customer (Role.USER) read', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ userId: 'u9' }));
      const res = await svc.getById('b1', { id: 'u9', role: Role.USER });
      expect(res.commissionRate).toBeNull();
      expect(res.commissionAmount).toBeNull();
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
      // The booking REFERENCE (pentest 2026-08-01): support identifies a
      // traveller by it and the pair login uses it, so a forwarded link must
      // not carry it. `publicRef` is already in the URL, so it stays.
      expect(res.displayRef).toBeNull();
      expect(res.publicRef).toBeDefined();
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
      // The owner gets their reference - it is the one they quote to support.
      expect(res.displayRef).toBeTruthy();
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

  // Browser booking_complete push served ONCE, mark-first, by a dedicated
  // endpoint (master 8.2) - separate from the plain GET (which the processing
  // poller also hits) and from `conversionFiredAt` (the server fire at confirm).
  describe('claimConversionPush (one-time browser push)', () => {
    const pushable = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        commissionAmount: D('31.99'),
        tour: { name: 'Sunset Sail' },
        ...over,
      });

    it('the plain GET no longer carries the conversion payload (no double-fire vector)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          contactEmail: 'guest@example.test',
          tour: { name: 'T', ageBands: [], cancellationHours: 48 },
          tourStartDateTime: null,
          tourTimeZone: null,
          operator: null,
        }),
      );
      const page = await svc.getThankYou(
        'p1',
        issueTravelerSession('guest@example.test'),
      );
      expect('conversion' in page).toBe(false);
    });

    it('returns the payload to the mark-first WINNER (verified, confirmed, commission present)', async () => {
      m.booking.findUnique.mockResolvedValue(pushable());
      m.booking.updateMany.mockResolvedValue({ count: 1 }); // this caller wins the flip

      const { conversion } = await svc.claimConversionPush(
        'p1',
        issueTravelerSession('guest@example.test'),
      );

      expect(conversion).toEqual(
        expect.objectContaining({
          event: 'Purchase',
          eventId: 'p1', // publicRef - MUST match the server CAPI event_id for dedup
          currency: 'EUR',
          value: '31.99',
          contentId: 't1',
          contentName: 'Sunset Sail',
        }),
      );
      // Hashed PII for Enhanced Conversions (server-side; raw never sent).
      expect(conversion?.userData?.sha256_email_address).toEqual(
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      // Mark-first guard is on conversionPushedAt (NOT conversionFiredAt).
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', conversionPushedAt: null },
          data: { conversionPushedAt: expect.any(Date) },
        }),
      );
    });

    it('returns null to the LOSER (a refresh / second tab - guard already burned)', async () => {
      m.booking.findUnique.mockResolvedValue(pushable());
      m.booking.updateMany.mockResolvedValue({ count: 0 }); // lost the race

      const { conversion } = await svc.claimConversionPush(
        'p1',
        issueTravelerSession('guest@example.test'),
      );
      expect(conversion).toBeNull();
    });

    it('never fires for a bare (unverified) link and does NOT burn the guard', async () => {
      m.booking.findUnique.mockResolvedValue(pushable());

      const { conversion } = await svc.claimConversionPush('p1'); // no session
      expect(conversion).toBeNull();
      expect(m.booking.updateMany).not.toHaveBeenCalled();
    });

    it('does not fire (or burn the guard) while the booking is not yet CONFIRMED', async () => {
      m.booking.findUnique.mockResolvedValue(
        pushable({ status: BookingStatus.ON_HOLD }),
      );

      const { conversion } = await svc.claimConversionPush(
        'p1',
        issueTravelerSession('guest@example.test'),
      );
      expect(conversion).toBeNull();
      expect(m.booking.updateMany).not.toHaveBeenCalled();
    });

    it('logs corruption and fires nothing when a confirmed booking has null commission (rule #22)', async () => {
      const err = jest
        .spyOn((svc as any).logger, 'error')
        .mockImplementation(() => undefined);
      m.booking.findUnique.mockResolvedValue(
        pushable({ commissionAmount: null }),
      );

      const { conversion } = await svc.claimConversionPush(
        'p1',
        issueTravelerSession('guest@example.test'),
      );
      expect(conversion).toBeNull();
      expect(m.booking.updateMany).not.toHaveBeenCalled();
      expect(err).toHaveBeenCalled();
      err.mockRestore();
    });

    it('404s an unknown publicRef', async () => {
      m.booking.findUnique.mockResolvedValue(null);
      await expect(
        svc.claimConversionPush('nope', issueTravelerSession('x@y.test')),
      ).rejects.toBeInstanceOf(NotFoundException);
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

    it('the caller that WINS the flip commits the outbox event once + sends the emails inline (B6 + founder restore)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 }); // transition + guard both win
      m.booking.findUnique.mockResolvedValue(confirmable());
      const emailJob = jest
        .spyOn(svc, 'runConfirmationEmailJob')
        .mockResolvedValue(undefined);
      const noticeJob = jest
        .spyOn(svc, 'runOperatorNoticeJob')
        .mockResolvedValue(undefined);

      await svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' });

      // B6: the winner commits the `booking.confirmed` domain event in the SAME
      // transaction as the mark-first guard; the queued jobs are the durable
      // retry backstop. Founder restore (2026-07-25): the EMAILS also send
      // INLINE right here (guard columns make the later job a no-op); CAPI and
      // the reminder stay queue-only.
      expect(m.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(m.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'booking.confirmed',
            aggregateId: 'b1',
          }),
        }),
      );
      expect(emailJob).toHaveBeenCalledWith('b1');
      expect(noticeJob).toHaveBeenCalledWith('b1');
      expect(tracking.fireBookingComplete).not.toHaveBeenCalled();
      expect(notifications.emitBookingUpdate).toHaveBeenCalledTimes(1);
    });

    it('an inline email failure never fails the confirmation (the queued job retries it)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(confirmable());
      jest
        .spyOn(svc, 'runConfirmationEmailJob')
        .mockRejectedValue(new Error('mail down'));
      jest.spyOn(svc, 'runOperatorNoticeJob').mockResolvedValue(undefined);

      await expect(
        svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' }),
      ).resolves.toBeUndefined();
      expect(m.outboxEvent.create).toHaveBeenCalledTimes(1); // backstop committed
    });

    it('reconciles every EUR figure onto the PSP charge rate when one is supplied (5C)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({
          currency: 'USD',
          paymentModel: PaymentModel.PAID_IN_FULL,
          totalRetail: D('100'),
          depositAmount: D('100'),
          fxRateToEur: D('0.92'), // ECB snapshot at reserve
          totalEur: D('92'),
          commissionRate: D('0.2'),
          commissionAmount: D('18.4'),
        }),
      );

      await svc.confirmFromPayment('b1', undefined, {
        rateToEur: D('0.9134'), // Stripe's actual charge conversion
        provider: 'stripe',
        asOf: new Date('2026-07-25T10:00:00Z'),
      });

      // The finalize write re-anchors fxRateToEur/totalEur/commissionAmount to
      // the PSP's true rate (NOT the ?? fallback path) + stamps the audit trail.
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', conversionFiredAt: null },
          data: expect.objectContaining({
            fxRateToEur: D('0.9134'),
            totalEur: D('91.34'),
            commissionAmount: D('18.27'),
            eurFxProvider: 'stripe',
            eurFxProviderAsOf: new Date('2026-07-25T10:00:00Z'),
          }),
        }),
      );
      // The settlement ledger row is written from the SAME reconciled figures:
      // paid_in_full -> collected = the full total at the PSP's true rate.
      const c = m.settlement.upsert.mock.calls[0][0].create;
      expect(c.commissionOwed).toEqual(D('18.27'));
      expect(c.amountCollected).toEqual(D('91.34')); // 100 * 0.9134
      expect(c.netPosition).toEqual(D('73.07')); // the payout owed the operator
    });

    it('an EUR-charged booking ignores a stray PSP rate (nothing was converted)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({
          currency: 'EUR',
          totalRetail: D('100'),
          fxRateToEur: D('1'),
          totalEur: D('100'),
          commissionAmount: D('20'),
        }),
      );

      await svc.confirmFromPayment('b1', undefined, {
        rateToEur: D('0.9'),
        provider: 'mollie',
        asOf: new Date('2026-07-25T10:00:00Z'),
      });

      const finalizeCall = m.booking.updateMany.mock.calls.find(
        ([arg]: [{ where: { conversionFiredAt?: null } }]) =>
          arg.where && 'conversionFiredAt' in arg.where,
      );
      expect(finalizeCall).toBeDefined();
      const data = finalizeCall![0].data as Record<string, unknown>;
      expect(data.fxRateToEur).toEqual(D('1'));
      expect(data.totalEur).toEqual(D('100'));
      expect(data.commissionAmount).toEqual(D('20'));
      expect(data.eurFxProvider).toBeUndefined();
      expect(data.eurFxProviderAsOf).toBeUndefined();
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

    // Pay-after-expiry (task #47): the hold was swept to EXPIRED before the payment
    // landed. The seat-claim guard on the initial ON_HOLD->CONFIRMED matches 0 rows,
    // so recovery re-claims inventory in a guarded transaction.
    it('recovers an EXPIRED booking when seats can be re-claimed (confirms once)', async () => {
      m.booking.updateMany
        .mockResolvedValueOnce({ count: 0 }) // ON_HOLD guard: not on hold (expired)
        .mockResolvedValue({ count: 1 }); // EXPIRED->CONFIRMED flip, then conversion guard
      m.booking.findUnique
        .mockResolvedValueOnce(confirmable({ status: BookingStatus.EXPIRED }))
        .mockResolvedValue(confirmable({ status: BookingStatus.CONFIRMED }));
      m.departure.findUnique.mockResolvedValue({
        capacity: 10,
        bookedCount: 2,
        status: 'OPEN',
        soldOutAt: null,
      });
      // $executeRaw defaults to 1: the guarded re-claim wins (seats available).

      await svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' });

      // Re-claimed inventory (guarded departure count-up) + confirmed once:
      // the finalize winner commits exactly one `booking.confirmed` outbox event.
      expect(claimCalls(m).length).toBeGreaterThan(0);
      expect(m.outboxEvent.create).toHaveBeenCalledTimes(1);
      // Availability changed (seats re-claimed), so the availability event fires too.
      expect(notifications.emitBookingUpdate).toHaveBeenCalledTimes(1);
    });

    it('does NOT confirm an EXPIRED booking when seats are gone - refunds the captured payment (B5)', async () => {
      const err = jest
        .spyOn((svc as any).logger, 'error')
        .mockImplementation(() => undefined);
      m.booking.updateMany
        .mockResolvedValueOnce({ count: 0 }) // ON_HOLD guard: expired
        .mockResolvedValue({ count: 1 }); // flip wins in-tx, but claim below fails -> rollback
      // Booking stays EXPIRED (the tx rolls back on sold-out).
      m.booking.findUnique.mockResolvedValue(
        confirmable({ status: BookingStatus.EXPIRED }),
      );
      m.departure.findUnique.mockResolvedValue({ id: 'dep1' }); // departure exists
      m.$executeRaw.mockResolvedValue(0); // SOLD OUT - the guarded re-claim loses
      // A captured payment exists to reverse.
      m.payment.findFirst
        .mockResolvedValueOnce(null) // no prior REFUND
        .mockResolvedValueOnce({
          amount: D('120'),
          currency: 'EUR',
          intentId: 'pi_x',
          chargeId: 'ch_x',
        });

      await svc.confirmFromPayment('b1', { last4: '4242', brand: 'visa' });

      // No confirmation side effects...
      expect(tracking.fireBookingComplete).not.toHaveBeenCalled();
      expect(mail.sendBookingConfirmationEmail).not.toHaveBeenCalled();
      expect(notifications.emitBookingUpdate).not.toHaveBeenCalled();
      // ...but the captured money is refunded (B2 refund-owed reconciliation).
      expect(stripe.refundIntent).toHaveBeenCalledWith('pi_x', 'refund-b1');
      expect(m.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: 'REFUND' }),
        }),
      );
      err.mockRestore();
    });

    // Operator-payout ledger (B3, founder 2026-07-26): a row is written ONLY for
    // paid_in_full (the model where IT holds the operator's money). Self-settling
    // deposit models and operator_full never get a row - a noise-free ledger.
    const settlementCreate = () => m.settlement.upsert.mock.calls[0][0].create;

    it('writes NO settlement row for a deposit model (self-settling: deposit == commission)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({
          paymentModel: PaymentModel.OPERATOR_LINK,
          depositAmount: D('20'),
          totalRetail: D('100'),
          commissionRate: D('0.2'), // -> commission 20 == deposit: nothing to move
        }),
      );

      await svc.confirmFromPayment('b1');

      expect(m.settlement.upsert).not.toHaveBeenCalled();
    });

    it('records the payout owed for paid_in_full (IT owes the operator the remainder)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({
          paymentModel: PaymentModel.PAID_IN_FULL,
          totalRetail: D('100'),
          commissionRate: D('0.2'),
        }),
      );

      await svc.confirmFromPayment('b1');

      const c = settlementCreate();
      expect(c.paymentModel).toBe(PaymentModel.PAID_IN_FULL);
      expect(c.amountCollected.toString()).toBe('100'); // full total collected
      expect(c.commissionOwed.toString()).toBe('20');
      expect(c.netPosition.toString()).toBe('80'); // the payout owed the operator
    });

    it('writes NO settlement row for operator_full (IT never held any money)', async () => {
      m.booking.updateMany.mockResolvedValue({ count: 1 });
      m.booking.findUnique.mockResolvedValue(
        confirmable({
          paymentModel: PaymentModel.OPERATOR_FULL,
          totalRetail: D('100'),
          commissionRate: D('0.2'),
        }),
      );

      await svc.confirmFromPayment('b1');

      expect(m.settlement.upsert).not.toHaveBeenCalled();
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

    it('translates the FORFEITED display-status filter to its defining predicate', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list(
        { status: 'FORFEITED' },
        { id: 'admin-1', role: Role.ADMIN },
      );
      const where = prisma.booking.findMany.mock.calls.at(-1)[0].where;
      expect(where.status).toBe(BookingStatus.CANCELLED);
      expect(where.utcForfeitedAt).toEqual({ not: null });
    });

    it('translates NON_PAYMENT_REPORTED to confirmed + pending report', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list(
        { status: 'NON_PAYMENT_REPORTED' },
        { id: 'admin-1', role: Role.ADMIN },
      );
      const where = prisma.booking.findMany.mock.calls.at(-1)[0].where;
      expect(where.status).toBe(BookingStatus.CONFIRMED);
      expect(where.utcNonPaymentReportedAt).toEqual({ not: null });
      expect(where.utcForfeitedAt).toBeNull();
    });

    it('passes raw enum statuses through unchanged (CANCELLED includes forfeited)', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      await svc.list(
        { status: BookingStatus.CANCELLED },
        { id: 'admin-1', role: Role.ADMIN },
      );
      const where = prisma.booking.findMany.mock.calls.at(-1)[0].where;
      expect(where.status).toBe(BookingStatus.CANCELLED);
      expect(where.utcForfeitedAt).toBeUndefined();
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

    // The booking is still CONFIRMED while a cancellation request is pending -
    // re-sending "You're booked!" then reads as the platform ignoring the
    // request (user-reported 2026-07-30).
    it('409s while a cancellation request is pending', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          utcCancellationRequestedAt: new Date('2030-01-02T00:00:00.000Z'),
          utcCancelledAt: null,
        }),
      );
      await expect(svc.resendConfirmation('p1')).rejects.toBeInstanceOf(
        ConflictException,
      );
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

    it('gates pickup/notes on CONFIRMED too - the snapshot moves with them', async () => {
      // `update()` re-snapshots the pickup address and window onto the booking,
      // so an unproven edit sends a paying traveler to the wrong place at the
      // wrong time. The booking id is not a secret here: it rides in the PATCH
      // URL path (server logs, APM traces, Referer headers).
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          contactEmail: 'guest@example.test',
        }),
      );
      await expect(
        svc.update('b1', { notes: 'gate 4' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        svc.update('b1', { pickupLocationId: 'pl2' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('allows pickup/notes on CONFIRMED with a session that owns the booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({
          status: BookingStatus.CONFIRMED,
          contactEmail: 'guest@example.test',
        }),
      );
      await svc.update(
        'b1',
        { notes: 'gate 4' },
        issueTravelerSession('guest@example.test'),
      );
      expect(m.booking.update).toHaveBeenCalled();
    });

    it('leaves pickup/notes ungated while ON_HOLD (checkout sets them pre-payment)', async () => {
      m.booking.findUnique.mockResolvedValue(
        fakeBooking({ status: BookingStatus.ON_HOLD }),
      );
      await svc.update('b1', { notes: 'gate 4' });
      expect(m.booking.update).toHaveBeenCalled();
    });
  });

  // QA report 2026-08-01: admin reversal of an executed cancellation.
  describe('restore', () => {
    const ADMIN = { id: 'admin1', role: Role.ADMIN };

    /** A confirmed-then-cancelled booking - the only restorable shape. */
    const cancelled = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CANCELLED,
        utcConfirmedAt: new Date('2030-06-01T08:00:00.000Z'),
        utcCancelledAt: new Date('2030-06-02T08:00:00.000Z'),
        utcForfeitedAt: null,
        cancelledBy: CancelledBy.ADMIN,
        cancellationRefund: CancellationRefund.NONE,
        island: 'curacao',
        ...over,
      });

    const openDeparture = () => ({
      capacity: 10,
      bookedCount: 4,
      status: DepartureStatus.OPEN,
      soldOutAt: null,
    });

    beforeEach(() => {
      m.departure.findUnique.mockResolvedValue(openDeparture());
      // The fresh row read back at the end of the transaction. No
      // contactEmail: the resend then no-ops, keeping these tests about the
      // restore itself (the confirmation email has its own suite).
      m.booking.findUniqueOrThrow.mockResolvedValue(
        cancelled({ status: BookingStatus.CONFIRMED, utcCancelledAt: null }),
      );
    });

    it('403s any non-admin actor - same conflict-#2 boundary as cancel', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      await expect(
        svc.restore('b1', { id: 'op-user', role: Role.TOUR_OPERATOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.booking.updateMany).not.toHaveBeenCalled();
    });

    it('is an idempotent no-op on an already-CONFIRMED booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        cancelled({ status: BookingStatus.CONFIRMED, utcCancelledAt: null }),
      );
      const res = await svc.restore('b1', ADMIN);
      expect(res.status).toBe(BookingStatus.CONFIRMED);
      expect(m.booking.updateMany).not.toHaveBeenCalled();
      expect(m.departure.updateMany).not.toHaveBeenCalled();
    });

    it('409s a booking that never confirmed - a hold release has nothing to restore', async () => {
      m.booking.findUnique.mockResolvedValue(
        cancelled({ utcConfirmedAt: null }),
      );
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409s a forfeited booking - forfeit is its own terminal path', async () => {
      m.booking.findUnique.mockResolvedValue(
        cancelled({ utcForfeitedAt: new Date('2030-06-03') }),
      );
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409s once the departure has already run', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled({ localDate: PAST }));
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409s when the traveller was already refunded (settled or in flight)', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      m.payment.findFirst.mockResolvedValueOnce({ id: 'refund-row' });
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // Refused BEFORE any state is touched.
      expect(m.booking.updateMany).not.toHaveBeenCalled();
      const where = m.payment.findFirst.mock.calls[0][0].where;
      expect(where.kind).toBe(PaymentKind.REFUND);
      expect(where.status.in).toEqual(
        expect.arrayContaining([
          PaymentStatus.REFUNDED,
          PaymentStatus.PROCESSING,
        ]),
      );
    });

    it('409s when a racing restore already flipped the booking (guarded status flip)', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      m.booking.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // The loser must abort BEFORE claiming seats.
      expect(claimCalls(m).length).toBe(0);
    });

    it('409s when the seats were resold after the cancellation', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      m.$executeRaw.mockResolvedValueOnce(0); // guard lost: seats resold
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409s when the departure itself was cancelled', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      m.departure.findUnique.mockResolvedValue({
        ...openDeparture(),
        status: DepartureStatus.CANCELLED,
      });
      await expect(svc.restore('b1', ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('restores: guarded flip clears every cancellation stamp, re-claims seats, notifies', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());

      const res = await svc.restore('b1', ADMIN);
      expect(res.status).toBe(BookingStatus.CONFIRMED);

      // The guarded CANCELLED->CONFIRMED flip carries every stamp clear.
      const flip = m.booking.updateMany.mock.calls[0][0];
      expect(flip.where).toEqual({
        id: 'b1',
        status: BookingStatus.CANCELLED,
      });
      expect(flip.data).toEqual(
        expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          utcCancelledAt: null,
          utcCancellationRequestedAt: null,
          cancellationRefund: null,
          cancellationReason: null,
          cancelledBy: null,
          utcOperatorCancellationReportedAt: null,
          operatorCancellationReason: null,
        }),
      );

      // Seat re-claim is the same guarded count-up the reserve path uses, in
      // restore mode: the guard compares live columns in SQL, sticky
      // SOLD_OUT/CLOSED are accepted, only a CANCELLED departure is refused.
      const claim = claimCalls(m)[0];
      expect(claim.sql).toContain('"bookedCount" + ? <= "capacity"');
      expect(claim.sql).toContain(`<> 'cancelled'::"departure_status"`);
      expect(claim.values).toEqual(expect.arrayContaining([2, 'dep1', 't1']));

      // Unit items travel with the booking.
      expect(m.bookingUnitItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: BookingStatus.CONFIRMED },
        }),
      );

      // The operator hears its seats are booked again.
      expect(inbox.notify).toHaveBeenCalledWith(
        expect.objectContaining({ event: InboxEvent.BOOKING_RESTORED }),
      );
    });

    it('reinstates a REVERSED settlement with its net obligation recomputed', async () => {
      m.booking.findUnique.mockResolvedValue(cancelled());
      m.settlement.findUnique.mockResolvedValueOnce({
        status: 'REVERSED',
        amountCollected: D('159.98'),
        commissionOwed: D('31.99'),
      });

      await svc.restore('b1', ADMIN);

      const update = m.settlement.update.mock.calls[0][0];
      expect(update.data.status).toBe('RECORDED');
      expect(update.data.netPosition.toString()).toBe('127.99');
    });

    it('claims the WHOLE unit for an exclusive charter, and only if still empty', async () => {
      m.booking.findUnique.mockResolvedValue(
        cancelled({ exclusiveDeparture: true }),
      );
      m.departure.findUnique.mockResolvedValue({
        ...openDeparture(),
        bookedCount: 0,
      });

      await svc.restore('b1', ADMIN);

      // Whole-unit re-claim: only a still-empty departure, filled to the LIVE
      // capacity column; sticky states accepted, CANCELLED refused.
      const claim = claimCalls(m)[0];
      expect(claim.sql).toContain('SET "bookedCount" = "capacity"');
      expect(claim.sql).toContain('AND "bookedCount" = 0');
      expect(claim.sql).toContain(`<> 'cancelled'::"departure_status"`);
    });
  });

  // QA report 2026-08-01: traveller withdrawal of a pending request.
  describe('withdrawCancellationRequest', () => {
    const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    const requested = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFirstName: 'Shahadat',
        utcCancellationRequestedAt: new Date('2026-07-30T10:00:00.000Z'),
        island: 'curacao',
        tour: { name: 'Klein Curacao Day Trip' },
        ...over,
      });

    const ownerToken = () => issueTravelerSession('guest@example.test');

    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';
    });

    afterAll(() => {
      process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    });

    it('clears the stamp via a guarded consume and notifies admin + traveller + operator', async () => {
      m.booking.findUnique.mockResolvedValue(requested());

      await expect(
        svc.withdrawCancellationRequest('p1', ownerToken()),
      ).resolves.toEqual({ withdrawn: true });

      // Guarded consume: only a still-set stamp matches, so racing withdraws
      // can never notify twice.
      const consume = m.booking.updateMany.mock.calls[0][0];
      expect(consume.where.utcCancellationRequestedAt).toEqual({ not: null });
      expect(consume.data).toEqual({ utcCancellationRequestedAt: null });

      // The admin is told FIRST - they might still execute the old request.
      const notices = mail.sendBookingNoticeEmail.mock.calls;
      expect(notices.length).toBeGreaterThanOrEqual(2);
      expect(notices[0][0]).toBe('admin@islandtours.test');
      expect(notices[1][0]).toBe('guest@example.test');

      expect(inbox.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          event: InboxEvent.BOOKING_CANCELLATION_WITHDRAWN,
        }),
      );
    });

    it('is a quiet success with NO notices when nothing is pending', async () => {
      m.booking.findUnique.mockResolvedValue(
        requested({ utcCancellationRequestedAt: null }),
      );
      await expect(
        svc.withdrawCancellationRequest('p1', ownerToken()),
      ).resolves.toEqual({ withdrawn: true });
      expect(m.booking.updateMany).not.toHaveBeenCalled();
      expect(mail.sendBookingNoticeEmail).not.toHaveBeenCalled();
    });

    it('is a quiet success with NO notices when a racing withdraw won the consume', async () => {
      m.booking.findUnique.mockResolvedValue(requested());
      m.booking.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(
        svc.withdrawCancellationRequest('p1', ownerToken()),
      ).resolves.toEqual({ withdrawn: true });
      expect(mail.sendBookingNoticeEmail).not.toHaveBeenCalled();
    });

    it('409s once the booking was cancelled - restoring is an admin action', async () => {
      m.booking.findUnique.mockResolvedValue(
        requested({ status: BookingStatus.CANCELLED }),
      );
      await expect(
        svc.withdrawCancellationRequest('p1', ownerToken()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('401s without a traveler session - link possession alone cannot withdraw', async () => {
      m.booking.findUnique.mockResolvedValue(requested());
      await expect(
        svc.withdrawCancellationRequest('p1', undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('401s a session bound to a DIFFERENT email', async () => {
      m.booking.findUnique.mockResolvedValue(requested());
      await expect(
        svc.withdrawCancellationRequest(
          'p1',
          issueTravelerSession('stranger@example.test'),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('404s an unknown publicRef', async () => {
      m.booking.findUnique.mockResolvedValue(null);
      await expect(
        svc.withdrawCancellationRequest('nope', ownerToken()),
      ).rejects.toBeInstanceOf(NotFoundException);
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

  // Conflict #2: operators REPORT cancellations; only an admin executes them.
  describe('reportCancellation / dismissCancellationReport (conflict #2)', () => {
    const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const op = { id: 'user-9', role: Role.TOUR_OPERATOR };
    const admin = { id: 'admin-1', role: Role.ADMIN };

    const confirmed = (over: Record<string, unknown> = {}) =>
      fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: 'guest@example.test',
        contactFullName: 'Guest Person',
        utcOperatorCancellationReportedAt: null,
        operatorCancellationReason: null,
        ...over,
      });

    beforeEach(() => {
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';
      // Serves BOTH lookups: resolveOperatorId (by userId) and the company
      // name read (by id).
      m.operator.findUnique.mockResolvedValue({
        id: 'op1',
        companyInfo: { companyName: 'Blue Boats' },
      });
      m.tour.findUnique.mockResolvedValue({ name: 'Klein Curacao Day Trip' });
    });

    afterAll(() => {
      process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    });

    it('stamps the report + reason and emails the admin as an OPERATOR report', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.booking.update.mockResolvedValue(
        confirmed({
          utcOperatorCancellationReportedAt: new Date(),
          operatorCancellationReason: 'Engine failure',
        }),
      );

      await svc.reportCancellation('b1', { reason: 'Engine failure' }, op);

      // Race-safe conditional stamp: only the FIRST report matches (the
      // where pins utcOperatorCancellationReportedAt: null).
      expect(m.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', utcOperatorCancellationReportedAt: null },
          data: {
            utcOperatorCancellationReportedAt: expect.any(Date),
            operatorCancellationReason: 'Engine failure',
          },
        }),
      );
      expect(mail.sendCancellationRequestEmail).toHaveBeenCalledTimes(1);
      const [to, details] = mail.sendCancellationRequestEmail.mock.calls[0];
      expect(to).toBe('admin@islandtours.test');
      expect(details.source).toBe('operator');
      expect(details.reporterName).toBe('Blue Boats');
      expect(details.reason).toBe('Engine failure');
      expect(details.displayRef).toBe('IT-2030-AAAA');
    });

    it('sends NO email when the conditional stamp loses a concurrent race', async () => {
      m.booking.findUnique.mockResolvedValue(confirmed());
      m.booking.updateMany.mockResolvedValueOnce({ count: 0 });
      const res = await svc.reportCancellation('b1', {}, op);
      expect(res.id).toBe('b1');
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('is idempotent: a repeat report neither re-stamps nor re-emails', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          utcOperatorCancellationReportedAt: new Date(
            '2030-06-01T00:00:00.000Z',
          ),
        }),
      );
      const res = await svc.reportCancellation('b1', {}, op);
      expect(res.id).toBe('b1');
      expect(m.booking.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utcOperatorCancellationReportedAt: expect.any(Date),
          }),
        }),
      );
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it("404s an operator reporting on ANOTHER operator's booking", async () => {
      m.booking.findUnique.mockResolvedValue(confirmed({ operatorId: 'op1' }));
      m.operator.findUnique.mockResolvedValue({ id: 'op-other' });
      await expect(svc.reportCancellation('b1', {}, op)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mail.sendCancellationRequestEmail).not.toHaveBeenCalled();
    });

    it('409s a report on a non-CONFIRMED booking', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({ status: BookingStatus.ON_HOLD }),
      );
      await expect(svc.reportCancellation('b1', {}, op)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('503s when ADMIN_EMAIL is not configured (the report MUST reach a human)', async () => {
      delete process.env.ADMIN_EMAIL;
      m.booking.findUnique.mockResolvedValue(confirmed());
      await expect(svc.reportCancellation('b1', {}, op)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(m.booking.update).not.toHaveBeenCalled();
    });

    it('dismiss clears the stamp AND the stored reason', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          utcOperatorCancellationReportedAt: new Date(
            '2030-06-01T00:00:00.000Z',
          ),
          operatorCancellationReason: 'Engine failure',
        }),
      );
      m.booking.update.mockResolvedValue(confirmed());

      await svc.dismissCancellationReport('b1', admin);

      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            utcOperatorCancellationReportedAt: null,
            operatorCancellationReason: null,
          },
        }),
      );
    });

    it('409s a dismiss once the booking is already cancelled', async () => {
      m.booking.findUnique.mockResolvedValue(
        confirmed({
          status: BookingStatus.CANCELLED,
          utcOperatorCancellationReportedAt: new Date(
            '2030-06-01T00:00:00.000Z',
          ),
        }),
      );
      await expect(
        svc.dismissCancellationReport('b1', admin),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Traveller account area (/{locale}/traveller)
  // ══════════════════════════════════════════════════════════════════════
  // The whole point of this surface is that it needs a STRONGER credential
  // than the `/bookings` pair lookup: one forwarded confirmation email must
  // not open someone's entire booking + payment history.
  describe('traveller account login (OTP)', () => {
    const EMAIL = 'guest@example.test';

    /** The row the service would have written for `code`. */
    function liveCodeRow(code: string, over: Record<string, unknown> = {}) {
      return {
        id: 'code1',
        email: EMAIL,
        codeHash: hashLoginCode(EMAIL, code),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(),
        ...over,
      };
    }

    // The sign-in code email needs the address and nothing else, so the lookup
    // selects exactly that. Stored casing differs from the caller's input on
    // purpose - the mail must go to the stored value.
    function bookingForCodeEmail() {
      return { contactEmail: 'Guest@Example.TEST' };
    }

    describe('requestTravellerLoginCode', () => {
      // `sent: false` is a DELIBERATE enumeration trade-off (founder
      // 2026-07-30): the UI shows "no bookings under this email" instead of
      // the always-positive ack. Throttles bound probing.
      it('answers sent:false without creating or mailing anything for an unknown email', async () => {
        m.booking.findFirst.mockResolvedValue(null);

        await expect(
          svc.requestTravellerLoginCode({ email: 'nobody@example.test' }),
        ).resolves.toEqual({ sent: false });

        expect(m.travelerLoginCode.create).not.toHaveBeenCalled();
        expect(mail.sendTravellerLoginCodeEmail).not.toHaveBeenCalled();
      });

      it('caps per target email (1/min, 5/day) for KNOWN emails, after the existence check', async () => {
        m.booking.findFirst.mockResolvedValue(bookingForCodeEmail());

        await svc.requestTravellerLoginCode({ email: EMAIL });

        expect(targetLimiter.consume).toHaveBeenCalledWith(
          'traveller-otp',
          EMAIL,
          [
            { max: 1, windowMs: 60 * 1000 },
            { max: 5, windowMs: 24 * 60 * 60 * 1000 },
          ],
          expect.stringContaining('sign-in code'),
        );
      });

      // Ordering guarantee (founder 2026-07-31): an unknown address must
      // answer sent:false CONSISTENTLY. When the limiter ran first, the
      // second click 429ed before the lookup and the login card advanced an
      // unknown email to a code screen that could never succeed.
      it('never consumes the per-email limiter for an unknown email', async () => {
        m.booking.findFirst.mockResolvedValue(null);

        await expect(
          svc.requestTravellerLoginCode({ email: 'nobody@example.test' }),
        ).resolves.toEqual({ sent: false });

        expect(targetLimiter.consume).not.toHaveBeenCalled();
      });

      // The per-email 429 is the ONLY 429 the login card may advance on, so
      // it must be distinguishable from the generic per-IP guard's: it fires
      // post-existence-check and carries `reason: 'otp-pending'`.
      it("marks the per-email 429 with reason 'otp-pending'", async () => {
        m.booking.findFirst.mockResolvedValue(bookingForCodeEmail());
        (targetLimiter.consume as jest.Mock).mockImplementationOnce(() => {
          throw new HttpException(
            'recently requested',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        });

        await expect(
          svc.requestTravellerLoginCode({ email: EMAIL }),
        ).rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
          response: expect.objectContaining({ reason: 'otp-pending' }),
        });
        expect(m.travelerLoginCode.create).not.toHaveBeenCalled();
      });

      it('stores only a keyed hash - never the code itself - and mails the stored address', async () => {
        m.booking.findFirst.mockResolvedValue(bookingForCodeEmail());

        await svc.requestTravellerLoginCode({ email: ' GUEST@example.test ' });

        const row = m.travelerLoginCode.create.mock.calls[0][0].data;
        expect(row.email).toBe(EMAIL); // normalized
        expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
        expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

        // The mailed code must hash to exactly what was stored, and must not
        // be recoverable from the row.
        const [to, code, expiresInLabel] =
          mail.sendTravellerLoginCodeEmail.mock.calls[0];
        expect(code).toMatch(/^\d{6}$/);
        expect(hashLoginCode(EMAIL, code)).toBe(row.codeHash);
        expect(row.codeHash).not.toContain(code);
        // Recipient is the STORED address, never the caller's casing/input.
        expect(to).toBe('Guest@Example.TEST');
        // The window the traveller is told about must be the one enforced.
        expect(expiresInLabel).toBe('10 minutes');
      });

      it('invalidates any previous unconsumed code for that email', async () => {
        m.booking.findFirst.mockResolvedValue(bookingForCodeEmail());

        await svc.requestTravellerLoginCode({ email: EMAIL });

        expect(m.travelerLoginCode.updateMany).toHaveBeenCalledWith({
          where: { email: EMAIL, consumedAt: null },
          data: { consumedAt: expect.any(Date) },
        });
      });
    });

    describe('verifyTravellerLoginCode', () => {
      /** The conditional attempt-take succeeds; later writes use `rest`. */
      function attemptTaken(...rest: { count: number }[]) {
        const mock = m.travelerLoginCode.updateMany.mockResolvedValueOnce({
          count: 1,
        });
        for (const r of rest) mock.mockResolvedValueOnce(r);
        return mock;
      }

      it('rejects with the SAME generic 401 when no live code exists', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(null);
        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '123456' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      // The pentest finding (2026-08-01): with no live code this method used
      // to answer 401 at zero cost forever, because the attempt counter lives
      // on the code row. The per-email budget is charged FIRST, so the free
      // oracle is gone.
      it('charges the per-email guess budget even when there is no code to guess at', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(null);

        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '123456' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(targetLimiter.consume).toHaveBeenCalledWith(
          'traveller-otp-verify',
          EMAIL,
          [
            { max: 12, windowMs: 15 * 60 * 1000 },
            { max: 30, windowMs: 24 * 60 * 60 * 1000 },
          ],
          expect.stringContaining('Too many sign-in attempts'),
        );
      });

      it("refuses a locked-out email with 429 reason 'too-many-attempts'", async () => {
        (targetLimiter.consume as jest.Mock).mockImplementationOnce(() => {
          throw new HttpException('nope', HttpStatus.TOO_MANY_REQUESTS);
        });
        m.travelerLoginCode.findFirst.mockResolvedValue(liveCodeRow('424242'));

        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '424242' }),
        ).rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
          response: { reason: 'too-many-attempts' },
        });
        // The budget is charged BEFORE anything is read, so a locked-out
        // guesser gets neither a query nor a try - not even with the CORRECT
        // code in hand.
        expect(m.travelerLoginCode.findFirst).not.toHaveBeenCalled();
        expect(m.travelerLoginCode.updateMany).not.toHaveBeenCalled();
      });

      // The cap must be enforced by the WRITE. Checking `row.attempts` from
      // the findFirst snapshot let N concurrent guesses all see the same value
      // and each spend a try on a code that allows five.
      it('spends the attempt with a capped conditional write, never a blind increment', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(liveCodeRow('111111'));
        attemptTaken();

        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '999999' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(m.travelerLoginCode.updateMany).toHaveBeenCalledWith({
          where: { id: 'code1', consumedAt: null, attempts: { lt: 5 } },
          data: { attempts: { increment: 1 } },
        });
        expect(m.travelerLoginCode.update).not.toHaveBeenCalled();
      });

      it('burns the code once the attempt budget is spent', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(
          liveCodeRow('111111', { attempts: 5 }),
        );
        // The capped write matches nothing - that IS the out-of-tries signal.
        m.travelerLoginCode.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '111111' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        // Consumed, not merely refused - a spent code is dead even if the
        // right digits arrive next.
        expect(m.travelerLoginCode.updateMany).toHaveBeenLastCalledWith({
          where: { id: 'code1', consumedAt: null },
          data: { consumedAt: expect.any(Date) },
        });
      });

      it('mints a HISTORY session on the right code and consumes it', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(liveCodeRow('424242'));
        attemptTaken({ count: 1 });

        const { sessionToken } = await svc.verifyTravellerLoginCode({
          email: ' Guest@Example.TEST ',
          code: '424242',
        });

        expect(verifyTravelerSession(sessionToken)).toEqual({
          email: EMAIL,
          bookingId: null,
          history: true,
        });
        // Redemption is a GUARDED write, not a blind update.
        expect(m.travelerLoginCode.updateMany).toHaveBeenLastCalledWith({
          where: { id: 'code1', consumedAt: null },
          data: { consumedAt: expect.any(Date) },
        });
      });

      // Two tabs submitting the same correct code at once: the read is a
      // snapshot, so only the guarded write can decide who actually redeemed.
      it('issues NO session to the loser of a concurrent redemption race', async () => {
        m.travelerLoginCode.findFirst.mockResolvedValue(liveCodeRow('424242'));
        attemptTaken({ count: 0 });

        await expect(
          svc.verifyTravellerLoginCode({ email: EMAIL, code: '424242' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });
    });
  });

  describe('traveller account reads', () => {
    const EMAIL = 'guest@example.test';
    const historyToken = () => issueTravelerHistorySession(EMAIL);

    function travellerRow(over: Record<string, unknown> = {}) {
      return fakeBooking({
        status: BookingStatus.CONFIRMED,
        contactEmail: EMAIL,
        contactFullName: 'Jane Doe',
        tourStartDateTime: new Date('2030-06-05T13:00:00.000Z'),
        tourEndDateTime: null,
        utcCancellationRequestedAt: null,
        utcNonPaymentReportedAt: null,
        utcForfeitedAt: null,
        utcOperatorCancellationReportedAt: null,
        operatorCancellationReason: null,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        tour: {
          name: 'Klein Curacao',
          slug: 'klein-curacao-day-trip',
          cancellationHours: 48,
          durationMinutesFrom: 480,
          checkInMinutesBefore: 30,
          meetingPointLat: 12.07,
          meetingPointLng: -68.86,
          destination: { slug: 'curacao', name: 'Curaçao' },
          images: [{ url: 'https://cdn.test/hero.webp' }],
          translations: [
            { locale: 'en', meetingPointText: 'Caracasbaai jetty' },
          ],
          locations: [],
        },
        operator: {
          contactEmail: 'ops@example.test',
          contactPhone: '+599 9 560 1367',
          companyInfo: {
            companyName: 'Miss Ann',
            companyEmail: 'info@example.test',
            companyPhone: null,
          },
        },
        payments: [],
        settlement: null,
        review: null,
        reviewInvitation: null,
        ...over,
      });
    }

    // The security property this whole feature rests on: a weaker token that
    // is perfectly VALID elsewhere must not open the account surface.
    describe('session scope gate', () => {
      it.each([
        ['no token at all', () => undefined],
        ['a `/bookings` pair-login token', () => issueTravelerSession(EMAIL)],
        ['a checkout booking-scoped token', () => issueBookingSession('b1')],
        ['a garbage token', () => 'v1.nonsense.nonsense'],
      ])('rejects %s on every account read', async (_label, token) => {
        const t = token();
        await expect(svc.listTravellerBookings({}, t)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(svc.getTravellerSummary(t)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(svc.listTravellerPayments({}, t)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        await expect(svc.getTravellerContact(t)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });
    });

    // Checkout prefill (test report 2026-08-01 §Traveler.1).
    describe('getTravellerContact', () => {
      it('returns the most recent booking contact, scoped by session email', async () => {
        m.booking.findFirst.mockResolvedValue({
          contactFirstName: 'Jane',
          contactLastName: 'Doe',
          contactPhone: '+5999123456',
          contactCountry: 'CW',
        });

        const res = await svc.getTravellerContact(historyToken());

        expect(res).toEqual({
          hasHistory: true,
          email: EMAIL,
          firstName: 'Jane',
          lastName: 'Doe',
          phone: '+5999123456',
          country: 'CW',
        });
        const args = m.booking.findFirst.mock.calls[0][0];
        expect(args.where).toEqual({
          contactEmail: { equals: EMAIL, mode: 'insensitive' },
        });
        // Latest wins: a traveller who moved expects their newest details.
        expect(args.orderBy).toEqual({ createdAt: 'desc' });
      });

      // A first-time traveller signed in at the account door still gets their
      // proven email back - checkout locks the field on it either way.
      it('still returns the session email when there is no earlier booking', async () => {
        m.booking.findFirst.mockResolvedValue(null);

        await expect(svc.getTravellerContact(historyToken())).resolves.toEqual({
          hasHistory: false,
          email: EMAIL,
          firstName: null,
          lastName: null,
          phone: null,
          country: null,
        });
      });

      // The payload is the caller's own contact block and nothing else: no
      // booking ids, no operator, no payment or commission context.
      it('selects only the four contact columns', async () => {
        m.booking.findFirst.mockResolvedValue(null);

        await svc.getTravellerContact(historyToken());

        expect(m.booking.findFirst.mock.calls[0][0].select).toEqual({
          contactFirstName: true,
          contactLastName: true,
          contactPhone: true,
          contactCountry: true,
        });
      });
    });

    describe('listTravellerBookings', () => {
      it('scopes by contact email case-insensitively (covers pre-account guest bookings)', async () => {
        m.booking.count.mockResolvedValue(1);
        m.booking.findMany.mockResolvedValue([travellerRow()]);

        await svc.listTravellerBookings({}, historyToken());

        const where = m.booking.findMany.mock.calls[0][0].where;
        expect(where).toEqual({
          contactEmail: { equals: EMAIL, mode: 'insensitive' },
        });
        // NEVER userId - guests who booked before any account existed must
        // still see their trips.
        expect(where.userId).toBeUndefined();
      });

      it('withholds operator/ops/PII context and commission from the row', async () => {
        m.booking.count.mockResolvedValue(1);
        m.booking.findMany.mockResolvedValue([travellerRow()]);

        const [row] = (await svc.listTravellerBookings({}, historyToken()))
          .data as Record<string, unknown>[];

        for (const withheld of [
          'settlementStatus',
          'settlementMethod',
          'settlementHeld',
          'contactEmail',
          'contactFullName',
          'utcNonPaymentReportedAt',
          'utcForfeitedAt',
          'utcOperatorCancellationReportedAt',
          'operatorCancellationReason',
        ]) {
          expect(row).not.toHaveProperty(withheld);
        }
        // Nulled (not omitted) so the payload shape never varies by caller.
        expect(row.commissionRate).toBeNull();
        expect(row.commissionAmount).toBeNull();
      });

      it('keeps what the cards render: money, verdicts, deep-link slug and review state', async () => {
        m.booking.count.mockResolvedValue(1);
        m.booking.findMany.mockResolvedValue([travellerRow()]);

        const [row] = (await svc.listTravellerBookings({}, historyToken()))
          .data as Record<string, unknown>[];

        expect(row).toMatchObject({
          displayRef: 'IT-2030-AAAA',
          publicRef: 'p1',
          tourName: 'Klein Curacao',
          partySize: 2,
          // The manage deep-link is /{destinationSlug}/thank-you/{publicRef}.
          destinationSlug: 'curacao',
          paymentStatus: 'UNPAID',
          paidAmount: '0',
          canRequestCancellation: true,
          cancellationBlockedReason: null,
          // Logistics + support facts the redesigned card renders (review F7,
          // 5.8): where to show up, how early, how long, who to call.
          destinationName: 'Curaçao',
          tourSlug: 'klein-curacao-day-trip',
          tourImageUrl: 'https://cdn.test/hero.webp',
          durationMinutesFrom: 480,
          arrivalBufferMinutes: 30,
          meetingPoint: 'Caracasbaai jetty',
          meetingPointLat: 12.07,
          meetingPointLng: -68.86,
          operator: {
            name: 'Miss Ann',
            email: 'ops@example.test',
            phone: '+599 9 560 1367',
          },
        });
        expect(row.review).toEqual({
          reviewed: false,
          canReview: false,
          reviewToken: null,
        });
      });

      it('caps the page size the client can ask for', async () => {
        m.booking.count.mockResolvedValue(0);
        m.booking.findMany.mockResolvedValue([]);

        const res = await svc.listTravellerBookings(
          { page: 2, limit: 5 },
          historyToken(),
        );

        expect(m.booking.findMany.mock.calls[0][0]).toMatchObject({
          skip: 5,
          take: 5,
        });
        expect(res).toMatchObject({ page: 2, limit: 5 });
      });
    });

    describe('getTravellerSummary', () => {
      it('runs the same ledger math as the dashboard summary, scoped by email', async () => {
        m.booking.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        m.payment.groupBy
          .mockResolvedValueOnce([
            { currency: 'EUR', _sum: { amount: D('200.00') } },
          ])
          .mockResolvedValueOnce([
            { currency: 'EUR', _sum: { amount: D('50.00') } },
          ]);

        const res = await svc.getTravellerSummary(historyToken());

        expect(res).toEqual({
          bookingsCount: 2,
          upcomingCount: 1,
          totalSpend: [{ currency: 'EUR', amount: '150' }],
        });
        expect(m.payment.groupBy.mock.calls[0][0].where).toMatchObject({
          booking: { contactEmail: { equals: EMAIL, mode: 'insensitive' } },
        });
      });

      // A settled refund flips BOTH the refund row and the original charge to
      // REFUNDED - counting only SUCCEEDED would drop the pair, and when the
      // two legs settle out of lockstep (reconcileRefundRow skips the charge
      // flip on a row with no intentId) it would bill the traveller for money
      // they already got back.
      it('counts REFUNDED rows on both legs, like the per-row payment badge', async () => {
        m.booking.count.mockResolvedValue(0);
        m.payment.groupBy.mockResolvedValue([]);

        await svc.getTravellerSummary(historyToken());

        for (const call of m.payment.groupBy.mock.calls) {
          expect(call[0].where.status).toEqual({
            in: ['SUCCEEDED', 'REFUNDED'],
          });
        }
      });
    });

    describe('listTravellerPayments', () => {
      const paymentRow = {
        id: 'pay1',
        kind: 'DEPOSIT',
        status: 'SUCCEEDED',
        provider: 'STRIPE',
        methodType: 'card',
        amount: D('31.99'),
        currency: 'EUR',
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
        booking: {
          displayRef: 'IT-2030-AAAA',
          publicRef: 'p1',
          localDate: day('2030-06-05'),
          tour: { name: 'Klein Curacao', destination: { slug: 'curacao' } },
        },
      };

      it('returns a traveler-safe row and nothing else', async () => {
        m.payment.count.mockResolvedValue(1);
        m.payment.findMany.mockResolvedValue([paymentRow]);

        const [row] = (await svc.listTravellerPayments({}, historyToken()))
          .data as Record<string, unknown>[];

        expect(row).toEqual({
          id: 'pay1',
          kind: 'DEPOSIT',
          status: 'SUCCEEDED',
          provider: 'STRIPE',
          methodType: 'card',
          amount: '31.99',
          currency: 'EUR',
          createdAt: '2030-01-01T10:00:00.000Z',
          bookingDisplayRef: 'IT-2030-AAAA',
          bookingPublicRef: 'p1',
          destinationSlug: 'curacao',
          tourName: 'Klein Curacao',
          bookingLocalDate: '2030-06-05',
        });
        // Payout internals and provider ids are operator/platform context.
        for (const withheld of [
          'intentId',
          'chargeId',
          'contactFullName',
          'settlementStatus',
        ]) {
          expect(row).not.toHaveProperty(withheld);
        }
      });

      it('scopes to the session email through the booking relation', async () => {
        m.payment.count.mockResolvedValue(0);
        m.payment.findMany.mockResolvedValue([]);

        await svc.listTravellerPayments({}, historyToken());

        expect(m.payment.findMany.mock.calls[0][0].where).toEqual({
          booking: { contactEmail: { equals: EMAIL, mode: 'insensitive' } },
        });
      });

      // Review 5.7 subtotal chips: per currency, never a cross-currency sum,
      // and an in-flight (PROCESSING) refund stays in its own "on its way"
      // bucket instead of being claimed as refunded.
      it('returns per-currency ledger totals with in-flight refunds separate', async () => {
        m.payment.count.mockResolvedValue(0);
        m.payment.findMany.mockResolvedValue([]);
        m.payment.groupBy
          .mockResolvedValueOnce([
            { currency: 'USD', _sum: { amount: D('1917.88') } },
            { currency: 'EUR', _sum: { amount: D('155.48') } },
          ])
          .mockResolvedValueOnce([
            { currency: 'USD', _sum: { amount: D('1200.00') } },
          ])
          .mockResolvedValueOnce([
            { currency: 'EUR', _sum: { amount: D('155.48') } },
          ]);

        const res = await svc.listTravellerPayments({}, historyToken());

        expect(res.totals).toEqual({
          paid: [
            { currency: 'USD', amount: '1917.88' },
            { currency: 'EUR', amount: '155.48' },
          ],
          refunded: [{ currency: 'USD', amount: '1200' }],
          refundPending: [{ currency: 'EUR', amount: '155.48' }],
        });
        // The pending bucket counts ONLY in-flight refunds.
        expect(m.payment.groupBy.mock.calls[2][0].where).toMatchObject({
          kind: PaymentKind.REFUND,
          status: PaymentStatus.PROCESSING,
        });
      });
    });

    describe('getTravellerReceipt', () => {
      const receiptRow = {
        id: 'pay1',
        kind: 'DEPOSIT',
        status: 'SUCCEEDED',
        amount: D('36.20'),
        currency: 'USD',
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
        methodType: 'card',
        booking: {
          displayRef: 'IT-2030-AAAA',
          publicRef: 'p1',
          localDate: day('2030-06-05'),
          startTime: '07:00',
          contactFullName: null,
          contactFirstName: 'Jane',
          contactLastName: 'Doe',
          paymentMethodBrand: 'visa',
          paymentMethodLast4: '4242',
          paymentModel: PaymentModel.OPERATOR_LINK,
          totalRetail: D('181.00'),
          depositAmount: D('36.20'),
          balanceAmount: D('144.80'),
          pickupAddress: null,
          pickupTotalPrice: null,
          unitItems: [
            { ageBandId: 'band-adult', priceRetail: D('79.00') },
            { ageBandId: 'band-adult', priceRetail: D('79.00') },
            { ageBandId: 'band-child', priceRetail: D('23.00') },
            // Spectator twin of the adult band - SAME label, own line.
            { ageBandId: 'band-adult-spec', priceRetail: D('23.40') },
          ],
          addOns: [
            {
              name: 'Open bar upgrade',
              quantity: 2,
              unitPrice: D('25.00'),
              totalPrice: D('50.00'),
            },
          ],
          tour: {
            name: 'Klein Curacao',
            destination: { name: 'Curaçao', slug: 'curacao' },
            ageBands: [
              {
                id: 'band-adult',
                label: 'Adult (18+)',
                participation: 'PARTICIPANT',
              },
              {
                id: 'band-child',
                label: 'Child (4-12)',
                participation: 'PARTICIPANT',
              },
              {
                id: 'band-adult-spec',
                label: 'Adult (18+)',
                participation: 'SPECTATOR',
              },
            ],
          },
          operator: { companyInfo: { companyName: 'Miss Ann' } },
        },
      };

      it('returns the receipt with the payer name, scoped to the session email', async () => {
        m.payment.findFirst.mockResolvedValue(receiptRow);

        const res = await svc.getTravellerReceipt('pay1', historyToken());

        expect(m.payment.findFirst.mock.calls[0][0].where).toEqual({
          id: 'pay1',
          booking: { contactEmail: { equals: EMAIL, mode: 'insensitive' } },
        });
        expect(res).toMatchObject({
          id: 'pay1',
          amount: '36.2',
          currency: 'USD',
          methodBrand: 'visa',
          methodLast4: '4242',
          payerName: 'Jane Doe',
          bookingDisplayRef: 'IT-2030-AAAA',
          bookingLocalDate: '2030-06-05',
          tourName: 'Klein Curacao',
          operatorName: 'Miss Ann',
          totalRetail: '181',
          depositAmount: '36.2',
          balanceAmount: '144.8',
          pickup: null,
        });
        // The invoice body: banded party lines + add-on snapshots.
        expect(res.party).toEqual([
          {
            label: 'Adult (18+)',
            spectator: false,
            quantity: 2,
            unitPrice: '79',
            lineTotal: '158.00',
          },
          {
            label: 'Child (4-12)',
            spectator: false,
            quantity: 1,
            unitPrice: '23',
            lineTotal: '23.00',
          },
          // The spectator twin stays its OWN line, flagged - it shares the
          // participant band's label, and merging them would misprice both.
          {
            label: 'Adult (18+)',
            spectator: true,
            quantity: 1,
            unitPrice: '23.4',
            lineTotal: '23.40',
          },
        ]);
        expect(res.addOns).toEqual([
          {
            name: 'Open bar upgrade',
            quantity: 2,
            unitPrice: '25',
            totalPrice: '50',
          },
        ]);
      });

      it("404s another traveller's payment id", async () => {
        m.payment.findFirst.mockResolvedValue(null);
        await expect(
          svc.getTravellerReceipt('someone-elses', historyToken()),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('401s a non-history session', async () => {
        await expect(
          svc.getTravellerReceipt('pay1', issueTravelerSession(EMAIL)),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });
    });

    // ── Self-service date change (review 10.4, direct swap) ────────────────
    describe('date change', () => {
      const T09 = new Date('1970-01-01T09:00:00.000Z');
      const dcBooking = (over: Record<string, unknown> = {}) => ({
        id: 'b1',
        publicRef: 'p1',
        displayRef: 'IT-2030-AAAA',
        contactEmail: EMAIL,
        contactFullName: 'Jane Doe',
        contactFirstName: null,
        contactLastName: null,
        customerLocale: 'en',
        status: BookingStatus.CONFIRMED,
        tourId: 't1',
        departureId: 'dep-old',
        operatorId: 'op1',
        island: 'curacao',
        exclusiveDeparture: false,
        localDate: day('2030-06-05'),
        startTime: '07:00',
        tourStartDateTime: new Date('2030-06-05T07:00:00.000Z'),
        utcCancellationRequestedAt: null,
        utcCancelledAt: null,
        unitItems: [{ id: 'u1' }, { id: 'u2' }],
        tour: {
          name: 'Klein Curacao',
          cancellationHours: 48,
          durationMinutesFrom: 480,
        },
        ...over,
      });
      const ownerToken = () => issueTravelerSession(EMAIL);

      it('lists only same-tour OPEN departures with room for the party', async () => {
        m.booking.findUnique.mockResolvedValue(dcBooking());
        m.departure.findMany.mockResolvedValue([
          {
            id: 'dep-a',
            date: day('2030-06-10'),
            startTime: T09,
            capacity: 8,
            bookedCount: 2,
          },
          {
            // Full for a 2-seat party - must be filtered out.
            id: 'dep-b',
            date: day('2030-06-11'),
            startTime: T09,
            capacity: 8,
            bookedCount: 7,
          },
        ]);

        const res = await svc.getDateChangeOptions('p1', ownerToken());

        expect(m.departure.findMany.mock.calls[0][0].where).toMatchObject({
          tourId: 't1',
          id: { not: 'dep-old' },
          status: DepartureStatus.OPEN,
        });
        expect(res.options).toEqual([
          {
            departureId: 'dep-a',
            date: '2030-06-10',
            startTime: '09:00',
            seatsLeft: 6,
          },
        ]);
      });

      it('an exclusive charter only offers EMPTY departures', async () => {
        m.booking.findUnique.mockResolvedValue(
          dcBooking({ exclusiveDeparture: true }),
        );
        m.departure.findMany.mockResolvedValue([
          {
            id: 'dep-a',
            date: day('2030-06-10'),
            startTime: T09,
            capacity: 8,
            bookedCount: 1, // someone aboard - not offerable to a charter
          },
          {
            id: 'dep-c',
            date: day('2030-06-12'),
            startTime: T09,
            capacity: 8,
            bookedCount: 0,
          },
        ]);

        const res = await svc.getDateChangeOptions('p1', ownerToken());
        expect(res.options.map((o) => o.departureId)).toEqual(['dep-c']);
      });

      it('401s without an owning session', async () => {
        m.booking.findUnique.mockResolvedValue(dcBooking());
        await expect(
          svc.getDateChangeOptions('p1', undefined),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('409s once the free window has closed', async () => {
        m.booking.findUnique.mockResolvedValue(
          // Starts in ~1h; 48h window long gone.
          dcBooking({
            tourStartDateTime: new Date(Date.now() + 3_600_000),
          }),
        );
        await expect(
          svc.changeDate('p1', 'dep-a', ownerToken()),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('409s while a cancellation request is pending', async () => {
        m.booking.findUnique.mockResolvedValue(
          dcBooking({
            utcCancellationRequestedAt: new Date('2030-01-01T00:00:00.000Z'),
          }),
        );
        await expect(
          svc.changeDate('p1', 'dep-a', ownerToken()),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('moves atomically: guarded claim on the new departure, release on the old, snapshots updated', async () => {
        m.booking.findUnique.mockResolvedValue(dcBooking());
        m.departure.findUnique.mockImplementation(
          ({ where }: { where: { id: string } }) =>
            Promise.resolve(
              where.id === 'dep-new'
                ? {
                    id: 'dep-new',
                    tourId: 't1',
                    date: day('2030-06-10'),
                    startTime: T09,
                    capacity: 8,
                    bookedCount: 2,
                    status: DepartureStatus.OPEN,
                    soldOutAt: null,
                  }
                : {
                    id: 'dep-old',
                    tourId: 't1',
                    date: day('2030-06-05'),
                    startTime: T09,
                    capacity: 8,
                    bookedCount: 2,
                    status: DepartureStatus.OPEN,
                    soldOutAt: null,
                  },
            ),
        );
        m.booking.update.mockResolvedValue({
          publicRef: 'p1',
          displayRef: 'IT-2030-AAAA',
          tourId: 't1',
          operatorId: 'op1',
          localDate: day('2030-06-10'),
          startTime: '09:00',
          tourStartDateTime: new Date('2030-06-10T09:00:00.000Z'),
        });

        const res = await svc.changeDate('p1', 'dep-new', ownerToken());

        // Guarded seat claim on the target (the reserve backstop, reused):
        // OPEN-only, live-column capacity guard, count-up by the party size.
        const claim = claimCalls(m)[0];
        expect(claim.sql).toContain(`"status" = 'open'::"departure_status"`);
        expect(claim.sql).toContain('"bookedCount" + ? <= "capacity"');
        expect(claim.values).toEqual(
          expect.arrayContaining(['dep-new', 't1', 2]),
        );
        // Old departure released via the clamped SQL decrement (never negative).
        expect(
          rawReleaseCalls(m).some(
            (c) => c.values[0] === 2 && c.values[1] === 'dep-old',
          ),
        ).toBe(true);
        // Time snapshots follow the new departure; money fields untouched.
        const data = m.booking.update.mock.calls[0][0].data;
        expect(data).toMatchObject({
          departureId: 'dep-new',
          startTime: '09:00',
        });
        expect(data.totalRetail).toBeUndefined();
        expect(res).toEqual({
          changed: true,
          localDate: '2030-06-10',
          startTime: '09:00',
        });
      });

      it('422s when the target departure fills in the race window', async () => {
        m.booking.findUnique.mockResolvedValue(dcBooking());
        m.departure.findUnique.mockResolvedValue({
          id: 'dep-new',
          tourId: 't1',
          date: day('2030-06-10'),
          startTime: T09,
          capacity: 8,
          bookedCount: 7,
          status: DepartureStatus.OPEN,
          soldOutAt: null,
        });
        m.$executeRaw.mockResolvedValue(0); // target filled: the guard loses

        await expect(
          svc.changeDate('p1', 'dep-new', ownerToken()),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
        expect(m.booking.update).not.toHaveBeenCalled();
      });
    });
  });
});
