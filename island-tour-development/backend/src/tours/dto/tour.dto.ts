import { Locale } from '@/common/constants/locales';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AddOnUnit,
  AgeBandType,
  BandParticipation,
  Currency,
  DeliveryFormat,
  DeliveryMethod,
  EligibilityState,
  FeatureType,
  FitnessLevel,
  OctoAvailabilityType,
  PaymentModel,
  PickupModel,
  PricingModel,
  RedemptionMethod,
  TierKey,
  TourBookingType,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Master rule #20 / §6.2 - free-cancellation window is enum-bound, NOT NULL, default 48. */
const CANCELLATION_HOURS = [24, 48, 72, 168] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class TourResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: 'Sunset Catamaran Cruise' }) name!: string;
  @ApiProperty({ example: 'sunset-catamaran-cruise' }) slug!: string;
  @ApiProperty({ enum: TourStatus }) status!: TourStatus;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  operatorId!: string;
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  destinationId!: string;
  @ApiProperty({
    type: [String],
    example: ['3fa85f64-…', 'a1b2c3d4-…'],
    description: 'All category ids (V2 §4)',
  })
  categoryIds!: string[];
  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Primary category (breadcrumb/canonical)',
  })
  primaryCategoryId!: string | null;
  @ApiProperty({
    type: [String],
    example: [],
    description: '0–n activity hub ids (discovery tag, no URL impact)',
  })
  hubIds!: string[];
  @ApiProperty({ enum: PricingModel }) pricingModel!: PricingModel;
  @ApiPropertyOptional({ enum: WholeUnitType })
  wholeUnitType!: WholeUnitType | null;
  @ApiProperty({ enum: Currency }) defaultCurrency!: Currency;
  @ApiPropertyOptional({ example: '75.00' }) basePrice!: string | null;
  @ApiPropertyOptional({ example: '75.00' }) priceFrom!: string | null;
  @ApiPropertyOptional({ example: 180 }) durationMinutesFrom!: number | null;
  @ApiPropertyOptional({ example: 240 }) durationMinutesTo!: number | null;
  @ApiProperty({ enum: PickupModel }) pickupModel!: PickupModel;
  @ApiProperty({ example: false, description: 'OCTO option.pickupRequired' })
  pickupRequired!: boolean;
  @ApiPropertyOptional({ example: 20 }) maxPartySize!: number | null;
  @ApiProperty({ example: 1 }) minPartySize!: number;
  @ApiProperty({ example: 120 }) bookingCutoffMinutes!: number;
  @ApiProperty({
    example: 48,
    description: 'Free-cancellation window in hours [24,48,72,168]',
  })
  cancellationHours!: number;
  @ApiProperty({
    type: [String],
    example: ['09:00', '13:00'],
    description:
      'Tour slot set; availability schedules switch these on per weekday.',
  })
  startTimes!: string[];
  @ApiProperty({ example: true }) instantConfirmation!: boolean;

  // ── Booking / payment (master E.3) ──
  @ApiProperty({ enum: PaymentModel }) paymentModel!: PaymentModel;
  @ApiProperty({
    example: '20.0',
    description: 'Deposit %, tier-driven (system-managed)',
  })
  depositPct!: string;
  @ApiPropertyOptional({
    enum: TourBookingType,
    description: 'private | shared',
  })
  bookingType!: TourBookingType | null;
  @ApiProperty({ enum: OctoAvailabilityType })
  availabilityType!: OctoAvailabilityType;
  @ApiProperty({ example: true }) instantDelivery!: boolean;
  @ApiProperty({ example: true }) availabilityRequired!: boolean;
  @ApiProperty({ example: false }) allowFreesale!: boolean;
  @ApiProperty({ enum: DeliveryFormat, isArray: true })
  deliveryFormats!: DeliveryFormat[];
  @ApiProperty({ enum: DeliveryMethod, isArray: true })
  deliveryMethods!: DeliveryMethod[];
  @ApiProperty({ enum: RedemptionMethod }) redemptionMethod!: RedemptionMethod;
  @ApiPropertyOptional({ example: 'OP-SKU-1024' }) reference!: string | null;
  @ApiProperty({ example: 'America/Curacao' }) timeZone!: string;

  // ── Meeting point / departure (master E.3) ──
  @ApiPropertyOptional({ example: 12.1091 }) meetingPointLat!: number | null;
  @ApiPropertyOptional({ example: -68.9316 }) meetingPointLng!: number | null;
  @ApiPropertyOptional({ example: 'Willemstad' }) departureCity!: string | null;
  @ApiPropertyOptional({ example: 30 }) checkInMinutesBefore!: number | null;

  // ── Audience / accessibility flags (master E.3) ──
  @ApiPropertyOptional({ example: 8 }) minAgeYears!: number | null;
  @ApiPropertyOptional({ enum: FitnessLevel })
  fitnessLevel!: FitnessLevel | null;
  @ApiProperty({ example: false }) weatherDependent!: boolean;
  @ApiProperty({ example: false }) wheelchairAccessible!: boolean;
  @ApiProperty({ example: false }) familyFriendly!: boolean;
  @ApiProperty({ example: false }) suitableForBeginners!: boolean;
  @ApiProperty({
    example: false,
    description: 'Manual editorial flag (never tier-linked)',
  })
  isLocalsFavourite!: boolean;

  // ── Commercial tier (master §7) - read-only, system-managed. Examples reflect the
  // default standard-tier tour: tierKey=standard → commissionTier 20.0, tierRank 5, depositPct 20.0. ──
  @ApiProperty({
    example: '20.0',
    description: 'Commission %, derived from tierKey (standard = 20.0)',
  })
  commissionTier!: string;
  @ApiProperty({ enum: TierKey, example: TierKey.standard }) tierKey!: TierKey;
  @ApiProperty({
    example: 5,
    description:
      'Denormalized from tierKey; never client-written (standard = 5)',
  })
  tierRank!: number;
  @ApiPropertyOptional({ example: null }) tierLockedUntil!: Date | null;
  @ApiProperty({ example: '0.00' }) qualityScore!: string;
  @ApiProperty({
    enum: EligibilityState,
    example: EligibilityState.LOCKED,
    description: 'New tours default to LOCKED (rule #7)',
  })
  eligibilityState!: EligibilityState;
  @ApiProperty({
    example: false,
    description: '≥1 AVAILABLE departure ≤30d (nightly)',
  })
  isBookable!: boolean;
  @ApiPropertyOptional({ example: null }) firstPublishedAt!: Date | null;
  @ApiPropertyOptional({ example: null }) graceStartedAt!: Date | null;
  @ApiPropertyOptional({ example: null }) graceMetric!: string | null;
  @ApiPropertyOptional({ example: null }) availabilityConfirmedAt!: Date | null;

  @ApiPropertyOptional({ example: null }) h1Override!: string | null;
  @ApiPropertyOptional({ example: null }) breadcrumbLabel!: string | null;
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/tours/sunset-og.jpg',
  })
  ogImage!: string | null;
  @ApiPropertyOptional({ example: 4.8 }) aggregateRating!: number | null;
  @ApiProperty({ example: 0 }) aggregateReviewCount!: number;
  @ApiProperty({
    type: [Number],
    example: [10, 2, 1, 0, 0],
    description: '[5-star,4-star,3-star,2-star,1-star] review counts.',
  })
  ratingDistribution!: number[];
  @ApiProperty({ example: 0 }) photoReviewCount!: number;
  // CRO signals (V2 §10). Columns exist + are returned, but stay at 0/null until the
  // bookings module (Phase 4) populates them. Documented here so Swagger matches the runtime response.
  @ApiProperty({
    example: 0,
    description:
      'Total bookings (CRO + Recommended-sort signal). 0 until the bookings module ships.',
  })
  bookingCount!: number;
  @ApiProperty({
    example: 0,
    description:
      'Bookings today ("Booked N times today"). 0 until the bookings module ships.',
  })
  bookingCountToday!: number;
  @ApiPropertyOptional({
    example: null,
    description:
      'Spots left across upcoming schedules ("Only X left"). null until the bookings module ships.',
  })
  spotsRemaining!: number | null;
  @ApiPropertyOptional({
    example: null,
    description:
      'Last booking time ("Last booked 2 hours ago"). null until the bookings module ships.',
  })
  lastBookedAt!: Date | null;
  @ApiProperty({ example: false }) isSponsored!: boolean;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiPropertyOptional({ example: null }) publishedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class TourHeroImageDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise',
  })
  url!: string;
  @ApiPropertyOptional() altText!: string | null;
}

