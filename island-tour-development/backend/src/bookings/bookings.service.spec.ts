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
import { BookingStatus, PaymentModel, Prisma, Role } from '@prisma/client';
import { BookingsService } from './bookings.service';

const D = (v: string | number) => new Prisma.Decimal(v);
const FUTURE = new Date('2030-06-05T07:00:00.000Z');
const PAST = new Date('2020-01-01T00:00:00.000Z');

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
    tourOption: { findFirst: jest.fn() },
    departure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    tourUnit: { findMany: jest.fn() },
    tourAddOn: { findMany: jest.fn() },
    bookingUnitItem: { updateMany: jest.fn() },
    operator: { findUnique: jest.fn() },
  };
  p.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(p) : Promise.all(arg as []),
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
    optionId: 'opt1',
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
    cancellationRefund: null,
    cancelledBy: null,
    cancellationReason: null,
    unitItems: [
      { id: 'ui1', uuid: 'uui1', unitId: 'adult', status: BookingStatus.ON_HOLD, priceRetail: D('79.99') },
      { id: 'ui2', uuid: 'uui2', unitId: 'adult', status: BookingStatus.ON_HOLD, priceRetail: D('79.99') },
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
    defaultCurrency: 'EUR',
    paymentModel: PaymentModel.OPERATOR_LINK,
    depositPct: D('20'),
    commissionTier: D('20'),
    minPartySize: 1,
    maxPartySize: 10,
    ...over,
  });
  m.tourOption.findFirst.mockResolvedValue({ id: 'opt1', minUnits: null, maxUnits: null });
  m.departure.findFirst.mockResolvedValue({
    id: 'dep1',
    localDateTimeStart: new Date('2030-06-05T09:00:00.000Z'),
    utcCutoffAt: FUTURE,
  });
  m.tourUnit.findMany.mockResolvedValue([
    {
      id: 'adult',
      type: 'ADULT',
      minQuantity: null,
      maxQuantity: null,
      accompaniedBy: [],
      priceRetail: D('79.99'),
      priceNet: D('63.99'),
    },
  ]);
  m.departure.updateMany.mockResolvedValue({ count: 1 });
  m.departure.findUnique.mockResolvedValue({
    vacancies: 8,
    capacity: 10,
    utcCutoffAt: FUTURE,
    status: 'AVAILABLE',
  });
  m.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    fakeBooking({ status: data.status, utcExpiresAt: data.utcExpiresAt }),
  );
  // finalizeConfirmation re-reads via booking.update (conversion backfill).
  m.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    fakeBooking(data),
  );
}

const reserveDto = {
  tourId: 't1',
  optionId: 'opt1',
  departureId: 'dep1',
  items: [{ unitId: 'adult', quantity: 2 }],
};

describe('BookingsService', () => {
  let prisma: any;
  let m: any;
  let mail: any;
  let tracking: any;
  let svc: BookingsService;

  beforeEach(() => {
    prisma = mockPrisma();
    m = prisma;
    mail = { sendBookingConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    tracking = { fireBookingComplete: jest.fn().mockResolvedValue(undefined) };
    svc = new BookingsService(prisma, mail, tracking);
  });

  describe('reserve', () => {
    it('atomically claims seats and creates an ON_HOLD booking', async () => {
      setupReserveContext(prisma);
      const res = await svc.reserve(reserveDto);

      expect(m.departure.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'dep1', vacancies: { gte: 2 } }),
          data: { vacancies: { decrement: 2 } },
        }),
      );
      expect(m.booking.create).toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.ON_HOLD);
    });

    it('is idempotent — a prior booking with the same id is returned', async () => {
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
      m.departure.findFirst.mockResolvedValue({
        id: 'dep1',
        localDateTimeStart: new Date('2030-06-05T09:00:00.000Z'),
        utcCutoffAt: PAST,
      });
      await expect(svc.reserve(reserveDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('OPERATOR_FULL is created CONFIRMED with no hold expiry', async () => {
      setupReserveContext(prisma, { paymentModel: PaymentModel.OPERATOR_FULL });
      await svc.reserve(reserveDto);
      const data = m.booking.create.mock.calls[0][0].data;
      expect(data.status).toBe(BookingStatus.CONFIRMED);
      expect(data.utcExpiresAt).toBeNull();
      expect(data.utcConfirmedAt).toBeInstanceOf(Date);
    });
  });

  describe('confirm', () => {
    it('transitions ON_HOLD → CONFIRMED and persists contact', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking());
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CONFIRMED, utcConfirmedAt: new Date() }),
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
      m.booking.findUnique.mockResolvedValue(fakeBooking({ utcExpiresAt: PAST }));
      await expect(
        svc.confirm('b1', { contact: { firstName: 'A', lastName: 'B', email: 'a@b.io' } }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('is idempotent when already CONFIRMED', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ status: BookingStatus.CONFIRMED }));
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
        vacancies: 10,
        capacity: 10,
        utcCutoffAt: FUTURE,
        status: 'AVAILABLE',
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED, cancellationRefund: 'FULL' }),
      );

      const res = await svc.cancel('b1', {});
      expect(m.departure.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vacancies: { increment: 2 } } }),
      );
      expect(res.cancellationRefund).toBe('FULL');
    });

    it('refunds NONE for an on-hold cancellation (no payment taken)', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ status: BookingStatus.ON_HOLD }));
      m.departure.findUnique.mockResolvedValue({
        vacancies: 10,
        capacity: 10,
        utcCutoffAt: FUTURE,
        status: 'AVAILABLE',
      });
      m.booking.update.mockResolvedValue(
        fakeBooking({ status: BookingStatus.CANCELLED, cancellationRefund: 'NONE' }),
      );
      const res = await svc.cancel('b1', {});
      expect(res.cancellationRefund).toBe('NONE');
    });

    it('rejects cancelling an already-redeemed booking', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ status: BookingStatus.REDEEMED }));
      await expect(svc.cancel('b1', {})).rejects.toBeInstanceOf(ConflictException);
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
      m.booking.findUnique.mockResolvedValue(fakeBooking({ status: BookingStatus.CONFIRMED }));
      await expect(svc.extend('b1', {})).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('expireStaleHolds', () => {
    it('expires lapsed holds and restores their seats', async () => {
      m.booking.findMany.mockResolvedValue([
        { id: 'b1', departureId: 'dep1', tourId: 't1', _count: { unitItems: 2 } },
      ]);
      m.tour.findUnique.mockResolvedValue({ timeZone: 'America/Curacao' });
      m.departure.findUnique.mockResolvedValue({
        vacancies: 10,
        capacity: 10,
        utcCutoffAt: FUTURE,
        status: 'SOLD_OUT',
      });
      const count = await svc.expireStaleHolds();
      expect(count).toBe(1);
      expect(m.departure.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vacancies: { increment: 2 } } }),
      );
      expect(m.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.EXPIRED } }),
      );
    });
  });

  describe('getById (auth scoping)', () => {
    it('allows the owning operator', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ operatorId: 'op1' }));
      m.operator.findUnique.mockResolvedValue({ id: 'op1' });
      const res = await svc.getById('b1', { id: 'u1', role: Role.TOUR_OPERATOR });
      expect(res.id).toBe('b1');
    });

    it('forbids an operator who does not own the booking', async () => {
      m.booking.findUnique.mockResolvedValue(fakeBooking({ operatorId: 'opX' }));
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
});
