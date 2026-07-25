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
import { PLATFORM_JOBS } from './platform-queue';

/** Thin-switch contract: every named job routes to its idempotent runner. */
describe('PlatformJobsProcessor', () => {
  const bookings = {
    runConfirmationEmailJob: jest.fn(),
    runOperatorNoticeJob: jest.fn(),
    runCapiConversionJob: jest.fn(),
    runPreTourReminderJob: jest.fn(),
    runRefundJob: jest.fn(),
  };
  const proc = new PlatformJobsProcessor(bookings as never);

  const job = (name: string) =>
    ({ name, data: { bookingId: 'b1' } }) as Job<{ bookingId: string }>;

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

  it('ignores unknown job names instead of throwing (forward compat)', async () => {
    await expect(proc.process(job('some.future-job'))).resolves.toBeUndefined();
  });
});
