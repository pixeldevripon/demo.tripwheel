---
name: customer_accounts_feature_security
description: Second-pass security review of the "Customer Accounts" feature (2026-07-20) - confirms the three critical gaps from the first pass (confirm() free-confirmation, cancel() no-ownership, update() unproven-email) are now fixed, and documents two remaining gaps the fix round introduced/missed.
type: project
---

# Customer Accounts feature - SECOND PASS review, 2026-07-20

Re-reviewed after the team applied fixes for the three CRITICAL/HIGH findings from the first pass
(see the prior version of this memory, now superseded). Traced every gate end-to-end against
current code, not just re-read the comments.

## CONFIRMED FIXED (do not re-flag)

- **`confirm()` (`bookings.service.ts` 606-674) now requires proof of payment before ON_HOLD ->
  CONFIRMED.** `dueNow` (deposit or full total per `paymentModel`) is compared against a
  `bookingId`-scoped `SUCCEEDED`, non-REFUND `Payment` aggregate; short of `dueNow` throws 402.
  Verified currency-safe: `Payment.amount`/`currency` are always written from `booking.currency` at
  `createIntentForBooking` (`payments.service.ts` ~208-225), so a booking's payments can never be in
  a different currency - the 402 check is always apples-to-apples, no conversion bug. Verified the
  REFUND-netting gap (aggregate excludes REFUND rows by `kind: { not }` rather than subtracting them,
  unlike `derivePaymentState` which correctly nets) is currently UNREACHABLE - grepped the whole `src/`
  tree, no code path anywhere creates a `Payment` row with `kind: REFUND` yet (webhook only handles
  `payment_intent.succeeded/failed`). Flag again once refunds are wired to Payment rows (settlement
  phase) - net paid-minus-refunded then, matching `derivePaymentState`'s shape.
  Spec tests (`bookings.service.spec.ts` ~762-782) explicitly override the mock's fully-paid default
  to unpaid/short-paid and assert the 402 + that `booking.update` never runs - proves the gate
  actually executes, isn't hidden behind the mock default.
- **`update()` (`bookings.service.ts` 1650-1721) now gates contact rewrites on a CONFIRMED booking
  behind `sessionOwnsBooking(verifyTravelerSession(sessionToken), ...)`.** ON_HOLD stays ungated by
  design (pre-payment checkout sets the initial contact). Notes/pickup-only updates on CONFIRMED
  correctly skip the gate. Tested for both the 401 (no/wrong session) and success (session for
  current contact) cases.
