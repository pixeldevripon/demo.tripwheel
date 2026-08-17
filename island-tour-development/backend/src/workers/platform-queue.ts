/**
 * The durable platform job queue (B6 / EVENT-DRIVEN-AND-QUEUES.md).
 *
 * One queue with NAMED jobs (doc §6 "one queue with named jobs for v1
 * simplicity"). Producers never touch BullMQ - they commit `OutboxEvent` rows
 * inside their own transactions; the OutboxRelayService publishes those rows
 * here and the PlatformJobsProcessor consumes them.
 */
import type { EmailTemplateKey } from '@prisma/client';

export const PLATFORM_QUEUE = 'platform-jobs';

/** Named jobs on the platform queue. */
export const PLATFORM_JOBS = {
  CONFIRMATION_EMAIL: 'booking.confirmation-email',
  OPERATOR_NOTICE: 'booking.operator-notice',
  CAPI_CONVERSION: 'tracking.capi-conversion',
  /**
   * Cancellation correction to Meta (ad-conversion PRD phase 3): the standard
   * `Refund` CAPI event for a cancelled, conversion-fired booking. Idempotent
   * by deterministic event id (`<publicRef>:refund`) - no guard column, same
   * contract as CAPI_CONVERSION.
   */
  META_REFUND: 'tracking.meta-refund',
  /**
   * Google Ads RETRACTION for a cancelled, conversion-fired booking
   * (ad-conversion PRD phase 3c). Enqueued with ADS_ADJUSTMENT_DELAY_MS:
   * order_id-identified conversions must be ingested by Google before they
   * can be adjusted, so the correction waits out the ingest lag (still
   * inside the PRD's 24-48h SLA).
   */
  ADS_ADJUSTMENT: 'tracking.ads-adjustment',
  PRE_TOUR_REMINDER: 'booking.pre-tour-reminder',
  REFUND_EXECUTE: 'booking.refund-execute',
  /**
   * One operator onboarding email (EMAIL-IMPLEMENTATION-PLAN.md §2.6).
   * Payload is `OnboardingEmailJobData` — the lifecycle sweep enqueues these
   * once WP-D registers senders; until then the processor logs and completes.
   */
  ONBOARDING_EMAIL: 'email.onboarding-send',
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
 * Renaming an entry cannot orphan the old schedule: registration prunes any
 * scheduler on this queue that is not listed here (which also cleaned up the
 * reverted iCal layer's legacy `calendar.ical-poll-tick` repeatable).
 *
 * TRADE, made deliberately: the sweeps now share Redis's fate. The old
 * in-process crons ran DB-only; if Redis dies at runtime these ticks stop
 * (holds keep their seats, phantom sold-out) until it returns - then every
 * sweep catches up automatically (all predicates are one-sided time/status
 * checks and the scheduler realigns missed iterations). Redis was already
 * load-bearing for confirmation emails, so this adds no new hard dependency,
 * but a Redis outage now has one more visible symptom.
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
  /**
   * Post-tour review requests, hourly (per-booking local-time decision).
   * `every` schedules are REGISTRATION-anchored rolling hours, not :00-
   * anchored like the old @Cron - the "around 10:00 local" first touch can
   * now land up to :59 past. Within the service's own "roughly 10:00"
   * contract, and every window check is one-sided so nothing is ever
   * skipped. Do not "fix" this to a cron pattern without re-reading
   * review-requests.service.ts.
   */
  REVIEW_REQUEST_SWEEP: { name: 'reviews.request-sweep', every: 3_600_000 },
  /** Spotlight/demand/materialize/bookable/quality/eligibility composite. */
  NIGHTLY_COMMERCIAL: {
    name: 'platform.nightly-commercial',
    pattern: '0 3 * * *', // 03:00 UTC daily, as the @Cron was
  },
  /**
   * Scheduled-email sweep (EMAIL-IMPLEMENTATION-PLAN.md §2.6): every 15 min,
   * evaluates due onboarding nudges + INT1R + MK-1 candidates against the
   * Tue–Thu Curaçao-morning window and send-time suppression, then sends
   * through the send log. ONE sweeper for all scheduled email — BK-3 keeps
   * its own hourly sweeper (REVIEW_REQUEST_SWEEP) untouched. A no-op stub
   * until WP-D registers senders; scheduling it here means WP-D ships no
   * scheduler-registration change.
   */
  EMAIL_LIFECYCLE_SWEEP: { name: 'email.lifecycle-sweep', every: 900_000 },
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

/** Payload of every booking-scoped job (the original queue contract). */
export interface BookingJobData {
  bookingId: string;
}

/** Payload of `PLATFORM_JOBS.ONBOARDING_EMAIL` (plan §2.6). */
export interface OnboardingEmailJobData {
  operatorId: string;
  templateKey: EmailTemplateKey;
}

/**
 * Discriminated by JOB NAME, not by a payload field: the processor already
 * switches on `job.name`, and every name maps to exactly one payload shape.
 * Booking jobs carry `BookingJobData` (unchanged — existing producers and
 * consumers compile untouched); the onboarding email job carries
 * `OnboardingEmailJobData`.
 */
export type PlatformJobData = BookingJobData | OnboardingEmailJobData;

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

/**
 * Delay before a Google Ads retraction is attempted (ad-conversion PRD 3c).
 * Google recommends waiting for the order_id conversion to be fully ingested
 * before adjusting it; 24h clears that in practice and still lands inside the
 * PRD's 24-48h correction SLA. The job's 5 retries cover the tail.
 */
export const ADS_ADJUSTMENT_DELAY_MS = 24 * 60 * 60 * 1_000;
