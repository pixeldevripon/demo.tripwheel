import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { BookingsService } from '@/bookings/bookings.service';
import { NightlyJobsService } from './nightly-jobs.service';
import {
  PLATFORM_JOBS,
  PLATFORM_QUEUE,
  PLATFORM_SCHEDULES,
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
 * SCHEDULED jobs (hardening F8) ride the same queue under the
 * PLATFORM_SCHEDULES names: repeatable single-runner replacements for the old
 * in-process @Cron sweeps. They carry no data and map to NightlyJobsService
 * methods; attempts = 1 (the schedule is the retry), so a throw lands the
 * tick in the retained failed set where a broken sweep is VISIBLE.
 */
@Processor(PLATFORM_QUEUE, { concurrency: 5 })
export class PlatformJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(PlatformJobsProcessor.name);

  constructor(
    private readonly bookings: BookingsService,
    private readonly nightlyJobs: NightlyJobsService,
  ) {
    super();
  }

  async process(job: Job<PlatformJobData>): Promise<void> {
    switch (job.name) {
      case PLATFORM_SCHEDULES.HOLD_EXPIRY_SWEEP.name:
        return this.nightlyJobs.holdExpirySweep();
      case PLATFORM_SCHEDULES.SETTLEMENT_REVERSE_SWEEP.name:
        return this.nightlyJobs.settlementReverseSweep();
      case PLATFORM_SCHEDULES.REVIEW_REQUEST_SWEEP.name:
        return this.nightlyJobs.reviewRequestsHourly();
      case PLATFORM_SCHEDULES.NIGHTLY_COMMERCIAL.name: {
        await this.nightlyJobs.run();
        return;
      }
      default:
        break;
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
