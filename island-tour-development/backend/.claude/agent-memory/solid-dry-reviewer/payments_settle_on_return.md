---
name: payments_settle_on_return
description: Review of the synchronous settle-on-return payment confirmation path (payments.service.ts settleFromReturn, stripe.service.ts retrievePaymentIntent, POST /payments/typ/:publicRef/settle) — 2026-07-19
metadata:
  type: project
---

## Feature reviewed (uncommitted, 2026-07-19)

`settleFromReturn(publicRef)` in `backend/src/payments/payments.service.ts` confirms a booking
synchronously the instant the browser reports Stripe success, instead of waiting for the async
`payment_intent.succeeded` webhook. It re-verifies the PaymentIntent with Stripe
(`StripeService.retrievePaymentIntent`, expands `latest_charge`) and funnels through the SAME
private `onIntentSucceeded` the webhook uses → `BookingsService.confirmFromPayment`.

## Verdict: pattern is correct and industry-standard

This is the textbook Stripe-recommended pattern (confirm client-side, verify server-side on
return, webhook stays the durable backstop). It does NOT fight
`technical-doc/02-architecture/EVENT-DRIVEN-AND-QUEUES.md` §3 ("synchronous core, async edges") —
it doesn't touch the transactional booking-create/seat-claim/intent-create path at all; it's a
second consumer of an already-created PaymentIntent's *outcome*, reusing the exact same idempotent
consumer the webhook uses. `technical-doc/03-implementation/BOOKING-WIDGET-CHECKLIST.md` line 146/174
had ALREADY flagged "processing page holds on webhook->CONFIRMED" as an unresolved latency flaw —
this change closes a documented gap, it doesn't invent a new pattern against the grain.

## The race this enables — and how it's handled (READ THIS BEFORE FLAGGING IT AS A BUG)

Settle and the webhook now race on ~every checkout (both fire within ~1s of Stripe success). A
naive read-then-write in `confirmFromPayment`/`finalizeConfirmation` would double-send the
confirmation email + double-fire the CAPI conversion (exactly the master's §8 table edge case
"TYP refresh / email revisit double-fires conversion").

As of this review, `BookingsService.confirmFromPayment` (bookings.service.ts ~line 649) and
`finalizeConfirmation` (~line 723) BOTH use the correct **mark-first atomic `updateMany`** pattern
(`where: { id, status: ON_HOLD }` / `where: { id, conversionFiredAt: null }`, checking
`count === 1` to determine the winner) — this is the exact §5.1 "mark-first" guard the master
prescribes, mirroring the departure seat-claim guarded update. This is well-executed and should be
held up as the reference implementation for future dual-entry-point (webhook + sync-return)
confirmation flows.

**IMPORTANT — verify this is still true before trusting it**: mid-review, two sequential reads of
the same line range of `bookings.service.ts` returned DIFFERENT code (first read showed a plain
read-then-write with no guard; second read, minutes later, showed the atomic guarded version). The
file was being actively edited by someone/something else during the review session. Grep for
`updateMany` + `conversionFiredAt: null` in `confirmFromPayment`/`finalizeConfirmation` before
relying on this being fixed in a future review — do not assume it's still there.

## Real gap found: zero test coverage on the guard itself

`backend/src/bookings/bookings.service.spec.ts` mocks `booking.updateMany` with a comment
literally saying "Override to `{ count: 0 }` to simulate losing a race with the concurrent
webhook/settle caller" — but there is NO `describe('confirmFromPayment'...)` block and no test
ever exercises the `count === 0` loser path. The mechanism that prevents the double-email/
double-conversion bug is completely untested. `payments.service.spec.ts` mocks
`bookings.confirmFromPayment` as a bare jest.fn(), so it can't and doesn't cover this either — the
coverage has to live in bookings.service.spec.ts.

## Other findings from this review

- `POST /payments/typ/:publicRef/settle` only pins `short`/`medium` throttle tiers; every sibling
  publicRef-keyed TYP mutation (`resend`, `cancellation-request` in bookings.controller.ts) pins
  all three (`short`/`medium`/`long`) tightly (10/hr). Settle silently inherits the global 3000/hr
  `long` tier — inconsistent with the established sibling pattern, and settle is the one that costs
  a live Stripe API call per hit.
- `stripe.service.spec.ts` has no test at all for the new `retrievePaymentIntent` method.
- Good DRY reuse: `resolveCharge`'s `expandedCharge` helper already handled both a string
  `latest_charge` (webhook shape) and an object (expanded shape) before this change, so
  settle's `expand: ['latest_charge']` request slots in with zero new branching — nice payoff from
  the original webhook code being defensive.
- Frontend `checkout-processing.tsx`'s `settleThenPoll` → `poll` chain has no double-loop/double-
  redirect race: `poll()` is only ever invoked once, from inside `settleThenPoll`, and every async
  branch is gated by the effect's `active` flag. Reviewed carefully, this is correct as written.
