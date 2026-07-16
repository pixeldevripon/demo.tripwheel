# Booking -> Payment -> Payout -> Tracking - completion progress

> **Living progress tracker** for finishing the end-to-end booking flow: booking, payment,
> confirmation email + operator payment-link email, scheduled payout after the cancellation
> window, payout/settlement, cancellation + refunds, provider-backed FX, the frontend widget,
> and the tracking/analytics layer.
>
> **This is the dashboard.** The task detail lives in the two checklists; this doc rolls them up
> into a single trackable view with a critical path.
>
> - Detail (backend/logic): [BOOKING-CHECKLIST.md](./BOOKING-CHECKLIST.md)
> - Detail (frontend widget/checkout): [BOOKING-WIDGET-CHECKLIST.md](./BOOKING-WIDGET-CHECKLIST.md)
> - Canonical: `technical-doc/island-tours-platform-master.html` v1.9 (wins on any conflict)
>
> **Maintenance rule:** on completing ANY task, update (1) this doc's checkbox + progress table,
> (2) the matching line in BOOKING-CHECKLIST.md / BOOKING-WIDGET-CHECKLIST.md, (3) the task status.
> Keep the three in lockstep in the same commit/response.

Last updated: 2026-07-16 · Branch: `rendering-caching` · ROOT HEAD at doc creation: `21efe49`

---

## Where we are now

The **money-flow spine is built and committed end-to-end**:

```
reserve (ON_HOLD) -> PATCH contact -> payment intent (automatic_payment_methods)
  -> custom Stripe card / PayPal + iDEAL redirect -> /payment/processing poller
  -> webhook confirm -> CONFIRMED + EUR conversion stamp -> TYP
```

Also built: server-authoritative quote, UNIT pricing, provider-backed FX (static provider + DB
cache + refresh scheduler), multi-currency display across public/wishlist/dashboard.

**Happy-path booking + card payment works.** What remains is the **edges**: real money
settlement/payout, real refunds, the second (operator) email, async/queue hardening, and the whole
tracking layer.

Uncommitted at doc creation: consent-line tweak (`checkout-payment.tsx`, `en.json`) + two trip-form files.

---

## End-to-end flow status

| Stage | Status | Remaining |
|---|---|---|
| Booking / reserve | 🟢 ~95% | attribution (utm/gclid) not captured at reserve; age-restriction validation partial |
| Payment (card / PayPal / iDEAL) | 🟢 ~90% | Mollie webhook is a stub; payment-succeeds-after-hold-expired reconciliation |
| Confirmation email | 🟡 ~60% | on SMTP/nodemailer not Resend; no invoice attachment; sent inline not queued |
| Operator payment-link email | 🔴 not built | second `operator_link` balance email (names operator + secure link) |
| Scheduled payout after cancel window | 🔴 not built | needs Settlement ledger + delayed payout job (RECORDED -> PAID_OUT, clawback-safe) |
| Payout / settlement | 🔴 not built | no Settlement model, no rows at confirm, no net_position convention (Connect = v2) |
| Cancellation + refunds | 🟡 ~60% | refund is category-only: no real Stripe refund, no REFUND row, no per-model amount, no tokenized cancel page |
| Provider-backed FX | 🟡 ~85% | only a real provider impl (Stripe FX Quotes) behind the existing seam remains |
| Frontend widget / checkout | 🟡 ~80% | pickup, add-ons, timing affordances; real-TYP data still demo |
| Tracking / analytics | 🔴 ~5% | whole §8.2/§8.3 browser + CAPI + GTM + consent layer |

Legend: 🟢 done/nearly · 🟡 partial · 🔴 not built.

---

## Task groups (~45 open items)

Checkboxes here mirror the two checklists. Tick both when a task lands.

### A. Settlement & payout (0/5 v1; 2 v2 deferred)
- [ ] A1 `Settlement` model + `SettlementStatus` enum
- [ ] A2 Write one Settlement row per booking at confirmation (deposit models net ~0)
- [ ] A3 `net_position` sign convention enforced in writes
- [ ] A4 `paid_in_full` scheduled payout after cancel window (RECORDED -> PAID_OUT, clawback-safe)
- [ ] A5 Delayed payout job wiring (depends A1-A4)
- [ ] A6 (v2) `operator_full` reintroduced + commission collection rail - deferred
- [ ] A7 (v2) Stripe Connect Express (destination charge, application_fee) - deferred

