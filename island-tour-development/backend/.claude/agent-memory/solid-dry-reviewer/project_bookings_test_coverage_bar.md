---
name: project_bookings_test_coverage_bar
description: This codebase holds booking-lifecycle mutation methods (cancel, restore, cancellation requests) to a very high spec-coverage bar; check for parity when reviewing new ones.
type: project
---

`backend/src/bookings/bookings.service.spec.ts` gives `describe('cancel', ...)` ~1900 lines of
coverage (auth boundary, every status branch, refund idempotency, held-only path, etc.) and
`describe('requestCancellation', ...)` its own dedicated block too.

**Why:** these methods move real money/inventory (refunds, seat release/claim, settlement rows),
so the team backs every branch with a unit test — this is the established convention for this
class of method, not just a nice-to-have.

**How to apply:** when reviewing a new or changed booking-lifecycle method (anything that flips
`BookingStatus`, claims/releases departure seats, or touches `Settlement`/`Payment` rows), check
whether `bookings.service.spec.ts` grew a matching `describe(...)` block in the same diff. If the
service file changed substantially but the spec file's additions are for an unrelated method, that
mismatch is worth flagging — as of 2026-08-01, `restore()` and `withdrawCancellationRequest()`
(both new, both status/inventory/money-adjacent) shipped with zero test coverage while the same
diff added 3 tests for the unrelated `getTravellerContact()` read-only helper. Re-check this is
still true before citing it — tests may have been added since.

See also [[project_2026_08_01_font_weight_regression]] for the review this was found in.
