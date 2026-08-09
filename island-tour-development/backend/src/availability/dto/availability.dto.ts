import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  ClosureReason,
  DepartureStatus,
} from '@prisma/client';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ScheduleResponseDto {
  @ApiProperty({ example: 'c1a2…' }) id!: string;
  @ApiProperty({ example: 'tour-uuid' }) tourId!: string;
  @ApiProperty({ example: 1, description: 'Weekday, Monday=0 … Sunday=6' })
  weekday!: number;
  @ApiProperty({ example: '09:00' }) startTime!: string;
  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'null = Tour.maxPartySize default',
  })
  capacityOverride!: number | null;
  @ApiProperty({ example: '2026-06-01' }) validFrom!: string;
  @ApiPropertyOptional({ example: '2026-09-30', nullable: true })
  validUntil!: string | null;
  @ApiProperty({ enum: AvailabilityScheduleStatus })
  status!: AvailabilityScheduleStatus;
}

export class ExceptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiPropertyOptional({
    example: '09:00',
    nullable: true,
    description: 'null = whole date',
  })
  startTime!: string | null;
  @ApiProperty({ enum: AvailabilityExceptionType })
  type!: AvailabilityExceptionType;
  @ApiPropertyOptional({
    example: 20,
    nullable: true,
    description: 'add_slot / set_capacity',
  })
  capacity!: number | null;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiPropertyOptional({
    enum: ClosureReason,
    nullable: true,
    description:
      'Why the operator closed. Drives what a traveller is told: SOLD_OUT reads ' +
      '"Sold out" with the date struck through, NOT_RUNNING reads "No departure", ' +
      'plain. Null on non-closure types and on closures written before reasons existed.',
  })
  closureReason!: ClosureReason | null;
  @ApiProperty({
    example: '2026-07-28T18:02:11.000Z',
    description: 'When this change was made - the audit half of §6.5.',
  })
  createdAt!: string;
  @ApiPropertyOptional({
    example: 'Maria',
    nullable: true,
    description:
      'Display name of whoever made the change ("Closed by Maria"); null when ' +
      'the account no longer exists or the row predates audit capture.',
  })
  createdByName!: string | null;
}

export class DepartureResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiProperty({ example: '13:00' }) startTime!: string;
  @ApiProperty({ example: 12 }) capacity!: number;
  @ApiProperty({ example: 4 }) bookedCount!: number;
  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description:
      'Seats left — surfaced only when under 5 (anti-scarcity, master §4).',
  })
  remaining!: number | null;
  @ApiProperty({
    enum: DepartureStatus,
    description: 'Live status (stored state folded with the read-time cutoff).',
  })
  status!: DepartureStatus;
  @ApiProperty({
    example: true,
    description: 'Live bookability (status OPEN, cutoff not passed).',
  })
  available!: boolean;
  @ApiPropertyOptional({ nullable: true, example: '2026-07-02T17:00:00.000Z' })
  soldOutAt!: string | null;
  @ApiPropertyOptional({
    enum: ClosureReason,
    nullable: true,
    description:
      'Set only on an operator-closed departure. Null when the closure is the ' +
      'read-time booking cutoff, which is a plain "Closed".',
  })
  closureReason!: ClosureReason | null;
  @ApiProperty({ example: false }) manuallyEdited!: boolean;
}

export class CalendarDayResponseDto {
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiProperty({ example: true }) available!: boolean;
  @ApiProperty({ enum: DepartureStatus }) status!: DepartureStatus;
  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description:
      'Lowest seats-left across open slots — surfaced only when under 5.',
  })
  remaining!: number | null;
  @ApiProperty({ example: 3, description: 'Number of departures on the day.' })
  departureCount!: number;
  @ApiPropertyOptional({
    enum: ClosureReason,
    nullable: true,
    description:
      'Why the day is unbookable, when an operator closed it. NOT_RUNNING means ' +
      'the traveller calendar shows "No departure" plain rather than a struck-out ' +
      '"Closed" — nothing was ever on sale that day.',
  })
  closureReason!: ClosureReason | null;
}

/** Operator month-grid day state (management view, not the public calendar). */
export const MANAGE_CALENDAR_DAY_STATUSES = [
  'open',
  'partial',
  'closed',
  'no_service',
] as const;
export type ManageCalendarDayStatus =
  (typeof MANAGE_CALENDAR_DAY_STATUSES)[number];