### B. Cancellation & refunds (0/4)
- [ ] B1 Execute real Stripe refund on cancellation + write `REFUND` Payment row
- [ ] B2 Payment-model-aware refund amount (deposit-only vs full; partial)
- [ ] B3 Tokenized cancel confirmation page (no raw-click) + account fallback
- [ ] B4 Operator non-payment -> admin confirm -> forfeit deposit + release (no auto-forfeit)

### C. Email (0/5)
- [ ] C1 Operator-balance email on `operator_link` (names operator + secure balance link)
- [ ] C2 Invoice attachment (from Stripe/Mollie) on confirmation
- [ ] C3 Pre-tour reminder (24h before; no payment links)
- [ ] C4 Switch provider SMTP -> Resend (Postmark fallback)
- [ ] C5 Verify template never names/spotlights operator before payment

### D. Async / queue hardening (0/8)
- [ ] D1 Transactional outbox (`OutboxEvent` written in booking txn; relay -> BullMQ)
- [ ] D2 Hold-expiry sweeper wiring (repeatable job drives `expireStaleHolds`)
- [ ] D3 Confirmation-email job (queued, retry + backoff) instead of inline
- [ ] D4 CAPI conversion job (queued, idempotent by event id)
- [ ] D5 Scheduled `paid_in_full` payout job (delayed) - pairs with A4/A5
- [ ] D6 Pre-tour reminder job (delayed) - pairs with C3
- [ ] D7 Affiliate postback job (delayed, approve after window)
- [ ] D8 Retries + exponential backoff, keep failed jobs (no silent drop)

### E. Tracking / analytics (0/8)
- [ ] E1 `booking_complete` browser push on TYP (once; prod-only guard)
- [ ] E2 Fire-point reconciliation: add `conversion_pushed_at` guard (separate from `conversion_fired_at`)
- [x] **E3 Real-TYP payload** (2026-07-16). Backend `getThankYou` + `ThankYouResponseDto` expanded
  (guest name/phone, party grouped by age band, deposit/balance + paymentModel, card brand/last4,
  durationMinutes, cancellationHours, computed free-cancel deadline local+UTC, operator contact via
  `companyInfo` join) - **no migration**. Frontend `getThankYouBooking` now calls `getTypByRef` and
  composes every label locale-side; demo payload deleted; cross-sell fetches **real** destination
  tours (`getThankYouRelatedTours`, booked tour excluded). Verified live on
  `4ce3c7c1-…`: real guest/operator/ref/party/money render, demo strings gone, deadline math
  correct (start `2026-07-24T13:30` - 48h = `2026-07-22T13:30`).
  `Code:` `bookings.service.ts:getThankYou`, `dto/booking.dto.ts`, `lib/thank-you/thank-you.ts`,
  `lib/api/public/bookings.ts`, TYP `page.tsx`
- [ ] E4 Attribution captured at reserve (utm/gclid/gbraid/wbraid/fbclid + affiliate)
- [ ] E5 Server-side PII hashing (SHA-256 email/phone/name/address) for EC/AM
- [ ] E6 Meta CAPI (server, parallel to Pixel, dedup by shared event id) - needs external creds
- [ ] E7 GTM container + 4-tag fan-out - needs GTM container id
- [ ] E8 Consent Mode v2 + CMP (EEA denied default) - needs CMP choice

### F. Frontend widget / checkout (0/6)
- [ ] F1 Pickup selection in widget (mandatory when `pickupRequired`)
- [ ] F2 Add-ons render + totals + payload (PER_PERSON vs FLAT, maxQuantity)
- [ ] F3 Timing affordances (instantConfirmation, bookingType PRIVATE/SHARED, bookingCutoffMinutes)
- [ ] F4 Consume server quote for persisted totals (client math = estimate only)
- [ ] F5 Swap TYP `getThankYouBooking` to real `GET /bookings/typ/:publicRef` (pairs with E3)
- [ ] F6 i18n / motion / Tailwind compliance pass on new copy

