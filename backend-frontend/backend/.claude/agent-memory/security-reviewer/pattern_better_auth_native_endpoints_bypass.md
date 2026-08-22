---
name: pattern_better_auth_native_endpoints_bypass
description: Any custom auth flow built alongside Better Auth must be checked against Better Auth's own native endpoint for the same action, still live under the catch-all mount - confirmed exploitable for password-change
metadata:
  type: project
---

`src/auth/auth.controller.ts` mounts `toNodeHandler(auth)` on `@All('/api/auth/*splat')` -
literally every Better Auth-registered route is reachable, including ones the app never calls from
its own frontend. Building a custom flow in a different module (e.g. `UserService`) does NOT
disable or shadow the native Better Auth route for the same action - both stay live side by side
unless the native one is explicitly blocked.

**Confirmed instance (2026-07-28 review, two-step password-change feature):** the new
`POST /users/me/password-change/request` + `/confirm` flow in `src/users/user.service.ts` was
designed so a stolen session + known password is *not* enough to change the password - an emailed,
single-use, mailbox-only confirmation is also required (see [[confirmed_secure_password_change_flow]]).
But Better Auth's own `POST /change-password` (registered by the `emailAndPassword` config in
`auth.instance.ts`, handler in `better-auth/dist/api/routes/update-user.mjs` -
`createAuthEndpoint("/change-password", ...)`) is still mounted at `/api/auth/change-password` via
the catch-all. It requires only a valid session + `currentPassword`, applies the new password
immediately, and only revokes other sessions if the caller opts in
(`revokeOtherSessions: true`, which nothing forces). This is a complete, silent bypass of the
two-step design - reported Critical. The dashboard frontend happens not to call
`authClient.changePassword` anywhere (grepped `components/`, `app/` - only a same-named Zod schema
exists), so the UI never exposes it, but the backend route is directly callable
(curl/Postman) regardless of frontend wiring.

**How to apply:** whenever a new "step-up" or "extra-verification" flow is built on top of a Better
Auth action (password change, email change, session revocation, etc.), explicitly check whether
Better Auth's own endpoint for that same action is still reachable through the catch-all mount. If
it is, either (a) block that specific path before it reaches `toNodeHandler` (e.g. a guard/
middleware keyed on `req.path`), or (b) disable the capability in the `betterAuth()` config if an
option exists, or (c) if intentionally left live as a deliberate lower-assurance path, that must be
a documented, explicit decision - not an oversight. Never assume a custom NestJS-side flow is the
only way to perform an action just because it's the only one wired into the frontend.
