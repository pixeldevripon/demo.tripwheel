/**
 * Unit tests for AvailabilityService. Prisma + the materializer are mocked.
 * Focus: ownership scoping, live status mapping (check/calendar) against the
 * master §E.9 departure model, manual departure edits, and the isBookable helper.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { mondayZeroWeekday } from '@/common/utils/timezone.util';
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
  const p = {
    tour: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    operator: { findUnique: jest.fn(), create: jest.fn() },
    // operatorContext's staff fallback - default "no seat".
    staffMember: { findUnique: jest.fn().mockResolvedValue(null) },
    // Audit-name resolution ("Closed by Maria") - default no matches.
    user: { findMany: jest.fn().mockResolvedValue([]) },
    availabilitySchedule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    availabilityException: {
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      // Reopens RETIRE rows via updateMany (soft delete, dev spec §6.5).
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    departure: {
      // Default [] so the post-mutation refreshIsBookable() -> computeIsBookable()
      // read has a value in tests that don't set departures explicitly.
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      // updateDeparture writes through a guarded updateMany (optimistic lock on
      // bookedCount); default to "claimed" so tests opt in to the race.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  // Interactive-transaction passthrough: the callback runs against the same
  // mock, which is exactly what the duplicate-guard tests need to observe.
  return Object.assign(p, {
    $transaction: jest.fn((fn: (tx: typeof p) => Promise<unknown>) => fn(p)),
  });
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
  let staffPermissions: { hasPermissions: jest.Mock };
  let svc: AvailabilityService;

  beforeEach(() => {
    prisma = mockPrisma();
    materializer = { materializeTour: jest.fn() };
    notifications = { emitAvailabilityUpdate: jest.fn() };
    staffPermissions = {
      hasPermissions: jest
        .fn()
        .mockResolvedValue({ granted: true, missing: [] }),
    };
    svc = new AvailabilityService(
      prisma as never,
      materializer as never,
      notifications as never,
      { notify: jest.fn() } as never,
      // Default: full grant. The stop-sell split tests override this.
      staffPermissions as never,
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

    // The "tour has no maxPartySize" case is GONE, not untested: the column is
    // NOT NULL as of 20260729190000, so capacity always resolves and the guard
    // it used to trip has nothing left to reject. What remains worth asserting
    // is that a schedule still saves with no override of its own.

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

  describe('manageCalendar', () => {
    const exceptionRow = (over: Record<string, unknown> = {}) => ({
      id: 'e1',
      tourId: 't1',
      date: day('2030-06-05'),
      startTime: null,
      type: 'CLOSE_DATE',
      capacity: null,
      note: null,
      createdBy: null,
      createdAt: new Date('2030-06-01T12:00:00.000Z'),
      ...over,
    });
    /** Schedule weekday index (0=Monday) for a YYYY-MM-DD key. */
    const weekdayOf = (key: string) => mondayZeroWeekday(day(key));

    it('derives day statuses across a full month', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.departure.findMany.mockResolvedValue([
        // 5 Jun - fully open
        departureRow({ id: 'a', date: day('2030-06-05') }),
        // 6 Jun - one slot closed, one open -> partial
        departureRow({ id: 'b', date: day('2030-06-06') }),
        departureRow({
          id: 'c',
          date: day('2030-06-06'),
          startTime: time('13:00'),
          status: 'CLOSED',
          bookedCount: 2,
        }),
        // 7 Jun - CLOSE_DATE exception (materializer already closed the row)
        departureRow({
          id: 'd',
          date: day('2030-06-07'),
          status: 'CLOSED',
          bookedCount: 3,
        }),
      ]);
      prisma.availabilityException.findMany.mockResolvedValue([
        exceptionRow({ date: day('2030-06-07') }),
      ]);
      prisma.availabilitySchedule.findMany.mockResolvedValue([
        {
          weekday: weekdayOf('2030-06-05'),
          startTime: time('09:00'),
          validFrom: day('2030-01-01'),
          validUntil: null,
        },
      ]);

      const res = await svc.manageCalendar('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        month: '2030-06',
      });

      expect(res).toHaveLength(30); // June has 30 days - every day present
      const byDate = new Map(res.map((d) => [d.date, d]));

      expect(byDate.get('2030-06-05')).toMatchObject({
        status: 'open',
        scheduled: true,
        scheduledTimes: ['09:00'],
        bookedTotal: 5,
      });
      expect(byDate.get('2030-06-06')).toMatchObject({
        status: 'partial',
        bookedTotal: 7,
      });
      expect(byDate.get('2030-06-07')).toMatchObject({
        status: 'closed',
        bookedTotal: 3,
      });
      expect(byDate.get('2030-06-07')?.exceptions).toHaveLength(1);
      // A departure-less day is no_service; the weekly pattern marks only the
      // matching weekday in its validity window as scheduled.
      expect(byDate.get('2030-06-04')).toMatchObject({
        status: 'no_service',
        scheduled: false,
        bookedTotal: 0,
      });
      expect(byDate.get('2030-06-12')?.scheduled).toBe(true); // next weekday hit
      // Management view: exact remaining always disclosed (5 left, >= threshold).
      expect(byDate.get('2030-06-05')?.departures[0].remaining).toBe(5);
    });

    it('a CLOSE_DATE exception closes the day even before rows re-materialize', async () => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ id: 'a', date: day('2030-06-05'), status: 'OPEN' }),
      ]);
      prisma.availabilityException.findMany.mockResolvedValue([
        exceptionRow({ date: day('2030-06-05') }),
      ]);
      prisma.availabilitySchedule.findMany.mockResolvedValue([]);

      const res = await svc.manageCalendar('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        month: '2030-06',
      });
      expect(res.find((d) => d.date === '2030-06-05')?.status).toBe('closed');
    });

    it('forbids an operator who does not own the tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({ ...TOUR, operatorId: 'op2' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(
        svc.manageCalendar('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          month: '2030-06',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('updateDeparture', () => {
    /** Arrange the happy-path reads for a departure edit. */
    const arrangeUpdate = (over: Record<string, unknown> = {}) => {
      const row = departureRow({ capacity: 10, bookedCount: 7, ...over });
      prisma.departure.findUnique.mockResolvedValue(row);
      prisma.departure.findUniqueOrThrow.mockResolvedValue(row);
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      return row;
    };

    it('preserves booked seats, re-derives status, and flags manuallyEdited', async () => {
      arrangeUpdate();

      await svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', {
        capacity: 12,
      });

      expect(prisma.departure.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // Guarded on the booked count read a moment ago - see the service.
          where: { id: 'd1', bookedCount: 7 },
          data: expect.objectContaining({
            capacity: 12,
            status: 'OPEN',
            manuallyEdited: true,
          }),
        }),
      );
    });

    it('refuses to set capacity below the seats already booked', async () => {
      arrangeUpdate({ capacity: 10, bookedCount: 8 });

      await expect(
        svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', { capacity: 2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.departure.updateMany).not.toHaveBeenCalled();
    });

    it('allows shrinking capacity down to exactly the booked count', async () => {
      arrangeUpdate({ capacity: 10, bookedCount: 8 });

      await svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', {
        capacity: 8,
      });
      expect(prisma.departure.updateMany).toHaveBeenCalled();
    });

    it('fails loudly when a booking lands mid-edit (optimistic lock miss)', async () => {
      arrangeUpdate();
      prisma.departure.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        svc.updateDeparture('u1', Role.TOUR_OPERATOR, 'd1', { capacity: 12 }),
      ).rejects.toBeInstanceOf(ConflictException);
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
        createdAt: new Date('2030-06-01T12:00:00.000Z'),
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
      // The exception's own day is reconciled too - the default pass only
      // covers ~90 days, and a beyond-horizon exception must be visible
      // immediately (not after the nightly long-horizon job).
      expect(materializer.materializeTour).toHaveBeenCalledWith(
        't1',
        '2030-06-10',
        '2030-06-10',
      );
      expect(prisma.tour.update).toHaveBeenCalled(); // refreshIsBookable
      expect(notifications.emitAvailabilityUpdate).toHaveBeenCalled();
    });

    /**
     * The write has already committed by the time the projection runs, so a
     * projection failure must not be reported as a failed write.
     *
     * This is exactly how an unapplied migration presented on 2026-08-08:
     * `materializeTour` threw on every call, the POST 500'd, and the dashboard
     * told the operator "0 added, 2 could not be added" about two schedules it
     * had just created - so the retry hit duplicate-key errors on rows they had
     * been told did not exist.
     */
    it('still succeeds when the projection fails - the write is committed', async () => {
      prisma.availabilityException.create.mockResolvedValue(exceptionRow());
      materializer.materializeTour.mockRejectedValue(
        new Error('The column `closureBatchId` does not exist'),
      );

      await expect(
        svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-10',
          type: 'CLOSE_DATE',
        }),
      ).resolves.toBeDefined();
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

    it('re-materialises on deleteException, which RETIRES the row', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue({
        tourId: 't1',
        date: day('2030-06-10'),
        retiredAt: null,
      });
      prisma.availabilityException.updateMany.mockResolvedValue({ count: 1 });
      await svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1');
      // Soft retirement, never a hard delete - the register keeps the row.
      // Guarded on retiredAt: null so racing Undos cannot both claim it.
      expect(prisma.availabilityException.delete).not.toHaveBeenCalled();
      expect(prisma.availabilityException.updateMany).toHaveBeenCalledWith({
        where: { id: 'x1', retiredAt: null },
        data: expect.objectContaining({
          retiredAt: expect.any(Date),
          retiredBy: 'u1',
          retiredBySide: 'OPERATOR',
        }),
      });
      expect(materializer.materializeTour).toHaveBeenCalledWith('t1');
      expect(prisma.tour.update).toHaveBeenCalled();
    });

    it('deleteException stops without re-projecting when it loses the retire race', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue({
        tourId: 't1',
        date: day('2030-06-10'),
        retiredAt: null,
      });
      // Another Undo won between the read and the write (0 rows matched).
      prisma.availabilityException.updateMany.mockResolvedValue({ count: 0 });
      await svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1');
      expect(materializer.materializeTour).not.toHaveBeenCalled();
    });

    it('deleteException is an idempotent no-op on an already-retired row', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue({
        tourId: 't1',
        date: day('2030-06-10'),
        retiredAt: new Date('2030-06-09T10:00:00Z'),
      });
      await svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1');
      expect(prisma.availabilityException.updateMany).not.toHaveBeenCalled();
      expect(materializer.materializeTour).not.toHaveBeenCalled();
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

    // Removed with the resolvable-capacity guard: an ADD_SLOT exception can no
    // longer be capacity-less, because the tour default it falls back on is
    // NOT NULL (migration 20260729190000).

    // E.9 floor (F2): a SET_CAPACITY below a departure's bookedCount used to be
    // stored and then silently ignored by the materializer (it never resizes a
    // booked departure). The write itself must refuse, so the portal can never
    // claim a capacity it did not get.
    describe('SET_CAPACITY clamps at bookedCount', () => {
      it('rejects a slot capacity below the seats already booked', async () => {
        prisma.departure.findMany.mockResolvedValueOnce([
          departureRow({ bookedCount: 8 }),
        ]);
        await expect(
          svc.createException('u1', Role.TOUR_OPERATOR, {
            tourId: 't1',
            date: '2030-06-05',
            type: 'SET_CAPACITY',
            startTime: '09:00',
            capacity: 5,
          }),
        ).rejects.toThrow(/8 seat\(s\) already booked/);
        expect(prisma.availabilityException.create).not.toHaveBeenCalled();
      });

      it('checks every departure on the date for a whole-day capacity', async () => {
        prisma.departure.findMany.mockResolvedValueOnce([
          departureRow({ bookedCount: 2 }),
          departureRow({
            id: 'd2',
            startTime: time('14:00'),
            bookedCount: 9,
          }),
        ]);
        await expect(
          svc.createException('u1', Role.TOUR_OPERATOR, {
            tourId: 't1',
            date: '2030-06-05',
            type: 'SET_CAPACITY',
            capacity: 5,
          }),
        ).rejects.toThrow(/9 seat\(s\) already booked on the 14:00 departure/);
      });

      it('accepts a capacity at exactly the booked count', async () => {
        prisma.departure.findMany.mockResolvedValueOnce([
          departureRow({ bookedCount: 5 }),
        ]);
        prisma.availabilityException.create.mockResolvedValue(
          exceptionRow({ type: 'SET_CAPACITY', capacity: 5 }),
        );
        await svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-05',
          type: 'SET_CAPACITY',
          startTime: '09:00',
          capacity: 5,
        });
        expect(prisma.availabilityException.create).toHaveBeenCalled();
      });

      // Matrix v1.7 stop-sell split: the narrow seat may close/reopen but
      // never shape inventory - the SERVICE enforces the type half.
      it('rejects ADD_SLOT / SET_CAPACITY from a stop-sell-only seat', async () => {
        staffPermissions.hasPermissions.mockResolvedValue({
          granted: false,
          missing: ['MANAGE_AVAILABILITY'],
        });
        await expect(
          svc.createException('u1', Role.TOUR_OPERATOR, {
            tourId: 't1',
            date: '2030-06-05',
            type: 'ADD_SLOT',
            startTime: '18:00',
          }),
        ).rejects.toThrow(/close and reopen only/);
        // Closing stays allowed for the same seat.
        prisma.availabilityException.create.mockResolvedValue(
          exceptionRow({ type: 'CLOSE_DATE' }),
        );
        await svc.createException('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          date: '2030-06-05',
          type: 'CLOSE_DATE',
        });
        expect(prisma.availabilityException.create).toHaveBeenCalled();
      });

      // Security review 2026-07-30: the split cuts BOTH ways. Deleting an
      // ADD_SLOT/SET_CAPACITY row shapes inventory just as much as writing
      // one, so the delete path re-checks the same permission.
      it('rejects DELETING an inventory-shaping exception from a stop-sell-only seat', async () => {
        staffPermissions.hasPermissions.mockResolvedValue({
          granted: false,
          missing: ['MANAGE_AVAILABILITY'],
        });
        prisma.availabilityException.findUnique.mockResolvedValue({
          tourId: 't1',
          date: day('2030-06-05'),
          type: 'SET_CAPACITY',
        });
        await expect(
          svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1'),
        ).rejects.toThrow(/close and reopen only/);
        expect(prisma.availabilityException.updateMany).not.toHaveBeenCalled();
        // Reopening a closure stays allowed for the same seat.
        prisma.availabilityException.findUnique.mockResolvedValue({
          tourId: 't1',
          date: day('2030-06-05'),
          type: 'CLOSE_DATE',
        });
        prisma.availabilityException.updateMany.mockResolvedValue({ count: 1 });
        await svc.deleteException('u1', Role.TOUR_OPERATOR, 'x1');
        expect(prisma.availabilityException.updateMany).toHaveBeenCalled();
      });

      it('applies the merged-shape floor on updateException too', async () => {
        prisma.availabilityException.findUnique.mockResolvedValue({
          tourId: 't1',
          date: day('2030-06-05'),
          type: 'SET_CAPACITY',
          startTime: time('09:00'),
          capacity: 12,
        });
        prisma.departure.findMany.mockResolvedValueOnce([
          departureRow({ bookedCount: 6 }),
        ]);
        await expect(
          svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
            capacity: 3,
          }),
        ).rejects.toThrow(/6 seat\(s\) already booked/);
        expect(prisma.availabilityException.update).not.toHaveBeenCalled();
      });
    });
  });

  // F4 Surface B: the cross-tour agenda composes every tour into one list and
  // "close all of today" fans out one CLOSE_DATE per open tour.
  describe('agenda', () => {
    const TOUR_A = {
      id: 't1',
      name: 'Catamaran',
      timeZone: 'America/Curacao',
      bookingCutoffMinutes: 60,
      pricingModel: 'PER_PERSON',
      availabilityConfirmedAt: new Date('2030-06-01T10:00:00Z'),
    };
    const TOUR_B = {
      id: 't2',
      name: 'Buggy',
      timeZone: 'America/Curacao',
      bookingCutoffMinutes: 60,
      pricingModel: 'UNIT',
      availabilityConfirmedAt: new Date('2030-06-02T10:00:00Z'),
    };

    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
    });

    it('merges tours chronologically with closures and the stalest stamp', async () => {
      prisma.tour.findMany.mockResolvedValue([TOUR_A, TOUR_B]);
      prisma.departure.findMany.mockResolvedValueOnce([
        departureRow({ id: 'a', tourId: 't2', startTime: time('07:00') }),
        departureRow({ id: 'b', tourId: 't1', startTime: time('09:00') }),
      ]);
      prisma.availabilityException.findMany.mockResolvedValueOnce([
        {
          id: 'x1',
          tourId: 't1',
          date: day('2030-06-05'),
          startTime: null,
          type: 'CLOSE_DATE',
          capacity: null,
          note: 'Weather',
          closureReason: 'NOT_RUNNING',
          createdBy: 'u1',
          createdBySide: 'PLATFORM',
          createdAt: new Date('2030-06-04T08:00:00Z'),
        },
      ]);
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1', name: 'Maria' }]);

      const res = await svc.agenda('u1', Role.TOUR_OPERATOR, {
        from: '2030-06-05',
        days: 2,
      });
      // The closure read asks only for rows in force (retired ones are
      // register history, not live stop-sells).
      expect(
        prisma.availabilityException.findMany.mock.calls[0][0].where,
      ).toMatchObject({ retiredAt: null });
      // Every requested day present, even when empty.
      expect(res.days.map((d) => d.date)).toEqual(['2030-06-05', '2030-06-06']);
      const rows = res.days[0].departures;
      expect(rows.map((r) => r.tourName)).toEqual(['Buggy', 'Catamaran']);
      // t1's whole-day closure attaches with its audit line - now carrying the
      // reason and the side (MCK-16 changes 5 + 10); t2 has none.
      expect(rows[1].closure).toMatchObject({
        id: 'x1',
        createdByName: 'Maria',
        createdBySide: 'PLATFORM',
        closureReason: 'NOT_RUNNING',
        note: 'Weather',
      });
      expect(rows[0].closure).toBeNull();
      // Freshness card reports the WEAKEST link.
      expect(res.lastConfirmedAt).toBe('2030-06-01T10:00:00.000Z');
    });

    it('closeAgendaDay writes one CLOSE_DATE per open tour and skips closed ones', async () => {
      prisma.tour.findMany.mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
      ]);
      prisma.departure.findMany.mockResolvedValueOnce([
        { tourId: 't1' },
        { tourId: 't2' },
      ]); // t3 runs nothing that day
      prisma.availabilityException.findMany.mockResolvedValueOnce([
        { tourId: 't2' }, // already closed
      ]);
      prisma.availabilityException.createMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });
      prisma.tour.findUnique.mockResolvedValue(TOUR);

      const res = await svc.closeAgendaDay('u1', Role.TOUR_OPERATOR, {
        date: '2030-06-05',
        note: 'Weather',
        closureReason: 'NOT_RUNNING',
      });
      expect(res).toEqual({ closed: 1, tourIds: ['t1'] });
      const args = prisma.availabilityException.createMany.mock.calls[0][0];
      expect(args.data).toHaveLength(1);
      expect(args.data[0]).toMatchObject({
        tourId: 't1',
        type: 'CLOSE_DATE',
        note: 'Weather',
        createdBy: 'u1',
        // MCK-16 changes 1 + 10: the reason and the side ride the write, and
        // one tap shares one batch id so the demand signal reads one event.
        closureReason: 'NOT_RUNNING',
        createdBySide: 'OPERATOR',
        closureBatchId: expect.any(String),
      });
      expect(materializer.materializeTour).toHaveBeenCalledWith(
        't1',
        '2030-06-05',
        '2030-06-05',
      );
    });
  });

  // Global calendar overview: admin platform-wide, operator pinned to self.
  describe('overview', () => {
    const OV_TOUR = {
      id: 't1',
      name: 'Catamaran',
      operatorId: 'op1',
      timeZone: 'America/Curacao',
      bookingCutoffMinutes: 60,
      pricingModel: 'PER_PERSON',
      maxPartySize: 12,
      startTimes: ['09:00', '13:00'],
      availabilityConfirmedAt: new Date('2030-06-01T10:00:00Z'),
      operator: {
        companyInfo: { companyName: 'Blue Bay Sailing' },
        user: { name: 'Owner Account' },
      },
    };

    it('pins a non-admin to their own operator and ignores operatorId', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.tour.findMany.mockResolvedValue([OV_TOUR]);
      prisma.departure.findMany.mockResolvedValueOnce([departureRow()]);
      prisma.availabilityException.findMany.mockResolvedValueOnce([]);

      const res = await svc.overview('u1', Role.TOUR_OPERATOR, {
        from: '2030-06-05',
        days: 2,
        operatorId: 'op-EVIL',
      });
      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { operatorId: 'op1', isActive: true },
        }),
      );
      expect(res.days.map((d) => d.date)).toEqual(['2030-06-05', '2030-06-06']);
      expect(res.days[0].departures[0]).toMatchObject({
        id: 'd1',
        operatorId: 'op1',
        tourName: 'Catamaran',
      });
      expect(res.tours[0]).toMatchObject({
        operatorName: 'Blue Bay Sailing',
        maxPartySize: 12,
        startTimes: ['09:00', '13:00'],
      });
    });

    it('reads platform-wide for ADMIN and honours operatorId/tourId narrowing', async () => {
      prisma.tour.findMany.mockResolvedValue([OV_TOUR]);
      prisma.departure.findMany.mockResolvedValueOnce([]);
      prisma.availabilityException.findMany.mockResolvedValueOnce([]);

      await svc.overview('admin', Role.ADMIN, {
        operatorId: 'op7',
        tourId: 't9',
      });
      // No operatorContext lookup - the admin path never resolves a seat.
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, operatorId: 'op7', id: 't9' },
        }),
      );
    });

    it('returns an honest empty for a caller with no operator context', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      const res = await svc.overview('u1', Role.TOUR_OPERATOR, {});
      expect(res).toMatchObject({ days: [], tours: [], lastConfirmedAt: null });
      expect(prisma.tour.findMany).not.toHaveBeenCalled();
    });

    it('reports today independently of the requested window and prefers slot closures', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.tour.findMany.mockResolvedValue([
        { ...OV_TOUR, operator: { companyInfo: null, user: { name: 'Ann' } } },
      ]);
      prisma.departure.findMany.mockResolvedValueOnce([departureRow()]);
      prisma.availabilityException.findMany.mockResolvedValueOnce([
        {
          id: 'x-day',
          tourId: 't1',
          date: day('2030-06-05'),
          startTime: null,
          type: 'CLOSE_DATE',
          note: null,
          createdBy: null,
          createdAt: new Date('2030-06-04T08:00:00Z'),
        },
        {
          id: 'x-slot',
          tourId: 't1',
          date: day('2030-06-05'),
          startTime: time('09:00'),
          type: 'CLOSE_SLOT',
          note: 'Engine',
          createdBy: null,
          createdAt: new Date('2030-06-04T09:00:00Z'),
        },
      ]);

      const res = await svc.overview('u1', Role.TOUR_OPERATOR, {
        from: '2030-06-05',
        days: 1,
      });
      // `today` is the island's real today, not the window start.
      expect(res.today).not.toBe('2030-06-05');
      expect(res.days[0].departures[0].closure).toMatchObject({
        id: 'x-slot',
        note: 'Engine',
      });
      // companyInfo null falls back to the owner account's name.
      expect(res.tours[0].operatorName).toBe('Ann');
    });
  });

  // F14 freshness confirm: one tour with tourId, the whole operator without.
  describe('confirmAvailability', () => {
    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.tour.updateMany = jest.fn().mockResolvedValue({ count: 3 });
    });

    it('stamps a single tour when tourId is given', async () => {
      const res = await svc.confirmAvailability('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
      });
      expect(res.confirmed).toBe(1);
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: {
          availabilityConfirmedAt: expect.any(Date) as Date,
        },
      });
    });

    it('stamps every active tour of the operator without a tourId', async () => {
      const res = await svc.confirmAvailability('u1', Role.TOUR_OPERATOR, {});
      expect(res.confirmed).toBe(3);
      expect(prisma.tour.updateMany).toHaveBeenCalledWith({
        where: { operatorId: 'op1', isActive: true },
        data: {
          availabilityConfirmedAt: expect.any(Date) as Date,
        },
      });
    });
  });

  // F8 bulk blackout: a range is one action, idempotent over overlaps, and its
  // Undo (reopen-range) drops the whole thing as one unit.
  describe('closeRange / reopenRange', () => {
    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilityException.createMany = jest
        .fn()
        .mockResolvedValue({ count: 0 });
      prisma.availabilityException.updateMany = jest
        .fn()
        .mockResolvedValue({ count: 3 });
    });

    it('writes one CLOSE_DATE per day, skipping already-closed dates', async () => {
      prisma.availabilityException.findMany.mockResolvedValueOnce([
        { date: day('2030-06-11') }, // already closed - must be skipped
      ]);
      const res = await svc.closeRange('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        from: '2030-06-10',
        to: '2030-06-12',
      });
      expect(res.closed).toBe(2);
      const args = prisma.availabilityException.createMany.mock.calls[0][0];
      expect(
        args.data.map((r: { date: Date }) => r.date.toISOString().slice(0, 10)),
      ).toEqual(['2030-06-10', '2030-06-12']);
      expect(args.data[0]).toMatchObject({
        type: 'CLOSE_DATE',
        startTime: null,
        createdBy: 'u1',
      });
      // Range projected + listing gate refreshed immediately.
      expect(materializer.materializeTour).toHaveBeenCalledWith(
        't1',
        '2030-06-10',
        '2030-06-12',
      );
      expect(prisma.tour.update).toHaveBeenCalled();
    });

    it('rejects a reversed range', async () => {
      await expect(
        svc.closeRange('u1', Role.TOUR_OPERATOR, {
          tourId: 't1',
          from: '2030-06-12',
          to: '2030-06-10',
        }),
      ).rejects.toThrow();
      expect(prisma.availabilityException.createMany).not.toHaveBeenCalled();
    });

    it('writes nothing when every date is already closed', async () => {
      prisma.availabilityException.findMany.mockResolvedValueOnce([
        { date: day('2030-06-10') },
      ]);
      const res = await svc.closeRange('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        from: '2030-06-10',
        to: '2030-06-10',
      });
      expect(res.closed).toBe(0);
      expect(prisma.availabilityException.createMany).not.toHaveBeenCalled();
      expect(materializer.materializeTour).not.toHaveBeenCalled();
    });

    it('reopenRange RETIRES every active whole-day closure in the bounds', async () => {
      const res = await svc.reopenRange('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        from: '2030-06-10',
        to: '2030-06-12',
      });
      expect(res.reopened).toBe(3);
      // Soft retirement (dev spec §6.5): the register keeps the closures.
      expect(prisma.availabilityException.deleteMany).not.toHaveBeenCalled();
      expect(prisma.availabilityException.updateMany).toHaveBeenCalledWith({
        where: {
          tourId: 't1',
          type: 'CLOSE_DATE',
          date: {
            gte: day('2030-06-10'),
            lte: day('2030-06-12'),
          },
          retiredAt: null,
        },
        data: expect.objectContaining({
          retiredAt: expect.any(Date),
          retiredBy: 'u1',
          retiredBySide: 'OPERATOR',
        }),
      });
      expect(materializer.materializeTour).toHaveBeenCalledWith(
        't1',
        '2030-06-10',
        '2030-06-12',
      );
    });
  });

  // MCK-16 changes 1, 5 and 10: every exception write carries which SIDE made
  // it, retired rows refuse edits, and legacy reasonless closures can be
  // backfilled through PATCH rather than renamed in the UI.
  describe('closure attribution + reason backfill (MCK-16)', () => {
    function exceptionRow(over: Record<string, unknown> = {}) {
      return {
        id: 'x1',
        tourId: 't1',
        date: day('2030-06-10'),
        startTime: null,
        type: 'CLOSE_DATE',
        capacity: null,
        note: null,
        closureReason: null,
        createdBy: 'u1',
        createdBySide: 'OPERATOR',
        createdAt: new Date('2030-06-01T12:00:00.000Z'),
        retiredAt: null,
        retiredBy: null,
        retiredBySide: null,
        ...over,
      };
    }

    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.availabilityException.create.mockResolvedValue(exceptionRow());
      prisma.availabilityException.update.mockResolvedValue(exceptionRow());
    });

    it('stamps the operator side on an operator close and PLATFORM on an admin close', async () => {
      await svc.createException('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
        date: '2030-06-10',
        type: 'CLOSE_DATE',
      } as never);
      expect(
        prisma.availabilityException.create.mock.calls[0][0].data,
      ).toMatchObject({ createdBy: 'u1', createdBySide: 'OPERATOR' });

      await svc.createException('admin1', Role.ADMIN, {
        tourId: 't1',
        date: '2030-06-11',
        type: 'CLOSE_DATE',
      } as never);
      expect(
        prisma.availabilityException.create.mock.calls[1][0].data,
      ).toMatchObject({ createdBy: 'admin1', createdBySide: 'PLATFORM' });
    });

    it('an admin undo retires with the PLATFORM side', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue(
        exceptionRow({ retiredAt: null }),
      );
      prisma.availabilityException.updateMany.mockResolvedValue({ count: 1 });
      await svc.deleteException('admin1', Role.ADMIN, 'x1');
      expect(prisma.availabilityException.updateMany).toHaveBeenCalledWith({
        where: { id: 'x1', retiredAt: null },
        data: expect.objectContaining({
          retiredBy: 'admin1',
          retiredBySide: 'PLATFORM',
        }),
      });
    });

    it('a platform STAFF write stamps the PLATFORM side too', () => {
      // isPlatformWideRole, not a bare ADMIN test - the §Admin.4 lesson.
      expect(svc['actorSide'](Role.STAFF)).toBe('PLATFORM');
      expect(svc['actorSide'](Role.EDITOR)).toBe('PLATFORM');
      expect(svc['actorSide'](Role.TOUR_OPERATOR)).toBe('OPERATOR');
      expect(svc['actorSide'](Role.GUIDE)).toBe('OPERATOR');
    });

    it('listExceptions returns retired rows WITH their retire audit line', async () => {
      prisma.availabilityException.findMany.mockResolvedValue([
        exceptionRow(),
        exceptionRow({
          id: 'x2',
          retiredAt: new Date('2030-06-03T09:00:00Z'),
          retiredBy: 'u2',
          retiredBySide: 'OPERATOR',
        }),
      ]);
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', name: 'Maria' },
        { id: 'u2', name: 'Yuri' },
      ]);
      const res = await svc.listExceptions('u1', Role.TOUR_OPERATOR, {
        tourId: 't1',
      });
      // The register is history: retired rows are NOT filtered out here.
      const where = prisma.availabilityException.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      expect(where).not.toHaveProperty('retiredAt');
      expect(res[1]).toMatchObject({
        id: 'x2',
        retiredAt: '2030-06-03T09:00:00.000Z',
        retiredByName: 'Yuri',
        retiredBySide: 'OPERATOR',
      });
      expect(res[0]).toMatchObject({ retiredAt: null, retiredByName: null });
    });

    it('refuses to edit a retired row', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue(
        exceptionRow({ retiredAt: new Date('2030-06-02T09:00:00Z') }),
      );
      await expect(
        svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', { note: 'late' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.availabilityException.update).not.toHaveBeenCalled();
    });

    it('backfills closureReason on a legacy closure via PATCH', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue(exceptionRow());
      await svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
        closureReason: 'SOLD_OUT',
      } as never);
      expect(prisma.availabilityException.update).toHaveBeenCalledWith({
        where: { id: 'x1' },
        data: { closureReason: 'SOLD_OUT' },
      });
    });

    it('refuses to RE-LABEL a recorded reason via PATCH (backfill only)', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue(
        exceptionRow({ closureReason: 'NOT_RUNNING' }),
      );
      // NOT_RUNNING -> SOLD_OUT would manufacture §3.7 sell-out evidence.
      await expect(
        svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
          closureReason: 'SOLD_OUT',
        } as never),
      ).rejects.toThrow(ConflictException);
      expect(prisma.availabilityException.update).not.toHaveBeenCalled();
      // Re-sending the same value is an idempotent no-op and stays allowed.
      await svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
        closureReason: 'NOT_RUNNING',
      } as never);
      expect(prisma.availabilityException.update).toHaveBeenCalled();
    });

    it('rejects a reason on a non-closure type via PATCH', async () => {
      prisma.availabilityException.findUnique.mockResolvedValue(
        exceptionRow({ type: 'ADD_SLOT', startTime: time('09:00') }),
      );
      await expect(
        svc.updateException('u1', Role.TOUR_OPERATOR, 'x1', {
          closureReason: 'SOLD_OUT',
        } as never),
      ).rejects.toThrow(/close_date \/ close_slot only/);
    });
  });

  // F13 status line: the number the operator sees must be exactly the number
  // the §7.2 listing gate counts - same bookability rules, same horizon.
  describe('availabilitySummary', () => {
    beforeEach(() => {
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
    });

    it('counts only bookable departures and returns the soonest as next', async () => {
      prisma.departure.findMany.mockResolvedValueOnce([
        // Sold out - not bookable, must not count.
        departureRow({ date: day('2030-06-04'), bookedCount: 10 }),
        departureRow({ id: 'd2', date: day('2030-06-05'), bookedCount: 2 }),
        departureRow({
          id: 'd3',
          date: day('2030-06-06'),
          startTime: time('14:00'),
        }),
      ]);
      const res = await svc.availabilitySummary('u1', Role.TOUR_OPERATOR, 't1');
      expect(res.openInNext30Days).toBe(2);
      expect(res.nextDeparture).toEqual({
        date: '2030-06-05',
        startTime: '09:00',
      });
    });

    it('returns the F13 warning state when nothing is bookable', async () => {
      prisma.departure.findMany.mockResolvedValueOnce([]);
      const res = await svc.availabilitySummary('u1', Role.TOUR_OPERATOR, 't1');
      expect(res).toEqual({ openInNext30Days: 0, nextDeparture: null });
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

  // ── nextBookableDateByTour (backs the §8 dead-end alternatives) ──────────────

  describe('nextBookableDateByTour', () => {
    const clocks = [
      { id: 't1', timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
      { id: 't2', timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
    ];

    it('short-circuits on an empty id list without touching the database', async () => {
      const out = await svc.nextBookableDateByTour(
        [],
        '2030-06-01',
        '2030-06-08',
      );
      expect(out.size).toBe(0);
      expect(prisma.departure.findMany).not.toHaveBeenCalled();
      expect(prisma.tour.findMany).not.toHaveBeenCalled();
    });

    it('returns the EARLIEST bookable date per tour', async () => {
      prisma.tour.findMany.mockResolvedValue(clocks);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ tourId: 't1', date: day('2030-06-03') }),
        departureRow({ tourId: 't1', date: day('2030-06-05') }),
        departureRow({ tourId: 't2', date: day('2030-06-04') }),
      ]);

      const out = await svc.nextBookableDateByTour(
        ['t1', 't2'],
        '2030-06-01',
        '2030-06-08',
      );
      expect(out.get('t1')).toBe('2030-06-03');
      expect(out.get('t2')).toBe('2030-06-04');
    });

    it('omits a tour whose only departures are full - OPEN status is not enough', async () => {
      prisma.tour.findMany.mockResolvedValue(clocks);
      prisma.departure.findMany.mockResolvedValue([
        // Status still OPEN in storage, but every seat is taken.
        departureRow({ tourId: 't1', capacity: 10, bookedCount: 10 }),
      ]);

      const out = await svc.nextBookableDateByTour(
        ['t1'],
        '2030-06-01',
        '2030-06-08',
      );
      expect(out.has('t1')).toBe(false);
    });

    it('omits a tour whose departures are all in the past (cutoff reached)', async () => {
      prisma.tour.findMany.mockResolvedValue(clocks);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ tourId: 't1', date: day('2020-01-01') }),
      ]);

      const out = await svc.nextBookableDateByTour(
        ['t1'],
        '2020-01-01',
        '2020-01-08',
      );
      expect(out.has('t1')).toBe(false);
    });

    it('rejects an inverted window', async () => {
      await expect(
        svc.nextBookableDateByTour(['t1'], '2030-06-08', '2030-06-01'),
      ).rejects.toThrow(/dateTo must be on or after dateFrom/);
    });
  });
});