### G. Correctness / misc (0/6)
- [ ] G1 Mollie webhook confirm (currently ledger-only stub)
- [ ] G2 Hold-expiry cron (pairs with D2)
- [ ] G3 Discount/coupon engine (deferred - re-add validated when Coupon engine ships)
- [ ] G4 Currency-change guard (block/relabel `defaultCurrency` once prices exist)
- [ ] G5 Real FX provider impl (Stripe FX Quotes) behind existing seam
- [x] **G6 Backend suite green** (2026-07-16). `bookings.service.spec.ts` mocks swapped from
  `$executeRaw` to `departure.updateMany`/`update` (`$executeRaw` is gone from service code entirely);
  `rawSqlTexts` SQL-substring matching replaced with `claimCalls`/`releaseCalls` asserting real Prisma
  args (stronger: exclusive claim now asserts `where.bookedCount===0 && data.bookedCount===capacity`);
  added the missing in-txn capacity read to `setupUnitReserveContext`. **905 tests / 43 suites pass.**

---

## Critical path

Ordered so each step de-risks the next and nothing produces wrong money.

- [ ] **1. Real-TYP data + fire-point reconciliation** (E3 -> E1 -> E2) - foundational; unblocks the browser push. *(TRK2 resume point.)*
- [ ] **2. Operator-balance email + switch to Resend** (C1 + C4) - completes the two-email requirement.
- [ ] **3. Hold-expiry sweeper wiring** (D2 / G2) - stops phantom sold-outs; small.
- [ ] **4. Settlement ledger** (A1-A3) - write one row per booking at confirm.
- [ ] **5. Scheduled `paid_in_full` payout after cancel window** (A4/A5, D5) - depends on 4.
- [ ] **6. Real refund execution** (B1-B2) - actual Stripe refund + REFUND row.
- [ ] **7. Outbox + queued idempotent jobs** (D1, D3-D4, D8) - hardening once jobs exist.
- [ ] **8. Tracking fan-out** (E5-E8) - PII hashing, then GTM/CAPI/Consent.
- [ ] **9. Real FX provider** (G5) - swap the static provider for live rates.

Plus, opportunistically: G1 (Mollie confirm), G4 (currency guard), G6 (spec green), B3/B4, C2/C3, E4, F1-F6.

---

## Locked decisions

- **TYP URL token = `publicRef` UUID** (founder, 2026-07-16). Confirmed correct as built and
  verified live: `http://localhost:3000/sint-maarten/thank-you/4ce3c7c1-3af9-4aeb-ac1c-bbe84b11eeae`
  - locale-less, destination segment, unguessable UUID. Master rules #7/#16.
  - `publicRef` (UUID, `@unique @default(uuid())`) = URL token only. **Never** the DB `id`, and
    never the human ref.
  - `displayRef` (`IT-YYYY-XXXXXXXX`) = customer-facing reference, shown **in page content + email**,
    never in the URL (it is sequential/guessable -> enumeration risk).
  - `id` (DB PK, client-suppliable as the reserve idempotency key) = authenticated mutations only
    (`PATCH /bookings/:id`, `POST /payments/bookings/:id/intent`).
  - **Verified as built, no fix needed.** The TYP "looks wrong" only because the page still renders
    the demo payload - fixed by E3 (step 1) below.

---

## Blocked on your input

- **Email provider (step 2):** confirm **Resend** (with Postmark fallback) is what we wire for C1/C4.
- **Tracking creds (step 8):** Meta Pixel id + CAPI access token (E6); GTM container id (E7); CMP
  choice - Cookiebot vs Iubenda (E8).

---

## Execution plan - start here after a session/plan switch

> Resume with `claude --continue` from the repo root, then work this list top-down. Each step:
> implement -> verify -> tick this doc + the matching checklist line -> update the task -> commit
> **from the ROOT repo** (never `backend/`).

### Realistic scope check

The full ~45-item list is **multi-day**, not one night: settlement + payouts + real refunds + the
outbox/queue layer are substantial, and the tracking fan-out (E6-E8) is **hard-blocked** on external
creds. What IS achievable in one focused session is the **"a real traveler's booking works
end-to-end and reports correctly"** milestone - steps 1-3 below.

### Tonight's target (achievable, unblocked)

