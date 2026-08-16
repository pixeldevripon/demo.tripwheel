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
  OnArrivalPayment,
  OperatorTermsKind,
  PaymentModel,
  PendingChangeStatus,
  PickupModel,
  PricingModel,
  RedemptionMethod,
  TierKey,
  TourApprovalStatus,
  TourBookingType,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { MoneyDto } from '@/fx/dto/money.dto';
import { Transform, Type } from 'class-transformer';
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
  ValidateIf,
} from 'class-validator';

/** Master rule #20 / §6.2 - free-cancellation window is enum-bound, NOT NULL, default 48. */
const CANCELLATION_HOURS = [24, 48, 72, 168] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Response DTOs ─────────────────────────────────────────────────────────────

export class TourCardAttributeDto {
  @ApiProperty({ example: 'boat_type' }) key!: string;
  @ApiProperty({
    example: 'catamaran',
    description:
      'Raw stored value; "true"/"false" for BOOLEAN, JSON array for ENUM_MULTI.',
  })
  value!: string;
  @ApiProperty({ example: 'ENUM', description: 'AttributeDefinition.dataType' })
  dataType!: string;
}

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
  @ApiPropertyOptional({
    type: MoneyDto,
    description:
      'Converted-price display object (guide §20.9). Canonical for display: shows prices in the requested `?currency` (falls back to the tour currency). Prefer this over the raw `priceFrom`/`basePrice`/`defaultCurrency` above.',
  })
  money?: MoneyDto;
  @ApiPropertyOptional({
    example: 10,
    nullable: true,
    description:
      'UNIT pricing: travelers covered by basePrice ("/10 people"). null for PER_PERSON.',
  })
  unitIncludedGuests!: number | null;
  @ApiPropertyOptional({
    example: '175.00',
    nullable: true,
    description:
      'UNIT pricing: surcharge per traveler beyond unitIncludedGuests. null for PER_PERSON.',
  })
  extraPersonPrice!: string | null;
  @ApiPropertyOptional({ example: 180 }) durationMinutesFrom!: number | null;
  @ApiPropertyOptional({ example: 240 }) durationMinutesTo!: number | null;
  @ApiProperty({ enum: PickupModel }) pickupModel!: PickupModel;
  @ApiProperty({ example: false, description: 'OCTO option.pickupRequired' })
  pickupRequired!: boolean;
  @ApiProperty({ example: 20 }) maxPartySize!: number;
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
    enum: OnArrivalPayment,
    description:
      'On-site payment terms. Only meaningful when paymentModel = ON_ARRIVAL; ' +
      'selects between the two on_arrival confirmation-email variants.',
  })
  onArrivalPayment!: OnArrivalPayment;
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
  @ApiProperty({
    example: false,
    description:
      'Operator-set: guests sleep on board (whole-unit charters). One of the two inputs to isOvernight.',
  })
  sleepAboard!: boolean;
  @ApiProperty({
    example: false,
    description:
      'Computed Day/Overnight charter verdict: sleepAboard OR duration >= 16h. The frontend partitions hub charter groups on this; never re-derived client-side.',
  })
  isOvernight!: boolean;
  @ApiProperty({ example: false }) weatherDependent!: boolean;
  @ApiProperty({ example: false }) wheelchairAccessible!: boolean;
  @ApiProperty({ example: false }) familyFriendly!: boolean;
  @ApiProperty({ example: false }) suitableForBeginners!: boolean;
  @ApiProperty({
    example: false,
    description: 'Manual editorial flag (never tier-linked)',
  })
  isLocalsFavourite!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Computed daily demand signal (§3.7) powering the "Likely to sell out" badge',
  })
  likelyToSellOut!: boolean;
  @ApiPropertyOptional({
    example: null,
    description:
      'Manual CMS launch override for the demand badge. null = use the computed value; true/false = force it',
    nullable: true,
  })
  likelyToSellOutOverride!: boolean | null;

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
  @ApiProperty({
    enum: TourApprovalStatus,
    example: TourApprovalStatus.NOT_SUBMITTED,
    description:
      'Content-review workflow (conflict #1): operators submit-for-review, the platform approves; publish requires APPROVED.',
  })
  approvalStatus!: TourApprovalStatus;
  @ApiPropertyOptional({ example: null }) submittedAt!: Date | null;
  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: "The admin's approve/reject note (cleared on re-submit).",
  })
  reviewNote!: string | null;
  @ApiPropertyOptional({ example: null }) publishedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({
    type: [TourCardAttributeDto],
    description:
      "The tour's resolved attribute values (boat type, amenities, …) for the listing card chip row. Only present on the listing endpoint.",
  })
  attributes?: TourCardAttributeDto[];
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
  @ApiProperty({ example: 0 }) highlightCount!: number;
  @ApiProperty({ example: 0 }) inclusionCount!: number;
  @ApiProperty({ example: 0 }) exclusionCount!: number;
}

