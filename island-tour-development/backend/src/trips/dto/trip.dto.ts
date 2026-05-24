import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddOnUnit, AgeBandType, PickupModel, PricingModel, ScheduleStatus, TripStatus, UnitType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
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
  @ApiProperty({ enum: TripStatus }) status!: TripStatus;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) operatorId!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) destinationId!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) categoryId!: string;
  @ApiPropertyOptional({ example: null }) hubId!: string | null;
  @ApiProperty({ enum: PricingModel }) pricingModel!: PricingModel;
  @ApiPropertyOptional({ enum: UnitType }) unitType!: UnitType | null;
  @ApiPropertyOptional({ example: '75.00' }) basePrice!: string | null;
  @ApiPropertyOptional({ example: '75.00' }) priceFrom!: string | null;
  @ApiPropertyOptional({ example: 180 }) durationMinutes!: number | null;
  @ApiProperty({ enum: PickupModel }) pickupModel!: PickupModel;
  @ApiPropertyOptional({ example: 20 }) maxPartySize!: number | null;
  @ApiProperty({ example: 1 }) minPartySize!: number;
  @ApiProperty({ example: 120 }) bookingCutoffMinutes!: number;
  @ApiProperty({ example: 24 }) cancellationHours!: number;
  @ApiPropertyOptional({ example: null }) h1Override!: string | null;
  @ApiPropertyOptional({ example: null }) breadcrumbLabel!: string | null;
  @ApiPropertyOptional({ example: 4.8 }) aggregateRating!: number | null;
  @ApiProperty({ example: 0 }) aggregateReviewCount!: number;
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
  @ApiProperty({ example: 0 }) scheduleCount!: number;
  @ApiProperty({ example: 0 }) highlightCount!: number;
  @ApiProperty({ example: 0 }) inclusionCount!: number;
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

export class TripAgeBandInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AgeBandType }) bandType!: AgeBandType;
  @ApiProperty({ example: 'Adults (13+)' }) label!: string;
  @ApiPropertyOptional({ example: 13 }) minAge!: number | null;
  @ApiPropertyOptional({ example: 99 }) maxAge!: number | null;
  @ApiProperty({ example: '75.00' }) price!: string;
  @ApiProperty({ example: 1 }) minCount!: number;
  @ApiPropertyOptional({ example: 10 }) maxCount!: number | null;
  @ApiProperty() displayOrder!: number;
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

export class TripScheduleInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '2026-07-15' }) startDate!: Date;
  @ApiPropertyOptional({ example: null }) endDate!: Date | null;
  @ApiProperty({ example: '09:00' }) startTime!: string;
  @ApiProperty({ example: 18 }) availableSpots!: number;
  @ApiProperty({ enum: ScheduleStatus }) status!: ScheduleStatus;
}

export class TripPublicDetailResponseDto extends TripResponseDto {
  @ApiProperty({ type: TripTranslationInlineDto, nullable: true })
  translation!: TripTranslationInlineDto | null;

  @ApiProperty({ type: [TripImageInlineDto] }) images!: TripImageInlineDto[];
  @ApiProperty({ type: [TripHighlightInlineDto] }) highlights!: TripHighlightInlineDto[];
  @ApiProperty({ type: [TripInclusionInlineDto] }) inclusions!: TripInclusionInlineDto[];
  @ApiProperty({ type: [TripAgeBandInlineDto] }) ageBands!: TripAgeBandInlineDto[];
  @ApiProperty({ type: [TripAddOnInlineDto] }) addOns!: TripAddOnInlineDto[];
  @ApiProperty({ type: [String], example: ['en', 'nl'] }) languages!: string[];
  @ApiProperty({ type: [TripScheduleInlineDto] }) schedules!: TripScheduleInlineDto[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class TripQueryDto {
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

  @ApiPropertyOptional({ example: 'mambo-beach', description: 'Required for hub-anchored tour URLs' })
  @IsOptional()
  @IsString()
  hubSlug?: string;

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class MyTripsQueryDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

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

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsUUID()
  hubId?: string;

  @ApiPropertyOptional({ enum: PricingModel, default: PricingModel.PER_PERSON })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ enum: UnitType })
  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @ApiPropertyOptional({ example: '75.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'basePrice must be a valid decimal number' })
  basePrice?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes?: number;

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

  // Phase 4: category change is allowed on LIVE trips (returns a warning).
  // Phase 5: this will be blocked when a featured slot is held.
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ enum: UnitType })
  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @ApiPropertyOptional({ example: '75.00' })
  @IsOptional()
  @IsDecimal({}, { message: 'basePrice must be a valid decimal number' })
  basePrice?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes?: number;

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
