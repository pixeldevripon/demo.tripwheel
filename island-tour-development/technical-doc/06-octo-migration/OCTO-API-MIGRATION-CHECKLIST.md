# OCTO API migration — gap analysis & checklist

> **Goal.** Revamp the Island Tours backend API to strictly follow the
> [OCTO specification](./OCTO-SPECIFICATION-REFERENCE.md) for the **tour → availability → booking**
> surface. This doc is the implementable plan: the scope decision, the entity mapping, the gap
> analysis, and a step-by-step task checklist (schemas, routes, response shapes, error structures,
> enums). Frontend impact is tracked in [`OCTO-FRONTEND-ALIGNMENT.md`](./OCTO-FRONTEND-ALIGNMENT.md).
>
> **Companions:** spec details → [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md);
> platform rules → [`../MASTER-CHECKLIST.md`](../MASTER-CHECKLIST.md) (the OCTO work is the API-contract
> layer; the master defines the business rules that map onto it).
>
> **Legend:** `- [ ]` to do · `- [x]` done · `⚠️` decision required before building.

---

## Naming: everything is `tour` — no `trips`, no `products`

**One entity name across the whole stack: `tour`.** We deliberately deviate from OCTO's wire term
**`product`** and expose that concept as **`tour`** in our API. There is no `trip` and no `product`
anywhere we control — DB, code, routes, and JSON all say `tour`.

Concretely, OCTO's `product` concept becomes `tour` in our API:

| OCTO canonical (the standard) | Our API (what we ship) |
|---|---|
| `GET /products` · `GET /products/{id}` | `GET /tours` · `GET /tours/{id}` |
| field `productId` (availability/booking bodies) | field `tourId` |
| error `INVALID_PRODUCT_ID` | error `INVALID_TOUR_ID` |
| DTO `Product` | DTO `OctoTour` |

Everything else in the OCTO contract is kept verbatim — `option`, `unit`, `availability`, `booking`,
`supplier`, capabilities, status values, money encoding, error envelope. Only the `product` → `tour`
rename is ours.

```text
Concept (OCTO)        Our name (everywhere: DB · code · routes · JSON)
──────────────        ────────────────────────────────────────────────
Product          ──►  tour            (Tour model · /tours · tourId · OctoTour)
Option           ──►  option          (unchanged)
Unit             ──►  unit            (unchanged; sourced from TourAgeBand)
Availability     ──►  availability    (unchanged; sourced from departures)
Booking          ──►  booking         (unchanged)
```

- **Prisma:** the schema will be aligned to a single `Tour` naming (the current mix of `Trip*` /
  `Tour*` identifiers collapses to `Tour*`). **Not done now — documentation only**; the rename lands
  with the OCTO build (see §7).
