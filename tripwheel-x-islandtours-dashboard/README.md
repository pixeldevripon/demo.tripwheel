# Tripwheel x Island Tours - Dashboard

The operator + admin CRM for the Island Tours marketplace. Standalone Next.js 16
app. It talks to the backend over HTTP and shares no code with the public site.

## Run it

```bash
cp .env.local.example .env.local   # then set NEXT_PUBLIC_BACKEND_URL + INTERNAL_API_SECRET
pnpm install
pnpm dev                           # http://localhost:3001
```

The backend must be reachable at `NEXT_PUBLIC_BACKEND_URL` (default
`http://localhost:5050`). This repo has no database and no Prisma client: every
read and write is an API call.

### Ports

| Port | App                               |
| ---- | --------------------------------- |
| 5050 | backend (NestJS)                  |
| 3000 | public site (`island-tours` repo) |
| 3001 | **this dashboard**                |

3001 is pinned in `pnpm dev`, not incidental. 3000 belongs to the public site -
it is what this app POSTs cache revalidations to (`REVALIDATE_TARGET_URL`), so
the two cannot share a port. The backend's `CORS_ORIGINS` must list
`http://localhost:3001`, because every API call here runs in the **browser** with
credentials; omit it and each one is CORS-blocked.

## Layout

```
app/(app)/**                   the CRM routes (served at /)
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

|             | Interim (in force)                  | Target                   |
| ----------- | ----------------------------------- | ------------------------ |
| Dashboard   | `dashboard.islandtours.esenc.cloud` | `dashboard.tripwheel.io` |
| Backend     | `api.islandtours.esenc.cloud`       | `api.tripwheel.io`       |
| Public site | `islandtours.esenc.cloud`           | `island.tours`           |

## Deploy

Vercel, same as the public site. There is **no Dockerfile and no
`output: 'standalone'`** here, on purpose - see the note at the top of
`next.config.ts` before adding either.

Set every var from `.env.production.example` in the Vercel project. Three of them
are shared secrets, and each fails in its own quiet way if it drifts:

| Var                   | If it is wrong                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNAL_API_SECRET` | must match the backend. Mismatch = SSR requests lose their throttle exemption, a 429 reads as "no session", and logged-in users bounce to `/portal`. |
| `COOKIE_DOMAIN`       | must match the backend's cookie domain (`.islandtours.esenc.cloud`). Mismatch = login loop.                                                          |
| `REVALIDATE_SECRET`   | must match the **public** repo's value. Mismatch = every revalidation 401s and the public site serves stale pages.                                   |

Also required, on the **backend**: add this app's origin to `CORS_ORIGINS`. It
feeds both CORS and Better Auth `trustedOrigins`, so a miss blocks API calls
_and_ rejects sign-in.

`NEXT_PUBLIC_*` vars are inlined at build time, not read at runtime - changing one
in Vercel needs a redeploy, not a restart.

## Known gaps

- No CI. The cache-tag contract in `lib/cache-tags.ts` is duplicated in the public
  repo and guarded only by a runtime 400 and a manual `diff`. See that file's
  header.
- `getDashboardStats` is still mock data (`app/_actions/dashboardActions.ts`).

## Specs

`technical-doc/dashboard-extraction/` in the island-tours monorepo. Read `02`
(extraction) and `02B` (cache revalidation) first; they carry the risk.
update

