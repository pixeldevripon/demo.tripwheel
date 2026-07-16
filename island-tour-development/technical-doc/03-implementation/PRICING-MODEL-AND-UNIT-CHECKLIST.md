# Pricing model + unit type + booking type - implementation checklist

> Goal: make `pricing_model` (per_person / unit), `unit_type` (group/boat/vehicle/aircraft/package),
> and `booking_type` (private / shared) behave correctly and consistently across backend, dashboard,
> and the public booking card/checkout - with age bands handled per model.
>
> Canonical source: master v1.9 (`technical-doc/island-tours-platform-master.html`). Where the master
> is silent, the engineer decision is recorded in Part 0 and flagged `[EXT]` (extension beyond master).
> Legend: [x] done - [~] partial - [ ] to build - `[EXT]` extension beyond the master.

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

- **D1a [EXT] Surcharge ONLY for GROUP - CONFIRMED (founder 2026-07-15).** The included-guests + extra-person surcharge applies ONLY when `unit_type = GROUP`. Boat/vehicle/aircraft/package charters are a FLAT whole-unit price (no surcharge fields). Enforced: backend create/update null `unitIncludedGuests`/`extraPersonPrice` unless GROUP; dashboard Pricing tab shows those fields only for GROUP; `buildTourBookingData` zeroes them unless GROUP (robust vs stale data); seed builder forces GROUP for any UNIT blueprint that declares surcharge fields. +2 backend tests.
- **D1 [EXT] UNIT pricing model - CONFIRMED (founder 2026-07-15).** The master's unit model is a flat "per group" price. The platform ADOPTS the richer engineer model (guide §9) as canonical: `unitTotal = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`. `unitIncludedGuests` defaults to `maxPartySize` and `extraPersonPrice` to 0 => degrades to a pure flat unit price (master-compatible). Already built in card/checkout.
- **D2 [EXT] unit_type-aware copy - CONFIRMED (founder 2026-07-15).** Enhance beyond the master's "per group": per-unit_type wording + icon (boat/vehicle/aircraft/package/group) on the card + checkout.
- **D3 booking_type is NOT a filter** (master no-op). Do not add a filter facet. Use `bookingType` only for the unit+private exclusivity rule and an optional "Private charter" badge (copy only).
- **D4 UNIT tours have NO age bands** (locked earlier). Single "guests" counter (Pattern A). Backend rejects age bands on unit tours; dashboard hides the age-band manager for unit tours.
- **D5 UNIT + PRIVATE = whole departure** (master-canonical). One booking consumes the entire departure (exclusive sell-out).
- **D6 [defer] Spectators-as-add-ons.** Master puts spectators in `add_ons[]`; code models them as SPECTATOR age bands. Out of scope here; tracked separately.

---

## 1. Backend (`backend/`)

### 1.1 Validation + invariants

- [x] **Create/update null out the opposite model's fields** (`tours.service.ts` create ~1655, update ~1866): `PER_PERSON` forces `wholeUnitType`/`unitIncludedGuests`/`extraPersonPrice` to null; `UNIT` applies them. (Full "UNIT requires basePrice+wholeUnitType" is enforced at PUBLISH - draft-friendly.)
- [x] **Reject age bands on UNIT tours** (`tours-children.service.ts` `addAgeBand` -> new `assertNotUnitPriced`): 400 "Unit-priced tours use a single guests count...".
- [x] **Publish gate per model** (`tours.service.ts` publish ~2096): `UNIT` requires `basePrice` + `wholeUnitType`; `PER_PERSON` requires >=1 age band OR basePrice.

### 1.2 Pricing display source

- [x] **`recomputePriceFrom` UNIT branch** (`tours.service.ts:373`): `UNIT -> priceFrom = basePrice`; `PER_PERSON -> DEFAULT participant band ?? cheapest participant band ?? basePrice`. Also recomputed on update when `pricingModel` changes.
  > 2026-07-16 founder rule: the "From $X per person" anchor is the DEFAULT band (adult reference
  > price), NOT the cheapest child/senior band (was showing "From EUR41" child price while Adult=EUR69).
  > Changed in `recomputePriceFrom` (orderBy `isDefault DESC, price ASC`), demo seed mirror, dashboard
  > Pricing-tab copy, spec; existing rows backfilled by migration
  > `20260716165001_reanchor_price_from_on_default_band`. Master line "from price on cards is the
  > lowest applicable" (field table, `price_adult` row) is SUPERSEDED by this founder decision -
  > master doc needs a wording update.