export class PaginatedToursResponseDto {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [TourResponseDto] }) data!: TourResponseDto[];
}

/**
 * One card in the all-sold-out dead-end recovery block
 * (AVAILABILITY-AND-DEPARTURES.md §8). A normal listing card plus the date that
 * earned it a place - it is offered precisely because it still has room.
 */
export class TourAlternativeResponseDto extends TourResponseDto {
  @ApiProperty({
    example: '2026-08-02',
    description:
      'Earliest live-bookable departure date (yyyy-MM-dd) inside the 7-day window.',
  })
  nextAvailableDate!: string | null;
}

export class TourUpdateResponseDto {
  @ApiProperty({ type: TourResponseDto }) tour!: TourResponseDto;
  @ApiProperty({ type: [String], example: [] }) warnings!: string[];
}

// ── Editorial: Locals' favourite (master §field-table — manual, ~30% coverage) ──

export class LocalsFavouriteDestinationStatDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  destinationId!: string;
  @ApiProperty({ example: 'Curaçao' }) destinationName!: string;
  @ApiProperty({ example: 40, description: 'LIVE tours in this destination' })
  totalLive!: number;
  @ApiProperty({ example: 12 }) flagged!: number;
  @ApiProperty({ example: 30, description: 'flagged / totalLive, rounded %' })
  pct!: number;
}

export class LocalsFavouriteStatsDto {
  @ApiProperty({ example: 120, description: 'LIVE tours across the catalog' })
  totalLive!: number;
  @ApiProperty({ example: 34 }) flagged!: number;
  @ApiProperty({ example: 28, description: 'flagged / totalLive, rounded %' })
  pct!: number;
  @ApiProperty({ example: 30, description: 'Master coverage target (%)' })
  target!: number;
  @ApiProperty({ type: [LocalsFavouriteDestinationStatDto] })
  perDestination!: LocalsFavouriteDestinationStatDto[];
}

export class SetLocalsFavouriteResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }) id!: string;
  @ApiProperty({ example: true }) isLocalsFavourite!: boolean;
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

export class TourHighlightInlineDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({
    example: 'Watch the sunset from the water with cocktails in hand',
  })
  text!: string;
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
  @ApiPropertyOptional({
    example: '17.00',
    nullable: true,
    description:
      'Per-person pickup price in the tour currency; charged only when pickupModel = PAID_ADDON (master 5.8). Null/0 = free zone.',
  })
  price!: string | null;
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
  @ApiPropertyOptional({
    example: 'Miss Ann',
    nullable: true,
    description: 'Operator display name (company name, else account name)',
  })
  operatorName!: string | null;

  @ApiProperty({ type: TourTranslationInlineDto, nullable: true })
  translation!: TourTranslationInlineDto | null;

  @ApiProperty({ type: [TourImageInlineDto] }) images!: TourImageInlineDto[];
  @ApiProperty({ type: [TourHighlightInlineDto] })
  highlights!: TourHighlightInlineDto[];
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

/**
 * Traveler-facing sort options at LAUNCH (master conflict log 68): three only.
 * `rating`/`newest` stay in the enum for internal use (dynamic-collection
 * `sortOrder`, and the documented reactivation path once review/booking volume
 * is meaningful) but are rejected on the public query.
 */
export const LAUNCH_TOUR_SORTS = [
  TourSort.recommended,
  TourSort.price_asc,
  TourSort.price_desc,
] as const;

/**
 * Traveler-facing sort options on the SEARCH results page - the launch three
 * plus `relevance`, which only exists where there is a search term to be
 * relevant to. A separate enum rather than a fourth `TourSort` member because
 * the filter-only listing endpoint shares that one and cannot honour it.
 */
export enum SearchSort {
  relevance = 'relevance',
  recommended = 'recommended',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
}

