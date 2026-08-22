---
name: confirmed_secure_traveller_otp_login
description: Traveller account OTP login (TravelerLoginCode + history-scoped session) reviewed 2026-07-28 - reference pattern for token-scope design and self-service data withholding
metadata:
  type: project
---

Reviewed the new `/{locale}/traveller` account-area backend (`TravelerLoginCode` model in
`prisma/bookings.prisma`, `traveler-session.util.ts` history claim, `bookings.service.ts`
requestTravellerLoginCode/verifyTravellerLoginCode/listTravellerBookings/getTravellerSummary/
listTravellerPayments, `booking.dto.ts` traveller DTO block, 5 new controller routes). Overall
well-designed; only one real bug found (see [[pattern_atomic_consume_updateMany]]).

**Confirmed correct (worth reusing as a reference pattern):**
- Three-tier session scope design (EMAIL / BOOKING / HISTORY) with the scope riding INSIDE the
  HMAC-signed payload (`{e, h:1}`), so a weaker token can never be upgraded by an attacker - test
  suite in `traveler-session.util.spec.ts` explicitly proves a forged unsigned `h:1` fails
  signature verification, and that legacy pre-`h` tokens verify as `history:false` (back-compat).
- `sessionHistoryEmail()` is the single gate every traveller-account read calls
  (`travellerEmailOr401` in `bookings.service.ts`) - no endpoint derives the scoped email any other
  way, so there is no path to pass an arbitrary email.
- OTP code: never stored plaintext (only `hashLoginCode` HMAC-SHA256 keyed by
  `TRAVELER_SESSION_SECRET`), generated via `crypto.randomInt` (not `Math.random`), single active
  code per email (new request invalidates the old one), 10-min TTL, 5-attempt cap, attempts
  incremented BEFORE comparison, `timingSafeEqual` compare, uniform generic 401 for every failure
  mode (unknown email/wrong/expired/used/exhausted all identical).
- `requestTravellerLoginCode` / `verifyTravellerLoginCode`: enumeration-proof `{sent:true}`, mail
  only to the STORED contactEmail (never caller input), per-target-email rate limiting via the
  existing `TargetRateLimiter` (1/min, 5/day) in addition to per-IP `@Throttle` on the controller.
- `mapTravellerBookingItem` explicitly destructures out settlement status/method/held, ops
  timestamps, and contactFullName/contactEmail, and nulls commission - verified against
  `mapBookingListItem`'s full shape field-by-field. `listTravellerPayments` select list excludes
  `intentId`/`chargeId` (Payment model has both). Both are also asserted directly in
  `bookings.service.spec.ts`.
- Pagination bounded (`TravellerListQueryDto`: `@Max(50)` on limit).
- Route ordering correct: all 5 `traveller/*` static routes registered before the `:id` catch-alls
  in `bookings.controller.ts`.

See [[pattern_atomic_consume_updateMany]] for the one confirmed race-condition finding in this
feature (verifyTravellerLoginCode's consume step).
