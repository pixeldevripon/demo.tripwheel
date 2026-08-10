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
4. [x] **Hold-expiry sweeper scheduled.** DONE 2026-07-25 (task #47). `NightlyJobsService.holdExpirySweep` `@Cron(EVERY_MINUTE)` drives `expireStaleHolds()` (in-process schedule, matching the FX/nightly convention - idempotent recompute, no BullMQ). Phantom sold-outs now clear within a minute. `Code:` `workers/nightly-jobs.service.ts`, `bookings.service.ts:expireStaleHolds`
5. [x] **FIXED 2026-07-25 (B6/#51): conversion/email now ride the transactional outbox.** The finalize winner commits a `booking.confirmed` OutboxEvent in the SAME transaction as the `conversionFiredAt` guard; the relay enqueues durable BullMQ jobs (5 attempts, exp backoff, failures retained) with per-consumer DB guards - a provider blip retries instead of losing the email/conversion. `Ref:` [Queues §5.1-§5.3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers) · `Code:` `bookings.service.ts:finalizeConfirmation/run*Job`, `workers/outbox-relay.service.ts`, `workers/platform-jobs.processor.ts`
6. [x] **`OPERATOR_FULL` rejected in v1.** `loadContext` throws `422` for an OPERATOR_FULL tour, so neither reserve nor quote can create a confirmed payment-free booking. `Ref:` [Settlement Part 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `bookings.service.ts:loadContext`. Test updated.
7. [x] **Mollie webhook is a stub.** FIXED 2026-07-25 (tasks #98-#104): full Mollie integration as a switchable PSP. `handleMollieWebhook` now re-fetches the payment from Mollie (the fetch IS the verification - Mollie posts only an id, no signature), maps `paid` -> Payment SUCCEEDED + `confirmFromPayment` (same finalization as Stripe), `failed/canceled/expired` -> FAILED (booking stays ON_HOLD), and reconciles EMBEDDED refunds. **Redelivery is NOT skipped**: Mollie re-posts the SAME payment id on every status change (paid now, refund settled later), so the ledger upserts and reconciliation re-runs - idempotency lives in the state-guarded transitions (atomic ON_HOLD gate + refund transition rules), not the event ledger. `Code:` `payments.service.ts:handleMollieWebhook`+`applyMolliePayment`, `mollie.service.ts`
8. [x] **Settlements ledger built.** DONE 2026-07-25 (task #48), REWORKED 2026-07-26 (founder): the ledger records **paid_in_full bookings only** - the one model where IT holds money it owes the operator. One row at confirmation (in `finalizeConfirmation`, EUR); `netPosition = amountCollected - commissionOwed` = the payout owed the operator. Self-settling deposit models and operator_full write NO row (`writeSettlement` no-ops; migration `20260726120000` purged the old noise rows). `Code:` `bookings.service.ts:writeSettlement`, `prisma/bookings.prisma:Settlement`. Payout = manual admin mark-paid (§12).
9. [x] **Attribution captured at reserve.** DONE 2026-07-25 (task #81). `AttributionDto`
   (gclid/gbraid/wbraid/fbclid + 5 UTM, all optional, length-capped) on `ReserveBookingDto`; the
   reserve service writes them onto the booking at CREATION only (the idempotent re-reserve
   early-return never overwrites the original). Frontend captures them from the landing URL into a
   first-party `it.attribution` cookie (`lib/tracking/attribution.ts`, last-click wins per param,
   90-day, persists through the funnel) via `<AttributionCapture>` mounted in the (frontend) layout,
   and the checkout reserve call reads the cookie into the payload. `Code:`
   `bookings.service.ts:reserve`, `dto/booking.dto.ts:AttributionDto`,
   `lib/tracking/attribution.ts`, `components/frontend/attribution-capture.tsx`, `checkout-form.tsx`.
   Tests: 3 backend cases (write / re-reserve-preserves / organic-null). Affiliate id is NOT part of
   this (it rides the promo-code path, separate).
10. [x] **Three production defects in checkout -> processing -> TYP.** EXECUTED 2026-07-29 (reported
    from production; reviewed - code + security). Reproduced, not guessed:
    - **The hand-off blanked between processing and the TYP.** Root cause is the Vercel RSC-variant
      bug: for a NON-prerendered path the client router's flight request is answered with the full
      HTML document. Proven by a controlled A/B on ONE route - the prerendered `DEMO_PUBLIC_REF`
      returns `text/x-component`, a real ref returns `text/html` (183 KB) with
      `x-matched-path: ...[publicRef].rsc`. The router cannot parse it, discards it and
      hard-navigates anyway. The 2026-07-19 "prerender all slugs" fix CANNOT apply here: `publicRef`
      is an unguessable runtime token, so the TYP is permanently on-demand. `cacheComponents: true`
      also makes `dynamic`/`dynamicParams`/`revalidate` a build error, so there is no route-config
      escape hatch. Fix is at the call site: `lib/checkout/leave-to.ts` does the document navigation
      directly, dropping the wasted round trip and the stall. The fixed-clock fade-out that emptied
      the screen before the new document arrived is gone. Re-check with the curl in that file after
      a Next/Vercel upgrade and revert to the router once a non-prerendered path serves
      `text/x-component`. **Never prefetch the TYP** - rendering it claims the mark-first
      `booking_complete` push, so a prefetch would consume it (rule #22).
    - **The TYP intermittently rendered the error boundary.** `publicGetStrict` throws on anything
      but 2xx/404 and nothing catches it; `publicFetch` retries 429/503 but NOT a network error or a
      5xx. That read lands moments after settle, the request in which the backend retrieves the
      PaymentIntent and sends BOTH confirmation emails inline - the busiest moment in the flow.
      `getTypByRef` now retries twice (250/600ms). A genuine 404 still returns `null` on the first
      call, so a real not-found is never retried and the strict throw still stands once exhausted.
      It deliberately does NOT retry 429/503 (security review): `publicFetch` already exhausts two
      attempts on those, and stacking would make ONE page load fan out to 9 backend calls - all SSR
      renders share one egress IP against the per-IP throttle, so that turns a brief 429 into a
      self-sustaining one. `BackendUnavailableError` now carries `status` so the two layers can
      divide the work; worst case is 3 calls on either path.
    - **Laggy Stripe/Mollie card fields.** Three LIVE causes: the PSP iframes mounted into a
      `Collapse` animating `height: 0 -> auto` under `overflow-hidden` (they mount on the very render
      the animation starts), which also made the sibling `scrollIntoView` aim at an offset that
      moved underneath it; the ~260-option country `<select>` was re-reconciled on every keystroke
      in name/email/phone/notes; and the CORS config set no `maxAge`, so reserve -> contact PATCH ->
      intent cost 6 round trips instead of 3. The cold document load into `/checkout` (the RSC bug
      above) compounded all three.
      **Ruled OUT with evidence - do not re-chase either:**
      (a) Stripe options churn - `@stripe/react-stripe-js` 6.8.0 deep-compares via `isEqual`
      (`dist/react-stripe.js:231-248`), so the recreated-but-equal options never call
      `element.update()`.
      (b) **Lenis smooth scroll.** Initially blamed (lerp .09 fighting the native `scrollIntoView`,
      and wheel events over a PSP iframe never reaching it). WRONG: `<SmoothScroll />` has been
      commented out in `app/(frontend)/layout.tsx:82` since 2026-07-18, so Lenis does not run at all.
      `smooth-scroll.tsx` was still hardened (checkout excluded; the rAF loop is now cancelled on
      cleanup instead of running forever on a destroyed instance; the setup effect is keyed on the
      native-scroll BOOLEAN, not `pathname`, so re-enabling it will not tear Lenis down on every
      navigation) - but none of that is live, and none of it fixed this bug.
    `Code:` `lib/checkout/leave-to.ts` (new), `checkout-processing.tsx`, `checkout-form.tsx`
    (`Collapse` `instant` + memoized country field/contact + COLLAPSE_MS-delayed scroll),
    `checkout-payment.tsx`, `checkout-payment-mollie.tsx`, `smooth-scroll.tsx` (checkout excluded +
    rAF loop cancelled), `lib/api/public/bookings.ts:getTypByRef`, `main.ts` (CORS `maxAge`).
11. [x] **`bookings.island` fallback wrote a display NAME, not a slug.** EXECUTED 2026-07-29.
    `reserve` stamped `island: ctx.tour.destination?.slug ?? 'Curaçao'` immutably, and the TYP
    `notFound()`s when `island !== the [destination] URL segment` - so `'Curaçao' !== 'curacao'`
    would have 404'd that booking's thank-you page forever, for the traveller AND the confirmation
    email link. Fixed to `'curacao'` (matching the existing convention at
    `bookings.service.ts:3150`) and a re-runnable backfill added (`pnpm booking:island:backfill`,
    `--dry` to report only) that repairs each row from its OWN tour's destination and skips - never
    guesses - what it cannot resolve.
    **The reserve fallback itself is unreachable** (`Tour.destination` is a REQUIRED relation that
    `loadContext` always selects), so production bookings are almost certainly clean - but the
    backfill's dry run found **312 of 548 local rows holding `'Curaçao'`, many on Aruba and Sint
    Maarten tours**. Traced to the OTHER trap, and it is live: `prisma/demo/reviews.ts` creates depth
    bookings WITHOUT `island`, so they fell through to the column's `@default("Curaçao")`. The seed
    now sets `island: tour.destination?.slug` (and selects the slug); the 312 rows were repaired and
    a re-run reports 0. Run the backfill against production to confirm it is clean there.
    **Column default DROPPED** 2026-07-29, migration `20260728222438_drop_booking_island_default`
    (`ALTER TABLE "bookings" ALTER COLUMN "island" DROP DEFAULT`) - it was the trap that actually
    bit. Removed rather than corrected to `'curacao'`: no guessed value is safe, since a `'curacao'`
    default would still 404 an Aruba booking. All three insert sites supply the slug and there is no
    raw SQL insert, so an omission is now a loud Postgres `23502` not-null violation instead of a
    silent forever-404. Metadata-only, no table rewrite - safe against a live bookings table, but run
    `pnpm booking:island:backfill --dry` on the target environment BEFORE deploying, since the
    default was masking rows there too.
    **Still open:** the TYP comparison means renaming a destination slug 404s every historical
    booking on it.
    `Code:` `bookings.service.ts:633`, `prisma/demo/reviews.ts`, `prisma/bookings.prisma`,
    `scripts/backfill-booking-island.ts`, `migrations/20260728222438_drop_booking_island_default`

---

## 1. Data model & schema

- [x] **`Booking` core fields** (publicRef, displayRef, status, paymentModel, currency, totalRetail, deposit/balance, commissionRate/Amount, totalEur, fxRateToEur, local date/time, tour start/end/tz, contact split, utcExpiresAt, utcCancellationRequestedAt, conversionFiredAt, billing + card snapshot). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma:Booking`
- [x] **`BookingUnitItem`** (one per traveler, priceRetail/priceNet, ticket fields). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- [x] **`BookingAddOn`** (snapshotted line items). `Ref:` [Guide §3](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/bookings.prisma`
- [x] **`Payment`** with kinds DEPOSIT/BALANCE/FULL/REFUND. `Ref:` [Guide §3 Payment](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/payments.prisma`
- [x] **`Departure`** (capacity, bookedCount, status OPEN/CLOSED/SOLD_OUT/CANCELLED, soldOutAt, source, manuallyEdited). `Ref:` [Guide §3 Departure](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `prisma/availability.prisma`
- [x] **`stripe_webhook_events`** idempotency table (+ `mollie_webhook_events`). `Ref:` [Guide §10](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `prisma/payments.prisma`
- [x] **`Settlement` model + `SettlementStatus` enum** (amountCollected, commissionOwed, netPosition, operatorPayout, status, externalRef). DONE 2026-07-25 (#48); migration `20260725060944_add_settlement_ledger`. `Code:` `prisma/bookings.prisma:Settlement`, `prisma/enums.prisma:SettlementStatus`
- [x] **`OutboxEvent` model** for the transactional outbox (2026-07-25, `prisma/outbox.prisma`, migration `add_outbox_and_job_guards` + Booking guard columns `utcConfirmationEmailSentAt`/`utcOperatorNoticeSentAt`/`utcReminderSentAt`). `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox)
- [x] **Source-currency fields on `Booking`** (sourceCurrency, sourceTotalRetail, sourceDepositAmount, sourceBalanceAmount, sourceFxRateToBooking + FX audit: sourceFx/eurFx provider+asOf). `Ref:` [Guide §20.2](./BOOKING-FLOW-DESIGN-GUIDE.md#202-add-booking-schema-snapshots) · `Code:` `prisma/bookings.prisma:Booking` (migration `20260715221643_multi_currency_fx_rates_and_source_snapshots`)
- [x] **`FxRate` table** (provider-backed rates, refresh, expiry, isActive history). `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `prisma/fx.prisma:FxRate`
- [ ] **`BookingQuote` model** (if quote is DB-backed). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · ABSENT
- [x] **Distinct `gclid` column.** DECIDED + DONE 2026-07-25 (task #81): renamed the generic
  `clickId` -> `gclid` to match master E.8 / 8.3 (migration `20260725045827_...`, a `RENAME COLUMN`
  not drop+add - the field had zero readers so no data lost). `gbraid`/`wbraid`/`fbclid` already
  existed. `Code:` `prisma/bookings.prisma:gclid`

---

## 2. Booking creation (reserve) - validation & atomic claim

- [x] **Single atomic guarded UPDATE on `departures`** (increment with `WHERE status='open' AND booked_count+seats<=capacity`, 0 rows -> fail), inside a transaction; no check-then-increment split. **2026-08-10 (hardening F2/F3): the claim now LITERALLY matches this SQL** - one raw guarded UPDATE in `claimSeats()` (check + increment + `SOLD_OUT` flip + `soldOutAt` stamp fused, capacity compared as a live column, not a pre-read literal), shared by reserve / pay-after-expiry recovery / restore / date-change, and placed LAST in the reserve transaction so the hot-row lock spans ~one statement + commit. `Ref:` [Guide §8](./BOOKING-FLOW-DESIGN-GUIDE.md#8-atomic-capacity-claim), [Queues §2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue), [Hardening F2/F3](./BOOKING-CONCURRENCY-HARDENING.md) · `Code:` `bookings.service.ts:claimSeats` · `Test:` `test/booking-concurrency.e2e-spec.ts` (real Postgres: last-seat race, capacity-shrink race, exclusive, restore-into-sticky)
- [x] **Booking + unit items + add-on snapshots created in the same transaction.** `Ref:` [Guide §4 step 11](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:reserve`
- [x] **Validate: tour exists; departure belongs to tour; cutoff not passed; party min/max; add-ons active & belong to tour; pickup belongs to tour.** `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:loadContext/validateRestrictions/cutoffReached`
- [x] **Age-restriction validation - CLOSED AS-IS (founder 2026-07-25: "keep it simple as is").** Tour minimum age enforced when `travelerAge` is supplied (ages optional). Band max-age / coverage checks deliberately NOT built - band selection is the age assertion; do not re-add. `Ref:` [Guide §4 step 6](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · `Code:` `bookings.service.ts:validateRestrictions`
- [x] **All party bands (incl. infants/spectators) count toward capacity** (one unit item each). `Ref:` [Guide §3 BookingUnitItem](./BOOKING-FLOW-DESIGN-GUIDE.md#3-core-entities) · `Code:` `bookings.service.ts:reserve`
- [x] **Whole-unit/private-charter claims the whole departure** (2026-07-16): a `UNIT` + `PRIVATE` reserve runs an exclusive claim (`booked_count = capacity`, `sold_out`, guarded by `status=open AND booked_count=0`); `Booking.exclusiveDeparture` drives whole-departure release on cancel/expiry. `Ref:` [Guide §9 UNIT capacity](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [§17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:reserve/releaseSeats`

### Concurrency hardening (plan: [BOOKING-CONCURRENCY-HARDENING.md](./BOOKING-CONCURRENCY-HARDENING.md), audit 2026-08-10)

- [x] **F1 - atomic `releaseSeats`** (SQL `GREATEST` decrement, no read-modify-write). DONE 2026-08-10.
- [x] **F2 - `claimSeats()` helper, guard in SQL** (one raw guarded UPDATE, fused `SOLD_OUT` flip, 4 call sites; live-column capacity guard closes the concurrent-capacity-edit hole). DONE 2026-08-10.
- [x] **F3 - claim last in the reserve transaction** (hot-row lock ≈ one statement + commit). DONE 2026-08-10.
- [x] **F4 - idempotent replay on reserve.** DONE 2026-08-10. The replay pre-check already existed; added the key-reuse 409 (`assertSameReservation`), the in-flight duplicate P2002-on-PK catch (loser answers with the winner's booking, fires no side effects), and fixed the constraint-error predicates to read the pg driver adapter's NESTED meta (`driverAdapterError.cause.constraint`) - a top-level-only read never matches in production. `Test:` `test/booking-idempotency.e2e-spec.ts` (real HTTP: sequential replay, parallel duplicates → one row, mismatched reuse → 409, replay reports current state).
- [x] **F5 - DB CHECK constraint.** DONE 2026-08-10. Migration `20260810120000_departures_booked_within_capacity`: ledger-based repair of drifted rows (3 dev fossils healed; generic, so prod drift heals on deploy; stamps `soldOutAt`/`updatedAt` exactly as the runtime does; `lock_timeout 5s` so the ALTER fails fast instead of stalling live claims), then `NOT VALID` + `VALIDATE`. Capacity-edit guards mostly pre-existed (`updateDeparture` floor → 400 + optimistic lock on the fill → 409); review found the ONE reachable 23514 - the materializer's unbooked-row reprojection could race a traveller's first booking (pre-F5 this silently WROTE the oversold row; the constraint would have turned it into a 500) - closed with a guarded `updateMany(bookedCount: 0)` whose lost race counts as `skipped` and self-heals next pass. CHECK constraints cannot live in the Prisma schema DSL: this one exists ONLY in the raw migration; a migration re-baseline must carry it forward by hand. Verified from-zero: full history replays on an empty DB and the constraint fires. `Test:` `test/booking-concurrency.e2e-spec.ts` (raw-SQL overbook / negative / capacity-cut / bad-INSERT all refused) + materializer race spec.
- [x] **F6 - explicit pool + timeouts.** DONE 2026-08-10. Pool was pure node-postgres defaults (max 10, NO timeouts - the 11th rush request queued forever and a wedged txn held row locks indefinitely). Now: `DB_POOL_MAX` (default 25) + connect 5s / statement 10s / idle-in-txn kill 15s / lock wait 3s, all proven applied per-connection by e2e `current_setting`. Reserve txn bounds explicit (`maxWait 2s, timeout 5s`); a 55P03 lock-wait abort on the reserve path answers 503 "try again" (never 500) in both adapter error shapes - raw-SQL P2010-nested AND the bare client-query DriverAdapterError, the second probe-discovered when the live e2e 500'd on the insert path. Postgres sizing rule documented in `.env.example`; numbers are conservative starts for F7 to tune. `Test:` `test/db-pool-config.e2e-spec.ts` (settings reach connections; held-lock reserve sheds at ~3s as 503, claims nothing).
- [x] **F7 - load test with postconditions.** DONE 2026-08-10. k6 harness + SQL postcondition checker (`backend/scripts/loadtest/`, runbook included). Baseline vs F1-F6: hot 100/500/1000 VUs on one capacity-20 departure -> EXACTLY 20 claims every time, fill == active-seat ledger, zero unexpected 5xx in ~3,100 requests, hot p95 227-285ms; spread-500 all claimed across 100 rows; mixed 80/20 reads never starved. Local correctness baseline - re-record on the VPS before launch.
- [x] **F8 - replica-safe sweeper.** DONE 2026-08-10. All four @Cron sweeps (hold-expiry, settlement reverse, review requests, nightly commercial) became BullMQ job schedulers with fixed ids on the platform-jobs queue - N replicas upsert ONE schedule each; verified with two live processes. attempts=1 (the schedule is the retry); failures land in the retained failed set instead of a swallowed log line.
- [ ] **F9 - shed doomed requests** (sold-out short-circuit, availability read cache, per-route throttle).

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
- [x] **Synchronous "settle on return" so the TYP redirect never waits on the webhook.** EXECUTED 2026-07-19 (reviewed - security + code): `POST /payments/typ/:publicRef/settle` (@Public, keyed on publicRef, throttled short/medium/long) re-reads the PaymentIntent from Stripe (expand latest_charge; NEVER trusts the client) and, when Stripe reports `succeeded`, runs the same idempotent `onIntentSucceeded` -> `confirmFromPayment` as the webhook - so the card/billing snapshot is captured immediately too. The `/payment/processing` page calls settle first and redirects to the TYP on CONFIRMED (~1s), polling only as the backstop; the webhook remains the source of truth for redirect-return methods. Fixes the multi-second stall AND the "missing card row" on the fresh booker's TYP. **Race-hardened (both reviewers):** settle + webhook can hit `confirmFromPayment` in the same second, so the `ON_HOLD->CONFIRMED` transition and the `conversionFiredAt` mark are now ATOMIC guarded `updateMany`s (master §5.1 mark-first) - exactly one caller emits emails + fires the conversion; the loser only backfills billing. Per-target rate cap (`TargetRateLimiter`, 5/publicRef/min) added so a multi-IP caller can't spray the shared Stripe API. Verdict: NOT the removed `mark-fired` class (Stripe re-verification neutralizes forgery). `Code:` `payments.service.ts:settleFromReturn`, `bookings.service.ts:confirmFromPayment`+`finalizeConfirmation` (atomic), `stripe.service.ts:retrievePaymentIntent`, `checkout-processing.tsx`. Tests: race winner/loser + finalize-race + rate-limit (`bookings`/`payments` specs).
- [x] **Mollie webhook confirms bookings.** DONE 2026-07-25 (see flaw 7): fetch-and-reconcile with embedded-refund settlement; settle-on-return and refunds route by the Payment ROW's provider. Mollie checkout is REDIRECT-based: `POST /payments/bookings/:id/intent` returns `{provider:'MOLLIE', checkoutUrl}` when the admin-selected `payment_settings.activeProvider` is MOLLIE (returnUrl/cancelUrl validated against the CORS allow-list; webhookUrl only attached when PUBLIC_API_URL/BETTER_AUTH_URL is public https - dev settles on return). `Code:` `payments.service.ts:createMollieCheckout`, `settings.controller.ts` `GET/PATCH /settings/payment/provider`
- [x] **`OPERATOR_FULL` bypasses charge/webhook, created CONFIRMED at commit** (v2 behavior; keep for when it returns). `Ref:` [Guide §10 operator_full](./BOOKING-FLOW-DESIGN-GUIDE.md#10-payment-flow) · `Code:` `bookings.service.ts:reserve`
- [~] **Payment-succeeds-after-hold-expired reconciliation.** DONE 2026-07-25 (task #47): `confirmFromPayment` now (a) fires side effects ONLY for a CONFIRMED booking - an EXPIRED booking whose payment lands no longer sends a false confirmation email/conversion; (b) attempts pay-after-expiry RECOVERY - `recoverExpiredBooking` re-claims seats in a guarded tx and confirms if capacity remains; (c) when seats are gone it now REFUNDS the captured payment via `executeRefund` (B5/#50, shared path) instead of leaving money stranded. Fully closed. `Code:` `bookings.service.ts:confirmFromPayment`+`recoverExpiredBooking`+`executeRefund`

---

## 6. Multi-currency (shopper currency, quote)

> Full reference: [../02-architecture/FX-AND-MULTI-CURRENCY.md](../02-architecture/FX-AND-MULTI-CURRENCY.md) (how conversion works, providers, env vars, booking snapshots, spotlight commission).

- [x] **`ReserveBookingDto` accepts `currency` and `quoteId`.** `Ref:` [Guide §20.3](./BOOKING-FLOW-DESIGN-GUIDE.md#203-add-shopper-currency-to-dtos) · `Code:` `dto/booking.dto.ts`. `currency` drives the charged currency (default = tour currency); `quoteId` accepted for forward-compat (reserve recomputes server-side, guide §20.8).
- [x] **`POST /bookings/quote` server-authoritative quote** (deposit/balance, commission, per-line breakdown, expiry, FX source/booking snapshot). `Ref:` [Guide §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · `Code:` `bookings.service.ts:quote()` + `bookings.controller.ts` (`@Public()`, static route before `:id`). Reuses `loadContext` + `computeBookingPricing` (UNIT + FX aware), no side effects; returns booking-currency totals + `source*` + both rates + `quoteId`/`expiresAt` (15 min). **Still deferred:** DB-backed quote + input-hash revalidation; `couponCode` discount preview (flaw #2).
- [x] **Pricing util converts source -> booking currency + writes source fields.** `Ref:` [Guide §20.5](./BOOKING-FLOW-DESIGN-GUIDE.md#205-convert-pricing-utility) · `Code:` `booking-pricing.util.ts:computeBookingPricing` (source/booking currency + `sourceFxRateToBooking`/`fxRateToEur` inputs; per-line conversion; `source*` outputs). Booking snapshots the source fields + FX provenance (`bookings.service.ts:resolvePricing` + reserve create). 5 conversion tests (util + service).
- [~] **Provider-backed FX (pair conversion USD<->EUR, refresh, freshness rules, fail-closed for checkout).** `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `src/fx/` (`FxRate` table, `FxModule`, `FxRatesService` getRate/getDisplayRate/convert/refreshRates, `StaticFxProvider`, fail-closed 503, lazy refresh, stale-display window). **BUILT with a dev/static provider + DB cache; still to do:** a real provider impl (Stripe FX Quotes per guide) behind the same interface (~1 class + 1 `FxModule` line - the seam is ready).
- [x] **FX refresh scheduler + startup warm-up (M4).** `Ref:` [Guide §20.1](./BOOKING-FLOW-DESIGN-GUIDE.md#201-build-provider-backed-fx-rates) · `Code:` `src/fx/fx-refresh.service.ts` (`FxRefreshService`): startup `refreshRates()` + dynamic `SchedulerRegistry` interval every `FX_RATE_REFRESH_MINUTES` (default 30, validated in `env.validate.ts`); non-fatal (logged + swallowed, boot never blocks); in-process `@nestjs/schedule` (no BullMQ, matches `NightlyJobsService`); interval cleared on destroy. 5 tests (`fx-refresh.service.spec.ts`).
- [x] **Public tour/search/detail APIs return converted `money` object + accept `currency`.** `Ref:` [Guide §20.9](./BOOKING-FLOW-DESIGN-GUIDE.md#209-update-public-tour-apis) · `Code:` `MoneyDto` (`src/fx/dto/money.dto.ts`) + `FxRatesService.buildMoney` + `ToursService.attachMoney`/`HubService.attachHubMoney`. `?currency` on tours list/detail/by-id, `/search`, collection render, hub render + our-picks/comparison; each card/detail carries `money{currency,sourceCurrency,fxRate,priceFrom,basePrice}` (falls back to source currency when no rate, never blocks). **Deferred:** collection `getBySlug`/`getActive` + hub hero/collection fastStats aggregates stay source-currency (frontend can derive display from card `money`).
- [x] **TYP/email render booking charged currency, not shopper cookie.** `Ref:` [Guide §20.10](./BOOKING-FLOW-DESIGN-GUIDE.md#2010-update-typ-and-email) · `Code:` TYP (`getThankYou`) + email render `Booking.currency`/`totalRetail`/deposit/balance (never tour currency). Re-verified 2026-07-16 with M5 + the currency selector live: email money formats via `formatMoney(narrowSymbol)` on the charged currency (spec-covered in `booking-email.context.spec.ts`).
- Full sub-checklist: [Guide §23 Multi-Currency Checklist](./BOOKING-FLOW-DESIGN-GUIDE.md#23-multi-currency-checklist).

---

## 7. Hold expiry

- [x] **Expiry logic** (find ON_HOLD past `utcExpiresAt`, release seats, mark unit items + booking EXPIRED, idempotent). `Ref:` [Guide §11](./BOOKING-FLOW-DESIGN-GUIDE.md#11-hold-expiry) · `Code:` `bookings.service.ts:expireStaleHolds`
- [x] **Scheduled sweeper wiring.** DONE 2026-07-25 (#47) as in-process `@Cron`; **moved to a BullMQ job scheduler 2026-08-10 (hardening F8)** - every replica upserts the same fixed scheduler id (`booking.hold-expiry-sweep`, every 60s), Redis keeps ONE schedule, exactly one worker runs each tick. A second app process no longer double-runs the sweep. `Code:` `workers/nightly-jobs.service.ts` + `workers/platform-queue.ts:PLATFORM_SCHEDULES`
- [x] **Seat release recomputes departure status** (SOLD_OUT -> OPEN when seats free). **2026-08-10 (hardening F1): the shared-branch release is now an atomic SQL `GREATEST("bookedCount" - seats, 0)`** - the old read-modify-write lost a decrement when two releases raced (sweeper vs. cancel), leaking seats until an admin noticed. `Ref:` [Guide §7](./BOOKING-FLOW-DESIGN-GUIDE.md#7-departure-state-machine), [Hardening F1](./BOOKING-CONCURRENCY-HARDENING.md) · `Code:` `bookings.service.ts:releaseSeats/recomputeStoredStatus` · `Test:` `test/booking-concurrency.e2e-spec.ts` (50-iteration concurrent-release race)

---

## 8. Cancellation & refunds

- [x] **Cancel releases seats, marks unit items + booking CANCELLED (with cancelledBy/reason/timestamps), in a transaction.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- [x] **Refund eligibility judged at request timestamp** (not admin action). `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel/computeRefund`
- [x] **Deadline computed = tour start - `cancellationHours`, never stored.** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:computeRefund`
- [~] **Payment-model-aware refund amount.** Only FULL/NONE category is returned; no deposit-only vs full-amount computation per model, no partial. `Ref:` [Guide §14 rules](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow), [§17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- [x] **`ON_HOLD` cancellation = no refund** (nothing paid). `Ref:` [Guide §17 cancellation](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` `bookings.service.ts:computeRefund`
- [x] **Operator-forced cancellation -> full refund / free reschedule (`force`).** `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:cancel`
- [x] **Actual Stripe REFUND execution + `REFUND` Payment row** on cancellation. DONE 2026-07-25 (task #50). `BookingsService.executeRefund` fires a real `stripe.refundIntent` on the captured charge and writes a `REFUND` Payment row (REFUNDED once settled, refundId) AND flips the ORIGINAL charge row to REFUNDED at the same settle point (2026-07-26 unification; migration `20260726140000` backfilled old rows). Called from `cancel()` when the policy verdict is FULL (NONE = out-of-window, nothing due), and from `confirmFromPayment` for the pay-after-expiry refund-owed case (B2). Payment-model-aware for free (refunds the actual captured amount: deposit for deposit models, total for paid_in_full). Idempotent (skips if a settled/in-flight REFUND exists + stable Stripe idempotency key `refund-{id}`), config-gated (no charge / no Stripe -> no-op), best-effort (never throws; logs for manual follow-up; durable retry = B6). Email copy corrected to master's "within 3 to 5 business days". Extracted a shared `StripeModule` so BookingsService can inject StripeService without a PaymentsModule cycle. `Ref:` [Guide §14](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:executeRefund`, `payments/stripe.module.ts`
- [x] **Cancellation-confirmed emails once an admin processes the request** (traveller + operator).
  EXECUTED 2026-07-20. `cancel()` previously sent NOTHING, so the request ack's promise ("We'll
  email you to confirm once it's done") and the operator's ("you'll be notified when it is final")
  were both silently broken - a processed request reached the traveller as silence. Now
  `sendCancellationConfirmedNotices` sends both, with refund-verdict-aware copy (FULL names the
  amount and the 5-10 day card timing; NONE explains the window). Best-effort (the seats are already
  released by then, so a dead mailbox must never surface as a failed cancellation), and skipped
  entirely for `heldOnly` releases - an abandoned checkout hold is inventory housekeeping, not news.
  `Code:` `bookings.service.ts:cancel/sendCancellationConfirmedNotices`
- [x] **Tokenized cancel confirmation page (no raw-click cancel) + account fallback - COMPLETE.** PAGE BUILT 2026-07-16 per master 6.4: locale-less `/cancel/{publicRef}` (proxy rewrite, noindex), "Cancel {tour}, {date}?" + refund chip only when paid > 0 (C23) + after-window locked copy; `POST /bookings/typ/:publicRef/cancellation-request` stamps `utcCancellationRequestedAt` on FIRST request and emails admin + traveller ack + operator notice. The B.34 account fallback (email+display_ref booking-lookup login) was built 2026-07-19 with the login hardening (`POST /bookings/lookup`, rate-capped, 24h HMAC session) - ledger verified 2026-07-25. `Ref:` [Guide §14 flow](./BOOKING-FLOW-DESIGN-GUIDE.md#14-cancellation-flow) · `Code:` `bookings.service.ts:requestCancellation`, `frontend app/(frontend)/[locale]/cancel/`
- [x] **Cancellation is reversible on both sides (QA report fix, 2026-08-01).** (1) Traveller
  WITHDRAW of a pending request: `POST /bookings/typ/:publicRef/cancellation-request/withdraw`
  (same session-ownership gate + human-pace throttle + 5/hr per-booking cap as the request) clears
  `utcCancellationRequestedAt` while nothing was executed; notifies admin FIRST ("do not process"),
  traveller ack, operator heads-up + `BOOKING_CANCELLATION_WITHDRAWN` inbox event; account panel
  gains a "Keep my booking - withdraw the request" button (7-locale `cancelWithdraw*`), proxied via
  `app/api/traveller/cancellation-withdraw`. (2) Admin RESTORE of an executed cancellation:
  `POST /bookings/:id/restore` (MANAGE_BOOKINGS + in-service ADMIN check) - guarded seat re-claim
  (refuses resold seats; exclusive needs the departure empty; CANCELLED departures are a dead end),
  booking + unit items back to CONFIRMED, ALL cancellation/operator-report stamps cleared,
  REVERSED settlement reinstated to RECORDED (net recomputed), confirmation email re-sent,
  `BOOKING_RESTORED` inbox event + availability fan-out. Hard refusals: refund settled/in-flight,
  departed, forfeited, hold-only. Dashboard: "Restore booking" row action + ConfirmDialog on
  CANCELLED non-forfeited rows. Migration `20260801130000_booking_restore_withdraw_inbox_events`
  (additive enum values, applied via `migrate deploy`). `Code:`
  `bookings.service.ts:withdrawCancellationRequest/restore`, dashboard `booking-row-actions.tsx`.
- [x] **Repeat cancellation requests refused server-side + cancellation state on the TYP.**
  EXECUTED 2026-07-20. Two halves of one hole: (1) `submitCancellationRequest` waved re-submits
  through as "idempotent", but each one re-sent the admin email, the traveller ack AND the operator
  heads-up - one booking could spam three mailboxes on a loop (only per-IP throttle + a 5/hr
  per-booking cap stood in the way). It now enforces `cancellationEligibility` - the SAME predicate
  the read paths advertise - so ALREADY_REQUESTED / NOT_CONFIRMED / DEPARTED all 409 with
  traveller-facing copy. Note this also closes departure: a booking with an existing stamp could
  previously re-submit after the trip had departed. (2) `GET /bookings/typ/:publicRef` shipped NO
  cancellation state, so the TYP could not tell a pending request from a fresh booking and rendered
  a hardcoded green "Confirmed" chip even on a cancelled booking. It now returns
  `cancellationRequestedAt` / `cancelledAt` / `canRequestCancellation` / `cancellationBlockedReason`;
  the TYP renders a three-way status chip (Confirmed / Cancellation pending / Cancelled) with an
  explanatory note, and both cancel affordances (header button + summary link) gate on the server
  verdict rather than on `status` alone. `/cancel` shows the pending state instead of a second form.
  New `--it-error` / `--it-warning` tokens (the frontend set had green only). 7-locale copy added.
  `Code:` `bookings.service.ts:submitCancellationRequest/getThankYou`, `booking-manage-header.tsx`,
  `frontend app/(frontend)/[locale]/cancel/[publicRef]/page.tsx`
  · The customer `/account` bookings sheet already gated on the same server reasons - unchanged.

---

## 9. Operator non-payment / forfeit

- [x] **Operator reports non-payment -> admin confirms -> only then forfeit deposit + release spot** (no auto-forfeit, no balance tracking in v1). `Ref:` [Guide §15](./BOOKING-FLOW-DESIGN-GUIDE.md#15-operator-non-payment--forfeit) · `Code:` `bookings.service.ts:reportNonPayment/confirmForfeit/dismissNonPaymentReport` (routes `report-non-payment` EDIT_BOOKING · `forfeit`/`dismiss-non-payment` MANAGE_BOOKINGS)
- [x] **Operator cancellation = report-only (access-roles conflict #2, 2026-07-28)**: cancelling a CONFIRMED booking is admin-only (`cancel` 403s non-admins with a "Report cancellation" pointer); operators file `POST /bookings/:id/report-cancellation` (stamps `utcOperatorCancellationReportedAt` + reason, emails ADMIN_EMAIL, idempotent), admin executes (`force` -> FULL refund, `cancelledBy=OPERATOR` so `cancellation_rate_90d` counts it) or `dismiss-cancellation-report`; pending report HOLDS the settlement payout and surfaces as display status `OPERATOR_CANCELLATION_REPORTED`. `Code:` `bookings.service.ts:reportCancellation/dismissCancellationReport`, `settlements.service.ts:payoutBlocker`

---

## 10. TYP & tracking / conversion

- [x] **`GET /bookings/typ/:publicRef` public; conversion object gated on CONFIRMED + non-null EUR commission.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou`
- [x] **Null `commissionAmount` on confirmed booking treated as data corruption -> no conversion.** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:getThankYou/finalizeConfirmation`
- [x] **Mark-first idempotency via `conversionFiredAt` (DB, not localStorage).** `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `bookings.service.ts:finalizeConfirmation`
- [x] **Conversion value = `commissionAmount` EUR, never GMV.** `Ref:` [Guide §9 tracking value](./BOOKING-FLOW-DESIGN-GUIDE.md#9-pricing-and-commission-logic), [Settlement - tracking](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#tracking-stays-unchanged) · `Code:` `tracking.service.ts`
- [x] **Click-id (gclid/gbraid/wbraid/fbclid) + UTM captured at reserve.** DONE 2026-07-25 (task #81; see flaw 9). `Code:` `bookings.service.ts:reserve`, `lib/tracking/attribution.ts`
- [~] **One `booking_complete` -> 4 GTM tags + Meta CAPI (server-side, dedup by event id).** Server CAPI DONE 2026-07-25 (task #44): fires once at confirm, `event_id`=publicRef == browser push (dedup-ready), fbc/event_source_url hardened. REMAINING: the 4-tag GTM fan-out that consumes the dataLayer push + fires the browser Pixel with the shared eventID (A5/#45, blocked on founder GTM/Pixel/CMP creds). `Ref:` [Guide §12](./BOOKING-FLOW-DESIGN-GUIDE.md#12-thank-you-page-and-tracking) · `Code:` `tracking.service.ts`

---

## 11. Confirmation email & notifications

- [x] **One dynamic confirmation email, payment-model-aware, zero-amount rows hidden.** Now the LOCKED wireframe template (2026-07-16): byte-for-byte port with style-parity CI guard, Cloudinary PNG icons, fluid-hybrid mobile + founder spacing refinement, 24h times/locale money-dates, `[EACH]` bullet lists, operator-note card, subject <24h variant, real text/plain part. Old `booking-confirmation.template.ts` DELETED. `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `templates/booking-confirmation-email.template.html`, `bookings/booking-email.context.ts`, `bookings.service.ts:sendConfirmationEmail`
- [x] **Operator "Booking Received" notification (C7)** on every confirmed booking to `companyInfo.companyEmail ?? contactEmail`; same shell (zero-new-styles spec); per-model action copy. (2026-07-16) `Code:` `templates/operator-booking-received.template.html`, `bookings.service.ts:sendOperatorNotification`
- [x] **Cancellation-request emails x3** (admin work-item [throws], traveller ack, operator heads-up via shared `booking-notice.template.html`). Final post-admin confirmations (locked 3-to-5-business-days copy, C23-aware) = CP6 scope. (2026-07-16)
- [x] **TYP resend endpoint** (`POST /bookings/typ/:publicRef/resend`, hard-throttled, recipient never caller-supplied) + **ICS calendar endpoint** (`GET .../calendar.ics`, RFC 5545, real UTC). (2026-07-16)
- [x] **Traveler session + masked TYP + owner-only cancellation.** EXECUTED 2026-07-19 (master 6.4 + login spec §1): the email+reference pair login issues a 24h HMAC email-bound `sessionToken` (also issued by checkout's contact PATCH), stored in a first-party HttpOnly cookie (`POST /api/traveler-session`) and replayed as `X-Traveler-Session`. The bare publicRef TYP link stays permanently valid but renders MASKED (email/phone/last-name masked; pickup address + card withheld; `verified:false`) with a 7-locale "verify it's you" card; `cancellation-request` 401s without an owning session and the `/cancel` page deep-returns through `/bookings?returnTo=`. Lookup gains per-credential caps (5/email + 10/reference per 15min, `lookup-rate-limiter.ts`) with audit + lockout logging. Email-code step-up deferred until invoices/history exist (founder 2026-07-19). `Code:` `bookings/traveler-session.util.ts`, `bookings/lookup-rate-limiter.ts`, frontend `app/api/traveler-session/route.ts`, `thank-you-verify-notice.tsx`.
- [x] **Operator-balance email on `operator_link` - CLOSED AS NOT BUILT (founder 2026-07-25: "operator confirm email keep it as is").** The existing operator Booking Received notice is the only operator email; no second balance email. `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules)
- [ ] **Invoice attachment on confirmation - BLOCKED ON A DECISION.** The spec says "invoice received from Stripe/Mollie", but neither PSP issues a customer invoice for plain payments (Stripe Invoicing is a separate paid product; Mollie invoices only bill the merchant). Options: our own generated PDF invoice (needs founder layout/content sign-off, like the locked email wireframe) or a Stripe receipt link. `Ref:` [Guide §4 step 22](./BOOKING-FLOW-DESIGN-GUIDE.md#4-end-to-end-booking-flow) · not implemented
- [ ] **Pre-tour reminder (24h before; "today/tomorrow" variant; no payment links).** `Ref:` [Guide §13 sequence](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · not built
- [x] **Provider is Resend (Postmark fallback pending).** EXECUTED 2026-07-19: nodemailer/SMTP removed; `mail.service.ts` sends via the Resend SDK, env-configured only (`RESEND_API_KEY` + `MAIL_FROM`; `/settings/smtp` API and `smtp_configuration` table dropped). `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · `Code:` `mail.service.ts` (Resend)
- [ ] **Never name/spotlight operator before payment; name deliberately post-booking on operator_link.** `Ref:` [Guide §13](./BOOKING-FLOW-DESIGN-GUIDE.md#13-confirmation-email-rules) · verify in template copy
- [x] **Dark-mode-safe logo in every email.** EXECUTED 2026-07-19: the SiteInfo logo is a transparent PNG with dark artwork - invisible when Gmail/Outlook dark mode repaints the card. Fix is two-layer: (1) `mail/email-logo.util.ts` `emailSafeLogoUrl()` injects a Cloudinary chained transform (`b_white,c_pad,f_jpg,h_ih_mul_1.2,w_iw_mul_1.2`) that bakes a white chip with 20% padding into the delivered pixels (applied in `mail.service.ts:getSiteLogo`, `booking-email.context.ts`, `bookings.service.ts` x2; non-Cloudinary URLs pass through); logo img bumped 40->48px so the artwork still renders at the wireframe's 40px. (2) `color-scheme: light` meta pair + `:root` rule added to all four shells (3 HTML templates + `auth-email-shell.ts`) so Apple Mail/iOS stop inverting the design entirely. White chip is invisible on the light card, so light mode is unchanged.

---

## 12. Settlement & payouts

- [x] **Write one `Settlement` row per confirmed `paid_in_full` booking** (founder 2026-07-26: self-settling deposit models and operator_full write NO row - the ledger holds only real operator payouts). `Code:` `bookings.service.ts:writeSettlement`.
- [x] **`paid_in_full` payout after the cancellation window (clawback-safe): RECORDED -> PAID_OUT is a MANUAL admin action.** DONE 2026-07-25 (#49), REWORKED 2026-07-26 (founder): the hourly auto-release cron is REMOVED - `PATCH /settlements/:id/mark-paid` (+ `mark-unpaid` undo, `MANAGE_BOOKINGS`) is the only path to PAID_OUT, so it always means a human confirmed the bank transfer. The window close survives as server-computed *eligibility* (`payoutEligible`/`payoutHeld`/`payoutReleaseAt`, SAME deadline formula as the refund path - payout can never precede a possible free refund), enforced in both the dashboard UI and the endpoint's stepwise 409 guards. Migration `20260726120000` reverted the old cron-flipped PAID_OUT rows to RECORDED. The hourly `settlement-reverse-sweep` (cancelled-booking self-heal) remains. `Ref:` [Settlement Part 2 decision 2](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-2---locked-decision-founder-2026-07-15) · `Code:` `settlements.service.ts:markPaidOut/markUnpaid`, `workers/nightly-jobs.service.ts`
- [x] **`net_position` semantics** - the payout owed the operator (collected - commission), zeroed on REVERSED; only paid_in_full rows exist so a negative net can no longer occur. `Ref:` [Settlement - ledger](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#the-settlements-ledger-build-in-v1-extend-later) · `Code:` `bookings.service.ts:writeSettlement`
- [ ] **v2: `operator_full` reintroduced (Connect or bank transfer) + commission collection rail.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred
- [ ] **v2: Stripe Connect Express (destination charge, application_fee = commission), ledger from Stripe events.** `Ref:` [Settlement Part 3](../02-architecture/SETTLEMENT-AND-PAYOUTS.md#part-3---v2-scope-carried-forward) · deferred

---

## 13. Event-driven & queues

- [x] **BullMQ + `@nestjs/schedule` installed and wired** (queues exist for media-upload, notifications; one nightly cron). `Ref:` [Queues §6](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#6-implementation-notes-bullmq--nestjs) · `Code:` `app.module.ts`, `workers/nightly-jobs.service.ts`
- [x] **Synchronous transactional core** (seat claim + booking + payment intent stay off the queue). `Ref:` [Queues §3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#3-the-pattern-synchronous-core-asynchronous-edges) · `Code:` `bookings.service.ts:reserve`
- [x] **Transactional outbox** BUILT 2026-07-25 (B6): `booking.confirmed` committed with the finalize guard, `booking.refund-owed` committed in the cancel transaction; `OutboxRelayService` (5s interval, batch 50, overlap-guarded, enqueue-then-stamp) bridges to the `platform-jobs` BullMQ queue with deterministic jobIds. `Ref:` [Queues §5.2](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#52-transactional-outbox)
- [x] **Confirmation-email job (queued, retry+backoff)** + operator-notice job - both rethrow send failures so BullMQ retries; guard columns stamped only after a clean send; consumers re-validate status (a cancelled booking gets NO confirmation). `Ref:` [Queues §4, §5.3](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory)
- [x] **CAPI conversion job (queued, idempotent by event id** = publicRef, the browser-push dedup contract preserved); null commission fails UNRECOVERABLY (loud, no retry loop). Pre-tour reminder = DELAYED job (start - 24h; skipped inside the window; consumer is a state-checked stub until the founder supplies the template). Refund retry = `booking.refund-owed` job re-invoking the idempotent executor. `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory)
- [x] **Hold-expiry sweep job (repeatable).** DONE 2026-07-25 (#47) as in-process `@Cron`; since 2026-08-10 (hardening F8) literally the designed repeatable BullMQ job (`booking.hold-expiry-sweep`, fixed scheduler id, single-runner across replicas; settlement/review/nightly-commercial sweeps moved with it). `Code:` `workers/platform-queue.ts:PLATFORM_SCHEDULES` + `workers/nightly-jobs.service.ts`
- [ ] **Scheduled `paid_in_full` payout job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [ ] **Pre-tour reminder job (delayed).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [ ] **Affiliate postback job (delayed, approve after window).** `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · not built
- [~] **Nightly quality-score / eligibility / materialization (cron).** Materialization/bookability/spotlight/demand done; quality-score + tier eligibility/grace/demotion are TODOs. `Ref:` [Queues §4](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#4-job-inventory) · `Code:` `workers/nightly-jobs.service.ts`
    - Note - **materialization horizons** (the inventory `departures` are generated by this job): create-time materialize uses a **90-day** default window; the nightly cron uses a **364-day** rolling 12-month window (`from` = today, slides forward one day per night); `MAX_HORIZON_DAYS = 365` cap; `BOOKABLE_HORIZON_DAYS = 30` is the separate ranking/bookability gate, not a generation horizon. Sharp edges: a new schedule shows only 90 days until the next 3 AM run; the 12-month horizon depends on the nightly cron running. Full detail: [Availability §3.1](../02-architecture/AVAILABILITY-AND-DEPARTURES.md#31-materialization-horizons-as-built).
- [~] **Idempotent consumers** (DB guards exist: `conversion_fired_at`, `stripe_webhook_events`). Once jobs move to the queue, add `jobId` dedup + keep DB guards; do not rely on jobId alone. `Ref:` [Queues §5.1](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#51-idempotent-consumers) · partly present
- [x] **Retries + exponential backoff, and keep failed jobs (no silent drop).** 5 attempts, 1s exponential backoff, `removeOnComplete: 1000`, `removeOnFail: 5000` (failures retained + capped). `Ref:` [Queues §5.3, §5.5](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#53-retries-and-backoff)
- [x] **No queue for capacity/overbooking** (atomic update is the control). `Ref:` [Queues §2, §7](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#2-overbooking-and-race-conditions-no-queue) · `Code:` `bookings.service.ts:reserve`

---

## 14. API surface & access

- [x] **Routes:** `POST /bookings`, `POST /bookings/:id/confirm|cancel|extend`, `PATCH /bookings/:id`, `GET /bookings/typ/:publicRef`, `GET /bookings`, `GET /bookings/:id`. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`
- [x] **`POST /bookings/quote`** (`@Public()`, static route before `:id`). `Ref:` [Guide §16 / §20.4](./BOOKING-FLOW-DESIGN-GUIDE.md#204-add-quote-dtos-and-endpoint) · `Code:` `bookings.controller.ts:quote()` (stateless single-currency; see §6)
- [x] **Access rules:** booking create + TYP public; list/detail auth-scoped; webhooks bypass auth+throttle with signature verify. `Ref:` [Guide §16](./BOOKING-FLOW-DESIGN-GUIDE.md#16-api-surface) · `Code:` `bookings.controller.ts`, `payments.controller.ts`
- [x] **No raw Prisma rows returned; status/commission/tier not client-settable.** `Ref:` [Guide §17 security](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases) · `Code:` DTO `select` shapes
- [x] **E2E coverage for checkout -> processing -> TYP.** EXECUTED 2026-07-29. The flow that
  produced three production defects had NONE. 14 specs, 42/42 across 3 repeats, no flakes:
  `e2e/tests/checkout.spec.ts` (contact render/validation/email/`?payment=failed`; reserve + PSP
  iframe ATTACHED - the assertion that catches an unusable mount container; Edit round trip keeps the
  iframes mounted; and a full **pay-through** with Stripe test card 4242 landing on a confirmed TYP)
  and `e2e/tests/booking-handoff.spec.ts` (processing with no ref redirects; polling shows progress
  and always yields the manual escape hatch; `redirect_status=failed` returns to checkout; TYP 404
  screen for an unknown ref AND for a destination mismatch - the `island` guard; TYP renders a real
  booking at its locale-less URL; and the RSC content-type check).
  **Nothing is mocked** - fixtures are DISCOVERED from the live backend (`e2e/helpers/booking.ts`),
  never pinned to a seed slug, which has rotted specs here before.
  **Traps worth knowing, all hit while writing these:**
  (a) `notFound()` in a streamed Suspense boundary CANNOT set a 404 - the 200 shell is already
  flushed, so these assert on the rendered 404 screen, not on status.
  (b) Typing before hydration silently loses the input (React resets the controlled value), so
  `openCheckout` waits on the `it-checkout-return:{tourId}` sessionStorage key the form writes on
  mount - a far tighter signal than `networkidle`.
  (c) `getByText` on streamed content hits React's hidden holding-pen copy; assert on body text.
  (d) The specs hold REAL seats, so a hammered departure sells out mid-run - `reserveBooking` rolls
  onto another available departure and THROWS the backend's message rather than returning a bare null.
  (e) The pay-through test is gated on a `pk_test_` key so it can never charge a live account; PSP
  state is PROBED via the intent endpoint, never guessed from config (guessing the
  `payment_settings` column names produced a confident, wrong "no PSP configured").
  (f) The RSC content-type test is Vercel-only and passes trivially against localhost - annotated as
  informational there rather than left looking like coverage it does not provide.
  (g) `POST /payments/typ/:publicRef/settle` is capped at **20/HOUR PER IP** (each call costs a live
  Stripe API hit). A traveller settles once; a suite run from one IP spends several, so the
  pay-through test SKIPS with that reason when it sees a 429 rather than surfacing an opaque 90s
  `waitForURL` timeout that reads like a broken hand-off. If it skips, wait for the window to roll
  over - it is not a regression.
  **Also fixed:** `e2e/auth.setup.ts` was throwing 403 since the four-door login enforcement shipped
  (no `x-login-surface` header), so `globalSetup` failed and the ENTIRE suite had been dead - which is
  how the checkout gap went unnoticed. **Known-red, DELIBERATELY KEPT (founder 2026-07-29):** the 10
  `/dashboard/*` specs (`attributes`, `categories`(+`-new-fields`), `collections`, `destinations`
  (+`-new-fields`), `hubs`(+`-new-fields`), `trips/*`) drive a surface extracted to its own repo and
  now redirected to the homepage by `proxy.ts` `LEGACY_DASHBOARD_PREFIXES`, so they land there and
  fail. Retention was asked for explicitly - they are the port source if that coverage is ever moved
  to the dashboard repo. Consequence to hold in mind: a bare `pnpm test:e2e` is red by design, so
  run the public-site specs by path (`checkout`, `booking-handoff`, `tour-reviews`) when you need a
  meaningful signal, and do not read a red suite as "the booking flow is broken".
- [x] **`INTERNAL_API_SECRET` no longer bypasses the throttle platform-wide.** EXECUTED 2026-07-29
  (security review). It was the sole global `skipIf`, so ANY request carrying `x-internal-api-key`
  skipped every tier on every route - including the deliberately tight `@Throttle()` overrides on
  settle, resend, cancellation-request, conversion, pair login, recover-reference and the traveller
  OTP request/verify. One leak lifted all of them at once.
  **The scoping rule: a route that declares its OWN `@Throttle()` is never bypassed.** No allow-list
  to maintain and it cannot drift - tightening a route removes it from the bypass automatically,
  because the `@Throttle()` IS the marker (matched by metadata-key prefix, so it holds for any
  throttler name).
  **The trap this opens, and the fix.** Our SSR renderers call the API server-to-server, so `req.ip`
  is one egress address shared by every visitor - any per-IP limit on a route reached that way is a
  single platform-wide bucket. `POST typ/:publicRef/conversion` is the one such route (3/10s, 5/min),
  so left alone it would have capped conversion claims at 5/min for ALL travellers combined and
  killed tracking silently. `TrustedOriginThrottlerGuard` therefore tracks by a forwarded visitor IP
  (`x-real-client-ip`) when - and only when - the caller also presents the internal secret, so a
  browser cannot spoof a fresh bucket. `claimConversionPush` forwards it; that header must NEVER be
  added to the shared `serverHeaders()`, which runs inside `'use cache'` scopes where request headers
  are unavailable. The guard also WARNS whenever a trusted origin is throttled, so any future SSR
  caller that forgets the header shows up in logs instead of as mysterious intermittent 429s.
  **Verified:** `next build` is the live check for the read path - prerendering fires hundreds of
  public GETs carrying the secret from one IP, and it passes (both `.env`s have the secret set), so
  the bypass still covers prerender fan-out. Unit tests cover the composed `skipIf` (trusted+ordinary
  → skip, trusted+`@Throttle`'d → do NOT skip, anonymous → never skip), the tracker (forwarded IP
  honoured only with the secret, chain takes the first hop, falls back to the egress IP, never
  empty), and a guard test asserting our mirrored `THROTTLER:LIMIT` prefix still equals the
  library's - so a `@nestjs/throttler` rename fails the suite instead of silently re-widening the
  bypass. **Dashboard impact: none** - its server-side calls (`/users/me`, `/users/me/permissions`,
  `/settings/social-media`, `/operators/*`, `/analytics/dashboard`, `set-password`,
  `password-change/request`, `operators/onboarding`) carry no `@Throttle()`, and
  `password-change/confirm` (which does) never sends the secret, so it is unchanged.
  **Still open:** that same `password-change/confirm` is an SSR call on a tight limit with no
  forwarded IP, so it shares one bucket across all dashboard users - pre-existing, not introduced
  here, and rare enough to be theoretical, but it wants the same header treatment.
  `Code:` `auth/internal-origin.util.ts`, `auth/trusted-origin-throttler.guard.ts`, `auth.module.ts`,
  frontend `lib/api/public/bookings.ts:claimConversionPush`
- [x] **`reserve` gained a per-DEPARTURE cap** (60/min, `TargetRateLimiter`). EXECUTED 2026-07-29.
  It is `@Public()` and its only other bound was the per-IP throttle, which a multi-IP caller
  sidesteps. Capacity already caps how many seats can be HELD at once; this bounds the rapid
  create/expire/re-create churn that would keep a popular departure looking sold out. The idempotent
  replay (same `dto.id`) returns before the limiter, so a retried Continue is free. `quote` is left
  on the global tiers deliberately - it is a cheap stateless read and the booking widget re-quotes on
  every selection change, so a per-target cap there risks rejecting a real shopper for no gain.
  `Code:` `bookings.service.ts:reserve`

### 14b. Dashboard operations pages (added 2026-07-16, founder request)

Three new dashboard menus, each reusing the tours TanStack table pattern (same UI, pagination,
comprehensive filters, search, date-range) and permission-gated per master RBAC + `lib/config/rbac.ts`
(operators scoped to their own tours' rows; admin sees all).

- [x] **Bookings list page** (`/dashboard/bookings`) - BUILT 2026-07-16. Backend: `GET /bookings`
  query DTO extended (`search` on refs/guest/tour, `paymentModel`, `cancellationRequested`) +
  `BookingListItemDto` (tourName, contact, partySize, createdAt, freeCancelDeadline,
  requestedInFreeWindow judged at request instant per C23). Frontend: reusable TanStack table
  (search, status/model selects, travel-date range, columns toggle, pagination), commission
  columns ADMIN-only (rule #22), row actions (details dialog, copy ref, admin Mark cancelled via
  `POST /bookings/:id/cancel`). `Code:` `components/dashboard/bookings/*`,
  `lib/api/bookings-dashboard.ts`, `hooks/bookings/use-bookings.ts`
- [x] **Payments list page** (`/dashboard/payments`) - BUILT 2026-07-16. Backend: NEW
  `GET /payments` (`@RequirePermissions(VIEW_PAYMENTS)`, operator scoped via `booking.operatorId`,
  filters status/kind/provider/search/created-range). Frontend: same table pattern.
  `Code:` `payments.service.ts:list`, `components/dashboard/payments/*`
- [x] **Cancellation Requests page** (`/dashboard/cancellation-requests`) - BUILT 2026-07-16.
  Same bookings table in queue mode (`cancellationRequested=true`, OLDEST request first) with
  Requested / Free-window / Refund-due columns; admin executes master 6.4 "marks cancelled" from
  the row action (refund STILL manual until CP6 wires real Stripe refunds). Operator role granted
  `VIEW_BOOKINGS` in BOTH role configs (master roles doc: operators "view own bookings"; scoping
  server-side). Nav: new "Cancellation Requests" item gated on `VIEW_BOOKINGS`.
  UPDATED 2026-07-20 - queue defaults to OUTSTANDING work. The page filtered only on
  `cancellationRequested=true`, which never excluded processed rows, so the queue grew forever and
  (sorting oldest-first) buried the requests still needing attention under the handled ones. A
  Pending / Processed / All requests control now sits where the status filter is suppressed in queue
  mode, defaulting to Pending -> `status=CONFIRMED` (a request is outstanding exactly while it has a
  stamp and the booking is still confirmed). Frontend-only, via the existing status param; a filter
  default rather than a hard exclusion, so history stays reachable. Empty state distinguishes
  "Nothing pending" from "No cancellation requests". KNOWN LOOSENESS: Processed reads as
  cancellation history, because `cancel()` stamps `utcCancellationRequestedAt` on every
  cancellation - so admin-initiated cancels with no traveller request appear there too. Pending is
  exact; tightening Processed would change refund-instant semantics, so it was left alone.
  The nav badge had the SAME bug and is fixed with it: its comment said "awaiting admin review" but
  the query never filtered status, so it counted every cancellation ever and never decremented (it
  read 3 against a 1-row Pending queue). It now pins `status=CONFIRMED`, as does the hover-prefetch
  key - which must match the list view's mount-time params exactly or the warmed cache is dead.
  `Code:` `components/bookings/bookings-list-view.tsx`, `bookings-table.tsx`,
  `components/shell/nav-main.tsx`, `use-nav-prefetch.ts` (dashboard repo)

---

## 15. Edge cases (Guide §17) - verification matrix

`Ref:` [Guide §17](./BOOKING-FLOW-DESIGN-GUIDE.md#17-edge-cases), [Queues §8](../02-architecture/EVENT-DRIVEN-AND-QUEUES.md#8-mapping-to-the-booking-flow-edge-cases)

- [x] Two users race last seats -> one guarded update wins.
- [x] Departure closes / cutoff passes after read -> submit fails (`WHERE status='open'` + live cutoff).
- [x] Party size exceeds remaining -> claim fails.
- [x] Payment intent retried -> same provider intent (idem key).
- [x] Webhook redelivered -> skipped via event ledger.
- [x] Payment succeeds after hold expired -> DONE 2026-07-25 (#47 + #50): no false confirm; recover (re-claim seats) if possible, else refund the captured payment (real Stripe refund, #50).
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
- [x] Deposit forfeiture never automatic (operator report -> admin confirm).
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

- [~] **1. `booking_complete` browser push on the TYP.** Push itself DONE 2026-07-25 (task #42):
  the TYP server component claims the push mark-first (`claimConversionPush`, forwarding the traveler
  session) and the `<ConversionPush>` client leaf pushes `booking_complete` to `window.dataLayer`
  once per load (prod-only via `NEXT_PUBLIC_ENABLE_TRACKING`, EUR commission value, `event_id` =
  publicRef for CAPI dedup). `Code:` `lib/tracking/booking-complete.ts`,
  `components/frontend/thank-you/conversion-push.tsx`, TYP `page.tsx`. REMAINING on this line: the
  hashed-PII fields (#43), click ids (#81), GTM container fan-out to Conversion Linker / Google Ads /
  GA4 / Meta Pixel (#45, blocked on founder creds), and server CAPI dedup (#44).

- [x] **2. FIRE-POINT RECONCILIATION (double-fire risk).** DONE 2026-07-25 (task #39). The server
  CAPI + email still fire at webhook/settle-confirm (`finalizeConfirmation`, guarded by
  `conversion_fired_at`); the **browser** push now has its OWN guard, new nullable
  `Booking.conversionPushedAt` (migration `20260725044039_...`), so it is independent of the
  already-set `conversion_fired_at`. The `conversion` payload was **removed from `GET typ/:publicRef`**
  (that GET is also the /payment/processing poller, so returning it double-fired the pixel on refresh -
  §8.1 item 5) and is now served ONCE, mark-first, by **`POST typ/:publicRef/conversion`**
  (`claimConversionPush`): verified-session + CONFIRMED + non-null-commission gated,
  `updateMany({where:{id, conversionPushedAt:null}})` picks the single winner, everyone else gets
  `{conversion:null}`. Dedicated endpoint (not the GET) so the poller can't consume the one push.
  `eventId` = `publicRef` (matches the server CAPI `event_id` for Meta dedup). `Code:`
  `bookings.service.ts:claimConversionPush`, `bookings.controller.ts:claimConversion`,
  `booking.dto.ts:ConversionPushResponseDto`. Tests: 7 new (winner/loser/unverified/not-confirmed/
  null-commission/404 + GET-drops-conversion); backend suite green (1477/67). The browser push that
  CONSUMES this endpoint is item 1 (task #42, next).

- [ ] **3. Operator balance email (`operator_link`).** Master §6: on `operator_link` a
  **second** operator-balance email follows the Island Tours confirmation. The IT confirmation
  email is wired (`sendConfirmationEmail`); the **operator balance email is not**.

- [x] **4. Real-data TYP - DONE 2026-07-16** (detail in "Deferred follow-ups" above). Backend
  payload expanded + frontend mapped to real data; demo payload deleted; cross-sell fetches real
  tours. Verified live. The `booking_complete` push (item 1) now has real values to send.
  **Finding raised:** `paymentMethodBrand`/`paymentMethodLast4` came back **null** on a paid
  OPERATOR_LINK booking, so the TYP card line is empty - §5 marks the billing/card snapshot `[x]`,
  so confirm whether the Stripe webhook path actually writes it.

- [x] **5. PII hashing** DONE 2026-07-25 (task #43). Server-side SHA-256 of email/phone
  (libphonenumber-js E.164)/name/address, ONE normalize+hash pass serving both Google EC (browser
  push `user_data`, hashed server-side - raw PII never sent) and Meta AM (CAPI). §8.1 item 3 / 8.3.
  `Code:` `tracking/pii-hash.util.ts`, `bookings.service.ts:buildConversionPayload`, `tracking.service.ts`.

- [ ] **6. Meta CAPI** (server, parallel to the Pixel, dedup by shared event id) - needs the
  Meta Pixel id + CAPI access token (external creds).

- [ ] **7. GTM container + tag fan-out** - the frontend pushes to `dataLayer`; the container +
  4 tags are configured in the GTM web UI (needs a GTM container id).

- [ ] **8. Consent Mode v2 + CMP** (EEA denied by default, US/CA granted) - needs a CMP choice
  (Cookiebot or Iubenda) before the GTM build (§8.1 item 7).

> Cross-refs: `technical-doc/02-architecture/TRACKING-AND-ANALYTICS.md`, master §8. Booking
> rule #22 (conversion = EUR `commission_amount`, never GMV) already enforced server-side.

