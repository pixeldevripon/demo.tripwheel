---
name: category-module-tests
description: Coverage record for the categories module unit tests — what was tested, tricky edge cases, and spec file paths
metadata:
  type: project
---

## Spec Files

- `/backend/src/categories/categories.service.spec.ts` — 83 tests
- `/backend/src/categories/categories.controller.spec.ts` — 17 tests
- Total: 100 tests, all green as of May 2026

## Key Edge Cases That Required Care

### $transaction re-setup after clearAllMocks()
`jest.clearAllMocks()` wipes the `$transaction` mock implementation. The transaction mock must be re-applied in `beforeEach` AFTER `clearAllMocks()`, otherwise transaction tests silently pass with `undefined` results.

### deleteTranslations — English guard runs before category lookup
The `Locale.en` guard is the very first check in the method. The test for it must assert that `prisma.category.findUnique` was NOT called — confirming the early return.

### getAll locale default
`CategoryQueryDto` has `locale?: Locale = Locale.en`. When testing the "no locale provided" case, the query DTO is passed as `{}` but the service destructures with `locale = Locale.en`. The test asserts the findMany call uses `locale: Locale.en` in the translations filter.

### createFaq displayOrder default
`CreateFaqDto.displayOrder` defaults to `0`. Test passes a DTO without `displayOrder` and asserts the create call includes `displayOrder: 0` (via the nullish coalescing `dto.displayOrder ?? 0` in the service).

### FeaturedSlot seeding — 3 rows, slots 1/2/3
The `create` test asserts `featuredSlot.createMany` receives exactly `[{slotNumber:1,...}, {slotNumber:2,...}, {slotNumber:3,...}]` with `status: 'AVAILABLE'` (string, not enum value).

### slug_registry skipped when no active destinations
When `destination.findMany` returns `[]`, `slugRegistry.createMany` must NOT be called. Tested explicitly.

### updateFaq / deleteFaq — no separate category guard
Unlike most other methods, `updateFaq` and `deleteFaq` do NOT call `findCategoryOrThrow` first. They use `faq.findFirst({ where: { entityId: categoryId, ... } })` which implicitly scopes to the category. Tests assert `findFirst` is called with the composite where clause.

## getTranslationsByLocale — returns placeholder, not NotFoundException
When no translation row exists for a locale, the service returns a null-filled object rather than throwing. This is intentional (the admin UI renders it as "no translation yet"). Confirmed in tests.

**Why:** relates to [[codebase-patterns]]
