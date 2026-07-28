import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  DepartureStatus,
  Prisma,
  Role,
  TourStatus,
  type AvailabilityException,
  type AvailabilitySchedule,
  type Departure,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { NotificationsService } from '@/notifications/notifications.service';
import {
  combineDateTime,
  dateKey,
  dayDate,
  hhmmToTime,
  localNow,
  mondayZeroWeekday,
  timeOfDay,
} from '@/common/utils/timezone.util';
import {
  BOOKABLE_HORIZON_DAYS,
  cutoffReached,
  discloseRemaining,
  isDepartureBookable,
  liveDepartureStatus,
  storedStatusForFill,
} from './availability-status.util';
import { AvailabilityMaterializerService } from './availability-materializer.service';
import type {
  AvailabilityCalendarDto,
  AvailabilityCheckDto,
  CalendarDayResponseDto,
  CreateExceptionDto,
  CreateScheduleDto,
  DepartureResponseDto,
  ExceptionResponseDto,
  ListDeparturesQueryDto,
  ListExceptionsQueryDto,
  ManageCalendarDayDto,
  ManageCalendarDayStatus,
  ManageCalendarQueryDto,
  MaterializeDto,
  ScheduleResponseDto,
  UpdateDepartureDto,
  UpdateExceptionDto,
  UpdateScheduleDto,
} from './dto/availability.dto';

const MS_PER_DAY = 86_400_000;

// 0 = Monday … 6 = Sunday (matches AvailabilitySchedule.weekday). Used for
// human-readable conflict messages.
const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Tour fields needed to resolve local time + the live booking cutoff. */
interface TourClock {
  timeZone: string;
  bookingCutoffMinutes: number;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materializer: AvailabilityMaterializerService,
    private readonly notifications: NotificationsService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // Schedules (operator)
  // ════════════════════════════════════════════════════════════════════════

  async createSchedule(
    userId: string,
    role: Role,
    dto: CreateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    await this.assertStartTimeInSlotSet(dto.tourId, dto.startTime);
    await this.assertResolvableCapacity(dto.tourId, dto.capacityOverride);
    assertDateRangeOrder(
      dto.validFrom,
      dto.validUntil,
      'validFrom',
      'validUntil',
    );
    const clock = await this.tourClock(dto.tourId);
    let row;
    try {
      row = await this.prisma.availabilitySchedule.create({
        data: {
          tourId: dto.tourId,
          weekday: dto.weekday,
          startTime: hhmmToTime(dto.startTime),
          capacityOverride: dto.capacityOverride ?? null,
          validFrom: dto.validFrom
            ? dayDate(dto.validFrom)
            : dayDate(dateKey(localNow(clock.timeZone))),
          validUntil: dto.validUntil ? dayDate(dto.validUntil) : null,
          ...(dto.status && { status: dto.status }),
        },
      });
    } catch (err) {
      throw this.scheduleConflict(err, dto.weekday, dto.startTime);
    }
    this.logger.log(`Schedule ${row.id} created for tour ${dto.tourId}`);
    // Project the new rule into departures now (and refresh the listing gate) so
    // the tour becomes bookable immediately rather than waiting for the nightly
    // job (master: departures are the single truth; §7.2 bookability).
    await this.syncTourAvailability(dto.tourId);
    this.notifications.emitAvailabilityUpdate({
      tourId: dto.tourId,
      operatorId,
    });
    return mapSchedule(row);
  }

