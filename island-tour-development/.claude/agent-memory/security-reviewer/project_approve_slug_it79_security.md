---
name: project_approve_slug_it79_security
description: CLEAN security review of GitHub issue #79 (publish approval gate - submissions queue + approval-time slug assignment) across backend + dashboard; confirms a 3rd tour-slug write path is as sound as the other 2
metadata:
  type: project
---

Reviewed 2026-08-15. Backend branch `approve-slug-79` (`backend/src/tours/tours.service.ts`
`approveTour()`, line ~3386, diff vs `prod`), dashboard branch `submissions-queue-79`
(`app/(app)/submissions/page.tsx`, `components/submissions/submissions-queue-view.tsx`,
`components/shell/nav-main.tsx`, `navigations/navigations.ts`, diff vs `main`). **No confirmed
vulnerabilities.**

**What changed:** `approveTour()` (already `@RequirePermissions(MANAGE_TRIPS)` at the controller,
`tours.controller.ts` line ~215) now re-derives the tour's slug from its final approved title, but
only when `!tour.firstPublishedAt` (never gone live) — a live tour's rename stays a deliberate
admin action, never an approval side effect. Reuses `generateSlug` + `isSlugTaken` +
`renameEntitySlug` (`common/utils/slug-registry.util.ts`) — the same three primitives `update()`'s
admin-slug-rename path already uses (see [[project_slug_ownership_it73_security]]). A collision
(with either another tour's `slug` column or an active `slugRegistry` row of ANY entity type) keeps
the current slug and logs a warning rather than failing the approval — deliberate, tested
(`tours.service.spec.ts` line ~1676: "a colliding approved-title slug is kept").

**1. Slug-realignment abuse (protected-slug takeover) — clean.** `generateSlug` is the same
NFD-strip/lowercase/`[^a-z0-9\s-]`-strip sanitizer used everywhere (`common/utils/slug.util.ts`
line 59); no path-traversal or control-char risk since output is always `[a-z0-9-]*`.
`isSlugTaken(tx, dest.slug, derived, id)` checks the `slugRegistry` unique index
`(destinationSlug, slug)` regardless of which entity owns the row — the 19 category slugs + the
reserved `tours` slug per destination all have their own `slugRegistry` rows (`entityId` = the
category/reserved row's own id, never the tour's), so passing `excludeEntityId = id` (the tour)
never matches them. A collision with a protected slug is correctly detected and falls back to
keeping the old slug — cannot be forced through by any tour name.

**2. 90-day-cooldown / squat-via-cycling — not exploitable, and not new capability anyway.**
Confirmed `submitForReview()` (line ~3335) rejects re-submission while `approvalStatus === APPROVED`
(409) — an operator cannot loop submit→approve on a still-approved tour. The only path back to
`NOT_SUBMITTED` is `archive()` → `restore()` (operator-reachable on their own never-live tour,
`archive()` only requires `status !== ARCHIVED`), which does reset `approvalStatus` and allows a
fresh submit with a new name → a new admin-approval round → a new `renameEntitySlug` call. But this
grants nothing beyond what `create()` already grants: `create()` (line ~2634) already reserves
`generateSlug(dto.name)` in the registry transactionally and self-serve, no admin involved, at
tour-creation time (rule #4/#8) — with **no numeric-suffix fallback** (a second collision on the
operator-name-suffixed candidate throws `ConflictException`, forcing a real rename). So an operator
could already claim any free slug just by creating a tour with that name; #79 doesn't add reach.
Also confirmed renames (including this new approval-time one) get **no cooldown protection on the
vacated slug** — `renameEntitySlug` re-points the tour's single registry row in place; the old slug
is immediately free for anyone, so a cycle can hold only the tour's *current* one slug, never
accumulate multiple locked ones. And the whole mechanism is admin-mediated per round (a human must
click Approve each time) — self-service abuse rate is zero, not just throttled.

**3. `/submissions` route data path — clean, server-gate confirmed.** `GET /tours/admin/all`
(`tours.controller.ts` line 132-136) carries `@RequirePermissions(Permission.MANAGE_TRIPS)` — same
endpoint the existing admin Tours list already uses, unchanged by this diff.
`useAdminTrips()`/`SubmissionsQueueView` (`components/submissions/submissions-queue-view.tsx`) is a
plain react-query call with no client gate; on a 403 it just renders the table's empty state (`data`
stays `undefined` → `data?.data ?? []` → `[]`) — no data leak, no backend detail surfaced. Note:
this dashboard's `app/(app)/layout.tsx` has no route-level permission guard at all (only
session-exists + role-based redirects for `USER`/uninboarded `TOUR_OPERATOR`) — any other
authenticated dashboard session (e.g. staff without `MANAGE_TRIPS`) CAN navigate to `/submissions`
directly and see the page shell with an empty table. This is the existing, sitewide dashboard
pattern (nav-item gating is cosmetic everywhere, not a regression introduced here) — consistent
with [[feedback_dashboard_rbac]]'s "gate the page/form" via `useRole()` being about button-level
gating, not a route firewall. `Permission.MANAGE_TRIPS` confirmed present and spelled identically
in both `lib/config/rbac.ts` (dashboard) and `roles.config.ts` (backend).

