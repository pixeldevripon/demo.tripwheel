/**
 * Unit tests for the poll scheduler. Prisma, the queue and the sync pipeline are
 * mocked.
 *
 * The behaviours worth pinning are the operational ones: a tick must only ever
 * enqueue, a crashed worker must not strand a subscription in SYNCING forever,
 * and a multi-instance deploy must not register the repeatable tick N times.
 */
import { CalendarSubscriptionStatus, IcalSyncTrigger } from '@prisma/client';
import { CalendarPollService } from './calendar-poll.service';
import { ICAL_TICK_MS, PLATFORM_JOBS } from '@/workers/platform-queue';

function mockPrisma() {
  return {
    calendarSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

const mockQueue = () => ({ add: jest.fn().mockResolvedValue(undefined) });
const mockSync = () => ({ runSync: jest.fn().mockResolvedValue(undefined) });

function make() {
  const prisma = mockPrisma();
  const queue = mockQueue();
  const sync = mockSync();
  const service = new CalendarPollService(
    prisma as never,
    sync as never,
    queue as never,
  );
  return { service, prisma, queue, sync };
}

describe('CalendarPollService', () => {
  describe('registering the tick', () => {
    it('registers one repeatable job at the configured interval', async () => {
      const { service, queue } = make();
      await service.onModuleInit();

      const [name, data, opts] = queue.add.mock.calls[0];
      expect(name).toBe(PLATFORM_JOBS.ICAL_POLL_TICK);
      expect(data).toEqual({});
      expect(opts.repeat).toEqual({ every: ICAL_TICK_MS });
    });

    // Every instance registers on boot, so without a stable jobId a three-pod
    // deploy would poll every operator's feed three times over.
    it('uses a fixed job id so multiple instances collapse to one schedule', async () => {
      const { service, queue } = make();
      await service.onModuleInit();
      expect(queue.add.mock.calls[0][2].jobId).toBe(
        PLATFORM_JOBS.ICAL_POLL_TICK,
      );
    });

    // Redis being unavailable must not take the API down with it.
    it('survives a queue that cannot be reached', async () => {
      const { service, queue } = make();
      queue.add.mockRejectedValue(new Error('redis down'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('tick', () => {
    it('enqueues one job per due subscription and does no work itself', async () => {
      const { service, prisma, queue, sync } = make();
      prisma.calendarSubscription.findMany.mockResolvedValue([
        { id: 'sub-1' },
        { id: 'sub-2' },
      ]);

      const result = await service.tick();

      expect(result.enqueued).toBe(2);
      // Running inline would serialise every operator behind the slowest channel.
      expect(sync.runSync).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        PLATFORM_JOBS.ICAL_POLL_ONE,
        { subscriptionId: 'sub-1' },
        expect.objectContaining({ jobId: 'ical-poll:sub-1' }),
      );
    });

    it('selects only auto-syncing, connected subscriptions that are due', async () => {
      const { service, prisma } = make();
      await service.tick();

      const [args] = prisma.calendarSubscription.findMany.mock.calls[0];
      expect(args.where).toMatchObject({
        autoSyncEnabled: true,
        disconnectedAt: null,
      });
      expect(args.where.nextPollAt.lte).toBeInstanceOf(Date);
      // A permanently broken URL waits for the operator, not for the clock.
      expect(args.where.status.in).not.toContain(
        CalendarSubscriptionStatus.INVALID_URL,
      );
      expect(args.where.status.in).not.toContain(
        CalendarSubscriptionStatus.PAUSED,
      );
    });

    // One retry per enqueue: the ladder lives in the database, and letting
    // BullMQ retry as well would write five log rows for one real failure.
    it('enqueues polls with a single attempt', async () => {
      const { service, prisma, queue } = make();
      prisma.calendarSubscription.findMany.mockResolvedValue([{ id: 'sub-1' }]);
      await service.tick();
      expect(queue.add.mock.calls[0][2].attempts).toBe(1);
    });

    it('caps how much it enqueues in one pass', async () => {
      const { service, prisma } = make();
      await service.tick();
      expect(
        prisma.calendarSubscription.findMany.mock.calls[0][0].take,
      ).toBeGreaterThan(0);
    });

    it('takes the most overdue first', async () => {
      const { service, prisma } = make();
      await service.tick();
      expect(
        prisma.calendarSubscription.findMany.mock.calls[0][0].orderBy,
      ).toEqual({ nextPollAt: 'asc' });
    });
  });

  describe('recovering stuck syncs', () => {
    // A killed worker leaves the row SYNCING forever: every later tick skips it
    // and the operator watches a spinner that never resolves.
    it('resets a sync left running past the cutoff and reschedules it', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.tick();

      expect(result.recovered).toBe(2);
      const [args] = prisma.calendarSubscription.updateMany.mock.calls[0];
      expect(args.where.status).toBe(CalendarSubscriptionStatus.SYNCING);
      expect(args.where.updatedAt.lt).toBeInstanceOf(Date);
      expect(args.data.status).toBe(CalendarSubscriptionStatus.ACTIVE);
      // Rescheduled rather than dropped, so recovery needs no operator action.
      expect(args.data.nextPollAt).toBeInstanceOf(Date);
    });

    it('recovers before selecting work, so a recovered row can run this tick', async () => {
      const { service, prisma } = make();
      const order: string[] = [];
      prisma.calendarSubscription.updateMany.mockImplementation(() => {
        order.push('recover');
        return Promise.resolve({ count: 0 });
      });
      prisma.calendarSubscription.findMany.mockImplementation(() => {
        order.push('select');
        return Promise.resolve([]);
      });

      await service.tick();
      expect(order).toEqual(['recover', 'select']);
    });
  });

  describe('pollOne', () => {
    it('runs the pipeline as a SCHEDULED trigger', async () => {
      const { service, sync } = make();
      await service.pollOne('sub-9');
      expect(sync.runSync).toHaveBeenCalledWith(
        'sub-9',
        IcalSyncTrigger.SCHEDULED,
      );
    });
  });
});
