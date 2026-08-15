---
name: Staff & Teams Module Security Findings
description: Security review of the Staff & Teams module (2026-07-19) — critical MANAGE_USERS -> EDITOR role-flip privilege escalation, plus tenant-isolation/cache findings for staff-permissions.service.ts
type: project
---

Review completed 2026-07-19. Scope: `backend/src/staff/*`, `backend/src/config/staff.config.ts`,
`backend/src/config/roles.config.ts`, `backend/src/users/*`, `backend/src/auth/guards/*`,
`backend/src/auth/auth.instance.ts`, `backend/src/common/utils/operator.util.ts`,
`backend/src/operators/operators.service.ts`, `backend/src/bookings/*`, plus the dashboard
staff/team UI. Full jest suite (55/1150+) was passing at review time; no code was modified.

**FIXED as of 2026-08-15 (verified during [[project_slug_ownership_it73_security]]) — the
`PATCH /users/:id/role` half of the CRITICAL below is closed:** `user.service.ts`
`updateUserRole()` now throws `ForbiddenException` unless `requester.role === Role.ADMIN`
(literal role check, line ~244) — no longer reachable via a `MANAGE_USERS` permission grant
alone. `user.controller.ts` JSDoc (line ~277) documents this as deliberate defense-in-depth.
`dto.role === Role.ADMIN` is also hard-blocked, so ADMIN itself can never be assigned via this
endpoint. This closes the "side-door via the *users* module" escalation path described below.
**Not re-verified in the 2026-08-15 pass:** whether `staff.config.ts` `PLATFORM_STAFF_EXCLUDED`
now also excludes `MANAGE_USERS`/`UPDATE_USER` from the ceiling itself (the fix above may make
that moot for role-changes specifically, but a lingering `MANAGE_USERS` grant could still expose
other user-mutating endpoints beyond role-change) — re-check `staff.config.ts` directly before
assuming the ceiling question is fully closed, not just the role-endpoint.

**CRITICAL (role-change half fixed, see above — re-verify ceiling half before reusing this
entry as still-open):**

- **`MANAGE_USERS` + role-flip-to-EDITOR bypasses the entire staff ceiling system.**
  `staff.config.ts` `PLATFORM_STAFF_EXCLUDED` only excludes `MANAGE_SYSTEM`/`MANAGE_STAFF`/
  `MANAGE_TEAM` — `MANAGE_USERS` and `UPDATE_USER` are NOT excluded, so an ADMIN can (plausibly by
  accident, e.g. building a "user support" designation) grant a platform STAFF member
  `MANAGE_USERS` via a designation/extraPermissions. `user.controller.ts` `PATCH /users/:id/role`
  is gated only by `@RequirePermissions(Permission.MANAGE_USERS)` (no `@Roles(ADMIN)`).
  `user.service.ts` `updateUserRole()` blocks assigning/demoting `ADMIN` only — it does NOT block
  assigning `EDITOR`, `STAFF`, or `TOUR_OPERATOR`. `staff-permissions.service.ts`
  `getEffectivePermissions()` (line ~54) returns `ROLE_PERMISSIONS[role]` **unchanged, with no
  ceiling** for any role other than STAFF/TOUR_OPERATOR. `roles.config.ts` `ROLE_PERMISSIONS[EDITOR]`
  is a broad static set (full trip/destination/category/collection/blog CRUD, booking &
  payment edit/delete platform-wide, review moderation, media, analytics/export/bulk) with zero
  staff-system oversight (no designation, no ceiling, not staff-managed, not revocable). Net
  effect: a staff member granted `MANAGE_USERS` can flip an accomplice account to `EDITOR` and
  hand them near-ADMIN platform-wide power, completely outside the ceiling/floor model the whole
  Staff & Teams feature was built to enforce. Direct grant paths (`staff.controller.ts`
  `MANAGE_STAFF`/`MANAGE_TEAM`-gated endpoints) correctly enforce the ceiling via
  `assertWithinCeiling` — this is a side-door via the *users* module, not the staff module itself.
  **Fix options:** exclude `MANAGE_USERS` (and probably `UPDATE_USER`/`DELETE_USER`) from
  `PLATFORM_STAFF_CEILING`, and/or make `updateUserRole` reject assigning `EDITOR`/`STAFF` to a
  target unless the caller is real ADMIN (not just MANAGE_USERS-holding staff) — **this half is
  now done, see the FIXED note above** —, and/or route EDITOR through the same ceiling computation
  as STAFF in `getEffectivePermissions`.

**MEDIUM:**

- **Two divergent suspension paths for the same account.** `staff.service.ts`
  `applyStatusUpdate()` (used by `PATCH /staff/:id/status` and `/staff/team/:id/status`) sets
  `user.status`, syncs `staffMember.status`, deletes all sessions, and calls
  `staffPermissions.invalidate()`. `user.service.ts` `updateUserStatus()` (`PATCH /users/:id/status`,
  gated only by `MANAGE_USERS`) sets ONLY `user.status` — no session deletion, no
  `staffMember.status` sync, no cache invalidation. Not currently exploitable as an access bypass
  (AuthGuard re-checks live `user.status` every request via `disableCookieCache: true`, independent
  of `staffMember.status` or the permission cache), but it's a weaker defense-in-depth path and
  creates a data-integrity drift between `user.status` and `staff_members.status` that the Team UI
  surfaces. Flag if any future code trusts `staffMember.status` as sole suspension authority.

