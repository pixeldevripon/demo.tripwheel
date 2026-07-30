---
name: finding_stop_sell_split_deleteexception_gap
description: STOP_SELL-only seats could delete ANY availability exception (incl. ADD_SLOT/SET_CAPACITY) via DELETE /availability/exceptions/:id, bypassing the capacity-shaping guard - fixed by adding a type check
metadata:
  type: project
---

Found 2026-07-30 reviewing the uncommitted availability-agenda work (branch `fix`).

**The bug:** `AvailabilityController.deleteException` (`src/availability/availability.controller.ts`)
had its guard changed from `@RequirePermissions(MANAGE_AVAILABILITY)` to
`@RequireAnyPermission(MANAGE_AVAILABILITY, STOP_SELL)` as part of the "stop-sell split"
(matrix v1.7 - dock staff may close/reopen but never shape inventory). But
`AvailabilityService.deleteException` never checked the exception's `type` before deleting -
it `select`ed only `{ tourId, date }`, not `type`. Every OTHER inventory-shaping write path
(`createException`, `updateException`) calls `assertCanShapeInventory()` to require full
`MANAGE_AVAILABILITY` for `ADD_SLOT`/`SET_CAPACITY`, but delete had no equivalent check. Net
effect: a STOP_SELL-only seat could `GET /availability/exceptions` to find an `ADD_SLOT` or
`SET_CAPACITY` row a manager created, then `DELETE` it - reversing a capacity decision they
are explicitly forbidden from making themselves. This is exactly the class of bug the split
exists to prevent (see the module's own docstring: "money-adjacent actions stay owner/manager").

**Why this pattern matters going forward:** whenever a route moves from AND-only
(`@RequirePermissions`) to an OR grant (`@RequireAnyPermission`) that mixes a broad and a narrow
permission, the service method behind it must be audited for EVERY write path the broader
permission was implicitly relying on to gate - not just the ones the diff's author had in mind.
Guard-decorator changes and service-body changes are easy to review separately and both look
correct in isolation; the gap only shows up by tracing the full call path end-to-end.

**How to apply:** on any future permission-split review in this repo (grep `RequireAnyPermission`
or `assertCanShapeInventory`-style type-conditional checks), specifically check delete/reopen/undo
endpoints paired with a narrower create/update guard - undo paths are the most common place the
symmetric check gets forgotten. See also [[pattern_atomic_consume_updateMany]] for the sibling
class of "the guard changed but the body didn't" bugs in this codebase.
