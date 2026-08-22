---
name: checkout_payment_typ_flow_2026-07-29
description: Full-stack security review of checkout -> payment (Stripe/Mollie) -> processing -> thank-you flow, 2026-07-29. Confirms prior traveler-session/customer-accounts fixes hold; two new findings (Mollie redirect fail-open, global INTERNAL_API_SECRET throttle bypass).
type: project
---

# Checkout -> payment -> processing -> TYP review — 2026-07-29

Scope: `payments/payments.{controller,service}.ts`, `stripe.service.ts`, `mollie.service.ts`,
`bookings.controller.ts` + `bookings.service.ts` (reserve/confirm/confirmFromPayment/update/
getThankYou/claimConversionPush/cancel), `traveler-session.util.ts`, `lookup-rate-limiter.ts`,
plus the frontend checkout components, `lib/api/{bookings,fetch}.ts`, `lib/api/public/{bookings,fetch}.ts`,
`lib/traveler-session.server.ts`, `app/api/traveler-session/route.ts`, `proxy.ts`,
`lib/traveler-booking.ts`, the processing page, and the TYP page.

## Re-verified: all prior findings from [[traveler_session_flow]] / [[customer_accounts_feature_security]] still hold fixed

- `update()` mints only `issueBookingSession(updated.id)` (BOOKING-scoped), never
  `issueTravelerSession(arbitraryEmail)` — the critical arbitrary-email mint bug stays closed.
- `getCalendar()` (bookings.service.ts ~2257) sets ICS `location: null` unconditionally and a
  generic description ("Pickup and meeting details are on your booking page") — the pickup-address
  leak stays closed.
- `cancel()`'s CANCELLED-status idempotent early-return (~2386) now runs AFTER the authorization
  block (~2350-2384) — the auth-bypass-via-early-return MEDIUM is fixed.
- Commission stripping now covers the write endpoints too: `mapBookingPublic()` always nulls
  `commissionRate`/`commissionAmount`; `reserve`/`confirm`/`update`/`extend` all return
  `mapBookingPublic`, and `cancel` returns `mapBookingForActor(booking, actor)` which only keeps
  commission for `isPlatformWideBookingRole`. The previously-flagged raw-`mapBooking()` leak from
  write endpoints is fixed.
- `confirm()` still correctly requires a payment-ledger proof (SUCCEEDED aggregate >= dueNow)
  before ON_HOLD -> CONFIRMED — no free-confirmation path via a raw booking id.

## New findings this pass

### MEDIUM: `assertAllowedRedirect` (payments.service.ts ~1125-1137) fails OPEN when `CORS_ORIGINS` parses to an empty list