export class TourDetailResponseDto extends TourResponseDto {
  @ApiPropertyOptional({ type: TourHeroImageDto, nullable: true })
  heroImage!: TourHeroImageDto | null;
  @ApiProperty({ example: 0 }) imageCount!: number;
  @ApiProperty({ example: 0 }) inclusionCount!: number;
  @ApiProperty({ example: 0 }) exclusionCount!: number;
}

export class PaginatedToursResponseDto {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [TourResponseDto] }) data!: TourResponseDto[];
}

export class TourUpdateResponseDto {
  @ApiProperty({ type: TourResponseDto }) tour!: TourResponseDto;
  @ApiProperty({ type: [String], example: [] }) warnings!: string[];
}

// ── Public detail inline DTOs (used by TourPublicDetailResponseDto) ───────────

export class TourTranslationInlineDto {
  @ApiProperty({ example: 'en' }) locale!: string;
  @ApiPropertyOptional({ example: 'Sunset Catamaran Cruise' }) title!:
    | string
    | null;
  @ApiPropertyOptional({
    example: 'Join us for a breathtaking sunset cruise...',
  })
  overview!: string | null;
  @ApiPropertyOptional({ example: 'Full description of the tour...' })
  description!: string | null;
  @ApiProperty({ example: false }) isMachineTranslated!: boolean;
}

