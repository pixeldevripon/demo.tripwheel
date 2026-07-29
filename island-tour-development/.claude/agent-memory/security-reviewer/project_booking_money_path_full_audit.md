---
name: project_booking_money_path_full_audit
description: Full (non-diff) security audit of booking/payment/availability/tracking/checkout money path, 2026-07-29 — findings + confirmed-clean patterns
type: project
---

Full audit run 2026-07-29 across bookings, payments, availability, tracking, auth guards, and the
frontend checkout/thank-you/cancel surfaces. Verdict: the money path is unusually disciplined
(deterministic-id upserts, guarded conditional `updateMany` race guards, HMAC traveler sessions with
`timingSafeEqual`, encrypted PSP secrets, fail-closed redirect allowlist). No Critical findings.
Frontend (`frontend/app/(frontend)/.../checkout|thank-you|cancel`, `lib/checkout/*`,
`lib/traveler-session.*`) came back fully clean — nothing to fix there.

**Why this matters for future reviews**: this establishes a verified baseline. A future diff review
touching these areas should treat any REGRESSION from the patterns below as high-priority (they were
deliberately built this way, often per dated review comments in the code itself, e.g. "security
review 2026-07-20" in bookings.service.ts).

## Open findings at time of audit (unfixed — reverify before assuming closed)

1. **HIGH — `extend()` has no rate limit, no session-ownership check, and no absolute hold-lifetime
   cap.** `backend/src/bookings/bookings.service.ts:2810-2825` (controller:
   `bookings.controller.ts:187-192`, plain `@Public()`, no `@Throttle` override). Only checks
   `status === ON_HOLD` and resets `utcExpiresAt` to `now + expirationMinutes` (DTO caps
   `expirationMinutes` at 60 via `@Max(60)`, `dto/booking.dto.ts:1404`). Anyone holding a booking `id`
   (including an exclusive PRIVATE+UNIT charter that claimed `bookedCount = capacity`, i.e. the WHOLE
   departure) can call it every few minutes forever, well within the global throttler ceiling
   (3000/hr = one call per 1.2s), permanently locking scarce inventory. Fix: add a per-booking
   `targetLimiter` bucket + an absolute cap from `booking.createdAt` (e.g. reject extend once
   `now - createdAt > 2h`), and consider requiring the booking-scoped session token the same way
   `update()`'s contact branch does.

2. **MEDIUM-HIGH — `update()` lets `pickupLocationId`/`pickupRequested`/`notes` be rewritten on an
   already-CONFIRMED, paid booking with zero session/ownership proof.**
   `backend/src/bookings/bookings.service.ts:2845-2916`. The `sessionOwnsBooking` gate
   (2845-2856) is scoped ONLY to `dto.contact` — pickup/notes fields apply unconditionally at
   2898-2905 regardless of status. Since `id` rides in the URL path (`PATCH /bookings/:id`), it's far
   more exposed (logs/APM/Referer/browser history) than a header-only value. Anyone who obtains a
   CONFIRMED booking's id can silently redirect a paid traveler to the wrong pickup point. Fix: extend
   the same `sessionOwnsBooking` gate to cover pickup/notes changes when `status === CONFIRMED`.

3. **MEDIUM — `Booking.id` (client-suppliable via `ReserveBookingDto.id`, only `@IsUUID()`-validated)
   is the actual bearer-credential trust boundary for confirm/cancel/extend/update, while the schema
   has a SEPARATE `uuid` column apparently intended for exactly this client-supplied idempotency-key
   role** (`backend/prisma/bookings.prisma` — `uuid String @unique @default(uuid())  // OCTO uuid
   (client-supplied; idempotency key)`) that `reserve()` never populates from `dto.id`
   (`bookings.service.ts:475,613`). Looks like a design divergence, not an intentional choice. Low
   practical risk today (UUIDv4 collision is infeasible and `@IsUUID()` at least checks format) but
   worth closing: route `dto.id` into `uuid`, keep `Booking.id` always server-`randomUUID()`-generated.

4. **HIGH — `availability.service.ts:updateDeparture` (line 603-643) writes `capacity` from
   `dto.capacity` straight to the DB with NO check that `capacity >= existing.bookedCount`**, unlike
   the materializer's `reconcile()` which explicitly refuses to resize any departure with
   `bookedCount > 0` (`availability-materializer.service.ts:297-314`). It's also a non-atomic
   read-then-write (`findUnique` at line 609, several awaits, then a plain `update` at 625) — a
   concurrent `reserve()` can increment `bookedCount` in the gap, and the `status` written is computed
   from the STALE `bookedCount`. An operator (or compromised operator session) can PATCH a departure's
   capacity below its current bookedCount, producing a permanently oversold/corrupted row that
   `computeIsBookable`/`listDepartures` then reason about incorrectly. Fix: reject when
   `dto.capacity < existing.bookedCount`, and make the write a conditional `updateMany` keyed on the
   read `bookedCount` (optimistic lock), mirroring the reserve-step seat-claim pattern.

5. **MEDIUM — `executeRefund` (bookings.service.ts, guard ~4515-4538, create ~4613) uses a
   `findFirst`-then-`create` TOCTOU for the REFUND payment row**, unlike every other money-mutating
   path in this codebase (charge rows use a deterministic id + `upsert`, per `payments.service.ts:459`
   and the Stripe webhook ledger's `P2002` catch). It's called from 4 independent sites
   (`confirmFromPayment`, `cancelBooking` x2, `runRefundJob`). Actual PSP-side double-refund is
   prevented by a shared idempotency key (`refund-${bookingId}`), but two near-simultaneous triggers
   can still create two duplicate REFUND `Payment` rows in Postgres, corrupting the refund-status view
   (only one row ever transitions out of PROCESSING). Fix: give REFUND rows a deterministic id
   (e.g. `${bookingId}:REFUND:${attempt}`) and `upsert`, or a partial unique index on
   `(bookingId, kind)` where status != FAILED.

6. **MEDIUM — `POST /payments/bookings/:id/intent` (createIntent) has no `@Throttle()` override**
   (`payments.controller.ts:70-75`) — confirmed by direct read, only the global tier applies — unlike
   its sibling `settle` (line 88-95) which has an explicit tight throttle specifically because it
   costs a live PSP API call. On Mollie's retry branch this mints a brand-new Mollie payment object
   per call. Fix: add a `@Throttle` mirroring `settle`'s tiers + a `targetLimiter.consume('intent',
   bookingId, ...)`.

7. **MEDIUM — Mollie webhook (`POST /payments/webhook/mollie`) has `@SkipThrottle()` (correct per
   rule #15) but Mollie's "signature verification" is itself a live outbound `getPayment` call**
   (no cheap local rejection like Stripe's HMAC check) — an attacker can force unlimited real network
   round-trips to Mollie by POSTing arbitrary `{id: "x"}` bodies, risking the platform's own Mollie API
   rate limit. `MollieWebhookDto.id` is also unbounded `@IsString()` with no `@MaxLength`. Fix: add a
   coarse dedicated throttle (e.g. 60/min/IP) generous enough for real retries, and cap `id` length.

## Confirmed-clean patterns (do not re-audit from scratch; spot-check only on future diffs)

- Reserve-step seat claim: guarded conditional `updateMany` (WHERE status=OPEN AND
  bookedCount<=capacity-seats) inside a `$transaction` — the canonical race-guard pattern, present in
  `reserve()`, `recoverExpiredBooking()`, and `confirmFromPayment()`'s ON_HOLD→CONFIRMED flip.
- All pricing (totalRetail/deposit/commission/currency/add-ons) is always server-recomputed from
  `loadContext()`/`computeBookingPricing` — no client-price-shaped field is ever trusted, on either
  backend or frontend (frontend only ever sends ids/quantities/quoteId, never a price).
- Traveler session tokens: HMAC-SHA256, `timingSafeEqual` throughout (session sig + OTP hash), secret
  required ≥32 chars with placeholder rejection, no insecure fallback, HISTORY scope is inside the
  signed payload (unforgeable escalation).
- Webhook idempotency: Stripe via DB unique-constraint + `P2002` catch (atomic, not read-then-write);
  Mollie via the booking's own guarded `updateMany` transition (correct given Mollie's re-post-on-every-
  status-change design).
- `assertAllowedRedirect` fails closed (empty `CORS_ORIGINS` → reject all) — confirmed by reading
  current code, not just trusting the "already fixed" note.
- Guard stack: `TrustedOriginThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard` registration
  order verified correct in `auth.module.ts`; `INTERNAL_API_SECRET` bypass correctly scoped by
  `hasOwnThrottleOverride` with `timingSafeEqual` comparison and fail-closed-on-unset; both
  RolesGuard/PermissionsGuard throw (never fall through) when `user` is undefined.
- CORS: real allow-list (`.includes()` exact match, rejects literal `'null'` origin), paired with
  `credentials: true`. ValidationPipe: `whitelist + forbidNonWhitelisted + transform` all present;
  the previously-known `enableImplicitConversion` footgun is gone (replaced by explicit `@Type()`).
- PII/tracking: SHA-256 with correct normalization (trim+lowercase, E.164 phone) in `pii-hash.util.ts`;
  no raw PII ever logged; no attacker-reachable tracking endpoint exists (CAPI is server-to-server
  only).
- ICS/email injection: RFC-5545 escaping in `booking-ics.util.ts`; HTML-escaping of every template
  token in the mail renderer — a traveler's own notes/name cannot inject into operator-viewed email
  or calendar files.
- Frontend: HttpOnly/Secure/SameSite=Lax traveler-session cookie set only via a same-origin-gated
  Route Handler, never echoed to JS; `returnTo` redirect target allowlisted by regex before
  `router.push`; no `dangerouslySetInnerHTML` anywhere in checkout/thank-you/cancel; no secret env var
  ever referenced in a `'use client'` file.
- Swagger (`/api/docs`) is exposed in ALL environments including production — this is a **documented,
  deliberate 2026-07-21 product decision**, not a bug. Don't re-flag it as a finding; at most note the
  recon-surface tradeoff.

See also [[project_login_auth_system]] for the guard/session infra this audit re-verified, and
[[project_booking_completion_resume]] for the feature-completion state of the same modules.
