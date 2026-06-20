# OCTO frontend alignment

> **Purpose.** The companion to keep updated as the backend moves to OCTO. It lists exactly what the
> **Next.js frontend** must change to consume the OCTO-shaped API — types, API clients, the booking
> widget/checkout flow, money handling, and error handling. Update this in lockstep with the backend
> ([`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md) /
> [`OCTO-AVAILABILITY-AND-BOOKING.md`](./OCTO-AVAILABILITY-AND-BOOKING.md)). Spec details:
> [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md).
>
> **Legend:** `- [ ]` to do · `- [x]` done · `⚠️` depends on a backend decision (see migration §9).

---

## 0. What changes for the frontend (summary)

| Area | Before | After (OCTO) |
|---|---|---|
| Tour detail data | `GET /tours/slug/:slug` (native shape) | `GET /tours/{id}` (Tour → Option → Unit) with `Octo-Capabilities` |
| Availability | `GET /tours/:id/schedules` (flat list) | `POST /availability` + `POST /availability/calendar` |
| Booking | none (no API) | reserve → confirm two-step (`POST /bookings`, `/confirm`, `/cancel`, `/extend`) |
| Money | decimals from API | **integer minor units** + `currencyPrecision` → convert in a helper |
| Pax selection | age bands | **units** (with restrictions: min/max age, counts, accompaniedBy) |
| Errors | `{statusCode,message}` | `{ error, errorMessage, <contextId> }` |
| Capabilities | n/a | send `Octo-Capabilities: octo/content, octo/pricing` (+ pickups when used) |

> The native **discovery** surface (homepage, destination, category, hub, collection, search,
> filters, slug routing) stays on `/api/v1` and **does not change**. Only the **tour detail data,
> availability, and the booking/checkout flow** move to OCTO.

---

## 1. Types (`types/octo.ts`)

- [ ] Add OCTO TypeScript types mirroring the spec: `OctoTour`, `OctoOption`, `OctoUnit`,
  `OctoUnitRestrictions`, `OctoAvailability`, `OctoAvailabilityCalendar`, `OctoBooking`,
  `OctoUnitItem`, `OctoContact`, `OctoPricing`, `OctoTax`, `OctoFeature`, `OctoMedia`,
  `OctoLocation`, `OctoBookingCancellation`.
- [ ] Status unions: `OctoBookingStatus` (`ON_HOLD|CONFIRMED|EXPIRED|CANCELLED|REDEEMED|PENDING|REJECTED`),
  `OctoAvailabilityStatus` (`AVAILABLE|FREESALE|SOLD_OUT|LIMITED|CLOSED`).
- [ ] Mark capability-gated fields optional (content/pricing) so core responses typecheck.

---

## 2. API client (`lib/api/octo.ts`)

- [ ] New client hitting the OCTO base (⚠️ `/api/octo/v1` per migration D0).
- [ ] Always send `Octo-Capabilities` (default `octo/content, octo/pricing`); pass auth per D1
  (cookie `credentials: 'include'` for v1, or bearer when introduced).
- [ ] Methods: `getTour(id)`, `getTours(params)`, `checkAvailability(body)`,
  `getAvailabilityCalendar(body)`, `createBooking(body)`, `confirmBooking(uuid, body)`,
  `cancelBooking(uuid, body)`, `extendBooking(uuid, body)`, `getBooking(uuid)`.
- [ ] **Error parsing**: read `{ error, errorMessage }` (not `{ message }`); surface `errorMessage`
  and branch on `error` codes (`UNPROCESSABLE_ENTITY` → "sold out / try another slot",
  `INVALID_BOOKING_UUID` → "session expired", etc.).
- [ ] Generate the booking `uuid` client-side (e.g. `crypto.randomUUID()`) and reuse it across
  retries (idempotency).

---

## 3. Money helper (`lib/money.ts`)

- [ ] `formatPrice(pricing: OctoPricing, locale)` → `retail / 10^currencyPrecision`, formatted with
  `Intl.NumberFormat` for the currency.
- [ ] Never do float math on minor units beyond the single divide-at-display.
- [ ] Currency selection: respect the locale default (EN/ZH → USD, others → EUR) + footer selector;
  pass `currency` into availability/booking requests.

---

## 4. Tour detail page (Tour)

- [ ] Switch the tour detail fetch to `GET /tours/{id}` (resolve slug → tour id; ⚠️ confirm how
  the frontend maps our flat slug URL to the OCTO tour id — likely a resolver on the backend).
- [ ] Render content from `octo/content`: `features[]` split by `type`
  (HIGHLIGHT / INCLUSION / EXCLUSION / ACCESSIBILITY_INFORMATION / terms), `media[]`, `faqs[]`,
  `locations[]` (itinerary/map), `durationMinutesFrom/To`.
- [ ] Localize via `Accept-Language` (next-intl locale) → backend returns `Content-Language`.
- [ ] Keep SEO/JSON-LD mapping (Tour/Offer) sourced from the OCTO tour fields.

---

## 5. Booking widget (the big change: reserve → confirm)

- [ ] **Unit selector** from `option.units` honoring `restrictions` (min/max age labels, min/max
  quantity, `accompaniedBy` — e.g. a CHILD requires an ADULT), and `option.restrictions.min/maxUnits`.
- [ ] **Date/slot selector** from `POST /availability/calendar` (month) → `POST /availability` (slots
  for a day), showing `status` (LIMITED → "Only N left" from `vacancies`; SOLD_OUT disabled).
- [ ] **Live price** from availability `unitPricing`/`pricing` as units change.
- [ ] **Step 1 — Reserve:** on "Book", call `POST /bookings` with the client `uuid`, `availabilityId`,
  `unitItems`, `expirationMinutes`. Store the returned `uuid` + `utcExpiresAt`.
- [ ] **Hold timer:** show a countdown to `utcExpiresAt`; offer "extend" (`POST /bookings/{uuid}/extend`)
  or handle expiry gracefully (re-check availability, re-reserve).
- [ ] **Step 2 — Confirm:** collect `contact` (fields required by `option.requiredContactFields` +
  per-unit `unit.requiredContactFields`), run payment, then `POST /bookings/{uuid}/confirm`.
- [ ] Add-ons: keep **unchecked by default** (EU Digital Fairness Act); send as native booking extras
  (⚠️ add-ons are not OCTO units — see migration D3).
- [ ] Pickups (if/when `octo/pickups`): pickup-location selector → `pickupLocationId`/`pickupRequested`.

---

## 6. Checkout & payment

- [ ] Drive payment from the confirm step per payment model; handle the OCTO `PENDING` intermediate
  (⚠️ migration D7) while Stripe settles, then show success on `CONFIRMED`.
- [ ] On confirm success, route to the **Thank You page** (`/{destination}/thank-you/{public_ref}` —
  ⚠️ map `public_ref` ↔ OCTO `uuid`/`resellerReference`, migration D6); fire `booking_complete`
  tracking (conversion value = commission EUR, server-provided).
- [ ] Cancellation UI (if exposed) → `POST /bookings/{uuid}/cancel`, show refund outcome
  (FULL/PARTIAL/NONE) from `cancellation.refund`.

---

## 6A. Per-tour reviews (native `/api/v1`, not OCTO)

> Reviews are served by the native API, not the OCTO surface. Render them on the tour detail page and
> let post-trip users submit one. Backend: migration §5F; schema: design §7.

- [ ] **Display on tour page**: `GET /api/v1/tours/{id}/reviews` (approved only, paginated, sortable:
  newest / highest / most-helpful); show rating, sub-scores, reviewer initial + country, travel
  month/year, photos, operator response, "verified booking" badge, helpful count.
- [ ] **Rating summary** honoring **LD11 cold-start** (backend gates it): if the tour returns no
  own-rating, render the operator fallback or no rating — never a fabricated one.
- [ ] **Localized text** via `Accept-Language` (next-intl) → EN fallback.
- [ ] **Submit a review** (post-trip, booking-gated): form for users with a completed booking →
  `POST /api/v1/tours/{id}/reviews`; show "pending moderation" after submit.
- [ ] **Operator dashboard**: respond to reviews on own tours (`POST /api/v1/reviews/{id}/response`).
- [ ] **Admin dashboard**: moderation queue (approve/reject) gated by `APPROVE_REVIEW`.
- [ ] **SEO**: emit `Review` + `AggregateRating` JSON-LD on the tour page from this data.

---

## 7. Error & edge-case handling

- [ ] Map OCTO error codes to user-facing messages (sold out, expired hold, invalid slot, validation).
- [ ] Handle **hold expiry** mid-checkout: prompt to re-reserve; never silently lose the seat.
- [ ] Handle **race loss** (`UNPROCESSABLE_ENTITY` on reserve): refresh availability, ask to pick again.

---

## 8. Dashboard (operator/admin) — availability authoring

- [ ] Operator availability management UI writes `availability_schedules` / `availability_exceptions`
  (native admin API), **not** the OCTO read endpoints.
- [ ] Show live `departures` (capacity vs vacancies, status) for the operator's tours.
- [ ] Booking management list/detail consuming `GET /bookings` (scoped to the operator).

---

## 9. Sequencing (frontend follows backend)

```text
backend: conventions + GET /tours        → frontend: types + octo client + tour detail render
backend: POST /availability(+calendar)       → frontend: date/slot selector + live pricing
backend: POST /bookings reserve→confirm       → frontend: booking widget two-step + hold timer
backend: payments on confirm + tracking       → frontend: checkout + Thank You + booking_complete
backend: webhooks / pickups / iCal            → frontend: pickups UI (if needed); rest is backend-only
```

> Keep this file current: when a backend OCTO endpoint lands, flip the matching frontend item and note
> any shape surprises here so the booking flow stays smooth.
