---
name: operator-conditions-wave3-review
description: Wave-3 review of the operator-conditions DOCUMENT feature (Pastel #80) - cross-tour termsDocument clobber race (MAJOR, unfixed), dashboard isSaving omission in TourWorkspace (MAJOR, unfixed), 3rd copy of the 2-6 ack-facts bound check (MINOR DRY), flattenCounts fragility
metadata:
  type: project
---

Reviewed 2026-08-16: backend commit 26e82ed4 (branch `operator-conditions-220`) + dashboard commit
caf310f (same branch) - the wave that lets an operator author the DOCUMENT flavor's actual text via
the wizard's reused pages `RichTextEditor`, and adds the Translation Console's per-locale entry
(`PUT /tours/:id/operator-terms/translation/:locale`). Backend `npx tsc --noEmit` clean, `npx jest
src/tours/` 378/378 green. Dashboard `npx tsc --noEmit` clean, `npx vitest run` 198/198 green.

**Confirmed MAJOR (backend, unfixed) - cross-tour termsDocument clobber, no optimistic concurrency:**
`termsDocument` lives on the OPERATOR row (one per operator, shared by ALL its tours), but is staged
per-TOUR inside that tour's `TourPendingChange.payload.conditions.document` - the first cross-entity
write this gate has ever done (`kind`/`acknowledgmentItems` are plain per-tour columns; no prior
wave shared state across tours). `approve()` (`tour-pending-changes.service.ts` ~1449-1474, inside
the `$transaction`) reads the operator's CURRENT `termsDocument`, and if it differs from the staged
snapshot, blind-overwrites it (`tx.operator.update({data:{termsDocument: payload.conditions.document,
...}})`) - no compare-and-swap against what the document was AT STASH TIME (contrast:
`pruneOpenAgainstLive`'s own `updatedAt`-scoped `deleteMany`/`updateMany` CAS pattern, used
elsewhere in the SAME file for the pending-change row itself). Concrete failure: operator has tours
T1 and T2, both LIVE, both DOCUMENT-flavored (so both read/write the SAME operator.termsDocument).
Operator edits T1's EN text -> staged (held, LIVE tour). Before admin approves T1, operator also
edits T2's EN text -> staged against the STILL-original doc. Admin approves T1 (doc -> v2, version
bumped). Admin approves T2 second: compares its stale-based staged text against the NOW-v2 live
doc, sees a diff, overwrites v2 with T2's v1-based text, bumps the version AGAIN even though nothing
new was authored - silently reverting the just-approved T1 edit. Mitigating factor (same shape as
the round-6 admin-bypass finding, see [[live_edit_gate_round4_review]]/[[live_edit_gate_round6_review]]):
the SECOND review's diff is collected fresh at review time (`collectCurrentValues`/
`pruneOpenAgainstLive` call `loadLiveConditions` live), so an attentive admin reviewing T2 would see
"current" already reflects T1's v2 text and could catch the collision - this is why it is MAJOR, not
CRITICAL. No test covers two tours under the same operator both staging DOCUMENT changes
concurrently. No fix applied - flagged for a future round.

