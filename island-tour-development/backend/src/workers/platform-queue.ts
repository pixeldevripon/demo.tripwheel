/**
 * The durable platform job queue (B6 / EVENT-DRIVEN-AND-QUEUES.md).
 *
 * One queue with NAMED jobs (doc §6 "one queue with named jobs for v1
 * simplicity"). Booking-side producers never touch BullMQ - they commit
 * `OutboxEvent` rows inside their own transactions; the OutboxRelayService
 * publishes those rows here and the PlatformJobsProcessor consumes them.
 *
 * Calendar sync is the exception to that pattern, and deliberately: it is not
 * reacting to a committed domain event, it is a POLL. Its tick is a BullMQ
 * repeatable job, which fans out one job per due subscription.
 */
export const PLATFORM_QUEUE = 'platform-jobs';

/** Named jobs on the platform queue. */
export const PLATFORM_JOBS = {
  CONFIRMATION_EMAIL: 'booking.confirmation-email',
  OPERATOR_NOTICE: 'booking.operator-notice',
  CAPI_CONVERSION: 'tracking.capi-conversion',
  PRE_TOUR_REMINDER: 'booking.pre-tour-reminder',
  REFUND_EXECUTE: 'booking.refund-execute',
  /** Repeatable: finds subscriptions whose `nextPollAt` is due and fans out. */
  ICAL_POLL_TICK: 'calendar.ical-poll-tick',
  /** One subscription's full sync pipeline. */
  ICAL_POLL_ONE: 'calendar.ical-poll-one',
} as const;

export type PlatformJobName =
  (typeof PLATFORM_JOBS)[keyof typeof PLATFORM_JOBS];

/** Booking-shaped jobs, which are the bulk of the queue. */
export interface BookingJobData {
  bookingId: string;
}

/** One subscription's poll. */
export interface CalendarPollJobData {
  subscriptionId: string;
}

/** The repeatable tick carries no payload - it discovers its own work. */
export type CalendarTickJobData = Record<string, never>;

/**
 * A union rather than one shape: the queue now carries work from two domains,
 * and a single `{ bookingId }` interface would have forced calendar jobs to
 * either lie about their payload or get a queue of their own.
 */
export type PlatformJobData =
  | BookingJobData
  | CalendarPollJobData
  | CalendarTickJobData;

/** Narrow a job payload to the booking shape. */
export function isBookingJob(data: PlatformJobData): data is BookingJobData {
  return typeof (data as BookingJobData).bookingId === 'string';
}

/** Narrow a job payload to a single-subscription poll. */
export function isCalendarPollJob(
  data: PlatformJobData,
): data is CalendarPollJobData {
  return typeof (data as CalendarPollJobData).subscriptionId === 'string';
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

/**
 * Calendar polls get ONE attempt, not five.
 *
 * The pipeline does its own retry accounting in the database - `failureCount`
 * drives a 1m/5m/15m/1h/4h ladder and decides when a subscription is really
 * broken. Letting BullMQ also retry would run that ladder five times per tick,
 * hammer the channel, and write five misleading rows into the sync history for
 * what is one failure.
 */
export const CALENDAR_POLL_JOB_OPTS = {
  attempts: 1,
  removeOnComplete: 500,
  removeOnFail: 1_000,
} as const;

/** How often the tick looks for due subscriptions. */
export const ICAL_TICK_MS = 15 * 60 * 1_000;

/** 24 hours in ms - the pre-tour reminder lead time (doc §4). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1_000;
