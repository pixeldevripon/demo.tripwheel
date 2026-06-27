# Tour module - complete data requirements

> Single, build-ready list of **every piece of data** the Tour module API needs: the `Tour`
> entity (grouped by concern), all child tables, the enums, validation rules, write-ownership
> (operator vs system vs admin), and the gaps still missing from `backend/prisma/tours.prisma`.
>
> Sources reconciled: master `island-tours-platform-master.html` E.3 (canonical, wins on conflict),
> `02-architecture/DATA-MODEL.md` E.3, `03-implementation/TRIP-MODULE.md`, and the current
> `backend/prisma/tours.prisma` + `enums.prisma`.
>
> Legend: **✓ in schema** = present today · **+ TO ADD** = required by master, missing from schema ·
> **W** = who writes it (`OP` operator, `SYS` system/job, `ADM` admin-only, `RO` read-only computed).

---

## 0. Shape at a glance

A tour belongs to exactly **1 destination**, **1+ categories** (one `isPrimary`), **0-n hubs**.
Canonical URL is flat: `/{locale}/{destination}/{tour-slug}/`. Model = `Tour` (`@@map("tours")`).

```
Tour ──< TourCategory (>=1, one isPrimary)      Tour ──< TourImage (>=5 + 1 hero to publish)
     ──< TourHub (0-n, discovery tag, no URL)         ──< TourAgeBand (flat per-traveler pricing)
     ──< TourAttribute (filters)                      ──< TourAddOn
     ──< TourLanguage (guide languages)               ──< TourInclusion ──< Translation
     ──< TourExclusion ──< Translation (typed)         ──< TourFeature ──< Translation (OCTO content)
     ──< TourLocation ──< Translation (itinerary)      ──< PickupLocation ──< Translation
     ──< TourTranslation (per-locale content + SEO)
     ──< AvailabilitySchedule / Exception / Departure (availability phase)
     ──< Booking · Review · Wishlist · SpotlightRequest
```

---

## 1. Tour entity - field by field

### 1.1 Identity & routing  (all ✓)

| Field | Type | W | Rules / notes |
|---|---|---|---|
| `id` | uuid | SYS | PK |
| `operatorId` | FK -> operators.id | SYS | Resolved from `user.id` via `resolveOperatorId`; **not** client-set |
| `destinationId` | FK | OP | Exactly one; immutable after create (recommended) |
| `name` | string | OP | Canonical English name |
| `slug` | string | OP | English only; unique per `(destinationId, slug)`; auto from name on create, editable (rename -> 301 + 90-day cooldown); writes a `TOUR` `slug_registry` row in the same transaction |
| `status` | `TourStatus` | OP | `DRAFT`/`LIVE`/`PAUSED`/`ARCHIVED`; re-runs category >=3 gating on change |
| `h1Override` | string? | OP | For awkward template H1s (LD15) |
| `breadcrumbLabel` | string? | OP | Editorial short form when H1 tour-name > 35 chars |
| `departureCity` | string? | OP | Drives meta-row location label (LD13); empty -> island only |

### 1.2 Pricing & party  (all ✓)

| Field | Type | W | Rules / notes |
|---|---|---|---|
| `pricingModel` | `PricingModel` | OP | `PER_PERSON` / `UNIT` -> OCTO `pricingPer` |
| `wholeUnitType` | `WholeUnitType?` | OP | Required when `pricingModel = UNIT`: group/boat/vehicle/aircraft/package |
| `defaultCurrency` | `Currency` | OP | USD/EUR |
| `basePrice` | Decimal(10,2)? | OP | Optional headline price |
| `priceFrom` | Decimal(10,2)? | SYS | Cached lowest applicable band price (for cards) |
| `minPartySize` | int | OP | Default 1; some tours require 4+ |
| `maxPartySize` | int? | OP | Capacity ceiling per booking |

> **Master mapping (pricing shape - resolved per master logic):** master E.3 "Pricing and party"
> defines **both** `price_adult` / `price_child` / `price_infant` (the three base band prices) **and**
> `age_bands[]` (richer banding, "all bands count toward capacity"). So the master's model is a
> **typed set of bands**, not loose price columns. **Follow master:** keep the single `TourAgeBand[]`
> source of truth and add a required **`bandType` enum** (`ADULT | CHILD | INFANT | YOUTH | SENIOR`).
> The master's adult/child/infant become three typed rows; extra bands (youth, senior) are more rows
> with explicit `minAge`/`maxAge`. The API then composes a typed `pricing` object keyed by band so the
> frontend gets `pricing.adult.price`, `pricing.child.price`, etc. - directly, as you wanted.
>
> Why not flat `priceAdult`/`priceChild`/`priceInfant` columns: master ALSO requires `age_bands[]`
> with age ranges and capacity semantics, so flat columns would force maintaining two parallel
> sources and can't express "Child (4-12)" or "Senior 65+". One typed band set satisfies both master
> constructs and makes `priceFrom` ("lowest applicable") a clean min over the rows. See §2.2 / §3.

