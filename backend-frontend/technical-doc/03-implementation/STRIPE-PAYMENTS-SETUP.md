# Stripe payments - setup (local, test, production)

How to configure Stripe for the Island Tours checkout: keys, webhooks, and payment
methods, for local dev, testing, and production. Credentials live **encrypted in the
database** (Settings -> Payments), never in `.env`.

> Money flow recap: checkout collects **card inline** (styled Stripe Card Elements,
> no Stripe-hosted UI) and **redirects** for PayPal / iDEAL. The up-front PaymentIntent
> uses `automatic_payment_methods`, so only account-activated + currency-compatible
> methods are offered. On a successful charge the **webhook** confirms the booking
> (`payment_intent.succeeded` -> `confirmFromPayment`), which fires the EUR conversion
> and the confirmation email. Without a working webhook, bookings stay `ON_HOLD`.

---

## 0. Prerequisite: `ENCRYPTION_KEY`

The backend stores the Stripe secret + webhook secret **encrypted**. Set a stable
`ENCRYPTION_KEY` in the backend env (same value across restarts, and a distinct one
per environment). If it changes, previously saved secrets can't be decrypted and you
must re-enter them.

```
# backend/.env
ENCRYPTION_KEY=<32+ char random string>
```

---

## 1. Get your Stripe keys

Stripe Dashboard -> **Developers -> API keys**. Toggle **Test mode** (top right) to
get test keys; turn it off for live keys.

| Key | Test prefix | Live prefix | Where it's used |
|---|---|---|---|
| Publishable key | `pk_test_...` | `pk_live_...` | Returned to the browser (Stripe.js) |
| Secret key | `sk_test_...` | `sk_live_...` | Server-side charge creation (encrypted) |

**Never mix test + live** (e.g. a live secret with a test publishable). That throws an
auth error -> a 500 at intent creation.

---

## 2. Enter keys in the dashboard

Admin dashboard -> **Settings -> Payments -> Stripe**:

- **Payment Label** - display name (e.g. "Stripe").
- **Publishable Key** - `pk_test_...` / `pk_live_...`.
- **Secret Key** - `sk_test_...` / `sk_live_...` (stored encrypted; leave blank on edit to keep the current one).
- **Webhook Secret** - `whsec_...` (from step 3/4).
- **Payment Methods** - the methods offered at checkout. Only **Card, iDEAL, PayPal**
  are selectable today (the checkout supports exactly these). Enabling one shows a short
  setup guide; disabling asks to confirm.

> Note: because the intent uses `automatic_payment_methods`, the *real* eligibility is
> whatever is **activated on your Stripe account** for the booking currency. A method
> selected here still won't appear at checkout until it's activated in Stripe (step 5).

---

## 3. Webhooks - LOCAL (Stripe CLI)

The webhook endpoint is:

```
POST http://localhost:5050/api/v1/payments/webhook
```

It is `@Public()` + `@SkipThrottle()` and verifies the Stripe signature against the
**raw** body (`main.ts` sets `rawBody: true`).

1. Install + log in to the Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe   # macOS (or see stripe.com/docs/stripe-cli)
   stripe login
   ```
2. Forward events to your local backend:
   ```bash
   stripe listen --forward-to localhost:5050/api/v1/payments/webhook
   ```
3. The CLI prints a signing secret like `whsec_...`. Paste it into
   **Settings -> Payments -> Stripe -> Webhook Secret** and save.
4. (Optional) Trigger a test event in another terminal:
   ```bash
   stripe trigger payment_intent.succeeded
   ```

Keep `stripe listen` running while testing checkout locally, otherwise the booking
never transitions past `ON_HOLD` (the `/payment/processing` page will poll, then fall
back to the manual "View my booking" link).

---

## 4. Webhooks - PRODUCTION (Dashboard)

Stripe Dashboard -> **Developers -> Webhooks -> Add endpoint**:

- **Endpoint URL:** `https://<your-domain>/api/v1/payments/webhook`
- **Events to send:** at minimum
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- Save, then reveal the endpoint's **Signing secret** (`whsec_...`) and paste it into
  **Settings -> Payments -> Stripe -> Webhook Secret** (live mode) and save.

