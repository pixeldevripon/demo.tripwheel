/**
 * Unit tests for AvailabilityService. Prisma + the materializer are mocked.
 * Focus: ownership scoping, live status mapping (check/calendar) against the
 * master §E.9 departure model, manual departure edits, and the isBookable helper.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    tour: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
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
      update: jest.fn(),
      delete: jest.fn(),
    },
    departure: {
      // Default [] so the post-mutation refreshIsBookable() -> computeIsBookable()
      // read has a value in tests that don't set departures explicitly.
      findMany: jest.fn().mockResolvedValue([]),
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

  // A schedule with no capacityOverride only materialises if the tour supplies a
  // default (maxPartySize). Without either, the materialiser silently skips the
  // slot and the tour never lists - so the write must be rejected up-front.
  describe('resolvable-capacity guard', () => {
    const noOverride = { ...createDto, capacityOverride: undefined };

    it('rejects a create with no override when the tour has no maxPartySize', async () => {
      // TOUR has no maxPartySize (undefined -> null), so capacity is unresolvable.
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, noOverride),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.availabilitySchedule.create).not.toHaveBeenCalled();
    });

    it('allows a create with no override when the tour has a maxPartySize default', async () => {
      prisma.tour.findUnique.mockResolvedValue({ ...TOUR, maxPartySize: 20 });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilitySchedule.create.mockResolvedValue(
        scheduleRow({ capacityOverride: null }),
      );
      const res = await svc.createSchedule(
        'u1',
        Role.TOUR_OPERATOR,
        noOverride,
      );
      expect(res.id).toBe('s1');
      expect(prisma.availabilitySchedule.create).toHaveBeenCalled();
    });

    it('allows a create with an explicit override regardless of maxPartySize', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR); // no maxPartySize
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilitySchedule.create.mockResolvedValue(scheduleRow());
      const res = await svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto);
      expect(res.id).toBe('s1');
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

  // Exceptions change sellable inventory, so every mutation must re-project
  // departures + refresh the listing gate immediately (not wait for the nightly
  // job) - otherwise a closed date keeps selling. See availability gap #11.
  describe('exceptions re-materialise departures', () => {
    function exceptionRow(over: Record<string, unknown> = {}) {
      return {
        id: 'x1',
        tourId: 't1',
        date: day('2030-06-10'),
        startTime: null,
        type: 'CLOSE_DATE',
        capacity: null,
        note: null,
        createdBy: 'u1',
        ...over,
      };
    }

    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
    });

    it('re-materialises + refreshes bookable on createException', async () => {
      prisma.availabilityException.create.mockResolvedValue(exceptionRow());
      await svc.createException('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        date: '2030-06-10',
        type: 'CLOSE_DATE',
      });
      expect(materializer.materializeTour).toHaveBeenCalledWith('t1');
      expect(prisma.tour.update).toHaveBeenCalled(); // refreshIsBookable
      expect(notifications.emitAvailabilityUpdate).toHaveBeenCalled();
    });

    it('re-materialises on updateException', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue({
        tourId: 't1',
        date: day('2030-06-10'),
      });
      prisma.availabilityException.update.mockResolvedValue(exceptionRow());
      await svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
        note: 'closed for maintenance',
      });
      expect(materializer.materializeTour).toHaveBeenCalledWith('t1');
      expect(prisma.tour.update).toHaveBeenCalled();
    });

    it('re-materialises on deleteException', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue({
        tourId: 't1',
        date: day('2030-06-10'),
      });
      prisma.availabilityException.delete.mockResolvedValue(exceptionRow());
      await svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1');
      expect(materializer.materializeTour).toHaveBeenCalledWith('t1');
      expect(prisma.tour.update).toHaveBeenCalled();
    });

    // gap #12: reject exception shapes the materializer would otherwise skip.
    it('rejects close_slot without a startTime', async () => {
      await expect(
        svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-10',
          type: 'CLOSE_SLOT',
        }),
      ).rejects.toThrow(/close_slot requires a startTime/);
      expect(prisma.availabilityException.create).not.toHaveBeenCalled();
    });

    it('rejects set_capacity without a capacity', async () => {
      await expect(
        svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-10',
          type: 'SET_CAPACITY',
          startTime: '09:00',
        }),
      ).rejects.toThrow(/set_capacity requires a capacity/);
    });

    it('rejects add_slot with no resolvable capacity (tour has no default)', async () => {
      prisma.tour.findUnique.mockResolvedValue({ ...TOUR, maxPartySize: null });
      await expect(
        svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-10',
          type: 'ADD_SLOT',
          startTime: '15:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // gap #14: reversed local-date ranges must be rejected, not silently return [].
  describe('date-range ordering', () => {
    it('rejects a schedule whose validUntil precedes validFrom', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, {
          ...createDto,
          validFrom: '2030-09-01',
          validUntil: '2030-06-01',
        }),
      ).rejects.toThrow(/validUntil must be on or after validFrom/);
    });

    it('rejects a departures query with to before from', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.listDepartures('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          from: '2030-07-31',
          to: '2030-07-01',
        }),
      ).rejects.toThrow(/to must be on or after from/);
    });
  });
});
