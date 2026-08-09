import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AvailabilityExceptionType,
  ClosureReason,
  DepartureSource,
  DepartureStatus,
  Prisma,
  type AvailabilityException,
  type AvailabilitySchedule,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  dateKey,
  dayDate,
  hhmmToTime,
  localNow,
  mondayZeroWeekday,
  timeOfDay,
} from '@/common/utils/timezone.util';
import { storedStatusForFill } from './availability-status.util';
import type { MaterializeResultDto } from './dto/availability.dto';

/** Hard cap so a bad date range can't explode the departures table. */
const MAX_HORIZON_DAYS = 365;
const DEFAULT_HORIZON_DAYS = 90;
const MS_PER_DAY = 86_400_000;

interface DesiredDeparture {
  date: Date; // @db.Date storage form (midnight UTC)
  startTime: string; // 'HH:MM'
  capacity: number;
  status: DepartureStatus; // OPEN, or CLOSED for a stop-sell exception
  source: DepartureSource;
  // Carried from the exception that closed this row, because it is what a
  // TRAVELLER is told: SOLD_OUT reads "Sold out" with the date struck through,
  // NOT_RUNNING reads "No departure", plain. Null on an open row.
  closureReason: ClosureReason | null;
}

/**
 * Materialization engine - projects the recurring `AvailabilitySchedule` weekly pattern
 * plus per-date `AvailabilityException` deviations into concrete `Departure` rows (the
 * inventory source of truth) for a rolling window (master §E.9 §3).
 *
 * All dates/times are destination-local. Capacity resolves exception -> schedule
 * `capacityOverride` -> tour default (`maxPartySize`). The job NEVER touches a departure
 * with bookings, a manual edit, or `source = api`. Idempotent and keyed on
 * `(tourId, date, startTime)`. The nightly BullMQ job (Phase 9) calls `materializeTour`.
 */
