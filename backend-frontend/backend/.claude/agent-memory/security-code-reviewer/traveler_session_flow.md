---
name: traveler_session_flow
description: Security review of the no-password traveler-session flow (bookings lookup/checkout, TYP masking, cancellation gate) — the critical arbitrary-email token-minting bug and other findings, 2026-07-19.
type: project
---

# Traveler-session flow review — 2026-07-19

Reviewed the newly built no-password traveler session (master 6.4 + login spec §1):
`backend/src/bookings/traveler-session.util.ts`, `lookup-rate-limiter.ts`, `bookings.service.ts`
(lookupBooking/update/confirm/getThankYou/requestCancellation/getCalendar/resendConfirmation),
`bookings.controller.ts`, `main.ts` CORS, plus the frontend half
(`app/api/traveler-session/route.ts`, `lib/traveler-session.server.ts`, `lib/traveler-booking.ts`,
the `/cancel/[publicRef]` page, `traveler-login.tsx`, `lib/api/public/fetch.ts`, the TYP page).

## Critical (open as of this review): arbitrary-email session-token minting via PATCH /bookings/:id

`BookingsService.update()` (bookings.service.ts ~1482-1521) is `@Public()`, keyed only on the
booking's internal UUID `id` (no session/ownership check on the endpoint itself), and on ANY
`dto.contact.email` unconditionally returns `{ ...mapped, sessionToken:
issueTravelerSession(dto.contact.email) }` — **with zero proof the caller owns that email** (no
OTP/magic-link/double-opt-in anywhere in the codebase). `confirm()` (~558-597) has the identical
unverified contact-email write, though it doesn't itself mint a token.

Exploit: attacker calls public `POST /bookings/quote` + `POST /bookings` (reserve, no auth, no
payment) to create a throwaway `ON_HOLD` hold and learn its own `id`; then `PATCH /bookings/:id`
with `contact.email = victim@example.com` → gets back a **genuinely HMAC-valid** 24h session token
bound to the victim's email, no distributed IP tricks needed. That token is *not* scoped to the
attacker's own booking — `sessionOwnsBooking()` (traveler-session.util.ts ~121-130) only compares
`token.email === booking.contactEmail`, so the forged token unlocks **every** booking that shares
that email:
- `GET /bookings/typ/:publicRef` with `X-Traveler-Session: <forged>` → full unmasked PII (name,
  phone, pickup address, card brand/last4) for any booking of the victim's the attacker knows the
  `publicRef` of.
- `POST /bookings/typ/:publicRef/cancellation-request` with the same header → passes the
  `sessionOwnsBooking` gate (bookings.service.ts ~1135-1144), stamping
  `utcCancellationRequestedAt` on the victim's real booking (which the code comments say is the
  authoritative instant for refund-eligibility judgment) and spamming the admin + traveler +
  operator with cancellation notices.

No extra rate limit on `update()`/`confirm()` beyond the global ThrottlerGuard tiers (20/s ·
300/min · 3000/hr per IP) — contrast with `lookup`/`recoverReference`/`resendConfirmation`/
`cancellation-request`, which all got custom `@Throttle()` overrides. Minting thousands of
victim-email tokens per hour per IP is trivially automatable.

**Root cause to fix:** `issueTravelerSession()` must never be called from an endpoint that accepts
an arbitrary caller-supplied email without proving control of it. Options: (a) require a fresh
email-confirmation click before minting (real fix, more work), or (b) stop `update()` from minting
a session at all and instead route the post-checkout "unmask my own just-placed booking" case
through the *existing* verified session issued at `reserve()` time scoped strictly to that one
booking id (not portable across other bookings sharing the email), or (c) at minimum, disallow
`update()`/`confirm()` from changing `contactEmail` on an already-`CONFIRMED` booking without an
existing valid session for the CURRENT contactEmail, and add the same per-email/per-reference
rate limiting `LookupRateLimiter` already provides for `lookup`.

## High: GET /bookings/typ/:publicRef/calendar.ics leaks pickup address unconditionally

`getCalendar()` (bookings.service.ts ~1324-1370) is `@Public()`, keyed only on `publicRef`, with
**no session/verification check at all** — unlike `getThankYou()`, which deliberately withholds
`pickupAddress` for unverified viewers ("hidden outright... masking a street address is theater",
~1901-1903). The ICS `location` field is set to the raw `booking.pickupAddress` regardless of
verification. Confirmed the confirmation email itself does not appear to embed the pickup address
text (only pickup time), so this genuinely exposes physical-location PII to anyone holding a bare
TYP link that the TYP page's own masking model explicitly protects. Fix: gate `getCalendar` behind
the same `sessionOwnsBooking` check as `requestCancellation`, or at minimum omit `location` when
unverified (a session header isn't available to a mail-client-opened link, so the real fix is
probably: never put the exact street address in the ICS `LOCATION` field for a public/mail-client
link — use the tour/meeting-point name instead, or require a short-lived signed variant of the
publicRef for this one link).

## Medium: no CSRF protection on frontend POST/DELETE /api/traveler-session

