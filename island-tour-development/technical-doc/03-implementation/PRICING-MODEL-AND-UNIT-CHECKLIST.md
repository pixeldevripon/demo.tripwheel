# Pricing model + unit type + booking type - implementation checklist

> Goal: make `pricing_model` (per_person / unit), `unit_type` (group/boat/vehicle/aircraft/package),
> and `booking_type` (private / shared) behave correctly and consistently across backend, dashboard,
> and the public booking card/checkout - with age bands handled per model.
>
> Canonical source: master v1.9 (`technical-doc/island-tours-platform-master.html`). Where the master
> is silent, the engineer decision is recorded in Part 0 and flagged `[EXT]` (extension beyond master).
> Legend: `[x]` done - `[~]` partial - `[ ]` to build - `[EXT]` extension beyond the master.

---

## 0. Canonical facts + decisions (read first)

### What the master actually says
- `pricing_model` enum `per_person` / `unit`; supersedes `price_type` (E.3, L8083-8091; L11667). **No default declared.**
- `unit_type` enum nullable, only when `unit`: group / boat / vehicle / aircraft / package (E.3 L8092-8099; L11669-11672). **Only `group` has any display rule** ("from $270 per group"); boat/vehicle/aircraft/package have NO per-type behavior in the master.
- Prices: `price_adult/child/infant` decimal; "from = lowest applicable" (E.3 L8100-8110). **There is NO unit pricing formula, no included-guest count, no extra-person surcharge anywhere in the master.**
- Card price label: two formats only - per person `from $36` (no suffix); per group `from $270 per group` (full label, muted) (S3.5 L2408-2411; L10150-10155).
- Tour-detail widget anchor: only `From $X per person` is specified (S3.1 L12405, L12422-12431); **no unit/group/charter widget anchor is defined** ("person-based, not group-based", L12515-12518).
- `age_bands[]` nullable; when present -> widget **Pattern B**; else **Pattern A**; "all bands count toward capacity" (E.3 L8112-8119; S3.3 L12717-12739; 6.1 L4751-4758). **No statement about age bands on unit tours.**
- **Spectators are add-ons, NOT age bands** - spectator pricing lives in `add_ons[]` (E.3 L8121-8127; L4757-4758; L12452-12453). Whether spectators count toward capacity: unspecified.
- `booking_type` private / shared. **Only rule:** "unit-priced private charters: one booking takes the whole departure" (E.3 L8204-8217). SHARED capacity + per-person PRIVATE behavior: unspecified. **`booking_type` was DROPPED as a filter (no-op)** (L2774, L2976-2977, L10162-10185).
- Capacity/departures (E.9 L9095-9177): capacity per departure; all party bands count toward capacity; atomic claim; `remaining` exposed only under 5; `status` open/closed/sold_out/cancelled; `capacity_override` null => `tour.max_party_size`.
- `min_party_size` default 1 (some require 4+); `max_party_size` capacity ceiling (E.3 L8130-8139; L11674-11679).

### Decisions (confirm before building Part A-C)
- **D1 [EXT] UNIT pricing model - CONFIRMED (founder 2026-07-15).** The master's unit model is a flat "per group" price. The platform ADOPTS the richer engineer model (guide §9) as canonical: `unitTotal = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`. `unitIncludedGuests` defaults to `maxPartySize` and `extraPersonPrice` to 0 => degrades to a pure flat unit price (master-compatible). Already built in card/checkout.
- **D2 [EXT] unit_type-aware copy - CONFIRMED (founder 2026-07-15).** Enhance beyond the master's "per group": per-unit_type wording + icon (boat/vehicle/aircraft/package/group) on the card + checkout.
- **D3 booking_type is NOT a filter** (master no-op). Do not add a filter facet. Use `bookingType` only for the unit+private exclusivity rule and an optional "Private charter" badge (copy only).
- **D4 UNIT tours have NO age bands** (locked earlier). Single "guests" counter (Pattern A). Backend rejects age bands on unit tours; dashboard hides the age-band manager for unit tours.
- **D5 UNIT + PRIVATE = whole departure** (master-canonical). One booking consumes the entire departure (exclusive sell-out).
- **D6 [defer] Spectators-as-add-ons.** Master puts spectators in `add_ons[]`; code models them as SPECTATOR age bands. Out of scope here; tracked separately.