@Injectable()
export class AvailabilityMaterializerService {
  private readonly logger = new Logger(AvailabilityMaterializerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async materializeTour(
    tourId: string,
    from?: string,
    to?: string,
  ): Promise<MaterializeResultDto> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true, timeZone: true, maxPartySize: true },
    });
    if (!tour) throw new BadRequestException('Tour not found');

    // Everything is destination-local time: "now" is the island's wall-clock now.
    const now = localNow(tour.timeZone);
    const { fromDate, toDate } = this.resolveWindow(from, to, now);

    const [schedules, exceptions] = await Promise.all([
      this.prisma.availabilitySchedule.findMany({
        where: { tourId, status: 'ACTIVE' },
      }),
      this.prisma.availabilityException.findMany({
        where: { tourId, date: { gte: fromDate, lte: toDate } },
      }),
    ]);

    const exceptionsByDate = new Map<string, AvailabilityException[]>();
    for (const ex of exceptions) {
      const key = dateKey(ex.date);
      const list = exceptionsByDate.get(key) ?? [];
      list.push(ex);
      exceptionsByDate.set(key, list);
    }

    const desired = new Map<string, DesiredDeparture>();
    for (
      let d = new Date(fromDate);
      d <= toDate;
      d = new Date(d.getTime() + MS_PER_DAY)
    ) {
      this.buildDayDepartures(
        d,
        tour.maxPartySize,
        schedules,
        exceptionsByDate.get(dateKey(d)) ?? [],
        desired,
      );
    }

    return this.reconcile(tourId, fromDate, toDate, desired);
  }

  // ── window resolution ──────────────────────────────────────────────────────
  private resolveWindow(
    from: string | undefined,
    to: string | undefined,
    now: Date,
  ) {
    const fromDate = from ? dayDate(from) : dayDate(dateKey(now));
    const toDate = to
      ? dayDate(to)
      : new Date(fromDate.getTime() + DEFAULT_HORIZON_DAYS * MS_PER_DAY);
    if (toDate < fromDate) {
      throw new BadRequestException('`to` must be on or after `from`');
    }
    if (
      (toDate.getTime() - fromDate.getTime()) / MS_PER_DAY >
      MAX_HORIZON_DAYS
    ) {
      throw new BadRequestException(
        `Window exceeds ${MAX_HORIZON_DAYS}-day horizon`,
      );
    }
    return { fromDate, toDate };
  }

  // ── one calendar day → desired departures ──────────────────────────────────
  private buildDayDepartures(
    day: Date,
    tourDefaultCapacity: number | null,
    schedules: AvailabilitySchedule[],
    dayExceptions: AvailabilityException[],
    desired: Map<string, DesiredDeparture>,
  ): void {
    const date = dayDate(dateKey(day));
    const weekday = mondayZeroWeekday(day); // Monday = 0 (master convention)
    const keyOf = (startTime: string) => `${dateKey(day)}|${startTime}`;

    // 1. Recurring schedule slots active on this weekday + within the valid window.
    for (const schedule of schedules) {
      if (schedule.weekday !== weekday) continue;
      if (schedule.validFrom && day < schedule.validFrom) continue;
      if (schedule.validUntil && day > schedule.validUntil) continue;

      const capacity = schedule.capacityOverride ?? tourDefaultCapacity;
      if (capacity == null) {
        this.logger.warn(
          `Schedule ${schedule.id} has no capacityOverride and tour has no maxPartySize - slot skipped`,
        );
        continue;
      }
      const startTime = timeOfDay(schedule.startTime);
      desired.set(keyOf(startTime), {
        date,
        startTime,
        capacity,
        status: DepartureStatus.OPEN,
        source: DepartureSource.SCHEDULE,
        closureReason: null,
      });
    }

    // 2. add_slot - introduce a departure the weekly pattern does not produce.
    for (const ex of dayExceptions) {
      if (ex.type !== AvailabilityExceptionType.ADD_SLOT) continue;
      if (!ex.startTime) {
        this.logger.warn(
          `add_slot exception ${ex.id} has no startTime - skipped`,
        );
        continue;
      }
      const capacity = ex.capacity ?? tourDefaultCapacity;
      if (capacity == null) {
        this.logger.warn(
          `add_slot exception ${ex.id} has no resolvable capacity - skipped`,
        );
        continue;
      }
      const startTime = timeOfDay(ex.startTime);
      desired.set(keyOf(startTime), {
        date,
        startTime,
        capacity,
        status: DepartureStatus.OPEN,
        source: DepartureSource.EXCEPTION,
        closureReason: null,
      });
    }

    // 3. set_capacity - override capacity for one slot (startTime set) or all (null).
    for (const ex of dayExceptions) {
      if (
        ex.type !== AvailabilityExceptionType.SET_CAPACITY ||
        ex.capacity == null
      )
        continue;
      if (ex.startTime) {
        const row = desired.get(keyOf(timeOfDay(ex.startTime)));
        if (row) row.capacity = ex.capacity;
      } else {
        for (const [k, row] of desired) {
          if (k.startsWith(`${dateKey(day)}|`)) row.capacity = ex.capacity;
        }
      }
    }

    // 4. close_date / close_slot - stop-sell: keep the departure but mark it
    // CLOSED, and carry the operator's REASON onto it.
    //
    // CLOSED whichever reason was given, deliberately. A "Sold out" close is
    // not stored as SOLD_OUT because that status is derived from the fill and
    // would reopen the moment a booking was cancelled - and a manual stop-sell
    // has to win until the operator lifts it. The reason is what makes the two
    // read differently to a traveller.
    for (const ex of dayExceptions) {
      if (ex.type === AvailabilityExceptionType.CLOSE_DATE && !ex.startTime) {
        for (const [k, row] of desired) {
          if (k.startsWith(`${dateKey(day)}|`)) {
            row.status = DepartureStatus.CLOSED;
            row.closureReason = ex.closureReason ?? null;
          }
        }
      } else if (
        ex.type === AvailabilityExceptionType.CLOSE_SLOT &&
        ex.startTime
      ) {
        const row = desired.get(keyOf(timeOfDay(ex.startTime)));
        if (row) {
          row.status = DepartureStatus.CLOSED;
          row.closureReason = ex.closureReason ?? null;
        }
      }
    }
  }

  // ── reconcile desired vs existing ──────────────────────────────────────────
  private async reconcile(
    tourId: string,
    fromDate: Date,
    toDate: Date,
    desired: Map<string, DesiredDeparture>,
  ): Promise<MaterializeResultDto> {
    const existing = await this.prisma.departure.findMany({
      where: { tourId, date: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
        status: true,
        closureReason: true,
        manuallyEdited: true,
        source: true,
      },
    });
    const keyOf = (date: Date, startTime: Date) =>
      `${dateKey(date)}|${timeOfDay(startTime)}`;
    const existingByKey = new Map(
      existing.map((e) => [keyOf(e.date, e.startTime), e]),
    );

    /**
     * Protected from DELETION and capacity re-projection (master §3): a booked,
     * operator-edited, or API-sourced departure is never removed or resized.
     */
    const isProtected = (row: {
      bookedCount: number;
      manuallyEdited: boolean;
      source: DepartureSource;
    }) =>
      row.bookedCount > 0 ||
      row.manuallyEdited ||
      row.source === DepartureSource.API;

    /**
     * Fully hands-off: operator-hand-edited or externally sourced. Even an
     * explicit stop-sell does not override these - the operator/API owns them.
     */
    const isFullyManaged = (row: {
      manuallyEdited: boolean;
      source: DepartureSource;
    }) => row.manuallyEdited || row.source === DepartureSource.API;

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const creates: Prisma.DepartureCreateManyInput[] = [];
    let updated = 0;
    let skipped = 0;

    for (const [key, want] of desired) {
      const row = existingByKey.get(key);
      if (!row) {
        creates.push({
          tourId,
          date: want.date,
          startTime: hhmmToTime(want.startTime),
          capacity: want.capacity,
          bookedCount: 0,
          status: want.status,
          closureReason: want.closureReason,
          source: want.source,
        });
        continue;
      }
      if (isFullyManaged(row)) {
        skipped++;
        continue;
      }
      // A booked departure keeps its capacity / bookedCount / source (never resize
      // or resurrect a booking), but its STATUS still follows the projection - so
      // an explicit stop-sell (CLOSE_DATE / CLOSE_SLOT) closes it and removing the
      // exception reopens it. CLOSED only stops NEW sales; existing bookings stay
      // valid. Without this a partially-booked slot would keep selling through a
      // closed date.
      if (row.bookedCount > 0) {
        const status =
          want.status === DepartureStatus.CLOSED
            ? DepartureStatus.CLOSED
            : storedStatusForFill(row.capacity, row.bookedCount);
        // The reason rides with the status: reopening clears it, and switching
        // a close from "Not running" to "Sold out" has to reach the traveller.
        // Both sides normalize to null - a row selected before the column
        // existed reads `undefined`, and treating that as a difference would
        // make every pass rewrite every booked departure it touches.
        const closureReason =
          status === DepartureStatus.CLOSED ? want.closureReason : null;
        if (
          status !== row.status ||
          closureReason !== (row.closureReason ?? null)
        ) {
          ops.push(
            this.prisma.departure.update({
              where: { id: row.id },
              data: { status, closureReason },
            }),
          );
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      // Unbooked, unmanaged: full re-projection of capacity + status + source.
      const status =
        want.status === DepartureStatus.CLOSED
          ? DepartureStatus.CLOSED
          : storedStatusForFill(want.capacity, row.bookedCount);
      ops.push(
        this.prisma.departure.update({
          where: { id: row.id },
          data: {
            capacity: want.capacity,
            status,
            closureReason:
              status === DepartureStatus.CLOSED ? want.closureReason : null,
            source: want.source,
          },
        }),
      );
      updated++;
    }

    // Orphans: existing slots no longer desired, unbooked, not protected → remove.
    const orphanIds = existing
      .filter(
        (e) => !desired.has(keyOf(e.date, e.startTime)) && !isProtected(e),
      )
      .map((e) => e.id);
    if (orphanIds.length) {
      ops.push(
        this.prisma.departure.deleteMany({ where: { id: { in: orphanIds } } }),
      );
    }
    if (creates.length) {
      ops.push(
        this.prisma.departure.createMany({
          data: creates,
          skipDuplicates: true,
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops);

    const result = {
      created: creates.length,
      updated,
      skipped,
      removed: orphanIds.length,
    };
    this.logger.log(
      `Materialized tour ${tourId}: +${result.created} ~${result.updated} ` +
        `skip ${result.skipped} -${result.removed}`,
    );
    return result;
  }
}
