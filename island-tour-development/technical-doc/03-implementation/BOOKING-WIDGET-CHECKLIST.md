# Booking Widget (Dynamic Card) - implementation checklist

> Goal: turn the tour-detail booking widget from a single-payment-type, dummy-fed card into a
> **conditional card driven by each tour's data** (payment model, pricing model, booking model, pickup
> model, deposit, cancellation, age bands, add-ons, availability), and wire the real
> checkout -> `/payment/processing` -> TYP flow.
>
> Source of truth: master v1.9 §5.8 (checkout), §5.9 (TYP), §6.1 (widget states). Engineer derivations:
> [BOOKING-FLOW-DESIGN-GUIDE.md](./BOOKING-FLOW-DESIGN-GUIDE.md) · [../02-architecture/BOOKING-AND-PAYMENTS.md](../02-architecture/BOOKING-AND-PAYMENTS.md) · [../02-architecture/TRACKING-AND-ANALYTICS.md](../02-architecture/TRACKING-AND-ANALYTICS.md) · [../02-architecture/AVAILABILITY-AND-DEPARTURES.md](../02-architecture/AVAILABILITY-AND-DEPARTURES.md) · backend gaps in [BOOKING-CHECKLIST.md](./BOOKING-CHECKLIST.md).
>
> Legend: `[x]` done · `[~]` exists but demo/partial (change needed) · `[ ]` to build.
> Hard rules to honor: NO em dash; Tailwind tokens only (no inline styles); `next/image` Figma SVGs;
> `it-section`/`it-container`; motion per repo standard (no whileHover, whileTap down); i18n via next-intl.

---

## 1. Current state (what the card does today)

- Widget lives in `frontend/components/frontend/tour/tour-booking-card/` (`TourBookingCard` + sections: `price-header`, `booking-calendar`, `departure-times`, `party-selector`, `spectators-panel`, `price-summary`, `booking-cta`, `policy-modal`, `sell-out-notice`). State/math: `frontend/lib/stores/booking-store.ts` (`deriveBooking`); mapper: `frontend/lib/tours/booking.ts` (`buildTourBookingData`, `DUMMY_BOOKING_DATA`); hook `frontend/hooks/tours/use-booking.ts`; provider `frontend/contexts/booking-context.tsx`.
- `[~]` **Fed DUMMY data, not the live tour.** `tour-detail-content.tsx:380-387` renders `<TourBookingCard>` with **no `data` prop** -> store falls back to `DUMMY_BOOKING_DATA`. Same in `checkout/page.tsx:99`. So every tour shows the same `$120/$65/free`, 3 fixed slots, 20% deposit.
- `[~]` **Payment model not branched.** Only a boolean `requiresDeposit = (OPERATOR_LINK||ON_ARRIVAL) && 0<depositPct<100` (`booking.ts:211`). All 4 models collapse to deposit-vs-full; `PAID_IN_FULL` and `OPERATOR_FULL` both just set `payToday = total`.
- `[~]` **Trust lines unconditional** (`booking-cta.tsx:56-67`): always renders "Pay {pct}% now, the rest later" AND "Free cancellation up to {hours}h", even for full-payment tours.
- `[~]` **Pricing is client-side and duplicated** (`deriveBooking` + `lib/checkout/checkout.ts:computeCheckoutTotals`). No server quote.
- `[~]` **Submission is mock.** Widget CTA only pushes to `/checkout?date&time&party`; `checkout-form.tsx:319 handleReserve()` is a 1.6s `setTimeout` then `router.push` to TYP with a hardcoded `DEMO_PUBLIC_REF`. No booking POST, no Stripe.
- `[~]` **Departure times capped at 3** (`departure-times.tsx:21 slice(0,3)`); slots forced `status:'available'`, `remaining:null` (`booking.ts:218`) - no real availability.
- **Not consumed at all:** `pricingModel`, `wholeUnitType`, `bookingType`, `instantConfirmation`, `bookingCutoffMinutes`, `pickupModel`, `pickupRequired`, `pickupLocations`, `addOns`, `unitIncludedGuests`, `extraPersonPrice`.

---

## 2. Data contract (what the widget needs vs what is exposed)