- **`cancel()` (`bookings.service.ts` 1536-1627) now requires an authenticated ops actor
  (platform-wide role, or the owning operator via `resolveOperatorId`) for anything past ON_HOLD.**
  Anonymous/`Role.USER` -> 401; foreign operator -> 404 (no existence oracle, verified via
  `resolveOperatorId` throwing BadRequestException only when the actor has NO operator profile at
  all, which happens before the ownership comparison and so isn't an oracle either). ON_HOLD stays
  public (checkout-abandon), unchanged. Tested for both cases.
- **`mapBooking()` commission stripping was added to `getById()` and `list()`** via
  `stripCommissionForCustomer(payload, actor.role)` - `Role.USER` gets `commissionRate`/
  `commissionAmount` nulled. `list()` has a passing test proving this (`bookings.service.spec.ts`
  "nulls the commission snapshot on rows returned to a USER").
- **Customer-provisioning email-bomb cap closed.** `createCustomerAccount`
  (`customer-provisioning.service.ts` ~150-186) now seeds the SAME `TargetRateLimiter`
  `customer-welcome` bucket (1/24h) that `resendSetPasswordLink` uses, BEFORE the first
  `requestPasswordReset` call - the old gap (uncapped first send, only resends were capped) is
  fixed. Non-`Role.USER` emails (operator/staff/admin) still correctly skipped outright.
  Backfill-linking still correctly scoped to `userId: null` only (can't reassign an already-owned
  booking).
- **`auth.instance.ts` invite branch (`sendResetPassword`, ~49-130) correctly branches on
  `!request`** - genuine forgot-password HTTP calls always carry `request` and take the `else`
  branch (neutral `sendPasswordResetEmail`), never the customer-welcome/staff-invite copy. No
  template/URL confusion. `customerWelcomeTemplate` escapes the caller-supplied name via
  `escapeHtml`.
- **`payments.service.ts list()`** - `Role.USER` branch (`where.booking = { userId: actor.id }`)
  cannot be widened: `ListPaymentsQueryDto` has no `operatorId`/`tourId`/`userId` field (whitelist
  strips it), and `Payment` rows carry no commission fields at all (commission lives only on
  `Booking`).
- **Controller wiring verified correct**: `GET /bookings/me/summary` registered above `GET
  /bookings/:id`; both plus `POST /bookings/:id/cancellation-request` carry
  `@RequirePermissions(VIEW_BOOKINGS)`; cancellation-request is throttled at the route AND has a
  per-booking `TargetRateLimiter` cap inside `submitCancellationRequest`.

## NEW findings from this pass (not yet fixed)

### MEDIUM: `cancel()`'s pre-existing idempotent CANCELLED early-return bypasses the NEW auth gate

`bookings.service.ts:1542` - `if (booking.status === BookingStatus.CANCELLED) return
mapBooking(booking);` runs BEFORE the newly-added authorization block (1550-1571). This line
predates the current fix round (confirmed via `git diff` - it's unchanged context, not a `+` line);
the new auth code was inserted after it without extending coverage. Effect: ANY caller - anonymous
or wrong-role - who has/guesses/leaks the raw UUID of an ALREADY-CANCELLED booking (including a real
customer's past paid trip) gets a 200 with the full `mapBooking()` payload (commission fields,
totals, paymentModel, cancellationRefund) with ZERO auth check. No test in the spec suite exercises
this path with a wrong-role actor - the gap wasn't caught. **Fix: move the idempotency short-circuit
after the authorization block**, or make it conditional on the same actor check as the live path.

### MEDIUM: commission fields leak from the WRITE endpoints the stripping fix didn't touch

`stripCommissionForCustomer` was added to `getById()`/`list()` only. `cancel()` (both the early
return above and the success return ~1626), `confirm()` (674), `update()` (1703/1720), `extend()`
(1647), and `reserve()` (492/494) all still return raw `mapBooking(...)` with unmasked
`commissionRate`/`commissionAmount`. These are all `@Public` and reachable by a checkout guest OR a
logged-in `Role.USER` acting on their own booking (e.g. cancelling their own still-ON_HOLD booking,
which is allowed for any actor) - so the platform's take-rate leaks into the raw JSON response body
(devtools/network tab) even though the dashboard read endpoints now correctly hide it. **Fix**:
either thread `actor.role` through these methods and strip there too, or strip commission fields
from `mapBooking()`'s public shape entirely and only attach them via the two dashboard mappers.

### LOW/MEDIUM: `TargetRateLimiter`'s single shared 50k-key budget has no per-bucket partition

`lookup-rate-limiter.ts` 186-214 (`TargetRateLimiter.consume`) - now a process-wide singleton
(`common/rate-limit.module.ts`) shared across `resend`, `cancel-req`, `recover`, `settle`, AND the
new `customer-welcome` bucket. `MAX_TRACKED_KEYS` (50,000) is a GLOBAL cap across ALL buckets
combined; overflow evicts oldest-inserted keys regardless of bucket. `recover`'s key is a
caller-supplied email (any string, no existence check) and `resend`/`cancel-req`'s key is a
`publicRef` - both attacker-choosable/enumerable, unlike `customer-welcome`'s key (a real contact
email). A distributed (multi-IP, since per-IP throttles cap single-source volume) attacker flooding
`recover`/`resend` with tens of thousands of distinct fake targets can push the map past 50k and
evict a `customer-welcome:<victim-email>` counter that was legitimately at its 1/24h cap, letting a
subsequent booking under that email re-trigger a send inside the same window. Bounded by real
distributed effort, so non-trivial but real. **Fix**: give `customer-welcome` (or any bucket that's
actually security-load-bearing) its own capacity ceiling, or evict per-bucket LRU instead of one
global oldest-key queue.

### Informational

- `reserve()`'s `operatorFull` CONFIRMED-with-no-payment branch (342-396, 490-494) is dead code:
  `loadContext()` (2314-2318) unconditionally rejects `PaymentModel.OPERATOR_FULL` for both
  `reserve`/`quote`, so the public API can never reach it (only the demo seed creates OPERATOR_FULL
  bookings, directly via Prisma). Not a vulnerability, just worth deleting - reads like a live
  payment-bypass path but isn't reachable.

**Why:** This is the second security pass on the same feature - the point is verifying fixes hold
under adversarial tracing, not re-describing the feature. The three original critical/high findings
are genuinely closed (traced the actual gate logic + the tests that pin it), which is the important
signal: the team's fix pattern (payment-ledger proof before status flip, session-ownership before
contact rewrite, role/ownership before non-hold cancel) is sound and reusable for any future
booking-lifecycle mutation.
**How to apply:** Before a third pass, check whether the CANCELLED-early-return reorder landed,
whether commission stripping was extended to the write endpoints, and whether `customer-welcome` got
its own rate-limit ceiling. If all three are fixed, this feature's gates can be considered settled -
no need to re-trace `confirm()`/`update()`/`cancel()`'s core logic again unless it changes.
