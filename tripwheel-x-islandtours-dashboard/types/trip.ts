// Trip (a.k.a. Tour) types - mirror the backend `tours` + `tours/:tourId` + `availability`
// contracts exactly. Backend route base is `/tours` (NOT `/trips`).

// ── Enums (string unions matching prisma/enums.prisma) ──────────────────────────
export type TripStatus = 'DRAFT' | 'LIVE' | 'PAUSED' | 'ARCHIVED';

// Mirrors backend TourApprovalStatus (conflict #1 content-review workflow).
export type TripApprovalStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';
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
  /** Required: also the default capacity every departure falls back on. */
  maxPartySize: number;
  minPartySize: number;
  bookingCutoffMinutes: number;
  cancellationHours: number;
  checkInMinutesBefore: number | null;
  instantConfirmation: boolean;
  /** Operator-conditions gate (Pastel #80): null = ungated. On a LIVE tour
   *  the gated owner's read overlays any STAGED change, so the wizard edits
   *  what the operator proposed, not what travellers see. */
  operatorTermsKind: 'DOCUMENT' | 'ACKNOWLEDGMENT' | null;
  /** {locale: string[]} confirm-list facts; the wizard edits the EN entry,
   *  the Translation Console the rest. */
  acknowledgmentItems: Record<string, string[]> | null;
  /** {locale: sanitized TipTap HTML} conditions document - lives on the
   *  OPERATOR (one per operator); the wizard edits EN, the console the rest. */
  operatorTermsDocument: Record<string, string> | null;

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
  /**
   * Guests sleep on board (whole-unit charters). With the backend's >=16h
   * duration fallback this drives the hub page's Day/Overnight charter split.
   */
  sleepAboard: boolean;
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
  // Approval workflow (conflict #1): operators submit-for-review, the
  // platform approves; publish requires APPROVED.
  approvalStatus: TripApprovalStatus;
  submittedAt: string | null;
  reviewNote: string | null;
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
  /** Per-person zone price (tour currency); charged only when pickupModel = PAID_ADDON. */
  price: string | null;
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
/**
 * Why an operator closed (mck-15 §4). Mirrors the backend `ClosureReason`.
 *
 * It decides what a TRAVELLER is told, so it is not a note: SOLD_OUT reads
 * "Sold out" with the date struck through and only the operator reopens it;
 * NOT_RUNNING reads "No departure", plain, because nothing was ever on sale
 * that day. Only SOLD_OUT counts toward the §3.7 demand signal.
 */
export type TourClosureReason = 'SOLD_OUT' | 'NOT_RUNNING';

/**
 * Which side of the marketplace performed an availability act (MCK-16 change
 * 10). Mirrors the backend `ActorSide`. PLATFORM = Island Tours; OPERATOR =
 * the tour's own operator seat (owner, manager or staff). An operator undoing
 * a platform closure should know what they are undoing.
 */
export type TourActorSide = 'OPERATOR' | 'PLATFORM';

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
  // Null on non-closures, and on closures written before reasons existed -
  // those keep reading as a plain "Closed", which is what they always meant.
  closureReason: TourClosureReason | null;
  // Audit surface (dev spec §6.5): who made the change, and when.
  createdAt: string; // ISO
  createdByName: string | null;
  // Which side made it. Optional while the backend deploy catches up - render
  // nothing rather than guessing when the key is absent.
  createdBySide?: TourActorSide | null;
  // Soft retirement: a reopen/undo RETIRES the row instead of deleting it, so
  // the Date changes register shows both the closure and its reopening. A
  // retired row is history - it is no longer in force and cannot be undone.
  retiredAt?: string | null;
  retiredByName?: string | null;
  retiredBySide?: TourActorSide | null;
}

// ── Management calendar (operator month grid) ───────────────────────────────────

export type DepartureStatus = 'OPEN' | 'CLOSED' | 'SOLD_OUT' | 'CANCELLED';

