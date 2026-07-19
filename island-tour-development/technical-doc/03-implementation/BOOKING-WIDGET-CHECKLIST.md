# Booking Widget (Dynamic Card) - implementation checklist

> Goal: turn the tour-detail booking widget from a single-payment-type, dummy-fed card into a
> **conditional card driven by each tour's data** (payment model, pricing model, booking model, pickup
> model, deposit, cancellation, age bands, add-ons, availability), and wire the real
> checkout -> `/payment/processing` -> TYP flow.
>
> Source of truth: master v1.9 §5.8 (checkout), §5.9 (TYP), §6.1 (widget states). Engineer derivations:
> [BOOKING-FLOW-DESIGN-GUIDE.md](./BOOKING-FLOW-DESIGN-GUIDE.md) · [../02-architecture/BOOKING-AND-PAYMENTS.md](../02-architecture/BOOKING-AND-PAYMENTS.md) · [../02-architecture/TRACKING-AND-ANALYTICS.md](../02-architecture/TRACKING-AND-ANALYTICS.md) · [../02-architecture/AVAILABILITY-AND-DEPARTURES.md](../02-architecture/AVAILABILITY-AND-DEPARTURES.md) · backend gaps in [BOOKING-CHECKLIST.md](./BOOKING-CHECKLIST.md).
>
> Legend: [x] done · [~] exists but demo/partial (change needed) · [ ] to build.
> Hard rules to honor: NO em dash; Tailwind tokens only (no inline styles); `next/image` Figma SVGs;
> `it-section`/`it-container`; motion per repo standard (no whileHover, whileTap down); i18n via next-intl.

---

## 0. Session progress (2026-07-15, branch `rendering-caching`, uncommitted)

- [x] **Step 1 - live data** wired into the widget + checkout (§1, §2).
- [x] **Step 3 - real availability** wired (calendar month map + per-date slots, cutoff, "only N left", auto-advance) (§4).
- [x] **Capacity enforcement during selection** - party caps at true seats-left (`BookingSlot.seatsLeft = capacity - bookedCount`, always known even when `remaining` is withheld above 5); `effectiveMaxOf` uses it. Master §3.3.1.
- [x] **Stepper silent-stop fixed** - inline note at capacity (`atCapacity`/`capacityReason` in `deriveBooking`; `booking-cta.tsx`): slot scarcity -> "Only N spots left", per-booking max -> "Up to N travellers per booking" (new `maxPerBooking` dict key, 7 locales). Master §3.3.1.
- [x] **CTA silent-ignore fixed (2026-07-19)** - clicking Check Availability with an incomplete selection no longer swallows the click: `handleCtaClick` sets `ctaError: 'date' | 'slot'` in the store (cleared on `pickDate`/`selectTime`/success), `booking-cta.tsx` shows an animated inline note above the button (Collapse, gap inside per motion rules), and the missing field highlights - `ring-1 ring-it-primary` on the date trigger (`booking-calendar.tsx`, plus the existing auto-open); for the slot case the pickable chips get a soft `border-it-primary/45` tint + a one-shot x-shake of the row (`departure-times.tsx`; a wrapper ring was tried first and rejected - it collided with the date field). New dict keys (7 locales): `errorSelectDate`, `errorSelectSlot`.
- [x] **Continue -> checkout no longer freezes (2026-07-19)** - the push to the dynamic checkout route is wrapped in `useTransition` (`booking-cta.tsx`): the button swaps to a spinner + "Continue" while navigating (disabled against double-push) and the checkout base route is `router.prefetch`ed on mount. Checkout forms were audited alongside: contact (name/email/phone) and payment (postal/name + Stripe element errors) already validate with inline errors, no change needed.
- [x] **Every slot chip shows a status line** - default "Available" (new `available` dict key, 7 locales) besides selected/soldOut/onlyLeft.
- [x] **Calendar disables + hover hints** - no-schedule / closed / sold-out days blocked with reason tooltip (new `calendarNoDepartures`, `calendarClosed` dict keys, 7 locales); tooltip animates via `AnimatePresence` + `crossFade`.
- [x] **Step 2 - payment-model conditional** wired (§3.1). `TourBookingData` now carries `paymentModel`; `deriveBooking` derives per-model money rows (`showPayToday`/`showBalance`, zero-amount rows hidden), `balanceLabel` (`Balance on arrival` for `on_arrival`), and a `paymentTrust` line (deposit-link / "Pay in full now" / none). `operator_full` is guarded out of v1 via `bookingBlocked` (disabled CTA + `bookingUnavailable` notice). New dict keys (7 locales): `bookingUnavailable`, `balanceOnArrival`, `payOnArrival`, `payInFull`; `payLater` reworded to the operator's-secure-link copy. `booking-cta.tsx` + `price-summary.tsx` render from the derived values.
    - **CTA copy deviation from the §3.1 table (founder call 2026-07-15):** the card CTA stays **"Continue"**, NOT "Reserve my spot - Pay {amount}". The card navigates to the **checkout page**, where the reserve + pay actually happens - so the "Reserve my spot · Pay {amount}" label lives on the checkout submit button (`checkout-form.tsx`, top-level `reserve`/`reservePay` keys), not the card. The deposit amount is already shown in the card's "Pay today" money row above the CTA. The §3.1 table below describes the reserve+pay wording that now applies to the **checkout button**, not the card.
