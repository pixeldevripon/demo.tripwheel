import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CollectionDisplayStyle,
  CollectionStatus,
  CollectionType,
  Currency,
  PricingModel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class CollectionResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  destinationId!: string;
  @ApiProperty({ example: 'Top 10 Tours' }) name!: string;
  @ApiProperty({ example: 'top-10-tours' }) slug!: string;
  @ApiProperty({ enum: CollectionType }) collectionType!: CollectionType;
  @ApiProperty({ enum: CollectionStatus, example: CollectionStatus.DRAFT })
  status!: CollectionStatus;
  @ApiProperty({
    enum: CollectionDisplayStyle,
    example: CollectionDisplayStyle.PERSONA,
  })
  displayStyle!: CollectionDisplayStyle;
  @ApiProperty({ type: [String], example: [] }) tourIds!: string[];
  @ApiPropertyOptional({ example: { booking_type: 'private' }, nullable: true })
  filterQuery!: unknown;
  @ApiPropertyOptional({ example: null, nullable: true }) heroImage!:
    | string
    | null;
  @ApiPropertyOptional({ example: null, nullable: true }) ogImage!:
    | string
    | null;
  @ApiProperty({ example: 'recommended' }) sortOrder!: string;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty({ example: false }) isSeeded!: boolean;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ example: '2024-06-01T08:00:00.000Z' }) updatedAt!: Date;
}

export class CollectionLocalizedResponseDto extends CollectionResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class CollectionDetailResponseDto extends CollectionLocalizedResponseDto {
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiProperty({
    type: [Object],
    description: 'Resolved tours (manual order, or dynamic filter result)',
  })
  tours!: unknown[];
}

export class CollectionTranslationEntryDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) curationNote!: string | null;
  @ApiPropertyOptional({ nullable: true }) eyebrowLabel!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class CollectionTourRationaleResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000099' })
  tourId!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({
    example: 'An uninhabited island, 10km offshore, sea turtles, no signal.',
  })
  rationale!: string;
}

export class CollectionTourEntryDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000099' })
  tourId!: string;
  @ApiProperty({ example: 0 }) position!: number;
}

export class CollectionPageContentResponseDto {
  @ApiProperty({ enum: Locale, example: Locale.nl }) locale!: Locale;
  @ApiPropertyOptional({ nullable: true }) aboutText!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) metaDescription!: string | null;
}

export class FaqResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ enum: Locale, example: Locale.en }) locale!: Locale;
  @ApiProperty({ example: 'How are these tours chosen?' }) question!: string;
  @ApiProperty({ example: 'Hand-picked by our editors.' }) answer!: string;
  @ApiProperty({ example: 0 }) displayOrder!: number;
  @ApiProperty({ example: true }) isActive!: boolean;
}

export class DeleteMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' }) message!: string;
}

export class CollectionFastStatsDto {
  @ApiProperty({ example: 10, description: 'Number of resolved tours' })
  tourCount!: number;
  @ApiPropertyOptional({
    example: 36,
    nullable: true,
    description: 'min(priceFrom) across resolved tours',
  })
  fromPrice!: number | null;
}

export class RelatedCollectionDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Best for couples' }) name!: string;
  @ApiProperty({ example: 'best-for-couples' }) slug!: string;
  @ApiPropertyOptional({ example: null, nullable: true }) heroImage!:
    | string
    | null;
}