export class ManageCalendarDayDto {
  @ApiProperty({ example: '2026-08-09' }) date!: string;
  @ApiProperty({
    enum: MANAGE_CALENDAR_DAY_STATUSES,
    description:
      'open = every in-service slot sellable · partial = at least one slot ' +
      'closed/overridden while others sell · closed = whole day stop-sold ' +
      '(CLOSE_DATE, or every departure closed) · no_service = no departures ' +
      'on this date (check `scheduled` for whether the weekly pattern covers it).',
  })
  status!: ManageCalendarDayStatus;
  @ApiProperty({
    example: true,
    description:
      'Whether an ACTIVE weekly schedule covers this date - lets the grid ' +
      'distinguish "no service planned" from "not materialized yet".',
  })
  scheduled!: boolean;
  @ApiProperty({
    type: [String],
    example: ['15:00', '17:30'],
    description:
      'Start times the weekly pattern produces on this date, whether or not ' +
      'departures exist yet - so a beyond-horizon day can show what WILL run ' +
      'before the engine materializes it.',
  })
  scheduledTimes!: string[];
  @ApiProperty({
    example: 3,
    description:
      'Seats booked across ALL departures on the day. Closing NEVER touches ' +
      'them (E.9: a close stops new sales only; cancelling booked departures ' +
      'is the separate admin-executed refund/rebook flow) - the UI shows this ' +
      'count so the operator sees who keeps their booking.',
  })
  bookedTotal!: number;
  @ApiProperty({ type: [DepartureResponseDto] })
  departures!: DepartureResponseDto[];
  @ApiProperty({ type: [ExceptionResponseDto] })
  exceptions!: ExceptionResponseDto[];
}

export class MaterializeResultDto {
  @ApiProperty({ example: 90 }) created!: number;
  @ApiProperty({ example: 12 }) updated!: number;
  @ApiProperty({
    example: 3,
    description: 'Protected (booked / manuallyEdited / api) - left as-is.',
  })
  skipped!: number;
  @ApiProperty({
    example: 5,
    description: 'Orphaned (schedule changed) - removed.',
  })
  removed!: number;
}

export class NextDepartureDto {
  @ApiProperty({ example: '2026-08-09' }) date!: string;
  @ApiProperty({ example: '09:00' }) startTime!: string;
}

export class AvailabilitySummaryDto {
  @ApiProperty({
    example: 41,
    description:
      'Bookable departures (OPEN, seats left, cutoff not passed) within the ' +
      'next 30 days - the §7.2 listing-gate horizon. 0 means the tour is ' +
      'excluded from every ranked surface until a date opens.',
  })
  openInNext30Days!: number;

  @ApiPropertyOptional({
    type: NextDepartureDto,
    description: 'The soonest bookable departure, null when none exists.',
  })
  nextDeparture!: NextDepartureDto | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class AvailabilitySummaryQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;
}

// ── Daily agenda (Surface B - review §3.3, matrix v1.6) ──────────────────────

export class AgendaQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-30',
    description: 'First day (tour-local). Defaults to the island´s today.',
  })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({
    example: 7,
    description: 'Days to return (default 7, max 28).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  days?: number;
}

export class AgendaDepartureDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: 'Sunset Champagne Sail' }) tourName!: string;
  @ApiProperty({ enum: ['PER_PERSON', 'UNIT'] })
  pricingModel!: string;
  @ApiProperty({ example: '2026-07-30' }) date!: string;
  @ApiProperty({ example: '16:30' }) startTime!: string;
  @ApiProperty({ example: 34 }) bookedCount!: number;
  @ApiProperty({ example: 40 }) capacity!: number;
  @ApiProperty({
    enum: DepartureStatus,
    description: 'LIVE status (cutoff folded in, master read contract).',
  })
  status!: DepartureStatus;
  @ApiProperty({
    example: false,
    description:
      'Booking cutoff has passed (tour-local clock). The read contract folds ' +
      'this into a CLOSED status, but the agenda renders it as "Departed" - ' +
      'a wall of struck-through "Closed" 07:00 rows every afternoon reads as ' +
      '"everything is broken" when it just means the boats left.',
  })
  cutoffPassed!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The CLOSE_DATE/CLOSE_SLOT row stopping this departure, when one ' +
      'exists - carries the id (for Reopen) and the who/when audit line.',
  })
  closure!: {
    id: string;
    createdAt: string;
    createdByName: string | null;
    note: string | null;
  } | null;
}

export class AgendaDayDto {
  @ApiProperty({ example: '2026-07-30' }) date!: string;
  @ApiProperty({ type: [AgendaDepartureDto] })
  departures!: AgendaDepartureDto[];
}

