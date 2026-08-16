---
name: live_edit_gate_round4_review
description: Round-4 review of the live-tour content gate (tour-pending-changes.service.ts + tours-children.service.ts) - confirmed isMachineTranslated data-loss bug in approve(), changedAreas() omits 2 of 5 list kinds, dashboard ListDiff blind to base-field-only changes
metadata:
  type: project
---

Reviewed 2026-08-15: backend commit fc8b66d (branch live-edit-gate-ux-80) + dashboard
commit 1aa9f6a (branch live-edit-gate-ux-80), the "UX round 4" pass that generalized the
live-tour content gate (client review #19) to the 5 itemized list kinds (highlights /
inclusions / exclusions / features / locations) via `LIST_CONFIG` in
`backend/src/tours/tour-pending-changes.service.ts`.

**Confirmed CRITICAL bug (still present as of this review):** `approve()`'s list-item
translation reconciliation (`tour-pending-changes.service.ts` ~line 1259-1272,
`trDelegate.upsert(...)`) sets `isMachineTranslated` in the `create` branch but NOT in the
`update` branch (`update: { ...fields, sourceHash: null }` - flag omitted). Compare: the
tour-level translation approve a few dozen lines earlier, and every direct/ungated
`upsertXTranslation` method in `tours-children.service.ts`, all set
`isMachineTranslated: false` in both create AND update ("Human write path - reset the AI
bookkeeping"). Concrete failure: operator edits a list item's non-EN locale (previously
machine-translated, `isMachineTranslated=true`) on a LIVE tour -> staged with
`isMachineTranslated:false` -> admin approves -> DB row keeps `isMachineTranslated=true`
(stale) -> `approve()` itself enqueues `contentTranslation.enqueue()` since a list was
touched -> the AI refresh job's human-row guard
(`content-translation.service.ts:160`, `if (existing && !existing.isMachineTranslated && !force)`)
does NOT skip this row because the flag is still `true` -> the just-approved human edit is
silently overwritten by a fresh machine translation. Zero test coverage for this path (no
`describe('staged lists')` / approve-list-reconciliation test exists in
`tour-pending-changes.service.spec.ts` at all).

**Confirmed MAJOR bug:** `changedAreas()` (same file, ~line 251-261) loops over only
`['highlights', 'inclusions', 'exclusions'] as const` - omits `'features'` and `'locations'`
even though `StagedListKind` has 5 members and `LIST_CONFIG` covers all 5. Effect: a staged
change touching ONLY features ("Info & terms") or ONLY locations ("Itinerary") never appears
in `changedAreas`, so no chip shows in the operator banner, operator Submissions queue, or
admin review queue - even though the dashboard's `lib/trips/pending-change-labels.ts`
`PENDING_AREA_LABELS` map explicitly defines labels for all 5 kinds (dashboard side is
correct/ready; backend just never emits those 2). Does NOT affect `hasAnyList()`/
`isEmptyPayload()` (separately correct) or the actual diff content (dashboard's `ListDiff`
reads `payload.lists`/`current.lists` directly, not `changedAreas`) - impact is confined to
the chip/label metadata.

**Confirmed MAJOR bug (dashboard):** `ListDiff` in
`components/trips/wizard/steps/pending-change-diff.tsx` (~line 259-269, dashboard repo)
computes `changed` as `item.isNew || !showCurrent || liveText !== text` where `text`/
`liveText` come only from `enTextOf()` (EN text/label/title). Any base-field-only staged
change - a reorder (`displayOrder`), an icon/imageUrl swap, an exclusion `type`/`priceText`
change, a location geo/address field change - is invisible: the item gets `changed:false`,
gets filtered out, and if that's the only item affected the whole section returns `null`
(no header renders at all). Since `showCurrent = isPlatform || !!change.current` is true in
the overwhelming majority of real views (both admin and operator, since `current` is almost
always populated), this isn't a rare edge case. Net effect: reviewer sees a "changed" chip
(for the 3 kinds `changedAreas` covers) but an empty/absent diff section when they open it -
backend's `listEquals` correctly compares `baseFields` too, so the data is genuinely staged;
only the dashboard's diff rendering is blind to it.

**Round-3 findings re-verified as correctly fixed in fc8b66d:** (1) cross-step held-title
loss - GET-side overlay in `tours.service.ts` (~line 2274-2293) + dashboard
`tripToUpdatePayload` dropping `name` (only `step-basics.tsx` re-adds `name: values.name`
explicitly after spreading) together close the loop; verified none of the other 5 callers
(`trip-advanced-section.tsx`, `step-reach.tsx`, `step-schedule.tsx`, `step-rules.tsx`,
`step-location.tsx`) re-add `name`. (2) `listForOperator` take-window truncation - now
filters `status: {not: APPROVED}` in the query plus a `groupBy` supersedence check
comparing `submittedAt` ordering; logic traced and sound. (3) prune write-on-read race -
`deleteMany`/`updateMany` guarded on `{id, updatedAt: row.updatedAt}`, `.count===0` falls
back to serving the stale-but-safe unpruned row. No test asserts `tripToUpdatePayload`
omits `name` specifically (coverage gap, not a live bug).

**Operational note:** at review time, this exact file
(`backend/src/tours/tour-pending-changes.service.ts` + its spec, and dashboard
`types/trip.ts` + `reject-changes-dialog.tsx`) had UNCOMMITTED changes on top of the
reviewed commits, introducing an in-progress `payload.meta.fieldTimes` per-unit-timestamp
feature (not requested in this review). This caused 3 backend jest failures that are
artifacts of that concurrent WIP, not defects in the reviewed commit - confirmed by diffing
`HEAD` vs working tree and matching the failing assertions to the exact WIP hunks. See
[[feedback_multi_session_git_traps]] in the user's global memory for the standing pattern of
concurrent sessions editing the same checkout.

Verified FINE (no defects) on hard-verify checklist: Prisma compound-key names
(`${trFk}_locale` matches Prisma's auto-generated `highlightId_locale` etc. - confirmed via
schema, no `@@unique(name:...)` override); staged-item `id` is always server-generated
`randomUUID()`, no client-injection path; exclusion `type` is `@IsEnum(ExclusionType)`-
validated before it ever reaches the stash; location `types: String[]` needs no enum
handling; `toListItemShape` correctly adds `tourId` to both gated and real list reads
(shape parity confirmed); `MAX_STAGED_LIST_ITEMS` correctly enforced only on add;
`UpdateTourFeatureDto` has no `text` field at all, so the universal update hook staging
`dto` as both base and translation patch cannot leak stray EN text.
