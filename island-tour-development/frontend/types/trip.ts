// Trip (a.k.a. Tour) types - mirror the backend `tours` + `tours/:tourId` + `availability`
// contracts exactly. Backend route base is `/tours` (NOT `/trips`).

// ── Enums (string unions matching prisma/enums.prisma) ──────────────────────────
export type TripStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'ARCHIVED';
export type PricingModel = 'PER_PERSON' | 'UNIT';
export type WholeUnitType = 'GROUP' | 'BOAT' | 'VEHICLE' | 'AIRCRAFT' | 'PACKAGE';
export type PickupModel = 'INCLUDED' | 'PAID_ADDON' | 'NONE';
export type AddOnUnit = 'PER_PERSON' | 'FLAT';
export type PaymentModel = 'OPERATOR_LINK' | 'ON_ARRIVAL' | 'PAID_IN_FULL' | 'OPERATOR_FULL';
export type TourBookingType = 'PRIVATE' | 'SHARED';
export type FitnessLevel = 'EASY' | 'MODERATE' | 'CHALLENGING';
export type ExclusionType = 'PAID_ADVANCE' | 'PAID_ONSITE' | 'UNAVAILABLE' | 'NOT_PERMITTED';
export type TierKey = 'premium' | 'featured' | 'boosted' | 'organic' | 'standard';
export type EligibilityState = 'LOCKED' | 'PROVISIONAL' | 'ELIGIBLE' | 'GRACE' | 'DEMOTED';
export type Currency = 'USD' | 'EUR';
// Departure/schedule availability status (availability module).
export type AvailabilityStatus = 'AVAILABLE' | 'FREESALE' | 'SOLD_OUT' | 'LIMITED' | 'CLOSED';

export const CANCELLATION_HOURS = [24, 48, 72, 168] as const;

// ── Core trip (TourResponseDto + list/detail enrichment) ────────────────────────
export interface TripListItem {
  id: string;
  name: string;
  slug: string;
  status: TripStatus;
  operatorId: string;
  destinationId: string;
  // V2: many-to-many categories (one primary) + many-to-many hubs
  categoryIds: string[];
  primaryCategoryId: string | null;
  hubIds: string[];

  // Pricing
  pricingModel: PricingModel;
  wholeUnitType: WholeUnitType | null;
  defaultCurrency: Currency;
  basePrice: string | null;
  priceFrom: string | null;

  // Duration range
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;

  // Pickup / party / booking window
  pickupModel: PickupModel;
  pickupRequired: boolean;
  maxPartySize: number | null;
  minPartySize: number;
  bookingCutoffMinutes: number;
  cancellationHours: number;
  instantConfirmation: boolean;

  // Booking / payment (master E.3)
  paymentModel: PaymentModel;
  depositPct: string;
  bookingType: TourBookingType | null;

  // Meeting point / departure
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  departureCity: string | null;

  // Audience / accessibility flags
  minAgeYears: number | null;
  fitnessLevel: FitnessLevel | null;
  weatherDependent: boolean;
  wheelchairAccessible: boolean;
  familyFriendly: boolean;
  suitableForBeginners: boolean;
  isLocalsFavourite: boolean;

  // Commercial tier (read-only, system-managed)
  commissionTier: string;
  tierKey: TierKey;
  tierRank: number;
  tierLockedUntil: string | null;
  qualityScore: string;
  eligibilityState: EligibilityState;
  isBookable: boolean;
  firstPublishedAt: string | null;

  // SEO overrides
  h1Override: string | null;
  breadcrumbLabel: string | null;

  // Ratings + CRO signals (0/null until the bookings module ships)
  aggregateRating: number | null;
  aggregateReviewCount: number;
  bookingCount: number;
  bookingCountToday: number;
  spotsRemaining: number | null;
  lastBookedAt: string | null;

  isSponsored: boolean;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Resolved names (backend join - present on list + detail)
  destinationName?: string | null;
  categoryNames?: string[];
  primaryCategoryName?: string | null;
  hubNames?: string[];

  // Detail-only counts + hero
  heroImage?: TripHeroImage | null;
  imageCount?: number;
  highlightCount?: number;
  inclusionCount?: number;
  exclusionCount?: number;

  // Admin list only
  operatorInfo?: {
    id: string;
    companyName: string | null;
    userName: string;
    userEmail: string;
  } | null;
}

