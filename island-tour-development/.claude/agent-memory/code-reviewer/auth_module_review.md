---
name: Auth Module Review
description: First code review of the auth module (2026-04-26) — patterns, violations, and good practices observed
type: project
---

First review of `backend/src/auth/` and `backend/src/config/` conducted 2026-04-26.

**Architecture is sound:** Three-guard chain (AuthGuard → RolesGuard → PermissionsGuard) registered via APP_GUARD in AuthModule. Clean decorator system. ROLE_PERMISSIONS map is exhaustive by type. No business logic in controller.

**Issues found (by severity):**
- CRITICAL: `role` field in Better Auth config has `input: true` — any caller can pass `role: 'ADMIN'` in a sign-up request body and only the `databaseHooks` guard stops it. The hook throws a plain `Error`, not an `HttpException`, which means the `AllExceptionsFilter` returns a 500 instead of a 403 for this case.
- MAJOR: CORS_ORIGINS parsing duplicated between main.ts and auth.instance.ts — missing `.filter(Boolean)` in main.ts is a latent bug.
- MAJOR: `RolesGuard` and `PermissionsGuard` each inline `{ user: { role: Role } }` as the request type — should be a shared `AuthenticatedRequest` interface.
- MINOR: Double import from `@prisma/client` in permissions.guard.ts (lines 8–9).
- MINOR: `any` casts in main.ts Swagger merge block — acceptable but tracked.
- MINOR: `ThrottlerGuard` is registered in `AppModule` as `APP_GUARD` but auth guards are registered in `AuthModule` — guard execution order depends on module import order. This is correct as-is but fragile to module reordering.
- MINOR: `AuthController` has no `@ApiTags` decorator — the Better Auth routes are merged into Swagger manually but the controller itself is invisible to Swagger introspection until `@ApiExcludeController()` or `@ApiTags` is explicit.

**How to apply:** Use these findings as baseline when reviewing future modules that consume auth guards or extend the permission system.
