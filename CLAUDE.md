# Tripwheel × Island Tours — workspace root

Island Tours is a Caribbean tour marketplace operating as a **reseller**: it earns commission on
bookings taken from local operators. Operators list single-day tours; travellers discover and **book
instantly** — there is no enquiry model.

> **This directory is not a git repo.** It is a container for three independent ones, so this file is
> **local and unversioned**. Repo-specific rules belong in that repo's own `CLAUDE.md`, which is
> versioned and travels with the code. Keep this file to what spans repos.

> **Read `ONBOARDING.md` (beside this file) first** for the narrative tour of the codebase. This file
> is the index and the rules — it deliberately does not repeat what ONBOARDING covers.

---

## 1. The three repos

| Repo | What it is | Stack | Port |
|---|---|---|---|
| `island-tour-development` | `backend/` API + `frontend/` public site | NestJS 11 · Prisma 7 · Postgres / Next.js 16 | 5050 · 3000 |
| `tripwheel-x-islandtours-dashboard` | Operator + admin CRM | Next.js 16, standalone | 3001 |
| `tripwheel-app` | **Different product.** Tripwheel marketing + login door; authenticates against `api.tripwheel.app`, *not* the Island Tours backend | Next.js 16 | 3002 |

**Only `island-tour-development/backend` owns a database.** The dashboard and the public site have no
Prisma client and no `DATABASE_URL` — every read and write is an HTTP call to `:5050`. Exactly one
Prisma instance exists in the whole system.

### Cross-repo coupling — none of this fails to compile

These are the traps. Every one of them is silent locally.

- **`lib/config/rbac.ts` (dashboard) mirrors `backend/src/config/roles.config.ts`.** Add or rename a
  `Permission` in one and the other must change too, or the dashboard silently mis-gates its UI. The
  backend change lands first.
- **Backend `CORS_ORIGINS` must list `http://localhost:3001`.** Dashboard API calls run in the
  *browser* with credentials; omit the origin and every one of them CORS-fails.
- **The dashboard POSTs cache revalidations to the public site** (`REVALIDATE_TARGET_URL` →
  `http://localhost:3000/api/revalidate`), authenticated with `INTERNAL_API_SECRET` — which must match
  the backend's and must **never** carry a `NEXT_PUBLIC_` prefix.
- **`lib/cache-tags.ts` is byte-identical in the dashboard and the public site.** `diff` between the
  two repos is the check; a drifted tag is rejected as `unknown_tag` at runtime.
- **Better Auth runs on the backend only.** No frontend calls `betterAuth()`; the session cookie is
  issued by the backend and scoped to the shared parent domain (`COOKIE_DOMAIN`).
- **Ports are pinned, not incidental.** 3000 and 3001 cannot be swapped — the revalidation target
  depends on the split.

---

## 2. Git — remote, branch, PR

**All three repos push to `pixelvega`. Every change goes on its OWN BRANCH and lands as a PR. Never
commit straight to the base branch.** Only the base differs:

| Repo | Remote | PR base |
|---|---|---|
| `island-tour-development` | `pixelvega` → `pixeldevripon/island-tours` | **`prod`** |
| `tripwheel-x-islandtours-dashboard` | `pixelvega` → `pixeldevripon/dashbaord-tripwheel-x-islandtours` *(the typo in that repo name is real)* | **`main`** |
| `tripwheel-app` | `pixelvega` → `pixeldevripon/tripwheel.app` | **`main`** |

```bash
git fetch pixelvega <base>
git switch -c <branch> pixelvega/<base>
# ... commit ...
git push -u pixelvega <branch>
gh pr create --base <base> --head <branch>
```

`island-tour-development` carries **four** remotes — `org` (tripwheel-io), `org-personal`
(devripon-tr), `origin` (Deveripon via the `github-personal` SSH alias) and `pixelvega`. Only the
last is the push target. A bare `git push` sends work to whichever remote the branch happens to
track, across four different GitHub accounts. **Name the remote and the branch explicitly, always.**

