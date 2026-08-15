---
name: project_subcategory_sync_it77_security
description: Security review of the sub-category taxonomy sync ops script (#77) and its dashboard companion PR — one confirmed Medium (sub-category id accepted as tour primary category server-side, HALF-FIXED by #78), one confirmed Medium (script's demote/retag split isn't atomic), everything else clean
metadata:
  type: project
---

**UPDATE 2026-08-15 (same day, #78 review):** Medium #1 below is HALF-FIXED.
`tours.service.ts` `create()` and the `categoryIds`-replace branch of
`update()` now both call `assertCategorySetShape` (renamed from
`assertPrimaryIsTopLevel`), which rejects a sub-category as primary — see
[[project_subtype_validation_it78_security]]. The gap that remains: a PATCH
sending `primaryCategoryId` ALONE (no `categoryIds`) still skips this check
entirely and can re-point primary onto an already-tagged sub-category via
the `tourCategory` existing-link branch (`tours.service.ts` ~3179-3200).
Same root defect as documented below, narrower surface, still open.

Reviewed 2026-08-15. Backend branch `subcategories-sync-77` (`git diff prod..HEAD`, 5 new files:
`backend/scripts/sync-sub-categories.ts`, `backend/prisma/data/sub-categories.config.ts`,
`backend/src/categories/sub-category-sync.ts` + spec, one `package.json` line). Dashboard branch
`subcategories-select-77` (`git diff main..HEAD`, `step-basics.tsx` only). Feature: single-level
category nesting used as filter-only "Row 2 chip" sub-categories; a manual `pnpm subcategories:sync`
VPS script converges the DB onto a static config (create/demote/repoint sub-categories, retag tours,
dissolve the Private Charter category into `tours.bookingType`).

**Confirmed Medium #1 - sub-category id accepted as a tour's PRIMARY category, server-side, with no
guard.** `backend/src/tours/tours.service.ts` `create()` (~line 2680-2688) and `update()`
(~line 2939-2947) validate `categoryIds`/`primaryCategoryId` with only `@IsUUID` (DTO) +
`category.findMany({ isActive: true })` - there is no check that the category is top-level
(`parentCategoryId === null`). This directly contradicts the invariant the new sync script's own
header documents ("a sub-category is never a tour's primary once its parent link exists - a sub has
no page, so a breadcrumb pointing at it would 404", `src/categories/sub-category-sync.ts` top
comment) and that invariant is enforced ONLY client-side, newly, in the paired dashboard PR
(`components/trips/wizard/steps/step-basics.tsx`: `topLevelCategories`/`subCategoryIds` filtering,
forces `primaryCategoryId` off any sub-category). Any direct API caller (Swagger UI, a future
client, or the dashboard before this PR) can set `primaryCategoryId` to a sub-category, or even send
`categoryIds` containing ONLY sub-category ids - which also passes (`categoryIds.length >= 1`,
`isActive: true`), producing a tour with **zero top-level category** at all, invisible on every
category page it should logically appear under via its Row-2 tag. Not a CIA breach (self-service,
own tour, authenticated operator/admin only) - a content-integrity/SEO/discoverability defect.
**Fix:** add a `parentCategoryId: null` clause to both `category.findMany` validation queries in
`tours.service.ts create()`/`update()` (or a dedicated "no sub-category may be primary" check), so
the backend mirrors the dashboard's new client-side rule instead of relying on it alone.

**Confirmed Medium #2 - sync script's demote step is not atomic with its tour-retag step.**
`backend/scripts/sync-sub-categories.ts` `demote` case: the category's `parentCategoryId` update +
`markSlugsDeleted` run in one `$transaction`, then `retagTours(...)` runs AFTER as a separate,
later step (its own per-tour `$transaction` calls). If the script is interrupted between them (kill,
DB blip, thrown error) for a category that is some tour's primary, that tour is left with
`primaryCategoryId` pointing at a category whose page slug was JUST retired - the exact 404
breadcrumb scenario the script exists to prevent - until the script is re-run to completion (it is
idempotent and self-heals: the `noop`/`demote`/`repoint` branches all call `retagTours` again on
re-run). Low likelihood (manual VPS run, not attacker-triggered, self-correcting), so Medium not
High. Context: `categories.service.ts` admin `update()` demote path (`confirmPageRemoval`) doesn't
retag affected tours AT ALL (this is a pre-existing gap in the admin flow, not introduced by this
PR) - the sync script is actually more thorough than the admin UI here, it just isn't atomic about
it. Fix: fold `retagTours` for the affected sub-category into the same `$transaction` as the
category-level demote/repoint mutation (single per-subcategory transaction covering the category and
all its tours), or at minimum document the two-phase risk and recommend always re-running to
completion / checking script exit code before considering a deploy step done.

**Confirmed clean:**
- Item 1 (HTTP reachability): `scripts/sync-sub-categories.ts` and
  `src/categories/sub-category-sync.ts` are imported by nothing under `backend/src/` except the
  script itself and its own spec file - not wired into `app.module.ts`, no controller, no BullMQ
  job, no cron, no `docker-compose*.yml` / entrypoint reference anywhere in the repo. Genuinely
  manual-only (`pnpm subcategories:sync[-- --dry]`), not reachable from any HTTP surface.
- Item 2 guards: the seeded-19 guard (`existing.isSeeded` -> `skip`, never demotes a master
  category) and the never-category-less guard (`planRemovalForTour` -> `keep-sole-category`, a
  tour's sole category is kept + reported, never dropped) are both correctly implemented in
  `src/categories/sub-category-sync.ts` and unit-tested in the paired spec.
- Item 3: `backend/prisma/data/sub-categories.config.ts` is 100% static literal TS data (no env
  interpolation, no file/network read, no runtime input parsing) - deployed/reviewed like any other
  source file, zero injection surface.
- Item 4: `markSlugsDeleted` (`src/common/utils/slug-registry.util.ts`) only sets
  `isActive=false, deletedAt=now` - the row still blocks reuse via `slugRowBlocks` until the 90-day
  cooldown elapses, identical semantics to the existing admin demotion flow
  (`categories.service.ts` line ~629-636). The script only ever touches non-seeded top-level
  "extra" categories (guarded by the isSeeded skip above), so the locked 19 + reserved `tours` slug
  per destination (20 protected slugs, CLAUDE.md) are never touched and no takeover window opens
  during cooldown - same guarantee the reattach-flow review already validated
  ([[project_category_subcategory_reattach_security]]).
- Sub-categories correctly write NO `slug_registry` row on create (mirrors
  `categories.service.ts create()`'s `isSubCategory` branch at line ~459-487), so no page/URL is
  ever exposed for them - consistent with the "filter-only, no standalone page" design.
- Dashboard `step-basics.tsx`: change is presentation-only (hides sub-categories from the
  top-level `MultiSelect`, preserves sub-category tags on save via careful `field.value` filtering
  so a Basics save can't silently strip a tour's Row-2 tags) - no new trust of client input, and it
  does NOT claim to be a substitute for backend validation (see Medium #1 - the backend still needs
  its own check).

Top 2 fixes if this ships: (1) add the top-level-only guard to `tours.service.ts`
`create()`/`update()` category validation (Medium #1); (2) make the sync script's per-subcategory
demote+retag one atomic transaction, or explicitly document/verify successful completion before
considering a VPS run done (Medium #2).