/** Full §10 render payload for a published collection page. */
export class CollectionRenderResponseDto extends CollectionLocalizedResponseDto {
  @ApiPropertyOptional({ nullable: true }) overview!: string | null;
  @ApiPropertyOptional({ nullable: true }) h1Override!: string | null;
  @ApiPropertyOptional({ nullable: true }) breadcrumbLabel!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Chosen by Islanders' })
  curationNote!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'BEST THINGS TO DO' })
  eyebrowLabel!: string | null;
  @ApiProperty({
    type: [Object],
    description:
      'Resolved tours in render order. MANUAL tours carry { rationale } for the locale (fallback en).',
  })
  tours!: unknown[];
  @ApiProperty({ type: CollectionFastStatsDto })
  fastStats!: CollectionFastStatsDto;
  @ApiProperty({ type: [FaqResponseDto] }) faqs!: FaqResponseDto[];
  @ApiProperty({ type: [RelatedCollectionDto] })
  relatedCollections!: RelatedCollectionDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class FaqLocaleQueryDto {
  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

export class ActiveCollectionsQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug' })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class CollectionBySlugQueryDto {
  @ApiProperty({ example: 'curacao', description: 'Destination slug' })
  @IsString()
  destinationSlug!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * Saved filter for a DYNAMIC collection. Every key maps 1:1 to a `TourQueryDto`
 * field consumed by the tour-listing engine (`ToursService.findAll`) when the
 * collection is resolved. Validated (whitelisted) so an unknown key is rejected.
 */
export class CollectionFilterQueryDto {
  @ApiPropertyOptional({ description: 'Single category id.' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Multi-select category ids (a tour in ANY matches).',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Activity hub id.' })
  @IsOptional()
  @IsUUID('4')
  hubId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 60, description: 'Min duration in minutes.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional({
    example: 480,
    description: 'Max duration in minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMax?: number;

  @ApiPropertyOptional({ example: 4.0, description: 'Minimum average rating.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  ratingMin?: number;

  @ApiPropertyOptional({
    example: 48,
    description:
      'Free-cancellation cutoff ceiling in hours (cancellationHours <= value).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationMaxHours?: number;

  @ApiPropertyOptional({ description: 'Only tours that offer pickup.' })
  @IsOptional()
  @IsBoolean()
  pickupAvailable?: boolean;

  @ApiPropertyOptional({
    description: "Only tours flagged as a locals' favourite.",
  })
  @IsOptional()
  @IsBoolean()
  isLocalsFavourite?: boolean;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({
    description:
      'Dictionary attribute filters: { attributeKey: value | value[] }. OR within a key, AND across keys.',
    example: { boat_type: ['catamaran', 'yacht'], booking_type: 'private' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string | string[]>;
}

export class CreateCollectionDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({ example: 'Top 10 Tours' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'top-10-tours',
    description:
      'Auto-generated from name when omitted. Must not equal a category slug.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiProperty({ enum: CollectionType, example: CollectionType.MANUAL })
  @IsEnum(CollectionType)
  collectionType!: CollectionType;

  @ApiPropertyOptional({
    type: [String],
    description: 'MANUAL: ordered tour ids',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tourIds?: string[];

  @ApiPropertyOptional({
    type: CollectionFilterQueryDto,
    description:
      'DYNAMIC: saved filter (each key maps to a TourQueryDto field).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollectionFilterQueryDto)
  filterQuery?: CollectionFilterQueryDto;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Open Graph social-share image. Falls back to heroImage.',
  })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({
    example: 'recommended',
    description: 'recommended | price_asc | price_desc | rating | newest',
  })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiPropertyOptional({
    enum: CollectionStatus,
    default: CollectionStatus.DRAFT,
    description: 'Defaults to DRAFT',
  })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @ApiPropertyOptional({
    enum: CollectionDisplayStyle,
    default: CollectionDisplayStyle.PERSONA,
    description: 'Defaults to PERSONA',
  })
  @IsOptional()
  @IsEnum(CollectionDisplayStyle)
  displayStyle?: CollectionDisplayStyle;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({ example: 'Top 10 Tours' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    example: 'top-10-tours',
    description:
      'Renaming issues an automatic 301 redirect; the old slug is protected by a 90-day reuse cooldown. Must not equal a category slug.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tourIds?: string[];

  @ApiPropertyOptional({
    type: CollectionFilterQueryDto,
    description:
      'DYNAMIC: saved filter (each key maps to a TourQueryDto field).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollectionFilterQueryDto)
  filterQuery?: CollectionFilterQueryDto;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Open Graph social-share image. Falls back to heroImage.',
  })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({ example: 'rating' })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiPropertyOptional({ enum: CollectionDisplayStyle })
  @IsOptional()
  @IsEnum(CollectionDisplayStyle)
  displayStyle?: CollectionDisplayStyle;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CollectionTranslationFieldsDto {
  @ApiPropertyOptional({ example: 'Top 10 Tours' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
  @ApiPropertyOptional({ example: 'Onze top 10 tours' })
  @IsOptional()
  @IsString()
  overview?: string;
  @ApiPropertyOptional({ example: 'Gekozen door eilandbewoners' })
  @IsOptional()
  @IsString()
  curationNote?: string;
  @ApiPropertyOptional({ example: 'BESTE DINGEN OM TE DOEN' })
  @IsOptional()
  @IsString()
  eyebrowLabel?: string;
  @ApiPropertyOptional({ example: 'Top 10 Tours op Curaçao' })
  @IsOptional()
  @IsString()
  h1Override?: string;
  @ApiPropertyOptional({ example: 'Top 10' })
  @IsOptional()
  @IsString()
  breadcrumbLabel?: string;
}

export class UpsertCollectionTranslationsDto {
  @ApiProperty({ type: CollectionTranslationFieldsDto })
  @ValidateNested()
  @Type(() => CollectionTranslationFieldsDto)
  fields!: CollectionTranslationFieldsDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMachineTranslated?: boolean = false;
}

export class UpsertCollectionPageContentDto {
  @ApiPropertyOptional({ example: 'These are our most-booked tours...' })
  @IsOptional()
  @IsString()
  aboutText?: string;
  @ApiPropertyOptional({ example: 'Top 10 Tours in Curaçao | Island Tours' })
  @IsOptional()
  @IsString()
  metaTitle?: string;
  @ApiPropertyOptional({ example: 'Book the 10 best-rated tours in Curaçao.' })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}

export class CreateFaqDto {
  @ApiProperty({ enum: Locale, example: Locale.en })
  @IsEnum(Locale)
  locale!: Locale;
  @ApiProperty({ example: 'How are these tours chosen?' })
  @IsString()
  @MinLength(5)
  question!: string;
  @ApiProperty({
    example: 'Hand-picked by our editors based on ratings and bookings.',
  })
  @IsString()
  @MinLength(10)
  answer!: string;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateFaqDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  question?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  answer?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Membership / rationale / status ─────────────────────────────────────────────

export class CollectionTourMemberDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000099' })
  @IsUUID('4')
  tourId!: string;

  @ApiProperty({
    example: 0,
    description:
      'Editorial order (the product). Position is re-normalized 0..n on save.',
  })
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReplaceCollectionToursDto {
  @ApiProperty({
    type: [CollectionTourMemberDto],
    description: 'Ordered MANUAL membership. Replaces all existing members.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CollectionTourMemberDto)
  tours!: CollectionTourMemberDto[];
}

export class UpsertCollectionTourRationaleDto {
  @ApiProperty({
    example: 'An uninhabited island, 10km offshore, sea turtles, no signal.',
    description: 'Max 20 words.',
  })
  @IsString()
  @MinLength(1)
  rationale!: string;
}

export class UpdateCollectionStatusDto {
  @ApiProperty({ enum: CollectionStatus, example: CollectionStatus.PUBLISHED })
  @IsEnum(CollectionStatus)
  status!: CollectionStatus;
}

export class CollectionRenderQueryDto {
  @ApiProperty({
    example: 'a1b2c3d4-0000-0000-0000-000000000001',
    description: 'Destination UUID',
  })
  @IsUUID('4')
  destinationId!: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; collection tour cards carry a converted `money` object (guide §20.9).',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
