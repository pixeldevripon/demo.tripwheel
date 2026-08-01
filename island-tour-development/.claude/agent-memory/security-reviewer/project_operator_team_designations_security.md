---
name: Operator Team Designations Feature Security Findings
description: Security review (2026-08-02) of the "default operator-team designations" feature (team-designations.config.ts, seed-designations.ts, operators.service.create, dashboard quick-create) — CLEAN, no critical/high; documents the enforcement chain traced for each template permission
metadata:
  type: project
---

Review completed 2026-08-02. Scope: `backend/src/config/team-designations.config.ts` (+ its spec),
`backend/prisma/seed-designations.ts`, `backend/prisma/seed.ts`, `backend/prisma/demo/users-operators.ts`,
`backend/src/operators/operators.service.ts` `create()`, dashboard
`components/staff/staff-invite-dialog.tsx` + `designation-edit-sheet.tsx` + `permission-matrix.tsx`,
plus every downstream endpoint gated by a permission the 4 templates grant (customers, bookings,
operators). Complements [[project_staff_teams_module_security]] (that memory's MANAGE_USERS→EDITOR
escalation is a separate, still-open finding in the *staff* module, unrelated to this feature).

**RESULT: no critical or high findings.** All four templates (Operations Manager 25 perms,
Reservations Agent 8, Content Editor 12, Guide 3) sit inside `OPERATOR_SEAT_CEILING`
(`staff.config.ts` = `ROLE_PERMISSIONS[TOUR_OPERATOR]` minus `MANAGE_TEAM`/`MANAGE_OPERATOR_PAYMENTS`),
verified by manual diff against `roles.config.ts` AND by `team-designations.config.spec.ts`. Guide
correctly omits `VIEW_BOOKING_FINANCIALS` (conflict #7 manifest-projection rule) — has an explicit
test for it.

**Every permission the templates grant was traced to its tenant-isolation enforcement point:**
- `VIEW_USERS` → `customers.controller.ts` `list()` → `customers.service.ts` pins
  `ownOperatorId` via `resolveOperatorId(prisma, actor.id, actor.role)` AFTER every other filter —
  a team seat cannot widen scope via query params.
- `EDIT_BOOKING` → `bookings.service.ts` `assertOwnsBooking()` (line ~3070) uses the same
  `resolveOperatorId` + `isPlatformWideBookingRole` pattern — gates ONLY `report-non-payment`/
  `report-cancellation`, neither moves money directly.
- `EDIT_OPERATOR_PROFILE` → `operators.service.ts` `assertMemberOrAdmin()` (line ~121) checks
  `seat.operatorId === operator.id` + not-suspended — and this permission only gates
  `PATCH /operators/:id/company-info` and `/social-media`, NOT the core `PATCH /operators/:id`
  (which holds `contactEmail`/`isActive`/`verificationStatus` and stays behind `MANAGE_OPERATORS`,
  never in `ROLE_PERMISSIONS[TOUR_OPERATOR]` at all). So a non-owner seat with this permission
  cannot redirect the operator's password-reset email or touch verification status.
- `EDIT_TRIP` (Content Editor + Operations Manager) cannot be used to change commission tier or
  request Spotlight — `tiers.service.spec.ts` has explicit tests ("forbids a team seat (non-owner)
  from changing the tier" / "...from requesting Spotlight") independent of this feature.
- All team-seat users carry `Role.TOUR_OPERATOR` (confirmed in `staff.service.ts` `provisionMember`
  call sites) and are NOT in the `PLATFORM_WIDE` role array (`operator.util.ts`, only
  `ADMIN`/`STAFF`/`EDITOR`), so every one of the above always routes through the tenant-pinned
  branch, never the platform-wide branch.

**The seeded rows are written outside `assertWithinCeiling` (raw `createMany` in operators.service
create + seed-designations.ts + demo/users-operators.ts) — confirmed NOT exploitable:**
- Protected by two independent layers: (1) `team-designations.config.spec.ts` asserts every
  template permission is in-ceiling and Guide excludes financials — CI-enforced; (2)
  `computeEffectivePermissions()` (`staff.config.ts`) re-intersects with the ceiling at every
  permission READ regardless of what's in the DB — so even a hypothetically bad row can't grant
  functional access outside the ceiling.
- LOW/INFO gap worth flagging if ever touched again: `GET /staff/designations` and
  `/staff/team/designations` (`staff.service.ts` `toDesignationResponse`) return the designation's
  RAW stored `permissions` array, not the ceiling-filtered effective set. If the spec test were ever
  deleted/skipped and a template gained an out-of-ceiling permission, the dashboard UI would *display*
  that permission as granted even though `computeEffectivePermissions` silently drops it for actual
  access — a display/audit inconsistency, not an access escalation. Not worth fixing preemptively;
  just note it if `team-designations.config.spec.ts` ever gets weakened or removed.

**`cleanTeamDesignations` (seed-designations.ts) cannot delete operator-authored designations** —
confirmed by checking `staff.prisma`: `isSystem Boolean @default(false)`, and NEITHER
`createDesignationFor` nor `updateDesignationFor` (`staff.service.ts`) ever sets `isSystem` in their
Prisma `data` — it can only ever be `true` via the three `defaultTeamDesignationRows()` call sites.
Also CLI-only (`pnpm prisma:seed:designations:clean`), not reachable via any HTTP endpoint, so it
requires deploy/shell access regardless.

**Dashboard "Add designation" quick-create (`staff-invite-dialog.tsx` → `DesignationEditSheet` →
`useCreateDesignation`) is NOT a bypass** — confirmed it calls the identical
`staffApi.createDesignation(scope, payload)` → `POST /staff/designations` or
`/staff/team/designations`, same `MANAGE_STAFF`/`MANAGE_TEAM` guard + `assertWithinCeiling` as the
full designations tab. `PermissionMatrix` only renders permissions from
`GET /staff/permission-catalog` (already ceiling-filtered per scope), so the UI can't even offer an
out-of-ceiling checkbox — and the backend would 400 it regardless.

**`operators.service.ts create()` rollback**: designation `createMany` happens after operator +
OWNER `staffMember` creation inside one try/catch; any failure deletes the operator row, which
cascades away the `staffMember` and `staffDesignation` rows (`onDelete: Cascade` in `staff.prisma`)
— no orphaned seeded-designation risk on partial failure.

**Why:** This is the definitive record that the operator-team-designations feature itself shipped
clean. Future reviews of `team-designations.config.ts` should re-check: (1) new/edited template
permissions still pass the spec test, (2) any NEW permission added to `OPERATOR_SEAT_CEILING` via a
`roles.config.ts` change to `TOUR_OPERATOR` gets traced to its own tenant-pinning enforcement before
being added to a template, the same way `VIEW_USERS`/`EDIT_BOOKING`/`EDIT_OPERATOR_PROFILE` were
traced here.
**How to apply:** If a 5th template or a permission addition to an existing template shows up, don't
just check `OPERATOR_SEAT_CEILING` membership (necessary but not sufficient) — walk the permission to
its controller/service and confirm the "WHOSE" scoping (usually `resolveOperatorId` /
`assertOwnsBooking` / `assertMemberOrAdmin`) is applied for the non-owner-seat path, the way this
review did for all four templates above.
