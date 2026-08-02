import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BookingsService } from '@/bookings/bookings.service';
import { CalendarPollService } from '@/calendar-sync/calendar-poll.service';
import {
  isBookingJob,
  isCalendarPollJob,
  PLATFORM_JOBS,
  PLATFORM_QUEUE,
  type PlatformJobData,
} from './platform-queue';

/**
 * Consumer for the durable platform queue (B6). Thin by design: every job maps
 * to an IDEMPOTENT `run*Job` method on BookingsService, which reloads the
 * booking, re-validates its state (it may have been cancelled between enqueue
 * and run), checks its own DB guard column, acts, and stamps the guard
 * (EVENT-DRIVEN-AND-QUEUES.md §5.1). A throw here retries with exponential
 * backoff (5 attempts); failures are retained in the failed set so a stuck
 * email/conversion/refund is visible, never silently dropped (§5.5).
 *
 * Calendar jobs are the exception to that retry note: they run ONCE per
 * enqueue, because the sync pipeline keeps its own retry ladder in the database
 * (see `CALENDAR_POLL_JOB_OPTS`). Two stacked retry mechanisms would hammer the
 * channel and write five sync-log rows for one real failure.
 */
@Processor(PLATFORM_QUEUE, { concurrency: 5 })
export class PlatformJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(PlatformJobsProcessor.name);

  constructor(
    private readonly bookings: BookingsService,
    private readonly calendarPoll: CalendarPollService,
  ) {
    super();
  }

  async process(job: Job<PlatformJobData>): Promise<void> {
    // Calendar jobs are matched on NAME first: the repeatable tick carries no
    // payload at all, so anything that inspects `job.data` must come after it.
    if (job.name === PLATFORM_JOBS.ICAL_POLL_TICK) {
      await this.calendarPoll.tick();
      return;
    }
    if (job.name === PLATFORM_JOBS.ICAL_POLL_ONE) {
      if (!isCalendarPollJob(job.data)) {
        this.logger.warn('iCal poll job without a subscriptionId - ignored');
        return;
      }
      await this.calendarPoll.pollOne(job.data.subscriptionId);
      return;
    }

    if (!isBookingJob(job.data)) {
      this.logger.warn(`Job '${job.name}' carries no bookingId - ignored`);
      return;
    }
    const { bookingId } = job.data;

    switch (job.name) {
      case PLATFORM_JOBS.CONFIRMATION_EMAIL:
        return this.bookings.runConfirmationEmailJob(bookingId);
      case PLATFORM_JOBS.OPERATOR_NOTICE:
        return this.bookings.runOperatorNoticeJob(bookingId);
      case PLATFORM_JOBS.CAPI_CONVERSION:
        return this.bookings.runCapiConversionJob(bookingId);
      case PLATFORM_JOBS.PRE_TOUR_REMINDER:
        return this.bookings.runPreTourReminderJob(bookingId);
      case PLATFORM_JOBS.REFUND_EXECUTE:
        return this.bookings.runRefundJob(bookingId);
      default:
        this.logger.warn(`Unknown platform job '${job.name}' - ignored`);
    }
  }
}