**Confirmed MAJOR (dashboard, unfixed) - `isSaving` omits the new mutation:**
`components/translations/workspace/tour-workspace.tsx` lines 324-331 - `isSaving` is the OR of every
mutation hook's `.isPending` (`upsertCore`, `upsertHighlight/Inclusion/Exclusion/Feature/Location/
Pickup`) and gates the Save button (`workspace-shell.tsx:212`, `disabled={isSaving || !isDirty}`,
label "Saving..." at :213). The new `upsertConditions = useUpsertOperatorTermsTranslation()` (line 93)
is pushed into the SAME `jobs` array run via `Promise.allSettled` inside `handleSave` (so the
success/failure TOAST correctly waits for it) but was never added to the `isSaving` OR-chain. When
the conditions card is the ONLY dirty section (no sub-entity or core-field edit), `upsertCore`
resolves and none of the sub-entity `.isPending` flags ever go true, so `isSaving` flips back to
`false` - and the button re-enables with "Save all" - WHILE the conditions PUT is still in flight
inside `Promise.allSettled`. A user can double-click and fire a second concurrent `handleSave()`
(idempotent per-locale upsert, so not data-corrupting, but defeats the single-flight guarantee the
disable is there for). Fix: add `|| upsertConditions.isPending` to the `isSaving` definition. No
test file exists for `tour-workspace.tsx` at all (pre-existing gap, not new to this commit) - this
is why it wasn't caught.

**Confirmed MINOR (backend DRY) - 3rd copy of the ack-facts bound check:** `tours.service.ts` already
had the "2 to 6 participation facts" bound check + message TWICE pre-existing (`resolveDesiredConditions`
~3597 and ~3611, one full check + one lower-bound-only recheck). This commit's NEW
`upsertOperatorTermsTranslation` (~3705-3708) adds a THIRD copy of the identical `cleaned.length < 2
|| cleaned.length > 6` + `'The confirm-list needs 2 to 6 participation facts'` message, with no
shared constant/helper. Also: the "spread existing locale map, set-or-delete one locale key,
null-if-empty" shape is duplicated 4x total across `resolveDesiredConditions` (EN branches for
ack-items and document) and `upsertOperatorTermsTranslation` (translation branches for the same
two) - worth a shared private helper (e.g. `mergeLocaleMap<T>(existing, locale, value)`) if this
gate grows a third content type. Not blocking - each duplication is ~5-8 lines and the EN/non-EN
validation genuinely differs (EN can never clear to empty; translations can).

**Verified FINE / no defect on hard-verify checklist:**
- `approve()`'s document write + tour-row update are both inside the SAME `$transaction` callback -
  no partial-apply risk within a single approval.
- `enChanged` version-bump condition (`stagedEn !== current.en`) is correct; translation-only merges
  (via the Console) correctly never touch `termsVersion`/`termsEffectiveDate` since that endpoint
  400s on `locale === 'en'`.
- `findOne`'s destructure-before-`flattenCounts` fix (`tours.service.ts` ~2280-2283) is correctly
  scoped: grepped ALL 3 callers of `flattenCounts` (`findAllAdmin`, `findMyTours`, `findOne`) - the
  two list queries already select the full `{id, companyInfo, user}` operator shape `flattenCounts`
  expects, and the separate `findBySlug` (public detail page) never calls `flattenCounts` at all (its
  own bespoke destructure/flatten path already handles its own distinct operator select shape
  correctly). No other current caller can hit the same crash. BUT `flattenCounts` itself is still
  fragile-by-convention: it unconditionally does `operator.user.name`/`operator.companyInfo?.
  companyName` whenever `operator !== undefined`, so any FUTURE caller that forgets the
  destructure-before-call incantation reintroduces the exact same 500. Worth hardening
  `flattenCounts` itself (guard on `operator?.user` before building `operatorInfo`) rather than
  relying on every call site remembering the order - this is a suggestion, not a currently-live bug.
- Pages reuse is genuinely import-only: `sanitizePageHtml` (`@/common/utils/page-html.util`) and the
  dashboard's `components/pages/rich-text-editor.tsx` both appear ONLY as new imports in this diff;
  neither file itself was touched. Zero behavioral drift risk to the Pages feature.
- Public `OperatorConditionsBody` switching from a bespoke Tailwind class list to `.it-page-prose` is
  a clean DRY win - reuses the same class `legal-page-shell.tsx` already uses for page bodies.
- `tripToUpdatePayload` (dashboard) correctly and deliberately omits `operatorTermsKind`/
  `acknowledgmentItems`/`operatorTermsDocument` (same convention as the pre-existing `name` omission,
  see [[live_edit_gate_round4_review]]) - `step-rules.tsx` is the sole owner/sender, consistent with
  the one-save-button-per-step contract.
- The Translation Console's DOCUMENT card diffs `before`/`now` against the LIVE `trip.
  operatorTermsDocument[locale]` (not a staged/pending value) - this exactly matches the PRE-EXISTING
  sub-entity diffing convention in the same file (`item.existing[f.name]`, also live-sourced), so it
  is not a new inconsistency even though platform-role Console users never get the owner-only
  pending-change overlay (`isOwner` requires `Role.TOUR_OPERATOR`, which Console users normally are
  not).
- DOCUMENT card has no AI-translate affordance (unlike every other field in this console, which gets
  either a per-field `aiFillFor` or a card-level `SectionAiTranslateButton`) - plausibly deliberate
  (naively AI-translating TipTap HTML risks mangling markup) rather than an oversight, since
  `RichTextEditor` is the FIRST HTML-bearing field this console has ever had to translate - flagged
  as a minor UX gap, not a defect.
