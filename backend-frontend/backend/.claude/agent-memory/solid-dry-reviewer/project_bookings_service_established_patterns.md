---
name: bookings_service_established_patterns
description: Baseline conventions already established in backend/src/bookings/bookings.service.ts - use these to judge whether new code in that file is consistent, not the generic CLAUDE.md defaults.
type: project
---

`backend/src/bookings/bookings.service.ts` is large (6463 lines as of 2026-08-01, was 4000+ in
2026-07-19 - it keeps growing every time a booking-lifecycle feature lands) and has its own
established sub-conventions that sometimes diverge from the general CLAUDE.md rules. When
reviewing new code in this file, compare against these rather than flagging divergence from
CLAUDE.md's generic defaults. The size itself is a standing SRP/god-class observation - flag it
ONCE per review cycle (plausible extraction seams: a `BookingCancellationService` for
request/withdraw/cancel/restore, a `TravellerAccountService` for login-code/session/receipt/
contact/summary/payments), don't re-flag it every time a new method is appended, and don't propose
doing the extraction inline with an unrelated bugfix diff.

- **`include:` not `select:` for list-shaped queries.** CLAUDE.md says "always use select: - never
  include", but the big list queries in this file (`list()`, `listTravellerBookings()`,
  `recoverReference()`'s multi-row lookup) all use `include:` at the top level with nested `select:`
  only on relations. This is the file's own established pattern (predates the 2026-07-28 traveller
  diff) - don't flag new code for following it.
- **`assertX(...)` naming for ownership/permission guards.** `assertOwnsBooking`, `assertCanView` -
  private helpers that validate and throw, named as imperative assertions. A helper that both
  validates AND extracts/returns a value (e.g. `travellerEmailOr401`) breaks this naming convention -
  worth a minor flag if a new one shows up.
- **Race-safe "exactly once" stamps use conditional `updateMany` + count-check**, not
  read-then-write. Example: the operator-cancellation-report stamp (~line 2705) does
  `updateMany({ where: { id, someTimestamp: null }, data: {...} })` and checks `count === 0` to
  detect "lost the race, already handled". Any new "first caller wins" mutation (login-code
  consumption, idempotent report/dismiss flows, etc.) should use this pattern - a plain
  findFirst-then-update is a known anti-pattern in this file (see `verifyTravellerLoginCode`'s
  consumedAt race, logged in [[bookings-traveller-account-module]]).
- **Fire-and-forget notice emails share a scaffolding shape**: per-target rate limit (targetLimiter,
  usually 1/min + 5/day) -> lookup booking(s) by contactEmail (case-insensitive) -> fetch siteInfo
  logo -> build `EmailTemplateContext` (emailIconBase, siteLogoUrl, bookingRef, tourName, startTime,
  dateLong via `formatDateLong`/`toLocale`) -> `void this.mail.sendBookingNoticeEmail(...).catch((err)
  => this.logger.error(...))` -> `return { sent: true }`. Present (independently) in
  `recoverReference`, `requestTravellerLoginCode`, and the admin-notify email in `reportCancellation`.
  Worth pointing out as a "should be shared" DRY item whenever a fourth copy appears, or when touched.
- **Commission/financial withholding by role** goes through small pure functions at the bottom of the
  file (`stripCommissionForNonPlatform` / formerly `stripCommissionForCustomer`,
  `applyManifestProjection` with its `MANIFEST_NULLED_FIELDS` const) that null fields rather than
  omit them, so DTO shape stays stable across roles. This is a deliberate, good pattern - reinforce it
  rather than suggesting per-role response types.
