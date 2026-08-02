import { Injectable, Logger } from '@nestjs/common';
import {
  AvailabilityExceptionSource,
  AvailabilityExceptionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AvailabilityService } from '@/availability/availability.service';
import { dateKey, dayDate, hhmmToTime } from '@/common/utils/timezone.util';
import type { DesiredBlock, MappedConflict } from './block-mapper.util';
import type { BusyBlock } from './ical-parser.util';

/**
 * Makes the database match what a feed currently says, and nothing more.
 *
 * ## The one rule that makes this safe
 * The diff is scoped to `source = ICAL` rows belonging to **this subscription**.
 * An operator's own closures (`source = MANUAL`) are never read, never counted
 * and never deleted - so a sync can no more reopen a day the operator closed by
 * hand than it can cancel a booking.
 *
 * ## Only a successful parse may remove a block
 * Deletion is driven by absence: "this block is no longer in the feed, release
 * it". That inference is only valid when we actually read the feed. A fetch
 * error, a timeout or a truncated body must therefore never reach this service -
 * the caller keeps the existing blocks and flips the subscription to ERROR
 * instead. The type signature enforces the shape of that contract (it takes
 * parsed blocks, which only exist on success), but the discipline is the
 * caller's: see `poll` in the sync service.
 *
 * ## Why departures are not written here
 * They are projected, not stored twice. Once the exceptions are right, the
 * existing materializer re-derives inventory exactly as it does for an operator
 * closing a day by hand (spec non-negotiable 1: `departures` is the truth).
 */
@Injectable()
export class CalendarReconcilerService {
  private readonly logger = new Logger(CalendarReconcilerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Apply a parsed feed to one subscription.
   *
   * Everything that touches inventory happens in a single transaction, so a
   * failure part-way leaves availability exactly as it was rather than
   * half-closed. The re-materialization runs after it commits: it is idempotent
   * and reads its own inputs, so holding the transaction open for it would only
   * lengthen the lock.
   */
  async reconcile(input: {
    subscriptionId: string;
    tourId: string;
    desired: DesiredBlock[];
    conflicts: MappedConflict[];
    events: BusyBlock[];
  }): Promise<{
    blocksCreated: number;
    blocksRemoved: number;
    eventsAdded: number;
    eventsRemoved: number;
    conflictsDetected: number;
  }> {
    const { subscriptionId, tourId, desired, conflicts, events } = input;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const blocks = await this.reconcileBlocks(
        tx,
        subscriptionId,
        tourId,
        desired,
      );
      const eventCounts = await this.reconcileEvents(
        tx,
        subscriptionId,
        events,
        now,
      );
      const conflictsDetected = await this.recordConflicts(
        tx,
        subscriptionId,
        tourId,
        conflicts,
      );
      return { ...blocks, ...eventCounts, conflictsDetected };
    });

    // Only touch the materializer when inventory actually moved - an unchanged
    // feed is the common case and should cost nothing.
    if (result.blocksCreated > 0 || result.blocksRemoved > 0) {
      await this.availability.resyncTourAvailability(tourId);
      this.logger.log(
        `Subscription ${subscriptionId}: +${result.blocksCreated} -${result.blocksRemoved} blocks, resynced tour ${tourId}`,
      );
    }

