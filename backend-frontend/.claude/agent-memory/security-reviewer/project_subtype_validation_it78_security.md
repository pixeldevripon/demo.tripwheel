---
name: project_subtype_validation_it78_security
description: Sub-type parent-validation security review (#78) — assertCategorySetShape wiring clean; #77's Medium #1 (sub as primary) is HALF-FIXED, one branch still open
type: project
---

Reviewed 2026-08-15: backend `subtypes-78` (assertCategorySetShape adds an
orphan-sub check to the renamed assertPrimaryIsTopLevel) + dashboard
`subtypes-select-78` (sub-type checkbox picker in step-basics.tsx).

Context: this PR closes most of [[project_subcategory_sync_it77_security]]'s
confirmed Medium #1 ("sub-category id accepted as tour primaryCategoryId
server-side, no top-level check") by renaming `assertPrimaryIsTopLevel` to
`assertCategorySetShape` and wiring it into both `create()` and the
`categoryIds`-replace branch of `update()`. One branch was missed — see
below.

**Clean, confirmed:**
- Both tour write paths (`create()` tours.service.ts:2680-2694 and `update()`
  with a `categoryIds` replace, tours.service.ts:2945-2955) fetch categories
  fresh from the DB by id (`isActive: true` filter) and call
  `assertCategorySetShape` before any write. No spoofable parent data.
- Category nesting is structurally capped at one level — `assertValidParent`
  (categories.service.ts:390-412) rejects a parent that itself has a parent;
  demote-to-sub blocks if `childCount > 0` (categories.service.ts:520-529).
  So the orphan check in tours.service.ts only ever sees a flat 2-level
  graph — no cycle/deep-chain input is reachable.
- [[project_subcategory_sync_it77_security]]'s ops script
  (sub-category-sync.ts `planTourRetag`, line ~121-132) already adds the
  parent link on demote, so it doesn't orphan tags either. Still HTTP-
  unreachable, ops-run only.
- Dashboard step-basics.tsx sub-type picker only toggles ids that are
  already members of the fetched `categories` list (parentBySubId /
  subTypeGroups both derived by filter/map over it) — no new client trust,
  server re-validates from DB on every save regardless.

**Confirmed finding — known issue (#77's Medium #1), only PARTIALLY closed
by this PR, still open as of this review:**
`tours.service.ts` `update()` — when a PATCH sends `primaryCategoryId` alone
(no `categoryIds` in the body), the entire `assertCategorySetShape` block is
skipped (gated on `dto.categoryIds !== undefined` at line ~2935). The
fallback re-point branch (lines ~3179-3200, `else if (dto.primaryCategoryId
!== undefined)`) only checks the requested id is *some* existing
`tourCategory` link for the tour — never that it's top-level. `UpdateTourDto`
(tour.dto.ts:1354-1357) allows `primaryCategoryId` fully independent of
`categoryIds`, and the comment there documents this as intentional
("re-point the primary among existing categories"). Reachable by any
`TOUR_OPERATOR` on their own tour via `PATCH /tours/:id
{ primaryCategoryId: <subCategoryId already tagged non-primary> } }` —
reproduces the exact breadcrumb-404 bug client review #16/#17 exists to
prevent, just through the second branch instead of the first. Does NOT let
an operator introduce a *new* orphan (categoryIds membership untouched by
this branch), so the #78 orphan rule itself isn't bypassed — only its
sibling top-level-primary rule.

**Why**: `assertCategorySetShape` (née `assertPrimaryIsTopLevel`) is only
wired into the `categoryIds`-replace path; the DTO's independent
`primaryCategoryId`-only re-point path predates it and was never folded in.

**How to apply**: if picking this back up, fix by fetching
`{ category: { select: { parentCategoryId: true } } }` in the existing-link
lookup at line ~3180 and rejecting a non-null `parentCategoryId` with the
same message `assertCategorySetShape` uses. Low effort, single branch.