export class RecomputeDemandResponseDto {
  @ApiProperty({ example: 9, description: 'Number of tours evaluated' })
  evaluated!: number;

  @ApiProperty({
    example: 1,
    description: 'Number flagged as "likely to sell out"',
  })
  flagged!: number;
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
    enum: LAUNCH_TOUR_SORTS,
    default: TourSort.recommended,
    description:
      'Sort order (default: Recommended). Launch set per master B.68 - rating/newest return later.',
  })
  @IsOptional()
  @IsIn(LAUNCH_TOUR_SORTS)
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

  @ApiPropertyOptional({
    example: 24,
    description:
      'Free-cancellation cutoff ceiling in hours: only tours you can cancel up to this many hours before (cancellationHours <= value). Lower = more flexible.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cancellationMaxHours?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Only tours that offer pickup (pickupModel != NONE).',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  pickupAvailable?: boolean;

  @ApiPropertyOptional({
    example: '2026-07-20',
    description:
      'Availability anchor (YYYY-MM-DD). When set, only tours with a bookable (OPEN) departure on that date are returned; `guests` and `timeOfDay` refine that same-day availability. Without a date, guests/timeOfDay are ignored.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Total party size. Only applied together with `date`: keeps tours whose departure that day has capacity - bookedCount >= guests.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: 'morning,afternoon',
    description:
      'Time-of-day buckets (CSV of morning|afternoon|evening). Only applied together with `date`: keeps tours with a matching-time departure that day. morning < 12:00, afternoon 12:00-16:59, evening >= 17:00.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsIn(['morning', 'afternoon', 'evening'], { each: true })
  timeOfDay?: string[];

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'uuid-a,uuid-b',
    description:
      'Multi-select category filter (CSV of ids). A tour in ANY of these matches. Takes precedence over categoryId.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  hubId?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Only tours flagged as a "locals\' favourite" (true) or not (false).',
  })
  @IsOptional()
  // Preserve `undefined` when the param is absent - otherwise the transform would
  // coerce it to `false` and silently exclude every favourite from unfiltered lists.
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isLocalsFavourite?: boolean;

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

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency. Prices are returned converted in each card `money` object (guide §20.9); omit to show tour currency.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

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

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency. The detail `money` object returns converted prices (guide §20.9); omit to show tour currency.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

/**
 * Query for `GET /tours/:id/alternatives` - the all-sold-out dead-end recovery
 * (AVAILABILITY-AND-DEPARTURES.md §8). Locale localizes the card titles; currency
 * adds the converted `money` object, exactly as on a listing card.
 */
export class TourAlternativesQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper display currency; adds the converted `money` object to each card (guide §20.9).',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

// ── Operator conditions (Pastel #80 / MCK-20) ─────────────────────────────────

/** Translation Console write for ONE locale (English is wizard-owned). */
export class UpsertOperatorTermsTranslationDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      "This locale's confirm-list facts (ACKNOWLEDGMENT tours). Empty array clears the translation - render falls back to English.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  acknowledgmentItems?: string[];

  @ApiPropertyOptional({
    description:
      "This locale's conditions document (DOCUMENT tours), TipTap HTML - sanitized server-side with the PAGES pipeline. Empty clears the translation.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  termsDocument?: string;
}

export class OperatorTermsQueryDto {
  @ApiPropertyOptional({ enum: Locale, default: 'en' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale = Locale.en;
}

export class TourOperatorTermsDto {
  @ApiProperty({ enum: OperatorTermsKind, example: 'DOCUMENT' })
  kind!: OperatorTermsKind;

  @ApiPropertyOptional({ example: 'Powerboat Caribbean', nullable: true })
  operatorName!: string | null;

  @ApiPropertyOptional({
    example: '1.0',
    nullable: true,
    description:
      'Document version snapshotted onto acceptances (DOCUMENT kind only)',
  })
  version!: string | null;

  @ApiPropertyOptional({ nullable: true })
  effectiveDate!: Date | null;

  @ApiProperty({
    type: [String],
    description:
      'First-person declarations (ACKNOWLEDGMENT kind only), locale-resolved with EN fallback',
  })
  items!: string[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Sanitized-HTML conditions text (DOCUMENT kind only), locale-resolved with EN fallback',
  })
  document!: string | null;
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

  @ApiPropertyOptional({
    enum: TourApprovalStatus,
    description:
      'Review-workflow filter - a SEPARATE axis from status (submitting ' +
      'stamps PENDING and leaves status alone). The dashboard status ' +
      'dropdown has offered "In review"/"Changes requested" since 2026-08-02 ' +
      'against this param; without it here the whole request 400s ' +
      '(forbidNonWhitelisted) and the list never loads.',
  })
  @IsOptional()
  @IsEnum(TourApprovalStatus)
  approvalStatus?: TourApprovalStatus;

  @ApiPropertyOptional({
    example: true,
    description:
      "The operator's whole review loop at once: PENDING and REJECTED " +
      'together - the operator Submissions view. Ignored when ' +
      'approvalStatus is set.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : undefined,
  )
  @IsBoolean()
  reviewLoop?: boolean;

  @ApiPropertyOptional({
    enum: ['updatedAt', 'submittedAt'],
    description:
      'Sort column (default updatedAt) - the Submissions view sorts by ' +
      'submittedAt ascending, matching the admin queue.',
  })
  @IsOptional()
  @IsIn(['updatedAt', 'submittedAt'])
  sortBy?: 'updatedAt' | 'submittedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Filter by destination ID',
  })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

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
    enum: [...Object.values(TourApprovalStatus), 'ANY'],
    description:
      'Review-workflow filter - same separate axis as on my-tours; the ' +
      'admin submissions view filters PENDING through this. WITHOUT it the ' +
      'admin list excludes PENDING and REJECTED tours: the working ' +
      'catalogue and the review queue are separate surfaces. ANY skips the ' +
      'axis entirely - for jump-to-anything surfaces like the command ' +
      'palette, where a tour mid-review is exactly what the admin wants.',
  })
  @IsOptional()
  @IsIn([...Object.values(TourApprovalStatus), 'ANY'])
  approvalStatus?: TourApprovalStatus | 'ANY';

  @ApiPropertyOptional({
    example: true,
    description:
      'The whole review loop at once: PENDING and REJECTED together - the ' +
      'Submissions queue’s "All" view. Ignored when approvalStatus is set.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : undefined,
  )
  @IsBoolean()
  reviewLoop?: boolean;

  @ApiPropertyOptional({
    enum: ['updatedAt', 'submittedAt'],
    description:
      'Sort column (default updatedAt). The Submissions queue sorts by ' +
      'submittedAt ascending - FIFO fairness for reviews.',
  })
  @IsOptional()
  @IsIn(['updatedAt', 'submittedAt'])
  sortBy?: 'updatedAt' | 'submittedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Default desc.' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Filter by operator ID',
  })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Filter by destination ID',
  })
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Filter by editorial Locals' favourite flag",
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : undefined,
  )
  @IsBoolean()
  isLocalsFavourite?: boolean;

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
  @Max(500)
  limit?: number = 20;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export class SetLocalsFavouriteDto {
  @ApiProperty({
    example: true,
    description: "Whether the tour is flagged as a Locals' favourite",
  })
  @IsBoolean()
  value!: boolean;
}

