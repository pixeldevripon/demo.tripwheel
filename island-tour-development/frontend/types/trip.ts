// Trip (a.k.a. Tour) types - mirror the backend `tours` + `tours/:tourId` + `availability`
// contracts exactly. Backend route base is `/tours` (NOT `/trips`).

// ── Enums (string unions matching prisma/enums.prisma) ──────────────────────────
export type TripStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'ARCHIVED';
export type PricingModel = 'PER_PERSON' | 'UNIT';
export type WholeUnitType = 'GROUP' | 'BOAT' | 'VEHICLE' | 'AIRCRAFT' | 'PACKAGE';
export type PickupModel = 'INCLUDED' | 'PAID_ADDON' | 'NONE';
export type AddOnUnit = 'PER_PERSON' | 'FLAT';
export type PaymentModel = 'OPERATOR_LINK' | 'ON_ARRIVAL' | 'PAID_IN_FULL' | 'OPERATOR_FULL';
/** On-site payment terms. Only meaningful when paymentModel = ON_ARRIVAL. */
export type OnArrivalPayment = 'CARD_OR_CASH' | 'CASH_ONLY';
export type TourBookingType = 'PRIVATE' | 'SHARED';
export type FitnessLevel = 'EASY' | 'MODERATE' | 'CHALLENGING';
export type ExclusionType = 'PAID_ADVANCE' | 'PAID_ONSITE' | 'UNAVAILABLE' | 'NOT_PERMITTED';
// Typed per-traveler pricing bands (master E.3). Lets the API compose pricing.adult etc.
export type AgeBandType = 'ADULT' | 'CHILD' | 'INFANT' | 'YOUTH' | 'SENIOR';
// Whether a priced band takes part in the activity or only rides along (Figma "Bringing Spectators?").
export type BandParticipation = 'PARTICIPANT' | 'SPECTATOR';
// OCTO product attributes (master E.3 / §1.4).
export type OctoAvailabilityType = 'START_TIME' | 'OPENING_HOURS';
export type DeliveryFormat = 'PDF_URL' | 'QRCODE' | 'CODE128' | 'PKPASS_URL';
export type DeliveryMethod = 'VOUCHER' | 'TICKET';
export type RedemptionMethod = 'DIGITAL' | 'PRINT' | 'MANIFEST';
// Feature types (master E.3). INCLUSION/EXCLUSION/HIGHLIGHT have dedicated tables/tabs;
// the dashboard Features tab only manages the informational + terms variants below.
export type FeatureType =
  | 'INCLUSION'
  | 'EXCLUSION'
  | 'HIGHLIGHT'
  | 'PREBOOKING_INFORMATION'
  | 'PREARRIVAL_INFORMATION'
  | 'REDEMPTION_INSTRUCTION'
  | 'ACCESSIBILITY_INFORMATION'
  | 'ADDITIONAL_INFORMATION'
  | 'BOOKING_TERM'
  | 'CANCELLATION_TERM';
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
  // UNIT (charter) pricing: base covers `unitIncludedGuests`; each extra traveler
  // beyond that (up to maxPartySize) costs `extraPersonPrice`. Null for PER_PERSON.
  unitIncludedGuests: number | null;
  extraPersonPrice: string | null;

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
  checkInMinutesBefore: number | null;
  instantConfirmation: boolean;

  // OCTO product attributes (master E.3 §1.4)
  timeZone: string;
  availabilityType: OctoAvailabilityType;
  instantDelivery: boolean;
  availabilityRequired: boolean;
  allowFreesale: boolean;
  deliveryFormats: DeliveryFormat[];
  deliveryMethods: DeliveryMethod[];
  redemptionMethod: RedemptionMethod;
  // The tour's slot set ('HH:MM'); availability schedules switch these on per weekday
  startTimes: string[];

  // Booking / payment (master E.3)
  paymentModel: PaymentModel;
  onArrivalPayment: OnArrivalPayment;
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
  ogImage: string | null;
  // Operator's external reference (OCTO product id)
  reference: string | null;

  // Ratings + CRO signals (0/null until the bookings module ships)
  aggregateRating: number | null;
  aggregateReviewCount: number;
  bookingCount: number;
  bookingCountToday: number;
  spotsRemaining: number | null;
  lastBookedAt: string | null;
  // Demand signal (master §3.7). `likelyToSellOut` is the computed daily value;
  // `likelyToSellOutOverride` is the manual CMS launch override (null = use computed).
  likelyToSellOut: boolean;
  likelyToSellOutOverride: boolean | null;

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
  bandType: AgeBandType;
  participation: BandParticipation;
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

