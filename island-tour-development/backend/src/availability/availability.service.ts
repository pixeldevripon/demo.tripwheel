import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityStatus,
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
import { dateKey, localNow } from '@/common/utils/timezone.util';
import {
  BOOKABLE_HORIZON_DAYS,
  computeAvailabilityStatus,
  isDepartureBookable,
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
    await this.assertOptionBelongs(dto.tourId, dto.optionId);
    const row = await this.prisma.availabilitySchedule.create({
      data: {
        tourId: dto.tourId,
        optionId: dto.optionId ?? null,
        weekdays: dto.weekdays,
        startTimes: dto.startTimes,
        capacity: dto.capacity,
        seasonStart: toDateOrNull(dto.seasonStart),
        seasonEnd: toDateOrNull(dto.seasonEnd),
        priceOverride: dto.priceOverride ?? null,
      },
    });
    this.logger.log(`Schedule ${row.id} created for tour ${dto.tourId}`);
    this.notifications.emitAvailabilityUpdate({
      tourId: dto.tourId,
      optionId: dto.optionId ?? null,
      operatorId,
    });
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
    if (dto.optionId !== undefined) {
      await this.assertOptionBelongs(existing.tourId, dto.optionId);
    }
    const row = await this.prisma.availabilitySchedule.update({
      where: { id },
      data: {
        ...(dto.optionId !== undefined && { optionId: dto.optionId ?? null }),
        ...(dto.weekdays && { weekdays: dto.weekdays }),
        ...(dto.startTimes && { startTimes: dto.startTimes }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.seasonStart !== undefined && {
          seasonStart: toDateOrNull(dto.seasonStart),
        }),
        ...(dto.seasonEnd !== undefined && {
          seasonEnd: toDateOrNull(dto.seasonEnd),
        }),
        ...(dto.priceOverride !== undefined && {
          priceOverride: dto.priceOverride ?? null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      optionId: row.optionId,
      operatorId,
    });
    return mapSchedule(row);
  }

  async deleteSchedule(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      select: { tourId: true, optionId: true },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    await this.prisma.availabilitySchedule.delete({ where: { id } });
    this.logger.log(`Schedule ${id} deleted`);
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      optionId: existing.optionId,
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
      orderBy: { createdAt: 'asc' },
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
    await this.assertOptionBelongs(dto.tourId, dto.optionId);
    const row = await this.prisma.availabilityException.create({
      data: {
        tourId: dto.tourId,
        optionId: dto.optionId ?? null,
        date: toDate(dto.date),
        type: dto.type,
        startTime: dto.startTime ?? null,
        capacity: dto.capacity ?? null,
        priceOverride: dto.priceOverride ?? null,
        note: dto.note ?? null,
      },
    });
    this.notifications.emitAvailabilityUpdate({
      tourId: dto.tourId,
      optionId: dto.optionId ?? null,
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
      select: { tourId: true, optionId: true, date: true },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    const row = await this.prisma.availabilityException.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime ?? null }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity ?? null }),
        ...(dto.priceOverride !== undefined && {
          priceOverride: dto.priceOverride ?? null,
        }),
        ...(dto.note !== undefined && { note: dto.note ?? null }),
      },
    });
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      optionId: existing.optionId,
      localDate: dateKey(existing.date),
      operatorId,
    });
    return mapException(row);
  }

  async deleteException(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilityException.findUnique({
      where: { id },
      select: { tourId: true, optionId: true, date: true },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    const operatorId = await this.assertTourAccess(existing.tourId, userId, role);
    await this.prisma.availabilityException.delete({ where: { id } });
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      optionId: existing.optionId,
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
      if (query.from) where.date.gte = toDate(query.from);
      if (query.to) where.date.lte = toDate(query.to);
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
    const result = await this.materializer.materializeTour(
      dto.tourId,
      dto.from,
      dto.to,
    );
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
    const tz = await this.tourTimeZone(query.tourId);
    const now = localNow(tz);

    const where: Prisma.DepartureWhereInput = { tourId: query.tourId };
    if (query.from || query.to) {
      where.localDateTimeStart = {};
      if (query.from) where.localDateTimeStart.gte = toDate(query.from);
      if (query.to) where.localDateTimeStart.lte = endOfDay(query.to);
    }
    if (query.status) where.status = query.status;

    const rows = await this.prisma.departure.findMany({
      where,
      orderBy: { localDateTimeStart: 'asc' },
    });
    return rows.map((r) => mapDeparture(r, now));
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

    const tz = await this.tourTimeZone(existing.tourId);
    const now = localNow(tz);

    let vacancies = existing.vacancies;
    if (dto.capacity !== undefined) {
      const booked = existing.capacity - existing.vacancies;
      vacancies = Math.max(0, dto.capacity - booked);
    }
    const capacity = dto.capacity ?? existing.capacity;
    const status =
      dto.status ??
      computeAvailabilityStatus({
        vacancies,
        capacity,
        utcCutoffAt: existing.utcCutoffAt,
        now,
      });

    const row = await this.prisma.departure.update({
      where: { id },
      data: {
        capacity,
        vacancies,
        status,
        ...(dto.priceOverride !== undefined && {
          priceOverride: dto.priceOverride ?? null,
        }),
        manuallyEdited: true, // protect from re-materialization
      },
    });
    this.logger.log(`Departure ${id} manually edited`);
    this.notifications.emitAvailabilityUpdate({
      tourId: existing.tourId,
      optionId: existing.optionId,
      localDate: dateKey(existing.localDateTimeStart),
      operatorId,
    });
    return mapDeparture(row, now);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public availability (real-time reads)
  // ════════════════════════════════════════════════════════════════════════

  async checkAvailability(dto: AvailabilityCheckDto): Promise<DepartureResponseDto[]> {
    const tz = await this.publicTourTimeZone(dto.tourId);
    if (dto.optionId) await this.assertOptionBelongs(dto.tourId, dto.optionId);
    const now = localNow(tz);
    const requiredSeats = (dto.units ?? []).reduce((s, u) => s + u.quantity, 0);

    const rows = await this.prisma.departure.findMany({
      where: {
        tourId: dto.tourId,
        ...(dto.optionId && { optionId: dto.optionId }),
        localDateTimeStart: {
          gte: toDate(dto.dateFrom),
          lte: endOfDay(dto.dateTo),
        },
      },
      orderBy: { localDateTimeStart: 'asc' },
    });

    return rows
      .map((r) => mapDeparture(r, now))
      .filter((d) => d.available && d.vacancies >= requiredSeats);
  }

  async calendar(dto: AvailabilityCalendarDto): Promise<CalendarDayResponseDto[]> {
    const tz = await this.publicTourTimeZone(dto.tourId);
    if (dto.optionId) await this.assertOptionBelongs(dto.tourId, dto.optionId);
    const now = localNow(tz);

    const rows = await this.prisma.departure.findMany({
      where: {
        tourId: dto.tourId,
        ...(dto.optionId && { optionId: dto.optionId }),
        localDateTimeStart: {
          gte: toDate(dto.dateFrom),
          lte: endOfDay(dto.dateTo),
        },
      },
      orderBy: { localDateTimeStart: 'asc' },
    });

    const byDay = new Map<string, DepartureResponseDto[]>();
    for (const r of rows) {
      const mapped = mapDeparture(r, now);
      const key = dateKey(r.localDateTimeStart);
      const list = byDay.get(key) ?? [];
      list.push(mapped);
      byDay.set(key, list);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => aggregateDay(date, slots));
  }

  /**
   * Whether the tour has ≥1 bookable departure within {@link BOOKABLE_HORIZON_DAYS}.
   * Feeds the nightly `isBookable` flag (ranking/search) — Phase 9.
   */
  async computeIsBookable(tourId: string): Promise<boolean> {
    const tz = await this.tourTimeZone(tourId).catch(() => null);
    if (!tz) return false;
    const now = localNow(tz);
    const horizon = new Date(now.getTime() + BOOKABLE_HORIZON_DAYS * MS_PER_DAY);
    const candidates = await this.prisma.departure.findMany({
      where: {
        tourId,
        status: {
          in: [
            AvailabilityStatus.AVAILABLE,
            AvailabilityStatus.LIMITED,
            AvailabilityStatus.FREESALE,
          ],
        },
        vacancies: { gt: 0 },
        localDateTimeStart: { gte: now, lte: horizon },
      },
      select: { vacancies: true, capacity: true, utcCutoffAt: true, status: true },
      take: 50,
    });
    return candidates.some((c) =>
      isDepartureBookable(
        computeAvailabilityStatus({
          vacancies: c.vacancies,
          capacity: c.capacity,
          utcCutoffAt: c.utcCutoffAt,
          now,
          manualStatus: stickyStatus(c.status),
        }),
      ),
    );
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

  private async assertOptionBelongs(
    tourId: string,
    optionId?: string | null,
  ): Promise<void> {
    if (!optionId) return;
    const option = await this.prisma.tourOption.findFirst({
      where: { id: optionId, tourId },
      select: { id: true },
    });
    if (!option) {
      throw new BadRequestException('optionId does not belong to this tour');
    }
  }

  private async tourTimeZone(tourId: string): Promise<string> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { timeZone: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour.timeZone;
  }

  private async publicTourTimeZone(tourId: string): Promise<string> {
    const tour = await this.prisma.tour.findFirst({
      where: { id: tourId, status: TourStatus.LIVE, isActive: true },
      select: { timeZone: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour.timeZone;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping helpers
// ════════════════════════════════════════════════════════════════════════════

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
function toDateOrNull(value?: string): Date | null {
  return value ? toDate(value) : null;
}
function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}
function dec(value: Prisma.Decimal | null): string | null {
  return value ? value.toString() : null;
}

/** CLOSED/FREESALE are sticky operator overrides; other stored values recompute. */
function stickyStatus(status: AvailabilityStatus): AvailabilityStatus | null {
  return status === AvailabilityStatus.CLOSED ||
    status === AvailabilityStatus.FREESALE
    ? status
    : null;
}

function mapSchedule(row: AvailabilitySchedule): ScheduleResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    weekdays: row.weekdays,
    startTimes: row.startTimes,
    capacity: row.capacity,
    seasonStart: row.seasonStart ? dateKey(row.seasonStart) : null,
    seasonEnd: row.seasonEnd ? dateKey(row.seasonEnd) : null,
    priceOverride: dec(row.priceOverride),
    isActive: row.isActive,
  };
}

function mapException(row: AvailabilityException): ExceptionResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    optionId: row.optionId,
    date: dateKey(row.date),
    type: row.type,
    startTime: row.startTime,
    capacity: row.capacity,
    priceOverride: dec(row.priceOverride),
    note: row.note,
  };
}

function mapDeparture(row: Departure, now: Date): DepartureResponseDto {
  const status = computeAvailabilityStatus({
    vacancies: row.vacancies,
    capacity: row.capacity,
    utcCutoffAt: row.utcCutoffAt,
    now,
    manualStatus: row.manuallyEdited ? stickyStatus(row.status) : null,
  });
  return {
    id: row.id,
    tourId: row.tourId,
    optionId: row.optionId,
    localDateTimeStart: row.localDateTimeStart.toISOString(),
    localDateTimeEnd: row.localDateTimeEnd
      ? row.localDateTimeEnd.toISOString()
      : null,
    allDay: row.allDay,
    capacity: row.capacity,
    vacancies: row.vacancies,
    status,
    available: isDepartureBookable(status) && row.vacancies > 0,
    utcCutoffAt: row.utcCutoffAt.toISOString(),
    priceOverride: dec(row.priceOverride),
    manuallyEdited: row.manuallyEdited,
  };
}

function aggregateDay(
  date: string,
  slots: DepartureResponseDto[],
): CalendarDayResponseDto {
  const vacancies = slots.reduce((s, d) => s + d.vacancies, 0);
  const capacity = slots.reduce((s, d) => s + d.capacity, 0);
  const hasAvailable = slots.some((d) => d.status === AvailabilityStatus.AVAILABLE);
  const hasFreesale = slots.some((d) => d.status === AvailabilityStatus.FREESALE);
  const hasLimited = slots.some((d) => d.status === AvailabilityStatus.LIMITED);
  const hasSoldOut = slots.some((d) => d.status === AvailabilityStatus.SOLD_OUT);

  let status: AvailabilityStatus;
  if (hasFreesale) status = AvailabilityStatus.FREESALE;
  else if (hasAvailable) status = AvailabilityStatus.AVAILABLE;
  else if (hasLimited) status = AvailabilityStatus.LIMITED;
  else if (hasSoldOut) status = AvailabilityStatus.SOLD_OUT;
  else status = AvailabilityStatus.CLOSED;

  return {
    date,
    available: slots.some((d) => d.available),
    status,
    vacancies,
    capacity,
    departureCount: slots.length,
  };
}