Redeliveries are safe: the backend records each event id in `stripe_webhook_events` and
skips duplicates (idempotent).

---

## 5. Activate payment methods in Stripe

Stripe Dashboard -> **Settings -> Payment methods** (per test/live mode):

- **Card** - on by default. Works in every currency; collected inline (no redirect).
- **iDEAL** - turn on. **EUR-only**, so it appears at checkout only for EUR bookings
  and is auto-hidden for USD.
- **PayPal** - turn on and complete the PayPal connection. Appears once active.

Until a method is activated here it stays greyed at checkout with a hint - that is the
eligibility gate working, not a bug.

---

## 6. Test the flow

Use Stripe **test cards** (test mode only):

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds (any future expiry, any CVC, any postal) |
| `4000 0025 0000 3155` | Requires 3-D Secure (inline modal) |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

End-to-end: pick a departure -> checkout -> contact -> pay with a test card ->
`/payment/processing` polls -> thank-you page. For PayPal/iDEAL, use Stripe's test
redirect (it shows a hosted "authorize test payment" page), then returns.

---

## 7. Quick troubleshooting

| Symptom | Cause / fix |
|---|---|
| 500 on `.../intent`, "currency invalid for payment method" | A method incompatible with the currency was forced. We use `automatic_payment_methods` now, so re-check you're on the latest backend. |
| 503 "Payments are not configured" | No secret + webhook secret saved. Complete steps 2-3. |
| Booking stuck on `/payment/processing` | Webhook not reaching the backend. Local: is `stripe listen` running? Prod: is the endpoint URL + signing secret correct? |
| iDEAL / PayPal greyed out | Not activated in Stripe (step 5), or currency-incompatible (iDEAL is EUR-only). |
| Auth error at intent creation | Test/live key mismatch, or a wrong `ENCRYPTION_KEY` (can't decrypt the saved secret). |

---

## Reference

- Webhook endpoint: `POST /api/v1/payments/webhook` (Stripe), `POST /api/v1/payments/webhook/mollie` (Mollie, fetch-and-reconcile).
- Handled events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `refund.updated`, `refund.failed` (Stripe); Mollie re-posts the payment id on
  every status change and the backend re-fetches it.
- Intent creation: `POST /api/v1/payments/bookings/:id/intent` (returns `provider` +
  either `clientSecret`/`publishableKey`/`paymentMethodTypes` (Stripe) or
  `checkoutUrl` (Mollie)).
- Code: `backend/src/payments/` (`stripe.service.ts`, `mollie.service.ts`, `payments.service.ts`).

---

## 8. Mollie (switchable second provider, 2026-07-25)

Mollie is a full drop-in alternative to Stripe. **Exactly one PSP charges travellers
at a time** - the admin picks it in **Settings -> Payments -> Active Provider**
(`payment_settings.activeProvider`, default STRIPE). The switch is guarded: it is
rejected while the target provider has no usable credentials, and it is **never
retroactive** - every `Payment` row keeps its own `provider`, and webhooks, settle
on return, and refunds always route by the ROW's provider.

### Setup

1. Mollie Dashboard -> **Developers -> API keys**: copy the **API key**
   (`test_...` for test mode, `live_...` for production). Mollie has no separate
   webhook secret - the backend verifies webhooks by re-fetching the payment with
   this key.
2. Admin -> **Settings -> Payments -> Mollie**: paste the API key (stored
   encrypted, same `ENCRYPTION_KEY` as Stripe).
3. Flip **Active Provider** to Mollie.

### How the flow differs from Stripe

- **Inline card via Mollie Components (Stripe parity).** With a **Profile ID**
  (`pfl_...`, public - Settings -> Payments -> Mollie) configured, the checkout
  renders Mollie's Components card fields (mollie.js iframes styled to the same
  Figma boxes as the Stripe form: number, expiry/CVC, name). The flow is
  two-phase: contact-continue only fetches the profile (`profileId`/`testmode`,
  NO payment created); Pay tokenizes the card client-side and the second intent
  call creates the `creditcard` payment with that `cardToken` - the returned
  checkout URL is then only the **3DS hop** (frictionless 3DS comes back with no
  link at all and goes straight to processing). A "More payment methods" row
  hands off to the hosted page for everything else.
