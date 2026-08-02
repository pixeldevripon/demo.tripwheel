/**
 * Unit tests for the reconciler. Prisma and the availability service are mocked.
 *
 * The two properties that matter most here are safety properties, not features:
 * an operator's own closures must survive every sync untouched, and a block must
 * only ever be released because the feed genuinely stopped listing it.
 */
import {
  AvailabilityExceptionSource,
  AvailabilityExceptionType,
  CalendarConflictResolution,
} from '@prisma/client';
import { CalendarReconcilerService } from './calendar-reconciler.service';
import type { DesiredBlock, MappedConflict } from './block-mapper.util';
import type { BusyBlock } from './ical-parser.util';

const SUB = 'sub-1';
const TOUR = 'tour-1';

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

function mockPrisma() {
  const tx = {
    availabilityException: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    calendarEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'e1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    calendarConflict: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return {
    tx,
    $transaction: jest.fn((cb: (c: typeof tx) => unknown) => cb(tx)),
    availabilityException: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

const mockAvailability = () => ({ resyncTourAvailability: jest.fn() });

function make() {
  const prisma = mockPrisma();
  const availability = mockAvailability();
  const service = new CalendarReconcilerService(
    prisma as never,
    availability as never,
  );
  return { service, prisma, availability };
}

const block = (over: Partial<DesiredBlock> = {}): DesiredBlock => ({
  date: day('2026-08-14'),
  startTime: null,
  type: AvailabilityExceptionType.CLOSE_DATE,
  externalUid: 'ext-1',
  slotKey: '*',
  note: 'Airbnb: Reserved',
  ...over,
});

const event = (over: Partial<BusyBlock> = {}): BusyBlock => ({
  externalUid: 'ext-1',
  summary: 'Reserved',
  isAllDay: true,
  startDateKey: '2026-08-14',
  endDateKey: '2026-08-14',
  startUtc: null,
  endUtc: null,
  recurrenceRule: null,
  isRecurrenceInstance: false,
  ...over,
});

const conflict = (over: Partial<MappedConflict> = {}): MappedConflict => ({
  departureId: 'dep-1',
  conflictDate: day('2026-08-14'),
  startTime: '08:00',
  bookedCount: 4,
  capacity: 60,
  resolution: CalendarConflictResolution.BLOCKED,
  ...over,
});

const reconcile = (
  service: CalendarReconcilerService,
  over: Partial<Parameters<CalendarReconcilerService['reconcile']>[0]> = {},
) =>
  service.reconcile({
    subscriptionId: SUB,
    tourId: TOUR,
    desired: [],
    conflicts: [],
    events: [],
    ...over,
  });

describe('CalendarReconcilerService', () => {
  describe("the operator's own closures are untouchable", () => {
    // The whole safety model: the diff never even READS a manual row, so it
    // cannot delete one, count one, or reopen a day a human closed by hand.
    it('scopes the diff to ICAL rows of this subscription only', async () => {
      const { service, prisma } = make();
      await reconcile(service);

      expect(prisma.tx.availabilityException.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            subscriptionId: SUB,
            source: AvailabilityExceptionSource.ICAL,
          },
        }),
      );
    });

    it('writes every imported row with ICAL provenance', async () => {
      const { service, prisma } = make();
      await reconcile(service, { desired: [block()] });

      const [{ data }] =
        prisma.tx.availabilityException.createMany.mock.calls[0];
      expect(data[0]).toMatchObject({
        tourId: TOUR,
        subscriptionId: SUB,
        source: AvailabilityExceptionSource.ICAL,
        externalUid: 'ext-1',
        slotKey: '*',
      });
    });
  });

  describe('diffing', () => {
    it('creates what is missing and leaves what already matches', async () => {
      const { service, prisma } = make();
      prisma.tx.availabilityException.findMany.mockResolvedValue([
        {
          id: 'keep',
          externalUid: 'ext-1',
          date: day('2026-08-14'),
          slotKey: '*',
        },
      ]);

      const result = await reconcile(service, {
        desired: [
          block(), // already present
          block({ date: day('2026-08-15') }), // new
        ],
      });

      expect(result.blocksCreated).toBe(1);
      expect(result.blocksRemoved).toBe(0);
      expect(prisma.tx.availabilityException.deleteMany).not.toHaveBeenCalled();
    });

    // The feed stopped listing it, so the date is free again.
    it('removes a row the feed no longer lists', async () => {
      const { service, prisma } = make();
      prisma.tx.availabilityException.findMany.mockResolvedValue([
        {
          id: 'stale',
          externalUid: 'gone',
          date: day('2026-08-14'),
          slotKey: '*',
        },
      ]);

      const result = await reconcile(service, { desired: [] });

      expect(result.blocksRemoved).toBe(1);
      expect(prisma.tx.availabilityException.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['stale'] } },
      });
    });

    // Two reservations covering one date are two rows; releasing one must not
    // release the date the other still holds.
    it('keys rows by event, so one removal does not release another', async () => {
      const { service, prisma } = make();
      prisma.tx.availabilityException.findMany.mockResolvedValue([
        {
          id: 'a',
          externalUid: 'ext-a',
          date: day('2026-08-14'),
          slotKey: '*',
        },
        {
          id: 'b',
          externalUid: 'ext-b',
          date: day('2026-08-14'),
          slotKey: '*',
        },
      ]);

      const result = await reconcile(service, {
        desired: [block({ externalUid: 'ext-a' })],
      });

      expect(result.blocksRemoved).toBe(1);
      expect(prisma.tx.availabilityException.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['b'] } },
      });
    });

    it('distinguishes a slot close from a whole-date close on the same day', async () => {
      const { service, prisma } = make();
      prisma.tx.availabilityException.findMany.mockResolvedValue([
        {
          id: 'whole',
          externalUid: 'ext-1',
          date: day('2026-08-14'),
          slotKey: '*',
        },
      ]);

      const result = await reconcile(service, {
        desired: [
          block({
            startTime: '08:00',
            slotKey: '08:00',
            type: AvailabilityExceptionType.CLOSE_SLOT,
          }),
        ],
      });

      expect(result.blocksCreated).toBe(1);
      expect(result.blocksRemoved).toBe(1);
    });

    it('tolerates a racing sync rather than failing the run', async () => {
      const { service, prisma } = make();
      await reconcile(service, { desired: [block()] });
      const [args] = prisma.tx.availabilityException.createMany.mock.calls[0];
      expect(args.skipDuplicates).toBe(true);
    });
  });

  describe('re-materialization', () => {
    it('resyncs the tour when inventory moved', async () => {
      const { service, prisma, availability } = make();
      prisma.tx.availabilityException.findMany.mockResolvedValue([]);
      await reconcile(service, { desired: [block()] });
      expect(availability.resyncTourAvailability).toHaveBeenCalledWith(TOUR);
    });

    // The common case is an unchanged feed; re-projecting every 15 minutes for
    // nothing would be pure load.
    it('skips the resync when nothing changed', async () => {
      const { service, availability } = make();
      await reconcile(service, { desired: [] });
      expect(availability.resyncTourAvailability).not.toHaveBeenCalled();
    });

    // Availability must never be left half-closed by a crash mid-write.
    it('does all inventory writes in one transaction', async () => {
      const { service, prisma } = make();
      await reconcile(service, { desired: [block()] });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('the event baseline', () => {
    it('counts a genuinely new event as added', async () => {
      const { service, prisma } = make();
      prisma.tx.calendarEvent.findMany.mockResolvedValue([]);
      const result = await reconcile(service, { events: [event()] });
      expect(result.eventsAdded).toBe(1);
    });

    it('does not count an event it has already seen', async () => {
      const { service, prisma } = make();
      prisma.tx.calendarEvent.findMany.mockResolvedValue([
        { externalUid: 'ext-1', startDate: day('2026-08-14') },
      ]);
      const result = await reconcile(service, { events: [event()] });
      expect(result.eventsAdded).toBe(0);
    });

    // Tombstoned, not deleted, so the record of what a channel once held survives.
    it('tombstones events missing from this run', async () => {
      const { service, prisma } = make();
      prisma.tx.calendarEvent.updateMany.mockResolvedValue({ count: 2 });
      const result = await reconcile(service, { events: [] });

      expect(result.eventsRemoved).toBe(2);
      const [args] = prisma.tx.calendarEvent.updateMany.mock.calls[0];
      expect(args.where).toMatchObject({
        subscriptionId: SUB,
        removedAt: null,
      });
      expect(args.data.removedAt).toBeInstanceOf(Date);
    });

    it('revives a tombstoned event that reappears upstream', async () => {
      const { service, prisma } = make();
      await reconcile(service, { events: [event()] });
      const [args] = prisma.tx.calendarEvent.upsert.mock.calls[0];
      expect(args.update.removedAt).toBeNull();
    });
  });

  describe('conflicts', () => {
    it('records a conflict the operator has not seen', async () => {
      const { service, prisma } = make();
      const result = await reconcile(service, { conflicts: [conflict()] });

      expect(result.conflictsDetected).toBe(1);
      const [{ data }] = prisma.tx.calendarConflict.createMany.mock.calls[0];
      expect(data[0]).toMatchObject({
        subscriptionId: SUB,
        tourId: TOUR,
        departureId: 'dep-1',
        bookedCount: 4,
        capacity: 60,
      });
    });

    // Polling every 15 minutes would otherwise re-raise the same double-sale 96
    // times a day, which trains the operator to ignore the alert that matters.
    it('does not re-raise a conflict that is still open', async () => {
      const { service, prisma } = make();
      prisma.tx.calendarConflict.findMany.mockResolvedValue([
        { departureId: 'dep-1' },
      ]);
      const result = await reconcile(service, { conflicts: [conflict()] });

      expect(result.conflictsDetected).toBe(0);
      expect(prisma.tx.calendarConflict.createMany).not.toHaveBeenCalled();
    });

    it('raises again once the operator has acknowledged the previous one', async () => {
      const { service, prisma } = make();
      // Only UNacknowledged rows are queried, so an acknowledged one is absent.
      prisma.tx.calendarConflict.findMany.mockResolvedValue([]);
      const result = await reconcile(service, { conflicts: [conflict()] });
      expect(result.conflictsDetected).toBe(1);

      const [args] = prisma.tx.calendarConflict.findMany.mock.calls[0];
      expect(args.where.acknowledgedAt).toBeNull();
    });
  });

  describe('disconnecting', () => {
    it('releases every imported block and re-projects', async () => {
      const { service, prisma, availability } = make();
      prisma.availabilityException.deleteMany.mockResolvedValue({ count: 6 });

      const result = await service.releaseBlocks(SUB, TOUR);

      expect(result.released).toBe(6);
      expect(prisma.availabilityException.deleteMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: SUB,
          source: AvailabilityExceptionSource.ICAL,
        },
      });
      expect(availability.resyncTourAvailability).toHaveBeenCalledWith(TOUR);
    });

    it('skips the resync when there was nothing to release', async () => {
      const { service, prisma, availability } = make();
      prisma.availabilityException.deleteMany.mockResolvedValue({ count: 0 });
      await service.releaseBlocks(SUB, TOUR);
      expect(availability.resyncTourAvailability).not.toHaveBeenCalled();
    });

    // The default choice on disconnect, and the safer one: a channel that stopped
    // syncing is not a channel whose dates became free.
    it('hands blocks to the operator by clearing their provenance', async () => {
      const { service, prisma } = make();
      prisma.availabilityException.updateMany.mockResolvedValue({ count: 6 });

      const result = await service.convertBlocksToManual(SUB);

      expect(result.converted).toBe(6);
      const [args] = prisma.availabilityException.updateMany.mock.calls[0];
      expect(args.data).toEqual({
        source: AvailabilityExceptionSource.MANUAL,
        subscriptionId: null,
        externalUid: null,
        slotKey: null,
      });
    });
  });
});
