import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityExceptionSource,
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  DepartureStatus,
  InboxEvent,
  Permission,
  Prisma,
  Role,
  StaffStatus,
  TourStatus,
  type AvailabilityException,
  type AvailabilitySchedule,
  type Departure,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { InboxService } from '@/inbox/inbox.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
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
  AgendaDayDto,
  AgendaDepartureDto,
  AgendaQueryDto,
  AgendaResponseDto,
  AvailabilityCalendarDto,
  AvailabilityCheckDto,
  AvailabilitySummaryDto,
  CalendarDayResponseDto,
  CloseAgendaDayDto,
  CloseAgendaDayResultDto,
  CloseRangeDto,
  ConfirmAvailabilityDto,
  ReopenRangeDto,
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
  AvailabilityOverviewResponseDto,
  OverviewDayDto,
  OverviewDepartureDto,
  OverviewQueryDto,
  ScheduleResponseDto,
  UpdateDepartureDto,
  UpdateExceptionDto,
  UpdateScheduleDto,
} from './dto/availability.dto';

const MS_PER_DAY = 86_400_000;

// Fallback clock for responses with no tour to borrow a timezone from.
// Every launch island (Curaçao, Aruba, Sint Maarten) runs UTC-4.
const PLATFORM_HOME_TIMEZONE = 'America/Curacao';

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
    private readonly inbox: InboxService,
    // The stop-sell split (matrix v1.7): exception writes are route-guarded by
    // MANAGE_AVAILABILITY OR STOP_SELL, but only the close types belong to the
    // narrow grant - the service re-checks before an ADD_SLOT / SET_CAPACITY.
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  /**
   * A STOP_SELL-only seat may close and reopen - never add departures or move
   * capacity (matrix v1.7: "money-adjacent actions stay owner/manager"). The
   * route guard cannot see the dto type, so the type-conditional half of the
   * split is enforced here.
   */
  private async assertCanShapeInventory(
    userId: string,
    role: Role,
  ): Promise<void> {
    const { granted } = await this.staffPermissions.hasPermissions(
      { id: userId, role },
      [Permission.MANAGE_AVAILABILITY],
    );
    if (!granted) {
      throw new ForbiddenException(
        'Adding departures or changing capacity needs the Manage availability permission; your seat can close and reopen only',
      );
    }
  }

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
    this.assertResolvableCapacity();
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
      this.assertResolvableCapacity();
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
    if (
      dto.type === AvailabilityExceptionType.ADD_SLOT ||
      dto.type === AvailabilityExceptionType.SET_CAPACITY
    ) {
      await this.assertCanShapeInventory(userId, role);
    }
    if (dto.type === AvailabilityExceptionType.ADD_SLOT)
      this.assertResolvableCapacity();
    if (
      dto.type === AvailabilityExceptionType.SET_CAPACITY &&
      dto.capacity != null
    ) {
      await this.assertCapacityAboveBooked(
        dto.tourId,
        dto.date,
        dto.startTime,
        dto.capacity,
      );
    }
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
    return mapException(row, await this.exceptionActorNames([row]));
  }

  /**
   * Refuse to hand-edit a row a connected calendar owns.
   *
   * These two endpoints predate the iCal import and are the OTHER way onto
   * `availability_exceptions`, so without this they quietly defeat the import's
   * central rule - *only a successful parse may remove a block*. Deleting an
   * `ICAL` row here writes no `IcalSyncLog` entry, so the audit trail the
   * feature exists to provide shows nothing happened; worse, the reconciler
   * diffs against `source = ICAL` rows, so the next poll finds the row missing,
   * the feed still listing the event, and **recreates it**. The operator sees a
   * date reopen and then silently re-close minutes later.
   *
   * Releasing an imported block is a sync operation: change the import mode, or
   * disconnect the subscription (which converts its blocks to `MANUAL`, at which
   * point these endpoints own them again and this guard stops applying).
   */
  private assertNotChannelOwned(source: AvailabilityExceptionSource): void {
    if (source === AvailabilityExceptionSource.ICAL) {
      throw new ConflictException(
        'This date was closed by a connected calendar. Change it from the calendar sync panel, or disconnect the calendar first.',
      );
    }
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
        source: true,
      },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    this.assertNotChannelOwned(existing.source);
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
      this.assertResolvableCapacity();
    if (
      effectiveType === AvailabilityExceptionType.SET_CAPACITY &&
      effectiveCapacity != null
    ) {
      await this.assertCapacityAboveBooked(
        existing.tourId,
        dateKey(existing.date),
        effectiveStartTime,
        effectiveCapacity,
      );
    }
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
    return mapException(row, await this.exceptionActorNames([row]));
  }

  async deleteException(userId: string, role: Role, id: string): Promise<void> {
    const existing = await this.prisma.availabilityException.findUnique({
      where: { id },
      select: { tourId: true, date: true, type: true, source: true },
    });
    if (!existing) throw new NotFoundException('Exception not found');
    this.assertNotChannelOwned(existing.source);
    const operatorId = await this.assertTourAccess(
      existing.tourId,
      userId,
      role,
    );
    // The stop-sell split cuts both ways: deleting an ADD_SLOT or SET_CAPACITY
    // row SHAPES inventory (it removes a departure / reverts a capacity
    // decision), so the narrow seat may only undo the close types.
    if (
      existing.type === AvailabilityExceptionType.ADD_SLOT ||
      existing.type === AvailabilityExceptionType.SET_CAPACITY
    ) {
      await this.assertCanShapeInventory(userId, role);
    }
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

  /**
   * Resolve `createdBy` user ids to display names in one query, so every
   * exception row can say "Closed by Maria · Jul 28, 14:02" instead of a UUID.
   * The exception table has no FK to users (createdBy survives account
   * deletion as a plain string), hence the manual join.
   */
  private async exceptionActorNames(
    rows: Pick<AvailabilityException, 'createdBy'>[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(rows.map((r) => r.createdBy).filter((v): v is string => !!v)),
    ];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Daily agenda (Surface B - one operator, ALL tours, review §3.3)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * The caller's operator WITHOUT auto-provisioning. `resolveOperatorId`
   * mints an Operator row for admins on first touch (the right behaviour for
   * tour CREATION, rule 19) - but on the agenda's cross-tour READS that meant
   * a phantom tour-less operator per admin and a silently empty surface.
   * Null = "this account runs no operator", which the callers render honestly.
   */
  private async operatorContext(userId: string): Promise<string | null> {
    const operator = await this.prisma.operator.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (operator) return operator.id;
    const seat = await this.prisma.staffMember.findUnique({
      where: { userId },
      select: { operatorId: true, status: true },
    });
    return seat?.operatorId && seat.status !== StaffStatus.SUSPENDED
      ? seat.operatorId
      : null;
  }

  /**
   * Departures + their stopping closures for a tour set over [fromDate,
   * toDate] - the shared read behind agenda() and overview(). A departure's
   * closure resolves slot-first (its own CLOSE_SLOT row beats the day-wide
   * CLOSE_DATE). Nothing prevents two racing staff writing duplicate closure
   * rows (no unique constraint on tour/date/time/type), so rows load
   * oldest-first and the FIRST wins - every surface deterministically
   * reports the same closure for the same departure.
   */
  private async departuresWithClosures(
    tourIds: string[],
    fromDate: Date,
    toDate: Date,
  ) {
    const [departures, closures] = await Promise.all([
      this.prisma.departure.findMany({
        where: {
          tourId: { in: tourIds },
          date: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          tourId: true,
          date: true,
          startTime: true,
          capacity: true,
          bookedCount: true,
          status: true,
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tourId: { in: tourIds },
          date: { gte: fromDate, lte: toDate },
          type: {
            in: [
              AvailabilityExceptionType.CLOSE_DATE,
              AvailabilityExceptionType.CLOSE_SLOT,
            ],
          },
        },
        select: {
          id: true,
          tourId: true,
          date: true,
          startTime: true,
          type: true,
          note: true,
          createdBy: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const actorNames = await this.exceptionActorNames(closures);
    type ClosureRow = (typeof closures)[number];
    const slotClosures = new Map<string, ClosureRow>();
    const dayClosures = new Map<string, ClosureRow>();
    for (const c of closures) {
      const date = dateKey(c.date);
      if (
        c.type === AvailabilityExceptionType.CLOSE_SLOT &&
        c.startTime !== null
      ) {
        const key = `${c.tourId}|${date}|${timeOfDay(c.startTime)}`;
        if (!slotClosures.has(key)) slotClosures.set(key, c);
      } else if (c.type === AvailabilityExceptionType.CLOSE_DATE) {
        const key = `${c.tourId}|${date}`;
        if (!dayClosures.has(key)) dayClosures.set(key, c);
      }
    }
    const closureFor = (tourId: string, date: string, startTime: string) => {
      const row =
        slotClosures.get(`${tourId}|${date}|${startTime}`) ??
        dayClosures.get(`${tourId}|${date}`);
      return row
        ? {
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            createdByName: row.createdBy
              ? (actorNames.get(row.createdBy) ?? null)
              : null,
            note: row.note,
          }
        : null;
    };
    return { departures, closureFor };
  }

  /** The STALEST availability_confirmed_at - the freshness card reports the
   *  weakest link, not the average. Null when any tour was never confirmed. */
  private stalestConfirm(
    tours: { availabilityConfirmedAt: Date | null }[],
  ): string | null {
    const stamps = tours.map((t) => t.availabilityConfirmedAt);
    return stamps.some((s) => s == null)
      ? null
      : new Date(
          Math.min(...stamps.map((s) => (s as Date).getTime())),
        ).toISOString();
  }

  /**
   * The cross-tour daily agenda: every departure across the operator's tours
   * in one chronological list, so a three-tour operator never opens three
   * tour editors to run one stormy morning. Read-only composition - closing a
   * row is the ordinary CLOSE_SLOT/CLOSE_DATE exception write.
   */
  async agenda(
    userId: string,
    role: Role,
    query: AgendaQueryDto,
  ): Promise<AgendaResponseDto> {
    const operatorId = await this.operatorContext(userId);
    if (!operatorId) return { days: [], tours: [], lastConfirmedAt: null };
    const tours = await this.prisma.tour.findMany({
      where: { operatorId, isActive: true },
      select: {
        id: true,
        name: true,
        timeZone: true,
        bookingCutoffMinutes: true,
        pricingModel: true,
        availabilityConfirmedAt: true,
      },
      orderBy: { name: 'asc' },
    });
    if (tours.length === 0) {
      return { days: [], tours: [], lastConfirmedAt: null };
    }
    const tourById = new Map(tours.map((t) => [t.id, t]));
    // One island per operator in practice - the first tour's clock anchors
    // "today". (Per-departure cutoffs still use each tour's own clock.)
    const from = query.from ?? dateKey(localNow(tours[0].timeZone));
    const dayCount = query.days ?? 7;
    const fromDate = dayDate(from);
    const toDate = new Date(fromDate.getTime() + (dayCount - 1) * MS_PER_DAY);
    const tourIds = tours.map((t) => t.id);

    // The widest read in the module (cross-tour × days) - shared with
    // overview(), which spans operators for admins.
    const { departures, closureFor } = await this.departuresWithClosures(
      tourIds,
      fromDate,
      toDate,
    );

    const byDay = new Map<string, AgendaDepartureDto[]>();
    for (const row of departures) {
      const tour = tourById.get(row.tourId);
      if (!tour) continue;
      const now = localNow(tour.timeZone);
      const date = dateKey(row.date);
      const startTime = timeOfDay(row.startTime);
      const start = combineDateTime(row.date, row.startTime);
      const cutoffPassed =
        now.getTime() >= start.getTime() - tour.bookingCutoffMinutes * 60_000;
      const list = byDay.get(date) ?? [];
      list.push({
        id: row.id,
        tourId: row.tourId,
        tourName: tour.name,
        pricingModel: tour.pricingModel,
        date,
        startTime,
        bookedCount: row.bookedCount,
        capacity: row.capacity,
        status: liveDepartureStatus({
          status: row.status,
          capacity: row.capacity,
          bookedCount: row.bookedCount,
          cutoffPassed,
        }),
        cutoffPassed,
        closure: closureFor(row.tourId, date, startTime),
      });
      byDay.set(date, list);
    }
    // Every requested day present, even empty - the agenda renders "nothing
    // runs today" as information, not as a missing row.
    const days: AgendaDayDto[] = [];
    for (let i = 0; i < dayCount; i++) {
      const date = dateKey(new Date(fromDate.getTime() + i * MS_PER_DAY));
      days.push({ date, departures: byDay.get(date) ?? [] });
    }
    return {
      days,
      tours: tours.map((t) => ({ id: t.id, name: t.name })),
      lastConfirmedAt: this.stalestConfirm(tours),
    };
  }

  /**
   * The global calendar grid: every departure across the scoped tours for
   * [from, from+days), day-bucketed. Operators (and their staff) are pinned to
   * their own operator; ADMIN reads platform-wide and may narrow with
   * operatorId/tourId. Read-only composition - every action the grid offers
   * is an existing per-tour write (exceptions / schedules / departures), all
   * of which admins pass via assertTourAccess.
   */
  async overview(
    userId: string,
    role: Role,
    query: OverviewQueryDto,
  ): Promise<AvailabilityOverviewResponseDto> {
    // The empty branch has no tour to borrow a clock from, so it anchors on
    // the launch region's zone (every live island runs UTC-4) - `today` must
    // stay island-local even with nothing to show, or the 20:00-24:00 island
    // window reports tomorrow.
    const empty: AvailabilityOverviewResponseDto = {
      today: dateKey(localNow(PLATFORM_HOME_TIMEZONE)),
      days: [],
      tours: [],
      lastConfirmedAt: null,
    };
    let tourWhere: Prisma.TourWhereInput;
    if (role === Role.ADMIN) {
      tourWhere = {
        isActive: true,
        ...(query.operatorId ? { operatorId: query.operatorId } : {}),
      };
    } else {
      // Same non-provisioning resolution as the agenda; the operatorId param
      // is deliberately ignored so a non-admin can never widen their scope.
      const operatorId = await this.operatorContext(userId);
      if (!operatorId) return empty;
      tourWhere = { operatorId, isActive: true };
    }
    if (query.tourId) tourWhere.id = query.tourId;

    const tours = await this.prisma.tour.findMany({
      where: tourWhere,
      select: {
        id: true,
        name: true,
        operatorId: true,
        timeZone: true,
        bookingCutoffMinutes: true,
        pricingModel: true,
        maxPartySize: true,
        startTimes: true,
        availabilityConfirmedAt: true,
        operator: {
          select: {
            companyInfo: { select: { companyName: true } },
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      // Ceiling on the admin platform-wide fan-out (departures × 62 days ride
      // on this list). Far above launch scale; past it, narrow by operator.
      take: 500,
    });
    if (tours.length === 0) return empty;
    const tourById = new Map(tours.map((t) => [t.id, t]));

    // Same anchoring convention as the agenda: the first tour's clock supplies
    // "today" (one region in practice - every launch island runs UTC-4).
    // Returned separately so the client never infers today from days[0].
    const today = dateKey(localNow(tours[0].timeZone));
    const from = query.from ?? today;
    const dayCount = query.days ?? 42;
    const fromDate = dayDate(from);
    const toDate = new Date(fromDate.getTime() + (dayCount - 1) * MS_PER_DAY);
    const tourIds = tours.map((t) => t.id);

    const [departures, closures] = await Promise.all([
      this.prisma.departure.findMany({
        where: {
          tourId: { in: tourIds },
          date: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          tourId: true,
          date: true,
          startTime: true,
          capacity: true,
          bookedCount: true,
          status: true,
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tourId: { in: tourIds },
          date: { gte: fromDate, lte: toDate },
          type: {
            in: [
              AvailabilityExceptionType.CLOSE_DATE,
              AvailabilityExceptionType.CLOSE_SLOT,
            ],
          },
        },
        select: {
          id: true,
          tourId: true,
          date: true,
          startTime: true,
          type: true,
          note: true,
          createdBy: true,
          createdAt: true,
        },
      }),
    ]);
    const actorNames = await this.exceptionActorNames(closures);
    // Platform-wide the closure list can be much larger than one operator's,
    // so the agenda's linear scan becomes two keyed maps.
    type ClosureRow = (typeof closures)[number];
    const slotClosures = new Map<string, ClosureRow>();
    const dayClosures = new Map<string, ClosureRow>();
    for (const c of closures) {
      const date = dateKey(c.date);
      if (
        c.type === AvailabilityExceptionType.CLOSE_SLOT &&
        c.startTime !== null
      ) {
        slotClosures.set(`${c.tourId}|${date}|${timeOfDay(c.startTime)}`, c);
      } else if (c.type === AvailabilityExceptionType.CLOSE_DATE) {
        dayClosures.set(`${c.tourId}|${date}`, c);
      }
    }
    const closureFor = (tourId: string, date: string, startTime: string) => {
      const row =
        slotClosures.get(`${tourId}|${date}|${startTime}`) ??
        dayClosures.get(`${tourId}|${date}`);
      return row
        ? {
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            createdByName: row.createdBy
              ? (actorNames.get(row.createdBy) ?? null)
              : null,
            note: row.note,
          }
        : null;
    };

    const byDay = new Map<string, OverviewDepartureDto[]>();
    for (const row of departures) {
      const tour = tourById.get(row.tourId);
      if (!tour) continue;
      const now = localNow(tour.timeZone);
      const date = dateKey(row.date);
      const startTime = timeOfDay(row.startTime);
      const start = combineDateTime(row.date, row.startTime);
      const cutoffPassed =
        now.getTime() >= start.getTime() - tour.bookingCutoffMinutes * 60_000;
      const list = byDay.get(date) ?? [];
      list.push({
        id: row.id,
        tourId: row.tourId,
        operatorId: tour.operatorId,
        tourName: tour.name,
        pricingModel: tour.pricingModel,
        date,
        startTime,
        bookedCount: row.bookedCount,
        capacity: row.capacity,
        status: liveDepartureStatus({
          status: row.status,
          capacity: row.capacity,
          bookedCount: row.bookedCount,
          cutoffPassed,
        }),
        cutoffPassed,
        closure: closureFor(row.tourId, date, startTime),
      });
      byDay.set(date, list);
    }
    const days: OverviewDayDto[] = [];
    for (let i = 0; i < dayCount; i++) {
      const date = dateKey(new Date(fromDate.getTime() + i * MS_PER_DAY));
      days.push({ date, departures: byDay.get(date) ?? [] });
    }
    const stamps = tours.map((t) => t.availabilityConfirmedAt);
    const lastConfirmedAt = stamps.some((s) => s == null)
      ? null
      : new Date(
          Math.min(...stamps.map((s) => (s as Date).getTime())),
        ).toISOString();
    return {
      today,
      days,
      tours: tours.map((t) => ({
        id: t.id,
        name: t.name,
        operatorId: t.operatorId,
        operatorName:
          t.operator.companyInfo?.companyName ?? t.operator.user.name,
        timeZone: t.timeZone,
        pricingModel: t.pricingModel,
        maxPartySize: t.maxPartySize,
        startTimes: t.startTimes,
      })),
      lastConfirmedAt,
    };
  }

  /**
   * "Close all of today" (matrix v1.6, the weather-day action): one CLOSE_DATE
   * per tour that has departures on the date and is not already closed. The
   * returned tourIds are the exact Undo set - reopenRange(date, date) each.
   */
  async closeAgendaDay(
    userId: string,
    role: Role,
    dto: CloseAgendaDayDto,
  ): Promise<CloseAgendaDayResultDto> {
    // With a tourId the TOUR's operator anchors the scope (assertTourAccess
    // returns it, and admins pass its bypass); without one, the caller's own
    // operator - resolved WITHOUT provisioning, so an admin with no operator
    // gets an honest zero instead of a phantom row and a silent no-op.
    let operatorId: string | null;
    if (dto.tourId) {
      operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    } else {
      operatorId = await this.operatorContext(userId);
      if (!operatorId) return { closed: 0, tourIds: [] };
    }
    const date = dayDate(dto.date);
    const tours = await this.prisma.tour.findMany({
      where: {
        operatorId,
        isActive: true,
        ...(dto.tourId && { id: dto.tourId }),
      },
      select: { id: true },
    });
    const tourIds = tours.map((t) => t.id);
    if (tourIds.length === 0) return { closed: 0, tourIds: [] };
    // Read + write in one transaction (same reasoning as closeRange): a
    // double-tap must not write a second "who closed this" audit row.
    const targets = await this.prisma.$transaction(async (tx) => {
      const [withDepartures, alreadyClosed] = await Promise.all([
        tx.departure.findMany({
          where: { tourId: { in: tourIds }, date },
          select: { tourId: true },
          distinct: ['tourId'],
        }),
        tx.availabilityException.findMany({
          where: {
            tourId: { in: tourIds },
            date,
            type: AvailabilityExceptionType.CLOSE_DATE,
          },
          select: { tourId: true },
        }),
      ]);
      const closedSet = new Set(alreadyClosed.map((r) => r.tourId));
      const ids = withDepartures
        .map((r) => r.tourId)
        .filter((id) => !closedSet.has(id));
      if (ids.length > 0) {
        await tx.availabilityException.createMany({
          data: ids.map((tourId) => ({
            tourId,
            date,
            startTime: null,
            type: AvailabilityExceptionType.CLOSE_DATE,
            note: dto.note ?? null,
            createdBy: userId,
          })),
        });
      }
      return ids;
    });
    if (targets.length > 0) {
      // Project + refresh the gate per affected tour, now not tonight - in
      // parallel: this is pitched as a one-tap action, not a per-tour queue.
      await Promise.all(
        targets.map(async (tourId) => {
          await this.materializer.materializeTour(tourId, dto.date, dto.date);
          await this.refreshIsBookable(tourId);
          this.notifications.emitAvailabilityUpdate({
            tourId,
            localDate: dto.date,
            operatorId,
          });
        }),
      );
    }
    this.logger.log(
      `User ${userId} closed ${dto.date} across ${targets.length} tour(s) (operator ${operatorId})`,
    );
    return { closed: targets.length, tourIds: targets };
  }

  /**
   * Freshness confirm (E.9 `availability_confirmed_at`, dev spec §6.4): the
   * anchor of the non-API operator's daily habit. With a tourId it stamps one
   * tour; without, every tour of the caller's operator - the agenda's one-tap
   * "Confirm today's availability". Visiting the availability surfaces calls
   * this too (the visit IS a review of the calendar), so the nudge system
   * never mails an operator who was just here.
   */
  async confirmAvailability(
    userId: string,
    role: Role,
    dto: ConfirmAvailabilityDto,
  ): Promise<{ confirmed: number; confirmedAt: string }> {
    const now = new Date();
    if (dto.tourId) {
      await this.assertTourAccess(dto.tourId, userId, role);
      await this.prisma.tour.update({
        where: { id: dto.tourId },
        data: { availabilityConfirmedAt: now },
      });
      return { confirmed: 1, confirmedAt: now.toISOString() };
    }
    const operatorId = await this.operatorContext(userId);
    if (!operatorId) return { confirmed: 0, confirmedAt: now.toISOString() };
    const { count } = await this.prisma.tour.updateMany({
      where: { operatorId, isActive: true },
      data: { availabilityConfirmedAt: now },
    });
    return { confirmed: count, confirmedAt: now.toISOString() };
  }

  /**
   * Bulk blackout (dev spec §6.2, F8): one CLOSE_DATE row per date in the
   * range, one transaction, one re-projection. A two-week haul-out is one
   * action instead of fourteen forms. Dates already carrying a whole-day
   * closure are skipped, so re-running an overlapping range never duplicates.
   * The paired {@link reopenRange} with the same bounds is the one-unit Undo.
   */
  async closeRange(
    userId: string,
    role: Role,
    dto: CloseRangeDto,
  ): Promise<{ closed: number }> {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    assertDateRangeOrder(dto.from, dto.to);
    const from = dayDate(dto.from);
    const to = dayDate(dto.to);
    const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
    // The calendar covers 12 months; a range beyond it is a typo, not a plan.
    if (days > 366) {
      throw new BadRequestException(
        'A closure range cannot exceed 366 days - close the tour instead',
      );
    }
    // Read + write in one transaction so two overlapping range-closes (a
    // double submit, or racing the agenda's close-day) cannot both see "not
    // closed yet" and write duplicate audit rows.
    const rows = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.availabilityException.findMany({
        where: {
          tourId: dto.tourId,
          type: AvailabilityExceptionType.CLOSE_DATE,
          date: { gte: from, lte: to },
        },
        select: { date: true },
      });
      const alreadyClosed = new Set(existing.map((r) => dateKey(r.date)));
      const data: Prisma.AvailabilityExceptionCreateManyInput[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(from.getTime() + i * MS_PER_DAY);
        if (alreadyClosed.has(dateKey(date))) continue;
        data.push({
          tourId: dto.tourId,
          date,
          startTime: null,
          type: AvailabilityExceptionType.CLOSE_DATE,
          note: dto.note ?? null,
          createdBy: userId,
        });
      }
      if (data.length > 0) await tx.availabilityException.createMany({ data });
      return data;
    });
    if (rows.length > 0) {
      // One projection pass over the whole range (not per-day): the closures
      // must hit sellable inventory now, not at the nightly job.
      await this.materializer.materializeTour(dto.tourId, dto.from, dto.to);
      await this.refreshIsBookable(dto.tourId);
      this.notifications.emitAvailabilityUpdate({
        tourId: dto.tourId,
        operatorId,
      });
    }
    this.logger.log(
      `User ${userId} closed range ${dto.from}..${dto.to} on tour ${dto.tourId} (${rows.length} day(s))`,
    );
    return { closed: rows.length };
  }

  /** The one-unit Undo of {@link closeRange}: drop every whole-day closure in the range. */
  async reopenRange(
    userId: string,
    role: Role,
    dto: ReopenRangeDto,
  ): Promise<{ reopened: number }> {
    const operatorId = await this.assertTourAccess(dto.tourId, userId, role);
    assertDateRangeOrder(dto.from, dto.to);
    // Same bound as closeRange, and checked BEFORE the delete: the
    // materializer's own 365-day cap would otherwise throw after rows were
    // already gone, leaving closures deleted but departures un-projected.
    const spanDays =
      Math.round(
        (dayDate(dto.to).getTime() - dayDate(dto.from).getTime()) / MS_PER_DAY,
      ) + 1;
    if (spanDays > 366) {
      throw new BadRequestException('A reopen range cannot exceed 366 days');
    }
    const { count } = await this.prisma.availabilityException.deleteMany({
      where: {
        tourId: dto.tourId,
        type: AvailabilityExceptionType.CLOSE_DATE,
        date: { gte: dayDate(dto.from), lte: dayDate(dto.to) },
      },
    });
    if (count > 0) {
      await this.materializer.materializeTour(dto.tourId, dto.from, dto.to);
      await this.refreshIsBookable(dto.tourId);
      this.notifications.emitAvailabilityUpdate({
        tourId: dto.tourId,
        operatorId,
      });
    }
    this.logger.log(
      `User ${userId} reopened range ${dto.from}..${dto.to} on tour ${dto.tourId} (${count} closure(s))`,
    );
    return { reopened: count };
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
      // The Date Changes register reads newest-first (§3.2d): the change you
      // just made is the one you check.
      orderBy: [{ createdAt: 'desc' }],
    });
    const names = await this.exceptionActorNames(rows);
    return rows.map((r) => mapException(r, names));
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
    const actorNames = await this.exceptionActorNames(exceptions);
    const exceptionsByDay = new Map<string, ExceptionResponseDto[]>();
    for (const row of exceptions) {
      const key = dateKey(row.date);
      const list = exceptionsByDay.get(key) ?? [];
      list.push(mapException(row, actorNames));
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
    // Capacity may never drop below the seats already sold. The nightly
    // materializer refuses to resize any departure with bookedCount > 0
    // (availability-materializer.service.ts); without the same floor here the
    // manual edit path can write capacity 2 onto a departure with 8 booked,
    // leaving a permanently oversold row that every downstream bookability
    // calculation then reasons about incorrectly.
    if (capacity < existing.bookedCount) {
      throw new BadRequestException(
        `Capacity cannot be lower than the ${existing.bookedCount} seat(s) already booked`,
      );
    }
    // A manual status wins; otherwise re-derive from the (preserved) booked count.
    const status =
      dto.status ?? storedStatusForFill(capacity, existing.bookedCount);
    const soldOut = status === DepartureStatus.SOLD_OUT;

    // Optimistic lock on the booked count. `existing` was read several awaits
    // ago (assertTourAccess + tourClock), so a reserve can have landed in the
    // gap - and both the floor check above and `storedStatusForFill` above
    // reason about that stale number. Guarding the write on it means a booking
    // that slipped in makes this edit fail loudly instead of silently
    // overwriting the seats it just sold.
    const claimed = await this.prisma.departure.updateMany({
      where: { id, bookedCount: existing.bookedCount },
      data: {
        capacity,
        status,
        ...(soldOut && existing.soldOutAt == null && { soldOutAt: new Date() }),
        manuallyEdited: true, // protect from re-materialization (master §3)
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException(
        'This departure was booked while you were editing it. Reload and try again.',
      );
    }
    const row = await this.prisma.departure.findUniqueOrThrow({
      where: { id },
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
   * The earliest LIVE-bookable departure DATE (`yyyy-MM-dd`) for each of `tourIds`
   * within `[fromKey, toKey]` inclusive. Tours with no bookable departure in the
   * window are simply absent from the map - so the caller can use `.has()` as the
   * "still has room" test and the value as display copy ("Next: 8 Aug").
   *
   * Bookability is the same rule the public calendar and reserve apply
   * ({@link liveDepartureStatus} + {@link isDepartureBookable}), not a coarse
   * `status = OPEN` check: a sold-out or past-cutoff row must not count. Each tour
   * carries its OWN clock, so `now` is resolved per time zone rather than once.
   *
   * Backs the all-sold-out dead end (AVAILABILITY-AND-DEPARTURES.md §8), whose
   * alternatives must have room "within 7 days". Bounded by design - the caller
   * passes an already-capped candidate set - and one query for all of them.
   */
  async nextBookableDateByTour(
    tourIds: string[],
    fromKey: string,
    toKey: string,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (tourIds.length === 0) return result;
    assertDateRangeOrder(fromKey, toKey, 'dateFrom', 'dateTo');

    const [tours, rows] = await Promise.all([
      this.prisma.tour.findMany({
        where: { id: { in: tourIds } },
        select: { id: true, timeZone: true, bookingCutoffMinutes: true },
      }),
      this.prisma.departure.findMany({
        where: {
          tourId: { in: tourIds },
          status: DepartureStatus.OPEN,
          date: { gte: dayDate(fromKey), lte: dayDate(toKey) },
        },
        select: {
          tourId: true,
          date: true,
          startTime: true,
          capacity: true,
          bookedCount: true,
          status: true,
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    const clocks = new Map(
      tours.map((t) => [
        t.id,
        {
          timeZone: t.timeZone,
          bookingCutoffMinutes: t.bookingCutoffMinutes,
        } satisfies TourClock,
      ]),
    );
    // One `now` per DISTINCT time zone, not per row.
    const nowByZone = new Map<string, Date>();

    // Rows arrive date-ascending, so the first bookable row per tour is also the
    // earliest - anything already recorded wins and is skipped.
    for (const r of rows) {
      if (result.has(r.tourId)) continue;
      const clock = clocks.get(r.tourId);
      if (!clock) continue;
      let now = nowByZone.get(clock.timeZone);
      if (!now) {
        now = localNow(clock.timeZone);
        nowByZone.set(clock.timeZone, now);
      }
      const start = combineDateTime(r.date, r.startTime);
      const live = liveDepartureStatus({
        status: r.status,
        capacity: r.capacity,
        bookedCount: r.bookedCount,
        cutoffPassed: cutoffReached(
          start.getTime(),
          now.getTime(),
          clock.bookingCutoffMinutes,
        ),
      });
      if (isDepartureBookable(live)) result.set(r.tourId, dateKey(r.date));
    }
    return result;
  }

  /**
   * The operator status line (review §3.2a): "is this tour selling?" in one
   * read - the soonest bookable departure and how many are open inside the
   * §7.2 30-day listing gate. Zero is the F13 warning state: the tour is out
   * of every ranked surface (and stays reachable only by direct link) until a
   * date opens. Same bookability rules as {@link computeIsBookable}, so the
   * number the operator sees is exactly the number the gate counts.
   */
  async availabilitySummary(
    userId: string,
    role: Role,
    tourId: string,
  ): Promise<AvailabilitySummaryDto> {
    await this.assertTourAccess(tourId, userId, role);
    const clock = await this.tourClock(tourId);
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
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    let openInNext30Days = 0;
    let nextDeparture: AvailabilitySummaryDto['nextDeparture'] = null;
    for (const c of candidates) {
      const start = combineDateTime(c.date, c.startTime);
      const cutoffPassed =
        now.getTime() >= start.getTime() - clock.bookingCutoffMinutes * 60_000;
      const live = liveDepartureStatus({
        status: c.status,
        capacity: c.capacity,
        bookedCount: c.bookedCount,
        cutoffPassed,
      });
      if (!isDepartureBookable(live)) continue;
      openInNext30Days++;
      nextDeparture ??= {
        date: dateKey(c.date),
        startTime: timeOfDay(c.startTime),
      };
    }
    return { openInNext30Days, nextDeparture };
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
    // Read the previous value so the EDGE can be detected. A tour that has been
    // unlisted for a week does not need telling again every nightly run; the
    // moment it FALLS OFF is the news.
    const before = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { isBookable: true, status: true, name: true, operatorId: true },
    });
    await this.prisma.tour.update({
      where: { id: tourId },
      data: { isBookable: bookable },
    });

    // The silent failure this is worth having: LIVE, published, and invisible
    // because the departures ran out. Nothing surfaced it before - you had to
    // open the tour and notice.
    if (
      before &&
      before.isBookable &&
      !bookable &&
      before.status === TourStatus.LIVE
    ) {
      this.inbox.notify({
        event: InboxEvent.TOUR_UNLISTED_NO_DEPARTURES,
        operatorId: before.operatorId,
        title: `${before.name} has dropped out of listings`,
        body: 'It is still published, but has no bookable departures in the next 30 days, so travellers cannot find it. Add availability to bring it back.',
        url: `/trips/${tourId}/edit?step=schedule`,
        entityType: 'tour',
        entityId: tourId,
        // Re-notifiable: if it recovers and falls off again, that is new news.
        dedupeKey: `TOUR_UNLISTED_NO_DEPARTURES:${tourId}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
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
   * Capacity ALWAYS resolves now: a schedule uses its own `capacityOverride`,
   * else the tour's `maxPartySize`, which is NOT NULL as of the
   * `20260729190000_max_party_size_required` migration.
   *
   * This used to be a real guard. `maxPartySize` was nullable, and when both it
   * and the override were absent the materialiser skipped every slot in silence
   * - the tour simply never listed, and the only explanation was a readiness
   * check that could pass for two different reasons. Kept as a no-op call site
   * marker rather than deleted so the four callers still read as "capacity is
   * checked here" if the column is ever loosened again.
   */
  private assertResolvableCapacity(): void {
    // Intentionally empty - see above.
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
   * Master E.9: "capacity below booked_count is admin-only with a warning and
   * never auto-cancels". The materializer honours that by refusing to resize any
   * departure with `bookedCount > 0`, which made a too-low SET_CAPACITY a SILENT
   * no-op: the row was stored, the departure kept its old capacity, and the
   * operator got a success response with nothing changed. Refuse it at the write
   * instead, so the portal can never claim a capacity it did not get.
   *
   * Scoped like the exception itself: a slot-level row checks only that
   * departure, a whole-day row checks every departure on the date.
   */
  private async assertCapacityAboveBooked(
    tourId: string,
    date: string,
    startTime: string | undefined,
    capacity: number,
  ): Promise<void> {
    const rows = await this.prisma.departure.findMany({
      where: {
        tourId,
        date: dayDate(date),
        ...(startTime && { startTime: hhmmToTime(startTime) }),
      },
      select: { startTime: true, bookedCount: true },
    });
    const worst = rows.reduce<{ startTime: Date; bookedCount: number } | null>(
      (max, r) =>
        r.bookedCount > capacity && (!max || r.bookedCount > max.bookedCount)
          ? r
          : max,
      null,
    );
    if (!worst) return;
    throw new BadRequestException(
      `Capacity cannot be lower than the ${worst.bookedCount} seat(s) already booked on the ${timeOfDay(worst.startTime)} departure. Existing bookings are never auto-cancelled; lowering below the booked count is an Island Tours support action.`,
    );
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

function mapException(
  row: AvailabilityException,
  actorNames?: Map<string, string>,
): ExceptionResponseDto {
  return {
    id: row.id,
    tourId: row.tourId,
    date: dateKey(row.date),
    startTime: row.startTime ? timeOfDay(row.startTime) : null,
    type: row.type,
    capacity: row.capacity,
    note: row.note,
    // Audit surface (dev spec §6.5): every override answers "who, when" so an
    // "I never closed that date" dispute is resolvable from the screen.
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdBy
      ? (actorNames?.get(row.createdBy) ?? null)
      : null,
    source: row.source,
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
