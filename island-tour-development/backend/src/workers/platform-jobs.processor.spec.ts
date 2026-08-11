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
import { PLATFORM_JOBS, PLATFORM_SCHEDULES } from './platform-queue';

/** Thin-switch contract: every named job routes to its idempotent runner. */
describe('PlatformJobsProcessor', () => {
  const bookings = {
    runConfirmationEmailJob: jest.fn(),
    runOperatorNoticeJob: jest.fn(),
    runCapiConversionJob: jest.fn(),
    runPreTourReminderJob: jest.fn(),
    runRefundJob: jest.fn(),
  };
  const nightlyJobs = {
    holdExpirySweep: jest.fn(),
    settlementReverseSweep: jest.fn(),
    reviewRequestsHourly: jest.fn(),
    run: jest.fn(),
  };
  const onboardingEmails = {
    runOnboardingEmailJob: jest.fn(),
  };
  const proc = new PlatformJobsProcessor(
    bookings as never,
    nightlyJobs as never,
    onboardingEmails as never,
  );

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

  // F8: the scheduled sweeps ride the same queue as single-runner repeatable
  // jobs. They carry no bookingId and route to the NightlyJobsService bodies.
  it.each([
    [PLATFORM_SCHEDULES.HOLD_EXPIRY_SWEEP.name, 'holdExpirySweep'],
    [
      PLATFORM_SCHEDULES.SETTLEMENT_REVERSE_SWEEP.name,
      'settlementReverseSweep',
    ],
    [PLATFORM_SCHEDULES.REVIEW_REQUEST_SWEEP.name, 'reviewRequestsHourly'],
    [PLATFORM_SCHEDULES.NIGHTLY_COMMERCIAL.name, 'run'],
  ] as const)('routes scheduled %s to %s', async (name, method) => {
    await proc.process({ name, data: {} } as Job<{ bookingId: string }>);
    expect(nightlyJobs[method]).toHaveBeenCalled();
  });

  it('lets a scheduled sweep throw (attempts=1: the failed tick must be RETAINED, not swallowed)', async () => {
    nightlyJobs.holdExpirySweep.mockRejectedValueOnce(new Error('db down'));
    await expect(
      proc.process({
        name: PLATFORM_SCHEDULES.HOLD_EXPIRY_SWEEP.name,
        data: {},
      } as Job<{ bookingId: string }>),
    ).rejects.toThrow('db down');
  });

  it('ignores unknown job names instead of throwing (forward compat)', async () => {
    await expect(proc.process(job('some.future-job'))).resolves.toBeUndefined();
  });

  // WP-D (D-17): the onboarding email job routes to the registered sender
  // with its OWN payload shape ({ operatorId, templateKey }, plan §2.6).
  it('routes email.onboarding-send to OnboardingEmailsService with its payload', async () => {
    const data = { operatorId: 'op-1', templateKey: 'OB5_TOUR_LIVE' };
    await proc.process({
      name: PLATFORM_JOBS.ONBOARDING_EMAIL,
      data,
    } as unknown as Job<{ bookingId: string }>);
    expect(onboardingEmails.runOnboardingEmailJob).toHaveBeenCalledWith(data);
  });
});