**4. Other things checked, informational only:**
- Same TOCTOU shape as `update()`'s rename path: the `dest`/`tourClash`/`registryTaken` checks run
  outside the `$transaction`, using `this.prisma` not `tx` (lines ~3407-3421). Two admins
  concurrently approving two different tours whose derived slugs collide could both pass the
  outside-tx check before either commits; the second transaction's `slugRegistry.updateMany` would
  then hit the `(destinationSlug, slug)` unique constraint. Not caught (no P2002 handling on this
  transaction, nor on `update()`'s equivalent) — bubbles to `AllExceptionsFilter`
  (`common/filters/http-exception.filter.ts`) as a generic 500, no schema/stack leak to the client.
  Admin-mediated concurrency only; same accepted-pattern class as
  [[project_category_subcategory_reattach_security]]'s P2002 note. Not a regression, not blocking.
- `CreateTourDto`/`UpdateTourDto` `name` is `@MaxLength(120)` (both), so the derived slug's length
  is bounded — no unbounded-slug DoS surface.
- `ApproveTourDto.note` unchanged, validated (`@IsOptional @IsString @MaxLength(1000)`).

**Why:** definitive record that #79's approval-time slug write is the 3rd tour-slug write path
(after `create()`/`update()`, per [[project_slug_ownership_it73_security]]) and is exactly as sound
— same sanitizer, same collision guard, same fail-open-to-old-slug design, same pre-existing TOCTOU
class the team already accepts elsewhere.
**How to apply:** future PRs adding a 4th tour-slug write path should reuse
`generateSlug`/`isSlugTaken`/`renameEntitySlug` and keep the collision check same-shape (query
`slugRegistry` without filtering by entity type, exclude only the tour's own id) — that's what makes
protected-slug takeover impossible. If a PR ever moves the collision check inside the
`$transaction`, that closes the long-standing TOCTOU class across all 3 (now 4) paths at once and is
worth calling out as a real hardening, not just parity.

**Re-verified 2026-08-15, pre-merge pass (FINAL diffs).** Backend branch grew a 2nd commit
(`71b32cf feat(tours): review loop leaves the admin list; FIFO-sortable queue`) since the first
review, adding `sortBy`/`sortDir` to `AdminToursQueryDto` (`tour.dto.ts` ~line 921) — both
`@IsIn(['updatedAt','submittedAt'])` / `@IsIn(['asc','desc'])`, consumed only as
`orderBy: { [sortBy]: sortDir }` (`tours.service.ts` ~2046). No arbitrary-column sort: the decorator
is the whitelist, `forbidNonWhitelisted: true` in `main.ts` rejects anything else with 400 before the
service ever sees it, and both enum values are real `Tour` columns. `MyToursQueryDto` (operator
`my-tours`) is a **separate class** with no `sortBy`/`sortDir`/`reviewLoop` fields — the operator
list can't be sort-manipulated via this DTO addition. Confirmed clean.

**Uncommitted at review time — coordination note, not a vulnerability:** a further `reviewLoop`
boolean (`AdminToursQueryDto`, `Transform` coercing `'true'/'false'` strings + `@IsBoolean()`) plus
the corresponding `tours.service.ts` `where.approvalStatus` branch were present in the backend
**working tree** but not yet committed on `approve-slug-79` — `git diff pixelvega/prod...HEAD`
misses them entirely; only `git diff` (no revision) shows them. The dashboard branch
(`submissions-queue-79`, already fully committed) already calls `useAdminTrips({ reviewLoop: true,
... })` for its "All" filter tab. If the backend PR merges without that trailing commit, `whitelist:
true` silently strips the unrecognized `reviewLoop` field (no error) and the "All" tab falls back to
the default `notIn: [PENDING, REJECTED]` filter — i.e. it would show **zero** rows instead of the
whole review loop. Fails closed (no data exposure), but is a functional break if the two repos merge
out of order. Confirm the `reviewLoop` commit is staged before merging either PR standalone.

**Dashboard `/submissions` page re-verified, same shape as before:** `reviewHref = (id) =>
\`/trips/${id}/edit?step=review\`` — `id` is a backend-issued UUID from `TripListItem.id`, not
free text, and even if it weren't, the literal `/trips/` prefix makes a `javascript:`-scheme
injection impossible through a `next/link` `href`. No `dangerouslySetInnerHTML` anywhere in
`components/submissions/submissions-queue-view.tsx`, `app/(app)/submissions/page.tsx`, or the
touched `trip-columns.tsx`/`trips-table.tsx` — tour name/slug/operator fields render as plain JSX
children (React-escaped). `SubmissionsBadge` (`components/shell/nav-main.tsx`) calls the same
`/tours/admin/all` endpoint and only mounts for sessions whose `filteredNav` already passed the
`MANAGE_TRIPS` permission check (`app-sidebar.tsx` `navGroupsForRole`) — a non-admin session never
fires that query from the sidebar. The wording-sweep files (`trips/loading.tsx`, `trips/page.tsx`,
`tour-filter-popover.tsx`, `trip-columns.tsx` header label, `statistics.tsx`, `trip-detail-shell.tsx`,
`trip-wizard.tsx`, `types/trip.ts`) are pure copy/type-only changes — no logic. `trips-table.tsx`
(43 lines) is a real logic change but UI-only: it removes the PENDING/REJECTED options from the
Tours-list status filter (now that axis lives on `/submissions`) and always clears
`approvalStatus: undefined` on selection — consistent with the backend's default exclusion, no
security effect.