- [x] **Price min/max FILTER uses `priceFrom`** not `basePrice` (`tours.service.ts` findAll ~685).

### 1.3 Booking engine (guide §9 gap - the big one) - DONE (2026-07-16)

- [x] **UNIT quote/reserve formula** (`src/bookings/booking-pricing.util.ts` `computeUnitLines`; `bookings.service.ts` `loadContext`): `computeBookingPricing` now takes `unit?: UnitPricingInput` and branches on it -> `unitTotal = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`, surcharge only when GROUP fields are non-null (D1a); flat unit types reduce to `basePrice`. `loadContext` selects `pricingModel, wholeUnitType, basePrice, unitIncludedGuests, extraPersonPrice, bookingType` and, for UNIT, builds the unit input from a `guests` count (rejects age-band items; requires guests + basePrice). `pax = guests`; one null-band unit item per guest (whole retail on the first for manifest + item-sum consistency).
- [x] **Reserve DTO supports a unit booking** (`src/bookings/dto/booking.dto.ts`): `items` is now optional (`ArrayMinSize` removed); added `guests?` + `travelerAges?`. `BookingUnitItemResponseDto.ageBandId` is nullable. Service enforces model XOR (UNIT needs guests / rejects items; PER_PERSON needs items / rejects guests).
- [x] **[D5] UNIT+PRIVATE exclusivity** (`bookings.service.ts` reserve claim + `releaseSeats`): a private-unit reserve runs an exclusive claim (`booked_count = capacity`, `status = sold_out`, guarded by `status = open AND booked_count = 0` so one booking takes the whole departure); non-exclusive keeps the guarded count-up. `Booking.exclusiveDeparture` (new column) is snapshotted at reserve; `releaseSeats(..., exclusive)` resets `booked_count = 0` on cancel/expiry for exclusive bookings, else counts down. Migration `20260715173552_unit_booking_exclusivity` (also made `BookingUnitItem.ageBandId` nullable).

### 1.4 Availability - DONE (2026-07-16, "reserve fills capacity" approach)

- [x] **[D5] Exclusive sold-out** - chosen representation: the exclusive reserve fills `booked_count` to `capacity`, so the existing `bookedCount >= capacity` logic in `availability-status.util.ts` reads SOLD_OUT with NO util change and no schema flag on Departure. `Booking.exclusiveDeparture` drives the release side only.
- [x] **Materializer** - no change needed (capacity for a private-unit departure stays `maxPartySize`; exclusivity is enforced at booking time).

### 1.5 Seed - DONE (2026-07-16)

- [x] **Removed the UNIT fake-age-band hack** (`prisma/demo/tours.ts` `buildAgeBands` returns `[]` for UNIT). `priceFrom` seed falls back to `basePrice` for UNIT (no participant band). `bookings-payments.ts` already skips age-band-less tours (`if (!adultBand) continue`), so UNIT demo tours simply get no demo bookings.
- [x] **Inconsistent unit tour** (`sunset-champagne-sail-private-charter`): it is a flat BOAT/PRIVATE charter with no surcharge fields - correct as-is under D1a (flat basePrice); no change needed.

---

## 2. Dashboard (`frontend/components/dashboard/trips/`)

### 2.0 Relocate ALL pricing fields into the Pricing tab (founder 2026-07-15)

The Pricing tab becomes the single home for "how this tour is priced"; the Details tab keeps only operational/logistics/audience/policy fields. This also puts the pricing-model gating (age bands vs unit fields) in ONE place.

