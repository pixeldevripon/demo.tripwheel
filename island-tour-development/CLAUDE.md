# Island Tours — CLAUDE.md

> **Canonical source of truth: `technical-doc/island-tours-platform-master.html`** (v1.9). It
> supersedes every other doc on any disagreement. The docs below are the engineer-facing
> derivations of it.
>
> Architecture/IA: `technical-doc/02-architecture/PLATFORM-ARCHITECTURE.md` · System/backend:
> `technical-doc/02-architecture/ARCHITECTURE-OVERVIEW.md`
> Commercial (tiers/ranking/eligibility): `technical-doc/02-architecture/COMMERCIAL-MODEL.md`
> Booking & payments: `technical-doc/02-architecture/BOOKING-AND-PAYMENTS.md` · Availability:
> `technical-doc/02-architecture/AVAILABILITY-AND-DEPARTURES.md` · Tracking:
> `technical-doc/02-architecture/TRACKING-AND-ANALYTICS.md`
> FX & multi-currency (how conversion works, providers, env, snapshots, spotlight commission):
> `technical-doc/02-architecture/FX-AND-MULTI-CURRENCY.md`
> Instagram feed (auto-sync flow, dashboard access token, sync cadence, token refresh, mirroring, code map):
> `technical-doc/02-architecture/INSTAGRAM-FEED.md`
> Notifications (who is told what, on both channels - the full action/audience/permission matrix):
> `technical-doc/02-architecture/NOTIFICATIONS-AND-ALERTS.md`
> Custom scripts (admin-pasted vendor snippets on every public page; the allowlist,
> what is deliberately NOT validated, where each tag actually lands):
> `technical-doc/02-architecture/CUSTOM-SCRIPTS.md`
> Settlement & payouts (v1/v2 money flow, settlements ledger):
> `technical-doc/02-architecture/SETTLEMENT-AND-PAYOUTS.md` (visual:
> `technical-doc/02-architecture/settlement-payout-flow.html`) · Event-driven & queues (BullMQ,
> outbox, no-queue-for-capacity): `technical-doc/02-architecture/EVENT-DRIVEN-AND-QUEUES.md`
> Data model: `technical-doc/02-architecture/DATA-MODEL.md` · Routing:
> `technical-doc/02-architecture/ROUTING-AND-RESOLUTION.md` · Slug registry:
> `technical-doc/02-architecture/SLUG-REGISTRY.md`
> Implementation: `technical-doc/03-implementation/IMPLEMENTATION-GUIDE.md` · Trip module:
> `technical-doc/03-implementation/TRIP-MODULE.md`
> Booking flow: `technical-doc/03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md` · **Booking checklist
> (every booking/settlement/queue task + build status + flaws, cross-checked vs code):
> `technical-doc/03-implementation/BOOKING-CHECKLIST.md`** · Booking widget (dynamic/conditional card
> + payment/processing page checklist): `technical-doc/03-implementation/BOOKING-WIDGET-CHECKLIST.md`
> Multilingual: `technical-doc/04-multilingual/MULTILINGUAL-CONTENT.md` · Access:
> `technical-doc/05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md` · Staff & teams (seats,
> designations, effective-permission engine): `technical-doc/05-access-management/STAFF-AND-TEAMS.md`
> Frontend/widget reference: `CLAUDE-reference.md`
> **Single checklist (every master point as a task + status + migration order):
> `technical-doc/MASTER-CHECKLIST.md`** · Superseded docs: `technical-doc/obsolete/`

---

## Checklist — keep it current

`technical-doc/MASTER-CHECKLIST.md` is the single source of truth: it lists **every master point as
a task** with its build status and the dependency-ordered migration plan. **Update it in the same
commit/response as the implementation work** — flip `- [ ]` → `- [x]`, correct stale lines, and keep
the progress table accurate.

---

## What this project is

