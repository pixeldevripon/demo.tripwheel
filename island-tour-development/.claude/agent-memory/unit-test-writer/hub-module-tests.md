---
name: hub-module-tests
description: What was tested in the hubs module, key patterns discovered, and tricky implementation details
metadata:
  type: reference
---

## Spec file locations

- `backend/src/hubs/hubs.service.spec.ts` — 75 tests, 98 total with controller
- `backend/src/hubs/hubs.controller.spec.ts` — 23 tests

## $transaction wiring — expose internal `_tx`

The hubs service uses `$transaction` heavily (create, update, remove). The mock factory
exposes the inner transaction client as `_tx` so individual tests can set up and assert
against it independently:

```typescript
const { _tx } = prisma;
_tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
_tx.hub.create.mockResolvedValue({ id: 'hub-new' });
```

This avoids the ambiguity of calling `prisma.hub.create` vs `tx.hub.create` inside
the callback.

## Key implementation details

- `create()` runs: `destination.findUnique` → `hub.create` → `slugRegistry.create` → (optionally) `hubAllowedCategory.createMany` → `hub.findUniqueOrThrow` — all inside a single `$transaction`.
- `remove()` runs `findHubOrThrow` OUTSIDE the transaction (seeded check), then `$transaction` contains `trip.count` + `hub.update` + `slugRegistry.updateMany`.
- `update()` only calls `slugRegistry.updateMany` when `isActive` is explicitly in the DTO.
- `deleteTranslations()` throws `BadRequestException` BEFORE the hub lookup when `locale === Locale.en`.
- `getTranslationsByLocale()` does NOT throw when no translation row exists — returns a null-filled shell object with the requested locale.
- `getFaqs()` omits `locale` from the `where` clause entirely when query.locale is undefined (tested by checking `not.toHaveProperty('locale')`).

## TypeScript gotcha

`HubTranslationFieldsDto` fields (`h1Override`, `breadcrumbLabel`) are typed as `string | undefined`, not `string | null`. Assigning `null` directly causes a TS2322 error. Use `undefined` or omit the field when calling from test DTOs.

## Allowed categories pattern

`removeAllowedCategory` checks for the existing row via `hubAllowedCategory.findUnique` (not a Prisma P2025 catch) and throws `NotFoundException` when `null` is returned — unlike other delete patterns in this codebase that catch `P2025`.

## FAQ pageType filter

All FAQ operations (get, create, update, delete) scope their Prisma where clause to
`pageType: FAQ_PAGE_TYPE.HUB` (value: `'hub'`). Tests verify this is always passed.
