# Booking Checklist - complete task ledger

> Scope: every task and logic rule across the three booking/settlement/queue docs, cross-checked against
> the current schema and backend code (audited 2026-07-15). This is booking-domain-specific and
> complements [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).
>
> Source docs (each task links to where it is described):
>
> - Flow: [BOOKING-FLOW-DESIGN-GUIDE.md](./BOOKING-FLOW-DESIGN-GUIDE.md)
> - Settlement: [../02-architecture/SETTLEMENT-AND-PAYOUTS.md](../02-architecture/SETTLEMENT-AND-PAYOUTS.md)
> - Queues: [../02-architecture/EVENT-DRIVEN-AND-QUEUES.md](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md)
> - Canonical: `technical-doc/island-tours-platform-master.html` v1.9 (wins on any conflict)

## Status legend

- [x] built and matches the spec
- [~] partial or deviates from spec (needs fix)
- [ ] not built
- Each item ends with `Ref:` (the doc section it comes from) and, where relevant, `Code:` (file:symbol) plus a gap note.

---

## 0. Critical flaws to fix first (things that can produce wrong money or lost data)

These are ranked. Each is expanded in its section below.

1. [x] **`ON_ARRIVAL` is now a deposit model.** `splitDeposit` + `chargeFor` capture the deposit up front (same as OPERATOR_LINK; balance collected on-site vs via link). Deposit secures the booking + commission. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models), [Guide §20.6/§20.7](./BOOKING-FLOW-DESIGN-GUIDE.md#206-fix-payment-model-split) · `Code:` `booking-pricing.util.ts:splitDeposit`, `payments.service.ts:chargeFor`, `bookings.service.ts` email deposit line. Tests updated.
2. [ ] **Discount/coupon DEFERRED (blocked on a coupon-validation engine).** Decision 2026-07-16 (founder): a client-supplied `discountAmount`/`couponCode` is untrusted with no server-side coupon engine (a client could grant itself 100% off), so we do NOT apply it - full price stays authoritative and no phantom discount is written. Removed the untrusted DTO fields + write-through. Re-add (validated) when a `Coupon` engine ships. `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:reserve`, `dto/booking.dto.ts`
3. [x] **`UNIT` pricing implemented** (Phase 3, 2026-07-16). `loadContext` selects unit fields; `computeUnitLines` prices `basePrice + surcharge`; charter/whole-unit tours book. `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:loadContext`, `booking-pricing.util.ts:computeUnitLines`
4. [ ] **Hold-expiry sweeper not scheduled.** `expireStaleHolds()` exists but no cron/queue calls it, so expired holds keep seats and cause phantom sold-outs. `Ref:` [Guide §11](./BOOKING-FLOW-DESIGN-GUIDE.md#11-hold-expiry), [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · `Code:` `bookings.service.ts:expireStaleHolds` (unwired)
5. [~] **Conversion/email fire inline with mark-first stamp, no queue/outbox.** `conversionFiredAt` is set before email/CAPI run; a CAPI/email failure is then never retried and the conversion is lost. `Ref:` [Queues §5.1](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers), [§5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · `Code:` `bookings.service.ts:finalizeConfirmation`
6. [x] **`OPERATOR_FULL` rejected in v1.** `loadContext` throws `422` for an OPERATOR_FULL tour, so neither reserve nor quote can create a confirmed payment-free booking. `Ref:` [Settlement Part 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `bookings.service.ts:loadContext`. Test updated.
7. [~] **Mollie webhook is a stub.** It records the event but never confirms the booking; Mollie-paid bookings never reach CONFIRMED. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `payments.service.ts:handleMollieWebhook`
8. [ ] **No settlements ledger.** Required in v1 for `paid_in_full` payout and future extension. `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later)
9. [ ] **Attribution never captured at reserve.** utm/click-id/affiliate columns exist but are not in the DTO or written; conversion adjustments and affiliate attribution break. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities), [Tracking](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#tracking-stays-unchanged) · `Code:` `bookings.service.ts:reserve`, `dto/booking.dto.ts:ReserveBookingDto`

---

## 1. Data model & schema

- [x] **`Booking` core fields** (publicRef, displayRef, status, paymentModel, currency, totalRetail, deposit/balance, commissionRate/Amount, totalEur, fxRateToEur, local date/time, tour start/end/tz, contact split, utcExpiresAt, utcCancellationRequestedAt, conversionFiredAt, billing + card snapshot). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma:Booking`
- [x] **`BookingUnitItem`** (one per traveler, priceRetail/priceNet, ticket fields). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- [x] **`BookingAddOn`** (snapshotted line items). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- [x] **`Payment`** with kinds DEPOSIT/BALANCE/FULL/REFUND. `Ref:` [Guide §3 Payment](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/payments.prisma`
- [x] **`Departure`** (capacity, bookedCount, status OPEN/CLOSED/SOLD_OUT/CANCELLED, soldOutAt, source, manuallyEdited). `Ref:` [Guide §3 Departure](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/availability.prisma`
- [x] **`stripe_webhook_events`** idempotency table (+ `mollie_webhook_events`). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `prisma/payments.prisma`
- [ ] **`Settlement` model + `SettlementStatus` enum** (amountCollected, commissionOwed, netPosition, operatorPayout, status, externalRef). `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · ABSENT
- [ ] **`OutboxEvent` model** for the transactional outbox. `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · ABSENT
- [x] **Source-currency fields on `Booking`** (sourceCurrency, sourceTotalRetail, sourceDepositAmount, sourceBalanceAmount, sourceFxRateToBooking + FX audit: sourceFx/eurFx provider+asOf). `Ref:` [Guide §20.2](./BOOKING-FLOW-DESIGN-GUIDE.md#202-add-booking-schema-snapshots) · `Code:` `prisma/bookings.prisma:Booking` (migration `20260715221643_multi_currency_fx_rates_and_source_snapshots`)
- [x] **`FxRate` table** (provider-backed rates, refresh, expiry, isActive history). `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `prisma/fx.prisma:FxRate`
- [ ] **`BookingQuote` model** (if quote is DB-backed). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · ABSENT
- [~] **Distinct `gclid` column.** Only a generic `clickId` exists; the tracking spec names `gclid` separately. Decide whether to rename/split. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma:clickId`

---

## 2. Booking creation (reserve) - validation & atomic claim

- [x] **Single atomic guarded UPDATE on `departures`** (increment with `WHERE status='open' AND booked_count+seats<=capacity`, 0 rows -> fail), inside a transaction; no check-then-increment split. `Ref:` [Guide §8](./BOOKING-FLOW-DESIGN-GUIDE.md#8-atomic-capacity-claim), [Queues §2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue) · `Code:` `bookings.service.ts:reserve`
- [x] **Booking + unit items + add-on snapshots created in the same transaction.** `Ref:` [Guide §4 step 11](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:reserve`
- [x] **Validate: tour exists; departure belongs to tour; cutoff not passed; party min/max; add-ons active & belong to tour; pickup belongs to tour.** `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:loadContext/validateRestrictions/cutoffReached`
- [~] **Age-restriction validation.** Only tour minimum age is enforced, and only when `travelerAge` is supplied (ages optional); no max age, no requirement that ages cover all seats. `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:validateRestrictions`
- [x] **All party bands (incl. infants/spectators) count toward capacity** (one unit item each). `Ref:` [Guide §3 BookingUnitItem](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `bookings.service.ts:reserve`
- [x] **Whole-unit/private-charter claims the whole departure** (2026-07-16): a `UNIT` + `PRIVATE` reserve runs an exclusive claim (`booked_count = capacity`, `sold_out`, guarded by `status=open AND booked_count=0`); `Booking.exclusiveDeparture` drives whole-departure release on cancel/expiry. `Ref:` [Guide §9 UNIT capacity](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [§17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:reserve/releaseSeats`

---

## 3. Pricing & commission logic

- [x] **Retail total from age bands + add-on line totals** (PER_PERSON `unitPrice*qty*pax`, FLAT `unitPrice*qty`). `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts`
- [x] **`UNIT` pricing** `basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice` (2026-07-16, surcharge GROUP-only per D1a; flat otherwise). `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts:computeUnitLines`, `bookings.service.ts:loadContext`
- [~] **Discount applied to totals.** Stored but not subtracted. `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts` (see flaw 2)
- [x] **Commission snapshot** `commissionRate = effectivePct/100`, spotlight overlay applied, never retroactive. `Ref:` [Guide §9 commission](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:reserve` + `tiers.effectiveCommissionRate`
- [x] **EUR normalization** `commissionAmount = totalEur * rate`; EUR at reserve, USD backfilled at confirm. `Ref:` [Guide §9 USD/EUR flow](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts`, `bookings.service.ts:finalizeConfirmation`
- [x] **Currency source = `Tour.defaultCurrency`, snapshotted to `Booking.currency`.** `Ref:` [Guide §9 currency anchor](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:reserve`
- [ ] **Currency-change guard** (block/relabel `defaultCurrency` change once prices exist). `Ref:` [Guide §9 currency-change caveat](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · not verified/likely missing
- [x] **Listing price filter aligned to `priceFrom`** (not `basePrice`) (Phase 1). `Ref:` [Guide §9 listing filter gap](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `tours.service.ts:findAll`

---

## 4. Payment models & deposit/balance split

- [x] **`OPERATOR_LINK`** deposit = `total*depositPct`, balance = remainder. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`
- [~] **`ON_ARRIVAL` is a DEPOSIT model** (deposit = `total*depositPct`). Currently deposit=0. `Ref:` [Guide §2 note](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`, `payments.service.ts:chargeFor` (see flaw 1)
- [x] **`PAID_IN_FULL`** deposit/payToday = total, balance = 0. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`
- [ ] **`OPERATOR_FULL` rejected in v1** (dropped by founder; re-enable in v2). `Ref:` [Settlement Part 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `bookings.service.ts:reserve` (see flaw 6)
- [x] **Checkout charge lands in the Island Tours account** (single merchant of record, no per-operator account in v1). `Ref:` [Guide §2.2](./BOOKING-FLOW-DESIGN-GUIDE.md#22-who-receives-the-money-per-leg) · `Code:` `payments.service.ts`
- [x] **Deposit models self-settle** (`commission == deposit_pct`; operator collects balance directly). `Ref:` [Settlement Part 2 decision 1](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · confirm `deposit_pct == commission` invariant per tier

---

## 5. Payment flow (intents, webhooks, confirmation)

- [x] **Charge models create `ON_HOLD` + `utcExpiresAt`; payment intent per booking.** `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `bookings.service.ts:reserve`, `payments.service.ts:createIntentForBooking`
- [x] **Intent idempotent per `(bookingId, kind)`** (Stripe idem key + deterministic Payment row id). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow), [§17 payment](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `payments.service.ts`
- [~] **`chargeFor` charges the deposit for `ON_ARRIVAL`.** Currently returns null. `Ref:` [Guide §20.7](./BOOKING-FLOW-DESIGN-GUIDE.md#207-fix-payment-intent-charge-logic) · `Code:` `payments.service.ts:chargeFor` (see flaw 1)
- [x] **Charge currency = `Booking.currency`** (not `Tour.defaultCurrency`). `Ref:` [Guide §20.7](./BOOKING-FLOW-DESIGN-GUIDE.md#207-fix-payment-intent-charge-logic) · `Code:` `payments.service.ts`
- [x] **Stripe webhook `@Public()` + `@SkipThrottle()`, raw-body signature verify, idempotent (record event id before processing).** `Ref:` [Guide §10, §17](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `payments.controller.ts`, `payments.service.ts:handleWebhook`, `main.ts` rawBody
- [x] **On success: Payment -> SUCCEEDED, booking ON_HOLD -> CONFIRMED, billing/card snapshot from provider.** `Ref:` [Guide §4 steps 19-21](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `payments.service.ts:onIntentSucceeded`, `bookings.service.ts:confirmFromPayment`
- [~] **Mollie webhook confirms bookings.** Ledger-only stub; no status map/confirm. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `payments.service.ts:handleMollieWebhook` (see flaw 7)
- [x] **`OPERATOR_FULL` bypasses charge/webhook, created CONFIRMED at commit** (v2 behavior; keep for when it returns). `Ref:` [Guide §10 operator_full](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `bookings.service.ts:reserve`
- [ ] **Payment-succeeds-after-hold-expired reconciliation** (confirmFromPayment only confirms when ON_HOLD; an expired booking whose payment later settles must be voided/refunded). `Ref:` [Guide §17 payment](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:confirmFromPayment` (no refund/void branch)

---

## 6. Multi-currency (shopper currency, quote)

> Full reference: [../02-architecture/FX-AND-MULTI-CURRENCY.md](../02-architecture/FX-AND-MULTI-CURRENCY.md) (how conversion works, providers, env vars, booking snapshots, spotlight commission).

- [x] **`ReserveBookingDto` accepts `currency` and `quoteId`.** `Ref:` [Guide §20.3](./BOOKING-FLOW-DESIGN-GUIDE.md#203-add-shopper-currency-to-dtos) · `Code:` `dto/booking.dto.ts`. `currency` drives the charged currency (default = tour currency); `quoteId` accepted for forward-compat (reserve recomputes server-side, guide §20.8).
- [x] **`POST /bookings/quote` server-authoritative quote** (deposit/balance, commission, per-line breakdown, expiry, FX source/booking snapshot). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · `Code:` `bookings.service.ts:quote()` + `bookings.controller.ts` (`@Public()`, static route before `:id`). Reuses `loadContext` + `computeBookingPricing` (UNIT + FX aware), no side effects; returns booking-currency totals + `source*` + both rates + `quoteId`/`expiresAt` (15 min). **Still deferred:** DB-backed quote + input-hash revalidation; `couponCode` discount preview (flaw #2).
- [x] **Pricing util converts source -> booking currency + writes source fields.** `Ref:` [Guide §20.5](./BOOKING-FLOW-DESIGN-GUIDE.md#205-convert-pricing-utility) · `Code:` `booking-pricing.util.ts:computeBookingPricing` (source/booking currency + `sourceFxRateToBooking`/`fxRateToEur` inputs; per-line conversion; `source*` outputs). Booking snapshots the source fields + FX provenance (`bookings.service.ts:resolvePricing` + reserve create). 5 conversion tests (util + service).
- [~] **Provider-backed FX (pair conversion USD<->EUR, refresh, freshness rules, fail-closed for checkout).** `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `src/fx/` (`FxRate` table, `FxModule`, `FxRatesService` getRate/getDisplayRate/convert/refreshRates, `StaticFxProvider`, fail-closed 503, lazy refresh, stale-display window). **BUILT with a dev/static provider + DB cache; still to do:** a real provider impl (Stripe FX Quotes per guide) behind the same interface (~1 class + 1 `FxModule` line - the seam is ready).
- [x] **FX refresh scheduler + startup warm-up (M4).** `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `src/fx/fx-refresh.service.ts` (`FxRefreshService`): startup `refreshRates()` + dynamic `SchedulerRegistry` interval every `FX_RATE_REFRESH_MINUTES` (default 30, validated in `env.validate.ts`); non-fatal (logged + swallowed, boot never blocks); in-process `@nestjs/schedule` (no BullMQ, matches `NightlyJobsService`); interval cleared on destroy. 5 tests (`fx-refresh.service.spec.ts`).
- [x] **Public tour/search/detail APIs return converted `money` object + accept `currency`.** `Ref:` [Guide §20.9](./BOOKING-FLOW-DESIGN-GUIDE.md#209-update-public-tour-apis) · `Code:` `MoneyDto` (`src/fx/dto/money.dto.ts`) + `FxRatesService.buildMoney` + `ToursService.attachMoney`/`HubService.attachHubMoney`. `?currency` on tours list/detail/by-id, `/search`, collection render, hub render + our-picks/comparison; each card/detail carries `money{currency,sourceCurrency,fxRate,priceFrom,basePrice}` (falls back to source currency when no rate, never blocks). **Deferred:** collection `getBySlug`/`getActive` + hub hero/collection fastStats aggregates stay source-currency (frontend can derive display from card `money`).
- [~] **TYP/email render booking charged currency, not shopper cookie.** `Ref:` [Guide §20.10](./BOOKING-FLOW-DESIGN-GUIDE.md#2010-update-typ-and-email) · `Code:` TYP (`getThankYou`) + email already render `Booking.currency`/`totalRetail`/deposit/balance (never tour currency). Re-verify when the frontend currency selector lands (M5).
- Full sub-checklist: [Guide §23 Multi-Currency Checklist](./BOOKING-FLOW-DESIGN-GUIDE.md#23-multi-currency-checklist).

---

## 7. Hold expiry

- [x] **Expiry logic** (find ON_HOLD past `utcExpiresAt`, release seats, mark unit items + booking EXPIRED, idempotent). `Ref:` [Guide §11](./BOOKING-FLOW-DESIGN-GUIDE.md#11-hold-expiry) · `Code:` `bookings.service.ts:expireStaleHolds`
- [ ] **Scheduled sweeper wiring** (BullMQ repeatable / cron drives `expireStaleHolds`). `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory), [§5.4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#54-delayed-and-scheduled-jobs) · unwired (see flaw 4)
- [x] **Seat release recomputes departure status** (SOLD_OUT -> OPEN when seats free). `Ref:` [Guide §7](./BOOKING-FLOW-DESIGN-GUIDE.md#7-departure-state-machine) · `Code:` `bookings.service.ts:releaseSeats/recomputeStoredStatus`

---

## 8. Cancellation & refunds

- [x] **Cancel releases seats, marks unit items + booking CANCELLED (with cancelledBy/reason/timestamps), in a transaction.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- [x] **Refund eligibility judged at request timestamp** (not admin action). `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel/computeRefund`
- [x] **Deadline computed = tour start - `cancellationHours`, never stored.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:computeRefund`
- [~] **Payment-model-aware refund amount.** Only FULL/NONE category is returned; no deposit-only vs full-amount computation per model, no partial. `Ref:` [Guide §14 rules](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow), [§17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- [x] **`ON_HOLD` cancellation = no refund** (nothing paid). `Ref:` [Guide §17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- [x] **Operator-forced cancellation -> full refund / free reschedule (`force`).** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- [ ] **Actual Stripe REFUND execution + `REFUND` Payment row** on cancellation (compute + issue refund, not just categorize). `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · not implemented (refund is a category only)
- [~] **Tokenized cancel confirmation page (no raw-click cancel) + account fallback.** PAGE BUILT 2026-07-16 per master 6.4: locale-less `/cancel/{publicRef}` (proxy rewrite, noindex), "Cancel {tour}, {date}?" + refund chip only when paid > 0 (C23) + after-window locked copy; `POST /bookings/typ/:publicRef/cancellation-request` stamps `utcCancellationRequestedAt` on FIRST request and emails admin + traveller ack + operator notice. REMAINING: the email+display_ref booking-lookup login (B.34 account fallback). `Ref:` [Guide §14 flow](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:requestCancellation`, `frontend app/(frontend)/[locale]/cancel/`

---

## 9. Operator non-payment / forfeit

- [ ] **Operator reports non-payment -> admin confirms -> only then forfeit deposit + release spot** (no auto-forfeit, no balance tracking in v1). `Ref:` [Guide §15](./BOOKING-FLOW-DESIGN-GUIDE.md#15-operator-non-payment--forfeit) · not built

---

## 10. TYP & tracking / conversion

- [x] **`GET /bookings/typ/:publicRef` public; conversion object gated on CONFIRMED + non-null EUR commission.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou`
- [x] **Null `commissionAmount` on confirmed booking treated as data corruption -> no conversion.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou/finalizeConfirmation`
- [x] **Mark-first idempotency via `conversionFiredAt` (DB, not localStorage).** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:finalizeConfirmation`
- [x] **Conversion value = `commissionAmount` EUR, never GMV.** `Ref:` [Guide §9 tracking value](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [Settlement - tracking](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#tracking-stays-unchanged) · `Code:` `tracking.service.ts`
- [ ] **Click-id (gclid/gbraid/wbraid/fbclid) + UTM captured at reserve.** Columns exist, not wired. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `bookings.service.ts:reserve` (see flaw 9)
- [ ] **One `booking_complete` -> 4 GTM tags + Meta CAPI (server-side, dedup by event id).** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · frontend GTM + CAPI job pending

---

## 11. Confirmation email & notifications

- [x] **One dynamic confirmation email, payment-model-aware, zero-amount rows hidden.** Now the LOCKED wireframe template (2026-07-16): byte-for-byte port with style-parity CI guard, Cloudinary PNG icons, fluid-hybrid mobile + founder spacing refinement, 24h times/locale money-dates, `[EACH]` bullet lists, operator-note card, subject <24h variant, real text/plain part. Old `booking-confirmation.template.ts` DELETED. `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `templates/booking-confirmation-email.template.html`, `bookings/booking-email.context.ts`, `bookings.service.ts:sendConfirmationEmail`
- [x] **Operator "Booking Received" notification (C7)** on every confirmed booking to `companyInfo.companyEmail ?? contactEmail`; same shell (zero-new-styles spec); per-model action copy. (2026-07-16) `Code:` `templates/operator-booking-received.template.html`, `bookings.service.ts:sendOperatorNotification`
- [x] **Cancellation-request emails x3** (admin work-item [throws], traveller ack, operator heads-up via shared `booking-notice.template.html`). Final post-admin confirmations (locked 3-to-5-business-days copy, C23-aware) = CP6 scope. (2026-07-16)
- [x] **TYP resend endpoint** (`POST /bookings/typ/:publicRef/resend`, hard-throttled, recipient never caller-supplied) + **ICS calendar endpoint** (`GET .../calendar.ics`, RFC 5545, real UTC). (2026-07-16)
- [ ] **Operator-balance email on `operator_link`** (names operator, secure balance link). `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · no such template
- [ ] **Invoice attachment (from Stripe/Mollie) on confirmation.** `Ref:` [Guide §4 step 22](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · not implemented
- [ ] **Pre-tour reminder (24h before; "today/tomorrow" variant; no payment links).** `Ref:` [Guide §13 sequence](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · not built
- [~] **Provider is Resend (Postmark fallback).** Currently nodemailer/SMTP. `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `mail.service.ts` (SMTP)
- [ ] **Never name/spotlight operator before payment; name deliberately post-booking on operator_link.** `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · verify in template copy

---

## 12. Settlement & payouts

- [ ] **Write one `Settlement` row per booking at confirmation** (all models; deposit models net ~0). `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · not built
- [ ] **`paid_in_full` scheduled payout after the cancellation window (clawback-safe): RECORDED -> PAID_OUT.** `Ref:` [Settlement Part 2 decision 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · not built
- [ ] **`net_position` sign convention** (+ IT owes operator, - operator owes IT) enforced in writes. `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · not built
- [ ] **v2: `operator_full` reintroduced (Connect or bank transfer) + commission collection rail.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred
- [ ] **v2: Stripe Connect Express (destination charge, application_fee = commission), ledger from Stripe events.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred

---

## 13. Event-driven & queues

- [x] **BullMQ + `@nestjs/schedule` installed and wired** (queues exist for media-upload, notifications; one nightly cron). `Ref:` [Queues §6](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#6-implementation-notes-bullmq--nestjs) · `Code:` `app.module.ts`, `workers/nightly-jobs.service.ts`
- [x] **Synchronous transactional core** (seat claim + booking + payment intent stay off the queue). `Ref:` [Queues §3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#3-the-pattern-synchronous-core-asynchronous-edges) · `Code:` `bookings.service.ts:reserve`
- [ ] **Transactional outbox** (write `OutboxEvent` in the booking transaction; relay -> BullMQ). `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · not built (see flaw 5)
- [ ] **Confirmation-email job (queued, retry+backoff)** instead of inline send. `Ref:` [Queues §4, §5.3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · inline today
- [ ] **CAPI conversion job (queued, idempotent by event id).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · inline today
- [ ] **Hold-expiry sweep job (repeatable).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · unwired (flaw 4)
- [ ] **Scheduled `paid_in_full` payout job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [ ] **Pre-tour reminder job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [ ] **Affiliate postback job (delayed, approve after window).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [~] **Nightly quality-score / eligibility / materialization (cron).** Materialization/bookability/spotlight/demand done; quality-score + tier eligibility/grace/demotion are TODOs. `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · `Code:` `workers/nightly-jobs.service.ts`
    - Note - **materialization horizons** (the inventory `departures` are generated by this job): create-time materialize uses a **90-day** default window; the nightly cron uses a **364-day** rolling 12-month window (`from` = today, slides forward one day per night); `MAX_HORIZON_DAYS = 365` cap; `BOOKABLE_HORIZON_DAYS = 30` is the separate ranking/bookability gate, not a generation horizon. Sharp edges: a new schedule shows only 90 days until the next 3 AM run; the 12-month horizon depends on the nightly cron running. Full detail: [Availability §3.1](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#31-materialization-horizons-as-built).
- [~] **Idempotent consumers** (DB guards exist: `conversion_fired_at`, `stripe_webhook_events`). Once jobs move to the queue, add `jobId` dedup + keep DB guards; do not rely on jobId alone. `Ref:` [Queues §5.1](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers) · partly present
- [ ] **Retries + exponential backoff, and keep failed jobs (no silent drop).** `Ref:` [Queues §5.3, §5.5](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#53-retries-and-backoff) · applies once jobs are queued
- [x] **No queue for capacity/overbooking** (atomic update is the control). `Ref:` [Queues §2, §7](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue) · `Code:` `bookings.service.ts:reserve`

---

## 14. API surface & access

- [x] **Routes:** `POST /bookings`, `POST /bookings/:id/confirm|cancel|extend`, `PATCH /bookings/:id`, `GET /bookings/typ/:publicRef`, `GET /bookings`, `GET /bookings/:id`. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`
- [x] **`POST /bookings/quote`** (`@Public()`, static route before `:id`). `Ref:` [Guide §16 / §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · `Code:` `bookings.controller.ts:quote()` (stateless single-currency; see §6)
- [x] **Access rules:** booking create + TYP public; list/detail auth-scoped; webhooks bypass auth+throttle with signature verify. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`, `payments.controller.ts`
- [x] **No raw Prisma rows returned; status/commission/tier not client-settable.** `Ref:` [Guide §17 security](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` DTO `select` shapes

### 14b. Dashboard operations pages (added 2026-07-16, founder request)

Three new dashboard menus, each reusing the tours TanStack table pattern (same UI, pagination,
comprehensive filters, search, date-range) and permission-gated per master RBAC + `lib/config/rbac.ts`
(operators scoped to their own tours' rows; admin sees all).

- [ ] **Bookings list page** (`/dashboard/bookings`): ref, tour, traveller, date, party, payment
  model, amounts, status; backend list endpoint w/ query DTO (status/model/date-range/search) +
  operator scoping. `Task:` DASH1
- [ ] **Payments list page** (`/dashboard/payments`): booking ref, tour, charged/deposit/balance,
  currency, intent status, model, timestamps; backend endpoint + scoping. `Task:` DASH2
- [ ] **Cancellation Requests page** (`/dashboard/cancellation-requests`): bookings with
  `utcCancellationRequestedAt` set - requested-at, tour date, in/out of free-window judgement,
  refund amount, status. This is where the admin executes master 6.4 (mark cancelled -> final
  emails + CP6 refund). `Task:` DASH3

---

## 15. Edge cases (Guide §17) - verification matrix

`Ref:` [Guide §17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases), [Queues §8](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#8-mapping-to-the-booking-flow-edge-cases)

- [x] Two users race last seats -> one guarded update wins.
- [x] Departure closes / cutoff passes after read -> submit fails (`WHERE status='open'` + live cutoff).
- [x] Party size exceeds remaining -> claim fails.
- [x] Payment intent retried -> same provider intent (idem key).
- [x] Webhook redelivered -> skipped via event ledger.
- [ ] Payment succeeds after hold expired -> reconcile/void/refund (not handled).
- [x] Payment fails -> booking stays ON_HOLD until retry/expiry.
- [x] Later tier/price/age-band/add-on/pickup edits do not mutate existing bookings (snapshots).
- [x] TYP refresh / email revisit does not double-fire conversion.
- [x] `publicRef` UUID non-enumerable; `displayRef` + email required for account access.
- [~] Cancellation admin latency cannot reduce refund (request-time judged) - but refund is category-only.
- [x] `PAID_IN_FULL` refund references full payment; deposit models reference deposit - **note:** currently only FULL/NONE category, amount not differentiated.

---

## 16. Locked master decisions to hold the line on (Guide §1)

`Ref:` [Guide §1](./BOOKING-FLOW-DESIGN-GUIDE.md#1-locked-master-decisions)

- [x] Booking is instant (no enquiry / 24h approval).
- [x] Inventory source of truth = `departures`.
- [x] Capacity claimed with one guarded atomic update.
- [x] `payment_model` snapshotted; tier/commission never retroactive.
- [x] `commission_amount` EUR is the conversion value; never GMV.
- [x] TYP `/{destination}/thank-you/{public_ref}`, no locale prefix, noindex.
- [x] `public_ref` unguessable; `display_ref` customer-facing.
- [x] One `cancellation_hours` window `[24,48,72,168]` default 48.
- [x] Cancellation deadline computed, never stored.
- [x] `operator_link` balance not tracked by Island Tours v1.
- [ ] Deposit forfeiture never automatic (operator report -> admin confirm).
- [x] Webhooks `@Public()` + `@SkipThrottle()`, signature-verified, idempotent.
- [x] Checkout charge lands in the Island Tours account (merchant of record); Connect routing is v2 (settlement rails).

---

## Build-order suggestion (to avoid new flaws)

1. Fix pricing correctness first: `ON_ARRIVAL` deposit, discount application, `UNIT` pricing (flaws 1-3). These affect money on every affected booking.
2. Reject `OPERATOR_FULL` in v1 reserve (flaw 6). One guard, prevents payment bypass.
3. Wire the hold-expiry sweeper (flaw 4). Stops phantom sold-outs.
4. Add the outbox + move confirmation email and CAPI to queued, idempotent jobs (flaw 5). Fixes lost conversions.
5. Add the `Settlement` model + write rows at confirmation; then the scheduled `paid_in_full` payout job (flaw 8, §12).
6. Capture attribution at reserve (flaw 9), then finish Mollie confirm (flaw 7).
7. Then multi-currency (quote endpoint, source fields, provider FX) as its own phase (§6, Guide §19-23).

Recommended sequence

1. Frontend, unblocked (steps 1-4): wire live data (data={buildTourBookingData(detail)}), add the 2 missing type fields + widen availability types, then payment-model conditional (CTA/money-rows/trust), real availability, pickup, add-ons. This ships a working dynamic card.
2. Backend slice (before step 6): UNIT pricing + POST /bookings/quote + the 3 flaws + /payment/processing's webhook dependency.
3. Frontend, money phase (steps 5-7): UNIT UI, real submission -> quote -> booking POST -> Stripe element -> processing page -> TYP real data + conversion.

One caveat worth flagging: for anything persisted (the actual booking total), the client math in deriveBooking/computeCheckoutTotals must not be authoritative - the server quote wins. During phase 1 that's fine as a display estimate; just don't let it become the source of truth for a real booking. That's exactly the phase-2 boundary above.

---

## Deferred follow-ups (discovered during the Stripe payment-flow build, 2026-07-16)

- [ ] **Pickup pricing / "Pickup location (From $X p.p.)" label.** The master checkout
  Contact spec calls for `"Pickup location (From $X p.p.)"` with "operator zones with
  prices" and an "Other location, we'll confirm via WhatsApp" fallback. The fallback +
  zone selection are built, but **no pickup price exists in the data model**:
  `PickupLocation` has no `price` column (only `pickupModel` = INCLUDED/PAID_ADDON/NONE),
  so `PublicPickupLocation` exposes none and the label falls back to plain "Pickup
  location". To implement faithfully: add `price Decimal` to `PickupLocation` (+ migration),
  FX-convert + expose it on `PublicPickupLocation` (like tour prices under `?currency`),
  then compute the min across zones for the `(From {price} p.p.)` suffix (master: no
  `$0.00` decimals -> hide when the min is 0 / `INCLUDED`) and show each zone's price in
  its option label. Frontend already threads `pickupFromLabel` (currently null).

- [x] **Real-data TYP payload expansion** (DONE 2026-07-16). `ThankYouResponseDto` +
  `getThankYou` now return guest name/phone, party grouped by age band, deposit/balance +
  `paymentModel`, card brand/last4, `durationMinutes`, `cancellationHours`, the computed
  free-cancel deadline (local + UTC), and operator contact (via the `companyInfo` join;
  OCTO supplier contact wins, company profile is the fallback). **No migration** - every
  field already existed on `Booking`. The frontend `getThankYouBooking` calls `getTypByRef`
  and composes all labels locale-side (`en` dates remapped to `en-GB` day-then-month order
  per Figma; times stay 12-hour); the demo payload is deleted and cross-sell now fetches
  **real** destination tours (`getThankYouRelatedTours`, booked tour excluded, section
  self-hides on empty). Verified live on `4ce3c7c1-…`. `Code:` `bookings.service.ts:getThankYou`,
  `dto/booking.dto.ts`, `lib/thank-you/thank-you.ts`, `lib/api/public/bookings.ts`, TYP `page.tsx`

### Fixed during this build

- [x] **Reserve 500 - overbooking-guard raw SQL used snake_case columns.** The atomic
  seat-claim `$executeRaw` (and `releaseSeats`) referenced `tour_id`/`booked_count`/
  `sold_out_at`/`updated_at`, but this schema has no `@map` so the real columns are
  camelCase (`"tourId"`/`"bookedCount"`/`"soldOutAt"`/`"updatedAt"`). Postgres `42703`
  -> 500 on every reserve. Unit tests mock `$executeRaw`, so it never surfaced.
  **Refactored** the 4 raw blocks (2 reserve claim + 2 `releaseSeats`) to type-safe
  Prisma `updateMany`/`update` + `recomputeStoredStatus` (atomic guard via a pre-computed
  `capacity - seats` threshold from an in-txn capacity read; `GREATEST(0,...)` clamp via
  read-modify-write). `bookings.service.spec.ts` still needs its `$executeRaw` mocks/asserts
  swapped to `departure.updateMany`/`update` before the suite is green.

- [x] **PaymentIntent currency/method 500 (Klarna-on-EUR).** Forcing the configured method
  list on the intent hit "currency invalid for payment method type klarna" (USD-only).
  Switched `createIntentForBooking` to Stripe `automatic_payment_methods` (account-activated +
  currency-compatible only) and return `payment_method_types` so the checkout gates methods.

---

## Tracking, analytics & transactional email (master §6/§8) - ACTUAL STATUS (2026-07-16)

The booking->payment->processing->TYP **money flow** is aligned with §8.2 (processing hop
= webhook-wait/zero-tags; idempotent webhook via `stripe_webhook_events`; redirect to
`/{destination}/thank-you/{public_ref}` with `public_ref` a UUID; TYP noindex/locale-less).
The **analytics half of §8.2/§8.3 is NOT built**, and there is one correctness risk to
reconcile before it is:

- [ ] **1. `booking_complete` browser push on the TYP.** Master §8.2/§8.3: the TYP server
  component hashes PII + sets `conversion_fired_at` before render (mark-first), the client
  pushes `booking_complete` **once** (prod only, staging guard), GTM fans out to Conversion
  Linker / Google Ads / GA4 purchase / Meta Pixel, and CAPI posts server-side with the shared
  event id. **None of this exists** (tracking module is "to build"; TYP still renders demo data).

- [ ] **2. FIRE-POINT RECONCILIATION (do this first - double-fire risk).** We set
  `conversion_fired_at` and fire the conversion at **webhook-confirm** (server,
  `finalizeConfirmation`), *before any TYP visit*. Master fires at **TYP render** (mark-first)
  via the **browser** push. These are incompatible as-is: a browser push gated on
  `conversion_fired_at` would **never fire** (already set at confirm), and `getThankYou`
  currently returns the `conversion` payload on **every** visit with no once-guard -> the
  client pixel would **double-fire** (violates §8.1 item 5). Fix when wiring tracking: keep
  the server CAPI at confirm, and add a **separate** "browser-push delivered" guard
  (e.g. `conversion_pushed_at`) so the TYP push fires exactly once, independent of the
  server-side `conversion_fired_at`.

- [ ] **3. Operator balance email (`operator_link`).** Master §6: on `operator_link` a
  **second** operator-balance email follows the Island Tours confirmation. The IT confirmation
  email is wired (`sendConfirmationEmail`); the **operator balance email is not**.

- [x] **4. Real-data TYP - DONE 2026-07-16** (detail in "Deferred follow-ups" above). Backend
  payload expanded + frontend mapped to real data; demo payload deleted; cross-sell fetches real
  tours. Verified live. The `booking_complete` push (item 1) now has real values to send.
  **Finding raised:** `paymentMethodBrand`/`paymentMethodLast4` came back **null** on a paid
  OPERATOR_LINK booking, so the TYP card line is empty - §5 marks the billing/card snapshot `[x]`,
  so confirm whether the Stripe webhook path actually writes it.

- [ ] **5. PII hashing** (server-side SHA-256 of email/phone[libphonenumber-normalized]/name/
  address) for Enhanced Conversions + Advanced Matching (§8.1 item 3).

- [ ] **6. Meta CAPI** (server, parallel to the Pixel, dedup by shared event id) - needs the
  Meta Pixel id + CAPI access token (external creds).

- [ ] **7. GTM container + tag fan-out** - the frontend pushes to `dataLayer`; the container +
  4 tags are configured in the GTM web UI (needs a GTM container id).

- [ ] **8. Consent Mode v2 + CMP** (EEA denied by default, US/CA granted) - needs a CMP choice
  (Cookiebot or Iubenda) before the GTM build (§8.1 item 7).

> Cross-refs: `technical-doc/02-architecture/TRACKING-AND-ANALYTICS.md`, master §8. Booking
> rule #22 (conversion = EUR `commission_amount`, never GMV) already enforced server-side.