- [x] **Moved pricingModel / defaultCurrency / basePrice / wholeUnitType / unitIncludedGuests / extraPersonPrice from the Details tab to a new `PricingBasicsCard` at the top of the Pricing tab** (`trip-pricing-tab.tsx`). Removed from Details schema/type/defaults/payload/UI + the `pricingModel` watch. The new card uses `useUpdateTrip` with its own zod schema (`superRefine`: UNIT requires basePrice + wholeUnitType) and is pricing-model-aware (currency + base always; unit type / included guests / extra person only for UNIT). Age bands already live in the Pricing tab (gated below).
- [x] **Pass the tour into `TripPricingTab`** (`trip-edit-view.tsx:364` now `trip={trip}`; tab derives `tripId`/`isUnit`).
- [x] **[D4] Age-band manager gated on `pricingModel`** (`trip-pricing-tab.tsx`): UNIT shows a note ("unit-priced ... single guests count, set base/included/extra in Details") instead of the age-band manager; PER_PERSON unchanged. Consistent with the backend reject.
- [x] **Pricing tab layout, pricing-model-aware (one place):** `PricingBasicsCard` (top) = model + currency + base always; unit type / included guests / extra person only for UNIT. Age-band manager below is hidden for UNIT.
- [x] **Confirmed** - these stay in the **Details tab** (NOT pricing): duration, pickup model/required, min/max party size, booking cutoff, meeting point, min age, fitness, weather/wheelchair/family/beginners, cancellation window, payment model, deposit %, `bookingType`. (Commercial/policy, not price inputs; revisit only if a dedicated Payments tab is wanted.)

### 2.1 Validation + create form

- [x] **UNIT validation** (2026-07-16, `trip-form.tsx` create schema): added `.superRefine` so `pricingModel==='UNIT'` requires `basePrice` + `wholeUnitType` (errors render on those fields). PER_PERSON keeps finishing its price (age bands) in the Pricing tab.
- [x] **Create form collects `unitIncludedGuests` + `extraPersonPrice`** (2026-07-16): the create form now shows a GROUP-only surcharge grid (Guests Included in Base + Extra Person Price) when `pricingModel==='UNIT' && wholeUnitType==='GROUP'`, and the payload sends them only in that case (D1a: other unit types stay flat). Schema/type/defaults/payload all wired; `CreateTripPayload` + backend `CreateTourDto` already supported the fields.
- [x] **[D3] Confirmed** - no booking_type / pricing_model filter facet added (master no-op). Recorded so it isn't "fixed" by mistake.

---

## 3. Booking card + checkout (`frontend/components/frontend/`)

- [x] UNIT pricing formula in card + checkout (`lib/tours/booking.ts:249-308`, `lib/stores/booking-store.ts:210-235`, `lib/checkout/checkout.ts:133-155`) - matches D1.
- [x] **[D2] Tour-detail widget price anchor is unit_type-aware** (`price-header.tsx` now uses `priceUnitLabel` -> "From $X per boat/vehicle/group/aircraft/package"); per-unit_type keys added to the booking dict (7 locales). Party counter still reads "{count} Guests" (fine for all unit types). The included/extra sub-line only shows for GROUP (surcharge). Checkout shows concrete totals + "N Guests" (no "per-unit" anchor needed there).
- [x] **[D2] Show the unit_type price unit CONSISTENTLY on ALL tour CARDS** (done Phase 2, 2026-07-15). There are 3 price-bearing card variants and they are inconsistent today:
    - `tour-card.tsx` (main; All Tours / category / collection) - binary `priceUnit: 'per' | 'perGroup'` (`lib/tours/listing.ts:123,151`; rendered `tour-card.tsx:133,292` via `dict.per`/`dict.perGroup`).
    - `hub-tour-card.tsx` (hub listing) - free-form `priceUnit: string` + optional `priceNote`, built by `hub-page.tsx cardPrice()` (170-192). Already has UNIT logic ("N people included" + "+$X per extra") but uses a generic "people" noun and **ignores `wholeUnitType`**.
    - `hub-pick-card.tsx` (hub "Our Picks") - shows `from $X` with **NO unit label at all** (129-132).
    - (`hub-discover-card.tsx`, `collection-card.tsx`, `tour-card-carousel.tsx` show no per-tour price - skip.)
    - [x] **Shared helper built** (`lib/tours/pricing-label.ts`: `priceUnitKey` + `priceUnitLabel` + `PriceUnitKey`). **Main tour card DONE** (`lib/tours/listing.ts` for `tourToListing` + `searchHitToListing`; `tour-card.tsx` resolves `dict[tour.priceUnit]`; `collection-page` threaded; listings dict x7). **Hub tour card DONE** (`hub-page.tsx cardPrice` uses `priceUnitLabel`; hub `cardChips` dict x7 got per-unit_type nouns; surcharge note only for GROUP). **Tour-detail widget anchor DONE** (`price-header.tsx`; booking dict x7). **Hub "Our Picks" card + Compare table DONE** (`hub-pick-card` + `hub-compare-section` got a `priceUnit` field; `pickToHubPick` + `groupToCompareTable` resolve it via `priceUnitLabel` from the hub `cardChips` labels). Every price-bearing surface is now unit_type-aware. Checkout unchanged (concrete totals + "N Guests").
    - **(original plan)** add ONE shared helper `lib/tours/pricing-label.ts` -> `priceUnitLabel({ pricingModel, wholeUnitType, unitIncludedGuests, extraPersonPrice }, labels)` returning `{ unit, note? }`: PER_PERSON -> "/per person"; UNIT -> unit noun from `wholeUnitType` ("/per boat|vehicle|group|aircraft|package", + "N included" / "+$X per extra" note). Consume it in `listing.ts` (main card), `hub-page.tsx cardPrice()` (hub card), and `hub-pick-card` (add the unit). Keep the detail widget + checkout (items above) on the same helper/label source so all surfaces match.
    - **Data:** the list card payload + search hit + hub hit must return `wholeUnitType` (they already return `pricingModel`; hub already returns `unitIncludedGuests`/`extraPersonPrice`). Add `wholeUnitType` to the card DTO/select + `TourCard` type (`tour-card.tsx:33,63-64`) and hub types.
    - **Copy:** per-unit_type keys (`perBoat`/`perVehicle`/`perGroup`/`perAircraft`/`perPackage`) + "included"/"per extra" notes, 7 locales; PER_PERSON stays `dict.per`.
    - Update the hardcoded `priceUnit` sources too (`category-page.tsx:61-126`, `collection-page.tsx:121`) to route through the helper.
