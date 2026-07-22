import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Locale,
  ReviewFlagReason,
  ReviewFlagStatus,
  ReviewModerationStatus,
  ReviewResponseAuthor,
  ReviewSource,
  ReviewerType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Supported sort orders for the public review list. `helpful` is deliberately
 * not here: helpful votes are deferred to V2 by the master.
 */
export const REVIEW_SORTS = ['newest', 'rating_desc', 'rating_asc'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tourId!: string;
  @ApiProperty() operatorId!: string;
  @ApiProperty({ example: 5, description: 'Overall rating 1–5.' })
  rating!: number;
  @ApiPropertyOptional({ nullable: true, example: 4 }) ratingValue!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 5 }) ratingGuide!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 5 }) ratingSafety!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 'Unforgettable sunset' })
  title!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Comment in the requested locale (fallback to any).',
  })
  comment!: string | null;
  @ApiProperty({
    enum: Locale,
    description: 'Locale the returned comment is in.',
  })
  locale!: Locale;
  @ApiPropertyOptional({ nullable: true, example: 'Ada B.' }) reviewerInitial!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: 'NL' }) reviewerCountry!:
    | string
    | null;
  @ApiPropertyOptional({
    enum: ReviewerType,
    nullable: true,
    description: 'Guest type (LD36). Null when the reviewer skipped step 3b.',
  })
  reviewerType!: ReviewerType | null;
  @ApiPropertyOptional({ nullable: true, example: 7 }) travelMonth!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 2026 }) travelYear!:
    | number
    | null;
  @ApiProperty({ type: [String], example: [] }) photos!: string[];
  @ApiProperty({
    type: [String],
    example: ['calm water', 'great crew'],
    description: 'Admin-set highlight chips (pre-AI LD29 Tier 3).',
  })
  themeTags!: string[];
  @ApiProperty({
    example: 0,
    description: 'Deferred to V2; never incremented.',
  })
  helpfulCount!: number;
  @ApiProperty({
    enum: ReviewSource,
    description: 'Only NATIVE appears on tour pages or in tour aggregates.',
  })
  source!: ReviewSource;
  @ApiProperty({
    example: true,
    description: 'Always true for NATIVE - reviews are booking-gated.',
  })
  isVerified!: boolean;
  @ApiProperty({ enum: ReviewModerationStatus })
  moderationStatus!: ReviewModerationStatus;
  @ApiPropertyOptional({ nullable: true }) responseText!: string | null;
  @ApiPropertyOptional({ enum: ReviewResponseAuthor, nullable: true })
  responseAuthor!: ReviewResponseAuthor | null;
  @ApiPropertyOptional({ nullable: true }) responseAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/**
 * A moderation-queue row. Extends the public shape with the operational context
 * a moderator needs to triage without opening three other screens: which tour,
 * which operator, which booking, and whether anyone has flagged it.
 */
export class AdminReviewResponseDto extends ReviewResponseDto {
  @ApiPropertyOptional({ nullable: true, example: 'Klein Curaçao Day Trip' })
  tourTitle!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Blue Bay Charters' })
  operatorName!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'IT-2026-00042',
    description: 'Human booking reference - the verification audit trail.',
  })
  bookingRef!: string | null;
  @ApiProperty({ example: false }) isFeatured!: boolean;
  @ApiPropertyOptional({ nullable: true }) rejectionReason!: string | null;
  @ApiProperty({
    example: 0,
    description: 'Open flags awaiting an Island Tours decision.',
  })
  openFlagCount!: number;
}

export class RatingBucketDto {
  @ApiProperty({ example: 5, description: 'Star value 1–5.' }) stars!: number;
  @ApiProperty({ example: 12 }) count!: number;
}

export class ThemeFacetDto {
  @ApiProperty({ example: 'Great guide' }) tag!: string;
  @ApiProperty({
    example: 9,
    description: 'Approved reviews carrying the tag.',
  })
  count!: number;
}

export class ReviewSummaryDto {
  @ApiProperty() tourId!: string;
  @ApiProperty({
    enum: ['tour', 'operator', 'none'],
    description:
      'LD11 cold-start: which entity the displayed rating comes from.',
  })
  source!: 'tour' | 'operator' | 'none';
  @ApiPropertyOptional({
    nullable: true,
    example: 4.6,
    description: 'Displayed rating (1dp), or null to hide.',
  })
  rating!: number | null;
  @ApiProperty({
    example: 12,
    description: 'Review count behind the displayed rating.',
  })
  reviewCount!: number;
  @ApiProperty({
    example: 12,
    description: "This tour's own approved-review count.",
  })
  approvedCount!: number;
  @ApiProperty({
    type: [RatingBucketDto],
    description:
      'Star distribution (approved only). Frontend renders at ≥3 (LD31).',
  })
  distribution!: RatingBucketDto[];
  @ApiProperty({
    type: [ThemeFacetDto],
    description:
      "Theme tags present on this tour's approved reviews, most-used first. " +
      'Backs the theme chips (FE-9); each tag is a valid `themeTag` filter ' +
      'value for GET /reviews.',
  })
  themes!: ThemeFacetDto[];
  @ApiProperty({
    example: 7,
    description:
      'Approved reviews carrying at least one photo. The customer-photo ' +
      'carousel is gated on this at ≥3 (FE-10) - a strip built from one ' +
      "guest's three snapshots is not social proof.",
  })
  photoCount!: number;
  @ApiPropertyOptional({ nullable: true, example: 4.5 }) avgValue!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 4.8 }) avgGuide!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true, example: 4.9 }) avgSafety!:
    | number
    | null;
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
    minimum: 1,
    maximum: 5,
    description:
      'Filter to a single star value. Backs the clickable star distribution ' +
      'chart, which is live from launch (LD31).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description:
      'Filter to reviews carrying this theme tag. Backs the theme chips above ' +
      'the review list (FE-9). Server-side rather than the client-side filter ' +
      'the plan sketched: the rating filter above already round-trips, and two ' +
      'filter mechanisms cannot be combined coherently - a client-side theme ' +
      'filter would only ever see the pages already loaded, so it would ' +
      'silently disagree with the star filter about what "matching" means.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  themeTag?: string;

  // `helpful` is deliberately absent: helpful votes are deferred to V2 by the
  // master, so there is no vote to sort by at launch. `@IsIn` rather than a bare
  // `@IsString`, so an unsupported sort is a 400 instead of silently falling
  // through to newest and looking like the sort control is broken.
  @ApiPropertyOptional({
    enum: REVIEW_SORTS,
    default: 'newest',
  })
  @IsOptional()
  @IsIn(REVIEW_SORTS)
  sort?: ReviewSort;

  @ApiPropertyOptional({
    enum: Locale,
    description: 'Preferred comment locale (fallback to any).',
  })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