    return result;
  }

  /**
   * Release everything a subscription is holding, then re-project.
   *
   * The disconnect path's "make these dates available again" option, and the
   * cleanup when a subscription is deleted outright.
   */
  async releaseBlocks(
    subscriptionId: string,
    tourId: string,
  ): Promise<{ released: number }> {
    const { count } = await this.prisma.availabilityException.deleteMany({
      where: { subscriptionId, source: AvailabilityExceptionSource.ICAL },
    });
    if (count > 0) await this.availability.resyncTourAvailability(tourId);
    this.logger.log(
      `Subscription ${subscriptionId}: released ${count} imported blocks`,
    );
    return { released: count };
  }

  /**
   * Hand the blocks to the operator instead of releasing them.
   *
   * The disconnect dialog's DEFAULT choice, and the safer one: a channel that
   * has stopped syncing is not a channel whose dates became free. Converting to
   * MANUAL keeps the days closed and makes them the operator's to reopen, which
   * also takes them out of this reconciler's reach forever.
   */
  async convertBlocksToManual(
    subscriptionId: string,
  ): Promise<{ converted: number }> {
    const { count } = await this.prisma.availabilityException.updateMany({
      where: { subscriptionId, source: AvailabilityExceptionSource.ICAL },
      data: {
        source: AvailabilityExceptionSource.MANUAL,
        subscriptionId: null,
        externalUid: null,
        slotKey: null,
      },
    });
    this.logger.log(
      `Subscription ${subscriptionId}: converted ${count} blocks to manual`,
    );
    return { converted: count };
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** `externalUid|YYYY-MM-DD|slotKey` - the identity of one imported block. */
  private static blockKey(parts: {
    externalUid: string | null;
    date: Date;
    slotKey: string | null;
  }): string {
    return `${parts.externalUid ?? ''}|${dateKey(parts.date)}|${parts.slotKey ?? '*'}`;
  }

  private async reconcileBlocks(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    tourId: string,
    desired: DesiredBlock[],
  ): Promise<{ blocksCreated: number; blocksRemoved: number }> {
    // Scoped to ICAL rows for THIS subscription. Manual closures are invisible
    // here by construction, which is what makes them untouchable.
    const existing = await tx.availabilityException.findMany({
      where: { subscriptionId, source: AvailabilityExceptionSource.ICAL },
      select: { id: true, externalUid: true, date: true, slotKey: true },
    });

    const existingByKey = new Map(
      existing.map((row) => [CalendarReconcilerService.blockKey(row), row]),
    );
    const desiredByKey = new Map(
      desired.map((block) => [
        CalendarReconcilerService.blockKey(block),
        block,
      ]),
    );

    const toCreate = [...desiredByKey.entries()]
      .filter(([key]) => !existingByKey.has(key))
      .map(([, block]) => block);

    const staleIds = existing
      .filter(
        (row) => !desiredByKey.has(CalendarReconcilerService.blockKey(row)),
      )
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await tx.availabilityException.deleteMany({
        where: { id: { in: staleIds } },
      });
    }

    if (toCreate.length > 0) {
      await tx.availabilityException.createMany({
        data: toCreate.map((block) => ({
          tourId,
          date: block.date,
          startTime: block.startTime ? hhmmToTime(block.startTime) : null,
          type: block.type,
          note: block.note,
          source: AvailabilityExceptionSource.ICAL,
          subscriptionId,
          externalUid: block.externalUid,
          slotKey: block.slotKey,
        })),
        // A concurrent sync racing us would otherwise violate the unique index;
        // losing the duplicate is exactly the right outcome.
        skipDuplicates: true,
      });
    }

    return { blocksCreated: toCreate.length, blocksRemoved: staleIds.length };
  }

  /**
   * Keep the diff baseline current.
   *
   * Without this we could not tell "the feed no longer lists this booking" from
   * "we have never seen it", and every poll would look like a full teardown and
   * rebuild of the operator's availability.
   */
  private async reconcileEvents(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    events: BusyBlock[],
    now: Date,
  ): Promise<{ eventsAdded: number; eventsRemoved: number }> {
    // "Added" is decided BEFORE writing. Inferring it afterwards from
    // `firstSeenAt` cannot work: that column is defaulted by Postgres, so it
    // carries the database's clock, never the `now` this process is holding.
    const known = await tx.calendarEvent.findMany({
      where: { subscriptionId },
      select: { externalUid: true, startDate: true },
    });
    const knownKeys = new Set(
      known.map((row) => `${row.externalUid}|${dateKey(row.startDate)}`),
    );
    let eventsAdded = 0;

    for (const event of events) {
      const startDate = dayDate(event.startDateKey);
      if (!knownKeys.has(`${event.externalUid}|${event.startDateKey}`)) {
        eventsAdded++;
      }

      await tx.calendarEvent.upsert({
        where: {
          subscriptionId_externalUid_startDate: {
            subscriptionId,
            externalUid: event.externalUid,
            startDate,
          },
        },
        create: {
          subscriptionId,
          externalUid: event.externalUid,
          summary: event.summary,
          startDate,
          endDate: dayDate(event.endDateKey),
          isAllDay: event.isAllDay,
          recurrenceRule: event.recurrenceRule,
          isRecurrenceInstance: event.isRecurrenceInstance,
          lastSeenAt: now,
        },
        update: {
          summary: event.summary,
          endDate: dayDate(event.endDateKey),
          isAllDay: event.isAllDay,
          lastSeenAt: now,
          // An event that came back after vanishing is live again, not a tombstone.
          removedAt: null,
        },
        select: { id: true },
      });
    }

    // Anything not in this run's feed is gone upstream. Tombstoned rather than
    // deleted so the history of what a channel once held survives.
    const { count: eventsRemoved } = await tx.calendarEvent.updateMany({
      where: { subscriptionId, removedAt: null, lastSeenAt: { lt: now } },
      data: { removedAt: now },
    });

    return { eventsAdded, eventsRemoved };
  }

  /**
   * Record conflicts, without re-raising one the operator has already seen.
   *
   * A poll every 15 minutes would otherwise re-report the same double-sale 96
   * times a day and train the operator to ignore the alert that matters most.
   */
  private async recordConflicts(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    tourId: string,
    conflicts: MappedConflict[],
  ): Promise<number> {
    if (conflicts.length === 0) return 0;

    const open = await tx.calendarConflict.findMany({
      where: {
        subscriptionId,
        acknowledgedAt: null,
        departureId: { in: conflicts.map((c) => c.departureId) },
      },
      select: { departureId: true },
    });
    const alreadyOpen = new Set(open.map((row) => row.departureId));

    const fresh = conflicts.filter((c) => !alreadyOpen.has(c.departureId));
    if (fresh.length === 0) return 0;

    await tx.calendarConflict.createMany({
      data: fresh.map((conflict) => ({
        subscriptionId,
        tourId,
        departureId: conflict.departureId,
        conflictDate: conflict.conflictDate,
        startTime: conflict.startTime ? hhmmToTime(conflict.startTime) : null,
        bookedCount: conflict.bookedCount,
        capacity: conflict.capacity,
        resolution: conflict.resolution,
      })),
    });
    return fresh.length;
  }
}
