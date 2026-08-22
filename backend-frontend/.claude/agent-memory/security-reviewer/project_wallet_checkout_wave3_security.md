---
name: project_wallet_checkout_wave3_security
description: Security review of Apple Pay/Google Pay wallet sheet at checkout (wave 3 of payment-methods-board) across island-tour-development + tripwheel-x-islandtours-dashboard
type: project
---

Reviewed 2026-08-17 (uncommitted, branch `payment-methods-board`, both repos): backend
`payment-method-brands.ts`/`payments.service.ts`/`payment.dto.ts`, frontend
`checkout-form.tsx`/`checkout-payment.tsx` (new `WalletExpressRow` using Stripe's
`ExpressCheckoutElement`)/`reserve-and-pay.ts`/`bookings.ts`, and the dashboard's
`payment-methods-board.tsx`/`payment-method-guides.ts` (wallet switches + always-on
"how it works" guide + loading skeletons).

**Result: CLEAN, no CRITICAL/HIGH/MEDIUM findings.** Only a LOW/informational note (see
below). Six specific attack-surface questions were traced end-to-end against actual code
(not assumed):

1. **Operator-conditions gate vs. the wallet path**: `WalletExpressRow`'s `onClick` gate
   (withholds `resolve()` when `termsSatisfied === false`) is confirmed **belt-only, not
   load-bearing**. The component only ever mounts when `intent?.provider === 'STRIPE'`
   (`checkout-form.tsx` ~1093), and that state is only reachable via
   `applyIntentResult`'s `'stripe'` case, which only comes from `intentForBooking()` ->
   `createPaymentIntent()` -> backend `PaymentsService.createIntentForBooking`
   (`payments.service.ts` ~252): `if (booking.tour?.operatorTermsKind &&
   !booking.operatorTermsAcceptedAt) throw UnprocessableEntityException(...)` runs
   unconditionally BEFORE the PSP branch (`createStripeIntent` is `private`, single caller).
   So a live Stripe `clientSecret` for a gated tour cannot exist client-side without the
   server already having recorded acceptance - the wallet sheet literally cannot exist to
   click before that. Same conclusion the wave-2 review reached for the Pay button/Klarna
   path; wallets add no new bypass.
2. **`return_url` construction** (`${window.location.origin}${processingHref}`,
   `WalletExpressRow.onConfirm`): `processingHref` is app-built from a static route +
   `encodeURIComponent(publicRef)` + `encodeURIComponent(tourId)` (`checkout-form.tsx`
   ~341) - no attacker-controlled path segment, `window.location.origin` isn't spoofable.
   Identical pattern to the already-reviewed PayPal/iDEAL/Klarna redirects. Clean.
3. **`walletMethods` response**: just `['applepay','googlepay']` filtered by admin
   switches - no secrets, no PSP account internals beyond what `paymentMethodTypes`
   already exposed. Clean.
4. **`methodType` snapshot** (`onIntentSucceeded`,
   `charge?.payment_method_details?.card?.wallet?.type`): value comes from Stripe's own
   signed webhook payload / `retrieveCharge`, never client input - bounded to Stripe's
   known wallet-type enum strings. Written via Prisma `updateMany` (parameterized, no raw
   SQL) into `Payment.methodType String?` (`prisma/payments.prisma:15`, unbounded text) -
   no injection, no length/crash risk.
5. **Dashboard wallet guides/skeletons**: `walletGuide` strings render as plain React text
   in `<li>` (no `dangerouslySetInnerHTML`), skeletons carry no data. Clean.
6. **Nested Elements group for `ExpressCheckoutElement`**: the new inner
   `<Elements stripe={stripePromise} options={{ clientSecret, locale }}>` wrapping
   `WalletExpressRow` reuses the SAME `clientSecret` prop already used elsewhere in this
   component for `confirmCardPayment`/`confirmPayPalPayment`/`confirmKlarnaPayment`/
   `confirmIdealPayment` (pre-existing, not new exposure) - this is Stripe's documented
   required pattern for `ExpressCheckoutElement` (needs a clientSecret-mode Elements
   group). No new leak (not logged, not in a URL, not serialized to the DOM beyond
   Stripe.js's own internal handling).

**Also confirmed while in this code**: the wave-2 MEDIUM gap ("missing `@IsIn()` on
`paymentMethods` DTOs" - see [[payment_methods_switch_wave2_2026-08-16]] in the backend's
`security-code-reviewer` memory) **is now fixed** - `backend/src/settings/dto/settings.dto.ts`
`UpdateStripeConfigurationDto`/`UpdateMollieConfigurationDto` both carry
`@IsIn(STRIPE_CHECKOUT_METHOD_KEYS, { each: true })` /
`@IsIn(MOLLIE_CHECKOUT_METHOD_KEYS, { each: true })`, which automatically extend to cover
the new `applepay`/`googlepay` keys added this wave (same const arrays). No action needed,
just correcting the prior-session's "not yet fixed" note.

**LOW/informational only**: none of the six attack-surface questions produced a real
finding. The one thing worth a note for future reviewers: `WalletExpressRow`'s client-side
terms gate can go stale-restrictive (not permissive) if a traveller ticks the box, the arm
kicks off, they untick before it resolves, then the arm succeeds - `termsAccepted` reads
false while `intent.provider` flips to `STRIPE` moments later, so the wallet button would
refuse to open even though the server-recorded acceptance is already valid. UX papercut,
not a security bug (fails closed, not open) - not filed as a finding.

See also [[project_operator_conditions_wave3_it80_security]] for the operator-terms gate's
own dedicated review, and [[project_instant_confirmation_it83_security]] for this session's
sibling "field fully removed, not just hidden" pattern precedent.