---

## 1. Backend (`backend/`)

### 1.1 Validation + invariants
- `[ ]` **Cross-field validation on tour create/update** (`src/tours/tours.service.ts:1638-1704` create, `1841-1963` update; DTO `src/tours/dto/tour.dto.ts:874-911`/`1161-1198`): `UNIT` requires `basePrice` + `wholeUnitType` (+ default `unitIncludedGuests=maxPartySize`, `extraPersonPrice=0`); `PER_PERSON` must NOT carry unit fields. Reject the invalid combos. Gap: today all fields are independently optional, no cross-check.
- `[ ]` **Reject age bands on UNIT tours** (`src/tours/tours-children.service.ts:376-418` add, `420-481` update): guard on `tour.pricingModel === 'UNIT'` -> 400. Gap: no pricingModel guard today.
- `[ ]` **Publish gate per model** (`tours.service.ts:2087-2091`): `PER_PERSON` requires >=1 participant band; `UNIT` requires `basePrice` (+ `wholeUnitType`). Gap: current gate is `basePrice OR bands`, so a mis-modeled tour can publish.

### 1.2 Pricing display source
- `[ ]` **`recomputePriceFrom` UNIT branch** (`tours.service.ts:373-396`): `UNIT -> priceFrom = basePrice` unconditionally; `PER_PERSON -> cheapest participant band ?? basePrice`. Gap: per-person logic applied to unit today (works only via the seed hack).
- `[ ]` **Price min/max FILTER uses `priceFrom`** not `basePrice` (`tours.service.ts:679-683`). Gap: filter disagrees with the displayed "From" price. (Sort already uses priceFrom, L819-843 - correct.)

### 1.3 Booking engine (guide §9 gap - the big one)
- `[ ]` **UNIT quote/reserve formula** (`src/bookings/booking-pricing.util.ts:85-116`, `src/bookings/bookings.service.ts` `loadContext` 822-887): branch on `pricingModel`; implement `basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`. `loadContext` must select `pricingModel, basePrice, unitIncludedGuests, extraPersonPrice, bookingType`. Gap: today total = sum(ageBand.price*qty) only; unit fields never read.
- `[ ]` **Reserve DTO supports a unit booking** (`src/bookings/dto/booking.dto.ts:151-170,243`): allow a guests-count reserve with no `ageBandId` for UNIT tours (current `ReserveItemDto` requires ageBandId + ArrayMinSize(1)). Gap: a unit tour can only be booked via the fake seed band today.
- `[ ]` **[D5] UNIT+PRIVATE exclusivity** (`bookings.service.ts:168-187` reserve claim, `releaseSeats` 948-958): a private-unit booking consumes the WHOLE departure (set booked_count = capacity / mark sold_out atomically), and release frees the whole departure. Gap: consumption is always pax count; a "private" charter can be double-booked today.

### 1.4 Availability
- `[ ]` **[D5] Exclusive sold-out in status util** (`src/availability/availability-status.util.ts:19-53,95-113`): a departure with a private-unit booking reads SOLD_OUT regardless of leftover seats. Decide representation: derive from `bookedCount>=capacity` after the reserve sets it full (simplest, no schema change) vs an explicit `exclusive`/`unitsBooked` flag on Departure. Gap: sold-out is pax-fill only.
- `[ ]` **Materializer note** (`src/availability/availability-materializer.service.ts:58,143,169`): capacity for a private-unit departure still = `maxPartySize` (the guest ceiling) - that's fine if 1.3/1.4 enforce exclusivity at booking time. No materializer change needed if we use the "reserve fills capacity" approach; revisit only if we add an explicit flag.

