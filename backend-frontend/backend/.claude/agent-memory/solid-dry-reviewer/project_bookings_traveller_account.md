---
name: bookings-traveller-account-module
description: Traveller account area (OTP login + history reads) added to bookings module; known naming split and an open money-display bug found in review.
type: project
---

Traveller account area (`/bookings/traveller/*`: request-code, verify-code, bookings, summary,
payments) shipped in `backend/src/bookings/` alongside two unrelated bundled features in the same
working-tree diff: operator cancellation reports (`:id/report-cancellation`, "conflict #2") and the
manifest/financials permission projection ("conflict #7", `VIEW_BOOKING_FINANCIALS`,
`applyManifestProjection`, `canSeeBookingFinancials`). All three landed together, uncommitted, as of
2026-07-28 - reviewed in isolation (traveller-account code only) per explicit request.

**Known issues found in the 2026-07-28 review (unresolved as of writing):**
- `summarizeBookings()` (bookings.service.ts, shared by `getCustomerSummary` and the new
  `getTravellerSummary`) filters payments with `status: PaymentStatus.SUCCEEDED` only. The same diff
  started writing `PaymentStatus.REFUNDED` onto settled refund rows AND the flipped original charge
  row (~line 4587-4596, comment confirms this is the terminal state for every refund, sync or async).
  Neither summary function was updated to also count REFUNDED, so `totalSpend` silently undercounts
  (drops to ~0 contribution) for any booking that has ever had a refund settle. Re-check whether this
  was fixed before trusting dashboard/traveller spend totals.
- `verifyTravellerLoginCode` does read-then-two-separate-writes (attempts increment, then
  consumedAt) instead of one atomic conditional update - a concurrent double-submit of the correct
  code can mint two HISTORY sessions from a code documented as "single-use". The codebase already has
  the right pattern for this exact shape: a race-safe `updateMany({ where: { ..., field: null } })` +
  count-check, used at the operator-cancellation-report stamp (~line 2705). Wasn't applied here.
- Naming split: the Prisma model is `TravelerLoginCode`/`traveler_login_codes` (American spelling,
  matching the pre-existing `traveler-session.util.ts` convention: `TravelerSessionClaims`,
  `issueTravelerSession`, `TRAVELER_SESSION_HEADER`), but every new route/DTO/service-method uses
  British "traveller" (`/bookings/traveller/*`, `RequestTravellerCodeDto`, `listTravellerBookings`).
  Both spellings now permanently coexist in the schema + public API. The master doc
  (`technical-doc/customers/CUSTOMER-ACCOUNTS.md`) isn't consistent either - it mixes both spellings
  itself - so this wasn't "the spec said X", just accumulated drift with no clear source of truth.

**Why:** cited findings from reviewing the traveller-account addition against the module's own
established patterns (`recoverReference`, `list()`, `getCustomerSummary`).
**How to apply:** when reviewing further `bookings.service.ts` changes, check whether the REFUNDED
summary bug and the OTP-verify race are still open before assuming money/session totals are correct.
Treat the traveler/traveller split as pre-existing noise - don't re-flag it unless new code
introduces a *third* spelling or variant.

See also [[bookings_service_established_patterns]].