export interface TripHeroImage {
  id: string;
  url: string;
  altText: string | null;
}

export interface PaginatedTrips {
  total: number;
  page: number;
  limit: number;
  data: TripListItem[];
}

export interface TripUpdateResponse {
  trip: TripListItem;
  warnings: string[];
}

// ── Child models ────────────────────────────────────────────────────────────────
export interface TourImage {
  id: string;
  tourId: string;
  url: string;
  isHero: boolean;
  focalX: number;
  focalY: number;
  altText: string | null;
  displayOrder: number;
  width: number;
  height: number;
}

export interface TourAddOn {
  id: string;
  tourId: string;
  name: string;
  description: string | null;
  price: string;
  unit: AddOnUnit;
  maxQuantity: number;
  displayOrder: number;
  isActive: boolean;
}

export interface TourAgeBand {
  id: string;
  tourId: string;
  label: string;
  minAge: number | null;
  maxAge: number | null;
  price: string;
  priceOriginal: string | null;
  priceNet: string | null;
  isDefault: boolean;
  displayOrder: number;
}

export interface TourLanguage {
  id: string;
  tourId: string;
  language: string;
}

export interface TourHighlightTranslation {
  locale: string;
  text: string;
  isMachineTranslated: boolean;
}

export interface TourHighlight {
  id: string;
  tourId: string;
  displayOrder: number;
  imageUrl?: string | null;
  translations: TourHighlightTranslation[];
}

export interface TourInclusionTranslation {
  locale: string;
  label: string;
  isMachineTranslated: boolean;
}

export interface TourInclusion {
  id: string;
  tourId: string;
  icon: string;
  displayOrder: number;
  imageUrl?: string | null;
  translations: TourInclusionTranslation[];
}

export interface TourExclusionTranslation {
  locale: string;
  label: string;
  isMachineTranslated: boolean;
}

export interface TourExclusion {
  id: string;
  tourId: string;
  icon: string;
  type: ExclusionType | null;
  priceText: string | null;
  displayOrder: number;
  imageUrl?: string | null;
  translations: TourExclusionTranslation[];
}

export interface TripTranslation {
  locale: string;
  title: string | null;
  overview: string | null;
  description: string | null;
  shortDescription: string | null;
  whatToBring: string | null;
  knowBeforeYouGo: string | null;
  notSuitableFor: string | null;
  localTip: string | null;
  meetingPointText: string | null;
  isMachineTranslated: boolean;
  updatedAt: string;
}

// Recurring schedule (availability module - `/availability/schedules`).
export interface TourSchedule {
  id: string;
  tourId: string;
  weekdays: number[]; // 0=Sun … 6=Sat
  startTimes: string[]; // 'HH:MM'
  capacity: number;
  seasonStart: string | null;
  seasonEnd: string | null;
  priceOverride: string | null;
  isActive: boolean;
}

// ── Query params ────────────────────────────────────────────────────────────────
export interface MyTripsQueryParams {
  search?: string;
  status?: TripStatus;
  page?: number;
  limit?: number;
}

export interface AdminTripsQueryParams {
  search?: string;
  status?: TripStatus;
  operatorId?: string;
  page?: number;
  limit?: number;
}

// ── Create / update payloads ────────────────────────────────────────────────────
export interface CreateTripPayload {
  name: string;
  slug?: string;
  destinationId: string;
  categoryIds: string[];
  primaryCategoryId?: string;
  hubIds?: string[];
  pricingModel?: PricingModel;
  wholeUnitType?: WholeUnitType;
  defaultCurrency?: Currency;
  basePrice?: string;
  durationMinutesFrom?: number;
  durationMinutesTo?: number;
  pickupModel?: PickupModel;
  pickupRequired?: boolean;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  paymentModel?: PaymentModel;
  instantConfirmation?: boolean;
  bookingType?: TourBookingType;
  meetingPointLat?: number;
  meetingPointLng?: number;
  departureCity?: string;
  minAgeYears?: number;
  fitnessLevel?: FitnessLevel;
  weatherDependent?: boolean;
  wheelchairAccessible?: boolean;
  familyFriendly?: boolean;
  suitableForBeginners?: boolean;
  reference?: string;
  h1Override?: string;
  breadcrumbLabel?: string;
}