- **Permission cache has no cross-instance invalidation (flagged as acceptable, per review brief).**
  `StaffPermissionsService` (`backend/src/staff/staff-permissions.service.ts`) is an in-process
  `Map` with a 60s TTL; `invalidate()`/`invalidateAll()` only clear the local process's cache. In a
  multi-instance deployment, revoking a *designation permission* (not a suspension — suspensions are
  covered independently by session deletion + live `user.status` check) can leave up to 60s of
  stale elevated access on other instances. Needs Redis-backed invalidation (pub/sub or shared
  cache) before horizontal scaling.

**LOW / INFORMATIONAL:**

- `MANAGE_OPERATOR_PAYMENTS` is grantable to platform staff via the ceiling (only excluded from the
  *operator seat* ceiling, `OPERATOR_SEAT_EXCLUDED` in `staff.config.ts`), but
  `operators.service.ts` `assertOwnerOrAdmin()` only recognizes `role === Role.ADMIN` as a bypass —
  a STAFF user granted this permission still gets a hard 403 on Stripe/Mollie config endpoints.
  Fail-closed (safe), but the permission catalog advertises a grant that doesn't functionally work.
- `GET /staff/permission-catalog` (`staff.controller.ts`) has no `@RequirePermissions` at all —
  any authenticated user, including a plain traveler (`Role.USER`), can enumerate the full
  Permission catalog and both scope ceilings. Low-sensitivity information disclosure of the RBAC
  model's shape, not user data.
- `resendPlatformInvite`/`resendTeamInvite` call `auth.api.requestPasswordReset()` directly
  (server-side), bypassing Better Auth's route-level `customRules` rate limit
  (`/forget-password` 5/min in `auth.instance.ts`) — only the global `ThrottlerGuard` (300/min)
  applies, so a compromised/malicious MANAGE_STAFF or MANAGE_TEAM actor could mail-bomb a member's
  inbox with reset links well beyond the intended 5/min. Requires an already-privileged actor.
- Invite flow email enumeration (`ConflictException` when the email already exists,
  `staff.service.ts` `provisionMember()`) mirrors `operators.service.ts` `create()` — pre-existing
  accepted pattern in this codebase, not new risk (both require admin/owner-level auth already).
- Dashboard `RoleProvider` (`contexts/role-context.tsx`) falls back to the static
  `ROLE_PERMISSIONS[role]` mirror when `GET /users/me/permissions` transiently fails
  (`app/_actions/userActions.ts` `getUserProfile`). For a narrowly-designated STAFF/seat user this
  can over-render UI actions (edit/delete buttons) beyond their real grant. No data leak — the
  backend still enforces the real effective set — but worth tightening (e.g., render nothing /a
  reduced-trust skeleton on fetch failure rather than the full static role list).

**CONFIRMED SECURE PATTERNS (Staff & Teams, worth reusing):**

- `resolveTeamOperatorId`/`resolveMember`/`resolveDesignation` in `staff.service.ts` correctly pin
  every team-scoped call to the caller's own operator (owner via `Operator.userId` lookup, admin
  via explicit `?operatorId`) and reject cross-tenant designation/member access with 403/404 —
  verified no operatorId-in-body/query injection path.
- `assertWithinCeiling()` is applied as defense-in-depth on every permission-array write
  (invite extraPermissions, member update, designation create/update) in addition to the
  ceiling-intersection done at read time in `computeEffectivePermissions` — tampered DB rows can't
  re-grant themselves anything outside the ceiling even if written directly.
- `resolveOperatorId` (`common/utils/operator.util.ts`) correctly excludes SUSPENDED seats from
  resolving to an operator id.
- Suspension via the *staff-specific* endpoints is properly atomic: `user.status`,
  `staffMember.status`, session deletion, and cache invalidation all happen together.
- `AuthGuard` now calls `getSession` with `disableCookieCache: true` and independently re-checks
  `SUSPENDED`/`DELETED` on every request — closes the 5-minute Better Auth cookie-cache race that
  would otherwise let a just-suspended session keep working.
- `session.create.before` hook blocks sign-in for SUSPENDED/DELETED accounts server-side (defense
  in depth beyond AuthGuard).
- System-seeded designations (migration `20260719180644_staff_and_designations`) contain none of
  the dangerous permissions (no MANAGE_USERS/UPDATE_USER/DELETE_USER) — the escalation above
  requires an admin to deliberately create a custom designation naming those permissions.
- `RolesGuard`/`PermissionsGuard` both null-check `request.user` now — the Phase 3 finding
  (`project_auth_phase3_security.md`) about missing null-safety is **fixed**.

**Also confirmed fixed since Phase 3 (update to that memory):** `auth.instance.ts` `role` additional
field is now `input: false` with `defaultValue: Role.TOUR_OPERATOR` (was `input: true` — the old
#1 critical). The `IS_SEEDING` env-var bypass pattern is gone entirely (`grep IS_SEEDING` returns
nothing in `src/`). ADMIN's `ROLE_PERMISSIONS` now includes `CREATE_CONTENT`/`VIEW_CONTENT` (the
old "ADMIN missing permissions" gap looks resolved, `roles.config.ts` line ~27-29).

**Why:** This is the definitive record of the Staff & Teams privilege-escalation path — future
reviews of any users/, staff/, or roles.config.ts change must re-verify the MANAGE_USERS→EDITOR gap
is closed before considering related work safe to ship.
**How to apply:** Any future PR touching `staff.config.ts` ceilings, `user.service.ts`
`updateUserRole`, or `roles.config.ts` EDITOR/STAFF permission sets should be checked against this
finding first. If the fix has landed, verify it here (does `PLATFORM_STAFF_CEILING` exclude
MANAGE_USERS? does `updateUserRole` block EDITOR/STAFF for non-ADMIN callers?) before assuming the
gap is closed.