- `[x]` **Backend returns every field needed** on `GET /tours/slug/:slug` (`TourPublicDetailResponseDto`): paymentModel, depositPct, pricingModel, basePrice, unitIncludedGuests, extraPersonPrice, wholeUnitType, bookingType, instantConfirmation, bookingCutoffMinutes, pickupModel, pickupRequired, cancellationHours, durationMinutesFrom/To, startTimes, defaultCurrency, ageBands (price/priceOriginal/priceNet/bandType/min-maxAge), addOns (price/unit/maxQuantity), pickupLocations, min/maxPartySize, timeZone. `Ref:` [Guide §9](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- `[ ]` **Add `unitIncludedGuests` + `extraPersonPrice` to `PublicTourDetail`** (`frontend/types/tour-detail.ts`). Backend sends them; the FE type omits them, so UNIT pricing is untyped/unusable. `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- `[ ]` **Widen `AvailabilityDeparture`** (`frontend/lib/api/availability.ts:11`) to keep `capacity`, `bookedCount`, `remaining`, `soldOutAt` (backend `DepartureResponseDto` sends them; FE type drops them) - needed for "Only N left" and sold-out. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- `[ ]` **Add a frontend client for `POST /availability/calendar`** (month map). The endpoint exists (`CalendarDayResponseDto[]`) but has NO frontend caller; the widget's month calendar needs it. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)

---

## 3. Conditional matrix (what the card must render per tour data)

### 3.1 By `paymentModel` (CTA + money rows + trust) - master §5.8, §6.1

`Ref:` [BOOKING-AND-PAYMENTS §1 CTA & money-row](../02-architecture/BOOKING-AND-PAYMENTS.md) · [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models)

| paymentModel | Money rows | CTA | Trust line | v1? |
|---|---|---|---|---|
| `operator_link` | Total · Pay today (deposit) · Balance later (operator sends secure link) | locked `Reserve my spot - Pay {deposit}` | "Pay {pct}% now, the rest via the operator's secure link" + free cancellation | yes |
| `on_arrival` | Total · Pay today (deposit) · Balance on arrival | locked `Reserve my spot - Pay {deposit}` | "Pay {pct}% now, the rest on arrival" + free cancellation | yes |
| `paid_in_full` | Total · Pay today = total (no balance row) | locked `Reserve my spot - Pay {total}` | "Pay in full now" + free cancellation | yes |
| `operator_full` | Total · Balance later (operator collects) - no pay-today | bare `Reserve my spot` (no lock, no amount) | free cancellation only, no payment line | **v2 (dropped v1)** |

- `[ ]` Zero-amount money rows hidden (master §6.1). `[ ]` `operator_full` bare-CTA path (build for v2, guard out of v1). `[ ]` Deposit uses real `depositPct` from tour, not a constant.
- `[ ]` **Reject/hide `operator_full` in v1** (founder decision - see [../02-architecture/SETTLEMENT-AND-PAYOUTS.md](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15)); if a tour still carries it, the widget must not offer a payment-free reserve.

### 3.2 By `pricingModel`

- `[ ]` **`PER_PERSON`** (current): age-band steppers (participants + spectators). Keep, but drive from live `ageBands`. `Ref:` [Guide §9 PER_PERSON](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- `[ ]` **`UNIT`** (whole-unit/charter): single "guests" count, price = `basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice`; copy "Includes {unitIncludedGuests} guests, +{extraPersonPrice} per extra"; `wholeUnitType` label (boat/vehicle/etc.). `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · **Backend dependency:** UNIT pricing is NOT implemented server-side ([BOOKING-CHECKLIST flaw 3](./BOOKING-CHECKLIST.md)); FE UI is blocked on it for real totals.

### 3.3 By pickup

- `[ ]` **`pickupModel` / `pickupRequired`**: when pickup is offered, surface pickup selection from `pickupLocations` (in widget or carried to checkout); if `pickupRequired`, make it mandatory before Continue. Today pickup only appears on the checkout form. `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow)

### 3.4 By booking model / timing

- `[ ]` **`instantConfirmation`**: show an "Instant confirmation" affordance when true. `[ ]` **`bookingType`** (PRIVATE/SHARED) semantics in party UI. `Ref:` master §6.1
- `[ ]` **`bookingCutoffMinutes`**: disable slots/dates inside the cutoff window (currently ignored; slots hardcoded available). Cutoff is computed live server-side in the availability read - consume it. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)

### 3.5 Add-ons

- `[ ]` **Render `addOns`** (per `unit`: PER_PERSON multiplies by party, FLAT once; respect `maxQuantity`) and include in totals + the booking payload. Not handled anywhere in the widget today. `Ref:` [Guide §9 add-on line totals](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)

---

## 4. Availability (real slots, not dummy)

- `[ ]` Wire the calendar to `POST /availability/calendar` (month map: per-day open/closed/sold_out/none, `remaining` only under 5). `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- `[ ]` Wire time chips to `POST /availability/check` (bookable slots for the picked date), remove the `slice(0,3)` cap, show all real slots. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- `[ ]` Show "Only N left" only when `remaining < 5`; render sold-out/closed states; auto-advance to `first_available_date`. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)

---

## 5. Server-authoritative pricing (quote)

