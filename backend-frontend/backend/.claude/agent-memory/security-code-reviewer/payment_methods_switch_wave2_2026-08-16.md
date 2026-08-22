---
name: payment_methods_switch_wave2_2026-08-16
description: Security review of the admin per-method payment switch (payment-methods-board) wave 2 - Klarna addition + Stripe/Mollie enforcement boundaries
type: project
---

Reviewed 2026-08-16: wave 2 of the payment-methods feature on branch `payment-methods-board`,
across `island-tour-development` (backend `payments.service.ts`/`mollie.service.ts`/
`stripe.service.ts`/`settings/dto/settings.dto.ts`, frontend `checkout-payment.tsx`) and
`tripwheel-x-islandtours-dashboard` (`payment-methods-board.tsx`). Uncommitted at review time.

**Key architectural fact worth remembering for any future payments-module review**: the admin's
per-method "offer at checkout" switch (`stripe_configuration.paymentMethods` /
`mollie_configuration.paymentMethods`) is enforced at *different layers* for the two PSPs, and
that asymmetry matters:
- **Stripe**: the PaymentIntent is always created with `automatic_payment_methods: { enabled: true }`
  (`stripe.service.ts` `createPaymentIntent` — the `methods` param it accepts is never actually
  passed by `payments.service.ts`). The switch only filters the `paymentMethodTypes` array in the
  HTTP response (`payments.service.ts` `createStripeIntent`). Stripe itself decides what a
  `clientSecret` can actually confirm, from account-activation + currency only. So the switch is a
  **UI/merchandising control, not a PSP-side block** — a client with devtools could still confirm a
  method Stripe would accept but the admin toggled off in our app. This is intentional/tested
  (`payments.service.spec.ts`: "the intent stays on automatic methods - the switch never restricts
  it"), acceptable AS LONG AS no one relies on it as a compliance/fraud block — if that's ever
  needed, the real fix is Stripe Payment Method Configurations (`payment_method_configuration` id
  referenced at creation, toggled server-side), not `payment_method_types`.
- **Mollie**: correctly enforced server-side. `dto.cardToken` (the only client-controlled trigger
  for `method: creditcard`) is dropped server-side when the card switch is off
  (`payments.service.ts` `mollieCardEnabled()` gate), and the hosted-page fallback passes an
  explicit `method:` array that already excludes disabled methods. No bypass found — checked
  specifically because a stale browser tab can still submit an old cardToken after a toggle.

**UPDATE 2026-08-17: this gap is now FIXED.** Both DTOs carry
`@IsIn(STRIPE_CHECKOUT_METHOD_KEYS, { each: true })` /
`@IsIn(MOLLIE_CHECKOUT_METHOD_KEYS, { each: true })` in
`backend/src/settings/dto/settings.dto.ts`, which automatically covers the `applepay`/
`googlepay` wallet keys added in wave 3 (same const arrays). See
`.claude/agent-memory/security-reviewer/project_wallet_checkout_wave3_security.md` (repo
root, cross-repo wave-3 wallet review) for the re-verification. Original gap description
kept below for history.

**Open gap (MEDIUM, FIXED as of 2026-08-17 — see update above)**: `UpdateStripeConfigurationDto.paymentMethods`
and `UpdateMollieConfigurationDto.paymentMethods` (`backend/src/settings/dto/settings.dto.ts`) are
`@IsArray() @IsString({ each: true })` only — no `@IsIn()` against a canonical method-key list.
Endpoint is `MANAGE_SETTINGS`/ADMIN-only (not attacker-reachable pre-auth), but a plain typo in a
direct API call (bypassing the dashboard, which only ever writes from `TOGGLEABLE_METHOD_KEYS`)
zeroes out the WHOLE Stripe checkout silently: Stripe's path only falls back to "all on" when the
stored array is exactly `[]` — a non-empty array of garbage never matches real Stripe method names,
so the intersection resolves to empty and every traveller sees zero payment methods. Mollie's path
would instead get a rejected `method:` array from Mollie's API on every hosted-page attempt (caught
by the global `AllExceptionsFilter`, no info leak, but still a checkout outage). Fix: add
`@IsIn(CANONICAL_METHOD_KEYS, { each: true })` per-provider (Stripe uses `card`/`ideal`/`paypal`/
`klarna`; Mollie uses `creditcard`/`ideal`/`paypal`/`klarna`/`applepay` — vocabularies differ, don't
share one enum across both DTOs).

**Verified safe, no finding**: Klarna's `return_url` (`window.location.origin + processingHref`,
`checkout-payment.tsx`) and `billing_details.address.country` (bound to a fixed `<select>`, not free
text) — no open-redirect or injection surface, matches the existing PayPal/iDEAL pattern exactly.
`methodType` recording on both PSP webhook paths is generic (`charge.payment_method_details.type` /
`payment.method`), not a hardcoded enum, so new methods (Klarna) need zero mapping-table changes.

See also [[checkout_payment_typ_flow_2026-07-29]] for the broader checkout/payment/TYP trust
boundary this sits inside.