### 1.5 Seed
- `[ ]` **Remove the UNIT fake-age-band hack** (`prisma/demo/tours.ts:1919-1932` `buildAgeBands`): UNIT tours seed with NO age bands. Ensure `priceFrom` seed uses `basePrice` for UNIT (`2417-2427`).
- `[ ]` **Fix inconsistent unit tour** (`prisma/demo/tours.ts:1895-1898`): UNIT/BOAT/PRIVATE with no `unitIncludedGuests`/`extraPersonPrice` - set them (or rely on defaults from 1.1).

---

## 2. Dashboard (`frontend/components/dashboard/trips/`)

### 2.0 Relocate ALL pricing fields into the Pricing tab (founder 2026-07-15)
The Pricing tab becomes the single home for "how this tour is priced"; the Details tab keeps only operational/logistics/audience/policy fields. This also puts the pricing-model gating (age bands vs unit fields) in ONE place.

- `[ ]` **Move these fields from the Details tab (`trip-details-tab.tsx`) to the Pricing tab (`trip-pricing-tab.tsx`):** `pricingModel` (596-610), `defaultCurrency` (the currency select shown for PER_PERSON, ~613-654), `basePrice` (667+), `wholeUnitType` (613-654), `unitIncludedGuests` + `extraPersonPrice` (691-716). Remove them from the Details schema/defaults/payload (211-265, 327-331, 443-453) and add them to the Pricing tab's form. Age bands already live in the Pricing tab.
- `[ ]` **Pass `pricingModel` (and the tour) into `TripPricingTab`** (`trip-edit-view.tsx:364` currently passes only `tripId`) so the tab can render pricing-model-aware.
- `[ ]` **Pricing tab layout, pricing-model-aware (one place):**
  - Top: `pricingModel` select + `defaultCurrency`.
  - `PER_PERSON` -> **age-band manager** (existing) + `basePrice` as the "from" fallback; NO unit fields.
  - `UNIT` -> `basePrice` + `wholeUnitType` + `unitIncludedGuests` + `extraPersonPrice`; **age-band manager HIDDEN** (satisfies [D4]). Note: "Unit-priced tours use a single guests count."
- `[ ]` **[D4]** The above hides the age-band manager for UNIT (was `trip-pricing-tab.tsx:597-651` always rendered). Gap today: priced age bands can be added to a UNIT tour.
- `[ ]` Keep in the **Details tab** (NOT pricing): duration, pickup model/required, min/max party size, booking cutoff, meeting point, min age, fitness, weather/wheelchair/family/beginners, cancellation window, payment model, deposit %, `bookingType`. (Payment model / deposit % / cancellation are commercial/policy, not price inputs - leave them; revisit only if a dedicated Payments tab is wanted.)