`origin` is stale in the dashboard too (devripon-tr, 103 commits behind as of 2026-08-02).

### No AI attribution

**Never** add `Co-Authored-By: Claude …` to a commit, or a "Generated with Claude Code" footer to a
PR body. Applies to all three repos.

---

## 3. Where the documentation is

**Canonical source of truth:** `island-tour-development/technical-doc/island-tours-platform-master.html`
(v1.9). Where any doc or any code disagrees with it, **the master wins**.

`island-tour-development/technical-doc/` is the doc tree:

| Area | Path under `technical-doc/` |
|---|---|
| Single task checklist — **update in the same commit as the work** | `MASTER-CHECKLIST.md` |
| Architecture / IA | `02-architecture/PLATFORM-ARCHITECTURE.md`, `ARCHITECTURE-OVERVIEW.md` |
| Commission tiers, ranking, eligibility | `02-architecture/COMMERCIAL-MODEL.md` |
| Booking & payments | `02-architecture/BOOKING-AND-PAYMENTS.md` · `03-implementation/BOOKING-CHECKLIST.md` |
| Availability & departures | `02-architecture/AVAILABILITY-AND-DEPARTURES.md` |
| Data model · routing · slug registry | `02-architecture/{DATA-MODEL,ROUTING-AND-RESOLUTION,SLUG-REGISTRY}.md` |
| FX & multi-currency | `02-architecture/FX-AND-MULTI-CURRENCY.md` |
| Settlement & payouts | `02-architecture/SETTLEMENT-AND-PAYOUTS.md` |
| Queues / outbox | `02-architecture/EVENT-DRIVEN-AND-QUEUES.md` |
| Tracking & analytics | `02-architecture/TRACKING-AND-ANALYTICS.md` |
| Custom scripts (admin-pasted vendor snippets) | `02-architecture/CUSTOM-SCRIPTS.md` |
| Notifications matrix | `02-architecture/NOTIFICATIONS-AND-ALERTS.md` |
| SEO strategy | `02-architecture/SEO-STRATEGY.md` |
| Multilingual (7 locales) | `04-multilingual/MULTILINGUAL-CONTENT.md` |
| Roles, access, staff & teams | `05-access-management/` |
| Rendering / revalidation | `02-architecture/{RENDERING,RENDERING-REVALIDATION-REVIEW}.md` |
| Email programme (wireframes + build status) | `emails/` |

Per-repo instruction files:

- `island-tour-development/CLAUDE.md` — backend module patterns, the 23 critical rules, Prisma layout
- `island-tour-development/frontend/CLAUDE.md` → `AGENTS.md` + `DASHBOARD-PATTERNS.md`
- `island-tour-development/frontend/CHANGELOG.md` — **the audit record**: what was fixed, what was
  deliberately *not* changed and why, and what is still open. Read before "improving" anything on the
  public site; several deliberate decisions look like bugs until you read the entry.
- `tripwheel-x-islandtours-dashboard/CLAUDE.md` · `tripwheel-app/CLAUDE.md`

---

## 4. Skills

Sixteen live in `island-tour-development/.claude/skills/` and are **directory-scoped** — they apply
when the files being changed are under `island-tour-development/`. The dashboard and `tripwheel-app`
define none of their own, so use the unscoped equivalents there.

| When you are… | Skill |
|---|---|
| Writing Next.js — file conventions, RSC boundaries, async APIs | `next-best-practices` |
| Touching `'use cache'`, PPR, `cacheLife`/`cacheTag`, `updateTag` | `next-cache-components` |
| Optimising React/Next performance | `vercel-react-best-practices` |
| Configuring Better Auth (server, adapters, sessions, plugins) | `better-auth-best-practices` |
| Hardening auth — rate limits, CSRF, trusted origins, cookies | `better-auth-security-best-practices` |
| Email/password flows, verification, reset, hashing | `email-and-password-best-practices` |
| Any Stripe work — API choice, Connect, billing, webhooks, keys | `stripe-best-practices` |
| Upgrading Stripe API/SDK versions | `upgrade-stripe` |
| Spec-driven change workflow | `openspec-{explore,propose,apply-change,update-change,sync-specs,archive-change}` |

