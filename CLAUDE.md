# demo.tripwheel — repo root

Island Tours is a Caribbean tour marketplace operating as a **reseller**: it earns commission on
bookings taken from local operators. Operators list single-day tours; travellers discover and **book
instantly** — there is no enquiry model.

**This repo is the DEMO deployment of that product.** It is a single git repository holding all the
apps as plain directories — not a container for several repos, and not the production checkout.

> The previous version of this file was copied from the upstream three-repo workspace and described
> a world that does not exist here: three separate repos, a `pixelvega` remote, a `prod` base
> branch, `tripwheel-app` as a separately deployed product, and three Next.js apps on ports
> 3000/3001/3002. Anything following it would push to a remote this repo does not have.

---

## 1. Layout — one repo, three directories, two of them deployed

| Directory | What it is | Stack | Deployed to |
|---|---|---|---|
| `backend-frontend/backend` | NestJS API — **the only thing that owns a database** | NestJS 11 · Prisma 7 · Postgres | **VPS** (Docker) |
| `backend-frontend/frontend` | Public traveller site | Next.js 16 | **Vercel** |
| `dashboard` | Operator + admin CRM — **and the admin login gate** | Next.js 16 | **Vercel** |
| `tripwheel-app` | Superseded. The admin gate moved into `dashboard` | Next.js 16 | **not deployed** |

`tripwheel-app/` is still in the tree but nothing builds, deploys, or references it. Treat it as
dead weight, not as a fourth app.

**Only `backend-frontend/backend` owns a database.** The two Next.js apps have no Prisma client and
no `DATABASE_URL`; every read and write is an HTTP call to the API. Exactly one Prisma instance
exists in the whole system.

---

## 2. Git — one remote, one branch

| | |
|---|---|
| Remote | `origin` → `github.com/pixeldevripon/demo.tripwheel` |
| Base branch | **`main`** (the only branch — there is no `prod` here) |

**Every change goes on its own branch and lands as a PR. Never commit straight to `main`.**

```bash
git fetch origin main
git switch -c <branch> origin/main
# ... commit ...
git push -u origin <branch>
gh pr create --base main --head <branch>
```

There is no `pixelvega`, `org`, or `org-personal` remote in this repo. If a doc under
`backend-frontend/` or `dashboard/` tells you to push to `pixelvega` with base `prod`, that doc is
upstream text that has not been rewritten — this section wins.

### No AI attribution

**Never** add a `Co-Authored-By: Claude …` trailer to a commit, or a "Generated with Claude Code"
footer to a PR body.

---

## 3. Deployment — and where the docs are

**`docs/operations/DEMO-DEPLOYMENT.md` is the authority for this repo.** Read it before the two
runbooks beside it: `VPS-DEPLOYMENT-CADDY.md` and `VPS-SECOND-INSTANCE.md` are pulled in from the
upstream workspace and describe all three Next apps running on the VPS under PM2. That is not this
deployment. They are still correct about Docker, Caddy/nginx, DNS, secrets and the database.

| Piece | Where | Detail |
|---|---|---|
| Backend | VPS `/opt/demo-tripwheel`, Docker | Port `5150` (production holds `5050`); image `demo-tripwheel-backend:<sha>` |
| Public site | Vercel project | Root Directory `backend-frontend/frontend` |
| Dashboard | Vercel project | Root Directory `dashboard` |

Demo hosts sit on a **different apex from production** (`tripwheel.io` vs `tripwheel.app`) so the two
instances' session cookies can never collide — see `VPS-SECOND-INSTANCE.md` §3. `COOKIE_DOMAIN` is
`.demo.tripwheel.io`.

### CI/CD

Workflows live at **`.github/workflows/` in the repo root**. GitHub reads them nowhere else — they
previously sat under `backend-frontend/` and consequently had never run once.

| Workflow | Trigger |
|---|---|
| `ci.yml` | push/PR on `main` touching `backend-frontend/backend/**` |
| `deploy-backend.yml` | push on `main` touching `backend-frontend/backend/**` or its `docker-compose.yml`; plus `workflow_dispatch` |
| `claude-code-review.yml` | every PR; skips cleanly unless `CLAUDE_CODE_OAUTH_TOKEN` is set |
| `claude.yml` | `@claude` mentions |

Frontend and dashboard deploys are Vercel's Git integration, deliberately not duplicated in Actions.

Required repository secrets: `VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`
(optional), and **`VPS_APP_DIR=/opt/demo-tripwheel`** — the *git root*, not the compose directory.
The deploy script runs `git reset --hard` there and then `cd`s into `backend-frontend/`.

---

## 4. Cross-app coupling — none of this fails to compile

These are the traps. Every one is silent locally.

- **`dashboard/lib/config/rbac.ts` mirrors `backend-frontend/backend/src/config/roles.config.ts`.**
  Add or rename a `Permission` in one and the other must change too, or the dashboard silently
  mis-gates its UI. The backend change lands first.
