---
name: finding_restore_double_restore_race
description: BookingsService.restore() (admin cancellation-reversal, 2026-08-01) claims departure seats via a guarded updateMany but flips the booking's own status with a plain update with no status:CANCELLED guard - two concurrent restore calls on the same booking can both win, double-incrementing bookedCount
metadata:
  type: project
---

Reviewed 2026-08-01: `backend/src/bookings/bookings.service.ts` `restore()` (~line 2844) and
`withdrawCancellationRequest()` (~line 2019), added for the admin "undo a mistaken cancellation"
feature. See [[pattern_atomic_consume_updateMany]] for the general idiom this violates.

**The bug:** `restore()` reads `booking` via `loadOr404` OUTSIDE any transaction, checks
`booking.status !== CANCELLED` etc. in plain JS, THEN opens a `$transaction` that (a) does a
correctly-guarded `tx.departure.updateMany({ where: { id, status: {not: CANCELLED}, bookedCount:
{lte: capacity - seats} }, data: { increment: seats } })` for the seat re-claim, but (b) finishes
with a plain `tx.booking.update({ where: { id: booking.id }, data: { status: CONFIRMED, ... } })` -
no `status: CANCELLED` in that WHERE, no count check. Two concurrent `restore(id)` calls (double-
click on the dashboard's Restore button, or two admins racing) both read `status === CANCELLED`
before either commits, both pass every guard, and - if the departure has enough spare capacity to
absorb the seat claim twice - BOTH transactions succeed: `bookedCount` is incremented by `seats`
TWICE for what is physically one booking's seats (phantom seats counted as booked), and
`reinstateSettlement` + `sendConfirmationEmail` both fire a second time. If capacity is tight, the
second claim's guard correctly fails (`claim.count === 0` -> rollback) - so the bug only manifests
silently on departures with slack, which is exactly when nobody would notice the miscount.

**Why the departure-side guard alone doesn't save it:** the guarded `updateMany` prevents
overselling relative to *current* `bookedCount`, but has no concept of "this specific booking
already claimed its seats" - it will happily grant the SAME booking's seat count twice to two
racing callers, because nothing ties the claim to a single-use consumption of the booking's
CANCELLED state. The fix is to guard the booking's own status flip first (or as part of the same
guard chain): `tx.booking.updateMany({ where: { id, status: CANCELLED }, data: {...} })`, check
`count === 1`, and only then (or atomically alongside it) claim the departure seats - so a losing
racer's transaction is a clean no-op instead of a second successful claim.

**Sibling, lower-severity issue in the same diff:** `withdrawCancellationRequest()` has the
identical shape (plain `prisma.booking.update` clearing `utcCancellationRequestedAt`, no guard) -
two concurrent withdraw calls both pass the `!booking.utcCancellationRequestedAt` check and both
call `sendCancellationWithdrawnNotices` (admin+traveller+operator, 3 emails), so a double-click
sends 6 emails for one logical action. No money/capacity impact (mailbox noise only), and it
mirrors a PRE-EXISTING weakness already present in the neighboring `submitCancellationRequest`
(unchanged in this diff) - so it's a known-class gap, not a new pattern, but still worth fixing
together since the fix is the same idiom.

**Confirmed NOT a new weakness (don't re-flag):** the "read `departure.capacity` via `findUnique`,
then use it in a JS-computed `updateMany` WHERE" shape (`dep.capacity - seats`) is this codebase's
established, repeated pattern (also at `bookings.service.ts` ~600, ~1146-1153, ~4669-4675) - a
TOCTOU exists in theory if an admin edits `capacity` mid-transaction, but that's a pre-existing,
repo-wide accepted tradeoff, not something `restore()` introduced.

**How to apply:** on any future review of an admin-reversal / restore / undo endpoint in this
codebase, check whether the entity's own status-transition write is a guarded `updateMany` keyed on
the expected PRIOR status, not just whether a downstream capacity/seat claim is guarded. The two
are independent guards and both are needed - guarding only the capacity side (as `restore()` did)
still allows the same logical action to execute twice.