  /**
   * Maps a Prisma unique-constraint violation (duplicate weekday+startTime rule)
   * to a clear 409, and re-throws anything else unchanged.
   */
  private scheduleConflict(
    err: unknown,
    weekday: number,
    startTime: string,
  ): Error {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const day = WEEKDAY_NAMES[weekday];
      return new ConflictException(
        day && startTime
          ? `A schedule for ${day} at ${startTime} already exists for this tour.`
          : 'A schedule for that weekday and start time already exists for this tour.',
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  /**
   * Re-materialise the tour's near-term departures from its current
   * schedules/exceptions and refresh `isBookable`. Reconcile is additive and
   * protects booked / manually-edited / API departures, so it is safe to call on
   * every schedule mutation.
   *
   * `targetDate` (exception mutations): the default pass only projects the
   * ~90-day horizon, so an exception dated beyond it would be stored but
   * produce no visible departure until the nightly long-horizon job - the
   * operator's "Add departure" toast would lie. Reconciling the exception's
   * own day as well closes that gap; it is idempotent and single-day cheap,
   * so no horizon/timezone arithmetic is needed to decide whether to run it.
   */
  private async syncTourAvailability(
    tourId: string,
    targetDate?: string,
  ): Promise<void> {
    await this.materializer.materializeTour(tourId);
    if (targetDate) {
      await this.materializer.materializeTour(tourId, targetDate, targetDate);
    }
    await this.refreshIsBookable(tourId);
  }

  async updateSchedule(
    userId: string,
    role: Role,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const existing = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      select: {
        tourId: true,
        capacityOverride: true,
        validFrom: true,
        validUntil: true,
      },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    if (dto.startTime)
      await this.assertStartTimeInSlotSet(existing.tourId, dto.startTime);
    // Validate the merged validity window (a partial edit can invert it).
    assertDateRangeOrder(
      dto.validFrom ?? dateKey(existing.validFrom),
      dto.validUntil !== undefined
        ? (dto.validUntil ?? undefined)
        : existing.validUntil
          ? dateKey(existing.validUntil)
          : undefined,
      'validFrom',
      'validUntil',
    );
    // The effective override after this edit (unchanged fields keep their value).
    if (dto.capacityOverride !== undefined) {
      await this.assertResolvableCapacity(
        existing.tourId,
        dto.capacityOverride,
      );
    }
    let row;
    try {
      row = await this.prisma.availabilitySchedule.update({
        where: { id },
        data: {
          ...(dto.weekday !== undefined && { weekday: dto.weekday }),
          ...(dto.startTime && { startTime: hhmmToTime(dto.startTime) }),
          ...(dto.capacityOverride !== undefined && {
            capacityOverride: dto.capacityOverride ?? null,
          }),
          ...(dto.validFrom && { validFrom: dayDate(dto.validFrom) }),
          ...(dto.validUntil !== undefined && {
            validUntil: dto.validUntil ? dayDate(dto.validUntil) : null,
          }),
          ...(dto.status && { status: dto.status }),
        },
      });
    } catch (err) {
      throw this.scheduleConflict(err, row?.weekday ?? -1, dto.startTime ?? '');
    }
    // Status/time/validity changes alter which departures should exist.
    await this.syncTourAvailability(existing.tourId);
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      operatorId,
    });
    return mapSchedule(row);
  }

