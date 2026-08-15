---
name: project_slug_ownership_it73_security
description: CLEAN security review of GitHub issue #73 (tour slug becomes Island-Tours-owned) across backend + dashboard; also confirms the prior staff-module CRITICAL role-flip finding is now fixed
metadata:
  type: project
---

Reviewed 2026-08-15. Branch `pastel-73-slug-review-owned` in both
`island-tour-development` (backend/src/tours/tours.service.ts +
dto/tour.dto.ts) and `tripwheel-x-islandtours-dashboard`
(components/trips/wizard/steps/step-basics.tsx). Diff vs `prod`/`main`
respectively. **No confirmed vulnerabilities.**

**What changed:** `create()` line ~2633 and `update()` line ~2950 both gate
`dto.slug` on literal `userRole === Role.ADMIN` (was: any caller with
`EDIT_TRIP`/`CREATE_TRIP`, i.e. every TOUR_OPERATOR). Non-admin slug is
IGNORED, not rejected (400 would break older dashboards that echo the stored
slug back on every save). Dashboard hides the slug input for non-admins and
shows a read-only "Web address" fact instead — presentation only, per
`useRole()` from `contexts/role-context.tsx` (server-resolved props).

**Confirmed server-side, not just UI-hidden:**
- `userRole`/`requesterRole` in both service methods come straight from
  `@AuthenticatedUser()` → `req.user` → Better Auth session, never from the
  request body. Client-side role tampering (devtools, RoleContext override)
  only flips which input renders — the backend re-checks the real session
  role regardless, so it changes nothing security-relevant.
- Traced every write path for `tour.slug` platform-wide (grepped all
  `tour.update`/`create`/`updateMany`/`upsert` callers): only
  `tours.service.ts` `create()`/`update()` ever set it. `tiers.service.ts`,
  `sitemap.service.ts`, `availability.service.ts`, `reviews.service.ts` write
  other tour fields but never `slug`. `octo.service.ts` is read-only
  (`findMany`/`findUnique` only) — no OCTO write surface exists for slug.
  `tours.controller.ts` has exactly one `@Post()` and one `@Patch(':id')`
  that accept a body containing `slug`; no bulk-update endpoint exists.
- Response objects (`this.flattenTour(updated)` in `update()`, the created
  `tour` row in `create()`) are built from the persisted DB row, not echoed
  from `dto.slug` — an ignored non-admin slug can't leak back as if honored.

**Role model (point 2 of the review — literal-role gate vs. permission
grants):** `Role` enum (`prisma/enums.prisma`) has exactly one ADMIN value.
EDITOR and the operator-staff `TOUR_OPERATOR`-seat designations both carry
broad `CREATE_TRIP`/`EDIT_TRIP` permissions (`roles.config.ts`) — enough to
create/edit tours — but their literal `role` field is never `'ADMIN'`, so the
slug gate excludes them correctly even though they can reach the surrounding
endpoint. This is stricter than the general trip-edit permission ceiling,
which is safe (more restrictive, not less).

**Bonus finding — prior CRITICAL from [[project_staff_teams_module_security]]
is now fixed.** That 2026-07-19 review flagged `PATCH /users/:id/role` as
gated only by `@RequirePermissions(MANAGE_USERS)` with no `@Roles(ADMIN)`,
letting a STAFF member holding a delegated `MANAGE_USERS` grant flip an
account to EDITOR (near-ADMIN static permission set, no staff ceiling). As of
this review, `user.service.ts` `updateUserRole()` (line ~244) now explicitly
throws `ForbiddenException` unless `requester.role === Role.ADMIN` — literal
role check, not a permission grant — and the controller JSDoc
(`user.controller.ts` line ~277) documents this as deliberate
defense-in-depth ("a role change hands out an entire static permission set,
which must never be reachable via a delegated grant"). `dto.role ===
Role.ADMIN` is also explicitly blocked (ADMIN can never be assigned via this
endpoint at all). Net effect: there is no live path for any non-ADMIN to end
up with a literal `role === 'ADMIN'` session, which is what makes the #73
slug gate (`=== Role.ADMIN`) sound. Worth updating the staff-module memory's
CRITICAL entry to reflect this fix; the broader `PLATFORM_STAFF_EXCLUDED`
ceiling question (whether MANAGE_USERS itself should be excluded from the
staff ceiling) was not re-verified in this pass.

**Registry invariants (point 4):** the diff only wraps the pre-existing
rename block (`slugTourConflict`/`registryTaken` pre-check +
`renameEntitySlug` in the `$transaction`) in `&& requesterRole ===
Role.ADMIN` — the conflict-check and 90-day-cooldown/301 logic itself is
byte-for-byte unchanged. Confirmed not weakened. Side note (pre-existing, not
introduced by this diff, not blocking): the pre-check still runs outside the
transaction (TOCTOU window) and `renameEntitySlug`'s `slugRegistry.updateMany`
has no explicit P2002 catch — same class of gap as
[[project_category_subcategory_reattach_security]]. Blast radius is now
smaller than before this diff, since only ADMIN (not every TOUR_OPERATOR)
can reach the rename path at all.

**Ignored-not-rejected choice (point 3):** no injection/log-forging risk —
`slug` is `@Matches(/^[a-z0-9-]+$/)`-constrained at the DTO layer
unconditionally (validated before the service ever sees role), so even the
ignored value can't carry control/newline characters, and no code path logs
the raw `dto` object (all `this.logger.log` calls in tours.service.ts use
plain template strings with specific fields, never a raw slug).

**Minor/informational, pre-existing, not introduced by this diff:** neither
`CreateTourDto.slug` nor `UpdateTourDto.slug` has a `@MaxLength` (only
`@MinLength(2)` + the charset regex). Now reachable by ADMIN only post-fix
(previously any operator), so this diff shrinks rather than grows that
surface. Low priority to add `@MaxLength` for defense in depth given it now
feeds a unique index key.

**Why:** definitive record that #73 is a genuine server-side fix (not a
button-hiding one) and that the ADMIN-role gate is sound against every role
in the system, including staff/operator-seat permission grants.
**How to apply:** future PRs touching tour slug/create/update in either repo
should re-verify the `userRole === Role.ADMIN` / `requesterRole ===
Role.ADMIN` gates are still literal-role checks (not permission checks) and
that no new tour-slug write path (bulk ops, OCTO, admin tools) has been
added without the same gate.

**Update 2026-08-15:** a 3rd tour-slug write path shipped —
`approveTour()`'s approval-time realignment (issue #79, see
[[project_approve_slug_it79_security]]). It's `MANAGE_TRIPS`-gated (not the
literal-`ADMIN` gate this memory is about, since approve/reject is a
platform-staff-reachable action by design, not a slug-authoring one) but
reuses the same `generateSlug`/`isSlugTaken`/`renameEntitySlug` primitives
and the same outside-transaction collision-check shape — confirmed equally
sound. "Only 2 write paths exist platform-wide" above is now stale; it's 3.