// A materialized departure as the MANAGEMENT view returns it (exact remaining
// always disclosed, live status folded with the booking cutoff).
export interface TourDeparture {
  id: string;
  tourId: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  capacity: number;
  bookedCount: number;
  remaining: number | null;
  status: DepartureStatus;
  available: boolean;
  soldOutAt: string | null;
  // Set only on an operator-closed departure; null when the closure is the
  // read-time booking cutoff, which is a plain "Closed".
  closureReason: TourClosureReason | null;
  manuallyEdited: boolean;
}

// F13 status line: "is this tour selling?" in one read. 0 open in 30 days =
// out of every ranked listing (§7.2) until a date opens.
export interface AvailabilitySummary {
  openInNext30Days: number;
  nextDeparture: { date: string; startTime: string } | null;
}

// ── Daily agenda (Surface B): one operator, ALL tours, one list ──────────────

export interface AgendaDeparture
  extends Pick<
    TourDeparture,
    | 'id'
    | 'tourId'
    | 'date'
    | 'startTime'
    | 'bookedCount'
    | 'capacity'
    | 'status'
  > {
  tourName: string;
  pricingModel: PricingModel;
  // Cutoff has passed (tour-local). Status folds this into CLOSED per the
  // read contract; the agenda renders it as "Departed" instead - a 07:00 boat
  // that already left is not a problem to fix.
  cutoffPassed: boolean;
  // The CLOSE_DATE/CLOSE_SLOT row stopping this departure, when one exists -
  // its id feeds Reopen, the rest is the audit line: who, when, which side
  // (MCK-16 change 10), and the reason the traveller calendar is rendering
  // (change 5). The two new keys are optional while the backend deploy
  // catches up.
  closure: {
    id: string;
    createdAt: string;
    createdByName: string | null;
    createdBySide?: TourActorSide | null;
    closureReason?: TourClosureReason | null;
    note: string | null;
  } | null;
}

export interface AgendaDay {
  date: string;
  departures: AgendaDeparture[];
}

export interface AgendaResponse {
  days: AgendaDay[];
  // timeZone rides along (optional during the deploy window) so audit
  // timestamps render on the ISLAND's clock - the E.9 one-clock rule.
  tours: { id: string; name: string; timeZone?: string }[];
  // The STALEST availability_confirmed_at across tours (weakest link).
  lastConfirmedAt: string | null;
}

// ── Global calendar overview: one grid, admin platform-wide ─────────────────
// Operators (and their staff) are pinned to their own tours; ADMIN reads every
// operator and may narrow with operatorId/tourId. Same departure shape as the
// agenda plus the operatorId the admin grid groups/filters by.

export interface OverviewDeparture extends AgendaDeparture {
  operatorId: string;
}

export interface OverviewDay {
  date: string;
  departures: OverviewDeparture[];
}

// Tour metadata the calendar's management popovers need: startTimes constrain
// a new weekly schedule's startTime, maxPartySize is the default capacity.
export interface OverviewTour {
  id: string;
  name: string;
  operatorId: string;
  operatorName: string;
  timeZone: string;
  pricingModel: PricingModel;
  // What one UNIT booking takes whole - drives the "Whole boat" pill noun
  // (MCK-16 change 11). Optional while the backend deploy catches up.
  wholeUnitType?: WholeUnitType | null;
  maxPartySize: number;
  startTimes: string[];
  // This tour's own freshness stamp - per tour because the field IS per tour
  // (MCK-16 change 12). Optional while the backend deploy catches up.
  availabilityConfirmedAt?: string | null;
}

export interface AvailabilityOverviewResponse {
  // The island's real today, independent of the requested window - never
  // infer today from days[0].
  today: string;
  days: OverviewDay[];
  tours: OverviewTour[];
  lastConfirmedAt: string | null;
  // The two-flavour empty-horizon signal (MCK-16 change 8): LIVE tours with
  // no open departure in the 30-day listing gate. dry = timetable ran out /
  // closures (amber, open timetables); full = every departure sold out (good
  // news, add departures). Null on the platform-wide admin read; optional
  // while the backend deploy catches up.
  horizon?: {
    dry: { id: string; name: string }[];
    full: { id: string; name: string }[];
  } | null;
}

