---
name: Auth Module Patterns
description: Guard chain design, decorator patterns, and SOLID/DRY issues found in the backend auth module (first review 2026-04-26)
type: project
---

Guard chain is correctly registered as APP_GUARD triple in AuthModule (AuthGuard → RolesGuard → PermissionsGuard). AuthGuard correctly attaches `request.user` for downstream guards to consume.

**Known issues found:**

1. `RolesGuard` and `PermissionsGuard` both independently inline `{ user: { role: Role } }` as the typed request shape. This is duplicated and should be extracted to a shared `AuthenticatedRequest` interface in `auth/types.ts`.

2. `PermissionsGuard` imports `Role` and `Permission` in two separate import statements from the same `@prisma/client` package (lines 8–9). Minor — consolidate to one import.

3. The ADMIN guard in `auth.instance.ts` (databaseHooks) casts `userData` to `{ role?: string }` via `as` — the `userData` type from Better Auth should be checked against the Better Auth version's actual inferred type rather than cast.

4. `auth.instance.ts` uses `Role.TOUR_OPERATOR` as the default role for ALL self-registering users. This is intentional per the project design (signup page is for operators only), but it means a plain USER cannot self-register, which is correct. Worth noting: the `input: true` flag on the role field means a caller can pass any role string, including ADMIN. The `databaseHooks` guard is the only protection — verify it is always exercised.

**What is done well:**
- `@Public()` / `@Roles()` / `@RequirePermissions()` are clean, composable, metadata-only decorators.
- `AuthGuard` is the only place session validation occurs — no duplication across guards.
- `ROLE_PERMISSIONS` is a `Record<Role, Permission[]>` which is exhaustive by TypeScript — adding a new Role forces the map to be updated at compile time.

**How to apply:** When reviewing future guards or controllers, enforce the shared `AuthenticatedRequest` type instead of repeated inline casts. Flag any guard that calls `auth.api.getSession()` outside `AuthGuard`.