export interface TourFeatureTranslation {
  locale: string;
  text: string;
  isMachineTranslated: boolean;
}

export interface TourFeature {
  id: string;
  tourId: string;
  type: FeatureType;
  displayOrder: number;
  translations: TourFeatureTranslation[];
}

export interface TourLocationTranslation {
  locale: string;
  title: string;
  shortDescription: string | null;
  isMachineTranslated: boolean;
}

export interface TourLocation {
  id: string;
  tourId: string;
  types: string[]; // e.g. ['START'], ['ITINERARY_ITEM'], ['END'], ['POI']
  latitude: number | null;
  longitude: number | null;
  streetAddress: string | null;
  addressLocality: string | null;
  addressRegion: string | null;
  postalCode: string | null;
  addressCountry: string | null;
  minutesTo: number | null;
  minutesAt: number | null;
  displayOrder: number;
  translations: TourLocationTranslation[];
}

export interface PickupLocationTranslation {
  locale: string;
  title: string;
  directions: string | null;
  isMachineTranslated: boolean;
}

export interface PickupLocation {
  id: string;
  tourId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  minutesPrior: number | null;
  windowStart: string | null; // 'HH:MM'
  windowEnd: string | null; // 'HH:MM'
  displayOrder: number;
  isActive: boolean;
  translations: PickupLocationTranslation[];
}

export interface TripTranslation {
  locale: string;
  title: string | null;
  overview: string | null;
  description: string | null;
  shortDescription: string | null;
  whatToBring: string[];
  knowBeforeYouGo: string[];
  notSuitableFor: string[];
  whatToExpectIntro: string | null;
  categoryDisplay: string | null;
  localTipTitle: string | null;
  localTipBody: string | null;
  /** "A note from {operator}" card in the confirmation email. */
  operatorNote: string | null;
  meetingPointText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isMachineTranslated: boolean;
  updatedAt: string;
}

// Recurring schedule (availability module - `/availability/schedules`).
// Availability schedule status (backend AvailabilityScheduleStatus enum).
export type AvailabilityScheduleStatus = 'ACTIVE' | 'PAUSED';

// One recurring rule = one weekday + one start time (the backend models these
// flat, one row per weekday × startTime — NOT grouped).
export interface TourSchedule {
  id: string;
  tourId: string;
  weekday: number; // 0=Monday … 6=Sunday (matches AvailabilitySchedule.weekday)
  startTime: string; // 'HH:MM'
  capacityOverride: number | null; // null = Tour.maxPartySize default
  validFrom: string; // 'YYYY-MM-DD'
  validUntil: string | null;
  status: AvailabilityScheduleStatus;
}

// Date-specific override of the recurring pattern (the daily operational tool).
// Materialized into departures alongside the schedules.
export type TourExceptionType =
  | 'CLOSE_DATE' // stop-sell the whole date
  | 'CLOSE_SLOT' // stop-sell one slot on a date
  | 'ADD_SLOT' // extra departure the weekly pattern does not produce
  | 'SET_CAPACITY'; // override capacity for one slot (startTime set) or all (null)

export interface TourException {
  id: string;
  tourId: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string | null; // null = whole date
  type: TourExceptionType;
  capacity: number | null; // add_slot / set_capacity
  note: string | null;
}

// ── Query params ────────────────────────────────────────────────────────────────
export interface MyTripsQueryParams {
  search?: string;
  status?: TripStatus;
  destinationId?: string;
  page?: number;
  limit?: number;
}

