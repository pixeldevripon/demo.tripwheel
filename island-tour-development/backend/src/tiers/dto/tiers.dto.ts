import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SpotlightStatus, TierKey } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class SpotlightRequestResponseDto {
  @ApiProperty({ example: 'c1a2b3c4-…' }) id!: string;
  @ApiProperty({ example: 'tour-uuid' }) tourId!: string;
  @ApiProperty({ example: 'operator-uuid' }) operatorId!: string;
  @ApiProperty({ example: 'destination-uuid' }) destinationId!: string;
  @ApiProperty({ enum: SpotlightStatus, example: SpotlightStatus.REQUESTED })
  status!: SpotlightStatus;
  @ApiProperty({ example: '2026-06-25T10:00:00.000Z' }) requestedAt!: string;
  @ApiPropertyOptional({ nullable: true, example: '2026-06-26T09:00:00.000Z' })
  approvedAt!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'admin-user-id' })
  approvedBy!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-07-01T00:00:00.000Z' })
  startsAt!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-07-31T00:00:00.000Z' })
  endsAt!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Approved for July high season.',
  })
  note!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-07-01T00:00:00.000Z' })
  requestedStartsAt!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 30 })
  requestedDurationDays!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 'Eligibility bar not met.' })
  rejectionReason!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'submitting-user-id' })
  requestedBy!: string | null;
}

export class TourSpotlightHistoryDto {
  @ApiPropertyOptional({
    type: SpotlightRequestResponseDto,
    nullable: true,
    description:
      'The current live/pending request (ACTIVE > APPROVED > REQUESTED), if any.',
  })
  current!: SpotlightRequestResponseDto | null;

  @ApiProperty({
    type: SpotlightRequestResponseDto,
    isArray: true,
    description: 'All requests for the tour, newest first.',
  })
  history!: SpotlightRequestResponseDto[];
}

export class SpotlightQueueDto {
  @ApiProperty({
    example: 2,
    description:
      'Count of APPROVED+ACTIVE (un-ended) requests for the queried destination.',
  })
  activeCount!: number;

  @ApiProperty({
    type: SpotlightRequestResponseDto,
    isArray: true,
    description: 'Matching requests, newest first.',
  })
  data!: SpotlightRequestResponseDto[];
}

export class TierResponseDto {
  @ApiProperty({ example: 'tour-uuid' }) tourId!: string;
  @ApiProperty({ enum: TierKey, example: TierKey.premium }) tierKey!: TierKey;
  @ApiProperty({
    example: 30.0,
    description: 'Commission percentage for the tier.',
  })
  commissionTier!: number;
  @ApiProperty({
    example: 1,
    description: 'Denormalized sort key (lower wins).',
  })
  tierRank!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-25T10:00:00.000Z',
    description:
      '30-day lock; further tier changes rejected while in the future.',
  })
  tierLockedUntil!: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class SpotlightQueueQueryDto {
  @ApiPropertyOptional({ example: 'destination-uuid' })
  @IsOptional()
  @IsString()
  destinationId?: string;

  @ApiPropertyOptional({ enum: SpotlightStatus })
  @IsOptional()
  @IsEnum(SpotlightStatus)
  status?: SpotlightStatus;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CreateSpotlightRequestDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      "Operator's preferred start date (admin still sets the final window).",
  })
  @IsOptional()
  @IsDateString()
  requestedStartsAt?: string;

  @ApiPropertyOptional({
    example: 30,
    description: "Operator's preferred length in days.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  requestedDurationDays?: number;
}

export class ApproveSpotlightDto {
  @ApiProperty({
    example: '2026-07-01T00:00:00.000Z',
    description: 'Window start.',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({
    example: '2026-07-31T00:00:00.000Z',
    description: 'Window end.',
  })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Approved for July high season.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectSpotlightDto {
  @ApiProperty({ example: 'Eligibility bar not met (needs >=10 reviews).' })
  @IsString()
  @MaxLength(1000)
  rejectionReason!: string;
}

export class ChangeTierDto {
  @ApiProperty({
    enum: TierKey,
    example: TierKey.premium,
    description: 'Operator-chosen tier.',
  })
  @IsEnum(TierKey)
  tierKey!: TierKey;
}