`parseCorsOrigins()` defaults to `http://localhost:3000` only when the env var is `undefined`; if
ops ever sets `CORS_ORIGINS=''` (or a value that trims to nothing) in production, `parseCorsOrigins`
returns `[]`. `assertAllowedRedirect`'s guard is `if (allowed.length > 0 && !allowed.includes(...))
throw` — when `allowed.length === 0` the whole condition is false, so **no origin is rejected at
all**: the Mollie `returnUrl`/`cancelUrl` (client-supplied via `POST /payments/bookings/:id/intent`
phase 2) would accept literally any origin, an open-redirect after a real/attempted Mollie payment.
Contrast with `main.ts`'s CORS origin callback, which fails CLOSED on the same empty-list case
(`allowedOrigins.includes(origin)` is false for everything, so browser-origin requests are all
rejected) — the two origin-allowlist checks in this codebase have inconsistent failure modes on the
same misconfiguration. Low likelihood (requires a specific env misconfig + the attacker needs a
bookingId, which is unguessable, though it can be their own), but a real bug: recommend changing the
guard to always enforce (`if (!allowed.includes(parsed.origin)) throw`), never skip validation when
the list is empty.

### MEDIUM (architectural, not a bug in itself): `INTERNAL_API_SECRET` skipIf is a GLOBAL, unconditional ThrottlerGuard bypass

`auth.module.ts` `isTrustedInternalOrigin` is wired as the single `skipIf` for the ONE global
`ThrottlerModule.forRoot()` — it bypasses throttling for EVERY route, including per-route
`@Throttle()` overrides (settle, resend, cancellation-request, claimConversion, lookup,
recoverReference, requestTravellerCode, verifyTravellerCode), not just the public GET reads it's
meant for. As implemented today the frontend correctly keeps every sensitive mutation on the
browser-side `apiFetch` (no `x-internal-api-key` header) and only routes idempotent reads (TYP GET,
claimConversionPush from the TYP server render) through the SSR `publicFetch`/`publicPost` helpers
that attach the secret — so as-built this is NOT currently exploited/misused (verified: none of
`lookupBooking`, `verifyTravellerCode`, `settleBooking`, `resendConfirmationEmail`,
`requestBookingCancellation` are called via the server-side `publicGet*`/`publicPost` helpers).
But architecturally this is fragile: a single leaked `INTERNAL_API_SECRET` becomes a rate-limit
master key for the ENTIRE API (traveler OTP `verify-code` brute force, `settle` Stripe-API-call
spam, `resend`/`recover-reference` email-bombing, `lookup` pair-guessing), and there is no per-route
allowlist limiting which routes may honor the bypass. The codebase already has extensive inline
comments warning "MUST be called from the browser... skipIf would bypass every limit below" at
every affected route — this is a known, actively-managed team tradeoff, not an oversight. Worth
flagging because the user explicitly asked about this exact mechanism.

**Why:** Booking/payment is the highest-value attack surface (money + PII); this flow has been
reviewed multiple times and the team has a strong track record of actually fixing what gets flagged
(traced fixes end-to-end again this pass, not just re-read comments). Recording the re-verification
so a future pass doesn't waste time re-tracing `confirm()`/`cancel()`/`update()`/`getCalendar()` core
logic, and flags only the two genuinely new items.
**How to apply:** Before a future pass on this flow, check whether `assertAllowedRedirect` was
changed to fail closed on an empty CORS_ORIGINS list, and whether the codebase moved toward a
per-route throttle-bypass allowlist (or documented the INTERNAL_API_SECRET blast radius somewhere
ops-visible) rather than the single global `skipIf`. If both untouched, the findings still apply
as-is; if the frontend ever adds a new SSR-side call to a currently-browser-only mutation route
(settle/lookup/verify-code/resend/recover/cancellation-request/claimConversion), re-check whether it
accidentally goes through `publicFetch`/`publicPost` and inherits the bypass.

## Confirmed secure patterns (reuse, don't re-flag)

- `createIntentForBooking` idempotency: deterministic `paymentRowId(bookingId, kind)` Payment row +
  Stripe idempotency key `pi_${bookingId}_${kind}`; Mollie replacement payments get a fresh
  timestamped idempotency key specifically so a retry-after-cardToken never replays the old attempt
  against the new card (payments.service.ts ~385-389).
- Mollie webhook has no signature — verification IS the re-fetch with our own API key
  (`getPayment`), and a 404 is treated as "not ours, ignore" rather than an error. Stripe webhook
  verifies HMAC signature against raw body + is idempotent via the `stripe_webhook_events` unique-id
  ledger (P2002 -> skip).
- Refund reconciliation (`reconcileRefundRow`) uses an explicit allowed-from-state transition table
  so an out-of-order/duplicate PSP delivery can never resurrect a FAILED refund or double-flip a
  charge row.
- Card PAN never touches the backend or its logs for either PSP — Stripe Card Elements / Mollie
  Components tokenize client-side; only `last4`/`brand`/billing country-postal-city are persisted.
- Traveler session scoping (BOOKING vs EMAIL vs HISTORY) is correctly threaded through this whole
  flow: checkout's contact PATCH mints BOOKING-scope only; `getThankYou`/`claimConversionPush`/
  `requestCancellation` all gate on `sessionOwnsBooking`; `claimConversionPush` additionally
  requires `verified` before touching the mark-first DB flag, so an unverified shared TYP link can
  never fire the commission-bearing conversion push.
- `POST /api/traveler-session` (frontend Route Handler) checks `isSameOrigin` (Sec-Fetch-Site with
  Origin-host fallback) before setting the HttpOnly cookie, and validates token SHAPE (regex) before
  storing — doesn't verify the signature (it has no secret), which is correct: the backend is the
  only verifier, so a garbage value here just renders masked.
- `reserve()`'s seat claim is a single conditional `updateMany` (status=OPEN AND
  bookedCount<=capacity-seats, or ==0+capacity for exclusive charter) inside a `$transaction` —
  correct overbooking guard, no read-then-write race window.
- `ReserveBookingDto.expirationMinutes`/`ExtendBookingDto.expirationMinutes` are capped `@Min(5)
  @Max(60)` — no unbounded hold-duration DoS via client-supplied expiry.
