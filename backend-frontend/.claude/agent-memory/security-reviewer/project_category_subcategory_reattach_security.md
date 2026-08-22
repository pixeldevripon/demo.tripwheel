---
name: project_category_subcategory_reattach_security
description: Security review of the subcategory-reattach branch (category demote/promote via confirmPageRemoval) — one confirmed Medium finding, everything else clean
metadata:
  type: project
---

Reviewed 2026-08-13 on branch `subcategory-reattach` in both `island-tour-development` and
`tripwheel-x-islandtours-dashboard` (uncommitted working-tree diffs). Feature: top-level
categories can now be demoted into sub-categories (`PATCH /categories/:id` with
`parentCategoryId` + `confirmPageRemoval: true`), previously hard-blocked.

**Confirmed finding (Medium, still open as of this review):** promotion (Detach) can crash with
an unhandled Prisma P2002 if the category's own freed slug was legitimately reclaimed by a
DIFFERENT entity after the 90-day cooldown elapsed. `backend/src/categories/categories.service.ts`
reactivate-own-ghosts step (`updateMany where entityType=CATEGORY && entityId=id`) is correctly
scoped and can never touch another entity's row — so this is a same-transaction collision/clean
rollback, NOT a silent hijack or data corruption. But the subsequent
`tx.slugRegistry.createMany({...missing...})` (no `skipDuplicates`, no `.catch`) throws raw when a
`missing` destination's `(destinationSlug, slug)` is now live-owned by someone else (the DB's
`@@unique([destinationSlug, slug])` in `slug-registry.prisma` spans ALL entity types, by design —
categories/hubs/collections/tours share one namespace per destination). `AllExceptionsFilter`
(`backend/src/common/filters/http-exception.filter.ts`) does return a generic "Internal server
error" for non-HttpException throws, so there's no info leak — but the admin gets an opaque 500
with no path to resolve other than manually renaming the category first. Fix: catch P2002 on that
createMany and throw a `ConflictException` naming the colliding destination(s). This pattern
(reactivate-then-createMany after a soft-delete cooldown) is reusable for hubs/collections/tours if
they ever grow an equivalent demote/promote flow — check for the same gap there.

**Confirmed clean:**
- `EDIT_CATEGORY` (gates the whole PATCH, including demotion) is granted identically to ADMIN and
  EDITOR in `roles.config.ts` — same as the pre-existing `DELETE_CATEGORY`/`CREATE_CATEGORY` on
  those same two roles. Demotion does NOT introduce a new privilege gap: EDITOR already had
  equivalent destructive power via the existing `DELETE /categories/:id`. EDITOR role is
  "not launch-active" per CLAUDE.md.
- Seeded-category demotion is blocked by `ForbiddenException` BEFORE the `confirmPageRemoval` check
  is reached — the flag cannot bypass the seeded protection.
- DTO whitelist hygiene clean: `confirmPageRemoval` is `@IsOptional() @IsBoolean()`;
  `parentCategoryId?: string | null` relies on class-validator's `@IsOptional()` short-circuiting on
  `null` (standard, correct behavior) — global `ValidationPipe` whitelist/forbidNonWhitelisted still
  applies, nothing new leaks through.
- Dashboard (`components/categories/category-subcategories-manager.tsx`) preserves RBAC
  (`canEdit`/`canCreate` via `useRole().can(...)`), and all interpolated category names
  (toasts, `ConfirmDialog` title/description) go through plain JSX text nodes / shadcn
  `AlertDialogTitle`/`AlertDialogDescription` — no `dangerouslySetInnerHTML` anywhere in
  `confirm-dialog.tsx`, so no injection sink even from an attacker-chosen category name.
- Mass-destruction-via-confirm-flag question: not a new vector — same permission
  (`EDIT_CATEGORY`) already permits equivalent destruction via the existing DELETE endpoint, and no
  new throttle gap was introduced (global ThrottlerGuard unchanged, no route-level
  `@Throttle`/`@SkipThrottle` added or removed).

See also [[project_bootstrap_security]] for the `AllExceptionsFilter` baseline this finding builds on.
