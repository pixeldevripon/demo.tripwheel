/**
 * The durable platform job queue (B6 / EVENT-DRIVEN-AND-QUEUES.md).
 *
 * One queue with NAMED jobs (doc §6 "one queue with named jobs for v1
 * simplicity"). Producers never touch BullMQ - they commit `OutboxEvent` rows
 * inside their own transactions; the OutboxRelayService publishes those rows
 * here and the PlatformJobsProcessor consumes them.
 */
export const PLATFORM_QUEUE = 'platform-jobs';

/** Named jobs on the platform queue. */
export const PLATFORM_JOBS = {
  CONFIRMATION_EMAIL: 'booking.confirmation-email',
  OPERATOR_NOTICE: 'booking.operator-notice',
  CAPI_CONVERSION: 'tracking.capi-conversion',
  PRE_TOUR_REMINDER: 'booking.pre-tour-reminder',
  REFUND_EXECUTE: 'booking.refund-execute',
} as const;

export type PlatformJobName =
  (typeof PLATFORM_JOBS)[keyof typeof PLATFORM_JOBS];

export interface PlatformJobData {
  bookingId: string;
}

/**
 * Default job options (doc §5.3): 5 attempts, exponential backoff from 1s
 * (1s/2s/4s/8s/16s). Completed jobs are trimmed; failures are RETAINED (capped)
 * so a stuck email/conversion/refund stays visible instead of vanishing.
 */
export const PLATFORM_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
} as const;

/** 24 hours in ms - the pre-tour reminder lead time (doc §4). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1_000;
