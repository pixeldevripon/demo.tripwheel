---
name: project_staff_module_tests
description: Unit test coverage added 2026-07-19 for the new Staff & Teams module (staff.config, staff-permissions.service, staff.service, permissions.guard)
metadata:
  type: project
---

Added 4 spec files (66 tests, all green) for the newly-written Staff & Teams module - no
production source changes. Files:

- `src/config/staff.config.spec.ts` (23 tests) - pure policy function
  `computeEffectivePermissions` + ceiling constants (`PLATFORM_STAFF_CEILING`,
  `OPERATOR_SEAT_CEILING`, `STAFF_BASE_PERMISSIONS`).
- `src/staff/staff-permissions.service.spec.ts` (19 tests) - static-role short circuit, STAFF/
  TOUR_OPERATOR no-row fallbacks, computed path, 60s in-process cache (incl. a
  `jest.useFakeTimers()` + `jest.setSystemTime()` test for actual TTL expiry), `invalidate`/
  `invalidateAll`, `hasPermissions` missing-list.
- `src/staff/staff.service.spec.ts` (35 tests) - invite flows (409 dup email, 400 ceiling
  violation, rollback deleteUser on staffMember.create throw), team operator resolution
  (admin needs operatorId / owner auto-resolve / owner+foreign operatorId -> 403), status
  update rules (OWNER seat 403, self-change 400, suspend cascades to user+session, reactivate
  stamps activatedAt), removeTeamMember guards, designation CRUD (duplicate name 409, P2002
  race 409, system rename/delete 403, members-assigned delete 409, invalidateAll only fires on
  a permissions edit not a name-only edit), and `getPermissionCatalog` scope filtering.
- `src/auth/guards/permissions.guard.spec.ts` (6 tests) - no existing guard spec file to update;
  wrote fresh. No Nest TestingModule needed - `new PermissionsGuard(mockReflector, mockStaffPermissions)`
  directly, with a hand-built `ExecutionContext` stub (`getHandler/getClass/switchToHttp.getRequest`).

**Mocking `@/auth/auth.instance`**: copied the exact pattern from
`src/operators/operators.service.spec.ts` - `jest.mock('@/auth/auth.instance', ...)` as the
FIRST statement in the file (before other imports), mocking `auth.$context` as a `Promise.resolve({password:{hash}, internalAdapter:{createUser,linkAccount,deleteUser}})`
and `auth.api.requestPasswordReset`. Since `$context` is a cached Promise (not a factory), grab
the resolved object once via `await auth.$context` in `beforeEach` and set fresh
`.mockResolvedValue(...)` on its nested jest.fn()s each time - `jest.clearAllMocks()` clears call
history but the same object reference persists across the whole file.

**Gotcha caught while writing inviteTeamMember tests**: when the actor is ADMIN and passes an
explicit `operatorId`, `resolveTeamOperatorId` still does `prisma.operator.findUnique({where:{id:
operatorId}})` to confirm the operator exists - forgetting to mock that call returns `undefined`
-> `NotFoundException('Operator not found')` instead of the exception you're actually trying to
test further down the method (e.g. a designation-scope-mismatch 400). Always mock
`prisma.operator.findUnique` in any ADMIN-actor team test even when the operator id itself isn't
the thing under test.

**Full-suite baseline note (2026-07-19)**: `src/bookings/bookings.service.spec.ts` has 7
pre-existing failing tests in `requestCancellation` (env var `ADMIN_EMAIL` state bleeding between
test files) that fail identically with or without the staff module's new spec files - confirmed
via `git stash` + re-run and via `--testPathIgnorePatterns` on the new files. Baseline is 51
suites / 1084 tests (7 already failing in bookings.service.spec.ts) before this session; adding
the staff module specs brings it to 55 suites / 1150 tests with the same 7 pre-existing failures
and all 66 new tests green. Do not treat that bookings failure as caused by staff-module work.
