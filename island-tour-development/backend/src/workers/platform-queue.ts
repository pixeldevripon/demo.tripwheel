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

/**
 * Scheduled (repeatable) jobs - the F8 single-runner replacements for the old
 * in-process `@Cron` methods (BOOKING-CONCURRENCY-HARDENING F8). Every
 * replica upserts the SAME scheduler id on boot; Redis keeps exactly one
 * schedule per id, so one worker runs each tick no matter how many app
 * processes exist. The old crons double-ran on every replica - harmless for
 * these idempotent recomputes only AFTER F1 made releases atomic; before it,
 * a double-run sweep was exactly the concurrent-release corruption.
 *
 * Renaming an entry ORPHANS the old schedule in Redis - remove it with
 * `queue.removeJobScheduler(oldName)` in the same change.
 *
 * The doc's designed names (EVENT-DRIVEN-AND-QUEUES.md §4) list the nightly
 * work as separate repeatable jobs (quality-score / eligibility /
 * materialization); as built they are one composite nightly run - F11's
 * truth-up reconciles the doc.
 */
export const PLATFORM_SCHEDULES = {
  /** Releases seats from ON_HOLD bookings past utcExpiresAt. Every minute. */
  HOLD_EXPIRY_SWEEP: { name: 'booking.hold-expiry-sweep', every: 60_000 },
  /** Voids payout rows whose booking cancelled/expired. Hourly. */
  SETTLEMENT_REVERSE_SWEEP: {
    name: 'settlement.reverse-sweep',
    every: 3_600_000,
  },
  /** Post-tour review requests, hourly (per-booking local-time decision). */
  REVIEW_REQUEST_SWEEP: { name: 'reviews.request-sweep', every: 3_600_000 },
  /** Spotlight/demand/materialize/bookable/quality/eligibility composite. */
  NIGHTLY_COMMERCIAL: {
    name: 'platform.nightly-commercial',
    pattern: '0 3 * * *', // 03:00 UTC daily, as the @Cron was
  },
} as const;

export type PlatformScheduleName =
  (typeof PLATFORM_SCHEDULES)[keyof typeof PLATFORM_SCHEDULES]['name'];

/**
 * Options for scheduled jobs: attempts 1, NOT the standard 5x backoff - the
 * schedule itself is the retry (the next tick re-runs the same idempotent
 * sweep), and a retrying sweep would overlap it. Failures are retained so a
 * broken sweep is visible in the failed set instead of vanishing.
 */
export const PLATFORM_SCHEDULE_OPTS = {
  attempts: 1,
  removeOnComplete: 100,
  removeOnFail: 1_000,
} as const;

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
