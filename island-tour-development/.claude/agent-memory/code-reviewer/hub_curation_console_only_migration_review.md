---
name: hub_curation_console_only_migration_review
description: Cross-repo review of hub Curation tab going English-only (Our Picks/comparison/content sections) with translation ownership moved to the Translation Console - 2026-07-28
metadata:
  type: project
---

Reviewed the uncommitted dashboard change that made `hub-our-picks-manager.tsx`,
`hub-comparison-manager.tsx`, `hub-content-sections-manager.tsx` English-only (move
up/down arrows replace manual displayOrder inputs; non-English fields round-tripped
untouched) plus the new `components/common/locale-completeness.tsx` and three new
`HubWorkspace` `extraSections` in `entity-workspaces.tsx` (Our Picks rationales,
comparison table, page sections) backed by four new per-item upsert hooks in
`hooks/hubs/use-hubs.ts` / `lib/api/hubs.ts` / `types/hub.ts`.

**Backend's comparison flag-preservation bug is FIXED as of this session** -
supersedes [[hub_curation_ai_translation_cross_repo_review]]: `setComparison` in
`backend/src/hubs/hubs.service.ts` (~line 1449) now scopes `priorTourFlags`/
`priorGroupFlags` PER GROUP (matched by English `groupName`), with an explicit
comment explaining why a hub-wide map would collide. Do not cite the old "Critical
map-collision" finding as current state anymore.

**Real findings from this pass:**
1. Medium/latent: `HubWorkspace`'s page-sections extraSection reads
   `useHubContentSections(id)` unfiltered, so if a hub ever has `FAST_FACT` content-section
   rows, the Console will expose them for translation even though
   `hub-content-sections-manager.tsx`'s `MANAGED_TYPES` deliberately excludes `FAST_FACT`
   from the structural editor (comment: "intentionally excluded") and never exports
   `MANAGED_TYPES` for reuse. Currently dormant - no seed path creates `FAST_FACT` rows -
   but latent the moment one exists. Fix: export `MANAGED_TYPES` from the manager and
   filter `enBlocks` by it in `entity-workspaces.tsx`.
2. Minor/DRY: three different inline "count filled locales" computations across
   `hub-our-picks-manager.tsx`, `hub-comparison-manager.tsx` (tour standout - via
   `ALL_LOCALES.filter`) and comparison's group-name chip (`(groupName.trim()?1:0) +
   nameTranslations.length`, NOT going through the same filter pattern) - functionally
   equivalent given backend's `MinLength(1)` guarantee, but should be one shared helper
   taking `Record<string,string>` → count.
3. Minor/dead-state: `DraftPick.displayOrder`, `DraftGroup.displayOrder`,
   `DraftTour.displayOrder` are still seeded and incremented on add, but save now always
   uses array index instead - the field is write-only/unused at read time in all three
   managers. Doesn't show up in tsc/eslint (unused *properties* aren't flagged).
4. Minor/a11y: `hub-comparison-manager.tsx`'s per-tour-column remove button (icon-only,
   ~line 405-413) has no `aria-label`, while the move-up/move-down buttons added right
   next to it in this same diff do - a pre-existing gap (same in the pre-diff file) that
   now reads as inconsistent since its neighbors were fixed in this pass.

**Verified SAFE (no bug) - worth remembering so it isn't re-litigated:**
- Reordering picks/groups/tour-columns via the new move arrows cannot orphan
  AI-translation flags: backend identity keys are content-based
  (`${tourId}|${locale}|${description}` for picks, `groupName` text for groups,
  `${tourId}|${locale}|${standoutNote}` scoped per-group for tour columns) - never
  positional - so a reorder-only save preserves `isMachineTranslated`/`sourceHash`.
- Content-section block reordering *can* orphan translation flags (identity truly is
  `(sectionType, displayOrder)`, no FK) but this is 100% pre-existing behavior - the
  same `moveBlock`/`handleSave` code existed before this diff; not introduced by it.
- The comparison extraSection's rows use `group.id` for `fieldKey: 'groupName'` and
  `comparisonTour.id` for `fieldKey: 'standoutNote'` in the SAME flat array - looked
  like a possible itemId collision (different UUID spaces sharing one section) but
  `content-workspace.tsx`'s `xsKey(section, itemId, fieldKey)` always composites
  itemId+fieldKey for every lookup/dedup, so collision is structurally impossible.
- Renaming a group's/pick's English name/tour orphaning old non-English translations
  (backend's `keep()` won't match) is real but is PRE-EXISTING - the group-name Input
  was always editable in this manager, tourId-swap-keeps-stale-rationale was always
  possible too. Not introduced by the English-only migration.
- `filter(c => c.value)` silently dropping intentional-empty-string clears in all three
  new `extraSections.save()` callbacks matches the exact existing `CollectionWorkspace`
  rationale precedent in the same file - systemic project-wide UX gap (clearing a
  translation via the Console silently no-ops instead of deleting), not new here.
- `hubKeys.ourPicks(id)`/`comparisonEdit(id)`/`contentSections(id)` invalidations
  omitting `locale` (producing a trailing `undefined` in the key) matches the exact
  precedent already used by `useSetHubOurPicks`/`useSetHubComparison`/
  `useReplaceHubContentSections` - a systemic pre-existing cache-key subtlety across
  the whole `hooks/hubs/use-hubs.ts` file, not introduced by the four new hooks.

**How to apply:** if asked to fix any of the "Verified SAFE" items, they are NOT bugs
introduced by this hub-curation-console migration - treat as separate, project-wide
tickets if the user wants them addressed (silent-clear-drop and locale-less invalidation
both span collections too, not just hubs).