export class AgendaResponseDto {
  @ApiProperty({ type: [AgendaDayDto] }) days!: AgendaDayDto[];
  @ApiProperty({
    type: [Object],
    description: 'The operator´s tours, for the filter chips (id + name).',
  })
  tours!: { id: string; name: string }[];
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The STALEST availability_confirmed_at across the operator´s tours - ' +
      'what the freshness card reports. Null when never confirmed.',
  })
  lastConfirmedAt!: string | null;
}

// ── Global calendar overview (admin + operator, one full-width grid) ─────────

export class OverviewQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'First day (tour-local). Defaults to the island´s today.',
  })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({
    example: 42,
    description: 'Days to return (default 42 - a six-week month grid, max 62).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(62)
  days?: number;

  @ApiPropertyOptional({
    example: 'tour-uuid',
    description: 'Narrow to one tour.',
  })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({
    example: 'operator-uuid',
    description:
      'Narrow to one operator. Honoured for ADMIN only - every other caller ' +
      'is pinned to their own operator and the param is ignored.',
  })
  @IsOptional()
  @IsString()
  operatorId?: string;
}

export class OverviewTourDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Sunset Champagne Sail' }) name!: string;
  @ApiProperty() operatorId!: string;
  @ApiProperty({
    example: 'Blue Bay Sailing',
    description: 'Company name, falling back to the owner account´s name.',
  })
  operatorName!: string;
  @ApiProperty({ example: 'America/Curacao' }) timeZone!: string;
  @ApiProperty({ enum: ['PER_PERSON', 'UNIT'] })
  pricingModel!: string;
  @ApiProperty({
    example: 10,
    description: 'Default departure capacity (no schedule override).',
  })
  maxPartySize!: number;
  @ApiProperty({
    type: [String],
    example: ['09:00', '14:00'],
    description:
      'The tour´s slot set - a new weekly schedule´s startTime must be one ' +
      'of these.',
  })
  startTimes!: string[];
}

export class OverviewDepartureDto extends AgendaDepartureDto {
  @ApiProperty({
    description: 'The tour´s operator - admin grids group/filter by it.',
  })
  operatorId!: string;
}

export class OverviewDayDto {
  @ApiProperty({ example: '2026-08-01' }) date!: string;
  @ApiProperty({ type: [OverviewDepartureDto] })
  departures!: OverviewDepartureDto[];
}

export class AvailabilityOverviewResponseDto {
  @ApiProperty({
    example: '2026-07-30',
    description:
      'The island´s current date, regardless of the requested window - so ' +
      'the client never has to infer "today" from days[0].',
  })
  today!: string;
  @ApiProperty({ type: [OverviewDayDto] }) days!: OverviewDayDto[];
  @ApiProperty({ type: [OverviewTourDto] }) tours!: OverviewTourDto[];
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The STALEST availability_confirmed_at across the scoped tours; null ' +
      'when any tour was never confirmed.',
  })
  lastConfirmedAt!: string | null;
}

export class CloseAgendaDayDto {
  @ApiProperty({ example: '2026-07-30' })
  @IsLocalDate()
  date!: string;