- [x] **CTA readiness fix (live mode)** - in live mode availability is pre-verified, so a complete in-capacity selection (date + time + party) is immediately `ready` (price summary shows) with **no redundant "Check availability" click**; the party stays editable after ready. `deriveBooking`: `ready = isLive ? selectionComplete : availabilityChecked`, `editingParty = isLive ? true : !availabilityChecked`. Demo/design card keeps the two-phase check. **Card CTA = "Continue"** (founder call): the reserve+pay action lives on the checkout page, not the card.
- [x] **UNIT (whole-unit / charter) pricing** wired (§3.2) - the card was doing per-person math (4 guests x $1,450 = $5,800) for a charter priced per group; now `total = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice` (e.g. Klein Curaçao Luxury Yacht Charter: 4 guests = $1,450, 12 guests = $1,890). Single "guests" stepper, "per group" headline + coverage sub-line, UNIT price breakdown; `computeCheckoutTotals` matches. See §3.2.
- **STILL PENDING (next):** pickup (§3.3), add-ons (§3.5), booking-model/timing affordances (§3.4), server quote (§5), real submission + payment (§6), `/payment/processing` (§7), TYP real data + conversion (§8).

### Dashboard + backend availability fixes done alongside (Schedules tab / materializer)

- [x] **Start Times moved from Details tab to Schedules tab** (`trip-schedules-tab.tsx` `StartTimesSection`, persists via `useUpdateTrip`; removed from `trip-details-tab.tsx`). Declared times now managed beside the schedules that consume them; removal blocked (tooltip) while a schedule uses a time.
- [x] **Schedule/exception forms: inline field + server errors** (replaced most toasts; row-action toasts kept).
- [x] **Free time inputs -> 24-hour HH:MM text** (native `type="time"` showed ambiguous `12:00 --` AM/PM in 12h locales); placeholder + accurate help.
- [x] **Backend materializer flaw fixed** - CLOSE_DATE / CLOSE_SLOT now close a **booked** departure (status synced; capacity/bookings/source still protected; `manuallyEdited`/API stay hands-off). Previously a partially-booked slot kept selling through a closed date. `backend/src/availability/availability-materializer.service.ts` reconcile split; +4 unit tests (52 availability tests pass). Backend is confirmed 24-hour-time compatible end to end.

---

## 1. Current state (what the card does today)