- `[ ]` **`POST /bookings/quote`** and consume it in the widget + checkout instead of client math; remove the duplicated `deriveBooking`/`computeCheckoutTotals` totals for anything persisted. `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · **Backend dependency:** quote endpoint not built ([BOOKING-CHECKLIST §6](./BOOKING-CHECKLIST.md)). Interim: keep client estimate but mark it non-authoritative.

---

## 6. Real submission + payment

- `[ ]` **`POST /api/v1/bookings`** from checkout `handleReserve` (replace the `setTimeout` demo); carry date/time/party/add-ons/pickup/contact + attribution; receive real `public_ref` (replace `DEMO_PUBLIC_REF` in `checkout/page.tsx:189`). `Ref:` [Guide §4](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow)
- `[ ]` **`POST /payments/bookings/:id/intent`** then mount a real Stripe (Mollie) payment element; never post raw card fields (current inputs are cosmetic; no SDK in `package.json`). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow)
- `[ ]` **Checkout stays payment-model-aware on real data** (the `payToday>0` gate already suppresses the payment phase for zero-pay models; drive it from the real quote, not `DUMMY_BOOKING_DATA`). `Ref:` master §5.8

---

## 7. Intermediate `/payment/processing` page (master §5.8, §5.9) - MISSING, to design

- `[ ]` **Build the lean `/payment/processing` route** (locale-less, noindex, ZERO tracking tags) that holds after payment submit and waits for the webhook to confirm the booking, then 302s to `/{destination}/thank-you/{public_ref}`. `Ref:` [Tracking §2 flow](../02-architecture/TRACKING-AND-ANALYTICS.md#2-flow-82)
- `[ ]` Poll `GET /bookings/typ/:publicRef` (or a status endpoint) until `CONFIRMED`, with a timeout/failure state. `[ ]` Show a minimal "confirming your booking" UI. `[ ]` Never fire conversion here.
- `[ ]` `operator_full` (v2) skips this hop (created confirmed at commit -> straight to TYP). In v1, all live models go through it. `Ref:` [Tracking §2 operator_full bypass](../02-architecture/TRACKING-AND-ANALYTICS.md#2-flow-82)

---

## 8. TYP + conversion (finish the real wiring)

- `[~]` TYP page/route built and correct (`/{destination}/thank-you/{publicRef}`, no locale prefix, noindex); currently a `DEMO_BOOKING` payload. `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking)
- `[ ]` Swap `getThankYouBooking` (`frontend/lib/thank-you/thank-you.ts:174`) to real `GET /bookings/typ/:publicRef`.
- `[ ]` Fire exactly one `booking_complete` (EUR `commission_amount`, never GMV) only when `status===CONFIRMED` and commission non-null; guard is server `conversion_fired_at`, not localStorage. `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking), [Tracking §3](../02-architecture/TRACKING-AND-ANALYTICS.md#3-data-contract-the-booking_complete-push-83)

---

## 9. Cross-cutting frontend compliance

- `[ ]` i18n via next-intl for all new copy (payment-model strings, UNIT copy, pickup, processing page).
- `[ ]` Motion per repo standard (MountReveal/Reveal, phase cross-fade, whileTap-down, NO whileHover); stagger any lists.
- `[ ]` Tailwind `--it-*` tokens + `it-section`/`it-container`; image containers get `bg-it-border`.
- `[ ]` `'use client'` only on the smallest leaf; server-render declarative-motion parts.
- `[ ]` Multi-currency (shopper currency) is a **separate later phase** (Guide §21) - do not block the dynamic card on it; render in `Tour.defaultCurrency` for now, and fix `CURRENCY_SYMBOLS` (only USD/EUR mapped, `booking.ts:154`).

---

## 10. Backend prerequisites (block full correctness - see BOOKING-CHECKLIST)

The card can be made conditional now on data already exposed, but these backend gaps must close for real money/flow:

- `[ ]` `ON_ARRIVAL` deposit split + charge (flaw 1) · `[ ]` discount applied (flaw 2) · `[ ]` UNIT pricing (flaw 3) · `[ ]` `POST /bookings/quote` (§6) · `[ ]` reject `operator_full` v1 (flaw 6) · `[ ]` `/payment/processing` depends on webhook->CONFIRMED (built) + Mollie confirm (flaw 7). `Ref:` [BOOKING-CHECKLIST §0](./BOOKING-CHECKLIST.md)

---

## Suggested build order

1. Wire live data: pass `data={buildTourBookingData(detail)}` in `tour-detail-content.tsx` and `checkout/page.tsx`; add the two missing type fields + widen availability types.
2. Payment-model conditional (CTA, money rows, trust lines) on real `paymentModel`/`depositPct`/`cancellationHours` (§3.1). Guard out `operator_full` for v1.
3. Real availability (calendar month map + slots, cutoff, "only N left"), remove the 3-slot cap (§4).
4. Pickup (§3.3) and add-ons (§3.5) in the widget/checkout + payload.
5. `pricingModel` UNIT UI (§3.2) once backend UNIT pricing lands.
6. Real submission: quote -> booking POST -> payment intent -> Stripe element (§5, §6).
7. `/payment/processing` page (§7), then TYP real data + conversion (§8).
