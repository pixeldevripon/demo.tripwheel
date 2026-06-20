# Island Tours — System & Backend Architecture

> **Canonical source:** master §1 (platform/infra) and §2.5 (rendering), with §7.2 (placement engine) and §8 (tracking).
> **Purpose:** the system/backend architecture — stack, auth, data-access conventions, the Next.js rendering strategy per page type, and the nightly/async background jobs the platform requires. This is the engineering spine; for discovery/IA see [`PLATFORM-ARCHITECTURE.md`](./PLATFORM-ARCHITECTURE.md), for commercial logic see [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md).

---

## Table of Contents

1. [System in One Breath](#1-system-in-one-breath)
2. [High-Level Stack](#2-high-level-stack)
3. [Layer Responsibilities](#3-layer-responsibilities)
4. [Authentication & Authorization (Better Auth)](#4-authentication--authorization-better-auth)
5. [Data-Access Conventions](#5-data-access-conventions)
6. [Next.js Rendering Strategy (per page type)](#6-nextjs-rendering-strategy-per-page-type)
7. [Placement Engine — Architectural View](#7-placement-engine--architectural-view)
8. [Background & Nightly Jobs](#8-background--nightly-jobs)
9. [Tracking & Analytics Pipeline](#9-tracking--analytics-pipeline)
10. [Real-Time / SSE — Out of Scope](#10-real-time--sse--out-of-scope)
11. [Key Technical Decisions](#11-key-technical-decisions)

---

## 1. System in One Breath

Island Tours is a Caribbean tour marketplace (reseller; commission on local operators). Three actors:

- **Travelers** discover tours through three parallel discovery layers (Categories | Activity Hubs | Collections) plus All Tours, filter by attributes, and book instantly — no enquiry model.
- **Operators** list tours, pick a commission **tier** in their dashboard, and earn placement through tier rank + a quality score, gated by an eligibility engine.
- **Admins** manage destinations, categories, hubs, collections, approve Destination Spotlight requests, and issue force-majeure cancellation pardons.

Placement is **not** a slot economy. It is governed by **commission tiers + a ranking query + an eligibility engine** (master §7.2). See [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md).

Launch scope: **3 live destinations** in rollout order — Curaçao (launch), Aruba, Sint Maarten. Saint Lucia and Bahamas are seeded pipeline rows only (master §1.2).

---

## 2. High-Level Stack

| Layer | Tool | Notes |
|---|---|---|
| Backend framework | NestJS 11 — strict TypeScript | Modules follow `src/users/` pattern (see `CLAUDE.md`) |
| Database | PostgreSQL via Prisma 7 ORM | **Split schema** in `backend/prisma/*.prisma`; Prisma 7 merges all files |
| Auth | Better Auth — **backend only** | Session validation in NestJS; frontend never runs `betterAuth()` |
| Frontend | Next.js (App Router) + **next-intl** | 7 locales; all UI strings via next-intl, no hardcoded English |
| Payments | **Stripe** | Deposit/full charge at booking; webhook idempotency via `stripe_webhook_events` |
| Transactional email | **Resend** (Postmark fallback) | SPF/DKIM/DMARC on a dedicated transactional subdomain (e.g. `bookings@mail.island.tours`), separate from marketing |
| Async jobs | **BullMQ** (Redis-backed) | Email dispatch, departures materialization, demotion engine, AI translation — see §8 |
| Tracking | GTM + Google Ads + GA4 + Meta Pixel + **server-side Meta CAPI** | One `booking_complete` dataLayer event on the TYP; Consent Mode v2 — see §9 |
| Affiliate | **Trackdesk** | 8% of GMV from Island Tours' commission; attribution owned by our own `booking_complete` event |
| API docs | `@nestjs/swagger` | Swagger UI at `/api/docs` |
| Validation | `class-validator` + `class-transformer` | Global `ValidationPipe`, `whitelist` + `forbidNonWhitelisted` |
| Rate limiting | `@nestjs/throttler` | Global guard, three tiers (20/s · 300/min · 3000/hr) |

Hosting: Next.js frontend + Node.js backend on TripWheel infrastructure (master §1.5). One Prisma instance per process — the backend owns all DB access; the frontend has no `prisma/` folder and no `DATABASE_URL`.

---

## 3. Layer Responsibilities

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  — Next.js (App Router) + next-intl                  │
│  Server Components (ISR/SSR) render content pages from the     │
│  backend REST API. Client components handle the booking widget,│
│  filters, and dashboards.                                      │
│         │ REST (locale-aware content + booking) calls          │
└─────────┼──────────────────────────────────────────────────────┘
          │
┌─────────┼──────────────────────────────────────────────────────┐
│  BACKEND — NestJS 11                                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  BullMQ Workers   │  │  Nightly Jobs    │  │
│  │  (CRUD,auth, │  │  (email, mat'n,   │  │  (quality_score, │  │
│  │   booking,   │  │   demotion, AI    │  │   eligibility,   │  │
│  │   ranking)   │  │   translation)    │  │   aggregates)    │  │
│  └──────┬───────┘  └────────┬──────────┘  └────────┬─────────┘  │
│  ┌──────┴───────────────────┴──────────────────────┴────────┐  │
│  │  Service layer (destinations, categories, hubs, trips,    │  │
│  │  bookings, payments, reviews, availability, slug-registry)│  │
│  └──────────────────────────┬────────────────────────────--─┘  │
│  ┌──────────────┐  ┌─────────┴────────┐                         │
│  │  Prisma ORM  │  │  Redis (BullMQ)  │  Stripe · Resend · CAPI  │
│  │  PostgreSQL  │  │  queue + delays  │  (external integrations) │
│  └──────────────┘  └──────────────────┘                         │
└──────────────────────────────────────────────────────────────--┘
```

- **PostgreSQL** — single source of truth for everything: destinations, categories, hubs, collections, tours, attributes, slug registry, bookings, reviews, availability/departures, tier state.
- **Redis** — backs BullMQ only (job queue + delayed jobs). Not a primary store, not a pub/sub bus for live UI.
- **BullMQ** — all async/scheduled work: transactional email, departures materialization, the eligibility demotion engine, AI translation jobs (§8).
- **Stripe / Resend / Meta CAPI / Trackdesk** — external integrations called from the service layer.
- **Better Auth** — session validation on the backend (§4).

---

## 4. Authentication & Authorization (Better Auth)

Better Auth lives on the **NestJS backend only** (`CLAUDE.md` Rule #12). The frontend never instantiates `betterAuth()`; all session logic is server-side.

- `auth.instance.ts` creates the `betterAuth()` instance. `AuthGuard` reads `better-auth.session_token` (cookie or Bearer), calls `getSession()`, and attaches `{ user, session }` to the request.
- CORS must use `credentials: true` via `parseCorsOrigins()` in both `main.ts` and `auth.instance.ts` (`CLAUDE.md` Rule #13).

### Guard execution order (do not reorder)

```
ThrottlerGuard   → blocks rate-limited clients before any DB work
AuthGuard        → validates session; populates request.user
RolesGuard       → checks @Roles() metadata
PermissionsGuard → checks @RequirePermissions() metadata
```

Use `@RequirePermissions()` on endpoints, never `@Roles()` on individual endpoints. Use `AuthenticatedRequest` / `TypedAuthUser` for typed access.

### Roles (master §1.6, full detail in [`../05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md`](../05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md))

| Role | Created by | Key capability |
|---|---|---|
| USER | Auto on first booking | Browse, book, review |
| TOUR_OPERATOR | Self-registration | List tours, pick commission tier, request Spotlight |
| ADMIN | Seed only | Full management; approve Spotlight; issue force-majeure pardons |

EDITOR / STAFF / GUIDE are designed but **not launch-active**. ADMIN is a strict superset of all lower roles. Roles are set server-side only — the frontend must never send a `role` field (`CLAUDE.md` Rule #10). The role model must support the commercial actions (operator tier selection; admin Spotlight approval and pardons) even though operator/admin tooling is outside the master's consumer scope.

---

## 5. Data-Access Conventions

These hold for every module (authoritative reference: `src/users/`; see `CLAUDE.md` Module Code Patterns).

- **Split Prisma schema** in `backend/prisma/` — one `.prisma` file per domain; Prisma 7 merges them. `prisma generate` is prepended to `build`/`start`.
- **Always `select:`** in Prisma queries — never return raw DB rows.
- **No try-catch for HttpExceptions** (Nest handles them). Only catch Prisma unique-constraint violations → `409 ConflictException`.
- **Business rules live in the service**, not the controller. Controllers are thin routing only — no Prisma calls, no try-catch, no business logic.
- **Transactional invariants** — every entity write that touches `slug_registry` must do so inside a Prisma transaction with the entity create (`CLAUDE.md` Rule #4):
  - Category create → 1 `slug_registry` row **per active destination**, transactionally (Rule #5). **Do NOT seed FeaturedSlot rows** — that rule is removed under the tier model.
  - Hub / Collection create → 1 `slug_registry` row for its destination.
  - Tour create → always 1 `slug_registry` TOUR row; flat URL, no hub nesting (Rule #8).
- **Slug renames** create a 301 entry in a redirect table automatically; deleted slugs enter a **90-day soft-delete cooldown** before reuse (master §2.3). See [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) and [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md).
- **Logging** — `this.logger.log(...)` on all mutating admin actions.
- **Trip ownership** uses `operator.id`, not `user.id` (`CLAUDE.md` Rule #19) — resolve via `resolveOperatorId(userId, role?)`.

### Current code state (built vs. to build)

| Built (schema + module) | To build |
|---|---|
| auth, users, operators, destinations, categories, hubs, collections, trips (+children), attributes/filters, slug-registry (resolve), search (keyword V1), settings, media-gallery | commission tiers / `quality_score` / ranking / eligibility engine; bookings service; reviews service; payments + Stripe + webhooks; availability/departures model (only a simple `TourSchedule` exists today); tracking pipeline; BullMQ workers; nightly jobs |

> **To remove (legacy slot scaffolding):** `FeaturedSlot` / `SlotLock` / `SlotHistory` / `WaitlistEntry` exist in the schema and category-create currently seeds 3 `FeaturedSlot` rows. These are superseded by the tier model and must be removed. Tracked in the master checklist, not in this doc.
>
> **Mismatches to fix in code (master checklist):** `cancellationHours` default 24 → enum default 48; no `payment_model` field; thin Booking model; category gating likely ≥1 not ≥3; no 301/redirect table or cooldown.

---

## 6. Next.js Rendering Strategy (per page type)

Canonical table (master §2.5). All content API endpoints accept a `locale` query param defaulting to `en`, with English fallback for missing translations.

| Page type | Rendering | Revalidation |
|---|---|---|
| Homepage | ISR | 60s |
| Destination | ISR | 60s |
| All Tours | ISR | 60s |
| Category | ISR | 60s |
| Collection | ISR | 60s |
| Activity Hub | ISR | 300s |
| Tour detail | ISR | 30s |
| Search results | SSR | not cached |
| Thank You page (TYP) | Server-rendered | — (noindex; master §8.2) |

Tour detail uses the shortest revalidation (30s) because availability and pricing must stay current. Activity Hubs cache longest (300s) — predominantly static SEO content. Search is fully dynamic SSR. The TYP is server-rendered with `conversion_fired_at` set server-side before render for mark-first idempotency (§9).

---

## 7. Placement Engine — Architectural View

The placement engine replaces the legacy slot economy entirely. Full detail in [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md); the architectural shape:

### Tiers (operator-selected in the dashboard)

| tier_key | Commission | tier_rank |
|---|---|---|
| premium | 30% | 1 |
| featured | 27.5% | 2 |
| boosted | 25% | 3 |
| organic | 22.5% | 4 |
| standard (default) | 20% | 5 |
| **Destination Spotlight** | 35% | separate labeled block, max 3/destination, manual approval |

`standard` is the default and deliberately ranks below `organic`. Tour tier columns: `commission_tier DECIMAL(4,1)` default 20.0, `tier_key VARCHAR(20)` default `'standard'`, `tier_rank SMALLINT` default 5 (denormalized from `tier_key`, never client-written), `tier_locked_until TIMESTAMP` nullable, `quality_score DECIMAL(6,2)` default 0. On tier change all three tier fields update together and `tier_locked_until = now + 30 days`.

### Ranking (category page / search)

```
ORDER BY tier_rank ASC, quality_score DESC, id ASC
```

A **bookability filter** excludes a tour from every ranked result when `status != active`, `is_bookable = false`, or there is **no open departure in the next 30 days** — the next eligible tour moves up; the excluded tour is not billed for its tier during the unbookable period. A **diversity pass** runs after ranking. Destination Spotlight renders as a separate labeled block, never interleaved.

`quality_score` is computed by a nightly job and is **read-only at query time** (§8). `commission_rate` / `commission_amount` snapshot onto every booking at creation and never change retroactively.

---

## 8. Background & Nightly Jobs

The master requires the following async/scheduled work. **BullMQ** (Redis-backed) runs queued/delayed jobs; nightly jobs run on a schedule (cron-style trigger into a BullMQ queue or a scheduler).

### Nightly jobs

| Job | What it does | Source |
|---|---|---|
| **quality_score recompute** | For every active tour, recompute `quality_score` (0–100, read-only at query time): `(avg_rating/5)*40 + (min(review_count,100)/100)*25 + (listing_completeness/100)*20 + (conversion_rate/max_conv)*15`. `max_conv` = highest conversion rate among active tours in the **same category**, recomputed per run. | master §7.2 |
| **Departures materialization** | Materialize `departures` for **12 rolling months** from `availability_schedules` (weekly pattern) + `availability_exceptions` (per-date overrides). **Never touches** departures that have bookings, manual edits, or `source = api`. Single-day tours only (v1). | master §2 / E.9 |
| **Eligibility check → notify → grace → auto-demote** | After a tour's one-time 90-day provisional window (from first publish), nightly enforce the flat eligibility bar (5 reviews · rating ≥4.0 · operator cancellation rate ≤10% trailing 90 days, min 10 bookings, admin force-majeure pardons). On failure: notify the operator, allow **30 days of grace**, then **auto-demote to the highest tier the tour still qualifies for**. Existing bookings keep their snapshotted commission. | master §7.2 |
| **Operator aggregate recompute** | Recompute operator-level aggregates (rating, review count, cancellation rate over trailing 90 days) used by the eligibility check and by the LD11 review cold-start fallback. | master §7.2 / E.7 |

### Queued / delayed jobs (BullMQ)

| Queue | Trigger | What it does |
|---|---|---|
| **email** | Booking confirmed, etc. | Send transactional email via Resend (Postmark fallback) |
| **pre-tour reminder email** | Scheduled relative to departure | Send the pre-tour reminder (trigger + suppression rules, payment-model lines, upsell condition) — master §6.7 |
| **AI translation** | Content saved without a manual translation | Generate machine translations (marked `isMachineTranslated`) per [`../04-multilingual/MULTILINGUAL-CONTENT.md`](../04-multilingual/MULTILINGUAL-CONTENT.md) |
| **departures materialization** | Schedule/exception change or nightly tick | Re-materialize affected `departures` (respecting the never-touch rules above) |
| **demotion** | Driven by the nightly eligibility check | Apply the 30-day grace + auto-demotion transition |

Notes:
- Departures: `availability_schedules` (tour_id, weekday 0–6 Mon=0, start_time, capacity_override, valid_from/until, status), `availability_exceptions` (date, start_time nullable, type close_date/close_slot/add_slot/set_capacity, capacity, note, created_by), `departures` (UNIQUE (tour_id, date, start_time): capacity, booked_count, status open/closed/sold_out/cancelled, sold_out_at, source schedule/exception/api, external_ref, manually_edited). All party bands count toward capacity. Bookability = EXISTS an open departure within 30 days. See [`AVAILABILITY-AND-DEPARTURES.md`](./AVAILABILITY-AND-DEPARTURES.md).
- `quality_score` and the eligibility check are read-only at query time — ranking never recomputes them inline.

---

## 9. Tracking & Analytics Pipeline

Canonical: master §8; detail in [`TRACKING-AND-ANALYTICS.md`](./TRACKING-AND-ANALYTICS.md).

- **One** `booking_complete` dataLayer event on the Thank You page fans out to **4 GTM tags**: Conversion Linker, Google Ads, GA4 `purchase`, Meta Pixel — plus **server-side Meta CAPI** with event-id dedup against the Pixel event.
- **Conversion value = `commission_amount` in EUR**, never GMV.
- **Mark-first idempotency**: `conversion_fired_at` is set server-side before the TYP renders, so a refresh never double-fires.
- TYP route `/{destination}/thank-you/{bookingRef}` where `bookingRef = public_ref` (uuid, non-enumerable), **no locale prefix**, `noindex`.
- `operator_full` bookings bypass payment/webhook and are created confirmed at commit.
- **Consent Mode v2**: EEA denied by default, US/CA granted.
- **Stripe webhook idempotency** via a `stripe_webhook_events` table.
- **Affiliate (Trackdesk):** attribution is owned by our own `booking_complete` event; promo codes double as attribution IDs; commission goes on hold at booking and approves after the cancellation window closes (clawback-safe). See [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md).

Booking records carry click IDs (gclid/gbraid/wbraid/fbclid) and UTM (source/medium/campaign/term/content) for attribution; see [`BOOKING-AND-PAYMENTS.md`](./BOOKING-AND-PAYMENTS.md) and [`DATA-MODEL.md`](./DATA-MODEL.md).

---

## 10. Real-Time / SSE — Out of Scope

The legacy architecture used SSE + Redis pub/sub to broadcast live slot-state changes to operator browsers. **There is no slot economy**, so there is **no real-time requirement** in the master. SSE, WebSockets, and Redis pub/sub for live UI are **out of scope** unless a future need arises. Redis is retained only as the BullMQ backing store. ISR revalidation (§6) is sufficient for keeping content pages current.

---

## 11. Key Technical Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Placement engine | Commission **tiers + ranking + eligibility** (no slots) | Master §7.2. Ethical CRO; placement earned by tier rank + quality, not by holding a scarce slot. |
| Ranking order | `tier_rank ASC, quality_score DESC, id ASC` | Deterministic, same-tier collisions resolved by quality then id; no per-category tier cap. |
| quality_score | Nightly job, read-only at query time, 0–100 | Keeps ranking queries cheap; recomputed against per-category `max_conv`. |
| Eligibility enforcement | Nightly check → notify → 30-day grace → auto-demote | Flat bar after a 90-day provisional window; bookings keep snapshotted commission. |
| Availability | `availability_schedules` + `availability_exceptions` → materialized `departures` | Bookability = open departure within 30 days; nightly materialization of 12 rolling months. |
| Backend framework | NestJS 11 + Prisma 7 split schema | Modular, strict TS; one file per domain merged by Prisma 7. |
| Auth | Better Auth, backend-only | Single secret; frontend never runs `betterAuth()`. |
| Rendering | ISR per page type; SSR for search; server-rendered TYP | Master §2.5; balances freshness against SEO/perf. |
| Async work | BullMQ (Redis) | Email, materialization, demotion, AI translation. No SSE/pub-sub. |
| Payments | Stripe; webhook idempotency via `stripe_webhook_events` | 4 payment models snapshotted onto the booking. |
| Email | Resend (Postmark fallback) on a dedicated transactional subdomain | SPF/DKIM/DMARC; separate from marketing. |
| Tracking | Single `booking_complete` event → 4 GTM tags + Meta CAPI | Conversion value = `commission_amount` EUR; mark-first idempotency; Consent Mode v2. |
| Real-time | **None** (out of scope) | No slot economy → no live-update requirement. |
| Commission storage | `commission_rate` / `commission_amount` snapshot on the booking | Rates change; historical bookings must reflect the rate at booking time. |