export class TourImageInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tour-img',
  })
  url!: string;
  @ApiProperty() isHero!: boolean;
  @ApiPropertyOptional() altText!: string | null;
  @ApiPropertyOptional({ example: 0.5 }) focalX!: number;
  @ApiPropertyOptional({ example: 0.5 }) focalY!: number;
  @ApiProperty({ example: 1920 }) width!: number;
  @ApiProperty({ example: 1080 }) height!: number;
  @ApiProperty() displayOrder!: number;
}

export class TourInclusionInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'check' }) icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Open bar' }) label!: string;
}

export class TourExclusionInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'x' }) icon!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Gratuities' }) label!: string;
}

export class TourAddOnInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Hotel pickup' }) name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ example: '15.00' }) price!: string;
  @ApiProperty({ enum: AddOnUnit }) unit!: AddOnUnit;
  @ApiProperty({ example: 1 }) maxQuantity!: number;
  @ApiProperty() displayOrder!: number;
}

export class TourAgeBandInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AgeBandType }) bandType!: AgeBandType;
  @ApiProperty({ enum: BandParticipation }) participation!: BandParticipation;
  @ApiProperty({ example: 'Adult' }) label!: string;
  @ApiPropertyOptional({ example: 13 }) minAge!: number | null;
  @ApiPropertyOptional({ example: null }) maxAge!: number | null;
  @ApiProperty({ example: '79.00' }) price!: string;
  @ApiPropertyOptional({ example: '99.00' }) priceOriginal!: string | null;
  @ApiPropertyOptional({ example: '60.00' }) priceNet!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() displayOrder!: number;
}

export class TourLocationInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: [String], example: ['START'] }) types!: string[];
  @ApiPropertyOptional({ example: 12.1091 }) latitude!: number | null;
  @ApiPropertyOptional({ example: -68.9316 }) longitude!: number | null;
  @ApiPropertyOptional() streetAddress!: string | null;
  @ApiPropertyOptional() addressLocality!: string | null;
  @ApiPropertyOptional() addressRegion!: string | null;
  @ApiPropertyOptional() postalCode!: string | null;
  @ApiPropertyOptional() addressCountry!: string | null;
  @ApiPropertyOptional({ example: 20 }) minutesTo!: number | null;
  @ApiPropertyOptional({ example: 45 }) minutesAt!: number | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Main Dock' }) title!: string;
  @ApiPropertyOptional({ example: 'Meet your crew.' }) shortDescription!:
    | string
    | null;
}

export class PickupLocationInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ example: 12.1091 }) latitude!: number | null;
  @ApiPropertyOptional({ example: -68.9316 }) longitude!: number | null;
  @ApiPropertyOptional() address!: string | null;
  @ApiPropertyOptional({ example: 30 }) minutesPrior!: number | null;
  @ApiPropertyOptional({ example: '07:45' }) windowStart!: string | null;
  @ApiPropertyOptional({ example: '08:15' }) windowEnd!: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Hotel Lobby' }) title!: string;
  @ApiPropertyOptional({ example: 'Wait in lobby.' }) directions!:
    | string
    | null;
}

export class TourFeatureInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: FeatureType }) type!: FeatureType;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ example: 'Please arrive early.' }) text!: string;
}

export class TourPublicDetailResponseDto extends TourResponseDto {
  @ApiProperty({ type: TourTranslationInlineDto, nullable: true })
  translation!: TourTranslationInlineDto | null;

