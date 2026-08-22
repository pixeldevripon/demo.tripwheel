---
name: project_session_surface_feature
description: Multi-hat session-surface (view-switching) feature reviewed 2026-07-27 - status, open gap, and the pattern it introduced
type: project
---

Backend added `GET/PATCH /auth/session-surface` (session-surface.controller/service/swagger.ts +
dto/session-surface.dto.ts, registered in auth.module.ts) so a multi-hat account (one email, many
"hats" - operator + staff + traveler) can re-stamp its CURRENT session's `surface` without logging
out. `surface` is one of `LOGIN_SURFACES` (`account|portal|staff|admin`, defined in
`login-surfaces.ts`), stamped at sign-in from the door the user entered (`x-login-surface` header)
and validated on re-stamp against `getLoginSurfaces()` (403 if the account holds no matching
identity). Reviewed 2026-07-27, backend side is solid: session id always comes from the
guard-validated request, never the body; the 5 new e2e tests in `test/auth.e2e-spec.ts` (describe
"session-surface switching") cover auth-required, report, refuse-cross-hat, reject-unknown-value,
and multi-hat re-stamp - all passing.

Dashboard repo (`tripwheel-x-islandtours-dashboard`) consumes `surface` (from Better Auth's own
session, not yet wired to the new backend endpoint) to decide CUSTOMER vs DASHBOARD view:
`lib/rbac-utils.ts` `isCustomerView(role, surface)` - `surface==='account'` -> customer,
any other truthy surface -> dashboard, falsy/null -> falls back to `isCustomerRole(role)`. This is
correct and is the sole decision point (`navGroupsForRole` threads it through). `role-context.tsx`
carries `surface` alongside `role`/`permissions`; `dashboard-shell.tsx`, `customer-route-guard.tsx`,
`app-sidebar.tsx`, `command-palette.tsx`, `user-profile-dropdown.tsx` (sign-out door routing) all
consume it consistently. `getSessionRole` was renamed to `getSessionView` in
`lib/server/dashboard-session.ts` - no leftover callers, only one stale comment still says
"getSessionRole" (line ~87).

**Open gap found in review (not yet fixed, flagged as Major):** before this feature, `isCustomerRole`
was pure role check (`role==='USER'`), so an ADMIN could never be a "customer view". Now an ADMIN can
re-stamp to the `account` surface (ADMIN holds every door) and become `isCustomerView===true` while
`command-palette.tsx`'s `isAdmin` gate (`userRole==='ADMIN'`, line ~108) and its permission gate
(`can(CREATE_TRIP) || can(MANAGE_OPERATORS)`, Actions block ~line 209) are unaware of `surface` - only
`destinations` (line ~132) was updated with `!isCustomer`. Net effect: an admin who switches to the
traveler view still gets catalogue "Tours"/"New tour"/"New tour operator" entries in the palette that
link to operator routes (`/trips/:id/edit`) which `CustomerRouteGuard` then bounces back to
`/bookings`. Not a security leak (admin already has that data access), just a UX/invariant violation
of the comment the same diff added ("customer VIEW must never be offered catalogue entities"). Fix
pattern: mirror the `destinations` gate - add `&& !isCustomer` to `adminTrips`'s enabled condition and
to the Actions block's render condition.

**Minor DRY note:** `getSessionView` and `getDashboardSession` in `dashboard-session.ts` both inline
the same `session.data.session as { surface?: string | null }` cast - small, worth a shared
`extractSurface()` helper if a third caller appears, not urgent at 2 call sites.

**How to apply:** if asked to review further work on this feature (e.g. a "switch view" UI that
actually calls the new backend endpoint), check whether the command-palette gap above was fixed, and
watch for the same isAdmin-vs-isCustomer split anywhere else `isAdmin` gates catalogue data without
also checking `isCustomer` now that ADMIN can hold a customer view.
