---
name: destination-hub-shared-patterns
description: Cross-module DRY violations between destinations, hubs, and categories — translationSelect, applyTranslation, faqSelect, and locale cast pattern are all duplicated
metadata:
  type: project
---

All three content modules (destinations, hubs, categories) independently define:

1. `translationSelect` const — identical shape `{ name, overview, h1Override, breadcrumbLabel, isMachineTranslated }` defined in each service file
2. `applyTranslation<T>()` private method — identical generic helper in all three service classes
3. `faqSelect` const — identical shape in all three services
4. FAQ CRUD logic (getFaqs, createFaq, updateFaq, deleteFaq) — structurally identical, only `pageType` string literal differs ('destination' | 'hub' | 'category')
5. locale path-param unsafe cast — `locale as Locale` without ParseEnumPipe appears in destinations.controller.ts and hubs.controller.ts

**Why:** These modules were built in parallel and each module owns its own copy rather than sharing from a common location.

**How to apply:** When a categories module review is requested, these same violations will be present. The fix is a shared `src/common/utils/translation.util.ts` exporting `TRANSLATION_SELECT` and a shared `applyTranslation` helper. FAQ logic should be extracted into a `FaqService` with a `pageType` parameter. The locale cast should use `new ParseEnumPipe(Locale)` on `:locale` path params.