  @ApiProperty({ type: [TourImageInlineDto] }) images!: TourImageInlineDto[];
  @ApiProperty({ type: [TourInclusionInlineDto] })
  inclusions!: TourInclusionInlineDto[];
  @ApiProperty({ type: [TourExclusionInlineDto] })
  exclusions!: TourExclusionInlineDto[];
  @ApiProperty({ type: [TourAddOnInlineDto] }) addOns!: TourAddOnInlineDto[];
  @ApiProperty({ type: [TourAgeBandInlineDto] })
  ageBands!: TourAgeBandInlineDto[];
  @ApiProperty({ type: [TourLocationInlineDto] })
  locations!: TourLocationInlineDto[];
  @ApiProperty({ type: [PickupLocationInlineDto] })
  pickupLocations!: PickupLocationInlineDto[];
  @ApiProperty({ type: [TourFeatureInlineDto] })
  features!: TourFeatureInlineDto[];
  @ApiProperty({ type: [String], example: ['en', 'nl'] }) languages!: string[];
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export enum TourSort {
  recommended = 'recommended',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  rating = 'rating',
  newest = 'newest',
}

export class TourQueryDto {
  @ApiPropertyOptional({
    example: 'catamaran',
    description: 'Case-insensitive name search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: TourSort,
    default: TourSort.recommended,
    description: 'Sort order (default: Recommended)',
  })
  @IsOptional()
  @IsEnum(TourSort)
  sort?: TourSort = TourSort.recommended;

