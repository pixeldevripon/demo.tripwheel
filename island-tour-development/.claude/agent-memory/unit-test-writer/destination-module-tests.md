---
name: destination-module-tests
description: Coverage notes, tricky edge cases, and key decisions for the destinations module spec files
metadata:
  type: reference
---

## Spec Files

- `backend/src/destinations/destinations.service.spec.ts` — 80+ service tests
- `backend/src/destinations/destinations.controller.spec.ts` — 27 controller tests + permission metadata assertions

## $transaction Wiring — Destinations-Specific Note

`remove()` is entirely inside a `$transaction`. The mock callback gets the same `prisma` mock object, so `prisma.destination.findUnique`, `prisma.trip.count`, `prisma.destination.update`, and `prisma.slugRegistry.updateMany` are all called on the single mock object. The `$transaction` mock must be re-applied after `jest.clearAllMocks()` in `beforeEach`.

## `create()` Transaction Steps

1. `tx.destination.create` — P2002 → ConflictException; catches via `.catch()`
2. `tx.slugRegistry.create` — always, for the 'tours' reserved slug
3. `tx.category.findMany` — finds all active categories
4. `tx.slugRegistry.createMany` — only when `categories.length > 0`; test both paths

## Key Error-Branching Details

- `deleteTranslations`: English guard fires before `findDestinationOrThrow` — `prisma.destination.findUnique` must NOT be called
- `deleteTranslations`: P2025 from `destinationTranslation.delete` → NotFoundException (not the Prisma error itself)
- `remove()`: Trip count check uses `{ isActive: true, status: { not: TripStatus.DRAFT } }`
- `update()`: Only calls `slugRegistry.updateMany` when `dto.isActive !== undefined`
- `getTranslationsByLocale`: returns null-filled placeholder when no row found (not a NotFoundException)
- `getPageContent`: same null-filled placeholder pattern as translations

## Controller Permission Metadata Pattern

```typescript
function getPermission(methodName: keyof DestinationController) {
  return Reflect.getMetadata('permissions', DestinationController.prototype[methodName]);
}
```

Public endpoints use `Reflect.getMetadata('isPublic', ...)` — returns `true` when `@Public()` is applied.

## Locale / applyTranslation Testing

- Happy path: `translations[0]` has `name` → that name is used in result
- Fallback path: `translations` is `[]` → base `name` is used, `isMachineTranslated: false`
- Both paths are tested for `getAll`, `getActive`, `getBySlug`, `getById`

## Slug Auto-Generation

`create()` calls `generateSlug(dto.name)` (removes diacritics, lowercases). Test asserts `destination.create` is called with `slug: 'curacao'` when `name: 'Curaçao'`.

## See Also

[[codebase-patterns]] for shared mock factory and $transaction wiring.
