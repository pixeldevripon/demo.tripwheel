# Tripwheel × Island Tours — Dashboard

The operator + admin CRM for the Island Tours marketplace. Standalone Next.js 16 on **:3001**.

> `README.md` covers running it, the layout, the two token systems, and auth. Read it first — this
> file only adds what an agent needs on top: the cross-repo picture and the push convention.

---

## Repo, git, and where this sits

> **This is the DEMO monorepo (`demo.tripwheel`).** The sections that used to sit here described
> three sibling repos and a `pixelvega` push target with a `prod` base. Neither exists in this
> checkout. **The root `CLAUDE.md` is authoritative on layout, git and deployment.**

One repo, `origin` → `pixeldevripon/demo.tripwheel`, single `main` branch, branch + PR for every
change. This directory is `dashboard/`; the API and public site are `../backend-frontend/{backend,
frontend}`.

This app is the operator + admin CRM **and the admin login gate** — there is no separate admin
application in this deployment. `../tripwheel-app` is superseded and undeployed.

It deploys to **Vercel** with Root Directory `dashboard`; the API deploys to the VPS. Details in
`../docs/operations/DEMO-DEPLOYMENT.md`.

---

## The three login doors

`app/(login)/` owns all of them: `/portal` (operators), `/staff`, and `/admin` (system
administrators, merged in from `tripwheel-app`). Each has its own shell, its own `forgot` and
`reset` routes and its own button style, so no two doors read as one surface. All three must stay in
`proxy.ts`'s `UNGUARDED_PREFIXES` — guarding a login door is a redirect loop.

**`/admin` deliberately does not reuse `AuthForm`.** The operator and staff doors render
`WrongDoorNote`, which names the surface an account actually belongs to. That is helpful there and
exactly what the admin door must never do: it would confirm which emails are real admin accounts.
So `admin-login.tsx` answers every failure with one generic string, and additionally verifies the
freshly-minted session really is `ADMIN` before handing over. Keeping that logic in its own
component rather than as an `AuthForm` variant means a later edit to the shared form cannot silently
reintroduce the hint.

`NEXT_PUBLIC_ADMIN_LOGIN_URL` is retired — there is no other origin to point at.

Coupling to respect — all silent, none fails to compile:

- **`lib/config/rbac.ts` mirrors `../backend-frontend/backend/src/config/roles.config.ts`.**
- **`lib/cache-tags.ts` must be byte-identical** to `../backend-frontend/frontend/lib/cache-tags.ts`.
- **`COOKIE_DOMAIN` must match the backend's**, or login is an infinite redirect loop.
- **`INTERNAL_API_SECRET` and `REVALIDATE_SECRET`** must match the backend and the public site.
  Server-only; never `NEXT_PUBLIC_`-prefixed.
- **This app's origin must be in the backend's `CORS_ORIGINS`** or every request fails, sign-in
  included.

---

## RBAC gating

Role is resolved server-side in the layout and distributed via `RoleContext`. `useRole()` returns
`{ role, can, canAny }`.

Gate: "Add X" buttons (`CREATE_*`/`MANAGE_*`), bulk delete, row-action delete, Danger Zone
(`DELETE_*`/`MANAGE_*`), and admin-only panels (`MANAGE_SYSTEM`/`MANAGE_USERS`).

Do **not** gate sub-actions inside an already-protected page, or individual form fields — gate the
page or the form. ADMIN is a strict superset of every lower role.

| Module | Create | Edit | Delete |
|---|---|---|---|
| Destinations | `CREATE_DESTINATION` | `EDIT_DESTINATION` | `DELETE_DESTINATION` |
| Categories | `CREATE_CATEGORY` | `EDIT_CATEGORY` | `DELETE_CATEGORY` |
| Hubs | `MANAGE_HUBS` | `MANAGE_HUBS` | `MANAGE_HUBS` |
| Collections | `CREATE_COLLECTION` | `EDIT_COLLECTION` | `DELETE_COLLECTION` |
| Tours | `CREATE_TRIP` | `EDIT_TRIP` | `DELETE_TRIP` / `MANAGE_TRIPS` |

---

## Talking to the backend

`lib/api/` holds one file per backend module. API base is `/api/v1`; auth lives at `/api/auth/*`
with no `/v1`. Authenticated routes need the Better Auth session cookie, so calls must send
credentials.

The backend strips unknown request-body fields (`whitelist` + `forbidNonWhitelisted`), so a payload
with a field the DTO doesn't declare gets a 400 rather than silently ignoring it. Translation
upserts in particular wrap their fields inside a `fields` key — sending them flat is that 400.