- Widget lives in `frontend/components/frontend/tour/tour-booking-card/` (`TourBookingCard` + sections: `price-header`, `booking-calendar`, `departure-times`, `party-selector`, `spectators-panel`, `price-summary`, `booking-cta`, `policy-modal`, `sell-out-notice`). State/math: `frontend/lib/stores/booking-store.ts` (`deriveBooking`); mapper: `frontend/lib/tours/booking.ts` (`buildTourBookingData`, `DUMMY_BOOKING_DATA`); hook `frontend/hooks/tours/use-booking.ts`; provider `frontend/contexts/booking-context.tsx`.
- [x] **Fed live tour data.** `tour-detail-content.tsx` now passes `data={buildTourBookingData(detail)}`; `checkout/page.tsx` builds the same from the live tour and threads it into `CheckoutBody`. `DUMMY_BOOKING_DATA` remains only as the store's design-time fallback. (Real availability - remaining/sold-out - still lands in §4.)
- [x] **Payment model branched** (Step 2). `deriveBooking` now switches on `paymentModel` for money rows, CTA label, and trust lines; `operator_full` is blocked in v1. `requiresDeposit` on `TourBookingData` is retained only for the checkout path (§6), not the widget.
- [x] **Trust lines conditional** (`booking-cta.tsx`): free-cancellation always; the payment line is model-specific (`paymentTrust`: deposit-link / "Pay in full now" / none for operator_full).
- [x] **Server quote consumed** (2026-07-15): debounced `POST /bookings/quote` hook feeds the card + checkout totals; `deriveBooking`/`computeCheckoutTotals` remain only as the optimistic estimate while the quote is in flight.
- [x] **Submission is REAL** (2026-07-15/16): `checkout-form.tsx` `handleReserve` calls `reserveBooking` (real `POST /bookings`, idempotency key) then `createPaymentIntent` + styled Stripe Card Elements; redirects via `checkout/processing` to the real TYP `public_ref`. The `setTimeout` demo is gone.
- [~] **Departure times capped at 3** (`departure-times.tsx:21 slice(0,3)`); slots forced `status:'available'`, `remaining:null` (`booking.ts:218`) - no real availability.
- **Not consumed at all:** `pricingModel`, `wholeUnitType`, `bookingType`, `instantConfirmation`, `bookingCutoffMinutes`, `pickupModel`, `pickupRequired`, `pickupLocations`, `addOns`, `unitIncludedGuests`, `extraPersonPrice`.
  and no countdown the hold time for a slot to booking.

---

## 2. Data contract (what the widget needs vs what is exposed)