### 1.3 Booking logic  (all ✓)

| Field | Type | W | Rules / notes |
|---|---|---|---|
| `durationMinutesFrom` | int? | OP | Formatter input |
| `durationMinutesTo` | int? | OP | Upper bound for a range |
| `pickupModel` | `PickupModel` | OP | `INCLUDED`/`PAID_ADDON`/`NONE` |
| `pickupRequired` | bool | OP | -> OCTO `option.pickupRequired` |
| `bookingCutoffMinutes` | int | OP | Default 120, range **0-10080**; after cutoff cell shows "Closed" |
| `cancellationHours` | int | OP | **Enum-bound `[24,48,72,168]`, default 48, NOT NULL** (DTO `@IsIn`); publish requirement. (`free_cancellation` is derivable -> do NOT store it) |
| `paymentModel` | `PaymentModel` | OP | `OPERATOR_LINK`/`ON_ARRIVAL`/`PAID_IN_FULL`/`OPERATOR_FULL`; **snapshotted onto booking** |
| `depositPct` | Decimal(4,1) | RO | 20-30 in 2.5 steps; **tier-driven, surfaced read-only** to operator |
| `bookingType` | `TourBookingType?` | OP | `PRIVATE`/`SHARED` |
| `instantConfirmation` | bool | OP | Default true |
| `meetingPointLat` / `meetingPointLng` | Float? | OP | Geo for Meeting & Pickup block (localized text on `TourTranslation`) |
| `checkInMinutesBefore` | int? | OP | **+ TO ADD** (Figma) - "Please arrive N minutes early for check-in" on the Meeting & Pickup block. Master references a per-tour "arrive 30 minutes early" default; design shows 15. Default 30 |
| `startTimes` | String[] (`'HH:MM'`) | OP | **+ TO ADD** - the tour's slot set (master E.3). The availability schedule switches these on per weekday; a `departure.start_time` must exist in this list. Single-day tours only (v1) |

> **`startTimes[]` is a real Tour field** (master E.3: the tour defines the slot set). It is consumed
> by the availability module (`AvailabilitySchedule` -> `Departure`, `UNIQUE (tour_id, date,
> start_time)`). Build sequencing only: you can add the column with the Tour now and wire its
> consumers in the availability phase. See `AVAILABILITY-AND-DEPARTURES.md` (line 46).

### 1.4 OCTO product attributes  (all ✓)

| Field | Type | W | Default |
|---|---|---|---|
| `timeZone` | string (IANA) | SYS | `America/Curacao`, derived from destination |
| `availabilityType` | `OctoAvailabilityType` | OP | `START_TIME` |
| `instantDelivery` | bool | OP | true |
| `availabilityRequired` | bool | OP | true |
| `allowFreesale` | bool | OP | false |
| `deliveryFormats` | `DeliveryFormat[]` | OP | `[PDF_URL, QRCODE]` |
| `deliveryMethods` | `DeliveryMethod[]` | OP | `[VOUCHER]` |
| `redemptionMethod` | `RedemptionMethod` | OP | `DIGITAL` |
| `reference` | string? | OP | Operator external id (OCTO reference) |

### 1.5 Flags & accessibility  (all ✓)

| Field | Type | W | Rules |
|---|---|---|---|
| `minAgeYears` | int? | OP | Tour-level min age (distinct from per-band `minAge`) |
| `fitnessLevel` | `FitnessLevel?` | OP | `EASY` (default, hidden) / `MODERATE` / `CHALLENGING` |
| `weatherDependent` | bool | OP | Default false |
| `wheelchairAccessible` | bool | OP | **Master directive: default `true`** (most tours assumed accessible). Change schema default false -> true. When false, routes to "Not suitable for" + feeds Schema.org `accessibilityFeature` |
| `familyFriendly` | bool | OP | Default false |
| `suitableForBeginners` | bool | OP | Default false |
| `isLocalsFavourite` | bool | ADM | Manual editorial flag; update-only; ~30% target; **never tier-linked** |

### 1.6 Commercial engine  (all ✓ - service logic still to build)