### 2.1 Validation + create form
- `[ ]` **UNIT validation** (Pricing tab form after 2.0; `trip-form.tsx` create schema 41-81): `superRefine` so UNIT requires `basePrice` + `wholeUnitType`; PER_PERSON requires >=1 participant band (or basePrice fallback). Gap: unit tour saves with empty unit fields today.
- `[ ]` **Create form pricing (`trip-form.tsx`) stays a single form** but must collect `unitIncludedGuests` + `extraPersonPrice` when `pricingModel==='UNIT'` so a unit tour is bookable at creation (or create a draft and finish pricing in the Pricing tab). Gap: create never collects them today.
- `[ ]` **[D3]** Do NOT add a booking_type or pricing_model filter facet (master no-op). (No work; recorded so it isn't "fixed" by mistake.)

---

## 3. Booking card + checkout (`frontend/components/frontend/`)

- `[x]` UNIT pricing formula in card + checkout (`lib/tours/booking.ts:249-308`, `lib/stores/booking-store.ts:210-235`, `lib/checkout/checkout.ts:133-155`) - matches D1.
- `[ ]` **[D2] unit_type-aware copy + icon map** (`booking.ts` carries `wholeUnitType:308` but it is dead data): headline noun, counter label, breakdown label, icon per unit_type. Consume in `price-header.tsx:40`, `party-selector.tsx:40`, `booking-store.ts:222`, and checkout `buildPartyLabel` (`checkout.ts:178-188`). Gap: BOAT/VEHICLE/AIRCRAFT/PACKAGE all render generic "Guests / per group" today.
- `[ ]` **[D2] Show the unit_type price unit CONSISTENTLY on ALL tour CARDS** (founder 2026-07-15). There are 3 price-bearing card variants and they are inconsistent today:
  - `tour-card.tsx` (main; All Tours / category / collection) - binary `priceUnit: 'per' | 'perGroup'` (`lib/tours/listing.ts:123,151`; rendered `tour-card.tsx:133,292` via `dict.per`/`dict.perGroup`).
  - `hub-tour-card.tsx` (hub listing) - free-form `priceUnit: string` + optional `priceNote`, built by `hub-page.tsx cardPrice()` (170-192). Already has UNIT logic ("N people included" + "+$X per extra") but uses a generic "people" noun and **ignores `wholeUnitType`**.
  - `hub-pick-card.tsx` (hub "Our Picks") - shows `from $X` with **NO unit label at all** (129-132).
  - (`hub-discover-card.tsx`, `collection-card.tsx`, `tour-card-carousel.tsx` show no per-tour price - skip.)
  - **Fix:** add ONE shared helper `lib/tours/pricing-label.ts` -> `priceUnitLabel({ pricingModel, wholeUnitType, unitIncludedGuests, extraPersonPrice }, labels)` returning `{ unit, note? }`: PER_PERSON -> "/per person"; UNIT -> unit noun from `wholeUnitType` ("/per boat|vehicle|group|aircraft|package", + "N included" / "+$X per extra" note). Consume it in `listing.ts` (main card), `hub-page.tsx cardPrice()` (hub card), and `hub-pick-card` (add the unit). Keep the detail widget + checkout (items above) on the same helper/label source so all surfaces match.
  - **Data:** the list card payload + search hit + hub hit must return `wholeUnitType` (they already return `pricingModel`; hub already returns `unitIncludedGuests`/`extraPersonPrice`). Add `wholeUnitType` to the card DTO/select + `TourCard` type (`tour-card.tsx:33,63-64`) and hub types.
  - **Copy:** per-unit_type keys (`perBoat`/`perVehicle`/`perGroup`/`perAircraft`/`perPackage`) + "included"/"per extra" notes, 7 locales; PER_PERSON stays `dict.per`.
  - Update the hardcoded `priceUnit` sources too (`category-page.tsx:61-126`, `collection-page.tsx:121`) to route through the helper.
- `[ ]` **[D2] UNIT widget price anchor** (`price-header.tsx`): "From $X per {unit noun}" (enhancement; master only defines per-person + card "per group").
- `[ ]` **[D3] Optional "Private charter" badge** (copy only) on the card when `bookingType==='PRIVATE'` + UNIT ("You get the whole {boat}"). Not a filter.
- `[ ]` **i18n**: new unit_type copy keys across all 7 locales.
- `[x]` Types already carry pricingModel/wholeUnitType/unit fields/bookingType (`types/trip.ts`, `types/tour-detail.ts`).

---

## 4. Tests + docs
- `[ ]` Backend unit tests: cross-field validation, age-band-on-unit rejection, `recomputePriceFrom` UNIT branch, UNIT quote formula, UNIT+PRIVATE exclusivity claim/release, priceFrom price filter.
- `[ ]` Update `BOOKING-WIDGET-CHECKLIST.md` §3.2/§3.4 and `BOOKING-FLOW-DESIGN-GUIDE.md` §9 cross-refs; update `MASTER-CHECKLIST.md`.
- `[ ]` Reseed after 1.5 so the DB reflects the no-age-band unit model.

---

## Suggested execution order
1. **Part 1.1-1.2 + Part 2** (validation, invariants, priceFrom, dashboard gating) - self-contained, makes the tour/UNIT model correct end to end without touching the booking engine.
2. **Part 3** (unit_type copy map, anchor, badge, i18n) - isolated frontend polish.
3. **Part 1.3-1.4** (UNIT quote/reserve + exclusivity) - the booking-engine work; do with the pending Step 5/6 (server quote + real submission) from `BOOKING-WIDGET-CHECKLIST.md`.
4. **Part 1.5 + Part 4** (seed + tests + docs) - alongside each phase.
