import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddOnUnit, PickupModel, PricingModel, TourStatus, WholeUnitType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class TripResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Sunset Catamaran Cruise' }) name!: string;
  @ApiProperty({ example: 'sunset-catamaran-cruise' }) slug!: string;
  @ApiProperty({ enum: TourStatus }) status!: TourStatus;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) operatorId!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) destinationId!: string;
  @ApiProperty({ type: [String], example: ['3fa85f64-…', 'a1b2c3d4-…'], description: 'All category ids (V2 §4)' })
  categoryIds!: string[];
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Primary category (breadcrumb/canonical)' })
  primaryCategoryId!: string | null;
  @ApiProperty({ type: [String], example: [], description: '0–n activity hub ids (discovery tag, no URL impact)' })
  hubIds!: string[];
  @ApiProperty({ enum: PricingModel }) pricingModel!: PricingModel;
  @ApiPropertyOptional({ enum: WholeUnitType }) wholeUnitType!: WholeUnitType | null;
  @ApiPropertyOptional({ example: '75.00' }) basePrice!: string | null;
  @ApiPropertyOptional({ example: '75.00' }) priceFrom!: string | null;
  @ApiPropertyOptional({ example: 180 }) durationMinutesFrom!: number | null;
  @ApiProperty({ enum: PickupModel }) pickupModel!: PickupModel;
  @ApiPropertyOptional({ example: 20 }) maxPartySize!: number | null;
  @ApiProperty({ example: 1 }) minPartySize!: number;
  @ApiProperty({ example: 120 }) bookingCutoffMinutes!: number;
  @ApiProperty({ example: 24 }) cancellationHours!: number;
  @ApiPropertyOptional({ example: null }) h1Override!: string | null;
  @ApiPropertyOptional({ example: null }) breadcrumbLabel!: string | null;
  @ApiPropertyOptional({ example: 4.8 }) aggregateRating!: number | null;
  @ApiProperty({ example: 0 }) aggregateReviewCount!: number;
  // CRO signals (V2 §10). Columns exist + are returned, but stay at 0/null until the
  // bookings module (Phase 4) populates them. Documented here so Swagger matches the runtime response.
  @ApiProperty({ example: 0, description: 'Total bookings (CRO + Recommended-sort signal). 0 until the bookings module ships.' })
  bookingCount!: number;
  @ApiProperty({ example: 0, description: 'Bookings today ("Booked N times today"). 0 until the bookings module ships.' })
  bookingCountToday!: number;
  @ApiPropertyOptional({ example: null, description: 'Spots left across upcoming schedules ("Only X left"). null until the bookings module ships.' })
  spotsRemaining!: number | null;
  @ApiPropertyOptional({ example: null, description: 'Last booking time ("Last booked 2 hours ago"). null until the bookings module ships.' })
  lastBookedAt!: Date | null;
  @ApiProperty({ example: false }) isSponsored!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiPropertyOptional({ example: null }) publishedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class TripHeroImageDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise' }) url!: string;
  @ApiPropertyOptional() altText!: string | null;
}

export class TripDetailResponseDto extends TripResponseDto {
  @ApiPropertyOptional({ type: TripHeroImageDto, nullable: true }) heroImage!: TripHeroImageDto | null;
  @ApiProperty({ example: 0 }) imageCount!: number;
  @ApiProperty({ example: 0 }) highlightCount!: number;
  @ApiProperty({ example: 0 }) inclusionCount!: number;
  @ApiProperty({ example: 0 }) exclusionCount!: number;
}

export class PaginatedTripsResponseDto {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [TripResponseDto] }) data!: TripResponseDto[];
}

export class TripUpdateResponseDto {
  @ApiProperty({ type: TripResponseDto }) trip!: TripResponseDto;
  @ApiProperty({ type: [String], example: [] }) warnings!: string[];
}

// ── Public detail inline DTOs (used by TripPublicDetailResponseDto) ───────────

export class TripTranslationInlineDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiPropertyOptional({ example: 'Sunset Catamaran Cruise' }) title!: string | null;
  @ApiPropertyOptional({ example: 'Join us for a breathtaking sunset cruise...' }) overview!: string | null;
  @ApiPropertyOptional({ example: 'Full description of the tour...' }) description!: string | null;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class TripImageInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tour-img' }) url!: string;
  @ApiProperty() isHero!: boolean;
  @ApiPropertyOptional() altText!: string | null;
  @ApiPropertyOptional({ example: 0.5 }) focalX!: number;
  @ApiPropertyOptional({ example: 0.5 }) focalY!: number;
  @ApiProperty({ example: 1920 }) width!: number;
  @ApiProperty({ example: 1080 }) height!: number;
  @ApiProperty() displayOrder!: number;
}

export class TripHighlightInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Watch the sunset from the water with cocktails in hand' }) text!: string;
}

export class TripInclusionInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'check' }) icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Open bar' }) label!: string;
}

export class TripExclusionInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'x' }) icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Gratuities' }) label!: string;
}