| Field | Type | W | Rules |
|---|---|---|---|
| `commissionTier` | Decimal(4,1) | SYS | 20/22.5/25/27.5/30; updated together with `tierKey`/`tierRank`. The **+35% Spotlight** is a separate overlay that does NOT change these columns - see [`SPOTLIGHT-DATA.md`](./SPOTLIGHT-DATA.md) and §2.15 |
| `tierKey` | `TierKey` | OP | Default `standard`; operator picks (eligibility-gated, 30-day lock) |
| `tierRank` | smallint | SYS | **Denormalized from `tierKey`, never client-written** |
| `tierLockedUntil` | DateTime? | SYS | `now + 30 days` on every tier change; rejects changes while locked |
| `qualityScore` | Decimal(6,2) | SYS | Nightly: `(avg_rating/5)*40 + (min(reviews,100)/100)*25 + (completeness/100)*20 + (conv_rate/max_conv)*15` |
| `eligibilityState` | `EligibilityState` | SYS | `LOCKED`/`PROVISIONAL`/`ELIGIBLE`/`GRACE`/`DEMOTED` |
| `graceStartedAt` | DateTime? | SYS | When the 30-day grace began (G7) |
| `graceMetric` | string? | SYS | Failed metric: rating / review_count / cancellation_rate |
| `isBookable` | bool | SYS | true iff >=1 AVAILABLE departure <=30d (nightly) |
| `availabilityConfirmedAt` | DateTime? | OP | Operator "availability is current" freshness nudge (G8) |
| `firstPublishedAt` | DateTime? | SYS | Eligibility window anchor |

### 1.7 Computed / cached aggregates & CRO counters  (partly ✓)

| Field | Type | W | Status |
|---|---|---|---|
| `aggregateRating` | Float? | SYS | ✓ updated on review approve; render at >=3 reviews (LD11 fallback below) |
| `aggregateReviewCount` | int | SYS | ✓ |
| `aggregatesUpdatedAt` | DateTime? | SYS | ✓ |
| `bookingCount` / `bookingCountToday` / `lastBookedAt` | int / int / DateTime? | SYS | ✓ (no consumer urgency surface in v1) |
| `spotsRemaining` | int? | SYS | ✓ derived from departures |
| `ratingDistribution` | int[5] or JSON | SYS | **+ TO ADD** - star chart (LD31); can be cached or computed at read |
| `photoReviewCount` | int | SYS | **+ TO ADD** - photo carousel activates at >=3 photo reviews |

### 1.8 SEO  (**all + TO ADD** - currently missing)

Master E.3 SEO block: `meta_title`, `meta_description`, `og_image`. These are **localized** ->
add to `TourTranslation` (§2.11), not the Tour row:

| Field | Type | W | Notes |
|---|---|---|---|
| `metaTitle` | string? (per locale) | OP | **+ TO ADD** on `TourTranslation` |
| `metaDescription` | string? (per locale) | OP | **+ TO ADD** on `TourTranslation` |
| `ogImage` | string? (URL) | OP | **+ TO ADD** - single image; Tour-level or per-locale (default Tour-level) |

### 1.9 Flags & timestamps  (all ✓)

`isSponsored`, `isActive`, `publishedAt`, `createdAt`, `updatedAt`.

---

## 2. Child tables - required data

### 2.1 `TourCategory`  ✓
`tourId`, `categoryId`, `isPrimary`. Unique `(tourId, categoryId)`. **Exactly one `isPrimary=true`**
per tour (drives breadcrumb + canonical category variant). Required: >=1 row.

### 2.2 `TourAgeBand`  (✓ + `bandType` TO ADD)  - typed per-traveler pricing

A **first-class child table/entity** (`@@map("tour_age_bands")`), **one row per priced band**, FK to
`Tour`, `onDelete: Cascade`. This IS the pricing model - not columns on `Tour`. The master's
`price_adult`/`price_child`/`price_infant` are three rows (`bandType` = `ADULT`/`CHILD`/`INFANT`);
the master's `age_bands[]` extras (youth, senior) are additional rows with explicit `minAge`/`maxAge`.

| Field | Type | W | Rules / notes |
|---|---|---|---|
| `id` | uuid | SYS | PK |
| `tourId` | FK -> tours.id | SYS | Cascade delete |
| `bandType` | `AgeBandType` | OP | **+ TO ADD** - `ADULT`/`CHILD`/`INFANT`/`YOUTH`/`SENIOR`; lets the API compose `pricing.adult` etc. |
| `participation` | `BandParticipation` | OP | **+ TO ADD** (Figma) - `PARTICIPANT` (default) / `SPECTATOR`. Drives the widget's "Bringing Spectators?" group (e.g. Adult spectator $20, Kid $10) |
| `label` | string | OP | Display label e.g. "Adult (age 13+)", "Child (age 4-12)", "Infant (age 0-3)" |
| `minAge` / `maxAge` | int? | OP | Inclusive age range; null = no bound. Design shows Adult 13+, Child 4-12, Infant 0-3 |
| `price` | Decimal(10,2) | OP | Retail price per traveler (0 = "Free", e.g. infants) |
| `priceOriginal` | Decimal(10,2)? | OP | Optional strikethrough / pre-discount |
| `priceNet` | Decimal(10,2)? | OP | Optional operator net |
| `isDefault` | bool | OP | The band the widget defaults to (usually Adult) |
| `displayOrder` | int | OP | Sort order in the selector |

**Rules:** all bands count toward capacity (participants AND spectators board the vessel); publish
needs >=1 `PARTICIPANT` band (or `basePrice`); `Tour.priceFrom` = `min(price)` across **participant**
bands. API composes a typed `pricing` object keyed by `bandType`, with spectator bands grouped under
`pricing.spectators`. `Tour.allowsSpectators` is derived (`EXISTS a SPECTATOR band`) - no extra column.