export class CreateTourDto {
  @ApiProperty({ example: 'Sunset Catamaran Cruise' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'sunset-catamaran-cruise',
    description:
      'ADMIN only - ignored for every other caller (client review #12: the ' +
      'slug is a destination-registry entry set by Island Tours). Without ' +
      'it the address derives from the name.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers and hyphens',
  })
  @MinLength(2)
  @MaxLength(120)
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

  @ApiPropertyOptional({
    example: 10,
    description:
      'UNIT pricing: travelers covered by basePrice ("/10 people"). Omit for PER_PERSON.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitIncludedGuests?: number;

  @ApiPropertyOptional({
    example: '175.00',
    description:
      'UNIT pricing: surcharge per traveler beyond unitIncludedGuests. Omit for PER_PERSON.',
  })
  @IsOptional()
  @IsDecimal({}, { message: 'extraPersonPrice must be a valid decimal number' })
  extraPersonPrice?: string;

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

  @ApiPropertyOptional({
    example: 20,
    description:
      'Maximum travelers per booking. ALSO the default capacity every schedule falls back on when it has no capacityOverride. The column is NOT NULL: omitting it here creates the tour with the schema default (10), which the operator confirms on the booking-rules step before publishing. It is optional ON CREATE only because create mints a bare draft from four fields - a required capacity would block the draft on a question the wizard asks two steps later.',
  })
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
  @IsIn(CANCELLATION_HOURS, {
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
    enum: OnArrivalPayment,
    default: OnArrivalPayment.CARD_OR_CASH,
    description:
      'Whether the operator takes card on site or cash only. Ignored unless ' +
      'paymentModel = ON_ARRIVAL. Snapshotted onto each booking at reserve.',
  })
  @IsOptional()
  @IsEnum(OnArrivalPayment)
  onArrivalPayment?: OnArrivalPayment;

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

  // instantConfirmation is intentionally NOT client-writable (Pastel #22):
  // every consumer surface promises instant confirmation ("Confirmed in
  // seconds" on All Tours) and no request-to-book flow exists behind an off
  // state. The column stays, default true - OCTO and the derived attributes
  // read it. Do not re-add without the full pending-booking spec.

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

  @ApiPropertyOptional({
    example: false,
    description:
      'Guests sleep on board (whole-unit charters). Forces the Overnight charter group for <16h sleep trips.',
  })
  @IsOptional()
  @IsBoolean()
  sleepAboard?: boolean;

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

export class ApproveTourDto {
  @ApiPropertyOptional({
    example: 'Great photos - approved.',
    description: 'Optional note stored on the tour (visible to the operator).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectTourDto {
  @ApiProperty({
    example:
      'The hero photo is blurry and the overview is one sentence - please expand it.',
    description: 'REQUIRED actionable note - the operator fixes and resubmits.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  note!: string;
}

// ── Live-tour pending content changes (client review #19 / dashboard #80) ──

export class TourPendingChangePayloadDto {
  @ApiPropertyOptional({
    example: { name: 'Sunset Catamaran Cruise' },
    description: 'Proposed tour-row fields (title only today).',
  })
  tour?: { name?: string };

  @ApiPropertyOptional({
    example: { en: { overview: 'A rewritten overview…' } },
    description: 'Proposed TourTranslation fields per locale (defined only).',
  })
  translations?: Record<string, Record<string, unknown>>;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description:
      'The staged copy of the WHOLE gallery when photos were touched.',
  })
  images?: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'object' } },
    description:
      'Staged copies of the itemized content lists (highlights / inclusions ' +
      '/ exclusions / features / locations) - whole desired state per kind, ' +
      'translations included.',
  })
  lists?: Record<string, unknown[]>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Bookkeeping, never applied: `fieldTimes` maps each staged unit ' +
      "('title' | 'photos' | 'tr:{locale}:{field}' | 'list:{kind}') to the " +
      'ISO time it was last staged.',
  })
  meta?: { fieldTimes?: Record<string, string> };
}

