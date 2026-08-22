// Mock the Better Auth singleton (reached transitively via BookingsService).
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

import { NightlyJobsService } from './nightly-jobs.service';
import { PLATFORM_SCHEDULES, PLATFORM_SCHEDULE_OPTS } from './platform-queue';

/**
 * F8 single-runner contract: on boot, EVERY replica upserts the same fixed
 * scheduler ids - Redis keeps one schedule per id, so N replicas produce one
 * tick - and prunes schedulers that are no longer in the catalog. The
 * registration must NEVER gate bootstrap on Redis.
 */
describe('NightlyJobsService scheduler registration', () => {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue({}),
    getJobSchedulers: jest.fn().mockResolvedValue([]),
    removeJobScheduler: jest.fn().mockResolvedValue(undefined),
  };

  const stub = {} as never;
  const svc = new NightlyJobsService(
    stub, // tours
    stub, // tiers
    stub, // availability
    stub, // publicCache
    stub, // reviewRequests
    stub, // bookings
    stub, // settlements
    stub, // contentTranslation
    stub, // onboardingEmails
    stub, // nextAdventureEmails
    queue as never,
  );
  const register = () =>
    (
      svc as unknown as { registerSchedulers(): Promise<void> }
    ).registerSchedulers();

  beforeEach(() => {
    queue.upsertJobScheduler.mockClear().mockResolvedValue({});
    queue.getJobSchedulers.mockClear().mockResolvedValue([]);
    queue.removeJobScheduler.mockClear();
  });

  it('upserts every schedule under its FIXED id with its designed cadence', async () => {
    await register();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(
      Object.values(PLATFORM_SCHEDULES).length,
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      PLATFORM_SCHEDULES.HOLD_EXPIRY_SWEEP.name,
      { every: 60_000 },
      expect.objectContaining({ opts: PLATFORM_SCHEDULE_OPTS }),
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      PLATFORM_SCHEDULES.NIGHTLY_COMMERCIAL.name,
      { pattern: '0 3 * * *', tz: 'UTC' },
      expect.objectContaining({ opts: PLATFORM_SCHEDULE_OPTS }),
    );
  });

  it('prunes schedulers that are not in the catalog (renames, reverted layers)', async () => {
    queue.getJobSchedulers.mockResolvedValue([
      { key: PLATFORM_SCHEDULES.HOLD_EXPIRY_SWEEP.name },
      // The reverted iCal layer's legacy repeatable, still ticking in Redis.
      {
        key: '1024076d37e34add86c4f557d5153d08',
        name: 'calendar.ical-poll-tick',
      },
    ]);
    await register();
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      '1024076d37e34add86c4f557d5153d08',
    );
  });

  it('NEVER blocks bootstrap on Redis: with Redis down the upsert PENDS (ioredis offline queue) - onModuleInit must return anyway', () => {
    // The real failure mode is a promise that never settles, not a
    // rejection: enableOfflineQueue queues the command until Redis returns.
    // An awaited registration would hang bootstrap forever.
    queue.upsertJobScheduler.mockReturnValue(new Promise(() => undefined));
    const before = Date.now();
    svc.onModuleInit(); // must return synchronously, not await the hang
    expect(Date.now() - before).toBeLessThan(50);
  });

  it('logs (never throws) when registration rejects outright', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(() => svc.onModuleInit()).not.toThrow();
    // Let the fire-and-forget rejection settle through the .catch handler.
    await new Promise((resolve) => setImmediate(resolve));
  });
});
