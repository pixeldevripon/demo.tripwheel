---
name: codebase-patterns
description: Established testing conventions in the Island Tours backend — mock factory shapes, $transaction wiring, Prisma error helpers, and test file structure
metadata:
  type: reference
---

## Mock Factory Pattern

All service tests use a `createMockPrismaService()` factory that returns a plain object with `jest.fn()` on every Prisma model method the service uses. The `$transaction` mock is always set up in `beforeEach` (after `jest.clearAllMocks()`) so callbacks execute synchronously:

```typescript
mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
```

Because `clearAllMocks()` wipes implementations, the transaction re-setup must happen AFTER `clearAllMocks()` in every `beforeEach`.

## Prisma Error Helper

```typescript
function makePrismaError(code: string) {
  const err = new Error(`Prisma error ${code}`);
  (err as any).code = code;
  return err;
}
```

Used to simulate P2002 (ConflictException) and P2025 (NotFoundException) branches.

## Test Module Structure

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [MyService, { provide: PrismaService, useValue: prisma }],
}).compile();
```

`PrismaService` is `@Global()` — never import `PrismaModule` in test modules.

## Controller Test Pattern

Controller tests mock the service as a plain object with `jest.fn()` and verify that each method calls the correct service method with the exact arguments. Auth/guard/decorator behaviour is noted as integration concerns — not tested at the unit level.

## Existing Spec Files (as of May 2026)

- `src/app.controller.spec.ts`
- `src/settings/settings.controller.spec.ts`
- `src/settings/settings.service.spec.ts`
- `src/settings/dto/settings.dto.spec.ts`
- `src/operators/operators.controller.spec.ts` — skeleton only
- `src/operators/operators.service.spec.ts` — skeleton only
- `src/media-gallery/media-gallery.controller.spec.ts`
- `src/media-gallery/media-gallery.service.spec.ts`
- `src/users/user.service.spec.ts` — comprehensive; the authoritative reference pattern
- `src/categories/categories.service.spec.ts` — written May 2026
- `src/categories/categories.controller.spec.ts` — written May 2026
- `src/destinations/destinations.service.spec.ts` — written May 2026 (107 total tests combined)
- `src/destinations/destinations.controller.spec.ts` — written May 2026
- `src/hubs/hubs.service.spec.ts` — written May 2026 (75 tests)
- `src/hubs/hubs.controller.spec.ts` — written May 2026 (23 tests)

## Jest Config (backend/package.json)

- `rootDir: src`, `testRegex: .*\\.spec\\.ts$`
- `moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" }` — `@/` alias resolves from `src/`
- Run: `pnpm jest <pattern> --no-coverage` from `backend/`
