import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Locale, ReviewModerationStatus } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty() operatorId!: string;
  @ApiProperty({ example: 5, description: 'Overall rating 1–5.' }) rating!: number;
  @ApiPropertyOptional({ nullable: true, example: 4 }) ratingValue!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 5 }) ratingGuide!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 5 }) ratingSafety!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 'Unforgettable sunset' }) title!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Comment in the requested locale (fallback to any).' })
  comment!: string | null;
  @ApiProperty({ enum: Locale, description: 'Locale the returned comment is in.' }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true, example: 'Ada B.' }) reviewerInitial!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'NL' }) reviewerCountry!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 7 }) travelMonth!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 2026 }) travelYear!: number | null;
  @ApiProperty({ type: [String], example: [] }) photos!: string[];
  @ApiProperty({ example: 0 }) helpfulCount!: number;
  @ApiProperty({ example: true, description: 'Always true - reviews are booking-gated.' })
  isVerified!: boolean;
  @ApiProperty({ enum: ReviewModerationStatus }) moderationStatus!: ReviewModerationStatus;
  @ApiPropertyOptional({ nullable: true }) operatorResponse!: string | null;
  @ApiPropertyOptional({ nullable: true }) operatorRespondedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class RatingBucketDto {
  @ApiProperty({ example: 5, description: 'Star value 1–5.' }) stars!: number;
  @ApiProperty({ example: 12 }) count!: number;
}

export class ReviewSummaryDto {
  @ApiProperty() tourId!: string;
  @ApiProperty({
    enum: ['tour', 'operator', 'none'],
    description: 'LD11 cold-start: which entity the displayed rating comes from.',
  })
  source!: 'tour' | 'operator' | 'none';
  @ApiPropertyOptional({ nullable: true, example: 4.6, description: 'Displayed rating (1dp), or null to hide.' })
  rating!: number | null;
  @ApiProperty({ example: 12, description: 'Review count behind the displayed rating.' })
  reviewCount!: number;
  @ApiProperty({ example: 12, description: "This tour's own approved-review count." })
  approvedCount!: number;
  @ApiProperty({
    type: [RatingBucketDto],
    description: 'Star distribution (approved only). Frontend renders at ≥3 (LD31).',
  })
  distribution!: RatingBucketDto[];
  @ApiPropertyOptional({ nullable: true, example: 4.5 }) avgValue!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 4.8 }) avgGuide!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 4.9 }) avgSafety!: number | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListReviewsQueryDto {
  @ApiProperty({ description: 'Tour to list approved reviews for.' })
  @IsUUID()
  tourId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['newest', 'rating_desc', 'rating_asc', 'helpful'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  sort?: 'newest' | 'rating_desc' | 'rating_asc' | 'helpful';

  @ApiPropertyOptional({ enum: Locale, description: 'Preferred comment locale (fallback to any).' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

export class SummaryQueryDto {
  @ApiProperty()
  @IsUUID()
  tourId!: string;
}

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ReviewModerationStatus, default: ReviewModerationStatus.PENDING })
  @IsOptional()
  @IsEnum(ReviewModerationStatus)
  status?: ReviewModerationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tourId?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class CreateReviewDto {
  @ApiProperty({ description: 'A confirmed/redeemed booking owned by the caller, not yet reviewed.' })
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Value for money.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingValue?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Guide / host.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingGuide?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Safety / organization.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingSafety?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ minLength: 10, maxLength: 4000, description: 'The review text.' })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  comment!: string;

  @ApiPropertyOptional({ enum: Locale, default: Locale.en, description: 'Locale the comment is written in.' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ type: [String], description: 'Photo URLs (max 8).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photos?: string[];
}

export class ModerateReviewDto {
  @ApiProperty({ enum: [ReviewModerationStatus.APPROVED, ReviewModerationStatus.REJECTED] })
  @IsEnum(ReviewModerationStatus)
  status!: ReviewModerationStatus;

  @ApiPropertyOptional({ description: 'Required when rejecting.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class OperatorResponseDto {
  @ApiProperty({ minLength: 2, maxLength: 2000 })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  response!: string;
}
