---
name: mock-patterns-trips
description: Reusable mock factory patterns for trips module tests — PrismaService, TripsService, $transaction wiring
metadata:
  type: reference
---

## createMockPrismaService (trips.service.spec.ts)

Mocks all Prisma models used by TripsService: `operator`, `destination`, `category`, `hub`, `hubAllowedCategory`, `trip`, `slugRegistry`. Each with `findUnique`, `findFirst`, `findMany`, `count`, `create`, `update`, `delete`, `updateMany`, `deleteMany` as needed.

`$transaction` default: calls the callback with the same mock object so both transactional and non-transactional calls hit identical jest.fn() stubs.

```typescript
mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
```

Must be **re-applied after jest.clearAllMocks()** in beforeEach because clearAllMocks wipes mockImplementation.

## createMockTripsService (trips-children.service.spec.ts)

For TripChildrenService tests, mock TripsService with only the two methods the children service calls:
- `findTripOrThrow: jest.fn()` — default resolves to makeTrip()
- `assertOwnership: jest.fn()` — default resolves to undefined (pass)

This lets each children-method test verify delegation without re-testing ownership logic.

## Fixture factories

- `makeTrip(overrides)` — returns a full trip object matching tripSelect shape, status: DRAFT, hubId: null
- `makeOperator(overrides)` — id, userId, companyInfo.companyName, user.name/email
- `makeDestination(overrides)` — id, slug: 'curacao', isActive: true
- `makeCategory(overrides)` — id, isActive: true

## Gotcha: apostrophes in test strings

Single-quoted `it('...')` strings with apostrophes inside (e.g., `operator's`) cause TypeScript parse errors. Use double quotes for those strings:

```typescript
// Bad — parse error
it('throws when TOUR_OPERATOR touches another operator's trip', ...)
// Good
it("throws when TOUR_OPERATOR touches another operator's trip", ...)
```

This bug was present in trips.service.spec.ts lines 790, 907, 966, 1073, 1150, 1245 and was fixed.