export class TourPendingChangeDto {
  @ApiProperty({ example: '9b2f5c1e-…' }) id!: string;
  @ApiProperty({ example: 'a4d81f0c-…' }) tourId!: string;
  @ApiProperty({ enum: PendingChangeStatus, example: 'PENDING' })
  status!: PendingChangeStatus;
  @ApiProperty({ type: TourPendingChangePayloadDto })
  payload!: TourPendingChangePayloadDto;
  @ApiProperty({
    example: ['title', 'photos'],
    description: "Which areas the set touches: 'title' | 'content' | 'photos'.",
  })
  changedAreas!: string[];
  @ApiPropertyOptional({
    description:
      'LIVE counterparts of every kept field (open sets only) - the diff ' +
      'both roles render against; the operator could not see them otherwise ' +
      '(their own reads are overlaid with the proposal).',
  })
  current?: TourPendingChangePayloadDto;
  @ApiProperty() submittedAt!: Date;
  @ApiPropertyOptional() submittedById!: string | null;
  @ApiPropertyOptional() decidedAt!: Date | null;
  @ApiPropertyOptional() decidedById!: string | null;
  @ApiPropertyOptional() reviewNote!: string | null;
}

export class PendingChangesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PaginatedPendingChangesDto {
  @ApiProperty({ example: 4 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [TourPendingChangeDto] })
  data!: TourPendingChangeDto[];
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
      'ADMIN only - ignored for every other caller (client review #12: the ' +
      'slug is a destination-registry entry set by Island Tours). Renaming ' +
      'issues an automatic 301 redirect from the old URL; the old slug is ' +
      'protected by a 90-day reuse cooldown (master slug-registry rules).',
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

