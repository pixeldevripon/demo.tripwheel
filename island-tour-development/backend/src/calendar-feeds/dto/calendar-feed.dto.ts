import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarFeedKind } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CalendarFeedResponseDto {
  @ApiProperty({ example: 'c1a2b3c4-…' }) id!: string;

  @ApiProperty({ enum: CalendarFeedKind, example: CalendarFeedKind.BOOKINGS })
  kind!: CalendarFeedKind;

  @ApiPropertyOptional({ example: 'Ops calendar', nullable: true })
  label!: string | null;

  /**
   * The full subscribe URL, token included. Returned on every read (not just on
   * create): a calendar subscription is a URL the operator re-copies whenever
   * they add a device, so hiding it after creation would only force a needless
   * rotation. Rotate or revoke if it leaks.
   */
  @ApiProperty({
    example:
      'https://api.tripwheel.app/api/v1/calendar-feeds/8Kj2…/calendar.ics',
  })
  url!: string;

  @ApiPropertyOptional({ example: '2026-07-29T09:12:44.000Z', nullable: true })
  lastFetchedAt!: string | null;

  @ApiProperty({ example: 42 }) fetchCount!: number;

  @ApiProperty({ example: '2026-07-20T10:00:00.000Z' }) createdAt!: string;
}

export class CalendarFeedListResponseDto {
  @ApiProperty({ type: [CalendarFeedResponseDto] })
  data!: CalendarFeedResponseDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CreateCalendarFeedDto {
  @ApiProperty({
    enum: CalendarFeedKind,
    example: CalendarFeedKind.BOOKINGS,
    description:
      'BOOKINGS needs VIEW_BOOKINGS (it exposes traveller names); DEPARTURES needs only MANAGE_AVAILABILITY.',
  })
  @IsEnum(CalendarFeedKind)
  kind!: CalendarFeedKind;

  @ApiPropertyOptional({ example: 'Ops calendar', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
