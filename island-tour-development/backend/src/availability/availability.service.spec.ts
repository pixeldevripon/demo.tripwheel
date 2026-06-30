/**
 * Unit tests for AvailabilityService. Prisma + the materializer are mocked.
 * Focus: ownership scoping, live status mapping (check/calendar) against the
 * master §E.9 departure model, manual departure edits, and the isBookable helper.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AvailabilityService } from './availability.service';

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
  return {
    tour: { findUnique: jest.fn(), findFirst: jest.fn() },
    operator: { findUnique: jest.fn(), create: jest.fn() },
    availabilitySchedule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    availabilityException: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    departure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

function departureRow(over: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    tourId: 't1',
    date: day('2030-06-05'),
    startTime: time('09:00'),
    capacity: 10,
    bookedCount: 5,
    status: 'OPEN',
    soldOutAt: null,
    source: 'SCHEDULE',
    manuallyEdited: false,
    ...over,
  };
}

function scheduleRow(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    tourId: 't1',
    weekday: 1,
    startTime: time('09:00'),
    capacityOverride: 10,
    validFrom: day('2026-06-01'),
    validUntil: null,
    status: 'ACTIVE',
    ...over,
  };
}

/** A tour row that satisfies assertTourAccess + assertStartTimeInSlotSet + tourClock. */
const TOUR = {
  operatorId: 'op1',
  startTimes: ['09:00', '13:00'],
  timeZone: 'America/Curacao',
  bookingCutoffMinutes: 120,
};

describe('AvailabilityService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let materializer: { materializeTour: jest.Mock };
  let notifications: { emitAvailabilityUpdate: jest.Mock };
  let svc: AvailabilityService;

  beforeEach(() => {
    prisma = mockPrisma();
    materializer = { materializeTour: jest.fn() };
    notifications = { emitAvailabilityUpdate: jest.fn() };
    svc = new AvailabilityService(
      prisma as never,
      materializer as never,
      notifications as never,
    );
  });

  const createDto = {
    tourId: 't1',
    weekday: 1,
    startTime: '09:00',
    capacityOverride: 10,
  };

  describe('ownership', () => {
    it('lets the owning operator create a schedule', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilitySchedule.create.mockResolvedValue(scheduleRow());

      const res = await svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto);
      expect(res.id).toBe('s1');
      expect(res.weekday).toBe(1);
      expect(res.startTime).toBe('09:00');
      expect(prisma.availabilitySchedule.create).toHaveBeenCalled();
    });

    it('forbids an operator who does not own the tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({ ...TOUR, operatorId: 'op2' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an ADMIN bypass ownership', async () => {
      prisma.tour.findUnique.mockResolvedValue({ ...TOUR, operatorId: 'opX' });
      prisma.availabilitySchedule.create.mockResolvedValue(
        scheduleRow({ id: 's2' }),
      );
      const res = await svc.createSchedule('admin', Role.ADMIN, createDto);
      expect(res.id).toBe('s2');
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 when the tour does not exist', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a startTime outside the tour slot set', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, {
          ...createDto,
          startTime: '10:30',
        }),
      ).rejects.toThrow(/slot set/);
    });
  });

  describe('checkAvailability', () => {
    it('returns only live-bookable slots with enough seats left', async () => {
      prisma.tour.findFirst.mockResolvedValue(TOUR);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ id: 'ok', bookedCount: 5 }), // 5 left
        departureRow({ id: 'soldout', bookedCount: 10, status: 'SOLD_OUT' }), // 0 left
        departureRow({ id: 'tooFew', bookedCount: 9 }), // 1 left
      ]);

      const res = await svc.checkAvailability({
        tourId: 't1',
        dateFrom: '2030-06-01',
        dateTo: '2030-06-30',
        units: [{ quantity: 2 }],
      });

      expect(res.map((d) => d.id)).toEqual(['ok']);
    });

    it('throws 404 when the tour is not LIVE/active', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      await expect(
        svc.checkAvailability({
          tourId: 't1',
          dateFrom: '2030-06-01',
          dateTo: '2030-06-30',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('calendar', () => {
    it('aggregates departures per day and discloses low remaining only', async () => {
      prisma.tour.findFirst.mockResolvedValue(TOUR);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ id: 'a', bookedCount: 5, capacity: 10 }), // 5 left (hidden)
        departureRow({
          id: 'b',
          bookedCount: 8,
          capacity: 10, // 2 left (disclosed)
          startTime: time('13:00'),
        }),
      ]);

      const res = await svc.calendar({
        tourId: 't1',
        dateFrom: '2030-06-01',
        dateTo: '2030-06-30',
      });

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        date: '2030-06-05',
        available: true,
        status: 'OPEN',
        remaining: 2,
        departureCount: 2,
      });
    });
  });

  describe('updateDeparture', () => {
    it('preserves booked seats, re-derives status, and flags manuallyEdited', async () => {
      prisma.departure.findUnique.mockResolvedValue(
        departureRow({ capacity: 10, bookedCount: 7 }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.departure.update.mockImplementation(({ data }) =>
        departureRow({ ...data }),
      );

      await svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', {
        capacity: 12,
      });

      expect(prisma.departure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({
            capacity: 12,
            status: 'OPEN',
            manuallyEdited: true,
          }),
        }),
      );
    });
  });

  describe('computeIsBookable', () => {
    it('is true when an OPEN, non-cutoff departure exists in the horizon', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ bookedCount: 4 }),
      ]);
      expect(await svc.computeIsBookable('t1')).toBe(true);
    });

    it('is false when there are no bookable departures', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.departure.findMany.mockResolvedValue([]);
      expect(await svc.computeIsBookable('t1')).toBe(false);
    });
  });
});
