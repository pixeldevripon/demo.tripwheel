import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  AvailabilityStatus,
} from '@prisma/client';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ScheduleResponseDto {
  @ApiProperty({ example: 'c1a2…' }) id!: string;
  @ApiProperty({ example: 'tour-uuid' }) tourId!: string;
  @ApiPropertyOptional({ example: 'opt-uuid', nullable: true })
  optionId!: string | null;
  @ApiProperty({ example: [1, 2, 3, 4, 5], description: '0=Sun … 6=Sat' })
  weekdays!: number[];
  @ApiProperty({ example: ['09:00', '13:00'] }) startTimes!: string[];
  @ApiProperty({ example: 12 }) capacity!: number;
  @ApiPropertyOptional({ example: '2026-06-01', nullable: true })
  seasonStart!: string | null;
  @ApiPropertyOptional({ example: '2026-09-30', nullable: true })
  seasonEnd!: string | null;
  @ApiPropertyOptional({ example: '79.99', nullable: true })
  priceOverride!: string | null;
  @ApiProperty({ example: true }) isActive!: boolean;
}

export class ExceptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiPropertyOptional({ nullable: true }) optionId!: string | null;
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiProperty({ enum: AvailabilityExceptionType })
  type!: AvailabilityExceptionType;
  @ApiPropertyOptional({ example: '09:00', nullable: true })
  startTime!: string | null;
  @ApiPropertyOptional({ example: 20, nullable: true })
  capacity!: number | null;
  @ApiPropertyOptional({ example: '99.00', nullable: true })
  priceOverride!: string | null;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
}

export class DepartureResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty() optionId!: string;
  @ApiProperty({ example: '2026-07-04T13:00:00.000Z' })
  localDateTimeStart!: string;
  @ApiPropertyOptional({ nullable: true }) localDateTimeEnd!: string | null;
  @ApiProperty({ example: false }) allDay!: boolean;
  @ApiProperty({ example: 12 }) capacity!: number;
  @ApiProperty({ example: 8 }) vacancies!: number;
  @ApiProperty({ enum: AvailabilityStatus }) status!: AvailabilityStatus;
  @ApiProperty({ example: true, description: 'Live bookability (status + cutoff).' })
  available!: boolean;
  @ApiProperty({ example: '2026-07-02T17:00:00.000Z' }) utcCutoffAt!: string;
  @ApiPropertyOptional({ nullable: true }) priceOverride!: string | null;
  @ApiProperty({ example: false }) manuallyEdited!: boolean;
}

export class CalendarDayResponseDto {
  @ApiProperty({ example: '2026-07-04' }) date!: string;
  @ApiProperty({ example: true }) available!: boolean;
  @ApiProperty({ enum: AvailabilityStatus }) status!: AvailabilityStatus;
  @ApiProperty({ example: 24, description: 'Sum of live vacancies across the day.' })
  vacancies!: number;
  @ApiProperty({ example: 36 }) capacity!: number;
  @ApiProperty({ example: 3, description: 'Number of departures on the day.' })
  departureCount!: number;
}

export class MaterializeResultDto {
  @ApiProperty({ example: 90 }) created!: number;
  @ApiProperty({ example: 12 }) updated!: number;
  @ApiProperty({ example: 3, description: 'Protected (manuallyEdited) — left as-is.' })
  skipped!: number;
  @ApiProperty({ example: 5, description: 'Orphaned (schedule changed) — removed.' })
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

  @ApiPropertyOptional({ enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status?: AvailabilityStatus;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CreateScheduleDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: 'opt-uuid', description: 'Null = all options.' })
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiProperty({ example: [1, 2, 3, 4, 5], description: '0=Sun … 6=Sat' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @ApiProperty({ example: ['09:00', '13:00'] })
  @IsArray()
  @ArrayMinSize(1)
  @Matches(HHMM, { each: true, message: 'startTimes must be HH:MM (00:00–23:59)' })
  startTimes!: string[];

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  seasonStart?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  seasonEnd?: string;

  @ApiPropertyOptional({ example: 79.99 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceOverride?: number;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ example: 'opt-uuid' })
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiPropertyOptional({ example: [0, 6] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ApiPropertyOptional({ example: ['10:00'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Matches(HHMM, { each: true, message: 'startTimes must be HH:MM (00:00–23:59)' })
  startTimes?: string[];

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  seasonStart?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  seasonEnd?: string;

  @ApiPropertyOptional({ example: 89.99 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExceptionDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: 'opt-uuid' })
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiProperty({ example: '2026-07-04' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: AvailabilityExceptionType })
  @IsEnum(AvailabilityExceptionType)
  type!: AvailabilityExceptionType;

  @ApiPropertyOptional({ example: '09:00', description: 'EXTRA_DEPARTURE / BLACKOUT one slot.' })
  @IsOptional()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: 20, description: 'CAPACITY_OVERRIDE / EXTRA_DEPARTURE.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ example: 99.0, description: 'PRICE_OVERRIDE / EXTRA_DEPARTURE.' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ example: 'Independence Day surcharge' })
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

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceOverride?: number;

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

  @ApiPropertyOptional({ enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status?: AvailabilityStatus;

  @ApiPropertyOptional({ example: 110.0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  priceOverride?: number;
}

class UnitQuantityDto {
  @ApiProperty({ example: 'unit-uuid' })
  @IsString()
  unitId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AvailabilityCheckDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: 'opt-uuid', description: 'Null = all options.' })
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional({
    type: [UnitQuantityDto],
    description: 'Optional capacity filter — only slots with enough vacancies.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitQuantityDto)
  units?: UnitQuantityDto[];
}

export class AvailabilityCalendarDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiPropertyOptional({ example: 'opt-uuid' })
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  dateTo!: string;
}
