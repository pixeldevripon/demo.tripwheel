import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
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
import { NotificationsService } from '@/notifications/notifications.service';
import {
  combineDateTime,
  dateKey,
  dayDate,
  hhmmToTime,
  localNow,
  timeOfDay,
} from '@/common/utils/timezone.util';
import {
  BOOKABLE_HORIZON_DAYS,
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
  MaterializeDto,
  ScheduleResponseDto,
  UpdateDepartureDto,
  UpdateExceptionDto,
  UpdateScheduleDto,
} from './dto/availability.dto';

const MS_PER_DAY = 86_400_000;

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
    const clock = await this.tourClock(dto.tourId);
    const row = await this.prisma.availabilitySchedule.create({
      data: {
        tourId: dto.tourId,
        weekday: dto.weekday,
        startTime: hhmmToTime(dto.startTime),
        capacityOverride: dto.capacityOverride ?? null,
        validFrom: dto.validFrom ? dayDate(dto.validFrom) : dayDate(dateKey(localNow(clock.timeZone))),
        validUntil: dto.validUntil ? dayDate(dto.validUntil) : null,
        ...(dto.status && { status: dto.status }),
      },
    });
    this.logger.log(`Schedule ${row.id} created for tour ${dto.tourId}`);
    this.notifications.emitAvailabilityUpdate({ tourId: dto.tourId, operatorId });
    return mapSchedule(row);
  }

  async updateSchedule(
    userId: string,
    role: Role,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const existing = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      select: { tourId: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    if (dto.startTime) await this.assertStartTimeInSlotSet(existing.tourId, dto.startTime);
    const row = await this.prisma.availabilitySchedule.update({
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
    this.notifications.emitAvailabilityUpdate({ tourId: existing.tourId, operatorId });
    return mapSchedule(row);
  }

  async deleteSchedule(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      select: { tourId: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    await this.prisma.availabilitySchedule.delete({ where: { id } });
    this.logger.log(`Schedule ${id} deleted`);
    this.notifications.emitAvailabilityUpdate({ tourId: existing.tourId, operatorId });
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
      select: { tourId: true, date: true },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
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
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    await this.prisma.availabilityException.delete({ where: { id } });
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
    const where: Prisma.AvailabilityExceptionWhereInput = { tourId: query.tourId };
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
  // Materialization (operator)
  // ════════════════════════════════════════════════════════════════════════

  async materialize(userId: string, role: Role, dto: MaterializeDto) {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    const result = await this.materializer.materializeTour(dto.tourId, dto.from, dto.to);
    this.notifications.emitAvailabilityUpdate({ tourId: dto.tourId, operatorId });
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
    return rows.map((r) => mapDeparture(r, now, clock.bookingCutoffMinutes, false));
  }

  async updateDeparture(
    userId: string,
    role: Role,
    id: string,
    dto: UpdateDepartureDto,
  ): Promise<DepartureResponseDto> {
    const existing = await this.prisma.departure.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Departure not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    const clock = await this.tourClock(existing.tourId);
    const now = localNow(clock.timeZone);

    const capacity = dto.capacity ?? existing.capacity;
    // A manual status wins; otherwise re-derive from the (preserved) booked count.
    const status = dto.status ?? storedStatusForFill(capacity, existing.bookedCount);
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

  async checkAvailability(dto: AvailabilityCheckDto): Promise<DepartureResponseDto[]> {
    const clock = await this.publicTourClock(dto.tourId);
    const now = localNow(clock.timeZone);
    const requiredSeats = (dto.units ?? []).reduce((s, u) => s + u.quantity, 0);

    const rows = await this.prisma.departure.findMany({
      where: { tourId: dto.tourId, date: { gte: dayDate(dto.dateFrom), lte: dayDate(dto.dateTo) } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return rows
      .map((r) => ({ row: r, dto: mapDeparture(r, now, clock.bookingCutoffMinutes, true) }))
      .filter(
        ({ row, dto: d }) =>
          d.available && row.capacity - row.bookedCount >= requiredSeats,
      )
      .map(({ dto: d }) => d);
  }

  async calendar(dto: AvailabilityCalendarDto): Promise<CalendarDayResponseDto[]> {
    const clock = await this.publicTourClock(dto.tourId);
    const now = localNow(clock.timeZone);

    const rows = await this.prisma.departure.findMany({
      where: { tourId: dto.tourId, date: { gte: dayDate(dto.dateFrom), lte: dayDate(dto.dateTo) } },
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
    const horizon = new Date(now.getTime() + BOOKABLE_HORIZON_DAYS * MS_PER_DAY);
    const candidates = await this.prisma.departure.findMany({
      where: {
        tourId,
        status: DepartureStatus.OPEN,
        date: { gte: dayDate(dateKey(now)), lte: dayDate(dateKey(horizon)) },
      },
      select: { date: true, startTime: true, capacity: true, bookedCount: true, status: true },
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
      throw new ForbiddenException('You do not have permission to manage this tour');
    }
    return tour.operatorId;
  }

  /** A schedule slot must be one of the tour's declared start times (master §2.1). */
  private async assertStartTimeInSlotSet(tourId: string, startTime: string): Promise<void> {
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
  const cutoffPassed = now.getTime() >= start.getTime() - cutoffMinutes * 60_000;
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
    remaining: publicView ? (discloseRemaining(remaining) ? remaining : null) : remaining,
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
