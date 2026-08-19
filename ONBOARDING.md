# Tripwheel × Island Tours — Engineering Onboarding

Island Tours is a Caribbean tour marketplace. It operates as a **reseller**: it earns a commission
on every booking taken from local operators. Operators list single-day tours, travelers discover and
**book instantly** — there is no enquiry model.

This guide gets you oriented across the codebase. The authoritative specification is
`island-tour-development/technical-doc/island-tours-platform-master.html` (v1.9) — where any doc or
any code disagrees with it, the master wins.

---

## 1. The product is three repos, not one

Everything lives under a single parent directory as **three independent git repos**:

| Repo | What it is | Stack | Port |
|---|---|---|---|
| `island-tour-development` | `backend/` API + `frontend/` public site | NestJS 11 · Prisma 7 · Postgres / Next.js | 5050 · 3000 |
| `tripwheel-x-islandtours-dashboard` | Operator + admin CRM | Next.js 16, standalone | 3001 |
| `tripwheel-app` | Tripwheel system-admin door (login only, today) | Next.js 16 | 3002 |

**Only `island-tour-development/backend` owns a database.** The dashboard and the public site have
no Prisma client and no `DATABASE_URL` — every read and write is an HTTP call to the backend. There
is exactly one Prisma instance in the whole system.

### Cross-repo coupling — the things that break silently

These are the traps. None of them produce a local type error.

- **`lib/config/rbac.ts` (dashboard) mirrors `backend/src/config/roles.config.ts`.** Add or rename a
  `Permission` in one and you must edit the other, or the dashboard mis-gates its UI.
- **Backend `CORS_ORIGINS` must list the dashboard origin.** Every dashboard API call runs in the
  *browser* with credentials; omit the origin and all of them are CORS-blocked.
