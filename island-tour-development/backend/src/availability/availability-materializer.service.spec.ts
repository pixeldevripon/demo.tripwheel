/**
 * Unit tests for the materialization engine (master §E.9 §3). Prisma is fully mocked;
 * the departure write ops (update/createMany/deleteMany) are invoked synchronously while
 * building the `$transaction` batch, so we assert on their captured arguments.
 */
import { AvailabilityMaterializerService } from './availability-materializer.service';

// A far-future window keeps things deterministic.
const DAY = '2030-06-05';
const DAY_START = new Date(`${DAY}T00:00:00.000Z`);
// Master weekday convention is Monday=0; JS getUTCDay() is Sunday=0, so rotate by 6.
const WEEKDAY = (new Date(Date.UTC(2030, 5, 5)).getUTCDay() + 6) % 7;

/** A @db.Time(0) storage value. */
function time(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

function schedule(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    tourId: 't1',
    weekday: WEEKDAY,
    startTime: time('09:00'),
    capacityOverride: 10,
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validUntil: null,
    status: 'ACTIVE',
    ...over,
  };
}

function exception(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    tourId: 't1',
    date: DAY_START,
    startTime: null,
    type: 'CLOSE_DATE',
    capacity: null,
    note: null,
    createdBy: null,
    ...over,
  };
}

function existingDeparture(over: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    date: DAY_START,
    startTime: time('09:00'),
    capacity: 10,
    bookedCount: 0,
    manuallyEdited: false,
    source: 'SCHEDULE',
    ...over,
  };
}

function mockPrisma() {
  return {
    tour: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        timeZone: 'America/Curacao',
        maxPartySize: 10,
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

  it('creates an OPEN departure per schedule start time', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);

    const res = await svc.materializeTour('t1', DAY, DAY);

    expect(res).toMatchObject({ created: 1, updated: 0, skipped: 0, removed: 0 });
    const rows = createdRows(prisma);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tourId: 't1',
      capacity: 10,
      bookedCount: 0,
      source: 'SCHEDULE',
      status: 'OPEN',
    });
    expect(rows[0].date.toISOString()).toBe(`${DAY}T00:00:00.000Z`);
    expect(rows[0].startTime.toISOString()).toBe('1970-01-01T09:00:00.000Z');
  });

  it('falls back to the tour default capacity when capacityOverride is null', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacityOverride: null }),
    ]);
    await svc.materializeTour('t1', DAY, DAY);
    expect(createdRows(prisma)[0]).toMatchObject({ capacity: 10 }); // tour.maxPartySize
  });

  it('skips days excluded by the weekday pattern', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ weekday: (WEEKDAY + 1) % 7 }),
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res.created).toBe(0);
    expect(prisma.departure.createMany).not.toHaveBeenCalled();
  });

  it('marks the day CLOSED on a close_date stop-sell (slot kept, not removed)', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([exception()]);
    await svc.materializeTour('t1', DAY, DAY);
    expect(createdRows(prisma)[0]).toMatchObject({ status: 'CLOSED' });
  });

  it('overrides capacity for the day via set_capacity', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([
      exception({ type: 'SET_CAPACITY', capacity: 5 }),
    ]);
    await svc.materializeTour('t1', DAY, DAY);
    expect(createdRows(prisma)[0]).toMatchObject({ capacity: 5 });
  });

  it('adds an extra departure via add_slot on top of the schedule', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]);
    prisma.availabilityException.findMany.mockResolvedValue([
      exception({ type: 'ADD_SLOT', startTime: time('15:00'), capacity: 8 }),
    ]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res.created).toBe(2);
    const times = createdRows(prisma).map((r: { startTime: Date }) =>
      r.startTime.toISOString(),
    );
    expect(times).toContain('1970-01-01T09:00:00.000Z');
    expect(times).toContain('1970-01-01T15:00:00.000Z');
  });

  it('re-projects capacity for an unbooked departure on re-materialize', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacityOverride: 12 }),
    ]);
    prisma.departure.findMany.mockResolvedValue([existingDeparture({ bookedCount: 0 })]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ created: 0, updated: 1 });
    expect(prisma.departure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ capacity: 12, status: 'OPEN' }),
      }),
    );
  });

  it('never touches a departure that has bookings (protected, master §3)', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacityOverride: 12 }),
    ]);
    prisma.departure.findMany.mockResolvedValue([existingDeparture({ bookedCount: 3 })]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ updated: 0, skipped: 1, created: 0 });
    expect(prisma.departure.update).not.toHaveBeenCalled();
  });

  it('never touches a manuallyEdited departure', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([
      schedule({ capacityOverride: 12 }),
    ]);
    prisma.departure.findMany.mockResolvedValue([existingDeparture({ manuallyEdited: true })]);
    const res = await svc.materializeTour('t1', DAY, DAY);
    expect(res).toMatchObject({ updated: 0, skipped: 1, created: 0 });
    expect(prisma.departure.update).not.toHaveBeenCalled();
  });

  it('prunes orphaned future departures with no bookings', async () => {
    prisma.availabilitySchedule.findMany.mockResolvedValue([schedule()]); // 09:00 only
    prisma.departure.findMany.mockResolvedValue([
      existingDeparture({ id: 'd-orphan', startTime: time('18:00'), bookedCount: 0 }),
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
