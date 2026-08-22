---
name: staff_team_module_review
description: Findings from the first review of the Staff & Teams module (backend src/staff/, staff.config.ts, updated operators/tours/users/bookings) - 2026-07-19
metadata:
  type: project
---

Reviewed the newly-built Staff & Teams module (fine-grained permissions on top of Role): `src/staff/*`, `config/staff.config.ts`, `config/roles.config.ts`, guards, `auth.instance.ts`, `common/utils/operator.util.ts`, plus its touch points in `operators.service.ts`, `tours.service.ts`, `user.service.ts`, `bookings.service.ts`.

**Overall: the strongest-architected module in the codebase so far.** `computeEffectivePermissions` in staff.config.ts is a single pure policy function consumed by both the guard path (StaffPermissionsService) and the API response echo (StaffService.toMemberResponse) - textbook DRY, can't drift. Ceiling/floor/exclusion sets are clearly documented with the *why* inline. See [[cross-module-patterns]] for the project's broader recurring issues - this module does NOT repeat the translationSelect/applyTranslation-style copy-paste that Category/Hub/Destination have.

**Real findings (verified against code, not assumptions):**

1. **IDOR/scope gap on `GET /users/:id/permissions`** (`user.controller.ts` ~L151, `user.service.ts` `getUserPermissions`/`getUserById`). Gated only by `@RequirePermissions(Permission.VIEW_PERMISSIONS)`. VIEW_PERMISSIONS is (a) in the STATIC `ROLE_PERMISSIONS[TOUR_OPERATOR]` list (every operator has it) and (b) inside `OPERATOR_SEAT_CEILING` (staff.config.ts), so it is grantable to a non-owner team seat via a designation. The service does zero ownership/operator scoping - any operator or a staff seat holding that permission can read ANY user's resolved permission set by id, including other operators, admins, or travelers. The docstring claims "admin audit" but the guard doesn't enforce that. Fix pattern: scope like `operators.service.ts`'s `assertMemberOrAdmin`, or split into an admin-only route.

2. **`updateTeamMember` is two non-atomic writes** (`staff.service.ts` ~L551-571). Writes `seatRole` first (bare `prisma.staffMember.update`), THEN calls `applyMemberUpdate` which runs `resolveDesignation` (can throw BadRequestException) before its own `prisma.staffMember.update`. If the designation validation throws, the seatRole write has already committed - partial state, no rollback, and the client sees an error despite a real mutation having landed. Verified: NOT a staleness bug in the *response* (Prisma's `update()` always returns the fresh row per `select`, so `effectivePermissions`/`seatRole` in the final response are correct) - the real defect is non-atomicity + an unnecessary extra round trip. Fix: validate first (assertWithinCeiling + resolveDesignation), then a single `update()` with all fields including seatRole.

3. **Invite/provisioning duplication** between `StaffService.provisionMember` (staff.service.ts ~L205-277) and `OperatorsService.create` (operators.service.ts ~L152-244): both normalize+check email, hash a throwaway password, `createUser`, `linkAccount`, `requestPasswordReset` with the same portalUrl body shape, log, and roll back via `deleteUser` on failure. The `portalUrl` private field is copy-pasted byte-for-byte in both services (staff.service.ts even comments "same convention as OperatorsService.portalUrl" - acknowledging the duplication instead of removing it). Worth extracting: a shared `provisionInvitedAccount()` util (email-check + createUser + linkAccount, throws ConflictException) and a shared `PORTAL_URL` constant/getter. Domain-row creation + custom rollback stay bespoke per service.

4. **bookings.service.ts platform-wide-role check duplicated** (`list()` ~L1924 and `assertCanView()` ~L1998): both hardcode `role === ADMIN || role === STAFF || role === EDITOR` to decide platform-wide vs operator-scoped visibility. Minor DRY - extract a `isPlatformWideBookingRole(role)` helper. Not a bug (confirmed both branches are consistent), just needs one source of truth if a role is ever added.

5. **StaffPermissionsService cache is process-local** (in-memory `Map`, 60s TTL). `invalidate()`/`invalidateAll()` only clear the calling process's cache. Fine for the current single-VPS deployment (see [[project_cicd_vps_deploy]]), but if the backend ever scales horizontally, a permission *downgrade* (not suspension - suspension also kills sessions via `session.deleteMany`, which is real-time regardless) could stay live on other instances for up to 60s. Flag again if horizontal scaling is ever discussed.

**Positive patterns confirmed correct on trace:**
- `resolveOperatorId` (common/utils/operator.util.ts) was correctly extended in this PR to resolve ACTIVE team seats too, and `tours.service.ts`'s private wrapper now delegates to it - removed what would have been a third copy of the owner/seat/admin-auto-provision logic.
- Prisma schema (`staff.prisma`) uses `@@unique([operatorId, name])` + service-level null-scope dedup for the Postgres NULL-distinctness gotcha - correctly reasoned, documented inline.
- Dashboard side (types/staff.ts, lib/api/staff.ts, hooks/staff/use-staff.ts, components/staff/*) is clean: query key factory, toast-in-hook, minimal 'use client', DTOs mirror backend with header comment, operatorId placement (body vs query) matches the backend route-by-route exactly (verified every one).
