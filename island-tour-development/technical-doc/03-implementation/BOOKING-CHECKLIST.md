# Booking Checklist - complete task ledger

> Scope: every task and logic rule across the three booking/settlement/queue docs, cross-checked against
> the current schema and backend code (audited 2026-07-15). This is booking-domain-specific and
> complements [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).
>
> Source docs (each task links to where it is described):
> - Flow: [BOOKING-FLOW-DESIGN-GUIDE.md](./BOOKING-FLOW-DESIGN-GUIDE.md)
> - Settlement: [../02-architecture/SETTLEMENT-AND-PAYOUTS.md](../02-architecture/SETTLEMENT-AND-PAYOUTS.md)
> - Queues: [../02-architecture/EVENT-DRIVEN-AND-QUEUES.md](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md)
> - Canonical: `technical-doc/island-tours-platform-master.html` v1.9 (wins on any conflict)

## Status legend

- `[x]` built and matches the spec
- `[~]` partial or deviates from spec (needs fix)
- `[ ]` not built
- Each item ends with `Ref:` (the doc section it comes from) and, where relevant, `Code:` (file:symbol) plus a gap note.

---

## 0. Critical flaws to fix first (things that can produce wrong money or lost data)

These are ranked. Each is expanded in its section below.

1. `[~]` **`ON_ARRIVAL` collects no deposit.** Code treats it as zero-upfront; the master says it is a deposit model. Result: no deposit captured, commission at risk. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models), [Guide §9 deposit/balance](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts:splitDeposit`, `payments.service.ts:chargeFor`
2. `[~]` **Discount/coupon stored but never applied.** `discountAmount`/`couponCode` are written to the booking but not subtracted from `totalRetail`/deposit/commission. Traveler is over-charged and commission is computed on the wrong base. `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts`
3. `[ ]` **`UNIT` pricing unimplemented.** Only per-person age-band pricing works; charter/whole-unit tours cannot be priced or booked. `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:loadContext` (does not select `pricingModel/basePrice/unitIncludedGuests/extraPersonPrice`)
4. `[ ]` **Hold-expiry sweeper not scheduled.** `expireStaleHolds()` exists but no cron/queue calls it, so expired holds keep seats and cause phantom sold-outs. `Ref:` [Guide §11](./BOOKING-FLOW-DESIGN-GUIDE.md#11-hold-expiry), [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · `Code:` `bookings.service.ts:expireStaleHolds` (unwired)
5. `[~]` **Conversion/email fire inline with mark-first stamp, no queue/outbox.** `conversionFiredAt` is set before email/CAPI run; a CAPI/email failure is then never retried and the conversion is lost. `Ref:` [Queues §5.1](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers), [§5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · `Code:` `bookings.service.ts:finalizeConfirmation`
6. `[ ]` **`OPERATOR_FULL` not rejected in v1.** The founder dropped it for v1, but reserve still accepts it and creates a confirmed, payment-free booking - an operator could bypass payment. `Ref:` [Settlement Part 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `bookings.service.ts:reserve`
7. `[~]` **Mollie webhook is a stub.** It records the event but never confirms the booking; Mollie-paid bookings never reach CONFIRMED. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `payments.service.ts:handleMollieWebhook`
8. `[ ]` **No settlements ledger.** Required in v1 for `paid_in_full` payout and future extension. `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later)
9. `[ ]` **Attribution never captured at reserve.** utm/click-id/affiliate columns exist but are not in the DTO or written; conversion adjustments and affiliate attribution break. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities), [Tracking](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#tracking-stays-unchanged) · `Code:` `bookings.service.ts:reserve`, `dto/booking.dto.ts:ReserveBookingDto`

---

## 1. Data model & schema

- `[x]` **`Booking` core fields** (publicRef, displayRef, status, paymentModel, currency, totalRetail, deposit/balance, commissionRate/Amount, totalEur, fxRateToEur, local date/time, tour start/end/tz, contact split, utcExpiresAt, utcCancellationRequestedAt, conversionFiredAt, billing + card snapshot). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma:Booking`
- `[x]` **`BookingUnitItem`** (one per traveler, priceRetail/priceNet, ticket fields). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- `[x]` **`BookingAddOn`** (snapshotted line items). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- `[x]` **`Payment`** with kinds DEPOSIT/BALANCE/FULL/REFUND. `Ref:` [Guide §3 Payment](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/payments.prisma`
- `[x]` **`Departure`** (capacity, bookedCount, status OPEN/CLOSED/SOLD_OUT/CANCELLED, soldOutAt, source, manuallyEdited). `Ref:` [Guide §3 Departure](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/availability.prisma`
- `[x]` **`stripe_webhook_events`** idempotency table (+ `mollie_webhook_events`). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `prisma/payments.prisma`
- `[ ]` **`Settlement` model + `SettlementStatus` enum** (amountCollected, commissionOwed, netPosition, operatorPayout, status, externalRef). `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · ABSENT
- `[ ]` **`OutboxEvent` model** for the transactional outbox. `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · ABSENT
- `[ ]` **Source-currency fields on `Booking`** (sourceCurrency, sourceTotalRetail, sourceDepositAmount, sourceBalanceAmount, sourceFxRateToBooking). `Ref:` [Guide §20.2](./BOOKING-FLOW-DESIGN-GUIDE.md#202-add-booking-schema-snapshots) · ABSENT (only booking-currency + EUR fields exist)
- `[ ]` **`FxRate` table** (provider-backed rates, refresh, expiry). `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · ABSENT
- `[ ]` **`BookingQuote` model** (if quote is DB-backed). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · ABSENT
- `[~]` **Distinct `gclid` column.** Only a generic `clickId` exists; the tracking spec names `gclid` separately. Decide whether to rename/split. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma:clickId`

---

## 2. Booking creation (reserve) - validation & atomic claim

- `[x]` **Single atomic guarded UPDATE on `departures`** (increment with `WHERE status='open' AND booked_count+seats<=capacity`, 0 rows -> fail), inside a transaction; no check-then-increment split. `Ref:` [Guide §8](./BOOKING-FLOW-DESIGN-GUIDE.md#8-atomic-capacity-claim), [Queues §2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue) · `Code:` `bookings.service.ts:reserve`
- `[x]` **Booking + unit items + add-on snapshots created in the same transaction.** `Ref:` [Guide §4 step 11](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:reserve`
- `[x]` **Validate: tour exists; departure belongs to tour; cutoff not passed; party min/max; add-ons active & belong to tour; pickup belongs to tour.** `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:loadContext/validateRestrictions/cutoffReached`
- `[~]` **Age-restriction validation.** Only tour minimum age is enforced, and only when `travelerAge` is supplied (ages optional); no max age, no requirement that ages cover all seats. `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:validateRestrictions`
- `[x]` **All party bands (incl. infants/spectators) count toward capacity** (one unit item each). `Ref:` [Guide §3 BookingUnitItem](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `bookings.service.ts:reserve`
- `[ ]` **Whole-unit/private-charter claims the whole departure** when the product is exclusive. `Ref:` [Guide §9 UNIT capacity](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [§17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · not implemented (UNIT path missing)

---

## 3. Pricing & commission logic

- `[x]` **Retail total from age bands + add-on line totals** (PER_PERSON `unitPrice*qty*pax`, FLAT `unitPrice*qty`). `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts`
- `[ ]` **`UNIT` pricing** `basePrice + max(0, pax - unitIncludedGuests) * extraPersonPrice`. `Ref:` [Guide §9 UNIT](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · MISSING (see flaw 3)
- `[~]` **Discount applied to totals.** Stored but not subtracted. `Ref:` [Guide §9 retail total](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts` (see flaw 2)
- `[x]` **Commission snapshot** `commissionRate = effectivePct/100`, spotlight overlay applied, never retroactive. `Ref:` [Guide §9 commission](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:reserve` + `tiers.effectiveCommissionRate`
- `[x]` **EUR normalization** `commissionAmount = totalEur * rate`; EUR at reserve, USD backfilled at confirm. `Ref:` [Guide §9 USD/EUR flow](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `booking-pricing.util.ts`, `bookings.service.ts:finalizeConfirmation`
- `[x]` **Currency source = `Tour.defaultCurrency`, snapshotted to `Booking.currency`.** `Ref:` [Guide §9 currency anchor](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · `Code:` `bookings.service.ts:reserve`
- `[ ]` **Currency-change guard** (block/relabel `defaultCurrency` change once prices exist). `Ref:` [Guide §9 currency-change caveat](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · not verified/likely missing
- `[ ]` **Listing price filter aligned to `priceFrom`** (not `basePrice`). `Ref:` [Guide §9 listing filter gap](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic) · gap noted in doc

---

## 4. Payment models & deposit/balance split

- `[x]` **`OPERATOR_LINK`** deposit = `total*depositPct`, balance = remainder. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`
- `[~]` **`ON_ARRIVAL` is a DEPOSIT model** (deposit = `total*depositPct`). Currently deposit=0. `Ref:` [Guide §2 note](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`, `payments.service.ts:chargeFor` (see flaw 1)
- `[x]` **`PAID_IN_FULL`** deposit/payToday = total, balance = 0. `Ref:` [Guide §2](./BOOKING-FLOW-DESIGN-GUIDE.md#2-payment-models) · `Code:` `booking-pricing.util.ts:splitDeposit`
- `[ ]` **`OPERATOR_FULL` rejected in v1** (dropped by founder; re-enable in v2). `Ref:` [Settlement Part 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `bookings.service.ts:reserve` (see flaw 6)
- `[x]` **Checkout charge lands in the Island Tours account** (single merchant of record, no per-operator account in v1). `Ref:` [Guide §2.2](./BOOKING-FLOW-DESIGN-GUIDE.md#22-who-receives-the-money-per-leg) · `Code:` `payments.service.ts`
- `[x]` **Deposit models self-settle** (`commission == deposit_pct`; operator collects balance directly). `Ref:` [Settlement Part 2 decision 1](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · confirm `deposit_pct == commission` invariant per tier

---

## 5. Payment flow (intents, webhooks, confirmation)

- `[x]` **Charge models create `ON_HOLD` + `utcExpiresAt`; payment intent per booking.** `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `bookings.service.ts:reserve`, `payments.service.ts:createIntentForBooking`
- `[x]` **Intent idempotent per `(bookingId, kind)`** (Stripe idem key + deterministic Payment row id). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow), [§17 payment](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `payments.service.ts`
- `[~]` **`chargeFor` charges the deposit for `ON_ARRIVAL`.** Currently returns null. `Ref:` [Guide §20.7](./BOOKING-FLOW-DESIGN-GUIDE.md#207-fix-payment-intent-charge-logic) · `Code:` `payments.service.ts:chargeFor` (see flaw 1)
- `[x]` **Charge currency = `Booking.currency`** (not `Tour.defaultCurrency`). `Ref:` [Guide §20.7](./BOOKING-FLOW-DESIGN-GUIDE.md#207-fix-payment-intent-charge-logic) · `Code:` `payments.service.ts`
- `[x]` **Stripe webhook `@Public()` + `@SkipThrottle()`, raw-body signature verify, idempotent (record event id before processing).** `Ref:` [Guide §10, §17](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `payments.controller.ts`, `payments.service.ts:handleWebhook`, `main.ts` rawBody
- `[x]` **On success: Payment -> SUCCEEDED, booking ON_HOLD -> CONFIRMED, billing/card snapshot from provider.** `Ref:` [Guide §4 steps 19-21](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `payments.service.ts:onIntentSucceeded`, `bookings.service.ts:confirmFromPayment`
- `[~]` **Mollie webhook confirms bookings.** Ledger-only stub; no status map/confirm. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `payments.service.ts:handleMollieWebhook` (see flaw 7)
- `[x]` **`OPERATOR_FULL` bypasses charge/webhook, created CONFIRMED at commit** (v2 behavior; keep for when it returns). `Ref:` [Guide §10 operator_full](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `bookings.service.ts:reserve`
- `[ ]` **Payment-succeeds-after-hold-expired reconciliation** (confirmFromPayment only confirms when ON_HOLD; an expired booking whose payment later settles must be voided/refunded). `Ref:` [Guide §17 payment](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:confirmFromPayment` (no refund/void branch)

---

## 6. Multi-currency (shopper currency, quote)

- `[ ]` **`ReserveBookingDto` accepts `currency` and/or `quoteId`.** `Ref:` [Guide §20.3](./BOOKING-FLOW-DESIGN-GUIDE.md#203-add-shopper-currency-to-dtos) · `Code:` `dto/booking.dto.ts` (absent)
- `[ ]` **`POST /bookings/quote` server-authoritative quote** (converted lines, deposit/balance, fx snapshots, expiry, input hash). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · absent
- `[ ]` **Pricing util converts source -> booking currency + writes source fields.** `Ref:` [Guide §20.5](./BOOKING-FLOW-DESIGN-GUIDE.md#205-convert-pricing-utility) · absent
- `[ ]` **Provider-backed FX (pair conversion USD<->EUR, refresh, freshness rules, fail-closed for checkout).** `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `common/utils/fx.util.ts` is static, one-direction (USD->EUR) only
- `[ ]` **Public tour/search/detail APIs return converted `money` object + accept `currency`.** `Ref:` [Guide §20.9](./BOOKING-FLOW-DESIGN-GUIDE.md#209-update-public-tour-apis) · absent
- `[ ]` **TYP/email render booking charged currency, not shopper cookie.** `Ref:` [Guide §20.10](./BOOKING-FLOW-DESIGN-GUIDE.md#2010-update-typ-and-email) · verify once multi-currency lands
- Full sub-checklist: [Guide §23 Multi-Currency Checklist](./BOOKING-FLOW-DESIGN-GUIDE.md#23-multi-currency-checklist).

---

## 7. Hold expiry

- `[x]` **Expiry logic** (find ON_HOLD past `utcExpiresAt`, release seats, mark unit items + booking EXPIRED, idempotent). `Ref:` [Guide §11](./BOOKING-FLOW-DESIGN-GUIDE.md#11-hold-expiry) · `Code:` `bookings.service.ts:expireStaleHolds`
- `[ ]` **Scheduled sweeper wiring** (BullMQ repeatable / cron drives `expireStaleHolds`). `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory), [§5.4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#54-delayed-and-scheduled-jobs) · unwired (see flaw 4)
- `[x]` **Seat release recomputes departure status** (SOLD_OUT -> OPEN when seats free). `Ref:` [Guide §7](./BOOKING-FLOW-DESIGN-GUIDE.md#7-departure-state-machine) · `Code:` `bookings.service.ts:releaseSeats/recomputeStoredStatus`

---

## 8. Cancellation & refunds

- `[x]` **Cancel releases seats, marks unit items + booking CANCELLED (with cancelledBy/reason/timestamps), in a transaction.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- `[x]` **Refund eligibility judged at request timestamp** (not admin action). `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel/computeRefund`
- `[x]` **Deadline computed = tour start - `cancellationHours`, never stored.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:computeRefund`
- `[~]` **Payment-model-aware refund amount.** Only FULL/NONE category is returned; no deposit-only vs full-amount computation per model, no partial. `Ref:` [Guide §14 rules](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow), [§17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- `[x]` **`ON_HOLD` cancellation = no refund** (nothing paid). `Ref:` [Guide §17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- `[x]` **Operator-forced cancellation -> full refund / free reschedule (`force`).** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- `[ ]` **Actual Stripe REFUND execution + `REFUND` Payment row** on cancellation (compute + issue refund, not just categorize). `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · not implemented (refund is a category only)
- `[ ]` **Tokenized cancel confirmation page (no raw-click cancel) + account fallback.** `Ref:` [Guide §14 flow](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · frontend, not verified

---

## 9. Operator non-payment / forfeit

- `[ ]` **Operator reports non-payment -> admin confirms -> only then forfeit deposit + release spot** (no auto-forfeit, no balance tracking in v1). `Ref:` [Guide §15](./BOOKING-FLOW-DESIGN-GUIDE.md#15-operator-non-payment--forfeit) · not built

---

## 10. TYP & tracking / conversion

- `[x]` **`GET /bookings/typ/:publicRef` public; conversion object gated on CONFIRMED + non-null EUR commission.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou`
- `[x]` **Null `commissionAmount` on confirmed booking treated as data corruption -> no conversion.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou/finalizeConfirmation`
- `[x]` **Mark-first idempotency via `conversionFiredAt` (DB, not localStorage).** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:finalizeConfirmation`
- `[x]` **Conversion value = `commissionAmount` EUR, never GMV.** `Ref:` [Guide §9 tracking value](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [Settlement - tracking](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#tracking-stays-unchanged) · `Code:` `tracking.service.ts`
- `[ ]` **Click-id (gclid/gbraid/wbraid/fbclid) + UTM captured at reserve.** Columns exist, not wired. `Ref:` [Guide §3 Booking](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `bookings.service.ts:reserve` (see flaw 9)
- `[ ]` **One `booking_complete` -> 4 GTM tags + Meta CAPI (server-side, dedup by event id).** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · frontend GTM + CAPI job pending

---

## 11. Confirmation email & notifications

- `[x]` **One dynamic confirmation email, payment-model-aware, zero-amount rows hidden.** `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `mail.service.ts`, `templates/booking-confirmation.template.ts`, `bookings.service.ts:sendConfirmationEmail`
- `[ ]` **Operator-balance email on `operator_link`** (names operator, secure balance link). `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · no such template
- `[ ]` **Invoice attachment (from Stripe/Mollie) on confirmation.** `Ref:` [Guide §4 step 22](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · not implemented
- `[ ]` **Pre-tour reminder (24h before; "today/tomorrow" variant; no payment links).** `Ref:` [Guide §13 sequence](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · not built
- `[~]` **Provider is Resend (Postmark fallback).** Currently nodemailer/SMTP. `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `mail.service.ts` (SMTP)
- `[ ]` **Never name/spotlight operator before payment; name deliberately post-booking on operator_link.** `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · verify in template copy

---

## 12. Settlement & payouts

- `[ ]` **Write one `Settlement` row per booking at confirmation** (all models; deposit models net ~0). `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · not built
- `[ ]` **`paid_in_full` scheduled payout after the cancellation window (clawback-safe): RECORDED -> PAID_OUT.** `Ref:` [Settlement Part 2 decision 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · not built
- `[ ]` **`net_position` sign convention** (+ IT owes operator, - operator owes IT) enforced in writes. `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · not built
- `[ ]` **v2: `operator_full` reintroduced (Connect or bank transfer) + commission collection rail.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred
- `[ ]` **v2: Stripe Connect Express (destination charge, application_fee = commission), ledger from Stripe events.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred

---

## 13. Event-driven & queues

- `[x]` **BullMQ + `@nestjs/schedule` installed and wired** (queues exist for media-upload, notifications; one nightly cron). `Ref:` [Queues §6](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#6-implementation-notes-bullmq--nestjs) · `Code:` `app.module.ts`, `workers/nightly-jobs.service.ts`
- `[x]` **Synchronous transactional core** (seat claim + booking + payment intent stay off the queue). `Ref:` [Queues §3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#3-the-pattern-synchronous-core-asynchronous-edges) · `Code:` `bookings.service.ts:reserve`
- `[ ]` **Transactional outbox** (write `OutboxEvent` in the booking transaction; relay -> BullMQ). `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox) · not built (see flaw 5)
- `[ ]` **Confirmation-email job (queued, retry+backoff)** instead of inline send. `Ref:` [Queues §4, §5.3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · inline today
- `[ ]` **CAPI conversion job (queued, idempotent by event id).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · inline today
- `[ ]` **Hold-expiry sweep job (repeatable).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · unwired (flaw 4)
- `[ ]` **Scheduled `paid_in_full` payout job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- `[ ]` **Pre-tour reminder job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- `[ ]` **Affiliate postback job (delayed, approve after window).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- `[~]` **Nightly quality-score / eligibility / materialization (cron).** Materialization/bookability/spotlight/demand done; quality-score + tier eligibility/grace/demotion are TODOs. `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · `Code:` `workers/nightly-jobs.service.ts`
  - Note - **materialization horizons** (the inventory `departures` are generated by this job): create-time materialize uses a **90-day** default window; the nightly cron uses a **364-day** rolling 12-month window (`from` = today, slides forward one day per night); `MAX_HORIZON_DAYS = 365` cap; `BOOKABLE_HORIZON_DAYS = 30` is the separate ranking/bookability gate, not a generation horizon. Sharp edges: a new schedule shows only 90 days until the next 3 AM run; the 12-month horizon depends on the nightly cron running. Full detail: [Availability §3.1](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#31-materialization-horizons-as-built).
- `[~]` **Idempotent consumers** (DB guards exist: `conversion_fired_at`, `stripe_webhook_events`). Once jobs move to the queue, add `jobId` dedup + keep DB guards; do not rely on jobId alone. `Ref:` [Queues §5.1](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers) · partly present
- `[ ]` **Retries + exponential backoff, and keep failed jobs (no silent drop).** `Ref:` [Queues §5.3, §5.5](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#53-retries-and-backoff) · applies once jobs are queued
- `[x]` **No queue for capacity/overbooking** (atomic update is the control). `Ref:` [Queues §2, §7](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue) · `Code:` `bookings.service.ts:reserve`

---

## 14. API surface & access

- `[x]` **Routes:** `POST /bookings`, `POST /bookings/:id/confirm|cancel|extend`, `PATCH /bookings/:id`, `GET /bookings/typ/:publicRef`, `GET /bookings`, `GET /bookings/:id`. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`
- `[ ]` **`POST /bookings/quote`.** `Ref:` [Guide §16 / §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · absent
- `[x]` **Access rules:** booking create + TYP public; list/detail auth-scoped; webhooks bypass auth+throttle with signature verify. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`, `payments.controller.ts`
- `[x]` **No raw Prisma rows returned; status/commission/tier not client-settable.** `Ref:` [Guide §17 security](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` DTO `select` shapes

---

## 15. Edge cases (Guide §17) - verification matrix

`Ref:` [Guide §17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases), [Queues §8](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#8-mapping-to-the-booking-flow-edge-cases)

- `[x]` Two users race last seats -> one guarded update wins.
- `[x]` Departure closes / cutoff passes after read -> submit fails (`WHERE status='open'` + live cutoff).
- `[x]` Party size exceeds remaining -> claim fails.
- `[x]` Payment intent retried -> same provider intent (idem key).
- `[x]` Webhook redelivered -> skipped via event ledger.
- `[ ]` Payment succeeds after hold expired -> reconcile/void/refund (not handled).
- `[x]` Payment fails -> booking stays ON_HOLD until retry/expiry.
- `[x]` Later tier/price/age-band/add-on/pickup edits do not mutate existing bookings (snapshots).
- `[x]` TYP refresh / email revisit does not double-fire conversion.
- `[x]` `publicRef` UUID non-enumerable; `displayRef` + email required for account access.
- `[~]` Cancellation admin latency cannot reduce refund (request-time judged) - but refund is category-only.
- `[x]` `PAID_IN_FULL` refund references full payment; deposit models reference deposit - **note:** currently only FULL/NONE category, amount not differentiated.

---

## 16. Locked master decisions to hold the line on (Guide §1)

`Ref:` [Guide §1](./BOOKING-FLOW-DESIGN-GUIDE.md#1-locked-master-decisions)

- `[x]` Booking is instant (no enquiry / 24h approval).
- `[x]` Inventory source of truth = `departures`.
- `[x]` Capacity claimed with one guarded atomic update.
- `[x]` `payment_model` snapshotted; tier/commission never retroactive.
- `[x]` `commission_amount` EUR is the conversion value; never GMV.
- `[x]` TYP `/{destination}/thank-you/{public_ref}`, no locale prefix, noindex.
- `[x]` `public_ref` unguessable; `display_ref` customer-facing.
- `[x]` One `cancellation_hours` window `[24,48,72,168]` default 48.
- `[x]` Cancellation deadline computed, never stored.
- `[x]` `operator_link` balance not tracked by Island Tours v1.
- `[ ]` Deposit forfeiture never automatic (operator report -> admin confirm).
- `[x]` Webhooks `@Public()` + `@SkipThrottle()`, signature-verified, idempotent.
- `[x]` Checkout charge lands in the Island Tours account (merchant of record); Connect routing is v2 (settlement rails).

---

## Build-order suggestion (to avoid new flaws)

1. Fix pricing correctness first: `ON_ARRIVAL` deposit, discount application, `UNIT` pricing (flaws 1-3). These affect money on every affected booking.
2. Reject `OPERATOR_FULL` in v1 reserve (flaw 6). One guard, prevents payment bypass.
3. Wire the hold-expiry sweeper (flaw 4). Stops phantom sold-outs.
4. Add the outbox + move confirmation email and CAPI to queued, idempotent jobs (flaw 5). Fixes lost conversions.
5. Add the `Settlement` model + write rows at confirmation; then the scheduled `paid_in_full` payout job (flaw 8, §12).
6. Capture attribution at reserve (flaw 9), then finish Mollie confirm (flaw 7).
7. Then multi-currency (quote endpoint, source fields, provider FX) as its own phase (§6, Guide §19-23).