// What a range close would hit (client review #5) - the modal states these
// before the confirm button. Guests are travellers with a committed booking
// on a departure in the range; a close keeps all of them.
export interface RangeImpact {
  departures: number;
  tours: number;
  bookedGuests: number;
}

// One scope shape for the three range endpoints (close / reopen / impact
// preview): a single tour, or every active tour of an operator and/or an
// island (client review #10). Mirrors the backend's RangeScopeDto.
export interface RangeScopeParams {
  tourId?: string;
  operatorId?: string;
  destinationId?: string;
  from: string;
  to: string;
}

export interface AvailabilityOverviewParams {
  from?: string; // 'YYYY-MM-DD', defaults to the island's today
  days?: number; // default 42 (six-week grid), max 62
  tourId?: string;
  operatorId?: string; // honoured for ADMIN only
  destinationId?: string; // island narrowing, honoured for every caller
}

// open = every in-service slot sellable · partial = some slot closed/overridden ·
// closed = whole day stop-sold · no_service = no departures (see `scheduled`).
export type ManageCalendarDayStatus = 'open' | 'partial' | 'closed' | 'no_service';

export interface ManageCalendarDay {
  date: string; // 'YYYY-MM-DD'
  status: ManageCalendarDayStatus;
  scheduled: boolean; // weekly pattern covers this date
  // Times the weekly pattern produces on this date, present even BEFORE the
  // engine materializes them - beyond-horizon days must never look empty.
  scheduledTimes: string[];
  bookedTotal: number; // seats booked across the day - gate one-tap closes on it
  departures: TourDeparture[];
  exceptions: TourException[];
}

// ── Query params ────────────────────────────────────────────────────────────────
export interface MyTripsQueryParams {
  search?: string;
  status?: TripStatus;
  /**
   * Review state - a SEPARATE axis from `status`, not a fifth status value.
   * Submitting for review stamps PENDING and leaves `status` alone, so a tour
   * awaiting approval may be DRAFT, PAUSED or ARCHIVED. Sent independently;
   * the backend ANDs the two.
   */
  approvalStatus?: TripApprovalStatus;
  /** The operator's whole review loop (PENDING + REJECTED) at once - the
   *  operator Submissions view. Ignored when approvalStatus is set. */
  reviewLoop?: boolean;
  sortBy?: 'updatedAt' | 'submittedAt';
  sortDir?: 'asc' | 'desc';
  destinationId?: string;
  page?: number;
  limit?: number;
}

