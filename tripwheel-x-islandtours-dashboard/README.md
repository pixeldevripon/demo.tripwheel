# Tripwheel x Island Tours - Dashboard

The operator + admin CRM for the Island Tours marketplace. Standalone Next.js 16
app. It talks to the backend over HTTP and shares no code with the public site.

## Run it

```bash
cp .env.local.example .env.local   # then set NEXT_PUBLIC_BACKEND_URL + INTERNAL_API_SECRET
pnpm install
pnpm dev                           # http://localhost:3000/dashboard
```

The backend must be reachable at `NEXT_PUBLIC_BACKEND_URL` (default
`http://localhost:5050`). This repo has no database and no Prisma client: every
read and write is an API call.

## Layout

```
app/(dashboard)/dashboard/**   the CRM routes           <- moves to / in Phase 6
app/(login)/{portal,staff}     operator + staff login
app/onboarding                 operator onboarding
components/**                  one folder per module
components/ui/**               shadcn primitives (forked from the public site)
components/login/**            login surfaces (forked; see "Two token systems")
lib/api/**                     the HTTP client, one file per backend module
lib/config/rbac.ts             MIRRORS backend/src/config/roles.config.ts - keep in sync
proxy.ts                       session guard (Next 16's renamed middleware)
```

## Two token systems, on purpose

- **Admin UI** -> the dashboard tokens in `app/globals.css`. Never `--it-*`.
- **Login surfaces** -> the Island Tours brand tokens in `app/login-tokens.css`,
  scoped by `.frontend-root` on `app/(login)/layout.tsx`.

The login screens are the operator's front door and are deliberately branded, so
`login-tokens.css` is a permanent fork of the public site's token file, not
migration scaffolding. The two are allowed to drift. Details in that file's header.

## Auth

Better Auth session cookie, issued by the backend and scoped to the shared parent
domain (`COOKIE_DOMAIN`, default `.islandtours.esenc.cloud`). The dashboard never
runs `betterAuth()` itself.

`proxy.ts` only checks that a session cookie is **present and well-formed** - it
makes no network call, and that property is load-bearing (see the comment there).
Authoritative validation happens one hop later in the dashboard layout.

## Origins

| | Interim (in force) | Target |
|---|---|---|
| Dashboard | `dashboard.islandtours.esenc.cloud` | `dashboard.tripwheel.io` |
| Backend | `api.islandtours.esenc.cloud` | `api.tripwheel.io` |
| Public site | `islandtours.esenc.cloud` | `island.tours` |

## Known gaps

- **Dashboard writes do not yet bust the public site's cache.** Two apps means two
  caches, and `updateTag()` cannot cross the gap - it fails silently, with no
  error. Phase 7 replaces the transport.
- Routes still live under `/dashboard/*`. Phase 6 moves them to the root.

## Specs

`technical-doc/dashboard-extraction/` in the island-tours monorepo. Read `02`
(extraction) and `02B` (cache revalidation) first; they carry the risk.