export class TripAddOnInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Hotel pickup' }) name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ example: '15.00' }) price!: string;
  @ApiProperty({ enum: AddOnUnit }) unit!: AddOnUnit;
  @ApiProperty({ example: 1 }) maxQuantity!: number;
  @ApiProperty() displayOrder!: number;
}

export class TripPublicDetailResponseDto extends TripResponseDto {
  @ApiProperty({ type: TripTranslationInlineDto, nullable: true })
  translation!: TripTranslationInlineDto | null;

  @ApiProperty({ type: [TripImageInlineDto] }) images!: TripImageInlineDto[];
  @ApiProperty({ type: [TripHighlightInlineDto] }) highlights!: TripHighlightInlineDto[];
  @ApiProperty({ type: [TripInclusionInlineDto] }) inclusions!: TripInclusionInlineDto[];
  @ApiProperty({ type: [TripExclusionInlineDto] }) exclusions!: TripExclusionInlineDto[];
  @ApiProperty({ type: [TripAddOnInlineDto] }) addOns!: TripAddOnInlineDto[];
  @ApiProperty({ type: [String], example: ['en', 'nl'] }) languages!: string[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export enum TripSort {
  recommended = 'recommended',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  rating = 'rating',
  newest = 'newest',
}

export class TripQueryDto {
  @ApiPropertyOptional({ example: 'catamaran', description: 'Case-insensitive name search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TripSort, default: TripSort.recommended, description: 'Sort order (default: Recommended)' })
  @IsOptional()
  @IsEnum(TripSort)
  sort?: TripSort = TripSort.recommended;

  @ApiPropertyOptional({ example: 60, description: 'Min duration in minutes' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) durationMin?: number;

  @ApiPropertyOptional({ example: 480, description: 'Max duration in minutes' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) durationMax?: number;

  @ApiPropertyOptional({ example: 4.0, description: 'Minimum average rating' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) ratingMin?: number;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  hubId?: string;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TripBySlugQueryDto {
  @ApiProperty({ example: 'curacao' })
  @IsString()
  destinationSlug!: string;

  // hubSlug removed in Stage 5 — every tour is flat /{destination}/{tour-slug}/ (no hub nesting).

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class MyTripsQueryDto {
  @ApiPropertyOptional({ example: 'catamaran', description: 'Case-insensitive name search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TourStatus })
  @IsOptional()
  @IsEnum(TourStatus)
  status?: TourStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminTripsQueryDto {
  @ApiPropertyOptional({ example: 'catamaran', description: 'Case-insensitive name search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TourStatus })
  @IsOptional()
  @IsEnum(TourStatus)
  status?: TourStatus;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Filter by operator ID' })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class CreateTripDto {
  @ApiProperty({ example: 'Sunset Catamaran Cruise' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'sunset-catamaran-cruise' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, numbers and hyphens' })
  @MinLength(2)
  slug?: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({ type: [String], example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'], description: '1+ category ids (V2 §4)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: 'Primary category — must be one of categoryIds. Defaults to the first.' })
  @IsOptional()
  @IsUUID()
  primaryCategoryId?: string;

  @ApiPropertyOptional({ type: [String], example: [], description: '0–n activity hub ids' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  hubIds?: string[];

  @ApiPropertyOptional({ enum: PricingModel, default: PricingModel.PER_PERSON })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ enum: WholeUnitType })
  @IsOptional()
  @IsEnum(WholeUnitType)
  wholeUnitType?: WholeUnitType;

  @ApiPropertyOptional({ example: '75.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'basePrice must be a valid decimal number' })
  basePrice?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutesFrom?: number;

  @ApiPropertyOptional({ enum: PickupModel, default: PickupModel.NONE })
  @IsOptional()
  @IsEnum(PickupModel)
  pickupModel?: PickupModel;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPartySize?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minPartySize?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  bookingCutoffMinutes?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationHours?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  h1Override?: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breadcrumbLabel?: string;
}

export class UpdateTripDto {
  @ApiPropertyOptional({ example: 'Sunset Catamaran Cruise' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  // V2 §4: supply categoryIds to replace the full category set; supply primaryCategoryId
  // alone to re-point the primary among the existing categories.
  @ApiPropertyOptional({ type: [String], example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  primaryCategoryId?: string;

  @ApiPropertyOptional({ type: [String], example: [], description: '0–n activity hub ids (replaces the full hub set)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  hubIds?: string[];

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ enum: WholeUnitType })
  @IsOptional()
  @IsEnum(WholeUnitType)
  wholeUnitType?: WholeUnitType;

  @ApiPropertyOptional({ example: '75.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'basePrice must be a valid decimal number' })
  basePrice?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutesFrom?: number;

  @ApiPropertyOptional({ enum: PickupModel })
  @IsOptional()
  @IsEnum(PickupModel)
  pickupModel?: PickupModel;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPartySize?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minPartySize?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  bookingCutoffMinutes?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationHours?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  h1Override?: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breadcrumbLabel?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
