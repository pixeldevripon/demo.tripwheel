import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InboxCategory, InboxEvent } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class InboxNotificationResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: InboxCategory, example: InboxCategory.TOURS })
  category!: InboxCategory;

  @ApiProperty({ enum: InboxEvent, example: InboxEvent.TOUR_APPROVED })
  event!: InboxEvent;

  @ApiProperty({ example: 'Sunset Catamaran Cruise was approved' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Island Tours publishes it from here.',
    nullable: true,
  })
  body!: string | null;

  @ApiProperty({
    example: '/trips/3fa85f64/edit?step=review',
    description:
      'Dashboard-relative path. Relative on purpose: it survives a domain change and cannot bounce the recipient off-site.',
  })
  url!: string;

  @ApiPropertyOptional({ example: 'tour', nullable: true })
  entityType!: string | null;

  @ApiPropertyOptional({ example: '3fa85f64', nullable: true })
  entityId!: string | null;

  @ApiPropertyOptional({
    example: '2026-07-29T08:00:00.000Z',
    nullable: true,
    description: 'Null while unread.',
  })
  readAt!: Date | null;

  @ApiProperty({ example: '2026-07-29T07:59:00.000Z' })
  createdAt!: Date;
}

export class InboxListResponseDto {
  @ApiProperty({ type: [InboxNotificationResponseDto] })
  data!: InboxNotificationResponseDto[];

  @ApiPropertyOptional({
    example: '2026-07-29T07:59:00.000Z',
    nullable: true,
    description:
      'Pass back as `cursor` for the next page. Null when the list is exhausted.',
  })
  nextCursor!: string | null;
}

export class InboxSummaryResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Total unread - the number on the bell.',
  })
  unread!: number;

  @ApiProperty({
    example: { TOURS: 1, BOOKINGS: 3 },
    description:
      'Unread per category, for the sidebar badges. Only non-zero categories are present. Shares one query with `unread`, so a badge can never disagree with the bell.',
  })
  byCategory!: Partial<Record<InboxCategory, number>>;

  @ApiPropertyOptional({
    example: '2026-07-29T07:59:00.000Z',
    nullable: true,
    description:
      'Newest notification of any read state; null for an empty inbox.',
  })
  latestAt!: Date | null;
}

export class InboxDigestResponseDto {
  @ApiProperty({
    type: [InboxNotificationResponseDto],
    description:
      'The unread notifications to show once per session. Empty when there is nothing new - the client must not render an empty modal.',
  })
  data!: InboxNotificationResponseDto[];

  @ApiProperty({
    example: 12,
    description: 'Total unread, so the modal can say "and 7 more".',
  })
  unread!: number;
}

export class InboxMarkReadResponseDto {
  @ApiProperty({ example: 3, description: 'How many rows changed.' })
  updated!: number;
}

export class InboxClearResponseDto {
  @ApiProperty({ example: 3, description: 'How many rows were removed.' })
  deleted!: number;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class ListInboxQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-29T07:59:00.000Z',
    description:
      'createdAt of the last row of the previous page. Keyset, not offset: the list mutates while you page it.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: InboxCategory })
  @IsOptional()
  @IsEnum(InboxCategory)
  category?: InboxCategory;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class MarkInboxReadDto {
  @ApiPropertyOptional({
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    description: 'Specific rows. Ignored when `all` is true.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids?: string[];

  @ApiPropertyOptional({
    enum: InboxCategory,
    description: 'Mark everything unread in one category - the badge clear.',
  })
  @IsOptional()
  @IsEnum(InboxCategory)
  category?: InboxCategory;

  @ApiPropertyOptional({
    example: false,
    description: 'Mark the whole inbox read. Wins over `ids` and `category`.',
  })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

/**
 * Deleting, not hiding. Same shape as marking read so the two controls behave
 * identically - including refusing an empty body, which matters more here.
 */
export class ClearInboxDto {
  @ApiPropertyOptional({
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    description: 'Specific rows. Ignored when `all` is true.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids?: string[];

  @ApiPropertyOptional({
    enum: InboxCategory,
    description: 'Clear one category.',
  })
  @IsOptional()
  @IsEnum(InboxCategory)
  category?: InboxCategory;

  @ApiPropertyOptional({
    example: false,
    description: 'Clear the whole inbox. Wins over `ids` and `category`.',
  })
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Restrict the delete to rows already read - the safe sweep. Combine with `all` for "clear everything I have seen".',
  })
  @IsOptional()
  @IsBoolean()
  onlyRead?: boolean;
}
