import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale, ReviewerType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

/**
 * What the tokenized review page is allowed to know.
 *
 * Deliberately narrow. The token travels in an email and may be forwarded, so it
 * must not unlock the booking's price, contact details or payment data.
 */
export class ReviewInvitationResponseDto {
  @ApiProperty() token!: string;
  @ApiProperty() tourId!: string;
  @ApiPropertyOptional({ nullable: true, example: 'Klein Curaçao Day Trip' })
  tourName!: string | null;
  @ApiPropertyOptional({ nullable: true }) tourSlug!: string | null;
  @ApiPropertyOptional({ nullable: true }) destinationSlug!: string | null;
  @ApiPropertyOptional({ nullable: true }) heroImage!: string | null;
  @ApiPropertyOptional({ nullable: true }) operatorName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Ada' })
  guestFirstName!: string | null;
  @ApiProperty({ example: '2026-07-14', description: 'Tour date (local).' })
  travelDate!: string;
  @ApiProperty({ example: false }) alreadyReviewed!: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

/**
 * Step 1. The ONLY required step, and it commits on tap - a guest who rates and
 * closes the tab has still left a countable review.
 */
export class StartReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}

/**
 * Steps 2, 3 and 3b. Every field optional and independently savable, so each
 * step can persist on its own without the guest reaching the end of the flow.
 */
export class EnrichReviewDto {
  @ApiPropertyOptional({ minLength: 10, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  comment?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: Locale, default: Locale.en })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ type: [String], description: 'Photo URLs (max 8).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({
    enum: ReviewerType,
    description: 'Step 3b guest type (LD36). One tap, optional.',
  })
  @IsOptional()
  @IsEnum(ReviewerType)
  reviewerType?: ReviewerType;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingValue?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingGuide?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  ratingSafety?: number;
}

/**
 * Step 4b, the private service-recovery channel. Offered ALONGSIDE the neutral
 * platform-review invitation on a low rating, never instead of it.
 */
export class SubmitFeedbackDto {
  @ApiProperty({ minLength: 2, maxLength: 4000 })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  message!: string;
}
