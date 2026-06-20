# OCTO Prisma schema design

> **What this is.** The complete **proposed** Prisma split-schema for the OCTO-aligned platform —
> tours, options, units, availability/departures, bookings + unit items, payments, reviews, the
> commercial engine (tiers/eligibility/spotlight), and OCTO partner webhooks — strictly following the
> [OCTO spec](./OCTO-SPECIFICATION-REFERENCE.md) and the master rules ([`../MASTER-CHECKLIST.md`](../MASTER-CHECKLIST.md)).
>
> **Status: design only — the live `backend/prisma/*.prisma` is NOT changed by this doc.** Apply after
> review. Naming follows the decision in [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md):
> one entity name everywhere — **`tour`** (no `trip`, no `product`).
>
> **Companions:** [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md) ·
> [`OCTO-AVAILABILITY-AND-BOOKING.md`](./OCTO-AVAILABILITY-AND-BOOKING.md) ·
> [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md).

---

## 1. Design principles

1. **One name: `tour`.** `Trip` → `Tour`, `trips.prisma` → `tours.prisma`, `/trips` → `/tours`. OCTO's
   `product` is serialized from `Tour`. (Tables keep stable `@@map` names where useful for migration.)
2. **OCTO hierarchy is real in the DB:** `Tour` (product) → `TourOption` (option) → `TourUnit` (unit).
   Every tour has ≥1 option (an auto-created `DEFAULT`); units belong to an option. This is stricter
   than the master's flat age-band model but is what OCTO requires and enables multi-option later.
3. **Money: `Decimal(10,2)` in the DB, minor units at the OCTO boundary.** Amounts stay decimal for
   accounting/commission precision; the serializer emits `amount = round(decimal * 10^precision)` with
   `currency` + `currencyPrecision`. (Decision D2.)
4. **Reserve → confirm bookings.** `Booking` holds inventory (`ON_HOLD`, `utcExpiresAt`); confirm
   commits; expiry/cancel release. One `BookingUnitItem` per traveler (OCTO unit item).
5. **Inventory single source of truth = `Departure`.** Materialized from `AvailabilitySchedule` +
   `AvailabilityException`. `vacancies` is the atomic counter (see availability doc Phase 5).
6. **Commercial engine stays native** (tiers, quality score, eligibility, spotlight, commission) —
   not exposed in OCTO JSON, but lives on the same models.
7. **Soft-delete / deactivate** (master soft-delete strategy): prefer `isActive` / status over hard
   delete; financial rows are retained.
8. **Split schema** (Prisma 7 auto-merges `*.prisma`). New/renamed files listed in §13.

---

## 2. Enums (`enums.prisma`)

```prisma
// ── Localisation ──
enum Locale { en es nl pt fr de zh }

// ── User / Auth ── (unchanged: Role, UserStatus, Permission*)
// * Permission: drop MANAGE_SLOTS / VIEW_SLOT_ANALYTICS (slot economy removed);
//   add MANAGE_AVAILABILITY, MANAGE_BOOKINGS, MANAGE_PAYMENTS, MANAGE_TIERS, APPROVE_SPOTLIGHT.

// ── Tour ──
enum TourStatus { DRAFT LIVE PAUSED ARCHIVED }            // renamed from TripStatus
enum PricingModel { PER_PERSON UNIT }                      // → OCTO pricingPer (UNIT→UNIT, UNIT-asset→BOOKING)
enum WholeUnitType { GROUP BOAT VEHICLE AIRCRAFT PACKAGE } // renamed from UnitType (asset-priced tours)
enum PickupModel { INCLUDED PAID_ADDON NONE }
enum AddOnUnit { PER_PERSON FLAT }

// ── OCTO catalog ──
enum OctoAvailabilityType { START_TIME OPENING_HOURS }
enum UnitType { ADULT YOUTH CHILD INFANT FAMILY SENIOR STUDENT MILITARY OTHER } // OCTO participant unit
enum DeliveryFormat { PDF_URL QRCODE CODE128 PKPASS_URL }
enum DeliveryMethod { VOUCHER TICKET }
enum RedemptionMethod { DIGITAL PRINT MANIFEST }
enum FeatureType {
  INCLUSION EXCLUSION HIGHLIGHT PREBOOKING_INFORMATION PREARRIVAL_INFORMATION
  REDEMPTION_INSTRUCTION ACCESSIBILITY_INFORMATION ADDITIONAL_INFORMATION
  BOOKING_TERM CANCELLATION_TERM
}

// ── Availability ──
enum AvailabilityStatus { AVAILABLE FREESALE SOLD_OUT LIMITED CLOSED } // replaces ScheduleStatus
enum AvailabilityExceptionType { BLACKOUT EXTRA_DEPARTURE CAPACITY_OVERRIDE PRICE_OVERRIDE TIME_OVERRIDE }

// ── Bookings (OCTO lifecycle) ──
enum BookingStatus { ON_HOLD CONFIRMED EXPIRED CANCELLED REDEEMED PENDING REJECTED }
enum CancellationRefund { FULL PARTIAL NONE }
enum CancelledBy { CUSTOMER OPERATOR ADMIN SYSTEM }

// ── Payments ──
enum PaymentModel { OPERATOR_LINK ON_ARRIVAL PAID_IN_FULL OPERATOR_FULL }
enum PaymentProvider { STRIPE MOLLIE }
enum PaymentKind { DEPOSIT BALANCE FULL REFUND }
enum PaymentStatus { REQUIRES_PAYMENT PROCESSING SUCCEEDED FAILED REFUNDED PARTIALLY_REFUNDED CANCELLED }

// ── Commercial engine (master) ──
enum TierKey { premium featured boosted organic standard }     // + spotlight handled separately
enum EligibilityState { LOCKED PROVISIONAL ELIGIBLE GRACE DEMOTED }
enum SpotlightStatus { REQUESTED APPROVED REJECTED ACTIVE EXPIRED }

// ── Reviews (E.7) ──
enum ReviewModerationStatus { PENDING APPROVED REJECTED }

// ── OCTO notifications (octo/notifications webhooks) ──
enum NotificationType { PRODUCT_UPDATE AVAILABILITY_UPDATE BOOKING_UPDATE }   // the three OCTO types
enum NotificationDeliveryStatus { PENDING DELIVERED FAILED DEAD }

// ── Geography / discovery (unchanged) ──
enum Region { CARIBBEAN ATLANTIC MEDITERRANEAN ASIA AFRICA }
enum HubType { LOCATION HIGHLIGHT AREA }
enum Currency { USD EUR }
enum SlugEntityType { TOUR CATEGORY HUB COLLECTION RESERVED }
enum CollectionType { MANUAL DYNAMIC }
enum FeaturedEntityType { CATEGORY HUB }
enum HubPickType { BEST_OVERALL MOST_POPULAR BEST_FOR_FAMILIES BEST_VALUE }
enum AttributeDataType { BOOLEAN ENUM ENUM_MULTI INTEGER DECIMAL TEXT }
enum FilterDisplayType { CHECKBOX RANGE_SLIDER RADIO DROPDOWN }
enum OperatorVerificationStatus { UNVERIFIED PENDING VERIFIED REJECTED }

// ── REMOVED ── SlotStatus, WaitlistStatus, AgeBandType (→ UnitType), ScheduleStatus (→ AvailabilityStatus), TripStatus (→ TourStatus)
```

