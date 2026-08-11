import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailTemplateKey } from '@prisma/client';
import {
  PLATFORM_JOB_OPTS,
  PLATFORM_JOBS,
  PLATFORM_QUEUE,
  REMINDER_LEAD_MS,
  type PlatformJobData,
  type PlatformJobName,
} from './platform-queue';

/** How often undispatched outbox rows are polled. */
const RELAY_INTERVAL_MS = 5_000;
/** Rows per tick - keeps a burst from starving the event loop. */
const RELAY_BATCH = 50;

/**
 * Transactional-outbox relay (B6 / EVENT-DRIVEN-AND-QUEUES.md §5.2).
 *
 * Domain events are committed to `outbox_events` INSIDE the transaction that
 * caused them (bookings.service); this relay is the only bridge to BullMQ: it
 * polls undispatched rows, fans each event out to its jobs (deterministic
 * jobIds so a crashed tick re-enqueues without duplicating - BullMQ ignores a
 * second add with a known jobId), and stamps `dispatchedAt`.
 *
 * Crash-safety: enqueue-then-stamp. If the process dies between the two, the
 * next tick re-enqueues the same jobIds (absorbed by dedup) and stamps. The
 * consumers' DB guards are the correctness backstop either way (§5.1).
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PLATFORM_QUEUE) private readonly queue: Queue,
  ) {}

  @Interval(RELAY_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return; // never overlap slow ticks
    this.running = true;
    try {
      await this.dispatchPending();
    } catch (err) {
      // Never let a Redis/DB blip kill the interval - the next tick retries.
      this.logger.error(`Outbox relay tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Publish undispatched outbox rows to the platform queue. */
  async dispatchPending(): Promise<number> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { dispatchedAt: null },
      orderBy: { createdAt: 'asc' },
      take: RELAY_BATCH,
    });
    for (const row of rows) {
      for (const { name, data, opts } of this.jobsFor(
        row.type,
        row.aggregateId,
        row.payload,
      )) {
        await this.queue.add(name, data, {
          ...PLATFORM_JOB_OPTS,
          // `__`, not `:` - BullMQ rejects custom job ids containing its
          // Redis key separator.
          jobId: `${row.aggregateId}__${name}`,
          ...opts,
        });
      }
      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: { dispatchedAt: new Date() },
      });
    }
    if (rows.length) {
      this.logger.log(`Dispatched ${rows.length} outbox event(s)`);
    }
    return rows.length;
  }

  /**
   * Event-type -> jobs fan-out. `booking.confirmed` produces the confirmation
   * email, operator notice, CAPI conversion, and - when the start is more than
   * the lead time away - a DELAYED pre-tour reminder (doc §5.4: compute the
   * delay at enqueue; the consumer re-validates state at fire time).
   * `operator.first-tour-live` (WP-C emits, once per operator) fans out to
   * the instant OB-5 send (WP-D, checklist D-17) - here the aggregateId is
   * the OPERATOR id, so each job names its own payload shape.
   */
  private jobsFor(
    type: string,
    aggregateId: string,
    payload: unknown,
  ): {
    name: PlatformJobName;
    data: PlatformJobData;
    opts?: { delay: number };
  }[] {
    switch (type) {
      case 'booking.confirmed': {
        const data = { bookingId: aggregateId };
        const jobs: {
          name: PlatformJobName;
          data: PlatformJobData;
          opts?: { delay: number };
        }[] = [
          { name: PLATFORM_JOBS.CONFIRMATION_EMAIL, data },
          { name: PLATFORM_JOBS.OPERATOR_NOTICE, data },
          { name: PLATFORM_JOBS.CAPI_CONVERSION, data },
        ];
        const startIso = (payload as { tourStartDateTime?: string | null })
          ?.tourStartDateTime;
        if (startIso) {
          const delay =
            new Date(startIso).getTime() - REMINDER_LEAD_MS - Date.now();
          // Inside the lead window (booked <24h before start) a reminder is
          // noise on top of the confirmation email - skip it entirely.
          if (delay > 0) {
            jobs.push({
              name: PLATFORM_JOBS.PRE_TOUR_REMINDER,
              data,
              opts: { delay },
            });
          }
        }
        return jobs;
      }
      case 'booking.refund-owed':
        return [
          {
            name: PLATFORM_JOBS.REFUND_EXECUTE,
            data: { bookingId: aggregateId },
          },
        ];
      case 'operator.first-tour-live':
        return [
          {
            name: PLATFORM_JOBS.ONBOARDING_EMAIL,
            data: {
              operatorId: aggregateId,
              templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
            },
          },
        ];
      default:
        this.logger.warn(
          `Unknown outbox event type '${type}' - marked dispatched, no job`,
        );
        return [];
    }
  }
}