- [x] **[D2] UNIT widget price anchor** (done Phase 2): `price-header.tsx` renders "From $X per {unit noun}" via `priceUnitLabel`.
- [x] **[D3] Optional "Private charter" badge** (2026-07-16, copy only): `price-header.tsx` shows a pill "Private charter - this departure is exclusively yours" when `bookingType==='PRIVATE'` + UNIT. `TourBookingData` now carries `bookingType`; new `privateCharter` dict key x7 locales. Not a filter.
- [x] **i18n**: new unit_type + private-charter copy keys across all 7 locales.
- [x] Types already carry pricingModel/wholeUnitType/unit fields/bookingType (`types/trip.ts`, `types/tour-detail.ts`).

---

## 4. Tests + docs

- [x] Backend unit tests: UNIT quote formula (GROUP surcharge, flat unit, add-on-by-pax, no-input throw) in `booking-pricing.util.spec.ts`; UNIT reserve (guests pricing, GROUP surcharge, items-rejected, guests-required, max-party), UNIT+PRIVATE exclusive claim + SHARED count-up + exclusive-release in `bookings.service.spec.ts`. Full backend suite green (875 tests). Age-band-on-unit rejection + `recomputePriceFrom` UNIT branch + priceFrom filter were covered in Phase 1.
- [x] Cross-ref docs updated (2026-07-16): `BOOKING-CHECKLIST.md` (UNIT pricing / whole-departure / priceFrom flipped to done) + `MASTER-CHECKLIST.md` (E.3 booking-logic UNIT-engine line added). `BOOKING-WIDGET-CHECKLIST.md` §3.2 already documents the UNIT card/checkout as done with the server-quote note.
- [x] **USER ACTION (only remaining item):** reseed so the DB reflects the no-age-band unit model - `pnpm prisma:seed:demo:clean` then `pnpm prisma:seed:demo`. (All code + tests are shipped; this just rebuilds demo data.)

---

## Suggested execution order

1. **Part 1.1-1.2 + Part 2** (validation, invariants, priceFrom, dashboard gating) - self-contained, makes the tour/UNIT model correct end to end without touching the booking engine.
2. **Part 3** (unit_type copy map, anchor, badge, i18n) - isolated frontend polish.
3. **Part 1.3-1.4** (UNIT quote/reserve + exclusivity) - the booking-engine work; do with the pending Step 5/6 (server quote + real submission) from `BOOKING-WIDGET-CHECKLIST.md`.
4. **Part 1.5 + Part 4** (seed + tests + docs) - alongside each phase.