A Caribbean tour marketplace (reseller — commission on local operators). **Admins** manage
destinations, categories, hubs, and collections. **Operators** list tours and choose a
**commission tier** that drives their ranking and visibility. **Travelers** discover via three
parallel layers (Categories | Activity Hubs | Collections) plus All Tours, filter by attributes,
and book instantly — no enquiry model.

**Placement is governed by commission tiers, not slots.** Operators pick a tier
(`premium 30% / featured 27.5% / boosted 25% / organic 22.5% / standard 20%`, plus
`Destination Spotlight 35%`); listings are ordered by `tier_rank ASC, quality_score DESC, id ASC`
with an eligibility engine and a nightly quality-score job. There is **no featured-slot economy**
(the old `FeaturedSlot`/`SlotLock`/`Waitlist` system is removed — see
`technical-doc/02-architecture/COMMERCIAL-MODEL.md`).

**Launch destinations:** Curaçao (launch), Aruba, Sint Maarten live; Saint Lucia and Bahamas are
seeded pipeline rows. **7 locales:** EN (primary), NL, DE, FR, ES, PT, ZH — English slugs in every
locale. A tour belongs to 1 destination, **1+ categories** (one `isPrimary`), **0–n hubs**, and has
one canonical flat URL `/{locale}/{destination}/{tour-slug}/`.

---

## Repo layout — this is a three-repo product

This repo is **not** the whole system. Three sibling checkouts live under
`tripwheel-x-islandtours/`, each with its own git remote and its own branch:

| Repo | What it is | Port |
|---|---|---|
| `island-tour-development` (this one) | `backend/` NestJS API + `frontend/` public site | 5050 · 3000 |
| `tripwheel-x-islandtours-dashboard` | Operator + admin CRM. Standalone Next.js, shares no code with the public site | 3001 |
| `tripwheel-app` | Tripwheel system-admin door. Currently only `app/(auth)` — login/forgot/reset | 3002 |

### Push remotes — per repo, and NOT a shared convention

| Repo | Push to | Base |
|---|---|---|
| `island-tour-development` (this one) | **`pixelvega`** | `prod` |
| `tripwheel-x-islandtours-dashboard` | **`pixelvega`** | `main` |
| `tripwheel-app` | **`pixelvega`** | `main` |

**This repo has FOUR remotes** — `org` (tripwheel-io), `org-personal` (devripon-tr), `origin`
(Deveripon) and `pixelvega` (pixeldevripon/island-tours). Only the last is the push target, and the
base branch is `prod`, not `main`. Name the remote and the branch explicitly on every push: a bare
`git push` sends work to whichever remote the branch happens to track, across four different GitHub
accounts.

`origin` is stale in the dashboard repo too (devripon-tr, 103 commits behind as of 2026-08-02) — a
PR opened against it spans the whole backlog instead of your change.

**Only `backend/` owns a database.** The dashboard and the public site have no Prisma client and
no `DATABASE_URL` — every read and write is an HTTP call to `:5050`. This is rule #14 ("only one
Prisma instance per process") expressed across repos.

Cross-repo coupling to respect when changing anything:

- **`lib/config/rbac.ts` in the dashboard mirrors `backend/src/config/roles.config.ts`.** Adding or
  renaming a `Permission` means editing both repos or the dashboard silently mis-gates the UI.
- **Backend `CORS_ORIGINS` must list `http://localhost:3001`.** Every dashboard API call runs in the
  browser with credentials; omit the origin and all of them CORS-fail.
- **The dashboard POSTs cache revalidations to the public site** (`REVALIDATE_TARGET_URL` →
  `http://localhost:3000/api/revalidate`), authenticated with `INTERNAL_API_SECRET` — which must
  match the backend's and must never be `NEXT_PUBLIC_`-prefixed.