> **Spectators (Figma booking widget).** The master notes "spectator pricing lives in `add_ons[]`",
> but the design shows spectators as **banded** (Adult $20 / Kid $10) with their own line items
> ("Spectators x 2 x $20"), which a flat `TourAddOn` (single price) cannot express. Modeling them as
> `TourAgeBand` rows with `participation = SPECTATOR` keeps one pricing model, supports the banded
> prices, and lets the booking path count them toward capacity while excluding them from the activity.

### 2.3 `TourHub`  ✓
`tourId`, `hubId`. **Validation:** hub must belong to the tour's destination AND at least one of the
tour's categories is in the hub's `HubAllowedCategory` set.

### 2.4 `TourImage`  ✓
`url`, `urlAvif?`, `urlWebp?`, `isHero`, `focalX` (0.5), `focalY` (0.5), `altText?`, `displayOrder`,
`width`, `height`. **Publish: >=5 images, exactly one `isHero`.**

### 2.5 `TourAddOn`  ✓
`name`, `description?`, `price` Decimal(10,2), `unit` (`PER_PERSON`/`FLAT`), `maxQuantity` (1),
`displayOrder`, `isActive`. EU Digital Fairness Act: never pre-checked in the frontend.

### 2.6 `TourLanguage`  ✓
`language` (ISO 639-1). Unique `(tourId, language)`. Drives the third quick-info badge (LD7).

### 2.7 `TourInclusion` + `TourInclusionTranslation`  ✓
Inclusion: `icon` (default `check`), `displayOrder`, `imageUrl?`. Translation: `label`.

### 2.8 `TourExclusion` + `TourExclusionTranslation`  ✓  (typed, LD18)
Exclusion: `icon` (default `x`), `type` `ExclusionType?` (`PAID_ADVANCE`/`PAID_ONSITE`/`UNAVAILABLE`/
`NOT_PERMITTED`), `priceText?` (for PAID_*), `displayOrder`, `imageUrl?`. Translation: `label`.

### 2.9 `TourFeature` + `TourFeatureTranslation`  ✓  (other OCTO content, DS1)
`type` `FeatureType` (NOT inclusion/exclusion): prebooking/prearrival info, redemption,
accessibility, additional info, booking/cancellation terms. Translation: `text`.

### 2.10 `TourLocation` + `TourLocationTranslation`  ✓  (OCTO itinerary)
`types[]` (START/ITINERARY_ITEM/END/POI), lat/lng, address parts, `minutesTo`, `minutesAt`,
`displayOrder`. Translation: `title`, `shortDescription?`.

### 2.11 `PickupLocation` + `PickupLocationTranslation`  (✓ + pickup window TO ADD)
`name`, lat/lng, `address?`, `minutesPrior?`, `displayOrder`, `isActive`. Translation: `title`,
`directions?`. A PAID_ADDON pickup also links to a `TourAddOn` for charging.
**+ TO ADD (Figma):** `windowStart` / `windowEnd` (`'HH:MM'`) - the design shows a pickup window
("7:45-8:15 AM window"), not just a single `minutesPrior`. Add the two time fields (or keep
`minutesPrior` and add a window). Master/design also surface "Confirm pickup location at booking".

### 2.12 `TourTranslation`  (✓ + SEO/category_display TO ADD)
Per-locale, unique `(tourId, locale)`:

| Field | Type | Status | Rules |
|---|---|---|---|
| `title` | string? | ✓ | Localized tour title |
| `overview` | string? | ✓ | **80-200 words, paragraph breaks only** (no headings/lists/bold) |
| `description` | string? | ✓ | Long description (master: 350-500 words) |
| `shortDescription` | string? | ✓ | Card/preview - **master directive: 160 char cap** (DTO `@MaxLength(160)`; fix schema comment that says 200) |
| `whatToBring` | string? | ✓ | **3-8** sentence-case bullets, <=25 words each; personal items the traveler brings; must NOT duplicate inclusions (CMS warning); shown when non-empty |
| `knowBeforeYouGo` | string? | ✓ | **3-10** sentence-case bullets, <=25 words each; operational caveats + positive accessibility + tour-side rules (no glass, no outside food) |
| `notSuitableFor` | string? | ✓ | **1-6** bullets when present; bookability-affecting restrictions (age, pregnancy, fitness, wheelchair-INaccessibility); NEGATIVE accessibility routes here; hidden entirely when empty |
| `localTip` | string? | ✓ | Optional Overview tail |
| `meetingPointText` | string? | ✓ | Localized meeting-point description (geo on Tour) |
| `whatToExpectIntro` | string? | **+ TO ADD** (Figma) | Intro paragraph above the numbered itinerary on the "What to Expect" tab (itinerary steps themselves = `TourLocation` rows). Optional |
| `categoryDisplay` | string? | **+ TO ADD** | Plural noun phrase for "More {x} in {destination}" (LD33); CMS validates plural |
| `metaTitle` | string? | **+ TO ADD** | SEO |
| `metaDescription` | string? | **+ TO ADD** | SEO |
| `isMachineTranslated` | bool | ✓ | |

