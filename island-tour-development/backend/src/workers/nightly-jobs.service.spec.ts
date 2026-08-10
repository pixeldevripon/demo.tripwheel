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
 * tick. The registration itself must never take the app down.
 */
describe('NightlyJobsService scheduler registration', () => {
  const queue = { upsertJobScheduler: jest.fn().mockResolvedValue({}) };

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
    queue as never,
  );

  beforeEach(() => queue.upsertJobScheduler.mockClear());

  it('upserts every schedule under its FIXED id with its designed cadence', async () => {
    await svc.onModuleInit();

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

  it('never lets a Redis outage at boot stop the app from serving', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });
});