> `cancellationHours` stays an `Int` (default `48`) with app-level validation to the enum-bound set
> `[24,48,72,168]` (Prisma enums can't be numeric).

---

## 3. Tours (`tours.prisma`)

### 3.1 Tour (= OCTO product)

```prisma
model Tour {
  id            String @id @default(uuid())
  operatorId    String
  destinationId String

  name   String                       // canonical English name
  slug   String                       // English, unique per destination
  status TourStatus @default(DRAFT)

  // ── OCTO product attributes ──
  timeZone             String                                  // IANA, e.g. "America/Curacao" (or derive from destination)
  availabilityType     OctoAvailabilityType @default(START_TIME)
  instantConfirmation  Boolean              @default(true)
  instantDelivery      Boolean              @default(true)
  availabilityRequired Boolean              @default(true)
  allowFreesale        Boolean              @default(false)
  deliveryFormats      DeliveryFormat[]     @default([PDF_URL, QRCODE])
  deliveryMethods      DeliveryMethod[]     @default([VOUCHER])
  redemptionMethod     RedemptionMethod     @default(DIGITAL)
  reference            String?                                 // operator's external id (OCTO reference)

  // ── Pricing model ──
  pricingModel  PricingModel   @default(PER_PERSON)   // → OCTO pricingPer
  wholeUnitType WholeUnitType?                        // when pricingModel = UNIT (boat/vehicle…)
  defaultCurrency Currency     @default(USD)
  basePrice     Decimal?       @db.Decimal(10, 2)
  priceFrom     Decimal?       @db.Decimal(10, 2)     // cached min for listing

  // ── Operational / booking logic (master E.3) ──
  durationMinutesFrom  Int?
  durationMinutesTo    Int?
  pickupModel          PickupModel @default(NONE)
  minPartySize         Int         @default(1)        // → option.restrictions.minUnits
  maxPartySize         Int?                            // → option.restrictions.maxUnits
  bookingCutoffMinutes Int         @default(120)      // → availability.utcCutoffAt
  cancellationHours    Int         @default(48)       // enum-bound [24,48,72,168]; → option.cancellationCutoff
  paymentModel         PaymentModel @default(OPERATOR_LINK)
  depositPct           Decimal      @default(20.0) @db.Decimal(4, 1) // 20–30 in 2.5 steps (tier-driven)

  // ── Commercial engine (master) ──
  commissionTier   Decimal          @default(20.0) @db.Decimal(4, 1) // 20/22.5/25/27.5/30 (+35 spotlight)
  tierKey          TierKey          @default(standard)
  tierRank         Int              @default(5)  @db.SmallInt        // denormalized; never client-written
  tierLockedUntil  DateTime?
  qualityScore     Decimal          @default(0)  @db.Decimal(6, 2)  // nightly job
  eligibilityState EligibilityState @default(LOCKED)
  isBookable       Boolean          @default(false)                 // ≥1 AVAILABLE departure ≤30d (nightly)
  firstPublishedAt DateTime?

  // ── SEO overrides ──
  h1Override      String?
  breadcrumbLabel String?

  // ── Cached review aggregates (on review approve) ──
  aggregateRating      Float?
  aggregateReviewCount Int       @default(0)
  aggregatesUpdatedAt  DateTime?

  // ── CRO counters (master §10) ──
  bookingCount      Int       @default(0)
  bookingCountToday Int       @default(0)
  spotsRemaining    Int?
  lastBookedAt      DateTime?

  // ── Flags ──
  isSponsored Boolean @default(false)
  isActive    Boolean @default(true)

  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  operator        Operator                @relation(fields: [operatorId], references: [id])
  destination     Destination             @relation(fields: [destinationId], references: [id])
  options         TourOption[]            // ≥1 (one DEFAULT)
  categories      TourCategory[]          // 1+ (one isPrimary)
  hubs            TourHub[]               // 0–n
  attributes      TourAttribute[]
  images          TourImage[]
  addOns          TourAddOn[]
  languages       TourLanguage[]
  highlights      TourHighlight[]
  inclusions      TourInclusion[]
  exclusions      TourExclusion[]
  features        TourFeature[]           // OTHER OCTO feature types (terms, accessibility, prebooking…) — DS1
  locations       TourLocation[]          // OCTO locations / itinerary
  translations    TourTranslation[]
  schedules       AvailabilitySchedule[]
  exceptions      AvailabilityException[]
  departures      Departure[]
  bookings        Booking[]
  reviews         Review[]
  wishlists       Wishlist[]
  spotlight       SpotlightRequest[]
  hubOurPicks     HubOurPick[]
  hubComparison   HubComparisonTour[]

  @@unique([destinationId, slug])
  @@index([operatorId])
  @@index([destinationId])
  @@index([status])
  @@index([tierRank, qualityScore])      // ranking
  @@index([isBookable])
  @@map("tours")
}
```

### 3.2 TourOption (= OCTO option)

```prisma
model TourOption {
  id        String  @id @default(uuid())
  tourId    String
  isDefault Boolean @default(false)      // OCTO option.default
  internalName String @default("Standard")
  reference String?

  // OCTO option fields (many derived from Tour, persisted for multi-option futures)
  availabilityLocalStartTimes String[] @default([])  // ["09:00","13:00"]
  cancellationCutoffAmount    Int      @default(48)
  cancellationCutoffUnit      String   @default("hour")   // hour|minute|day
  requiredContactFields       String[] @default(["firstName","lastName","emailAddress"])
  minUnits Int?                                            // restrictions.minUnits (default from tour.minPartySize)
  maxUnits Int?                                            // restrictions.maxUnits

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tour       Tour       @relation(fields: [tourId], references: [id], onDelete: Cascade)
  units      TourUnit[]
  departures Departure[]
  bookings   Booking[]

  @@index([tourId])
  @@map("tour_options")
}
```

### 3.3 TourUnit (= OCTO unit; replaces TourAgeBand)

```prisma
model TourUnit {
  id       String   @id @default(uuid())
  optionId String
  type     UnitType                      // ADULT | CHILD | INFANT | … (OCTO)
  internalName String                    // 'Adult', 'Child (4-12)'
  reference String?

  // OCTO unit.restrictions
  minAge       Int?
  maxAge       Int?
  idRequired   Boolean @default(false)
  minQuantity  Int?
  maxQuantity  Int?
  paxCount     Int     @default(1)        // headcount consumed toward capacity
  accompaniedBy String[] @default([])     // unit types that must accompany (e.g. ["ADULT"])

  // Pricing (Decimal in DB → OCTO Pricing at boundary)
  priceRetail   Decimal  @db.Decimal(10, 2)
  priceOriginal Decimal? @db.Decimal(10, 2)   // pre-discount (OCTO original)
  priceNet      Decimal? @db.Decimal(10, 2)   // operator net
  taxes         Json?    @default("[]")        // [{ name, retail, original?, net? }]

  displayOrder Int @default(0)

  option    TourOption        @relation(fields: [optionId], references: [id], onDelete: Cascade)
  unitItems BookingUnitItem[]

  @@index([optionId])
  @@map("tour_units")
}
```

### 3.4 OCTO content children — features & locations

**Decision DS1 — keep dedicated tables; do NOT unify.** Highlights, inclusions, and exclusions stay
as their own tables (§3.5) for the richer admin UX (`icon`, `imageUrl`, per-type ordering).
`TourFeature` holds **only the other OCTO feature types** (terms, accessibility, prebooking/prearrival,
redemption, additional info) — not HIGHLIGHT/INCLUSION/EXCLUSION. At the OCTO boundary, the serializer
merges all four sources into `features[]`, tagging each with the right `FeatureType`.

```prisma
// OCTO features OTHER than highlight/inclusion/exclusion (terms, accessibility, prebooking info…)
model TourFeature {
  id           String      @id @default(uuid())
  tourId       String
  type         FeatureType                       // PREBOOKING_INFORMATION | ACCESSIBILITY_INFORMATION | BOOKING_TERM | … (not H/I/E)
  displayOrder Int         @default(0)

  tour         Tour                      @relation(fields: [tourId], references: [id], onDelete: Cascade)
  translations TourFeatureTranslation[]

  @@index([tourId, type])
  @@map("tour_features")
}
model TourFeatureTranslation {
  id        String  @id @default(uuid())
  featureId String
  locale    Locale
  text      String
  isMachineTranslated Boolean @default(false)
  feature   TourFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  @@unique([featureId, locale])
  @@map("tour_feature_translations")
}

// OCTO locations / itinerary (start, itinerary item, end, POI…)
model TourLocation {
  id           String   @id @default(uuid())
  tourId       String
  types        String[] @default([])     // ["START"], ["ITINERARY_ITEM"], ["END"] …
  latitude     Float?
  longitude    Float?
  streetAddress String?
  addressLocality String?
  addressRegion String?
  postalCode   String?
  addressCountry String?
  minutesTo    Int?
  minutesAt    Int?
  displayOrder Int      @default(0)

  tour         Tour                      @relation(fields: [tourId], references: [id], onDelete: Cascade)
  translations TourLocationTranslation[]

  @@index([tourId])
  @@map("tour_locations")
}
model TourLocationTranslation {
  id         String @id @default(uuid())
  locationId String
  locale     Locale
  title      String
  shortDescription String?
  isMachineTranslated Boolean @default(false)
  location   TourLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  @@unique([locationId, locale])
  @@map("tour_location_translations")
}
```

### 3.5 Unchanged-shape children (renamed `tripId` → `tourId`)

`TourCategory`, `TourHub`, `TourImage`, `TourAddOn`, `TourLanguage`, `TourHighlight`(+translation),
`TourInclusion`(+translation), `TourExclusion`(+translation), `TourTranslation` keep their current
fields exactly (see the old `trips.prisma`), with `tripId`→`tourId`, relation `trip`→`tour`, and
`@relation` target `Tour`. `TourTranslation` is the rename of `TripTranslation`.

> **DS1 resolved → keep dedicated tables (not unified).** `TourHighlight`, `TourInclusion`,
> `TourExclusion` (with `icon`/`imageUrl`/order + per-locale translations) **stay as-is**. `TourFeature`
> (§3.4) covers only the other OCTO feature types. The OCTO `content` serializer **merges all four into
> `features[]`**: highlights→`HIGHLIGHT`, inclusions→`INCLUSION`, exclusions→`EXCLUSION`, plus the
> `TourFeature` rows by their own `type`. No data migration of the existing tables.

---

## 4. Availability (`availability.prisma`)

```prisma
// Recurring availability rule (operator-authored)
model AvailabilitySchedule {
  id        String  @id @default(uuid())
  tourId    String
  optionId  String?                       // null = applies to all options
  weekdays  Int[]   @default([])          // 0=Sun … 6=Sat
  startTimes String[] @default([])        // ["09:00","13:00"]
  capacity  Int
  seasonStart DateTime? @db.Date
  seasonEnd   DateTime? @db.Date
  priceOverride Decimal? @db.Decimal(10, 2)
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tour   Tour        @relation(fields: [tourId], references: [id], onDelete: Cascade)
  option TourOption? @relation(fields: [optionId], references: [id])

  @@index([tourId])
  @@map("availability_schedules")
}

// Date-specific override
model AvailabilityException {
  id        String  @id @default(uuid())
  tourId    String
  optionId  String?
  date      DateTime @db.Date
  type      AvailabilityExceptionType
  startTime String?                       // for EXTRA_DEPARTURE / TIME_OVERRIDE
  capacity  Int?                          // for CAPACITY_OVERRIDE
  priceOverride Decimal? @db.Decimal(10, 2)
  note      String?

  tour Tour @relation(fields: [tourId], references: [id], onDelete: Cascade)

  @@index([tourId, date])
  @@map("availability_exceptions")
}

// Materialized bookable slot (= OCTO Availability). Inventory source of truth.
model Departure {
  id        String   @id @default(uuid())
  tourId    String
  optionId  String

  localDateTimeStart DateTime
  localDateTimeEnd   DateTime?
  allDay     Boolean @default(false)
  capacity   Int
  vacancies  Int                          // atomic counter; CHECK (vacancies >= 0)
  status     AvailabilityStatus @default(AVAILABLE)
  utcCutoffAt DateTime
  priceOverride Decimal? @db.Decimal(10, 2)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tour     Tour       @relation(fields: [tourId], references: [id], onDelete: Cascade)
  option   TourOption @relation(fields: [optionId], references: [id])
  bookings Booking[]

  @@unique([tourId, optionId, localDateTimeStart])
  @@index([tourId, localDateTimeStart])
  @@index([status])
  @@map("departures")
}
```

> Add a DB `CHECK (vacancies >= 0)` constraint (raw SQL in the migration) as the overbooking backstop.
> Reserve uses the atomic conditional `UPDATE … WHERE vacancies >= n` (availability doc Phase 5).

---

## 5. Bookings (`bookings.prisma`)

```prisma
model Booking {
  id   String @id @default(uuid())
  uuid String @unique @default(uuid())    // OCTO uuid (client-supplied; idempotency key)

  tourId      String
  optionId    String
  departureId String?                      // null when freesale
  operatorId  String
  userId      String?                      // guest auto-created; null until known

  // OCTO refs
  resellerReference String?                // our display ref (IT-2026-XXXXX)
  supplierReference String?                // operator/external ref
  publicRef         String  @unique @default(uuid())  // TYP url token
  displayRef        String  @unique                    // IT-2026-00042 (human)

  status   BookingStatus @default(ON_HOLD)
  freesale Boolean       @default(false)
  testMode Boolean       @default(false)

  // Lifecycle timestamps
  utcExpiresAt   DateTime?
  utcConfirmedAt DateTime?
  utcRedeemedAt  DateTime?

  // Snapshot at booking time
  paymentModel PaymentModel
  currency     Currency
  localDate    DateTime @db.Date
  startTime    String?

  // Pricing snapshot (Decimal; minor units at boundary)
  totalRetail      Decimal  @db.Decimal(10, 2)
  totalNet         Decimal? @db.Decimal(10, 2)
  commissionAmount Decimal? @db.Decimal(10, 2)   // EUR-normalized conversion value; null = corruption (no conversion)
  depositAmount    Decimal  @db.Decimal(10, 2)
  balanceAmount    Decimal  @db.Decimal(10, 2)   // operator-collected balance
  taxes            Json?    @default("[]")

  // Contact (OCTO Contact; guest override of User)
  contactFirstName String?
  contactLastName  String?
  contactFullName  String?
  contactEmail     String?
  contactPhone     String?
  contactPostalCode String?
  contactCountry   String?
  contactLocales   String[] @default([])
  notes            String?

  // Attribution (master tracking E.8)
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  clickId     String?                        // gclid/fbclid/etc
  affiliateId String?                        // Trackdesk
  conversionFiredAt DateTime?                // mark-first idempotency

  // Cancellation
  cancellationRefund CancellationRefund?
  cancelledBy        CancelledBy?
  cancellationReason String?
  utcCancelledAt     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tour      Tour              @relation(fields: [tourId], references: [id])
  option    TourOption        @relation(fields: [optionId], references: [id])
  departure Departure?        @relation(fields: [departureId], references: [id])
  operator  Operator          @relation(fields: [operatorId], references: [id])
  user      User?             @relation(fields: [userId], references: [id])
  unitItems BookingUnitItem[]
  payments  Payment[]
  review    Review?

  @@index([tourId])
  @@index([operatorId])
  @@index([userId])
  @@index([status])
  @@index([departureId])
  @@index([localDate])
  @@map("bookings")
}

// OCTO UnitItem — one per traveler/ticket
model BookingUnitItem {
  id        String @id @default(uuid())
  uuid      String @unique @default(uuid())
  bookingId String
  unitId    String

  status BookingStatus @default(ON_HOLD)
  utcRedeemedAt DateTime?

  // Per-traveler contact (optional; OCTO allows per-unit contact)
  contactFirstName String?
  contactLastName  String?

  // Pricing snapshot
  priceRetail Decimal  @db.Decimal(10, 2)
  priceNet    Decimal? @db.Decimal(10, 2)

  // Ticket (OCTO Ticket delivery artifact)
  ticketCode      String?
  ticketDeliveryFormat DeliveryFormat?
  ticketUrl       String?

  booking Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  unit    TourUnit @relation(fields: [unitId], references: [id])

  @@index([bookingId])
  @@map("booking_unit_items")
}
```

---

## 6. Payments (`payments.prisma`)

```prisma
model Payment {
  id        String @id @default(uuid())
  bookingId String

  provider     PaymentProvider @default(STRIPE)
  kind         PaymentKind                      // DEPOSIT | BALANCE | FULL | REFUND
  status       PaymentStatus   @default(REQUIRES_PAYMENT)
  amount       Decimal         @db.Decimal(10, 2)
  currency     Currency
  intentId     String?                          // Stripe PaymentIntent id
  chargeId     String?
  refundId     String?
  raw          Json?                            // provider payload snapshot

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([bookingId])
  @@index([status])
  @@index([intentId])
  @@map("payments")
}

// Idempotent webhook ledger (Stripe etc.)
model StripeWebhookEvent {
  id          String   @id            // Stripe event id (idempotency)
  type        String
  processedAt DateTime?
  payload     Json
  createdAt   DateTime @default(now())

  @@map("stripe_webhook_events")
}
```

---

## 7. Per-tour review system (`reviews.prisma`, master E.7 + LD11)

**Per-tour, booking-gated, moderated, multilingual.** Every review belongs to exactly one tour
(`tourId`) and one completed booking (`bookingId @unique` → one review per booking, "verified"). The
tour page shows its own rating once it clears the **LD11 cold-start** threshold; below it, the
operator aggregate is the fallback. Approved reviews recompute the cached aggregates on `Tour` and
`Operator` and feed the nightly `qualityScore`.

```prisma
model Review {
  id        String @id @default(uuid())
  bookingId String @unique                      // one review per booking → "Verified booking"
  tourId    String                              // PER-TOUR
  operatorId String
  userId    String

  // Ratings — overall + optional sub-scores (all 1–5)
  rating         Int                            // overall
  ratingValue    Int?                           // value for money
  ratingGuide    Int?                           // guide / host
  ratingSafety   Int?                           // safety / organization
  title          String?

  // Reviewer identity (privacy-safe display)
  reviewerFirstName String?
  reviewerInitial   String?                     // "Ada B."
  reviewerCountry   String?

  travelMonth  Int?                             // 1–12
  travelYear   Int?
  photos       String[] @default([])

  isVerified   Boolean @default(true)           // always true (booking-gated)
  helpfulCount Int     @default(0)              // "N found this helpful"

  moderationStatus    ReviewModerationStatus @default(PENDING)
  rejectionReason     String?
  operatorResponse    String?
  operatorRespondedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  booking      Booking             @relation(fields: [bookingId], references: [id])
  tour         Tour                @relation(fields: [tourId], references: [id])
  operator     Operator            @relation(fields: [operatorId], references: [id])
  user         User                @relation(fields: [userId], references: [id])
  translations ReviewTranslation[]

  @@index([tourId, moderationStatus, createdAt])   // per-tour listing, newest-first
  @@index([tourId, rating])                         // sort by rating
  @@index([operatorId, moderationStatus])
  @@map("reviews")
}

model ReviewTranslation {
  id       String @id @default(uuid())
  reviewId String
  locale   Locale
  comment  String
  isMachineTranslated Boolean @default(false)
  review   Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  @@unique([reviewId, locale])
  @@map("review_translations")
}
```

**Aggregates (cached, recomputed on approve/unapprove):**
- `Tour.aggregateRating` / `aggregateReviewCount` / `aggregatesUpdatedAt` (already on `Tour`, §3.1).
- `Operator.aggregateRating` / `aggregateReviewCount` (already on `Operator`).

**LD11 cold-start rule (enforced in the service, not the schema):**
- A tour shows **its own** rating only with **≥3 approved reviews**.
- Below 3, fall back to the **operator** aggregate **only if** the operator has **≥10 reviews and
  ≥4.0** average; otherwise show no rating (not a fabricated one).

> Reviews are **native** (OCTO has no review capability). They surface on the OCTO tour content as
> `AggregateRating`/`Review` JSON-LD at the frontend (SEO doc), and feed `qualityScore` (commercial
> engine), but are served by a native `/api/v1/tours/{id}/reviews` endpoint.

---

## 8. Operators (`operators.prisma`, supplier + eligibility additions)

Add to `Operator` (rest unchanged; `trips`→`tours`, drop slot/waitlist relations, add bookings stays):

```prisma
model Operator {
  // … existing fields …

  // OCTO supplier contact (E.164 phone)
  contactEmail String?
  contactPhone String?

  // Eligibility engine (master)
  cancellationRate90d Decimal @default(0) @db.Decimal(5, 2)  // % over trailing 90d
  totalBookings       Int     @default(0)
  forceMajeurePardons Int     @default(0)

  // Relations (revised)
  tours            Tour[]
  bookings         Booking[]
  reviews          Review[]
  spotlightRequests SpotlightRequest[]
  notificationSubscriptions NotificationSubscription[]
  // REMOVED: featuredSlots, slotLocks, waitlistEntries
}
```

`OperatorCompanyInfo`, `OperatorSocialMedia`, `OperatorStripeConfig`, `OperatorMollieConfig` unchanged.

---

## 9. Commercial engine (`tiers.prisma`)

Tier columns live on `Tour` (§3.1). Spotlight needs its own request/approval table:

```prisma
model SpotlightRequest {
  id            String @id @default(uuid())
  tourId        String
  operatorId    String
  destinationId String

  status     SpotlightStatus @default(REQUESTED)
  requestedAt DateTime @default(now())
  approvedAt DateTime?
  approvedBy String?                          // admin user id
  startsAt   DateTime?
  endsAt     DateTime?
  note       String?

  tour        Tour        @relation(fields: [tourId], references: [id], onDelete: Cascade)
  operator    Operator    @relation(fields: [operatorId], references: [id])
  destination Destination @relation(fields: [destinationId], references: [id])

  @@index([destinationId, status])           // enforce max 3 active per destination in service
  @@index([tourId])
  @@map("spotlight_requests")
}
```

> `TierKey` → `commissionTier`/`tierRank` mapping is enforced in the service (denormalized, 30-day
> lock); it is not a separate table. Quality-score + eligibility are nightly BullMQ jobs.

---

## 10. OCTO notifications / webhooks (`notifications.prisma`)

> The `octo/notifications` capability. Distinct from the existing internal `Webhooks`/`WebhookPoint`
> (Zapier/n8n lead catches) — keep those. Endpoints: `/notifications/subscriptions` CRUD + outbound
> delivery. Spec: [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md) §5.4.

```prisma
model NotificationSubscription {
  id         String   @id @default(uuid())
  operatorId String?                              // null = platform-level
  url        String                               // subscriber webhook endpoint
  secret     String                               // HMAC signing (our convention; D13)
  notificationTypes NotificationType[] @default([]) // PRODUCT_UPDATE | AVAILABILITY_UPDATE | BOOKING_UPDATE
  headers    Json?    @default("{}")              // optional custom headers echoed on delivery
  isActive   Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  operator   Operator?                @relation(fields: [operatorId], references: [id])
  deliveries NotificationDelivery[]

  @@index([operatorId])
  @@map("notification_subscriptions")
}

model NotificationDelivery {
  id             String @id @default(uuid())      // = notification id (idempotency for subscriber)
  subscriptionId String
  notificationType NotificationType
  payload        Json                             // { id, subscriptionId, notificationType, utcCreatedAt, data }
  status         NotificationDeliveryStatus @default(PENDING)
  attempts       Int     @default(0)
  lastError      String?
  deliveredAt    DateTime?

  createdAt DateTime @default(now())

  subscription NotificationSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId, status])
  @@map("notification_deliveries")
}
```

Optional iCal (secondary sync):

```prisma
model IcalSyncLog {
  id        String   @id @default(uuid())
  tourId    String?
  direction String                            // "export" | "import"
  status    String                            // "ok" | "failed"
  message   String?
  createdAt DateTime @default(now())
  @@index([tourId])
  @@map("ical_sync_logs")
}
```

---

## 11. Unchanged models (keep as-is; only `Trip`→`Tour` back-relations rename)

`user.prisma` (User, Session, Account, Verification — add `bookings Booking[]`, `tours`? no;
keep `reviews`, `wishlists`), `destinations.prisma` (Destination + Hub + HubAllowedCategory +
HubOurPick + HubComparisonGroup/Tour + FeaturedExperience), `categories.prisma`, `collections.prisma`,
`attributes.prisma` (AttributeDefinition, TourAttribute — already `tour*`), `slug-registry.prisma`,
`faq.prisma`, `media-gallery.prisma`, `settings.prisma`, `wishlist.prisma`.

Back-relation renames required where they point at the old `Trip`:
- `Destination.trips` → `tours Tour[]`
- `Category` / `Hub` via `TourCategory`/`TourHub` (relation target `Tour`)
- `User.wishlists`, `User.reviews`, add `User.bookings Booking[]`
- `Wishlist.trip` → `tour`, `tripId` → `tourId`

---

## 12. Removed (slot economy)

Delete files **`featured-slots.prisma`** (`FeaturedSlot`, `SlotLock`, `SlotHistory`) and
**`waitlist.prisma`** (`WaitlistEntry`), their enums (`SlotStatus`, `WaitlistStatus`), and all
relations on `Operator`/`Tour`. (Already in the master checklist's removal list.)

---

## 13. File layout (after)

```text
prisma/
  schema.prisma            generator + datasource (update the file-map comment)
  enums.prisma             §2
  user.prisma              (+ Booking back-relation)
  operators.prisma         §8
  destinations.prisma      (Destination.trips → tours)
  categories.prisma        (unchanged)
  collections.prisma       (unchanged)
  tours.prisma             §3   (renamed from trips.prisma)
  availability.prisma      §4   (NEW)
  bookings.prisma          §5   (expanded + BookingUnitItem)
  payments.prisma          §6   (NEW)
  reviews.prisma           §7   (expanded + ReviewTranslation)
  tiers.prisma             §9   (NEW — SpotlightRequest)
  attributes.prisma        (unchanged)
  slug-registry.prisma     (unchanged)
  faq.prisma               (unchanged)
  media-gallery.prisma     (unchanged)
  settings.prisma          (unchanged)
  wishlist.prisma          (tripId → tourId)
  notifications.prisma     §10  (NEW — octo/notifications subscriptions + deliveries)
  webhooks.prisma          (unchanged — internal lead webhooks)
  — DELETED: featured-slots.prisma, waitlist.prisma
```

---

## 14. OCTO field mapping (DB → OCTO JSON)

| OCTO field | Source |
|---|---|
| `product.id` | `Tour.id` |
| `product.internalName` / `title` | `Tour.name` / `TourTranslation.title` |
| `product.availabilityType` | `Tour.availabilityType` |
| `product.deliveryFormats/Methods`, `redemptionMethod` | `Tour.*` |
| `product.pricingPer` | derive from `Tour.pricingModel` |
| `product.durationMinutesFrom/To` | `Tour.durationMinutes*` |
| `product.options[]` | `TourOption[]` |
| `option.availabilityLocalStartTimes` | `TourOption.availabilityLocalStartTimes` |
| `option.cancellationCutoff*` | `TourOption.*` / `Tour.cancellationHours` |
| `option.restrictions.min/maxUnits` | `TourOption.min/maxUnits` / `Tour.min/maxPartySize` |
| `option.units[]` | `TourUnit[]` |
| `unit.type`, `restrictions.*` | `TourUnit.type`, `TourUnit.min/maxAge/paxCount/...` |
| `unit.pricing` | `TourUnit.priceRetail/Original/Net` + `taxes` → minor units |
| `availability[].id` | `Departure.id` |
| `availability.localDateTimeStart/End`, `status`, `vacancies`, `capacity`, `utcCutoffAt` | `Departure.*` |
| `booking.uuid`, `status`, `utcExpiresAt/ConfirmedAt`, `unitItems`, `contact`, `pricing` | `Booking.*` + `BookingUnitItem[]` |
| `booking.resellerReference` / `supplierReference` | `Booking.resellerReference` / `supplierReference` |
| `cancellation.refund/reason/utcCancelledAt` | `Booking.cancellation*` |
| `supplier.*` | `Operator` (+ `SiteInfo`) per D4 |
| content `features[]` | merge of `TourHighlight`(→HIGHLIGHT) + `TourInclusion`(→INCLUSION) + `TourExclusion`(→EXCLUSION) + `TourFeature`(other types) — DS1 |
| content `media[]` | `TourImage` |
| content `locations[]` | `TourLocation` |

---

## 15. Migration & decisions

**Decided:**
- **DS1 → keep dedicated tables (NOT unified).** `TourHighlight`/`TourInclusion`/`TourExclusion` stay
  as separate tables; `TourFeature` covers only the other OCTO feature types. The OCTO serializer
  merges all four into `features[]` at the boundary.
- **DS2 → rename the table.** `Trip`→`Tour` **renames the physical table** `trips` → `tours`
  (`@@map("tours")`) — no `@@map("trips")` alias. Same for child tables that referenced trips.

**Migration steps:**
- **Rename migration:** `Trip`→`Tour` model + `trips`→`tours` table (DS2); cascade to child tables,
  relations, code, and frontend API clients in one coordinated PR.
- **Enum migrations:** `TripStatus`→`TourStatus`, `BookingStatus` value change, `ScheduleStatus`→
  `AvailabilityStatus`, `AgeBandType`→`UnitType`.
- **Backfill:**
  - One `TourOption` (DEFAULT) per existing tour; move `TourAgeBand` rows → `TourUnit` under it.
  - Materialize `Departure` from existing `TourSchedule`, then drop `TourSchedule`.
  - (Highlights/inclusions/exclusions stay as their existing tables — no backfill; DS1.)
- **Other decisions** reflected above: Money D2, Option/Unit D3, Supplier D4; remaining
  migration-checklist decisions D0–D13.

> Nothing here is applied to the live schema yet. On approval, I'll implement file-by-file in the order
> of §13, generate migrations, and update [`../MASTER-CHECKLIST.md`](../MASTER-CHECKLIST.md).

---

## 16. Post-review additions (booking add-ons + pickups)

Two gaps surfaced during review were closed in the live schema (decision: **prices do NOT vary by
date**, so the flat `priceOverride` on `Departure`/`AvailabilitySchedule` is sufficient — no
per-unit-by-date pricing model is added).

### 16.1 Booking add-on line items (`bookings.prisma`)

`TourAddOn` (the catalog extra) now has selected line items snapshotted onto the booking, so editing
or deleting a tour add-on never mutates a placed booking. `addOnId` is a soft reference for reporting.

```prisma
model BookingAddOn {
  id         String    @id @default(uuid())
  bookingId  String
  addOnId    String?                                // soft ref; snapshot below is source of truth
  name       String                                 // snapshot of TourAddOn.name
  unit       AddOnUnit @default(PER_PERSON)         // snapshot (PER_PERSON | FLAT)
  quantity   Int       @default(1)
  unitPrice  Decimal   @db.Decimal(10, 2)           // snapshot of TourAddOn.price
  totalPrice Decimal   @db.Decimal(10, 2)           // unitPrice × qty (× pax if PER_PERSON), computed at booking time
  booking    Booking    @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  addOn      TourAddOn? @relation(fields: [addOnId], references: [id], onDelete: SetNull)
  @@index([bookingId])
  @@map("booking_addons")
}
```
`Booking` gains `addOns BookingAddOn[]`; `TourAddOn` gains `bookings BookingAddOn[]`.
(EU Digital Fairness Act: add-ons are never pre-checked in the widget — see frontend doc §5.)

### 16.2 First-class pickup locations (`tours.prisma`) — D12

`PickupLocation` (+ translation) are first-class points (distinct from `TourLocation` itinerary). A
`PAID_ADDON` pickup is additionally linked to a `TourAddOn` for charging.

```prisma
model PickupLocation {
  id           String   @id @default(uuid())
  tourId       String
  name         String
  latitude     Float?
  longitude    Float?
  address      String?
  minutesPrior Int?                                 // pickup N minutes before departure
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  tour         Tour                        @relation(fields: [tourId], references: [id], onDelete: Cascade)
  bookings     Booking[]
  translations PickupLocationTranslation[]          // localized title + directions
  @@index([tourId])
  @@map("pickup_locations")
}
```
`Tour` gains `pickupRequired Boolean @default(false)` (→ OCTO `option.pickupRequired`) and
`pickupLocations PickupLocation[]`. `Booking` gains `pickupRequested Boolean` +
`pickupLocationId String?` + `pickupLocation` relation.

### 16.3 Still open (deferred, by decision)

- **#3 per-unit-by-date pricing** — NOT added (prices don't vary by date).
- **#4 platform→operator payout/settlement ledger** — not modeled yet; revisit if settlement
  reporting becomes a launch requirement (per-booking `Payment` covers charges/refunds today).

---

## 17. Coverage-audit gap closures (G1–G11)

A full audit against the master checklist + architecture docs found 11 gaps (5 launch-blocking,
6 should-fix). All were applied to the live schema (additive only). Deferred: G12 (review rating
distribution), G13 (collection per-tour rationale), G14 (payout ledger).

| Gap | Severity | Closure |
|---|---|---|
| **G1** slug 301 redirects + 90-day cooldown | launch-blocker | New `SlugRedirect` table (`from/toSlug`, `statusCode`); `SlugRegistry.deletedAt` for cooldown |
| **G2** booking commission-rate snapshot | launch-blocker | `Booking.commissionRate Decimal(5,4)` (fraction, e.g. 0.2750) |
| **G3** multi-currency EUR normalization | launch-blocker | `Booking.totalEur` + `fxRateToEur` (currency = original; commissionAmount stays EUR) |
| **G4** `booking_complete` attribution contract | launch-blocker | `Booking`: `utmTerm/utmContent`, `gbraid/wbraid/fbclid`, `island`, `customerLocale`, `customerId` |
| **G6** force-majeure pardons | launch-blocker | New `ForceMajeurePardon` table (destination + date range); `Destination.forceMajeurePardons` |
| **G5** Stripe billing snapshot | should-fix | `Booking`: `billingCountry/PostalCode/City`, `paymentMethodLast4/Brand` |
| **G7** eligibility grace lifecycle | should-fix | `Tour.graceStartedAt` + `graceMetric` |
| **G8** departure ops columns | should-fix | `Departure`: `soldOutAt`, `source`, `manuallyEdited`, `externalRef`; `Tour.availabilityConfirmedAt` |
| **G9** tour marketing/info content | should-fix | `TourTranslation`: `shortDescription`, `whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, `localTip`, `meetingPointText`; `Tour.meetingPointLat/Lng`, `departureCity` |
| **G10** typed exclusions (LD18) | should-fix | `TourExclusion.type` (`ExclusionType`) + `priceText` |
| **G11** tour audience/accessibility flags | should-fix | `Tour`: `minAgeYears`, `fitnessLevel`, `bookingType`, `weatherDependent`, `wheelchairAccessible`, `familyFriendly`, `suitableForBeginners`, `isLocalsFavourite` (+ enums `FitnessLevel`, `TourBookingType`, `ExclusionType`) |