- **The dashboard POSTs cache revalidations to the public site** (`REVALIDATE_TARGET_URL` →
  the public site's `/api/revalidate`), authenticated with a shared internal secret. That secret is
  server-only and must never carry a `NEXT_PUBLIC_` prefix.
- **Ports are pinned, not incidental.** 3000 and 3001 cannot be swapped — the revalidation target
  depends on the split.
- **Better Auth runs on the backend only.** No frontend ever calls `betterAuth()` itself; the
  session cookie is issued by the backend and scoped to the shared parent domain.

---

## 2. Backend

NestJS 11, strict TypeScript, ~44 feature modules all wired into `app.module.ts`. Split Prisma
schema across 35 `.prisma` files (Prisma 7 merges them automatically); `schema.prisma` holds only
the generator and datasource. ~106 migrations, ~106 unit spec files, 6 e2e suites.

Largest modules by volume: `tours/`, `bookings/`, `hubs/`, `common/`, `availability/`, `reviews/`,
`calendar-sync/`, `content-translation/`.

### Every module follows the same five-file shape

```
src/<module>/
├── dto/<module>.dto.ts      ALL DTOs, in order: Response → Query → Request
├── <module>.swagger.ts      one decorator function per endpoint
├── <module>.service.ts      all business logic
├── <module>.controller.ts   thin routing only — no logic, no try-catch, no Prisma
└── <module>.module.ts
```

`src/users/` is the authoritative reference to copy. Conventions that are enforced, not suggested:

- `@/` path alias for every internal import (`@prisma/client` is the one exception).
- The global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted` — **every request body needs
  a matching DTO class**, or fields are stripped and the request 400s.
- Always use `select:` in Prisma queries. Never return raw rows.
- Static routes must be declared **before** dynamic (`:id`) routes — NestJS matches top to bottom.
- Don't catch `HttpException`s; Nest handles them. Only catch Prisma unique violations → 409.

### Guard chain — fixed order, do not reorder

```
ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard
```

Rate limiting fires before session validation on every request, which is why `ThrottlerModule` lives
in `AuthModule` rather than `AppModule`. Gate endpoints with `@RequirePermissions()`, not `@Roles()`.

### API surface

Base URL `/api/v1`. Auth at `/api/auth/*` (no `/v1`). Swagger UI at `/api/docs`. Authenticated
routes require the Better Auth session cookie. Webhook endpoints deliberately bypass both AuthGuard
and ThrottlerGuard, verify signatures, and are idempotent via a webhook-events table.

---

## 3. The commercial model — read this before touching ranking

Placement is governed by **commission tiers**, not slots. An older "featured slot" economy
(FeaturedSlot / SlotLock / Waitlist) was removed entirely; if you find a reference to it, it is
stale documentation.

| Tier | Commission | Rank |
|---|---|---|
| `premium` | 30% | 1 |
| `featured` | 27.5% | 2 |
| `boosted` | 25% | 3 |
| `organic` | 22.5% | 4 |
| `standard` (default) | 20% | 5 |
| Destination Spotlight | 35% | separate block, max 3 per destination, admin-approved |

Ranking query: `ORDER BY tier_rank ASC, quality_score DESC, id ASC`, applied after a bookability
filter and a diversity pass. Tiers above `organic` unlock only past an eligibility bar (5 reviews,
rating ≥ 4.0, operator cancellation rate ≤ 10%), recomputed by a nightly job.

**The invariants:**

- `tier_rank` is denormalized from `tier_key` and is **never client-written**.
- On a tier change, four fields move together — `tier_key`, `commission_tier`, `tier_rank`, and
  `deposit_pct` — and `tier_locked_until` is set to now + 30 days. The deposit *is* the commission
  collection, so `deposit_pct` always equals the tier rate. This includes the nightly demotion path.
- Existing bookings keep their snapshotted commission. Tier changes are never retroactive.

---

## 4. Routing and the slug registry

Canonical tour URL is flat: `/{locale}/{destination}/{tour-slug}/`. A tour belongs to one
destination, one or more categories (exactly one `isPrimary`), and zero or more hubs. **Hubs are
discovery tags with no URL effect.**

The `[slug]` segment is ambiguous — it could be a category, hub, collection, or tour. The
`slug_registry` table resolves it, keyed `UNIQUE (destination_slug, slug)`.

- Registry rows are **transactional** — written in the same `$transaction` as the entity itself.
- Creating a category writes one row **per active destination**.
- Every tour always writes a `TOUR` row on create.
- Disabling an entity sets `is_active = false`; the row stays so the slug remains protected and the
  page 404s.
- Renames auto-create a 301 redirect. Deleted slugs wait out a 90-day reuse cooldown.
- Slugs are always English, in every locale. 19 categories + reserved `tours` = 20 protected slugs
  per destination.

---

## 5. Booking, payments, money

Four payment models, snapshotted onto the booking at creation: `operator_link`, `on_arrival`,
`paid_in_full`, `operator_full`. `operator_full` takes no payment and is created confirmed at commit
— no charge, no webhook.

`cancellation_hours` is enum-bound to `[24, 48, 72, 168]`, defaults to 48, and is NOT NULL: every
published tour carries a free-cancellation window.

**Conversion value is `commission_amount` in EUR — never GMV.** A confirmed booking with a null
`commission_amount` is data corruption: render an error and fire no conversion event.

Payments run through Stripe (deposit and paid-in-full collection), with Mollie also configured.
Display currency follows the locale (EN/ZH → USD, European locales → EUR) with a footer override.

---

## 6. Frontends

### Public site (`island-tour-development/frontend`)

Routes live under `app/(frontend)/[locale]/...` — destination, `[slug]` resolution, checkout,
thank-you, cancel, review, traveller, wishlist, search. ~222 components under `components/frontend/`.

- **Tailwind classes only — never inline style objects.** The `--it-*` tokens are registered in
  `@theme inline`, so they map to real utilities (`bg-it-primary`, `text-it-ink`, `shadow-it-md`).
- Reuse the section utilities `it-section` and `it-container`; never hardcode padding. If spacing is
  wrong, fix the token in `frontend-tokens.css`.
- Tokenize **colors only**. Font size, letter-spacing, and line-height go inline as plain Tailwind
  values. Use `px` in arbitrary values, not `rem`.
- Icons are SVG files in `public/icons/`, rendered via `next/image` — never inline `<svg>`. Keep the
  Figma color baked in; a `next/image` SVG can't be recolored by Tailwind text utilities.
- Fonts are the SF Pro system stack. No `next/font`.

The thank-you page has **no locale prefix** and is noindex: `/{destination}/thank-you/{public_ref}`.

### Dashboard (`tripwheel-x-islandtours-dashboard`)

~25 CRM route groups under `app/(app)/`. `lib/api/` has one file per backend module. Role is
resolved server-side in the layout and distributed via `RoleContext`; `useRole()` gives you
`{ role, can, canAny }`.

Gate these and only these: "Add X" buttons, bulk delete, row-action delete, Danger Zone, and
admin-only panels. Do **not** gate sub-actions inside an already-protected page, or individual form
fields — gate the page or the form.

The repo runs **two token systems on purpose**: dashboard tokens for admin UI, and the Island Tours
brand `--it-*` tokens for login surfaces only (scoped by `.frontend-root`). That fork is permanent,
not migration scaffolding — the two are allowed to drift.

---

## 7. Roles

| Role | Created by | Capability |
|---|---|---|
| USER | Auto, on first booking | Browse, book, review, wishlist |
| TOUR_OPERATOR | Admin-invited (set-password email) | Create tours, choose tier, manage availability |
| ADMIN | Database seed only | Full platform management, Spotlight approval, force-majeure pardons |

ADMIN is a **strict superset** of every lower role — re-verify this whenever you extend the
`Permission` enum. Operators inherit USER. `EDITOR`/`STAFF`/`GUIDE` are modeled but not
launch-active. **Never let a frontend set a user role**; role changes go through admin-gated
endpoints only.

Staff and operator seats share one model (`StaffDesignation` + `StaffMember`) behind an
effective-permission engine consumed by `PermissionsGuard`. Suspension is enforced immediately —
a suspended seat loses access on its very next request.

---

## 8. Editorial flags worth knowing

`is_locals_favourite` is an **editorial** flag, manually curated by admins with `MANAGE_EDITORIAL`,
targeting roughly 30% coverage. It is never operator-set and never tier-linked. It is deliberately
absent from the tour create/update DTOs and must never be re-added to the operator tour form.

---

## 9. Scope

Three live destinations, in rollout order: **Curaçao** (launch), **Aruba**, **Sint Maarten**. Saint
Lucia and Bahamas exist as seeded pipeline rows only. Seven locales — EN (primary), NL, DE, FR, ES,
PT, ZH. The schema scales to other regions with no structural change.

---

## 10. Running it

```bash
# from island-tour-development/
pnpm install:all
pnpm prisma:generate       # after any schema change
pnpm prisma:migrate        # create + apply a migration (dev)
pnpm dev                   # backend + public site together
pnpm test:backend

# dashboard, separately
pnpm dev                   # pinned to :3001
```

Copy each repo's `.env.example` / `.env.local.example` and fill it in — the examples document what
every variable is for. Secrets are never committed.

---

## 11. Where to read next

Inside `island-tour-development/`:

- `CLAUDE.md` — the working engineering rules, including the cross-repo section
- `technical-doc/README.md` — the navigable index to every active doc
- `technical-doc/MASTER-CHECKLIST.md` — build status, kept current with implementation work
- `technical-doc/02-architecture/COMMERCIAL-MODEL.md` — tiers, ranking, eligibility
- `technical-doc/02-architecture/BOOKING-AND-PAYMENTS.md` — payment models and money flow
- `technical-doc/02-architecture/DATA-MODEL.md` — canonical entity model

Superseded material is parked in `technical-doc/obsolete/` — if a doc contradicts the master or the
code, check there before trusting it.
