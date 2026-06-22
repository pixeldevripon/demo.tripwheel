/**
 * Unit tests for the materialization engine. Prisma is fully mocked; the
 * departure write ops (update/createMany/deleteMany) are invoked synchronously while
 * building the `$transaction` batch, so we assert on their captured arguments.
 */
import { AvailabilityMaterializerService } from './availability-materializer.service';

// A far-future window keeps "now < cutoff" deterministic (created slots → AVAILABLE).
const DAY = '2030-06-05';
const DAY_START = new Date(`${DAY}T00:00:00.000Z`);
const WEEKDAY = new Date(Date.UTC(2030, 5, 5)).getUTCDay();
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function schedule(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    tourId: 't1',
    weekdays: ALL_WEEKDAYS,
    startTimes: ['09:00'],
    capacity: 10,
    seasonStart: null,
    seasonEnd: null,
    priceOverride: null,
    isActive: true,
    ...over,
  };
}

function exception(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    tourId: 't1',
    date: DAY_START,
    type: 'BLACKOUT',
    startTime: null,
    capacity: null,
    priceOverride: null,
    note: null,
    ...over,
  };
}

function mockPrisma() {
  return {
    tour: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        timeZone: 'America/Curacao',
        bookingCutoffMinutes: 120,
        durationMinutesFrom: 240,
      }),
    },
    availabilitySchedule: { findMany: jest.fn().mockResolvedValue([]) },
    availabilityException: { findMany: jest.fn().mockResolvedValue([]) },
    departure: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnValue({ op: 'update' }),
      createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
      deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

function createdRows(prisma: ReturnType<typeof mockPrisma>) {
  return prisma.departure.createMany.mock.calls[0]?.[0]?.data ?? [];
}

describe('AvailabilityMaterializerService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let svc: AvailabilityMaterializerService;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new AvailabilityMaterializerService(prisma as never);
  });

  it('creates a departure per schedule start time with derived cutoff + end', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);

    const res = await svc.materializeTour('t1', DAY, DAY);

    expect(res).toMatchObject({ created: 1, updated: 0, skipped: 0, removed: 0 });
    const rows = createdRows(prisma);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tourId: 't1',
      capacity: 10,
      vacancies: 10,
      source: 'schedule',
      status: 'AVAILABLE',
    });
    expect(rows[0].localDateTimeStart.toISOString()).toBe(`${DAY}T09:00:00.000Z`);
    expect(rows[0].utcCutoffAt.toISOString()).toBe(`${DAY}T07:00:00.000Z`);
    expect(rows[0].localDateTimeEnd.toISOString()).toBe(`${DAY}T13:00:00.000Z`);
  });

  it('skips days excluded by the weekday pattern', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ weekdays: [(WEEKDAY + 1) % 7] }),
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res.created).toBe(0);
    expect(prisma.departure.createMany).not.toHaveBeenCalled();
  });

  it('suppresses departures on a whole-day BLACKOUT', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([exception()]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res.created).toBe(0);
  });

  it('applies a CAPACITY_OVERRIDE for the day', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([
      exception({ type: 'CAPACITY_OVERRIDE', capacity: 5 }),
    ]);
    await svc.materializeTour('t1', DAY, DAY);
    expect(createdRows(prisma)[0]).toMatchObject({ capacity: 5, vacancies: 5 });
  });

  it('adds an EXTRA_DEPARTURE on top of the schedule', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([
      exception({ type: 'EXTRA_DEPARTURE', startTime: '15:00', capacity: 8 }),
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res.created).toBe(2);
    const times = createdRows(prisma).map((r: { localDateTimeStart: Date }) =>
      r.localDateTimeStart.toISOString(),
    );
    expect(times).toContain(`${DAY}T09:00:00.000Z`);
    expect(times).toContain(`${DAY}T15:00:00.000Z`);
  });

  it('preserves booked seats when capacity changes on re-materialize', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacity: 12 }),
    ]);
    prisma.departure.findMany.mockResolvedValue([
      {
        id: 'd1',
        localDateTimeStart: new Date(`${DAY}T09:00:00.000Z`),
        capacity: 10,
        vacancies: 7, // 3 booked
        manuallyEdited: false,
      },
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ created: 0, updated: 1 });
    expect(prisma.departure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ capacity: 12, vacancies: 9 }),
      }),
    );
  });

  it('never touches a manuallyEdited departure', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacity: 12 }),
    ]);
    prisma.departure.findMany.mockResolvedValue([
      {
        id: 'd1',
        localDateTimeStart: new Date(`${DAY}T09:00:00.000Z`),
        capacity: 10,
        vacancies: 7,
        manuallyEdited: true,
      },
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ updated: 0, skipped: 1, created: 0 });
    expect(prisma.departure.update).not.toHaveBeenCalled();
  });

  it('prunes orphaned future departures with no bookings', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]); // 09:00 only
    prisma.departure.findMany.mockResolvedValue([
      {
        id: 'd-orphan',
        localDateTimeStart: new Date(`${DAY}T18:00:00.000Z`), // no longer scheduled
        capacity: 10,
        vacancies: 10, // unbooked
        manuallyEdited: false,
      },
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ created: 1, removed: 1 });
    expect(prisma.departure.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['d-orphan'] } },
    });
  });

  it('rejects a window beyond the 365-day horizon', async () => {
    await expect(
      svc.materializeTour('t1', '2030-01-01', '2032-01-01'),
    ).rejects.toThrow(/horizon/i);
  });

  it('throws when the tour does not exist', async () => {
    prisma.tour.findUnique.mockResolvedValue(null);
    await expect(svc.materializeTour('t1', DAY, DAY)).rejects.toThrow(/not found/i);
  });
});