  @ApiPropertyOptional({
    example: 'tour-uuid',
    description: 'Scope to one tour (the agenda´s filtered bulk close).',
  })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({ example: 'Weather' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CloseAgendaDayResultDto {
  @ApiProperty({
    example: 3,
    description: 'Tours whose day was closed (already-closed skipped).',
  })
  closed!: number;
  @ApiProperty({
    type: [String],
    description: 'The affected tour ids - the Undo reopens exactly these.',
  })
  tourIds!: string[];
}

// ── Freshness confirm (E.9 availability_confirmed_at, dev spec §6.4) ─────────

export class ConfirmAvailabilityDto {
  @ApiPropertyOptional({
    example: 'tour-uuid',
    description:
      'Confirm one tour. Omit to confirm every tour of the caller´s operator ' +
      '- the daily agenda´s one-tap "Confirm today´s availability".',
  })
  @IsOptional()
  @IsString()
  tourId?: string;
}

export class ConfirmAvailabilityResultDto {
  @ApiProperty({ example: 3, description: 'Tours stamped.' })
  confirmed!: number;
  @ApiProperty({ example: '2026-07-30T13:02:11.000Z' })
  confirmedAt!: string;
}

// ── Bulk blackout (dev spec §6.2: "blackout ranges") ─────────────────────────

export class CloseRangeDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({
    enum: ClosureReason,
    description:
      'Why the range is being closed. The same two reasons as a single-day ' +
      'close, and both have to reach Date changes so the register reads ' +
      '"Whole day closed · Sold out" rather than just "closed".',
  })
  @IsOptional()
  @IsEnum(ClosureReason)
  closureReason?: ClosureReason;

  @ApiProperty({ example: '2026-09-01' })
  @IsLocalDate()
  from!: string;

  @ApiProperty({ example: '2026-09-14' })
  @IsLocalDate()
  to!: string;

  @ApiPropertyOptional({ example: 'Maintenance haul-out' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReopenRangeDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsLocalDate()
  from!: string;

  @ApiProperty({ example: '2026-09-14' })
  @IsLocalDate()
  to!: string;
}

export class CloseRangeResultDto {
  @ApiProperty({
    example: 14,
    description: 'Whole-day closures written (already-closed dates skipped).',
  })
  closed!: number;
}

export class ReopenRangeResultDto {
  @ApiProperty({
    example: 14,
    description: 'Whole-day closures removed in the range.',
  })
  reopened!: number;
}

export class ListSchedulesQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;
}

export class ListExceptionsQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsLocalDate()
  to?: string;
}

export class ManageCalendarQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: '2026-08', description: 'Calendar month (YYYY-MM).' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month!: string;
}

export class ListDeparturesQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ enum: DepartureStatus })
  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CreateScheduleDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 1, description: 'Weekday, Monday=0 … Sunday=6' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({
    example: '09:00',
    description: 'Must exist in Tour.startTimes[]',
  })
  @Matches(HHMM, { message: 'startTime must be HH:MM (00:00–23:59)' })
  startTime!: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'null/omitted = Tour.maxPartySize default',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityOverride?: number;

  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Defaults to today.',
  })
  @IsOptional()
  @IsLocalDate()
  validFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'null = open-ended.',
  })
  @IsOptional()
  @IsLocalDate()
  validUntil?: string;

  @ApiPropertyOptional({
    enum: AvailabilityScheduleStatus,
    default: AvailabilityScheduleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AvailabilityScheduleStatus)
  status?: AvailabilityScheduleStatus;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    example: 6,
    description: 'Weekday, Monday=0 … Sunday=6',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM (00:00–23:59)' })
  startTime?: string;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityOverride?: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsLocalDate()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsLocalDate()
  validUntil?: string;

  @ApiPropertyOptional({ enum: AvailabilityScheduleStatus })
  @IsOptional()
  @IsEnum(AvailabilityScheduleStatus)
  status?: AvailabilityScheduleStatus;
}

export class CreateExceptionDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: '2026-07-04' })
  @IsLocalDate()
  date!: string;

  @ApiProperty({
    enum: AvailabilityExceptionType,
    description:
      'close_date / close_slot (stop-sell) · add_slot · set_capacity',
  })
  @IsEnum(AvailabilityExceptionType)
  type!: AvailabilityExceptionType;

  @ApiPropertyOptional({
    example: '09:00',
    description: 'null = whole date (close_date / day-wide set_capacity)',
  })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({
    example: 20,
    description: 'Required for add_slot / set_capacity.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Independence Day closure' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    enum: ClosureReason,
    description:
      'Why the operator is closing (CLOSE_DATE / CLOSE_SLOT only). SOLD_OUT shows the traveller "Sold out" with the date struck through; NOT_RUNNING shows "No departure", plain, because nothing was ever on sale that day. Omitted, the closure reads as a plain "Closed".',
  })
  @IsOptional()
  @IsEnum(ClosureReason)
  closureReason?: ClosureReason;
}

export class UpdateExceptionDto {
  @ApiPropertyOptional({ enum: AvailabilityExceptionType })
  @IsOptional()
  @IsEnum(AvailabilityExceptionType)
  type?: AvailabilityExceptionType;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Updated note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MaterializeDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Defaults to today.',
  })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Defaults to today + 90 days; max horizon 365 days.',
  })
  @IsOptional()
  @IsLocalDate()
  to?: string;
}

export class UpdateDepartureDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({
    enum: DepartureStatus,
    description: 'Manual override (e.g. CLOSED stop-sell, CANCELLED).',
  })
  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;
}

class PartySizeDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AvailabilityCheckDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsLocalDate()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsLocalDate()
  dateTo!: string;

  @ApiPropertyOptional({
    type: [PartySizeDto],
    description:
      'Optional capacity filter - only slots with enough seats left.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartySizeDto)
  units?: PartySizeDto[];
}

export class AvailabilityCalendarDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsLocalDate()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsLocalDate()
  dateTo!: string;
}
