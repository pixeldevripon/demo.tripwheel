---
name: Auth Testing Patterns
description: Better Auth cookie extraction, sign-up/sign-in Supertest helpers, session lifecycle
type: project
---

## Cookie extraction

Better Auth sets `better-auth.session_token` as an HttpOnly cookie.
Extract it from `res.headers['set-cookie']` (typed as `string | string[] | undefined`):

```typescript
function extractSessionCookie(setCookieHeader: string | string[] | undefined): string | undefined {
  if (!setCookieHeader) return undefined;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const found = cookies.find((c) => c.includes('better-auth.session_token'));
  return found ? found.split(';')[0] : undefined;
}
```

Pass the extracted cookie as `.set('Cookie', cookie)` on subsequent requests.

## Endpoint paths (no /v1 prefix)

- Sign-up: `POST /api/auth/sign-up/email`
- Sign-in: `POST /api/auth/sign-in/email`
- Sign-out: `POST /api/auth/sign-out`
- Session: `GET /api/auth/session`

These live under `AuthController` with `@All('/api/auth/*splat')` and are `@Public()`.

## Key behaviors

- `minPasswordLength: 12` — passwords < 12 chars are rejected with non-200 status.
- `role.input: false` — role field in sign-up body is silently stripped; user always gets `TOUR_OPERATOR`.
- `status.input: false` — same for status; always defaults to `ACTIVE`.
- `GET /api/auth/session` without a cookie returns 200 with `{ session: null, user: null }` (Better Auth contract, not a 401).
- Sign-out invalidates the session; subsequent session fetch with old cookie returns null session.

## Shared-user pattern for sign-in tests

Create one shared user in `beforeAll` of the sign-in describe block; sign-in tests don't mutate state.
Delete in `afterAll` of the same block, not in the outer `afterEach`.