export interface UpdateTripPayload {
  name?: string;
  // Renaming the slug issues a 301 redirect + 90-day cooldown (backend handles it).
  slug?: string;
  categoryIds?: string[];
  primaryCategoryId?: string;
  hubIds?: string[];
  pricingModel?: PricingModel;
  wholeUnitType?: WholeUnitType;
  defaultCurrency?: Currency;
  basePrice?: string;
  durationMinutesFrom?: number;
  durationMinutesTo?: number;
  pickupModel?: PickupModel;
  pickupRequired?: boolean;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  paymentModel?: PaymentModel;
  instantConfirmation?: boolean;
  bookingType?: TourBookingType;
  meetingPointLat?: number;
  meetingPointLng?: number;
  departureCity?: string;
  minAgeYears?: number;
  fitnessLevel?: FitnessLevel;
  weatherDependent?: boolean;
  wheelchairAccessible?: boolean;
  familyFriendly?: boolean;
  suitableForBeginners?: boolean;
  isLocalsFavourite?: boolean;
  reference?: string;
  h1Override?: string | null;
  breadcrumbLabel?: string | null;
  isActive?: boolean;
}

export interface AddTourImagePayload {
  url: string;
  isHero?: boolean;
  focalX?: number;
  focalY?: number;
  altText?: string;
  displayOrder?: number;
  width: number;
  height: number;
}

export interface UpdateTourImagePayload {
  isHero?: boolean;
  focalX?: number;
  focalY?: number;
  altText?: string;
  displayOrder?: number;
}

export interface CreateTourAddOnPayload {
  name: string;
  description?: string;
  price: string;
  unit?: AddOnUnit;
  maxQuantity?: number;
  displayOrder?: number;
}

export interface UpdateTourAddOnPayload {
  name?: string;
  description?: string;
  price?: string;
  unit?: AddOnUnit;
  maxQuantity?: number;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateTourAgeBandPayload {
  label: string;
  minAge?: number;
  maxAge?: number;
  price: string;
  priceOriginal?: string;
  priceNet?: string;
  isDefault?: boolean;
  displayOrder?: number;
}

export interface UpdateTourAgeBandPayload {
  label?: string;
  minAge?: number;
  maxAge?: number;
  price?: string;
  priceOriginal?: string;
  priceNet?: string;
  isDefault?: boolean;
  displayOrder?: number;
}

export interface CreateTourHighlightPayload {
  text: string;
  displayOrder?: number;
  imageUrl?: string;
}

export interface UpdateTourHighlightPayload {
  displayOrder?: number;
  imageUrl?: string | null;
}

export interface UpsertHighlightTranslationPayload {
  text: string;
  isMachineTranslated?: boolean;
}

export interface CreateTourInclusionPayload {
  label: string;
  icon?: string;
  displayOrder?: number;
  imageUrl?: string;
}

export interface UpdateTourInclusionPayload {
  icon?: string;
  displayOrder?: number;
  imageUrl?: string | null;
}

export interface UpsertInclusionTranslationPayload {
  label: string;
  isMachineTranslated?: boolean;
}

export interface CreateTourExclusionPayload {
  label: string;
  icon?: string;
  type?: ExclusionType;
  priceText?: string;
  displayOrder?: number;
  imageUrl?: string;
}

export interface UpdateTourExclusionPayload {
  icon?: string;
  type?: ExclusionType;
  priceText?: string | null;
  displayOrder?: number;
  imageUrl?: string | null;
}

export interface UpsertExclusionTranslationPayload {
  label: string;
  isMachineTranslated?: boolean;
}

export interface UpsertTripTranslationPayload {
  title?: string | null;
  overview?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  whatToBring?: string | null;
  knowBeforeYouGo?: string | null;
  notSuitableFor?: string | null;
  localTip?: string | null;
  meetingPointText?: string | null;
  isMachineTranslated?: boolean;
}

export interface AddTourLanguagePayload {
  language: string;
}

// Recurring-schedule payloads (availability module).
export interface CreateTourSchedulePayload {
  weekdays: number[];
  startTimes: string[];
  capacity: number;
  seasonStart?: string;
  seasonEnd?: string;
  priceOverride?: number;
}

export interface UpdateTourSchedulePayload {
  weekdays?: number[];
  startTimes?: string[];
  capacity?: number;
  seasonStart?: string;
  seasonEnd?: string;
  priceOverride?: number;
  isActive?: boolean;
}