- [x] **Backend returns every field needed** on `GET /tours/slug/:slug` (`TourPublicDetailResponseDto`): paymentModel, depositPct, pricingModel, basePrice, unitIncludedGuests, extraPersonPrice, wholeUnitType, bookingType, instantConfirmation, bookingCutoffMinutes, pickupModel, pickupRequired, cancellationHours, durationMinutesFrom/To, startTimes, defaultCurrency, ageBands (price/priceOriginal/priceNet/bandType/min-maxAge), addOns (price/unit/maxQuantity), pickupLocations, min/maxPartySize, timeZone. `Ref:` [Guide §9](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- [x] **Added `unitIncludedGuests` + `extraPersonPrice` to `PublicTourDetail`** (`frontend/types/tour-detail.ts`). Backend sends them; the FE type now carries them so UNIT pricing is typed. `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- [x] **Widened `AvailabilityDeparture`** (`frontend/lib/api/availability.ts`) to match backend `DepartureResponseDto`: `tourId`, `capacity`, `bookedCount`, `remaining`, `soldOutAt`, `manuallyEdited` - needed for "Only N left" and sold-out. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- [x] **Added a frontend client for `POST /availability/calendar`** (`getTourCalendar` in `frontend/lib/api/availability.ts`, `CalendarDay` type). Feeds the widget's month calendar. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)

---

## 3. Conditional matrix (what the card must render per tour data)

### 3.1 By `paymentModel` (CTA + money rows + trust) - master §5.8, §6.1

`Ref:` [BOOKING-AND-PAYMENTS §1 CTA & money-row](../02-architecture/BOOKING-AND-PAYMENTS.md) · [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models)

> **CTA column applies to the CHECKOUT submit button, not the card.** In this build the card CTA is a plain **"Continue"** to checkout (founder call 2026-07-15); the "Reserve my spot · Pay {amount}" wording below is the checkout button. Money rows + trust lines below DO apply to the card.

| paymentModel    | Money rows                                                               | CTA (checkout button)                       | Trust line                                                                    | v1?                 |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| `operator_link` | Total · Pay today (deposit) · Balance later (operator sends secure link) | locked `Reserve my spot - Pay {deposit}`    | "Pay {pct}% now, the rest via the operator's secure link" + free cancellation | yes                 |
| `on_arrival`    | Total · Pay today (deposit) · Balance on arrival                         | locked `Reserve my spot - Pay {deposit}`    | "Pay {pct}% now, the rest on arrival" + free cancellation                     | yes                 |
| `paid_in_full`  | Total · Pay today = total (no balance row)                               | locked `Reserve my spot - Pay {total}`      | "Pay in full now" + free cancellation                                         | yes                 |
| `operator_full` | Total · Balance later (operator collects) - no pay-today                 | bare `Reserve my spot` (no lock, no amount) | free cancellation only, no payment line                                       | **v2 (dropped v1)** |

- [x] Zero-amount money rows hidden (master §6.1) - `showPayToday`/`showBalance` gate the pay-today and balance rows on `> 0`. [x] `operator_full` bare-CTA path built (`ctaReadyLabel` = `reserveSpot`, balance-only rows) for v2, guarded out of v1. [x] Deposit uses real `depositPct` from the tour (`usesDeposit = isDepositModel && 0 < depositPct < 100`), not a constant.
- [x] **Reject/hide `operator_full` in v1** (founder decision - see [../02-architecture/SETTLEMENT-AND-PAYOUTS.md](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15)): `bookingBlocked = isOperatorFull` replaces the CTA + trust lines with a disabled `bookingUnavailable` notice, so the widget never offers a payment-free reserve.

### 3.2 By `pricingModel`

- [x] **"From $X per person" anchor = DEFAULT age band (2026-07-16 founder rule).** The widget/card
  headline anchors on the tour's default participant band (Adult reference price), never the cheapest
  child/senior band (was "From EUR41" child while Adult=EUR69). Backend-owned: `recomputePriceFrom`
  prefers `isDefault DESC, price ASC`; existing rows backfilled
  (`20260716165001_reanchor_price_from_on_default_band`); demo seed + dashboard Pricing-tab copy
  updated. Frontend reads `priceFrom` as-is - no client change needed.
- [x] **Exact decimal prices EVERYWHERE (2026-07-16 founder rule).** No whole-unit rounding on any
  money display: widget `conv` keeps cents, `money()`/`formatCheckoutMoney` render both cents when
  fractional ("$63.75", whole stays "$75"), deposit estimates round to cents, and the central
  `formatPriceFrom`/`resolveDisplayPrice` make every tour-card surface exact (listing, wishlist,
  typeahead, collection, hub, dashboard columns). Supersedes the Figma whole-number card anchor
  for fractional prices.
- [x] **Live currency switch (2026-07-16).** Footer currency change re-prices the mounted widget
  without a hard reload: `BookingStoreProvider` syncs re-converted `data`/`currency` into the live
  store on `router.refresh()` (selection preserved; quote dropped -> auto re-quote in new currency).

- [x] **`PER_PERSON`**: age-band steppers (participants + spectators), driven from live `ageBands`. `Ref:` [Guide §9 PER_PERSON](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)
- [x] **`UNIT`** (whole-unit/charter) - client-side pricing wired. `buildTourBookingData` now carries `pricingModel`/`basePrice`/`unitIncludedGuests`/`extraPersonPrice`/`wholeUnitType`, ignores age bands, and exposes a single "guests" stepper (`bands=[{id:'unit-guests', price:0}]`, Pattern A). `deriveBooking` computes `total = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice` and a UNIT `priceRows` breakdown ("Charter (up to N guests)" + "Extra guests x k x {price}"). `price-header.tsx` shows "From {basePrice} per group" + sub-line "Up to N guests · +{price} per extra guest"; `party-selector.tsx` header reads "{count} Guests". `computeCheckoutTotals` mirrors the same UNIT math so the card and checkout agree. New dict keys (7 locales): `guests`, `perGroup`, `unitIncludes`, `unitExtra`, `unitCharterLine`, `unitExtraGuests`. **Still pending:** the persisted/authoritative UNIT total must come from the server quote (§5) once backend UNIT pricing lands ([BOOKING-CHECKLIST flaw 3](./BOOKING-CHECKLIST.md)); the FE figure is a correct client estimate. Minor: checkout party label uses the English band label "Guests" (localize when §6 lands). `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)

### 3.3 By pickup