export interface AdminTripsQueryParams {
  search?: string;
  status?: TripStatus;
  operatorId?: string;
  destinationId?: string;
  isLocalsFavourite?: boolean;
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
  unitIncludedGuests?: number;
  extraPersonPrice?: string;
  durationMinutesFrom?: number;
  durationMinutesTo?: number;
  pickupModel?: PickupModel;
  pickupRequired?: boolean;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  paymentModel?: PaymentModel;
  onArrivalPayment?: OnArrivalPayment;
  instantConfirmation?: boolean;
  bookingType?: TourBookingType;
  // OCTO product attributes (master E.3 §1.4)
  timeZone?: string;
  availabilityType?: OctoAvailabilityType;
  instantDelivery?: boolean;
  availabilityRequired?: boolean;
  allowFreesale?: boolean;
  deliveryFormats?: DeliveryFormat[];
  deliveryMethods?: DeliveryMethod[];
  redemptionMethod?: RedemptionMethod;
  startTimes?: string[];
  meetingPointLat?: number;
  meetingPointLng?: number;
  departureCity?: string;
  minAgeYears?: number;
  fitnessLevel?: FitnessLevel;
  weatherDependent?: boolean;
  wheelchairAccessible?: boolean;
  familyFriendly?: boolean;
  suitableForBeginners?: boolean;
  checkInMinutesBefore?: number;
  reference?: string;
  ogImage?: string;
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
  unitIncludedGuests?: number;
  extraPersonPrice?: string;
  durationMinutesFrom?: number;
  durationMinutesTo?: number;
  pickupModel?: PickupModel;
  pickupRequired?: boolean;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  paymentModel?: PaymentModel;
  onArrivalPayment?: OnArrivalPayment;
  instantConfirmation?: boolean;
  bookingType?: TourBookingType;
  // OCTO product attributes (master E.3 §1.4)
  timeZone?: string;
  availabilityType?: OctoAvailabilityType;
  instantDelivery?: boolean;
  availabilityRequired?: boolean;
  allowFreesale?: boolean;
  deliveryFormats?: DeliveryFormat[];
  deliveryMethods?: DeliveryMethod[];
  redemptionMethod?: RedemptionMethod;
  startTimes?: string[];
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
  // Manual demand-badge override (null = use the computed daily signal)
  likelyToSellOutOverride?: boolean | null;
  checkInMinutesBefore?: number;
  reference?: string | null;
  ogImage?: string | null;
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
  bandType: AgeBandType;
  participation?: BandParticipation;
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
  bandType?: AgeBandType;
  participation?: BandParticipation;
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
  // Backend expects string arrays (one item per entry), NOT a single blob.
  whatToBring?: string[];
  knowBeforeYouGo?: string[];
  notSuitableFor?: string[];
  whatToExpectIntro?: string | null;
  categoryDisplay?: string | null;
  localTipTitle?: string | null;
  localTipBody?: string | null;
  operatorNote?: string | null;
  meetingPointText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isMachineTranslated?: boolean;
}

// ── Feature payloads ──────────────────────────────────────────────────────────
export interface CreateTourFeaturePayload {
  type: FeatureType;
  text: string;
  displayOrder?: number;
}

export interface UpdateTourFeaturePayload {
  type?: FeatureType;
  displayOrder?: number;
}

export interface UpsertFeatureTranslationPayload {
  text: string;
  isMachineTranslated?: boolean;
}

// ── Location payloads ─────────────────────────────────────────────────────────
export interface CreateTourLocationPayload {
  types: string[];
  title: string;
  shortDescription?: string;
  latitude?: number;
  longitude?: number;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
  minutesTo?: number;
  minutesAt?: number;
  displayOrder?: number;
}

export interface UpdateTourLocationPayload {
  types?: string[];
  latitude?: number | null;
  longitude?: number | null;
  streetAddress?: string | null;
  addressLocality?: string | null;
  addressRegion?: string | null;
  postalCode?: string | null;
  addressCountry?: string | null;
  minutesTo?: number | null;
  minutesAt?: number | null;
  displayOrder?: number;
}

export interface UpsertLocationTranslationPayload {
  title: string;
  shortDescription?: string;
  isMachineTranslated?: boolean;
}

// ── Pickup location payloads ──────────────────────────────────────────────────
export interface CreatePickupLocationPayload {
  name: string;
  title?: string;
  directions?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  minutesPrior?: number;
  windowStart?: string;
  windowEnd?: string;
  displayOrder?: number;
}

export interface UpdatePickupLocationPayload {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  minutesPrior?: number | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpsertPickupLocationTranslationPayload {
  title: string;
  directions?: string;
  isMachineTranslated?: boolean;
}

export interface AddTourLanguagePayload {
  language: string;
}

// Recurring-schedule payloads (availability module).
export interface CreateTourSchedulePayload {
  weekday: number; // 0=Monday … 6=Sunday
  startTime: string; // 'HH:MM' — must be one of the tour's startTimes
  capacityOverride?: number; // omit = Tour.maxPartySize default
  validFrom?: string; // 'YYYY-MM-DD' — defaults to today
  validUntil?: string; // 'YYYY-MM-DD' — omit = open-ended
  status?: AvailabilityScheduleStatus;
}

export interface UpdateTourSchedulePayload {
  weekday?: number;
  startTime?: string;
  capacityOverride?: number | null;
  validFrom?: string;
  validUntil?: string | null;
  status?: AvailabilityScheduleStatus;
}

// Date-exception payload (availability module). `startTime`/`capacity` apply per type.
export interface CreateTourExceptionPayload {
  date: string; // 'YYYY-MM-DD'
  type: TourExceptionType;
  startTime?: string; // 'HH:MM' — required for close_slot/add_slot; omit = whole date
  capacity?: number; // required for add_slot/set_capacity
  note?: string;
}