> Payload shape for the children translation endpoint must use the `{ fields: { ... } }` wrapper
> (flat sends -> 400 `forbidNonWhitelisted`). English base-locale tab: `name` read-only, delete ->
> clears fields via upsert (backend blocks delete on `en`).

### 2.13 `TourAttribute`  ✓  (filters, V2 §7)
Per-tour values against `AttributeDefinition`. Drives faceted filters/badges/JSON-LD.

### 2.14 Related entities owned by OTHER modules (not tour-module children)

These have a `Tour` relation but are **written by other modules**, not the operator's tour
create/update flow. The tour module only reads from them (mostly via the §1.7 aggregates). Listed
here so they are not mistaken for missing tour children:

| Entity | File | Relation | Owner module | Tour module sees |
|---|---|---|---|---|
| `Review` + `ReviewTranslation` | `reviews.prisma` | `Tour ──< Review` (per-tour `tourId`, booking-gated `bookingId @unique`, moderated) | **Reviews (E.7, to build)** | Aggregates only: `aggregateRating`, `aggregateReviewCount`, `ratingDistribution`, `photoReviewCount` (approved records only) |
| `Booking` (+ items/add-ons) | `bookings.prisma` | `Tour ──< Booking` | **Bookings/Payments (E.8, to build)** | CRO counters: `bookingCount`, `bookingCountToday`, `lastBookedAt`, `spotsRemaining` |
| `AvailabilitySchedule` / `AvailabilityException` / `Departure` | `availability.prisma` | `Tour ──< ...` | **Availability (E.9, to build)** | `isBookable`, `spotsRemaining`; consumes `startTimes[]` |
| `Wishlist` | `wishlist.prisma` | `Tour ──< Wishlist` | Wishlist | - |
| `SpotlightRequest` (+ `ForceMajeurePardon`) | `tiers.prisma` | `Tour ──< SpotlightRequest` | **Commercial engine** | Per-tour Spotlight (35% overlay, max 3/dest, manual approval). Effective commission at booking = `activeSpotlight ? 0.35 : commissionTier/100`. **Full model + rules: [`SPOTLIGHT-DATA.md`](./SPOTLIGHT-DATA.md)** |

> **Per-tour Review entity = `reviews.prisma` `Review`.** It is intentionally NOT a tour-module
> child: reviews are created by travelers (gated on a confirmed booking) and moderated by admins, so
> they belong to the Reviews module. The operator never writes reviews through the tour form.

---

## 3. Enums the module depends on

**Present ✓ in `enums.prisma`:** `TourStatus`, `PricingModel`, `WholeUnitType`, `PickupModel`,
`AddOnUnit`, `ExclusionType`, `FitnessLevel`, `TourBookingType`, `OctoAvailabilityType`,
`DeliveryFormat`, `DeliveryMethod`, `RedemptionMethod`, `FeatureType`, `PaymentModel`, `Currency`,
`TierKey`, `EligibilityState`, `Locale`. (Availability/booking enums consumed downstream.)

**+ TO ADD: `AgeBandType`** (for typed pricing, §2.2):
`ADULT | CHILD | INFANT | YOUTH | SENIOR`. `ADULT`/`CHILD`/`INFANT` cover the master's three base
band prices; `YOUTH`/`SENIOR` cover the optional `age_bands[]` extras.

**+ TO ADD: `BandParticipation`** (for spectators, §2.2): `PARTICIPANT | SPECTATOR`.

---

## 4. Gaps to make the schema complete  (master-mandated changes)

Every row below is **required by the master doc** - not optional. Apply all.

