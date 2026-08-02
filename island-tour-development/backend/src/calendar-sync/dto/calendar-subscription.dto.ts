import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CalendarImportMode,
  CalendarPlatform,
  CalendarSubscriptionStatus,
  IcalSyncOutcome,
  IcalSyncTrigger,
} from '@prisma/client';

/** Poll cadences the UI offers. Minutes, so the scheduler can compare directly. */
export const SYNC_INTERVALS = [15, 30, 60, 180, 360, 720, 1440] as const;

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CalendarSubscriptionResponseDto {
  @ApiProperty({ example: 'c1a2b3c4-…' }) id!: string;
  @ApiProperty({ example: 'a9f8…' }) tourId!: string;

  @ApiProperty({ enum: CalendarPlatform, example: CalendarPlatform.AIRBNB })
  platform!: CalendarPlatform;

  @ApiPropertyOptional({ example: 'Local Tours Co', nullable: true })
  platformLabel!: string | null;

  /**
   * MASKED unless the caller may manage the connection. An OTA calendar URL is a
   * bearer credential for the operator's account on that platform, so the full
   * value never reaches a client that only holds read access.
   */
  @ApiProperty({ example: 'https://www.airbnb.com/calendar/ical/…ics' })
  url!: string;

  @ApiProperty({
    example: false,
    description: 'True when `url` above is masked.',
  })
  urlMasked!: boolean;

  @ApiProperty({
    enum: CalendarImportMode,
    example: CalendarImportMode.WARN_ONLY,
  })
  importMode!: CalendarImportMode;

  @ApiProperty({
    enum: CalendarSubscriptionStatus,
    example: CalendarSubscriptionStatus.ACTIVE,
  })
  status!: CalendarSubscriptionStatus;

  @ApiProperty({ example: true }) autoSyncEnabled!: boolean;
  @ApiProperty({ example: 60 }) syncIntervalMinutes!: number;

  @ApiPropertyOptional({ example: '2026-08-02T09:12:44.000Z', nullable: true })
  lastPolledAt!: string | null;

  @ApiPropertyOptional({ example: '2026-08-02T09:12:44.000Z', nullable: true })
  lastSuccessAt!: string | null;

  @ApiPropertyOptional({ example: 'HTTP_404', nullable: true })
  lastErrorCode!: string | null;

  @ApiPropertyOptional({
    example: 'This link no longer exists. Regenerate it on that channel.',
    nullable: true,
  })
  lastErrorMessage!: string | null;

  @ApiProperty({ example: 6 }) lastEventCount!: number;

  /** Imported exceptions this connection currently holds. */
  @ApiProperty({ example: 12 }) blockedCount!: number;

  /** Unacknowledged conflicts - the number the UI badges. */
  @ApiProperty({ example: 0 }) openConflictCount!: number;

  @ApiProperty({ example: false }) excludeFromExport!: boolean;

  @ApiPropertyOptional({ example: 'Main Airbnb listing', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: '2026-07-20T10:00:00.000Z' }) createdAt!: string;
}

/** Result of a dry-run URL check, before anything is saved. */
export class ValidateFeedResponseDto {
  @ApiProperty({ example: true }) valid!: boolean;
  @ApiPropertyOptional({ example: 6 }) eventCount?: number;
  @ApiPropertyOptional({ example: 'Airbnb (Klein Curacao)', nullable: true })
  calendarName?: string | null;
  @ApiPropertyOptional({ example: '2026-08-14' }) firstEvent?: string | null;
  @ApiPropertyOptional({ example: '2026-11-02' }) lastEvent?: string | null;
  @ApiPropertyOptional({ example: 4102 }) feedSizeBytes?: number;

  /** Non-fatal notes, e.g. `EMPTY_FEED`. The UI shows these without blocking save. */
  @ApiPropertyOptional({ example: ['EMPTY_FEED'], type: [String] })
  warnings?: string[];

  @ApiPropertyOptional({ example: 'NOT_A_CALENDAR' }) errorCode?: string;
  @ApiPropertyOptional({
    example: 'This is not a calendar feed.',
  })
  message?: string;
}

/** What one sync run did. */
export class SyncRunResponseDto {
  @ApiProperty({ example: 'success' }) outcome!: string;
  @ApiProperty({ example: 6 }) eventsFound!: number;
  @ApiProperty({ example: 2 }) blocksCreated!: number;
  @ApiProperty({ example: 1 }) blocksRemoved!: number;
  @ApiProperty({ example: 0 }) conflictsDetected!: number;
  @ApiPropertyOptional({ example: 'HTTP_404', nullable: true })
  errorCode!: string | null;
  @ApiPropertyOptional({
    example: 'This link no longer exists.',
    nullable: true,
  })
  errorMessage!: string | null;
  @ApiProperty({ example: 1240 }) durationMs!: number;
}

export class DisconnectResponseDto {
  @ApiProperty({ example: 6 }) datesReleased!: number;
  @ApiProperty({ example: 0 }) datesConvertedToManual!: number;
}

/**
 * One run, as the operator reads it.
 *
 * This is the answer to "why did my dates change" and "why has nothing synced
 * since Tuesday" - and in WARN_ONLY, where nothing is written to availability,
 * the log is most of what the feature produces.
 */