  @ApiPropertyOptional({ example: 60, description: 'Min duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional({ example: 480, description: 'Max duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMax?: number;

  @ApiPropertyOptional({ example: 4.0, description: 'Minimum average rating' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  ratingMin?: number;

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

export class TourBySlugQueryDto {
  @ApiProperty({ example: 'curacao' })
  @IsString()
  destinationSlug!: string;

  // hubSlug removed in Stage 5 - every tour is flat /{destination}/{tour-slug}/ (no hub nesting).

  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class MyToursQueryDto {
  @ApiPropertyOptional({
    example: 'catamaran',
    description: 'Case-insensitive name search',
  })
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

export class AdminToursQueryDto {
  @ApiPropertyOptional({
    example: 'catamaran',
    description: 'Case-insensitive name search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TourStatus })
  @IsOptional()
  @IsEnum(TourStatus)
  status?: TourStatus;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Filter by operator ID',
  })
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

export class CreateTourDto {
  @ApiProperty({ example: 'Sunset Catamaran Cruise' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'sunset-catamaran-cruise' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers and hyphens',
  })
  @MinLength(2)
  slug?: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  destinationId!: string;

  @ApiProperty({
    type: [String],
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    description: '1+ category ids (V2 §4)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description:
      'Primary category - must be one of categoryIds. Defaults to the first.',
  })
  @IsOptional()
  @IsUUID()
  primaryCategoryId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: [],
    description: '0–n activity hub ids',
  })
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

  @ApiPropertyOptional({ enum: Currency, default: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  defaultCurrency?: Currency;

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

  @ApiPropertyOptional({
    example: 240,
    description: 'Upper bound of a duration range (≥ durationMinutesFrom)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutesTo?: number;

  @ApiPropertyOptional({ enum: PickupModel, default: PickupModel.NONE })
  @IsOptional()
  @IsEnum(PickupModel)
  pickupModel?: PickupModel;

  @ApiPropertyOptional({
    example: false,
    description: 'OCTO option.pickupRequired',
  })
  @IsOptional()
  @IsBoolean()
  pickupRequired?: boolean;

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

  @ApiPropertyOptional({
    example: 48,
    enum: CANCELLATION_HOURS,
    default: 48,
    description:
      'Free-cancellation window (master rule #20: enum-bound, default 48)',
  })
  @IsOptional()
  @IsIn(CANCELLATION_HOURS as unknown as number[], {
    message: 'cancellationHours must be one of 24, 48, 72, 168',
  })
  cancellationHours?: number;

  @ApiPropertyOptional({
    enum: PaymentModel,
    default: PaymentModel.OPERATOR_LINK,
  })
  @IsOptional()
  @IsEnum(PaymentModel)
  paymentModel?: PaymentModel;

  @ApiPropertyOptional({
    type: [String],
    example: ['09:00', '13:00'],
    description: 'Tour slot set; values must be HH:MM.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @Matches(HHMM, {
    each: true,
    message: 'startTimes must be HH:MM (00:00-23:59)',
  })
  startTimes?: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  instantConfirmation?: boolean;

  @ApiPropertyOptional({
    enum: TourBookingType,
    description: 'private | shared',
  })
  @IsOptional()
  @IsEnum(TourBookingType)
  bookingType?: TourBookingType;

  @ApiPropertyOptional({ example: 12.1091 })
  @IsOptional()
  @IsLatitude()
  meetingPointLat?: number;

  @ApiPropertyOptional({ example: -68.9316 })
  @IsOptional()
  @IsLongitude()
  meetingPointLng?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Please arrive N minutes before departure for check-in.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  checkInMinutesBefore?: number;

  @ApiPropertyOptional({
    example: 'Willemstad',
    description: 'Drives the meta-row location label; empty → island only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  departureCity?: string;

  @ApiPropertyOptional({
    example: 8,
    description: 'Tour-level minimum age (distinct from per-unit minAge)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minAgeYears?: number;

  @ApiPropertyOptional({ enum: FitnessLevel })
  @IsOptional()
  @IsEnum(FitnessLevel)
  fitnessLevel?: FitnessLevel;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  weatherDependent?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  wheelchairAccessible?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  familyFriendly?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  suitableForBeginners?: boolean;

  @ApiPropertyOptional({
    example: 'OP-SKU-1024',
    description: "Operator's external id (OCTO reference)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/tours/sunset-og.jpg',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  ogImage?: string;

  @ApiPropertyOptional({
    example: '2026-06-23T10:00:00.000Z',
    description: 'Operator freshness confirmation timestamp.',
  })
  @IsOptional()
  @IsDateString()
  availabilityConfirmedAt?: string;

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

export class UpdateTourDto {
  @ApiPropertyOptional({ example: 'Sunset Catamaran Cruise' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'sunset-catamaran-cruise',
    description:
      'Renaming the slug issues an automatic 301 redirect from the old URL; the old slug is protected by a 90-day reuse cooldown (master slug-registry rules).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers and hyphens',
  })
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  // V2 §4: supply categoryIds to replace the full category set; supply primaryCategoryId
  // alone to re-point the primary among the existing categories.
  @ApiPropertyOptional({
    type: [String],
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  primaryCategoryId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: [],
    description: '0–n activity hub ids (replaces the full hub set)',
  })
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

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  defaultCurrency?: Currency;

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

  @ApiPropertyOptional({
    example: 240,
    description: 'Upper bound of a duration range (≥ durationMinutesFrom)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutesTo?: number;

  @ApiPropertyOptional({ enum: PickupModel })
  @IsOptional()
  @IsEnum(PickupModel)
  pickupModel?: PickupModel;

  @ApiPropertyOptional({
    example: false,
    description: 'OCTO option.pickupRequired',
  })
  @IsOptional()
  @IsBoolean()
  pickupRequired?: boolean;

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

  @ApiPropertyOptional({
    example: 48,
    enum: CANCELLATION_HOURS,
    description:
      'Free-cancellation window (master rule #20: enum-bound, default 48)',
  })
  @IsOptional()
  @IsIn(CANCELLATION_HOURS as unknown as number[], {
    message: 'cancellationHours must be one of 24, 48, 72, 168',
  })
  cancellationHours?: number;

  @ApiPropertyOptional({ enum: PaymentModel })
  @IsOptional()
  @IsEnum(PaymentModel)
  paymentModel?: PaymentModel;

  @ApiPropertyOptional({
    type: [String],
    example: ['09:00', '13:00'],
    description: 'Tour slot set; values must be HH:MM.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @Matches(HHMM, {
    each: true,
    message: 'startTimes must be HH:MM (00:00-23:59)',
  })
  startTimes?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  instantConfirmation?: boolean;

  @ApiPropertyOptional({
    enum: TourBookingType,
    description: 'private | shared',
  })
  @IsOptional()
  @IsEnum(TourBookingType)
  bookingType?: TourBookingType;

  @ApiPropertyOptional({ example: 12.1091 })
  @IsOptional()
  @IsLatitude()
  meetingPointLat?: number;

  @ApiPropertyOptional({ example: -68.9316 })
  @IsOptional()
  @IsLongitude()
  meetingPointLng?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  checkInMinutesBefore?: number;

  @ApiPropertyOptional({ example: 'Willemstad' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  departureCity?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minAgeYears?: number;

  @ApiPropertyOptional({ enum: FitnessLevel })
  @IsOptional()
  @IsEnum(FitnessLevel)
  fitnessLevel?: FitnessLevel;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  weatherDependent?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  wheelchairAccessible?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  familyFriendly?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  suitableForBeginners?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Manual editorial flag (never tier-linked)',
  })
  @IsOptional()
  @IsBoolean()
  isLocalsFavourite?: boolean;

  @ApiPropertyOptional({
    example: 'OP-SKU-1024',
    description: "Operator's external id (OCTO reference)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/tours/sunset-og.jpg',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  ogImage?: string;

  @ApiPropertyOptional({ example: '2026-06-23T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  availabilityConfirmedAt?: string;

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