`frontend/app/api/traveler-session/route.ts` sets/clears the HttpOnly session cookie based purely
on `req.json()` body content, with no Origin/Sec-Fetch-Site check and no CSRF token. Route Handlers
(unlike Next Server Actions) get no automatic CSRF protection. A cross-site `enctype="text/plain"`
auto-submit form is the classic bypass for JSON-body CSRF (no preflight triggered) and can plant an
attacker-chosen, shape-valid token (`TOKEN_SHAPE` regex only checks format, not signature) into a
victim's cookie jar, or CSRF-`DELETE` to force-logout. Given the backend re-verifies per-booking
email ownership on every use, this alone doesn't leak victim data — but it's a real confused-deputy
gap (forced session-fixation/logout) and becomes more dangerous in combination with the Critical
finding above (an attacker who has legitimately minted a token for an email can also CSRF it into
someone else's browser, though the practical payoff there is unclear). Recommend at minimum an
`Origin`/`Sec-Fetch-Site` header check before trusting the POST.

## Low / informational

- TYP response (`getThankYou`) returns `conversion.value` (the EUR commission amount) and full
  `operator.email`/`operator.phone` **unmasked regardless of `verified`** — the commission amount
  is business-sensitive (reveals platform take-rate to anyone with the bare link); operator contact
  is probably fine (it's the operator's own public-facing support contact, not traveler PII).
- `resendConfirmation` / `recoverReference` / `requestCancellation` / `calendar.ics` are all rate
  limited **per-IP only** (global `@Throttle` tiers or none), not per-`publicRef`/booking — a
  multi-IP attacker can email-bomb a single victim's booking without touching any per-target cap.
- CORS in `main.ts` allows `origin === 'null'` with `credentials: true` (pre-existing, NOT part of
  this diff — the diff only added the `X-Traveler-Session` header to `allowedHeaders`). Flagging
  because it was in-scope for this review: a sandboxed-iframe/`data:` page can send `Origin: null`
  and make credentialed cross-origin requests (mainly a risk to the Better Auth cookie for
  dashboard sessions, not directly the traveler-session header, since that header is only attached
  by first-party JS). Worth a follow-up but out of scope for the traveler-session feature itself.
- `TRAVELER_SESSION_SECRET` falls back to `BETTER_AUTH_SECRET` when unset; both `.env.example` and
  `.env.production.example` already set a distinct placeholder for it and `env.validate.ts`
  enforces ≥32 chars + no placeholder string when present — correctly documented, just make sure
  ops actually sets a *dedicated* value in production for key separation.

## Confirmed secure patterns (reuse, don't re-flag)

- `verifyTravelerSession()` (traveler-session.util.ts) — correct `timingSafeEqual` HMAC check,
  rejects on any parse/shape failure, checks `exp` before returning the email. Good implementation.
- `getThankYou()` masking is otherwise complete and well-reasoned: `maskEmail`/`maskPhone`/
  `maskLastName` never omit (keep page shape), pickup address and card fields withheld outright
  (not just masked) when unverified — this is the pattern the calendar-ics gap above should match.
- `requestCancellation()` correctly gates the mutation on `sessionOwnsBooking` **before** touching
  the DB or sending mail (bookings.service.ts ~1135-1144) — link possession alone cannot cancel.
- `LookupRateLimiter` — good per-credential (not just per-IP) failure caps, normalizes
  email(trim+lowercase)/reference(trim+uppercase) before keying so casing/whitespace can't bypass
  it, redacts email in logs, uniform 429 message (no enumeration signal).
- `lookupBooking()` is enumeration-proof: identical generic 404 for unknown email, unknown
  reference, or mismatched pair; case-insensitive Prisma match on both fields.
- Frontend TYP fetch (`getThankYouBooking`/`getTypByRef`) is correctly kept OUT of any `'use cache'`
  scope — `connection()` + `<Suspense>` + `publicGetStrict` with the per-user header, matching the
  explicit warning in `lib/api/public/fetch.ts` about never passing per-user headers from inside a
  cache scope. Verified no caching wrapper on the TYP page.
- `traveler-login.tsx`'s `returnTo` redirect validation
  (`/^\/(?:[a-z0-9-]+\/thank-you|cancel)\/[A-Za-z0-9-]+$/`) is anchored and character-restricted —
  correctly resistant to open redirect (no `//host`, no protocol, single-segment only).
- `it.travelerBooking` client-readable cookie (`lib/traveler-booking.ts`) is correctly treated as
  pure display sugar — validates shape on read, never used to authorize anything; the real
  credential stays in the separate HttpOnly cookie.

**Why:** This is a new, non-trivial auth surface (no passwords) with a subtle but critical trust-
model bug in the token-issuance path, not the verification path — worth remembering precisely
because the verification code all looks correct in isolation and the bug only shows up by tracing
where `issueTravelerSession()` gets called from.
**How to apply:** Before closing out or re-reviewing this feature, check whether `update()`/
`confirm()` still mint sessions unconditionally from client-supplied email, and whether
`getCalendar()` still skips the ownership check `getThankYou()`/`requestCancellation()` both have.
