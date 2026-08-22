---
name: hub_curation_ai_translation_review
description: Backend review findings for hub curation AI-translation coverage (Our Picks/comparison/content sections) - 2026-07-28
metadata:
  type: project
---

Reviewed `backend/src/content-translation/entity-registry.ts` (`collectHub` additions) and
`backend/src/hubs/hubs.service.ts` (`setOurPicks`/`setComparison`/`replaceContentSections` flag
preservation + `enqueue('hub', id)` hooks) for the feature extending AI translation to hub Curation
surfaces. Verified against the actual Prisma schema and DTOs, not assumed.

**Critical - cross-group/duplicate-name collision in `setComparison`'s flag-preservation maps**
(`hubs.service.ts` ~1438-1454, consumed at ~1486-1490 and ~1512-1516). `priorTourFlags` is built by
`priorGroups.flatMap((g) => g.comparisonTours.flatMap(...))` keyed by `tourId|locale|standoutNote`
with NO `groupId` in the key - but `HubComparisonTour` is only `@@unique([groupId, tourId])`, not
hub-wide, so the SAME tour can legitimately appear in two different comparison groups of one hub.
`priorGroupFlags` is keyed by `groupName|locale|groupName` and `groupName` has zero DB or DTO
uniqueness constraint (`ComparisonGroupInputDto.groupName` is just `@IsString()`). Both maps are
built via `new Map(array.flatMap(...))`, which silently keeps the LAST entry on a duplicate key.
Concrete failure: tour X compared in two groups with an identical (or coincidentally-matching)
translated `standoutNote` for locale=fr - one group's row is human-edited, the other machine - on
save both recreated rows get whichever flag survived the collision, so a human translation can be
mis-tagged `isMachineTranslated: true` and silently overwritten by a later refresh. No test covers
this (checked `hubs.service.spec.ts` - only single-group/single-tour happy path). Fix: scope
`tourFlags`/`groupFlags` construction PER matched prior group (e.g. `priorByGroupName = new
Map(priorGroups.map(g => [g.groupName, g]))`, then build each group's tour-flags map from just that
group's `comparisonTours` inside the `for (const group of dto.groups)` loop) instead of one
hub-wide flatten; also worth rejecting duplicate `groupName` in `dto.groups` outright at the service
layer rather than trying to disambiguate identical names.

**Major - `HubContentSection` translation-unit identity has no real key, unlike every other unit
type** (`entity-registry.ts` ~573-619, consumed by `content-translation.service.ts` line ~168
`payload[\`${unit.key}.${field}\`] = unit.source[field]`). The unit key is
`hubsection:${sectionType}:${displayOrder}` - a synthetic composite, not a DB row id. Every OTHER
unit in the registry (highlight/inclusion/exclusion/feature/location/pickup/ourpick/compgroup/
comptour/faq-group/section-group) keys off a real primary key or a real FK group column
(`sectionGroupId` on `PageContentSection`). `HubContentSection` has NO such FK and NO
`@@unique([hubId, locale, sectionType, displayOrder])` at the DB level - the OLD comment in
`content-translation.constants.ts` (removed by this diff) explicitly said sections were excluded
"on purpose (v1)" because there is "no group key, so per-row translation cannot work." This diff
works around that with a content-derived proxy key instead of adding a real key. If two EN rows
ever end up sharing (sectionType, displayOrder) for the same hub - no current write path in the
diff produces this under normal single-admin use, but nothing in the schema prevents it either -
`content-translation.service.ts`'s flat `payload` object (keyed by `unit.key.field` across ALL
pending units) would silently let one section's source overwrite the other's before the provider
call, writing the WRONG translated text into both blocks. Recommend adding the DB-level
`@@unique([hubId, locale, sectionType, displayOrder])` (or a real `blockId` column) so this is
enforced rather than merely assumed from frontend save-time order computation.

**Minor - headingless-type detection via content equality, not an explicit type list**
(`entity-registry.ts` line ~581: `const headingIsBody = section.heading === section.body`). The
dashboard already has the real truth table (`SECTION_TYPE_META[type].hasHeading` in
`hub-content-sections-manager.tsx`, false only for `EDITORIAL`/`HIGHLIGHT`). The backend infers the
same fact from data equality instead of declaring its own `HEADINGLESS_SECTION_TYPES` set keyed off
`HubSectionType.EDITORIAL`/`HIGHLIGHT`. Practically low-risk (heading/body text collision on a real
titled block is implausible) but it is duplicated/undeclared domain knowledge - flag if a new
section type is ever added.

**Verified safe**: `HubOurPick` flag preservation (`hubs.service.ts` ~1248-1277) keyed by
`tourId|locale|description` cannot collide within one hub because `HubOurPick` is
`@@unique([hubId, tourId])`. `replaceContentSections`'s own prior-flags map (~1156-1163) keyed by
full text content is the same "last-wins on duplicate key" Map pattern but is lower-stakes (only
affects flag continuity, not payload content). Gap-fill semantics (`if (!field) return;` guards
before `upsert`) on the new ourpick/compgroup/comptour units correctly follow the established
single-field-unit convention (same as `highlight`/`inclusion`/`feature`) - no bug there.

**How to apply:** any future hub-comparison or hub-content-section work should check whether the
`setComparison` map-scoping fix or the `HubContentSection` unique constraint has since landed before
assuming the collision risk is closed.