- **`lib/cache-tags.ts` must be byte-identical** in `backend-frontend/frontend/` and `dashboard/`.
  `diff` between the two is the check; a drifted tag is rejected as `unknown_tag` at runtime.
- **Backend `CORS_ORIGINS` must list both Vercel origins.** Dashboard and site API calls run in the
  *browser* with credentials; omit an origin and every one of its requests CORS-fails, including
  sign-in.
- **`COOKIE_DOMAIN` must match between the backend and the dashboard.** A mismatch is an infinite
  login redirect loop, not an error.
- **`INTERNAL_API_SECRET` and `REVALIDATE_SECRET`** are matched pairs across the API and the two
  apps. Both are server-only and must **never** carry a `NEXT_PUBLIC_` prefix.
- **Better Auth runs on the backend only.** No frontend calls `betterAuth()`; the session cookie is
  issued by the API and scoped to the shared parent domain.
- **The dashboard POSTs cache revalidations to the public site** (`REVALIDATE_TARGET_URL` →
  `<site>/api/revalidate`). Unset in production means silent staleness, never an error.

---

## 5. Local development

Ports here are the ordinary dev ports, not the VPS ones.

| Service | Port | Command |
|---|---|---|
| Backend API | `5050` | `cd backend-frontend && pnpm dev:backend` |
| Public site | `3000` | `cd backend-frontend && pnpm dev:frontend` |
| Dashboard | `3001` | `cd dashboard && pnpm dev` |

`cd backend-frontend && pnpm dev` runs the API and the site together. Node 22 · pnpm 10 · Postgres
17.4 on 5432 · Redis required by BullMQ.

Backend `CORS_ORIGINS` must include `http://localhost:3000` and `http://localhost:3001` for local
work.

### Testing

| Where | Runner |
|---|---|
| `backend-frontend/backend` | Jest — `pnpm test` |
| `backend-frontend/frontend` | Vitest — `pnpm test` |
| `backend-frontend/frontend/e2e`, `dashboard/e2e` | Playwright — `pnpm test:e2e` |

---

## 6. This is a demo — what must differ from production

| Setting | Here |
|---|---|
| `NEXT_PUBLIC_ENABLE_TRACKING` | `false`. Demo builds are also `NODE_ENV=production`, so this flag is the only thing keeping test bookings out of real Google Ads / GA4 / Meta data |
| Stripe keys (DB, Admin → Settings) | **test** keys only |
| `META_*`, `GOOGLE_ADS_*` | blank |
| Cloudinary | separate cloud, or demo uploads land in production's media gallery |
| Resend | separate key and a demo `MAIL_FROM` domain. Booking flows send **real** email to whatever address is typed in |
| Every secret | freshly generated. Never copy production's, `ENCRYPTION_KEY` least of all — it decrypts the stored Stripe keys |
| Seeding | `RUN_SEED=true` on the first boot only, then `pnpm prisma:seed:demo` |

---

## 7. Documentation index

| Area | Path |
|---|---|
| **This deployment** | `docs/operations/DEMO-DEPLOYMENT.md` |
| VPS runbook (Caddy or nginx) | `docs/operations/VPS-DEPLOYMENT-CADDY.md` |
| Second instance on one VPS | `docs/operations/VPS-SECOND-INSTANCE.md` |
| Day-2 ops (backups, Sentry, rate limits, scaling) | `docs/operations/VPS-OPERATIONS-GUIDE.md` |
| Canonical product spec | `backend-frontend/technical-doc/island-tours-platform-master.html` |
| Task checklist | `backend-frontend/technical-doc/MASTER-CHECKLIST.md` |
| Architecture, booking, availability, FX, settlement, queues | `backend-frontend/technical-doc/02-architecture/` |
| Backend module patterns + the critical rules | `backend-frontend/CLAUDE.md` |
| Public-site patterns | `backend-frontend/frontend/CLAUDE.md` |
| Dashboard patterns | `dashboard/CLAUDE.md` |

Where any doc disagrees with the master spec, the master wins — **except** on repo layout, git
remotes, and deployment, where this file wins, because the master and its derivations were written
for the three-repo production workspace.

---

## 8. Open items

- **The admin login gate is not merged yet.** `dashboard/app/(login)/` has `portal` and `staff` but
  no `admin` route. The backend already accepts the surface (`x-login-surface: admin`) and
  `dashboard/components/login/login-ui.tsx` still links outward via `NEXT_PUBLIC_ADMIN_LOGIN_URL`.
  Merging the gate means adding the `admin` door here and dropping that outward link.
- **`ONBOARDING.md` (beside this file) still describes the three-repo world.** It is a good narrative
  tour of the product; its repo/deployment sections are stale.
- **`tripwheel-app/` is undeployed.** Deleting it is a decision, not a deployment step.
