---
name: Auth Testing Patterns
description: Better Auth cookie extraction, session lifecycle, and the internalAdapter-based user-provisioning pattern (sign-up is disabled)
type: project
---

## CRITICAL: public sign-up is disabled (as of ~2026-07)

`src/auth/auth.instance.ts` sets `emailAndPassword.disableSignUp: true` and
`requireEmailVerification: true`. Comment in that file: "Public self-registration
is disabled. Operator accounts are created by an admin (see
OperatorsService.create) ... There is no sign-up endpoint and no OAuth."

**`POST /api/auth/sign-up/email` cannot be used to provision e2e test users
anymore.** `test/auth.e2e-spec.ts` still tests this endpoint and documents the
old "sign-up gives TOUR_OPERATOR by default" behavior — that file is now stale
on this point (its sign-up describe block will fail against the current
`auth.instance.ts`; do not copy its `signUp()` helper into new tests). Verify
current behavior of `auth.instance.ts` directly before trusting that file's
patterns — this has already flipped once.

Also: **ADMIN accounts cannot be created via Better Auth at all**, at any layer
— `databaseHooks.user.create.before` throws `Error('ADMIN accounts cannot be
created at runtime.')` when `role === 'ADMIN'`, seed-only per master rule #10.

## The working pattern: replicate OperatorsService.create()

`src/operators/operators.service.ts` `create()` is the only place in the app
that provisions a real, sign-in-able credential account outside the DB seed.
Reuse its exact recipe in test `beforeAll`:

```typescript
import { auth } from './../src/auth/auth.instance'; // relative import, see path-alias-handling.md
import { Role } from '@prisma/client';

const authCtx = await auth.$context;
const hashedPassword = await authCtx.password.hash(VALID_PASSWORD);

// Must be created as TOUR_OPERATOR (or USER) — 'ADMIN' throws in the hook above.
const user = await authCtx.internalAdapter.createUser({
  email, name,
  role: Role.TOUR_OPERATOR,
  emailVerified: true, // bypasses requireEmailVerification at sign-in
});

await authCtx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: 'credential',
  accountId: user.id,
  password: hashedPassword,
});

// To test as ADMIN: promote via a direct Prisma update BEFORE signing in —
// raw Prisma writes bypass the databaseHooks guard (it only fires on Better
// Auth's own create/update paths, not on `prisma.user.update`).
if (needsAdmin) {
  await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
}

// Now the REAL sign-in endpoint works and returns a genuine signed cookie.
const signInRes = await signIn(server, email, VALID_PASSWORD); // still enabled
const cookie = extractSessionCookie(signInRes.headers['set-cookie']);
```

This is preferable to hand-rolling a `Session` row or a Bearer-token signature
hack — it drives the real credential sign-in HTTP path end-to-end, so the
cookie is byte-for-byte what a real user would get.

`better-auth/crypto` also exports a standalone `hashPassword`/`verifyPassword`
if `auth.$context.password` is ever unavailable, but `authCtx.password.hash`
(as used above and in `OperatorsService`) is the proven, in-repo path.

## Cookie extraction (unchanged)

```typescript
function extractSessionCookie(setCookieHeader: string | string[] | undefined): string | undefined {
  if (!setCookieHeader) return undefined;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const found = cookies.find((c) => c.includes('better-auth.session_token'));
  return found ? found.split(';')[0] : undefined;
}
```

## Endpoint paths (no /v1 prefix)

- Sign-in: `POST /api/auth/sign-in/email` (still active)
- Sign-out: `POST /api/auth/sign-out`
- Session: `GET /api/auth/get-session`
- Sign-up: `POST /api/auth/sign-up/email` — **disabled**, do not use

## Other key behaviors

- `minPasswordLength: 12`.
- `GET /api/auth/get-session` without a cookie returns 200 with null session/user (not 401).
- Sign-out invalidates the session; subsequent session fetch with the old cookie returns null.
- Ownership-mismatch checks (`ToursService.assertOwnership`, `AvailabilityService.assertTourAccess`)
  throw `ForbiddenException` (403) distinct from `PermissionsGuard` failures — a
  role can have the route's required Permission and still get 403 at the
  service layer for not owning the specific resource. To exercise this you
  need a *second* real `Operator` row (`prisma.operator.create({data:{userId}})`)
  for the non-owning user — a fresh TOUR_OPERATOR user with no Operator row
  instead gets a 400 ("No operator profile found"), not a 403.
