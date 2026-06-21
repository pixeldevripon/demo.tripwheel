import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AvailabilityExceptionType,
  Prisma,
  type AvailabilityException,
  type AvailabilitySchedule,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  dateKey,
  localNow,
  localWallTime,
  parseHhMm,
} from '@/common/utils/timezone.util';
import { computeAvailabilityStatus } from './availability-status.util';
import type { MaterializeResultDto } from './dto/availability.dto';

/** Hard cap so a bad date range can't explode the departures table. */
const MAX_HORIZON_DAYS = 365;
const DEFAULT_HORIZON_DAYS = 90;
const MS_PER_DAY = 86_400_000;

interface DesiredDeparture {
  optionId: string;
  localDateTimeStart: Date;
  localDateTimeEnd: Date | null;
  capacity: number;
  utcCutoffAt: Date;
  priceOverride: Prisma.Decimal | null;
  source: string;
}

/**
 * Materialization engine — expands recurring `AvailabilitySchedule` rules plus
 * date-specific `AvailabilityException` overrides into concrete `Departure` rows
 * (the inventory source of truth) for a rolling window.
 *
 * Idempotent: keyed on `(tourId, optionId, localDateTimeStart)`. Re-running adjusts
 * capacity (preserving already-booked seats), prunes orphaned future slots, and never
 * touches departures an operator has `manuallyEdited`. The nightly BullMQ job (Phase 9)
 * calls `materializeTour` to roll the window forward.
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
      select: {
        id: true,
        timeZone: true,
        bookingCutoffMinutes: true,
        durationMinutesFrom: true,
        options: {
          where: { isActive: true },
          select: { id: true, isDefault: true },
        },
      },
    });
    if (!tour) throw new BadRequestException('Tour not found');
    const defaultOptionId =
      tour.options.find((o) => o.isDefault)?.id ?? tour.options[0]?.id;
    if (!defaultOptionId) {
      throw new BadRequestException('Tour has no active option to schedule against');
    }

    // Everything is destination-local time: "now" is the island's wall-clock now.
    const now = localNow(tour.timeZone);
    const { fromDate, toDate } = this.resolveWindow(from, to, now);

    const [schedules, exceptions] = await Promise.all([
      this.prisma.availabilitySchedule.findMany({
        where: { tourId, isActive: true },
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
        tour,
        defaultOptionId,
        schedules,
        exceptionsByDate.get(dateKey(d)) ?? [],
        desired,
      );
    }

    return this.reconcile(tourId, fromDate, toDate, desired, now);
  }

  // ── window resolution ──────────────────────────────────────────────────────
  private resolveWindow(from: string | undefined, to: string | undefined, now: Date) {
    const fromDate = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date(`${dateKey(now)}T00:00:00.000Z`);
    const toDate = to
      ? new Date(`${to}T00:00:00.000Z`)
      : new Date(fromDate.getTime() + DEFAULT_HORIZON_DAYS * MS_PER_DAY);
    if (toDate < fromDate) {
      throw new BadRequestException('`to` must be on or after `from`');
    }
    if ((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY > MAX_HORIZON_DAYS) {
      throw new BadRequestException(`Window exceeds ${MAX_HORIZON_DAYS}-day horizon`);
    }
    return { fromDate, toDate };
  }

  // ── one calendar day → desired departures ──────────────────────────────────
  private buildDayDepartures(
    day: Date,
    tour: {
      timeZone: string;
      bookingCutoffMinutes: number;
      durationMinutesFrom: number | null;
    },
    defaultOptionId: string,
    schedules: AvailabilitySchedule[],
    dayExceptions: AvailabilityException[],
    desired: Map<string, DesiredDeparture>,
  ): void {
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const dom = day.getUTCDate();
    const weekday = day.getUTCDay();

    const optionOf = (scheduleOptionId: string | null) =>
      scheduleOptionId ?? defaultOptionId;
    const appliesTo = (exOptionId: string | null, optionId: string) =>
      exOptionId === null || exOptionId === optionId;

    // Recurring schedules
    for (const schedule of schedules) {
      if (!schedule.weekdays.includes(weekday)) continue;
      if (schedule.seasonStart && day < schedule.seasonStart) continue;
      if (schedule.seasonEnd && day > schedule.seasonEnd) continue;

      const optionId = optionOf(schedule.optionId);

      const wholeDayBlackout = dayExceptions.some(
        (e) =>
          e.type === AvailabilityExceptionType.BLACKOUT &&
          !e.startTime &&
          appliesTo(e.optionId, optionId),
      );
      if (wholeDayBlackout) continue;

      const capacity =
        this.overrideValue(
          dayExceptions,
          AvailabilityExceptionType.CAPACITY_OVERRIDE,
          optionId,
          (e) => e.capacity,
        ) ?? schedule.capacity;
      const price =
        this.overrideValue(
          dayExceptions,
          AvailabilityExceptionType.PRICE_OVERRIDE,
          optionId,
          (e) => e.priceOverride,
        ) ?? schedule.priceOverride;

      for (const startTime of schedule.startTimes) {
        const timeBlackout = dayExceptions.some(
          (e) =>
            e.type === AvailabilityExceptionType.BLACKOUT &&
            e.startTime === startTime &&
            appliesTo(e.optionId, optionId),
        );
        if (timeBlackout) continue;

        this.addDesired(desired, tour, {
          optionId,
          year,
          month,
          dom,
          startTime,
          capacity,
          price,
          source: 'schedule',
          overwrite: false,
        });
      }
    }

    // Extra departures (explicit one-offs win over schedule keys)
    for (const ex of dayExceptions) {
      if (ex.type !== AvailabilityExceptionType.EXTRA_DEPARTURE) continue;
      if (!ex.startTime) {
        this.logger.warn(`EXTRA_DEPARTURE ${ex.id} has no startTime — skipped`);
        continue;
      }
      if (ex.capacity === null) {
        this.logger.warn(`EXTRA_DEPARTURE ${ex.id} has no capacity — skipped`);
        continue;
      }
      this.addDesired(desired, tour, {
        optionId: optionOf(ex.optionId),
        year,
        month,
        dom,
        startTime: ex.startTime,
        capacity: ex.capacity,
        price: ex.priceOverride,
        source: 'exception',
        overwrite: true,
      });
    }
  }

  /** Most-specific override (option-specific beats all-options) of a given type. */
  private overrideValue<T>(
    exceptions: AvailabilityException[],
    type: AvailabilityExceptionType,
    optionId: string,
    read: (e: AvailabilityException) => T | null,
  ): T | null {
    const matches = exceptions.filter(
      (e) => e.type === type && (e.optionId === null || e.optionId === optionId),
    );
    if (!matches.length) return null;
    matches.sort((a, b) => (a.optionId ? -1 : 1) - (b.optionId ? -1 : 1));
    for (const m of matches) {
      const v = read(m);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }

  private addDesired(
    desired: Map<string, DesiredDeparture>,
    tour: {
      timeZone: string;
      bookingCutoffMinutes: number;
      durationMinutesFrom: number | null;
    },
    p: {
      optionId: string;
      year: number;
      month: number;
      dom: number;
      startTime: string;
      capacity: number;
      price: Prisma.Decimal | null;
      source: string;
      overwrite: boolean;
    },
  ): void {
    const { hour, minute } = parseHhMm(p.startTime);
    const start = localWallTime(p.year, p.month, p.dom, hour, minute);
    const key = `${p.optionId}|${start.toISOString()}`;
    if (desired.has(key) && !p.overwrite) return;

    const end = tour.durationMinutesFrom
      ? new Date(start.getTime() + tour.durationMinutesFrom * 60_000)
      : null;
    const utcCutoffAt = new Date(start.getTime() - tour.bookingCutoffMinutes * 60_000);

    desired.set(key, {
      optionId: p.optionId,
      localDateTimeStart: start,
      localDateTimeEnd: end,
      capacity: p.capacity,
      utcCutoffAt,
      priceOverride: p.price,
      source: p.source,
    });
  }

  // ── reconcile desired vs existing ──────────────────────────────────────────
  private async reconcile(
    tourId: string,
    fromDate: Date,
    toDate: Date,
    desired: Map<string, DesiredDeparture>,
    now: Date,
  ): Promise<MaterializeResultDto> {
    // Load existing in a generous UTC instant window (covers tz offset at both ends).
    const lowerBound = new Date(fromDate.getTime() - MS_PER_DAY);
    const upperBound = new Date(toDate.getTime() + 2 * MS_PER_DAY);
    const existing = await this.prisma.departure.findMany({
      where: {
        tourId,
        localDateTimeStart: { gte: lowerBound, lte: upperBound },
      },
      select: {
        id: true,
        optionId: true,
        localDateTimeStart: true,
        capacity: true,
        vacancies: true,
        manuallyEdited: true,
      },
    });
    const existingByKey = new Map(
      existing.map((e) => [
        `${e.optionId}|${e.localDateTimeStart.toISOString()}`,
        e,
      ]),
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const creates: Prisma.DepartureCreateManyInput[] = [];
    let updated = 0;
    let skipped = 0;

    for (const [key, want] of desired) {
      const row = existingByKey.get(key);
      if (!row) {
        const status = computeAvailabilityStatus({
          vacancies: want.capacity,
          capacity: want.capacity,
          utcCutoffAt: want.utcCutoffAt,
          now,
        });
        creates.push({
          tourId,
          optionId: want.optionId,
          localDateTimeStart: want.localDateTimeStart,
          localDateTimeEnd: want.localDateTimeEnd,
          capacity: want.capacity,
          vacancies: want.capacity,
          status,
          utcCutoffAt: want.utcCutoffAt,
          priceOverride: want.priceOverride,
          source: want.source,
        });
        continue;
      }
      if (row.manuallyEdited) {
        skipped++;
        continue;
      }
      const booked = row.capacity - row.vacancies;
      const vacancies = Math.max(0, want.capacity - booked);
      const status = computeAvailabilityStatus({
        vacancies,
        capacity: want.capacity,
        utcCutoffAt: want.utcCutoffAt,
        now,
      });
      ops.push(
        this.prisma.departure.update({
          where: { id: row.id },
          data: {
            capacity: want.capacity,
            vacancies,
            localDateTimeEnd: want.localDateTimeEnd,
            utcCutoffAt: want.utcCutoffAt,
            priceOverride: want.priceOverride,
            status,
          },
        }),
      );
      updated++;
    }

    // Orphans: existing future slots no longer desired, with no bookings + not edited.
    const orphanIds = existing
      .filter(
        (e) =>
          !desired.has(`${e.optionId}|${e.localDateTimeStart.toISOString()}`) &&
          e.localDateTimeStart >= fromDate &&
          e.localDateTimeStart <= upperBound &&
          e.capacity === e.vacancies &&
          !e.manuallyEdited,
      )
      .map((e) => e.id);

    if (orphanIds.length) {
      ops.push(
        this.prisma.departure.deleteMany({ where: { id: { in: orphanIds } } }),
      );
    }
    if (creates.length) {
      ops.push(
        this.prisma.departure.createMany({ data: creates, skipDuplicates: true }),
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