export interface AdminTripsQueryParams {
  search?: string;
  status?: TripStatus;
  /** See MyTripsQueryParams.approvalStatus - same separate axis. WITHOUT it
   *  the admin list excludes PENDING/REJECTED (they live on /submissions);
   *  'ANY' skips the axis entirely (the command palette's jump-to-anything). */
  approvalStatus?: TripApprovalStatus | 'ANY';
  operatorId?: string;
  destinationId?: string;
  isLocalsFavourite?: boolean;
  /** Both review states at once - the Submissions queue's "All" view. */
  reviewLoop?: boolean;
  /** The Submissions queue sorts submittedAt asc - FIFO review fairness. */
  sortBy?: 'updatedAt' | 'submittedAt';
  sortDir?: 'asc' | 'desc';
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
  // instantConfirmation is not writable (Pastel #22) - the backend rejects it.
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
  sleepAboard?: boolean;
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

/**
 * PATCH /tours/:id.
 *
 * `undefined` and `null` mean DIFFERENT things here, and the difference is the
 * whole contract: the backend writes each column behind a
 * `dto.x !== undefined` guard, and `JSON.stringify` drops undefined keys from
 * the body outright. So an omitted key preserves the stored value and an
 * explicit `null` clears it.
 *
 * Every nullable column is therefore typed `| null`. They were typed without
 * it, which quietly forced every wizard step to express "the operator emptied
 * this box" as `undefined` - the one value that means "leave it alone" - so
 * clearing a duration, a meeting point or a minimum age reported success and
 * changed nothing. Use `blankToNull` / `numberOrNull` from
 * `lib/trips/update-payload.ts` rather than hand-rolling the conversion.
 */
export interface UpdateTripPayload {
  name?: string;
  // Renaming the slug issues a 301 redirect + 90-day cooldown (backend handles it).
  slug?: string;
  categoryIds?: string[];
  primaryCategoryId?: string;
  hubIds?: string[];
  pricingModel?: PricingModel;
  wholeUnitType?: WholeUnitType | null;
  defaultCurrency?: Currency;
  basePrice?: string | null;
  unitIncludedGuests?: number | null;
  extraPersonPrice?: string | null;
  durationMinutesFrom?: number | null;
  durationMinutesTo?: number | null;
  pickupModel?: PickupModel;
  pickupRequired?: boolean;
  maxPartySize?: number;
  minPartySize?: number;
  bookingCutoffMinutes?: number;
  cancellationHours?: number;
  paymentModel?: PaymentModel;
  onArrivalPayment?: OnArrivalPayment;
  // instantConfirmation is not writable (Pastel #22) - the backend rejects it.
  bookingType?: TourBookingType | null;
  // Operator-conditions gate (Pastel #80): kind + EN facts + EN document
  // travel together and ONLY the Booking rules step sends them. On a LIVE
  // tour the backend HOLDS the change for review instead of applying it.
  operatorTermsKind?: 'DOCUMENT' | 'ACKNOWLEDGMENT' | null;
  acknowledgmentItems?: string[];
  /** TipTap HTML from the rich-text editor; sanitized server-side with the
   *  PAGES pipeline before storage. */
  operatorTermsDocument?: string;
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
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  departureCity?: string | null;
  minAgeYears?: number | null;
  fitnessLevel?: FitnessLevel | null;
  sleepAboard?: boolean;
  weatherDependent?: boolean;
  wheelchairAccessible?: boolean;
  familyFriendly?: boolean;
  suitableForBeginners?: boolean;
  // No `isLocalsFavourite` / `likelyToSellOutOverride`: both are EARNED or
  // editorial signals an operator must not be able to self-award, so the
  // 2026-08-02 audit pulled them out of UpdateTourDto. Each has its own
  // MANAGE_EDITORIAL-gated verb - PATCH /tours/:id/locals-favourite and
  // PATCH /tours/:id/likely-to-sell-out. Nothing sends them today; they are
  // listed here only so the next person does not re-add them and rediscover
  // the `isActive` 400 the hard way.
  checkInMinutesBefore?: number | null;
  reference?: string | null;
  ogImage?: string | null;
  h1Override?: string | null;
  breadcrumbLabel?: string | null;
  // No `isActive`: PATCH /tours/:id rejects it. Visibility moves through
  // POST /tours/:id/pause | /unpause | /archive | /restore, which keep the
  // slug_registry row in step with the tour.
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
  // priceNet deliberately absent (client review #20): net = price minus tier
  // commission, derived server-side reading - never client-written.
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
  // priceNet deliberately absent - see CreateTourAgeBandPayload.
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
  /** Per-person zone price (tour currency); only meaningful on PAID_ADDON tours. */
  price?: string;
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
  /** Per-person zone price (tour currency); explicit null clears it. */
  price?: string | null;
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
  // set_capacity: required. add_slot: optional - blank/omitted resolves to the
  // tour's maxPartySize server-side (and only a MANAGE_AVAILABILITY seat may
  // name one; a plain add rides the narrow stop-sell grant).
  capacity?: number;
  note?: string;
  // CLOSE_DATE / CLOSE_SLOT only — the backend rejects it on the other two.
  closureReason?: TourClosureReason;
}

// ── Live-tour pending content changes (client review #19 / dashboard #80) ──
// Edits an operator makes to a LIVE tour's title, description content or
// photos are HELD in one of these instead of applied - travellers keep seeing
// the approved version. Price and booking cutoff stay instant lanes.

export type PendingChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PendingChangeArea =
  | 'title'
  | 'content'
  | 'photos'
  | 'conditions'
  | 'highlights'
  | 'inclusions'
  | 'exclusions'
  | 'features'
  | 'locations';

/** Operator-conditions gate flavors (Pastel #80 / MCK-20). */
export type OperatorTermsKind = 'DOCUMENT' | 'ACKNOWLEDGMENT';

/** The staged operator-conditions unit - the WHOLE desired state. */
export interface StagedConditions {
  kind: OperatorTermsKind | null;
  acknowledgmentItems: Record<string, string[]> | null;
  /** {locale: sanitized HTML} - lives on the OPERATOR row when applied. */
  document: Record<string, string> | null;
  /** Bookkeeping, never rendered: the operator's document as it stood when
   *  this unit was staged - the backend CAS-checks the approval against it. */
  documentBase?: Record<string, string> | null;
}

/** One staged list item - the list GET's shape (flat base columns plus a
 *  translations array carrying EVERY locale). */
export interface StagedTripListItem extends Record<string, unknown> {
  id: string;
  translations: Array<{ locale: string } & Record<string, unknown>>;
  isNew?: boolean;
}

export type StagedListKind =
  | 'highlights'
  | 'inclusions'
  | 'exclusions'
  | 'features'
  | 'locations';

export interface StagedTripImage {
  id: string;
  url: string;
  isHero: boolean;
  focalX: number;
  focalY: number;
  altText: string | null;
  displayOrder: number;
  width: number;
  height: number;
  /** Added while staged - no real image row exists yet. */
  isNew?: boolean;
}

export interface TripPendingChangePayload {
  tour?: { name?: string };
  /** Proposed TourTranslation fields per locale (defined fields only). */
  translations?: Record<string, Record<string, unknown>>;
  /** The staged copy of the WHOLE gallery, when photos were touched. */
  images?: StagedTripImage[];
  /** Staged copies of the itemized content lists - whole state per kind. */
  lists?: Partial<Record<StagedListKind, StagedTripListItem[]>>;
  /** The staged operator-conditions gate change (Pastel #80). */
  conditions?: StagedConditions;
  /** Bookkeeping: per-unit "last staged" ISO stamps, keyed
   *  'title' | 'photos' | 'conditions' | `tr:{locale}:{field}` |
   *  `list:{kind}`. */
  meta?: { fieldTimes?: Record<string, string> };
}

export interface TripPendingChange {
  id: string;
  tourId: string;
  status: PendingChangeStatus;
  payload: TripPendingChangePayload;
  changedAreas: PendingChangeArea[];
  /** LIVE counterparts of every kept field (open sets only) - the server
   *  collects these during its read-time prune so BOTH roles diff against
   *  one consistent snapshot (the operator's own reads are overlaid). */
  current?: {
    tour?: { name: string | null };
    translations?: Record<string, Record<string, unknown>>;
    images?: StagedTripImage[];
    lists?: Partial<Record<StagedListKind, StagedTripListItem[]>>;
    conditions?: StagedConditions;
  };
  submittedAt: string;
  submittedById: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  reviewNote: string | null;
  updatedAt: string;
}

/** Admin queue row - the change set plus the tour summary it belongs to. */
export interface PendingChangeQueueRow extends TripPendingChange {
  tour: {
    id: string;
    name: string;
    slug: string;
    status: TripStatus;
    destination: { id: string; name: string; slug: string };
    /** Present on the admin queue only - the operator lane omits it. */
    operator?: {
      id: string;
      companyInfo: { companyName: string | null } | null;
      user: { name: string | null; email: string } | null;
    };
    /** Hero image only (take 1). */
    images: Array<{ url: string }>;
  };
}

export interface PaginatedPendingChanges {
  total: number;
  page: number;
  limit: number;
  data: PendingChangeQueueRow[];
}