- [ ] **Step 1 - Real TYP + fire-point** (tasks #40 -> #39 -> #42)
      1. Backend: widen `getThankYou` + `ThankYouResponseDto` (`bookings.service.ts:908`,
         `dto/booking.dto.ts`). The `Booking` row already has guest name, deposit/balance, card
         brand/last4, dates, pickup - **no migration needed**. Add joins: `operator`
         (`companyName`/`contactEmail`/`contactPhone`) + `tour` (`durationMinutesFrom`,
         `cancellationHours`). Compute `freeCancellationDeadline = tourStartDateTime - cancellationHours`.
      2. Frontend: wire `lib/thank-you/thank-you.ts:getThankYouBooking` to `getTypByRef`
         (`lib/api/public/bookings.ts` - already built), map -> rich `ThankYouBooking`, delete the
         demo payload. Keep `DEMO_PUBLIC_REF` only for `generateStaticParams`.
      3. Add `conversion_pushed_at` (migration) as a **separate** browser-push guard - do NOT reuse
         `conversion_fired_at` (already set at webhook-confirm, so a push gated on it would never
         fire). Mark-first on TYP render; `getThankYou` must return `conversion` **once**.
      4. Add the `booking_complete` dataLayer push on TYP (prod-only guard, EUR `commissionAmount`,
         never GMV - rule #22).
      - Verify: real booking -> TYP shows that booking's real data; refresh does **not** double-fire.

- [ ] **Step 2 - Operator-balance email + Resend** (task #46) - *needs your Resend confirmation*
- [ ] **Step 3 - Hold-expiry sweeper** (task #47) - small; `expireStaleHolds()` already exists, just
      needs a repeatable job. Stops phantom sold-outs.
- [ ] **Step 3.5 - Make the suite green** (task #53 / G6): swap `bookings.service.spec.ts`
      `$executeRaw` mocks -> `departure.updateMany`/`update` (red since the refactor). Do this
      before any commit that touches bookings.

### Next session (not tonight)

- [ ] Step 4 - Settlement ledger (#48) -> Step 5 - scheduled payout (#49, blocked by #48)
- [ ] Step 6 - Real refund execution (#50)
- [ ] Step 7 - Outbox + queued jobs (#51)
- [ ] Step 8 - Tracking fan-out (#43-#45) - **blocked on creds**
- [ ] Step 9 - Real FX provider (#53 / G5)
- [ ] Group F - widget gaps (#52)

---

## Change log

- 2026-07-16 - Doc created. Baseline captured at ROOT `21efe49`. Nothing ticked yet.
- 2026-07-16 - **TYP URL token decision locked = `publicRef` UUID** (verified live; no fix needed -
  the perceived "id in URL" is the correct unguessable token). Added execution plan + scope check.
- 2026-07-16 - **E3 (real-TYP data) DONE + verified live.** Step 1 is now E1+E2 only. Two findings
  raised while verifying (see "Open findings" below).

---

## Open findings (raised 2026-07-16 while verifying E3)

- [x] **Card brand/last4 null on every paid booking - ROOT-CAUSED + FIXED 2026-07-16.** Not a data
  quirk: `expandedCharge(intent)` only read an *already-expanded* charge, but **Stripe webhooks never
  expand nested objects** - a succeeded `payment_intent` carries `latest_charge` as a plain **string
  id**, and the legacy `intent.charges.data[0]` list no longer exists on current API versions. So it
  returned `undefined` -> `billing` was `undefined` -> `confirmFromPayment` wrote null brand/last4 on
  **every** booking, and the TYP card line was always blank. Fixed by adding
  `StripeService.retrieveCharge()` + `PaymentsService.resolveCharge()`, which fetches the charge when
  `latest_charge` is a string (best-effort: a failed lookup logs and still confirms - the snapshot must
  never block a confirmation). The old spec had **baked the bug in** (`confirmFromPayment('b1', undefined)`
  was the asserted expectation); replaced with 3 real regression tests (string id -> fetch + snapshot;
  pre-expanded -> no fetch; lookup fails -> still confirms). `Code:` `payments.service.ts:resolveCharge`,
  `stripe.service.ts:retrieveCharge`
  > Note: existing bookings (incl. `4ce3c7c1-…`) keep their null snapshot - the fix only applies to new
  > webhook deliveries. Make a fresh test booking to see the card line populate.
- [ ] **English date punctuation vs Figma (cosmetic, needs a call).** Figma demo strings were
  `Tue 28 May, 2026` / `Sunday, 26 May`. Intl `en-GB` produces `Fri, 24 Jul 2026` /
  `Wednesday 22 July` - correct day-then-month **order**, but the comma sits after the weekday
  rather than before the year. Matching Figma exactly needs a hand-rolled formatter, which would
  break the other 6 locales, so it was NOT silently hand-rolled. Decide: keep locale-correct Intl,
  or hand-compose for `en` only.