- [~] **`pickupModel` / `pickupRequired`**: pickup selection lives on the checkout form (real `pickupLocationId` into reserve; selection now mirrors live into the summary card, 2026-07-16, and timing is snapshotted onto the booking). Widget-side surfacing + `pickupRequired` enforcement before Continue still pending. `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow)

### 3.4 By booking model / timing

- [ ] **`instantConfirmation`**: show an "Instant confirmation" affordance when true. [ ] **`bookingType`** (PRIVATE/SHARED) semantics in party UI. `Ref:` master §6.1
- [ ] **`bookingCutoffMinutes`**: disable slots/dates inside the cutoff window (currently ignored; slots hardcoded available). Cutoff is computed live server-side in the availability read - consume it. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)

### 3.5 Add-ons

- [ ] **Render `addOns`** (per `unit`: PER_PERSON multiplies by party, FLAT once; respect `maxQuantity`) and include in totals + the booking payload. Not handled anywhere in the widget today. `Ref:` [Guide §9 add-on line totals](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic)

---

## 4. Availability (real slots, not dummy)

Wired via `frontend/hooks/tours/use-availability-sync.ts` (mounted in `tour-booking-card.tsx`), driving new store state (`calendarDays`, `daySlots`, `calendarLoading`, `slotsLoading`, `tourId`, `isLive`). A no-op in demo mode (no `tourId`) so the design card still works off `DUMMY_BOOKING_DATA`.

- [x] Wired the calendar to `POST /availability/calendar` (one fetch over the bookable horizon on mount -> per-day availability map). Days present+open are selectable; present-but-unavailable (sold out / closed) and absent (no departures) days render disabled; past days disabled. Auto-advances the month view to the first available month before a date is picked. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- [x] Wired time chips to `POST /availability/check` (bookable slots for the picked date), removed the `slice(0,3)` cap, show all real slots with a loading skeleton while they resolve. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- [x] Show "Only N left" only when `remaining < 5` (backend already nulls `remaining` above the threshold). Auto-advance to first-available month done. **Note:** `/availability/check` returns ONLY bookable slots (sold-out / closed / past-cutoff filtered server-side), so per-time sold-out chips do not appear in live mode - date-level sold-out is reflected by the calendar day being disabled. The `sold_out` slot state remains only for the demo dataset. `Ref:` [Availability §4](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#4-read-contract)
- [ ] Empty-date edge (a day the calendar reported open returns zero live slots on a race): the chips section stays collapsed. Acceptable for now; a "no times available" message would need a new i18n key.

---

## 5. Server-authoritative pricing (quote)

- [x] **`POST /bookings/quote`** consumed in the widget + checkout. `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · Backend stateless quote (`bookings.service.ts:quote()`) + frontend `useBookingQuote` (debounced, aborts superseded, re-quotes on currency switch); when a fresh quote is loaded it - not client math - drives the money summary/breakdown, and `deriveBooking`/`computeCheckoutTotals` remain only as the optimistic pre-quote estimate (target state reached).

---

## 6. Real submission + payment