  async deleteSchedule(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      select: { tourId: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    await this.prisma.availabilitySchedule.delete({ where: { id } });
    this.logger.log(`Schedule ${id} deleted`);
    // Removing a rule should retire its future (unbooked) departures and refresh
    // the listing gate.
    await this.syncTourAvailability(existing.tourId);
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      operatorId,
    });
  }

  async listSchedules(
    userId: string,
    role: Role,
    tourId: string,
  ): Promise<ScheduleResponseDto[]> {
    await this.assertTourAccess(tourId, userId, role);
    const rows = await this.prisma.availabilitySchedule.findMany({
      where: { tourId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map(mapSchedule);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Exceptions (operator)
  // ════════════════════════════════════════════════════════════════════════

  async createException(
    userId: string,
    role: Role,
    dto: CreateExceptionDto,
  ): Promise<ExceptionResponseDto> {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    this.assertExceptionShape(dto.type, dto.startTime, dto.capacity);
    if (dto.type === AvailabilityExceptionType.ADD_SLOT)
      await this.assertResolvableCapacity(dto.tourId, dto.capacity);
    const row = await this.prisma.availabilityException.create({
      data: {
        tourId: dto.tourId,
        date: dayDate(dto.date),
        startTime: dto.startTime ? hhmmToTime(dto.startTime) : null,
        type: dto.type,
        capacity: dto.capacity ?? null,
        note: dto.note ?? null,
        createdBy: userId,
      },
    });
    // An exception (close date/slot, add slot, set capacity) changes sellable
    // inventory, so re-project departures + refresh the listing gate now instead
    // of waiting for the nightly job. Otherwise a closed date keeps selling.
    // The date is passed so beyond-horizon exceptions materialize immediately.
    await this.syncTourAvailability(dto.tourId, dto.date);
    this.notifications.emitAvailabilityUpdate({
      tourId: dto.tourId,
      localDate: dto.date,
      operatorId,
    });
    return mapException(row);
  }

  async updateException(
    userId: string,
    role: Role,
    id: string,
    dto: UpdateExceptionDto,
  ): Promise<ExceptionResponseDto> {
    const existing = await this.prisma.availabilityException.findUnique({
      where: { id },
      select: {
        tourId: true,
        date: true,
        type: true,
        startTime: true,
        capacity: true,
      },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    // Validate the merged exception shape (a partial edit can leave it invalid).
    const effectiveType = dto.type ?? existing.type;
    const effectiveStartTime =
      dto.startTime !== undefined
        ? dto.startTime
        : existing.startTime
          ? timeOfDay(existing.startTime)
          : undefined;
    const effectiveCapacity =
      dto.capacity !== undefined ? dto.capacity : existing.capacity;
    this.assertExceptionShape(
      effectiveType,
      effectiveStartTime,
      effectiveCapacity,
    );
    if (effectiveType === AvailabilityExceptionType.ADD_SLOT)
      await this.assertResolvableCapacity(existing.tourId, effectiveCapacity);
    const row = await this.prisma.availabilityException.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.startTime !== undefined && {
          startTime: dto.startTime ? hhmmToTime(dto.startTime) : null,
        }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity ?? null }),
        ...(dto.note !== undefined && { note: dto.note ?? null }),
      },
    });
    // Re-project departures + refresh the listing gate so the edited exception
    // takes effect on sellable inventory immediately.
    await this.syncTourAvailability(existing.tourId, dateKey(existing.date));
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      localDate: dateKey(existing.date),
      operatorId,
    });
    return mapException(row);
  }

  async deleteException(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilityException.findUnique({
      where: { id },
      select: { tourId: true, date: true },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    await this.prisma.availabilityException.delete({ where: { id } });
    // Removing an exception restores the underlying schedule's departures for
    // that date, so re-project + refresh the listing gate now.
    await this.syncTourAvailability(existing.tourId, dateKey(existing.date));
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      localDate: dateKey(existing.date),
      operatorId,
    });
  }

  async listExceptions(
    userId: string,
    role: Role,
    query: ListExceptionsQueryDto,
  ): Promise<ExceptionResponseDto[]> {
    await this.assertTourAccess(query.tourId, userId, role);
    assertDateRangeOrder(query.from, query.to);
    const where: Prisma.AvailabilityExceptionWhereInput = {
      tourId: query.tourId,
    };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = dayDate(query.from);
      if (query.to) where.date.lte = dayDate(query.to);
    }
    const rows = await this.prisma.availabilityException.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return rows.map(mapException);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Management calendar (operator)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Month grid for the operator's one-tap availability calendar: every day of
   * the requested month with its derived state, full departures (booked counts
   * always disclosed - this is the management view), the day's exceptions, and
   * whether the weekly pattern covers the date. Read-only composition of data
   * the module already owns - closing a day from the grid is the ordinary
   * CLOSE_DATE exception write.
   */
  async manageCalendar(
    userId: string,
    role: Role,
    query: ManageCalendarQueryDto,
  ): Promise<ManageCalendarDayDto[]> {
    await this.assertTourAccess(query.tourId, userId, role);
    const clock = await this.tourClock(query.tourId);
    const now = localNow(clock.timeZone);

    const [yearStr, monthStr] = query.month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1; // 0-based
    const daysInMonth = new Date(
      Date.UTC(year, monthIndex + 1, 0),
    ).getUTCDate();
    const monthStart = dayDate(`${query.month}-01`);
    const monthEnd = dayDate(
      `${query.month}-${String(daysInMonth).padStart(2, '0')}`,
    );

    const [departures, exceptions, schedules] = await Promise.all([
      this.prisma.departure.findMany({
        where: {
          tourId: query.tourId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tourId: query.tourId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.availabilitySchedule.findMany({
        where: {
          tourId: query.tourId,
          status: AvailabilityScheduleStatus.ACTIVE,
          validFrom: { lte: monthEnd },
          OR: [{ validUntil: null }, { validUntil: { gte: monthStart } }],
        },
        select: {
          weekday: true,
          startTime: true,
          validFrom: true,
          validUntil: true,
        },
      }),
    ]);

    const departuresByDay = new Map<string, DepartureResponseDto[]>();
    for (const row of departures) {
      const key = dateKey(row.date);
      const list = departuresByDay.get(key) ?? [];
      // publicView=false: the operator always sees exact remaining seats.
      list.push(mapDeparture(row, now, clock.bookingCutoffMinutes, false));
      departuresByDay.set(key, list);
    }
    const exceptionsByDay = new Map<string, ExceptionResponseDto[]>();
    for (const row of exceptions) {
      const key = dateKey(row.date);
      const list = exceptionsByDay.get(key) ?? [];
      list.push(mapException(row));
      exceptionsByDay.set(key, list);
    }

    const days: ManageCalendarDayDto[] = [];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const key = `${query.month}-${String(dayNum).padStart(2, '0')}`;
      const day = dayDate(key);
      const weekday = mondayZeroWeekday(day); // Monday = 0 (master convention)

      const dayDepartures = departuresByDay.get(key) ?? [];
      const dayExceptions = exceptionsByDay.get(key) ?? [];
      // The times the weekly pattern produces on this date - surfaced even
      // before materialization so a beyond-horizon day never LOOKS empty
      // when departures will in fact run (they'd pop in on the nightly job).
      const scheduledTimes = [
        ...new Set(
          schedules
            .filter(
              (s) =>
                s.weekday === weekday &&
                s.validFrom.getTime() <= day.getTime() &&
                (!s.validUntil || s.validUntil.getTime() >= day.getTime()),
            )
            .map((s) => timeOfDay(s.startTime)),
        ),
      ].sort();

      days.push({
        date: key,
        status: manageDayStatus(dayDepartures, dayExceptions),
        scheduled: scheduledTimes.length > 0,
        scheduledTimes,
        bookedTotal: dayDepartures.reduce((sum, d) => sum + d.bookedCount, 0),
        departures: dayDepartures,
        exceptions: dayExceptions,
      });
    }
    return days;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Materialization (operator)
  // ════════════════════════════════════════════════════════════════════════

  async materialize(userId: string, role: Role, dto: MaterializeDto) {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    const result = await this.materializer.materializeTour(
      dto.tourId,
      dto.from,
      dto.to,
    );
    // Departures changed - the listing gate depends on isBookable, so refresh it.
    await this.refreshIsBookable(dto.tourId);
    this.notifications.emitAvailabilityUpdate({
      tourId: dto.tourId,
      operatorId,
    });
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Departures (operator)
  // ════════════════════════════════════════════════════════════════════════

  async listDepartures(
    userId: string,
    role: Role,
    query: ListDeparturesQueryDto,
  ): Promise<DepartureResponseDto[]> {
    await this.assertTourAccess(query.tourId, userId, role);
    assertDateRangeOrder(query.from, query.to);
    const clock = await this.tourClock(query.tourId);
    const now = localNow(clock.timeZone);

    const where: Prisma.DepartureWhereInput = { tourId: query.tourId };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = dayDate(query.from);
      if (query.to) where.date.lte = dayDate(query.to);
    }
    if (query.status) where.status = query.status;

    const rows = await this.prisma.departure.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    // Operator view: surface the true remaining seats (not the public <5 disclosure).
    return rows.map((r) =>
      mapDeparture(r, now, clock.bookingCutoffMinutes, false),
    );
  }

  async updateDeparture(
    userId: string,
    role: Role,
    id: string,
    dto: UpdateDepartureDto,
  ): Promise<DepartureResponseDto> {
    const existing = await this.prisma.departure.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Departure not found');
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    const clock = await this.tourClock(existing.tourId);
    const now = localNow(clock.timeZone);

    const capacity = dto.capacity ?? existing.capacity;
    // A manual status wins; otherwise re-derive from the (preserved) booked count.
    const status =
      dto.status ?? storedStatusForFill(capacity, existing.bookedCount);
    const soldOut = status === DepartureStatus.SOLD_OUT;

    const row = await this.prisma.departure.update({
      where: { id },
      data: {
        capacity,
        status,
        ...(soldOut && existing.soldOutAt == null && { soldOutAt: new Date() }),
        manuallyEdited: true, // protect from re-materialization (master §3)
      },
    });
    this.logger.log(`Departure ${id} manually edited`);
    // A cancel / sold-out / reopen can flip the tour's bookability - refresh the flag.
    await this.refreshIsBookable(existing.tourId);
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      localDate: dateKey(existing.date),
      operatorId,
    });
    return mapDeparture(row, now, clock.bookingCutoffMinutes, false);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public availability (real-time reads)
  // ════════════════════════════════════════════════════════════════════════

  async checkAvailability(
    dto: AvailabilityCheckDto,
  ): Promise<DepartureResponseDto[]> {
    assertDateRangeOrder(dto.dateFrom, dto.dateTo, 'dateFrom', 'dateTo');
    const clock = await this.publicTourClock(dto.tourId);
    const now = localNow(clock.timeZone);
    const requiredSeats = (dto.units ?? []).reduce((s, u) => s + u.quantity, 0);

    const rows = await this.prisma.departure.findMany({
      where: {
        tourId: dto.tourId,
        date: { gte: dayDate(dto.dateFrom), lte: dayDate(dto.dateTo) },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return rows
      .map((r) => ({
        row: r,
        dto: mapDeparture(r, now, clock.bookingCutoffMinutes, true),
      }))
      .filter(
        ({ row, dto: d }) =>
          d.available && row.capacity - row.bookedCount >= requiredSeats,
      )
      .map(({ dto: d }) => d);
  }

  async calendar(
    dto: AvailabilityCalendarDto,
  ): Promise<CalendarDayResponseDto[]> {
    assertDateRangeOrder(dto.dateFrom, dto.dateTo, 'dateFrom', 'dateTo');
    const clock = await this.publicTourClock(dto.tourId);
    const now = localNow(clock.timeZone);

    const rows = await this.prisma.departure.findMany({
      where: {
        tourId: dto.tourId,
        date: { gte: dayDate(dto.dateFrom), lte: dayDate(dto.dateTo) },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const byDay = new Map<string, DepartureResponseDto[]>();
    for (const r of rows) {
      const mapped = mapDeparture(r, now, clock.bookingCutoffMinutes, true);
      const key = dateKey(r.date);
      const list = byDay.get(key) ?? [];
      list.push(mapped);
      byDay.set(key, list);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => aggregateDay(date, slots));
  }

  /**
   * Whether the tour has >=1 OPEN, non-cutoff departure within {@link BOOKABLE_HORIZON_DAYS}
   * (master §6). Feeds the nightly `isBookable` flag (ranking/search) - Phase 9.
   */
  async computeIsBookable(tourId: string): Promise<boolean> {
    const clock = await this.tourClock(tourId).catch(() => null);
    if (!clock) return false;
    const now = localNow(clock.timeZone);
    const horizon = new Date(
      now.getTime() + BOOKABLE_HORIZON_DAYS * MS_PER_DAY,
    );
    const candidates = await this.prisma.departure.findMany({
      where: {
        tourId,
        status: DepartureStatus.OPEN,
        date: { gte: dayDate(dateKey(now)), lte: dayDate(dateKey(horizon)) },
      },
      select: {
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
        status: true,
      },
      take: 100,
    });
    return candidates.some((c) => {
      const start = combineDateTime(c.date, c.startTime);
      const cutoffPassed =
        now.getTime() >= start.getTime() - clock.bookingCutoffMinutes * 60_000;
      const live = liveDepartureStatus({
        status: c.status,
        capacity: c.capacity,
        bookedCount: c.bookedCount,
        cutoffPassed,
      });
      return isDepartureBookable(live);
    });
  }

  /**
   * Recomputes {@link computeIsBookable} and persists it to `tour.isBookable`.
   * The public listing (`ToursService.findAll`) gates on this flag, so it must be
   * refreshed whenever the tour's departures change (materialize / departure edit)
   * and when it is published. Returns the new value.
   */
  async refreshIsBookable(tourId: string): Promise<boolean> {
    const bookable = await this.computeIsBookable(tourId);
    await this.prisma.tour.update({
      where: { id: tourId },
      data: { isBookable: bookable },
    });
    return bookable;
  }

  /**
   * Nightly recompute of `isBookable` across every LIVE tour (master §6/§7.2:
   * "exclude tours with no availability in the next 30 days"). Idempotent; safe to
   * run on demand. Returns how many were evaluated and how many are now bookable.
   */
  async recomputeAllBookable(): Promise<{
    evaluated: number;
    bookable: number;
  }> {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.LIVE, isActive: true },
      select: { id: true },
    });
    let bookable = 0;
    for (const t of tours) {
      if (await this.refreshIsBookable(t.id)) bookable++;
    }
    this.logger.log(
      `isBookable recompute: evaluated=${tours.length} bookable=${bookable}`,
    );
    return { evaluated: tours.length, bookable };
  }

  /**
   * Nightly materialisation of a rolling 12-month window for every LIVE tour
   * (master: "a nightly job materializes 12 rolling months"). Reconcile protects
   * booked / manually-edited / API departures. Run before {@link recomputeAllBookable}
   * so the flag reflects freshly-projected departures. Failures per tour are logged
   * and skipped so one bad tour never aborts the batch.
   */
  async materializeAllLive(): Promise<{ evaluated: number; failed: number }> {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.LIVE, isActive: true },
      select: { id: true },
    });
    // 12 rolling months (kept just under the materialiser's 365-day cap).
    const to = dateKey(new Date(Date.now() + 364 * MS_PER_DAY));
    let failed = 0;
    for (const t of tours) {
      try {
        await this.materializer.materializeTour(t.id, undefined, to);
      } catch (err) {
        failed++;
        this.logger.warn(
          `materializeAllLive: tour ${t.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log(
      `materializeAllLive: evaluated=${tours.length} failed=${failed}`,
    );
    return { evaluated: tours.length, failed };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Asserts the actor may manage the tour and returns the tour's owning operatorId. */
  private async assertTourAccess(
    tourId: string,
    userId: string,
    role: Role,
  ): Promise<string> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { operatorId: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    if (role === Role.ADMIN) return tour.operatorId;
    const operatorId = await resolveOperatorId(this.prisma, userId, role);
    if (tour.operatorId !== operatorId) {
      throw new ForbiddenException(
        'You do not have permission to manage this tour',
      );
    }
    return tour.operatorId;
  }

  /** A schedule slot must be one of the tour's declared start times (master §2.1). */
  private async assertStartTimeInSlotSet(
    tourId: string,
    startTime: string,
  ): Promise<void> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { startTimes: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.startTimes?.length && !tour.startTimes.includes(startTime)) {
      throw new BadRequestException(
        `startTime ${startTime} is not in the tour's startTimes slot set`,
      );
    }
  }

  /**
   * A schedule only materialises into departures if a capacity can be resolved:
   * its own `capacityOverride`, else the tour's `maxPartySize` default. When both
   * are absent the materialiser silently skips every slot and the tour never lists
   * - so reject the write up-front and tell the operator exactly how to fix it
   * (master §3: capacity is per-departure, defaulting from the tour).
   */
  private async assertResolvableCapacity(
    tourId: string,
    capacityOverride: number | null | undefined,
  ): Promise<void> {
    if (capacityOverride != null) return; // its own capacity always resolves
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { maxPartySize: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.maxPartySize == null) {
      throw new BadRequestException(
        "This schedule has no capacity to sell. Set a capacity override for it, or set the tour's Max Party Size on the Details tab (used as the default capacity). Without one, no bookable departures are created and the tour will not list.",
      );
    }
  }

  /**
   * Rejects an exception whose required fields for its type are missing, so the
   * materializer never silently skips it (gap #12). `close_date` needs only the
   * date; `close_slot`/`add_slot` need a `startTime`; `set_capacity` needs a
   * `capacity`. `add_slot` capacity resolvability is checked separately via
   * {@link assertResolvableCapacity}.
   */
  private assertExceptionShape(
    type: AvailabilityExceptionType,
    startTime: string | undefined,
    capacity: number | null | undefined,
  ): void {
    switch (type) {
      case AvailabilityExceptionType.CLOSE_SLOT:
        if (!startTime)
          throw new BadRequestException('close_slot requires a startTime');
        break;
      case AvailabilityExceptionType.ADD_SLOT:
        if (!startTime)
          throw new BadRequestException('add_slot requires a startTime');
        break;
      case AvailabilityExceptionType.SET_CAPACITY:
        if (capacity == null)
          throw new BadRequestException('set_capacity requires a capacity');
        break;
      case AvailabilityExceptionType.CLOSE_DATE:
        break;
    }
  }

  /**
   * Public re-projection hook for callers outside the availability module (e.g.
   * {@link ToursService} when a tour's `maxPartySize` - the schedules' default
   * capacity - changes). Re-materialises the near-term window and refreshes the
   * `isBookable` listing gate so previously-uncapacitated schedules become
   * bookable (or stop being) immediately, without waiting for the nightly job.
   */
  async resyncTourAvailability(tourId: string): Promise<void> {
    await this.syncTourAvailability(tourId);
  }

  private async tourClock(tourId: string): Promise<TourClock> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { timeZone: true, bookingCutoffMinutes: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour;
  }

  private async publicTourClock(tourId: string): Promise<TourClock> {
    const tour = await this.prisma.tour.findFirst({
      where: { id: tourId, status: TourStatus.LIVE, isActive: true },
      select: { timeZone: true, bookingCutoffMinutes: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping helpers
// ════════════════════════════════════════════════════════════════════════════

function mapSchedule(row: AvailabilitySchedule): ScheduleResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    weekday: row.weekday,
    startTime: timeOfDay(row.startTime),
    capacityOverride: row.capacityOverride,
    validFrom: dateKey(row.validFrom),
    validUntil: row.validUntil ? dateKey(row.validUntil) : null,
    status: row.status,
  };
}

function mapException(row: AvailabilityException): ExceptionResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    date: dateKey(row.date),
    startTime: row.startTime ? timeOfDay(row.startTime) : null,
    type: row.type,
    capacity: row.capacity,
    note: row.note,
  };
}

function mapDeparture(
  row: Departure,
  now: Date,
  cutoffMinutes: number,
  publicView: boolean,
): DepartureResponseDto {
  const start = combineDateTime(row.date, row.startTime);
  const cutoffPassed = cutoffReached(
    start.getTime(),
    now.getTime(),
    cutoffMinutes,
  );
  const remaining = Math.max(0, row.capacity - row.bookedCount);
  const status = liveDepartureStatus({
    status: row.status,
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    cutoffPassed,
  });
  return {
    id: row.id,
    tourId: row.tourId,
    date: dateKey(row.date),
    startTime: timeOfDay(row.startTime),
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    // Public read contract (§4): only surface remaining when under the threshold.
    remaining: publicView
      ? discloseRemaining(remaining)
        ? remaining
        : null
      : remaining,
    status,
    available: isDepartureBookable(status),
    soldOutAt: row.soldOutAt ? row.soldOutAt.toISOString() : null,
    manuallyEdited: row.manuallyEdited,
  };
}

function aggregateDay(
  date: string,
  slots: DepartureResponseDto[],
): CalendarDayResponseDto {
  const hasOpen = slots.some((d) => d.status === DepartureStatus.OPEN);
  const hasSoldOut = slots.some((d) => d.status === DepartureStatus.SOLD_OUT);

  let status: DepartureStatus;
  if (hasOpen) status = DepartureStatus.OPEN;
  else if (hasSoldOut) status = DepartureStatus.SOLD_OUT;
  else status = DepartureStatus.CLOSED;

  // Best disclosed remaining across open slots (already nulled when >=5).
  const disclosed = slots
    .filter((d) => d.available && d.remaining != null)
    .map((d) => d.remaining as number);

  return {
    date,
    available: slots.some((d) => d.available),
    status,
    remaining: disclosed.length ? Math.max(...disclosed) : null,
    departureCount: slots.length,
  };
}

/**
 * Day state for the operator month grid. SOLD_OUT is still "in service" - only
 * CLOSED/CANCELLED departures count as stopped. A whole-day CLOSE_DATE wins
 * outright (it may land before the materializer has synced the rows).
 */
function manageDayStatus(
  departures: DepartureResponseDto[],
  exceptions: ExceptionResponseDto[],
): ManageCalendarDayStatus {
  if (exceptions.some((e) => e.type === AvailabilityExceptionType.CLOSE_DATE)) {
    return 'closed';
  }
  if (departures.length === 0) return 'no_service';
  const stopped = departures.filter(
    (d) =>
      d.status === DepartureStatus.CLOSED ||
      d.status === DepartureStatus.CANCELLED,
  ).length;
  if (stopped === departures.length) return 'closed';
  const hasSlotException = exceptions.some(
    (e) =>
      e.type === AvailabilityExceptionType.CLOSE_SLOT ||
      e.type === AvailabilityExceptionType.SET_CAPACITY,
  );
  if (stopped > 0 || hasSlotException) return 'partial';
  return 'open';
}
