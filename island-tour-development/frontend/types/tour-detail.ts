/**
 * Public tour detail - the response shape of `GET /tours/slug/:slug`
 * (backend `TourPublicDetailResponseDto`, served by `ToursService.findBySlug`).
 *
 * All localized fields are already resolved to the requested locale with a
 * field-by-field English fallback applied server-side (MULTILINGUAL-CONTENT.md
 * "Fetch & fallback"), so the frontend never has to fall back itself. Date
 * fields arrive as ISO strings over JSON. Neutral (type-only) so it is safe in
 * both server and client bundles.
 */
import type {
  AddOnUnit,
  Currency,
  EligibilityState,
  ExclusionType,
  FeatureType,
  FitnessLevel,
  PaymentModel,
  PickupModel,
  PricingModel,
  TierKey,
  TourBookingType,
  TripStatus,
  WholeUnitType,
} from './trip';

/** Resolved (locale → EN fallback) tour translation row. */
export interface PublicTourTranslation {
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
  meetingPointText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isMachineTranslated: boolean;
}

export interface PublicTourHighlight {
  id: string;
  displayOrder: number;
  text: string;
}

export interface PublicTourImage {
  id: string;
  url: string;
  isHero: boolean;
  altText: string | null;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  displayOrder: number;
}

export interface PublicTourInclusion {
  id: string;
  icon: string;
  displayOrder: number;
  label: string;
}

export interface PublicTourExclusion {
  id: string;
  icon: string;
  type: ExclusionType;
  priceText: string | null;
  displayOrder: number;
  label: string;
}

export interface PublicTourAddOn {
  id: string;
  name: string;
  description: string | null;
  price: string;
  unit: AddOnUnit;
  maxQuantity: number;
  displayOrder: number;
}

export interface PublicTourAgeBand {
  id: string;
  bandType: string;
  participation: string;
  label: string;
  minAge: number | null;
  maxAge: number | null;
  price: string;
  priceOriginal: string | null;
  priceNet: string | null;
  isDefault: boolean;
  displayOrder: number;
}

export interface PublicTourLocation {
  id: string;
  types: string[];
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
  title: string;
  shortDescription: string | null;
}

export interface PublicPickupLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  minutesPrior: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  displayOrder: number;
  title: string;
  directions: string | null;
}

export interface PublicTourFeature {
  id: string;
  type: FeatureType;
  displayOrder: number;
  text: string;
}

export interface PublicTourDetail {
  id: string;
  name: string;
  slug: string;
  status: TripStatus;
  operatorId: string;
  destinationId: string;
  categoryIds: string[];
  primaryCategoryId: string | null;
  hubIds: string[];

  // Pricing
  pricingModel: PricingModel;
  wholeUnitType: WholeUnitType | null;
  defaultCurrency: Currency;
  basePrice: string | null;
  priceFrom: string | null;
  /** UNIT pricing: guests covered by basePrice before per-head surcharge. null for PER_PERSON. */
  unitIncludedGuests: number | null;
  /** UNIT pricing: surcharge per traveler beyond unitIncludedGuests. null for PER_PERSON. */
  extraPersonPrice: string | null;
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;

  // Pickup / party / booking window
  pickupModel: PickupModel;
  pickupRequired: boolean;
  maxPartySize: number | null;
  minPartySize: number;
  bookingCutoffMinutes: number;
  cancellationHours: number;
  startTimes: string[];
  instantConfirmation: boolean;
  paymentModel: PaymentModel;
  depositPct: string;
  bookingType: TourBookingType | null;
  timeZone: string;

  // Meeting point / departure
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  departureCity: string | null;
  checkInMinutesBefore: number | null;

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
  qualityScore: string;
  eligibilityState: EligibilityState;
  isBookable: boolean;

  // SEO / routing
  h1Override: string | null;
  breadcrumbLabel: string | null;
  ogImage: string | null;

  // Reviews / CRO signals (0/null until the reviews + bookings modules populate them)
  aggregateRating: number | null;
  aggregateReviewCount: number;
  ratingDistribution: number[];
  photoReviewCount: number;
  bookingCount: number;
  bookingCountToday: number;
  spotsRemaining: number | null;
  lastBookedAt: string | null;
  isSponsored: boolean;

  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  /** Operator display name (company name, else account name). */
  operatorName: string | null;

  // Relations (localized, EN fallback applied server-side)
  translation: PublicTourTranslation | null;
  images: PublicTourImage[];
  highlights: PublicTourHighlight[];
  inclusions: PublicTourInclusion[];
  exclusions: PublicTourExclusion[];
  addOns: PublicTourAddOn[];
  ageBands: PublicTourAgeBand[];
  locations: PublicTourLocation[];
  pickupLocations: PublicPickupLocation[];
  features: PublicTourFeature[];
  languages: string[];
}