- **The Better Auth session cookie is issued by the backend** and scoped to the shared parent domain
  (`COOKIE_DOMAIN`). No frontend ever runs `betterAuth()` itself (rule #12).
- Ports are pinned, not incidental. 3000/3001 cannot be swapped — the revalidation target depends on
  the split.

> The **Frontend dashboard RBAC pattern** and **translation form** sections below describe the
> dashboard repo, not `frontend/` in this one. `frontend/` is the public site only: its routes are
> `app/(frontend)/[locale]/...` plus `app/(login)/`.

---

## Backend structure

```
backend/
├── src/
│   ├── app.module.ts · main.ts · env.validate.ts
│   ├── auth/                    ✓ Better Auth, guards, decorators
│   ├── common/                  ✓ shared DTOs, filters, utils
│   ├── prisma/                  ✓ PrismaService (@Global)
│   ├── users/                   ✓
│   ├── operators/               ✓ (add cancellation_rate_90d, contact_email/phone)
│   ├── destinations/            ✓
│   ├── categories/              ✓ (gating → ≥3; remove slot seeding)
│   ├── hubs/                    ✓
│   ├── collections/             ✓
│   ├── tours/ + tours-children/ ✓ (OCTO product; routes /tours; tier columns + E.3 fields + payment_model)
│   ├── attributes/              ✓ dictionary + per-tour values + filters
│   ├── slug-registry/           ✓ (add 301 redirects + 90-day cooldown)
│   ├── search/                  ⚠️ basic; faceted/two-stage ranking pending
│   ├── settings/ · media-gallery/ · mail/   ✓
│   ├── tiers/ (ranking, eligibility, quality_score)   ← to build
│   ├── availability/ (schedules, exceptions, departures) ← to build
│   ├── bookings/ · payments/ (Stripe, 4 models, webhooks) ← to build
│   ├── reviews/                 ← to build
│   ├── inbox/                   ✓ dashboard bell/badges/digest (NOT notifications/, which is OCTO webhooks)
│   ├── recommendations/         ✓ post-booking promo (TYP + email): typed, internal/external, placement-controlled
│   ├── tracking/ (TYP, booking_complete, CAPI)  ← to build
│   └── workers/ (BullMQ nightly jobs, email, materialization) ← to build
├── prisma/                      ← split schema (Prisma 7 merges automatically)
└── ...
```

> Removed: `slots/`, `waitlist/` modules and the `featured-slots.prisma` / `waitlist.prisma`
> schema files (tier economy replaces them). See `MASTER-CHECKLIST.md` → "Remove (was the slot economy)".

---

## Commands

```bash
pnpm dev:backend             # NestJS on http://localhost:5050
pnpm prisma:generate         # regenerate client after schema changes
pnpm prisma:migrate          # create + apply migration (dev)
pnpm prisma:migrate:deploy   # apply pending migrations (production)
pnpm prisma:migrate:reset    # reset DB + re-apply all (dev only)
pnpm prisma:studio · pnpm prisma:format · pnpm prisma:validate
```

---

## Tech stack (backend)

| Layer | Tool |
|---|---|
| Framework | NestJS 11 — strict TypeScript |
| Database | PostgreSQL via Prisma ORM (split schema) |
| Auth | Better Auth — backend only |
| API docs | `@nestjs/swagger` — Swagger UI at `/api/docs` |
| Validation | `class-validator` + `class-transformer` — global `ValidationPipe` |
| Rate limiting | `@nestjs/throttler` — global guard |
| Payments | Stripe (deposit/full); operator-managed balance on `operator_link` |
| Email | Resend (Postmark fallback) |
| Jobs | BullMQ (nightly quality-score/eligibility/materialization, email, AI translation) |
| Package manager | pnpm |

---

## Platform entities — who controls what

| Entity | Create | Notes |
|---|---|---|
| Destinations | Admin | Islands; pre-seeded; `is_seeded` protects from delete; grouped by region (data attribute, no URL) |
| Categories | Admin | **19 global** categories; page renders only at **≥3** published tours per destination |
| Hubs | Admin | Destination-specific; `hub_type` = location/highlight/area |
| Collections | Admin | Curated/filtered editorial lists (manual or dynamic) |
| Tours | Operators | 1 destination → **1+ categories** (one `isPrimary`) → **0–n hubs**; one flat canonical URL |
| Commission tier | Operators | Operator picks tier (eligibility-gated, 30-day lock); drives ranking + deposit_pct |
| Destination Spotlight | Operators → Admin | Request + admin approval; max 3 per destination; separate block |
| Top Island Experiences | Admin | Categories and Hubs only — never individual tours |
| Page editorial content | Admin | About/FAQ per destination/category/hub/collection |
| Attributes / Filters | Admin (dictionary) + Operator (per-tour values) | `attribute_definitions` + `tour_attributes` |

**Slug registry write rules** (all transactional with the entity):
- Category create → 1 `slug_registry` row **per active destination**
- Hub create → 1 row for its destination
- Collection create → 1 row for its destination
- Tour create → **always** 1 `TOUR` row (flat `/{dest}/{tour-slug}/`; hubs have no URL effect)
- Slug rename → auto `301` in the redirect table; deleted slug → **90-day reuse cooldown**

**Commission tier rules:**
- New tours default to `tier_key='standard'` (`commission_tier=20.0`, `tier_rank=5`)
- `tier_rank` is denormalized from `tier_key`, **never client-written**
- On tier change, `tier_key`/`commission_tier`/`tier_rank` update together and
  `tier_locked_until = now + 30 days`; changes are rejected while locked
- Existing bookings keep their snapshotted commission; tier changes are never retroactive

---

## Slug registry — how it works

> Full detail: `technical-doc/02-architecture/SLUG-REGISTRY.md`.

The `[slug]` segment is ambiguous (category, hub, collection, or destination-only tour). The slug
registry resolves it.

```
slug_registry
  id · destination_slug · slug · entity_type ('category'|'hub'|'collection'|'tour'|'reserved')
  entity_id (NULL only for 'reserved') · is_active (default true)
  UNIQUE (destination_slug, slug)
```

- `is_active = false` when an entity is disabled — the row stays (protects the slug), the page 404s.
- `tours` is reserved at every destination (`entity_type: 'reserved'`).
- 19 categories + reserved `tours` = **20 protected slugs per destination**.
- Slugs are always English; unique per `(destination_slug, slug)`; the same slug is allowed across
  destinations.
- Renames create a 301 redirect automatically; deleted slugs wait out a 90-day cooldown before reuse.

---

## Prisma schema layout

Split schema in `backend/prisma/` (Prisma 7 merges all `.prisma` files). `prisma generate` is
prepended to `build`/`start*`.

```
prisma/
├── schema.prisma          generator + datasource only
├── enums.prisma           all platform enums (Locale, Role, Permission, TripStatus, TierKey,
│                          PaymentModel, EligibilityState, DepartureStatus, …)
├── user.prisma            Better Auth: User, Session, Account, Verification
├── operators.prisma       Operator (+ company/social/Stripe/Mollie configs)
├── destinations.prisma    Destination, Hub (+ allowed categories, our picks, comparison), content
├── categories.prisma      Category (+ translation, page content)
├── collections.prisma     Collection (+ translation, page content)
├── trips.prisma           Trip + children (images, age bands, add-ons, languages, highlights,
│                          inclusions, exclusions, translations) + TourCategory + TourHub + tier cols
├── attributes.prisma      AttributeDefinition, TourAttribute
├── slug-registry.prisma   SlugRegistry (+ redirects table — to add)
├── availability.prisma    availability_schedules, availability_exceptions, departures  ← to add
├── calendar-feeds.prisma  CalendarFeed — tokenized read-only iCal export (bookings / departures)
├── bookings.prisma        Booking (E.8 expansion: refs, multi-currency, commission, payment_model) ← expand
├── reviews.prisma         Review (E.7 expansion) ← expand
├── wishlist.prisma        Wishlist
├── faq.prisma             Faq (polymorphic; pageType + entityId)
├── recommendations.prisma RecommendationCategory + Recommendation + RecommendationTranslation - post-booking promo (TYP + email)
├── media-gallery.prisma · settings.prisma · webhooks.prisma
└── migrations/
```

> To delete: `featured-slots.prisma`, `waitlist.prisma` (slot economy removed). See alignment
> checklist Phase 1.

---

## API conventions

- Base URL `http://localhost:5050/api/v1`; auth at `http://localhost:5050/api/auth/*` (no `/v1`);
  Swagger at `http://localhost:5050/api/docs`.
- Authenticated routes require the `better-auth.session_token` cookie.
- TYP route has **no** locale prefix and is noindex: `/{destination}/thank-you/{public_ref}`.

---

## Three user roles

| Role | Created by | Key capability |
|---|---|---|
| USER | Auto on first booking | Browse, book, review, wishlist |
| TOUR_OPERATOR | Admin-invited (set-password email) | Create tours, choose commission tier, manage availability |
| ADMIN | Database seed only | Full platform management + Spotlight approval + force-majeure pardons |

Operators inherit USER; admins inherit USER + OPERATOR. `EDITOR`/`STAFF`/`GUIDE` are modeled but
not launch-active. Full map: `technical-doc/05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md`.

## Auth guard execution order

```
ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard
```

Do not reorder. Use `@RequirePermissions()` on endpoints, not `@Roles()`.

---

## Module code patterns

Every new module follows `src/users/` (the authoritative reference).

### File structure
```
src/<module>/
├── dto/<module>.dto.ts      ALL DTOs: response, query, request
├── <module>.swagger.ts      one decorator function per endpoint
├── <module>.service.ts      all business logic
├── <module>.controller.ts   thin routing only
└── <module>.module.ts
```

### DTO conventions
Three categories in order: Response → Query → Request.
- `@ApiProperty` on every response field with `example:`; `@ApiPropertyOptional` on optional fields.
- Required response fields use `!`. Numeric query params need `@Type(() => Number)`.
- Paginated wrapper: `{ total, page, limit, data: [...] }`.

### Swagger conventions
- Always `type:` (never `schema:`); `404` uses `type: NotFoundErrorDto`.
- Import error DTOs from `@/common/dto/error-responses.dto`. One decorator function per endpoint.

### Controller conventions
- Static routes BEFORE dynamic (`:id`) routes — NestJS matches top-to-bottom.
- `import type { TypedAuthUser }` (satisfies `isolatedModules`). No business logic, try-catch, or
  Prisma calls in controllers.

### Service conventions
- `private readonly logger = new Logger(<Service>.name)`; log all mutating admin actions.
- No try-catch for HttpExceptions (Nest handles them); only catch Prisma unique violations → 409.
- Always use `select:` in Prisma queries — never return raw rows. Guard business rules in the service.

### Module registration
Add every new module to `AppModule.imports`. `PrismaService` is `@Global()` — do NOT import a
PrismaModule inside individual modules.

---

## Critical rules — never break these

1. **`@/` path alias for all internal imports** (`@prisma/client` is the standard-package exception).
2. **Global ValidationPipe strips unknown fields** (`whitelist` + `forbidNonWhitelisted`). Every
   request body needs a matching DTO class.
3. **ADMIN role is a strict superset** of all lower roles. Re-check on every `Permission` extension.
4. **Slug-registry rows are transactional** — written in the same `$transaction` as the entity.
5. **Category create writes a `slug_registry` row for ALL active destinations** (one per destination,
   same transaction). It does **not** seed any slot rows.
6. **New tours default to `tier_key='standard'`** (`commission_tier=20.0`, `tier_rank=5`). Do not
   create any FeaturedSlot rows — the slot economy is removed.
7. **`tier_rank` is denormalized from `tier_key` and never client-written.** On tier change all FOUR
   tier fields update together - `tier_key`/`commission_tier`/`tier_rank`/**`deposit_pct`** (LD24:
   the deposit IS the commission collection, so `deposit_pct` always equals the tier rate; this
   includes the nightly demotion path) - and `tier_locked_until = now + 30 days`.
8. **Every tour is flat and always writes a `TOUR` `slug_registry` row** on create (toggled on
   archive/restore, removed on hard delete per the 90-day cooldown). Hubs are discovery tags with no
   URL effect.
9. **Destinations with `is_seeded = true` cannot be deleted** (403 in the service).
10. **Never let the frontend set user roles.** Role changes only via `@Roles(Role.ADMIN)` endpoints.
11. **ThrottlerGuard is global and runs first** (20/s · 300/min · 3000/hr). Lives in `AuthModule`.
12. **Better Auth lives on NestJS only.** The frontend never runs `betterAuth()`.
13. **CORS must have `credentials: true`** — use `parseCorsOrigins()` in `main.ts` and `auth.instance.ts`.
14. **Only one Prisma instance per process.** The frontend has no `prisma/` and no `DATABASE_URL`.
15. **Webhook endpoints bypass AuthGuard and ThrottlerGuard** (`@Public()` + `@SkipThrottle()`).
    Stripe webhooks verify signatures and are idempotent via the `stripe_webhook_events` table.
16. **Use `AuthenticatedRequest` and `TypedAuthUser`** from `@/auth/auth.types` (never inline casts).
17. **Guards and decorators keep their instructional JSDoc** (What it does + Dependencies + Usage).
18. **BullMQ is for the master's async work** — nightly quality-score/eligibility/materialization
    jobs, transactional email, and AI translation. (No slot-lock or waitlist-offer jobs — removed.)
19. **Trip ownership uses `operator.id`, not `user.id`.** `trips.operatorId` is a FK to
    `operators.id`. The service resolves `user.id` → `operator.id` (`resolveOperatorId`) before any
    write or ownership check. `ADMIN` is auto-provisioned an operator on first create and bypasses
    ownership; a `TOUR_OPERATOR` with no operator record throws 400.
20. **`cancellation_hours` is enum-bound `[24, 48, 72, 168]`, default 48**, NOT NULL — a listing
    requirement (every published tour carries a free-cancellation window).
21. **`payment_model` is snapshotted onto the booking** at creation
    (`operator_link`/`on_arrival`/`paid_in_full`/`operator_full`). `operator_full` takes no payment
    and is created confirmed at commit (no Stripe charge, no webhook).
22. **Conversion value is `commission_amount` in EUR**, never GMV (tracking). A confirmed booking
    with a null `commission_amount` is data corruption: render error, no conversion fired.
23. **`is_locals_favourite` is an editorial flag, never operator-set.** It is manual, never
    tier-linked, target ~30% coverage. Only admins with `MANAGE_EDITORIAL` toggle it, via
    `PATCH /tours/:id/locals-favourite` (curated on the `/dashboard/locals-favourites` page).
    It is NOT in `CreateTourDto`/`UpdateTourDto` and must never be re-added to the operator
    tour form. See `technical-doc/LOCALS-FAVOURITE-EDITORIAL-CHECKLIST.md`.

---

## Frontend translation form patterns

Apply to every multilingual module (Category, Hub, Collection, Trip, and future entities).

### Upsert translation payload shape
The backend wraps translation fields inside a `fields` key — never send them flat (flat → 400
`forbidNonWhitelisted`):
```typescript
{ fields: { name, overview, h1Override, breadcrumbLabel }, isMachineTranslated?: false }
```

### English (base-locale) tab rules
- `name` is read-only (canonical value, edited in the Details tab); all other fields editable via
  `LocaleTab` with the `disableNameField` prop.
- The English "Delete translation" button must NOT call the delete endpoint (backend blocks it).
  Instead it upserts the editable fields as `null` — label it "Clear Fields". Branch `handleDelete`
  on `disableNameField`.

---

## Frontend create form — slug field pattern

- **Create mode:** slug field shown, auto-generates from name as the user types; once manually
  edited (`slugTouched`), auto-generation stops.
- **Edit mode:** slug is editable with a note that renaming issues a 301 redirect (master allows
  renames; the redirect table + 90-day cooldown protect old URLs).
- Backend `CreateXxxDto` accepts an optional `slug?`; the service uses `dto.slug ?? generateSlug(
  dto.name)` and always normalizes via `generateSlug`. Keep the frontend `toSlug()` in sync with the
  backend util (NFD strip, lowercase, hyphenate, collapse, trim).

---

## Frontend dashboard RBAC pattern

Role is resolved server-side in the dashboard layout and distributed via `RoleContext`.

- **`lib/config/rbac.ts`** mirrors `backend/src/config/roles.config.ts` — keep in sync.
- `useRole()` → `{ role, can, canAny }`.
- Gate: "Add X" buttons (`CREATE_*`/`MANAGE_*`), bulk Delete, row-action Delete, Danger Zone
  (`DELETE_*`/`MANAGE_*`), admin-only panels (`MANAGE_SYSTEM`/`MANAGE_USERS`).
- Do NOT gate sub-actions inside an already-protected page, or individual form fields (gate the
  page/form).

| Module | Create | Edit | Delete |
|---|---|---|---|
| Destinations | `CREATE_DESTINATION` | `EDIT_DESTINATION` | `DELETE_DESTINATION` |
| Categories | `CREATE_CATEGORY` | `EDIT_CATEGORY` | `DELETE_CATEGORY` |
| Hubs | `MANAGE_HUBS` | `MANAGE_HUBS` | `MANAGE_HUBS` |
| Collections | `CREATE_COLLECTION` | `EDIT_COLLECTION` | `DELETE_COLLECTION` |
| Tours | `CREATE_TRIP` | `EDIT_TRIP` | `DELETE_TRIP` / `MANAGE_TRIPS` |

For every new module: check `rbac.ts` for the right `Permission` key(s); import `useRole` in the
table, row-actions, and form; gate Add / bulk Delete / row Delete / Danger Zone.

---

## Frontend (public site) — coding patterns

### File locations
```
app/(frontend)/                  public site route group
  layout.tsx                     imports frontend-tokens.css; wraps with .frontend-root
  frontend-tokens.css            all --it-* design tokens (frontend scope only)
components/frontend/             all public-facing components
```

### Icons — SVG files in `public/icons/`, rendered via `next/image`
Pull the exact SVG from Figma, save it as a file, render with `next/image` (never inline `<svg>` or
a lucide stand-in for a Figma icon). Section-prefix filenames (`nav-*`, `hero-*`, `footer/*`). Keep
the Figma colour baked in (a `next/image` SVG is not recolourable by Tailwind text utilities). Set
`width`/`height` to the export's intrinsic size; size on screen with a `size-*` class; `alt=''` for
decorative icons. `lucide-react` is allowed only for generic affordances not in Figma (hamburger,
chevrons, back arrow).

### Always Tailwind classes — never inline style objects
`--it-*` vars are registered in `@theme inline`, so they map to utilities: `bg-it-primary`,
`text-it-ink`, `rounded-it-full`, `shadow-it-md`, `font-it-display`. Never
`style={{ background: 'var(--it-primary)' }}`.

### Fonts & Tailwind v4
SF Pro system stack (`font-it-display`, `font-it-body`) — no `next/font`. Use canonical v4 classes:
`bg-linear-to-br`, `text-(--it-star-filled)`, `z-100`, scale tokens (`min-w-45`).

### Container & layout — reuse the section utilities (do NOT hardcode padding)
```tsx
<section className="it-section bg-it-white">   {/* vertical padding token */}
  <div className="it-container">                {/* max-width 1440 + horizontal padding token */}
```
If spacing is wrong, update the token in `frontend-tokens.css` — don't inline. Promote repeated
patterns (card, badge, pill) to `--it-*` tokens or `it-*` utilities.

### Tokenize colors only; metrics inline; px not rem
Colors → `--it-*` tokens + utilities. Font size / letter-spacing / line-height go inline as plain
Tailwind values (`text-[40px] leading-[1.2] tracking-[-0.012em]`). Use `px` in arbitrary values
(`h-[600px]`, not rem); em/unitless values stay as-is.