  @ApiPropertyOptional({
    example: 10,
    description:
      'UNIT pricing: travelers covered by basePrice ("/10 people"). Omit for PER_PERSON.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitIncludedGuests?: number;

  @ApiPropertyOptional({
    example: '175.00',
    description:
      'UNIT pricing: surcharge per traveler beyond unitIncludedGuests. Omit for PER_PERSON.',
  })
  @IsOptional()
  @IsDecimal({}, { message: 'extraPersonPrice must be a valid decimal number' })
  extraPersonPrice?: string;

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
  @IsIn(CANCELLATION_HOURS, {
    message: 'cancellationHours must be one of 24, 48, 72, 168',
  })
  cancellationHours?: number;

  @ApiPropertyOptional({ enum: PaymentModel })
  @IsOptional()
  @IsEnum(PaymentModel)
  paymentModel?: PaymentModel;

  @ApiPropertyOptional({
    enum: OnArrivalPayment,
    description:
      'Whether the operator takes card on site or cash only. Ignored unless ' +
      'paymentModel = ON_ARRIVAL. Existing bookings keep their snapshot.',
  })
  @IsOptional()
  @IsEnum(OnArrivalPayment)
  onArrivalPayment?: OnArrivalPayment;

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

  // ── OCTO / delivery (editable from the details tab's OCTO & Delivery card) ──
  @ApiPropertyOptional({ enum: OctoAvailabilityType })
  @IsOptional()
  @IsEnum(OctoAvailabilityType)
  availabilityType?: OctoAvailabilityType;

  @ApiPropertyOptional({ enum: RedemptionMethod })
  @IsOptional()
  @IsEnum(RedemptionMethod)
  redemptionMethod?: RedemptionMethod;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  instantDelivery?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  availabilityRequired?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowFreesale?: boolean;

  @ApiPropertyOptional({ enum: DeliveryFormat, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryFormat, { each: true })
  deliveryFormats?: DeliveryFormat[];

  @ApiPropertyOptional({ enum: DeliveryMethod, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DeliveryMethod, { each: true })
  deliveryMethods?: DeliveryMethod[];

  // timeZone is intentionally NOT operator-editable: it is always derived from
  // the tour's destination on create (a tour belongs to exactly one destination)
  // and must not drift from the destination clock. See is-iana-timezone.validator.

  // instantConfirmation removed - never client-writable (Pastel #22, see
  // CreateTourDto).

  // ── Operator-conditions gate (Pastel #80 / MCK-20) ──
  // Null clears the gate. On a LIVE tour a non-platform change is HELD for
  // review like title/description/photos - legal conditions must never change
  // silently under travellers. DOCUMENT requires the operator to have a
  // conditions document on file (the text itself is platform-managed).
  @ApiPropertyOptional({
    enum: OperatorTermsKind,
    nullable: true,
    description:
      'Operator-conditions gate flavor; null removes the gate. DOCUMENT requires the operator conditions document to exist.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateTourDto) => o.operatorTermsKind !== null)
  @IsEnum(OperatorTermsKind)
  operatorTermsKind?: OperatorTermsKind | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'ACKNOWLEDGMENT only: 2-6 first-person participation facts (English; other locales via the Translation Console). Never platform policy.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  acknowledgmentItems?: string[];

  @ApiPropertyOptional({
    description:
      "DOCUMENT only: the operator's conditions text (English), authored in the dashboard rich-text editor. Sanitized server-side with the PAGES pipeline before storage; one document per operator, shared by all its tours.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  operatorTermsDocument?: string;

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

  @ApiPropertyOptional({
    example: false,
    description:
      'Guests sleep on board (whole-unit charters). Forces the Overnight charter group for <16h sleep trips.',
  })
  @IsOptional()
  @IsBoolean()
  sleepAboard?: boolean;

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

  // NOTE: isLocalsFavourite is intentionally NOT settable here. It is a manual
  // editorial flag (master §field-table) curated only by admins via the dedicated
  // MANAGE_EDITORIAL endpoints (PATCH /tours/:id/locals-favourite), never by
  // operators editing their own tour. See LOCALS-FAVOURITE-EDITORIAL-CHECKLIST.md.

  @ApiPropertyOptional({
    example: true,
    description:
      'Manual CMS launch override for the "Likely to sell out" demand badge. null = use the computed daily signal; true/false = force it.',
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  likelyToSellOutOverride?: boolean | null;

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