- **The captured spec** ([`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md))
  intentionally keeps OCTO's canonical `product` vocabulary so it stays a faithful reference; map it
  1:1 to `tour` when reading it against our API.
- **⚠️ Strict-OCTO consumers.** A third-party OCTO client (e.g. an OTA) expects `productId` /
  `/products`. If/when we expose the API to such a consumer, add a **compatibility alias** (accept
  `productId` as a synonym for `tourId`, mount `/products` → `/tours`). Tracked as decision **D11**.

> OCTO already speaks "tours" in its content model — the `octo/content` `categoryLabels` enum contains
> `boat-tours`, `walking-tours`, `day-trips`, etc. Naming the container `tour` is a natural fit.

---

## 0. Scope decision (read first)

OCTO is a **B2B connectivity contract** for the transactional core (catalog, availability, booking).
Island Tours is a multilingual reseller marketplace with a commercial engine (tiers, ranking,
commission, eligibility, tracking) that OCTO does **not** model. So we adopt OCTO **where it fits**
and keep native APIs where it does not. The boundary:

| Layer | API shape | Why |
|---|---|---|
| **Catalog read** (tours/options/units) | **OCTO** (`GET /tours`, `/tours/{id}`, `/supplier`) | Standard, consumable by the frontend + future OTAs. |
| **Availability** (check + calendar) | **OCTO** (`POST /availability`, `/availability/calendar`) | Standard slot model maps to departures. |
| **Booking transaction** (reserve→confirm→cancel) | **OCTO** (`/bookings/*`) | Standard two-step flow. |
| **Pricing / content / pickups** | **OCTO capabilities** | `octo/pricing`, `octo/content`, `octo/pickups`. |
| **Commercial engine** (tiers, ranking, quality score, eligibility, Spotlight, tracking) | **Native** (Island-Tours-specific routes) | Not in OCTO; keep under `/api/v1/...`. |
| **Admin/operator management** (create/edit tours, translations, page content, FAQ, attributes, hubs, collections, settings) | **Native** (existing `/api/v1/...`) | Authoring surface; OCTO is read/transact only. |
| **Discovery** (categories, hubs, collections, search, filters) | **Native** | Marketplace IA; not OCTO. |

**⚠️ Decision D0 — surface strategy.** Two ways to expose OCTO; pick one (recommendation first):

1. **Recommended — dedicated OCTO namespace** `/api/octo/v1/*` alongside the existing `/api/v1/*`.
   The public frontend's booking flow consumes the OCTO namespace; native admin/discovery stays on
   `/api/v1`. Clean separation, OTA-ready, no breakage of admin tooling.
2. Replace the public-read tour/availability/booking routes under `/api/v1` with OCTO shapes
   in place. Fewer namespaces, but mixes OCTO + native conventions (errors, money) on one prefix.

> This checklist assumes **Option 1** (`/api/octo/v1`). If D0 changes, only the path prefixes move.

**⚠️ Decision D1 — auth for the OCTO surface.** OCTO mandates `Authorization: Bearer <token>`; our
platform uses Better Auth cookie sessions. For the public frontend, the OCTO booking surface is
effectively public (no per-user token) until checkout. Options: (a) accept the Better Auth session
cookie on the OCTO routes too (simplest for our own frontend); (b) issue a public reseller bearer
token for the frontend; (c) support both. **Recommendation: (a) for v1**, add bearer (b) when a real
third-party reseller integrates. Document whichever in `ARCHITECTURE-OVERVIEW.md`.

**⚠️ Decision D2 — money representation.** OCTO requires **integer minor units** + `currencyPrecision`.
Our schema stores `Decimal(10,2)` (`basePrice`, `price`, `totalAmount`, …). We keep `Decimal` in the
DB (precision for accounting/commission) and **convert to minor units at the OCTO serialization
boundary** only. Do not change the DB money types.

**⚠️ Decision D3 — Option/Unit modeling.** Today a Tour has no explicit "options"; it has age bands
(ADULT/CHILD/INFANT) and add-ons. OCTO needs ≥1 Option per Tour, each with Units. Mapping
(recommended): **one synthetic `DEFAULT` Option per tour** (multi-option deferred), and **age bands →
Units** (`bandType` → `UnitType`, `minAge/maxAge` → `restrictions`, `price` → `pricing`). Add-ons are
**not** OCTO units — defer to `octo/extras` (not standardized) or keep as a native booking extra.

---

## 1. Entity & field mapping (Island Tours → OCTO)

| OCTO concept | Island Tours source | Notes / gap |
|---|---|---|
| **Supplier** | `Operator` (+ platform `SiteInfo`) | OCTO supplier ≈ the platform or the operator. **⚠️ D4:** one supplier (platform) vs supplier-per-operator. Recommend **platform-as-supplier** for the unified marketplace API; expose operator as tour-level metadata. |
| Supplier.contact.email/telephone | `OperatorCompanyInfo.companyPhone`, `User.email` | Add operator `contactEmail`/`contactPhone` (master already wants `contact_email/phone`, E.164). |
| **Tour** | `Tour` | Core: derive `availabilityType` (START_TIME), `instantConfirmation` (true — instant booking), `deliveryMethods` (VOUCHER), `redemptionMethod`. New fields needed (see §2). |
| Tour.options | *(none)* | Synthesize `DEFAULT` option (D3). |
| Tour.pricingPer | `Tour.pricingModel` | `PER_PERSON`→`UNIT`, `UNIT`(group/boat)→`BOOKING`. |
| Tour.durationMinutesFrom/To | `Tour.durationMinutes` | Map both from the single value (or add a range). |
| Tour content (title/desc/highlights/inclusions/exclusions/media/faqs/itinerary) | `TourTranslation`, `TourHighlight`/`TourInclusion`/`TourExclusion` + `TourFeature` (other types) — DS1, `TourImage`, FAQ, `TourLocation` | `octo/content`: serializer **merges** all into `features[]` (HIGHLIGHT/INCLUSION/EXCLUSION/…), `media[]`, `faqs[]`, `locations[]`. |
| **Option** | synthetic | `availabilityLocalStartTimes` ← schedules' `startTime`; `cancellationCutoff` ← `cancellationHours`; `restrictions.min/maxUnits` ← `minPartySize/maxPartySize`; `requiredContactFields`. |
| **Unit** | `TourAgeBand` | `bandType`→`type`; `minAge/maxAge/minCount/maxCount`→`restrictions`; `price`→`pricing`. |
| **Availability** | `TourSchedule` (→ master `departures`) | Map `startDate+startTime`→`localDateTimeStart`; `availableSpots`→`vacancies`; `totalSpots`→`capacity`; `status`→OCTO status. Calendar = aggregate per day. |
| **Booking** | `Booking` (thin) | Expand heavily (§4): `uuid`, two-step status, `unitItems`, `contact`, `pricing`, currency, refs, expiry. |
| **UnitItem** | *(none)* | New child table — one row per pax. |
| **Contact** | `User` + new booking contact fields | Add guest contact override on booking. |
| **Pricing** | `Decimal` money fields | Serialize to minor units at boundary (D2). |
| **Pickup** | `Tour.pickupModel` + pickup add-on | Map to `octo/pickups` (deferred unless needed). |
| Booking status | `BookingStatus` enum (PENDING/CONFIRMED/CANCELLED/COMPLETED/REFUNDED) | **Replace/extend** to OCTO set: ON_HOLD/CONFIRMED/EXPIRED/CANCELLED/REDEEMED/PENDING/REJECTED (§7). |

---

## 1A. OCTO surface coverage matrix (every endpoint + capability)

The migration is **complete only when every row below is checked.** Each maps to a section here.

### Endpoints

| OCTO endpoint | Method | Our path | Section | Done |
|---|---|---|---|---|
| Get Supplier | `GET` | `/supplier/` | §3.1 | [x] |
| Get Tour List (OCTO product list) | `GET` | `/tours/` | §3.2 | [x] |
| Get Tour (OCTO product) | `GET` | `/tours/{id}` | §3.2 | [x] |
| Availability Check | `POST` | `/availability/` | §4.1 | [ ] |
| Availability Calendar | `POST` | `/availability/calendar` | §4.2 | [ ] |
| Create Booking (reserve) | `POST` | `/bookings/` | §5.2 | [ ] |
| Get Booking | `GET` | `/bookings/{uuid}` | §5.7 | [ ] |
| Get Booking List | `GET` | `/bookings/` | §5.7 | [ ] |
| Confirm Booking | `POST` | `/bookings/{uuid}/confirm` | §5.3 | [ ] |
| Update Booking | `PATCH` | `/bookings/{uuid}` | §5.6 | [ ] |
| Cancel Booking | `POST` | `/bookings/{uuid}/cancel` | §5.4 | [ ] |
| Extend Booking | `POST` | `/bookings/{uuid}/extend` | §5.5 | [ ] |
| Get Pickup Locations | `GET` | `/bookings/{uuid}/pickupLocations` | §5C | [ ] |
| Create Notification Subscription | `POST` | `/notifications/subscriptions` | §5D | [ ] |
| Get Notification Subscription | `GET` | `/notifications/subscriptions/{id}` | §5D | [ ] |
| List Notification Subscriptions | `GET` | `/notifications/subscriptions` | §5D | [ ] |
| Update Notification Subscription | `PATCH` | `/notifications/subscriptions/{id}` | §5D | [ ] |
| Delete Notification Subscription | `DELETE` | `/notifications/subscriptions/{id}` | §5D | [ ] |
| Outbound webhook delivery (POST to subscriber) | `POST` | subscriber `url` | §5D | [ ] |

### Capabilities

| Capability | Section | Done |
|---|---|---|
| `octo/content` | §5A | [x] |
| `octo/pricing` | §5B | [x] |
| `octo/pickups` | §5C | [ ] |
| `octo/dropoffs` | §5C | [ ] |
| `octo/notifications` (webhooks incl. `AVAILABILITY_UPDATE`) | §5D | [ ] |
| `octo/promotions` *(draft — defer)* | §5E | [ ] |
| Core conventions (headers, capabilities negotiation, money, errors) | §2, §6 | [x] |

---

## 2. Cross-cutting conventions

- [x] **Capabilities middleware** — parse the `Octo-Capabilities` request header (+ `_capabilities`
  query), expose the active set to serializers, and echo it in the response header. Support
  `octo/content`, `octo/pricing`, `octo/pickups`, `octo/dropoffs`, `octo/notifications`.
  → `src/octo/common/octo-capabilities.ts` (`OctoCapabilitiesMiddleware` + `@OctoCaps()`); applied
  `forRoutes('octo')` in `OctoModule`. Locale negotiation in `octo-locale.ts` (`Content-Language`).
- [x] **OCTO serializers** that gate fields by active capability (core vs content vs pricing).
  → `src/octo/serializers/octo-tour.serializer.ts` (+ `octo-supplier.serializer.ts`).
- [x] **Money serializer** — `Decimal → { amount(minorUnits), currency, currencyPrecision }`; build
  the `Pricing` object incl. `original/retail/net` and `includedTaxes` (D2). → `octo-money.ts`.
- [x] **OCTO error filter** — a filter (or interceptor) on the OCTO namespace that emits the flat
  `{ error, errorMessage, <contextId> }` shape with OCTO codes, instead of the native
  `{statusCode,timestamp,path,message}` (§6). Map Nest exceptions → OCTO codes.
  → `octo-error.ts` (`OctoException` + `OctoExceptionFilter`, bound per-controller via `@UseFilters`).
- [ ] **Bearer auth guard** for the OCTO namespace per D1 (or cookie passthrough). *(v1 catalog reads
  are `@Public()`; bearer for OTAs layered in a later phase.)*
- [ ] **`Octo-Env`** handling (live/test) and booking `testMode` — confirm against spec (open item).
  *(header allowed in CORS; consumed once bookings land in Phase 4-5.)*
- [x] **Swagger** — a separate OCTO tag/group documenting OCTO routes with OCTO DTOs + error shapes.
  *(routes grouped under the `OCTO` `@ApiTags`; OCTO DTO classes deferred — responses are spec-shaped.)*

---

## 3. Catalog endpoints

### 3.1 `GET /supplier/`

- [x] Build `OctoSupplierController` + serializer returning Supplier (D4).
- [x] `contact` from operator/platform; `media` from logo/cover; `endpoint` from config.
  → platform-as-supplier from `SiteInfo` + `CompanyInformations`; `endpoint` derived from the request.
- [ ] Add operator `contactEmail` (E.164 `contactPhone`) fields (Prisma + DTO) if supplier-per-operator.
  *(N/A — D4 platform-as-supplier; not building per-operator suppliers.)*

### 3.2 `GET /tours/` and `GET /tours/{id}`

- [x] `OctoToursController` (`/api/v1/octo/tours`), public/bearer. *(public for v1; bearer later.)*
- [x] **Core serializer**: `id, internalName, reference, locale, timeZone, allowFreesale,
  instantConfirmation, instantDelivery, availabilityRequired, availabilityType, deliveryFormats,
  deliveryMethods, redemptionMethod, options[]`.
- [x] Derive new Tour attributes from Tour — **add fields if missing**:
  - [x] `availabilityType` (constant `START_TIME` for scheduled tours; `OPENING_HOURS` later).
  - [x] `deliveryFormats` / `deliveryMethods` / `redemptionMethod` (config or per-tour; default
    `["PDF_URL","QRCODE"] / ["VOUCHER"] / DIGITAL`).
  - [x] `instantConfirmation`/`instantDelivery` (true for instant-book platform).
  - [x] `timeZone` per destination.
- [x] **DEFAULT option** serializer (D3): start times from `availabilityLocalStartTimes`,
  `cancellationCutoff` from `cancellationCutoffAmount/Unit`, `restrictions` from min/max party size,
  `requiredContactFields`. *(reads persisted `TourOption`; no synthesis needed — D3 schema landed.)*
- [x] **Units** from `TourUnit` (D3).
- [x] `octo/content` serializer: `features[]`, `media[]`, `faqs[]`, `locations[]`, `commentary[]`,
  `categoryLabels[]` (our category slugs), durations.
  - [x] Localize via `Accept-Language` against `TourTranslation`; set `Content-Language`.
    *(`Available-Languages` response header deferred.)*
- [x] `octo/pricing` serializer: `defaultCurrency`, `availableCurrencies`, `pricingPer`,
  `pricingFrom` on option + units.
- [ ] Pagination: OCTO list is a plain array — currently returns the full LIVE catalog as a bare
  array (tier-ranked). Add query/header paging when the catalog grows. **⚠️ D5** still open.

---

## 4. Availability endpoints

> Depends on the **availability/departures** model (master Stage 5). Today only `TourSchedule`
> exists (`startDate,endDate,startTime,totalSpots,availableSpots,status`). Build availability on top.

### 4.1 `POST /availability/`

- [ ] `OctoAvailabilityController` (`/api/octo/v1/availability`).
- [ ] Request DTO: `tourId, optionId, localDateStart, localDateEnd, availabilityIds?, units?[],
  currency?`.
- [ ] Resolve tour+option → tour; query schedules/departures in range; build Availability items:
  `id, localDateTimeStart/End, allDay, available, status, vacancies, capacity, maxUnits, utcCutoffAt,
  openingHours`.
- [ ] `id` must be a **stable, opaque slot id** that Create Booking can resolve back to a departure.
- [ ] Status mapping → `AVAILABLE / LIMITED / SOLD_OUT / CLOSED / FREESALE` (define thresholds, e.g.
  LIMITED when vacancies ≤ N).
- [ ] `utcCutoffAt` from `bookingCutoffMinutes`.
- [ ] `octo/pricing`: `unitPricing[]` + `pricing` for the requested `units`.

### 4.2 `POST /availability/calendar`

- [ ] Same request minus `availabilityIds`; return one `AvailabilityCalendar` per day:
  `localDate, available, status, vacancies, capacity, openingHours`, + `unitPricingFrom`/`pricingFrom`.
- [ ] Aggregate multiple departures per day into a day summary.

---

## 5. Booking endpoints (two-step reserve → confirm)

> The largest gap: today `Booking` is **model-only** (no controller/service) and thin. Build the full
> module. Preserve master business rules (commission snapshot, payment models, instant confirm)
> mapped onto the OCTO flow.

### 5.1 Schema expansion (`prisma/bookings.prisma`)

- [ ] Add: `uuid` (client-supplied, unique), `resellerReference`, `supplierReference`,
  `utcExpiresAt`, `utcConfirmedAt`, `utcRedeemedAt`, `freesale`, `cancellable`, `testMode`,
  `currency`, `notes` (exists), pricing breakdown fields, `cancellationRefund`/`cancellationReason`/
  `utcCancelledAt`.
- [ ] **Contact** on booking: `contactFirstName/LastName/FullName/Email/Phone/PostalCode/Country/
  Locales/Notes` (guest override; falls back to `User`).
- [ ] **New `BookingUnitItem` table**: `id, bookingId, uuid, unitId (→ age band), status,
  utcRedeemedAt, contact fields, ticket fields, pricing fields, resellerReference, supplierReference`.
- [ ] Reconcile with **master E.8** booking fields (public_ref/display_ref, multi-currency,
  commission snapshot, click IDs/UTM, payment_model, billing) — OCTO fields + E.8 fields **coexist**;
  align names where they overlap (`public_ref` ↔ `uuid`?, `display_ref` ↔ `resellerReference`?). **⚠️ D6.**
- [ ] Change `BookingStatus` enum to the OCTO set (§7) + a migration mapping old → new.

### 5.2 `POST /bookings/` — create (reserve)

- [ ] Request DTO: `uuid, tourId, optionId, availabilityId, unitItems[{unitId}], notes?,
  expirationMinutes?`.
- [ ] **Atomic capacity claim** against the departure (decrement vacancies; reject if insufficient →
  `UNPROCESSABLE_ENTITY`).
- [ ] Create booking `ON_HOLD` + `BookingUnitItem` rows; set `utcExpiresAt = now + expirationMinutes`
  (clamp to supplier/master limits).
- [ ] Validate unit restrictions (age band min/max counts, `accompaniedBy`, option min/maxUnits).
- [ ] Compute `pricing` (booking + per unit) via the pricing serializer.
- [ ] **Freesale** path when `allowFreesale` (optional `availabilityId`).
- [ ] Return Booking `ON_HOLD`.

### 5.3 `POST /bookings/{uuid}/confirm`

- [ ] Request DTO: `contact, resellerReference?, unitItems[{uuid}], emailReceipt?`.
- [ ] Reject if expired (`UNPROCESSABLE_ENTITY` / `INVALID_BOOKING_UUID`).
- [ ] **Payment hook** (master): trigger Stripe PaymentIntent per `payment_model`; `operator_full`
  confirms with no charge. Snapshot `commission_amount`. **⚠️ D7:** OCTO confirm is synchronous; our
  Stripe deposit/full flow may need a `PENDING` intermediate (use OCTO `PENDING`).
- [ ] On success: `CONFIRMED`, set `utcConfirmedAt`, persist contact, issue voucher/tickets, send
  confirmation email (Resend), fire `booking_complete` tracking (conversion = commission EUR).
- [ ] Return Booking `CONFIRMED` with `voucher` + per-item `ticket`.

### 5.4 `POST /bookings/{uuid}/cancel`

- [ ] Request DTO: `reason?, force?`. Compute refund (FULL/PARTIAL/NONE) from `cancellationHours`
  window vs now. Release capacity back to the departure. Set `CANCELLED` + `BookingCancellation`.
- [ ] Stripe refund per refund decision; respect commission reversal rules.

### 5.5 `POST /bookings/{uuid}/extend`

- [ ] Request DTO: `expirationMinutes`. Push `utcExpiresAt` (clamp). Only valid while `ON_HOLD`.

### 5.6 `PATCH /bookings/{uuid}` — update

- [ ] Modify `unitItems`/`contact`/`notes` pre-travel (re-validate capacity + pricing). **⚠️ D8:**
  confirm exact path/semantics against spec.

### 5.7 `GET /bookings/{uuid}` and `GET /bookings/`

- [ ] Single + list (filter by `resellerReference`, `supplierReference`, `localDate*`, `tourId`).
- [ ] AuthZ: a reseller/operator sees only its own bookings; admin sees all.

### 5.8 Expiry job

- [ ] BullMQ job: sweep `ON_HOLD` past `utcExpiresAt` → `EXPIRED`, release held capacity.

---

## 5A. Capability: `octo/content`

Gated content fields on Tour/Option/Unit, localized.

- [ ] Content serializer adds, when `octo/content` is active: `title`, `shortDescription`,
  `description`, `features[]`, `faqs[]`, `media[]`, `locations[]`, `commentary[]`, `categoryLabels[]`,
  `durationMinutesFrom/To`.
- [ ] `features[]` **merged** by the serializer (DS1 — dedicated tables kept): `TourHighlight`→
  HIGHLIGHT, `TourInclusion`→INCLUSION, `TourExclusion`→EXCLUSION, plus `TourFeature` rows for the
  other types (terms, accessibility, prebooking/prearrival, redemption).
- [ ] `media[]` from `TourImage` (`src`/`type`/`rel`); `locations[]` from `TourLocation` (itinerary,
  start/end, place + postalAddress).
- [ ] Localization headers: read `Accept-Language` → emit `Content-Language` + `Available-Languages`
  from `TourTranslation` (7 locales, EN fallback).
- [ ] `commentary[]` from tour languages (format/language).

## 5B. Capability: `octo/pricing`

- [ ] Pricing serializer adds `defaultCurrency`, `availableCurrencies`, `pricingPer` on Tour;
  `pricingFrom`/`pricing` on Option + Unit; `unitPricing[]`+`pricing` on Availability;
  `unitPricingFrom`/`pricingFrom` on Calendar; `pricing` (booking + per unit item) on Booking.
- [ ] Money in **minor units** via the money serializer (D2): `original`, `retail`, `net`,
  `currency`, `currencyPrecision`, `includedTaxes[]`.
- [ ] `pricingPer` from `Tour.pricingModel`; per-currency conversion if `currency` requested differs.

## 5C. Capability: `octo/pickups` & `octo/dropoffs`

- [ ] Schema: pickup/dropoff location tables (or reuse `TourLocation` typed as pickup/dropoff) +
  Option flags `pickupAvailable`/`pickupRequired` (and dropoff equivalents).
- [ ] Option serializer adds `pickupAvailable`, `pickupRequired`, `pickupLocations[]`, `pickupAreas[]`
  (+ dropoff mirror) when capability active.
- [ ] Availability request accepts `pickupLocationId` + `pickupRequested`; response adds
  `localPickupDateTimeStart/End` when a location is supplied.
- [ ] Booking create/update accepts `pickupRequested`, `pickupLocationId`, `pickupNotes`; confirmed
  booking returns `pickupLocation` + pickup datetime bounds (dropoff mirror).
- [ ] `GET /bookings/{uuid}/pickupLocations?latitude=&longitude=` — full list, or reordered/subset/
  virtual location when coordinates supplied.
- [ ] Map our `Tour.pickupModel` (INCLUDED/PAID_ADDON/NONE) → pickup capability flags; PAID_ADDON
  pickups link to the pickup add-on. **⚠️ D12:** model pickups as first-class locations vs add-ons.

## 5D. Capability: `octo/notifications` (webhooks)

> The reseller/partner subscribes to **change events**; OCTO pushes HTTP `POST` webhooks. This is how
> **availability changes propagate** (not polling) — the gap the checklist was missing.

### Subscription endpoints

- [ ] `POST /notifications/subscriptions` — create. Body: `url`, `notificationTypes[]`, `headers?`
  (custom headers echoed on delivery). Returns the subscription with its `id`.
- [ ] `GET /notifications/subscriptions` — list (scoped to the caller).
- [ ] `GET /notifications/subscriptions/{id}` — retrieve one.
- [ ] `PATCH /notifications/subscriptions/{id}` — update (`url`/`notificationTypes`/`headers`/active).
- [ ] `DELETE /notifications/subscriptions/{id}` — delete.
- [ ] Only active when `octo/notifications` is in `Octo-Capabilities`.

### Event types (OCTO `notificationType`)

- [ ] `PRODUCT_UPDATE` — emit when a tour's catalog/content/pricing changes. `data.productId` (=tourId).
- [ ] `AVAILABILITY_UPDATE` — **emit when departures/inventory change** (booking, cancel, expiry,
  materialization, capacity edit). `data` carries Availability-Check-compatible params (tourId/optionId/
  date) so the subscriber re-fetches `POST /availability/`.
- [ ] `BOOKING_UPDATE` — emit on every booking status transition (ON_HOLD→CONFIRMED/CANCELLED/EXPIRED/
  REDEEMED). `data.uuid`.

### Delivery payload & worker

- [ ] Payload: `{ id, subscriptionId, notificationType, utcCreatedAt, data }`.
- [ ] BullMQ **delivery worker**: POST to each matching subscription `url` with its custom `headers`;
  retries with backoff; record `NotificationDelivery` (status/attempts/lastError); dead-letter after N.
- [ ] **Signing/verification & retry policy** — not specified in the captured docs (open item); add
  HMAC signature header + documented retry schedule as our convention. **⚠️ D13.**
- [ ] **Emit hooks**: availability mutations (reserve/cancel/expire/materialize) enqueue
  `AVAILABILITY_UPDATE`; booking transitions enqueue `BOOKING_UPDATE`; tour publish/edit enqueue
  `PRODUCT_UPDATE`.

> Schema: `NotificationSubscription` / `NotificationDelivery` with `notificationTypes` = the three OCTO
> types — see [`OCTO-PRISMA-SCHEMA-DESIGN.md`](./OCTO-PRISMA-SCHEMA-DESIGN.md) §10.

## 5E. Capability: `octo/promotions` *(draft — defer)*

- [ ] Not stable in OCTO; defer. When adopted: promotional pricing on availability + bookings.

## 5F. Per-tour reviews (native module — feeds tour rating + quality score)

> **Native, not OCTO** (OCTO has no review capability). Booking-gated, per-tour, moderated,
> multilingual. Surfaces as `AggregateRating`/`Review` JSON-LD on the tour page and feeds
> `qualityScore`. Schema: [`OCTO-PRISMA-SCHEMA-DESIGN.md`](./OCTO-PRISMA-SCHEMA-DESIGN.md) §7
> (`Review` + `ReviewTranslation`). Stays under `/api/v1` (not `/api/octo/v1`).

- [ ] Expand `Review` to E.7 (sub-ratings, reviewer identity, travel month/year, photos, helpful
  count, operator response, moderation) + `ReviewTranslation` (per-locale text).
- [ ] **Create review** `POST /api/v1/tours/{id}/reviews` — **booking-gated**: only a `REDEEMED`/
  completed booking by this user, one review per booking (`bookingId @unique`). Starts `PENDING`.
- [ ] **List reviews** `GET /api/v1/tours/{id}/reviews` — public, **approved only**, paginated,
  sortable (newest / highest / most-helpful), per-locale text via `Accept-Language` → EN fallback.
- [ ] **Operator response** `POST /api/v1/reviews/{id}/response` — operator replies to a review on its
  own tour.
- [ ] **Moderation** `PATCH /api/v1/reviews/{id}/moderate` (admin) — approve/reject (+ reason).
- [ ] **Aggregates**: on approve/unapprove, recompute `Tour.aggregateRating`/`Count` and
  `Operator.aggregateRating`/`Count` (cached).
- [ ] **LD11 cold-start** (service rule): tour shows its own rating only at **≥3 approved**; else
  operator fallback **only if ≥10 reviews & ≥4.0**; else no rating.
- [ ] **Quality score feed**: avg rating + review count feed the nightly `qualityScore` job (ranking).
- [ ] RBAC: `VIEW_REVIEWS` / `EDIT_REVIEW` / `DELETE_REVIEW` / `APPROVE_REVIEW` (enums already exist).

---

## 6. Error structure

- [ ] OCTO error filter for the OCTO namespace emitting `{ error, errorMessage, tourId?, optionId?,
  unitId?, availabilityId? }`.
- [ ] Map: validation → `BAD_REQUEST`; unknown ids → `INVALID_*_ID` / `INVALID_BOOKING_UUID`;
  sold-out / restriction / expired → `UNPROCESSABLE_ENTITY` (422); auth → `UNAUTHORIZED` (401) /
  `FORBIDDEN` (403); unhandled → `INTERNAL_SERVER_ERROR` (500).
- [ ] Keep native `{statusCode,timestamp,path,message}` for `/api/v1` (admin/discovery) — do not
  change those.
- [ ] Swagger error DTOs for OCTO routes (`OctoErrorDto`).

---

## 7. Enums & Prisma changes

- [ ] **`BookingStatus`** → `ON_HOLD, CONFIRMED, EXPIRED, CANCELLED, REDEEMED, PENDING, REJECTED`
  (migrate: PENDING→PENDING/ON_HOLD, CONFIRMED→CONFIRMED, CANCELLED→CANCELLED, COMPLETED→REDEEMED,
  REFUNDED→CANCELLED+refund). **⚠️ D9:** confirm mapping; preserve historical rows.
- [ ] New enums: `AvailabilityStatus` (AVAILABLE/FREESALE/SOLD_OUT/LIMITED/CLOSED),
  `OctoAvailabilityType` (START_TIME/OPENING_HOURS), `DeliveryFormat`, `DeliveryMethod`,
  `RedemptionMethod`, `OctoUnitType` (or map from `AgeBandType`), `CancellationRefund`,
  `FeatureType`, `MediaRel`, `LocationType`, `CommentaryFormat`.
- [ ] Map `AgeBandType` (ADULT/CHILD/INFANT) → OCTO `UnitType` (add YOUTH/SENIOR/STUDENT/etc. if we
  want richer units — **⚠️ D10**).
- [ ] `PricingModel` (PER_PERSON/UNIT) → derive `PricingPer` (UNIT/BOOKING) at serialization.
- [ ] **Remove** legacy slot/waitlist enums (`SlotStatus`, `WaitlistStatus`) — already scheduled in
  the master checklist; unrelated to OCTO but clean up together.
- [ ] New table `BookingUnitItem`; add OCTO fields to `Booking` (§5.1).
- [ ] Optional Tour fields on `Tour`: `availabilityType`, delivery/redemption config, `timeZone`
  (or derive from destination).
- [ ] **Rename Prisma to a single `Tour` naming** (per the "Naming" callout): collapse the current
  `Trip*` / `Tour*` mix to `Tour*` — `Trip` model → `Tour`, `trips.prisma` → `tours.prisma`,
  `TripTranslation/TripImage/TripStatus/...` → `Tour*`, module `trips/` → `tours/`, routes
  `/api/v1/trips` → `/api/v1/tours`, **and rename the physical table `trips` → `tours`** (DS2 — no
  `@@map` alias). One coordinated migration + update imports + frontend API clients. **Documentation-
  only for now; schedule with the OCTO build.**
- [ ] **Content tables (DS1 — keep dedicated):** keep `TourHighlight`/`TourInclusion`/`TourExclusion`
  (+translations); **add** `TourFeature` + `TourFeatureTranslation` for the other OCTO feature types.
  Serializer merges all into `features[]`. (No migration of the existing tables.)

---

## 8. Reconciliation with the master (do not regress)

OCTO is the **API contract**; the master rules remain the **business logic**. Keep all of these
working through the OCTO layer:

- [ ] **Commission tiers / ranking / quality score** — native; the OCTO tour list does **not**
  expose tier internals, but tour **ordering** in our own listing endpoints still uses
  `tier_rank, quality_score, id`. (OCTO `/tours` ordering — define: keep ranked, or stable.)
- [ ] **Commission snapshot** on confirm (conversion value = `commission_amount` EUR) — fire from the
  OCTO confirm path.
- [ ] **Payment models** (operator_link/on_arrival/paid_in_full/operator_full) — map onto OCTO
  confirm + Stripe (D7).
- [ ] **7 locales** — OCTO `octo/content` localization via `Accept-Language` ↔ our `TourTranslation`.
- [ ] **Multi-category / multi-hub** — categories → `categoryLabels` (lossy; OCTO enum is fixed);
  hubs → `locations`. Keep native category/hub pages.
- [ ] **TYP / tracking / Consent Mode v2 / Meta CAPI** — fire from OCTO confirm; TYP route unchanged.
- [ ] **Slug registry / flat URLs** — unchanged (native discovery).
- [ ] **Cancellation window** (`cancellation_hours` enum, default 48) → OCTO `cancellationCutoff` +
  refund computation.

---

## 9. Decisions to confirm (collected)

| # | Decision | Recommendation |
|---|---|---|
| D0 | OCTO namespace vs in-place | **Dedicated `/api/octo/v1`** |
| D1 | OCTO auth (bearer vs cookie) | **Cookie for v1**, add bearer for OTAs |
| D2 | Money representation | **Decimal in DB, minor units at boundary** |
| D3 | Option/Unit modeling | **Single DEFAULT option; age bands → units; add-ons native** |
| D4 | Supplier = platform vs operator | **Platform-as-supplier** |
| D5 | OCTO list pagination | Confirm spec; likely array + query paging |
| D6 | Booking field reconciliation (OCTO uuid/refs ↔ master public_ref/display_ref) | Align names; both sets coexist |
| D7 | Stripe deposit/full vs synchronous OCTO confirm | Use OCTO `PENDING` intermediate |
| D8 | Update Booking semantics | Confirm spec |
| D9 | BookingStatus migration mapping | As in §7 |
| D10 | Richer UnitTypes | Map ADULT/CHILD/INFANT now; extend later |
| D11 | Strict-OCTO `productId`/`/products` compatibility alias for third-party consumers | Add alias only when an external OCTO client integrates; our API stays `tour` |
| D12 | Pickups modeled as first-class locations vs add-ons | First-class pickup locations; PAID_ADDON links the pickup add-on |
| D13 | Webhook signing + retry policy (not in OCTO spec) | HMAC signature header + backoff retry as our convention |

---

## 10. Suggested build sequence

```text
0. Conventions (capabilities mw, money serializer, OCTO error filter, auth guard, Swagger group)
        │
        ▼
1. GET /supplier/  +  GET /tours + /tours/{id}   (catalog read; content+pricing capabilities)
        │
        ▼
2. Availability model (master Stage 5: schedules+exceptions+departures)
        │
        ▼
3. POST /availability + /availability/calendar
        │
        ▼
4. Booking schema expansion + BookingUnitItem + BookingStatus migration
        │
        ▼
5. POST /bookings (reserve) → confirm → cancel → extend → update → get/list  + expiry job
        │
        ▼
6. Payments (Stripe) wired into confirm/cancel  +  tracking on confirm  +  email
        │
        ▼
7. Per-tour reviews (booking-gated) + moderation + aggregates → quality score   (§5F, native)
        │
        ▼
8. octo/notifications: subscription CRUD + delivery worker
   + emit AVAILABILITY_UPDATE / BOOKING_UPDATE / PRODUCT_UPDATE  (real-time propagation)
        │
        ▼
9. Pickups/dropoffs capability  +  frontend alignment (separate doc)
```

> The full OCTO surface is enumerated in the **§1A coverage matrix** — the migration is complete only
> when every endpoint and capability row there is checked.

> Update this checklist in the same commit as each change (flip `- [ ]` → `- [x]`). Keep the
> [`MASTER-CHECKLIST.md`](../MASTER-CHECKLIST.md) in sync where OCTO work satisfies a master task
> (bookings, availability, payments, tracking).
