---
name: Auth Module Phase 3 Security Findings
description: Security issues and secure patterns from Phase 3 auth module review — auth.instance.ts, guards, decorators, roles.config.ts, seed.ts
type: project
---

Review completed 2026-04-26. Auth module (Phase 3) added: auth.instance.ts, auth.controller.ts, auth.module.ts, guards (auth, roles, permissions), decorators (public, roles, require-permissions, authenticated-user), roles.config.ts, seed.ts.

**Critical / High findings to carry forward:**

- **role: input: true is the #1 critical issue.** In auth.instance.ts additionalFields, `role` has `input: true`. This means ANY client calling POST /api/auth/sign-up/email can pass `role: "ADMIN"` (or any role) in the request body. The databaseHook only blocks ADMIN when IS_SEEDING !== 'true', but TOUR_OPERATOR vs USER role can be freely set by the client during sign-up. Fix: set `input: false` and use `defaultValue: Role.TOUR_OPERATOR`. Programmatic seeding must use auth.api.createUser() with the DB adapter directly instead of signUpEmail() if it needs to set a role.

- **IS_SEEDING env var is a runtime privilege bypass.** seed.ts sets `process.env.IS_SEEDING = 'true'` before importing auth.instance. This pattern is safe in a one-off seed script, but if anything were to set IS_SEEDING=true in a production env, the ADMIN guard in databaseHooks would be silently disabled. The IS_SEEDING check is a weak control — should use a dedicated server-side seed function that bypasses the sign-up path entirely, e.g., inserting directly via prisma.user.create() with a pre-hashed password, or checking that this env var is never set in the production env validator.

- **ADMIN_PASSWORD in .env.example is a weak placeholder** ("yourPassword" — no length/complexity requirement enforced). The env validator does not check ADMIN_PASSWORD. Risk: developer copies .env.example and runs seed without changing the password.

- **RolesGuard does not check for user presence.** If AuthGuard fails for some reason and user is not attached to request, `user.role` in RolesGuard will throw a TypeError (uncaught, crashes the guard). Should null-check user.

- **PermissionsGuard does not check for user presence.** Same issue as RolesGuard.

- **ADMIN is missing CREATE_CONTENT and UPLOAD_MEDIA permissions** in ROLE_PERMISSIONS. ADMIN inherits less than TOUR_OPERATOR in those two permissions. Likely an oversight — ADMIN should have a superset of all other roles. This could cause unexpected 403s for admin-initiated content actions.

- **AuthController is NOT marked @Public()** — it relies on Better Auth's toNodeHandler() bypassing NestJS guards because NestJS doesn't intercept the raw node handler. This works in practice but is architecturally implicit. If the guard pipeline changes, all auth endpoints could be blocked. Consider adding explicit @Public() to the handler, or verifying that toNodeHandler() truly bypasses NestJS middleware.

- **minPasswordLength: 8** — minimum is very low for a platform with financial transactions. No complexity requirement (uppercase, digit, special char). Better Auth does not enforce complexity by default.

- **Two separate PrismaClient instances** — auth.instance.ts creates its own PrismaClient (standalone for Better Auth) separate from NestJS PrismaService. This is documented as intentional. The standalone client is not monitored by NestJS shutdown hooks. Better Auth does not call prisma.$disconnect() on app shutdown. Low risk now, but connection leak potential at scale.

- **CORS allowedHeaders missing 'Cookie'** — Browsers handle cookies automatically but the explicit allowedHeaders list only includes Content-Type and Authorization. Some proxy/CDN configurations strip unlisted headers. Low risk but worth noting.

- **openAPI() plugin enabled globally** — The Better Auth openAPI plugin exposes the /api/auth/reference endpoint. This is not gated behind NODE_ENV. Should be disabled or restricted in production to avoid exposing the auth API schema.

**Confirmed secure patterns (Phase 3):**

- Three global APP_GUARDs registered in correct order: AuthGuard → RolesGuard → PermissionsGuard.
- @Public() decorator correctly bypasses AuthGuard via IS_PUBLIC_KEY metadata check.
- trustedOrigins for Better Auth CSRF pulled from CORS_ORIGINS env — consistent with main.ts CORS config.
- Better Auth rate limiting configured for sensitive endpoints (/sign-in/email, /sign-up/email, /forget-password, /reset-password) at 5 req/min — matches Critical Rule #14.
- Session expiry 7 days, cookieCache 5 min — reasonable values.
- status field has `input: false` — clients cannot self-assign status.
- databaseHook blocks ADMIN creation via public sign-up — good defense-in-depth even though role:input:true is the primary issue.
- @@map lowercase maintained for all Better Auth tables (user, session, account, verification) — Critical Rule #3 compliant.
- All internal imports use @/ alias — Critical Rule #15 compliant.
- env.validate.ts validates BETTER_AUTH_SECRET >= 32 chars and rejects "change-me" placeholder.
- tsconfig.build.json sets sourceMap: false — source maps excluded from production build.

**Why:** These carry forward to all future phase reviews. The role:input:true issue MUST be fixed before Phase 4 adds any user-facing sign-up flow.
**How to apply:** In Phase 4+ reviews, verify role:input:true has been fixed. Flag any new endpoint that handles role assignment without @Roles(Role.ADMIN) guard. In DTO reviews, remember enableImplicitConversion risk from Phase 1.

**UPDATE (2026-07-19, Staff & Teams module review) — confirmed fixed:**
- `role:input:true` is now `input: false` with `defaultValue: Role.TOUR_OPERATOR` in
  `auth.instance.ts`. The #1 Phase 3 critical is resolved.
- The `IS_SEEDING` env-var bypass pattern no longer exists anywhere in `src/` (grep confirms).
- ADMIN's `ROLE_PERMISSIONS` now includes `CREATE_CONTENT`/`VIEW_CONTENT`/`EDIT_CONTENT`/
  `DELETE_CONTENT` — no longer missing relative to lower roles.
- `RolesGuard` and `PermissionsGuard` both null-check `request.user` before use.
- However, a NEW and more severe role-assignment escalation was found in the same area: see
  [[project_staff_teams_module_security]] — `PATCH /users/:id/role` (gated only by `MANAGE_USERS`,
  which is NOT excluded from the platform staff ceiling) can flip any non-admin account to `EDITOR`,
  which carries a broad static permission set with zero staff-system oversight. This is the
  successor critical finding to `role:input:true` and must be checked in every future review of
  `users/`, `staff/`, or `roles.config.ts`.
