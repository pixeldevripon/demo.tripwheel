---
name: project_island_scope_it71_security
description: Security review of GitHub issue #71 (island scope for admin calendar range actions) — clean; operator-pin and role-vs-permission decoupling re-confirmed
type: project
---

Reviewed 2026-08-15: backend `it-71-island-scope` worktree, top commit `d328b60`
(`rangeScope()`/`overview()` gain `destinationId` in
`backend/src/availability/availability.service.ts`; `operators.findAll` gains
`destinationId` in `backend/src/operators/operators.service.ts`) + dashboard
`dash-71-island-scope` worktree, top commit `29b81d5` (Island filter popover +
cascade in `components/calendar/global-calendar.tsx`,
`components/common/island-filter-popover.tsx`, `range-dialog.tsx`). Both
branches stacked on `pastel-67-range-impact`
([[project_range_impact_it67_security]]) — only the top commits were in scope.
No critical/high findings.

**What this added:** `destinationId` on `RangeScopeDto` (shared by
`CloseRangeDto`/`ReopenRangeDto`/`RangeImpactQueryDto` via
`extends RangeScopeDto`) and on `OverviewQueryDto`/`OperatorQueryDto`. For
ADMIN, `destinationId` alone can now be the whole scope (island-wide
close/reopen/preview, no `operatorId` needed) — previously ADMIN had to name
an `operatorId`. For everyone else it is a pure narrowing filter ANDed onto
their existing pin.

**Confirmed clean — the operator pin is never dropped for non-admins:**
- `rangeScope()` (availability.service.ts ~1342-1400): the `if (role ===
  Role.ADMIN) {...} else { operatorId = await this.operatorContext(userId);
  }` branch structure is unchanged by this diff — `dto.operatorId` is still
  read ONLY inside the ADMIN branch (same invariant as
  [[project_range_impact_it67_security]]). `destinationId` is spread onto the
  `tour.findMany` where-clause alongside whatever `operatorId` the branch
  resolved — for non-admins that's always their own, from
  `operatorContext(userId)` (:693-706, resolves via `Operator.userId` or a
  non-suspended `StaffMember.userId` seat — never from client input).
- `overview()` (:922-954): identical shape — non-admin builds
  `tourWhere = { operatorId, isActive: true }` from `operatorContext(userId)`
  FIRST, `destinationId` is ANDed on after. `query.operatorId` remains
  "deliberately ignored" for non-admins (pre-existing comment, unchanged).
- The `dto.tourId` single-tour path is orthogonal to all of this —
  `assertTourAccess` (unchanged, :2362-2380) throws 403 on any
  operator/tour mismatch before `destinationId` is ever read.

**Confirmed clean — STOP_SELL-only staff cannot reach island-wide scope.**
`closeRange`/`reopenRange`/`rangeImpact` are gated by
`@RequireAnyPermission(MANAGE_AVAILABILITY, STOP_SELL)` — a PERMISSION check.
But the scope-widening branch in `rangeScope`/`overview` gates on
`role === Role.ADMIN` literally — a different, decoupled check. `Role.STAFF`
is a distinct Prisma enum value from `Role.ADMIN`
(`prisma/enums.prisma: ADMIN, EDITOR, STAFF, GUIDE, TOUR_OPERATOR, USER`).
`config/roles.config.ts` (`ROLE_PERMISSIONS` static map) grants
`MANAGE_AVAILABILITY`/`STOP_SELL` statically only to `ADMIN` and
`TOUR_OPERATOR` — a STAFF seat's STOP_SELL comes exclusively through
`StaffPermissionsService`'s computed per-member override, itself scoped to
that seat's own `StaffMember.operatorId`. So any STOP_SELL-holding staff seat
necessarily has `role !== Role.ADMIN`, always falls into the pinned `else`
branch, and always resolves to their OWN operator regardless of what
`destinationId` they pass. Permission level (what you may DO) and role (whose
data you see) are correctly independent checks here — this is the right
pattern, worth reusing as the standard to check against in future
scope-widening features.

**Confirmed clean — fan-out bound unchanged.** ADMIN island-wide close/reopen
is still capped at 200 tours (`rangeScope`'s `take: 200`) × 366 days (checked
in `closeRange`/`reopenRange`/`rangeImpact` independently, all three, same as
the pre-#71 `operatorId`-only scope). Not a new DoS class — same ceiling an
ADMIN could already hit via a large `operatorId` scope pre-#71, just now also
reachable via `destinationId`.

**Confirmed clean — `operators.findAll` destinationId leaks nothing new.**
`GET /operators` requires `MANAGE_OPERATORS` (admin-tier permission) — not
reachable by a plain TOUR_OPERATOR or STOP_SELL-only seat. The new
`where.tours = { some: { destinationId, isActive: true } }` only narrows a
dataset the same caller can already pull unfiltered with the same `select`
(includes `user.email` — pre-existing, appropriate for that permission tier,
not newly exposed by this filter).

**Confirmed clean — dashboard.** No `dangerouslySetInnerHTML` anywhere in the
diff; `islandName` (from `useActiveDestinations()`, admin-curated) is
interpolated only as a plain JSX text child in `range-dialog.tsx`'s
`SelectItem`. `destinationId` in the calendar's Island filter is populated
only from a closed dropdown of real destination IDs — no new ID-enumeration
surface (destinations are public catalogue data, already visible site-wide).
Client-side `isAdmin` gating before sending `destinationId` is pure UX/defense
in depth; the actual trust boundary is server-side (confirmed above).

**Low/informational (not filed as a blocking finding):** dashboard
`isAdmin = isPlatformWideRole(role)` (lib/rbac-utils.ts) returns true for
`ADMIN`, `STAFF`, AND `EDITOR` — broader than the backend's literal
`role === Role.ADMIN` gate for destination-alone scope. If a `Role.STAFF`/
`EDITOR` session ever reached the calendar with `MANAGE_AVAILABILITY`/
`STOP_SELL` granted but no `Operator`/`StaffMember` row of their own, they'd
see "All tours on {island}" in the UI but submitting it would silently
no-op (`rangeScope`'s non-admin branch resolves `operatorContext` to `null`,
and `closeRange`/`reopenRange` return `{closed: 0, tourCount: 0}` with no
error) — a false-success UX footgun, not a cross-tenant data issue. Not
currently reachable given the permission model as reviewed (STOP_SELL only
computed for an operator-bound `StaffMember` row), but worth tightening the
frontend's `allToursAllowed` check to literal `role === 'ADMIN'` if that
combination ever becomes grantable.

**Pattern reconfirmed:** `destinationId` on all three DTOs
(`RangeScopeDto`/`OverviewQueryDto`/`OperatorQueryDto`) uses `@IsString()`
not `@IsUUID()` — same established convention as `tourId`/`operatorId` on
these DTOs, not a deviation.