- **Hosted page fallback.** No profileId (or mollie.js blocked by the browser):
  the payment step is a hand-off to Mollie's hosted page (method selection, card
  entry, 3DS all happen there). Either way Mollie redirects back to
  `/checkout/processing`, where settle-on-return + polling confirm the booking -
  the same landing Stripe's redirect methods use. Aborting on the Mollie page
  returns to the checkout (`cancelUrl`).
- **Webhooks carry only a payment id** (form-urlencoded, no signature). The
  backend fetches the payment from Mollie - that fetch IS the verification - and
  reconciles: `paid` confirms the booking, `failed/canceled/expired` marks the
  charge FAILED, and embedded refunds settle the REFUND rows. Because Mollie
  re-posts the SAME id on later transitions, redelivery is never skipped;
  idempotency lives in the state-guarded transitions.
- **Local dev needs no webhook forwarding.** Mollie cannot reach localhost, so no
  `webhookUrl` is attached unless `PUBLIC_API_URL`/`BETTER_AUTH_URL` is a public
  https origin; dev bookings settle on return. (No `mollie listen` equivalent
  needed.)
- **Refunds** are always asynchronous at Mollie (`queued`/`pending` first): the
  REFUND row is recorded PROCESSING and settles when the payment webhook re-fires.
- **Redirect-URL safety:** the browser-supplied `returnUrl`/`cancelUrl` are
  validated against the CORS origin allow-list, so a crafted intent call cannot
  bounce a traveller to a hostile page.

## 9. Operator-level PSP setup (2026-07-25)

Operators get the exact same configuration surface as the platform, scoped to
their own account (dashboard **Settings > Payments** when logged in as a
TOUR_OPERATOR): a **Payout Provider** switch (radio rows + confirmation
dialog) above a **Stripe** card (publishable key / secret key / webhook secret)
and a **Mollie** card (API key). Secrets are stored encrypted and masked on
read, identical to the platform config.

**Semantics differ from the platform switch (founder, 2026-07-25): the operator
only RECEIVES PAYOUTS through this provider - never booking payments.**
Travelers are always charged by the platform's PSP; every copy string on the
operator surface (card description, confirm dialog, success toast) says payout,
not checkout.

- Backend: `Operator.activePaymentProvider` (default `STRIPE`) +
  `GET/PATCH /operators/:id/payment-provider`, guarded by
  `MANAGE_OPERATOR_PAYMENTS` and the **owner-only** gate (`assertOwnerOrAdmin` -
  team seats never pass; admins bypass). Key/config endpoints
  (`:id/stripe-config`, `:id/mollie-config`) already existed with the same gate.
- The switch is **rejected with a 400** when the target provider has no usable
  credentials (Stripe: secret key + webhook secret; Mollie: API key) - same
  contract as the platform switch in `settings.service`.
- The per-config `isActive` flags are kept in sync with the switch server-side,
  so config reads stay coherent; the single switch is the source of truth.
- NOTE: these operator credentials are **configuration only for now** - the
  traveler checkout still charges through the PLATFORM's active PSP
  (`payment_settings.activeProvider`). Wiring operator-owned charging (e.g.
  operator_link balance collection) is a separate, future money-flow decision.
