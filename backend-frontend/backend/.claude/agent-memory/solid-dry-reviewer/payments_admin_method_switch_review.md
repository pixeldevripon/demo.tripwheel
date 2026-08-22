---
name: payments-admin-method-switch-review
description: Payment-methods-board wave 2 (2026-08-16) review findings in payments.service.ts - Mollie paymentMethodTypes empty-list contract gap + redundant paymentMethods() Prisma reads per request
type: project
---

Reviewed 2026-08-16: backend/src/payments/payments.service.ts gained an admin
per-method checkout switch (Settings -> Payments, `paymentMethods[]` column on
`stripe_configuration`/`mollie_configuration`; empty = "all on"). Two findings
worth checking again if this file is touched:

1. **Mollie's `paymentMethodTypes` response field never implements the
   "empty = all on" fallback that Stripe's sibling code does.** Stripe's
   `createStripeIntent` (line ~331) correctly does
   `enabledMethods.length ? offered.filter(...) : offered` - i.e. falls back
   to the REAL eligible list when the admin hasn't restricted anything.
   Mollie's `createMollieCheckout` phase 1 (line ~379) and `mollieResponse`
   (line ~490) just do `paymentMethodTypes: await this.mollie.paymentMethods()`
   - the raw admin config, verbatim. When that config is empty (the
   documented "all on" default), this field comes back `[]`, contradicting
   the contract every other line in the same file states. The ACTUAL payment
   restriction still works correctly (Mollie's `createPayment` builds its
   `method` array from the same list and omits it entirely when empty, so the
   hosted page really does offer everything) - only the *response field*
   lies. Currently harmless because nothing in the frontend reads this field
   for the Mollie flow (`checkout-payment-mollie.tsx` only reads `profileId`,
   card-only inline UI) - but it's a live footgun for whoever wires up a
   Mollie method-list UI later, or for the dashboard if it ever surfaces this
   field.
   **How to apply:** if a future task adds any UI/API consumer of the Mollie
   `paymentMethodTypes` field, fix this first (mirror the Stripe fallback, or
   at minimum stop claiming "empty = all on" in the doc comment).

2. **Redundant `mollie.paymentMethods()` calls per request** (each one is a
   Prisma `findUnique` + `decrypt()`, no caching in `MollieService.config()`).
   Phase 1 of `createMollieCheckout` calls it twice in the same response build
   (once via the new private `mollieCardEnabled()` helper at line ~371, once
   directly for `paymentMethodTypes` at line ~379) - plus `componentsProfile()`
   already does its own separate query. Phase 2 (with a cardToken) calls it a
   third time inside `mollie.createPayment()` (mollie.service.ts:95) and a
   fourth time in `mollieResponse()`. None of this breaks correctness (mocks
   return the same value every time in tests, masking it) but it's 3-4x more
   DB+decrypt round trips than needed per checkout request.
   **How to apply:** if touching this function again, fetch
   `this.mollie.paymentMethods()` ONCE near the top and thread the list
   through (derive `cardEnabled` from it inline) instead of re-querying.