| # | Change | Where | Master basis |
|---|---|---|---|
| 1 | Add `metaTitle`, `metaDescription` | `TourTranslation` | E.3 SEO block (localized) |
| 2 | Add `ogImage` | `Tour` | E.3 SEO block (single image, Tour-level) |
| 3 | Add `categoryDisplay` | `TourTranslation` | LD33 "More {x} in {destination}"; CMS validates plural |
| 4 | Add `ratingDistribution`, `photoReviewCount` | `Tour` (cached) or compute at read | E.3 computed: star chart (LD31) + photo carousel gate (>=3) |
| 5 | Set `wheelchairAccessible` default -> **`true`** | `Tour` | E.3 / LD23: "most tours assumed accessible unless explicitly not" |
| 6 | Enforce `shortDescription` **160** char cap | DTO + schema comment | E.3 content: "string 160" |
| 7 | Change `whatToBring`/`knowBeforeYouGo`/`notSuitableFor` -> **`String[]`** | `TourTranslation` | E.3 content: typed as `string[]` with count + word limits (see §4.1) |
| 8 | Add `AgeBandType` enum + **`bandType`** field | `enums.prisma` + `TourAgeBand` | E.3 pricing: typed bands enable `pricing.adult`/`pricing.child` access (see §1.2 / §2.2) |
| 9 | Add `startTimes` `String[]` (`'HH:MM'`) | `Tour` | E.3: the tour's slot set; availability schedules switch them per weekday (see §1.3). Column now, consumers in the availability phase |
| 10 | Add `checkInMinutesBefore` int? (default 30) | `Tour` | Figma + master: "arrive N minutes early for check-in" on Meeting & Pickup (see §1.3) |
| 11 | Add `participation` field + `BandParticipation` enum | `TourAgeBand` + `enums.prisma` | Figma: banded **spectator** pricing ("Bringing Spectators? Adult $20 / Kid $10") - see §2.2 |
| 12 | Add `windowStart`/`windowEnd` (`'HH:MM'`) | `PickupLocation` | Figma: pickup window "7:45-8:15 AM" (see §2.12) |
| 13 | Add `whatToExpectIntro` | `TourTranslation` | Figma: intro paragraph on the "What to Expect" tab (see §2.13) |

**The only master field deliberately NOT stored: `free_cancellation`.** Master E.3 calls it
"redundant by rule... always `true` and derivable from `cancellation_hours`; drop at the C5
migration." Derive it (`freeCancellation = cancellationHours != null`) - never persist it.

### 4.1 Master directive: bullet fields are `string[]`, not `string`

Master models `what_to_bring_{locale}[]`, `know_before_you_go_{locale}[]`, and
`not_suitable_for_{locale}[]` as **`string[]` arrays** with per-bullet validation (counts 3-8 / 3-10
/ 1-6, and <=25 words per bullet). The current schema stores each as a single `String?`, which loses
the bullet structure and makes the master's count/word-limit validation impossible at the API layer.

**Follow master:** change these three on `TourTranslation` to **`String[]`** (Postgres `text[]`).
Keep `overview` / `description` / `localTip` / `meetingPointText` as `String?` (free prose - master
types them as markdown/string, not arrays). Inclusions and exclusions stay as child
tables (already correct - they carry order, icons, types, images, and per-locale text).

---

## 5. Publish guard  (listing requirements - master §6.2)

A tour can move `DRAFT -> LIVE` only when ALL hold:

1. **>=5 images** with exactly one `isHero`.
2. **English `overview`** present (80-200 words).
3. **A price** (>=1 `TourAgeBand` or `basePrice`).
4. **Free-cancellation window present** (`cancellationHours` set; always is, NOT NULL).
5. **>=1 category** with exactly one `isPrimary`.

Lifecycle: `DRAFT -> LIVE <-> PAUSED -> ARCHIVED` (+ restore). Status changes re-run the category
>=3 gating in both directions.

---

## 6. Write-ownership summary

- **Operator-writable** (create/update): identity, content, pricing bands/add-ons, booking logic,
  flags (except `isLocalsFavourite`), OCTO attributes, `tierKey`, availability freshness.
- **System-only** (never client-set): `operatorId` (resolved), `tierRank`, `commissionTier`,
  `tierLockedUntil`, `qualityScore`, `eligibilityState`/grace fields, `isBookable`, `priceFrom`,
  all aggregates and CRO counters, `firstPublishedAt`, `timeZone`.
- **Admin-only:** `isLocalsFavourite`, Spotlight approval (`commissionTier` 35 path).
- **Read-only to operator (display):** `depositPct` (tier-driven).

---

## 7. Tour availability  (master E.9 - separate module; schema present, service to build)

**Capacity lives per departure, never on the tour or the weekly pattern** (master §E.9). Three tables
separate intent from truth; a nightly job materializes a **12-month rolling window**. Single-day tours
only (v1). All times tour-local (`destination.timezone`). All party bands count toward capacity.

```
AvailabilitySchedule (weekly pattern)  +  AvailabilityException (per-date deviation)
        │  nightly materialization (never touches departures with bookings, manual edits, or source=api)
        ▼
   Departure  (single bookable truth; atomic capacity claim at booking; bookability = open departure <=30d)
```

