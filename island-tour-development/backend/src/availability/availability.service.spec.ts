/**
 * Unit tests for AvailabilityService. Prisma + the materializer are mocked.
 * Focus: ownership scoping, live status mapping (check/calendar),
 * manual departure edits, and the isBookable helper.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AvailabilityService } from './availability.service';

const FUTURE = new Date('2030-06-30T12:00:00.000Z');

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
    departure: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

function departureRow(over: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    tourId: 't1',
    optionId: 'opt1',
    localDateTimeStart: new Date('2030-06-05T09:00:00.000Z'),
    localDateTimeEnd: null,
    allDay: false,
    capacity: 10,
    vacancies: 5,
    status: 'AVAILABLE',
    utcCutoffAt: FUTURE,
    priceOverride: null,
    manuallyEdited: false,
    ...over,
  };
}

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
    weekdays: [1, 2, 3],
    startTimes: ['09:00'],
    capacity: 10,
  };

  describe('ownership', () => {
    it('lets the owning operator create a schedule', async () => {
      prisma.tour.findUnique.mockResolvedValue({ operatorId: 'op1' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilitySchedule.create.mockResolvedValue({
        id: 's1',
        tourId: 't1',
        weekdays: [1, 2, 3],
        startTimes: ['09:00'],
        capacity: 10,
        seasonStart: null,
        seasonEnd: null,
        priceOverride: null,
        isActive: true,
      });

      const res = await svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto);
      expect(res.id).toBe('s1');
      expect(prisma.availabilitySchedule.create).toHaveBeenCalled();
    });

    it('forbids an operator who does not own the tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({ operatorId: 'op2' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.createSchedule('u1', Role.TOUR_OPERATOR, createDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an ADMIN bypass ownership', async () => {
      prisma.tour.findUnique.mockResolvedValue({ operatorId: 'opX' });
      prisma.availabilitySchedule.create.mockResolvedValue({
        id: 's2',
        tourId: 't1',
        weekdays: [1],
        startTimes: ['09:00'],
        capacity: 10,
        seasonStart: null,
        seasonEnd: null,
        priceOverride: null,
        isActive: true,
      });
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
  });

  describe('checkAvailability', () => {
    it('returns only live-bookable slots with enough vacancies', async () => {
      prisma.tour.findFirst.mockResolvedValue({ timeZone: 'America/Curacao' });
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ id: 'ok', vacancies: 5 }),
        departureRow({ id: 'soldout', vacancies: 0, status: 'SOLD_OUT' }),
        departureRow({ id: 'tooFew', vacancies: 1 }),
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
    it('aggregates departures per day', async () => {
      prisma.tour.findFirst.mockResolvedValue({ timeZone: 'America/Curacao' });
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ id: 'a', vacancies: 5, capacity: 10 }),
        departureRow({
          id: 'b',
          vacancies: 2,
          capacity: 10,
          status: 'LIMITED',
          localDateTimeStart: new Date('2030-06-05T13:00:00.000Z'),
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
        status: 'AVAILABLE',
        vacancies: 7,
        capacity: 20,
        departureCount: 2,
      });
    });
  });

  describe('updateDeparture', () => {
    it('preserves booked seats, recomputes vacancies, and flags manuallyEdited', async () => {
      prisma.departure.findUnique.mockResolvedValue(
        departureRow({ capacity: 10, vacancies: 7 }), // 3 booked
      );
      prisma.tour.findUnique.mockResolvedValue({ operatorId: 'op1' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.departure.update.mockImplementation(({ data }) =>
        departureRow({ ...data }),
      );

      await svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', { capacity: 12 });

      expect(prisma.departure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({
            capacity: 12,
            vacancies: 9,
            manuallyEdited: true,
          }),
        }),
      );
    });
  });

  describe('computeIsBookable', () => {
    it('is true when a bookable departure exists in the horizon', async () => {
      prisma.tour.findUnique.mockResolvedValue({ timeZone: 'America/Curacao' });
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ vacancies: 4, utcCutoffAt: FUTURE }),
      ]);
      expect(await svc.computeIsBookable('t1')).toBe(true);
    });

    it('is false when there are no bookable departures', async () => {
      prisma.tour.findUnique.mockResolvedValue({ timeZone: 'America/Curacao' });
      prisma.departure.findMany.mockResolvedValue([]);
      expect(await svc.computeIsBookable('t1')).toBe(false);
    });
  });
});
