---
name: cross-module-patterns
description: DRY violations and recurring patterns spanning multiple service modules (categories, hubs, and likely future modules)
metadata:
  type: project
---

## Last updated: 2026-05-16

### Project-wide DRY violations to address
These are copy-pasted verbatim between `CategoryService` and `HubService`. Any future module (destinations, trips) that implements translations will copy them again.

1. **`translationSelect` object** — `{ name, overview, h1Override, breadcrumbLabel, isMachineTranslated }` — should live in `src/common/prisma-selects/translation.select.ts` or similar.
2. **`faqSelect` object** — `{ id, question, answer, displayOrder, isActive, locale }` — should be a shared constant since the Faq model is polymorphic and shared.
3. **`applyTranslation<T>` method** — takes `base`, `translation | undefined`, `locale`; returns merged object. Should be a generic utility function in `src/common/utils/translation.util.ts`.
4. **`pageType` magic strings** — `'category'`, `'hub'`, `'destination'`, `'tour'` written as raw strings in multiple places. Should be a `FaqPageType` const object or enum in `src/common/constants/faq-page-type.ts`.
5. **Locale fallback pattern** — `query.locale ?? 'en'` repeated in multiple controllers; the DTO already defaults the value so the `?? 'en'` is redundant noise. Remove it in all controllers — just pass `query.locale` directly.
6. **TOCTOU pattern** — both `CategoryService.update()` and `CategoryService.remove()` (and their Hub equivalents) call `findXOrThrow` outside the transaction then mutate inside. The find-then-act should be inside the transaction or use Prisma's `update` which throws P2025 on missing records.

### Established good patterns to preserve
- `findEntityOrThrow()` private helper — clean, consistent, use this everywhere
- `select:` on every Prisma call — enforced well across both modules
- Transaction wrapping of all multi-table writes — correct in create()
- `@RequirePermissions()` only, no `@Roles()` on individual endpoints
- Swagger decorator functions in separate `.swagger.ts` file — keeps controllers clean
- Logger on all mutating admin actions