**`next-cache-components` matters more than it looks.** The public site runs `cacheComponents: true`,
which changes rendering semantics and rejects route segment config at *build* time, not typecheck.

---

## 5. Review agents

Eight in `island-tour-development/.claude/agents/`. Two were purpose-built for the public site and
carry the project's own threat model and conventions:

- **`frontend-code-reviewer`** — DRY, SOLID, component purity, composition
- **`frontend-security-reviewer`** — the traveller-session trust boundary, Route Handlers, XSS sinks,
  cache poisoning, IDOR

Plus `security-code-reviewer`, `solid-dry-reviewer`, `performance-reviewer`, `seo-reviewer`,
`test-writer`, `e2e-test-writer` (broader, repo-wide).

**Run the two frontend ones in parallel and verify every finding against source before acting.** They
report false positives, and several past findings were correctly refuted.

---

## 6. Local development

| Service | Fact |
|---|---|
| Node · pnpm | v22 · v10 |
| Postgres | **17.4 only**, port 5432. 14 and 16 were uninstalled 2026-08-08 — two clusters on one port raced at boot and the app hit whichever won |
| Database | `island_tours` (**underscore**), role `devripon` |
| Redis | required by BullMQ; `redis-cli ping` → `PONG` |

**`island-tours` with a hyphen also exists on that cluster — it is a different, older project.** The
near-miss is easy to hit.

```bash
pnpm dev:backend                    # NestJS :5050
pnpm prisma:migrate:deploy          # apply migrations
pnpm prisma:seed  /  :seed:demo     # the DB is schema-only until you do
```

### Testing

| Where | Runner |
|---|---|
| `backend/` | Jest — `pnpm test` |
| `frontend/` | **Vitest** — `pnpm test` (300+ unit tests; added 2026-08-02, there were none before) |
| `frontend/e2e/` | Playwright — `pnpm test:e2e` |

Vitest covers pure modules, route handlers and client components. It does **not** replace Playwright:
async Server Components, `'use cache'` semantics, PPR boundaries and the real cookie jar are only
honest in `e2e/`.

### Known traps

- **A stale nested git repo exists at `backend/.git`.** Running `git status` from inside `backend/`
  reports dozens of phantom modified files (it tracks `node_modules/` and `dist/`). Always run git
  from the repo root. It should be deleted — that is the owner's call, not an agent's.
- **`nest build` emits `dist/src/main.js`, not `dist/main.js`** — `prisma/*.ts` in the TS program
  lifts tsc's `rootDir` to the project root. `docker-entrypoint.sh` resolves this at runtime.

---

## 7. Rules that are easy to get wrong

- **Money has two formatters and they are not interchangeable.** `formatPriceFrom` = listing "From"
  prices, whole amounts bare. `formatMoney` = concrete totals, always cents. Hand-rolling
  `symbol + number` is wrong in five of seven locales — ICU puts `€` *after* the number in de/fr/es,
  and the same is true of `$`.
- **Never let the frontend decide authorization.** All authority is in the backend; the frontend
  carries the traveller session token but never verifies it.
- **`encodeURIComponent` every path segment** interpolated into a backend URL. An unencoded route
  param resolves dot segments inside `fetch` and relocates the request.
- **Update `MASTER-CHECKLIST.md` in the same commit as the work.**
- **Backend: `@/` path alias for all internal imports**; global `ValidationPipe` strips unknown body
  fields (`whitelist` + `forbidNonWhitelisted`), so every request body needs a matching DTO.
- **Guard order is `ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`.** Do not reorder.
- **Comments in this codebase explain *why*, and they are usually right.** If a change would undo a
  documented tradeoff, re-read it before assuming it is wrong.
