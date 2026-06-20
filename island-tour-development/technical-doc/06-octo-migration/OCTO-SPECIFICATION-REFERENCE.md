# OCTO API — specification reference (detailed)

> **What this is.** A captured, implementation-grade reference of the
> [OCTO specification](https://docs.octo.travel/) (Open Connectivity for Tours, Activities &
> Attractions) — every endpoint, schema, sub-schema, enum, capability, header, the booking
> lifecycle, the error structure, and worked request/response examples. Captured June 2026 from
> `docs.octo.travel`. This is a **reference snapshot** — on any conflict the live spec at
> <https://docs.octo.travel/> and its OpenAPI / SwaggerHub definition win. A few items remain
> unconfirmed; they are flagged inline and collected in [§12](#12-open-items-to-verify).
>
> **Why we have it.** Island Tours is migrating its booking/availability API to follow OCTO. Build
> plan: [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md). Frontend impact:
> [`OCTO-FRONTEND-ALIGNMENT.md`](./OCTO-FRONTEND-ALIGNMENT.md).

---

## Table of contents

1. [What OCTO is](#1-what-octo-is)
2. [Conventions (auth, headers, capabilities, money)](#2-conventions)
3. [Endpoints](#3-endpoints)
4. [Core schemas](#4-core-schemas) — Supplier · Product · Option · Unit · Availability · Booking · UnitItem · Contact
5. [Capability schemas](#5-capability-schemas) — content · pricing · pickups/dropoffs · notifications (webhooks)
6. [Shared sub-schemas](#6-shared-sub-schemas) — Media · Feature · Location/Place/PostalAddress · Commentary · Ticket · Cancellation
7. [Booking lifecycle](#7-booking-lifecycle)
8. [Worked examples](#8-worked-examples)
9. [Error structure & codes](#9-error-structure--codes)
10. [Capabilities catalog](#10-capabilities-catalog)
11. [Enum appendix](#11-enum-appendix)
12. [Open items to verify](#12-open-items-to-verify)

---

> **Naming note — this reference uses OCTO's canonical `product`; our API uses `tour`.** This document
> deliberately keeps OCTO's standard vocabulary (**Product**, `/products`, `productId`,
> `INVALID_PRODUCT_ID`) so it stays a faithful reference to the real spec. **Our own API renames that
> one concept to `tour`** — `GET /tours`, field `tourId`, error `INVALID_TOUR_ID`, DTO `OctoTour`.
> Everything else (`option`, `unit`, `availability`, `booking`, `supplier`, capabilities, statuses,
> money, errors) is identical. Map `product → tour` 1:1 when reading this against our implementation.
> Decision + mapping: [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md)
> ("Naming" callout + D11).

---

## 1. What OCTO is

OCTO is an open standard API specification for the in-destination experiences sector (tours,
activities, attractions). It defines agreed schemas, endpoints, and **capabilities** for connecting
platforms, resellers, OTAs, and suppliers. It separates a small mandatory **core** from optional
**capabilities** that enrich responses only when explicitly requested.

The domain model is three layers:

```text
Supplier ──▶ Product ──▶ Option ──▶ Unit          (catalog: who / what / which variant / who travels)
                          │
                          ▼
                     Availability                  (when: bookable slots / calendar days)
                          │
                          ▼
                       Booking ──▶ UnitItem        (transaction: reserve → confirm; one item per traveler)
```

- **Supplier** — the operator/brand offering products.
- **Product** — a sellable experience (a tour). Carries delivery/redemption rules, content, options.
- **Option** — a bookable variant of a product (e.g. "Morning", "With transfer"). Holds start times,
  cancellation cutoff, required contact fields, restrictions, and the units.
- **Unit** — a participant type within an option (ADULT, CHILD, INFANT, …) with age/quantity
  restrictions and pricing.
- **Availability** — a bookable slot (a datetime, or an opening-hours day) with capacity/vacancies.
- **Booking** — a reservation that **holds** availability, then is **confirmed**; contains
  **UnitItems** (one per participant/ticket).

---

## 2. Conventions

### Base URL & versioning

OCTO does not mandate a path prefix. The **Supplier** object advertises its `endpoint` (base URL, no
trailing slash); every operation path below is relative to it.

### Authentication

- `Authorization: Bearer <token>` — **mandatory on every request**.
- `Content-Type: application/json` — required on `POST` / `PATCH` / `DELETE`.

### Required & common headers

| Header | Direction | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | request | Auth (always). |
| `Content-Type: application/json` | request | On write methods. |
| `Octo-Capabilities: <ids>` | request | Comma-separated capability IDs to enable (e.g. `octo/content, octo/pricing`). |
| `Octo-Env: live \| test` | request | Live vs test environment. *(Seen in examples; not formally documented — see [§12](#12-open-items-to-verify).)* |
| `Octo-Capabilities: <ids>` | response | Echoes the capabilities the server actually initialized. |
| `Accept-Language` / `Content-Language` / `Available-Languages` | request/response | Localization, with `octo/content`. |

### Capabilities (the core mechanism)

The response shape is controlled by the **`Octo-Capabilities`** request header (or the
`_capabilities` query parameter), a comma-separated list of capability IDs:

```http
GET /products/ HTTP/1.1
Authorization: Bearer <token>
Octo-Capabilities: octo/content, octo/pricing
Octo-Env: live
```

- **Core** (no capabilities) returns only the mandatory fields.
- Each enabled capability **adds gated fields** to the relevant schemas.
- The server **echoes** the initialized capabilities in the `Octo-Capabilities` response header.

> Practical rule: a field's presence depends on the requested capabilities. A consumer must request
> the capabilities it needs and must not assume gated fields exist otherwise.

### Money encoding (with `octo/pricing`)

All monetary amounts are **integers in the currency's minor units**. Convert with
`amount / 10^currencyPrecision`. Example: `retail: 7500`, `currencyPrecision: 2`, `currency: "EUR"`
→ €75.00. **Never floats/decimals for money.**

---

## 3. Endpoints

All paths are relative to the supplier `endpoint`. Capability-gated fields appear only when requested.

| Operation | Method | Path | Notes |
|---|---|---|---|
| Get Supplier | `GET` | `/supplier/` | Supplier metadata + contact. |
| Get Product List | `GET` | `/products/` | Full catalog (paginated). |
| Get Product | `GET` | `/products/{id}` | Single product, same shape as list item. |
| Availability Check | `POST` | `/availability/` | Concrete bookable slots for a date range / specific ids. |
| Availability Calendar | `POST` | `/availability/calendar` | Day-level availability summary for a range. |
| Create Booking (reserve) | `POST` | `/bookings/` | Holds availability → `ON_HOLD`. |
| Get Booking | `GET` | `/bookings/{uuid}` | Single booking. |
| Get Booking List | `GET` | `/bookings/` | Filter via query params. |
| Confirm Booking | `POST` | `/bookings/{uuid}/confirm` | `ON_HOLD → CONFIRMED`. |
| Update Booking | `PATCH` | `/bookings/{uuid}` | Modify unit items / contact / notes. |
| Cancel Booking | `POST` | `/bookings/{uuid}/cancel` | `→ CANCELLED` + refund decision. |
| Extend Booking | `POST` | `/bookings/{uuid}/extend` | Push out `utcExpiresAt`. |
| Get Pickup Locations | `GET` | `/bookings/{uuid}/pickupLocations?latitude=&longitude=` | `octo/pickups` only. |
| Create Notification Subscription | `POST` | `/notifications/subscriptions` | `octo/notifications`. |
| List Notification Subscriptions | `GET` | `/notifications/subscriptions` | `octo/notifications`. |
| Get Notification Subscription | `GET` | `/notifications/subscriptions/{id}` | `octo/notifications`. |
| Update Notification Subscription | `PATCH` | `/notifications/subscriptions/{id}` | `octo/notifications`. |
| Delete Notification Subscription | `DELETE` | `/notifications/subscriptions/{id}` | `octo/notifications`. |

**Get Booking List** query filters (commonly supported): `resellerReference`, `supplierReference`,
`localDate` / `localDateStart` / `localDateEnd`, `productId`, `optionId`. *(Exact param set — verify
against OpenAPI; see [§12](#12-open-items-to-verify).)*

---

## 4. Core schemas

### 4.1 Supplier

```jsonc
{
  "id": "string",                  // unique supplier id
  "name": "string",                // business name
  "endpoint": "https://api.example.com",  // base URL, no trailing slash
  "contact": {                     // SupplierContact
    "website":   "string|null",
    "email":     "string|null",
    "telephone": "string|null",    // E.164
    "address":   "string|null"
  },
  "shortDescription": "string|null",
  "media": [ /* Media[] — see §6.1; may be null */ ]
}
```

### 4.2 Product

Core fields are always present. `defaultCurrency` / `availableCurrencies` / `pricingPer` require
`octo/pricing`; `title` / `description` / `media` / `faqs` / `features` / `locations` /
`durationMinutes*` / `commentary` require `octo/content`.

```jsonc
{
  // ── Core ──
  "id": "string",
  "internalName": "string",
  "reference": "string|null",
  "locale": "string",
  "timeZone": "string",                 // IANA tz, e.g. "America/Curacao"
  "allowFreesale": false,               // unbounded sales permitted
  "instantConfirmation": true,
  "instantDelivery": true,
  "availabilityRequired": true,
  "availabilityType": "START_TIME | OPENING_HOURS",
  "deliveryFormats": ["PDF_URL","QRCODE","CODE128","PKPASS_URL"],
  "deliveryMethods": ["VOUCHER","TICKET"],
  "redemptionMethod": "DIGITAL | PRINT | MANIFEST",
  "options": [ /* Option[] — §4.3 */ ],

  // ── octo/pricing ──
  "defaultCurrency": "EUR",
  "availableCurrencies": ["EUR","USD"],
  "pricingPer": "UNIT | BOOKING",

  // ── octo/content ──
  "title": "string",
  "shortDescription": "string|null",
  "description": "string|null",
  "features": [ /* Feature[] — §6.2 */ ],
  "faqs": [ { "question": "string", "answer": "string" } ],
  "media": [ /* Media[] — §6.1 */ ],
  "locations": [ /* Location[] — §6.3 */ ],
  "categoryLabels": ["boat-tours","family-friendly"],   // CategoryLabel enum — §11
  "durationMinutesFrom": 60,
  "durationMinutesTo": 120,              // nullable
  "commentary": [ /* Commentary[] — §6.4 */ ]
}
```

### 4.3 Option

```jsonc
{
  // ── Core ──
  "id": "string",
  "default": true,
  "internalName": "string",
  "reference": "string|null",
  "availabilityLocalStartTimes": ["09:00","13:00"],     // ≥1 required
  "cancellationCutoff": "PT24H",                         // ISO 8601 duration
  "cancellationCutoffAmount": 24,
  "cancellationCutoffUnit": "hour | minute | day",
  "requiredContactFields": ["firstName","lastName","emailAddress"],   // ContactField enum — §11
  "restrictions": { "minUnits": 1, "maxUnits": 10 },     // OptionRestrictions (ints, nullable)
  "units": [ /* Unit[] — §4.4 */ ],

  // ── octo/pricing ──
  "pricingFrom": [ /* Pricing[] — §5.2 */ ],
  "pricing":     [ /* Pricing[] */ ],

  // ── octo/pickups (when enabled) ──
  "pickupAvailable": true,
  "pickupRequired": false,
  "pickupLocations": [ /* PickupLocation[] — §5.3 */ ],
  "pickupAreas": [ /* optional service areas */ ],

  // ── octo/content ──
  "title": "string",
  "shortDescription": "string|null",
  "description": "string|null",
  "features": [], "faqs": [], "media": [], "locations": [], "categoryLabels": [],
  "durationMinutesFrom": 60, "durationMinutesTo": 120, "commentary": []
}
```

### 4.4 Unit

```jsonc
{
  // ── Core ──
  "id": "string",
  "internalName": "string",
  "reference": "string|null",
  "type": "ADULT | YOUTH | CHILD | INFANT | FAMILY | SENIOR | STUDENT | MILITARY | OTHER",
  "restrictions": {                     // UnitRestrictions
    "minAge": 0, "maxAge": 17,
    "idRequired": false,
    "minQuantity": null, "maxQuantity": null,
    "paxCount": 1,                       // headcount this unit consumes toward capacity
    "accompaniedBy": ["adult"],          // unit ids/types that must accompany
    "minHeight": 0, "maxHeight": 0, "heightUnit": "cm",
    "minWeight": 0, "maxWeight": 0, "weightUnit": "kg"
  },
  "requiredContactFields": ["firstName","lastName"],   // per-ticket required fields

  // ── octo/pricing ──
  "pricingFrom": [ /* Pricing[] */ ],
  "pricing":     [ /* Pricing[] */ ],

  // ── octo/content ──
  "title": "string|null",
  "shortDescription": "string",
  "features": []
}
```

### 4.5 Availability

**`POST /availability/` request:**

```jsonc
{
  "productId": "string",
  "optionId": "string",
  "localDateStart": "2026-07-01",       // YYYY-MM-DD
  "localDateEnd": "2026-07-31",
  "availabilityIds": ["..."],            // optional: check specific slots
  "units": [ { "id": "unitId", "quantity": 2 } ],   // optional: capacity + pricing
  "currency": "EUR",                     // optional (octo/pricing)
  "pickupLocationId": "string",          // optional (octo/pickups)
  "pickupRequested": true                // optional (octo/pickups)
}
```

**Availability** object (response item):

```jsonc
{
  "id": "string",                        // opaque slot id → used as availabilityId in Create Booking
  "localDateTimeStart": "2026-07-01T09:00:00+02:00",
  "localDateTimeEnd":   "2026-07-01T11:00:00+02:00",
  "allDay": false,
  "available": true,
  "status": "AVAILABLE | FREESALE | SOLD_OUT | LIMITED | CLOSED",
  "vacancies": 8,                        // nullable
  "capacity": 12,                        // nullable
  "maxUnits": null,                      // nullable — max units per booking on this slot
  "utcCutoffAt": "2026-06-30T22:00:00Z",
  "openingHours": [ { "from": "09:00", "to": "17:00" } ],   // for OPENING_HOURS products

  // octo/pricing
  "unitPricing": [ /* Pricing[] with unitId */ ],
  "pricing": { /* Pricing — total */ },

  // octo/pickups (when pickupLocationId supplied)
  "localPickupDateTimeStart": "2026-07-01T08:30:00+02:00",
  "localPickupDateTimeEnd":   "2026-07-01T08:45:00+02:00"
}
```

**`POST /availability/calendar`** uses the same request minus `availabilityIds`. **AvailabilityCalendar**
object (one per day):

```jsonc
{
  "localDate": "2026-07-01",
  "available": true,
  "status": "AVAILABLE | FREESALE | SOLD_OUT | LIMITED | CLOSED",
  "vacancies": 8,                        // nullable
  "capacity": 12,                        // nullable
  "openingHours": [ { "from": "09:00", "to": "17:00" } ],

  // octo/pricing — UNIT mode → unitPricingFrom; BOOKING mode → pricingFrom
  "unitPricingFrom": [ /* Pricing[] */ ],
  "pricingFrom": [ /* Pricing[] */ ]
}
```

### 4.6 Booking

```jsonc
{
  "id": "string",
  "uuid": "uuid",                        // client-supplied at create; the primary identifier
  "testMode": false,
  "resellerReference": "string|null",    // reseller's own booking ref
  "supplierReference": "string|null",    // supplier's own booking ref
  "status": "ON_HOLD | CONFIRMED | EXPIRED | CANCELLED | REDEEMED | PENDING | REJECTED",
  "utcCreatedAt": "date-time",
  "utcUpdatedAt": "date-time",
  "utcExpiresAt": "date-time|null",      // when an ON_HOLD reservation lapses
  "utcRedeemedAt": "date-time|null",
  "utcConfirmedAt": "date-time|null",
  "productId": "string", "product": { /* Product */ },
  "optionId": "string",  "option":  { /* Option */ },
  "cancellable": true,
  "cancellation": { /* BookingCancellation|null — §6.6 */ },
  "freesale": false,
  "availabilityId": "string|null", "availability": { /* Availability|null */ },
  "contact": { /* Contact — §4.8 */ },
  "notes": "string|null",
  "deliveryMethods": ["VOUCHER","TICKET"],
  "voucher": { /* Ticket|null — §6.5 */ },
  "unitItems": [ /* UnitItem[] — §4.7 */ ],
  "pricing": { /* Pricing — octo/pricing */ },

  // octo/pickups (when used)
  "pickupRequested": true,
  "pickupLocationId": "string|null",
  "pickupLocation": { /* PickupLocation|null */ },
  "pickupNotes": "string|null"
}
```

### 4.7 UnitItem

One per participant / ticket.

```jsonc
{
  "uuid": "string",
  "resellerReference": "string|null",
  "supplierReference": "string|null",
  "unitId": "string", "unit": { /* Unit */ },
  "status": "BookingStatus",
  "utcRedeemedAt": "date-time|null",
  "contact": { /* Contact */ },
  "ticket": { /* Ticket|null — §6.5 */ },
  "pricing": { /* Pricing — octo/pricing */ }
}
```

### 4.8 Contact

```jsonc
{
  "fullName": "string|null",
  "firstName": "string|null",
  "lastName": "string|null",
  "emailAddress": "string|null",
  "phoneNumber": "string|null",
  "locales": ["en"],
  "postalCode": "string|null",
  "country": "string|null",
  "notes": "string|null"
}
```

Which fields are **required** is declared by `Option.requiredContactFields` (lead traveler) and
`Unit.requiredContactFields` (per ticket). Allowed field names: see `ContactField` in [§11](#11-enum-appendix).

---

## 5. Capability schemas

### 5.1 `octo/content`

Adds the customer-facing fields shown in §4.2–§4.4 (`title`, `shortDescription`, `description`,
`features`, `faqs`, `media`, `locations`, `categoryLabels`, `durationMinutes*`, `commentary`).
Localized via `Accept-Language` (request), `Content-Language` (response locale), `Available-Languages`
(what the supplier can serve).

Content is **modeled through generic structures**, not bespoke fields:

| Conceptual field | OCTO representation |
|---|---|
| highlights / inclusions / exclusions | `features[]` with `type` ∈ `HIGHLIGHT` / `INCLUSION` / `EXCLUSION` |
| images / video | `media[]` (`src`, `type`, `rel`) |
| itinerary | `locations[]` with `types[]` ∈ `ITINERARY_ITEM` / `START` / `END` |
| country / address | `locations[].place.postalAddress` |
| FAQs | `faqs[]` (`question`, `answer`) |
| guide language(s) / format | `commentary[]` (`format`, `language`) |

### 5.2 `octo/pricing`

**Pricing** object:

```jsonc
{
  "original": 8000,                      // list / undiscounted, minor units
  "retail":   7500,                      // customer-facing price
  "net":      6000,                      // supplier net (nullable)
  "currency": "EUR",                     // ISO 4217
  "currencyPrecision": 2,                // amount / 10^precision
  "includedTaxes": [
    { "name": "VAT", "retail": 1200, "original": 1280, "net": 1000 }   // Tax
  ]
}
```

Where pricing attaches (driven by `product.pricingPer`):

| Endpoint | Field(s) | Context |
|---|---|---|
| `GET /products/{id}` | `pricingFrom` | per-unit "from" price on option/unit |
| `POST /availability/calendar` (UNIT) | `unitPricingFrom` | per `unitId` |
| `POST /availability/calendar` (BOOKING) | `pricingFrom` | per booking |
| `POST /availability/` | `unitPricing[]` + `pricing` | final per-unit + total |
| `POST /bookings/` | `pricing` (booking + per `unitItem`) | final total with taxes |

`PricingPer`: `UNIT` (price per participant) or `BOOKING` (one price per reservation).

### 5.3 `octo/pickups` and `octo/dropoffs`

**On `Option`:** `pickupAvailable`, `pickupRequired`, `pickupLocations[]`, `pickupAreas[]`.

**PickupLocation** (a `Location` variant — see §6.3):

```jsonc
{
  "id": "string",
  "title": "string",
  "shortDescription": "string|null",
  "place": {
    "latitude": 12.108,
    "longitude": -68.935,
    "postalAddress": { /* PostalAddress — §6.3 */ },
    "identifiers": { /* google/apple/tripadvisor ids */ },
    "sameAs": ["https://..."]
  }
}
```

**On availability** (`POST /availability/`): request `pickupLocationId` + `pickupRequested`; response
adds `localPickupDateTimeStart` / `localPickupDateTimeEnd` when a location id is supplied.

**On booking** (create/update): `pickupRequested`, `pickupLocationId`, `pickupNotes`. The confirmed
booking returns `pickupLocation` + pickup datetime bounds. Pickup is selected at **booking level**
(per-`unitItem` pickup is not documented).

**Dedicated endpoint:** `GET /bookings/{uuid}/pickupLocations?latitude={lat}&longitude={lng}`. Without
coordinates → full list; with coordinates → the supplier may reorder/subset/synthesize a virtual
pickup location.

**`octo/dropoffs`** mirrors pickups exactly: `dropoffAvailable`, `dropoffRequired`,
`dropoffLocations[]`, selected via `dropoffRequested`, `dropoffLocationId`, `dropoffNotes`.

### 5.4 `octo/notifications` (webhooks)

Resellers/partners subscribe to **change events**; the supplier pushes HTTP `POST` webhooks. Enabled
by adding `octo/notifications` to `Octo-Capabilities`. **This is how availability changes propagate
without polling.**

**Subscription endpoints:**

| Action | Method | Path |
|---|---|---|
| Create | `POST` | `/notifications/subscriptions` |
| List | `GET` | `/notifications/subscriptions` |
| Retrieve | `GET` | `/notifications/subscriptions/{id}` |
| Update | `PATCH` | `/notifications/subscriptions/{id}` |
| Delete | `DELETE` | `/notifications/subscriptions/{id}` |

**Subscription request body:**

```jsonc
{
  "url": "https://reseller.example.com/octo/webhook",   // delivery endpoint
  "notificationTypes": ["PRODUCT_UPDATE","AVAILABILITY_UPDATE","BOOKING_UPDATE"],
  "headers": { "X-Custom": "..." }                       // optional, echoed on delivery
}
```

**Notification (webhook) types:**

| `notificationType` | Fires when | `data` carries |
|---|---|---|
| `PRODUCT_UPDATE` | Product/tour data changes | `productId` |
| `AVAILABILITY_UPDATE` | Availability/inventory changes | Availability-Check-compatible params (productId/optionId/date) → subscriber re-fetches `POST /availability/` |
| `BOOKING_UPDATE` | Booking status changes | `uuid` |

**Delivery payload (POSTed to the subscription `url`):**

```jsonc
{
  "id": "ntf_…",
  "subscriptionId": "sub_…",
  "notificationType": "AVAILABILITY_UPDATE",
  "utcCreatedAt": "2026-07-01T15:49:31Z",
  "data": { /* type-specific; e.g. { productId, optionId, localDate } */ }
}
```

> Retry policy and signature/verification are **not specified** in the captured docs (see
> [§12](#12-open-items-to-verify)) — implementers add their own (HMAC + backoff).

---

## 6. Shared sub-schemas

### 6.1 Media

```jsonc
{
  "src": "https://...",                  // permanent URL
  "type": "image/jpeg | image/png | video/mp4 | video/avi | external/youtube | external/vimeo",
  "rel": "LOGO | COVER | GALLERY",
  "title": "string|null",
  "caption": "string|null",
  "copyright": "string|null"
}
```

### 6.2 Feature

```jsonc
{
  "shortDescription": "string|null",
  "type": "FeatureType"
}
```

`FeatureType`: `INCLUSION`, `EXCLUSION`, `HIGHLIGHT`, `PREBOOKING_INFORMATION`,
`PREARRIVAL_INFORMATION`, `REDEMPTION_INSTRUCTION`, `ACCESSIBILITY_INFORMATION`,
`ADDITIONAL_INFORMATION`, `BOOKING_TERM`, `CANCELLATION_TERM`.

> Note: Feature has **no** `id` or free-form `value` field — the text lives in `shortDescription`,
> classified by `type`.

### 6.3 Location / Place / PostalAddress

```jsonc
// Location
{
  "title": "string",
  "shortDescription": "string|null",
  "types": ["START","ITINERARY_ITEM","END"],   // LocationType[]
  "minutesTo": 15,                              // travel time to this location
  "minutesAt": 30,                             // time spent at this location
  "place": { /* Place */ }
}

// Place
{
  "latitude": 12.108,
  "longitude": -68.935,
  "postalAddress": { /* PostalAddress */ },
  "identifiers": { /* google/apple/tripadvisor place ids */ },
  "sameAs": ["https://maps.google.com/..."]
}

// PostalAddress
{
  "streetAddress": "string",
  "addressLocality": "string",                 // city/town
  "addressRegion": "string",
  "postalCode": "string",
  "addressCountry": "string",                  // ISO country
  "postOfficeBoxNumber": "string|null"
}
```

`LocationType`: `START`, `ITINERARY_ITEM`, `POINT_OF_INTEREST`, `ADMISSION_INCLUDED`, `END`,
`REDEMPTION`.

### 6.4 Commentary

```jsonc
{
  "format": "IN_PERSON | RECORDED_AUDIO | WRITTEN | OTHER",
  "language": "en"
}
```

### 6.5 Ticket

The booking-level `voucher` and the per-`unitItem` `ticket` use a **Ticket** object (delivery
artifact: code/QR/PDF/PKPASS, redemption state). The full field list was **not** available in the
captured docs — confirm against the live spec before relying on specific fields. Expected shape
(per delivery formats): a delivery payload (e.g. `deliveryOptions[]` with `deliveryFormat` + `value`),
plus redemption metadata (`redemptionMethod`, `utcRedeemedAt`). See [§12](#12-open-items-to-verify).

### 6.6 BookingCancellation

```jsonc
{
  "refund": "FULL | PARTIAL | NONE",
  "reason": "string|null",
  "utcCancelledAt": "date-time"
}
```

---

## 7. Booking lifecycle

OCTO bookings are **two-step: reserve → confirm.**

```text
POST /bookings/            → ON_HOLD   (holds availability; utcExpiresAt set)
POST /bookings/{uuid}/extend → ON_HOLD (utcExpiresAt pushed out)
POST /bookings/{uuid}/confirm → CONFIRMED
POST /bookings/{uuid}/cancel  → CANCELLED (+ BookingCancellation.refund)
   (hold lapses, no confirm)  → EXPIRED
   (check-in)                 → REDEEMED
```

1. **Create** (`POST /bookings/`): client-generated `uuid`, `productId`, `optionId`, `availabilityId`,
   `unitItems` (each `{ unitId }`), optional `notes`, `expirationMinutes`. Reserves/holds availability;
   returns `ON_HOLD` with `utcExpiresAt`.
2. **Confirm** (`POST /bookings/{uuid}/confirm`): `contact`, `resellerReference`, `unitItems`,
   `emailReceipt`. Must occur before `utcExpiresAt`. `ON_HOLD → CONFIRMED`.
3. **Extend** (`POST /bookings/{uuid}/extend`): pushes out `utcExpiresAt` (subject to supplier limits).
4. **Update** (`PATCH /bookings/{uuid}`): modify unit items / contact / notes pre-travel.
5. **Cancel** (`POST /bookings/{uuid}/cancel`): `reason`, `force`. `→ CANCELLED` + a
   `BookingCancellation` (`refund` = FULL/PARTIAL/NONE).

**Status values:**

| Status | Meaning |
|---|---|
| `ON_HOLD` | Reserved, awaiting confirmation; expires at `utcExpiresAt`. |
| `CONFIRMED` | Confirmed and active. |
| `EXPIRED` | Hold lapsed without confirmation. |
| `CANCELLED` | Terminated (user- or system-initiated). |
| `REDEEMED` | Used/consumed (checked in). |
| `PENDING` | Awaiting processing (intermediate). |
| `REJECTED` | Application declined. |

**Freesale:** when `product.allowFreesale` is true, `availabilityId` is optional and capacity is
effectively unbounded; the booking carries `freesale: true`.

---

## 8. Worked examples

> Concrete shapes for the critical path. Values illustrative; structure follows the schemas above.

### 8.1 Get Product (`GET /products/{id}`, `octo/content, octo/pricing`)

```jsonc
// → 200
{
  "id": "tour_curacao_snorkel",
  "internalName": "Curaçao Snorkel Safari",
  "reference": "CUR-SNK-01",
  "locale": "en",
  "timeZone": "America/Curacao",
  "allowFreesale": false,
  "instantConfirmation": true,
  "instantDelivery": true,
  "availabilityRequired": true,
  "availabilityType": "START_TIME",
  "deliveryFormats": ["PDF_URL","QRCODE"],
  "deliveryMethods": ["VOUCHER"],
  "redemptionMethod": "DIGITAL",
  "defaultCurrency": "USD",
  "availableCurrencies": ["USD","EUR"],
  "pricingPer": "UNIT",
  "title": "Curaçao Snorkel Safari",
  "shortDescription": "Half-day guided snorkel tour to two reefs.",
  "description": "…",
  "durationMinutesFrom": 240, "durationMinutesTo": 240,
  "features": [
    { "type": "HIGHLIGHT", "shortDescription": "Two pristine reef stops" },
    { "type": "INCLUSION", "shortDescription": "Snorkel gear & guide" },
    { "type": "EXCLUSION", "shortDescription": "Gratuities" }
  ],
  "media": [ { "src": "https://cdn/…1.jpg", "type": "image/jpeg", "rel": "COVER" } ],
  "categoryLabels": ["boat-tours","family-friendly"],
  "options": [
    {
      "id": "DEFAULT", "default": true, "internalName": "Standard",
      "availabilityLocalStartTimes": ["09:00","13:00"],
      "cancellationCutoff": "PT48H", "cancellationCutoffAmount": 48, "cancellationCutoffUnit": "hour",
      "requiredContactFields": ["firstName","lastName","emailAddress","phoneNumber"],
      "restrictions": { "minUnits": 1, "maxUnits": 12 },
      "units": [
        {
          "id": "adult", "internalName": "Adult", "type": "ADULT",
          "restrictions": { "minAge": 13, "maxAge": 99, "idRequired": false, "paxCount": 1 },
          "pricingFrom": [ { "original": 7999, "retail": 7999, "net": 6399,
                            "currency": "USD", "currencyPrecision": 2,
                            "includedTaxes": [ { "name": "OB", "retail": 727 } ] } ]
        },
        {
          "id": "child", "internalName": "Child (4-12)", "type": "CHILD",
          "restrictions": { "minAge": 4, "maxAge": 12, "idRequired": false, "paxCount": 1,
                            "accompaniedBy": ["adult"] },
          "pricingFrom": [ { "original": 4999, "retail": 4999, "net": 3999,
                            "currency": "USD", "currencyPrecision": 2, "includedTaxes": [] } ]
        }
      ]
    }
  ]
}
```

### 8.2 Availability Check (`POST /availability/`)

```jsonc
// request
{ "productId": "tour_curacao_snorkel", "optionId": "DEFAULT",
  "localDateStart": "2026-07-01", "localDateEnd": "2026-07-01",
  "units": [ { "id": "adult", "quantity": 2 }, { "id": "child", "quantity": 1 } ],
  "currency": "USD" }

// → 200
[
  { "id": "2026-07-01T09:00-cur-snk", "localDateTimeStart": "2026-07-01T09:00:00-04:00",
    "localDateTimeEnd": "2026-07-01T13:00:00-04:00", "allDay": false,
    "available": true, "status": "AVAILABLE", "vacancies": 6, "capacity": 12, "maxUnits": null,
    "utcCutoffAt": "2026-06-29T13:00:00Z",
    "unitPricing": [
      { "unitId": "adult", "original": 7999, "retail": 7999, "currency": "USD", "currencyPrecision": 2 },
      { "unitId": "child", "original": 4999, "retail": 4999, "currency": "USD", "currencyPrecision": 2 }
    ],
    "pricing": { "original": 20997, "retail": 20997, "currency": "USD", "currencyPrecision": 2 } }
]
```

### 8.3 Create Booking (`POST /bookings/`) — reserve

```jsonc
// request
{ "uuid": "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
  "productId": "tour_curacao_snorkel", "optionId": "DEFAULT",
  "availabilityId": "2026-07-01T09:00-cur-snk",
  "unitItems": [ { "unitId": "adult" }, { "unitId": "adult" }, { "unitId": "child" } ],
  "notes": "Honeymoon tour", "expirationMinutes": 30 }

// → 201
{ "uuid": "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454", "status": "ON_HOLD",
  "utcCreatedAt": "2026-06-20T10:00:00Z", "utcExpiresAt": "2026-06-20T10:30:00Z",
  "productId": "tour_curacao_snorkel", "optionId": "DEFAULT",
  "availabilityId": "2026-07-01T09:00-cur-snk", "freesale": false, "cancellable": true,
  "unitItems": [ { "uuid": "ui-1", "unitId": "adult", "status": "ON_HOLD" },
                 { "uuid": "ui-2", "unitId": "adult", "status": "ON_HOLD" },
                 { "uuid": "ui-3", "unitId": "child", "status": "ON_HOLD" } ],
  "pricing": { "retail": 20997, "currency": "USD", "currencyPrecision": 2 } }
```

### 8.4 Confirm Booking (`POST /bookings/{uuid}/confirm`)

```jsonc
// request
{ "contact": { "firstName": "Ada", "lastName": "Byron",
               "emailAddress": "ada@example.com", "phoneNumber": "+12125550100", "locales": ["en"] },
  "resellerReference": "IT-2026-00042", "emailReceipt": true,
  "unitItems": [ { "uuid": "ui-1" }, { "uuid": "ui-2" }, { "uuid": "ui-3" } ] }

// → 200
{ "uuid": "f8c3de3d-…", "status": "CONFIRMED", "utcConfirmedAt": "2026-06-20T10:05:00Z",
  "resellerReference": "IT-2026-00042", "supplierReference": "SUP-7781",
  "contact": { "firstName": "Ada", "lastName": "Byron", "emailAddress": "ada@example.com" },
  "voucher": { /* Ticket */ },
  "unitItems": [ { "uuid": "ui-1", "status": "CONFIRMED", "ticket": { /* … */ } }, "…" ],
  "pricing": { "retail": 20997, "currency": "USD", "currencyPrecision": 2 } }
```

### 8.5 Cancel (`POST /bookings/{uuid}/cancel`)

```jsonc
// request
{ "reason": "Customer requested", "force": false }

// → 200
{ "uuid": "f8c3de3d-…", "status": "CANCELLED",
  "cancellation": { "refund": "FULL", "reason": "Customer requested",
                    "utcCancelledAt": "2026-06-20T11:00:00Z" } }
```

### 8.6 Extend (`POST /bookings/{uuid}/extend`)

```jsonc
// request
{ "expirationMinutes": 30 }
// → 200  { "uuid": "…", "status": "ON_HOLD", "utcExpiresAt": "2026-06-20T11:30:00Z" }
```

---

## 9. Error structure & codes

OCTO returns a **flat error object** (not the NestJS `{statusCode,timestamp,path,message}` shape):

```jsonc
{
  "error": "INVALID_PRODUCT_ID",
  "errorMessage": "The productId is invalid.",
  // optional context fields:
  "productId": "...", "optionId": "...", "unitId": "...", "availabilityId": "..."
}
```

| Code | HTTP | When |
|---|---|---|
| `INVALID_PRODUCT_ID` | 400 | Unknown/invalid `productId`. |
| `INVALID_OPTION_ID` | 400 | Unknown/invalid `optionId`. |
| `INVALID_UNIT_ID` | 400 | Unknown/invalid `unitId`. |
| `INVALID_AVAILABILITY_ID` | 400 | Unknown/invalid `availabilityId`. |
| `INVALID_BOOKING_UUID` | 400 | Unknown/invalid booking `uuid`. |
| `BAD_REQUEST` | 400 | Malformed request / validation failure. |
| `UNPROCESSABLE_ENTITY` | 422 | Semantically invalid (sold out, restriction violated, bad date range). |
| `UNAUTHORIZED` | 401 | Missing/invalid bearer token. |
| `FORBIDDEN` | 403 | Authenticated but not permitted. |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error. |

---

## 10. Capabilities catalog

| Capability ID | Status | Adds |
|---|---|---|
| `octo/content` | stable | Customer content: `title`, descriptions, `features` (highlights/inclusions/exclusions/terms/accessibility), `faqs`, `media`, `locations`/itinerary, `commentary`, `categoryLabels`, durations. Localized via `Accept-Language`/`Content-Language`/`Available-Languages`. |
| `octo/pricing` | stable (Feb 2024) | All money fields: `pricing`/`pricingFrom`/`unitPricing`/`unitPricingFrom`, currency + precision, `includedTaxes`; `pricingPer`, `defaultCurrency`, `availableCurrencies`. |
| `octo/pickups` | stable | `pickupAvailable`/`pickupRequired`/`pickupLocations`/`pickupAreas` on options; pickup selection on availability + booking; `GET /bookings/{uuid}/pickupLocations`. |
| `octo/dropoffs` | stable | Dropoff mirror of pickups. |
| `octo/promotions` | in development | Promotional pricing on availability + bookings. |
| `octo/notifications` | stable | Webhook subscriptions (`/notifications/subscriptions` CRUD) + push events `PRODUCT_UPDATE` / `AVAILABILITY_UPDATE` / `BOOKING_UPDATE`. See §5.4. |

> Header examples mention `octo/offers`, but it is **not** a documented capability — treat as
> non-standard. `octo/cart`, `octo/adjustments`, `octo/extras`, `octo/questions`, `octo/packages`,
> `octo/maps`, `octo/resources` were **not** confirmed in the captured docs.

---

## 11. Enum appendix

| Enum | Values |
|---|---|
| `AvailabilityType` | `START_TIME`, `OPENING_HOURS` |
| `AvailabilityStatus` | `AVAILABLE`, `FREESALE`, `SOLD_OUT`, `LIMITED`, `CLOSED` |
| `BookingStatus` | `ON_HOLD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`, `REDEEMED`, `PENDING`, `REJECTED` |
| `DeliveryFormat` | `PDF_URL`, `QRCODE`, `CODE128`, `PKPASS_URL` |
| `DeliveryMethod` | `VOUCHER`, `TICKET` |
| `RedemptionMethod` | `DIGITAL`, `PRINT`, `MANIFEST` |
| `PricingPer` | `UNIT`, `BOOKING` |
| `UnitType` | `ADULT`, `YOUTH`, `CHILD`, `INFANT`, `FAMILY`, `SENIOR`, `STUDENT`, `MILITARY`, `OTHER` |
| `ContactField` | `firstName`, `lastName`, `fullName`, `emailAddress`, `phoneNumber`, `postalCode`, `country`, `notes`, `locales`, `allowMarketing` |
| `FeatureType` | `INCLUSION`, `EXCLUSION`, `HIGHLIGHT`, `PREBOOKING_INFORMATION`, `PREARRIVAL_INFORMATION`, `REDEMPTION_INSTRUCTION`, `ACCESSIBILITY_INFORMATION`, `ADDITIONAL_INFORMATION`, `BOOKING_TERM`, `CANCELLATION_TERM` |
| `LocationType` | `START`, `ITINERARY_ITEM`, `POINT_OF_INTEREST`, `ADMISSION_INCLUDED`, `END`, `REDEMPTION` |
| `CommentaryFormat` | `IN_PERSON`, `RECORDED_AUDIO`, `WRITTEN`, `OTHER` |
| `MediaType` | `image/jpeg`, `image/png`, `video/mp4`, `video/avi`, `external/youtube`, `external/vimeo` |
| `MediaRel` | `LOGO`, `COVER`, `GALLERY` |
| `CancellationRefund` | `FULL`, `PARTIAL`, `NONE` |
| `CategoryLabel` | `multi-day`, `city-cards`, `adults-only`, `animals`, `audio-guide`, `beaches`, `bike-tours`, `boat-tours`, `classes`, `day-tours`, `family-friendly`, `fast-track`, `food`, `guided-tours`, `history`, `hop-on-hop-off`, `literature`, `live-music`, `museums`, `nightlife`, `outdoors`, `private-tours`, `romantic`, `recurring-events`, `self-guided`, `small-group-tours`, `sports`, `theme-parks`, `walking-tours`, `wheelchair-accessible`, `accommodation-included`, `tour-difficulty-easy`, `tour-difficulty-medium`, `tour-difficulty-hard` |

---

## 12. Open items to verify

Re-check these against <https://docs.octo.travel/> / the OpenAPI definition before building:

- **`Octo-Env`** header (`live`/`test`) — appears in examples but not formally documented. The
  `testMode` flag exists on the booking; some suppliers use separate test tokens.
- **Update Booking** (`PATCH /bookings/{uuid}`) and **Get Booking List** (`GET /bookings/`) exact
  paths and the full set of list query parameters.
- **Ticket** schema — full fields (delivery payloads, redemption metadata) were not captured.
- Whether `octo/offers`, `octo/cart`, `octo/adjustments`, `octo/extras`, `octo/questions`,
  `octo/packages`, `octo/maps`, `octo/resources` exist as standardized capabilities.
- GeoJSON `geometry` structure on `Place` (not documented in captured content).
- Whether `contact` may be supplied at **create** as well as **confirm** (supplier-dependent).
- The `pickupAreas` schema (service-area definitions) — referenced but not fully expanded.
- **Notifications** webhook **retry policy** and **signature/verification** — not specified; also the
  exact `data` payload per `notificationType` and whether a delivery-history endpoint exists.
- Notification subscriptions path spelling (`/notifications/subscriptions`; one doc table showed a
  `subcriptions` typo) — confirm the canonical path.

**Source:** <https://docs.octo.travel/> (welcome, endpoints & capabilities, products, availability,
bookings, pricing, content, pickups/dropoffs pages), captured June 2026 via the docs `?ask=` query
interface and the OpenAPI references therein.