**Tour module's coupling (build these inputs in the tour module):**
- `Tour.startTimes[]` - the slot set the schedules switch on (gap #9)
- `Tour.maxPartySize` - default per-departure capacity
- `Tour.bookingCutoffMinutes` - feeds each `Departure.utcCutoffAt`
- Read-back (system-computed, nightly): `Tour.isBookable`, `Tour.spotsRemaining`

**Entities** (in `availability.prisma`, related `Tour ──< each`, `onDelete: Cascade`):
- `AvailabilitySchedule` - `weekdays[]`, `startTimes[]`, `capacity`, `seasonStart/End`, `priceOverride`, `isActive`
- `AvailabilityException` - `date`, `type` (`AvailabilityExceptionType`), `startTime?`, `capacity?`, `priceOverride?`, `note?`
- `Departure` - `localDateTimeStart` (+`End?`, `allDay`), `capacity`, `vacancies` (atomic, `CHECK >= 0`), `status` (`AvailabilityStatus`), `utcCutoffAt`, `priceOverride?`, `soldOutAt?`, `source`, `manuallyEdited`, `externalRef?`; `UNIQUE (tourId, localDateTimeStart)`

### 7.1 Schema-vs-master divergences to reconcile (when building E.9)

The existing `availability.prisma` was written toward an OCTO shape and conflicts with master §E.9 /
`AVAILABILITY-AND-DEPARTURES.md`. Per the follow-master rule, reconcile these before wiring the module:

| Concern | `availability.prisma` (now) | Master spec | Action |
|---|---|---|---|
| Weekday convention | comment `0=Sun…6=Sat` | **Monday = 0** | Pick one + document; bug risk if mismatched |
| Departure counter | `vacancies` (countdown) | `booked_count` (countup) | Keep `vacancies` (atomic + `CHECK`), but map to master's read contract |
| Departure status | `AVAILABLE/FREESALE/SOLD_OUT/LIMITED/CLOSED` | `open/closed/sold_out/cancelled` | Reconcile value set; master needs a `cancelled` state |
| Exception type | `BLACKOUT/EXTRA_DEPARTURE/CAPACITY_OVERRIDE/PRICE_OVERRIDE/TIME_OVERRIDE` | `close_date/close_slot/add_slot/set_capacity` | Reconcile to master's stop-sell semantics |
| Schedule capacity | `capacity Int` (required) | `capacity_override` nullable (`null` = tour default) | Add the tour-default fallback |
| Season fields | `seasonStart/seasonEnd` | `valid_from/valid_until` | Naming only |
| Schedule active | `isActive` boolean | `status` enum (active/paused) | Naming/shape |

> This is an **E.9-phase** reconciliation, not a tour-module blocker. The tour module only needs
> `startTimes[]` + `maxPartySize` + `bookingCutoffMinutes` (above) to feed it later.

---

## 8. Suggested API surface (REST, base `/api/v1/tours`)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/tours` | Create (DRAFT); resolves operator, writes `TOUR` slug_registry row |
| `GET` | `/tours` | List (operator-scoped / admin-all) + filters/pagination |
| `GET` | `/tours/:id` | Detail (full nested) |
| `PATCH` | `/tours/:id` | Update core fields |
| `DELETE` | `/tours/:id` | Hard delete (90-day slug cooldown) |
| `PATCH` | `/tours/:id/status` | Lifecycle transition (runs publish guard) |
| `PATCH` | `/tours/:id/tier` | Tier change (eligibility-gated, 30-day lock) |
| `*` | `/tours/:id/{images,age-bands,add-ons,languages,inclusions,exclusions,features,locations,pickups,categories,hubs}` | Children CRUD |
| `PUT` | `/tours/:id/translations/:locale` | Upsert localized content (`{ fields: {...} }`) |

RBAC: `CREATE_TRIP` / `EDIT_TRIP` / `DELETE_TRIP` / `MANAGE_TRIPS`. Guard order:
`ThrottlerGuard -> AuthGuard -> RolesGuard -> PermissionsGuard`. Use `@RequirePermissions()`.

---

## 9. Figma traceability (tour detail page + booking widget)

Source frames: `47936:3354` (Tour Details Page) and `47659:2339` (Booking Widget V2). Every rendered
element maps to a data source below. **Bold = new, added above.**

### 9.1 Tour detail page -> data source

| UI element | Data source |
|---|---|
| Hero gallery, "Show all photos", focal points | `TourImage` (>=5, one hero) |
| Title, H1 "Curaçao: Sunset reef snorkel..." | `name` + `TourTranslation.title` / `h1Override` |
| "4.8 (1,738)", star distribution (38/7/0) | `aggregateRating`, `aggregateReviewCount`, **`ratingDistribution`** |
| "Locals' favorite" badge | `isLocalsFavourite` |
| "Willemstad, Curaçao" location meta | `departureCity` + destination |
| Quick badges: "8 hours", "Pickup available", "EN, NL, +2" | `durationMinutes*`, `pickupModel`, `TourLanguage[]` |
| "Likely to sell out" / "Book today" | **Derived** from availability demand signal (`Departure.soldOutAt` / `spotsRemaining`) - not stored on tour |
| Tabs: Overview / What's Included / What to Expect / Meeting & Pickup / Important Info / Cancellation / Reviews | `TourTranslation.overview`; `TourInclusion`/`TourExclusion`; **`whatToExpectIntro`** + `TourLocation` itinerary; meeting geo + `PickupLocation`; `knowBeforeYouGo`/`notSuitableFor`/`whatToBring`; `cancellationHours`; `Review` |
| Numbered itinerary (5 steps, time + title + desc) | `TourLocation` (`types`, `minutesAt`, translation `title`/`shortDescription`) |
| "What's Included" + "(available - from $17 pp)" extras | `TourInclusion`; `TourAddOn` (price, "pay on the day" = `ON_ARRIVAL` semantics) |
| Meeting point name/address/"Open in Google Maps" | `meetingPointLat/Lng` + `TourTranslation.meetingPointText` |
| "Hotel pickup (optional) 7:45-8:15 AM window" | `PickupLocation` + **`windowStart`/`windowEnd`** |
| "Please arrive 15 minutes early" | **`checkInMinutesBefore`** |
| Reviews: name, country, date, Verified, title, body, photos, operator reply, sort | `Review` (+ `operatorResponse`, `reviewerCountry`, `photos`) - Reviews module (E.7) |
| "Supplied by Miss Ann" | `Operator.displayName` |
| Related rows: "More Snorkeling tours...", "More to explore..." | `categoryDisplay` (LD33) + ranking query |

### 9.2 Booking widget -> data source

| UI element | Data source |
|---|---|
| Calendar, "Check Availability", slot chips ("1:00 PM Selected", "4:00 PM Sold out", "Only 2 left") | `Departure` (E.9): `localDateTimeStart`, `status`, `vacancies` |
| Party selector: Adult (13+), Child (4-12) $65, Infant (0-3) Free | `TourAgeBand` (`bandType`, `minAge`/`maxAge`, `price=0`) |
| "Bringing Spectators? Adult $20 / Kid $10" + line "Spectators x 2 x $20" | **`TourAgeBand.participation = SPECTATOR`** |
| Add-ons / "Pickup location (From $17 p.p.)" | `TourAddOn`; `PickupLocation` |
| "Apply" promo field | **Booking module: `Coupon`/promo entity (NEW, not tour)** |
| Pay today 20% / Balance later, "All taxes and fees included" | `depositPct` (tier-driven) + `paymentModel` |
| Contact: full name, email, country (+599), phone (E.164), special requests (<=500), newsletter opt-in | **Booking module (E.8): `Booking` customer fields + newsletter flag** |
| Payment: card / PayPal / Apple Pay / Google Pay, postal code, name on card | **Payments module: Stripe/Mollie** |
| TYP: "Reserved!", "Paid today", "View booking", "Add to calendar", "pairs well" cross-sell | **Booking (E.8)** `public_ref`/`display_ref`; ICS from `Departure` + meeting point |

### 9.3 New entities the booking frame implies (other modules - flagged, not in tour scope)

- **`Coupon` / promo code** (the "Apply" field) - discount engine, applied at booking. Not in master
  E.3/E.8 tables yet; confirm against the commercial model before building.
- **`Booking` customer block** (E.8): `customerName`, `email`, `phone` (E.164), `country`,
  `specialRequests` (<=500), `newsletterOptIn`, locale. Already flagged thin in `DATA-MODEL.md`.
- **Newsletter subscription** ("Send me the good stuff...") - marketing list opt-in.

These belong to the bookings/payments/marketing modules; listed here only so they are not lost.

### 9.4 Thank-you page (TYP) -> data source  (frame `47744:9184`)

**Result: the TYP adds NO new tour fields.** Every tour-derived value it shows is already in the
model or computed. The new data it needs lives in Booking / Payment / Operator.

| TYP element | Data source | New tour field? |
|---|---|---|
| "You're booked, Denley!", "Guest lead", "2 adults, 1 child" | Booking (customer + party) | No |
| "Booking ref: IT-2026-04821" | Booking `public_ref`/`display_ref` | No |
| "8:00 AM - 5:00 PM", "Duration 9 hour" | `Departure.localDateTimeStart/End` + `durationMinutes*` | No (present) |
| "Pickup: At your accom" | Booking's selected `PickupLocation` | No (present) |
| "Free cancel: Before Sunday, 26 May" | **Derived** (`start - cancellationHours`); master: computed, never stored | No |
| "Add to calendar" (ICS) | tour title + departure start/end + meeting point | No (derivable) |
| "Trip: Miss Ann Boat Trips", "Email: reservation@...", "Phone: +599 9 123 4567" | **Operator** `displayName` + company name + `contact_email` + `contact_phone` (E.164) | No - **Operator (E.6)** |
| Deposit/balance, "Pay before", "Mastercard *****4242", Total | Booking + Payment (`payment_method_last4`/`brand`) | No |
| "Islanders also love... pair with your booking" | related/cross-sell tours (ranking) | No |
| Apartment promo, platform support email | Settings / editorial | No |

> **Only dependency flagged:** the TYP relies on operator `contact_email` + `contact_phone` (E.164)
> and a company/legal name distinct from `displayName`. `DATA-MODEL.md` already notes these are
> **missing on the Operator row** (master E.6). That is an operator-module gap, not a tour one - no
> change to `tours.prisma` results from the TYP.