export class SummaryQueryDto {
  @ApiProperty()
  @IsUUID()
  tourId!: string;
}

/**
 * Cross-tour admin/operator listing. Unlike the public list this is NOT scoped to
 * one tour and NOT limited to APPROVED - moderating a queue you cannot see the
 * whole of is not moderating.
 */
export class AdminReviewsQueryDto {
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

  @ApiPropertyOptional({
    enum: ReviewModerationStatus,
    description: 'Omit for every status.',
  })
  @IsOptional()
  @IsEnum(ReviewModerationStatus)
  status?: ReviewModerationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tourId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Only reviews carrying photos.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasPhotos?: boolean;

  @ApiPropertyOptional({ description: 'Only reviews with an open flag.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  flagged?: boolean;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ description: 'Submitted on or after (ISO date).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Submitted on or before (ISO date).' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Free text over the reviewer name, title and comment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: ['oldest', 'newest'],
    default: 'oldest',
    description:
      'Queue default is oldest-first: a moderation backlog is cleared from the ' +
      'bottom, and the oldest pending review is the one a traveller has been ' +
      'waiting on longest.',
  })
  @IsOptional()
  @IsIn(['oldest', 'newest'])
  sort?: 'oldest' | 'newest';
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

  @ApiPropertyOptional({
    enum: ReviewModerationStatus,
    default: ReviewModerationStatus.PENDING,
  })
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
  @ApiProperty({
    description:
      'A confirmed/redeemed booking owned by the caller, not yet reviewed.',
  })
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'Value for money.',
  })
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

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'Safety / organization.',
  })
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

  @ApiProperty({
    minLength: 10,
    maxLength: 4000,
    description: 'The review text.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  comment!: string;

  @ApiPropertyOptional({
    enum: Locale,
    default: Locale.en,
    description: 'Locale the comment is written in.',
  })
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
    description:
      'Guest type (LD36). Collected from launch; the consumer filter is V2.',
  })
  @IsOptional()
  @IsEnum(ReviewerType)
  reviewerType?: ReviewerType;
}

/** Statuses a moderator may transition INTO. PENDING is entry-only. */
export const MODERATABLE_STATUSES = [
  ReviewModerationStatus.APPROVED,
  ReviewModerationStatus.HELD,
  ReviewModerationStatus.REJECTED,
] as const;

export class ModerateReviewDto {
  @ApiProperty({
    enum: MODERATABLE_STATUSES,
    description:
      'APPROVED publishes and feeds aggregates. HELD parks a review that needs ' +
      'a second look without publishing or rejecting it. REJECTED requires a reason.',
  })
  @IsIn(MODERATABLE_STATUSES)
  status!: (typeof MODERATABLE_STATUSES)[number];

  @ApiPropertyOptional({
    description:
      'Required when rejecting. Must be a documented POLICY ground (fake, ' +
      'abusive, off-topic, personal data) - never that the review is negative.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class BulkModerateReviewsDto {
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty({ enum: MODERATABLE_STATUSES })
  @IsIn(MODERATABLE_STATUSES)
  status!: (typeof MODERATABLE_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Required when rejecting.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class RespondToReviewDto {
  @ApiProperty({ minLength: 2, maxLength: 2000 })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  response!: string;
}

export class SetThemeTagsDto {
  @ApiProperty({
    type: [String],
    maxItems: 5,
    example: ['calm water', 'great crew'],
    description: 'Highlight chips shown above the review cards. Admin-only.',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  themeTags!: string[];
}

export class FeatureReviewDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isFeatured!: boolean;
}

export class FlagReviewDto {
  @ApiProperty({
    enum: ReviewFlagReason,
    description:
      'The policy ground. There is deliberately no "negative" or "unfair" ' +
      'option: sentiment is not a removal ground under the Omnibus Directive.',
  })
  @IsEnum(ReviewFlagReason)
  reason!: ReviewFlagReason;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ResolveFlagDto {
  @ApiProperty({
    enum: [ReviewFlagStatus.RESOLVED, ReviewFlagStatus.DISMISSED],
  })
  @IsIn([ReviewFlagStatus.RESOLVED, ReviewFlagStatus.DISMISSED])
  status!: ReviewFlagStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

export class DeleteReviewDto {
  @ApiPropertyOptional({
    maxLength: 500,
    description:
      'The documented policy ground, recorded on the audit trail. Required for ' +
      'a moderator; optional when an author deletes their own review.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
