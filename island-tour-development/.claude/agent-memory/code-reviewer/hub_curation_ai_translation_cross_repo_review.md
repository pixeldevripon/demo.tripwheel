---
name: hub_curation_ai_translation_cross_repo_review
description: Cross-repo review of "AI translation covers hub curation surfaces" (Our Picks/comparison/content sections) - 2026-07-28
metadata:
  type: project
---

Reviewed the uncommitted feature extending AI translation to hub Curation surfaces across both
repos: backend `entity-registry.ts`/`hubs.service.ts` (Our Picks, comparison, content sections) and
dashboard `ai-translate-field-button.tsx` (new) + `ai-translate-all-button.tsx` (new, untracked but
not called out in the task description - found by grepping imports) + `rationale-translation-tabs.tsx`
+ `hub-content-sections-manager.tsx`.

**Backend has real findings** - full detail in the backend repo's own memory:
`backend/.claude/agent-memory/solid-dry-reviewer/hub_curation_ai_translation_review.md`. Headline:
a verified Critical map-collision in `setComparison`'s flag-preservation (tourId reused across
groups is schema-legal but not accounted for in the identity key; groupName has zero uniqueness
constraint either) that can silently mis-tag a human translation as machine-generated and expose it
to being overwritten by a later refresh - no test covers it. Also a Major structural gap: the new
`HubContentSection` translation unit is the only one in the whole registry keyed by a synthetic
(sectionType, displayOrder) pair instead of a real DB id/FK, reversing a previously-documented
exclusion rationale ("no group key, so per-row translation cannot work") without adding the missing
key.

**Frontend finding - DRY duplication of the in-field AI button.** The new
`components/common/ai-translate-field-button.tsx` re-implements the exact same button markup
(icon, `absolute right-1 size-6` classes, `top-1`/`top-1/2 -translate-y-1/2` multiline switch,
aria-label/title pattern, spin state) that already exists in
`components/translations/workspace/field-pair.tsx` (~lines 108-130, the Translation Console's own
inline AI button). Two independent copies of the same presentational button/behavior now exist -
should be one shared leaf component that both `FieldPair` (callback-driven, no own hook) and
`AiTranslateFieldButton` (owns `useInlineTranslate`) render.

**Noise, not part of the feature**: `components/shell/command-palette.tsx` has an unrelated stray
change (the ⌘K `<kbd>` hint commented out) sitting in the same dirty working tree - flagged to the
user as likely accidental, not reviewed as part of this feature.

**How to apply:** if asked to fix the frontend DRY item, extract the button markup from
`field-pair.tsx` into a shared component first, then have both call sites use it - don't just copy
the new one's version into the old file (the console version's `onAiTranslate`/`isTranslating` are
caller-owned; the new one owns its own hook - the shared piece is presentational only, size/class/
icon/title, not the click handling).