export class SyncLogResponseDto {
  @ApiProperty({ example: 'c1a2…' }) id!: string;

  @ApiProperty({ enum: IcalSyncOutcome, example: IcalSyncOutcome.SUCCESS })
  outcome!: IcalSyncOutcome;

  @ApiProperty({ enum: IcalSyncTrigger, example: IcalSyncTrigger.SCHEDULED })
  trigger!: IcalSyncTrigger;

  @ApiPropertyOptional({ example: 200, nullable: true })
  httpStatus!: number | null;

  @ApiProperty({ example: 6 }) eventsFound!: number;

  /**
   * The delta an operator actually cares about. A run that changed nothing
   * shows 0/0 and should read as reassurance, not as a failure.
   */
  @ApiProperty({ example: 2 }) blocksCreated!: number;
  @ApiProperty({ example: 1 }) blocksRemoved!: number;
  @ApiProperty({ example: 0 }) conflictsDetected!: number;

  @ApiPropertyOptional({ example: 'HTTP_404', nullable: true })
  errorCode!: string | null;

  @ApiPropertyOptional({
    example: 'This link no longer exists. Regenerate it on that channel.',
    nullable: true,
  })
  errorMessage!: string | null;

  @ApiProperty({ example: 1240 }) durationMs!: number;
  @ApiProperty({ example: '2026-08-02T09:12:44.000Z' }) startedAt!: string;
}

export class PaginatedSyncLogsDto {
  @ApiProperty({ example: 128 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [SyncLogResponseDto] }) data!: SyncLogResponseDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListSubscriptionsQueryDto {
  @ApiProperty({ example: 'a9f8…' })
  @IsUUID()
  tourId!: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Include disconnected connections, which are retained for history.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDisconnected?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

/**
 * A calendar URL. 2048 is the practical ceiling; OTA links carry a long token in
 * the query string and are routinely 200+ characters.
 */
const URL_RULES = {
  min: 12,
  max: 2048,
} as const;

export class ValidateFeedDto {
  @ApiProperty({ example: 'a9f8…' })
  @IsUUID()
  tourId!: string;

  @ApiProperty({
    example: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc123',
  })
  @IsString()
  @Length(URL_RULES.min, URL_RULES.max)
  url!: string;
}

export class CreateCalendarSubscriptionDto {
  @ApiProperty({ example: 'a9f8…' })
  @IsUUID()
  tourId!: string;

  @ApiProperty({ enum: CalendarPlatform, example: CalendarPlatform.AIRBNB })
  @IsEnum(CalendarPlatform)
  platform!: CalendarPlatform;

  @ApiPropertyOptional({
    example: 'Local Tours Co',
    description:
      'Required when platform is OTHER; a label only, it changes nothing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[\p{L}\p{N} .\-&']+$/u, {
    // No URLs: this is a display name, and one that looked like a link would be
    // mistaken for the feed address in every list and error message.
    message:
      'platformLabel may contain letters, numbers, spaces and . - & only',
  })
  platformLabel?: string;

  @ApiProperty({
    example: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc123',
  })
  @IsString()
  @Length(URL_RULES.min, URL_RULES.max)
  url!: string;

  @ApiPropertyOptional({
    enum: CalendarImportMode,
    example: CalendarImportMode.WARN_ONLY,
    description:
      'Defaults to WARN_ONLY. iCal carries no seat count, so on a multi-capacity tour a busy event must not close the whole day.',
  })
  @IsOptional()
  @IsEnum(CalendarImportMode)
  importMode?: CalendarImportMode;

  @ApiPropertyOptional({ example: 60, enum: SYNC_INTERVALS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...SYNC_INTERVALS])
  syncIntervalMinutes?: number;

  @ApiPropertyOptional({ example: 'Main Airbnb listing, EU account' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateCalendarSubscriptionDto {
  /**
   * `platform` is deliberately absent: existing blocks are attributed to it, so
   * changing it would relabel history. Delete and re-add instead.
   */
  @ApiPropertyOptional({
    example: 'https://www.airbnb.com/calendar/ical/9.ics',
  })
  @IsOptional()
  @IsString()
  @Length(URL_RULES.min, URL_RULES.max)
  url?: string;

  @ApiPropertyOptional({ enum: CalendarImportMode })
  @IsOptional()
  @IsEnum(CalendarImportMode)
  importMode?: CalendarImportMode;

  @ApiPropertyOptional({ example: 60, enum: SYNC_INTERVALS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...SYNC_INTERVALS])
  syncIntervalMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Exclude this source from our outbound feed, to break an echo loop.',
  })
  @IsOptional()
  @IsBoolean()
  excludeFromExport?: boolean;

  @ApiPropertyOptional({ example: 'Main Airbnb listing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 'Local Tours Co' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  platformLabel?: string;
}

export class DisconnectCalendarSubscriptionDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'False (default) keeps the dates blocked as manual closures. True frees them. A channel that stopped syncing is not a channel whose dates became free.',
  })
  @IsOptional()
  @IsBoolean()
  releaseDates?: boolean;
}

export class ListSyncLogsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
