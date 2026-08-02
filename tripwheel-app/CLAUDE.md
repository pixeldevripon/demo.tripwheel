@AGENTS.md

# Tripwheel App

The Tripwheel marketing site and its login door. Next.js 16 on **:3002**. Today it is only
`app/(auth)` — login, forgot, reset — with `/login` as the System Admin entrance.

---

## Push remotes — per repo, not a shared convention

| Repo | Push to | Base |
|---|---|---|
| `tripwheel-app` (this one) | **`pixelvega`** | `main` |
| `island-tour-development` | **`pixelvega`** | `prod` |
| `tripwheel-x-islandtours-dashboard` | **`origin`** | `main` |

This repo also has an `origin` (devripon-tr/tripwheel.app) that is **not** the push target. Name the
remote explicitly on every push — a bare `git push`, or assuming `origin`, sends work to the wrong
GitHub org. The dashboard inverts this rule, so the convention cannot be carried between repos.

---

## What this app talks to — NOT the island-tours backend

It shares a parent folder with two Island Tours repos, but it is a **separate product surface**.
Every cross-service URL is an env var (`lib/links.ts`):

| Var | Default | What it is |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tripwheel.app` | this site's canonical origin — metadata, sitemap, JSON-LD |
| `NEXT_PUBLIC_API_URL` | `https://api.tripwheel.app` | the shared Better Auth backend the login form posts to |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://dashboard.tripwheel.app` | where a successful login lands |

`lib/auth-client.ts` is a `createAuthClient` (better-auth/react) pointed at `API_URL`. **A login here
IS a dashboard login** — the same backend instance, with cross-subdomain cookie config making the
session visible to `dashboard.tripwheel.app` after the redirect.

So: do not wire this app to `localhost:5050`, and do not assume the Island Tours Prisma schema,
roles config, or `CORS_ORIGINS` apply. They belong to a different backend.

`getSessionRole()` in `lib/auth-client.ts` is the one place the `role` additionalField is cast —
plain `createAuthClient` cannot infer it. Read the role through that helper rather than
re-deriving the cast at each door. Values are the backend's Prisma enum, uppercase (`ADMIN`).

---

## The sibling repos (context only)

Three checkouts live under `tripwheel-x-islandtours/`, each its own git repo on its own branch:

| Repo | What it is | Port |
|---|---|---|
| `island-tour-development` | Island Tours `backend/` NestJS API + `frontend/` public site | 5050 · 3000 |
| `tripwheel-x-islandtours-dashboard` | Island Tours operator + admin CRM | 3001 |
| `tripwheel-app` (this one) | Tripwheel marketing + login door | 3002 |

Ports are pinned so all three can run at once. Beyond that, this repo shares no code and no database
with the other two — it has no Prisma client and no `DATABASE_URL`.
