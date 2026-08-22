@AGENTS.md

# Tripwheel App

The Tripwheel marketing site and its login door. Next.js 16 on **:3002**. Today it is only
`app/(auth)` — login, forgot, reset — with `/login` as the System Admin entrance.

---

## SUPERSEDED — this app is not deployed

> In the **demo** deployment (`demo.tripwheel`), the admin login gate lives inside `../dashboard`,
> not here. Nothing builds, deploys, or references this directory: no Vercel project, no CI path
> filter, no workflow. It is kept only so its history and its login UI are available while the gate
> is merged into the dashboard.
>
> The section that used to sit here described a `pixelvega` push target and a three-repo workspace.
> Neither exists in this checkout — one repo, `origin` → `pixeldevripon/demo.tripwheel`, single
> `main` branch. **The root `CLAUDE.md` is authoritative.**
>
> Everything below is retained as reference for the merge, and describes how this app behaved as a
> standalone deployment. Do not treat it as a description of how the demo works today.

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
