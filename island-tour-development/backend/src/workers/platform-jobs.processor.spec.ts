// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (reached transitively via BookingsService ->
// CustomerProvisioningService; same approach as the bookings/payments specs).
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

import type { Job } from 'bullmq';
import { PlatformJobsProcessor } from './platform-jobs.processor';
import { PLATFORM_JOBS, type PlatformJobData } from './platform-queue';

/** Thin-switch contract: every named job routes to its idempotent runner. */
describe('PlatformJobsProcessor', () => {
  const bookings = {
    runConfirmationEmailJob: jest.fn(),
    runOperatorNoticeJob: jest.fn(),
    runCapiConversionJob: jest.fn(),
    runPreTourReminderJob: jest.fn(),
    runRefundJob: jest.fn(),
  };
  const calendarPoll = { tick: jest.fn(), pollOne: jest.fn() };
  const proc = new PlatformJobsProcessor(
    bookings as never,
    calendarPoll as never,
  );

  const job = (name: string, data: PlatformJobData = { bookingId: 'b1' }) =>
    ({ name, data }) as Job<PlatformJobData>;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    [PLATFORM_JOBS.CONFIRMATION_EMAIL, 'runConfirmationEmailJob'],
    [PLATFORM_JOBS.OPERATOR_NOTICE, 'runOperatorNoticeJob'],
    [PLATFORM_JOBS.CAPI_CONVERSION, 'runCapiConversionJob'],
    [PLATFORM_JOBS.PRE_TOUR_REMINDER, 'runPreTourReminderJob'],
    [PLATFORM_JOBS.REFUND_EXECUTE, 'runRefundJob'],
  ] as const)('routes %s to %s', async (name, method) => {
    await proc.process(job(name));
    expect(bookings[method]).toHaveBeenCalledWith('b1');
  });

  describe('calendar jobs', () => {
    // The tick carries NO payload, so it has to be matched on name before
    // anything reaches into `job.data`.
    it('runs the tick for a payload-less repeatable job', async () => {
      await proc.process(job(PLATFORM_JOBS.ICAL_POLL_TICK, {}));
      expect(calendarPoll.tick).toHaveBeenCalledTimes(1);
    });

    it('routes a single poll to its subscription', async () => {
      await proc.process(
        job(PLATFORM_JOBS.ICAL_POLL_ONE, { subscriptionId: 'sub-1' }),
      );
      expect(calendarPoll.pollOne).toHaveBeenCalledWith('sub-1');
    });

    it('ignores a malformed poll job rather than throwing', async () => {
      await expect(
        proc.process(job(PLATFORM_JOBS.ICAL_POLL_ONE, {})),
      ).resolves.toBeUndefined();
      expect(calendarPoll.pollOne).not.toHaveBeenCalled();
    });

    it('never routes a calendar job into a booking runner', async () => {
      await proc.process(job(PLATFORM_JOBS.ICAL_POLL_TICK, {}));
      expect(bookings.runConfirmationEmailJob).not.toHaveBeenCalled();
    });
  });

  it('ignores unknown job names instead of throwing (forward compat)', async () => {
    await expect(proc.process(job('some.future-job'))).resolves.toBeUndefined();
  });

  // A booking job whose payload lost its id must not crash the worker.
  it('ignores a booking job with no bookingId', async () => {
    await expect(
      proc.process(job(PLATFORM_JOBS.CONFIRMATION_EMAIL, {})),
    ).resolves.toBeUndefined();
    expect(bookings.runConfirmationEmailJob).not.toHaveBeenCalled();
  });
});
