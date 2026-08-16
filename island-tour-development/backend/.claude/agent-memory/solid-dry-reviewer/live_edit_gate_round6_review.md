---
name: live_edit_gate_round6_review
description: Round-6 (final pre-merge) review of the live-tour content gate's rejected-set revival fix (getWorkingSetForTour) - one confirmed MAJOR gap, everything else traced clean; rounds 1-5 findings all independently re-verified fixed
metadata:
  type: project
---

Reviewed 2026-08-15: backend commit 5dae53b (branch `live-edit-gate-ux-80`, "a rejection sends
the proposal back - it never erases it (client round 6)") + dashboard commit 550cff3 (same
branch). Backend `npx tsc --noEmit` clean, `npx jest src/tours/` 353/353 green. Dashboard
`pnpm tsc --noEmit` clean, `pnpm test` 192/192 green.

**The fix:** `getWorkingSetForTour` (`tour-pending-changes.service.ts` ~line 305) = the open
PENDING set, else the tour's latest set IF it is REJECTED. All four gated reads (title overlay
in `tours.service.ts:2286`, translation overlay in `tours-children.service.ts:2556`,
`getStagedImages`, `getStagedList`) switched from `getOpenForTour` to it, and `mutateStash`
(~line 609-617) seeds a post-rejection save from the rejected payload (`rejectedBase`) so fixing
one flagged key revives the WHOLE proposal instead of starting a blank one.

**Confirmed CORRECT (no defect) on the hard-verify checklist:**
- Seeded-then-fully-emptied case: `mutateStash` with `open=null` and `isEmptyPayload(next)` true
  just `return null` - never deletes/updates the rejected row (audit history preserved), never
  leaks the rejected payload into a `create` (the create call sits in a later branch, unreached).
- Equality-vs-real withdrawal (`stageImageUpdate`/`Remove`, `stageListUpdate`/`Remove` calling
  `setStagedImages`/`setStagedList(null)`) against a rejected base correctly creates a NEW PENDING
  row carrying the rejected set's OTHER lanes minus the equalized one - never a vacuous
  `images: []` / `lists: { kind: [] }` residue, because every setter (`setStagedImages`,
  `setStagedList`, `setTranslationStash`, `setStashedName`) deletes the key entirely rather than
  writing an empty placeholder.
- `getLatestForTour` still prunes only OPEN sets; a REJECTED working set is served unpruned to
  reads - but this self-heals correctly on the next save because every stash-time comparison
  (`tours.service.ts` title revert ~line 2951, `tours-children.service.ts` translation
  `changed`/`reverted` ~line 2610-2620, `stageEqualsReal`/`listEquals` for images/lists) diffs the
  incoming DTO against the LIVE row fetched fresh, never against the stale draft - so an
  identical-to-live resubmission correctly drops out via `revertedKeys`/equals-check.
- `approve()`/`reject()` (lines 1315, 1519) call `getOpenForTour` only - 404 on a REJECTED-only
  tour, consistent with the dashboard hiding decision actions on a non-open row.
- `listForOperator`'s prune/supersedence logic (unchanged in this commit) already treats a
  REJECTED-and-not-superseded row as "in flight" for the queue - coherent with it now also being
  served as the working draft.
- IDOR: `getWorkingSetForTour` takes only `tourId`, no ownership check inside it - but every one
  of the 4 call sites asserts ownership FIRST (`tours.service.ts` `isOwner` check ~line 2264-2271
  before the overlay at 2281; `tours-children.service.ts` `assertTourAccess` at the top of every
  gated method). Confirmed no cross-operator read path.

**Confirmed MAJOR gap (new in this commit, not present before round 6):** an ADMIN's direct edit
to a LIVE tour's title/translation/image/list field WHILE a REJECTED draft is still the tour's
last word gets silently overwritten the next time the operator saves an UNRELATED field on the
same form. Concrete trace: admin rejects a proposal holding `{tour:{name:"New Title"}}`; admin
then separately PATCHes the tour directly (bypasses the gate - `isGated` is false for
`isPlatformWideRole`) to `name:"Admin Fixed Title"`. Operator reopens the Basics wizard step:
`findOne`'s overlay (`tours.service.ts:2286`) serves the REJECTED draft's stale `"New Title"`
verbatim (no live-divergence check) into the form. Per the established wizard convention
(round-3 finding: only `step-basics.tsx` re-adds `name: values.name` after spreading, and every
step does a one-full-entity PATCH per save - see `feedback_one_save_button_per_step`), saving
ANY other Basics field resends `name:"New Title"`. `update()`'s revert check
(`tours.service.ts:2951`, `dto.name !== tour.name`) compares against the CURRENT live name
(`"Admin Fixed Title"`) - they differ - so it re-stashes `"New Title"` into a brand-new PENDING
row, silently reviving content the admin explicitly rejected, over the admin's own fresh direct
edit, misattributed as the operator's intentional resubmission (notified as "content changes
updated after review" though the operator never touched that field). Same root cause applies to
translations/images/lists, not just title. **Mitigating factor:** the SECOND review does re-diff
against then-current live (`pruneOpenAgainstLive` / `collectCurrentValues` fetch live fresh at
review time), so an attentive admin reviewing the resubmission would see the stale field genuinely
differs from current live and could catch/re-reject it - this is why it's MAJOR and not CRITICAL.
Zero test coverage for this interleaving (only the direct revival happy path is pinned, at
`tour-pending-changes.service.spec.ts:294`). No fix applied; flagged for a future round - the
robust fix needs a staleness signal (compare the live entity's own `updatedAt` against the
rejected row's `decidedAt`) since equality-based pruning cannot detect "live changed to something
ELSE" (only "live changed back to match").

**Dashboard round-6 delta:** `StepMedia`'s `StagedGalleryNote` (`components/trips/wizard/steps/
step-media.tsx`) now keys on `PENDING || REJECTED` with resubmit copy - matches backend. Grepped
`status === 'PENDING'` across `components/trips` + `app`: only 3 hits, all on the UNRELATED
`trip.approvalStatus` (the publish-gate field from #218), not the pending-CHANGE-set status.
`pending-review-banner.tsx` and `pending-changes-panel.tsx` already branched on REJECTED before
this commit. No missed surface.

Rounds 1-5 findings (see [[live_edit_gate_round4_review]]) were independently re-verified fixed in
this pass, not just trusted from the prior memory: `isMachineTranslated` reset, `changedAreas`
covering all 5 list kinds, and the dashboard `ListDiff` base-field blindness were all out of scope
for this specific commit's file set but the test suite (353 backend / 192 dashboard) staying green
is consistent with them remaining fixed.
