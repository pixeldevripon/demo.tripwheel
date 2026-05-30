// Enums as string unions
export type TripStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'ARCHIVED';
export type PricingModel = 'PER_PERSON' | 'UNIT';
export type PickupModel = 'NONE' | 'INCLUDED' | 'OPTIONAL';
export type UnitType = 'HOUR' | 'DAY' | 'PERSON' | 'GROUP';
export type AgeBandType = 'ADULT' | 'CHILD' | 'INFANT';
export type AddOnUnit = 'PER_PERSON' | 'FLAT';
export type ScheduleStatus = 'AVAILABLE' | 'SOLD_OUT' | 'CLOSED' | 'CANCELLED';

// Core trip (my-trips list item)
export interface TripListItem {
  id: string;
  name: string;
  slug: string;
  status: TripStatus;
  operatorId: string;
  destinationId: string;
  categoryId: string;
  hubId: string | null;
  pricingModel: PricingModel;
  unitType: UnitType | null;
  basePrice: string | null;
  priceFrom: string | null;
  durationMinutes: number | null;
  pickupModel: PickupModel;
  maxPartySize: number | null;
  minPartySize: number;
  bookingCutoffMinutes: number;
  cancellationHours: number;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  aggregateRating: number | null;
  aggregateReviewCount: number;
  isSponsored: boolean;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Only in detail
  heroImage?: TripHeroImage | null;
  imageCount?: number;
  scheduleCount?: number;
  highlightCount?: number;
  inclusionCount?: number;
  featuredSlotNumber?: number | null;
  featuredSlotStatus?: string | null;
  // Only in admin list
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

// Child models
export interface TourImage {
  id: string;
  tripId: string;
  url: string;
  isHero: boolean;
  focalX: number;
  focalY: number;
  altText: string | null;
  displayOrder: number;
  width: number;
  height: number;
}

export interface TourAgeBand {
  id: string;
  tripId: string;
  bandType: AgeBandType;
  label: string;
  minAge: number | null;
  maxAge: number | null;
  price: string;
  minCount: number;
  maxCount: number | null;
  displayOrder: number;
}

export interface TourAddOn {
  id: string;
  tripId: string;
  name: string;
  description: string | null;
  price: string;
  unit: AddOnUnit;
  maxQuantity: number;
  displayOrder: number;
  isActive: boolean;
}

export interface TourLanguage {
  id: string;
  tripId: string;
  language: string;
}

export interface TourHighlightTranslation {
  locale: string;
  text: string;
  isMachineTranslated: boolean;
}

export interface TourHighlight {
  id: string;
  tripId: string;
  displayOrder: number;
  translations: TourHighlightTranslation[];
}

export interface TourInclusionTranslation {
  locale: string;
  label: string;
  isMachineTranslated: boolean;
}

export interface TourInclusion {
  id: string;
  tripId: string;
  icon: string;
  displayOrder: number;
  translations: TourInclusionTranslation[];
}

export interface TripTranslation {
  locale: string;
  title: string | null;
  overview: string | null;
  description: string | null;
  isMachineTranslated: boolean;
  updatedAt: string;
}

export interface TourSchedule {
  id: string;
  tripId: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  totalSpots: number;
  availableSpots: number;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

// Query params
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

// Create/Update payloads
export interface CreateTripPayload {
  name: string;
  slug?: string;
  destinationId: string;
  categoryId: string;
  hubId?: string | null;
  pricingModel?: PricingModel;
  unitType?: UnitType;
  basePrice?: string;
  durationMinutes?: number;
  pickupModel?: PickupModel;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  h1Override?: string;
  breadcrumbLabel?: string;
}

export interface UpdateTripPayload {
  name?: string;
  categoryId?: string;
  pricingModel?: PricingModel;
  unitType?: UnitType;
  basePrice?: string;
  durationMinutes?: number;
  pickupModel?: PickupModel;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
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

export interface CreateTourAgeBandPayload {
  bandType: AgeBandType;
  label: string;
  minAge?: number;
  maxAge?: number;
  price: string;
  minCount?: number;
  maxCount?: number;
  displayOrder?: number;
}

export interface UpdateTourAgeBandPayload {
  label?: string;
  minAge?: number;
  maxAge?: number;
  price?: string;
  minCount?: number;
  maxCount?: number;
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

export interface CreateTourHighlightPayload {
  text: string;
  displayOrder?: number;
}

export interface UpsertHighlightTranslationPayload {
  text: string;
  isMachineTranslated?: boolean;
}

export interface CreateTourInclusionPayload {
  label: string;
  icon?: string;
  displayOrder?: number;
}

export interface UpdateTourInclusionPayload {
  icon?: string;
  displayOrder?: number;
}

export interface UpsertInclusionTranslationPayload {
  label: string;
  isMachineTranslated?: boolean;
}

export interface UpsertTripTranslationPayload {
  title?: string | null;
  overview?: string | null;
  description?: string | null;
  isMachineTranslated?: boolean;
}

export interface CreateTourSchedulePayload {
  startDate: string;
  endDate?: string;
  startTime: string;
  totalSpots: number;
}

export interface UpdateTourSchedulePayload {
  totalSpots?: number;
  availableSpots?: number;
  status?: ScheduleStatus;
}

export interface AddTourLanguagePayload {
  language: string;
}