- [x] **`POST /api/v1/bookings`** from checkout `handleReserve` - DONE (real reserve with date/time/party/pickup/contact; real `public_ref` flows to the TYP; add-ons + attribution capture still pending, see BOOKING-CHECKLIST flaw 9). `Ref:` [Guide §4](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow)
- [x] **`POST /payments/bookings/:id/intent`** + custom-styled Stripe Card Elements - DONE (no raw card fields; card/paypal/ideal launch set). Mollie deferred. `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow)
- [x] **Checkout payment-model-aware on real data** - the `payToday>0` gate runs off the live tour/quote; `DUMMY_BOOKING_DATA` survives only as the store's design-time fallback. `Ref:` master §5.8

---

## 7. Intermediate `/payment/processing` page (master §5.8, §5.9) - BUILT (as `checkout/processing`)

- [x] **Lean processing route BUILT** at `[destination]/[slug]/checkout/processing` (noindex, no tracking): holds after payment submit until the webhook confirms, then forwards to `/{destination}/thank-you/{public_ref}`. `Ref:` [Tracking §2 flow](../02-architecture/TRACKING-AND-ANALYTICS.md#2-flow-82)
- [x] Polls the TYP endpoint until `CONFIRMED` with timeout/failure states. [x] Minimal "confirming your booking" UI. [x] No conversion fired here.
- [ ] `operator_full` (v2) skips this hop (created confirmed at commit -> straight to TYP). In v1, all live models go through it. `Ref:` [Tracking §2 operator_full bypass](../02-architecture/TRACKING-AND-ANALYTICS.md#2-flow-82)

---

## 8. TYP + conversion (finish the real wiring)

- [x] TYP page/route built and correct (`/{destination}/thank-you/{publicRef}`, no locale prefix, noindex). **URL token decision locked 2026-07-16 = `publicRef` UUID** (unguessable, master rules #7/#16); `displayRef` (`IT-2026-XXXXXXXX`) is shown in page content + email, never in the URL. `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking)
- [x] **Swapped `getThankYouBooking` to the real `GET /bookings/typ/:publicRef`** (2026-07-16). `DEMO_BOOKING` deleted (`DEMO_PUBLIC_REF` survives only as the `generateStaticParams` shell token); all labels composed locale-side; related tours now fetched **real** via `getThankYouRelatedTours` (booked tour excluded; section self-hides when empty). Verified live on `4ce3c7c1-…`. See [BOOKING-COMPLETION-PROGRESS.md](./BOOKING-COMPLETION-PROGRESS.md) E3.
- [ ] Fire exactly one `booking_complete` (EUR `commission_amount`, never GMV) only when `status===CONFIRMED` and commission non-null; guard is server `conversion_fired_at`, not localStorage. `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking), [Tracking §3](../02-architecture/TRACKING-AND-ANALYTICS.md#3-data-contract-the-booking_complete-push-83)

---

## 9. Cross-cutting frontend compliance

- [ ] i18n via next-intl for all new copy (payment-model strings, UNIT copy, pickup, processing page).
- [ ] Motion per repo standard (MountReveal/Reveal, phase cross-fade, whileTap-down, NO whileHover); stagger any lists.
- [ ] Tailwind `--it-*` tokens + `it-section`/`it-container`; image containers get `bg-it-border`.
- [ ] `'use client'` only on the smallest leaf; server-render declarative-motion parts.
- [x] Multi-currency DONE (M5 + §21.5, committed `ab60871`): shopper-currency display sitewide + live server quote in the widget/checkout.

---

## 10. Backend prerequisites (block full correctness - see BOOKING-CHECKLIST)

The card can be made conditional now on data already exposed, but these backend gaps must close for real money/flow:

- [x] `ON_ARRIVAL` deposit split + charge (flaw 1, now a deposit model) · [ ] discount applied (flaw 2, coupon engine pending) · [x] UNIT pricing (flaw 3) · [x] `POST /bookings/quote` (§6; now FX-aware) · [x] reject `operator_full` v1 (flaw 6, `loadContext` throws) · [~] `/payment/processing` built on webhook->CONFIRMED; Mollie confirm still block-commented (flaw 7). `Ref:` [BOOKING-CHECKLIST §0](./BOOKING-CHECKLIST.md)

---

## Suggested build order

1. [x] Wire live data: pass `data={buildTourBookingData(detail)}` in `tour-detail-content.tsx` and `checkout/page.tsx`; add the two missing type fields + widen availability types. (Done - typechecks clean.)
2. Payment-model conditional (CTA, money rows, trust lines) on real `paymentModel`/`depositPct`/`cancellationHours` (§3.1). Guard out `operator_full` for v1.
3. [x] Real availability (calendar month map + slots, cutoff, "only N left"), remove the 3-slot cap (§4). (Done - typechecks + lints clean.)
4. Pickup (§3.3) and add-ons (§3.5) in the widget/checkout + payload.
5. `pricingModel` UNIT UI (§3.2) once backend UNIT pricing lands.
6. Real submission: quote -> booking POST -> payment intent -> Stripe element (§5, §6).
7. `/payment/processing` page (§7), then TYP real data + conversion (§8).

Recommended sequence

1. Frontend, unblocked (steps 1-4): wire live data (data={buildTourBookingData(detail)}), add the 2 missing type fields + widen availability types, then payment-model conditional (CTA/money-rows/trust), real availability, pickup, add-ons. This ships a working dynamic card.
2. Backend slice (before step 6): UNIT pricing + POST /bookings/quote + the 3 flaws + /payment/processing's webhook dependency.
3. Frontend, money phase (steps 5-7): UNIT UI, real submission -> quote -> booking POST -> Stripe element -> processing page -> TYP real data + conversion.

One caveat worth flagging: for anything persisted (the actual booking total), the client math in deriveBooking/computeCheckoutTotals must not be authoritative - the server quote wins. During phase 1 that's fine as a display estimate; just don't let it become the source of truth for a real booking. That's exactly the phase-2 boundary above.

