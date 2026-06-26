import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  DepartureStatus,
} from '@prisma/client';

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
  @ApiProperty({ enum: AvailabilityScheduleStatus }) status!: AvailabilityScheduleStatus;
}

export class ExceptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiPropertyOptional({ example: '09:00', nullable: true, description: 'null = whole date' })
  startTime!: string | null;
  @ApiProperty({ enum: AvailabilityExceptionType })
  type!: AvailabilityExceptionType;
  @ApiPropertyOptional({ example: 20, nullable: true, description: 'add_slot / set_capacity' })
  capacity!: number | null;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
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
    description: 'Seats left — surfaced only when under 5 (anti-scarcity, master §4).',
  })
  remaining!: number | null;
  @ApiProperty({
    enum: DepartureStatus,
    description: 'Live status (stored state folded with the read-time cutoff).',
  })
  status!: DepartureStatus;
  @ApiProperty({ example: true, description: 'Live bookability (status OPEN, cutoff not passed).' })
  available!: boolean;
  @ApiPropertyOptional({ nullable: true, example: '2026-07-02T17:00:00.000Z' })
  soldOutAt!: string | null;
  @ApiProperty({ example: false }) manuallyEdited!: boolean;
}

export class CalendarDayResponseDto {
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiProperty({ example: true }) available!: boolean;
  @ApiProperty({ enum: DepartureStatus }) status!: DepartureStatus;
  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description: 'Lowest seats-left across open slots — surfaced only when under 5.',
  })
  remaining!: number | null;
  @ApiProperty({ example: 3, description: 'Number of departures on the day.' })
  departureCount!: number;
}

export class MaterializeResultDto {
  @ApiProperty({ example: 90 }) created!: number;
  @ApiProperty({ example: 12 }) updated!: number;
  @ApiProperty({
    example: 3,
    description: 'Protected (booked / manuallyEdited / api) - left as-is.',
  })
  skipped!: number;
  @ApiProperty({ example: 5, description: 'Orphaned (schedule changed) - removed.' })
  removed!: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

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
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListDeparturesQueryDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
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

  @ApiProperty({ example: '09:00', description: 'Must exist in Tour.startTimes[]' })
  @Matches(HHMM, { message: 'startTime must be HH:MM (00:00–23:59)' })
  startTime!: string;

  @ApiPropertyOptional({ example: 12, description: 'null/omitted = Tour.maxPartySize default' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityOverride?: number;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'null = open-ended.' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: AvailabilityScheduleStatus, default: AvailabilityScheduleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AvailabilityScheduleStatus)
  status?: AvailabilityScheduleStatus;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ example: 6, description: 'Weekday, Monday=0 … Sunday=6' })
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
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
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
  @IsDateString()
  date!: string;

  @ApiProperty({
    enum: AvailabilityExceptionType,
    description: 'close_date / close_slot (stop-sell) · add_slot · set_capacity',
  })
  @IsEnum(AvailabilityExceptionType)
  type!: AvailabilityExceptionType;

  @ApiPropertyOptional({ example: '09:00', description: 'null = whole date (close_date / day-wide set_capacity)' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: 20, description: 'Required for add_slot / set_capacity.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Independence Day closure' })
  @IsOptional()
  @IsString()
  note?: string;
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
  note?: string;
}

export class MaterializeDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: '2026-07-01', description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Defaults to today + 90 days; max horizon 365 days.',
  })
  @IsOptional()
  @IsDateString()
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
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional({
    type: [PartySizeDto],
    description: 'Optional capacity filter - only slots with enough seats left.',
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
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  dateTo!: string;
}
