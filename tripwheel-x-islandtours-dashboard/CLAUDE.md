# Tripwheel × Island Tours — Dashboard

The operator + admin CRM for the Island Tours marketplace. Standalone Next.js 16 on **:3001**.

> `README.md` covers running it, the layout, the two token systems, and auth. Read it first — this
> file only adds what an agent needs on top: the cross-repo picture and the push convention.

---

## Push remotes — per repo, not a shared convention

| Repo | Push to | Base |
|---|---|---|
| `tripwheel-x-islandtours-dashboard` (this one) | **`pixelvega`** | `main` |
| `island-tour-development` | **`pixelvega`** | `prod` |
| `tripwheel-app` | **`pixelvega`** | `main` |

**Every change goes on its OWN BRANCH and lands as a PR. Never commit straight to
the base branch.** Branch off the fetched base, push that branch to `pixelvega`,
open the PR against the base — one branch per PR, no exceptions and no batching
of unrelated work onto a shared branch.

```bash
git fetch pixelvega main
git switch -c <branch> pixelvega/main
# ... commit ...
git push -u pixelvega <branch>
gh pr create --base main --head <branch>
```

`pixelvega` here is `pixeldevripon/dashbaord-tripwheel-x-islandtours` (note the typo in the repo
name — it is real, not a mistake in this doc).

**`origin` (devripon-tr) is stale — do not push there.** As of 2026-08-02 it sat 103 commits behind
this repo's working branch, so a PR against it spans the whole backlog rather than your change.
Name the remote explicitly on every push rather than relying on `origin` being the default.

---

## This is a three-repo product

Three sibling checkouts live under `tripwheel-x-islandtours/`, each its own git repo on its own
branch:

| Repo | What it is | Port |
|---|---|---|
| `island-tour-development` | `backend/` NestJS API + `frontend/` public site | 5050 · 3000 |
| `tripwheel-x-islandtours-dashboard` (this one) | Operator + admin CRM | 3001 |
| `tripwheel-app` | **Different product.** Tripwheel marketing + login door; authenticates against `api.tripwheel.app`, not the Island Tours backend | 3002 |

**This repo has no database.** No Prisma client, no `DATABASE_URL` — every read and write is an HTTP
call to the backend on :5050. Only `island-tour-development/backend` owns one.

### Cross-repo coupling — none of this fails to compile locally

- **`lib/config/rbac.ts` mirrors `backend/src/config/roles.config.ts`.** Adding or renaming a
  `Permission` means editing both repos, or this dashboard silently mis-gates its UI. The backend
  change should land first.
- **The backend's `CORS_ORIGINS` must list `http://localhost:3001`.** Every API call here runs in the
  *browser* with credentials; omit the origin and all of them CORS-fail.
- **Cache revalidations POST to the public site** (`REVALIDATE_TARGET_URL` →
  `http://localhost:3000/api/revalidate`) using `INTERNAL_API_SECRET`, which must match the
  backend's and must never carry a `NEXT_PUBLIC_` prefix.
- **Better Auth runs on the backend only.** This app never calls `betterAuth()`; the session cookie
  is issued by the backend and scoped to the shared parent domain (`COOKIE_DOMAIN`).
- Ports are pinned, not incidental. 3000 and 3001 cannot be swapped — the revalidation target
  depends on the split.

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
