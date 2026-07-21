# Island Tours — Application Features & Task Status

> **Generated:** 2026-07-21
> **Supersedes:** `technical-doc/APPLICATION-FEATURES.md` (44 lines, materially stale — it marks
> bookings, payments, tiers, availability and reviews as not built when all five ship today).
> That file is left in place; treat **this** document as the current inventory.

---

## How this document was built

Every document under `technical-doc/` was read in full — including the canonical
`island-tours-platform-master.html` (14,795 lines) and the three client-provided design
sources — producing a **20,144-line** extraction corpus. In parallel, all three codebases
were audited directly.

**Status marks in Parts II–IV come from the code audit, not from the docs.** This matters:
the tracking checklists disagree with the shipped code in both directions, so a
doc-derived checklist would have been wrong. Where a document claims a different status
than the code shows, the code wins and the doc's claim is recorded inline as
`(docs claim: …)`.

### Sources

| Source | Scope |
|---|---|
| `island-tours-platform-master.html` v1.9 | Canonical spec — settles every conflict |
| `island-tours-booking-confirmation-email-wireframe.html` | Client-provided; binding for all booking email |
| `island-tours-login-pages.html` + login spec/rationale | Client-provided; 3 auth surfaces |
| `technical-doc/**` (~90 files) | Architecture, implementation, access, deployment, OCTO, dashboard extraction |
| `island-tour-development/backend` | NestJS 11 + Prisma/Postgres |
| `island-tour-development/frontend` | Next.js 16 public site |
| `tripwheel-x-islandtours-dashboard` | Standalone Next.js admin/operator dashboard |

### Codebase split

| Codebase | Path | Covered in |
|---|---|---|
| Backend | `island-tour-development/backend` | Part II |
| Public site | `island-tour-development/frontend` | Part III |
| Dashboard | `tripwheel-x-islandtours-dashboard` | Part IV |

---

## Status legend

| Mark | Meaning |
|---|---|
| `- [x]` | **Done** — code audit confirms built and wired |
| `- [~]` | **Ongoing** — exists but partial, stubbed, or has known defects; the bullet says what remains |
| `- [ ]` | **Pending** — not built |

`⚠️ CONFLICT` marks a point where sources disagree. Per project rule, the master doc is the
arbiter; where it is silent the item is escalated in Part V rather than silently resolved.

---

## Status roll-up

| Codebase | Done | Ongoing | Pending | Total |
|---|---:|---:|---:|---:|
| Backend (Part II) | 243 | 19 | 110 | 372 |
| Public frontend (Part III) | 224 | 38 | 191 | 453 |
| Dashboard (Part IV) | 187 | 15 | 122 | 324 |
| **Total** | **684** | **70** | **438** | **1,192** |

> The `MASTER-CHECKLIST.md` progress table reports ~23% complete (46/157/15 of 203). That figure
> is stale on both axes — it undercounts shipped work and its own per-section Done counts read 0
> for §3/§5/§7/§8 while items beneath them are `[x]`. Code-derived completion is materially higher.

### Highest-severity findings

| # | Finding | Where |
|---|---|---|
| 1 | Mollie-paid bookings stay `ON_HOLD` forever — webhook records an idempotency row but never confirms; no Mollie SDK installed | Part II |
| 2 | No analytics/tracking layer at all on the public site — `booking_complete` never fires; TYP conversion is a comment, not code | Part III |
| 3 | `StaticFxProvider` is bound in every environment, so production never truly fails closed | Part II |
| 4 | Nightly jobs run on in-process `@nestjs/schedule` — will double-run under a second replica | Part II |
| 5 | No `sitemap.ts`, `robots.ts`, or JSON-LD; hreflang/canonical only on the tour-detail route | Part III |
| 6 | ~~Homepage CMS loaders have zero callers~~ **STALE, fixed** — `app/(frontend)/[locale]/page.tsx` calls `getHomePageContent` (verified 2026-07-21) | Part III |
| 7 | `operator_full` specced as live in 5 docs, dropped from v1 by the 2026-07-15 locked decision | Part V |
| 8 | Category gating built at ≥1 published tour; canonical rule is ≥3 | Part II / V |
| 9 | Dashboard e2e suite ships ~80 checked-in failing directories — do not read as green | Part IV |
| 10 | Public frontend has zero test coverage (its only specs target the extracted dashboard) | Part III |

---

## Document structure

- **Part I — Feature & requirement inventory** (A–E): every feature and rule found in the docs
  - A. Platform foundation, IA, routing, SEO & rendering
  - B. Catalog entities, commercial model, ranking & badges
  - C. Availability, booking, payments, settlement, FX & transactional email
  - D. Public site pages, discovery, accounts, auth & tracking
  - E. Roles & access, dashboard, operations, infrastructure & OCTO
- **Part II — Backend task checklist**
- **Part III — Public frontend task checklist**
- **Part IV — Dashboard task checklist**
- **Part V — Conflicts, stale docs & open decisions**

---

# PART I — FEATURE & REQUIREMENT INVENTORY

## A. Platform Foundation, Information Architecture, Routing, SEO & Rendering

> Sources: master spec `island-tours-platform-master.html` v1.9 (June 11, 2026) §0–§5; `01-project-scope/PROJECT-SCOPE.md`; `02-architecture/ARCHITECTURE-OVERVIEW.md`, `PLATFORM-ARCHITECTURE.md`, `ROUTING-AND-RESOLUTION.md`, `SEO-STRATEGY.md`, `SLUG-REGISTRY.md`, `SOFT-DELETE-STRATEGY.md`; `04-multilingual/MULTILINGUAL-CONTENT.md`; `RENDERING.md` + `RENDERING-REVALIDATION-REVIEW.md`; `local-date-time-conversation.md`.
> Document precedence: **the master is canonical and supersedes every other doc on any disagreement**; where documents disagree, **the most recent locked decision wins**; every reversal is recorded in the master's Appendix B conflict log.

---

### A1. Platform positioning & business model

#### A1.1 What Island Tours is
- Island Tours is a **Caribbean tour marketplace** built on the **"Built by Islanders"** ethos: local curation as the ethical, locally owned alternative to global OTAs.
- Named competitor OTAs: **Viator, GetYourGuide, Klook, Headout**.
- **Three-sided model**: travelers discover and book tours/activities; local operators supply them; Island Tours earns a **commission per booking**.
- Island Tours is a **reseller, not the tour provider** (PROJECT-SCOPE §1).
- Platform URL: `www.island.tours`. Owner: Denley (founder); Dev: Arnav; Design: external team.
- Island Tours and the Klein Curaçao hub are **TripWheel's first deployment on an isolated instance**.
- **Tagline: "Island Tours. Built by Islanders."** — closing/sign-off form is **"Built by Islanders."**
- The tagline is a **brand mark, like a logo — never translated**; it stays in English in all seven locales.
- Tagline usage: full form beneath the logo and in brand contexts; closing form as sign-off in the global footer, email sign-offs, and end of long-form copy.

#### A1.2 The four positioning pillars
- **Pillar 1 — Local curation, not an algorithmic catalog.** Editorial picks are made by people who live on the islands.
- **Pillar 2 — Ethical CRO.** No fake urgency, no fake scarcity, no badge inflation, no dark patterns, no pre-checked add-ons. Paid placement is **always labeled `Sponsored`**.
- **Pillar 3 — Transparency.** Total price before checkout, no hidden fees, clear cancellation, claims always verifiable.
- **Pillar 4 — Caribbean-proud voice.** Warm, direct, first-person plural, never corporate.

#### A1.3 Commercial model (commission-based marketplace)
- Operators pay a **tiered commission**, **locked/snapshotted at booking time** as `commission_amount` on the booking record.
- Commission tiers (tier key — commission — `tier_rank`):
  - `premium` — **30%** — rank **1**
  - `featured` — **27.5%** — rank **2**
  - `boosted` — **25%** — rank **3**
  - `organic` — **22.5%** — rank **4**
  - `standard` (default) — **20%** — rank **5**
  - **Destination Spotlight** — **35%** — separate placement block, **never interleaved**; **max 3 simultaneous per destination**; **manual approval** (operator requests, Island Tours approves).
- `standard` is the default tier for new tours **and** the locked rate for operators on a negotiated 20% agreement.
- `standard` **deliberately ranks below `organic`**, so a 20% operator who wants to outrank other base-rate tours moves up to `organic` at 22.5%.
- **Tier mechanics are internal commercial logic, never user-facing.**
- Tier also drives the deposit percentage (LD24): `tour.deposit_pct` ranges **20 to 30 in 2.5 steps**.
- **Revenue is recognized on tour completion.**
- **There is no featured-slot economy** — the earlier 3-slots-per-category, soft-lock/hard-reserve, waitlist and paid-skip mechanism is **removed entirely**; placement is governed by **commission tiers + a ranking query + an eligibility engine**.
- Ranking order: `ORDER BY tier_rank ASC, quality_score DESC, id ASC`.
- Free cancellation window per tour, **default 48h**; it is a **listing requirement**.
- **Four payment models** govern the balance (canonical set, confirmed June 10, 2026): `operator_link` (default), `on_arrival`, `paid_in_full`, `operator_full`.
  - `operator_link` — operator emails a secure payment link; balance paid online before the deadline; deposit `deposit_pct`% via Stripe at booking.
  - `on_arrival` — balance paid in person on arrival (card or cash, or cash only, per tour); deposit `deposit_pct`% via Stripe.
  - `paid_in_full` — traveler pays **100% at booking** via Island Tours.
  - `operator_full` — operator collects the full amount; **checkout takes no payment**; booking created confirmed at commit, bypasses Stripe + webhook.
- The earlier LD24 statement "balance online, not cash on tour day" describes the `operator_link` default and is **superseded** as a platform-wide rule by this four-model set.
- **Two-phase operator visibility (platform principle):** before payment, all copy is **agentless** — the widget and modals say "You'll get a secure link to pay the rest" and never name or spotlight the operator (disintermediation control).
- After booking, the operator is named **deliberately**: on `operator_link` tours the Thank You page and confirmation email say the operator will send the balance link, so that email is **expected and not mistaken for phishing** (the C2 mitigation).
- Summary rule: **pre-payment agentless, post-booking named** (confirmed June 10, 2026).
- **Affiliate program:** Trackdesk (primary); **8% of GMV**, funded entirely out of Island Tours' commission take; commission **on hold at booking**, approves after the cancellation window closes (clawback-safe); attribution owned by the platform's own `booking_complete` event; **promo codes double as attribution identifiers**.
- ⚠️ **CONFLICT — `operator_full` v1 status:** PROJECT-SCOPE §5, BOOKING-AND-PAYMENTS, DATA-MODEL and TRACKING treat `operator_full` as a **live fourth model**; SETTLEMENT-AND-PAYOUTS Part 2 (founder decision, 2026-07-15) **drops it from v1** (returns in v2). The settlement decision is the later, locked one.

#### A1.4 Launch destinations (LOCKED, confirmed June 10, 2026)
- Three **live** destinations in rollout order; Saint Lucia and Bahamas exist as **seeded pipeline rows only**.
- Destination 1 — **Curaçao** — slug `/curacao/` — status **Launch**.
- Destination 2 — **Aruba** — slug `/aruba/` — status **Rollout 2**.
- Destination 3 — **Sint Maarten** — slug `/sint-maarten/` — status **Rollout 3**.
- Destination 4 — **Saint Lucia** — slug `/saint-lucia/` — status **Pipeline, seeded only**.
- Destination 5 — **Bahamas** — slug `/bahamas/` — status **Pipeline, seeded only**.
- Every 2026 surface (homepage hero quick links, email spec, reviews) works with the **three-island set**.
- The destination data model supports **unlimited expansion with no structural change**.
- Destinations are grouped by **region** — a **data attribute with no URL layer** (there is no `/caribbean/`). Schema scales to **Atlantic, Mediterranean, Asia, Africa** without structural change.
- `parent_destination_id` is **nullable** for future sub-destinations (e.g. `/bahamas/nassau/`) — **unused at launch**.
- Destinations with `is_seeded = true` **cannot be deleted** (403 in the service).

#### A1.5 Languages & currency model
- **Seven locales from launch, English primary: EN, NL, DE, FR, ES, PT, ZH.**
- DB `Locale` enum ordering is `en, es, nl, pt, fr, de, zh` — the same set.
- Overrules `Island-Tours-platform-architecture-v3.md` partially; B.13: six-locale switcher (UI/UX V2) → **seven locales including ZH**.
- **Slugs are English in every locale** (one slug worldwide per page); the locale prefix alone switches language.
- **Display currency defaults per locale (LOCKED June 10, 2026):**
  - Locales **EN, ZH → USD**
  - Locales **NL, DE, FR, ES, PT → EUR**
- The locale sets the default currency; a **currency selector in the global footer** lets the user override it.
- The currency override **persists for the session**.
- Decided June 10, 2026, reversing the Section4_7 §6.3 removal and partially restoring the UI/UX Structure V2 footer selector (conflict log 51; B.51).
- **The nav never carries the currency selector.**
- **IP-based currency localization is roadmap**, not launch.
- **Locale-aware number formatting applies:** `$1,234.56` vs `€1.234,56`.
- `destination.currency` remains in the data model for **operator and payout context only** — it does **not** drive display currency.
- ⚠️ **CONFLICT (resolved):** B.12 — display currency destination-based + footer selector (architecture, UI/UX V2) → locale-fixed, no selector (Section4_7 §6.3, twice) (C6) → **reversed again by B.51 to locale-default + footer selector, session-persistent** (veto round June 10, 2026). B.51 is the current lock.

#### A1.6 Infrastructure (master §1.5)
- **Next.js** frontend; **Node.js / NestJS 11** backend on **TripWheel infrastructure**; strict TypeScript; modules follow the `src/users/` pattern.
- **`next-intl`** for all UI strings — **no hardcoded English anywhere**.
- Database — **PostgreSQL via Prisma 7 ORM**, **split schema** in `backend/prisma/*.prisma` (Prisma 7 merges all files). (Master §1.5 also names **Supabase** for bookings, tours, operators.)
- **Auth — Better Auth, backend only**; session validation in NestJS; the frontend never runs `betterAuth()`.
- **Stripe** for payments; **webhook idempotency via `stripe_webhook_events`**.
- **Resend** as transactional email provider, **Postmark as fallback**.
- Full **SPF, DKIM and DMARC** on a dedicated transactional subdomain (e.g. `bookings@mail.island.tours`), separate from marketing email.
- **BullMQ (Redis-backed)** async jobs: email dispatch, departures materialization, demotion engine, AI translation.
- Tracking stack: **GTM, Google Ads, GA4, Meta Pixel + server-side Meta CAPI**; **Consent Mode v2**.
- Affiliate — **Trackdesk**.
- API docs — `@nestjs/swagger`, **Swagger UI at `/api/docs`**.
- Validation — `class-validator` + `class-transformer`; **global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`**.
- Rate limiting — `@nestjs/throttler`; **global guard, three tiers (20/s · 300/min · 3000/hr)**.
- **One Prisma instance per process** — backend owns all DB access; the frontend has **no `prisma/` folder and no `DATABASE_URL`**.
- **Redis backs BullMQ only** — not a primary store, not a pub/sub bus for live UI.
- **SSE, WebSockets and Redis pub/sub for live UI are out of scope** (there is no slot economy, so no real-time requirement); **ISR revalidation is sufficient**.
- Guard execution order (**do not reorder**): `ThrottlerGuard` → `AuthGuard` → `RolesGuard` → `PermissionsGuard`.
- `AuthGuard` reads **`better-auth.session_token`** (cookie or Bearer), calls `getSession()`, attaches `{ user, session }`.
- **CORS must use `credentials: true`** via `parseCorsOrigins()` in both `main.ts` and `auth.instance.ts`.
- ⚠️ **CONFLICT — TOUR_OPERATOR account creation:** PROJECT-SCOPE §3 and ARCHITECTURE-OVERVIEW §4 say **self-registration** (Better Auth email verification + Google); repo `CLAUDE.md` says **admin-invited (set-password email)**. Unresolved between docs.

#### A1.7 Scope of the master document
- **IN SCOPE:** consumer-facing platform, booking flow and payment models, transactional email, commercial model including the affiliate program, conversion-tracking architecture.
- **OUT OF SCOPE:** Google Ads operational roadmap (founder's personal planning doc), operator/admin tooling, the Meta creative production system.
- The master carries the consolidated data model (Appendix E) and a build map (Appendix F) routing developers to deep source sections per build block.
- Built by reconciling roughly **75 working documents** (specs, design reviews v1–v8, audits, handoffs, wireframes) produced March–June 2026.
- Conventions: emoji in wireframes/copy blocks are **text shorthand for SVG icons (LD20)** — production UI never renders emoji; `{placeholders}` are template variables resolved per tour/booking/locale at render time; locked copy is quoted verbatim and marked `locked` — implement exactly as written.
- Version history: v1.0 initial consolidation → v1.1 tracking spec + veto round + chat sweep → v1.2 availability/departures (E.9) → v1.3 search (5.10) → v1.4 tier eligibility (7.2) → v1.5 `operator_full` checkout → v1.6 pre-tour reminder email (6.7) → v1.7 `operator_link` balance visibility gap closed → v1.8 reminder block tweak → **v1.9 C23 payment_model-aware cancellation copy + locked TYP copy** (June 11, 2026).

---

### A2. Information architecture

#### A2.1 Core hierarchy
- `Homepage → Destinations (Curaçao, Aruba, Sint Maarten live; expansion-ready) → Discovery layer: Categories | Activity Hubs | Collections | All Tours → Tour detail pages → Booking widget → Checkout → Thank You page`.
- **Categories are global** — one set of 19, reused per destination.
- **Destinations scale without structural change.**
- A **tour** belongs to exactly **1 destination**, **1+ categories** (exactly one flagged `isPrimary`) via `TourCategory`, and **0–n hubs** via `TourHub`.
- A **hub is a discovery tag with no URL effect**.
- Every tour has **one canonical flat URL** `/{locale}/{destination}/{tour-slug}/` but can be discovered through many category/hub/collection pages.
- **Cannibalization between layers is prevented by the slug registry: one slug, one page type, per destination.**

#### A2.2 The three parallel discovery layers (+ All Tours)
- **Category** — anchored to a *type of activity* (taxonomy); carries the **19 global categories**; purpose: browse by activity; the **SEO workhorse**.
- **Activity Hub** — anchored to *a place or product reality* (Klein Curaçao, Willemstad, sunset cruises as an experience cluster); carries **comparison logic** and rich informational SEO content (what it is, best time to visit, how to get there).
- **Collection** — anchored to *a persona or intent* (best things to do, couples, families, day trips); carries **editorial ranking**; primarily a curated tour listing with a short intro.
- **All Tours** — the destination's **full catalog**; carries **filters + sort**; served from the reserved `tours` slug.
- **Hub vs Collection decision rule:** a Hub is anchored to a place or product reality and carries **comparison logic**; a Collection is anchored to a persona or intent and carries **editorial ranking**.
- **Rule of thumb:** rich informational content deserving its own SEO page → **Hub**. Primarily a curated tour list cutting across categories → **Collection**.
- Ranking/ordering within listing pages (tier rank, quality score, bookability, Sponsored labeling, the "Locals' favorites" sort label) is owned by the placement engine.

#### A2.3 All page types (master §2.1 — 9 specced page types + Help Center = 10 rows)
- **Homepage** — job: destination selection, nothing else — `/` (per-locale `/{locale}/`).
- **Destination** — job: island overview, entry to all discovery layers — `/en/curacao/`.
- **All Tours** — job: full filterable catalog per destination — `/en/curacao/tours/`.
- **Category** — job: one activity type per destination, **SEO workhorse** — `/en/curacao/boat-tours/`.
- **Activity Hub** — job: one location, highlight, or area with its own decision logic — `/en/curacao/klein-curacao/`.
- **Collection** — job: persona or intent-driven curated list, cuts across categories — `/en/curacao/best-things-to-do/`.
- **Tour detail** — job: conversion page — `/en/curacao/{tour-slug}/`.
- **Checkout + Thank You page (TYP)** — job: transaction and confirmation (master §5.8, §5.9).
- **Search results** — job: query results within a destination — `/en/search?q={query}&destination={dest}` (locked, `island-tours-search-dev-spec.md`).
- **Help Center** — job: site-level FAQ with **FAQPage schema (LD21)** — `/help` (spec to be written, C16).
- Tours live **flat directly under the destination** — **no `/tour/` segment, no hub nesting**.

#### A2.4 Entity ownership (who controls what)
- **Destinations** — Admin. Islands; pre-seeded; `is_seeded` protects from delete; grouped by region (data attribute, no URL).
- **Categories** — Admin. **19 global** categories; page renders only at **≥3 published tours per destination**.
- **Hubs** — Admin. Destination-specific; `hub_type` = **location / highlight / area**.
- **Collections** — Admin. Curated/filtered editorial lists (manual or dynamic).
- **Tours** — Operators. 1 destination → 1+ categories (one `isPrimary`) → 0–n hubs; one flat canonical URL.
- **Commission tier** — Operators (eligibility-gated, 30-day lock); drives ranking + `deposit_pct`.
- **Destination Spotlight** — Operators request → Admin approves; max 3 per destination; separate block.
- **Top Island Experiences** — Admin; **Categories and Hubs only, never individual tours**.
- **Page editorial content** — Admin; About/FAQ per destination/category/hub/collection.
- **Attributes / Filters** — Admin owns the dictionary (`attribute_definitions`); Operator sets per-tour values (`tour_attributes`).
- **`is_locals_favourite`** — editorial flag, **never operator-set**; admin-only with `MANAGE_EDITORIAL`, target ~30% coverage.

#### A2.5 The three user roles
- **USER (traveler)** — created **auto on first booking** — browse, book, pay, review, wishlist.
- **TOUR_OPERATOR** — list tours, pick a commission tier, manage availability, request Spotlight. ⚠️ **CONFLICT** on creation path (self-registration vs admin-invited) — see A1.6.
- **ADMIN** — created by **database seed only** — full platform management + Spotlight approval + force-majeure pardons + confirming operator non-payment reports.
- Operators inherit USER; **ADMIN is a strict superset** of OPERATOR and USER.
- `EDITOR` / `STAFF` / `GUIDE` are modeled/designed but **not launch-active**.
- **Roles are set server-side only** — the frontend never sends a `role` field.

#### A2.6 Edge cases the system must handle (EC-01 … EC-10)
- **EC-01** — tour drops below an eligible tier → nightly check notifies, opens a **30-day grace**, then auto-demotes to the highest still-qualifying tier; existing bookings keep snapshotted commission.
- **EC-02** — operator changes tier within the 30-day lock → **rejected** while `tier_locked_until` is in the future.
- **EC-03** — tour has no open departure in the next 30 days → excluded from every ranked result set; **not billed for its tier** during the unbookable period.
- **EC-04** — category has fewer than 3 published tours in a destination → category page is `draft`; excluded from nav, sitemaps, internal links and search until threshold met; **checked on every tour status change, both directions**.
- **EC-05** — `operator_full` booking → bypasses payment + webhook; created confirmed at commit; **still fires the conversion event**.
- **EC-06** — traveler misses the balance deadline (deposit model) → **forfeiting is never automatic**; operator reports non-payment, admin confirms, only then is the deposit forfeited.
- **EC-07** — operator-forced cancellation → **full refund or free reschedule, always**.
- **EC-08** — Destination Spotlight request when 3 are already active → **rejected** (max-3 cap); request **queued** for manual approval when a slot frees.
- **EC-09** — slug renamed or deleted → rename creates a **301 redirect** entry automatically; a deleted slug enters a **90-day reuse cooldown**.
- **EC-10** — review submitted without a confirmed booking → **rejected**; reviews gated on a confirmed `booking_id`.

---

### A3. URL structure, routing & resolution

#### A3.1 The URL model — exactly two public content URL shapes, both locale-prefixed
- `/{locale}/{destination}/` → **Destination page** (2 segments).
- `/{locale}/{destination}/{slug}/` → **Category | Hub | Collection | Tour | reserved `tours`** (3 segments).
- **There is no fourth segment.** Tours are flat — never nested under a category or hub — and **there is no `/tour/` path segment**. Any deeper path that is not an explicitly-defined route is a **404**.
- Canonical URL pattern: `/{locale}/{destination}/{slug}/`.
- **Trailing slashes are canonical.**
- URL → resolution examples: `/en/curacao/` → Destination; `/en/curacao/boat-tours/` → Category; `/en/curacao/klein-curacao/` → Activity Hub; `/en/curacao/top-10-tours/` → Collection; `/en/curacao/sunset-catamaran-cruise/` → Tour detail; `/en/curacao/tours/` → reserved "all tours in destination" listing.
- **Exception — the Thank You page:** `/{destination}/thank-you/{bookingRef}` carries **no locale prefix** and is **noindex**. `bookingRef = bookings.public_ref` (a **UUID, non-enumerable** — booking URLs cannot be enumerated). TYP strings localize via next-intl from `bookings.customer_locale`.
- **Search results:** `/{locale}/search?q={query}&destination={dest}`.
- **Help Center:** `/help`.

#### A3.2 The three URL-model invariants
- **1. One canonical URL per tour.** Discovered via many pages, but every link points to the single flat URL. Correct: `/en/curacao/klein-curacao-catamaran-day-trip/`; **Wrong: `/en/curacao/boat-tours/klein-curacao-catamaran/`**.
- **2. All third-segment entities share one namespace.** Category, hub, collection, tour and the reserved `tours` slug all compete for the same `(destination, slug)` slot — uniqueness enforced **per destination** by the slug registry.
- **3. Slugs are English at every locale.** The locale prefix selects the *translation*; it never changes the slug. `/en/curacao/boat-tours/` and `/nl/curacao/boat-tours/` are the **same entity with different rendered content**.
- B.20 override: the tour-card doc's `/tour/{slug}` URL → `/{locale}/{destination}/{slug}/`.

#### A3.3 Segment 1 — `{locale}` (middleware, never the registry)
- Config: `createMiddleware({ locales: ['en','es','nl','pt','fr','de','zh'], defaultLocale: 'en', localePrefix: 'always' })` in `middleware.ts` (next-intl).
- **Supported locales:** `en, nl, de, fr, es, pt, zh` — all 7 active from launch (EN primary).
- **Default locale:** `en`. **Prefix policy:** `always` — every public content URL carries a locale prefix.
- **No-prefix request** (`/curacao/boat-tours/`) → **302 redirect** to the user's preferred language via **`Accept-Language` detection**, defaulting to `/en/…`.
- **Effect on resolution: NONE.** The resolver ignores locale; `(destination, slug)` → the same entity for every locale. Locale only selects **which translation row is read**.

#### A3.4 Segment 2 — `{destination}` (resolved directly, no registry lookup)
- The destination slug **is** the route segment; validated against **`Destination.slug`, NOT the slug registry**.
- Route: `app/(frontend)/[locale]/[destination]/page.tsx`; data ← `GET /api/v1/destinations/slug/{destination}?locale=` (**404 if missing or inactive**).
- Launch destination slugs (rollout order): `curacao` (launch), `aruba`, `sint-maarten`; pipeline (seeded, not live): `saint-lucia`, `bahamas`.

#### A3.5 Segment 3 — `{slug}` (polymorphic, resolved by the registry)
- The third segment is **ambiguous** — from the URL alone Next.js cannot tell a category from a hub from a collection from a tour; they share **one route file and one namespace**. The **slug registry disambiguates it**.

#### A3.6 Depth & disambiguation rules
- `/{locale}/` → Homepage.
- `/{locale}/{destination}/` (2 segments) → Destination page — **direct match on `Destination.slug`, no registry lookup**. **There is no 2-segment tour URL.**
- `/{locale}/{destination}/{slug}/` (3 segments) → **always one `slug-registry/resolve` call, then switch on `entityType`**.
- **4+ segments → 404** unless an explicitly-defined route exists. **No nested tour URL** — hubs add a discovery *tag*, never a URL prefix.

#### A3.7 The resolution algorithm
- **Resolve endpoint:** `GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}` — `@Public()`, no auth, **locale-independent, cacheable**.
- Implementation (`slug-registry.service.ts → resolve()`): `prisma.slugRegistry.findUnique({ where: { destinationSlug_slug: { destinationSlug, slug } }, select: { destinationSlug, slug, entityType, entityId, isActive } })`; if `!entry || !entry.isActive` → `NotFoundException("No active slug \"{slug}\" found for destination \"{destinationSlug}\"")`.
- **200** → `{ destinationSlug, slug, entityType, entityId }`.
- **404** → slug is **unknown** OR **inactive (tombstoned)**. **The public router treats both identically.**
- **Renames:** a request for the *old* slug must resolve to a **301** to the new flat URL via the redirect table **before** the registry 404s.
- **Frontend routing switch** (`app/(frontend)/[locale]/[destination]/[slug]/page.tsx`): resolve first, then branch —
  - `CATEGORY` → `<CategoryPage destination categoryId={r.entityId} locale />`
  - `HUB` → `<HubPage destination hubId={r.entityId} locale />`
  - `COLLECTION` → `<CollectionPage destination collectionId={r.entityId} locale />`
  - `TOUR` → `<TourPage destination slug={slug} locale />`
  - `RESERVED` → `<AllToursListing destination locale />`
  - `default` → `notFound()`
- **TOUR** fetches by the *flat slug* it already has and does **not** need `entityId`: `GET /api/v1/trips/slug/{slug}?destinationSlug={destination}&locale=` (**no `hubSlug` — flat resolution**).
- **CATEGORY / HUB / COLLECTION** use `entityId` to fetch the page payload + filtered/ranked tour list.
- **End-to-end flow (category example, `/nl/curacao/boat-tours/`):** middleware extracts `locale=nl, destination=curacao, slug=boat-tours` → `resolve` returns `{ entityType: CATEGORY, entityId: abc-123 }` (404 if missing/inactive → `notFound()`) → `<CategoryPage>` fetches **in parallel** `GET /categories/destination/curacao/boat-tours?locale=nl` (**404 if <3 published tours**), `GET /categories/abc-123/page-content?locale=nl`, `GET /categories/abc-123/faqs?locale=nl` → render with tours ordered by `tier_rank ASC, quality_score DESC, id ASC`.

#### A3.8 The two independent 404 layers (category gating)
- A successful `CATEGORY` resolve is **necessary but not sufficient** to render.
- **1. Registry 404** — the slug is unknown or `isActive = false`.
- **2. Gating 404** — the category resolves fine, but has **fewer than 3 published tours** at this destination+category combination; **`categories.service.ts` returns 404 when `publishedTourCount < 3`**.
- The registry answers *"what is this slug?"*; the category service answers *"is this page allowed to render right now?"*. **Both map to `notFound()` on the frontend.**
- **Gating applies to CATEGORIES ONLY.** Hubs, collections and tours render whenever their resolve succeeds and `isActive = true`.

#### A3.9 Frontend caching guidance for resolution
- Resolve results are **cacheable per `(destination, slug)`** with revalidation.
- Because slugs can change, **cache invalidation must also fire on a rename** (write the 301, bust the old key) **and on an `isActive` toggle**, not only on hard delete.
- The resolver is **locale-independent** — one cached resolution serves all 7 locales for a given `(destination, slug)`.
- **Treat a `404` from resolve as authoritative:** render `notFound()`. **Never fall back to guessing the entity type.** **Check the redirect table for a 301 BEFORE deciding a slug is gone.**

#### A3.10 Breadcrumbs (master §2.7)
- **Separator: `›` exclusively** (Tier 3 of the separator system, §A9.4).
- **Final crumb is the current page and is NOT clickable.**
- **JSON-LD `BreadcrumbList` on every page with breadcrumbs.**
- **Tour pages have three path variants**, chosen by the tour's **primary attachment**:
  - **Hub-anchored** — `Home › Destination › Hub › Tour` (primary attachment is an activity hub)
  - **Category-anchored** — `Home › Destination › Category › Tour` (primary attachment is its `isPrimary` category)
  - **Flat** — `Home › Destination › Tour` (no hub/category anchor applies)
- This **supersedes the architecture document's "first assigned category" rule**.
- **Non-tour breadcrumb paths:** Destination → `Home › Destination`; Category → `Home › Destination › Category`; Activity Hub → `Home › Destination › Activity Hub`; Collection → `Home › Destination › Collection`.
- **Mobile visibility is a deliberate per-page divergence (LD8):** **visible on tour detail pages, hidden on destination pages** (replaced by the nav back-arrow).
- **The URL stays flat regardless of which breadcrumb variant renders** — the breadcrumb reflects **discovery context, not the URL**.

#### A3.11 Routing implementation status (as of 2026-06-20)
- Backend `GET /api/v1/slug-registry/resolve` — **Built**.
- Backend registry writes (destination/category/hub/collection/tour) — **Built**.
- Flat tour URLs (no hub-nested route, no `hubSlug` param) — **Built**.
- **301 redirect table on rename — Not built** (target, master §2.3).
- **90-day slug reuse cooldown — Not built** (target, master §2.3).
- **Category gating threshold — Built at ≥1, not the canonical ≥3 — to fix.**
- Frontend destination page, `tours/page.tsx` (RESERVED listing), polymorphic `[slug]/page.tsx` — **Built**; `CategoryPage` — **Built**; `HubPage` — **In progress**; `CollectionPage` / `TourPage` — **Not built** at that date (those `[slug]` branches 404).
- Tour ranking on category/search lists — **Not built** at that date (no tier/quality model yet).

---

### A4. Slug registry

#### A4.1 Why it exists
- Every public page other than the destination root lives under one ambiguous shape `/{locale}/{destination}/{slug}/`, where `{slug}` is **polymorphic** (Category / Activity Hub / Collection / Tour / reserved "all tours" listing).
- The registry maps `{destination} + {slug}` → `{ entityType, entityId }` so the frontend knows **which page component to render and which API to call**.
- The registry resolves the page type **at request time**; **linking components never need to know the type** (a quick link simply navigates to `/{locale}/{destination}/{slug}/`).
- **Design rule:** a tour has **one** canonical flat URL; the categories and hubs a tour belongs to are **discovery tags** — they affect listing/filtering, **not** the URL. No hub-nested tour URL; no `/tour/` segment.

#### A4.2 Schema — `SlugRegistry` (`@@map("slug_registry")`)
- `id String @id @default(uuid())`
- `destinationSlug String` — e.g. `'curacao'`; **denormalized copy of `Destination.slug`** so resolution is a **single-table lookup with no join**; the island namespace.
- `slug String` — the **English URL segment**; always English, never translated; normalized via `generateSlug()`.
- `entityType SlugEntityType` — **`TOUR | CATEGORY | HUB | COLLECTION | RESERVED`** (enum lives in `enums.prisma`).
- `entityId String?` — **FK-by-value** to the owning row (`Category.id`, `Hub.id`, `Collection.id`, `Trip.id`); **`null` only for `RESERVED`**.
- `isActive Boolean @default(true)` — `true` = page renders; **`false` = slug stays claimed but the page 404s (tombstone)**.
- `createdAt DateTime @default(now())`
- **`@@unique([destinationSlug, slug])`**
- **`@@index([destinationSlug, slug, isActive])`**
- Entity type → example URL: `CATEGORY` → `/en/curacao/boat-tours/`; `HUB` → `/en/curacao/klein-curacao/`; `COLLECTION` → `/en/curacao/top-10-tours/`; `TOUR` → `/en/curacao/sunset-catamaran-cruise/`; `RESERVED` → `/en/curacao/tours/`.

#### A4.3 The registry invariants
- **1. Uniqueness** — `@@unique([destinationSlug, slug])`; within one destination a slug maps to exactly one entity. The same slug under different destinations is **independent** (`curacao/boat-tours` ≠ `aruba/boat-tours`).
- **2. Transactional integrity** — **every registry row is written in the same Prisma `$transaction` as the entity it represents.** A failed entity create rolls back its registry row and vice-versa — **never orphan rows or unrouteable entities** (CLAUDE.md Critical Rule #4).
- **3. `isActive` is a tombstone, not a delete** — the row stays with `isActive=false`: the page 404s but the slug **remains claimed**, so no other entity can silently steal a bookmarked/indexed URL.
- **`entityId` is `null` iff `entityType === RESERVED`.**
- Slugs are **locale-independent** and unique per destination.
- **No code path writes a registry row on a translation or a page-content edit.**

#### A4.4 The 20 protected slugs per destination
- At destination creation the registry is pre-seeded with **20 protected slugs**: **19 global category slugs** (one `CATEGORY` row each) + the reserved **`tours`** slug (one `RESERVED` row, `entityId = null`).
- The reserved `tours` slug protects `/{destination}/tours/` so **no category/hub/collection/tour can ever claim it**, and lets the frontend render the "all tours in this destination" listing from a **known, stable URL**.
- **`RESERVED` is the only `entityType` whose `entityId` is `null`.**
- Categories are **global** — the same 19-slug set is reused for every destination; a new category **fans a row out to every active destination**, and a new destination **backfills a row for every existing active category**.

#### A4.5 Write-on-create rules (quick reference)
- **Destination create** → **1 `RESERVED` row** (`tours`, `entityId = null`) **+ 1 `CATEGORY` row per existing active category** — backfills every existing category into the new island.
- **Category create** → **1 `CATEGORY` row per existing active destination** (`entityId` = category id) — fans out across all islands; **writes slug rows only — NO FeaturedSlot rows**.
- **Hub create** → exactly **1 `HUB` row** (`entityId` = hub id), scoped to its one destination.
- **Collection create** → exactly **1 `COLLECTION` row** (`entityId` = collection id), scoped to its one destination.
- **Tour (Trip) create** → **always exactly 1 `TOUR` row** (`entityId` = trip id) — **unconditional; flat URL for every tour**.
- **Translation create/edit** → registry write **skipped** (slugs are English-only).
- **Page-content / FAQ edits** → **skipped** (page payloads, not routable entities).
- **Rename (slug change)** → updates the row's `slug` **and writes a 301 redirect entry**; `entityType`/`entityId` unchanged.
- **CRITICAL CHANGE — no FeaturedSlot seeding.** The earlier rule "Category create seeds exactly 3 FeaturedSlot rows in the same transaction" is **removed**; FeaturedSlot / SlotLock / SlotHistory / Waitlist do **not** exist in the target architecture. The category-create service **must drop the `featuredSlot.createMany([...])` call** (it still exists in code as of 2026-06-20).

#### A4.6 Step-by-step create cycles (each inside a single Prisma `$transaction`; any throw rolls everything back and no slug is claimed)
- **Create a DESTINATION** (`destinations.service.ts create()`):
  1. `slug = generateSlug(dto.slug ?? dto.name)` ("Curaçao" → "curacao")
  2. BEGIN TRANSACTION
  3. `destination.create({ name, slug, region, …, createdBy })` — **P2002 on slug → 409 "already exists"**
  4. `slugRegistry.create({ destinationSlug:"curacao", slug:"tours", entityType: RESERVED, entityId: null })` — reserve the listing URL
  5. `categories = category.findMany({ isActive: true })`
  6. If `categories.length > 0`: `slugRegistry.createMany(categories.map(c => ({ destinationSlug:"curacao", slug:c.slug, entityType: CATEGORY, entityId:c.id })))`
  7. COMMIT → log "seeded N category slug(s) + 1 reserved"
- **Create a CATEGORY** (`categories.service.ts create()`; categories are **global**, one category spans every island):
  1. `slug = generateSlug(dto.slug ?? dto.name)` → "boat-tours"
  2. BEGIN TRANSACTION
  3. `category.create({ name, slug, …, createdBy })` — **P2002 → 409**
  4. `destinations = destination.findMany({ isActive: true })`
  5. If `destinations.length > 0`: `slugRegistry.createMany(destinations.map(d => ({ destinationSlug:d.slug, slug:"boat-tours", entityType: CATEGORY, entityId: category.id })))`
  6. COMMIT → log "seeded N slug_registry row(s)"
  - Result: `/curacao/boat-tours/`, `/aruba/boat-tours/`, … all resolve to this one category. **The page does not render until that destination has ≥3 published tours in the category.**
- **Create an ACTIVITY HUB** (`hubs.service.ts create()`; destination-scoped; **the hub does NOT accept an explicit slug — always derived from name**):
  1. `slug = generateSlug(dto.name)` → "klein-curacao"
  2. BEGIN TRANSACTION
  3. `destination.findUnique({ id: destinationId })` — **404 if missing**
  4. `hub.create({ destinationId, name, slug, hubType, …, createdBy })` — **P2002 → 409**
  5. `slugRegistry.create({ destinationSlug: destination.slug, slug: "klein-curacao", entityType: HUB, entityId: hub.id })` — **P2002 → 409**
  6. COMMIT
- **Create a COLLECTION** (`collections.service.ts create()`; destination-scoped, manual or dynamic/filtered):
  1. `slug = generateSlug(dto.slug ?? dto.name)` → 2. BEGIN → 3. `collection.create({ destinationId, name, slug, … })` (**P2002 → 409**) → 4. `slugRegistry.create({ destinationSlug, slug, entityType: COLLECTION, entityId: collection.id })` → 5. COMMIT
  - **Collection slugs must be semantically distinct from category slugs** (`top-10-tours` correct, never `boat-tours-private` — that should be a filtered category URL instead).
- **Create a TOUR** (`trips.service.ts create()`) — **the most defensive cycle** (tour slugs share the destination namespace with categories, hubs, collections and the reserved `tours` slug):
  1. `operatorId = resolveOperatorId(userId, role)` — `user.id → operator.id` (**admin auto-provisions**)
  2. `baseSlug = generateSlug(dto.slug ?? dto.name)`
  3. Validate destination → **must exist AND `isActive`**, else **400**
  4. Validate categories: **dedupe; require ≥1; `primaryCategoryId ∈ categoryIds`; each exists + `isActive`**
  5. `slug = resolveUniqueSlug(baseSlug, destinationId, destinationSlug, operatorId)`
  6. BEGIN TRANSACTION
  7. Validate each `hubId` (**TOCTOU-safe, inside tx**): exists + `isActive`; **same destination**; **allowed-category match**
  8. `trip.create({ … categories:{create: … (one isPrimary)}, hubs:{create: …} })` — **P2002 on slug → 409 (race)**
  9. `slugRegistry.create({ destinationSlug, slug: trip.slug, entityType: TOUR, entityId: trip.id, isActive:true })`
  10. COMMIT
  - Rows written: 1 `Trip` + N `TourCategory` (one `isPrimary`) + M `TourHub` + **always** 1 `TOUR` registry row.

#### A4.7 Slug normalization (`generateSlug()`) — applies to every slug
- **Lowercase only** (`Curaçao` → `curacao`, `Boat Tours` → `boat-tours`).
- **ASCII only** — diacritics folded (`ç`→`c`, `ü`→`u`, `é`→`e`); NFD strip.
- **Separators** — spaces and underscores → single hyphens.
- **Strip** — no special characters, no double hyphens.
- **Trim** — no leading or trailing hyphens.
- **Language — always English, never translated.**
- Backend `CreateXxxDto` accepts an optional `slug?`; the service uses `dto.slug ?? generateSlug(dto.name)` and always normalizes via `generateSlug`. The frontend `toSlug()` must stay in sync with the backend util.

#### A4.8 `resolveUniqueSlug` — slug collision resolution algorithm
- **Step 1 — normalize.** `generateSlug()` lowercases, ASCII-folds, strips punctuation, hyphen-joins → the **base slug** (`"Klein Curaçao Boat Trip"` → `klein-curacao-boat-trip`).
- **Step 2 — own-duplicate guard.** If *this same operator* already has the base slug at this destination → **`409` immediately** (they are duplicating their own listing; **no auto-rename**).
- **Step 3 — cross-entity collision check.** **In parallel**, look for any **trip** (any operator) with that slug at this destination, and any **`slug_registry`** row at `(destinationSlug, baseSlug)`. If **both empty** → the base slug is free, use it as-is. **This check must also treat a slug still inside its 90-day cooldown as taken** (and a slug with an outstanding 301 source).
- **Step 4 — suffix with operator identity (one attempt, NEVER numeric).** If claimed by *another* entity: `suffix = generateSlug(companyName ?? userName ?? operatorId[:8])` (e.g. "bluefin-charters"); `candidate = "klein-curacao-boat-trip-bluefin-charters"`. Re-check the candidate against **both** the trips table and the registry:
  - free → **use it**
  - taken by *this* operator → **409 (own duplicate)**
  - taken by *another* entity → **409 "choose a different tour name or slug"**
  - **No numeric suffix is ever tried (`-2`, `-3`, …)** — numbers are confusing for users and poor for SEO. The operator-name suffix is the **single** fallback; a further collision is rejected.
- **Step 5 — atomic claim.** The winning slug is written as `Trip.slug` **and** the `TOUR` registry row **in the same transaction**. A unique-constraint race between the pre-check and the write is caught as **`409 "taken concurrently, retry"`**.
- **Worked example:** Operator A → `klein-curacao-boat-trip`. Operator B (Bluefin Charters), same name → `klein-curacao-boat-trip-bluefin-charters`. Operator C whose suffix also collides → **rejected with 409; must rename**. No `-1`/`-2` is ever generated.

#### A4.9 Deactivate / reactivate cascades (soft disable → `isActive = false` tombstone)
- All flips happen **in the same transaction** as the entity change; the row stays, the page 404s, the slug stays claimed.
- **Destination deactivate** → `updateMany` **ALL** rows `WHERE destinationSlug = <slug>` → `isActive:false` (reserved row + categories + hubs + collections + tours).
- **Destination reactivate** → `updateMany` all rows for that `destinationSlug` → `isActive:true`.
- **Category deactivate / reactivate** → `updateMany WHERE entityType=CATEGORY AND entityId=<id>` — **flips that category's row on EVERY island at once**.
- **Hub deactivate / reactivate** → `updateMany WHERE entityType=HUB AND entityId=<id>`.
- **Collection deactivate / reactivate** → `updateMany WHERE entityType=COLLECTION AND entityId=<id>`.
- **Tour archive / restore** → `updateMany WHERE entityType=TOUR AND entityId=<id>` → `isActive:false` / `true`.
- **Guarded deactivation:** **destinations and categories refuse to deactivate while active non-draft trips are still assigned (throws `409`)** — prevents stranding live, bookable tours behind a 404 parent.

#### A4.10 Hard-delete cascades → row removed, then 90-day cooldown
- Permanent deletes `deleteMany` the registry rows **in the same transaction** as the entity delete.
- **Destination force-delete** → `deleteMany WHERE destinationSlug = <slug>`. **Blocked if `isSeeded`.**
- **Category force-delete** → `deleteMany WHERE entityType=CATEGORY AND entityId=<id>` (**all islands**). **Blocked if `isSeeded`.**
- **Collection force-delete** → `deleteMany WHERE entityType=COLLECTION AND entityId=<id>`.
- **Tour remove (hard)** → `deleteMany WHERE entityType=TOUR AND entityId=<id>`.
- After a hard delete the slug is **not immediately reusable** — it enters a **90-day soft-delete cooldown** before any new entity can claim it, **protecting against stale external links and search-index confusion**.

#### A4.11 Slug state machine
- `∅ --create()--> isActive:true --deactivate()--> isActive:false --forceDelete()--> cooldown --(+90 days)--> ∅ (free)`
- `isActive:false --reactivate()--> isActive:true`
- `rename → 301` writes a redirect and loops back into the active state.
- `isActive:false` is the **tombstone state**: routable lookups 404, the unique `(destinationSlug, slug)` pair is **still occupied**. **A hard delete frees the pair only after the cooldown window expires.**

#### A4.12 301 redirects on rename
- **Slugs are NOT immutable** (master §2.3) — this **supersedes the older "immutable, no 301" stance**.
- **Create mode (frontend):** slug field shown, auto-generates from name as the user types; once manually edited (`slugTouched`), auto-generation stops.
- **Edit mode (frontend):** slug is editable with a note that renaming issues a 301 redirect.
- Rename sequence:
  1. In the same transaction the registry row's `slug` is updated to the new value.
  2. A **redirect entry** is written mapping the old `(destinationSlug, oldSlug)` → the new flat URL, with **`status = 301`**.
  3. **The public resolver checks the redirect table BEFORE returning a 404**; a request for the old slug issues a permanent redirect to the new canonical URL.
- **Suggested redirect table (target schema, NOT yet built)** — `model SlugRedirect` (`@@map("slug_redirects")`): `id String @id @default(uuid())`; `destinationSlug String`; `fromSlug String` (old slug being vacated); `toSlug String` (new slug, or full target path for cross-type moves); `statusCode Int @default(301)`; `createdAt DateTime @default(now())`; `@@unique([destinationSlug, fromSlug])`.

#### A4.13 The 90-day reuse cooldown
- A hard-deleted slug is **not immediately available** to a new entity; the freed `(destinationSlug, slug)` pair is **held for 90 days** so stale external links and indexed URLs are **not silently rebound to an unrelated page**. After the cooldown the slug may be reclaimed.
- **Implementation options (target):** keep a **tombstone row with a `deletedAt` timestamp** and refuse reuse until `now > deletedAt + 90 days`, **or** carry the cooldown in the redirect/registry table.
- **`resolveUniqueSlug` step 3 must treat an in-cooldown slug as taken.**
- Reconciling collisions with 301/cooldown: the operator-name-suffix logic is unchanged for concurrent live entities; the 301/cooldown rules add **two extra "taken" conditions** — a slug with an outstanding 301 source, and a slug inside its 90-day cooldown.

#### A4.14 Registry invariants checklist (for reviewers)
- Every registry write is inside the entity's create/update `$transaction`.
- Category create → one row **per active destination**; **no FeaturedSlot rows**.
- Destination create → one `RESERVED 'tours'` row (+ one row per existing active category); **20 protected slugs per destination once all 19 categories exist**.
- Tour create → **always** one `TOUR` row; archive/restore toggles `isActive`; hard remove deletes it.
- **No registry write on a translation or page-content edit.**
- Rename → **301 entry written + registry `slug` updated, same transaction**.
- Hard delete → slug held in a **90-day cooldown**; `resolveUniqueSlug` treats in-cooldown slugs as taken.
- Deactivate → `isActive:false` (row kept); force-delete → row removed.
- **`entityId` is `null` iff `entityType === RESERVED`.**
- Public `resolve()` treats `isActive:false` as **404 (after checking the 301 redirect table)**.

#### A4.15 Registry implementation status (as of 2026-06-20)
- `SlugRegistry` table + `resolve()` endpoint — **Built**.
- Transactional write sites (destination/category/hub/collection/tour) — **Built**.
- `resolveUniqueSlug()` (operator-name suffix, no numerics) — **Built**.
- Flat `TOUR` rows / no hub-nesting — **Built**.
- **Category-create FeaturedSlot seeding — exists in code, must be REMOVED.**
- **`SlugRedirect` table + 301-on-rename — Not built** (target).
- **90-day reuse cooldown — Not built** (target).
- **Category gating threshold — Built at ≥1, must change to canonical ≥3.**

---

### A5. The 19 global categories & the category gating rule

#### A5.1 The 19 categories (one global set reused across every destination)
| # | Category name | Slug | Examples |
|---|---|---|---|
| 1 | Boat Tours & Cruises | `boat-tours` | catamaran, sailing |
| 2 | Snorkeling Tours | `snorkeling` | reef snorkel |
| 3 | Scuba Diving | `scuba-diving` | dive trips |
| 4 | Sunset Cruises | `sunset-cruises` | sunset sailing |
| 5 | Sightseeing Tours | `sightseeing-tours` | island highlights, city tours |
| 6 | Day Trips | `day-trips` | remote island trips |
| 7 | Off-Road Tours | `off-road-tours` | buggy, ATV, quad, jeep safari, 4x4, UTV |
| 8 | Jet Ski Tours | `jet-ski` | jetski trips |
| 9 | Parasailing | `parasailing` | parasail flights |
| 10 | Water Sports | `water-sports` | kayaking, paddleboard, SUP |
| 11 | Fishing Trips | `fishing-trips` | deep sea fishing, sport fishing |
| 12 | Nature & Wildlife Tours | `nature-wildlife-tours` | dolphins, parks |
| 13 | Hiking Tours | `hiking-tours` | volcano hikes |
| 14 | Adventure Tours | `adventure-tours` | zipline, bungee, skydiving |
| 15 | Cultural & Historical Tours | `cultural-tours` | heritage, art tours |
| 16 | Food & Drink Tours | `food-tours` | street food, rum tours |
| 17 | Attraction Tickets | `attraction-tickets` | museums, parks |
| 18 | Luxury Experiences | `luxury-experiences` | yacht experiences |
| 19 | Workshops & Classes | `workshops-classes` | cooking class |

- Together with the reserved `tours` slug these form the **20 pre-seeded protected slugs per destination**.
- The **curated discovery list per destination** draws from this set.

#### A5.2 Multi-category tagging
- A tour carries **1+ categories** via `TourCategory`, exactly one flagged **`isPrimary`** (which drives the breadcrumb).
- **Key overlaps are intentional:**
  - Sunset catamaran → `boat-tours` + `sunset-cruises`
  - Klein Curaçao trip by boat → `boat-tours` + `day-trips`
  - Jet ski + snorkel combo → `jet-ski` + `snorkeling` + `water-sports` (carries all three relevant slugs)
- **Day Trips is the one duration-based category**: it groups tours of **roughly 6 hours or more** regardless of activity, and is **almost always paired with the activity category**.

#### A5.3 "Luxury Experiences" naming lock
- **LOCKED, confirmed June 10, 2026:** "Luxury Experiences" stands.
- The category label **and its category-page H1** are the **single sanctioned use of "luxury" platform-wide**.
- **In running copy the word "luxury" stays banned**; copy under this category states what makes a tour premium instead: **private skipper, small group, champagne**.

#### A5.4 Category page visibility gate
- **Canonical rule: a category page is publicly live only when it has at least 3 published tours** in that category-and-destination combination.
- Below the threshold the page is automatically **`status: draft`** — excluded from **navigation, sitemaps, internal links, and search**; **404 to crawlers**.
- The check runs on **every tour status change in both directions** (publish can flip a category live; unpublish can flip it back to draft).
- **Confirmed June 10, 2026: the 3-plus-automation rule stands; the architecture file's threshold of 1 is superseded.**
- The `slug_registry` CATEGORY row **stays in place regardless** (it protects the slug); only page render/visibility is gated.
- **Gating applies to categories only** — hubs, collections and tours render whenever resolve succeeds and `isActive=true`.
- ⚠️ **CONFLICT — canonical vs built:** the canonical threshold is **≥3 published tours** (master §2.4), but ROUTING-AND-RESOLUTION §13, SLUG-REGISTRY §10, DATA-MODEL E.2 and the repo memory all record the gating as **BUILT AT ≥1** in code — flagged "to fix". Both states are documented; **≥3 is canonical, ≥1 is the shipped behavior as of 2026-06-20**.

---

### A6. SEO

#### A6.1 SEO ownership lock (master conflict log 67) — no page duplicates another's keyword territory
- **The destination page owns destination-level keywords and About content.**
- **Each category page owns its own vertical's About content** (boat-tour specifics, safety, best season).
- **The All Tours page owns long-tail filter queries** — it is a **transactional utility page**, not an SEO hub, and carries **no About content block**.
- Ads routing: broad campaigns ("curacao tours") land on All Tours; specific campaigns land on the matching category or tour page.
- The **Activity Hub is the primary Google Ads landing page** for its place/highlight.

#### A6.2 Metadata storage & the fallback chain
- Per-entity, per-locale meta lives in **`*PageContent` tables** with fields **`metaTitle`, `metaDescription`, `aboutText`**, keyed **`(entityId, locale)`**. Already built for destinations, categories, hubs, collections.
- **Tour meta is derived at render:** title from the translated name (**LD15 H1 pattern**), description from the overview, `og:image` from the hero image.
- **Global defaults live in the `SiteSEO` singleton.**
- **Fallback chain:**
  - A missing translation → **falls back to English**.
  - A missing `metaTitle` → **falls back to the template `"{name} | Island Tours"`**.
  - A missing description → **falls back to empty rather than a bad guess**.

#### A6.3 Canonicals, locale & hreflang
- **One canonical URL per tour:** flat `/{locale}/{destination}/{tour-slug}/`, **per-locale, trailing slash**.
- Each locale version has its **own canonical** URL.
- **`hreflang` pairs across all 7 locales (EN, NL, DE, FR, ES, PT, ZH) plus `x-default → EN`** on every content page.
- Emitted markup example for `/*/curacao/boat-tours/`: `<link rel="alternate" hreflang="en|nl|de|fr|es|pt|zh" href="/{locale}/curacao/boat-tours/" />` plus `<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />`.
- Slugs are English in every locale; **only the locale prefix switches language**.
- **Renames issue a 301** from the old URL (redirect table); deleted slugs observe the **90-day reuse cooldown** — **canonical chains therefore stay clean**.
- **Filtered listing URLs carry a self-referencing canonical to the clean URL** (master conflict log 61): `/en/curacao/boat-tours/?booking_type=private` canonical → `/en/curacao/boat-tours/`.
- **Filtered pages use query params, never new slugs.** Prefer a filtered category URL over a dedicated collection page when the "collection" is really just a filtered category. **Collection slugs must be semantically distinct from category slugs** (`top-10-tours` correct, never `boat-tours-private`).

#### A6.4 The full JSON-LD matrix per surface (master §2.6)
- **Every page with breadcrumbs → `BreadcrumbList`.**
- **Tour detail → `Product`/`Offer`**, with:
  - `acceptedPaymentMethod` **including ApplePay and GooglePay**
  - `audience.suggestedMinAge` from **`tour.min_age_years`**
  - **accessibility fields** from the LD27 data set
  - `refundPolicy` from **`tour.cancellation_hours`**
  - **`includes` and `excludes` arrays** mirroring LD18
  - **`Review` + `AggregateRating`** from §4.7.18 and the LD29 preview cards
- **Help Center `/help` → `FAQPage`.**
- **Collection and Activity Hub → `FAQPage`** on their FAQ sections.
- **Destination → `FAQPage`** on the NeedHelp FAQ column (SEO ownership lock, conflict log 67).
- **All Tours → `ItemList`** on the tour grid **plus `BreadcrumbList`**; **server-rendered crawlable list**; filter query params carry **self-referencing canonicals to the clean URL**.
- **Search results → NO schema: `noindex, follow`** (search spec).
- The dedicated tour-page schema spec (Round 7) is **still to be written (C16)**.

#### A6.5 Sitemaps & robots
- **`/sitemap.xml` index** plus **per-locale and per-page-type sitemap files**.
- **Published entities only**; **categories below the ≥3 threshold excluded**; **`lastmod` on change**.
- **`robots.txt`:** **disallow `/admin`, `/api`, `/dashboard`; allow `/`; declare the sitemap.**

#### A6.6 TYP noindex & transactional surfaces
- The Thank You page `/{destination}/thank-you/{public_ref}` is **noindex** and carries **no locale prefix** (transactional surface) — B.48 confirmed.
- Because it is `noindex`, the locale-prefix rule for content pages does not apply to it.
- **Search results** are `noindex, follow` and SSR, not cached.
- The **wishlist page** sets `robots: { index: false }`.

#### A6.7 Ethical CRO signals (no dark patterns)
- Transparency is a brand pillar: **no fake urgency, no fake scarcity, no badge inflation, no pre-checked add-ons.**
- **Paid placement always carries the `Sponsored` badge.**
- **The only demand signal is the single sell-out trigger** (master §3.7), driven by real `recent_sellouts` data.
- **Capacity messaging uses live availability ("Only N left" in the party selector), never invented countdowns.**
- CRO counters `booking_count`, `booking_count_today`, `spots_remaining`, `last_booked_at` exist in the model but have **no consumer urgency surface in v1**.
- **`Most popular` is editorial/quality-based** — organic tour, `review_count ≥ 10`, rating `≥ 4.5`, **max 1 per category** — **never commission-driven**.

#### A6.8 SEO implementation status
- Backend SEO data (meta tables, `aboutText`, derivable tour fields) is **largely in place**.
- **The frontend rendering layer (meta emission, canonical/hreflang tags, JSON-LD emitters, sitemaps, robots, breadcrumb JSON-LD) is a build task.**

---

### A7. Multilingual & localization

#### A7.1 Locales
- **Seven locales from launch, English primary: `EN, NL, DE, FR, ES, PT, ZH`.**
- DB `Locale` enum ordering is `en, es, nl, pt, fr, de, zh` — the same set.
- **All UI strings go through `next-intl`; no hardcoded English anywhere.**
- The tagline **"Island Tours. Built by Islanders." stays English in every locale** (brand mark).
- Copy must translate cleanly across seven locales: **avoid idioms that break in translation**.
- Latin locales share one type scale; **ZH may adjust**; **ZH may render the full-width comma**.

#### A7.2 The English-slug rule
- **Slugs are always English, never translated** — one slug worldwide per page; the locale prefix alone switches language (`/en/…`, `/nl/…`, `/zh/…`).
- **Why English slugs:** avoids **7× registry multiplication**; tourists predominantly search in English; **SEO value lives in translated titles/meta/H1/body, not the slug**; keeps the registry to **one row per entity per destination**.
- `/nl/curacao/boottochten/` is **wrong** — translated slugs are never used.

#### A7.3 Translation storage model — typed translation tables (not EAV)
- Each translatable entity has a **typed child table keyed `(entityId, locale)` unique**:
  - **Destination** → `DestinationTranslation` — `name, overview, h1Override, breadcrumbLabel, isMachineTranslated`
  - **Category** → `CategoryTranslation` — same shape
  - **Hub** → `HubTranslation` — same shape
  - **Trip** → `TripTranslation` — `title, overview, description, isMachineTranslated`
  - **Collection** → `CollectionTranslation` — `name, overview, h1Override, breadcrumbLabel, isMachineTranslated`
  - **Tour highlights / inclusions / exclusions** → `Tour*Translation` — `text/label, isMachineTranslated`
- **SEO meta is stored separately per locale** in the `*PageContent` tables (`metaTitle`, `metaDescription`, `aboutText`).
- **FAQ is a polymorphic table** (`pageType` + `entityId` + `locale`).
- `name` overrides are optional; **a null translated `name` falls back to the canonical base value**.

#### A7.4 Fetch & fallback
- **All content API endpoints accept a `locale` query parameter defaulting to `en`.**
- The service fetches the requested locale and **falls back to English field-by-field** when a translation row or field is missing — **never a blank render**. Applies to names, overviews and meta alike.

#### A7.5 Translation upsert payload contract
- Translation upserts **wrap fields in a `fields` key** plus an `isMachineTranslated` flag.
- **Sending fields flat fails the global `ValidationPipe`** (`forbidNonWhitelisted` → **400**).
- Correct shape: `{ "fields": { "name": "…", "overview": "…", "h1Override": null, "breadcrumbLabel": null }, "isMachineTranslated": false }`.

#### A7.6 English (base-locale) tab rules
- `name` is **read-only on the English tab** (canonical value, edited in the Details tab); all other fields editable (via `LocaleTab` with the `disableNameField` prop).
- The English **"Delete translation" action does NOT call the delete endpoint** (the backend blocks it). It **upserts the editable fields as `null`** — label it **"Clear Fields"**; branch `handleDelete` on `disableNameField`.

#### A7.7 Machine translation & the `isMachineTranslated` flag
- A **BullMQ background job** translates content to the other six locales after the English source is saved, setting **`isMachineTranslated = true`**.
- **Proper nouns (destination and hub names) are never machine-translated.**
- **Reviews use the LD32 path** — Google Translate per card with a show-original toggle — **cached per locale**.
- AI translation is one of the master's sanctioned BullMQ async workloads.

#### A7.8 SEO i18n
- **`hreflang` across all 7 locales plus `x-default → EN`** on every content page.
- **On slug rename a `301` is issued** (slugs are not immutable).
- **On admin content update, on-demand ISR revalidation fires for all 7 locale URLs.**
- **ISR revalidation follows the URL shape:** a category lives at **every destination × locale**, so a content edit **revalidates the full matrix** — `for (locale of LOCALES) for (dest of ACTIVE_DESTINATIONS) revalidatePath('/{locale}/{dest}/boat-tours/')`; a **hub** edit revalidates per-locale at its one path; a **destination** edit revalidates per-locale at its one path.

---

### A8. Rendering, caching & revalidation

#### A8.1 Canonical ISR/revalidation per page type (master §2.5)
| Page type | Rendering | Revalidation |
|---|---|---|
| Homepage | ISR | **60 s** |
| Destination | ISR | **60 s** |
| All Tours | ISR | **60 s** |
| Category | ISR | **60 s** |
| Collection | ISR | **60 s** |
| Activity Hub | ISR | **300 s** |
| Tour detail | ISR | **30 s** |
| Search results | **SSR** | **not cached** |
| Thank You page (TYP) | **Server-rendered** | n/a (**noindex**) |

- **Rationale:** tour detail uses the shortest revalidation (30 s) because **availability and pricing must stay current**; Activity Hubs cache longest (300 s) — predominantly static SEO content; Search is fully dynamic SSR.
- **The TYP is server-rendered with `conversion_fired_at` set server-side before render** for mark-first idempotency.
- **All content API endpoints accept a `locale` query parameter defaulting to `en`, with English fallback for missing translations.**
- Tour detail performance budget per Section4_7 §1.3.

#### A8.2 The shipped Next.js 16 Cache Components model (`cacheComponents: true`, PPR)
- Framework: **Next.js 16 with `cacheComponents: true` (Partial Prerendering)** — `next.config.ts:5`.
- **No route file declares any segment config** (`dynamic`, `revalidate`, `fetchCache`, `runtime`, `dynamicParams`); all rely on defaults (`dynamicParams = true`) plus **per-loader `cacheLife`/`cacheTag`**.
- Content on a route falls into **three buckets**:
  1. **Static** — synchronous JSX and pure computation; **prerendered at build, served instantly, changes only on redeploy**.
  2. **Cached (`'use cache'`)** — async data that need not be fresh every request; **stored keyed by function id + serialized args + closure**, governed by `cacheLife` (lifetime) and `cacheTag` (event invalidation); part of the prerender, regenerated when its tag is busted or lifetime expires.
  3. **Dynamic (Suspense)** — request-time data (`cookies`, `headers`, `searchParams`, `connection()`, randomness, current time); **must be wrapped in `<Suspense>`**, excluded from the static prerender, streamed at request time.
- **A `<Suspense>` boundary only actually streams (and shows its fallback skeleton) if the component inside it reads request-time data.** A purely cached component wrapped in `<Suspense>` **does not stream** — it resolves at prerender time and is baked into the static shell, and **its fallback effectively never renders** ("inert Suspense").
- **`await connection()` opts a subtree into dynamic rendering** — using it on entirely-cached data **deliberately converts prerenderable content into a per-request streamed hole (with a skeleton flash) for no freshness benefit**. It is a **perceived-performance lever, not a correctness requirement**.
- **Cannot read `cookies()`, `headers()` or `searchParams` inside a `'use cache'` function** — request-time inputs are always read outside the cached scope and passed in, or deferred to client islands.
- **No route awaits uncached data outside a `<Suspense>` boundary** — every `searchParams` is kept as an un-awaited Promise until inside a boundary. This is why the production build is green (**awaiting `searchParams` outside Suspense throws the Next 16 Blocking Route error**).

#### A8.3 Per-route render mode (as reviewed 2026-07-12)
| Route | Render mode | Prerendered params | `loading.tsx` | Streamed holes |
|---|---|---|---|---|
| `app/(frontend)/layout.tsx` | Fully static | n/a | n/a | none |
| `[locale]/layout.tsx` | Fully static shell | **all 7 locales** | No | none (`WishlistProvider` is a client island) |
| `[locale]/page.tsx` (home) | **Fully static** | inherits locale | No | none |
| `[locale]/[destination]/page.tsx` | Partial prerender | active destinations + launch fallback | **Yes (added)** | Hero, Local Favourites, Collections (later baked static) |
| `[locale]/[destination]/tours/page.tsx` | Partial prerender | active destinations + launch fallback | **Yes (added)** | Header (baked), Listing (streams) |
| `[locale]/[destination]/[slug]/page.tsx` | Partial prerender | destination × category + fallback; tours/hubs/collections on-demand | **Yes** | owned by each entity component |
| `[locale]/search/page.tsx` | Partial prerender (body) | none | No | Results (`generateMetadata` reads `searchParams` → dynamic metadata) |
| `[locale]/wishlist/page.tsx` | Fully static shell | none | No | none (client `WishlistView`) |

- `generateStaticParams` for `[destination]` uses `getActiveDestinations()`; **on throw or empty it falls back to `LAUNCH_DESTINATION_SLUGS` (5 slugs) — backend-down safe**. `notFound()` gate on `!island.isActive`.
- `[slug]/page.tsx` `generateStaticParams` builds destination × category combos; **on throw or empty falls back to launch destinations × launch categories + `'tours'` + `klein-curacao`**.
- **Every `(frontend)` route needs `generateStaticParams` with ≥1 entry or the layout throws a Blocking Route error.**

#### A8.4 `'use cache'` loader policy & the cached-loader ledger
- **Every public data loader is a `'use cache'` function with an explicit `cacheLife` and (almost always) a `cacheTag`. No loader is silently uncached.**
- **EXECUTED 2026-07-19 (ISR-cost pass):** all **event-covered entity/meta loaders moved from `hours` (revalidate 1 h, expire 1 d) to the built-in `days` profile (stale 300 s, revalidate 1 d, expire 1 w)**; the slug-registry's inline `{300,300,3600}` moved to `days` (it had been revalidating every 5 minutes). Rationale: these loaders are already invalidated on demand by the dashboard write bridge (`updateTag`), so short timers only burned ISR writes.
- **Deliberately NOT switched:** `getDestinationTours` and `searchTours` (**nightly quality-score/eligibility re-rank has no tag-bust event; hourly/minutes windows are the freshness mechanism**) and `getPlatformReviews` (external provider aggregate, no change event, single cache entry).
- Loader ledger (loader — `cacheLife` — `cacheTag`s):
  - `getDestinationCategories` — `days` — `categories`, `tours`
  - `getCategoryBySlugForDestination` — `days` — `tours` + `category:${id}` when found, else `categories`
  - `getCategoryPageContent` — `days` — `category:${categoryId}`
  - `getCategoryFaqs` — `days` — `category:${categoryId}`
  - `getActiveCollectionsForDestination` — `days` — `collections`
  - `getCollectionRender` — `days` — `tours` + `collection:${id}` when found, else `collections`
  - `getCollectionPageContent` — `days` — `collection:${collectionId}`
  - `getActiveDestinations` — `days` — `destinations`
  - `getDestinationBySlug` — `days` — `destination:${id}` when found, else `destinations`
  - `getDestinationFacets` / `getCategoryFacets` — `days` — `tours`, `categories`
  - `getDestinationHubs` — `days` — `hubs`, `tours`
  - `getHubRender` — `days` — `tours` + `hub:${id}` when found, else `hubs`
  - `getHubPageContent` — `days` — `hub:${hubId}`
  - `getTourReviews` — `days` — `reviews`, `tour:${tourId}`
  - `searchTours` — **`minutes`** — `search`
  - `getDestinationTours` — **`hours`** (kept short: nightly re-rank without tag bust) — `tours`
  - `getTourBySlug` — `days` — `tour:${id}`, `operator:${operatorId}` when found, else `tours`
  - `resolveSlug` — `days` — `slug:${destinationSlug}:${slug}`, `slug-registry`
  - `getDictionary` — **`max`** — **no tag, untagged by design** (UI chrome strings ship with the build; editing dictionary JSON requires a redeploy)
- **The complete tag universe.** Coarse (literal): `categories`, `tours`, `collections`, `destinations`, `hubs`, `reviews`, `search`, `slug-registry`. Granular (templated): `category:${id}`, `collection:${id}`, `destination:${id}`, `hub:${id}`, `tour:${id}`, `operator:${id}`, `slug:${destinationSlug}:${slug}`.

#### A8.5 The four data-fetch entrypoints and the two error contracts
- **`apiFetch`** — client + cookie; **throws**; used for authenticated dashboard calls; fires public cache revalidation on success.
- **`publicFetch`** — returns the raw Response regardless of status; **retries only on HTTP 429/503 with fixed backoff `[300, 800]` ms (no jitter, since it runs inside `'use cache'`)**.
- **`publicGet<T>`** — **throw-free: `null` on any failure** (network, non-2xx, bad JSON). **Use ONLY for soft-fallback data** (lists that render empty, optional sections).
- **`publicGetStrict<T>`** — for data a page gates with `notFound()`: **`null` ONLY on a backend 404** (genuine not-found); **THROWS `BackendUnavailableError` on network error / 5xx / 429-after-retries / bad JSON**. **The throw makes an ISR background revalidation FAIL, so Next keeps serving the last good prerendered page instead of caching a 404 over it.**
  - Before this split, a backend outage during the 5-minute stale-window revalidation **replaced every destination/entity page with a cached 404** (observed in production 2026-07-19 as `/en/curacao` + `/en/aruba` 404s).
  - **Strict callers:** `getDestinationBySlug`, `resolveSlug`, `getTourBySlug`, `getCategoryBySlugForDestination`, `getHubRender`, `getCollectionRender`, `getTypByRef`. Everything else stays on `publicGet`.
  - **Trade-off:** `next build` now **requires the backend to be reachable for prerendered entity routes** (it fails loudly instead of silently baking 404s). **Soft contexts embedding a strict loader must `.catch(() => null)` locally.**
- `serverHeaders()` sets `Content-Type: application/json` and, when `INTERNAL_API_SECRET` is set, adds **`x-internal-api-key: <secret>`** to identify the SSR/build server as a trusted origin so the backend **skips its per-IP rate limiter** (server-only secret, never `NEXT_PUBLIC_`).
- Base URL: `${NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`.

#### A8.6 Cache-tag revalidation (mutation → public cache bust)
- Mechanism:
  1. A dashboard mutation (TanStack Query `useMutation`) calls a `lib/api/<module>.ts` method → `apiFetch(path, init)`.
  2. On a successful (`res.ok`) response `apiFetch` calls **`revalidatePublicForPath(path, method)`**.
  3. `revalidatePublicForPath` **short-circuits for non-mutating verbs** (`MUTATING_METHODS = POST/PATCH/PUT/DELETE`), maps path → tags via `tagsForMutation`, and if non-empty fires the Server Action **fire-and-forget: `void revalidateCacheTags(tags).catch(() => {})`**. **A failure is swallowed; stale cache self-heals at the next `cacheLife`.**
  4. `revalidateCacheTags` (a `'use server'` action) loops the tags and calls **`updateTag(tag)`**.
  5. **`updateTag` immediately expires those tags**; the next request regenerates any `'use cache'` read carrying a matching `cacheTag`.
- **Only `updateTag` (immediate) is used. There is no `revalidateTag` (background) and no `revalidatePath` anywhere in the app** — chosen so the **next visitor** sees the change.
- **`updateTag` throws in Route Handlers** — it must be called from a Server Action.
- **Trigger → tag mapping** (the `switch (seg0)` in `tagsForMutation`; `slug` = `['slug-registry']` only when `affectsSlugRegistry(parts, method)`):
  - `tours` with seg1 present and seg1 != `slug` → `tour:<seg1>`, `tours`, `search` (+ `slug-registry` if slug-affecting)
  - `tours` bare (`POST /tours`, or `/tours/slug/...`) → `tours`, `search` (+ `slug-registry` on `POST /tours`)
  - `availability` (any mutation) → `tours`, `search`
  - `tiers` with seg1=`tours` and seg2 → `tour:<seg2>`, `tours`, `search`; `tiers` otherwise → `tours`, `search`
  - `attributes` → `tours`, `search`
  - `operators` with seg1 → `operator:<seg1>`, `tours`, `search`, `user-profile`; bare → `tours`, `search`, `user-profile`
  - `destinations` with seg1 → `destination:<seg1>`, `destinations` (+ `slug-registry`); bare → `destinations` (+ `slug-registry` on POST)
  - `categories` with seg1 → `category:<seg1>`, `categories` (+ `slug-registry`); bare → `categories` (+ `slug-registry` on POST)
  - `collections` with seg1 → `collection:<seg1>`, `collections` (+ `slug-registry`); bare → `collections` (+ `slug-registry` on POST)
  - `hubs` with seg1 → `hub:<seg1>`, `hubs` (+ `slug-registry`); bare → `hubs` (+ `slug-registry` on POST)
  - `users` (e.g. `/users/me`) → `user-profile`; `settings` (e.g. `/settings/social-media`) → `user-profile`
  - **anything else** (media-gallery, operator-settings, wishlist, read-only lookups) → **`[]` no-op**
- **`affectsSlugRegistry` is true for:** `POST /entity` (1 segment); `DELETE`/`PATCH /entity/:id` (2 segments); `/entity/:id/<verb>` where verb ∈ **`LIFECYCLE_VERBS = {status, publish, pause, unpause, archive, restore}`**.
- **Tags are de-duped via `[...new Set(tags)]`.** The `tours` branch **guards `seg1 !== 'slug'`** so `/tours/slug/:slug` read paths never produce a bogus `tour:slug` tag.
- **Special rules:** slug-registry busting is appended **only** for slug-affecting writes — **content-only sub-routes (translations, page-content, FAQs, images) do NOT bust `slug-registry`**. `user-profile` is busted by `users`, `settings` **and** `operators` (the last because `getUserProfile` reads operator company/social info). wishlist, media-gallery, operator-settings and read-only slug lookups are **intentionally unmapped no-ops**.
- **14 distinct bustable tags:** `tours`, `search`, `destinations`, `categories`, `collections`, `hubs`, `slug-registry`, `user-profile`, `tour:<id>`, `operator:<id>`, `destination:<id>`, `category:<id>`, `collection:<id>`, `hub:<id>`.
- `slug:${dest}:${slug}` is **covered by the coarse `slug-registry` tag** (never busted granularly, which is fine).
- **Backend-driven bust:** `NightlyJobsService.run()` ends by calling `PublicCacheService.revalidateTags(['tours','search'])`, which **POSTs the frontend `POST /api/revalidate`** (header `x-revalidate-secret`; backend env `REVALIDATE_SECRET` + `ISLAND_TOURS_URL`; **no-ops with a warning when unset**), so listings pick up the **03:00 UTC re-rank** on the next visit instead of waiting out the daily timer.

#### A8.7 Streaming / PPR policy (the coherent policy applied)
- **Prerendered content routes** (home, `[destination]`, `[destination]/tours`, category): **cached sections bake into the static shell** — instant LCP, SEO content in the initial HTML, no skeleton flash — kept fresh via cache tags. **Streamed holes only for `searchParams`** (tours-listing, search-results). **Route `loading.tsx` covers client navigation and cold on-demand param misses.**
- **On-demand entity routes (`tour`, `hub`) under `[slug]`:** **instant cached shell + stream the heavy/secondary fetch via `await connection()` behind its skeleton.** Tour detail already did this; `hub-trips` was changed to do it too. **Collection has no secondary fetch, so it stays fully static and relies on `[slug]/loading.tsx`.**
- **Net rule: every `<Suspense>` boundary must either genuinely stream or be removed, and every section skeleton must have a defined home** (streamed fallback for on-demand sections; `loading.tsx` composition for prerendered ones).
- **Any dynamic page/component must never render blank:** per-independent-fetch `<Suspense>` boundaries with skeletons that mirror each section; push the fetch into the section so ready parts stream/interact in parallel.
- **Next.js `loading.tsx` does NOT cascade to parent/sibling segments** — each on-demand-capable segment needs its own.
- Skeletons live in `components/skelitons/` (misspelling is the actual path).
- **Entrance animation by render path:** Suspense-**streamed** content → `MountReveal`; **static-shell (prerendered)** content → **no self-animation** (`PageTransition` owns page-enter; a hydration-started `MountReveal` on SSR content flashes/"shakes"); below-fold → `Reveal`.

#### A8.8 Known rendering gaps & fixes (review 2026-07-12, executed)
- **🔴 G1 — `reviews` was unbustable.** `getTourReviews` tags `reviews` + `tour:${id}` but `cache-revalidation.ts` had **no `case 'reviews'`**. Latent (no review-mutation client yet). Impact when review moderation ships: review list **and** the tour rating/count aggregate (`getTourBySlug`, tagged `tour:${id}`) stale up to 1 hour. **Fix: add `case 'reviews'` busting `['reviews', tour:${id}, 'tours', 'search']`** (tours/search included because tour cards display the rating). **Executed.**
- **🟠 G2 — no `loading.tsx` on on-demand-capable content routes.** Only `[slug]` had one; `[destination]` and `[destination]/tours` had none, so a non-prerendered destination could hang on a blank body. **Fix executed: `loading.tsx` added at both segments composing the existing section skeletons.**
- **G2b (minor) — `getDictionary` is untagged** (`cacheLife('max')`, no `cacheTag`). Fine while locale copy ships with the build; add a `translations` tag only if the dictionary becomes backend-editable. **Left open by design.**
- **Systemic inconsistency (resolved): inert Suspense boundaries.** `ToursHeaderSection` (dead `connection` import), `DestinationHeroSection`, `DestinationCollectionsSection` and `HubTripsData` were wrapped in Suspense but had no request-time trigger, so **`ToursHeaderSkeleton`, `DestinationHeroSkeleton`, `DestinationCollectionsSkeleton` and `HubTripsPanelSkeleton` rendered nowhere**. Fixed by baking the prerendered ones static (+ `loading.tsx`) and adding `await connection()` to `HubTripsData`.
- **Verification after execution:** `pnpm build` green, TypeScript clean, **static page count rose 356 → 434**, all affected routes classify as Partial Prerender (`◐`), no "Uncached data accessed outside Suspense" errors.
- **Vercel RSC-variant bug (fixed 2026-07-19):** on Vercel (not locally), **RSC navigation requests to NON-prerendered `[slug]` paths were served the cached HTML document (`text/html`, `x-vercel-cache: HIT`) instead of the flight payload**, so every tour-card click aborted client nav and hard-reloaded. Two fixes: **`generateStaticParams` now prerenders ALL known slugs** (categories + hubs + collections + tours via paginated `getAllTourSlugs` — the listing DTO **caps `limit` at 100**, and a 400 would silently prerender zero tours), and **`proxy.ts`'s matcher now EXCLUDES locale-prefixed paths**. Verified: **868 pages**, locale redirect / TYP + cancel rewrites / dashboard guard intact, tour RSC requests return `text/x-component`.
- **Streaming entity/destination shells:** `[slug]/page.tsx` and `[destination]/page.tsx` **no longer await anything before returning JSX** — they return `<Suspense fallback={<EntityPageSkeleton|DestinationPageSkeleton>}>` around an async dispatch component (`EntityDispatch`/`DestinationContent`) doing the resolves **in parallel via `Promise.all`**. Cold paths paint the skeleton instantly and stream. **Cold-path TTFB 0.27 s vs blocking full-render before.**
- Note: `middleware.ts` is **renamed `proxy.ts` in Next 16**, and **proxy rewrites run before `next.config` rewrites** — the locale-less TYP URL is served by a `proxy.ts` rewrite, not `next.config`.
- ⚠️ **CONFLICT — declared vs shipped rendering model:** the master §2.5 specifies **per-page-type ISR with fixed revalidate windows (60/300/30 s, SSR for search)**; the shipped frontend instead uses **Next 16 Cache Components / PPR with per-loader `cacheLife` profiles (`minutes`/`hours`/`days`/`max`) plus on-demand `updateTag` busting** and **no route-level `revalidate` segment config at all**. Both are recorded; the shipped model is the later implementation of the same freshness intent.

---

### A9. Design system & brand voice

> Depth reference: `Island_Tours_UI_UX_Structure_V2.md` — partially overruled, master wins (5 conflict-log notes). Brand voice deep reference: `Island_Tours_Brand_Voice_Bible.md` v1.1 (§4 is the operative digest).

#### A9.1 Color (§3.1)
- **Brand orange** (primary CTAs, active states, highlighted icons only): **`#E8611A`**.
- **Peach tint** (card #1 on curated persona lists only): **`#FBF1EA` family**; the card-spec range is **`#FDF6F0` to `#FFF5EE`**, designer-final within palette.
- **Body text:** near-black **`#1F2937`**.
- **Secondary text and sub-header icons:** **`#6B7280`**.
- **Borders and dividers:** **`#E5E7EB`**.
- **Trust checkmarks:** green **`#16A34A`**.
- **Background:** white / off-white.
- **WCAG AA contrast is mandatory.**
- Brand orange **fails on light backgrounds for body text** — use it for accents and CTAs, **not running text**.
- The **Stripe badge uses the official logo kit in the `slate` variant** (blurple clashes with brand orange).
- Frontend implementation rule: **colors are tokenized as `--it-*` CSS vars and used as Tailwind utilities** (`bg-it-primary`, `text-it-ink`); **never inline `style={{}}` objects**.
- **Every photo container gets `bg-it-border` (#ededed)** as the image fallback background — on the container, never on cross-fade layers.

#### A9.2 Typography & spacing (§3.2)
- The typography scale is a **design-team deliverable** (locked during the v2 design phase) within the stated rules.
- **H1 largest and semibold.**
- **H2 consistent across all sections of a page.**
- **Body 14 to 15px.**
- **Microcopy 11 to 12px, neutral gray.**
- **Latin locales share one type scale; ZH may adjust.**
- **Section padding 64 to 80px desktop, 40 to 56px mobile.**
- **Component internal padding 16 to 24px.**
- **Container width 1200px.**
- **Standard listing grid is 3 columns desktop.**
- Frontend rule: **tokenize colors only; type metrics (font-size / letter-spacing / line-height) stay inline Tailwind values**; use **px, not rem**, in arbitrary values.
- Frontend rule: reuse the section utilities `it-section` (vertical padding token) + `it-container` (max-width 1440 + horizontal padding token) — **never hardcode padding**.
- Fonts: **SF Pro system stack** (`font-it-display`, `font-it-body`) — no `next/font`.
- Sitewide tour-grid standard: `grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4` for every tour-card grid (tours/collection/hub/related/search/wishlist); **mobile carousels stay carousels**.

#### A9.3 Icons (LD20, §3.3)
- **One SVG library platform-wide** — **Lucide recommended, Heroicons alternative**; design picks and locks one.
- **Icon size 18 to 20px, ~1.5px line stroke, monochrome.**
- **Default icon color gray `#6B7280`; brand orange for active states only.**
- **No emoji in production UI, ever.**
- **No mixed icon sets. No inline icons in body copy.**
- **Minimum launch icon set (15):** check, x, pin, clock, van, star, sparkle, heart-outline, arrow-up-right, globe, bag, ban, info-circle, **flame (demand signal)**, **lock (payment CTA)**.
- **Emoji appearing in specs are shorthand for these icons.**
- Frontend implementation: Figma icons are **SVG files in `public/icons/`, rendered via `next/image`** — never inline `<svg>` or a lucide stand-in for a Figma icon; section-prefix filenames (`nav-*`, `hero-*`, `footer/*`); keep the Figma colour baked in; `alt=''` for decorative icons. `lucide-react` is allowed only for generic affordances not in Figma (hamburger, chevrons, back arrow).

#### A9.4 Typographic separator system (LOCKED, confirmed June 10, 2026 — §3.4)
- **Three tiers, platform-wide.** The earlier four-tier system that used a pipe between info categories was reversed; **the pipe is retired everywhere** (B.14, C12).
- **Tier 1 — `·` middot** — between inline items and info categories in a single row. Examples: `★ 4.8 (1,738) · ✦ Locals' favorite · 📍 Willemstad, Curaçao` and `Full day · 8 to 9h · From $120`.
- **Tier 2 — `,` comma** — inside one geographic reference only. Example: `Willemstad, Curaçao`. (The comma is grammatical notation, not a separator tier.)
- **Tier 3 — `›` right angle** — **breadcrumbs only**. Example: `Home › Curaçao › Tour name`.
- **ZH may render the full-width comma.**
- **Hub fast-facts rows that previously mixed pipes normalize to middots.**

#### A9.5 Badges (§3.6)
- **Sponsored** — rounded rectangle, **gray** — trigger: **paid tier P1–P3 placements**; always shown on paid placement (transparency is a brand pillar).
- **Most popular** — rounded rectangle, **brand orange** — trigger: **organic tour, `review_count >= 10` and rating `>= 4.5`; max 1 per category** — **never awarded on commission-tier grounds**. (B.33: "Bestseller" → "Most popular".)
- **Likely to sell out** — rounded rectangle — **single platform trigger** (§3.7).
- **New** — rounded rectangle — trigger: **tour published under 30 days ago and `review_count = 0`**; **replaces the rating row on cards** (added June 10, 2026, conflict log 64).
- **Numbered rank 01 to 10** — **circle**, brand orange — trigger: **Best Things to Do and Top 10 collections only**. **Circles mean rank; rounded rectangles mean status. Never on destination-page sections.**
- **Locals' favorite ✦** — a **meta-row element on tour pages** — trigger: **manual editorial boolean `tour.is_locals_favourite`, target ~30% of catalog** — **not algorithmic, not tier-linked**; also drives the destination featured grid and the Top 10 Tours page.
- **Demand signaling — one trigger (LOCKED)**: one algorithm powers both the card "Likely to sell out" badge and the tour-page demand card; **all three conditions must hold, evaluated daily** — (1) `tour_age_days >= 90`; (2) `recent_sellouts >= 3` in the past 60 days; (3) `upcoming_availability_ratio < 0.40` over the next 30 days. A **manual CMS override flag** exists for launch (no tour has 90 days of history) and is removed once organic data accrues. Sellout events come from `departures.sold_out_at`. **Expected coverage ~5 to 10% of catalog; selectivity is the feature.** This supersedes the three earlier per-page trigger definitions.
- **Diversity pass:** after ranking, listings apply a diversity pass — **never more than 2 tours of the same subtype consecutively**.

#### A9.6 Navigation bar (§3.9)
- **Nav is sticky.**
- **Destination-context state** contains: logo, **location selector showing the current island**, **Categories dropdown**, **search**, **language switcher**, **wishlist**, **account**.
- Categories dropdown shows the **curated discovery list**, items with **40 to 48px rounded thumbnails** per the Fever pattern.
- **Search:** compact pill while the hero is in view, expanded after scroll, **scoped to the destination**.
- **Homepage variant:** location selector reads **"Select your island"**; **Categories and search are hidden** (no destination context).
- **The currency selector lives in the footer only, never the nav.**

#### A9.7 Footer (§3.10)
- **Global footer on every page.**
- Contains: **destination links (Curaçao · Aruba · Sint Maarten)**, **support (WhatsApp link**, deep-link behavior per §6.6**)**, **legal**, **language switcher**, **currency selector** (locale-defaulted), **payment logos in white/monochrome**, and the brand sign-off **"Built by Islanders."** at display size.
- The footer sign-off is the tagline's **one persistent on-page home** (the tour-page closing trust block was dropped).
- **Mobile renders the footer fully expanded, never an accordion** (decided June 7 footer session; conflict log 66).
- **No black-and-white Curaçao flag** on the Explore links.
- **Payment logos and the Powered by Stripe badge align flush to the language pill's outer left edge** (locked).
- **Payment logo set:** VISA, Mastercard, PayPal, iDEAL, Apple Pay, Google Pay, Klarna, Amex. **Footer renders them monochrome; in-section renders full color.**

#### A9.8 Brand voice (§4.1)
- Voice is **warm, plain, confident, understated**.
- **First-person plural where natural** ("We confirm your booking in seconds").
- **Specific over vague** ("Reef-safe sunscreen protects coral and your skin", not "appropriate sun protection").
- **Active voice.**
- **Caribbean-proud without cliché.**
- **No superlatives without specifics, no defensive framing, no corporate stacking of features, no fake urgency.**
- **Power-word register:** spot, works, locals, picked, plans.

#### A9.9 Hard voice rules (§4.2)
- **Operator names never appear in discovery-layer copy** (cards, hub comparison tables, Our Pick, collections).
- **Hub comparison columns and Our Pick reference tour titles, not operator names.**
- Operators are named in **exactly two contexts**: (a) the tour detail page **"Supplied by {operatorName}"** line (LD14), and (b) **post-booking surfaces** (TYP, confirmation email), per the two-phase principle.
- **Claims must be verifiable.** No invented stats; directional benchmark language only when honestly labeled.
- Real operator names appear in **spec examples only** (LD10): Miss Ann, Mermaid, Gold Seahorse, BlueFinn, Irie Tours, Powerboat.
- **No em-dashes anywhere in platform copy.** Use periods, commas, colons, occasional semicolons. Source strings containing em-dashes have been rewritten (before/after list in Appendix C item C13).

#### A9.10 Banned words (LD9, platform-wide)
- **Banned:** paradise, luxury, exclusive, seamless, world-class, **"discover" as a verb opener**, unlock, adventure-awaits, committed-to, magical, amazing, incredible (without specifics), hassle-free, curated by experts, premium (without justification), don't miss out, hurry.
- **Also banned:** **"Subscribe"** (use **"Email me"**), **"Submit"**, **"Customer support"** (use **"WhatsApp us"**), and **"cart"** and **"checkout"** in customer-facing labels.
- **Two sanctioned exceptions:**
  1. The category label **"Luxury Experiences"** with its category-page H1 (§2.4).
  2. The **homepage hero H1, which subverts "discover" instead of using it** — "We didn't discover the Caribbean. We grew up in it." (conflict log 71; requires a translation test per locale).
- **Every editorial-H2 override (e.g. a hub's "Our {hub}" heading) passes the LD9 banned-list check.**

#### A9.11 US-English lock (§4.3, LOCKED June 10, 2026)
- **US English platform-wide** — "travelers" is locked in multiple strings.
- The earlier British-spelling exception for the brand term is **reversed**: the term is **"Locals' favorite(s)"** in all copy (badge, sort label, section headers, Top 10 page; conflict log 54, B.54).
- **The internal CMS field `is_locals_favourite` keeps its existing spelling** — field names are not user-facing and a rename has no migration value.

#### A9.12 Time & deadline copy rules (§4.4)
- **24-hour clock in all transactional and deadline copy.**
- **"(local time)" is retained wherever a money-relevant deadline is stated** (cancellation cutoff, balance deadline).
- **Never "Curaçao time" in customer-facing deadline copy** — it breaks on Aruba and Sint Maarten expansion.
- **Arrival buffer language is dynamic:** default **"arrive 5 minutes early" for pickup**, **"arrive 30 minutes early" for meeting-point tours**, **overridable per tour**.

#### A9.13 Duration formatter (locked rules, locale-aware — §3.5)
- Based on **`duration_minutes`**, with optional **`duration_minutes_max`** for ranges.
- **Unit words and "to" translate per locale via a locale-aware formatter, never string concatenation.**
- **Same format on mobile and desktop.**
- Under 60 minutes → **`45 minutes`**
- Exactly 60 → **`1 hour`**
- Whole hours → **`4 hours`**
- Hours plus minutes → **`4 hours 30 minutes`**
- Whole-hour range → **`4 to 5 hours`**
- Mixed range → **`2 hours 30 minutes to 3 hours`** — **endpoints in full, never decimals**.

#### A9.14 Motion standard (sitewide, 2026-07-14)
- Every page/component gets **page transitions, micro-interactions, and reveal animations** (`MountReveal` / `Reveal` reuse).
- **HARD RULE: no `whileHover` motion at all** (no scale-ups, lifts or nudges) — hovers are strictly **color/opacity CSS transitions**; press = **`whileTap` scale DOWN (0.9–0.98)**.
- **HARD RULE: canonical animation constants live in `frontend/lib/motion.ts`** (`springPop` 500/30, `swapFade` 0.15/y±6, `crossFade` 0.2/y±8, `pageEnter` 0.5/y16) — import them, never re-declare inline.
- **HARD RULE for lists:** never increment reveal delay by index in a map; every mapped `Reveal`/`MountReveal` gets the **`listItem`** prop (renders static below 640px).
- **Never wrap App Router `{children}` in `AnimatePresence mode="wait"` keyed by pathname** — it throws "Rendered more hooks than during the previous render"; use enter-only keyed `motion.div`.
- **`'use client'` only on the smallest leaf** that truly needs it; declarative-motion-only elements render from the server via `motion-link.tsx` / `motion-primitives.tsx` (`MotionDiv`/`Span`/`Button`/`A`).

---

### A10. Soft-delete strategy & hard-delete preconditions

#### A10.1 The principle
- **Deactivate, do not destroy.** Setting **`isActive = false`** (or entity **`status = archived`**) **hides an entity from the public site and navigation while keeping its row, its slug claim, and its relationships intact**.
- **Reversible with one toggle.**
- **Hard deletes are reserved for the narrow, guarded cases below.**

#### A10.2 Why soft delete is load-bearing (4 reasons)
- **1. Slug + URL protection.** The slug registry maps every public URL to one entity. **Removing a row frees the slug and risks a future entity claiming the same URL**, breaking external links and confusing the search index. A deactivated entity **keeps its `slug_registry` row with `is_active = false`**: the URL stays claimed and the page returns **404**.
- **2. Booking + financial records.** Bookings reference the **tour → operator → destination** chain and **snapshot the commission at booking time** (`commission_rate`, `commission_amount`). **Hard-deleting any link would violate foreign keys or cascade-destroy immutable financial history.**
- **3. Seeded entities.** The launch destinations and the 19 global categories are seeded (**`isSeeded = true`**) and **must never be deleted**. **Services throw `403 Forbidden` on any delete of a seeded entity, even a force delete.**
- **4. Translation cost.** Each entity carries **up to 7 locales of translations plus per-locale page content**. Soft delete preserves all of it for **instant reactivation**; a hard delete **throws away real translation work**.
- **What changed from the prior design:** the featured-slot economy is removed, so the previous **"FeaturedSlot rows are permanent / SlotHistory audit trail"** rationale for soft delete **no longer applies and has been dropped**. The remaining four reasons still make soft delete **non-negotiable**.

#### A10.3 Per-entity soft-delete / reactivate behavior (registry cascades)
- **Destination deactivate** → **ALL** registry rows `WHERE destinationSlug = <slug>` → `isActive:false` (reserved row + categories + hubs + collections + tours). **Reactivate** flips them all back to `true`.
- **Category deactivate / reactivate** → `WHERE entityType=CATEGORY AND entityId=<id>` — **flips that category's row on every island at once**.
- **Hub deactivate / reactivate** → `WHERE entityType=HUB AND entityId=<id>`.
- **Collection deactivate / reactivate** → `WHERE entityType=COLLECTION AND entityId=<id>`.
- **Tour archive / restore** → `WHERE entityType=TOUR AND entityId=<id>` → `isActive:false` / `true`.
- **Category page (separately) gates on ≥3 published tours** — a visibility gate, not a delete state; the registry row **stays regardless**.
- **Guarded deactivation:** **destinations and categories refuse to deactivate while active non-draft trips are still assigned → `409`** — prevents stranding live, bookable tours behind a 404 parent.
- All flips are **transactional with the entity change**.

#### A10.4 Hard-delete preconditions (guarded force delete)
- A force-delete endpoint exists under permission **`MANAGE_SYSTEM`**, for genuine cleanup of entities that **were never public and have no bookings**.
- It **must**:
  - **refuse seeded entities** (`isSeeded = true` → **403**),
  - **refuse entities with any booking history**,
  - **remove the `slug_registry` row only after honoring the 90-day cooldown rule**,
  - **run inside a transaction with the entity removal**.
- Per-entity hard-delete registry cascades:
  - **Destination force-delete** → `deleteMany WHERE destinationSlug = <slug>`; **blocked if `isSeeded`**.
  - **Category force-delete** → `deleteMany WHERE entityType=CATEGORY AND entityId=<id>` (all islands); **blocked if `isSeeded`**.
  - **Collection force-delete** → `deleteMany WHERE entityType=COLLECTION AND entityId=<id>`.
  - **Tour remove (hard)** → `deleteMany WHERE entityType=TOUR AND entityId=<id>`.
- **After a hard delete the freed `(destinationSlug, slug)` pair enters the 90-day cooldown** before any new entity can claim it.
- **A slug is genuinely freed only after the cooldown**, and even then the old URL still resolves via its 301 if a rename was involved.

---

### A11. Date, time & timezone rules

#### A11.1 The core rule
- **Use destination-local time for "when the customer experiences the tour." Use UTC for "when the system event happened."**

| Area | Correct time model |
|---|---|
| Weekly schedule ("Every Tuesday 09:00") | **Destination-local wall time** |
| Availability exception ("Closed on 2026-08-12") | **Destination-local date** |
| Departure inventory ("2026-08-12 at 09:00") | **Destination-local date + local time** |
| Booking cutoff ("stop booking 2 hours before 09:00") | **Compare against destination-local now** |
| Cancellation window ("free until 48 hours before start") | **Compare against destination-local tour start** |
| Booking confirmation / payment / webhook timestamps | **UTC instant** |
| Hold expiry | **UTC instant** |
| Invoice / payment issue timestamp | **UTC or business/accounting timezone**, but show tour date locally |
| Customer invoice / receipt tour date | **Destination-local date/time** |
| Email reminders | **Compute from destination-local tour time; schedule the job on a real UTC instant** |
| Tracking conversion time | **UTC instant** |
| Reviews ("can review after tour happened") | **Compare destination-local tour start/end against destination-local now** |

- **The clean rule:** store and return tour schedule as **`{ localDate, startTime, endTime, timeZone }`**; store **UTC only for real system events**; derive real UTC instants **only** when a scheduler, webhook, tracking event, or external calendar needs an absolute moment.

#### A11.2 The platform time contract (Phase 1 of the 12-phase plan)
- `localDate` = **`YYYY-MM-DD` destination-local calendar date**.
- `startTime` / `endTime` = **`HH:mm` destination-local wall-clock**.
- `timeZone` = **IANA**.
- `startsAtUtc` / `endsAtUtc` = **real UTC instants, used only for integrations, reminders, calendars and schedulers**.
- `createdAt` / `updatedAt` / webhook / payment timestamps = **UTC instants**.
- **Swagger descriptions must explicitly label every date/time field as either local wall-clock or UTC instant.**
- **Customer-facing tour dates must render from `{ localDate, startTime, timeZone }`, never from a fake `DateTime` field.**

#### A11.3 What the current implementation gets right
- `AvailabilitySchedule.weekday` and `startTime` are **tour-local**.
- `AvailabilityException.date` and `Departure.date/startTime` use **`@db.Date` and `@db.Time`** — the right shape for local calendar inventory.
- **Explicit local-time helpers** treat date/time as **local wall-clock values instead of converting to UTC** (`timezone.util.ts`).
- **Materialization uses the tour timezone to decide "today" locally.**
- **Public availability correctly computes cutoff from local start time and local now.**
- **Booking reserve snapshots `localDate`, `startTime`, `tourStartDateTime`, `tourEndDateTime`.**
- **Lifecycle fields are correctly named as UTC:** `utcExpiresAt`, `utcConfirmedAt`, `utcRedeemedAt`.
- **Verdict:** the availability/departure implementation is conceptually mostly right. **The risky part is the API boundary — local wall-clock `Date` values serialized as UTC-looking ISO strings.**

#### A11.4 Timezone source-of-truth rules
- **Destination timezone must be required platform data** (currently `timezone String?` — nullable).
- **Validate timezone strings as real IANA zones** via `Intl.DateTimeFormat(undefined, { timeZone: value })`; **reject offset strings (`UTC-04:00`) and labels (`Curacao`, `Curaçao time`, `AST`)**.
- **Valid launch zones:** `America/Curacao`, `America/Aruba`, `America/Lower_Princes` (Sint Maarten), `America/St_Lucia`, `America/Nassau`.
- Destination-create fallback map: `{ curacao: 'America/Curacao', aruba: 'America/Aruba', 'sint-maarten': 'America/Lower_Princes', 'saint-lucia': 'America/St_Lucia', bahamas: 'America/Nassau' }` — if timezone is missing and the slug/name is a known launch destination, **derive and store it explicitly; if missing and underivable, reject with 400**.
- **Operators must not freely edit `Tour.timeZone`** — always derive it from `Destination.timeZone`; ignore/reject operator-provided `dto.timeZone` on update; when a tour's destination changes, **recalculate `Tour.timeZone` in the same transaction**. Any admin override must be **admin-only and audit logged**.
- **Remove the unsafe `America/Curacao` fallbacks** (three locations: `tours.service.ts` create `destination.timezone ?? 'America/Curacao'`; `tours.prisma` `timeZone String @default("America/Curacao")`; `reviews.service.ts` `booking.tour?.timeZone ?? 'America/Curacao'`) — keep `America/Curacao` **only as the seed default for the Curaçao destination itself, never as a universal fallback**. Otherwise an Aruba/Bahamas/Sint Maarten tour silently becomes Curaçao time.
- **Keep user timezone completely separate from tour/destination timezone** — user timezone defaults to offset strings like `UTC+06:00` and **must never be used for availability logic**.
- **Never reuse browser timezone detection for tour/destination timezone.**

#### A11.5 Local-date validation rules
- **Replace `@IsDateString()` with strict `YYYY-MM-DD` validation** (`@Matches(/^\d{4}-\d{2}-\d{2}$/)` or a custom `@IsLocalDate()`) for date-only business fields: availability `from`/`to`, schedule `validFrom`/`validUntil`, exception `date`, public availability `dateFrom`/`dateTo`, booking list `from`/`to`. `@IsDateString()` wrongly accepts full ISO timestamps.
- **Keep `@IsDateString()` only for real UTC instants.**
- **Validate local date range ordering:** `validUntil >= validFrom`, `dateTo >= dateFrom`, `to >= from`.

#### A11.6 Serialization & display rules
- **Stop exposing fake local wall-clock `Date` as UTC-looking ISO.** `tourStartDateTime.toISOString()` returning `2026-07-01T09:00:00.000Z` **does not mean 09:00 UTC — it means 09:00 Curaçao local**. Preferred response shape: `localDate: "2026-07-01"`, `startTime: "09:00"`, `endTime: "13:00"`, `timeZone: "America/Curacao"`, plus `startsAtUtc` **only if an actual instant is needed**.
- **Emails/invoices/receipts/TYP/ICS must label the timezone:** `2026-07-01 at 09:00 Curaçao local time` or `(America/Curacao)`. **Never print a fake UTC ISO string as the tour time.**
- Invoices need **two separate concepts**: payment/invoice timestamp = UTC/accounting time; **booked experience date/time = destination-local** (`Tour date: Tuesday, July 1, 2026 / Time: 9:00 AM / Timezone: Curaçao local time`).
- **Every balance/cancellation deadline in copy includes "(local time)".**
- **Calendar/ICS export:** convert local tour start/end to real UTC instants or emit timezone-aware calendar fields.
- **Frontend must not use generic `new Date(localDate)` formatting for date-only business fields** — `new Date("2026-07-01")` is midnight UTC, so a viewer in a negative-offset timezone sees **June 30**. Required utilities: `parseLocalDateParts("YYYY-MM-DD")`, `formatLocalDateOnly(localDate, locale)`, `formatLocalTime(startTime, locale)`, `formatTourLocalDateTime({ localDate, startTime, timeZone, locale })`.
- **Dashboard schedule/exception date pickers are plain calendar-date editors, not timezone-aware instant editors** (input/output stays `YYYY-MM-DD`; never auto-convert to browser timezone; avoid timezone-converted date labels).
- **Public/customer UI must prefer `localDate` / `startTime` / `timeZone` over `tourStartDateTime`** until the backend response shape is fixed.

#### A11.7 Booking, cutoff and cancellation time rules
- **Add `Booking.tourTimeZone` snapshot.** On reserve, snapshot `localDate`, `startTime`, `endTime`, `tourTimeZone`, cancellation hours, payment model and commission fields; **backfill existing bookings**. Use the snapshotted timezone for **cancellation deadline computation, review eligibility, booking emails, TYP display, invoice/receipt display** — so historical bookings stay stable if a tour/destination timezone changes later.
- **One shared backend helper for live departure bookability** (status open; remaining capacity sufficient; **current destination-local time has not passed `bookingCutoffMinutes`**), used by the public availability month map, tour listing date filters, full-text search date filters, and booking reserve pre-check.
- **`Tour.isBookable` can go stale during the day** — cutoff passing is time-based, with no DB row change. Decide officially: **Option A = coarse cached flag, allowed to be stale (then never use it alone for exact date/guest/time search); Option B = live-computed for user-facing endpoints.**
- **Cancellation deadline is judged on the request timestamp, not the admin action timestamp** (BOOKING-AND-PAYMENTS). Current code computes refund with `localNow(tour.timeZone)` at cancel-service run time, so **a traveler who requested before the deadline can be wrongly refused when an admin processes it after**. Fix: model cancellation as a **request** (`cancellation_requested_at` or a request table, stored as a **UTC instant**), compute refund eligibility from the request timestamp against the snapshotted tour timezone, with audit fields (requested by, processed by, processed at, refund decision, refund reason).
- **Availability exceptions must immediately re-materialize departures.** Schedules call `syncTourAvailability()` after create/update/delete; **exceptions do NOT** — so closing July 10 leaves existing departures bookable until a manual materialize, another schedule sync, or the nightly job. **Every exception mutation must re-materialize the affected window and refresh `isBookable`** (HIGH PRIORITY, gap 11), also validating exception type combinations at write time (`CLOSE_DATE` requires `date`; `CLOSE_SLOT` requires `date` + `startTime`; `ADD_SLOT` requires `date`, `startTime` and resolvable capacity; `SET_CAPACITY` requires `date`, `startTime` and `capacity`).
- **Reminder emails must be scheduled from the local tour start converted to a real UTC instant**, never from fake `Z` wall-clock values; copy switches "Tomorrow:" / "Today:" based on **destination-local** date.

#### A11.8 Analytics & counter time rules
- **Tracking event timestamps stay UTC instants.** Conversion value stays **`commission_amount` in EUR**.
- **`bookingCountToday`** is timezone-sensitive and currently not maintained; when implemented, "today" should mean **destination-local today** (preferred, supports CRO copy) or clearly platform-business today — **if UTC analytics day is chosen, it must not be used for customer-facing "today" copy**.
- **Demand-signal windows** ("past 60 days", "next 30 days") currently use **UTC day windows** — acceptable for an analytics/ranking signal; **destination-local is required if the value ever appears as customer-facing "today"/"tomorrow"/date-specific copy**.
- **Spotlight / commercial campaign windows** (`startsAt`/`endsAt`) — **recommendation: keep them as absolute UTC instants** for admin/commercial logic (they are campaign windows, not tour departures).









---

## B. Catalog Entities, Commercial Model, Ranking & Badges

### B.1 Entity ownership matrix — who creates and controls what

- **Destinations** — created by **Admin** only. Islands, pre-seeded. `is_seeded = true` rows are **delete-protected** (403 in the service). Grouped by `region` (a **data attribute with no URL effect**).
- **Categories** — created by **Admin** only. **19 global** categories, one set reused across every destination; slug is **global**.
- **Activity Hubs** — created by **Admin only (editorial)**. **Operators never create hubs**; operators only *attach* their tours to an allowed hub during tour creation (`TourHub`, gated by `HubAllowedCategory`). Permission: `MANAGE_HUBS`.
- **Collections** — created by **Admin only (editorial)**. **Operators never touch collections.** Permissions: `CREATE_COLLECTION` / `EDIT_COLLECTION` / `DELETE_COLLECTION`.
- **Tours** — created by **Operators** (`trips.operatorId` FK → `operators.id`). One destination → **1+ categories** (exactly one `isPrimary`) → **0–n hubs**. Permissions: `CREATE_TRIP` / `EDIT_TRIP` / `DELETE_TRIP` / `MANAGE_TRIPS`.
  - `ADMIN` bypasses tour ownership and is auto-provisioned an operator record on first create; a `TOUR_OPERATOR` with no operator record gets a **400**.
  - The service resolves caller `user.id` → `operator.id` (`resolveOperatorId`) **before any write or ownership check**.
- **Commission tier** — chosen by the **Operator**, **per tour**, eligibility-gated, with a 30-day lock. `tierKey` is operator-writable; `tierRank` / `commissionTier` / `tierLockedUntil` / `qualityScore` / `eligibilityState` are **server-set only**.
- **Destination Spotlight** — **Operator requests → Admin approves** (manual, never self-serve). Operator request via `EDIT_TRIP` (own tour) or a dedicated permission; approval via `APPROVE_SPOTLIGHT` (admin).
- **Top Island Experiences / Featured Experiences** — **Admin only**; **categories and hubs only, never individual tours** (see B.15).
- **Page editorial content** (About / FAQ per destination, category, hub, collection) — **Admin**.
- **Attributes** — **Admin owns the dictionary** (`AttributeDefinition`); **Operator sets per-tour values** (`TourAttribute`).
- **`is_locals_favourite`** — **Admin only**, permission `MANAGE_EDITORIAL`. Never operator-set (see B.13).
- **Reviews** — created by **travelers** (gated on a confirmed `booking_id`), moderated by **admins**. Intentionally NOT a tour-module child; the operator never writes reviews through the tour form.
- **Slug-registry rows are transactional with the entity** in every case (create / rename / disable).

---

### B.2 Destinations (master E.1)

- **Fields (master canonical names):**
  - `id` uuid · `name` string · `slug` string — **slug is locale-independent** (§2.2).
  - `region` enum · `country` string — region is **Caribbean at launch**.
  - `description` text · `long_description` text — `long_description` drives the **350–500 word SEO section** (§5.2).
  - `hero_image` · `gallery_images[]` · `og_image` — URLs.
  - `latitude` float · `longitude` float · `timezone` IANA string — **timezone drives every "(local time)" computation** platform-wide.
  - `currency` · `language` string — **operator and payout context only**; display currency is locale-driven, not destination-driven (§1.3).
  - `meta_title` · `meta_description` string.
  - `parent_destination_id` uuid nullable — future sub-destinations; **unused at launch**.
  - `status` enum (`draft` / `published` / `archived`) · `created_at` · `updated_at`.
- **Translations & page content (current code, `destinations.prisma`):** `description` / `long_description` and SEO `meta_*` live on `DestinationTranslation` / `DestinationPageContent`, **not on the base row**.
- **Seeded guard:** `is_seeded` present in code; seeded destinations cannot be deleted.
- **Code divergence from master:** status is modeled as boolean `isActive` (+ `isSeeded`) rather than the 3-value enum. Everything else (`region` required, `country`, `latitude`, `longitude`, `timezone`, `currency`, `galleryImages`, `ogImage`, `parentDestinationId`) is aligned.
- **Launch scope:** Curaçao, Aruba, Sint Maarten **live**; Saint Lucia and Bahamas are **seeded pipeline rows** (C1, confirmed). Checklist notes pipeline-vs-live surfacing is **not yet enforced**.
- **Destination slug normalization:** lowercase only; ASCII only (ç→c, ü→u, é→e); spaces and underscores → hyphens; no special characters; no double hyphens; no leading or trailing hyphens.
- **Region grouping is a data attribute with no URL** — confirmed built (`Region` enum).

---

### B.3 Categories (master E.2)

- **19 global categories** with fixed slugs; one set reused per destination; **slug is global**.
- **Fields:** `id` uuid · `name` · `slug` · `description` text · `icon` string (identifier from the §3.3 SVG set) · `sort_order` int · `parent_category_id` uuid nullable (future grouping, **no URL impact**, unused at launch) · `meta_title_template` · `meta_description_template` (e.g. `"{category} in {destination}"`, **resolved per destination**) · `status` (per destination combination).
- **Per-destination pages:** the category page renders **only at ≥3 published tours** for that destination (C2 confirmed; the architecture file's ≥1 is **superseded**, conflict log B.45).
- **Gating automation:** `status` per destination combination is **driven by the ≥3-published-tours threshold automation and never hand-set**. **Tour status changes re-run the gating check in BOTH directions** (publish and unpublish).
- **Current code divergence:** the per-destination status automation is **not yet the ≥3 gate** (effectively ≥1 — it 404s at 0). Marked `⚠️` in the checklist.
- **Slug registry:** category create writes **1 `slug_registry` row per active destination**, in the same transaction. **19 categories + reserved `tours` = 20 protected slugs per destination.**
- **Category create must NOT seed slot rows** — the old 3-`FeaturedSlot` seeding in `categories.service.ts` is a removal item (slot economy).
- **Translations:** per-locale `CategoryTranslation` + per-locale page content; translation upserts use the `{ fields: { ... } }` wrapper.
- **FAQ:** polymorphic `Faq` model (`pageType` + `entityId`), `pageType='category'`.
- **Day Trips** is the one duration-based category.
- **"Luxury Experiences"** is kept as a category label/H1 — the **single sanctioned exception** to the LD9 banned-words rule; "luxury" stays banned in running copy (C17).

---

### B.4 Activity Hubs (master E.4 + 5.5 + Figma `48024-11145` Klein Curaçao)

- **Definition / job:** one **place, highlight, or area** with **full decision support**. The platform's **primary Google Ads landing page**. The **only list-type page that earns a full hero image** (pages that sell a specific place get a hero; pages that merely list options — All Tours, Category — get a thin header).
- **URL:** `/{locale}/{destination}/{hub-slug}/` — flat, one slug per destination.
- **`hub_type` enum values: `location` (Klein Curaçao) / `highlight` (Dolphins) / `area` (West Coast)** — each has its own anchor-nav set and content template.
- **Hub vs Collection:** Hub = anchored to a **place/landmark**, rich informational content + comparison logic. Collection = anchored to a **persona/intent**, mostly a curated list. Slug registry enforces one slug → one page type per destination.
- **Tour link:** a tour attaches to **0–n hubs** (`TourHub`); hubs are **discovery tags with NO URL effect**. A hub shows only tours whose category is in its allowed-category list.
- **Every field:**
  - `id` uuid (SYS) · `destinationId` FK (ADM, mandatory) · `name` (ADM) · `slug` (ADM, unique per destination) · `description` string? (ADM; master `short_description`, card/meta blurb) · `hubType` `HubType?` (ADM; **nullable today**, master treats it as set) · `latitude` / `longitude` Float? (ADM; location-type hubs) · `isSeeded` / `isActive` bool · `createdBy` + timestamps.
  - **`heroImage` string? — `+ TO ADD`, GAP G1 (High).** Master E.4 `hero_image`; the hub's defining feature, full-bleed hero. Not on schema today.
  - **`ogImage` string? — `+ TO ADD`, GAP G7 (Low-Medium).** Master E.4 `og_image` (Destination has it, Hub does not).
  - **`status` enum — `+ TO ADD`, GAP G6 (Medium).** Master lists `status`; today only `isActive`. Decide `HubStatus { DRAFT, PUBLISHED, ARCHIVED }` vs `isActive` + publish guard.
  - `meta_title` / `meta_description` (on `HubPageContent`, per locale) — present.
- **`HubTranslation` (per locale):** `name` string? (falls back to `Hub.name`) · `overview` string? (**the editorial lead**, "Why Klein Curaçao", **max 150 words, no visible header** — directive G9) · `h1Override` string? (hero H1, per hub per locale, **never templated**) · `breadcrumbLabel` string? · **`heroTagline` string? — `+ TO ADD`, GAP G5 (Medium)** (hero subtitle under H1, e.g. "Where islanders send their visitors") · `isMachineTranslated` bool.
- **`HubPageContent` (per locale):** `aboutText` string? (currently the only long-copy slot — **insufficient** for multi-block Discover + Local Tips) · `metaTitle` · `metaDescription`.
- **Allowed categories:** `HubAllowedCategory(hubId, categoryId)` gates which category of tours an operator may attach. **No gap.**
- **Our Picks:** `HubOurPick(hubId, tourId, pickType, description, displayOrder)` with `HubPickType { BEST_OVERALL, MOST_POPULAR, BEST_FOR_FAMILIES, BEST_VALUE }`. Figma shows 3 picks (`BEST OVERALL` / `MOST POPULAR` / `BEST FOR FAMILIES`).
  - **Tour titles, never operator names** (master 5.5 / LD14). Card facts (rating, boat type, from $X) come from the Tour.
  - Editorial line **"Our honest picks, not paid placements"** is static copy.
  - **GAP G8 (Medium):** `description` is a single `String` — must be per locale (`HubOurPickTranslation(ourPickId, locale, description)`).
- **Comparison groups:** `HubComparisonGroup(groupName, displayOrder)` + `HubComparisonTour(groupId, tourId, displayOrder)` model the two groups (Figma: **Comfort trips** / **Adventure trips**) and which tours sit in each column. Frozen first column, booking buttons in the header, tour-title columns.
  - Rows in Figma: *What stands out · On the island · Breakfast · Open bar · Crossing · Boat & group · Free cancel · from $X*.
  - **Derived from the Tour:** Free cancel (`cancellationHours`), from $X (`fromPrice`), Boat & group (`wholeUnitType` + capacity).
  - **Likely Tour attributes** (`attributes.prisma` dictionary): Crossing (1 hour), Breakfast (Included/-), Open bar (Premium/Optional).
  - **Curated, not modeled:** "What stands out" free text (e.g. "Dive school, massage with a view").
  - **GAP G3 (Medium-High):** no store for curated cells and `groupName` is not per locale. Fixes: (a) `HubComparisonGroupTranslation(groupId, locale, groupName)`; (b) `HubComparisonTour.standoutNote` (+ translation child) **or** `HubComparisonCell(comparisonTourId, attributeKey, value)`.
- **All Figma sections — 12 sections of the hub page:**
  1. **Nav + breadcrumb** (`Home / Curaçao / Klein Curaçao`) — global nav + `breadcrumbLabel`. ✓
  2. **Full hero** — H1 `Klein Curaçao day trips`, tagline `Where islanders send their visitors`, **fast facts** `Full day (8-9h) · From $120 · BBQ lunch · Daily`, date picker `Select date` / `Check Availability`. **Partial** (heroImage GAP, tagline GAP, fast facts GAP).
  2b. **Sticky anchor nav — 5 locked items:** `Why Klein Curaçao` · `Trips` · `Private charters` · `Compare` · `Discover`. Template-driven from sections present; **derived**.
  3. **Editorial lead** `Why Klein Curaçao` — max 150 words, **no visible header**. ✓
  4. **Shared tours grid** — `9 Klein Curaçao day trips. Pick yours.`; filter chips + date; cards carry a **`Sponsored` badge (hubs DO show it, unlike collections)**. ✓ derived.
  5. **Private charters** — `14 private charters. Yours alone.`, split `Day charters (11)` + `Overnight charters (3)`. Derived: hub tours where `bookingType = PRIVATE`; day-vs-overnight split by duration. ✓ derived.
  6. **Our Pick** — `We've been on every boat`, 3 picks, editorial blurb each. **Partial** (per-locale blurb GAP).
  7. **Comparison table** — `Which trip is right for you?`. **Partial** (cell/row values not modeled).
  8. **Discover deep-dive** — `Discover Klein Curaçao`, 6 named subsections: *The White Beach · History · Sea Turtles · Snorkeling & Diving · The Pink Lighthouse · Shipwrecks*. **GAP**.
  9. **Local tips** — `What we tell first-timers…`, ~8 titled tip cards (Take water shoes, Sit at the back, No need to rush ashore, Bring reef-safe sunscreen, Book weeks ahead, Mind the lighthouse stairs…). **GAP**.
  10. **FAQ** — **7 AEO questions**, FAQPage schema (Figma shows 9 — count is editorial, not a schema constraint). Polymorphic `Faq`, `pageType='hub'`. ✓ wired.
  11. **Related hubs** — `Also worth your time on Curaçao`, 3 cross-hub cards. **Derived**: other active hubs in the same destination excluding self, **cap 3**.
  12. **Footer** — global. ✓
- **Mandatory sections (master 5.5):** **Discover ("Our {hub}"), Local Tips, Related Hubs.** The editorial H2 defaults to **"Our {hub}"** via i18n template; a hub may override it per hub per locale and the override passes the **LD9 banned-list check** (C18; the earlier "Discover {hub}" default is retired — conflict log B.55).
- **Display & business rules (locked, master 5.5):**
  - **Full hero image is mandatory** and must show the **specific** place/attraction, not the generic destination (hero-specificity rule). **Operator-sourced photos preferred.**
  - **Anchor nav = 5 locked items**, sticky on scroll, derived from sections present.
  - **No trust bar on hubs** (unlike the tour page). Share pill matches the tour page.
  - Hub shared grid **does** rank by tier/quality and **does** show the `Sponsored` badge.
- **Publish guard (tied to G6):** a hub may go `PUBLISHED` only when — `heroImage` is set **AND** base-locale H1 + editorial lead exist **AND** `hubType` is set **AND** the mandatory sections (Discover, Local Tips) have at least one base-locale block.
- **Write & ownership:** admin-only create/edit/delete (`MANAGE_HUBS`); create/rename/disable transactional with `slug_registry` (create writes one `HUB` row for the destination; rename issues a **301 + 90-day cooldown**; `isActive=false` flips the registry row and the page 404s); `isSeeded=true` rows are delete-protected.
- **G1–G10 gap ledger (apply order):**
  - **G1** `heroImage` — the hub's defining element, master E.4 → `Hub`. **High.**
  - **G2** `content_sections` — Discover deep-dive + Local Tips, titled/ordered/per-locale; only `aboutText` today → new `HubContentSection` + `HubSectionType { DISCOVER, LOCAL_TIP, EDITORIAL }`. **High.**
  - **G3** Comparison cell content ("what stands out") + per-locale `groupName`; cells otherwise undefined → `HubComparison*` extensions. **Medium-High.**
  - **G4** Fast-facts bar store (editorial facts like crossing time / inclusion note) → `HubContentSection` `FAST_FACT` type or `fastFacts Json?` per locale on `HubPageContent`. **Medium.**
  - **G5** `heroTagline` (hero subtitle, per locale) → `HubTranslation`. **Medium.**
  - **G6** `status` — master lists it; today only `isActive` → `Hub` + `HubStatus` enum. **Medium.**
  - **G7** `ogImage` (E.4) → `Hub`. **Low-Medium.**
  - **G8** `HubOurPick.description` must be per locale → `HubOurPickTranslation`. **Medium.**
  - **G9** `overview` directive: editorial lead max 150 words, no visible header (no new field) → `HubTranslation`. **Low.**
  - **G10** `hubType` nullable → tighten to required after the Stage-2 backfill → `Hub`. **Low.**
- **Fast-facts detail (G4):** master locks a **4-fact** hero bar. Some facts are **derived** (Price from = `min(fromPrice)` across hub tours; "Daily" from departures); others are **hub-specific editorial** (`45min-1.5h crossing · 10km offshore`, `BBQ lunch included`) and are **not stored anywhere today**. At minimum **"getting there"** and the **inclusion note** must be editable.
- **Already present and correct:** `id`, `name`, `slug`, `destination_id`, `hub_type`, `short_description`, `latitude`/`longitude`, `meta_title`/`meta_description`, timestamps, allowed categories, Our Pick structure, comparison group/tour links, FAQ wiring.

---

### B.5 Collections (master E.5 + 5.6 + Figma `47433-2051` Best Things to Do)

- **Definition / job:** a **persona- or intent-driven curated list** (best things to do, couples, families, day trips). The only page type that cuts **across** activity categories on a persona/intent basis.
- **URL:** `/{locale}/{destination}/{collection-slug}/` — flat, one slug per destination.
- **Two kinds:**
  - **MANUAL** — an ordered `tourIds[]` list; **the order IS the product**.
  - **DYNAMIC** — a saved `filterQuery` (JSON) resolved at read time.
- **Commission never influences curation or order. No Sponsored badge ever appears on a collection card.**
- **Cannibalization guard:** the collection slug **must not collide with a category slug**; enforced by the unique `slug_registry` row (one slug → one page type per destination).
- **Every field:**
  - `id` uuid (SYS) · `destinationId` FK (ADM) · `name` (ADM) · `slug` (ADM, unique per destination, no category collision) · `collectionType` `CollectionType { MANUAL, DYNAMIC }` (ADM) · `tourIds[]` String[] (ADM; ordered editorial list, MANUAL) · `filterQuery` Json? (ADM; DYNAMIC) · `heroImage` string? (ADM; banner image) · `sortOrder` string (ADM; **applies to DYNAMIC only** — MANUAL order = `tourIds[]`) · `isActive` bool (toggles slug-registry `is_active`; page 404s when false) · `isSeeded` bool (delete-protected) · `createdBy` string? · `createdAt` / `updatedAt`.
  - **`status` enum — `+ TO ADD`, GAP G5 (Medium).** Master E.5 lists `status`; today only `isActive`. "Rationale required before publish" implies a real draft state → `CollectionStatus { DRAFT, PUBLISHED, ARCHIVED }` or `isActive` + publish guard.
  - **`displayStyle` enum — `+ TO ADD`, GAP G6 (Medium).** `CollectionDisplayStyle { NUMBERED, PERSONA }`.
- **`CollectionTranslation` (per locale):** `name` string? (falls back to `Collection.name`) · `overview` string? (**the section-3 intro — one sentence, max 30 words, AEO "include" structure**) · `h1Override` string? (banner H1 — `The 10 best things to do in Curaçao.`, **period required** on Best Things to Do) · `breadcrumbLabel` string? · **`eyebrowLabel` string? — `+ TO ADD`, GAP G3 (Low)** (banner eyebrow / persona label `BEST THINGS TO DO`; or derive by upper-casing `name` — flag the choice) · **`curationNote` string? — `+ TO ADD`, GAP G2 (Medium)** (banner subtitle `Chosen by Islanders - in the order we'd book them`) · `isMachineTranslated` bool.
- **`CollectionPageContent` (per locale):** `aboutText` string? (optional long-form editorial body) · `metaTitle` · `metaDescription`. **No gap here.**
- **Per-tour rationale — `collection_rationale` (MAIN GAP, G1, High):**
  - Master E.5: **per tour, per locale**; *"required CMS field before publish, max 20 words"* (§3.5, §5.6).
  - It is the sentence under every card title in Figma (e.g. *"An uninhabited island, 10km offshore, sea turtles, no signal. The day Curaçao is famous for."*) — **per-collection, per-tour, per-locale editorial copy, NOT a Tour field**.
  - **Not modeled anywhere in the schema today.** `tourIds String[]` stores order but cannot hang per-tour-per-locale copy off it.
  - Recommended fix: promote to a join table — `CollectionTour(id, collectionId, tourId, position)` with `@@unique([collectionId, tourId])` + `@@index([collectionId, position])`, plus `CollectionTourRationale(id, collectionTourId, locale, rationale)` with `@@unique([collectionTourId, locale])`.
  - **Validation:** `rationale` ≤ 20 words; **required for the base locale before a MANUAL collection can be published**.
  - **DYNAMIC collections: rationale is optional** (cards come from a live query, not curated copy).
  - Lighter alternative (keeping `tourIds[]`): a standalone `CollectionRationale(collectionId, tourId, locale, text)` table — join table preferred (co-locates order + membership + copy).
- **The 6 locked FAQ questions (Best Things to Do, verbatim in Figma), FAQPage schema:**
  1. What are the best things to do in Curaçao?
  2. How far in advance should I book these tours?
  3. When is the best time to visit Curaçao?
  4. Do these tours include hotel pickup?
  5. Can I combine multiple tours in one trip?
  6. How does Island Tours choose which tours to feature? *(conflict log B.23: was "Are these paid placements?")*
  - **Directive:** reuse the polymorphic `Faq` with `pageType='collection'`; extend the comment list in `faq.prisma` (currently `'category' | 'hub' | 'destination' | 'tour'`). **Do NOT add a JSON blob on `Collection`** — GAP G7 (Medium) is the wire-up.
- **NUMBERED vs PERSONA display rules (master 5.6, locked):**
  - **NUMBERED** — numbered badges `01`–`10` appear **only** on **Best Things to Do** and **Top 10** collections → `displayStyle = NUMBERED`. Numbered badges **never** appear on destination sections (conflict log B.21).
  - **PERSONA** — persona collections (couples / families / day trips) get **no numbers**; a **peach highlight marks card #1** → `displayStyle = PERSONA`.
  - **No Sponsored badge on collection cards, ever.**
  - Card price label is always **"from $X"**.
- **The 7 Figma sections:** (1) Nav + breadcrumb `Home / Curaçao / Collections / Best things to do`; (2) **thin editorial banner** (~300px, text on gradient) with eyebrow / H1 / curation note / fast stats `10 tours · From $36` / Share pill; (3) one-sentence intro (max 30 words); (4) curated **3-column grid — no sort, no filter chips**, each card numbered `01`–`10` + rating `4.8 (1,738)` + title + **rationale sentence** + duration + `From $X` + `Free cancellation`; (5) **Need help before booking?** (Chat on WhatsApp, trust lines) with the collection FAQ as the right column; (6) FAQ (6 AEO questions); (7) **Keep exploring** (`Best for couples` / `Best for families` / `Day trips`) + recovery CTA `Not sure yet? See all Curaçao tours →`.
- **Derived (no schema change):** fast stats `10 tours · From $36` = count of resolved tours + `min(fromPrice)` in the active currency; card facts read from each resolved Tour; "Keep exploring" = other active collections in the same destination excluding self (**cap 3**); recovery CTA links to `/{locale}/{destination}/`.
- **Publish guard (G5):** a **MANUAL** collection may go `PUBLISHED` only when every member tour has a base-locale rationale (≤20 words) **AND** `heroImage` is set **AND** base-locale H1 + overview exist. **DYNAMIC collections skip the per-tour rationale requirement.**
- **G1–G8 gap ledger (apply order):**
  - **G1** Collection Rationale per tour/locale (required before publish, max 20 words) — not modeled → `CollectionTour` + `CollectionTourRationale`. **High** (on every card in Figma + master E.5).
  - **G2** `curationNote` (banner subtitle) per locale → `CollectionTranslation`. **Medium.**
  - **G3** `eyebrowLabel` / persona label per locale (or derive from `name`) → `CollectionTranslation`. **Low** (decide store vs derive).
  - **G4** `overview` directive: max 30 words + AEO "include" structure (validation/doc only) → `CollectionTranslation`. **Low.**
  - **G5** `status` — needed for the "rationale required before publish" gate → `Collection` + `CollectionStatus`. **Medium.**
  - **G6** `displayStyle` (NUMBERED vs PERSONA) for badge/peach rules → `Collection` + enum. **Medium.**
  - **G7** FAQ wire-up: add `'collection'` to `Faq.pageType`; do not use a JSON blob → `faq.prisma`. **Medium.**
  - **G8** `sortOrder` directive: applies to DYNAMIC only; MANUAL order = `tourIds[]` / `CollectionTour.position` → service rule. **Low.**
- **Everything else in master E.5 already present:** `id`, `name`, `slug`, `destination_id`, `collection_type`, `tour_ids[]`, `filter_query`, `hero_image`, `meta_title`, `meta_description`, timestamps.
- **Write & ownership:** admin-only; create/rename/disable transactional with `slug_registry` (create writes one `COLLECTION` row for the destination; rename → **301 + 90-day cooldown**; `isActive=false` flips `is_active` and the page 404s); `isSeeded=true` delete-protected.

---

### B.6 Tours — every field, grouped (master E.3; legend `W` = writer: **OP** operator · **SYS** system/job · **ADM** admin-only · **RO** read-only computed)

> Shape: 1 destination · **1+ categories** (exactly one `isPrimary`) · **0–n hubs**. Canonical flat URL `/{locale}/{destination}/{tour-slug}/`. Model entity is `Trip` (`@@map("trips")`) in `TRIP-MODULE.md` and `Tour` (`@@map("tours")`) in `TOUR-MODULE-DATA.md` — **a naming divergence between the two docs**.

#### B.6.1 Identity & routing (all present)

- `id` uuid — **SYS** — PK.
- `operatorId` FK → `operators.id` — **SYS** — resolved from `user.id` via `resolveOperatorId`; **not client-set**.
- `destinationId` FK — **OP** — exactly one; immutable after create (recommended).
- `name` / `title` string — **OP** — canonical English name.
- `slug` string — **OP** — English only; **unique per `(destinationId, slug)`**; auto-generated from name on create, editable (rename → **301 + 90-day cooldown**); **always writes a `TOUR` `slug_registry` row in the same transaction**.
- `status` `TourStatus` — **OP** — `DRAFT` / `LIVE` / `PAUSED` / `ARCHIVED`; **re-runs the category ≥3 gating on change (both directions)**.
- `h1Override` string? — **OP** — for awkward template H1s (LD15).
- `breadcrumbLabel` string? — **OP** — editorial short form when the H1 tour-name portion **exceeds 35 chars**.
- `departureCity` string? — **OP** — drives the meta-row location label (LD13); **empty → island only**.
- `categories[]` / `activity_hubs[]` FK arrays — **1+ categories** (one `isPrimary`), **0+ hubs**.

#### B.6.2 Localized content (`TourTranslation`, unique `(tourId, locale)`)

- `title` string? ✓ — localized tour title.
- `overview` string? ✓ — **80–200 words, paragraph breaks only; no headings, lists, or bold** (LD22). Master models it as `overview_{locale}` markdown.
- `description` string? ✓ — long description (master: **350–500 words**).
- `shortDescription` string? ✓ — card/preview; **master directive: 160-char cap** (DTO `@MaxLength(160)`; schema comment saying 200 is a bug to fix).
- `whatToBring` ✓ — **3–8** sentence-case bullets, ≤25 words each; personal items; **must NOT duplicate inclusions (CMS warning)**; shown when non-empty.
- `knowBeforeYouGo` ✓ — **3–10** sentence-case bullets, ≤25 words each; operational caveats + **positive** accessibility + tour-side rules (no glass, no outside food).
- `notSuitableFor` ✓ — **1–6** bullets when present; bookability-affecting restrictions (age, pregnancy, fitness, wheelchair-**in**accessibility); **NEGATIVE accessibility routes here**; **hidden entirely when empty**; renamed from `not_allowed` (LD23).
- `localTip` string? ✓ — optional Overview tail (LD22).
- `meetingPointText` string? ✓ — localized meeting-point description (geo lives on the Tour row).
- `whatToExpectIntro` string? — **`+ TO ADD` (Figma, gap #13)** — intro paragraph above the numbered itinerary on the "What to Expect" tab (steps = `TourLocation` rows). Optional.
- `categoryDisplay` string? — **`+ TO ADD` (gap #3)** — plural noun phrase driving **"More {category_display} in {destination}"** (LD33); **CMS validates the plural form**.
- `metaTitle` / `metaDescription` string? — **`+ TO ADD` (gaps #1)** — SEO, localized, on `TourTranslation`.
- `isMachineTranslated` bool ✓.
- **Master directive (gap #7):** `what_to_bring`, `know_before_you_go`, `not_suitable_for` must become **`String[]` (Postgres `text[]`)**, not single `String?` — current storage loses bullet structure and makes the master's count/word-limit validation impossible at the API layer. `overview` / `description` / `localTip` / `meetingPointText` stay `String?` (free prose).
- **Master content fields modeled as child tables instead of `_{locale}` arrays:** `included_items[]` (LD18, supersedes `includes`), `excluded_items[]` typed objects (LD18, supersedes `excludes`), `highlights_{locale}[]` (**3–6 items, 5–15 words**, merged into Overview rendering per LD22).
- `gallery_images[]` — ordered, **first marked `is_hero`**, **manual focal point per image**.

#### B.6.3 Pricing & party

- `pricingModel` `PricingModel` — **OP** — `PER_PERSON` / `UNIT` → OCTO `pricingPer`; **supersedes the architecture `price_type`**.
- `wholeUnitType` (master `unit_type`) `WholeUnitType?` — **OP** — required when `pricingModel = UNIT`: **group / boat / vehicle / aircraft / package**.
- `defaultCurrency` `Currency` — **OP** — USD / EUR.
- `basePrice` Decimal(10,2)? — **OP** — optional headline price.
- `priceFrom` Decimal(10,2)? — **SYS** — cached lowest applicable band price (for cards).
- `minPartySize` int — **OP** — **default 1**; some tours require **4+**.
- `maxPartySize` int? — **OP** — capacity ceiling per booking.
- `unitIncludedGuests` / `extraPersonPrice` — **OP** — **GROUP-only** (see B.14 D1a).
- **Master mapping:** master E.3 defines **both** `price_adult` / `price_child` / `price_infant` **and** `age_bands[]` ("all bands count toward capacity"), so the master's model is a **typed set of bands, not loose price columns**. Resolution: keep the single `TourAgeBand[]` source of truth + add a required `bandType` enum; master's adult/child/infant become three typed rows; extras (youth, senior) are more rows with explicit `minAge` / `maxAge`. The API composes a typed `pricing` object keyed by band (`pricing.adult.price`, `pricing.child.price`). Flat columns would force two parallel sources and cannot express "Child (4-12)" or "Senior 65+".
- **All party bands count toward capacity.**

#### B.6.4 Booking logic

- `durationMinutesFrom` / `durationMinutesTo` int? — **OP** — formatter input; `To` is the upper bound for a range (master `duration_minutes` / `duration_minutes_max`).
- `pickupModel` `PickupModel` — **OP** — `INCLUDED` / `PAID_ADDON` / `NONE`; **supersedes the boolean `pickup_available`**.
- `pickupRequired` bool — **OP** — → OCTO `option.pickupRequired`.
- `bookingCutoffMinutes` int — **OP** — **default 120, range 0–10080**; after cutoff the date cell shows **"Closed"**. **Zero-minute cutoffs explicitly supported.**
- `cancellationHours` int — **OP** — **enum-bound `[24, 48, 72, 168]`, default 48, NOT NULL** (DTO `@IsIn`); CMS blocks out-of-enum values; **a publish requirement**; drives **5 render locations** + Schema `refundPolicy` (LD1). Canonical name **supersedes `cancellation_window_hours`** (C5).
- `paymentModel` `PaymentModel` — **OP** — `OPERATOR_LINK` / `ON_ARRIVAL` / `PAID_IN_FULL` / `OPERATOR_FULL`; **snapshotted onto the booking at creation**.
- `depositPct` Decimal(4,1) — **RO to the operator** — **20–30 in 2.5 steps** (20, 22.5, 25, 27.5, 30); **tier-driven**, surfaced read-only (LD24).
- `bookingType` `TourBookingType?` — **OP** — `PRIVATE` / `SHARED`.
- `instantConfirmation` bool — **OP** — default true.
- `meetingPointLat` / `meetingPointLng` Float? — **OP** — Meeting & Pickup block (LD19); localized text on `TourTranslation`.
- `checkInMinutesBefore` int? — **`+ TO ADD` (Figma, gap #10)** — **OP** — "Please arrive N minutes early for check-in". Master references a per-tour "arrive 30 minutes early" default; design shows 15. **Default 30.**
- `startTimes` String[] (`'HH:MM'`) — **`+ TO ADD` (gap #9)** — **OP** — the tour's slot set (master E.3); the availability schedule switches these per weekday; **a `departure.start_time` must exist in this list**. Column now, consumers in the availability phase.
- **`free_cancellation` boolean — the ONE master field deliberately NOT stored.** Master calls it "redundant by rule… always `true` and derivable from `cancellation_hours`; drop at the C5 migration." Derive as `freeCancellation = cancellationHours != null` — **never persist it.**

#### B.6.5 OCTO product attributes (all present)

- `timeZone` string (IANA) — **SYS** — default `America/Curacao`, derived from the destination.
- `availabilityType` `OctoAvailabilityType` — **OP** — default `START_TIME`.
- `instantDelivery` bool — **OP** — default true.
- `availabilityRequired` bool — **OP** — default true.
- `allowFreesale` bool — **OP** — default false.
- `deliveryFormats` `DeliveryFormat[]` — **OP** — default `[PDF_URL, QRCODE]`.
- `deliveryMethods` `DeliveryMethod[]` — **OP** — default `[VOUCHER]`.
- `redemptionMethod` `RedemptionMethod` — **OP** — default `DIGITAL`.
- `reference` string? — **OP** — operator external id (OCTO reference).

#### B.6.6 Flags & accessibility

- `minAgeYears` int? — **OP** — tour-level min age (distinct from per-band `minAge`); widget enforcement + Schema `suggestedMinAge`; **supersedes `minimum_age`**.
- `fitnessLevel` `FitnessLevel?` — **OP** — `EASY` (**default, hidden**) / `MODERATE` / `CHALLENGING`.
- `weatherDependent` bool — **OP** — **default false**.
- `wheelchairAccessible` bool — **OP** — **master directive: default `true`** ("most tours assumed accessible unless explicitly not"); **schema default must change false → true (gap #5)**. When false, routes to "Not suitable for" and feeds Schema.org `accessibilityFeature`.
- `familyFriendly` bool — **OP** — default false.
- `suitableForBeginners` bool — **OP** — default false.
- `guideLanguages[]` (via `TourLanguage`) — **OP** — drives the **third quick-info badge** (LD7).
- `isLocalsFavourite` bool — **ADM** — **manual editorial flag, update-only, ~30% target, never tier-linked** (see B.13).

#### B.6.7 Commercial tier

- `commissionTier` Decimal(4,1) default **20.0** — **SYS** — 20 / 22.5 / 25 / 27.5 / 30; updated together with `tierKey` / `tierRank`. The **+35% Spotlight is a separate overlay that does NOT change these columns.**
- `tierKey` `TierKey` varchar(20) default `'standard'` — **OP** — operator picks (eligibility-gated, 30-day lock).
- `tierRank` smallint default **5** — **SYS** — **denormalized from `tierKey`, never client-written**.
- `tierLockedUntil` DateTime? — **SYS** — `now + 30 days` on every tier change; further changes rejected while in the future.
- `qualityScore` Decimal(6,2) default **0** — **SYS** — nightly job, **read-only at query time**.
- `eligibilityState` — **SYS** — master enum values `eligible` / `provisional` / `grace` / `demoted`; code enum `EligibilityState` = `LOCKED` · `PROVISIONAL` · `ELIGIBLE` · `GRACE` · `DEMOTED`.
- `graceStartedAt` DateTime? — **SYS** — when the 30-day grace began (gap G7 of the tour doc).
- `graceMetric` string? — **SYS** — the failed metric: `rating` / `review_count` / `cancellation_rate`.
- `isBookable` bool — **SYS** — true iff ≥1 AVAILABLE departure within 30 days (nightly); bookability-filter input.
- `availabilityConfirmedAt` DateTime? — **OP** — operator "availability is current" freshness nudge (gap G8 of the tour doc).
- `firstPublishedAt` DateTime? — **SYS** — eligibility window anchor.
- `isSponsored` bool — **SYS** — denormalized mirror of an ACTIVE `SpotlightRequest`; **never set manually** outside the spotlight lifecycle (prod) or the demo seed.

#### B.6.8 Computed / cached aggregates & CRO counters (read-only)

- `aggregateRating` Float? — **SYS** ✓ — updated on review approve; **renders at ≥3 reviews**, LD11 operator fallback below 3.
- `aggregateReviewCount` int — **SYS** ✓; `aggregatesUpdatedAt` DateTime? ✓.
- `ratingDistribution[]` (int[5] or JSON) — **`+ TO ADD` (gap #4)** — star chart (LD31); can be cached or computed at read.
- `photoReviewCount` int — **`+ TO ADD` (gap #4)** — **photo carousel activates at ≥3 photo reviews**.
- `bookingCount` int — **SYS** ✓ — "Most booked" sort, **parked until the §3.12 reactivation threshold**.
- `bookingCountToday`, `lastBookedAt`, `spotsRemaining` — **SYS** ✓ — present in the model but **NO consumer urgency surface in v1 (ethical CRO)**. Capacity messaging uses live availability ("Only N left" in the party selector); capacity values derive from departures (E.9).
- `likelyToSellOut` bool — **SYS** — nightly demand recompute (§3.7); `likelyToSellOutOverride` bool? — manual CMS launch override; **read-time logic is `override ?? computed`**.
- `qualityScore` — nightly (§7.2 formula).
- **Render thresholds:** rating renders at **≥3 reviews** (LD11 fallback below 3); reviews **sort hidden under 10**, **filters hidden under 20** (LD30), default newest first.

#### B.6.9 SEO (all `+ TO ADD` today)

- `metaTitle` string? per locale — **OP** — on `TourTranslation` (gap #1).
- `metaDescription` string? per locale — **OP** — on `TourTranslation` (gap #1).
- `ogImage` string? URL — **OP** — single image, **Tour-level** (gap #2).

#### B.6.10 Flags & timestamps (all present)

- `isSponsored`, `isActive`, `publishedAt`, `createdAt`, `updatedAt`.

#### B.6.11 All child tables

- **`TourCategory`** ✓ — `tourId`, `categoryId`, `isPrimary`; unique `(tripId, categoryId)`; **exactly one `isPrimary = true` per tour**; required ≥1 row. Drives the breadcrumb and the canonical's category variant. Multi-category overlaps are intentional (sunset catamaran = `boat-tours` + `sunset-cruises`).
- **`TourHub`** ✓ — `tourId`, `hubId`. **Validation: the hub must belong to the tour's destination AND at least one of the tour's categories must be in the hub's `HubAllowedCategory` set.** No URL effect.
- **`TourAgeBand`** (`@@map("tour_age_bands")`, cascade delete) — **this IS the pricing model, not columns on Tour.** Fields: `id` (SYS) · `tourId` (SYS) · **`bandType` `AgeBandType` — `+ TO ADD` (gap #8)** `ADULT | CHILD | INFANT | YOUTH | SENIOR` · **`participation` `BandParticipation` — `+ TO ADD` (gap #11)** `PARTICIPANT` (default) / `SPECTATOR` · `label` (e.g. "Adult (age 13+)", "Child (age 4-12)", "Infant (age 0-3)") · `minAge` / `maxAge` int? (inclusive; null = no bound; design: Adult 13+, Child 4-12, Infant 0-3) · `price` Decimal(10,2) (0 = "Free") · `priceOriginal` Decimal? (strikethrough) · `priceNet` Decimal? (operator net) · `isDefault` bool (the band the widget defaults to, usually Adult) · `displayOrder` int.
  - **Rules:** all bands count toward capacity (participants AND spectators board the vessel); publish needs ≥1 `PARTICIPANT` band (or `basePrice`); `Tour.priceFrom = min(price)` across **participant** bands; API composes a typed `pricing` object keyed by `bandType`, spectator bands under `pricing.spectators`; **`Tour.allowsSpectators` is derived** (`EXISTS a SPECTATOR band`) — no extra column.
- **`TourImage`** ✓ — `url`, `urlAvif?`, `urlWebp?`, `isHero`, `focalX` (0.5), `focalY` (0.5), `altText?`, `displayOrder`, `width`, `height`. **Publish: ≥5 images, exactly one `isHero`.**
- **`TourAddOn`** ✓ — `name`, `description?`, `price` Decimal(10,2), `unit` (`PER_PERSON` / `FLAT`), `maxQuantity` (1), `displayOrder`, `isActive`. **EU Digital Fairness Act: never pre-checked in the frontend.**
- **`TourLanguage`** ✓ — `language` (ISO 639-1), unique `(tourId, language)`. Drives the third quick-info badge (LD7).
- **`TourHighlight` + `TourHighlightTranslation`** ✓ — highlight: `displayOrder`, `imageUrl?`; translation: `(highlightId, locale)`, `text`, `isMachineTranslated`. **3–6 highlights, 5–15 words each; publish requires ≥3.**
- **`TourInclusion` + `TourInclusionTranslation`** ✓ — inclusion: `icon` (default `check`), `displayOrder`, `imageUrl?`; translation: `label`.
- **`TourExclusion` + `TourExclusionTranslation`** ✓ (typed, LD18) — exclusion: `icon` (default `x`), `type` `ExclusionType?` (`PAID_ADVANCE` / `PAID_ONSITE` / `UNAVAILABLE` / `NOT_PERMITTED`), `priceText?` (for `PAID_*`), `displayOrder`, `imageUrl?`; translation: `label`. Master shape `{label, type, priceText?}`; **type drives inline rendering**.
- **`TourFeature` + `TourFeatureTranslation`** ✓ (other OCTO content, DS1) — `type` `FeatureType` (NOT highlight/inclusion/exclusion): prebooking/prearrival info, redemption, accessibility, additional info, booking/cancellation terms; translation: `text`.
- **`TourLocation` + `TourLocationTranslation`** ✓ (OCTO itinerary) — `types[]` (`START` / `ITINERARY_ITEM` / `END` / `POI`), lat/lng, address parts, `minutesTo`, `minutesAt`, `displayOrder`; translation: `title`, `shortDescription?`.
- **`PickupLocation` + `PickupLocationTranslation`** ✓ — `name`, lat/lng, `address?`, `minutesPrior?`, `displayOrder`, `isActive`; translation: `title`, `directions?`. A `PAID_ADDON` pickup also links to a `TourAddOn` for charging. **`+ TO ADD` (gap #12): `windowStart` / `windowEnd` (`'HH:MM'`)** — design shows a pickup window ("7:45-8:15 AM"), not just a single `minutesPrior`.
- **`TourTranslation`** ✓ — per locale, unique `(tourId, locale)` — see B.6.2.
- **`TourAttribute`** ✓ — per-tour values against `AttributeDefinition`; drives faceted filters / badges / JSON-LD.
- **Related entities owned by other modules (not tour children):** `Review` + `ReviewTranslation` (reviews module, E.7); `Booking` + items/add-ons (bookings/payments, E.8); `AvailabilitySchedule` / `AvailabilityException` / `Departure` (availability, E.9); `Wishlist`; `SpotlightRequest` + `ForceMajeurePardon` (commercial engine).
- **Enums the module depends on — present:** `TourStatus`, `PricingModel`, `WholeUnitType`, `PickupModel`, `AddOnUnit`, `ExclusionType`, `FitnessLevel`, `TourBookingType`, `OctoAvailabilityType`, `DeliveryFormat`, `DeliveryMethod`, `RedemptionMethod`, `FeatureType`, `PaymentModel`, `Currency`, `TierKey`, `EligibilityState`, `Locale`. **`+ TO ADD`: `AgeBandType`, `BandParticipation`.**

#### B.6.12 Publish guard — `DRAFT → LIVE` only when ALL hold

1. **≥5 images** with **exactly one `isHero`**.
2. **English `overview`** present (80–200 words).
3. **≥3 highlights.**
4. **A price** — ≥1 `TourAgeBand` **or** `basePrice`.
5. **Free-cancellation window present** (`cancellationHours` set; always is, NOT NULL) — listing requirement per master §6.2.
6. **≥1 category** with exactly one `isPrimary`.
- **Per-pricing-model publish gate (built):** `UNIT` additionally requires `basePrice` + `wholeUnitType`; `PER_PERSON` requires ≥1 age band **OR** `basePrice`. (The full "UNIT requires basePrice + wholeUnitType" rule is enforced **at publish, not at create** — draft-friendly.)
- **Lifecycle:** `DRAFT → LIVE ⇄ PAUSED → ARCHIVED` (+ restore). Status changes re-run the category ≥3 gating in both directions.

#### B.6.13 The tour-card contract

- **A tour card shows at most ONE badge, in the top-left slot.**
- The badge is derived **once, on the backend** (`ToursService.deriveTourBadge`) and returned as a `badge` field on **every** public tour-list item — every listing surface (destination "Locals' favorites", search results + typeahead, All Tours, category, hub tours) renders the same badge with **zero client-side logic**.
- The frontend paints `hit.badge` (`tour-card.tsx → BadgeChip`, type `TourBadge`); **listings consume the API order verbatim and must never re-sort or recompute a badge**.
- **Card rating render rules:** ≥3 reviews → show `⭐ 4.8 (124)`; 0–2 reviews → **hide the rating row entirely**; tour added <30 days ago AND 0 reviews → show the **New** badge instead of the rating row.
- **Card price label — two formats only:** per person → `from $36` (**no suffix**); per group → `from $270 per group` (full label, muted). Extended by decision D2 to be `unit_type`-aware (per boat / vehicle / group / aircraft / package).
- **Card pricing fallback:** "Price on request" (conflict log B.41; replaced "Contact for pricing").
- **Pickup label per `pickup_model`:** "Pickup included" when in the price, "Pickup available" when a paid add-on; the **filter** label is always "Pickup available" (B.69). LD3: **"Pickup", no hyphen, platform-wide.**
- **Review count separator:** `4.8 (1,738)` (en/es/pt) or `4.8 (1.738)` (nl/de) via `toLocaleString()`; no word "reviews"; a11y `aria-label="4.8 out of 5 stars, 1,738 reviews"`.
- **Duration formatter:** `<60 min` → "45 minutes"; exactly 60 → "1 hour"; whole hours → "4 hours"; hours + minutes → "4 hours 30 minutes"; ranges → "4 to 5 hours" / "2 hours 30 minutes to 3 hours"; **no decimals**.
- **Wishlist heart on every card:** desktop top-right overlay on the image, mobile bottom-right (avoids badge collision); ~32px white circular backdrop with subtle shadow; outlined (default) → filled brand-orange (wishlisted); **optimistic UI** (fill immediately, revert on API failure); no page navigation.
- **Image carousel:** 5–7 photos (`hero_image` first, rest from `gallery_images`); dots always visible bottom-center; arrows fade in on card hover only; lazy load (only first image immediate); 300ms ease-out slide; **mobile has no carousel — single `hero_image`**. Last carousel slide (desktop only) shows the first ~150 chars of `description`, truncated on a word boundary, ending `...More`.
- **Title convention:** `[Tour core identity] + [single strongest USP]`; **no `highlights[0]` on the card component**.
- **Grid density:** 3×6 = **18 per page**; mobile 1 column, pagination after 12 cards. Grid is a **3-column 1200 container** (B.19, superseding the 4-column 1280 grid).
- **The 01/02/03 ranking ribbon is REMOVED** from the generic card — position in the grid is the only ranking signal; it violated "max 1 badge per card" and broke in carousels and filtered results. Numbered `01`–`10` badges survive only on NUMBERED collections.

---

### B.7 Attributes

- **Dictionary:** `AttributeDefinition` (`attributes.prisma`) — **admin-owned**; built.
- **Per-tour values:** `TourAttribute` — **operator-set**; built. Drives **faceted filters, badges, and JSON-LD**.
- **Public filters endpoint** — built (Stage 1 DONE).
- **Derived / computed attributes (compute-on-read SSOT):** a set of tour attributes that duplicate first-class tour fields is **never stored or operator-editable** — the dashboard mirrors the backend's list in `lib/config/derived-attributes.ts`, and the **backend rejects setting them**. A contract test (dashboard risk **B4**) guards the two lists against drift; without it the dashboard would offer an attribute the backend rejects. *(Detail of the individual derived keys lives outside the fragments assembled for this section.)*
- **Hub comparison rows are a consumer of the dictionary:** Crossing (`1 hour`), Breakfast (Included / -), Open bar (Premium / Optional) are **likely Tour attributes** — reuse the dictionary if defined; model only the curated remainder.
- **The public filter modal (locked, B.59 / dtpl-11) — six sections, every one actually filters, in order:**
  1. **Price** — slider, $0 to max. (**Backend: the price min/max filter uses `priceFrom`, not `basePrice`.**)
  2. **Duration** — 4 multi-select bands.
  3. **Time of day** — morning / afternoon / evening, multi-select.
  4. **Free cancellation window** — 24h / 48h / 72h, single-select (**replaced the dead free-cancellation toggle**).
  5. **Pickup available** — toggle.
  6. **Ratings** — 3.0+ / 4.0+ / 4.5+, single-select, **hidden until reviews exist**.
  - **Removed: Booking type (a no-op)** — `booking_type` was dropped as a filter (decision D3).
  - **Category navigation chips in the filter row are links, not facets** (B.60); "Explore by type" removed from All Tours.
  - Filter state lives in **query params with self-referencing canonicals to the clean URL**; ItemList + BreadcrumbList schema; **server-rendered crawlable list** (B.61).
  - **Dual results counter** (B.62): static "{Y} tours available" in the page header + dynamic "{X} of {Y} tours" with applied pills and Clear all in the grid header.
  - Sidebar filters (architecture doc) are **superseded by horizontal chips** (B.18).

---

### B.8 Commission tiers

- **Island Tours is a commission marketplace.** Operators pay a tiered commission; **placement is a commercial choice within a flat quality bar**. **Placement is governed by commission tiers, not slots — there is no auction and no slot economy.**
- **Tier mechanics are internal commercial logic, never user-facing** — travelers never see "tier", commission, or `tier_rank`.
- **The five tiers** (source of truth: `TIER_MAP` in `backend/src/tiers/tiers.service.ts`):

  | Tier key | `tier_rank` | Commission | How a tour qualifies | Default? |
  |---|---|---|---|---|
  | `premium` | **1** (top) | **30.0%** | Flat eligibility bar | — |
  | `featured` | **2** | **27.5%** | Flat eligibility bar | — |
  | `boosted` | **3** | **25.0%** | Flat eligibility bar | — |
  | `organic` | **4** | **22.5%** | Open (no bar) | — |
  | `standard` | **5** (bottom) | **20.0%** | Open (no bar) | ✅ new tours |

- `boosted` / `featured` / `premium` are the three **paid (eligibility-gated)** tiers; `organic` / `standard` are the **open baseline**. Higher commission "buys" a lower `tier_rank`.
- **`standard` deliberately ranks BELOW `organic`** (5 vs 4) even though both are open — `organic` is the "good citizen" baseline, `standard` the floor. A 20% operator who wants to outrank other base-rate tours must move up to `organic` at 22.5%. **Intentional, not a bug.** `standard` is also the locked rate for operators on a negotiated 20% agreement.
- **Destination Spotlight = 35%** — **NOT a sixth interleaved tier**; a separate labeled block, never interleaved, max 3 simultaneous per destination, manual approval (see B.12).
- **Tour tier columns:** `commission_tier` `DECIMAL(4,1)` default **20.0** · `tier_key` `VARCHAR(20)` default `'standard'` · `tier_rank` `SMALLINT` default **5** · `tier_locked_until` `TIMESTAMP` nullable · `quality_score` `DECIMAL(6,2)` default **0**.
- **`tier_rank` denormalization rule:** `tier_rank` is **denormalized from `tier_key`** (1 best … 5 worst) for index/sort performance and is the **sole tier-derived sort key** (lower wins). It is **NEVER written by the client** — the client may set `tier_key` (subject to lock + eligibility); the server derives everything else. `tier_rank` and `quality_score` are **server-owned**.
- **Tier change + 30-day lock:** on any change **all three tier columns update together** — `tier_key = <new tier>`, `commission_tier = <new commission %>`, `tier_rank = <new rank>` (server-set) — **and `tier_locked_until = now() + 30 days`**. Further tier changes are **rejected while `tier_locked_until` is in the future**.
- Tier selection is **additionally gated by the eligibility engine** — the requested tier must be one the tour currently qualifies for (see B.10).
- **Non-retroactive rule:** `commission_rate` and `commission_amount` **snapshot onto every booking at creation and never change retroactively** (master §7.1). A later tier change, demotion, spotlight activation/expiry, or rate edit does **not** touch existing bookings. Demotion only changes future bookings' rate and the tour's `tier_rank`.
  - `commission_rate` `decimal(5,4)` — e.g. `0.20` for 20%.
  - `commission_amount` `decimal(10,2)` — **in EUR; the conversion value on every analytics platform (Google Ads, GA4, Meta) — never GMV.**
- **Deposit percentage is tier-driven** (LD24): `tour.deposit_pct` = **20 to 30 in 2.5 steps** → allowed values **20, 22.5, 25, 27.5, 30**. It governs how much of the booking is taken to Island Tours via Stripe on the deposit payment models.
- **Revenue is recognized on tour completion.**
- **A tour excluded by the bookability filter is not billed for its tier** during the unbookable period.
- **Removed slot economy** (do not build against it): `FeaturedSlot`, `SlotLock`, `SlotHistory`, `WaitlistEntry`; flows `lockSlot` → `publishTrip`, soft-lock / hard-reserve; the "3 featured slots per category" mechanism; category-create seeding 3 `FeaturedSlot` rows; `MANAGE_SLOTS` permission. **`FeaturedExperience` (Top Island Experiences) and `Wishlist` are unrelated — keep them.**

---

### B.9 Ranking

- **The canonical order (master §7.2 + the 2026-07-18 spotlight-first product decision):**
  ```
  is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC
  ```
  - Shown to travelers as the default sort **"Locals' favorites"** (a.k.a. "Recommended") — **"Locals' favorites" is the UI label for the tier ordering, not a separate formula.**
  - ⚠️ **CONFLICT (documented, resolved by date):** the master §7.2 and `COMMERCIAL-MODEL.md` state the order as **`tier_rank ASC, quality_score DESC, id ASC`** (three keys, no `is_sponsored`); `TOUR-RANKING.md` / `TOUR-BADGES-AND-RANKING.md` (Jul 19, product decision 2026-07-18) prepend **`is_sponsored DESC`** as sort key #1, realizing the master's "separate labeled block, never interleaved" as **spotlight-first within the single grid**. Below the spotlight block the pure master §7.2 order applies.
- **Key-by-key:**
  - **`is_sponsored`** — ACTIVE Destination Spotlight (max 3 per destination). The **spotlight FLAG** is the sort key; the Sponsored **badge** is cosmetic and **never reorders anything**.
  - **`tier_rank`** — 1 = premium … 5 = standard, denormalized from the operator's commission tier. **The dominant key** — a higher commission buys a better shelf.
  - **`quality_score`** — 0–100, nightly job, **read-only at query time**; **only a tie-breaker WITHIN a tier** — it can never lift a tour over a better-paying one.
  - **`id ASC`** — stable final tie-break; same tier + same quality → fixed order, no shuffling between visits. **Same-tier collisions are expected and valid; there is no per-category tier cap.**
- **Quality-score formula (master §7.2), range 0–100, nightly, read-only at query time:**
  ```
  quality_score = (avg_rating / 5)               * 40
                + (min(review_count, 100) / 100) * 25
                + (listing_completeness / 100)   * 20
                + (conversion_rate / max_conv)   * 15
  ```
  - **Rating — weight 40** — `avg_rating / 5`; **approved reviews only**; range 0 (no/low rating) → 40 (5.0★).
  - **Review volume — weight 25** — `min(review_count, 100) / 100`; **caps at 100 reviews**; range 0 → 25 (≥100 reviews).
  - **Listing completeness — weight 20** — fraction of the listing spec filled (images, description, attributes, meeting point, …), 0–100; range 0 → 20 (fully complete). Operator-facing guidance: **4+ photos**, description, highlights, inclusions, meeting point.
  - **Conversion — weight 15** — `conversion_rate / max_conv`; **`max_conv` = the highest conversion rate among ACTIVE tours in the SAME category, recomputed per run** (so relative). Range 0 → 15 (category leader). Category-relative so a niche category is not penalised.
  - **The nightly job is the only writer**; the score is **never computed at query time**. Built as `src/tours/quality-score.ts`, run by `ToursService.recomputeQualityScores()`.
  - **Known caveat:** the conversion term **contributes 0 until pageview tracking lands**.
  - **Demo caveat:** the seed sets `quality_score = 60 + tier_rank*5` (65/70/75/80/85, and 0 on just-published tours); these look inverted across tiers but are harmless (quality only compares within a tier) and the **real nightly job overwrites them on its next 3:00 UTC run**.
  - **Supersedes** the earlier weighted formulas — architecture doc and All Tours spec (**bookings 0.4 / rating 0.3 / recency 0.2 / reviews 0.1**) per conflict log **B.17** and **B.46**.
- **Sort options at launch — exactly 3 (conflict log B.68 / `LAUNCH_TOUR_SORTS`):**

  | UI label | Logic |
  |---|---|
  | **Locals' favorites (default)** | `is_sponsored DESC, tier_rank ASC, quality_score DESC, id` |
  | **Price: low to high** | `price_from ASC` (then `base_price`) |
  | **Price: high to low** | `price_from DESC` |
  - "Highest rated" / "Most booked" return once review/booking volume is meaningful; **"Newest" stays out** — the New badge covers recency. The public DTO **rejects** `rating` / `newest`. API: `GET /api/v1/tours?sort=recommended|price_asc|price_desc` (default `recommended`).
- **Bookability filter (master §7.2)** — a tour is excluded from **every** ranked result set, **regardless of tier**, when:
  - `status != LIVE` (master: `status != 'active'`), **OR**
  - `is_active = false`, **OR**
  - `is_bookable = false`, **OR**
  - it has **no availability / no open departure in the next 30 days**.
  - An excluded tour **does NOT occupy a position** — the next eligible tour moves up — and is **not billed for its tier** during the unbookable period. **Bookability removes, never reorders.**
  - **Bookability = EXISTS an open departure within 30 days**, carried by the `isBookable` column and recomputed by the nightly availability job to avoid a per-request departures join.
  - **Enforced in all four paths:** `findAll`, `search()`, the `suggest()` tour hits, and `findPublicByIds` (manual collections). `total` reflects the bookability-filtered set, so pagination counts are honest.
- **Diversity pass (master §3.8):**
  - Runs **AFTER ranking**, on the **default sort only**: *never more than 2 tours of the same subtype consecutively*. Subtype = `primaryCategoryId`.
  - Implemented in `applyDiversityPass` over the fetched page. Default behaviour: keep strict rank order, taking the earliest-ranked tour that will not form a 3-run; when a 3rd same-subtype tour would land back-to-back-to-back, the next tour of a different subtype is pulled up to break the run; if none is available it keeps strict rank order.
  - Deviates **only** when the most-abundant remaining subtype is *tight* (`count*2 - 1 ≥ remaining`, i.e. it needs an every-other slot to stay interleavable) — then it leads with that subtype so it is not stranded into a tail 3-run.
  - **Page-local** (operates on the returned page, not across pagination). **Explicit price/rating sorts are never reordered.**
  - **Diversity never sacrifices a paid tier for cosmetic spacing** — `tier_rank` order stays intact except where §3.8 forces a minimal change. Positions wobble ±1 by design.
  - Purpose per COMMERCIAL-MODEL: avoid one operator dominating the top of a result set; reorders within the already-ranked, already-filtered set and **does not change tier economics**.
- **`mostPopular` cap:** the master caps "Most popular" at **max 1 per category**. Implemented **page-local** as `applyMostPopularCap`, run **after final ordering** in `findAll`, `search`, and the typeahead strips: the first-ranked tour of each primary category keeps the badge; later ones drop to no badge (or fall back to Sponsored when paid). ⚠️ `TOUR-BADGES.md` (Jun 30) still calls this a "Known simplification" and says `deriveTourBadge` returns per-tour eligibility only — **stale**; it was built 2026-07-18.
- **Peach tint (master §B.63) — presentation only, no effect on order:** peach `#FFF5EE` on **card #1 of the All Tours page, page 1, default sort only**; dropped during price sorts. **Excluded:** hub pages, numbered collections, search results, related tours, category pages, and the destination "Locals' favorites" grid. Tint range quoted as `#FDF6F0` to `#FFF5EE`. Built 2026-07-18 (`ToursListingSection → peachFirst → TourCard tinted`).
- **First-card cream highlight (product decision 2026-07-18, beyond master):** the FIRST card of each main tour listing (All Tours page 1, destination grid, collection tours, hub trips panel) renders the hover treatment statically — cream `#fdf6f0` fill, image corners merged, inset content. **Position-based** via a `highlighted` prop (`i === 0`), **NOT badge- or spotlight-based**. **No-layout-shift rule:** content inset is static-only and hover animates ONLY background + corner radius (animating horizontal padding shrinks the text box, re-wraps titles and shifts the grid — bug fixed 2026-07-18). The cream highlight visually overrides the peach tint on card #1.
- **Single code path:** every listing surface (destination "Locals' favorites", All Tours, category, hub tours, search-within-bucket) orders through `ToursService.findAll` → `buildOrderBy` (DB sort) → `applyDiversityPass` (in-memory reorder). **Search results are one flat set ordered by the same canonical sort — there are no relevance buckets; ILIKE matching only decides membership.**
- **End-to-end listing request:** `WHERE status=LIVE ∧ isActive ∧ isBookable (+ destination/category/hub filters)` → `ORDER BY is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC` → `flattenTour` (localized title, destinationSlug, primaryCategoryId) → `deriveTourBadge` → `applyDiversityPass` (recommended sort only) → JSON `{ total, data: [{ …tour, title, badge, … }] }`.
- **The nightly scheduler** (`@nestjs/schedule` in-process cron — idempotent recomputes, not retry/concurrency queues, so **no Redis/BullMQ needed** for these; `NightlyJobsService.nightly()`, `@Cron(EVERY_DAY_AT_3AM, tz: UTC)`), in order:
  1. `TiersService.runSpotlightLifecycle()` — activate/expire spotlights + mirror `isSponsored`.
  2. `ToursService.recomputeLikelyToSellOut()` — §3.7 demand signal for every LIVE tour.
  3. `AvailabilityService.materializeAllLive()` + `recomputeAllBookable()` — departures + the §7.2 bookability gate.
  4. `ToursService.recomputeQualityScores()` — the §7.2 formula.
  5. `TiersService.runEligibilityLifecycle()` — provisional → flat bar → 30-day grace → demotion (+ refresh `operator.cancellationRate90d`).
  - Each is also a plain method callable on demand (admin endpoint / tests / seed) via `NightlyJobsService.run()`.
  - ⚠️ **CONFLICT (mechanism):** `EVENT-DRIVEN-AND-QUEUES.md` lists `commercial.quality-score`, `commercial.eligibility-enforce`, and `availability.materialization` as **BullMQ repeatable (cron) jobs, run-date guarded** (`upsertJobScheduler`, e.g. pattern `0 15 3 * * *`); the built implementation uses **in-process `@nestjs/schedule`** instead.

---

### B.10 Eligibility engine (master §7.2 + §10247-ff, locked June 10, 2026)

- **A flat bar was chosen over the earlier "March ladder" draft:** one threshold proves base quality, after which tier is a **purely commercial visibility choice**. Only Spotlight carries a higher bar plus manual approval.
- **The flat bar — opens `boosted`, `featured`, AND `premium` (one bar, no per-tier ladder). All three must hold:**
  - **≥ 5 reviews** — **approved reviews only** (review moderation); the same `review_count` the tour page renders.
  - **rating ≥ 4.0** — the same `aggregate_rating` the tour page renders.
  - **operator cancellation rate ≤ 10%** — operator-initiated cancellations ÷ confirmed bookings, **trailing 90 days, across ALL the operator's tours**.
  - `organic` and `standard` have **no bar**.
  - **Enforced:** `evaluateFlatBar` gates `changeTier` (unless inside the provisional window; **admins bypass**) plus the nightly `runEligibilityLifecycle`.
- **Cancellation-rate details:**
  - **Traveler cancellations never count** — only **operator-initiated** cancellations.
  - The gate applies **only at ≥ 10 confirmed bookings** in the trailing-90-day window; below that the denominator is too thin to be fair (`operator.cancellation_rate_90d` is **null under 10 bookings**).
  - **Force-majeure pardons:** an admin marks an event as a **date range + destination** (e.g. a hurricane day); operator cancellations inside a pardoned range are **excluded for everyone at once**. Modeled as `ForceMajeurePardon` in `tiers.prisma` — fields `destinationId`, `startDate`, `endDate`, `reason`, `createdBy`; **no per-tour data**. Feeds both the tier flat bar and the Spotlight bar.
  - **Weather is otherwise an ordinary cancellation** — customer harm is identical; weather resilience is operator quality.
- **The Spotlight bar (on TOP of the flat bar), opens Destination Spotlight:**
  - **≥ 10 reviews**
  - **rating ≥ 4.5**
  - **cancellation rate ≤ 10%**
  - **manual admin approval** (operator requests, Island Tours approves)
  - **< 3 active in the destination** (hard cap)
  - **Enforced:** `assertSpotlightEligible` + `SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION`. Checked at **request AND approve**.
- **Lifecycle: provisional window → notify → grace → auto-demote (`EligibilityState`):**
  - Every tour gets a **one-time 90-day PROVISIONAL window from first publish** (`first_published_at` is the anchor) during which **ANY tier may be held, ungated** — no tour has history at launch. **It does not reset.**
  - **After the window:** a **nightly check** enforces the bar — "does the tour still meet the bar for its held tier?"
    - **Yes** → keep tier.
    - **No** → **NOTIFY the operator** → **30-day GRACE period** → if still failing at the end of grace → **AUTOMATIC DEMOTION to the highest tier the tour still qualifies for** (= `organic`, since the flat bar gates all three paid tiers).
  - **States:** master enum `eligible` / `provisional` / `grace` / `demoted`; code `EligibilityState` = `LOCKED` · `PROVISIONAL` · `ELIGIBLE` · `GRACE` · `DEMOTED`, with `graceStartedAt` and `graceMetric` (the failed metric: rating / review_count / cancellation_rate).
  - **Existing bookings keep their snapshotted commission through any demotion** — tier changes are never retroactive.
  - `DEMOTED` stays visible on the (now open-tier) tour until the bar passes again.
  - **Built:** `TiersService.runEligibilityLifecycle` runs in the nightly job and also refreshes `operator.cancellationRate90d`. Grace entry and demotion are **logged**.
  - **TODO:** the **operator email notice for grace/demotion is wireframe-gated** and not yet sent.
- **Three levers for a tour to climb (in order of impact):** (1) **win a Destination Spotlight** — biggest jump, leads every listing at 35%; (2) **upgrade the commission tier** — sustained placement, subject to the flat bar, 30-day lock, grace/demotion; (3) **raise the quality score** — decides who stands first *among equals*, never across tiers.

---

### B.11 Badges

- **Rendering contract:** at most **one badge per card**, **top-left**, derived once on the backend and served identically to every surface (see B.6.13).
- **The four card badges (`TourBadge` keys), triggers and colours:**

  | Badge | Trigger | Colour |
  |---|---|---|
  | **`likelyToSellOut`** | §3.7 demand signal true (`likelyToSellOut` / `likelyToSellOutOverride`) — all three conditions below. ~5–10% of catalog; selectivity is the feature. | Navy **`#193c5e`** |
  | **`mostPopular`** | `aggregateReviewCount ≥ 10` **AND** `aggregateRating ≥ 4.5`. **Never granted on commission-tier grounds.** Capped **max 1 per category per page**. | Brand orange **`#e8611a`** |
  | **`new`** | `publishedAt` < **30 days** ago **AND** `aggregateReviewCount == 0`. **Replaces the rating row** on the card. Auto-expires on first review or at 30 days. | Cream **`#fdf6f0`** |
  | **`sponsored`** | See the ⚠️ conflict below. | Gray (`bg-it-surface`); explainer gives **`#efece7` light / `#33373b` dark** |

- **⚠️ CONFLICT — sponsored badge PRECEDENCE (two docs disagree):**
  - **Claim A — `TOUR-BADGES.md` (Jun 30):** priority is **1 `sponsored` → 2 `likelyToSellOut` → 3 `mostPopular` → 4 `new`**. Rationale quoted from the master: *"always shown on paid placement; transparency is a brand pillar"*, so sponsored **outranks every earned badge**.
  - **Claim B — `TOUR-BADGES-AND-RANKING.md` §2.2 (Jul 19, "FINAL, product decision 2026-07-18", after two iterations):** priority is **1 `likelyToSellOut` → 2 `mostPopular` → 3 `new` → 4 `sponsored` (fallback)**. Earned badges lead; Sponsored is the **fallback label for any paid placement with no earned badge** — it answers "why is this unrated tour at the top?", and a card with an earned badge already explains itself.
  - **Status:** the Jul 19 doc is newer and self-describes as FINAL; `TOUR-BADGES.md` appears **stale on this point**. Both are recorded here; the master HTML is the arbiter.
- **⚠️ CONFLICT — sponsored badge TRIGGER (same two docs):**
  - **Claim A — `TOUR-BADGES.md` (Jun 30):** sponsored = **an ACTIVE Destination Spotlight ONLY** (mirrored onto `tour.isSponsored`). *"Commission tier alone does NOT make a tour sponsored."* "Paid placements P1–P3" are read as the max-3 Spotlight slots, not the self-serve tiers.
  - **Claim B — `TOUR-BADGES-AND-RANKING.md` §2.1 (Jul 19):** sponsored = **ACTIVE Destination Spotlight (`isSponsored = true`) OR a paid tier P1–P3 (`tier_rank <= 3`)** — citing master §3.6 "Paid tiers P1 to P3 placements". **Open tiers (organic/standard) are never labeled Sponsored.**
  - Master §7.2 itself says: **"Sponsored badge (gray) on paid placements P1 to P3."** COMMERCIAL-MODEL restates: "Sponsored badge — on paid placements P1–P3 (gray)."
- **Mutual exclusivity:** most pairs are mutually exclusive by definition — `new` needs 0 reviews so it cannot also be `mostPopular`; `likelyToSellOut` needs age ≥ 90d while `new` needs < 30d. The only real overlaps are **sponsored vs any earned badge** (resolved by the precedence conflict above) and **`likelyToSellOut` vs `mostPopular`** (sell-out wins in both docs).
- **Every badge is independent of position.** No badge ever reorders a card. The only correlation (Sponsored often first) is because the ACTIVE Spotlight tends to sit on a high-tier tour — and because `is_sponsored` is a sort key — **not because the badge sorts**.
- **How each badge is earned (input owner / timing / position effect):**
  - `sponsored` — operator tier pick / admin spotlight approval + lifecycle; **immediate on tier change, spotlight on approve or nightly**; position effect **none**.
  - `likelyToSellOut` — nightly demand recompute (or manual override); **nightly**; position effect **none**.
  - `mostPopular` — reviews module (`ReviewsService.recomputeAggregates` on approve/edit/remove); **real-time, no job**; position effect **none**.
  - `new` — publish + reviews; **real-time, no job**; position effect **none**.
- **§3.7 demand signal — "Likely to sell out" — ONE algorithm** powers both the card badge and the tour-page demand card (C7: one three-condition algorithm plus a manual CMS launch flag, replacing four competing definitions — conflict log B.44). **All three conditions must hold, evaluated daily:**
  1. `tour_age_days >= 90` (from `firstPublishedAt`, falling back to `publishedAt`).
  2. `recent_sellouts >= 3` in the past **60 days** — from `departures.sold_out_at` (E.9).
  3. `upcoming_availability_ratio < 0.40` over the next **30 days** — `Σ remaining_seats / Σ capacity` across non-cancelled departures in `[today, today+30]`.
  - Implemented in `backend/src/tours/demand-signal.ts` (`evaluateLikelyToSellOut`) — the **single source of truth** shared by the production recompute job and the demo seed so they cannot drift. Result stored on `tour.likelyToSellOut`; **nullable `tour.likelyToSellOutOverride` is the manual CMS launch override** (no tour has 90 days of history at launch). **Read-time logic: `override ?? computed`.**
  - Recompute entry points: nightly cron; admin `POST /api/v1/tours/admin/recompute-demand?tourId=` (`MANAGE_TRIPS`); or setting the override.
- **Data sources per badge:** `sponsored` ← `tour.isSponsored` (← ACTIVE `SpotlightRequest`) [+ `tier_rank` under Claim B]; `likelyToSellOut` ← `tour.likelyToSellOut` / `Override` (← `departures.soldOutAt`, capacity vs bookedCount, `firstPublishedAt`); `mostPopular` ← `aggregateReviewCount`, `aggregateRating`, `isSponsored`; `new` ← `publishedAt`, `aggregateReviewCount`.
- **NOT card badges (intentionally not in `deriveTourBadge`):**
  - **Numbered rank `01`–`10`** — circle; **Best Things to Do / Top 10 collections only**; never on destination sections.
  - **Locals' favorite ✦** — a **meta-row element on the tour page**; manual `tour.isLocalsFavourite`; it also selects the destination featured grid.
- **Hub variant** `hub-tour-card.tsx` (`HubTourBadge`) — **no `new` badge by design**; it keeps a rating row instead.
- **Collections: no Sponsored badge, ever.** Hubs **do** show it.
- **Legacy badge guidance (superseded / lineage):** "Bestseller" → renamed **"Most popular"** (B.33). Earlier color hierarchy (dtpl-7): Likely to sell out = urgency red/deep-orange bg + white text; Bestseller = authority near-black/deep-navy bg + white text; New = neutral off-white/ivory bg + dark text; **green reserved for a future "Special Offer" badge**; badge shape = small rounded pill (not flag/ribbon); top-left on image (desktop) / top of the right half (mobile). The **New badge itself was added** by conflict log B.64 (badge set previously had no recency badge).
- **Sponsored lifecycle → badge:** `requestSpotlight()` → `REQUESTED` → admin `approveSpotlight(window)` → `APPROVED` (or `→ ACTIVE` immediately if the window is already open, setting `tour.isSponsored = true`) → nightly `runSpotlightLifecycle()` flips `APPROVED → ACTIVE` at `startsAt` (`isSponsored = true`) and `ACTIVE → EXPIRED` past `endsAt` (`isSponsored = false`) → `deriveTourBadge` paints the gray chip while `isSponsored` is true, clearing automatically on the next lifecycle run.
  - `isSponsored` is **denormalized** (like `tier_rank`) so listings never join the spotlight table per card, and is **recomputed from ground truth** (true iff the tour has ≥1 ACTIVE spotlight), so multi-request cases are correct.
  - **TODO (the only explicit one in §2.3):** clear `isSponsored` when an ACTIVE spotlight is **cancelled** (today it only clears when the window closes).
- **Demo coverage:** the demo seed surfaces **all four badges in every live destination** (Curaçao, Aruba, Sint Maarten), each on an `isLocalsFavourite` tour so it appears in the destination "Locals' favorites" grid — `sponsored` via an ACTIVE Spotlight on the per-destination lead; `mostPopular` via `SHOWCASE_MOST_POPULAR` tours with ≥10 redeemed bookings → forced-approved 5★ reviews; `new` via `SHOWCASE_NEW` tours (`publishedDaysAgo: -8`, zero bookings); `likelyToSellOut` via `SHOWCASE_LIKELY_TO_SELL_OUT` tours aged 100 days with 3 past SOLD_OUT departures + filled upcoming, then the **real evaluator** runs. Re-seed: `pnpm prisma:seed:demo:clean && pnpm prisma:seed:demo`. **Demo helpers are not production code** — only the seeded data is demo; the evaluator/recompute they call are production.
- **Worked example (the explainer's headline):** *"Why is the 'Most popular' tour ranked 12th? Because badges describe — rank is bought."* West Point Snorkel & Beach Hop is the best-reviewed tour on Curaçao (★5.0 · 14 reviews → earns **Most popular**) but its operator pays **Boosted** (25%, rank 3); eleven tours ahead pay more (1 Spotlight at 35% + Premium 30% + Featured 27.5%). **"Ratings never compete across tiers — they only break ties inside the same tier."** Verdict: **no logic mismatch — the commercial model working as designed.**

---

### B.12 Destination Spotlight

- **Not a tier** — a separate, **manually-approved placement overlay**, modeled **per tour** by `SpotlightRequest` (`backend/prisma/tiers.prisma`).
- **The rules:**
  - **Commission: 35%**, only while active.
  - **Placement: a separate labeled block, never interleaved** with the ranked list (master). Realized in code (2026-07-18) as **spotlight-first within the single grid** via `is_sponsored DESC`.
  - **Cap: max 3 simultaneous per destination** — hard, across all operators.
  - **Approval: manual** — operator requests, Island Tours approves. **Not self-serve.**
  - **Extra eligibility on top of the flat bar: ≥10 reviews · rating ≥4.5 · `cancellation_rate_90d` ≤10%.**
  - Spotlight does **NOT** change `tierKey` / `commissionTier` / `tierRank` — those stay at the operator's chosen tier. It is an **overlay** that wins on commission + placement while active.
- **Lifecycle and statuses — `SpotlightStatus = REQUESTED | APPROVED | REJECTED | ACTIVE | EXPIRED`:**
  - Operator requests → service checks the extra eligibility bar → **`REQUESTED`**.
  - Admin approves (manual; verifies the destination's active count < 3; sets `approvedBy`, `startsAt`, `endsAt`) → **`APPROVED`** (or straight to `ACTIVE` if the window is already open).
  - `startsAt` reached → **`ACTIVE`**; `endsAt` reached → **`EXPIRED`** (frees a cap slot).
  - Admin rejects → **`REJECTED`** (with `note` / `rejectionReason`).
  - Timeline example: day -7 request `REQUESTED` → day -7 approve window (-5…+25) `APPROVED` → day -5 `ACTIVE` (`isSponsored = true`, badge ON) → day +25 `EXPIRED` (`isSponsored = false`, badge OFF).
- **`SpotlightRequest` entity** (`@@map("spotlight_requests")`, `Tour ──< SpotlightRequest`, `onDelete: Cascade`; a tour may have many over time, **at most one live**):
  - `id` uuid (SYS) · `tourId` FK (SYS) · `operatorId` FK (SYS) · `destinationId` FK (SYS, the cap is enforced per destination) · `status` `SpotlightStatus` (SYS/ADM, default `REQUESTED`) · `requestedAt` (SYS, default now) · `approvedAt` DateTime? (ADM) · `approvedBy` string? (ADM) · `startsAt` / `endsAt` DateTime? (ADM) · `note` string? (ADM).
  - **`+ TO ADD` (optional):** `requestedStartsAt` DateTime? (OP), `requestedDurationDays` int? (OP, alt `requestedEndsAt`), `rejectionReason` string? (ADM, cleaner than overloading `note`), `requestedBy` string? (OP, submitting user id for audit).
  - Indexes: `@@index([destinationId, status])` (cap enforcement), `@@index([tourId])`.
- **Rules the service must enforce:**
  1. **Eligibility gate at request AND approve** — reads `tour.aggregateRating`, `tour.aggregateReviewCount`, and `operator.cancellation_rate_90d`.
  2. **Hard cap at approve** — count requests for the destination with `status IN (APPROVED, ACTIVE)` whose window has not ended; **reject approval if already 3**. Must run **in a transaction** to avoid a race past the cap.
  3. **Effective commission at booking creation** — the snapshot must use the active-spotlight rate, not the tier column:
     ```
     effectiveCommissionRate(tourId, at):
       if hasActiveSpotlight(tourId, at) -> 0.35   (SPOTLIGHT_COMMISSION_RATE)
       else                              -> tour.commissionTier / 100
     ```
     `hasActiveSpotlight` = EXISTS a `SpotlightRequest` with `status = ACTIVE` and `bookingTime BETWEEN startsAt AND endsAt`. Resolved in **both quote and reserve** via `TiersService.effectiveCommissionRate(tourId, now)`; commission **snapshots and never changes retroactively** — a later activation/expiry does not change an existing booking. If a spotlight flips between quote and reserve, **the reserve snapshot is authoritative**. Payment never recomputes commission.
     - **Multi-currency safe:** commission is computed on the **EUR** value of the booking total, so a USD- or EUR-charged spotlight tour still yields a correct EUR commission at 35%.
  4. **Placement overlay on the read/ranking path** — master: active-spotlight tours are excluded from the interleaved ranked list and rendered in the separate labeled block. Code realization: they **lead** the single grid via `is_sponsored DESC`.
- **Jobs (no schema change):** a nightly/clock job flips `APPROVED → ACTIVE` when `now >= startsAt` and `ACTIVE → EXPIRED` when `now > endsAt`, freeing the destination cap slot automatically, and recomputes `tour.isSponsored` from ground truth.
- **Data sufficiency verdict:** the schema is sufficient for the core flow; what is missing is **service logic** (effective-commission resolution, transactional cap enforcement, activate/expire job, eligibility gate), the optional fields above, and **one cross-module dependency — `operator.cancellation_rate_90d` (master E.6) must exist**.
- **Checklist status:** marked `- [x]` — `src/tiers/` implements request/approve/reject, the transactional cap, the eligibility gate, and the effective-commission overlay snapshotted onto the booking.

---

### B.13 Locals' favourite — editorial rules

- `is_locals_favourite` is a **manual editorial flag**, set **only by the Island Tours editorial team (admins)**, **never operator-set**, **never tier-linked**, target **~30% catalog coverage**.
- It is the **single source of truth for every "Locals' favorite" surface** — the tour-page meta-row ✦ (LD13) and the destination featured-grid selector. **It is NOT a card badge.**
- **Gated by permission `MANAGE_EDITORIAL`** — granted to **`Role.ADMIN` only**. `MANAGE_TRIPS` cannot gate it because `TOUR_OPERATOR` holds that permission. (`MANAGE_EDITORIAL` added to the `Permission` enum, migration `20260712133827_add_manage_editorial_permission`.)
- **Write path: `PATCH /tours/:id/locals-favourite`** with body `{ value: boolean }`; toggles and **logs the admin action**.
  - **Removed from `UpdateTourDto`** and from the service `update()`; **never in `CreateTourDto`** (confirmed non-gap). It must never be re-added to the operator tour form.
- **Stats endpoint: `GET /tours/admin/locals-favourite/stats`** → `{ totalLive, flagged, pct, target: 30, perDestination[] }`.
- **Curation UI:** `/dashboard/locals-favourites` — RBAC-gated nav item (`permissions: [MANAGE_EDITORIAL]`), destination selector, coverage banner vs the 30% target (**amber warning when >10 points off**), a trips-table mirror with search + favourite/status/destination/operator filters + column toggle + pagination. **REMOVE confirms via `ConfirmDialog`; add is direct.** Candidate list reuses the existing `GET /tours/admin/all` + `destinationId` filter — no new list endpoint.
- **Intentional deviation:** no row-select / bulk column (`showSelect: false`) — no bulk curation action exists.
- `likelyToSellOutOverride` is **intentionally untouched** by this surface (a computed-signal override, a separate concern).
- **Gaps this work closed:** **G1** operator-editable checkbox in the shared trip form; **G2** the backend wrote the flag from `UpdateTourDto` regardless of caller role (**the real security hole**); **G3** no admin/editorial permission distinct from operators; **G4** no editorial surface and no ~30% coverage target surfaced.
- **Only two open items** in the checklist: manual verification that the page renders and the toggle + stats work end to end, and a live dev click-through. Everything else is `[x]`.
- **Brand term:** GB "Locals' favourite(s)" → **US "Locals' favorite(s)" platform-wide** (B.54 / C14); the **CMS field name `is_locals_favourite` is unchanged**.

---

### B.14 Pricing models

- **`pricing_model` enum: `per_person` / `unit`** — supersedes the architecture `price_type`. **The master declares no default.**
- **`unit_type` enum (nullable, only when `unit`): `group` / `boat` / `vehicle` / `aircraft` / `package`.** In the master **only `group` has any display rule** ("from $270 per group"); boat/vehicle/aircraft/package carry **no per-type behavior** in the master.
- **What the master actually says (baseline):** prices are `price_adult` / `price_child` / `price_infant`, "from = lowest applicable"; **there is NO unit pricing formula, no included-guest count, and no extra-person surcharge anywhere in the master**; card price label has two formats only; the tour-detail widget anchor is specified only as `From $X per person` ("person-based, not group-based") — **no unit/group/charter widget anchor is defined**; `age_bands[]` nullable drives widget **Pattern B** (else **Pattern A**) and "all bands count toward capacity"; **spectators are add-ons, not age bands**; `booking_type` private/shared with the single rule "unit-priced private charters: one booking takes the whole departure"; **`booking_type` was DROPPED as a filter (no-op)**.
- **The UNIT formula (decision D1):**
  ```
  unitTotal = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice
  ```
  - `unitIncludedGuests` **defaults to `maxPartySize`** and `extraPersonPrice` **defaults to 0**, so the model **degrades to a pure flat unit price (master-compatible)**.
  - Implemented in `src/bookings/booking-pricing.util.ts` (`computeUnitLines`) and mirrored in the card/checkout (`lib/tours/booking.ts`, `lib/stores/booking-store.ts`, `lib/checkout/checkout.ts`).
- **The six locked decisions (Part 0 of `PRICING-MODEL-AND-UNIT-CHECKLIST.md`; `[EXT]` = extension beyond the master):**
  - **D1a `[EXT]` — surcharge ONLY for GROUP (CONFIRMED, founder 2026-07-15).** Included-guests + extra-person surcharge applies **only when `unit_type = GROUP`**. Boat / vehicle / aircraft / package charters are a **FLAT whole-unit price with no surcharge fields**. Enforced in four places: backend create/update **null out** `unitIncludedGuests` / `extraPersonPrice` unless GROUP; the dashboard Pricing tab shows those fields only for GROUP; `buildTourBookingData` **zeroes them unless GROUP** (robust against stale data); the seed builder **forces GROUP** for any UNIT blueprint declaring surcharge fields. +2 backend tests.
  - **D1 `[EXT]` — the UNIT pricing model (CONFIRMED, founder 2026-07-15).** The master's unit model is a flat "per group" price; the platform **ADOPTS the richer engineer model as canonical** (the formula above).
  - **D2 `[EXT]` — `unit_type`-aware copy (CONFIRMED, founder 2026-07-15).** Beyond the master's "per group": per-`unit_type` wording + icon (boat / vehicle / aircraft / package / group) on card **and** checkout. Shared helper `lib/tours/pricing-label.ts` (`priceUnitKey` / `priceUnitLabel` / `PriceUnitKey`): `PER_PERSON` → "/per person"; `UNIT` → unit noun from `wholeUnitType` (+ "N included" / "+$X per extra" note, **GROUP only**). Copy keys `perBoat` / `perVehicle` / `perGroup` / `perAircraft` / `perPackage` across **7 locales**.
  - **D3 — `booking_type` is NOT a filter** (master no-op). No filter facet. `bookingType` is used only for the unit+private exclusivity rule and an optional **"Private charter" badge (copy only)** — the pill *"Private charter - this departure is exclusively yours"* shows when `bookingType === 'PRIVATE'` and UNIT.
  - **D4 — UNIT tours have NO age bands** (locked earlier). A single "guests" counter (Pattern A). The backend **rejects age bands on unit tours** (`assertNotUnitPriced` → 400 "Unit-priced tours use a single guests count…"); the dashboard hides the age-band manager for unit tours.
  - **D5 — UNIT + PRIVATE = the whole departure** (master-canonical). One booking consumes the entire departure (exclusive sell-out). Implementation: a private-unit reserve runs an **exclusive claim** (`booked_count = capacity`, `status = sold_out`, guarded by `status = open AND booked_count = 0`); non-exclusive keeps the guarded count-up. `Booking.exclusiveDeparture` is snapshotted at reserve; `releaseSeats(..., exclusive)` **resets `booked_count = 0`** on cancel/expiry for exclusive bookings, else counts down. Migration `20260715173552_unit_booking_exclusivity`. Chosen representation means existing `bookedCount >= capacity` logic reads SOLD_OUT with **no util change and no schema flag on `Departure`**; the materializer needs no change (capacity for a private-unit departure stays `maxPartySize`; exclusivity is enforced at booking time).
  - **D6 `[defer]` — spectators-as-add-ons.** The master puts spectators in `add_ons[]`; the code and the Figma widget model them as **`SPECTATOR` age bands** (Adult $20 / Kid $10 with their own line items "Spectators x 2 x $20", which a flat single-price `TourAddOn` cannot express). Divergence acknowledged in both docs; **out of scope, tracked separately.**
- **`priceFrom` anchoring (2026-07-16 founder rule):** `recomputePriceFrom` sets `UNIT → priceFrom = basePrice`; `PER_PERSON → the DEFAULT participant band ?? cheapest participant band ?? basePrice`. The "From $X per person" anchor is the **DEFAULT band (adult reference price), NOT the cheapest child/senior band** (it was showing "From EUR41" child while Adult = EUR69). `orderBy isDefault DESC, price ASC`; demo seed, dashboard copy and spec mirrored; existing rows backfilled by migration `20260716165001_reanchor_price_from_on_default_band`. **The master line "the 'from' price on cards is the lowest applicable" is SUPERSEDED by this founder decision** — the master doc needs a wording update.
- **Reserve DTO:** `items` is now optional (`ArrayMinSize` removed); `guests?` + `travelerAges?` added; `BookingUnitItemResponseDto.ageBandId` nullable. The service enforces a **model XOR** — UNIT needs `guests` and rejects `items`; PER_PERSON needs `items` and rejects `guests`. For UNIT, `pax = guests` and one null-band unit item is created per guest (whole retail on the first, for manifest + item-sum consistency).
- **Dashboard consolidation (founder 2026-07-15):** ALL pricing fields moved into the **Pricing tab** (`PricingBasicsCard`: model + currency + base always; unit type / included guests / extra person only for UNIT; age-band manager below, hidden for UNIT). The **Details tab keeps only** operational/logistics/audience/policy fields: duration, pickup model/required, min/max party size, booking cutoff, meeting point, min age, fitness, weather/wheelchair/family/beginners, cancellation window, payment model, deposit %, `bookingType`.
- **Status:** every checkbox in `PRICING-MODEL-AND-UNIT-CHECKLIST.md` is `[x]`; the backend suite was green at **875 tests**; the sole outstanding action is a **user-run demo reseed**.

---

### B.15 Featured Experiences / Top Island Experiences

- **`FeaturedExperience`** is the model behind **Top Island Experiences** (lives in `prisma/destinations.prisma`).
- **Admin-created / admin-curated.** It surfaces **categories and hubs only — never individual tours.**
- It is **unrelated to the slot economy and explicitly kept** when `FeaturedSlot` / `SlotLock` / `SlotHistory` / `WaitlistEntry` are deleted (as is `Wishlist`) — an explicit note in the removal section of `MASTER-CHECKLIST.md`.
- It is administered **inside the Homepage CMS module** rather than as a standalone dashboard route (`homepage-experiences-tab.tsx`); backend endpoints `/featured-experiences[/:id]` alongside `/home-page` and `/home-page/translations/:locale`.
- **Public-site status:** the homepage `TopExperiences` component has bundled fallback cards and a curated path with `MIN_CURATED_CARDS = 3` that is **never fed** — `getFeaturedExperiences()` exists in `lib/api/public/` but is **imported by nothing**, so all homepage "top experiences" card labels currently come from the static dictionary JSON, not the CMS.

---

## C. Availability, Booking, Payments, Settlement, FX & Transactional Email

> Canonical arbiter for everything below: `technical-doc/island-tours-platform-master.html` **v1.9** (June 11, 2026). Where a derived doc disagrees with the master, the master wins. Conflicts between sources are marked `⚠️ CONFLICT` and left unresolved.

> ### ⚠️ PROMINENT FLAG — `operator_full` is DROPPED FROM v1
> Multiple docs (BOOKING-AND-PAYMENTS.md, BOOKING-FLOW-DESIGN-GUIDE.md, BOOKING-AND-PAYMENT-DATA.md, master §1.4/§5.8/§6.1/§8.2, the confirmation-email wireframe, EVENT-DRIVEN-AND-QUEUES.md) spec `operator_full` as a **live, fully-specified fourth payment model**.
> **It was DROPPED FROM v1 by the locked founder decision of 2026-07-15** recorded in `02-architecture/SETTLEMENT-AND-PAYOUTS.md` Part 2: *"V1 ships with three payment models. `operator_full` is dropped from v1."* It returns in **v2** via **Stripe Connect or direct bank transfer**, at which point the commission-collection rail is specified.
> Every `operator_full` requirement below is therefore **v2 scope**, retained verbatim because the specs are locked and the code path is built-but-guarded. Backend enforcement: `bookings.service.ts:loadContext` throws **422** for an `OPERATOR_FULL` tour, so neither `reserve` nor `quote` can create a confirmed payment-free booking. Frontend enforcement: `bookingBlocked = isOperatorFull` replaces the CTA + trust lines with a disabled `bookingUnavailable` notice.
> EVENT-DRIVEN-AND-QUEUES.md states this explicitly: *"`operator_full` is dropped in v1 (see SETTLEMENT-AND-PAYOUTS.md); the note above is the v2 behavior."*

---

### C.1 Availability: schedules, exceptions, departures, materialization

#### C.1.1 Governing principles (master E.9, locked June 10, 2026)

- The platform is the **single source of truth** for availability and is always current **regardless of operator API status**.
- API adapters come later, are **not a prerequisite**, and **upsert into the same model**.
- **Capacity lives per departure.**
- **Single-day tours only (v1)** — LD25 multi-day support was dropped.
- **All times are tour-local.**
- Mental model: `Schedules (rules) → materialize → Departures (concrete inventory) → computeIsBookable → tour.isBookable → filter → public listing`.
- Schedules and exceptions are **rules**; they are **never booked against**. Bookings only claim `Departure` rows.
- Departures replace the simple legacy `TourSchedule` model.
- Any missing link in the chain ⇒ tour is `LIVE` but "not yet listed".

#### C.1.2 Table 1 — `availability_schedules` (weekly recurring pattern)

- `tourId` — FK to the tour.
- `weekday` — smallint, **`0 = Monday … 6 = Sunday` (tour-local)**. Explicitly **NOT** JavaScript's Sunday=0. Invariant: Monday=0 everywhere; do not reintroduce JS Sunday=0.
- `startTime` — `@db.Time`; **must be one of `Tour.startTimes[]`** (master: `start_time` must exist in `tour.start_times[]`). Enforced by `assertStartTimeInSlotSet`.
- `capacityOverride` — `Int?`; per-rule capacity. **`null` = fall back to `Tour.maxPartySize`** (the tour default capacity).
- `validFrom` / `validUntil` — dates bounding the window the rule applies. `validUntil` null = open-ended. Supports **seasonal patterns**.
- `status` — enum `ACTIVE` (default) or `PAUSED`. **Only `ACTIVE` rules materialize**; `PAUSED` produce nothing.
- Unique constraint: **`(tourId, weekday, startTime, validFrom)`** — master phrases it as "one row per tour, weekday, and time".

#### C.1.3 Table 2 — `availability_exceptions` (per-date deviations)

- `tourId` — FK.
- `date` — the date the exception applies to.
- `startTime` — time, **nullable**; **null time = the whole date**.
- `type` — enum `AvailabilityExceptionType`, four values:
  - **`ADD_SLOT`** — introduce a departure the weekly pattern does not produce.
  - **`SET_CAPACITY`** — override capacity for one slot (`startTime` set) or for the whole date (`startTime` null).
  - **`CLOSE_DATE`** — stop-sell the whole date (departures are kept but marked `CLOSED`).
  - **`CLOSE_SLOT`** — stop-sell one slot.
- `capacity`, `note`, `createdBy` — supporting fields.
- The **close types are the stop-sell one-tap workflow — the daily core action for non-API operators** (master E.9).

#### C.1.4 Table 3 — `departures` (the materialized truth)

- **`UNIQUE (tourId, date, startTime)`** — this is the materializer's idempotency key.
- `date` + `startTime` — the concrete instant, tour-local.
- `capacity` — int; the resolved capacity for THIS departure.
- `bookedCount` — int; seats claimed. `>= capacity` ⇒ sold out. **All party bands count toward capacity** (including infants and spectators).
- `status` — enum `DepartureStatus`: **`OPEN` / `SOLD_OUT` / `CLOSED` / `CANCELLED`** (master lowercase: `open` / `closed` / `sold_out` / `cancelled`).
- `soldOutAt` — timestamptz nullable; **stamped once per fill**; feeds `recent_sellouts` for the §3.7 demand trigger.
- `source` — enum **`SCHEDULE` / `EXCEPTION` / `API`**.
- `externalRef` — varchar; API adapters **upsert idempotently**.
- `manuallyEdited` — boolean; `true` **protects the row from re-materialization**.
- Rule: **portal stop-sell always wins**, and **a sync never silently reopens a manual closure**.
- Rule: **capacity below `booked_count` is admin-only, with a warning, and never auto-cancels.**
- Rule: restores (cancellation, capacity raise) **reopen the departure but `sold_out_at` history stays**.

#### C.1.5 Two `Tour` fields that drive availability

- **`Tour.maxPartySize` (`Int?`)** — the DEFAULT capacity a schedule uses when it has no `capacityOverride`. **If both are null the slot is silently skipped** — this is the "published but not listed" root cause.
- **`Tour.isBookable` (`Boolean`)** — the cached listing gate. The public grid reads **only this**, never joining departures per-request.

#### C.1.6 The materialization engine (`availability-materializer.service.ts`, `materializeTour(tourId, from?, to?)`)

1. **Load tour clock + default capacity** (`timeZone`, `maxPartySize`). All computation in destination-local time; "now" = island wall clock (`localNow`).
2. **Resolve window** (`resolveWindow`): default **`today … today + 90 days`** (`DEFAULT_HORIZON_DAYS = 90`). Hard cap **365 days** (`MAX_HORIZON_DAYS`). The nightly job passes **`to = today + 364d`** (rolling 12 months).
3. **Load ACTIVE schedules + in-window exceptions** (`status: 'ACTIVE'`; PAUSED produce nothing).
4. **Build the desired set one calendar day at a time** (`buildDayDepartures`):
   - For each schedule whose `weekday` matches and whose `validFrom`/`validUntil` covers the day, add a desired departure.
   - **Capacity resolution:** `capacity = schedule.capacityOverride ?? tour.maxPartySize`. If null, the slot is **skipped with only a warning log**.
   - Layer exceptions on top: `ADD_SLOT`, `SET_CAPACITY`, `CLOSE_DATE`, `CLOSE_SLOT`.
   - **Full precedence:** `exception.capacity ?? schedule.capacityOverride ?? tour.maxPartySize`.
5. **Reconcile desired vs existing** (`reconcile`):
   - **Create** departures that do not exist yet.
   - **Update** capacity/status on unprotected existing rows.
   - **Delete** orphans (existing rows no longer desired AND unprotected).
   - A row is **protected and never touched** when `bookedCount > 0 || manuallyEdited || source === API`.
   - All writes run in a single `$transaction`.
6. Returns `{ created, updated, skipped, removed }`; logs e.g. `Materialized tour <id>: +2 ~1 skip 0 -0`.

- Master rule: **a nightly job materializes 12 rolling months** and **never touches departures with bookings, manual edits, or API source**.
- **Materializer flaw FIXED (2026-07-15):** `CLOSE_DATE` / `CLOSE_SLOT` now close a **booked** departure (status synced; capacity/bookings/source still protected; `manuallyEdited`/API stay hands-off). Previously a partially-booked slot kept selling through a closed date. `reconcile` was split; +4 unit tests (52 availability tests pass).

#### C.1.7 Materialization horizons (the three distinct numbers)

- **`DEFAULT_HORIZON_DAYS = 90`** — the create-time / on-demand materialize window.
- **Nightly cron horizon = `today + 364d`** — the rolling 12-month window; `from` = today, sliding forward one day per night.
- **`MAX_HORIZON_DAYS = 365`** — hard cap on any requested window.
- **`BOOKABLE_HORIZON_DAYS = 30`** — the **separate** ranking/bookability gate, **not a generation horizon**.
- **Sharp edges (documented):** a new schedule shows only **90 days** of departures until the next 3 AM run; the 12-month horizon **depends on the nightly cron actually running**.

#### C.1.8 The `isBookable` listing gate

- **`computeIsBookable(tourId)`** — true iff **≥1 live-OPEN departure within the horizon**, where horizon = `now … now + BOOKABLE_HORIZON_DAYS` and **`BOOKABLE_HORIZON_DAYS = 30`**. Query filters `status: OPEN` + the 30-day window, takes 100 candidates; for each it computes the **live** status (`liveDepartureStatus`) and keeps it only if `isDepartureBookable`.
- **`refreshIsBookable(tourId)`** — calls `computeIsBookable` and persists to `tour.isBookable`. It is the **ONLY writer of the flag**.
- **`liveDepartureStatus`** — computed at read time, **never stored**:
  - `CANCELLED` / `CLOSED` are **sticky** (operator/admin states) — returned as-is.
  - Else `bookedCount >= capacity` ⇒ **`SOLD_OUT`**.
  - Else if the booking cutoff has passed (`now >= start - bookingCutoffMinutes`) ⇒ **`CLOSED`** — **cutoff is NEVER materialized, only applied live**.
  - Else **`OPEN`**.
- **`isDepartureBookable`** — only a **live `OPEN`** departure counts.
- A departure can exist and still not make a tour bookable: **past, past cutoff, sold out, closed, or cancelled**.
- Master §7.2 / COMMERCIAL-MODEL: **bookability = EXISTS an open departure within 30 days**; a tour is excluded from **every** ranked result set when `status != 'active'` OR `is_bookable = false` OR no open departure in the next 30 days. An excluded tour **does not occupy a position** and **is not billed for its tier** during the unbookable period.
- **Public listing filter** — `ToursService.findAll` filters the **cached flag**, never a live join:
  ```ts
  const where: Prisma.TourWhereInput = { status: TourStatus.LIVE, isActive: true, isBookable: true };
  ```
- **Real-time single-tour reads DO read departures directly:** `checkAvailability(dto)` (live-bookable slots with enough seats) and `calendar(dto)` (per-day aggregate for the date picker).

#### C.1.9 Read contract (master E.9)

- Month map with **per-date state**.
- **`remaining` exposed only under 5.**
- **`cutoff_passed` computed from `booking_cutoff_minutes` at read time.**
- **`first_available_date`** for calendar auto-advance.

#### C.1.10 Recompute trigger matrix

| Trigger | What runs |
|---|---|
| Operator **creates** a schedule | `syncTourAvailability` = materialize + refresh |
| Operator **updates** a schedule | `syncTourAvailability` |
| Operator **deletes** a schedule | `syncTourAvailability` |
| Operator hits the **Materialize** endpoint | `materializeTour(from, to)` + `refreshIsBookable` |
| Operator **edits a departure** (cancel / sold-out / reopen) | `refreshIsBookable` |
| Tour is **published** | `computeIsBookable` → stored |
| Tour is **unpaused** | `computeIsBookable` → stored |
| Tour's **`maxPartySize` changes** | `resyncTourAvailability` — materialize + refresh (self-heal) |
| **Nightly cron (03:00 UTC)** | `materializeAllLive()` then `recomputeAllBookable()` across all LIVE tours |

- **Nightly job** (`NightlyJobsService.run()`): (1) `availability.materializeAllLive()` — rolling 12 months for every LIVE + active tour; **per-tour failures are logged and skipped** so one bad tour never aborts the batch. (2) `availability.recomputeAllBookable()` — refresh `isBookable` for every LIVE + active tour. Both are public methods callable on demand.
- ⚠️ **Spec-vs-code divergence (see also §C.11):** the nightly job is a plain **`@nestjs/schedule` cron (in-process), NOT BullMQ** — the rationale given is that these are idempotent recomputes, not a retry/concurrency queue. A **stale comment** in `availability-materializer.service.ts:42-43` still says "nightly BullMQ job" — **wrong; ignore it**.

#### C.1.11 Worked example (documented)

Monday 09:00 schedule, `maxPartySize=20`, `timeZone=America/Curacao`, `bookingCutoffMinutes=120`:
`POST /availability/schedules` → guards (ownership `assertTourAccess`, start time in slot set `assertStartTimeInSlotSet`, resolvable capacity `assertResolvableCapacity`) → row inserted `status=ACTIVE, validFrom=today` → `syncTourAvailability` → `materializeTour` creates Departures for every Monday in the 90-day window at 09:00, capacity 20, `OPEN`, `source=SCHEDULE` → `refreshIsBookable` → true → the public grid returns the tour. If the tour is still `DRAFT`, materialization still runs (it does **not** gate on status); `publish` later calls `computeIsBookable`.

#### C.1.12 "PUBLISHED, NOT YET LISTED" failure mode

- **Symptom:** dashboard banner *"PUBLISHED, NOT YET LISTED — This tour has no availability in the next 30 days…"*, driven by `trip.status === 'LIVE' && !trip.isBookable`.
- **Root cause:** both `capacityOverride` and `maxPartySize` are null ⇒ **silent skip** ⇒ zero departures ⇒ `isBookable = false`.
- **Guards now preventing it:**
  1. **Write-time guard** — `assertResolvableCapacity(tourId, capacityOverride)` called from `createSchedule` + `updateSchedule`; rejects a schedule with no override on a tour with no `maxPartySize`.
  2. **Self-heal on `maxPartySize`** — `ToursService.update` calls `availability.resyncTourAvailability(id)`.
  3. **UI surfacing** — the Schedules tab shows an amber notice when there is no Max Party Size, flips the capacity field to required, and blocks submit with a clear toast; the "not yet listed" banner explains the capacity cause.
- **Diagnostics:** 4 SQL queries provided (tour flags; ACTIVE schedules + overrides; departure count; OPEN departures in the next 30 days) plus a log grep for `has no capacityOverride and tour has no maxPartySize - slot skipped`.
- **Fix decision tree:** 0 schedules → add recurring schedules · schedules + 0 departures + null capacity → set Max Party Size (self-heals) or a per-schedule override · departures exist but none OPEN in 30 days → past / past-cutoff / sold-out / closed, or `validFrom` beyond 30 days · flag stale → force recompute (materialize endpoint or `NightlyJobsService.run()`).

#### C.1.13 Availability invariants to preserve

1. `isBookable` is a **cache** — any new code path changing departures MUST call `refreshIsBookable` / `resyncTourAvailability`.
2. **Never materialize without resolvable capacity** (keep the write-time guard).
3. **Protected departures are sacred** (`bookedCount > 0`, `manuallyEdited`, `source = API`).
4. **Weekday is Monday=0 everywhere.**
5. **Cutoff is live, never stored.**
6. **The public grid reads `isBookable`, not departures.**

#### C.1.14 All-sold-out dead end (master E.9 / B.77)

- Trigger: **no open departure in 30 days**.
- Recovery is **NOT** "Get notified when one opens? [Email me]" — that was superseded.
- Locked copy: **"These trips still have room this week"**, showing **2 to 3 same-category tours with an open departure within 7 days**.
- Plus a **silent GA4 `availability_dead_end` event**.
- **Notify-me is deferred to v2.**
- Rationale recorded: most buyers are already on the island with days left.

#### C.1.15 Operator availability portal (master E.9)

- Weekly schedule editor · exceptions calendar · bulk blackouts · **one-tap "Close today"** · `availability_confirmed_at` **freshness nudge for non-API operators** · **full audit trail**.
- **Dashboard fixes executed alongside:** Start Times moved from the Details tab to the **Schedules tab** (`trip-schedules-tab.tsx` `StartTimesSection`, persists via `useUpdateTrip`); removal of a start time is blocked (with tooltip) while a schedule uses it. Schedule/exception forms use **inline field + server errors** (replacing most toasts; row-action toasts kept). Free time inputs switched to **24-hour `HH:MM` text** because native `type="time"` showed ambiguous `12:00 --` AM/PM in 12h locales. Backend confirmed 24-hour-time compatible end to end.

---

### C.2 The booking widget — states, fields, validation, errors

> Canonical: master §6.1 (states), §6.3 (trust strip/modals), §5.8 (checkout); design source `Design_Brief_BookingWidget.md` — **the master overrules it where they disagree**. Implementation checklist: `03-implementation/BOOKING-WIDGET-CHECKLIST.md`.

#### C.2.1 The five states S1–S5

- **S1 Initial** — **Trigger:** page load. **Display:** "From $X per person" · date input · travelers input · CTA **"Check availability"** · the trust strip (§6.3).
- **S2 Date picker** — **Trigger:** tap the date field. **Display:** full-month calendar; **desktop shows 1 to 2 months, mobile 1 month with swipe**; defaults to the current month; the **first bookable date is highlighted**; **auto-skips months that are fully booked or beyond the booking cutoff**.
- **S3 Date selected** — **Trigger:** tap a date cell. **Display:** **time-slot chips when multiple departures exist**; the date persists as a **pill with a "Change" affordance**.
- **S4 Ready** — **Trigger:** date, time, and party all set. **Display:** the **financial summary always visible** with rows **Total / Pay today / Balance later**; a **"Show details" expander** showing the item math; the line **"All taxes and fees included"**; CTA becomes **"Continue →"**.
- **S5 Checkout** — **Trigger:** tap Continue. **Display:** the **accordion checkout** (§5.8, single-page accordion per C3).

#### C.2.2 Field order, selectors and party caps

- **Field order is LOCKED: date first, travelers second.**
- The **travelers selector is variant-aware**: an **inline counter** for single pricing; a **dropdown panel with an Apply button** for age-banded pricing (widget "Pattern B").
- **Pickup is a Step 2 field, never Step 1.**
- The **spectator field renders only on tours that have spectator pricing**.
- **Capacity-aware party validation** (widget brief §3.3.1): the **plus button disables at capacity**; an inline **"Only N left"** message; **auto-adjust party on date change**; **all age bands count toward capacity**.
- **Capacity enforcement during selection (built):** party caps at true seats-left — `BookingSlot.seatsLeft = capacity - bookedCount`, always known **even when `remaining` is withheld above 5**; `effectiveMaxOf` uses it.
- **Stepper silent-stop fixed:** an inline note renders at capacity (`atCapacity` / `capacityReason` in `deriveBooking`; `booking-cta.tsx`) — slot scarcity → **"Only N spots left"**; per-booking max → **"Up to N travellers per booking"** (dict key `maxPerBooking`, 7 locales).
- `min_party_size` / `max_party_size` — the capacity ceiling; **minimum defaults to 1**, some tours require **4+**.
- `min_age_years` — widget enforcement (plus Schema `suggestedMinAge`).

#### C.2.3 Calendar and slot chips (live availability)

- Calendar wired to **`POST /availability/calendar`** — one fetch over the bookable horizon on mount → a per-day availability map.
- **Days present + open** are selectable; **present-but-unavailable** (sold out / closed) and **absent** (no departures) render **disabled**; **past days disabled**.
- **Auto-advances the month view to the first available month** before a date is picked.
- Time chips wired to **`POST /availability/check`** (bookable slots for the picked date); the old **`slice(0,3)` 3-slot cap was removed**; all real slots render with a **loading skeleton** while they resolve.
- **"Only N left" shows only when `remaining < 5`** (the backend nulls `remaining` above that threshold).
- **Every slot chip shows a status line** — default **"Available"** (dict key `available`, 7 locales), besides selected / soldOut / onlyLeft.
- **Calendar disables carry hover hints** — no-schedule / closed / sold-out days blocked with a reason tooltip (dict keys `calendarNoDepartures`, `calendarClosed`, 7 locales); the tooltip animates via `AnimatePresence` + `crossFade`.
- **Note:** `/availability/check` returns **ONLY bookable slots** (sold-out / closed / past-cutoff filtered server-side), so **per-time sold-out chips do not appear in live mode** — date-level sold-out is reflected by the calendar day being disabled. The `sold_out` slot state remains only for the demo dataset.
- **Sold-out date copy (locked, B.78):** **"Sold out. Try another date."** (em dash removed); behavior — auto-suggest the next available date — unchanged.
- ⚠️ **CONFLICT (transcribed as written):** BOOKING-WIDGET-CHECKLIST §1 marks `[~]` *"Departure times capped at 3 (`departure-times.tsx:21 slice(0,3)`); slots forced `status:'available'`, `remaining:null` — no real availability"*, which contradicts §4's `[x]` removal of the cap.

#### C.2.4 Booking cutoff

- Per-tour **`tour.booking_cutoff_minutes`**, **default 120**, **range 0 to 10080** (zero minutes to one week).
- **After the cutoff the date cell shows "Closed".**
- **Zero-minute cutoffs are explicitly supported** for operators with the logistics for it (the cruise day-tripper segment is high value on Curaçao).
- Cutoff is **computed live server-side** in the availability read — the widget must consume it.
- ⚠️ **Status:** `bookingCutoffMinutes` is **not yet consumed by the widget** (`[ ]` — slots currently do not disable inside the cutoff window client-side).

#### C.2.5 CTA progression and readiness

- **CTA progression LOCKED (LD2):** `Check availability` → `Continue` → `🔒 Reserve my spot · Pay $X`.
- **`operator_full` renders the bare CTA "Reserve my spot"** — **no lock icon, no amount** (the lock is the payment icon and no payment occurs) — B.80, conflict log 80/82. **(v2 only — see the flag.)**
- **CTA copy deviation from the §3.1 table (founder call 2026-07-15):** the **card CTA stays "Continue"**, NOT "Reserve my spot · Pay {amount}". The card navigates to the **checkout page**, where reserve + pay happens — so **"Reserve my spot · Pay {amount}" lives on the checkout submit button** (`checkout-form.tsx`, top-level `reserve` / `reservePay` keys), not the card. The deposit amount is already shown in the card's "Pay today" money row above the CTA.
- **CTA readiness fix (live mode):** in live mode availability is pre-verified, so a complete in-capacity selection (date + time + party) is **immediately `ready`** (the price summary shows) with **no redundant "Check availability" click**; the party stays editable after ready. `deriveBooking`: `ready = isLive ? selectionComplete : availabilityChecked`, `editingParty = isLive ? true : !availabilityChecked`. The demo/design card keeps the two-phase check.
- **CTA silent-ignore fixed (2026-07-19):** clicking Check Availability with an incomplete selection no longer swallows the click — `handleCtaClick` sets `ctaError: 'date' | 'slot'` in the store (cleared on `pickDate` / `selectTime` / success); `booking-cta.tsx` shows an **animated inline note above the button** (Collapse, gap inside per motion rules), and the missing field highlights: **`ring-1 ring-it-primary` on the date trigger** (`booking-calendar.tsx`, plus the existing auto-open); for the slot case the pickable chips get a soft **`border-it-primary/45` tint + a one-shot x-shake of the row** (`departure-times.tsx`). *(A wrapper ring was tried first and rejected — it collided with the date field.)* New dict keys (7 locales): `errorSelectDate`, `errorSelectSlot`.
- **Continue → checkout no longer freezes (2026-07-19):** the push to the dynamic checkout route is wrapped in `useTransition` (`booking-cta.tsx`) — the button swaps to a spinner + "Continue" while navigating (disabled against double-push) and the checkout base route is `router.prefetch`ed on mount.

#### C.2.6 Per-payment-model money rows, CTA and trust lines

| `paymentModel` | Money rows | CTA (checkout button) | Trust line | v1? |
|---|---|---|---|---|
| `operator_link` | Total · Pay today (deposit) · Balance later (operator sends secure link) | locked `Reserve my spot - Pay {deposit}` | "Pay {pct}% now, the rest via the operator's secure link" + free cancellation | **yes** |
| `on_arrival` | Total · Pay today (deposit) · Balance on arrival | locked `Reserve my spot - Pay {deposit}` | "Pay {pct}% now, the rest on arrival" + free cancellation | **yes** |
| `paid_in_full` | Total · Pay today = total (no balance row) | locked `Reserve my spot - Pay {total}` | "Pay in full now" + free cancellation | **yes** |
| `operator_full` | Total · Balance later (operator collects) — no pay-today | bare `Reserve my spot` (no lock, no amount) | free cancellation only, no payment line | **v2 (dropped v1)** |

- **Zero-amount money rows are hidden** (master §6.1, conflict log 82) — `showPayToday` / `showBalance` gate rows on `> 0`. Applies in **widget S4, checkout summary, and email block 4**.
  - `operator_full` shows **Total** and **"Balance later"**.
  - `paid_in_full` shows **Total** and **"Pay today"**.
- **Deposit uses the real `depositPct` from the tour** (`usesDeposit = isDepositModel && 0 < depositPct < 100`), never a constant.
- `deriveBooking` derives per-model money rows, `balanceLabel` (**"Balance on arrival"** for `on_arrival`), and a `paymentTrust` line (deposit-link / "Pay in full now" / none). New dict keys (7 locales): `bookingUnavailable`, `balanceOnArrival`, `payOnArrival`, `payInFull`; `payLater` reworded to the operator's-secure-link copy.
- **`operator_full` is guarded out of v1** via `bookingBlocked` → disabled CTA + `bookingUnavailable` notice, so the widget never offers a payment-free reserve.

#### C.2.7 Trust strip and the two modals (LD5, locked verbatim — master §6.3)

- **Exactly two lines** inside the widget container, green SVG checks, the key phrase underlined as the click target:
  - **`✓ Free cancellation up to {hours}h`** → opens the **cancellation modal**
  - **`✓ Pay only {X}% today, the rest later`** → opens the **deposit modal**
- **Nothing else** — no "Instant confirmation", no WhatsApp, no "Secure payment" line; each exclusion is a locked decision (LD5, final of the 4→3→2 chain).
- On **`paid_in_full` and `operator_full`** the strip is the **single cancellation line**; line 2 and the deposit modal apply to the **deposit models only** (conflict log 81 / B.81).
- **Cancellation modal lead (locked):** *"Plans change. No problem."*
- **Cancellation modal body (locked):** *"Cancel up to {hours} hours before your tour starts (local time). Full refund, no forms, no questions asked."*
- **Cancellation modal after-window (locked):** *"If you cancel less than {hours} hours before your tour starts, we can't refund or change the booking. But if the operator has to cancel, you're covered: a full refund or a free reschedule."*
- **Deposit modal lead (locked):** *"Keep your plans flexible."*
- **Deposit modal step 3, default (locked):** *"Pay the balance up to {hours} hours before your tour starts (local time), or cancel for a full refund. After that, the booking is locked and the deposit is non-refundable."*
- **Deposit modal step 3, `on_arrival` variant (locked, C23 / conflict log 88 / B.88):** *"Pay the rest on arrival (card or cash, or cash only, per tour). Cancel free up to {hours} hours before your tour starts (local time). After that, the booking is locked and the deposit is non-refundable."* Head, other steps, and the why block are unchanged.
- **Deposit modal "Why we do this" (locked):** *"Popular tours fill up fast, so your deposit secures your spot the moment you book, without paying it all upfront. You're also supporting the local islanders who run these tours."*
- **Modal presentation:** desktop centered card ~**520px** max; mobile **bottom sheet**.
- **Modal a11y:** dialog semantics with **focus trap, ESC to close, focus return**.
- **Modal styling:** **orange numbered step circles**.
- Modals contain **no "Learn more" links** and **no refund timing** (refund timing lives only in the cancellation confirmation); the **deposit mechanics stay agentless**.
- ⚠️ B.43: the modal wireframe hint enum `[24, 48, 72]` is **superseded** — LD1's `[24, 48, 72, 168]` governs.

#### C.2.8 Pricing-model behavior in the widget

- **`PER_PERSON`** — age-band steppers (participants + spectators), driven from live `ageBands`. Retail = `sum(TourAgeBand.price × quantity)`; spectator bands are still `BookingUnitItem` rows and still count toward capacity.
- **`UNIT`** (whole-unit / private charter) — a **single "guests" stepper** (`bands=[{id:'unit-guests', price:0}]`, Pattern A); age bands ignored. Formula:
  ```
  total = basePrice + max(0, guests - unitIncludedGuests) * extraPersonPrice
  ```
  (e.g. Klein Curaçao Luxury Yacht Charter: 4 guests = $1,450; 12 guests = $1,890.) UNIT `priceRows` breakdown renders **"Charter (up to N guests)"** + **"Extra guests × k × {price}"**; `price-header.tsx` shows **"From {basePrice} per group"** with sub-line **"Up to N guests · +{price} per extra guest"**; `party-selector.tsx` header reads **"{count} Guests"**. `computeCheckoutTotals` mirrors the same math. New dict keys (7 locales): `guests`, `perGroup`, `unitIncludes`, `unitExtra`, `unitCharterLine`, `unitExtraGuests`.
  - **Still pending:** the persisted/authoritative UNIT total must come from the server quote; the FE figure is a correct **client estimate** only.
  - **Minor:** the checkout party label uses the English band label "Guests" (to localize).
- **"From $X per person" anchor = the DEFAULT age band** (founder rule 2026-07-16) — never the cheapest child/senior band (was "From EUR41" child while Adult = EUR69). Backend-owned: `recomputePriceFrom` prefers `isDefault DESC, price ASC`; rows backfilled by migration `20260716165001_reanchor_price_from_on_default_band`. ⚠️ **This SUPERSEDES the master field-table line "the 'from' price on cards is the lowest applicable"** — master wording still needs updating.
- **Exact decimal prices EVERYWHERE** (founder rule 2026-07-16) — **no whole-unit rounding on any money display**: widget `conv` keeps cents; `money()` / `formatCheckoutMoney` render both cents when fractional ("$63.75", whole stays "$75"); deposit estimates round to cents; central `formatPriceFrom` / `resolveDisplayPrice` make every tour-card surface exact. ⚠️ **Supersedes the Figma whole-number card anchor for fractional prices.**
- **Live currency switch (2026-07-16):** a footer currency change re-prices the mounted widget without a hard reload — `BookingStoreProvider` syncs re-converted `data` / `currency` into the live store on `router.refresh()`; the selection is preserved (band ids are stable) and the stale quote is dropped → auto re-quote in the new currency.

#### C.2.9 Server-authoritative quote (the widget must not own money)

- **`POST /bookings/quote`** is consumed in the widget + checkout. Backend stateless quote (`bookings.service.ts:quote()`); frontend `useBookingQuote` is **debounced, aborts superseded requests, and re-quotes on currency switch**.
- When a fresh quote is loaded it — **not client math** — drives the money summary/breakdown. `deriveBooking` / `computeCheckoutTotals` remain **only the optimistic pre-quote estimate**.
- Rule: the widget must call `POST /bookings/quote` **whenever date / time / party / add-ons / pickup / coupon / currency changes**, display backend quote totals, submit `quoteId` and/or `currency`, and **never compute authoritative totals locally**.
- Locked caveat: *"for anything persisted (the actual booking total), the client math in `deriveBooking`/`computeCheckoutTotals` must not be authoritative — the server quote wins."*
- **Do not trust frontend-converted totals.** Booking creation must either accept a `quoteId` and revalidate, or recompute the same quote server-side.

#### C.2.10 Pickup, add-ons and timing affordances (widget status)

- **Pickup** — `[~]` pickup selection lives on the **checkout form** (real `pickupLocationId` into reserve; the selection mirrors live into the summary card, and the timing is snapshotted onto the booking). **Widget-side surfacing and `pickupRequired` enforcement before Continue are still pending.**
- **Add-ons** — `[ ]` **"Not handled anywhere in the widget today."** Must render `addOns` per `unit` (**PER_PERSON multiplies by party, FLAT once**; respect `maxQuantity`) and include them in totals + the booking payload.
- **`instantConfirmation`** — `[ ]` show an "Instant confirmation" affordance when true.
- **`bookingType` (PRIVATE / SHARED)** — `[ ]` semantics in the party UI.
- **Not consumed at all (as of the checklist):** `pricingModel`, `wholeUnitType`, `bookingType`, `instantConfirmation`, `bookingCutoffMinutes`, `pickupModel`, `pickupRequired`, `pickupLocations`, `addOns`, `unitIncludedGuests`, `extraPersonPrice` — plus *"no countdown the hold time for a slot to booking"* [sic].

#### C.2.11 Error states, loading and empty edges

- **Missing date on CTA click** → inline animated note above the button + `ring-1 ring-it-primary` on the date trigger (dict `errorSelectDate`).
- **Missing slot on CTA click** → inline animated note + `border-it-primary/45` chip tint + one-shot x-shake of the chip row (dict `errorSelectSlot`).
- **At slot capacity** → **"Only N spots left"** inline note (`capacityReason`).
- **At per-booking maximum** → **"Up to N travellers per booking"** (dict `maxPerBooking`).
- **Day with no departures** → calendar day disabled with tooltip (`calendarNoDepartures`).
- **Day closed** → calendar day disabled with tooltip (`calendarClosed`).
- **`operator_full` tour** → CTA and trust lines replaced by a **disabled `bookingUnavailable` notice**.
- **Slots loading** → skeleton on the chip row; **calendar loading** → `calendarLoading` state.
- **Continue navigating** → button swaps to spinner, disabled against double-push.
- **Checkout form errors** — contact (name / email / phone) and payment (postal / name + Stripe element errors) validate with **inline errors** (audited; no change needed).
- ⚠️ **Empty-date edge (`[ ]` open):** a day the calendar reported open that returns zero live slots on a race — **the chips section stays collapsed**. Doc's note: *"Acceptable for now; a 'no times available' message would need a new i18n key."*
- **All-sold-out (30-day dead end)** → the alternatives module (§C.1.14), not a notify-me form.

#### C.2.12 Race-condition and idempotency handling at the widget boundary

- **Lost capacity race** → the guarded atomic `UPDATE` affects **0 rows** → the booking fails → the **frontend returns the traveler to date/time selection with the chosen date preserved** (flow path `C1` = *"Return to widget, keep date, choose another slot"*, on both cutoff/capacity failure and a failed claim).
- **Departure closes after the calendar read** → submit fails (`WHERE status='open'`).
- **Cutoff passes after the calendar read** → submit fails (cutoff computed live).
- **Reserve is idempotent** — `checkout-form.tsx:handleReserve` calls `reserveBooking` (real `POST /bookings`) **with an idempotency key**; `Booking.uuid` is the OCTO client-supplied idempotency key, and the DB `id` is client-suppliable as the reserve idempotency key.
- **Payment intent** is created/reused **idempotently per `(bookingId, kind)`**.
- **Currency change between quote and payment:** invalidate the old quote → request a new quote → create/reuse a payment intent **for the new booking/quote only**. **"Do not reuse a USD PaymentIntent for an EUR checkout or vice versa."**

#### C.2.13 Confirmation state — the processing hop and TYP

- **`/payment/processing`** (built as `[destination]/[slug]/checkout/processing`) — **lean intermediate page, noindex, ZERO tracking tags**. Holds after payment submit until the webhook confirms, then forwards to `/{destination}/thank-you/{public_ref}`.
  - Polls the TYP endpoint until **`CONFIRMED`**, with **timeout / failure states**.
  - Minimal **"confirming your booking"** UI.
  - **No conversion fired here.**
  - `operator_full` **skips this hop** (created confirmed at commit → straight to TYP) — **v2**; in v1 all live models go through it.
- **Synchronous "settle on return"** so the TYP redirect never waits on the webhook (EXECUTED 2026-07-19): `POST /payments/typ/:publicRef/settle` (`@Public`, keyed on `publicRef`, throttled short/medium/long) **re-reads the PaymentIntent from Stripe** (expanding `latest_charge`; **NEVER trusts the client**) and, when Stripe reports `succeeded`, runs the same idempotent `onIntentSucceeded` → `confirmFromPayment` as the webhook. The processing page calls settle first and redirects on CONFIRMED (~1s), polling only as a backstop; **the webhook remains the source of truth for redirect-return methods.**
  - **Race-hardened:** settle and webhook can hit `confirmFromPayment` in the same second, so the `ON_HOLD → CONFIRMED` transition **and** the `conversionFiredAt` mark are **ATOMIC guarded `updateMany`s** (master §5.1 mark-first) — exactly one caller emits emails and fires the conversion; the loser only backfills billing.
  - **Per-target rate cap** (`TargetRateLimiter`, **5 / publicRef / min**) so a multi-IP caller cannot spray the shared Stripe API.
- **TYP** — route `/{destination}/thank-you/{public_ref}`, **no locale prefix, noindex**; URL token locked to the **`publicRef` UUID** (unguessable); **`displayRef` (`IT-2026-XXXXXXXX`) appears in page content and email, never in the URL**.
- **TYP status chip is three-way** (Confirmed / Cancellation pending / Cancelled) driven by server verdicts `cancellationRequestedAt` / `cancelledAt` / `canRequestCancellation` / `cancellationBlockedReason` — replacing a hardcoded green "Confirmed" chip that rendered even on a cancelled booking.

---

### C.3 Booking lifecycle: reserve → quote → contact → intent → webhook → confirm → TYP

#### C.3.1 Locked master decisions governing the flow (BOOKING-FLOW-DESIGN-GUIDE §1 — all LOCKED)

- **Booking is instant.** No enquiry model, no 24-hour approval step. *"Bookings are confirmed instantly on every model; no 24h enquiry step exists."*
- **Inventory source of truth is `departures`**, not schedules or exceptions.
- **Capacity must be claimed with one guarded atomic database update.**
- **`payment_model` is snapshotted onto the booking at creation.**
- **Tier/commission snapshots are never retroactive.**
- **`commission_amount` in EUR is the conversion value. Never GMV.**
- **TYP route is `/{destination}/thank-you/{public_ref}`** — no locale prefix, `noindex`.
- **`public_ref` = the unguessable TYP URL token; `display_ref` = customer-facing.**
- **One unified `cancellation_hours` window `[24, 48, 72, 168]`, default `48`**, governs **both** free cancellation and the balance deadline.
- **The cancellation deadline is computed, never stored.**
- **`operator_link` balance is not tracked by Island Tours v1.**
- **Deposit forfeiture is never automatic:** operator reports non-payment → admin confirms → deposit/spot outcome applied.
- **Webhooks must be `@Public()` + `@SkipThrottle()`, signature-verified, idempotent.**
- **`operator_full` takes no payment rail; created `CONFIRMED` at commit.** *(v2 — see flag.)*
- **The checkout charge always lands in the Island Tours Stripe/Mollie account.** Island Tours is **merchant of record** for every on-platform charge; **no per-operator connected account in v1.**
- **Two counter-party settlement rails are OPEN in the master** (conflict log C23) and must not be invented in code: (a) operator payout on `paid_in_full`, (b) commission collection on `operator_full`. **Stripe Connect is the named phase-2 candidate** (B.85). *(Now partially closed by the 2026-07-15 locked decision — see §C.8.)*

#### C.3.2 The 25-step end-to-end flow (guide §4)

1. Traveler opens the tour detail page.
2. Frontend reads availability from the availability API (projecting live status from `departures`).
3. Traveler selects date, start time, party, add-ons, pickup, contact details, notes, optional promo/attribution.
4. Frontend submits **`POST /api/v1/bookings`**.
5. Backend loads tour, selected departure, age bands, add-ons, pickup, effective commission.
6. Backend **validates**: tour exists · departure exists and belongs to the tour · **booking cutoff has not passed** · party size within min/max · age restrictions met · selected age bands belong to the tour · add-ons active and belong to the tour · pickup location belongs to the tour.
7. Backend **computes**: unit-item totals · add-on totals · total retail · deposit amount · balance amount · commission rate · EUR-normalized commission when possible.
8. Backend starts a **DB transaction**.
9. Backend **claims seats with a single guarded update** on `departures`.
10. **If the update affects zero rows → the booking fails with an availability error.**
11. Backend creates: `Booking`, **one `BookingUnitItem` per traveler**, `BookingAddOn` snapshots.
12. If `paymentModel = OPERATOR_FULL` → created **`CONFIRMED`**, no payment intent, confirmation finalization runs. *(v2.)*
13. For charge models → created **`ON_HOLD` with `utcExpiresAt`**.
14. Frontend requests **`POST /api/v1/payments/bookings/:id/intent`**.
15. Payment service creates or reuses a provider intent **idempotently**.
16. Traveler pays through Stripe/Mollie.
17. Provider **webhook arrives**.
18. Webhook **verifies the signature** and **records the provider event idempotently**.
19. On success, the payment row → **`SUCCEEDED`**.
20. Booking transitions **`ON_HOLD → CONFIRMED`**.
21. **Billing/card snapshot** written from the provider payment method.
22. **Confirmation finalization runs once:** EUR commission backfilled if needed · **`conversionFiredAt` stamped** · confirmation email sent · *"Add invoice as attatchments (INVOICE RECIVE FROM STRIPE/MOLLIE)"* [sic — the doc's own spelling] · server-side conversion side effects run.
23. Traveler is redirected/rendered to the **TYP**.
24. TYP returns the conversion payload **only** for confirmed bookings with a valid EUR commission.
25. Browser fires **exactly one `booking_complete`**.

- Guide §5 contains a mermaid flowchart mirroring the above; the widget return path **`C1` = "Return to widget, keep date, choose another slot"** on both cutoff/capacity failure and a failed claim.
- **Built money-flow spine (as committed):**
  ```
  reserve (ON_HOLD) -> PATCH contact -> payment intent (automatic_payment_methods)
    -> custom Stripe card / PayPal + iDEAL redirect -> /payment/processing poller
    -> webhook confirm -> CONFIRMED + EUR conversion stamp -> TYP
  ```

#### C.3.3 Reserve logic order (guide §20.8)

1. Load tour.
2. `sourceCurrency = tour.defaultCurrency`.
3. `bookingCurrency = dto.currency ?? sourceCurrency`.
4. If `quoteId` present: load the quote and verify **not expired** and **same tour / departure / items / add-ons / pickup / coupon / currency**; else **recompute the quote server-side**.
5. Write the booking with **all currency / source / fx / commission fields**.
6. Create `BookingUnitItem.priceRetail` **in booking currency**; optionally add source per-ticket audit fields.

#### C.3.4 Booking state machine (guide §6)

```
[*] --> ON_HOLD    : charge models reserve seats
[*] --> CONFIRMED  : OPERATOR_FULL
ON_HOLD --> CONFIRMED : payment succeeds / confirm
ON_HOLD --> EXPIRED   : hold expires
ON_HOLD --> CANCELLED : cancel before payment
CONFIRMED --> CANCELLED : admin/customer/operator cancellation
CONFIRMED --> REDEEMED  : tour redeemed
EXPIRED/CANCELLED/REDEEMED --> [*]
```

- **`ON_HOLD` and `CONFIRMED` hold seats.**
- **`EXPIRED` and `CANCELLED` release seats.**
- **`REDEEMED` is terminal** for normal customer cancellation.
- **`PENDING` / `REJECTED` exist in the enum for compatibility** but the instant-booking path **must not depend on an enquiry-style pending-approval flow**.
- Full enum on `Booking.status`: `ON_HOLD` / `CONFIRMED` / `CANCELLED` / `REDEEMED` / `EXPIRED` / `PENDING` / `REJECTED`.
- ⚠️ **CONFLICT (naming):** master E.8 / BOOKING-AND-PAYMENTS.md describe the states as **`pending_payment → confirmed → cancelled → …`** (with further states such as **forfeited** and **operator-cancelled** following the same admin-confirmed pattern), while the code/guide state machine uses **`ON_HOLD`** for the pre-payment state and has no `forfeited` state. Both are transcribed as written.
- Lifecycle diagram from BOOKING-AND-PAYMENT-DATA.md:
  ```
  ON_HOLD (utcExpiresAt, capacity claimed) ──confirm──> CONFIRMED ──> REDEEMED
     │ expire / cancel                        │ admin-confirmed request
     ▼                                        ▼
  EXPIRED / CANCELLED (release capacity)   CANCELLED (full refund if before deadline)

  operator_full: created CONFIRMED at commit (no charge, no webhook, no ON_HOLD).
  ```

#### C.3.5 Departure state machine (guide §7)

- `OPEN → SOLD_OUT` — a booking fills capacity.
- `SOLD_OUT → OPEN` — cancellation/expiry frees seats.
- `OPEN → CLOSED` — close date/slot or an admin stop-sell.
- `CLOSED → OPEN` — explicit reopen / materialization rule.
- `OPEN | CLOSED | SOLD_OUT → CANCELLED` — admin/operator cancellation.
- **Rules:** `OPEN <-> SOLD_OUT` is **fill-derived** · `CLOSED` / `CANCELLED` are **sticky operational states** · **cutoff-passed status is computed live and must NOT be persisted as `CLOSED`**.
- Seat release **recomputes departure status** (`SOLD_OUT → OPEN` when seats free) — `releaseSeats` / `recomputeStoredStatus`.

#### C.3.6 The atomic guarded capacity claim (guide §8)

```sql
UPDATE departures
   SET booked_count = booked_count + :seats,
       status = CASE WHEN booked_count + :seats >= capacity THEN 'sold_out' ELSE status END,
       sold_out_at = CASE WHEN booked_count + :seats >= capacity AND sold_out_at IS NULL THEN now() ELSE sold_out_at END,
       updated_at = now()
 WHERE id = :departure_id
   AND tour_id = :tour_id
   AND status = 'open'
   AND booked_count + :seats <= capacity;
```

- **If affected rows = 0 the booking MUST fail**; the frontend returns the traveler to date/time selection **with the chosen date preserved**.
- **"Never split capacity check and increment into separate queries."**
- This single conditional `UPDATE` **is** the concurrency control: PostgreSQL takes a **row-level lock**, so when two travelers race for the last seats **exactly one wins** — atomically, at the database, with **no extra infrastructure**.
- **Booking + unit items + add-on snapshots are created in the same transaction** as the claim.
- **Whole-unit / private-charter exclusive claim (2026-07-16):** a `UNIT` + `PRIVATE` reserve runs an **exclusive claim** — `booked_count = capacity`, status `sold_out`, **guarded by `status = open AND booked_count = 0`**; `Booking.exclusiveDeparture` drives **whole-departure release** on cancel/expiry.
- **⚠️ Bug fixed — reserve 500 from snake_case raw SQL:** the atomic seat-claim `$executeRaw` (and `releaseSeats`) referenced `tour_id` / `booked_count` / `sold_out_at` / `updated_at`, but this schema has **no `@map`**, so the real columns are camelCase (`"tourId"` / `"bookedCount"` / `"soldOutAt"` / `"updatedAt"`) → Postgres `42703` → **500 on every reserve**. Unit tests mocked `$executeRaw`, so it never surfaced. Refactored the 4 raw blocks (2 reserve claim + 2 `releaseSeats`) to type-safe Prisma `updateMany` / `update` + `recomputeStoredStatus` (atomic guard via a pre-computed `capacity - seats` threshold from an in-transaction capacity read; `GREATEST(0, …)` clamp via read-modify-write). `$executeRaw` is now gone from the service code entirely.

#### C.3.7 Hold expiry (guide §11)

- **Charge-model bookings in `ON_HOLD` must have `utcExpiresAt`.**
- **Sweeper steps:** (1) find `ON_HOLD` where `utcExpiresAt < now`; (2) **release seats**; (3) mark unit items `EXPIRED`; (4) mark the booking `EXPIRED`; (5) emit availability/booking notifications.
- **Expiry must be idempotent.**
- Intended mechanism: a **BullMQ delayed/repeatable sweeper** (`booking.hold-expiry-sweep`, **run-window guarded**).
- ⚠️ **CRITICAL FLAW (open):** *"Hold-expiry sweeper not scheduled."* `expireStaleHolds()` exists but **no cron/queue calls it**, so **expired holds keep seats and cause phantom sold-outs**. `Code: bookings.service.ts:expireStaleHolds` (unwired).
- ⚠️ **Open edge:** **payment succeeds after the hold has expired** — `confirmFromPayment` only confirms when `ON_HOLD`; *"an expired booking whose payment later settles must be voided/refunded"* — **no refund/void branch exists.** Guidance: reconcile carefully; prefer preventing confirmation of expired bookings and refunding/voiding if necessary; the consumer must re-validate state.

#### C.3.8 API surface (guide §16 / §14)

| Method | Route (base `/api/v1`) | Purpose |
|---|---|---|
| `POST` | `/bookings` | Reserve / claim seats; `OPERATOR_FULL` confirms immediately |
| `POST` | `/bookings/quote` | Server-authoritative quote (`@Public()`, static route before `:id`) |
| `POST` | `/bookings/:id/confirm` | Confirm a held booking in the adapter/manual flow |
| `POST` | `/bookings/:id/cancel` | Cancel and release seats |
| `POST` | `/bookings/:id/extend` | Extend `ON_HOLD` expiry |
| `PATCH` | `/bookings/:id` | Update contact / notes / pickup on an active booking |
| `GET` | `/bookings/typ/:publicRef` | Public TYP lookup |
| `GET` | `/bookings/typ/:publicRef/calendar.ics` | ICS calendar file (RFC 5545, real UTC), CONFIRMED only |
| `POST` | `/bookings/typ/:publicRef/resend` | Resend confirmation email (hard-throttled) |
| `POST` | `/bookings/typ/:publicRef/cancellation-request` | Tokenized cancellation request |
| `GET` | `/bookings` | Auth-scoped list |
| `GET` | `/bookings/:id` | Auth-scoped detail |
| `POST` | `/payments/bookings/:id/intent` | Create/reuse a payment intent |
| `POST` | `/payments/typ/:publicRef/settle` | Synchronous settle-on-return (re-reads the intent from Stripe) |
| `GET` | `/payments` | Payments list (`VIEW_PAYMENTS`, operator-scoped) |
| `POST` | `/payments/webhook` | Stripe webhook |
| `POST` | `/payments/webhook/mollie` | Mollie webhook |

- **Access rules:** booking creation is **public guest checkout** · TYP lookup is **public because `publicRef` is unguessable** · account/admin/operator listing + detail reads are **auth-scoped** · **webhooks bypass auth and throttling but verify provider authenticity**.
- **No raw Prisma rows are returned** from booking APIs; **status, commission, and tier rank are never client-settable**.
- RBAC permissions: `VIEW_BOOKINGS` / `MANAGE_BOOKINGS` / `EDIT_BOOKING`, `VIEW_PAYMENTS` / `MANAGE_PAYMENTS`. Guard order unchanged.

#### C.3.9 Write ownership

- **Customer (checkout):** party (`BookingUnitItem` + `travelerAge`), `contact*`, `notes`, `pickupLocationId`, add-on selections, `couponCode`, `newsletterOptIn`, payment method.
- **System / webhook:** all refs, status transitions, commission/EUR snapshot, `paymentModel`, billing snapshot, `conversionFiredAt`, capacity claim, `Payment` rows, ticket artifacts.
- **Admin:** cancellation confirmation (sets `CANCELLED`, refund), deposit-forfeit confirmation, force-majeure full refund/reschedule.
- **Operator:** reports non-payment (admin confirms); operator-forced cancellation.
- **Security invariants:** `publicRef` must be **UUID / non-enumerable** · `displayRef` alone is **insufficient for account access — pair it with the booking email** · webhooks must verify signatures · **the frontend must never set roles, commission, tier rank, booking status, or payment status** · **never expose raw Prisma rows** from booking APIs.

#### C.3.10 Snapshot-immutability edge cases (guide §17)

- Later **tour tier changes** do not affect existing bookings.
- Later **tour price edits** do not.
- Later **age-band edits** do not affect existing `BookingUnitItem` prices.
- Later **add-on edits/deletes** do not affect existing `BookingAddOn` rows.
- Later **pickup edits** do not affect the `pickupAddress` snapshot.
- `BookingAddOn` is **fully snapshotted** (`addOnId` soft ref, `name`, `unit`, `quantity`, `unitPrice`, `totalPrice`) so a later `TourAddOn` edit/delete **never mutates a placed booking**. Paid pickup (`PAID_ADDON`) charges through here. **Spectators are NOT add-ons** — they are unit items.

---

### C.4 The four payment models

> ⚠️ **Read §C.0's flag first: `operator_full` is DROPPED FROM v1** by the founder decision of 2026-07-15. Everything below about `operator_full` is v2 scope.

#### C.4.1 Operational shape (guide §2.1 / BOOKING-AND-PAYMENTS §1)

| Model | Charged at checkout | Balance handling | Payment rail | Created status |
|---|---|---|---|---|
| **`OPERATOR_LINK`** (the **default**) | `depositPct`% deposit | Operator emails a **secure balance link**; balance paid **online before the deadline** | Stripe/Mollie | `ON_HOLD` → `CONFIRMED` after payment |
| **`ON_ARRIVAL`** | `depositPct`% deposit | Balance paid **in person on arrival** (card or cash, or cash only, per tour) | Stripe/Mollie | `ON_HOLD` → `CONFIRMED` after payment |
| **`PAID_IN_FULL`** | **100%** | Nothing later — fully paid via Island Tours at booking | Stripe/Mollie | `ON_HOLD` → `CONFIRMED` after payment |
| **`OPERATOR_FULL`** | **0 / nothing** | Operator collects the **full amount** directly | **none** — bypasses the Stripe charge and webhook entirely | **`CONFIRMED` at commit** |

- A tour **declares one payment model**; it is **snapshotted onto the booking as `payment_model` at creation** and **never changes retroactively** (master §1.4, confirmed June 10, 2026).
- **Implementation warning (the doc's own):** *"if code treats `ON_ARRIVAL` as no upfront charge, that conflicts with the master. `ON_ARRIVAL` is a deposit model."*
- **`deposit_pct` is tier-driven**: **20 to 30 in 2.5 steps** → allowed values **20, 22.5, 25, 27.5, 30** (LD24). Tier and commission are snapshotted onto the booking alongside `payment_model`.
- **Superseded rule:** LD24's *"balance online, never cash on tour day"* describes only the `operator_link` default and is **superseded as a platform-wide rule** by the four-model set (B.29, C8).

#### C.4.2 Deposit / balance formulas (guide §9)

```
OPERATOR_LINK: deposit = total * depositPct; balance = total - deposit
ON_ARRIVAL:    deposit = total * depositPct; balance = total - deposit
PAID_IN_FULL:  deposit/payToday = total;     balance = 0
OPERATOR_FULL: deposit/payToday = 0;         balance = total
```

- **Retail total** = `sum(age band price * quantity) + sum(add-on line totals) - discount`.
- **Add-on line totals:** `PER_PERSON` → `unitPrice * addOnQuantity * partySize`; `FLAT` → `unitPrice * addOnQuantity`.
- Fix required (guide §20.6): **`ON_ARRIVAL` must fall through with `OPERATOR_LINK` to the deposit branch**; `OPERATOR_FULL` returns `{ depositAmount: 0, balanceAmount: totalRetail }`.
- Fix required (guide §20.7) for `chargeFor()`: `OPERATOR_LINK` / `ON_ARRIVAL` → `{amount: deposit, kind: DEPOSIT}`; `PAID_IN_FULL` → `{amount: total, kind: FULL}`; `OPERATOR_FULL` → `null`. **Stripe/Mollie currency must use `Booking.currency`, NOT `Tour.defaultCurrency`.**

#### C.4.3 Who receives the money — per leg (guide §2.2)

Every booking splits into at most two legs: the **checkout leg** (Island Tours' Stripe/Mollie at booking) and the **remainder leg** (operator, off-platform).

| `payment_model` | Checkout leg | Recipient | Remainder leg | Recipient |
|---|---|---|---|---|
| `OPERATOR_LINK` | `deposit` via Stripe/Mollie | **Island Tours** | `total - deposit` | **Operator** — own secure payment link, paid online before the deadline |
| `ON_ARRIVAL` | `deposit` via Stripe/Mollie | **Island Tours** | `total - deposit` | **Operator** — in person on arrival (card or cash, per tour) |
| `PAID_IN_FULL` | `total` via Stripe/Mollie | **Island Tours** | none | none |
| `OPERATOR_FULL` | **none** (no charge, no webhook) | none | `total` | **Operator** — collected directly |

Canonical basis: master §1.4, §5.8 / conflict log C22, BOOKING-AND-PAYMENTS.md §1.

#### C.4.4 Settlement per model — the original OPEN-rail table (guide §2.3)

| `payment_model` | Island Tours ends with | Operator ends with | Settlement rail | Status |
|---|---|---|---|---|
| `OPERATOR_LINK` | Retains `deposit` | Collects balance directly | **No cross-transfer** | **Resolved** (master §1.4) |
| `ON_ARRIVAL` | Retains `deposit` | Collects balance directly | **No cross-transfer** | **Resolved** (master §1.4) |
| `PAID_IN_FULL` | Holds 100%; keeps commission | Owed `total - commission` | Island Tours must pay the operator out | **OPEN** — payout rail unresolved; Stripe Connect split is the phase-2 candidate (B.85, C23) |
| `OPERATOR_FULL` | Holds nothing; still owed `commission` | Holds 100% | Island Tours must collect commission from the operator | **OPEN** — commission settlement rail unresolved (C23) |

- **Deposit-vs-commission note:** `depositPct` (20–30, 2.5 steps) and `commissionTier` (20–35) are both tier-driven but **separate fields**. On deposit models the retained deposit is only an **approximation** of the commission owed; the master defines **no automated true-up in v1** → manual/off-platform reconciliation. **"Do not assume `deposit == commission` in code."**
- **"Do not invent the OPEN rails."** For `PAID_IN_FULL` / `OPERATOR_FULL`, v1 has no automated payout/collection. **Model entitlement in data, leave transfer to a manual admin process** until the Stripe Connect phase-2 decision lands. **Never auto-transfer funds without a signed-off rail.**
- ⚠️ **CONFLICT / SUPERSESSION:** the 2026-07-15 locked decision (§C.8) **partly closes these rails** — it locks `deposit_pct == commission` for the deposit models (making them explicitly self-settling) and locks a **scheduled payout after the cancellation window** for `paid_in_full`, while **removing `operator_full` from v1 entirely.** ⚠️ It also **directly contradicts the "do not assume `deposit == commission`" instruction above**; both are transcribed as written.

#### C.4.5 Off-platform legs are NOT machine-readable in v1 (guide §2.4)

- Operator-collected balance (`OPERATOR_LINK`, `ON_ARRIVAL`) and the full `OPERATOR_FULL` amount run on **operator rails**; the platform **cannot verify them** (B.85).
- **"Do not create a `BALANCE` payment row in v1"** — even though the `Payment.kind` enum has one.
- **No automatic "balance overdue" state and no automatic forfeit state.** Operator non-payment is **operator-reported then admin-confirmed** (master §15); only that confirmation forfeits a deposit and releases the spot.
- The v1 platform ledger **reconciles only on-platform legs**. The two OPEN rails each need their own ledger entries once chosen; **Stripe Connect (phase 2) would make the operator balance/payouts machine-readable.**
- **B.85 hard rule:** *"All paid" rendering on `operator_link` surfaces is **forbidden***; the platform cannot verify the operator's own rails, so any such surface uses a **neutral balance line**. The all-paid line is **`paid_in_full` only**.

#### C.4.6 Two-phase operator visibility — the C2 anti-phishing mitigation

- **Pre-payment — agentless.** The widget and all modals are **operator-agnostic**: *"You'll get a secure link to pay the rest."* The operator is **never named or spotlighted before payment** (disintermediation control).
- **Post-booking — operator named, deliberately.** On `operator_link` tours the **Thank You page and confirmation email name the operator** and state the operator will send the balance link, so that follow-up email is **expected and never mistaken for phishing**.
- Slogan / invariant: **"Pre-payment agentless, post-booking named."**
- This is why `operator_link` confirmation emails **foreshadow the operator by name** — confirmation email **block 5, mandatory on `operator_link`**.

#### C.4.7 `operator_full` — the one model that touches no payment rail (v2 summary)

- **No charge at checkout, no Stripe webhook.**
- Booking **created `confirmed` at commit** — no `pending_payment` / `ON_HOLD` state.
- Widget CTA is the bare **"Reserve my spot"**; zero-amount money rows hidden.
- Checkout has **no Payment section and no Stripe Elements**; **`/payment/processing` is skipped**; redirect **straight to the TYP** (B.79, C22).
- **`payment_method_last4` and the Stripe billing fields stay null** (B.79).
- Checkout trust: **free-cancellation line only, no Stripe badge** (B.89) — *"the Stripe badge drops where Stripe processes nothing."*
- Cancellation confirmation carries **no refund line** (*"Nothing was paid to Island Tours …"*).
- **Conversion fires at commit rather than on a webhook**, with an **identical data contract** (master §8.2, B.79).
- **TYP `operator_full` copy locked (B.90):** card = *"Island Tours took no payment today. Total {total}, settled directly with {operatorName}."*; step 2 = *"{operatorName} collects the full amount directly and will confirm how and when."*
- `original_currency` on an `operator_full` booking (where nothing is charged) is the **session display-currency snapshot** (C22).

---

### C.5 Payments: Stripe, methods, webhooks, refunds, settings

#### C.5.1 Payment flow per model (guide §10)

- **Charge models (`OPERATOR_LINK`, `ON_ARRIVAL`, `PAID_IN_FULL`):** booking created `ON_HOLD` → **seats already claimed** → **payment intent created idempotently per `(bookingId, kind)`** → provider confirms **asynchronously via webhook** → the webhook updates the payment row → the webhook confirms the booking.
- **`OPERATOR_FULL`:** booking created `CONFIRMED` → **no payment intent** → **no provider webhook expected** → confirmation finalization runs immediately → TYP available immediately. **Never create a provider payment intent for `OPERATOR_FULL`.** *(v2.)*

#### C.5.2 PaymentIntent creation

- **`POST /api/v1/payments/bookings/:id/intent`** creates or reuses a provider intent.
- **Idempotent per `(bookingId, kind)`** — Stripe idempotency key + a **deterministic `Payment` row id**. A retried intent creation **returns the same provider intent**.
- **Charge currency = `Booking.currency`**, never `Tour.defaultCurrency`.
- **⚠️ Bug fixed — PaymentIntent currency/method 500 (Klarna-on-EUR):** forcing the configured method list on the intent hit *"currency invalid for payment method type klarna"* (USD-only). Switched `createIntentForBooking` to Stripe **`automatic_payment_methods`** (account-activated **and** currency-compatible methods only) and to **return `payment_method_types`** so the checkout gates the methods it renders.

#### C.5.3 Payment method eligibility gating

- **Launch method set: card / PayPal / iDEAL.**
- **Card** is **custom / inline** — styled **Stripe Card Elements**, **no raw card fields** and no Stripe-hosted UI.
- **PayPal and iDEAL are redirect** methods.
- Eligibility is gated via **`automatic_payment_methods` + the returned `payment_method_types`**.
- **Mollie is deferred** at the frontend; the backend Mollie confirm path stays block-commented.
- Design source (LD26): **payment methods as an equal radio list, card default expanded; wallets device-conditional** (a reversal from express buttons). Figma offers **Card / PayPal / Apple Pay / Google Pay** → hence the `Payment.methodType` gap.
- **No payment section on `operator_full`** (conflict log 79, C22).

#### C.5.4 The `Payment` ledger

- Fields: `id` / `bookingId` · `provider` (**`STRIPE` / `MOLLIE`**) · `kind` (**`DEPOSIT` / `BALANCE` / `FULL` / `REFUND`**) · `status` (**`REQUIRES_PAYMENT` / `PROCESSING` / `SUCCEEDED` / `FAILED` / `REFUNDED` / `PARTIALLY_REFUNDED` / `CANCELLED`**) · `amount` / `currency` · `intentId` / `chargeId` / `refundId` · `raw` `Json?` (provider payload snapshot).
- **`+ TO ADD`: `methodType` `string?`** — Figma offers 4 payment methods.
- **v1 rule: no `BALANCE` rows for `OPERATOR_LINK`** — the balance is the operator's transaction and is untracked.
- Each checkout charge writes a `Payment` ledger row (`DEPOSIT` or `FULL`), a provider PaymentIntent/charge, and an **idempotent row in `stripe_webhook_events`**. **Refunds write `REFUND` rows.**

#### C.5.5 Webhooks — signature verification and idempotency

- Webhook endpoints are **`@Public()` + `@SkipThrottle()`** — they bypass `AuthGuard` and `ThrottlerGuard` (CLAUDE.md rule #15).
- **Stripe signature verified against the RAW body** (`main.ts` `rawBody`).
- **The provider event id is recorded in `stripe_webhook_events` BEFORE processing** — the redelivery guard. **Webhook retries are safe.**
- `StripeWebhookEvent` shape: `id`, `type`, `processedAt`, `payload`.
- A parallel **`mollie_webhook_events`** table exists (`+ TO ADD if Mollie is live`: a `MollieWebhookEvent`, or generalize to `ProviderWebhookEvent` with a `provider` column).
- **On a successful intent:** `Payment` → `SUCCEEDED` · booking `ON_HOLD → CONFIRMED` · **billing/card snapshot written from the provider payment method** (`payments.service.ts:onIntentSucceeded`, `bookings.service.ts:confirmFromPayment`).
- **Webhook events handled (named in the docs):** `payment_intent` **succeeded** (the confirm path, `onIntentSucceeded`); **payment failed** → the booking **stays `ON_HOLD`** until retry or expiry; **redelivery** → skipped via the event ledger. The Mollie webhook currently only records the event.
- ⚠️ **Mollie webhook is a stub** (`[~]`, flaw 7): *"It records the event but never confirms the booking; Mollie-paid bookings never reach CONFIRMED."* `Code: payments.service.ts:handleMollieWebhook`.
- **⚠️ Bug fixed — card brand/last4 null on every paid booking:** `expandedCharge(intent)` only read an *already-expanded* charge, but **Stripe webhooks never expand nested objects** — a succeeded `payment_intent` carries `latest_charge` as a plain **string id**, and the legacy `intent.charges.data[0]` list no longer exists on current API versions. It returned `undefined` → `billing` was `undefined` → `confirmFromPayment` wrote null brand/last4 on **every** booking, and the TYP card line was always blank. Fixed with `StripeService.retrieveCharge()` + `PaymentsService.resolveCharge()`, which fetch the charge when `latest_charge` is a string (**best-effort: a failed lookup logs and still confirms** — the snapshot must never block a confirmation). The old spec had **baked the bug in** (`confirmFromPayment('b1', undefined)` was the asserted expectation); replaced with 3 real regression tests. **Existing bookings keep their null snapshot** — the fix applies only to new webhook deliveries.

#### C.5.6 Billing snapshot from the payment method

- `billing_country` `char(2)`, `billing_postal_code` `varchar`, `billing_city` `varchar` — **pulled automatically from the Stripe `payment_method` during webhook handling**, with **no extra booking-form friction**.
- **Hashed into Enhanced Conversions / Advanced Matching.**
- **Null on `operator_full`** (and, per BOOKING-AND-PAYMENT-DATA, on `ON_ARRIVAL`).
- `payment_method_last4` + `brand` — from the Stripe payment method, for the TYP payment row; **null on `operator_full`**.

#### C.5.7 Refunds

- Refunds write **`REFUND` `Payment` rows**.
- ⚠️ **NOT IMPLEMENTED (open):** *"Actual Stripe REFUND execution + `REFUND` Payment row on cancellation (compute + issue refund, not just categorize)"* — **the refund is a category only** today. `computeRefund` returns only a **FULL / NONE** verdict: *"no deposit-only vs full-amount computation per model, no partial."*
- The dashboard **Cancellation Requests** queue lets an admin mark a booking cancelled, but **real refund money movement is deferred to CP6**.

#### C.5.8 Encrypted settings fields / provider configuration

- Operator-side provider configuration models exist: **`OperatorStripeConfig`** and **`OperatorMollieConfig`** (`operators.prisma`), alongside `OperatorCompanyInfo` / `OperatorSocialMedia`.
- **`GET /settings/public/site`** (`@Public`) returns a **hand-picked 8-field projection via an explicit `select:`**. **The same controller also serves Stripe/Mollie settings, so this endpoint must NEVER be widened to the row.** It is read-only (`findFirst`, not `upsert`). `whatsappNumber` is nulled when `enableWhatsappChat` is false.
- **SMTP settings were removed entirely** (2026-07-19): the `/settings/smtp` API and the `smtp_configuration` table were **dropped**; mail is now **env-configured only** (`RESEND_API_KEY` + `MAIL_FROM`).
- **Merchant of record:** the checkout charge **always lands in the Island Tours Stripe/Mollie account**; there is **no per-operator connected account in v1**. Connect routing is v2.

#### C.5.9 Payment edge cases (guide §17)

- **Payment intent creation retried** → return the same provider intent by idempotency key.
- **Webhook redelivered** → skip via the provider event ledger.
- **Payment succeeds after the hold technically expired** → reconcile carefully; **prefer preventing confirmation of expired bookings and refunding/voiding if necessary**. ⚠️ Not handled.
- **Payment fails** → keep the booking `ON_HOLD` until retry or expiry.
- **`OPERATOR_FULL`** → never create a provider payment intent.

---

### C.6 Commission: snapshot, EUR conversion, and the conversion-value rules

#### C.6.1 The snapshot rule

- **`commission_rate` and `commission_amount` snapshot onto every booking at creation and never change retroactively** (master §7.1).
- A later **tier change, demotion, or rate edit does NOT touch existing bookings**. Demotion only changes future bookings' rate and the tour's `tier_rank`.
- **`commission_rate`** `decimal(5,4)` — e.g. `0.20` for 20% (`0.2750` = 27.5%); snapshot at booking time.
- **`commission_amount`** `decimal(10,2)` — **in EUR**; the conversion value for every analytics platform.
- **Formulas:** `commissionRate = effectiveCommissionPercent / 100`; **`commissionAmount = totalEur * commissionRate`**. Once written, **never changes**.
- **The effective commission may be the active Destination Spotlight rate.** Resolved in **both quote and reserve** via `TiersService.effectiveCommissionRate(tourId, now)`:
  ```
  effectiveCommissionRate(tourId, at):
    if hasActiveSpotlight(tourId, at) -> 0.35   (SPOTLIGHT_COMMISSION_RATE)
    else                              -> tour.commissionTier / 100
  ```
- Evaluated at booking-time `now`, snapshotted, **never retroactive** — a later spotlight activation/expiry does not change an existing booking.
- **The quote shows the spotlight-effective rate** (matching what reserve will charge). If a spotlight flips between quote and reserve, **the reserve snapshot is authoritative**.
- **Payment never recomputes commission**; `finalizeConfirmation` only **EUR-normalizes the already-snapshotted value** using the snapshot's `fxRateToEur` (**no refetch**).
- Tier table driving the rate: `premium` **30%** (rank 1) · `featured` **27.5%** (2) · `boosted` **25%** (3) · `organic` **22.5%** (4) · `standard` **20%** (5, default) · **Destination Spotlight 35%** (separate block, not a rank).
- **Tier mechanics are internal commercial logic, never user-facing** — travelers never see "tier", commission, or `tier_rank`. In the dashboard, **commission columns are ADMIN-only** (rule #22).

#### C.6.2 EUR conversion

- **EUR tour:** `fxRateToEur = 1`, `totalEur = totalRetail`, `commissionAmount = totalRetail * commissionRate`.
- **USD tour (USD/EUR flow):** operator enters USD → booking snapshots `currency = USD` → totals / deposit / balance / unit-item / add-on prices stored in USD → the Stripe/Mollie charge is created in USD → **at confirmation the backend uses the FX rate snapshotted from the provider-backed quote** → stores `totalEur = totalRetail * fxRateToEur` → stores `commissionAmount = totalEur * commissionRate` → **the TYP and email display USD while `booking_complete` sends the EUR commission**.
- **The FX rate is snapshotted so historical commission/conversion never drift.**
- Current implementation: the pricing utility can compute the EUR commission **immediately for EUR bookings**; for **USD bookings, confirmation finalization backfills** `fxRateToEur`, `totalEur`, and `commissionAmount` **before the conversion fires**.
- **Multi-currency safe:** commission is computed on the **EUR value** of the booking total, so a USD- or EUR-charged spotlight tour still yields a correct EUR commission at **35%**.
- **Edge case:** a USD booking **must be normalized to EUR before the conversion fires**.

#### C.6.3 The conversion-value rule (master §8.1 item 1, §8.3, CLAUDE.md rule #22)

- **Conversion value = `commission_amount`, in EUR — NEVER GMV.** Smart Bidding learns from real margin.
- `booking_complete.booking_value` ← `bookings.commission_amount` — **EUR always; never `booking_total_eur`, never `totalRetail`, never `totalEur`, never GMV.**
- `booking_complete.booking_currency` ← **hardcoded `'EUR'`** — the tracking currency is always EUR; the customer UI shows `original_currency`.
- Exactly **one** `booking_complete` fires per booking, **regardless of payment model**. `OPERATOR_FULL` fires **at commit** (no webhook) with an **identical data contract**.
- **Settlement must never be conflated with tracking:** the settlements ledger is the **money-movement record**; the conversion event is the **marketing-value record**.

#### C.6.4 The null-commission = data corruption rule

- **A confirmed booking with a null `commission_amount` is DATA CORRUPTION** (master §8.3, guide §2.4/§12/§17, EVENT-DRIVEN §5.5, CLAUDE.md rule #22).
- Required behavior: **render an error and fire NO conversion.** Never silently fall back.
- The TYP conversion object is allowed **only** when: **status is `CONFIRMED`** AND **`commissionAmount` is non-null** AND **the value is EUR**.
- The conversion job must **fail loudly, not fire**.
- The same **no-silent-fallback** rule covers a **missing cancellation window** and an **operator with neither contact field** (E.6).
- Every booking snapshots `commissionRate`, `commissionAmount` (EUR), and `fxRateToEur`.

#### C.6.5 Conversion idempotency (mark-first)

- **`conversion_fired_at`** `timestamptz NULL` — the **mark-first idempotency guard, set server-side BEFORE the conversion payload is exposed/rendered** (master §8.2).
- **Idempotency belongs in the DATABASE, never localStorage** (master §8.1 item 5).
- **TYP refresh, email revisits, and shared links must never double-fire.** A client push that never executes is an **accepted false negative, never a double fire**.
- ⚠️ **FIRE-POINT RECONCILIATION (open, double-fire risk):** the code sets `conversion_fired_at` and fires the conversion at **webhook-confirm** (server, `finalizeConfirmation`), *before any TYP visit*. The master fires at **TYP render** (mark-first) via the **browser push**. These are **incompatible as-is**: a browser push gated on `conversion_fired_at` would **never fire** (already set at confirm), and `getThankYou` currently returns the `conversion` payload on **every** visit with no once-guard → the client pixel would **double-fire** (violating §8.1 item 5). **Documented fix:** keep the server CAPI at confirm and add a **separate `conversion_pushed_at` guard** (new migration) so the TYP push fires exactly once, independent of `conversion_fired_at`.
- The `ON_HOLD → CONFIRMED` transition and the `conversionFiredAt` mark are now **atomic guarded `updateMany`s** so exactly one caller (webhook vs settle-on-return) emits emails and fires the conversion.

#### C.6.6 Affiliate commission (funded out of commission)

- **Rate: 8% of GMV** (total tour price), **funded entirely out of Island Tours' commission take — not added on top.**
- Worked example: a **$240** booking at the **25%** tier yields **$60** commission; the affiliate earns **$19.20**; Island Tours nets **$40.80**.
- **Lifecycle:** the commission goes **on hold at booking** and **approves after the cancellation window closes** (clawback-safe), mapped to the per-tour cancellation window.
- **Attribution rides the platform's own `booking_complete` event**; **promo codes double as attribution identifiers** in the booking widget.
- Platform: **Trackdesk (primary)**; Tapfiliate = mature alternative; FirstPromoter = middle option. **Stripe-native tools (PromoteKit, Rewardful, Tolt) are structurally incompatible** — they calculate off the ~20% Stripe charge, not the full tour price. **Payouts in USD and EUR.**

---

### C.7 Cancellation

#### C.7.1 The unified window (master §6.2, confirmed June 10, 2026)

- **ONE per-tour window governs BOTH the balance deadline AND free cancellation.**
- Field: **`tour.cancellation_hours`** — **enum `[24, 48, 72, 168]`, default `48`**.
- **CMS-enforced NOT NULL and enum-bound**; values outside the enum are blocked. **Validated at operator onboarding.**
- **Free cancellation is a listing requirement (locked June 10, 2026):** every published tour carries a window from the LD1 enum. This grounds every "free cancellation on every tour" claim (§3.11, §5.1) and the filter-modal subtext (B.76).
- **`free_cancellation` boolean is redundant by rule** — always `true`, derivable from `cancellation_hours`; **drop it at the C5 migration**.
- **Canonical field name is `cancellation_hours`**, superseding `cancellation_window_hours` with its 24-or-48 framing (B.11, C5). **The same migration adds the `payment_model` snapshot column to `bookings`.**
- ⚠️ Known code mismatch (BOOKING-AND-PAYMENTS.md): `cancellationHours` **currently defaults to 24** — must become the **enum default 48**.
- This unified window **supersedes the earlier split model** (balance at 72h, cancellation at 48h) — B.30, C4.

#### C.7.2 Deadline computation — computed, never stored

- **Formula: `cancelDeadline = tour start − cancellation_hours`.**
- Computed in **tour-local time**, displayed with **"(local time)"**. Deadlines render in the tour-local timezone per E.1 (`Destination.timezone`, an IANA string, **drives every "(local time)" computation**).
- **The deadline is computed, never stored on the booking** (Appendix E.8). **Do NOT add a column.**
- Implemented: *"Deadline computed = tour start - `cancellationHours`, never stored"* — verified live (start `2026-07-24T13:30` − 48h = `2026-07-22T13:30`).

#### C.7.3 The five render locations (from ONE backend lookup per page)

1. **Trust-strip line 1** (widget).
2. **Cancellation Policy paragraph 1.**
3. **Cancellation Policy paragraph 2.**
4. **The mobile sticky bar.**
5. **The confirmation email.**

- Plus Schema.org **`refundPolicy`** derived from `cancellation_hours` (LD1) on the tour-detail `Product`/`Offer` JSON-LD.

#### C.7.4 Window lifecycle (master §6.2)

- **Book:** deposit (deposit models) / full (`paid_in_full`) / nothing (`operator_full`). **Confirmed instantly.**
- **Up to the deadline:** **cancel for a full refund of any amount paid**; on `operator_link`, **pay the balance**.
- **After the deadline: Locked.**
- **Operator-forced cancellation** (unsafe conditions): **full refund or free reschedule, always.**

#### C.7.5 The tokenized C1 cancellation flow (master §6.4)

- **No raw-click cancellation.** The confirmation email's **"Cancel booking"** button opens a **tokenized confirmation page** on island.tours — **never an immediate cancel**. *Clicking the link never cancels.*
- Pipeline:
  1. Confirmation email **"Cancel booking"** button
  2. → **Tokenized confirmation page**: `"Cancel {tour}, {date}? Refund ${deposit}"` — **the refund line renders only when the amount is above zero** (C23)
  3. → submit → **manual request form (modal)** → **admin email**
  4. → **admin marks `cancelled` in the DB**
  5. → **notifications to BOTH traveler and operator**
- Implementation flow: traveler clicks the cancel link → tokenized confirmation page → shows tour / date / refund expectation → traveler submits the cancellation request → **stamp `utcCancellationRequestedAt`** → admin/operator workflow reviews → if allowed/forced: mark `CANCELLED` → release seats → **compute the refund from the request timestamp** → notify traveler and operator; if not allowed: keep the booking active / support resolution.
- **The cancellation deadline is judged on the REQUEST timestamp, not the admin action** — admin latency never penalizes a traveler who requested in time.
- **`utcCancellationRequestedAt` is stamped on the FIRST request only**; re-submits re-notify but never move it.
- **Account fallback for lost emails:** `island.tours/bookings` — login with **email + booking reference (`display_ref`)**, **rate-limited**. **Accounts are auto-created at booking** (B.34 supersedes the earlier "No account area in v1").
- **The TYP URL rides on the separate unguessable `public_ref` UUID**; the **email-plus-reference pair is the credential** for an account holding invoices and PII.
- **As built:** locale-less **`/cancel/{publicRef}`** (proxy rewrite, noindex), *"Cancel {tour}, {date}?"* + a green **"Refund {amount}" chip only when something was paid to Island Tours** (C23) + after-window locked copy with **no request button**; `POST /bookings/typ/:publicRef/cancellation-request` (`@Public`, resend-grade throttle, optional **500-char** reason) stamps the timestamp and emails **admin + traveller ack + operator notice**. Admin email target is **`ADMIN_EMAIL`** — **503 if unconfigured**, because *"a silently dropped refund request is the worst outcome"*; mail failure **throws**.
- **Repeat requests refused server-side:** `submitCancellationRequest` enforces `cancellationEligibility` — the **same predicate the read paths advertise** — so **`ALREADY_REQUESTED` / `NOT_CONFIRMED` / `DEPARTED` all 409** with traveller-facing copy. (Previously re-submits waved through as "idempotent" while re-sending **three** emails each time — one booking could spam three mailboxes on a loop.)
- **Owner-only cancellation (2026-07-19):** `cancellation-request` **401s without an owning traveler session**; the `/cancel` page deep-returns through `/bookings?returnTo=`. The bare `publicRef` TYP link stays permanently valid but renders **MASKED** (email/phone/last-name masked; pickup address + card withheld; `verified:false`) with a 7-locale "verify it's you" card. Lookup has **per-credential caps: 5/email + 10/reference per 15 min**.

#### C.7.6 Cancel confirmation modal (design spec — a page on island.tours, NOT an email)

- Opens when the traveler taps **Cancel booking**; **the link only opens this form, it never cancels on click**.
- Submitting sends a **cancellation request to the Island Tours admin by email**; the **admin processes the refund and confirms by email**.
- Layout: **430px** max-width white card, `border-radius:16px`, `box-shadow:0 26px 70px -20px rgba(0,0,0,.55)`, padding `24px 22px`, Plus Jakarta Sans, ink `#1F2937`.
- Content in order:
  1. Title: **"Are you sure you want to cancel?"** — 18px weight 800, `letter-spacing:-.01em`.
  2. Context line: **"{tourName} · {date}"** — 13px `#9aa3b2`.
  3. Reassurance: **"Full refund, no questions asked. We'll email you to confirm."** — 13.5px `#6B7280`.
  4. **Optional free-text textarea**, 3 rows, placeholder **"Optional. Anything you'd like us to know?"**, `1.5px solid #D1D5DB`, `border-radius:10px`, `resize:vertical`. **Not required.**
  5. Two buttons in a wrapping flex row, 10px gap: primary dark `#1F2937` white text weight 700 radius 10 padding `11px 18px` — **"Yes, cancel booking"**; secondary transparent `1.5px solid #D1D5DB` text `#374151` — **"Keep my booking"**.
- **Ordering rule:** destructive action first, "Keep my booking" as the outline escape — **as drawn**.

#### C.7.7 Per-payment-model cancellation confirmation copy (locked, master §6.4 / C23 / B.87)

- **Deposit models (locked):** *"Your {X}% deposit is on its way back from us, within 3 to 5 business days, to your original payment method. If you've already paid the balance, the tour operator refunds that part. Don't see your balance refund within {N} days? Message us and we'll chase it."*
- **`paid_in_full` (locked):** opens with *"Your payment is on its way back from us, within 3 to 5 business days, to your original payment method."*
- **`operator_full` (locked):** carries **no refund line** and reads *"Nothing was paid to Island Tours. Already paid the operator? Then the operator refunds you directly."*
- The tokenized cancel page **renders the refund amount only when above zero**.

#### C.7.8 Refund rules

- **Refund eligibility is judged at the REQUEST timestamp**, not the admin-action timestamp.
- **Before `tour start - cancellation_hours`:** refund the amount paid to Island Tours.
- **After the deadline:** customer cancellation is **locked** unless a force/admin policy applies.
- **Operator-forced cancellation** gives a **full refund or a free reschedule** — it **overrides the normal locked window** (as does force majeure).
- **`ON_HOLD` cancellation has no refund** — no payment landed.
- **`PAID_IN_FULL`** refund line references the **full payment**.
- **`OPERATOR_FULL`** has **no Island Tours refund line** — the refund line is omitted.
- **`OPERATOR_LINK`** operator-collected balance, if already paid, is **refunded by the operator**.
- **Cancellation fields on `Booking`:** `cancellationRefund` (**`FULL` / `PARTIAL` / `NONE`**), `cancelledBy` (**`CUSTOMER` / `OPERATOR` / `ADMIN` / `SYSTEM`**), `cancellationReason`, `utcCancelledAt`, `utcCancellationRequestedAt`.
- **Cancel releases seats** and marks unit items + booking `CANCELLED` (with `cancelledBy` / reason / timestamps) **in a transaction**.
- ⚠️ **Refund amount is category-only** (`[~]`): only a FULL/NONE verdict is returned; **no deposit-only vs full-amount computation per model, no partial**, and **no actual Stripe refund is executed**.
- **Cancellation-confirmed emails (EXECUTED 2026-07-20):** `cancel()` previously sent **nothing**, so the request-ack's promise (*"We'll email you to confirm once it's done"*) and the operator's (*"you'll be notified when it is final"*) were both silently broken — a processed request reached the traveller as silence. `sendCancellationConfirmedNotices` now sends both, with **refund-verdict-aware copy** (FULL names the amount and the **5-10 day** card timing; NONE explains the window). **Best-effort** (seats are already released, so a dead mailbox must never surface as a failed cancellation), and **skipped entirely for `heldOnly` releases** — an abandoned checkout hold is inventory housekeeping, not news.

#### C.7.9 Manual-forfeit and operator non-payment rules (master §15, §6.2, B.84)

- **The platform does not track `operator_link` balance payments in v1**, so **"unpaid" cannot be machine-determined**.
- **There is no automatic balance-overdue state.**
- **There is no automatic deposit forfeit.**
- **There is no automated balance nudge** — and the pre-tour reminder carries **no balance nudge** either.
- **The rule (conflict log 84):** **Operator reports non-payment → admin confirms → ONLY that confirmation forfeits the deposit and releases the spot.**
- Further states (e.g. **forfeited**, **operator-cancelled**) follow the same **admin-confirmed** pattern.
- ⚠️ **NOT BUILT:** the operator-report → admin-confirm → forfeit + release flow does not exist in code.

#### C.7.10 Dashboard cancellation-request queue

- **`/dashboard/cancellation-requests`** — the bookings table in **queue mode** (`cancellationRequested=true`, **OLDEST request first**) with **Requested / Free-window / Refund-due** columns. This is master §6.4's "admin marks cancelled" done properly (the master literally says *"admin marks cancelled in Supabase"*; the queue replaces raw DB edits). **Real refund money movement stays CP6.**
- `BookingListItemDto` adds `requestedInFreeWindow`, **judged at the REQUEST instant per C23**.
- **UPDATED 2026-07-20:** the queue now defaults to **OUTSTANDING work**. It previously filtered only on `cancellationRequested=true`, which never excluded processed rows, so the queue grew forever and (sorting oldest-first) **buried requests still needing attention**. A **Pending / Processed / All requests** control now sits where the status filter is suppressed in queue mode, defaulting to **Pending → `status=CONFIRMED`**. Frontend-only, via the existing status param — a filter default rather than a hard exclusion, so history stays reachable.
- ⚠️ **KNOWN LOOSENESS:** *"Processed reads as cancellation history, because `cancel()` stamps `utcCancellationRequestedAt` on every cancellation — so admin-initiated cancels with no traveller request appear there too. Pending is exact; tightening Processed would change refund-instant semantics, so it was left alone."*
- The **nav badge had the same bug** and is fixed with it: its comment said "awaiting admin review" but the query never filtered status, so it counted **every cancellation ever and never decremented** (it read 3 against a 1-row Pending queue). It now pins `status=CONFIRMED`, **as does the hover-prefetch key — which must match the list view's mount-time params exactly or the warmed cache is dead.**

---

### C.8 Settlement & payouts

> Canonical: `02-architecture/SETTLEMENT-AND-PAYOUTS.md` (master §1.4, §5.8, §7.1, conflict log C22/C23/B.85). Visual: `settlement-payout-flow.html`.

#### C.8.1 The problem being solved

- Resolves the two "open settlement rails" flagged in the master (C23): **operator payout on `paid_in_full`** (platform holds 100%) and **commission collection on `operator_full`** (platform holds nothing).
- **Key reframe:** the four models are **one target with three deviations**. The platform's goal on every booking is to **end up holding exactly its `commission`**.
  - **Deposit models** — collected `deposit` (≈ commission by design) vs the commission target: roughly equal → **settlement needed: none (self-settling)**.
  - **`paid_in_full`** — collected 100% → **over-collects** → pay the operator back the net.
  - **`operator_full`** — collected 0% → **under-collects** → collect commission from the operator.
- The deposit is deliberately sized near the commission rate — `deposit_pct` steps **20 / 22.5 / 25 / 27.5 / 30** line up with the tier commission rates — so IT keeps its deposit as its cut and the operator keeps the balance. **No transfer needed.**
- The two open rails are the two classic marketplace money-flow problems: `paid_in_full` = **the payout problem**; `operator_full` = **the commission-collection problem**.
- **Industry benchmark:** Viator (Merchant API) / GetYourGuide / Klook = merchant of record (= `paid_in_full`); Viator remits **monthly, ~21 business days after the travel month** (weekly PayPal option); GYG **monthly default, bi-weekly for +2% commission**. Airbnb = merchant of record + fast payout (**host paid ~24h after check-in**). Booking.com (legacy) = pay-at-property (= `operator_full`), **invoices the hotel monthly** and collects by direct debit / bank transfer / virtual card. **Lesson: pay-at-property is real and viable but is the one everyone is trying to get away from** (leakage, disputes, reconciliation cost) — *"Nobody builds toward operator-collects on purpose."*
- **The standard tool: Stripe Connect** — destination charges + `application_fee_amount`. **Hard truth about `operator_full`:** *"you cannot automatically collect commission on money that never touches the platform."* Only two honest closures: **(1) route the money through the platform** (which collapses it into `paid_in_full`), or **(2) keep it truly off-platform and invoice for commission** (monthly self-billed invoice + SEPA direct-debit mandate or card-on-file, with **listing suspension on non-payment**). *"There is no third option; this is a product decision, not an engineering one."*

#### C.8.2 ⚠️ THE LOCKED FOUNDER DECISION (2026-07-15) — supersedes the two OPEN flags for v1 scope

> **"V1 ships with three payment models. `operator_full` is dropped from v1."**

| Model | v1 status | Checkout leg | Settlement |
|---|---|---|---|
| `operator_link` | **Live** | `deposit` to Island Tours via Stripe/Mollie | **Self-settling** — `deposit_pct == commission`; IT keeps the deposit as commission; the operator collects the balance directly (secure payment link). **No transfer.** |
| `on_arrival` | **Live** | `deposit` to Island Tours via Stripe/Mollie | **Self-settling**, same as above; the operator collects the balance in person. |
| `paid_in_full` | **Live** | `total` (100%) to Island Tours via Stripe/Mollie | **Scheduled payout (clawback-safe)** — IT retains its `commission`; the remainder (`total - commission`) is paid out to the operator **on a schedule after the cancellation window closes**. |
| `operator_full` | **REMOVED IN v1** | none | Returns in **v2** via **Stripe Connect or direct bank transfer**. |

- **Decision 1 — Deposit models: commission equals deposit.** Treat **`commission == deposit_pct`**. IT collects the deposit, which **IS** its commission take; the rest of the booking amount is received by the operator directly. **No cross-transfer and no settlement action required.** The `settlements` row exists **for record-keeping only** (`net_position` ~ 0).
  - **Engineering note:** because `commission == deposit_pct` is locked for these models, **keep the two values consistent per tier** so the self-settling property holds. **If a tour ever has `deposit_pct != commission`, a residual appears and MUST be reconciled through the ledger.**
  - ⚠️ **CONFLICT:** this directly contradicts guide §2.3's *"Do not assume `deposit == commission` in code."*
- **Decision 2 — `paid_in_full`:** originally documented as *"platform commission retained, remainder paid out to the operator in a single booking flow but in a queue so it does not await the traveler's booking"* — **this phrasing is deprecated.**
  - **Engineering note (carried to phase 2):** an **immediate in-flow payout is NOT clawback-safe** against cancellations inside the free-cancellation window. If a traveler cancels and is refunded after the operator has been paid, IT must recover the net from the operator. **A scheduled payout released after the cancellation window closes (the Viator/Airbnb pattern) removes this risk.** A true in-flow split generally requires Stripe Connect (destination charge with `transfer_data`); without Connect, the "single flow payout" is a manual/near-real-time transfer recorded against the ledger row.
  - **NOTE (authoritative, verbatim):** **"AS PER ENGINEER NOTE WE WILL IMPLEMENT SCHEDULED PAYOUT RELEASE AFTER THE CANCELLATION WINDOW."**
- **Decision 3 — `operator_full`: deferred to v2.** Not offered in v1. Reintroduced in v2 using **Stripe Connect or direct bank transfer**, at which point the commission-collection rail (invoice + collection, or a Connect application fee) is specified.

#### C.8.3 The `Settlement` model (build in v1, extend later)

- **Every booking gets a settlement record from day one, even when no transfer happens.** It is the extension point for scheduled payouts, Connect, and `operator_full` in v2 **without a data-model rewrite**.
- `model Settlement` (`@@map("settlements")`):
  - `id String @id @default(uuid())`
  - `bookingId String @unique`
  - `booking Booking @relation(fields: [bookingId], references: [id])`
  - `operatorId String`
  - `paymentModel PaymentModel`
  - **Core ledger (locked minimum):**
    - `amountCollected Decimal @db.Decimal(10, 2)` — what IT collected at checkout (**EUR**)
    - `commissionOwed Decimal @db.Decimal(10, 2)` — IT's commission (**EUR**)
    - `netPosition Decimal @db.Decimal(10, 2)` — **`+` = IT owes the operator; `-` = the operator owes IT**
  - **Extension hooks (nullable in v1, used by v2 payouts/Connect):**
    - `currency Currency @default(EUR)`
    - `operatorPayout Decimal? @db.Decimal(10, 2)` — amount paid out to the operator (`paid_in_full`)
    - `status SettlementStatus @default(RECORDED)` — enum **`RECORDED | PAID_OUT | INVOICED | SETTLED`**
    - `settledAt DateTime?`
    - `externalRef String?` — Stripe transfer id / payout id / invoice id (v2)
  - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
  - `@@index([operatorId, status])`, `@@index([status])`

#### C.8.4 Row semantics per v1 model

| Model | `amountCollected` | `commissionOwed` | `netPosition` | Action |
|---|---|---|---|---|
| `operator_link` | `deposit` | `commission` (= deposit) | **~ 0** | **Record only** |
| `on_arrival` | `deposit` | `commission` (= deposit) | **~ 0** | **Record only** |
| `paid_in_full` | `total` | `commission` | **`+ (total - commission)`** | **Scheduled payout after the cancellation window**; `status = RECORDED` until the window closes, then **`PAID_OUT`** (set `operatorPayout`) |

#### C.8.5 Settlement invariants

- **`net_position` sign is fixed: positive = Island Tours owes the operator; negative = the operator owes Island Tours.**
- **Every booking writes exactly ONE settlement row at confirmation, regardless of model.**
- In v2 the **same table absorbs** `operator_full` (negative `net_position`, `status = INVOICED`) and scheduled Connect payouts (`externalRef` = Stripe transfer/payout id).
- **Separation invariant:** regardless of model, **exactly one `booking_complete` fires with `booking_value = commission_amount` in EUR (never GMV)**. The settlements ledger is the money-movement record; the conversion event is the marketing-value record. **They must never be conflated.**

#### C.8.6 Scheduled-payout-after-cancellation-window rule

- The `paid_in_full` payout is a **BullMQ delayed job** — `settlement.paid-in-full-payout`, triggered by `booking.confirmed` **AND** `paid_in_full`, **released after the cancellation window**, idempotency key **`bookingId:payout`**.
- **Compute the delay from tour-local time** (payout: after the cancellation window closes) and **re-check state in the consumer**, because the booking may have been cancelled or refunded meanwhile.
- Because the payout is delayed until after the cancellation window, the edge case *"cancellation refunded after the operator was paid"* **cannot happen for `paid_in_full`**.
- Aligns with the master's *"revenue is recognized on tour completion"* and with the affiliate on-hold-then-approve lifecycle.
- **v1 runs it manually/batched against the ledger; v2 automates it** via a Stripe Connect destination charge (`application_fee_amount = commission`) with the transfer released on the same post-window schedule.

#### C.8.7 Phase 1 vs Phase 2 (recommendation)

- **Phase 1 (now, no Connect) — build the settlement ledger, execute manually:** add the `settlements` ledger (every model writes a row, even deposit models where the delta is ~0); `paid_in_full` → scheduled **manual net payout** per operator per cycle, released after the cancellation window closes / tour completion; `operator_full` → **monthly commission invoice** collected via bank transfer / direct debit, requiring a payment method or mandate on file at operator onboarding, with **listing suspension on non-payment** (reusing the manual admin-confirm pattern from the forfeit flow). **"The ledger is the important part: build now so Phase 2 changes only the executor, not the data model."**
- **Phase 2 (Stripe Connect Express):** onboard operators as **Express connected accounts**; `paid_in_full` + deposit models → **destination charges with `application_fee_amount = commission`** (automatic, reconciled, machine-readable; the ledger populated from Stripe events instead of manual entry); `operator_full` → force the product decision (route through Connect, or keep invoice-only and accept it will never be machine-readable). **Machine-readable balances:** routing the operator balance through Connect makes the currently off-platform legs verifiable, closing the B.85 gap.
- **The decision behind both rails:** *"is Island Tours the merchant of record?"* Yes (via Connect) → `paid_in_full` and deposit balances **solve themselves and become trackable**.

#### C.8.8 Settlement build status

- ⚠️ **ALL UNBUILT.** `Settlement` model + `SettlementStatus` enum: **ABSENT**. No rows written at confirmation. No `net_position` sign convention enforced in writes. No scheduled `paid_in_full` payout. v2 items (`operator_full` reintroduction, Stripe Connect Express) deferred.

---

### C.9 FX & multi-currency

> Canonical: `02-architecture/FX-AND-MULTI-CURRENCY.md`, deriving from `BOOKING-FLOW-DESIGN-GUIDE.md` §20–23. **If anything disagrees with the master (v1.9), the master wins.**
> Status: backend **M1 (FX foundation) + M2 (pricing/quote/reserve wiring) + M3 (public-API display conversion via `money`) + M4 (refresh scheduler + startup warm-up) BUILT and tested.** Still on the **STATIC provider**; a real `FxProvider` (Stripe FX Quotes) and **M5 (frontend)** are tracked separately.

#### C.9.1 The one rule

- **The frontend NEVER computes or fetches FX rates.** All conversion happens in **`FxRatesService` (backend)**.
- Any rate used for money is **snapshotted onto the booking at reserve time and never refetched afterwards**, so a historical booking's charged amount and commission **never drift**.
- The frontend only **formats** with `Intl.NumberFormat`.

#### C.9.2 `FxRate` — immutable rate history

- Lives in `prisma/fx.prisma` → **`FxRate`**: the rate cache **and immutable history**.
- **One active row per pair** (`USD->EUR`, `EUR->USD`) with `rate`, `provider`, `providerAsOf`, `expiresAt`, `isActive`.
- **A refresh writes a NEW row and flips the prior active row `isActive = false`.** `refreshRates()` **never mutates a rate row in place.**
- Guide-specified schema: `baseCurrency`, `quoteCurrency`, `rate Decimal(18,8)`, `provider`, `providerAsOf`, `fetchedAt`, `expiresAt`, `isActive`; **unique `[baseCurrency, quoteCurrency, providerAsOf, provider]`**; `@@map("fx_rates")`. **Store direct pairs USD→EUR and EUR→USD.**
- All rate/money math uses **`Decimal`, never JS float**; conversions **round HALF_UP to 2dp at the line boundary**.

#### C.9.3 The provider seam

- **`fx-provider.interface.ts`** — the **`FxProvider` interface + `FX_PROVIDER` DI token** + `FxQuote` / `ProviderRate` / `FxPair` types. This is the **swappable seam**: booking/tour code **never touches a provider response shape**.
- **`fx.module.ts` → `FxModule`** binds `FX_PROVIDER -> StaticFxProvider`, provides `FxRefreshService`, and **exports `FxRatesService`**. Registered in `AppModule`; imported by `BookingsModule` (and the public read modules in M3). Relies on the global `ScheduleModule.forRoot()` for `SchedulerRegistry`.
- **Swapping in a real provider** = implement the `FxProvider` interface (`fetchRates(pairs) -> ProviderRate[]`) + **rebind `FX_PROVIDER` in `FxModule` (one line)**. **Nothing else changes** — all consumers depend only on `FxRatesService`, and the M4 scheduler already refreshes whatever provider is bound.
- **Timing:** do the swap **before production checkout serves cross-currency**, alongside the Stripe PaymentIntent work.
- Guide-listed service files: `backend/src/fx/fx.module.ts`, `fx-rates.service.ts`, `fx-provider.interface.ts`, `providers/<provider>.service.ts`, `dto/fx.dto.ts`. API: `getRate(from,to)`, `convert(amount,from,to)`, `refreshRates()`.

#### C.9.4 `StaticFxProvider` — what is wired right now

- **`providers/static-fx.provider.ts` → `StaticFxProvider`** is the provider wired **in every environment** today.
- Derives `USD <-> EUR` from **`FX_USD_TO_EUR` (default `0.92`)** with **no network call**, so local/dev/tests convert without any account (`EUR->USD` is its inverse).
- **NOT production-grade.** Guide §20.1 mandates a real provider and **"fail closed"** for production checkout.
- **Recommended production provider: Stripe FX Quotes** — locks a quote you can attach to the PaymentIntent, so **the displayed converted amount and the charged payment share one rate**. Use when `booking.currency` differs from `Tour.defaultCurrency`; request a locked quote for the expected checkout lifetime (**`five_minutes` or `hour`**); snapshot the `fx_quote` id, rate, provider timestamp and expiry on the booking quote; pass the `fx_quote` id into the PaymentIntent; **if expired/invalid, discard and ask the frontend to refresh prices.**
- **Open Exchange Rates** = good display/cache fallback; **ECB euro reference rates** = reference/audit source. *"Do not use a generic rates API as the sole checkout source if Stripe FX Quotes is available."*
- Provider requirements: supports USD+EUR · timestamped rates · documented update frequency · server-side API usage · clear failure/rate-limit behavior · commercial use allowed.
- **What is still needed for true production:** (1) a real `FxProvider` implementation (Stripe FX Quotes) + rebind in `FxModule`; (2) then production **genuinely fails closed on cross-currency** when the provider is down, instead of leaning on the static default.

#### C.9.5 The two rate paths (deliberately different)

| Method | Used by | Freshness | On failure |
|---|---|---|---|
| **`getRate()` / `convert()`** | **booking quote + reserve** (authoritative money) | **Fresh only; lazy-refreshes once if stale** | **FAILS CLOSED → 503** (`Payments temporarily unavailable`) |
| **`getDisplayRate()` / `buildMoney()`** | **public cards/detail** (display only) | **Fresh preferred, stale allowed within a window** | **Falls back to source currency (rate `1`), NEVER blocks the page** |
| **`refreshRates()`** | the **scheduler (M4)** + the lazy on-demand path | n/a | **Logs + skips a non-positive rate** |

- **Same-currency short-circuits to rate `1` with NO DB or provider call** (`identityRate`).
- Guide freshness matrix:

| Use | Freshness rule |
|---|---|
| Public tour cards / search | May use the last active/stale-display rate |
| Booking quote | **Requires a fresh, non-expired rate** |
| Payment intent | Uses the booking/quote snapshot, **never refetches** |
| TYP / email | Uses the booking snapshot, **never refetches** |
| Tracking | Uses the booking snapshot, **never refetches** |

- Rate rules: same-currency rate is always `1` with no provider call · cross-currency must come from `fx_rates`/equivalent cache · `getRate()` returns only a **non-expired active rate** · a stale rate is allowed **only within the configured stale window** · **no acceptable rate → the quote/booking fails with `503 Payments temporarily unavailable`** · use `Decimal`, never JS float.

#### C.9.6 Booking-time snapshot fields

- `quote / reserve` → **`resolvePricing()`** (`bookings.service.ts`):
  - `getRate(tourCurrency -> bookingCurrency)` → **`sourceFxRateToBooking`**
  - `getRate(bookingCurrency -> EUR)` → **`fxRateToEur`**
  - `tiers.effectiveCommissionRate(tourId, now)` (spotlight-aware)
  - → **`computeBookingPricing(...rates, commissionTier)`** (pure, `booking-pricing.util.ts`) → booking-currency totals + `source*` snapshot + EUR commission
- **`booking.create` snapshots:**
  - `currency` (= `bookingCurrency`, the **charged** currency)
  - `totalRetail` / `depositAmount` / `balanceAmount` (booking currency)
  - `sourceCurrency`, `sourceTotalRetail`, `sourceDepositAmount`, `sourceBalanceAmount`
  - `sourceFxRateToBooking` (tourCurrency → bookingCurrency)
  - `fxRateToEur`, `totalEur` (bookingCurrency → EUR)
  - `commissionRate`, `commissionAmount` (**EUR**, project rule #22)
  - **FX audit provenance:** `sourceFxProvider` / `sourceFxProviderAsOf` / `eurFxProvider` / `eurFxProviderAsOf`
- **payment / TYP / email / tracking → READ the snapshot, NEVER refetch FX.**
- Migration: `20260715221643_multi_currency_fx_rates_and_source_snapshots`. Guide-specified additive columns: `sourceCurrency Currency?`, `sourceTotalRetail Decimal?(10,2)`, `sourceDepositAmount Decimal?(10,2)`, `sourceBalanceAmount Decimal?(10,2)`, `sourceFxRateToBooking Decimal?(12,6)` — existing bookings get `sourceCurrency = currency`, source totals = charged totals, `sourceFxRateToBooking = 1`; **keep nullable during migration**.

#### C.9.7 Currency resolution and terminology

- **`sourceCurrency = tour.defaultCurrency`.**
- **`bookingCurrency = dto.currency ?? sourceCurrency`** (shopper choice; **default = the tour currency**).
- The traveler is charged in `bookingCurrency`; **the PaymentIntent uses `Booking.currency` — never the tour currency.**

| Term | Meaning |
|---|---|
| `tourCurrency` | Currency operators entered prices in (`Tour.defaultCurrency`) |
| `shopperCurrency` | Currency the visitor selected (`NEXT_CURRENCY`, default per locale) |
| `booking.currency` | Currency actually snapshotted/charged; should equal `shopperCurrency` |
| `sourceCurrency` / `sourceTotalRetail` / `sourceFxRateToBooking` | The tour-currency audit snapshot |
| `fxRateToEur` | `booking.currency` → EUR, snapshotted for tracking/commission |
| `sourceFxRate` | `tourCurrency` → `shopperCurrency` |
| `totalEur` | Full total normalized to EUR (`booking_total_eur`) |

- `Tour.defaultCurrency Currency @default(USD)` is the **source of truth** for all tour-authored prices: `Tour.basePrice`, `Tour.priceFrom`, `TourAgeBand.price` / `.priceOriginal` / `.priceNet`, `TourAddOn.price`. **No per-age-band or per-add-on currency field — a tour is single-currency.**
- **Rounding policy (guide 20.5):** each **participant seat and add-on line** is converted to booking currency and **rounded to 2dp**, then summed for `totalRetail`. `source*` figures preserve the original tour-currency quote. **Deposit/balance are computed in each currency independently.** Computation order: (1) source totals from tour prices; (2) source deposit/balance; (3) convert lines/totals to bookingCurrency; (4) round consistently at line boundaries and final totals; (5) `fxRateToEur` from bookingCurrency; (6) `totalEur`; (7) `commissionAmount = totalEur * commissionRate`.
- **Display rule:** *"Frontend must not simply replace the symbol. It must display a converted amount."*
- **TYP + confirmation email render `Booking.currency` / `totalRetail` / `depositAmount` / `balanceAmount` — NEVER `Tour.defaultCurrency`** on booking transactional surfaces. Source values appear only in internal dashboards. The TYP renders the **historical booking currency, not the cookie**.

#### C.9.8 The quote endpoint

- **`POST /api/v1/bookings/quote`** — `@Public()`, static route registered before `:id`; **stateless**, reusing `loadContext` + `computeBookingPricing` (UNIT- and FX-aware), **no side effects**.
- **Inputs (`QuoteBookingDto`):** `tourId`, `departureId`, `items`, `addOns?`, `pickupLocationId?`, `couponCode?`, `currency`.
- **Output (`BookingQuoteResponseDto`):** `quoteId`, `expiresAt`, `tourCurrency`, `currency`, `sourceFxRateToBooking`, `fxRateToEur`, `sourceTotalRetail`, `totalRetail`, `sourceDepositAmount`, `depositAmount`, `sourceBalanceAmount`, `balanceAmount`, `commissionRate`, `commissionAmount`, `paymentModel`, `lines`.
- **Quote expiry: 10–15 minutes** (implemented at **15 min**). Redis if available, else a DB table `model BookingQuote { id, payload Json, expiresAt, createdAt }`.
- **The quote must include a hash of the request inputs so it cannot be reused for different items.** ⚠️ **Still deferred:** DB-backed quote + input-hash revalidation, and `couponCode` discount preview.
- `ReserveBookingDto` accepts **`currency`** (drives the charged currency, default = tour currency) and **`quoteId`** (accepted for forward-compat; **reserve recomputes server-side**). *"If you skip `quoteId`, `POST /bookings` must recompute the quote server-side and ignore frontend totals."*

#### C.9.9 Public display conversion (M3)

- Public read endpoints accept an **optional `?currency`** and return a converted **`money`** object per tour card/detail — **the canonical display object**; legacy `priceFrom` / `basePrice` / `defaultCurrency` **stay for back-compat**.
- Shape: **`money: { currency, sourceCurrency, fxRate, priceFrom, basePrice }`** — **amounts are strings**.
- Built via **`FxRatesService.buildMoney`** (single) or the per-page helpers **`ToursService.attachMoney`** / **`HubService.attachHubMoney`** (resolve each distinct source currency's display rate once → **≤2 DB reads per page**). Uses **`getDisplayRate`** (stale allowed); when no rate is available it falls back to the tour's source currency at **rate `1`** — **a page never blocks on FX**.
- **Endpoints with `?currency` + `money`:** `GET /tours` · `GET /tours/slug/:slug` · `GET /tours/:id` · `GET /search` · `GET /collections/render/:slug` · `GET /hubs/render/:slug` · `GET /hubs/:id/our-picks` · `GET /hubs/:id/comparison`.
- **Deferred (still source-currency):** collection `getBySlug` / `getActive`, and hero/fastStats aggregate numbers (hub hero `priceFrom`, collection `fastStats.fromPrice`). The frontend can derive a display "from" price from the card `money` objects.
- **Price filters must use `priceFrom`, not `basePrice`** (aligned in Phase 1). Three recommended approaches for cross-currency min/max: a single launch currency; convert bounds per tour source currency; or filter post-fetch on converted `money.priceFrom`.

#### C.9.10 Refresh scheduler & startup (M4)

- **`fx-refresh.service.ts` → `FxRefreshService`** keeps `fx_rates` warm.
- **Startup** (`onApplicationBootstrap`): one `refreshRates()` so the first booking quote does not pay the provider round-trip and cross-currency works immediately when reachable.
- **Interval**: registered dynamically via **`SchedulerRegistry`** every **`FX_RATE_REFRESH_MINUTES` (default 30)** — **well inside the 120-minute TTL** so a rate never expires between refreshes.
- **Non-fatal**: a refresh that throws is **logged and swallowed** — boot and the interval never die. **Correctness is enforced per-request downstream** (the booking quote 503s, display falls back to source currency), **not by blocking the app**.
- ⚠️ **Convention:** in-process **`@nestjs/schedule` (NO BullMQ)**, matching `NightlyJobsService` — *"FX refresh is an idempotent recompute, not a retry/concurrency queue."*
- **`onModuleDestroy` clears the interval defensively** (tests / hot-reload leave no live timer).

#### C.9.11 Environment variables

- **Consumed by code today (all optional — defaults work; validated as positive numbers in `env.validate.ts` when set):**
  - **`FX_USD_TO_EUR`** — default **`0.92`** — the static `USD->EUR` rate used by `StaticFxProvider`.
  - **`FX_RATE_TTL_MINUTES`** — default **`120`** — how long a fetched rate stays **"fresh"** for booking quotes.
  - **`FX_RATE_STALE_DISPLAY_HOURS`** — default **`24`** — how stale a rate may be for the **public-display fallback**.
  - **`FX_RATE_REFRESH_MINUTES`** — default **`30`** — the `FxRefreshService` interval cadence. **Keep well below the TTL.**
  - **Local:** nothing required — runs on defaults.
- **Production (guide-listed, NOT YET consumed):**
  - **`FX_PROVIDER=stripe`** — selects the provider impl (**no effect yet**).
  - **`FX_PROVIDER_API_KEY=...`** — provider credential (**no effect yet**).
  - **⚠️ WARNING:** setting these does **nothing today** — the binding is **hardcoded to `StaticFxProvider`** in `FxModule`.
- Guide-listed fetch-schedule defaults: fetch every **30 minutes** · expire after **2 hours** · stale allowed up to **24 hours for public display only** · **never stale for new booking quotes/payment intents**.

#### C.9.12 Failure scenarios

| Scenario | Behavior |
|---|---|
| **Provider down at boot** | Startup refresh is **logged + swallowed**; the app boots. Cached DB rows (if any) still serve; the interval keeps retrying. |
| **Provider down, fresh cached rate exists** | **Use the cached rate.** |
| **Provider down, only a stale display rate exists** | **Public display only** (source-currency fallback); **the booking quote BLOCKS.** |
| **Provider down, no cached rate** | **Same-currency only**; a cross-currency **quote/reserve returns 503**. |
| **Rate changes after a quote** | The existing quote **stays valid until expiry**; a new quote uses the new rate. |
| **Rate changes after a booking** | **The booking never changes** (snapshot). |

- Startup rule (guide): try refresh → if the provider fails but valid cached rates exist, continue → if there are no cached cross-currency rates, **disable cross-currency quoting and return same-currency only**. **"Do not silently fall back to hardcoded production rates."**

#### C.9.13 Known FX/currency gaps

- ⚠️ **Currency-change guard missing:** `defaultCurrency` is **editable on the tour** and existing numeric price rows are **NOT auto-converted**. Must either block changing it after prices exist, require re-entry of all prices, or implement an explicit conversion workflow updating `basePrice`, `priceFrom`, age-band prices, add-on prices, and unit pricing fields **together**. **"Do not silently relabel existing USD prices as EUR."** Status: *"not verified/likely missing."*
- ⚠️ **`PricingModel.UNIT` booking gap (now resolved):** `reserve()` originally built pricing only from selected `TourAgeBand` rows and did not implement the UNIT formula. **Implemented 2026-07-16** — `loadContext` selects unit fields; `computeUnitLines` prices `basePrice + surcharge`; **the surcharge is GROUP-only per D1a, flat otherwise**.
- **OCTO serializer:** keep OCTO source pricing stable unless the OCTO endpoint explicitly accepts a requested currency; **the public shopper-currency cookie must not affect OCTO responses.**
- **Frontend currency state:** helper `frontend/lib/currency/current.ts` (`currencyFromCookie`, `formatMoney`); the footer selector must **`router.refresh()`** after setting the cookie (`max-age=31536000; samesite=lax`), not just local state.
- **FX tests:** `fx-rates.service.spec.ts` (identity rate, fresh cache hit, lazy refresh, fail-closed 503, `convert`, `refreshRates` write+deactivate, non-positive rejection, stale-display window) · `fx-refresh.service.spec.ts` (startup refresh + interval registration, swallowed startup failure, scheduled-tick cadence, no double-register, interval cleared on destroy) · `booking-pricing.util.spec.ts` (source==booking rate 1, USD tour → EUR booking, EUR tour → USD booking with EUR commission) · `bookings.service.spec.ts` (quote + reserve conversion, source snapshot, default booking currency) · `payments.service.spec.ts` (**PaymentIntent currency == `Booking.currency`**).

---

### C.10 Transactional email

> **LOCKED-WIREFRAME RULE:** `island-tours-booking-confirmation-email-wireframe.html` is titled *"Island Tours · Booking Confirmation Email (locked template)"* and is declared **LOCKED — the binding source of truth for booking emails**. Booking emails must mirror the wireframe **exactly, in design and logic**; if a template deviates it is **rebuilt from the wireframe**. Operator emails reuse the same shell.
> **The wireframe and the template are different artifacts and must not be confused:** the wireframe is the **visual mockup (zero tokens)**; `booking-confirmation-email.template.html` is the **tokenized template that renders**.

#### C.10.1 Provider and deliverability

- **Provider: Resend (primary)** — React Email, free tier viable at launch. **Postmark (fallback).**
- **SPF, DKIM, DMARC on a dedicated transactional subdomain**, fully separate from the marketing stream. **Deliverability is mission-critical because the C2 mitigation lives in this email** — named as *"the real lever"* on the anti-phishing mitigation.
- **Executed 2026-07-19:** nodemailer/SMTP removed; `mail.service.ts` sends via the **Resend SDK, env-configured only** (`RESEND_API_KEY` + `MAIL_FROM`); the `/settings/smtp` API and `smtp_configuration` table were dropped. **Postmark fallback still open.**

#### C.10.2 One dynamic template

- **ONE dynamic template** for all bookings, tours, and locales: merge variables, **conditional blocks**, i18n resource files. Not four separate templates.
- *"Sample data shown; all values are merge variables"* — **every literal in the wireframe** (name, tour, operator, dates, money, phone, email) is a merge field.
- **Two render targets:** **Desktop 600px** and **Mobile single-column**. The mockup clones the identical template into both frames — **desktop and mobile are the same markup; there is no separate mobile template**. Mobile preview frame is **392px wide / 760px tall**; desktop frame is **600px max-width**.
- **Mini-language:** `{token}` placeholders + `[IF cond]…[ELSE]…[/IF]` blocks (supporting `=`, `AND`, `OR`), plus **`[EACH list]…{item}…[/EACH]`** (added in review round 2; **an empty list is falsy for `[IF]`**). **44 tokens, 14 distinct conditions** at extraction; the built context provides **46 tokens + 3 condition-only fields**.
  - Renderer (`mail/templates/email-template.renderer.ts`): **recursive, 2-deep nesting**; unknown tokens are left **literal**; **`findUnresolvedTokens()` is the guard**; values are **HTML-escaped**; CSS braces untouched; it **throws on an unbalanced block rather than emitting half an email**.
  - **`[ELSEIF]` is NOT in the language** — it appears nowhere in the wireframe and nothing implements it. Use nested `[ELSE]`.

#### C.10.3 Subject line and preheader rules

- **Subject pattern: "You're booked: {tourName} on {date}"** — sample *"You're booked: Klein Curaçao Day Trip on 22 May 2026"*. The subject leads with the outcome, then the tour name, then the departure date in `D Month YYYY` form.
- **Preheader / preview text: "Your spot is reserved. Here are your details and what happens next."**
- **<24h variant (master §6.5, B.83):** when a booking is created **less than 24 hours before tour start**, the subject switches to **"You're booked for tomorrow: {tour}"** (or **"today"**) and **no separate reminder follows** — it doubles as the reminder for last-minute bookings.
- **`operator_full`:** Block 1's headline becomes **"Reservation sent"**, so the **subject must branch in the same direction** for that model (headline/subject consistency).
- **`paid_in_full`:** the headline **stays "You're booked"** — so the **subject does NOT branch** for `paid_in_full` or `on_arrival`.

#### C.10.4 Email-client and build constraints

- Email-safe **single-column** layout, **max 600px** width.
- **Inline styles in production** (no `<style>` block inside the email body — with one deliberate exception, see mobile spacing below).
- Port to **React Email**, sent via **Resend**.
- All layout uses `<table role="presentation" cellpadding="0" cellspacing="0">` with `border-collapse` — table-based and email-client-safe. Outer table `width="100%"`; inner `width="600"` with `style="width:100%;max-width:600px"`.
- Card chrome: white `#FFFFFF`, `border-radius:16px`, `overflow:hidden`, `1px solid #E8EAED`, `border-collapse:separate` (**required for the radius to render**).
- Outer cell padding `0 16px` for mobile gutters.
- **Font stack: `'Plus Jakarta Sans', Arial, sans-serif`** — **Arial is the mandatory fallback on every text node** (Gmail/Outlook will not load the webfont).
  - ⚠️ **Email clients do NOT inherit `font-family` from `<body>` into tables** — the wireframe carries the stack **on every block `<td>` (15 sites)**.
  - ⚠️ **Gmail font is CLOSED as impossible-by-platform:** Gmail (web + apps) and Outlook-Windows **strip `<link>`, `@import`, and `@font-face` for every sender**. Apple Mail / iOS do load Plus Jakarta Sans. **The only lever is the fallback stack, which the wireframe locks to Arial.** A closer-metric fallback (Segoe UI) would require a **wireframe edit first**.
- **Palette:** brand orange **`#E8611A`**; orange-tint `#FBF1EA`; green `#16A34A` (also `#1f9d55` in branch variants); dark ink `#1F2937`; mid gray `#6B7280`; hairline `#E8EAED`; secondary text `#374151` / `#4B5563`; muted `#9aa3b2` / `#b6bcc7`; disabled/dot `#D1D5DB`; panel fill `#F7F8FA`; info-blue panel `#EEF4FB` with text `#27496f` / `#3a516b` and icon `#3B6AA0`; orange-box heading `#9a4a16` and body `#5b3a22`. **Lowercase design hex values.**
- **SVG line icons in neutral gray `#6B7280`** per **LD20**. **No emoji anywhere in the body.** Icons: inline `<svg>` with `stroke-width` ~1.3–1.8, `stroke-linecap="round"`, `stroke-linejoin="round"`, sized **16–17px** (blocks) with a **24px viewBox**.
  - ⚠️ **DELIBERATE DEVIATION (founder-approved): SVG is NOT deliverable in email** — Gmail strips `<svg>`; Outlook's Word engine never supported it. The wireframe draws **14 `<svg>` sites = 10 unique icons**; all 10 were extracted verbatim into `mail/templates/icons/*.svg` (**the repo is the source of truth**) and **rasterized by Cloudinary (`f_png`)**, referenced as `<img>`. One **`{emailIconBase}`** token = `.../f_png,w_34/islandtours/email/icons`; **delivered at 34px, displayed at wireframe size (16/17px)**; source SVGs authored at **4x** so Cloudinary always downscales. **`alt=""` + fixed 26px gutter cells** so Outlook image-blocking never collapses the layout. Republish with `pnpm email:icons:upload` (idempotent); preview with `pnpm email:preview [paymentModel]`.
- **Hero/featured image `alt` = the tour name.** Featured-image placeholders carry `aria-label="tour featured image"`.
- **Mobile responsiveness:** the wireframe has **no media queries and no classes — its shell IS the fluid hybrid** (`width:100%;max-width:600px`). ⚠️ A first port's media-query/class layer and an mso ghost table were both **deviations and were removed**. The **only** sanctioned media query is the founder-requested mobile breathing room: on **≤480px**, outer gutter **26/16 → 12/6** and cell sides **28 → 16** (`.it-shell-pad` / `.it-cell`) — **the ONLY media query and the ONLY classes**, with parity guards asserting exactly that.
- **Dark-mode safety (2026-07-19):** the SiteInfo logo is a transparent PNG with dark artwork — invisible when Gmail/Outlook dark mode repaints the card. Two-layer fix: (1) `mail/email-logo.util.ts` `emailSafeLogoUrl()` injects a **Cloudinary chained transform (`b_white,c_pad,f_jpg,h_ih_mul_1.2,w_iw_mul_1.2`)** baking a **white chip with 20% padding** into the delivered pixels (non-Cloudinary URLs pass through); logo `<img>` bumped **40 → 48px**. (2) **`color-scheme: light` meta pair + a `:root` rule** added to **all four shells** (3 HTML templates + `auth-email-shell.ts`) so Apple Mail/iOS stop inverting the design. The white chip is invisible on the light card, so light mode is unchanged. (Logo previously enlarged 28px → 40px by founder request.)
- **Locale formatting rules:**
  - **Currency:** **USD for EN and ZH; EUR for NL, DE, FR, ES, PT.** Money always renders in the **charged** currency.
  - **Dates:** locale-formatted. **`en` → `en-GB`.** ⚠️ **en-GB renders USD as "US$220.00"** while the wireframe locks "$60.00"/"from $45" → fixed with **`currencyDisplay: 'narrowSymbol'`**.
  - **Times: 24-hour across ALL locales** (`hourCycle: 'h23'`) — **no AM/PM in any locale**. ⚠️ **Note: the TYP renders 12-hour — the email rule differs.**
  - All times are labelled with the **destination timezone**, e.g. **"(Curaçao time)"**. *(Master §6.5 correction: block 9's "(Curaçao time)" → **"(local time)"** as the expansion-proof rule — B.31.)*
  - **Deadline format locked:** **"Wed, 20 May 2026, 08:00"** (was "Wednesday, 20 May 2026 at 08:00").
  - **Language** rendered via **`Intl.DisplayNames`, localized** (was raw ISO codes).
- **`prefers-reduced-motion` / animation: none** — static email.
- **A real `text/plain` part** is generated (`buildConfirmationEmailText`).

#### C.10.5 The 11 blocks in render order

> Master §6.5 enumerates **eleven blocks in order**. The wireframe numbers them slightly differently (brand bar as block 0, blocks 2+3 combined). Both enumerations are given.

**Master §6.5 ordering:**
1. **Block 1** — confirmation **plus booking reference**, direct, at the top.
2. **Block 2** — tour **hero image**.
3. **Block 3** — core details: **date, time in 24h format, meeting point or pickup, party, duration**, with the **dynamic arrival buffer**.
4. **Block 4** — **payment summary**: deposit paid, balance due, total, with the single **`{hours}` deadline "(local time)"**; **zero-amount rows hidden** (conflict log 82).
5. **Block 5** — **C2 foreshadow, MANDATORY on `operator_link`**: the operator, **named**, will send a separate email with a secure link to pay the balance, so that email is **expected and never read as phishing**.
6. **Block 6** — **anti-fraud line (LOCKED):** *"We'll never ask for card details by reply, text, or phone. Always pay through the link in your booking emails."* plus the verification anchor *"If a payment request looks off, check with us on WhatsApp first."*
7. **Block 7** — **cancellation**: the **tokenized cancel link** plus the **account pointer**.
8. **Block 8** — **what to bring and prepare** (conditional per tour) and **support: WhatsApp, Mon to Sun 08:00 to 20:00** (confirmed).
9. **Block 9** — **payment-model block, conditional per the four models**; **every deadline "(local time)"**; **`{operatorName}` always templated** (was a hardcoded "Zipline" — B.32).
10. **Block 10** — practical footer.
11. **Block 11** — **"Built by Islanders." sign-off.**

**Wireframe block-by-block (Option 1 = default `operator_link` deposit model):**

- **Brand bar (block 0)** — padding `18px 28px`, bottom border `1px solid #E8EAED`. Wordmark **"ISLAND TOURS"** — uppercase, weight 800, 13px, `letter-spacing:.04em`; **"ISLAND" in `#1F2937`, "TOURS" in `#E8611A`**.
  - ⚠️ **Deliberate deviation (founder-approved):** the wireframe's brand bar is a **text wordmark with zero `<img>`**, so using the real logo is itself a deviation. Renders `[IF siteLogoUrl]<img>[ELSE]<wordmark>[/IF]` — **admin-swappable via Settings > General**.
- **Block 1 · Confirmation headline** — 30×30px circular badge, background `#E7F6ED`, containing a 16px green checkmark SVG (`#16A34A`, stroke-width 2.4). Headline **"You're booked, {firstName}."** — 22px weight 800, `letter-spacing:-.02em`, `#1F2937`, **no line-height**. Sub-line **"Booking reference: {displayRef}"** — 13px `#6B7280`, the reference itself bold `#1F2937` (sample `IT-2026-04821`). Padding `26px 28px 6px`.
  - **Conditional:** for `operator_full` the headline becomes **"Reservation sent, {firstName}."** (still shows the booking-reference line).
- **Blocks 2 + 3 · Booking summary (combined row)** — two-column table: **96×96px featured-image thumbnail** (`border-radius:10px`) at left with `padding-right:14px`; details at right; both `vertical-align:top`. Source note: the thumbnail beside the title is **"same format as checkout"** — the email must **mirror the checkout summary card format**.
  - Tour name: 17px weight 800 `#1F2937`, `line-height:1.25`, `letter-spacing:-.01em`. Operator name below: 13.5px `#6B7280`.
  - Date + time line: **"{Weekday}, {D Month YYYY} · {HH:MM}"** — 14px weight 600 `#374151` (sample *"Friday, 22 May 2026 · 08:00"*).
  - Horizontal rule: 1px `#E8EAED`, margin `16px 0 14px`.
  - Detail rows table (14.5px `#374151`, `line-height:1.45`), each row = **26px-wide icon cell + text cell**, `padding:5px 0` (**first icon cell only carries `width:26px`**):
    1. **Pickup row (conditional: pickup vs meeting point)** — map-pin icon + **"Pickup: {location}, {HH:MM}."** + inline link **"Open in Maps"** (orange `#E8611A`, weight 600, underlined).
    2. **Readiness note** — **"Please be ready 5 minutes before pickup."**
    3. **Ends at** — arrow icon + **"Ends at: {endLocation}"** (sample *"Jan Thiel Beach"*).
    4. **Guests** — people icon + **"Guests: {n} adults, {n} child"** — pluralized/composed from the age-band breakdown.
    5. **Duration (conditional)** — clock icon + **"Duration: {duration}"** (sample *"9 hours"*).
    6. **Language** — globe icon + **"Language: {language}"** (sample *"English"*).
    7. **Special requests (conditional)** — speech-bubble icon + **"Your note to the operator: {note}"**.
  - Footer links row: **"View tour details"** · gray `#D1D5DB` dot separator (`margin:0 9px`) · **"Add to calendar"** — both 13.5px orange weight 600 underlined. **(Implies the ICS/calendar-link requirement.)**
- **Block 4 · Operator note (CONDITIONAL)** — blue info panel `#EEF4FB`, `border-radius:10px`, padding `14px 16px`; 16px circular-info icon in `#3B6AA0`. Header **"A note from {operatorName}"** — 13.5px weight 700 `#27496f`. Body: free-text operator note, 13.5px `#3a516b`. **Renders only when the operator has supplied a note.**
  - Data source: **`TourTranslation.operatorNote`** (localized; migration `20260716144848_tour_translation_operator_note`), edited at **Dashboard > Tours > edit > Translations tab > "Note to Travellers"**; traveller locale with English fallback; **empty hides the blue card**.
- **Block 5 · Payment (BRANCHES on `paymentModel`)** — container `#F7F8FA` fill, `1px solid #E8EAED`, `border-radius:12px`, padding `16px 18px`. Section label **"PAYMENT"** — 13px weight 700 uppercase `letter-spacing:.06em` `#9aa3b2`.
- **Block 6 · "How to pay the rest" / C2 anti-phishing foreshadow (BRANCHES)** — container `#FBF1EA` fill, **left border 4px solid `#E8611A`**, `border-radius:10px`, padding `15px 17px`. Heading 14px weight 800 `#9a4a16`; body 14px `#5b3a22`, `line-height:1.55`. Below the box, **always**: a shield-with-check icon (16px `#6B7280`) + a 12.5px `#6B7280` **anti-fraud line**.
  - **⚠️ PLACEMENT RULE (HARD):** this block **and the anti-fraud line carry the C2 anti-phishing mitigation and MUST stay above the fold of the payment area — never buried in the footer.**
- **Block 7 · Prepare ("What to bring" + "Good to know") — CONDITIONAL** — preceded by a `1px solid #E8EAED` top border with `padding-top:18px`. Section label **"WHAT TO BRING"** (13px weight 700 uppercase `.06em` `#9aa3b2`); bulleted list with bullet `&bull;` in orange `#E8611A`, text 14px `#374151` (samples: *"Swimwear and a towel"*, *"Reef-safe sunscreen and a hat"*, *"Cash. Card payments are not possible on Klein Curaçao."*). Section label **"GOOD TO KNOW"**, same styling, `margin:16px 0 10px`, same bullet format. **Both lists render/hide per booking.**
- **Block 8 · Questions (two-part contact panel)** — container `#F7F8FA` + `1px solid #E8EAED`, `border-radius:12px`, padding `16px 18px`.
  - **Part 1 — operator contact:** heading **"Questions about the day?"** (15px weight 700 `#1F2937`); body **"{operatorName} runs your tour and knows it best."** (14px `#4B5563`); two white outline buttons side by side — **"Call"** and **"Email"** (14px weight 700, `1.5px solid #D1D5DB`, `border-radius:10px`, padding `11px 18px`); contact line **"{operatorPhone} · {operatorEmail}"** — 12px `#9aa3b2`.
  - Divider `1px solid #E8EAED`, `margin:16px 0 14px`.
  - **Part 2 — platform contact:** heading **"Questions about your booking?"**; body **"We'll sort it out."**; solid orange CTA **"Chat on WhatsApp"** (white on `#E8611A`, `border-radius:10px`, padding `11px 20px`); hours line **"Mon to Sun, 8:00 to 20:00 Curaçao time"** — 12.5px `#9aa3b2`.
  - **Deliberate split:** the **operator handles the tour, Island Tours handles the booking.**
- **Block 9 · Cancel (BRANCHES)** — preceded by a top border + `padding-top:18px`.
  - **Default variant:** section label **"NEED TO CANCEL?"** (uppercase `#9aa3b2`); body **"You can cancel for a full refund up to {deadline} ({destination} time)."** (deadline bold); outline button **"Cancel booking"** (14px weight 700, `1.5px solid #D1D5DB`, `border-radius:10px`, padding `11px 20px`); account pointer **"Your booking details, history, and invoice are always in your Island Tours account at island.tours/bookings."** — 12.5px `#9aa3b2`, the URL an orange underlined link. *(A `{accountUrlLabel}` token renders **"island.tours/bookings"** rather than a raw URL.)*
  - **`operator_full` variant:** the card is a bordered white box (`1px solid #EAE7E1`, radius 14px) rather than the plain section; heading **"Need to cancel?"** (15px weight 800); body **"{operatorName} handles payment for this tour, so cancellation and refunds run through them under their terms. To cancel, contact {operatorName} directly. We're on WhatsApp if you have questions."**; **NO "Cancel booking" button** — cancellation is off-platform for this model.
  - **⚠️ CANCEL-BUTTON RULE (HARD):** the Cancel button is a **tokenized link** that opens a **cancellation request form on island.tours** — **never a raw one-click cancel**. **Clicking the link never cancels.** Submitting the form **emails the request to the Island Tours admin**, who **processes the refund and confirms by email**. (`cancelUrl` → `/cancel/{publicRef}` per master §6.4/C1.)
- **Block 10 · Sign-off** — top border + `padding-top:18px`. Line 1 **"Island Tours. Built by Islanders."** — 13px weight 800 `#1F2937`. Line 2 **"www.island.tours"** — 12.5px `#9aa3b2`. Legal block, 11.5px `#b6bcc7`, `line-height:1.6`, three lines: *"ITG B.V. (Island Tours Group) · KvK Curaçao 169950"* · *"Caracasbaaiweg 366, Willemstad, Curaçao"* · *"This is a transactional booking email."* (**transactional classification statement — no unsubscribe/marketing footer**).
- **Block 11 · Upsell ("More {destination} experiences")** — **bottom-anchored, contained in a panel, explicitly NO social row.** Container `#F7F8FA` + `1px solid #E8EAED`, radius 12, padding `16px 18px`. Heading **"More {destination} experiences"** — 15px weight 700. Two-up grid (`width="50%"` each, 7px inner gutters); each card: **150px-tall featured image**, `border-radius:9px`, `aria-label="tour featured image"`; tour title 13.5px weight 700 `#1F2937`; meta line **"{rating} · {price}"** — 12.5px `#6B7280` (samples *"4.9 · $89"*, *"4.7 · $65"* — **no "from", zero cents stripped**). Footer link **"Browse all {destination} tours"** — 13.5px orange weight 600 underlined.
  - **Related tours = same DESTINATION, not category** (founder correction mid-review; a category filter was tried and reverted). LIVE + bookable, ordered by master §7.2 (`tier_rank ASC, quality_score DESC, id ASC`); **no rating fabricated for an unreviewed tour** (LD11 cold start).

#### C.10.6 The four `paymentModel` branches (block 5 payment + block 6 how-to-pay)

**Block 5 — Payment:**

- **Variant 1 — default / `operator_link` deposit:**
  - Row **"Deposit paid today ({depositPct}%)"** → amount, weight 700, **green `#16A34A`** (sample "$40.00" at 20%).
  - Row **"Balance due"** → amount, weight 600, `#1F2937` (sample "$160.00").
  - **Divider row** (`border-top:1px solid #E8EAED`, `padding-top:8px`).
  - Row **"Total"** (weight 700) → amount weight 800 (sample "$200.00").
  - Deadline note under a **dashed divider** (`1px dashed #E0E3E8`, `padding-top:12px`), 13.5px `#4B5563`: **"Pay your balance, or cancel for a full refund, up to {Weekday, D Month YYYY, HH:MM} ({destination} time). After that the deposit is non-refundable, and an unpaid balance cancels the booking."** — the deadline datetime bold.
- **Variant 2 — `on_arrival`:**
  - Row **"Deposit paid today ({pct}%)"** → green `#1f9d55` weight 700.
  - Row **"Balance due on arrival"** → weight 600.
  - Row **"Total"** with top border, both cells weight 800.
  - Note: **"Cancel for a full refund up to {deadline} ({destination} time). After that the deposit is non-refundable."** — **no "unpaid balance cancels the booking" clause**, because there is no balance link.
- **Variant 3 — `paid_in_full`:**
  - **Single row "Paid in full"** (weight 800) → total amount in **green `#1f9d55`, weight 800** (sample "$200.00").
  - Note: **"Cancel for a full refund up to {deadline} ({destination} time). After that it is non-refundable."**
  - Business rule stated: 100% is paid to **Island Tours** at booking and **Island Tours refunds in full** on cancellation.
- **Variant 4 — `operator_full`:**
  - **Single row "Total"** (weight 800) → amount weight 800. *(As built: a plain Total row + "Payable to {operator}. Island Tours took no payment." and **no Cancel button**.)*
  - Note: **"Payable to {operatorName}. Island Tours took no payment."**
  - Business rule stated: Island Tours takes no payment at booking; the operator emails the full-payment link, confirms the spot, and settles commission with Island Tours afterward.
- ⚠️ **Defect fixed:** money rows originally conditioned **only the LABEL, not the row**, so `paid_in_full` / `operator_full` would have rendered a **bare `{depositAmount}` with no label**. Per the wireframe the **whole `<tr>` must vanish**: `operator_link` = deposit / Balance due / Total · `on_arrival` = deposit / Balance due on arrival / Total · `paid_in_full` = **Paid in full only** · `operator_full` = **Total only**. Now wrapped at `<tr>` level, asserted by 4 tests.

**Block 6 — How to pay the rest:**

- **Variant 1 — default (deposit / `operator_link`):**
  - Heading **"How to pay the rest"**.
  - Body: **"{operatorName} will email you a secure link to pay the remaining {balance}. This is the only payment left on your booking, so look out for that email and pay before the deadline above."**
  - Anti-fraud line: **"We'll never ask you to send card details by reply, message, or phone. If you're ever unsure about a payment request, check with us on WhatsApp first."** (WhatsApp is an underlined link, gray `#6B7280`.)
- **Variant 2A — `on_arrival` + `onArrivalPayment = card_or_cash`:**
  - Heading **"Pay the rest on arrival"**.
  - Body: **"You'll pay the remaining {balance} to {operatorName} when you arrive. Card and cash are both accepted."**
  - Anti-fraud line: **"You only pay the rest on arrival. We'll never send a link to pay the balance."**
- **Variant 2B — `on_arrival` + `onArrivalPayment = cash_only`:**
  - Heading **"Pay the rest on arrival"**.
  - Body: **"You'll pay the remaining {balance} to {operatorName} in cash when you arrive. Card isn't possible and there's no ATM on site, so bring the {balance} in cash with you."** (**balance appears twice, both bold**.)
  - Anti-fraud line: same as 2A.
- **Variant 3 — `paid_in_full`:**
  - Heading **"From {operatorName}"**.
  - Body: **"{operatorName} will also email you with their own confirmation and arrival details. Look out for it."**
  - Anti-fraud line: **"Your tour is fully paid. No one should ask you for further payment."**
- **Variant 4 — `operator_full`:**
  - Heading **"Pay to confirm your spot"**.
  - Body: **"{operatorName} will email you a secure link to pay the full {total}. Paying confirms your spot, so look out for that email."**
  - Anti-fraud line: the full *"We'll never ask you to send card details by reply, message, or phone… WhatsApp first."* variant.
- The sub-variant is selected by a dedicated field **`onArrivalPayment`** (`card_or_cash` | `cash_only`).
  - **Locked decision (founder 2026-07-16):** `onArrivalPayment` is a **new `Tour` enum column** (`CARD_OR_CASH | CASH_ONLY`, **NOT NULL default `CARD_OR_CASH`**) + an operator dashboard field (Details tab + create form, **shown only when `paymentModel = ON_ARRIVAL`**), **snapshotted onto `Booking` at reserve** (rule #21 — never retroactive). Migration `20260716122726_on_arrival_payment_and_pickup_timing_snapshot`.

#### C.10.7 Conditional / dynamic-block register

- Conditionals that render or hide per booking: **pickup vs meeting point**, **duration**, **special requests**, **what-to-bring**, **operator note**, **end point**, **tour language**.
- Branch variable **`paymentModel`** with four values: `operator_link` (default), `on_arrival`, `paid_in_full`, `operator_full`.
- Branch variable **`onArrivalPayment`** with two values: `card_or_cash`, `cash_only` (only under `on_arrival`).
- **Blocks affected per model:**
  - **`on_arrival` → only blocks 5 and 6 change**; everything else identical to Option 1.
  - **`paid_in_full` → blocks 5 and 6 change**; the headline stays "You're booked".
  - **`operator_full` → blocks 1, 5, 6 and 9 change.**
- **Merge variables implied across the template:** firstName · displayRef/bookingReference · tourName · featuredImage (+alt) · operatorName · departure weekday/date/time · pickup type + location + time · endLocation · guest composition by age band · duration · language · specialRequest note · operatorNote · depositPct · depositAmount · balanceAmount · totalAmount · currency · cancellationDeadline (datetime + timezone label) · destinationName · operatorPhone · operatorEmail · whatsAppLink · tourDetailsUrl · calendarUrl · cancelTokenUrl · mapsUrl · upsell tours (image/title/rating/price) · browse-all URL · support hours.
- **Data already available (post-E3):** `firstName`, `bookingRef`, `tourName`, `operatorName/Email/Phone`, `dateLong`, `dateShort`, `startTime`, `duration`, `partyBreakdown`, `pickupLocation`, `totalAmount`, `depositAmount`, `depositPct`, `balanceAmount`, `islandName`, `specialRequests` (`Booking.notes`), `cancelDeadlineDateTime`, `locale`, related tours.
- **`depositPct` is derived from the booked amounts**, NOT from `Tour.depositPct` (which is tier-driven and mutable).
- **Arrival-buffer / pickup-timing decision (SUPERSEDED on inspection — no platform constant needed; every field already exists):** non-pickup *"arrive N minutes early"* → **`Tour.checkInMinutesBefore` (`@default(30)`)**; pickup *"be ready N minutes before"* → **`PickupLocation.minutesPrior`**; **`PickupLocation.windowStart` / `windowEnd`** (`'HH:MM'`) give the Figma "7:45-8:15 AM window". A platform constant is only a fallback. **Pickup TIMING is snapshotted at reserve, never joined live** — `Booking.pickupMinutesPrior`, `pickupWindowStart`, `pickupWindowEnd` (nullable snapshots), alongside the existing `pickupAddress` + `pickupLocationId`.
- **`meetingPoint` = the tour's `START` `TourLocation`**, rendered from `TourLocationTranslation.title` (already localized) + `streetAddress`. **No migration.** The same source gives **`endPoint`** for free (`types` contains `'END'`).
- **`operatorNote`** originally rendered nothing (no note modelled; the card hid) until `TourTranslation.operatorNote` was added.
- ⚠️ **Two orphan-icon bugs fixed** (found by the template spec): icon cells sat **OUTSIDE** their `[IF]` (a booking with no end point / duration / language / note would have emailed an icon beside blank space); `[IF operatorNote]` wrapped **only the heading** (leaving an empty blue card). **Both now wrap the whole `<tr>`.**
- ⚠️ **One unclosed `[IF`** (28 `[IF` vs 27 `[/IF]`) — `[IF paymentModel = operator_link OR on_arrival]` opened **inside a `<td>`** on the deposit row and never closed. Fixed.

#### C.10.8 The email sequence

- **confirmation → operator balance email (`operator_link` only) → pre-tour reminder (24h before start) → cancellation confirmation.**
- **Founder requirement 2026-07-16: 2 emails per booking, 3 on `operator_link`:** (1) **Confirmation to the traveller** (must follow the LOCKED wireframe); (2) **"Booking Received" notification to the tour operator** (NEW, previously untracked); (3) **Secure payment link for the remainder — `operator_link` only.**
- **Operator "Booking Received" email (BUILT):** fires in `finalizeConfirmation` right after the traveller email; recipient = **`companyInfo.companyEmail ?? contactEmail`** (founder: company email first); **reuses the traveller shell VERBATIM** (the spec asserts **zero new style attributes**); **per-model action copy** (send link / collect on arrival / fully paid), guest contact, dashboard CTA; **English-formatted regardless of the traveller's locale**; **failures swallow** (money is already captured).
- **Operator-balance email on `operator_link` — ⚠️ NOT BUILT.** *"no such template."*
- **Cancellation-request emails ×3 (BUILT):** admin work-item (**throws** on failure), traveller ack (*"we got your request — terms are judged from this moment"*, in their locale's date format), operator heads-up (*"no action needed yet"*, company inbox first). The ack/notice pair is **best-effort**. All ride a shared **`booking-notice.template.html`** (spec asserts zero new style attributes).
- **Final post-admin cancellation confirmations** (locked *"on its way back within 3 to 5 business days"* copy, C23-aware) — see §C.7.8.
- **TYP resend endpoint (BUILT):** `POST /bookings/typ/:publicRef/resend` — `@Public`, keyed on the unguessable `publicRef`; **the recipient is NEVER accepted from the caller** (sends only to the booking's stored `contactEmail`); **CONFIRMED-only**, so a CANCELLED booking can never re-emit "You're booked"; throttled to **1/10s, 3/min, 10/hr per IP**. **It MUST stay a browser call** — `skipIf: isTrustedInternalOrigin` exempts the internal API secret from throttling, so routing it through SSR/`publicFetch` would **silently strip every limit**. Confirm-time sends **swallow** email failures (money already captured); the **resend path rethrows** (one `rethrow` flag, both behaviours tested).
- **ICS calendar endpoint (BUILT):** `GET /bookings/typ/:publicRef/calendar.ics` — `@Public`, keyed on `publicRef`, **confirmed bookings only**; `booking-ics.util.ts` is hand-rolled **RFC 5545**: CRLF, escaping, **75-OCTET folding on UTF-8 boundaries**, real UTC via `localWallClockToUtc`.
- ⚠️ **Invoice attachment NOT implemented** — guide step 22 requires *"Add invoice as attatchments (INVOICE RECIVE FROM STRIPE/MOLLIE)"* [sic].

#### C.10.9 The pre-tour reminder email (master §6.7, locked June 11, 2026)

- Canonical source: `island-tours-pre-tour-reminder-email-spec.md`. **Same template system as the confirmation, deliberately recognizable as its sibling.**
- **TRIGGER: sends once per confirmed booking at 24 hours before tour start, tour-local.**
- **SUPPRESSION:**
  - Bookings **created inside that 24h window get NO reminder** — the confirmation's subject variant covers it (B.83).
  - **Suppressed for cancelled, forfeited, and operator-cancelled bookings.**
- **Content — logistics card:** time, meeting point or pickup with the be-ready line and the **Maps text link**, dynamic arrival buffer per §4.4.
- **Content — booking reference** renders as a **quiet line under the greeting** (the confirmation's block-1 pattern); the reference plus an ID stays the **LD4 check-in credential**. ⚠️ The v1.6 *"Your ticket = your reference + an ID"* callout box is **DROPPED** (B.86); **LD4 itself is unchanged**.
- **Content — conditional what-to-bring.**
- **Content — payment-model block with zero-amount rows hidden:**
  - **`on_arrival`:** states the balance and accepted methods.
  - **`operator_full`:** the operator-direct total.
  - **`paid_in_full`:** **one all-paid line** — *"the only model allowed to say 'all paid'"*.
  - **`operator_link`:** a **neutral balance line that never claims payment** (B.85 — "All paid" rendering on `operator_link` surfaces is **forbidden**).
- **Content — a conditional weather line** on `weather_dependent` tours.
- **Content — operator contact named first**, with the Island Tours WhatsApp fallback (two-phase principle, §1.4).
- **NEVER a payment link** — payment links exist **only** in the operator balance email, reinforcing the C2 mitigation.
- **NO cancellation CTA** — the window has closed or is closing at send time.
- **NO balance nudge** — the `operator_link` balance state is not machine-readable in v1, and forfeit follows operator report + admin confirmation (B.84, B.85).
- Below the operational content, **soft-opt-in customers (§5.8) get the TYP-style upsell block**: *"Islanders also love..."*, **2 to 3 cross-category cards with an open departure within 7 days** (E.9), **UTM-tagged links**. **Opted-out customers receive the identical email WITHOUT the block.**
- ⚠️ **NOT BUILT.**

#### C.10.10 Copy invariants and mechanical guards

- **Never name or spotlight the operator before payment**; name deliberately post-booking on `operator_link`. ⚠️ Status: *"verify in template copy"*.
- **Always show the booking reference.** **Hide zero-amount rows.** Deposit models show deposit paid + balance due. `PAID_IN_FULL` shows total paid, no balance. `OPERATOR_FULL` shows that nothing was paid to Island Tours. `OPERATOR_LINK` explicitly names the operator **after** booking and says they will send the secure balance link.
- **Include the cancellation link to a tokenized confirmation/request page, not a raw-click cancel action.** Include the account fallback: `/bookings` lookup with email + `displayRef`.
- **THE MECHANICAL GUARD (design review round 3 — "every single style must match 100%, nothing skipped"):** the template was **rebuilt as a byte-for-byte port of the wireframe's `<template id="email-tpl">`**, and the template spec **extracts EVERY `style=""` attribute from the wireframe and asserts each appears VERBATIM in the shipped template** (only demo placeholder art, canvas padding fold, and inline-svg alignment are excluded, each with a stated reason). **A designer edit to either file fails CI on the first drifted byte.**
- **Template spec assertions** (`booking-confirmation-email.template.spec.ts`, 13 tests, rendering the **real shipped template**): every token resolves for **all 5 payment models**; **no leftover `[IF]` or `{token}`**; **zero `<svg>` and zero glyphs**; all 10 icons render as Cloudinary PNG `<img alt="">`; each optional row hides **together with its icon**; both logo/wordmark branches render.
- **Context builder** `bookings/booking-email.context.ts` is a **PURE function** (46 tokens + 3 condition-only fields); `BookingsService.assembleConfirmationContext` does the I/O, so **assembly is DB-free and every wireframe rule is unit-testable**. Deliberately render-agnostic. **The loop is closed by a test**: `booking-email.context.spec.ts` renders the REAL template with the REAL builder output and asserts **`findUnresolvedTokens() === []`** for all 5 payment models plus a minimal booking. `render-email-preview.ts` also **builds through the real builder** (it previously hand-rolled its context, so the preview could look perfect while production shipped something else).
- **Bugs found while wiring that "each one would have shipped":** (1) **`nest build` never copied the `.html`** — no `assets` entry, so `readFileSync` threw at startup in production while every test passed locally (fixed in `nest-cli.json`, `outDir: dist/src`; **`watchAssets` landed later — a dev server compiled before it keeps a STALE template in `dist`, so the dev backend must be restarted once**). (2) **`Booking.customerLocale` is a free-form `String?`, not the `Locale` enum** — added a `toLocale()` coercion ("en-US"/junk → `en`). (3) **`calendarUrl` was built off `FRONTEND_URL`** but it is an **API route**, so it would have 404'd in every inbox — now `PUBLIC_API_URL ?? BETTER_AUTH_URL`. (4) **en-GB renders USD as "US$220.00"** → `currencyDisplay: 'narrowSymbol'`. (5) Redundant tour query in `resendConfirmation` dropped.
- ⚠️ **Open conflicts flagged for the founder (not silently resolved):** (1) **`accountUrl` vs master C1** — the template footer says booking details/history/invoice *"are always in your Island Tours account at {accountUrl}"*, but master C1 states *"No account area in v1"* and asks for a lightweight booking-lookup fallback. **`/bookings` DOES exist in the code** (built after the master was written), and **B.34 RESOLVES it**: accounts ARE auto-created with email + booking-reference login. **The lookup LOGIN page itself is still to build.** (2) **Two Cloudinary accounts live**: `SiteInfo.logo` → cloud **`djqinkh2c`**, `backend/.env` `CLOUDINARY_CLOUD_NAME` → **`dsfms7jb4`**. (3) **`start:prod` is `node dist/main` but the build emits `dist/src/main.js`** — production start would fail (pre-existing; **flagged, not fixed**). (4) **English date punctuation vs Figma:** Figma demo strings were `Tue 28 May, 2026` / `Sunday, 26 May`; Intl `en-GB` produces `Fri, 24 Jul 2026` / `Wednesday 22 July` — correct day-then-month order, but the **comma sits after the weekday rather than before the year**. Matching Figma exactly needs a hand-rolled formatter that would break the other 6 locales, **so it was NOT silently hand-rolled** — decide: keep locale-correct Intl, or hand-compose for `en` only.
- **WhatsApp deep-link pattern (master §6.6):** one pattern everywhere — **`https://wa.me/{number}?text={greeting}`**; WhatsApp Web/app handles desktop and mobile natively — **no custom modal**. WhatsApp **lives in**: tour-description inline links, the global footer, error states, the NeedHelp components, **post-purchase email**. WhatsApp is **deliberately absent from**: the widget trust strip, the trust modals, and the commit moment generally. `buildWhatsappUrl()` is mirrored on both sides (`common/utils/whatsapp.util.ts` + `lib/whatsapp.ts`), normalizes to bare digits, and **returns null when disabled/unusable so callers hide the surface**. ⚠️ **OPEN:** the `?text={greeting}` half needs real copy in **7 locales** (currently linking bare `wa.me/{number}`).
- **TYP "4 guestss" bug (founder-spotted):** `getThankYou` returned the **PLURAL** label `'Guests'` for age-band-less (UNIT-priced) parties while every other label is singular, and the client pluralises against the quantity → double-pluralised. **Contract: the backend sends the SINGULAR unit; the client pluralises.** Fixed to `'Guest'`; `fmtParty` hardened so `pluralise()` skips a label already ending in 's'. *"`getThankYou` had ZERO test coverage — that is why it shipped."*
- **"Card payment only" removed from `operator_link`** (founder-approved): it was hardcoded in `thank-you-summary.tsx`, driven by **no data**, present in **no spec**, and asserted how a third party collects a balance running on the operator's own rails — **which master B.85 forbids on any surface**. The card/cash statement is only legitimate on `on_arrival`, where `Tour.onArrivalPayment` actually tells us.

---

### C.11 Queues, jobs and the outbox

> Canonical: `02-architecture/EVENT-DRIVEN-AND-QUEUES.md`. Core thesis: **"a queue is the wrong tool for capacity/overbooking, and the right tool for everything after the seat and money are settled."** Rule of thumb: **synchronous transactional core, asynchronous edges.**

#### C.11.1 Decision summary — concern → mechanism → queue?

| Concern | Correct mechanism | Queue? |
|---|---|---|
| Overbooking / two travelers race for the last seats | **Single atomic guarded `UPDATE departures`** (row-level lock) | **No** |
| Booking create + unit items + add-ons + settlement row | **One DB transaction (synchronous)** | **No** |
| Payment intent creation | **Idempotent per `(bookingId, kind)`** (synchronous) | **No** |
| Confirmation / operator-balance email | BullMQ job, retryable, idempotent | **Yes** |
| Server-side **Meta CAPI** conversion | BullMQ job, idempotent by event id | **Yes** |
| **Hold expiry** (release seats at `utcExpiresAt`) | BullMQ delayed/repeatable sweeper | **Yes** |
| Scheduled **`paid_in_full` payout** after the cancellation window | BullMQ delayed job | **Yes** |
| **Pre-tour reminder** (24h before start) | BullMQ delayed job | **Yes** |
| **Affiliate postback** (on-hold, approve after window) | BullMQ delayed job | **Yes** |
| Nightly **`quality_score` / eligibility / materialization** | BullMQ repeatable (cron) | **Yes** |

#### C.11.2 Why no queue for overbooking

- The guarded atomic `UPDATE` (§C.3.6) **is** the concurrency control; **if it affects zero rows, the booking fails**. PostgreSQL's row-level lock means **exactly one of two racing travelers wins**, at the database, **with no extra infrastructure**.
- A queue **does not remove the need for the atomic update** — you would still run it inside the consumer, so you would have **both**.
- A queue **serializes bookings**, fighting the master's **instant booking** requirement by adding latency and a new failure surface.
- Queues / virtual waiting rooms only help for true **flash-sale hot inventory** (thousands of buyers on one SKU in the same second). **A tour departure has ~20 to 40 seats and a handful of concurrent bookers.** *"Do not build for contention we will not have."*
- **"Keep the atomic guarded update. That is the overbooking and race-condition answer."**

#### C.11.3 Synchronous core, asynchronous edges

- **Stays synchronous and transactional (critical path) — inside ONE DB transaction, in order:**
  1. **Atomic seat claim** (`UPDATE departures … WHERE booked_count + :seats <= capacity`).
  2. **Create `Booking`** (+ `BookingUnitItem`, `BookingAddOn`, **`Settlement` row**).
  3. **Write an `outbox` row for each domain event** this booking emits.
- Then, **outside the transaction**:
  4. **Create the payment intent** (idempotent per `(bookingId, kind)`) — except `operator_full`, which is confirmed at commit with no charge. *(⚠️ `operator_full` is dropped in v1; that is v2 behavior.)*
- **Goes async (BullMQ jobs):** everything that is a **side effect of a state change** — email, conversion, payout, reminder, nightly recompute. **Retryable, idempotent, sometimes delayed.** They must **never block the booking response** and **never be lost if a process crashes**.
- **"Keep the critical booking path (seat claim, booking create, payment intent) off the queue entirely."**

#### C.11.4 Job inventory — job | trigger | type | idempotency key

| Job | Trigger | Type | Idempotency key |
|---|---|---|---|
| `booking.confirmation-email` | `booking.confirmed` | standard | **`bookingId:confirmation`** |
| `booking.operator-balance-email` | `booking.confirmed` **AND** `operator_link` | standard | **`bookingId:operator-balance`** |
| `tracking.capi-conversion` | `booking.confirmed` (**EUR commission present**) | standard | **`bookingId:capi`** (dedup by event id) |
| `booking.hold-expiry-sweep` | schedule | **repeatable (cron)** | **run-window guarded** |
| `settlement.paid-in-full-payout` | `booking.confirmed` **AND** `paid_in_full`, **released after the cancellation window** | **delayed** | **`bookingId:payout`** |
| `booking.pre-tour-reminder` | `booking.confirmed`, **fire 24h before start** | **delayed** | **`bookingId:reminder`** |
| `affiliate.postback` | `booking.confirmed` with attribution, **approve after window** | **delayed** | **`bookingId:affiliate`** |
| `commercial.quality-score` | **nightly** | repeatable (cron) | **run-date guarded** |
| `commercial.eligibility-enforce` | **nightly** | repeatable (cron) | **run-date guarded** |
| `availability.materialization` | **nightly** | repeatable (cron) | **run-date guarded** |

#### C.11.5 The transactional outbox pattern

- **The problem:** the gap between committing to Postgres and enqueuing the job — the commit succeeds but the process dies before `queue.add`; **or** the enqueue succeeds and the transaction rolls back.
- **The fix:** write the event to an **`outbox` table inside the same transaction** as the booking; a **relay** publishes outbox rows to BullMQ and **marks them dispatched**.
- Prisma model:
  ```prisma
  model OutboxEvent {
    id           String   @id @default(uuid())
    aggregate    String   // 'booking'
    aggregateId  String   // bookingId
    type         String   // 'booking.confirmed' | 'booking.cancelled' | 'payment.succeeded' | 'hold.expired'
    payload      Json
    dispatchedAt DateTime?
    createdAt    DateTime @default(now())

    @@index([dispatchedAt])
    @@map("outbox_events")
  }
  ```
- **Domain event types enumerated:** `booking.confirmed`, `booking.cancelled`, `payment.succeeded`, `hold.expired`.
- **Guarantee:** "booking confirmed" **always eventually fires its email, conversion, and payout — exactly once in effect.**
- **Producers** are services that, after commit, publish outbox rows (the **relay** calls `queue.add`). **Consumers** are `@Processor` classes; **each is idempotent and re-validates booking state before acting.**

#### C.11.6 Reliability rules

- **Idempotent consumers — two layers:**
  - **Queue-level dedup via a custom `jobId`:** BullMQ ignores a second `add()` with an existing `jobId` and emits a `duplicated` event. Use a deterministic key (e.g. `bookingId:confirmation`).
    - **⚠️ CAVEAT:** `removeOnComplete` / `removeOnFail` remove the job from the queue, after which **the same `jobId` is no longer seen as a duplicate**. **Do NOT rely on `jobId` dedup alone for correctness.**
  - **DB-level guard is the real backstop:** **`conversion_fired_at` is stamped before the conversion payload is exposed (mark-first)**, and **Stripe events are recorded in `stripe_webhook_events` before processing**. **Each consumer checks and sets its own guard.**
- **Retries and backoff:** configure `attempts` with **exponential backoff** so a transient email/provider failure retries instead of dropping. BullMQ delay grows as **`2^(attempt-1) * delay`**. Reference config:
  ```typescript
  await queue.add('booking.confirmation-email', { bookingId }, {
    jobId: `${bookingId}:confirmation`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, 16s
    removeOnComplete: 1000,
    removeOnFail: false, // keep failures for inspection / DLQ
  });
  ```
- **Delayed jobs (fire once, later):** the scheduled `paid_in_full` payout and the pre-tour reminder use `{ delay: msUntilTarget }`. **Compute the delay from tour-local time** (payout: after the cancellation window closes; reminder: 24h before start). **Re-check state in the consumer**, because the booking may have been cancelled or refunded meanwhile.
- **Repeatable / cron jobs** (hold-expiry sweep, nightly jobs) use the **Job Scheduler**:
  ```typescript
  await queue.upsertJobScheduler('nightly-quality-score',
    { pattern: '0 15 3 * * *' }, // 03:15 daily
    { name: 'commercial.quality-score',
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnFail: 1000 } });
  ```
  Delayed and repeatable jobs need the **BullMQ scheduler running**; the modern **`upsertJobScheduler`** API **supersedes** the older `QueueScheduler` + `repeat` pattern.
- **Failed jobs: do NOT silently drop.** Keep them (`removeOnFail: false` or a numeric retention) and **surface them** (Bull Board or an admin view) so a stuck payout/conversion is visible.
- **A confirmed booking with a null `commission_amount` is data corruption** (master §8) — **the conversion job must FAIL LOUDLY, not fire.**

#### C.11.7 Implementation notes (BullMQ + NestJS)

- BullMQ is **Redis-backed**; register once and add **a queue per bounded concern** (**or one queue with named jobs for v1 simplicity**). Use **`@nestjs/bullmq`**.
- Worker concurrency capped so one worker does not starve the pool: `new Worker('platform', processor, { connection, concurrency: 10 })`.
- **One Redis, one connection config** — mirroring the "only one Prisma instance per process" rule.

#### C.11.8 What NOT to do

- **Do NOT** route bookings through a queue to prevent overbooking — the atomic guarded update is correct and sufficient.
- **Do NOT** adopt **Kafka, SNS, or event sourcing** — BullMQ + a lightweight domain-event/outbox layer is correctly sized for a tour marketplace.
- **Do NOT** use an in-process emitter (**`@nestjs/event-emitter`**) for anything that must not be lost — **not durable, disappears on crash**. Fine only for non-critical best-effort in-process fan-out; **everything money- or customer-facing goes through the durable queue + outbox.**
- **Do NOT** rely on `jobId` dedup alone once `removeOnComplete`/`removeOnFail` are set — keep the DB-level idempotency guard.

#### C.11.9 Mapping to the booking-flow edge cases

- Two users race for the last seats → **atomic guarded update, one winner**.
- Departure closes / cutoff passes after the calendar read → **the atomic update's `WHERE status='open'` fails the claim**.
- Payment intent retried → **provider idempotency key + `(bookingId, kind)`**.
- Webhook redelivered → **`stripe_webhook_events` ledger before processing**.
- Payment succeeds after the hold expired → **the consumer re-validates state; prefer refund/void over confirming an expired hold**.
- TYP refresh / email revisit double-fires the conversion → **mark-first `conversion_fired_at` DB guard**.
- Cancellation refunded after the operator was paid → **the payout is delayed until after the cancellation window, so this cannot happen for `paid_in_full`**.

#### C.11.10 ⚠️ SPEC-SAYS-BullMQ-CRON vs CODE-USES-`@nestjs/schedule` — the divergence

- **The spec (EVENT-DRIVEN-AND-QUEUES.md §1 and §4)** lists the **nightly `quality_score` / eligibility / materialization** jobs — and the **hold-expiry sweep** — as **BullMQ repeatable (cron)** jobs, driven by `upsertJobScheduler`.
- **The code does NOT do this for the nightly work.** `NightlyJobsService` is a **plain in-process `@nestjs/schedule` cron (03:00 UTC)**, explicitly **NOT BullMQ**, with the stated rationale: *"idempotent recomputes, not a retry/concurrency queue."* The same convention is applied to **`FxRefreshService`** (startup refresh + a dynamic `SchedulerRegistry` interval), which likewise declares *"in-process `@nestjs/schedule` (no BullMQ), matching `NightlyJobsService`."*
- A **stale comment** in `availability-materializer.service.ts:42-43` still says **"nightly BullMQ job"** — **wrong; ignore it.**
- **BullMQ IS installed and wired**, but for different concerns: *"queues exist for media-upload, notifications; one nightly cron"* (`app.module.ts`, `workers/nightly-jobs.service.ts`).
- **The hold-expiry sweeper is the one place the divergence bites:** the spec says BullMQ repeatable; the code has **neither** — `expireStaleHolds()` exists but **nothing calls it** (see §C.3.7).

#### C.11.11 Queue/job build status

- `[x]` **BullMQ + `@nestjs/schedule` installed and wired** (queues for media-upload and notifications; one nightly cron).
- `[x]` **Synchronous transactional core** — seat claim + booking + payment intent stay off the queue.
- `[x]` **No queue for capacity/overbooking** — the atomic update is the control.
- `[ ]` **Transactional outbox** — `OutboxEvent` model **ABSENT**; no relay.
- `[ ]` **Confirmation-email job (queued, retry + backoff)** — **inline today**.
- `[ ]` **CAPI conversion job (queued, idempotent by event id)** — inline today.
- `[ ]` **Hold-expiry sweep job (repeatable)** — **unwired**.
- `[ ]` **Scheduled `paid_in_full` payout job (delayed)** — not built.
- `[ ]` **Pre-tour reminder job (delayed)** — not built.
- `[ ]` **Affiliate postback job (delayed, approve after window)** — not built.
- `[~]` **Nightly quality-score / eligibility / materialization (cron)** — **materialization / bookability / spotlight / demand are DONE**; **quality-score and tier eligibility/grace/demotion are TODOs**.
- `[~]` **Idempotent consumers** — DB guards exist (`conversion_fired_at`, `stripe_webhook_events`); once jobs move to the queue, **add `jobId` dedup and KEEP the DB guards** — do not rely on `jobId` alone.
- `[ ]` **Retries + exponential backoff, and keep failed jobs (no silent drop)** — applies once jobs are queued.
- ⚠️ **CRITICAL FLAW 5 (`[~]`):** *"Conversion/email fire inline with mark-first stamp, no queue/outbox."* `conversionFiredAt` is set **before** email/CAPI run, so **a CAPI/email failure is never retried and the conversion is lost.** `Code: bookings.service.ts:finalizeConfirmation`.

---

### C.12 Reference: booking-side entities (master Appendix E.8 + code)

#### C.12.1 `Booking` — E.8 field register

- **Identity & status:** `public_ref` `uuid NOT NULL UNIQUE` (TYP URL credential; **random, never incremental** — booking URLs **cannot be enumerated**) · `display_ref` `varchar NOT NULL` (customer-facing, format **`IT-2026-XXXXX`**; the **transaction id in all tracking** and, **with the email, the account login**) · `status` enum · `island` `varchar NOT NULL` (**denormalized from the tour at creation**, default **`'Curaçao'`**; **stable under future tour relocation**).
  - Token roles locked: `publicRef` (UUID `@unique @default(uuid())`) = **URL token only**, never the DB `id`, never the human ref · `displayRef` (`IT-YYYY-XXXXXXXX`) = customer-facing, **never in the URL** (sequential/guessable → enumeration risk) · `id` (DB PK, client-suppliable as the reserve idempotency key) = **authenticated mutations only**.
- **Money & commission:** `original_currency` `char(3)` (**USD or EUR**; what Stripe charged; on `operator_full` the **session display-currency snapshot**; **every customer-facing amount renders in this currency**) · `original_amount` `decimal(10,2)` · `booking_total_eur` `decimal(10,2)` · `fx_rate_to_eur` `decimal(10,6)` (**snapshot at booking time, audit trail**) · `deposit_amount` `decimal` (**TYP balance row = `original_amount − deposit_amount`** in the original currency; **0 on `operator_full`**) · `payment_method_last4` + `brand` (from the Stripe payment method; **null on `operator_full`**) · `commission_rate` `decimal(5,4)` · `commission_amount` `decimal(10,2)` **in EUR** · `payment_model` enum (**snapshotted from the tour at creation**, added via the C5 migration).
- **Attribution & idempotency:** `conversion_fired_at` `timestamptz NULL` (mark-first guard, set server-side before render) · `gclid`, `gbraid`, `wbraid`, `fbclid` (**click ids captured at booking creation**; required for adjustments and offline conversions) · `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` · `affiliateId` (Trackdesk).
- **Customer identity & billing:** `customer_first_name` + `customer_last_name` (**stored SPLIT** — the checkout form asks separately; improves Enhanced Conversions match rate by **+20 to 40%**; legacy single-field names **parse heuristically**) · `customer_email`, `customer_phone` (**normalized to E.164 via `libphonenumber-js`**) · `customer_id` (**hash of the email**; GA4 `user_id` for cross-device tracking) · `customer_locale` (**captured from day one** under the 7-locale scope; drives localized TYP and email) · `billing_country` `char(2)`, `billing_postal_code`, `billing_city` (pulled from the Stripe payment method **during webhook handling**; **null on `operator_full`**).
- **Timestamps & tour instant:** `utcExpiresAt` / `utcConfirmedAt` / `utcRedeemedAt` / `utcCancelledAt` / `utcCancellationRequestedAt` · `localDate` · `startTime` (`'HH:MM'`) · `tourStartDateTime` + `tourEndDateTime` (**master E.8 core** — the TYP time range, ICS invite, 24h reminder and `cancelDeadline` calc all need a full start timestamp; derive the end from start + duration and **snapshot it**) · `tourTimeZone`.
- **Snapshots at booking time:** `paymentModel` · `currency` · `pickupRequested` · `pickupLocationId` (null = meet on site) · `pickupAddress` (TYP fallback = the tour meeting point; **snapshotted for immutability since `PickupLocation` can change**) · `pickupMinutesPrior` / `pickupWindowStart` / `pickupWindowEnd` · `onArrivalPayment` (null unless `paymentModel = ON_ARRIVAL`) · `exclusiveDeparture`.
- **Pricing snapshot:** `totalRetail` `Decimal(10,2)` · `totalNet` · `commissionRate` `Decimal(5,4)?` · `commissionAmount` · `depositAmount` · `balanceAmount` · `taxes` `Json?` ("All taxes and fees included") · `totalEur` · `fxRateToEur` `Decimal(12,6)?` · plus the source-currency block (§C.9.6).
- **Contact (OCTO Contact; guest override of User):** `contactFirstName` / `contactLastName` / `contactFullName` / `contactEmail` / `contactPhone` / `contactCountry` (dial code "+599" in the widget) / `contactPostalCode` / `contactLocales` · `notes` (= "Special requests (optional)", **cap 500 chars**) · `newsletterOptIn` (Figma "Send me the good stuff…" opt-in).
- **Cancellation:** `cancellationRefund` (`FULL`/`PARTIAL`/`NONE`) · `cancelledBy` (`CUSTOMER`/`OPERATOR`/`ADMIN`/`SYSTEM`) · `cancellationReason` · `utcCancelledAt`.
- **Other:** `uuid` (OCTO client-supplied idempotency key) · `tourId` / `operatorId` / `departureId` (null when `freesale`) / `userId` (guest auto-created; **accounts are auto-created at booking**) · `resellerReference` / `supplierReference` (OCTO external refs) · `freesale` / `testMode`.
- **Party composition:** master E.8 lists `adults_count`, `children_count` **plus child ages**; the TYP renders "2 adults, 1 child". Counts are **derivable** from `BookingUnitItem` grouped by `ageBand.bandType` — add columns only for a hot query.
- **⚠️ The `DATA-MODEL.md` "Booking is thin" note is STALE.** Already complete, do NOT re-add: `publicRef`/`displayRef`, the full commission + EUR-normalization block, the `paymentModel` snapshot, split contact name + E.164 phone + locale, the billing snapshot, all UTM + click-id attribution, `conversionFiredAt`, `BookingUnitItem`, `BookingAddOn`, and the Stripe ledger.
- **⚠️ Distinct `gclid` column:** only a generic `clickId` exists; the tracking spec names `gclid` separately. **Decide whether to rename/split.**
- **Naming reconciliations (semantics match, no change):** `currency` = `original_currency` · `totalRetail` = `original_amount` · `totalEur` = `booking_total_eur` · `fxRateToEur` = `fx_rate_to_eur` · `contactFirstName/LastName` = `customer_first_name/last_name` · `contactEmail/Phone` = `customer_email/phone` · `customerId` = `customer_id` · `notes` = special requests.

#### C.12.2 `BookingUnitItem` — one row per traveler/ticket

- `id` / `uuid` (OCTO ticket uuid) · `bookingId` (cascade) · `ageBandId` (priced at the band sold; **spectators flow here via a `SPECTATOR`-participation band**) · `status` / `utcRedeemedAt` (per-ticket redemption) · `contactFirstName` / `contactLastName` (optional per-unit) · `travelerAge` `int?` (**+ TO ADD** — not derivable from `ageBandId`; needed for min-age enforcement, equipment and tracking) · `priceRetail` / `priceNet` (snapshot, in booking currency) · `ticketCode` / `ticketDeliveryFormat` / `ticketUrl` (OCTO delivery artifact).
- **ALL unit items count toward departure capacity, including infants and spectators.**

#### C.12.3 Remaining "gaps to add" ledger (BOOKING-AND-PAYMENT-DATA)

| # | Change | Where | Basis |
|---|---|---|---|
| 1 | Add `tourStartDateTime` + `tourEndDateTime` | `Booking` | Master E.8 core; TYP time range, ICS, 24h reminder, deadline calc |
| 2 | Add `travelerAge` `int?` | `BookingUnitItem` | Master child ages; min-age enforcement |
| 3 | Add `pickupAddress` `string?` snapshot | `Booking` | Master `pickup_address`; booking immutability |
| 4 | Add `newsletterOptIn` `bool` | `Booking` | Figma checkout opt-in |
| 5 | Cap `notes` at **500** chars | DTO | Figma "Max 500 characters" |
| 6 | Make `island` NOT NULL (default `'Curaçao'`) | `Booking` | Master E.8 |
| 7 | Add `methodType` `string?` | `Payment` | Figma 4 payment methods |
| 8 | Mollie webhook idempotency | `payments.prisma` | If Mollie is live |
| 9 | (design) `couponCode` + `discountAmount` + a `Coupon` entity | `Booking` + new | Figma "Apply"; **confirm against the commercial model FIRST** — not in the master tables and it **affects commission math** |

- ⚠️ **Discount/coupon DEFERRED (founder decision 2026-07-16):** a client-supplied `discountAmount` / `couponCode` is **untrusted with no server-side coupon engine** (a client could grant itself 100% off), so it is **NOT applied** — full price stays authoritative and **no phantom discount is written**. The untrusted DTO fields and write-through were **removed**. Re-add (validated) when a `Coupon` engine ships.

#### C.12.4 Age-restriction validation status

- ⚠️ `[~]` **Only the tour minimum age is enforced, and only when `travelerAge` is supplied** (ages are optional). **No max age, and no requirement that ages cover all seats.** `Code: bookings.service.ts:validateRestrictions`.

---

## D. Public Site Pages, Discovery, Accounts, Auth & Tracking

> Sources: `frag-master-1.md` (§1.3–§1.4, §2, §3.4–§3.12, §5 page specifications), `frag-master-3.md`
> (Fixes, filter modal, hub/collection sections, Locked Decisions LD1–LD33, CMS model, above-the-fold,
> TYP microcopy + server flow, search, widget, states, trust, ranking, schemas), `frag-architecture-c.md`
> (routing/SEO/tracking), `frag-client-wireframes.md` §B–§I (the login corpus), `frag-crosscutting.md`
> (A12 homepage CMS + Pages, A13 customer accounts, A14 traveler session, A16 category two-listing),
> plus the affiliate block carried in from `frag-architecture-b.md` §8 (item 13 of the brief).
>
> Locked copy is reproduced verbatim in `backticks`. Conflicts are marked `⚠️ CONFLICT` with both claims.

---

### D.1 Page specification template (applies to every page below)

- Every page spec follows the same template: **job, URL, section order, locked elements, conditionals,
  schema, tracking**.
- Deep wireframes live in the named canonical source file per page.
- Rendering per page type (master §2.5): Homepage ISR 60s · Destination ISR 60s · All Tours ISR 60s ·
  Category ISR 60s · Collection ISR 60s · Activity Hub ISR 300s · Tour detail ISR 30s · Search results
  SSR, not cached · Thank You server-rendered, n/a (`noindex`).
- All content API endpoints accept a `locale` query parameter defaulting to `en`, with English fallback
  for missing translations.

---

### D.2 URL model, locales and currency (the frame every page sits in)

- **Exactly two public URL shapes, both locale-prefixed:** `/{locale}/{destination}/` (2 segments,
  destination page) and `/{locale}/{destination}/{slug}/` (3 segments: category | hub | collection |
  tour | reserved `tours`).
- **There is no fourth segment.** Tours are flat, never nested under a category or hub; there is no
  `/tour/` path segment. Any deeper undefined path is a `404`.
- Canonical URL pattern `/{locale}/{destination}/{slug}/` with **trailing slashes canonical**.
- Locale prefix always present for content pages: `/en/`, `/nl/`, `/de/`, `/fr/`, `/es/`, `/pt/`, `/zh/`.
- No-prefix requests **302-redirect** via `Accept-Language` detection, defaulting to `/en/`.
- Middleware config: `createMiddleware({ locales: ['en','es','nl','pt','fr','de','zh'], defaultLocale:
  'en', localePrefix: 'always' })` (next-intl).
- **Slugs are English at every locale.** The locale prefix selects the translation and never changes the
  slug. `/nl/curacao/boottochten/` is wrong.
- **Three invariants:** (1) one canonical URL per tour; (2) all third-segment entities share one
  `(destination, slug)` namespace; (3) slugs are English at every locale.
- The `{destination}` segment resolves directly against `Destination.slug` — **no registry lookup**.
- The `{slug}` segment is polymorphic and resolved by the slug registry via
  `GET /api/v1/slug-registry/resolve?destinationSlug=&slug=` (`@Public()`, locale-independent, cacheable).
- Routing switch: `CATEGORY` → `<CategoryPage>`, `HUB` → `<HubPage>`, `COLLECTION` → `<CollectionPage>`,
  `TOUR` → `<TourPage>` (fetched by flat slug, does not need `entityId`), `RESERVED` →
  `<AllToursListing>`, default → `notFound()`.
- **Two independent 404 layers:** registry 404 (slug unknown or `isActive=false`) and gating 404
  (category resolves but has fewer than 3 published tours). Gating applies to **categories only**.
- Exception: the Thank You page `/{destination}/thank-you/{bookingRef}` carries **no locale prefix** and
  is `noindex`.
- **Seven locales from launch**, English primary: EN, NL, DE, FR, ES, PT, ZH.
- **Display currency defaults per locale (LOCKED June 10, 2026):** EN, ZH → **USD**; NL, DE, FR, ES, PT →
  **EUR**.
- A **currency selector in the global footer** lets the user override the locale default; the override
  **persists for the session**.
- **The nav never carries the currency selector.**
- IP-based currency localization is roadmap, not launch.
  - **EXECUTED 2026-07-21 (geo-preselected currency):** brought forward from roadmap on request. The
    footer selector now **opens on the visitor's own currency instead of the locale default**, chosen
    from location - still strictly a choice between the two supported currencies, EUR or USD, and
    still only ever the *initial* value: a stored `NEXT_CURRENCY` (an explicit pick, or an earlier geo
    pick) is never overwritten.
    - **One input, one writer.** Geo writes the `NEXT_CURRENCY` cookie and nothing else;
      `getServerCurrency` still reads only that cookie, so prices keep resolving through exactly one
      path and the pill can never disagree with the prices next to it.
    - **`proxy.ts`** resolves the visitor's country from the edge (`x-vercel-ip-country`, plus
      `cf-ipcountry`/`x-country`) and sets the cookie **on the same redirect that picks the locale** -
      so anyone arriving at `/` or `/curacao` gets a first paint already in their currency.
    - **`CurrencyAutoDetect`** (first child of the locale layout, renders nothing) covers deep
      landings straight onto `/{locale}/...`, which the proxy matcher deliberately excludes, and
      hosts that report no country at all. It reads the **browser clock's time zone** - the one
      location signal with no network round trip, no third-party lookup, and no permission prompt -
      then refreshes once so the server re-renders prices in the new currency. Mounted first because
      the nav/hero search, wishlist, and footer pill all read the cookie in their own mount effects.
    - **The rule is one question** (`lib/currency/geo.ts`): is the visitor in Europe? EU 27 + EEA + UK
      + CH + the euro microstates + the Western Balkans → EUR; everywhere else → USD, which is also
      right for the Caribbean itself (Curaçao and Sint Maarten quote in USD, Aruba's florin is
      dollar-pegged). Turkey and Russia sit partly or wholly in Europe but price international travel
      in dollars, so they fall through to USD. An unreadable signal returns `undefined` rather than a
      guess, leaving the locale default in place.
- Locale-aware number formatting applies: `$1,234.56` vs `€1.234,56`.
- `destination.currency` stays in the data model for operator/payout context; it does **not** drive
  display currency.
- ⚠️ CONFLICT — currency on cards: `[ALLTOURS-IMP]` says cards currently show `€` and that **USD is the
  primary currency at launch, EUR a footer switcher option**, default display `$`; §1.3 instead makes the
  default **locale-derived** (EUR for five of seven locales). Both are recorded as locked.

---

### D.3 Homepage

- **Job:** get the user to choose an island. **Single primary action.**
- **URL:** `/{locale}/`.
- **Sources:** `Section4_Homepage_DestinationPage-V2.pdf` (newest surviving spec) plus the June 10, 2026
  homepage Figma (hero H1, micro trust bar, NeedHelp). The final spec file was lost; deviations from V2
  are marked.
- **Section order — eight specced sections plus the trust component from the cross-surface matrix (10 rows):**
  1. Navigation bar, homepage variant (§3.9).
  2. Hero — spec structure; H1 per the June 10 Figma.
  3. Micro trust bar.
  4. Video carousel.
  5. Social proof strip.
  6. Featured destinations.
  7. Editorial banner (launch-only slot).
  8. Why Island Tours.
  9. Need help before booking? (full, with FAQ column) — added by trust matrix §3.11.
  10. Footer.
- Hero (locked): full-bleed Caribbean aerial image, dark gradient bottom-to-top, **CMS-managed per locale**.
- **H1 LOCKED June 10, 2026:** `We didn't discover the Caribbean. We grew up in it.`
- The H1 is a deliberate **subversion** of the LD9-banned word "discover" — a sanctioned exception, not a use.
- The H1 requires a **translation test per locale** so the cliché reversal survives outside English.
- H1 runner-up, held as the post-launch A/B variant: `These are our islands. Let us show you around.`
- **Subheadline LOCKED:** `Chosen by locals. Made for travelers.`
- Destination search input: centered and dominant; **placeholder LOCKED** `Which island?`.
- Hero search is a **single field**; **no date field on the homepage**.
- On focus: destination selector panel (dropdown on desktop, full-screen on mobile).
- On selection: navigate to `/{locale}/{destination}/`.
- **Popular quick links LOCKED:** `Popular: Curaçao · Aruba · Sint Maarten`.
- Quick links are **CMS-ordered**; they become a horizontal scroll row on mobile if overflowing.
- Micro trust bar: full-width light band directly below the hero, 3 columns desktop, stacked mobile,
  icon + bold label + one-line clarification, **no CTA, no border**.
- Trust bar row 1 — label `Pay as little as 20% today` — clarification `Secure your spot now, pay the rest later`.
- Trust bar row 2 — label `Plans change. No problem` — clarification `Free cancellation on every tour, no questions asked`.
- Row 2 is **hour-free by design**: the exact window lives where it is known per tour (widget, tour page,
  modal, email). The **universality claim is played exactly once, on the platform front door**.
- Trust bar row 3 — label `We're locals. Here to help` — clarification `Message us on WhatsApp, 08:00 to 20:00`.
- The Figma's "8am to 10pm" was **rejected** against the confirmed operational fact (08:00–20:00).
- The `Chat 24/7` claim **stays excluded** until a chatbot channel exists.
- Video carousel: center-active card with flanking partials, progress lines; **2.5 cards visible on mobile**.
- Social proof strip: Trustpilot aggregate plus rotating review quotes.
- **Social proof strip renders only at 100 or more platform reviews.**
- Homepage sections carry the **peach/ivory tint on card #1** (curated-list rule, §D.10).
- **Tracking:** standard GA4 page view; destination selection fires `select_content`.
- ⚠️ CONFLICT — trust-bar cancellation copy: B.72 records the Figma line `Free cancellation on most tours,
  up to 24h before` (founder decision over the 48h recommendation, "honest only while most live tours
  carry 24h windows"); B.75 then supersedes it with `Free cancellation on every tour, no questions asked`
  (hour-free). The **LD1 platform default stays 48h** either way.

---

### D.4 Destination page

- **Job:** island overview; route the user into a discovery layer or a featured tour.
- **URL:** `/{locale}/{destination}/`.
- **Sources:** V2 PDF destination sections plus the April 2026 destination review, which supersedes the
  spec on every copy point; the June 10, 2026 locks supersede the review where marked.
- **Section order (review-locked):** Nav (full destination context) → Hero → Breadcrumbs (below hero,
  desktop only; **hidden on mobile** per the LD8 divergence) → Category quick links → Featured tours →
  Instagram grid → Need help before booking? → Destination description → Footer.
- Hero: destination image, search + date fields via `<HeroSearch />`.
- `<HeroSearch />`: search **scoped to the destination**; single-month date picker, **12 months forward**;
  submit navigates to `/{locale}/search?q={query}&destination={dest}`.
- **H1 LOCKED June 10, 2026:** `{Destination} tours & activities` — **sentence case** (e.g.
  `Curaçao tours & activities`). The Title Case form is superseded.
- **Subheadline LOCKED:** `Tours picked by locals who know every reef, route, and sunset spot.`
- Popular quick links: top 3 from the curated discovery list, slug-registry-resolved.
- Category quick links: `<CategoryQuickLinks />`, **7 to 8 cards** from the curated discovery list,
  **excluding All Experiences**; horizontal scroll, 5–6 visible desktop, 2.5 mobile.
- **Category quick links header LOCKED:** `Explore by type`.
- **Featured tours header LOCKED:** `Locals' favorites`.
- Featured tours: **2 rows of 3 cards**, populated by the `is_locals_favourite` editorial flag.
- **No numbered badges** on the Featured tours section.
- **Featured tours CTA LOCKED:** `See all {Destination} tours →` linking to `/{locale}/{destination}/tours/`.
- At **20 or more published tours** the CTA carries the dynamic count: `See all {count} {Destination} tours →`.
- **Below 20 published tours no count is shown**, to avoid signaling scarcity.
- Instagram grid: brand handle row per review.
  - **EXECUTED 2026-07-21 (phase 1 - admin-curated feed):** the grid was hardcoded (six bundled JPGs, a
    hardcoded `@island.tours_` handle) and `SiteInfo.instagramWidgetId` was the abandoned start of a
    third-party embed that nothing ever read. Both are gone. New **`instagram` backend module**
    (`instagram.prisma`: `InstagramAccount` singleton + `InstagramPost`; enums `InstagramSource`,
    `InstagramMediaType`; migration `20260721160000_instagram_feed`, which also **drops
    `instagramWidgetId`**). Public `GET /instagram/public/feed?destination=&limit=` returns the handle,
    profile link and tiles in one call; admin CRUD + reorder sits behind `VIEW_SETTINGS` /
    `MANAGE_SETTINGS`. Public site renders `components/frontend/instagram/instagram-grid.tsx` from
    `lib/api/public/instagram.ts` (`'use cache'`, new coarse tag **`instagram`**, added to
    `lib/cache-tags.ts` in BOTH repos). Dashboard gets a **Settings > Instagram** tab (handle card +
    tile grid: media-library photo, permalink, caption, alt override, per-island pin, show/hide, arrow
    reorder), and dashboard writes bust `instagram` via `cache-revalidation.ts`.
  - **Why first-party, not a widget:** an iframe embed cannot be server-rendered into this prerendered
    page, brings consent-managed cookies into six EU locales for a decorative strip, and cannot be
    styled to the Figma grid. **Instagram `media_url` CDN links expire within days and hotlinking them
    breaks their terms**, so a tile's photo is always a URL we control.
  - **Gates (all three collapse to "render no section"):** `SiteInfo.enableInstagram` off, zero live
    tiles, or no handle set. A handle row over an empty grid is worse than no section.
  - **EXECUTED 2026-07-21 (phase 1b - video tiles + two layouts):** a feed of only stills could not
    represent reels, so `InstagramPost` gained **`videoUrl`** (migration `20260721170000_instagram_video`,
    which drops the redundant `thumbnailUrl`): `imageUrl` is now the still the grid always paints and
    **doubles as the poster**, so a reel never flashes black and a reduced-motion visitor sees the
    photo. **`mediaType` is DERIVED, never client-set** - VIDEO when a video is attached, otherwise the
    admin's IMAGE/CAROUSEL_ALBUM choice (that one describes the linked post, which we cannot see).
    Playback is `components/frontend/instagram/instagram-tile-video.tsx`: muted + `playsInline`, loaded
    and played only within 200px of the viewport, paused on exit, and **rendered not at all under
    `prefers-reduced-motion`**.
  - **Two layouts, admin-chosen** (`InstagramLayout` on `InstagramAccount`, migration
    `20260721180000_instagram_layout_and_badges`): **GRID** = the curated Figma band (2/3 columns,
    rounded 384x337 cards, 6 tiles); **GALLERY** = the Instagram profile look (3/6 columns of 4:5
    portraits, tight gutters, 18 tiles). The layout rides the public feed payload, so switching it is
    a content decision, not a deploy. `getPublicFeed` takes its default tile count FROM the layout
    (6 / 18); an explicit `limit` still wins. Frontend split: `instagram-section.tsx` (fetch + gates +
    handle row) → `instagram-grid.tsx` | `instagram-gallery.tsx`, both rendering the shared
    `instagram-tile.tsx`, so the two can never drift on media handling.
  - **Dashboard:** the on/off switch MOVED off Integrations onto the Instagram tab, beside the handle,
    layout selector and tiles it governs (a toggle three tabs from what it turns on is how the old
    widget-ID field went unnoticed). Tile dialog gains an optional media-library **video**, a post-type
    (photo/carousel) choice and a pin toggle. `isPinned` is **badge-only and never reorders** -
    `displayOrder` owns order.
  - **Corner badges DECIDED 2026-07-21: on, in both layouts.** Reel / carousel / pin glyphs
    (`public/icons/instagram-{reel,carousel,pin}.svg`) sit top-right; **a single photo carries none**,
    matching Instagram - a badge on every tile would only label a photo as a photo. Pin outranks the
    media badge when a post is both. They are `pointer-events-none` LABELS: the whole tile stays one
    outbound link. (They were briefly removed on the argument that this is Instagram's product chrome;
    reinstated by decision - without them a still and a reel are identical until the reel plays.)
  - **PENDING (phase 2 - API sync):** Instagram Login OAuth + encrypted token (`INSTAGRAM_TOKEN_SECRET`,
    the 3-file env change), daily sync job mirroring media into Cloudinary, and the **60-day long-lived
    token refresh** (`GET /refresh_access_token`, token must be ≥24h old and unexpired; refresh at
    <10 days with an admin warning at 7). Needs an Instagram **Business/Creator** account and Meta app
    review for `instagram_business_basic`. Rows land in the same tables as `source = API`; the frontend
    does not change. Synced tiles reject edits to sync-owned fields (photo/caption/permalink) but stay
    curatable (order, visibility, pinning, alt text).
- Destination description section: `About tours in {Destination}` — **350 to 500 words, exactly 3 H2s**,
  SEO content from the destination model.
- **SEO ownership lock:** the destination page owns destination-level keywords and About content;
  category-specific About content lives on the category pages.
- **No Trustpilot badge** on the destination page at launch: a thin review base is a liability, not a
  trust signal.
- Trust component: full "Need help before booking?" with FAQ column (§3.11).
- Footer islands: Curaçao · Aruba · Sint Maarten.
- **Schema:** `BreadcrumbList`; `FAQPage` on the NeedHelp FAQ column.
- Destination-page top-tour sections carry the **peach tint on card #1**.

---

### D.5 All Tours page

- **Job:** complete filterable catalog per destination.
- **URL:** `/{locale}/{destination}/tours/` (**reserved slug**).
- **Canonical source:** `Section4_3_AllToursPage.md`.
- **H1 LOCKED June 10, 2026:** `All {Destination} tours & activities in {year}`.
- `{year}` **MUST be a CMS variable resolving to the current year at render time.** Do **NOT** hardcode
  "2026" — a hardcoded year becomes a stale H1 in January 2027, working against the freshness signal it
  exists to provide.
- The `<title>` tag and meta follow the same `{year}` variable; keep visible H1 and page title aligned.
- The spec variant "All Tours in {Destination}" is superseded.
- Rationale for the H1: "tours" alone undersells the catalogue (we also sell standalone activities:
  jetski, diving, snorkeling sessions); the page must read transactional for commercial-intent and Ads
  traffic. Pattern reference: Viator "All Curacao Tours & Excursions in 2026".
- The added "All" + year + word-order shift differentiates this H1 from the destination H1 enough to
  avoid keyword cannibalization while both carry the right keywords.
- **Role (locked, review v2):** transactional utility page — **not an Ads-only throwaway and not an SEO hub**.
- The destination page owns destination keywords; **this page owns long-tail filter queries**.
- **No About content block** on All Tours.
- Ads routing: broad campaigns ("curacao tours") land here; specific campaigns land on the matching
  category or tour page.
- **Stack order:** page header (H1, orientation line, static count `{Y} tours available`) → filter row
  with Filters modal and category chips → 3-column grid of shared tour cards → pagination → compact trust
  strip → footer.
- **Grid: 3 × 6 = 18 per page.** Mobile 1 column with pagination after 12.
- Grid-density rationale: 3×3 = 9/page means 4 pages at 32–34 tours, each a conversion drop-off point;
  industry standard is 15–25/page (GetYourGuide 20, Viator 30). At 18/page with 32 tours: 2 pages total.
  Vertical card format unchanged — only more cards per page.
- **Orientation line (locked):** `From Klein Curaçao day trips to buggy adventures. Every tour we offer on the island.`
  - Supersedes the wireframe line "From catamaran trips to off-road adventures — everything we offer on the island."
  - Reason 1: Klein Curaçao is the strongest SEO anchor for the destination — far higher search volume
    than "catamaran".
  - Reason 2: "every tour we offer" reads as concrete completeness; "everything we offer" is vaguer.
  - The orientation line is **CMS-managed per destination**; Aruba and Sint Maarten get their own
    locally-strong tour-type pairs at launch.
- **Compact trust strip (four checkmarks, current platform copy):**
  - `Free cancellation, no questions asked`
  - `Pay as little as 20% today, the rest later`
  - `Confirmed in seconds`
  - `Safe & secure checkout`
  - Plus the inline link `Questions? Chat on WhatsApp →`.
  - Checkmarks **stack vertically on mobile** (1 column), WhatsApp link below.
  - **No FAQ accordion here** (FAQ lives on the destination page only) and **no payment logos** (footer only).
  - The trust strip is inserted **between pagination and the SEO block** where a SEO block exists; the two
    serve different purposes and both must appear.
  - ⚠️ CONFLICT — an earlier `[ALLTOURS-IMP]` lock states the same strip with the copy
    `✓ Free cancellation — no questions asked` / `✓ Reserve from 20% · pay the rest later` /
    `✓ Confirmed in seconds` / `✓ Safe & secure checkout`; §5.3 records the later platform copy above.
    §3.11 also states the deliberate component split: the NeedHelpSection carries **two** checkmarks while
    the All Tours compact strip keeps **four** — "different components, design must not harmonize them."
- **Dual count** and applied-filter pills per §3.12; the results counter carries the ranking tooltip.
- Grid order per the ranking rule plus the diversity pass.
- **Peach tint on card #1 is conditional here:** it applies **only while Sort = "Locals' favorites"** (the
  curated default). Under Price Low-High or Price High-Low the ranking becomes dynamic and the tint
  **MUST be removed**.
- **Schema:** `ItemList` on the grid + `BreadcrumbList`; server-rendered crawlable list.

#### D.5.1 All Tours — 🔴 Must Fix items

- **🔴 Remove the "Explore by type" category-cards section.**
  - Five large category cards (Boat Tours, Buggy Tours, Sunset Cruises, Snorkeling, Walking Tours)
    currently sit between page header and filter row.
  - They duplicate the Category Quick Links already on the homepage and destination page.
  - On All Tours the user has explicitly chosen to see all tours; re-offering visual category navigation
    pushes the first tour cards far below the fold.
  - They conflict with the category chips that belong inside the filter row.
  - Competitor evidence verified by direct screenshots, April 2026: Viator (`viator.com/Curacao/d725-ttd`)
    and GetYourGuide (Curaçao listing) both run page header → filter row with category chips → tour grid,
    **no visual category cards**; same pattern on Klook, Headout, Airbnb Experiences — **5 of 5 major
    platforms converge on filter-row chips for listing pages**.
  - Why "move them below the grid" does not solve it: below pagination is a discovery dead zone; the ~5%
    who scroll past pagination look for trust signals or SEO content; filter-row chips already navigate to
    `/curacao/{category}/` without consuming above-the-fold space; the same cards already exist on
    `/curacao/` and repeating them creates two parallel navigation systems.
  - **FIX: delete the entire section. Do NOT move it below the grid.**
  - Resulting structure: page header → filter row (with category chips) → tour grid → pagination → SEO
    content block → footer.
  - Both buckets (browse-driven via chips, filter-driven via Date + Adults + Filters + Sort) reach their
    goal within the first **280px** of content height instead of 600px+.
- **🔴 Replace facet-pill filters with the locked Filters-button + modal.**
  - The wireframe uses individual facet pills ("Free cancel (18)", "Under €50 (9)", "3–6 hours (14)",
    "Top rated (12)", "Full day (8)", "Under €100") — a GetYourGuide pattern.
  - Our locked spec is the Viator pattern: a **single "Filters" button opening a modal**.
  - The wireframe currently mixes both patterns, so users see two inconsistent filter systems.
  - Additional pill problems: "Top rated (12)" reads as a sort criterion next to the actual sort dropdown;
    "Under €50" + "Under €100" are overlapping price buckets, not a single price filter; "3–6 hours" +
    "Full day" overlap with the locked 4-band duration filter; currency shown as € should be $.
  - **FIX:** replace all facet pills with a single Filters button, showing a count badge when filters are
    active: `Filters ●2`.
  - ⚠️ CONFLICT — this 🔴 item names an earlier 6-filter set (Price slider / Duration 4 options / Booking
    type 3 options / Rating 3 options / Free cancellation toggle / Pickup included toggle). The
    `[FILTER-MODAL]` list in §D.10 is the **final locked version**.
- **🔴 Add category chips and the Adults pill to the filter row.**
  - Locked filter-row layout:
    `[📅 26 Apr]  [👤 2 Adults]  [⚙ Filters ●n]  │  Klein Curaçao · Boat Tours · Snorkeling · Sunset Cruises · Buggy Tours · Private Charters  →    Sort by: Locals' favourites ▼`
  - A **vertical divider** separates search context (Date, Adults, Filters) from category navigation chips.
  - Category chips are **NAVIGATION LINKS** to `/curacao/{category}/`, not facet filters; they scroll
    horizontally on overflow.
  - The Adults pill opens a 3-tier popover: Adults 12+ / Children 4–11 / Infants under 4 · Free on most tours.
- **🔴 Sort label "Featured" → "Locals' favourites."** "Featured" is Viator/GYG language, inconsistent with
  brand voice. Exactly three sort options total.
- **🔴 H1 → `All Curaçao tours & activities in {year}`** (see above).

#### D.5.2 All Tours — 🟠 Important items

- **🟠 Move the SEO content block above pagination.** The "About tours in Curaçao" block currently sits
  BELOW pagination, where SEO/AEO value is significantly lower: Google treats pagination as a soft "page
  end" and ~99% of users never scroll past it, so the block is dead space for both signals.
  - Fix option A: move the entire block above the tour grid (between page header and filter row) — best
    for SEO/AEO weight.
  - Fix option B: keep the position but expand to **300+ words** with internal links to category pages, so
    it earns the position.
  - **Anything less than 300+ words must be moved.**
  - ⚠️ CONFLICT — §5.3 states flatly **"No About content block on All Tours"**; this 🟠 item assumes the
    block exists and only argues about its position/length.
- **🟠 Card copy `Pickup is available` → `Pickup included`.** "is available" reads passive and uncertain;
  "included" is direct and reads as a tour benefit. Change ALL card pickup labels. Must be translatable
  via an i18n key.
  - ⚠️ CONFLICT (three-way) — `[TOURCARD-FIX]` Fix 7 locks `Pick-up available`; this item locks
    `Pickup included`; **LD3 locks "Pickup" with NO hyphen platform-wide**; and §3.5/B.69 resolves it
    per `pickup_model`: **"Pickup included" when pickup is in the price, "Pickup available" when it is a
    paid add-on, nothing when none** — with the **filter label always "Pickup available."** The B.69
    per-`pickup_model` rule is the latest and most specific.
- **🟠 Currency display € → $** (see the D.2 conflict note).
- **🟠 Grid density: 18 per page** (see above).
- **🟠 First card missing peach/ivory tint** (see D.10 tint rules).
- **🟠 Orientation line — locked version not yet applied** (see above).
- **🟠 Trust strip below grid — locked element missing.** Final page stack: tour grid → pagination → trust
  strip → SEO block → footer.
- **🟠 Rating display rules (show only when meaningful).** The wireframe shows "4.8 (1738)" on every card;
  locked spec renders rating only at **≥3 reviews**. Below 3, one or two ratings can unfairly tank a tour
  or look fake.
  - ≥3 reviews: show `⭐ 4.8 (124)`.
  - 0–2 reviews: **hide the rating row entirely**.
  - Tour added **<30 days ago AND 0 reviews**: show a `New` badge **instead of** the rating row.
- **🟠 Price suffix "/per" formatting.** The wireframe shows "from $36/per" — incomplete and unclear. Only
  two formats allowed: per person (default) `from $36` — **NO suffix**; per group `from $270 per group` —
  full label, muted text.

---

### D.6 Category page

- **Job:** SEO landing for one activity type per destination.
- **URL:** `/{locale}/{destination}/{category-slug}/`.
- **Canonical sources:** `Section4_4_CategoryPage.md` plus `CategoryPage_DesignReview_v1`.
- **Live only at 3 or more published tours** in that destination+category combination.
- Below the threshold the page is automatically `status: draft` — excluded from navigation, sitemaps,
  internal links, and search; it 404s to crawlers.
- The check runs on **every tour status change in both directions** (publish can flip a category live;
  unpublish can flip it back to draft).
- **Structure (ONE single listing):**
  1. Hero — category H1 + intro.
  2. Filter row with the Filters modal, explicitly **without the category chips**.
  3. **One ranked grid** — ranking order + diversity pass, with Sponsored / Most popular badges.
  4. Category description content blocks (this vertical's About).
  5. Related categories.
- **No trust bar on category pages** — this is not incidental; the locked trust matrix has an explicit
  row `Category, Activity Hub → No trust bar`, and the matrix is "the outcome of the cross-surface trust
  review and is intentional."
- Category H1 template is under open item C19: keyword-matched per category proposed, **undecided**.
- Each category page **owns its own vertical's About content** (boat-tour specifics, safety, best season)
  per the SEO ownership lock.
- All "Pick-up available" instances corrected to "Pickup available" (LD3).
- Review fixes from `CategoryPage_DesignReview_v1` are folded in.
- **19 global categories** (one set reused across every destination), with slugs: `boat-tours`,
  `snorkeling`, `scuba-diving`, `sunset-cruises`, `sightseeing-tours`, `day-trips`, `off-road-tours`,
  `jet-ski`, `parasailing`, `water-sports`, `fishing-trips`, `nature-wildlife-tours`, `hiking-tours`,
  `adventure-tours`, `cultural-tours`, `food-tours`, `attraction-tickets`, `luxury-experiences`,
  `workshops-classes`.
- **Multi-category tagging:** a tour can belong to multiple categories and key overlaps are intentional
  (sunset catamaran = `boat-tours` + `sunset-cruises`; Klein Curaçao trip = `boat-tours` + `day-trips`).
- **Day Trips is the one duration-based category** — roughly 6 hours or more regardless of activity,
  almost always paired with the activity category.
- "Luxury Experiences" is the **single sanctioned use of "luxury" platform-wide** (the category label and
  its category-page H1). In running copy "luxury" stays banned; copy under this category states what makes
  a tour premium instead: private skipper, small group, champagne.

#### D.6.1 The category "two listings" conflict (A16, July 5 2026)

- ⚠️ CONFLICT — **`category-page.tsx` renders TWO listing blocks; the master defines ONE.**
  - **Top block (lines 288–337, `ToursListingSection`):** real dynamic data (`getCategoryFacets` +
    `getDestinationTours`), backend-paginated, real URL-driven toolbar locked to this category with
    sub-category pills, real pagination, **no trust strip**. **Matches the master.**
  - **Second block (lines 347–380, `ToursListing`):** `MOCK_TOURS` (6 hardcoded cards), `CategoryFilterBar`
    with local `useState` only and hardcoded `SECONDARY_FILTER_CATEGORIES` pills, **fake pagination
    (`pageCount={1}`)**, and a `CategoryTrustStrip`. **Does not match the master, on two counts.**
  - The comment on line 347 cites **Figma node 47171:1499** — the second block is a **design-file artifact,
    not a master requirement**.
  - It contradicts the master in two locked ways: (1) it is a second listing where the master defines one
    ranked grid; (2) it has a trust strip where §3.11 explicitly says category pages get none.
  - **Structurally the two filter bars cannot coexist:** the top `ToursFilterBar` owns the URL query params
    (`?sort=`, `?price=`, sub-category slugs); `CategoryFilterBar` is pure local state wired to nothing.
  - Sub-categories are a **codebase feature, filter-only** — the master never mentions them (grep returns
    zero matches). With no sub-cat pills selected the top block shows the whole category tree (parent + subs).
  - Backend capability: **for the master-compliant single listing, YES, completely — and it already works.**
    `/tours` already does category filtering (`categoryIds`), sub-category narrowing, attribute facets,
    price/rating/duration filters, ranking-order sort and pagination. For the second listing "there is
    nothing to be capable of — the master does not define it, so there is no backend contract."
  - **Recommendation:** REMOVE the second `<section>` plus the now-unused `CategoryFilterBar`,
    `CategoryTrustStrip`, `MOCK_TOURS`, and `SECONDARY_FILTER_CATEGORIES`, collapsing the page to
    `breadcrumb → header → the one dynamic listing → related categories → About → FAQs`.
  - If the Figma genuinely wants that block, that is a **master-vs-Figma decision for the founder — the
    master wins unless it is amended.**
- ⚠️ CONFLICT — **gating threshold.** `CLAUDE.md`/master §2.4 specify **≥3 published tours**; the code
  gates at **≥1** (`categories.service.ts getPublishedTourCount` + the detail 404). The featured-experience
  card gate deliberately **mirrors the CODE**, because its job is to match the real 404 condition. If ≥3 is
  the intended rule, **both the category service and that gate change together.**

---

### D.7 Activity Hub page

- **Job:** one place, highlight, or area with full decision support; **primary Google Ads landing page**.
- **URL:** `/{locale}/{destination}/{hub-slug}/`.
- **Canonical sources:** `Section4_5_ActivityHubPage.md`, `ActivityHubPage_DesignReview_v1`, hub context summary.
- **Hub types: location, highlight, area** — each with its own anchor-nav set and content template.
- Klein Curaçao reference structure, **12 sections**:
  1. Hero — H1 and fast facts overlaid on image.
  2. Sticky anchor nav, **5 items LOCKED**: `Book now · Private charter · Our Pick · Compare · Tips & FAQ`.
  3. Editorial lead — **max 150 words, no visible header**.
  4. Best for / Good to know.
  5. Shared tours grid (filter chips per §3.12; **no peach card**).
  6. Private charters.
  7. Our Pick — **3 picks**: Best overall, Most popular, Best for families — referencing **tour titles, not operator names**.
  8. Comparison table — **two groups Comfort and Adventure**, frozen first column, booking buttons in the header, tour-title columns.
  9. `Our {hub}` editorial deep-dive.
  10. Local tips.
  11. FAQ — **7 AEO questions**.
  12. Related hubs.
- Sections `Our {hub}`, `Local Tips`, and `Related Hubs` are **mandatory**.
- **Header rule LOCKED June 10, 2026:** the editorial section H2 defaults to `Our {hub}` via the i18n
  template; a hub may override it per locale through its content-section heading field; **every override
  passes the LD9 banned-list check**. `Discover {hub}` is **retired**.
- **No trust bar** on hub pages.
- Share button matches the tour-page pill.
- Hero fast facts are **all-middot** per §3.4:
  `Full day · 8 to 9h · 45min to 1.5h crossing · 10km offshore · From $120 · BBQ lunch included · Daily`.

#### D.7.1 Hub Section 1 — Navigation Bar

- Destination-context nav, fully spec'd in §4.2 — no changes.
- Logo black on white; location indicator `📍 Curaçao`; Categories active dropdown; search bar a compact
  pill that expands on scroll.

#### D.7.2 Hub Section 2 — Hero

- **Purpose:** immediate emotional pull; communicate "this is a real, specific, extraordinary place"
  before the user reads a word.
- **Architectural rule:** pages that **SELL** a specific place or experience earn a full hero image; pages
  that **LIST** options (All Tours, Category) use a thin header only.
- Hero image spec: full-width, full-bleed aerial photo of the hub subject; must show the white beach,
  turquoise water, pink lighthouse, the scale of the island; **aspect ratio 16:9 desktop, 3:2 mobile,
  60vh minimum**; rendered with Next.js `<Image priority />` as the above-fold LCP element; dark gradient
  overlay, heavier at the bottom where H1 and the fast facts bar sit.
- **Hero image specificity requirement (ALL hubs):** the image must show the specific location,
  attraction, or activity — never the broader destination.
  - Location (Klein Curaçao): correct = aerial of the small island with turquoise water; incorrect =
    generic Curaçao beach.
  - Highlight (Dolphins): correct = dolphins in open water with a boat visible; incorrect = generic
    Caribbean ocean.
  - Area (West Coast): correct = rocky West Coast coastline with characteristic terrain; incorrect =
    generic Curaçao coastline.
- Images sourced from actual tour operators on this hub are preferred — authentic, contextually accurate,
  visually differentiated from stock.

##### Hub Hero H1

- **EN H1 LOCKED:** `Klein Curaçao — Where Islanders Send Their Visitors`.
- Rationale: the majority of users arrive via Google Ads on "klein curacao activity" queries with 3–4
  competitor tabs open (Viator, GYG, kleincuracao.nl). Every competitor H1 is feature-first ("Klein
  Curacao Day Trip with Premium Open Bar", "From Willemstad: Full-Day Boat Tour") — zero brand voice, zero
  differentiation.
- "Where Islanders Send Their Visitors" is impossible for any competitor to claim; it is social proof from
  the most credible source, the people who live here, and it answers the comparing user's implicit
  question ("which platform should I trust?").
- It sets up the editorial lead architecturally: "The best beach in Curaçao isn't on Curaçao... We've been
  on every boat. We've never met anyone who regretted going." — H1 makes the claim, editorial lead delivers
  the proof.
- Styling: white, bold, **CENTERED** in the hero image, above the fast facts bar.
- **CMS field `hub_h1`** — per hub, per locale. **NEVER templated.**
- **Multilingual H1s ADAPT THE CONCEPT, not a direct translation:**
  - EN: `Klein Curaçao — Where Islanders Send Their Visitors` (social proof, local authority)
  - NL: `Klein Curaçao — Hier zijn we opgegroeid` (most direct brand claim, strongest for NL)
  - ES: `Klein Curaçao — Elegido por quienes viven aquí`
  - DE: `Klein Curaçao — Empfohlen von denen, die hier aufgewachsen sind`
  - FR: `Klein Curaçao — Choisi par ceux qui ont grandi ici`
  - PT: `Klein Curaçao — Escolhido por quem cresceu aqui`
  - ZH: `克莱因库拉索 — 岛民世代的首选`
- **H1 naming principle (EN pattern):** `[Place/Experience Name] — [One line that only a local who grew up here would say]`.

##### Hub Fast Facts Bar

- Horizontal data bar overlaid on the bottom of the hero image, above the gradient's darkest point.
- Gives researchers the four most decision-relevant facts in 5 seconds.
- Desktop: 4 facts in ONE horizontal row, always visible without scrolling. Mobile: same 4 facts in a
  **2×2 grid** inside the hero.
- Facts for Klein Curaçao:
  - `🕐 Duration` → `Full day · 8–9 hours`
  - `🚢 Getting there` → `45min–1.5h crossing · 10km offshore`
  - `💰 Price from` → `From $120 · BBQ lunch included`
  - `🗓 Availability` → `Daily departures`
- Why these four: duration pre-qualifies time commitment; crossing time carries seasickness relevance +
  genuine remoteness (the range is honest — Powerboat 45 min, catamarans up to 1.5h; "1.5h by boat" was
  only accurate for catamarans); price + immediate value signal (lunch is included by all 6 operators, and
  restoring "BBQ lunch included" makes $120 feel like excellent value rather than just a number); daily
  departures = availability reassurance.
- **Considered and EXCLUDED:** "Pick-up available" (only 4 of 6 operators, can't be universal);
  "All inclusive" (not universal — Miss Ann and Mermaid charge extra for open bar); "Snorkel gear
  included" (universal but lower priority).
- Design: semi-transparent dark background, white text, subtle border-top. **Not a separate section** —
  embedded in the hero as an overlay.
- CRO rationale: Baymard large-scale travel testing — missing prices and duration in listing contexts
  cause immediate abandonment ("I wish it would show me the price right away because then that saves me
  clicking each one").

##### Hub Hero Breadcrumb and Date Picker

- Breadcrumb desktop: `Home › Curaçao › Klein Curaçao` — above the hero in the nav area, white text.
  Mobile: `← Curaçao` back arrow in the nav.
- **Hero date picker** is the hero's **PRIMARY conversion element** — it addresses the availability
  question at first impression, before any scroll.
- Design: `┌ 📅 Select date … [Check availability] ┐` full-width pill, full-width on desktop AND mobile,
  semi-transparent dark background matching the Fast Facts Bar, white text and white calendar icon.
- **Placeholder copy `Select date`** — a clear functional instruction; copy warmth belongs in the H1 and
  editorial lead, not in a UI input label.
- `[Check availability]` button: Island Tours orange `#E8611A`, white text.
- Positioned directly below the Fast Facts Bar, still inside the hero image area.
- **Behaviour on date selection:**
  1. Auto-scrolls to Section 4 (Tour Listings).
  2. Date filter chip activates automatically: `📅 May 15`.
  3. Grid filters to tours available on that date.
  4. Tour count updates: `4 of 7 tours available on May 15`.
  5. Tours sold out on that date: greyed-out card + `Sold out` badge, still visible but not clickable.
  6. If 0 tours available: `No tours available on May 15 — try another date`, with the date picker
     re-exposed inline.
- **Empty on arrival: NEVER pre-filled** — not from ad parameters, not from URL. The user always selects
  their own date.
- Mobile: same full-width design, stacked below the Fast Facts 2×2 grid; tapping opens the native date picker.

#### D.7.3 Hub Section 2b — Sticky Anchor Navigation

- Horizontal navigation bar appearing directly below the hero.
- Becomes **sticky on scroll** — fixed to the top of the viewport once the user scrolls past the hero.

---

### D.8 Collection page

- **Job:** persona or intent-driven curated list. It is the **ONLY page type that cuts across activity
  categories on a persona or intent basis**, serving the traveler who knows WHO they're traveling with but
  not WHAT to book, and the traveler searching "things to do" without knowing the options.
- **URL:** `/{locale}/{destination}/{collection-slug}/`.
- **Canonical source:** `CollectionPage_FinalDecisions.md` (June 2026). Fully locked; the v1–v8 review
  chain is lineage only.
- **Seven sections:**
  1. Nav.
  2. Thin full-width editorial banner (~300px), all text overlaid on image with gradient, carrying persona
     label, H1, curation note, fast stats, Share pill.
  3. One-sentence intro — body text, **max 30 words**, AEO "include" structure.
  4. Curated **3-column grid — NO sort, NO filters**.
  5. "Need help before booking?" with the collection FAQ as its right column.
  6. FAQ content — **6 AEO questions**, `FAQPage` schema.
  7. `Keep exploring Curaçao` — **the only H2 on the page** — with 3 cross-intent collection cards plus the
     recovery CTA `Not sure yet? See all Curaçao tours →` linking to `/{locale}/{destination}/`.
- **Locked copy (Best Things to Do):**
  - H1: `The 10 best things to do in Curaçao.` — **period required**.
  - Curation note: `Chosen by Islanders, in the order we'd book them.`
  - Fast stats: `10 tours · From $36`.
  - Intro: `The best things to do in Curaçao include Klein Curaçao day trips, swimming with dolphins, Westcoast Tours, sunset cruises, and off-road buggy tours, chosen by Islanders who've done all of them.`
- The six FAQ answers are verbatim from the final decisions doc, including **Q6 reframed** from "Are these
  paid placements?" to `How does Island Tours choose which tours to feature?`.
- **Circular numbered badges 01 to 10 on Best Things to Do and Top 10 only.**
- **No peach on numbered collections** (peach marks card #1 on persona collections).
- **Collection Rationale is a required CMS field before publish** — optional italic line under the card
  title, collection pages only, **max 20 words**.
- Card prices render `from $X`.
- **Commission never influences curation or order**, and **no Sponsored badge appears on collection cards**.
- Trust component: `<NeedHelpSection showFAQ={false} />` with payment logos and the collection FAQ as its
  right column.
- **Schema:** `FAQPage` on the FAQ section; `BreadcrumbList`.
- **Collection slugs must be semantically distinct from category slugs** (`top-10-tours` correct, never
  `boat-tours-private` — that should be a filtered category URL).
- **Hub vs Collection decision rule:** a Hub is anchored to a place or product reality and carries
  **comparison logic**; a Collection is anchored to a **persona or intent** and carries **editorial ranking**.

---

### D.9 Tour detail page

- **Job:** conversion page.
- **URL:** `/{locale}/{destination}/{tour-slug}/`.
- **Canonical sources:** `Section4_7_TourDetailPage.md` (LD register + CMS model) and
  `Design_Brief_TourDetailPage.md`, with Appendix B staleness corrections applied; also
  `island-tours-tour-journey.html` (up to date).

#### D.9.1 Above the fold (the single most conversion-critical zone)

- Desktop above-fold order: Breadcrumbs → H1 → Meta row → (left) gallery hero + 4 tiles with Save/Share
  overlay + quick info badges | (right) booking widget.
- **Layout rules (desktop ≥1280px):** TWO COLUMNS from the top of content — left ~60% (~720px), right ~33%
  (~400px), ~32px gutter. Left column: H1, meta row, gallery, quick info badges, all editorial sections.
  Right column: **booking widget ONLY**.
- **Booking widget starts at H1 LEVEL, not below the gallery**; in-flow at first, pinned-sticky on scroll;
  sticky offset = global nav height + 16px; releases above the global footer to prevent overlap.
- **Layout rules (mobile):** single column — gallery → meta row → quick info → callout → in-flow booking
  widget → editorial sections. Sticky bottom CTA bar appears when the in-flow widget scrolls past the
  viewport.
- **Element 1 — Breadcrumbs:** always visible on desktop AND mobile (**LD8: mobile breadcrumbs are VISIBLE
  on the tour detail page, a deliberate divergence from the destination page which hides them**); truncate
  long crumbs; the final breadcrumb is the current page and is **NOT clickable**.
  - Three path variants chosen by the tour's **primary attachment**: `Home › Destination › Hub › Tour`;
    `Home › Destination › Category › Tour`; `Home › Destination › Tour`.
  - **The URL stays flat regardless of which breadcrumb variant renders** — the breadcrumb reflects
    discovery context, not URL.
- **Element 2 — H1 (LD15):** format `{Destination or Hub}: {Tour name}` (GYG colon pattern), **Title Case
  on both sides**, hub-first when specific (Klein Curaçao, Willemstad, Caracas Bay), destination as
  fallback; avoid destination-then-sub-destination double reference; **35–60 chars target, 70 hard max**;
  **no operator name suffix** (LD14).
  - Rationale: entity binding for AI citations; the H1 travels well outside page context (cards, social
    shares, marketing); multi-destination scalability for Aruba and Sint Maarten.
- **Element 3 — Meta row (LD13):** single unified row directly below H1 —
  `[★ rating · count reviews] · [✦ Locals' favorite (if applicable)] · [📍 City, Island]`; full width,
  left-aligned.
  - Middle-dot `·` separates info-categories; the **comma separates City from Island** within the location
    reference (geographic notation, not a typographic separator).
  - Middle-dot chosen over pipe `|`: lighter visual weight matching metadata status; aligns with the warm
    + minimal aesthetic; modern UI pattern (Twitter/Instagram bios, Airbnb, GYG). **The pipe was earlier
    locked but REVERSED** — too "structured marketplace / corporate" for warm Caribbean curator positioning.
  - **Location is ALWAYS present.**
  - Wireframe example: `★ 4.8 (1,738) · ✦ Locals' favourite · 📍 Willemstad`.
- **Element 4 — Gallery:** hero + 4 tiles asymmetric grid; "Show all photos" CTA bottom-right; lightbox on
  click. `[♡ Save] [↗ Share]` pill-style controls overlay the hero image **top-right corner** (Viator
  pattern). **Save/Share are NOT in the meta row.**
- **Element 5 — Quick info badges (LD7): exactly 3** — Duration, Pickup, Languages. No more.
  - Duration badge format `[X hours]` — single-day tours only (LD25 dropped multi-day; no multi-day variant).
  - Universal facts go in the trust strip, not here.
- **Element 6 — Review preview module (LD29)** — see D.16.
- **Element 7 — Booking widget** in the right rail from H1 level, sticky.
- **Brand voice above the fold:** H1 starts with destination context ("Curaçao: ..."); trust strip uses
  lowercase humanized copy `Free cancellation up to {hours}h` — **NOT** "FREE CANCELLATION 48HRS";
  Locals' favourite is editorial (manual, curated), not algorithmic, target ~30% catalog coverage at launch.
- **Don't do this above the fold:**
  - ❌ Don't put the booking widget below the gallery (v1 mistake — must be right rail from H1 level).
  - ❌ Don't use check-in/check-out date inputs (Airbnb accommodation pattern, wrong for tours).
  - ❌ Don't show "Total Price: $X" before the user selects a date — show "From $X per person" until then.
  - ❌ Don't add a 4th quick info badge.
  - ❌ Don't include an operator host card.
- ⚠️ CONFLICT — the above-fold wireframe widget content lists `✓ Free cancellation up to {hours}h before
  tour` / `✓ Pay {X}% today, the rest later` / `✓ Instant confirmation` / `💬 WhatsApp us · daily 08–22h`
  and a `📍 Pickup location ▾` field. **That wireframe pre-dates LD5 (2-line trust strip, no Instant
  confirmation, no WhatsApp) and §3.1 (pickup moved to Step 2). LD5/§3.1 win.**

#### D.9.2 Seven H2 sections in fixed order (LD16 sticky TOC, LD17 stacked layout)

- **Section navigation = Sticky TOC (LD16)**, Baymard-validated and Viator-aligned with one ordering
  divergence.
  - The sticky anchor-link row appears at the top of the viewport when the user scrolls past the Quick Info
    badges; **NOT visible at initial page load**.
  - **Exactly 7 items in order:** `Overview · What's Included · What to Expect · Meeting & Pickup ·
    Important Info · Cancellation Policy · Reviews`.
  - **Excluded from the TOC:** Related tours, Provider attribution (tail content). The FAQ section is
    removed entirely per LD21.
  - **All sections expanded by default** — the TOC is supplementary navigation, not a content gatekeeper.
  - Active state: underline indicator follows scroll position. Click: smooth scroll with
    `scroll-margin-top` accounting for TOC height.
  - Mobile: horizontal scrolling pill row, same 7 items, sticky on scroll. Booking widget remains sticky in
    the right rail underneath.
  - Rationale: Baymard PDP testing — **Sticky TOC 7% miss rate vs 27% for content-hiding horizontal tabs**.
  - Persuasion-grouped order: emotional sell (Overview), concrete value (What's Included), experience detail
    (What to Expect) precede logistics (Meeting & Pickup), then risk surfacing (Important Info), trust
    signal (Cancellation Policy), final validation (Reviews).
  - Diverges from Viator on Meeting & Pickup / What to Expect placement: Viator puts logistics first for
    their global cruise-traveler audience where pickup logistics are deal-breakers; the Caribbean
    island-resident tour audience has lower logistical variability.
  - **Section H2s match TOC labels EXACTLY.**
- **Section layout = stacked H2 over content (LD17, Viator pattern).** Each of the 7 sections renders as a
  visible H2 followed by body content. **NO two-column layout** (the GYG label-left/content-right pattern
  v1 currently uses) and **NO parent grouping headers** ("Experience" / "About this tour" / "Details").
  - Rationale: stacked H2 is the coherent system pairing for the Sticky TOC — anchor links land on visible
    H2 landmarks; two-column would create competing navigation cues. Stacked also preserves desktop-mobile
    parity. Industry alignment: Viator, Klook, Airbnb Experiences, Headout, Tiqets all stacked; GYG's
    two-column is an outlier supporting their choice of no sticky TOC.
  - Section H2 styling consistent across all 7 — same weight, size, spacing.

**H2 1 — Overview (LD22: Highlights merged in, not a standalone H2)**

- Structure in order: (1) narrative paragraph — **60–80 words target, 100w hard ceiling triggering Read
  More overflow**, opening with a hook-quality first sentence, must add context bullets cannot carry;
  (2) highlights bullets — **3–6 items, `•` prefix, 5–12 words each, action verb leading**; (3) local tip —
  optional callout, hidden when there is no authentic content.
- A single H2 "Overview" covers all three elements.
- **NO separate Hook field** — the opening sentence(s) do the hook work.
- **NO sub-labels** ("Highlights" / "Full description") within the section — Viator pattern, avoids
  corporate-template feel.
- **Bullet prefix is `•` NOT `✓`** — semantic separation from What's Included where `✓` correctly signals
  "this is included."
- Narrative-before-bullets follows Viator's revealed preference: at 60–80w bullets are visible within ~1.5s
  scroll, F-pattern protection is unnecessary, and narrative-first lands brand voice more strongly.
- Preserves LD16's 7-item TOC (a separate Highlights H2 would force 8 items).

**H2 2 — What's Included (LD18)**

- Two-column industry-standard pattern with SVG icon sub-headers: `[check icon] Included` |
  `[cross icon] Not included` on desktop; stacked on mobile. Aligns with Viator and GYG (Jakob's Law).
- **Right-column item content conventions** (inline text carries the nuance; no extra structural state):
  - (a) Paid add-on purchaseable in advance via the widget: `[item name] (available — from $X pp)` —
    e.g. `Hotel transfer (available — from $17 pp)`.
  - (b) Paid extra, on-site only: `[item name] (pay on the day)` — e.g. `Alcoholic beverages (pay on the day)`.
  - (c) Not available: plain statement, no suffix — e.g. `WiFi on board`.
  - (d) Not permitted: `[item] not permitted` — e.g. `Outside food & drinks not permitted`.
- **Where each item belongs:** ✓ Included = items provided at no extra cost; ✗ Not included = items with
  explicit inclusion status (paid add-on, unavailable, not permitted). Operational caveats
  (weather-dependent, age restrictions, fitness, time warnings) route to Important Info > Know before you
  go, or Not suitable for. Personal items (towel, sunscreen, swimwear) route to Important Info > What to bring.
- Rationale for flipping from the earlier ✓/💰 design to ✓/✗: (1) Jakob's Law — familiar patterns are
  System-1 processed; deviant patterns force System-2 and hurt conversion in an emotionally heavy travel
  purchase; (2) Hick's Law — two categories parse faster than three when listing 8–10 items; (3) industry
  convergence is revealed-preference data — Viator and GYG run hundreds of A/B tests per year and have both
  been on ✓/✗ for years.
- Brand voice impact: ✗ markers don't lose warmth — voice lives in item content (`BBQ lunch with rum punch`
  vs `Lunch service included`).
- Transparent `(available — from $X)` inline notation is factually more honest than a polished 💰 framing
  and fits the ethical-CRO stance.
- **Schema.org:** the backend structures `includes` and `excludes` arrays for AI/AEO; visual display
  follows ✓/✗.
- **CMS:** `included_items` (array of strings); `excluded_items` (array of objects
  `{item: string, type: 'paid_advance' | 'paid_onsite' | 'unavailable' | 'not_permitted', price_text?: string}`)
  where `type` drives the inline text rendering.
- **Overlap rule:** items in `included_items` MUST NOT duplicate in `tour.what_to_bring` — CMS warning at
  edit-time.

**H2 3 — What to Expect**

- Numbered timeline.

**H2 4 — Meeting & Pickup (LD19)**

- Stacked sub-blocks with SVG icon sub-headers: `[pin icon] Meeting point` — descriptive text +
  `Open in Google Maps →` link, **NO embedded or static map image**; `[clock icon] Departure time`;
  `[van icon] Hotel pickup (optional)`.
- **Conditional:** the Hotel pickup sub-block is hidden when the tour has no pickup option.
- Pickup details cross-reference the booking widget ("Add pickup when selecting your date") — no UI duplication.
- Information scope strictly limited to location, time, pickup. **NO duration** (quick info badges), **NO
  days of operation** (widget date picker), **NO cruise time or activity breakdown** (What to Expect).
- Layout consistent desktop and mobile (stacked).
- No-map rationale: PDP research shows **<5% map interaction**; users use their own navigation apps on the
  day, not during research. Address text + Google Maps link is functionally sufficient; saves **~50KB page
  weight per PDP** and eliminates the Google API tracking call. Matches GYG revealed preference.

**H2 5 — Important Info (LD23: single consolidated H2, 3 typography-only subsections)**

- **NO icons on subsection headers** — typography distinction only (bold H3 styling).
- Replaces former separate sections 4.7.12 What to Bring, 4.7.13 Know Before You Go, 4.7.14 Accessibility,
  4.7.15 Languages.
- **Subsections in FIXED order:**
  1. **Not suitable for** — **CONDITIONAL render**, shown only when restrictions apply (age limits, fitness
     requirements, pregnancy restrictions, wheelchair-INaccessibility). **Hidden entirely when zero
     restrictions exist.** GYG pattern. 1–6 bullets when present.
  2. **Know before you go** — **ALWAYS shown.** Operational caveats + dietary + capacity + equipment +
     tour-side rules (no glass, no outside food) + **POSITIVE accessibility status**. 3–10 bullets.
  3. **What to bring** — always shown when non-empty. Personal items list, 3–8 bullets.
- Items already in What's Included MUST NOT duplicate here — editorial rule, CMS warning.
- **Accessibility routing rule:** positive accessibility status ("Wheelchair-accessible vessel via boarding
  ramp") routes to "Know before you go"; **negative** accessibility ("Not wheelchair accessible — requires
  boat boarding") routes to "Not suitable for". **The operator marks one or the other per tour, never both.**
- Diverges from the earlier 3-icon design (🎒/🚫/ℹ️) — reverted because both Viator and GYG omit icons here.
- Sub-section name change: **"Not allowed" → "Not suitable for"** — GYG-aligned, warmer behavioural framing.
- Languages content NOT included here — covered by the Quick Info badges.
- Order rationale: bookability-critical info first (restrictions can disqualify the user entirely),
  operational caveats second, optional preparation last.
- Conditional rendering of "Not suitable for" preserves signal strength — an always-rendered marketing
  fallback like "Suitable for all" would degrade the signal.
- CMS field rename: `tour.not_allowed_{locale}[]` → `tour.not_suitable_for_{locale}[]`.

**H2 6 — Cancellation Policy (prose only, two locked paragraphs)**

- Paragraph 1: `Plans change. No problem. Free cancellation up to {hours} hours before your tour starts. Full refund, no forms, no questions asked.`
- Paragraph 2: `If you cancel less than {hours} hours before the tour start time, unfortunately we can't refund or change the booking.`

**H2 7 — Reviews**

- Trust sub-line rendered under the H2: `Every review from a confirmed booking. No exceptions.`
- Full behaviour in D.16.

#### D.9.3 Tail content (not in the TOC)

- **`Supplied by {operatorName}` muted line (LD14)** — rendered as a right-aligned signature trailer at the
  END of the Cancellation Policy section, before the Reviews H2. Muted text, no separator lines,
  **non-clickable at v1**.
  - **No dedicated host showcase section, no operator name in H1, no host bio/photo/story per tour.**
  - Disintermediation control: prominence calibrated to satisfy EU consumer transparency law (Package
    Travel Directive) while minimizing google-the-operator friction.
  - Operator celebration moves to brand-level surfaces (marketing copy, Locals' favourite badge, global
    footer brand sign-off), not per-tour.
- **Related Tours (LD33) — two horizontal-scroll rows with independent conditional render.**
  - Row 1 H2: `More {category_display} in {Destination}`. Query: `SELECT tours WHERE category =
    current.category AND destination = current.primary_destination AND id != current.id AND status =
    active ORDER BY rating × bookability_score DESC LIMIT 3`.
  - Row 2 H2: `More to explore in {Destination}`. Query: same but `category != current.category`.
  - **3 cards per row maximum**; desktop 3-across grid; mobile horizontal scroll snap with **1.2 cards
    visible peek**.
  - **Render threshold: ≥2 valid tours required for a row to render**; below that the row is hidden. Rows
    render independently; if both queries return <2, the entire section is absent.
  - Card variant: the listing-page tour card **WITHOUT the peach/ivory tint** on the first card (peach is
    reserved for curated listing pages with default sort, not cross-sell context) and **WITHOUT Collection
    Rationale**.
  - Standard card content: image, title, rating (≥3 review threshold), price, duration badge, locality.
  - Title voice rationale: specific titles outperform generic by ~10–15% click-through; a specific category
    keyword improves SEO topical density vs a generic "Related tours" H2; the "More" prefix maintains warm
    brand voice.
  - Diverges from Viator (5+ rows + tabs + footer category links + Recently viewed = overengineering) and
    GYG (single mixed-content carousel = lower relevance signal per card).
  - **CMS requirement `tour.category_display_{locale}`** — a **plural noun phrase per locale** (EN: "boat
    tours" / "snorkeling tours" / "cruises" / "food tours" / "ATV tours" / "diving experiences"; NL:
    "boottochten" / "snorkeltours" / "cruises" / "food tours" / "ATV-tochten" / "duikexcursies"). CMS
    validation warns if the value is singular or not a noun phrase.
  - **Tracking:** `related_tour_click` with `{source_tour_id, target_tour_id, row: "category"|"destination",
    position: 1-3, is_mobile: boolean}` — drives post-launch algorithm tuning.
  - Position: between Reviews and the global footer. Cross-sell at the conversion-critical moment is
    conversion-neutral with a retention-positive trade-off; industry revealed preference (Viator/GYG/Airbnb)
    validates inclusion.
- Global footer.

#### D.9.4 Tour page — explicit exclusions and the demand card

- **No closing trust block** (dropped; the tagline moves to the global footer, the review trust sub-line
  moves under the Reviews H2 — LD6 text and design brief §8.4 were stale on this).
- **No per-tour FAQ section (LD21).** User-question space is covered by Important Info > Know before you go,
  Important Info > What to bring, the Cancellation Policy section, Reviews, and the site-level Help Center
  at `/help`.
  - Rationale: revealed preference from Viator and GYG — both market leaders decided NOT to use per-tour FAQ
    despite massive A/B test infrastructure. Per-tour FAQ duplicates Important Info, creates an editorial
    scale problem at thousands of tours, and shows weak engagement on tail sections.
  - **Schema.org `FAQPage` markup lives on `/help`, NOT on tour detail pages.**
- **LD27 DROPPED — no critical-constraints callout above the fold.** The original single-line micro-component
  (Min age · Fitness · Weather-dependent · Not wheelchair accessible) between Quick Info badges and the
  Sticky TOC trigger was reversed in Phase 5: the original rationale rested on generic e-commerce
  scroll-depth data, not OTA-specific A/B evidence, and Viator/GYG/Klook/Headout (1000+ A/B tests each) do
  NOT adopt it. Constraints are handled through Important Info, Sticky TOC skip-to access, booking-widget
  enforcement (the party-size picker blocks bookings under `tour.min_age_years`), and Schema.org markup.
  **The structured fields `min_age_years`, `fitness_level`, `weather_dependent`, `wheelchair_accessible`
  REMAIN in the data model** for Schema.org accessibility/audience markup.
- **LD25 DROPPED — multi-day tour support.** The original decision included `is_multi_day` + a `days` array
  + conditional UI across Duration badge, What to Expect, Meeting & Pickup and the widget. Removed because
  the v1 launch catalog (Curaçao) and the 12-month roadmap contain **ZERO multi-day tours**; future-proofing
  adds CMS complexity, conditional rendering and validation surface with no v1 value. **Single-day tours are
  the ONLY supported tour type in v1.**
- **Demand card:** renders below the widget when the single demand trigger fires.
  - Copy LOCKED: headline `Likely to sell out`, line `Book today to secure your spot.`
  - Style: flame icon (SVG), white card, brand-orange border at 30% — **never red, never animated, not
    clickable in v1**.
- **Schema:** `Product`/`Offer` with `acceptedPaymentMethod` (including ApplePay, GooglePay),
  `audience.suggestedMinAge` from `min_age_years`, accessibility fields, `refundPolicy` from
  `cancellation_hours`, `includes`/`excludes` arrays, plus `Review` + `AggregateRating`, and `BreadcrumbList`.
- **Tour meta is derived at render:** title from the translated name (LD15 H1 pattern), description from the
  overview, `og:image` from the hero image.

---

### D.10 Checkout

- **Status:** LOCKED, confirmed June 10, 2026.
- **Canonical sources:** `Design_Brief_BookingWidget.md` §4 (content) restructured per
  `Design_Review_Checkout` (June 2026) into a single-page accordion; `Checkout_Accordion_Wireframe.html`
  is the reference render. Also `Checkout_Payment_TrustSignals_Wireframe.html`,
  `island-tours-checkout-journey.html`.
- **Architecture: single-page accordion.** One URL, two collapsing sections — **Contact then Payment** —
  with the persistent booking summary alongside.
- Booking summary sidebar: **sticky, ~340px, desktop**; mobile is a **full-screen takeover**.
- The step-indicator semantics from the two-step design carry over as accordion section states: completed
  sections show a check and reopen on tap.
- **Contact section fields:**
  - "Back to availability" link.
  - **First name and last name as TWO fields** (split names raise the Enhanced Conversions match rate
    **20–40%**). This overrides the widget brief's single "Full name" field.
  - Email — helper `Booking confirmation sent here.` plus the **PECR soft opt-in marketing notice**.
  - Country — **default Curaçao `+599`**, drives phone format via `libphonenumber-js`.
  - Phone.
  - Pickup location dropdown, rendered when `tour.pickup_available`.
    - Label: `Pickup location (From $X p.p.)`.
    - **Default LOCKED:** `No pickup, meet at location`.
    - Options: operator zones with prices, plus the fallback `Other location, we'll confirm via WhatsApp`.
    - Prices render with **no $0.00 decimals**.
  - Special requests (optional, **500 chars**).
- **Payment section (radio list, LD26 revised).** Header: `Select a payment method`.
  - **LD26 REVERSED:** the original "Express wallet buttons primary, manual card secondary" is reversed.
    Market analysis showed both Viator and GYG present payment methods as **equal radio options** for tour
    booking specifically (considered purchases ≠ impulse e-commerce).
  - **Card radio is selected and expanded by default**, with VISA, MC, Amex logos.
  - Discover, JCB, Maestro logos are **locale-conditional**.
  - PayPal, iDEAL, Klarna render **collapsed**.
  - **Apple Pay renders only on iOS Safari; Google Pay only on Chrome/Android** (device-aware).
  - Stripe Elements handles locale-aware postal code.
- **Final CTA lives INSIDE the expanded method**, LOCKED (LD2 override): `🔒 Reserve my spot · Pay $X` with
  the exact deposit amount.
  - **Four CRO triggers in the final CTA:** outcome-first (`Reserve my spot`); psychological ownership
    (`my spot` — Cialdini commitment trigger); specific action + amount (`Pay $X`); trust signal (🔒 padlock).
  - **CTA progression matched to mental state (LD2):** discovery stage `Check availability`; transitional
    stage `Continue`; checkout stage `🔒 Reserve my spot · Pay $X` (replacing the former `Secure your spot`).
- Below the CTA: `Payments are secure and encrypted`.
- Below the CTA: implied-consent line `By tapping Reserve my spot, you agree to Island Tours' Terms and Privacy Policy.` — **links, no checkbox**.
- **Trust signals at the payment moment: exactly two** — the "Secure checkout" cue with the official
  Powered by Stripe badge (slate), and the free-cancellation line at the commit button.
- **Free-cancellation commit line:** `✓ Free cancellation up to {hours}h before the tour starts, full refund.`
- **Booking summary contents:** tour image and title, party, date, time, pickup state, then **Total / Pay
  today / Balance later** with `All taxes and fees included`.
- Booking summary order is **date-first**; **no duplicate date pill**.
- **Zero-amount rows are hidden:** `operator_full` shows Total and Balance later; `paid_in_full` shows Total
  and Pay today. The widget S4 summary and email block 4 follow the same rule.
- **Total-price-before-checkout rule (LD12):** the total the user will pay is **ALWAYS visible in the
  booking widget before they enter any payment information**; all fees itemized; **no surprises at
  checkout**. This is a **regulatory commitment, not a CRO choice**.
- **Resilience requirements:** unified loading pattern, **idempotent payment retry**, capacity
  race-condition handling, and error states with a **WhatsApp fallback button**.
- **Schema.org:** `Offer.acceptedPaymentMethod` includes `ApplePay` and `GooglePay` for AEO regardless of
  the UI pattern.

#### D.10.1 `operator_full` checkout branch (confirmed June 11, 2026, C22)

- Tours on this model take **no payment at booking**.
- The **Payment section does NOT render**: the accordion is Contact, then the commit block with the **bare
  CTA `Reserve my spot`, no lock icon, no amount** (the lock is the payment icon and no payment occurs).
- The booking is created **confirmed at commit**, **skips `/payment/processing`**, and redirects **straight
  to the Thank You page**.
- The **commission snapshot and the `booking_complete` contract are unchanged**, so conversion value is
  unaffected.
- `payment_method_last4` and the Stripe billing fields stay **null**, and the Enhanced Conversions address
  fields drop out (optional per the data contract, **no build error**).
- **Only the free-cancellation line renders at the commit block**; the Stripe badge does not render, there
  being no payment to secure.
- ⚠️ CONFLICT — `operator_full` is fully specified here and in the email/TYP branches, but the settlement
  decision (founder, 2026-07-15) records it as **DROPPED from v1**, returning in **v2 via Stripe Connect or
  direct bank transfer**. The cross-document note adds: "the wireframe's coverage remains the binding
  template shape if it is reinstated."

#### D.10.2 Payment/cancellation lifecycle (canonical money flow — source of truth for ALL modal, email and confirmation copy)

- **Book:** the customer pays a `{X}%` deposit to Island Tours; the booking is confirmed. **TWO emails
  follow** — the Island Tours confirmation and the operator email with the balance payment link.
- **Balance:** due **72 hours before the tour**; the **OPERATOR** sends the reminders.
- **72h to 48h:** safe zone — still time to pay the balance or cancel for free.
- **Up to 48 hours before (tour local time):** cancel for a full refund.
- **At 48 hours before:** locked. If the balance is unpaid and the booking is not cancelled, **the deposit
  is forfeited and the spot is released**.
- **If the operator has to cancel** (e.g. unsafe conditions): **full refund OR a free reschedule**.
- The 80% balance is the **OPERATOR's transaction** (operator-sent link, not Island Tours branded).
- **Auto-pay and branded collection of the balance are off the table for v1.**
- Modal copy stays **agentless** so it does not spotlight the operator.
- The Island Tours confirmation email **foreshadows the operator's balance email** so it is expected, not
  treated as phishing.
- **Two-phase operator visibility (platform principle):** **pre-payment agentless, post-booking named.**

#### D.10.3 Booking widget trust strip (LD5) and its two modals

- **Exactly TWO lines, both clickable, in fixed order.**
  - Line 1: `✓ Free cancellation up to {hours}h` — template-substitutes `tour.cancellation_hours` per LD1
    (default 48, enum `[24, 48, 72, 168]`); click opens the **cancellation modal**.
  - Line 2: `✓ Pay only {X}% today, the rest later` — template-substitutes `tour.deposit_pct` per LD24
    (range 20–30%, steps of 2.5); click opens the **deposit modal**.
- Copy choice locked as `Pay only {X}% today`, **NOT** `Reserve from {X}%`, because: (a) "only" is honest
  amplifier framing on a real low-commitment benefit (20% IS objectively low vs industry-standard 100%
  upfront) — not fake CRO theater; (b) "Pay X% today" is maximally transparent; (c) "Reserve from X%" is
  linguistically awkward English; (d) the Built by Islanders voice is warm + direct.
- **Position: INSIDE the widget container, below the Continue CTA** — NOT in a separate container below the
  widget. The page architecture already stacks the demand-signal card separately below the widget; a second
  separate container creates 3-container visual fragmentation. Airbnb / Booking / GYG / Klook all keep the
  trust strip inside the widget when multiple elements stack below; Viator's separate-container approach
  works only because they have no demand-signal card.
- Visual treatment: **green checkmark icons retained** (universal trust signal); **partial underline on the
  key clickable phrase only** (`Free cancellation`, `Pay only {X}% today`) — NOT whole-line underline;
  optional 1px light divider above the trust strip, within the widget.
- **Deliberately excluded — WhatsApp/support:** the trust strip is the commit-moment surface and must
  contain only policy-backed anxiety-reducers, **no exit ramps, no filler**.
- **Deliberately excluded — "Instant confirmation":** Viator + GYG use 2-line trust strips; the claim is
  static, table-stakes, lacks modal depth, and adds filler. Email confirmation behaviour is implied by the
  modern mental model and made explicit in the confirmation state.
- **Deliberately excluded — "Secure payment":** already triple-signaled at the payment moment (CTA padlock
  + "Payments are secure and encrypted" microcopy + payment provider logos in Step 2); adding it at Step 1
  introduces **shadow anxiety** (negative framing).
- **Where WhatsApp lives instead:** tour description sections (small inline link `Questions? WhatsApp us →`
  near Description and Meeting & Pickup); the page footer; error states (API failure / card declined /
  network errors all show a WhatsApp fallback button); the confirmation email
  (`Questions? Reply or WhatsApp us [number]`). This routes genuine support questions to WhatsApp when the
  user is RESEARCHING or has a PROBLEM — **never at the moment of commitment**.
- **WhatsApp is deliberately NOT in the cancellation modal.** The earlier soft line ("Something unexpected?
  WhatsApp us, we'll do what we can.") was REMOVED: it undercut the firm no-refund statement and could be
  cited in a chargeback dispute. The after-window section now carries a genuine protection statement
  (operator-cancellation cover) instead.
- **Trust strip is single-line on `paid_in_full` and `operator_full`** (§3.11).

**Modal: Free cancellation (trust strip Line 1) — LOCKED COPY, implement verbatim**

- Heading: `Free cancellation up to {hours}h`
- Lead: `Plans change. No problem.`
- Body: `Cancel up to {hours} hours before your tour starts (local time). Full refund, no forms, no questions asked.`
- How it works step 1: `Open your booking confirmation email.`
- How it works step 2: `Tap "Cancel booking".`
- How it works step 3: `The amount you paid is refunded to your original payment method.`
- After-window heading: `Less than {hours} hours before`
- After-window body: `If you cancel less than {hours} hours before your tour starts, we can't refund or change the booking. But if the operator has to cancel, you're covered: a full refund or a free reschedule.`
- Copy rationale: the heading echoes the trigger line exactly (confirms the click); `(local time)` resolves
  the cutoff timezone unambiguously — NOT "Curaçao time" (breaks on expansion to Aruba/Sint Maarten), NOT
  "the tour's local time" (over-engineered); **step 3 deliberately states NO refund timeframe** — the split
  (Island Tours refunds the deposit; the operator refunds the balance if paid) and the 3–5 business day
  timing live ONLY in the cancellation confirmation, so the modal does not over-promise on the
  operator-controlled 80%; **weather is NOT named** (tours run in rain, only unsafe conditions force a
  cancellation, already covered); **NO "Learn more" link** — the modal is self-sufficient and a link would
  imply it is incomplete.

**Modal: Deposit (trust strip Line 2) — LOCKED COPY, implement verbatim**

- Heading: `Pay only {X}% today, the rest later`
- Lead: `Keep your plans flexible.`
- Body: `Reserve your tour now and pay the rest online before you go.`
- How it works step 1: `Pay {X}% today. Your booking is confirmed right away, with all the details in your email.`
- How it works step 2: `You'll get a secure link to pay the rest, with reminders as your tour nears.`
- How it works step 3: `Pay the balance up to {hours} hours before your tour starts (local time), or cancel for a full refund. After that, the booking is locked and the deposit is non-refundable.`
- "Why we do this": `Popular tours fill up fast, so your deposit secures your spot the moment you book, without paying it all upfront. You're also supporting the local islanders who run these tours.`
- Dynamic content: `{X}%` resolves to `tour.deposit_pct` (range 20 to 30 in 2.5% steps). **NEVER hardcode 20%.**

#### D.10.4 Booking widget Step 1 (S1) and the date picker

- Wireframe: price anchor line → date input row → travelers row → full-width primary CTA → 2-line trust strip.
- **Price anchor:** `From $X per person` when the tour has ANY pricing variation (age-banded, seasonal,
  group-size); `$X per person` when pricing is truly uniform. Most tours use "From" because age-banded
  pricing is common.
- Price anchor styling (industry-aligned with Viator/GYG/Booking/Airbnb): font size **24–28px desktop,
  22–24px mobile — the SAME size for all three parts**; weight `From` = Regular (400), `$X` = **Bold (700)**,
  `per person` = Regular (400); colour brand-dark (`#1F2937` or similar), **NOT muted gray**. Only the price
  number is bold, creating an eye-magnet hierarchy on the data.
- Two (max three) input rows: date · travelers · optional spectators (Variant D).
- **Pickup field is NOT in Step 1** — moved to the Step 2 contact form (industry-aligned with
  Viator/GYG/Booking/Headout; lower Step 1 friction).
- **Single primary CTA** — no secondary "Book Now" twin button.
- Card treatment: subtle border `1px solid #E5E7EB`, white background, ~24px padding, border-radius ~8px.
- **Don'ts:** ❌ no payment logos in Step 1; ❌ no two CTAs; ❌ **no countdown timer or "Only N spots left"
  badge at widget level** (urgency belongs on the time slot only, and only when REAL); ❌ no "We accept all
  major cards" copy; ❌ don't shrink the price font for compactness.
- **Field order LOCKED: Date FIRST, Travelers SECOND.** Industry split: date first at Viator, Klook,
  Headout, Booking, Airbnb Experiences, Fever (5 of 7 majors); participants first only at GetYourGuide
  (driven by per-group pricing where party size IS the pricing driver).
  - Date-first rationale: (1) our price anchor is person-based so it is accurate before party selection;
    (2) date is the availability gate — selecting it triggers the API call for time slots and capacity;
    (3) sequential data flow date → time slots → confirm party matches the mental model; (4) one widget
    pattern across per-person, age-banded and per-group tours; (5) the hotel-tourist majority on Curaçao has
    flexible party size but fixed vacation dates.
  - A post-launch A/B test may reconsider for per-group pricing tours (private charters), if data warrants.
- **Date picker — single full-month calendar.** Tapping `📅 Select date` opens a full-month calendar
  dropdown **DIRECTLY**. **NO compact chip row; NO "View all dates" intermediate step.**
  - Header shows month nav `← May 2026 … June →`; **week starts Monday**.
  - State is communicated through cell styling — **NO legend needed**.
  - Desktop: **2 months side-by-side** (current + next). Mobile: single month; swipe horizontally OR tap
    `←`/`→` arrows above the calendar.
  - **Date cell states:** available plentiful (≥5 spots) — date number, subtle hover, tappable, NO
    indicator; available low capacity (1–4 spots) — date number + subscript indicator below (`5 left`,
    `4 left`, …) in **neutral muted gray ~12px, NOT red/orange**, still tappable; today — subtle
    pill/circle; sold out (0 spots) — greyed, strikethrough or ✕ overlay, non-tappable; closed day —
    greyed, non-tappable; cutoff passed — greyed, non-tappable; selected — **brand-orange filled
    background, white text**.
  - **Scarcity indicator rules (date level):** render the `N left` subscript **ONLY when
    `available_capacity_for_date < 5`**; colour **muted neutral gray — NOT brand-orange, NOT red, NOT
    yellow** (honest factual signal, not pressure framing); format `5 left` / `4 left` / `3 left` /
    `2 left` / `1 left` — **no exclamation, no "Only", no "HURRY"**; the same indicator surfaces on the
    date pill after selection `📅 Tue 28 May (5 left)` only when capacity < 5; works for ALL tour types
    (single-departure 95% + multi-departure 5%) because capacity is fundamentally a date property; it does
    NOT replace slot-level scarcity badges on time-slot chips.
  - **Rules:** custom component, **NOT native OS pickers** (worse mobile conversion); opens directly to the
    month containing the first available bookable date; if the current month is fully booked, auto-advance
    to the next month with availability; **forward window 12 months max**, per-tour configurable via
    `tour.max_advance_days`; at month +12 the next-month arrow is disabled with tooltip
    `"Bookings open up to {N} months ahead"`; loading state = skeleton calendar grid.
  - **Why no chip row (v1 simplification):** Viator + GYG don't do this for tours/activities; the chip row
    is a flight-booking pattern (Skyscanner) meaningful only when prices fluctuate daily; tour pricing is
    stable and the "From $X per person" anchor does the price-signal work.
  - **Don'ts:** ❌ native iOS/Android date picker; ❌ price-per-date inside calendar cells; ❌ a "compact"
    alternative view; ❌ red/orange on the capacity scarcity subscript.
- **Travelers selector — variant-aware.** Pattern A (single-pricing tour, one price per person regardless
  of age): **inline counter, always visible** — `👥 2 travelers  [− 2 +]`. Pattern B (age-banded tour,
  different prices for adults/children/infants): **dropdown panel + Apply button**, with a COLLAPSED state
  showing `Travelers`.
- Departures `booked_count` counts **all party bands, infants included**.
- Brand voice: "Check availability" is exploratory, low-commitment entry; "From $120 per person" is
  transparent, exact pricing convention.

#### D.10.5 Checkout error, race and confirmation states

- **Error states (Step 1) — trigger → microcopy:**
  - Date sold out → `Sold out — try another date.` + auto-suggest next available.
  - All next-30-days sold out → `No spots open in the next 30 days. Get notified when one opens?` + `[Email me]`.
  - All time slots sold out for the selected date → `All times sold out for this date. Try another date →`
    (returns to the date picker, date deselected).
  - API failure loading dates → `Couldn't load dates. Try again, or message us on WhatsApp.` + `[Retry]` `[WhatsApp →]`.
  - Below min party size → `This tour needs at least 4 travelers. Try the smaller-group version →`.
  - Time slot needed but not picked → `Please pick a departure time.`
  - Network offline → `You're offline. Showing cached dates — these may be out of date.`
- **Error states (Step 2) — trigger → microcopy:**
  - Empty required field → `Please fill in your [field name].` (inline below the field).
  - Invalid email format → `That email doesn't look right. Mind double-checking?`
  - Email typo detected → `Did you mean gmail.com?` — inline suggestion below the field, tappable to accept.
  - Invalid phone → `Phone number format unclear. Include country code.`
  - Card declined → `Card declined. Try a different card, or message us on WhatsApp.` + `[WhatsApp →]`.
  - Payment processing failed → `Payment didn't go through — your card wasn't charged. Try again?` + `[Retry]`.
  - Spot sold out between Step 1 and Step 2 submission → `This time just sold out. Pick another?`
- **Error placement rules:** inline below the specific field; **red text on a neutral background — NOT a red
  banner** across the top of the form; icon `⚠` before the error text; **focus returns to the first errored field**.
- **Payment retry safety (idempotency):** all payment attempts use a **client-generated idempotency key
  (UUID) per booking attempt**; **retry uses the SAME key**; prevents double-charge if the network times out
  after the server received payment. The Retry button preserves session state including the idempotency key.
- **Race condition handling:** (1) a final availability check runs on the `Reserve my spot · Pay $X` tap;
  (2) if sold out, a modal reads `This time just sold out — try another?`; (3) the user returns to Step 1
  **with the date PRESERVED**; (4) time slots are refreshed; (5) the user picks a new time and re-enters
  Step 2 **with the contact form PRE-FILLED**.
- **Confirmation state (post-successful payment):**
  - Heading `✓ Reserved!`
  - Body `Your spot is confirmed. We've sent the details to john.smith@example.com.`
  - Detail lines `📅 Tue 28 May · 8:00 AM`, `👥 2 adults`, and **CONDITIONALLY** `📍 Hotel pickup: Marriott`
    (shown only if a paid pickup zone was selected; omitted entirely when "No pickup" is the default).
  - Financial lines `Paid today $48` and `Balance later $192`.
  - `What's next?`: 1. `Check your email for the confirmation`; 2. `Pay your remaining balance online — we'll email you a secure payment link. Sooner the better; latest 48h before tour starts.`
  - Buttons `[ View booking ]` and `[ Add to calendar ]`.
  - Divider, then upsell block heading `Make the most of Curaçao` with sub-line
    `While you're planning your trip, these tours pair well with what you booked:` and cards e.g.
    `Klein Curaçao Sunset Cruise · From $85`, `Christoffel Park Hike · From $45`,
    `Willemstad Food Tour · From $65`; CTA `[Explore more tours →]` right-aligned.
  - Mobile: same content stacked vertically, centered ✓ + "Reserved!", divider rules between blocks,
    full-width `[ View booking → ]` and `[ Add to calendar ]`, pickup line still conditional.

---

### D.11 Thank You page (TYP)

- **Job:** the single confirmation surface where conversion fires **exactly once**.
- **Route:** `/{destination}/thank-you/{bookingRef}` where `bookingRef = bookings.public_ref` (a **UUID,
  never incremental** — booking URLs cannot be enumerated).
- **NO locale prefix** — the TYP is a `noindex` transactional surface, so the content-page locale-prefix
  rule does not apply.
- `export const metadata = { robots: { index: false, follow: false } }`.
- TYP strings localize via **next-intl** using `bookings.customer_locale` (captured at booking, seven-locale
  launch scope). **Deadlines render in the tour-local timezone** per `destination.timezone` (e.g.
  `America/Curacao`).
- **Route step 1:** a lean `/payment/processing` intermediate page — waits for the webhook, **ZERO tags, no
  conversion**. **Skipped on `operator_full`.**
- **Route step 2:** the full TYP.
- **Canonical sources:** `island-tours-typ-design-brief.md` (UI/UX) and
  `island-tours-typ-tracking-dev-spec.md` (implementation). Strategy docs are lineage only.
- **Structure (order locked June 10, 2026 per the TYP Figma) — 7 sections:**
  1. Confirmation hero with key details — tour, operator, date and time, pickup state, party, booking
     reference; **partially masked email with Resend link**.
  2. Booking card — details plus payment status per model.
  3. `What happens next` per-step cards.
  4. Tour upsell under H2 `Islanders also love...` with sub-line `Picked to pair with your booking`,
     **3 cards**.
  5. Apartment block — the Island Tours-owned stay with the ownership disclosure and Airbnb availability CTA.
  6. Support card, **operator-first** — operator email and phone primary, Island Tours email fallback for
     platform issues.
  7. Footer.
- **Booking card, deposit-model copy:** `Deposit paid today $X ({pct}%)`, then `Remaining balance` with the
  concrete deadline `Pay before {Day, Date}`. Variants exist for on_arrival, paid_in_full and operator_full.
- **Booking card `operator_full` variant LOCKED:** `Island Tours took no payment today. Total {total}, settled directly with {operatorName}.`
- **"What happens next" step 2 names the operator deliberately.**
  - On `operator_link`: `{operatorName} will email you a payment link for the remaining balance. Pay before {date}.`
  - On `operator_full` LOCKED: `{operatorName} collects the full amount directly and will confirm how and when.`
- **Upsell selection rules:** a category **other than** the booked tour, rating **4.7 or higher**,
  availability **2 to 7 days out**, **limit 3**. Whole card clickable, **no per-card CTA** (the Figma's
  per-card "Quick" link was rejected).
- **Apartment block disclosure:** ownership line `Owned and hosted by Island Tours` with the Airbnb
  availability CTA — the apartment is Island Tours' own property, so the earlier "Featured local stay · we
  may earn a commission." line was **factually wrong** and replaced.
- **Explicit exclusions:** **no Download voucher** (LD4: the booking reference plus ID is the check-in
  credential; the email is the ticket); **no sticky support bar**; **no relevance badges** on upsell cards.
- **LD4 — Booking IS the ticket:** bookings deliver an email confirmation that doubles as the entry pass.
  **No scannable mobile ticket, no QR code, no app dependency.**

#### D.11.1 TYP — complete English microcopy

- **Hero block:**
  - `You're booked, [Firstname]!` 🌴
  - `Your [Klein Curaçao Day Trip] is reserved for Friday, 22 May at 8:00 AM.`
  - `Booking ref: IT-2026-04821` with a `[copy]` affordance.
  - `[Add to calendar ▼]` button.
  - `Confirmation email sent to denley@example.com. Don't see it? Check your spam folder, or [Resend email].`
  - Fallback without name: `Your Curaçao adventure is locked in!` 🌴 / `Your [Tour Name] is reserved for [Date] at [Time].`
- **Booking summary card:** column headers `TOUR DETAILS` and `PAYMENT`; microcopy under payment
  `You've paid your 20% deposit today. The operator will email you a payment link for the remaining 80% — pay by card at least 72 hours before your tour.`
- **What happens next:** heading `What happens next`;
  step 1 `Booking confirmation email` — "We've emailed your booking confirmation. Check your spam folder if it's not in your inbox.";
  step 2 `Payment link from your operator` — "Miss Ann Boat Trips will email you a payment link for the remaining $160. Pay before Tue, 19 May.";
  step 3 `Show up & enjoy`.
- **Tour upsell section:** heading `Make the most of Curaçao`; sub-line `Picked to pair with your tour.`;
  body 3 tour cards; CTA `[Browse Curaçao's top picks →]`.
  - ⚠️ CONFLICT — §5.9 (B.57) supersedes this with H2 `Islanders also love...` and sub-line
    `Picked to pair with your booking`.
- **Our apartment block:** eyebrow `[palm icon] OUR APARTMENT · Jan Thiel`; heading `Palm Suite Apartment`;
  body `Quiet, modern, 5 minutes from the beach.`; meta `★ 4.9 · Sleeps 4 · From $160/night`;
  CTA `[See availability on Airbnb ↗]`; disclosure `Owned and hosted by Island Tours.`
- **Support card:** heading `Got a question about your tour?`; sub-line
  `Talk to the locals running it — they know it best:`; operator name `Miss Ann Boat Trips`;
  `📧 reservations@missannboattrips.com`; `☎ +599 9 123 4567`; divider `───`; second heading
  `Booking or payment issue?`; body
  `Email reservations@island.tours and include your ref (IT-2026-04821). We usually reply within 24 hours.`
- **Trust strip at bottom:** `[palm icon] Built by Islanders on Curaçao · 🔒 Secure booking · ✓ Free cancellation`.
- **Edge-case microcopy:**
  - Email delayed: `Email taking longer than usual? Check your spam folder first. Still nothing? Your booking is safe — ref IT-2026-04821. Tap [Resend email] or email reservations@island.tours and include your ref.`
  - Pending manual confirmation: `Your booking is being confirmed by Miss Ann Boat Trips. We'll email you within 4 hours (usually faster). You can already add it to your calendar — we'll update if anything changes.`
  - Tour starts today/tomorrow — banner above hero: `⏰ Your tour is tomorrow! Make sure your phone is on — the operator may call to confirm pickup.`
  - Full amount paid: payment column shows `✓ Paid in full · $200.00`; the "Remaining balance" block is
    replaced with `Your tour is fully paid. Just bring your booking ref and ID.`; **"What's next" SKIPS step 2**
    (payment link) and shifts the remaining steps up.
  - Last-minute booking (<72h before tour): `✓ Deposit paid: $40.00 (20%)`;
    `⚠ Remaining: $160.00 (80%) — pay ASAP`;
    `Miss Ann Boat Trips will email you a payment link shortly. Tour starts in [X hours] — please pay immediately to secure your spot.`; step 2 uses the urgent variant copy.
  - No pickup (meeting point): the Pickup field becomes `MEETING POINT — [tappable address]` plus microcopy
    `Please arrive 15 minutes early.`

#### D.11.2 TYP server-component flow (mark-first conversion, with idempotency)

- Route file: `app/curacao/thank-you/[bookingRef]/page.tsx`.
- Load the booking with `getBookingByPublicRef(params.bookingRef)`. **If no booking → `notFound()`.**
- **If `booking.status !== 'confirmed'` → render `<PendingPaymentState />`.**
- **SERVER-SIDE MARK-FIRST conversion pattern:**
  - Atomic update: set `conversion_fired_at = now()` **WHERE `public_ref` matches AND
    `conversion_fired_at IS NULL`**, returning the row.
  - `markedBooking` is non-null **only if THIS update was the first to succeed**; on refresh the second
    render gets null → no fire.
  - `shouldFire = markedBooking !== null`.
- Detect the UI state server-side via `detectBookingState(booking)`.
- Server-side **Meta CAPI fires when `shouldFire`, in parallel with the browser Pixel** via dataLayer. The
  CAPI call is **fire-and-forget, non-blocking**; failures logged via
  `logger.error('Meta CAPI failure', { bookingRef, err })`.
- Render `<BookingSummary booking state={bookingState} />` and, when tracking data exists,
  `<ConversionTracker data={trackingData} />`.
- **Why server-side mark-first:** the old pattern (client-side push then mark-fired via API) had a race
  condition — a refresh between push and API call caused a **double-fire on all platforms**. The new pattern
  does the atomic DB update BEFORE render; Postgres guarantees the `WHERE conversion_fired_at IS NULL`
  clause matches only once.
- **Accepted trade-off:** if the client-side dataLayer push fails (browser crash, JS disabled, blocker
  extension) the booking is marked fired but the event never reached GTM — a **FALSE NEGATIVE (missed
  conversion), never a false positive (double count)**. For Smart Bidding quality a false negative is far
  safer: a missed conversion lowers the learned value (acceptable); a double count teaches the algorithm
  that certain clicks are worth twice as much (catastrophic).
- **The `/api/booking/mark-fired` endpoint from earlier spec versions is REMOVED for a security
  vulnerability:** anyone who knew a `publicRef` could block legitimate conversions. Marking now happens
  entirely server-side inside the Server Component render.
- **The guard is the database column, not client storage. Never `localStorage`.**
- **`operator_full` bypass:** `operator_full` bookings take no charge and no webhook; the booking is created
  **confirmed at commit** and redirects **straight to the TYP**, where mark-first idempotency and the data
  contract apply **unchanged**.

#### D.11.3 `BookingState` detection order

- `type BookingState = 'fully_confirmed' | 'pending_manual_confirm' | 'deposit_paid_balance_pending' | 'fully_paid' | 'last_minute' | 'balance_overdue' | 'tour_today' | 'tour_tomorrow'`.
- `last_minute` = **<72h to tour start**. `balance_overdue` = the 72h deadline passed with remaining unpaid.
- The design brief describes **16 component states**; the state is detected server-side from booking + tour data.
- **`detectBookingState` logic, IN ORDER:**
  1. Compute `hoursUntilTour = (tourStart - now) / 3_600_000`.
  2. **Time-based banners first** (they visually override other states).
  3. `hoursUntilTour < 24 && > 0` → `tour_today`.
  4. `hoursUntilTour < 48 && > 24` → `tour_tomorrow`.
  5. `hoursUntilTour < 72 && > 0` → `last_minute`.
  6. Then payment state: `remaining_amount === 0` → `fully_paid`.
  7. `remaining_payment_overdue` → `balance_overdue`.
  8. `deposit_paid && !fully_paid` → `deposit_paid_balance_pending`.
  9. `requires_operator_confirmation` → `pending_manual_confirm`.
  10. Default → `fully_confirmed`.

---

### D.12 Search results page

- **Status:** LOCKED June 10, 2026. **Canonical source:** `island-tours-search-dev-spec.md`.
- **URL:** `/{locale}/search?q={query}&destination={dest}&date={date?}`.
- **Rendering: SSR, never cached**; **`noindex, follow`** — the SEO ownership lock keeps search URLs out of
  the index and prevents them competing with or bloating the index.
- **ONE unified search system:** the nav search bar and the destination hero search share the **same
  autocomplete backend, the same suggestions data, and the same results page**.
- **Destination-scoped ALWAYS.** On the homepage there is **NO search** — the user selects an island first.
- **Autocomplete:** minimum **2 characters**, **250ms debounce**.
- **Autocomplete groups:** Categories & Hubs, Tours, Collections.
- Autocomplete zero-state panel and **rotating placeholders per destination**, from the CMS.
- **Launch backend: Postgres full-text with trigram typo tolerance**, in the platform's own database.
  **Algolia is a phase-2 consideration**, triggered by catalog size or query volume — **never a launch
  dependency** (decided June 10, 2026).
- **The results page shows TOURS ONLY.** Categories, hubs and collections are reached through autocomplete
  suggestions, not through the results page (decided June 10, 2026).
- Results page uses the standard filter row **minus the category chips**, with the `date` param pre-applied.
- **Ranking is two-stage:** relevance buckets (exact title, strong, weak), then
  `tier_rank ASC, quality_score DESC, id` within each bucket. The **diversity pass applies per bucket**.
- **Search results carry NO paid placements and NO peach tint** (dynamic ranking makes tint feel unstable).
- The search results counter carries the **transparency tooltip**.
- **Search sort options:** `Most relevant` (default) · `Price: low to high` · `Price: high to low`.
- Empty state recovers with **popular-search chips, the Category Quick Links row, and
  `See all {Destination} tours →`**.
- **Tracking:** the GA4 `search` event fires on **every render** with `results_count`.
- **Schema: none** — `noindex, follow`.

---

### D.13 Help Center and legal/policy pages

- **`/help`** carries the site-level FAQ across **five categories: Booking, Cancellation, Safety, Equipment,
  Accessibility**, with **FAQPage JSON-LD** for AEO/AI citation.
- The once-floated sixth category "About {destination} tours" is **rejected** — that content belongs to the
  destination page per the SEO ownership lock.
- **FAQPage schema otherwise appears ONLY on collections, hubs, and the destination NeedHelp FAQ.**
- The Help Center spec itself is **still to be written (open item C16)**.
- **Existing legal pages** are hand-authored JSX: `privacy-policy` (516 lines), `terms` (541 lines), plus
  `cookie-policy`, `cancellation-policy`, `legal-notice`, `manage-cookies` — **English on every locale**, via
  `components/frontend/legal/legal-page-shell`.
  - Header comment: **verbatim handover copy, change only through Denley per the README.**
  - The full Cancellation Policy page stays reachable from the footer and from the on-page Cancellation
    Policy section.
- The footer already carries **four inert labels waiting for routes** (about, help, contact, …).
- **`robots.txt`:** disallow `/admin`, `/api`, `/dashboard`; allow `/`; declare the sitemap.
- **Sitemaps:** `/sitemap.xml` index plus **per-locale and per-page-type sitemap files**; published entities
  only; categories below the ≥3 threshold excluded; `lastmod` on change.
- **Canonicals & hreflang:** each locale version has its own canonical (the flat per-locale URL); every
  entity page outputs hreflang for all 7 locales **plus `x-default → English`**; renames issue a **301**;
  deleted slugs observe the **90-day reuse cooldown**; filtered listing URLs (`?booking_type=private`) carry
  a **self-referencing canonical** to the clean URL.

---

### D.14 Navigation bar, footer, island selector, currency and locale switchers

**Navigation bar (§3.9)**

- Nav is **sticky**.
- **Destination-context state contains:** logo, **location selector showing the current island**, Categories
  dropdown, search, **language switcher**, wishlist, account.
- Categories dropdown shows the **curated discovery list**, items with **40 to 48px rounded thumbnails**
  (Fever pattern).
- Search: **compact pill while the hero is in view, expanded after scroll, scoped to the destination**.
- **Homepage variant:** the location selector reads `Select your island`; **Categories and search are
  HIDDEN** (no destination context).
- **The currency selector lives in the footer only, NEVER the nav.**
- On hub pages the nav shows the logo black on white, location indicator `📍 Curaçao`, an active Categories
  dropdown, and the compact expanding search pill.

**Footer (§3.10)**

- **Global footer on EVERY page.**
- Contains: **destination links (Curaçao · Aruba · Sint Maarten)**, support (WhatsApp link with deep-link
  behavior), legal, **language switcher**, **currency selector (locale-defaulted)**, **payment logos in
  white/monochrome**, and the brand sign-off `Built by Islanders.` **at display size**.
- The footer sign-off is the tagline's **one persistent on-page home** (the tour-page closing trust block
  was dropped).
- Mobile renders the footer **fully expanded, never an accordion**.
- **No black-and-white Curaçao flag** on the Explore links.
- Payment logos and the **Powered by Stripe** badge align **flush to the language pill's outer left edge**
  (locked).
- **Payment logo set:** VISA, Mastercard, PayPal, iDEAL, Apple Pay, Google Pay, Klarna, Amex.
- **Footer renders payment logos monochrome; in-section renders full color.**
- The footer carries `For operators` next to `Manage your booking` (wrong-door routing, D.19.6).

**Trust components per page type (locked matrix, §3.11)**

- The platform **deliberately varies the trust component by surface**; the matrix is the outcome of the
  cross-surface trust review and is **intentional**.
- Homepage → **micro trust bar (3 columns) PLUS** full "Need help before booking?" with FAQ column.
- Destination → full "Need help before booking?" with FAQ column.
- All Tours → **compact trust strip: 4 checkmarks plus WhatsApp link, no payment logos, no FAQ**.
- **Category and Activity Hub → NO trust bar.**
- Collection → `<NeedHelpSection showFAQ={false} />` with payment logos and the collection FAQ as its right column.
- Tour detail widget → **2-line clickable trust strip**; **single line on `paid_in_full` and `operator_full`**.
- Checkout payment step → **exactly 2 signals**: "Secure checkout" cue with the official Stripe slate badge,
  plus the free-cancellation line at the CTA; on `operator_full` **only the free-cancellation line renders**.
- **NeedHelpSection checkmarks LOCKED June 10, 2026: TWO lines, no longer four** —
  `Free cancellation, no questions asked` · `Pay as little as 20% today, the rest later`.
  - "Confirmed in seconds" and "Safe & secure checkout" are **dropped from the NeedHelpSection component**.
  - ⚠️ CONFLICT — B.74 records the same drop but with the first checkmark worded
    `Free cancellation on most tours, no forms`; §3.11 records `Free cancellation, no questions asked`.
- NeedHelpSection left column also carries the **"We're locals" support line, WhatsApp CTA with team
  avatars, and payment logos**.
- **NeedHelp FAQ answer to "Can I cancel if my plans change?" LOCKED June 10, 2026:**
  `Every tour can be cancelled for free. How late you can cancel differs per tour; the exact cut-off is on the tour page and in your confirmation email. No forms, no questions asked.`
  - **No numeric range in that answer:** the LD1 enum allows 168h, so a quoted 24-to-72 range would break the
    moment a one-week-window tour publishes.
  - Detail belongs in the FAQ; **page-level lines stay hour-free**.
- **Trust copy matrix LOCKED: two deposit phrasings, no longer three.**
  - The page-level deposit sentence is `Pay as little as 20% today, the rest later` — in full on the
    NeedHelp checkmark and on the All Tours trust strip.
  - The homepage micro bar renders it **split**: label `Pay as little as 20% today` plus clarification
    `Secure your spot now, pay the rest later`.
  - The **widget strip alone** uses the tour-precise `Pay only {X}% today, the rest later`, **on the deposit
    models only**.
  - **Do not cross-apply the deposit phrasings.**
- The **"on every tour" universality claim is homepage-exclusive** (trust bar row 2); every other surface
  uses "Free cancellation, no questions asked".

**Breadcrumbs (§2.7 / §3.4 Tier 3)**

- Separator: **`›` exclusively**. The final crumb is the current page and is **not clickable**.
- **JSON-LD `BreadcrumbList` emitted on every page that has breadcrumbs.**
- Tour pages have **three path variants** chosen by the tour's primary attachment (hub-anchored,
  category-anchored, flat).
- Non-tour breadcrumbs: Destination `Home › Destination`; Category `Home › Destination › Category`;
  Activity Hub `Home › Destination › Activity Hub`; Collection `Home › Destination › Collection`.
- **Mobile visibility is a deliberate per-page divergence:** breadcrumbs are **visible on tour detail pages**,
  **hidden on destination pages** (replaced by the nav back-arrow).

**Typographic separator system (LOCKED June 10, 2026, §3.4)**

- **Three tiers, platform-wide. The earlier four-tier system that used a pipe between info categories was
  reversed; the pipe is retired everywhere.**
- Tier 1 — `·` middot — between inline items and info categories in a single row. Examples:
  `★ 4.8 (1,738) · ✦ Locals' favorite · 📍 Willemstad, Curaçao` and `Full day · 8 to 9h · From $120`.
- Tier 2 — `,` comma — **inside one geographic reference only** (`Willemstad, Curaçao`). The comma is
  grammatical notation, not a separator tier.
- Tier 3 — `›` right angle — **breadcrumbs only**.
- **ZH may render the full-width comma.**
- Hub fast-facts rows that previously mixed pipes **normalize to middots**.

---

### D.15 Discovery: the tour card, filters, sorting, pagination and the grid standard

#### D.15.1 The shared tour card (§3.5)

- **A single `<TourCard />` is used on EVERY listing surface.**
- **The whole card is clickable; NO CTA button on cards.**
- Heart (save) control **top-right**; badge slot **top-left**.
- Desktop card: image carousel of **5 to 7 photos plus a final description slide**.
- Mobile card: **horizontal layout, image 40% / content 60%**.
- Meta line: duration via the **shared duration formatter**.
- Meta line: price rendered `from $120` — **lowercase "from" on cards**; prices are **starting** prices.
- Meta line: rating rendered `★ 4.8 (1,738)` with **locale-aware thousands separator** and **no word
  "reviews"**.
- **Rating renders only at `review_count >= 3`.**
- Tours **under 30 days old with zero reviews show the `New` badge instead of the rating row**.
- Pickup line per `pickup_model`: **"Pickup included"** when pickup is in the price; **"Pickup available"**
  when pickup is a paid add-on; **nothing** when none. **No hyphen in "Pickup", platform-wide (LD3).** The
  filter label is **always "Pickup available"**.
- **"Free cancellation" indicator renders as the LAST card line** where applicable.
- **"Price on request"** is the fallback label for unpriced tours (superseding "Contact for pricing").
- Group-priced tours read `from $270 per group` (full label, muted); per-person stays `from $36` with no suffix.
- Floating card style; **3-column 1200 container is the platform standard** (superseding the tour-card doc's
  4-column 1280 grid).
- Card URLs are `/{locale}/{destination}/{slug}/` (superseding `/tour/{slug}`).
- **Collection Rationale:** optional italic line under the title, **collection pages only, max 20 words**.
- **GA4 events on the card:** `view_item_list`, `select_item`, `add_to_wishlist` — with **list id and index**.

**Peach/ivory tint on card #1 (locked)**

- The top-ranked card in every curated list gets a **subtle peach/ivory background tint**.
- The tint fills the **FULL card area including the text block below the image** — not just the image frame.
- **Trigger rule: position #1 per curated list — NOT badge-based. Exactly one tinted card per list.**
- **Applied on:** homepage sections (Featured Destinations, Top Picks), collection pages (persona
  collections), activity-hub-adjacent curated lists, destination-page top-tour sections, and **All Tours
  card #1 — in both curated and All Tours cases ONLY while the default "Locals' favorites" sort is active**.
- **The tint DROPS under price sorts** (dynamic ranking).
- **NOT applied on:** search results (dynamic ranking makes tint feel unstable), related-tours carousels on
  detail pages (subordinate context), **numbered collections**, and **hub pages** (the hub no-peach rule stands).
- Tint colour: soft peach/ivory approx `#FDF6F0` / `#FFF5EE`; **final hex chosen by the designer within the
  brand palette**. It must be **warmer than pure white, subtle enough not to interfere with text contrast,
  and harmonize with real tour photography**.
- Pattern reference: Viator uses a mint-green tint on their #1 listing card (e.g. `viator.com/Rome/d511-ttd`);
  we adapt to **warm peach for Caribbean warmth**.

**Duration formatter (locked rendering rules, locale-aware)**

- Driven by `duration_minutes`, with optional `duration_minutes_max` for ranges.
- Unit words and "to" **translate per locale via a locale-aware formatter, NEVER string concatenation**.
- **Same format on mobile and desktop.**
- `< 60 min` → `45 minutes`.
- Exactly `60 min` → `1 hour` (singular).
- Whole hours only → `4 hours`.
- Hours + minutes → `4 hours 30 minutes`.
- Whole-hour range → `4 to 5 hours`.
- Mixed range → `2 hours 30 minutes to 3 hours` — **endpoints in full, NO decimals** ("2.5 to 3 hours" is
  awkward and reads commerce-y).

#### D.15.2 Badges (§3.6)

- **Sponsored** — rounded rectangle, gray — trigger: **paid tiers P1 to P3 placements** — **always shown on
  paid placement; transparency is a brand pillar**.
- **Most popular** — rounded rectangle, brand orange — trigger: **organic tour, `review_count >= 10` and
  rating `>= 4.5`; max 1 per category** — **never awarded on commission-tier grounds**.
- **Likely to sell out** — rounded rectangle — the single platform demand trigger.
- **New** — rounded rectangle — trigger: tour published **under 30 days ago AND `review_count = 0`** —
  **replaces the rating row on cards**.
- **Numbered rank 01 to 10** — **circle**, brand orange — trigger: **Best Things to Do and Top 10
  collections only** — **circles mean rank; rounded rectangles mean status; never on destination-page sections**.
- **Locals' favorite ✦** — a meta-row element on tour pages — trigger: the **manual editorial boolean
  `tour.is_locals_favourite`**, target ~30% of catalog — **not algorithmic, not tier-linked**; also drives
  the destination featured grid and the Top 10 Tours page.
- **Max 1 badge per card.** Badge priority order: `Likely to sell out` > `Bestseller` > `New`.
- Badge shape: **small rounded pill — never a flag or ribbon**. Position: top-left on image (desktop) / top
  of right-half (mobile).

#### D.15.3 Demand signaling: ONE trigger (LOCKED June 10, 2026, §3.7)

- **One algorithm** powers both the listing-card "Likely to sell out" badge and the tour-page demand card.
- **All three conditions must hold, evaluated DAILY:**
  1. `tour_age_days >= 90`.
  2. `recent_sellouts >= 3` in the past **60 days**.
  3. `upcoming_availability_ratio < 0.40` over the next **30 days**.
- A **manual CMS override flag** exists for the launch phase (no tour has 90 days of history at launch) and
  is **removed once organic data accrues**.
- Sellout events come from `departures.sold_out_at`.
- **Expected coverage ~5 to 10% of catalog; selectivity is the feature.**
- This supersedes the three earlier per-page trigger definitions.

#### D.15.4 Ranking, diversity pass and pagination

- **Ranking rule.** For any category page or search query, tours are sorted by:
  1. `tier_rank` **ASCENDING** (1 before 4).
  2. `quality_score` **DESCENDING**.
  3. `tour_id` **ASCENDING** (stable final tiebreaker).
- Canonical query:
  `SELECT * FROM tours WHERE category_slug = $1 AND status = 'active' AND is_bookable = true ORDER BY tier_rank ASC, quality_score DESC, id ASC LIMIT $2 OFFSET $3;`
- For search queries, replace the `category_slug` filter with the search match condition; **the `ORDER BY`
  block is IDENTICAL**.
- **Diversity pass (§3.8):** after ranking, listings apply a diversity pass — **never more than 2 tours of
  the same subtype consecutively**. On search it applies **per relevance bucket**.
- **Pagination:** All Tours 3×6 = **18 per page** desktop; **mobile 1 column with pagination after 12**.
- **Dual count (locked):** the **page header** carries the static catalog-scope signal `{Y} tours available`;
  the **grid header** carries the dynamic filter-state signal `{X} of {Y} tours` plus dismissible
  applied-filter pills and `Clear all`. **The two counts have different semantic roles and are NOT duplicates.**
- The **results counter carries the transparency tooltip** (`32 tours ⓘ`) explaining ranking and the
  Sponsored label. **The sort dropdown NEVER carries the tooltip.**

#### D.15.5 The filter row

- **Never a sidebar** (the architecture document's sidebar stays superseded).
- Filter row (All Tours): **one row, two zones separated by a vertical divider, sticky on mobile**.
- Layout: `[Date] [2 Adults] [Filters ●n] │ Klein Curaçao · Boat Tours · Snorkeling · Sunset Cruises · Buggy Tours → Sort by: Locals' favorites ▼`.
- **Date chip:** single-month calendar, **12 months forward**; filters to availability on the date; active
  state shows the date with a clear control.
- **Adults pill:** opens the **3-tier travelers popover** (Adults 12+, Children 4 to 11, Infants under 4 with
  "Free on most tours"). It **feeds age-based pricing and availability filtering**.
- **Filters button:** opens the filter modal; **count badge when filters are active (`Filters ●2`)**.
- **Category chips are navigation links** to `/{locale}/{destination}/{category-slug}/`, **not facet
  filters**; horizontal scroll on overflow.
- **Category pages reuse the filter row WITHOUT the category chips** (the related-categories block covers
  lateral navigation).
- **Activity Hub uses its own chip set** (Klein Curaçao: Date · Catamaran · Powerboat · Beach house · Open bar).
- **Collections have no sort and no filter chips: the editorial order is the product.**
- Filter state lives in **query params with self-referencing canonicals to the clean URL**; `ItemList` plus
  `BreadcrumbList` schema; **server-rendered crawlable list**. (Supersedes "client-side only, no URL parameters".)
- **Session storage preserves filter state for back navigation.**

#### D.15.6 The final locked filter modal — SIX sections

- **Every one must actually filter.** Same count as the original spec, with **two dead filters (Booking
  type, old Pickup-included) swapped for two live ones (Time of day, Pickup-available)**, and **two reworked
  (Duration bands, Free cancellation window)**.
- **Order top to bottom:**
  1. **Price** — slider, `$0` to max. The earlier price-preset chips are **retired**.
  2. **Duration** — **4 multi-select bands**: `up to 2h · 2 to 4h · 4 to 6h · full day 6h+`. Maps to
     `duration_minutes`; **boundary rule is lower-bound-inclusive, upper-exclusive** (a 4h tour falls in
     4 to 6h).
  3. **Time of day** — multi-select `morning · afternoon · evening`. Maps to start times, stored as a set; a
     tour with morning and evening departures **matches both**.
  4. **Free cancellation window** — **single-select**: `up to 24h · 48h · 72h before`.
     - **Subtext LOCKED:** `All tours include free cancellation. Filter by how late you can cancel.` —
       **13px, `#6B7280`, WCAG AA**.
     - Replaces the dead yes/no toggle; maps to `cancellation_hours`; **exact filter logic (including 168h
       tours) is TO CONFIRM with product before build**.
  5. **Pickup available** — **toggle, default off**. **"Available", never "included"**: no expectation of
     free pickup in the base price. Matches any tour with `pickup_model` other than `none`.
  6. **Ratings** — single-select `3.0+ · 4.0+ · 4.5+`. **HIDDEN entirely until tours cross the 3-review
     render threshold; flips on PER ISLAND.**
- **Removed: "Booking type"** — it was a no-op.
- The **Apply button shows a live result count** against the unapplied selection.
- **Filters combine with AND logic.**

#### D.15.7 Sorting — exactly THREE options at launch

- **Sort control (All Tours and Category):** right-aligned on desktop, **full-width select on mobile**; the
  current option is always shown inline as `Sort by: {option}`.
- **Option 1 — `Locals' favorites` (default)** — logic: the platform ranking
  `tier_rank ASC, quality_score DESC, id`. **The label is the UI name for this ordering.**
- **Option 2 — `Price: low to high`** — `price_from` ascending.
- **Option 3 — `Price: high to low`** — `price_from` descending.
- Supersedes the earlier six-option spec.
- **Reactivation path (documented June 10, 2026):** `Highest rated` returns once the destination has a
  meaningful review base (mirroring the modal's Ratings gate); `Most booked` returns once booking volume is
  meaningful (then also an honest counterweight to tier ranking).
- **`Newest` stays out; the `New` badge covers recency.**
- ⚠️ CONFLICT — spelling: `[ALLTOURS-MUST]` and the filter-row layout use British `Locals' favourites`;
  §4.3 locks **US English platform-wide** with `Locals' favorite(s)` in all copy (badge, sort label, section
  headers, Top 10 page). **The internal CMS field `is_locals_favourite` keeps its existing spelling** —
  field names are not user-facing and a rename has no migration value.

#### D.15.8 Sitewide tour-grid standard

- Every tour-card grid (tours / collection / hub / related / search / wishlist) uses the same grid;
  **mobile carousels stay carousels**.
- All Tours grid: **3 columns desktop, 18 per page (3×6)**; **mobile 1 column, pagination after 12**.
- Category and collection grids: **3-column**.
- Related tours: **3 cards per row max**, desktop 3-across, **mobile horizontal scroll snap with 1.2 cards
  visible peek**.
- Hub tours grid uses the shared grid with hub chips and **no peach card**.

---

### D.16 The "Fixes" list (tour card)

- **Fix 1 — Remove the 01/02/03 ranking ribbon.**
  - Delete the red folded-ribbon element from the tour card entirely.
  - **Position in the grid becomes the ONLY ranking signal** (no numeric rank rendered).
  - Reason: violates "max 1 badge per card" — ribbon + pill = two badges.
  - Reason: breaks in carousels (cards 4–6 render "04, 05, 06" with no context).
  - Reason: breaks on filtered search results (rank changes per query).
  - Reason: stylistically dated — no major experience platform uses ranking ribbons.
- **Fix 2 — Badge system with proper colour hierarchy.**
  - Problem: identical light-green pills for all three badges collapse the hierarchy; **each badge must look
    different**.
  - `Likely to sell out` — function urgency — **red or deep orange background, white text**.
  - `Bestseller` — function authority — **dark (near-black or deep navy) background, white text**.
  - `New` — function neutral framing — **off-white / ivory background, dark text**.
  - **Green is BANNED for these badges:** in booking UIs green signals deal/discount and none of our badges
    mean that. **Green is reserved in-spec for a future "Special Offer" badge** — using it now exhausts the
    vocabulary.
  - Current light-green-on-light-green **likely fails WCAG AA contrast**.
  - **Copy fix `Best Seller` → `Bestseller`** (one word; industry convention — NYT, Amazon, Klook, GYG).
  - ⚠️ CONFLICT — B.33 supersedes the listing badge name again: **`Bestseller` → `Most popular`** (category
    review chain), and §3.6 defines `Most popular` with its own trigger (organic, ≥10 reviews, ≥4.5 rating,
    max 1 per category).
- **Fix 3 — Add the wishlist heart.**
  - Currently missing; **REQUIRED on every card**.
  - Desktop position: **top-right overlay on the image**. Mobile position: **bottom-right overlay** (avoids
    badge collision).
  - Visual: **~32px white circular backdrop, subtle shadow, heart icon inside**.
  - States: **outlined (default) → filled brand-orange (wishlisted)**.
  - Behaviour: click toggles; **optimistic UI — fill immediately, revert on API failure**; **no page
    navigation on click**.
- **Fix 4 — Image carousel: photo count + description last-slide (desktop).**
  - The card needs a **5–7 photo carousel with a description snippet as the last slide** (the wireframe shows
    a static image). **Supersedes the earlier "3–5 photos" spec** — 3–5 was too conservative; **5–7 is the
    current industry standard**.
  - Photos: `hero_image` first; the rest pulled from `gallery_images`.
  - **Dots always visible**, bottom-centre of image, white with partial opacity.
  - **Arrows fade in on card hover only**, on the left/right edges of the image.
  - **Lazy load: only the first image loads immediately**; others load on first interaction.
  - Transition: **slide, 300ms ease-out**.
  - **Mobile: single `hero_image`, NO carousel** — touch users rarely swipe deep on listing cards and the
    detail-page carousel covers the use case.
  - **Last slide (desktop only) — description snippet:** first ~150 characters of `description` (the same
    field used on the detail page), **truncated on a word boundary**, ending with `...More` which navigates
    to the detail page; light background (not an image), readable typography, same card corner-radius as
    image slides. **Never rendered on mobile.**
  - **Wireframe requirement:** draw the dots on the image even in the wireframe so dev knows it is a carousel.
- **Fix 5 — Keep the USP in the title (no separate highlight line).**
  - The wireframe title `Klein Curaçao Catamaran Day Trip with Open Bar & BBQ` is **CORRECT — no change
    needed**. The note exists only to prevent the pattern being re-opened during revision.
  - Rationale: Viator, GetYourGuide and Airbnb Experiences all put the USP in the title and omit inclusion
    bullets on listing cards. The USP is visible in **100% of viewports with zero extra vertical space**.
  - **Title convention for operator onboarding:** `[Tour core identity] + [single strongest USP]` — e.g.
    `Klein Curaçao Catamaran Day Trip with Open Bar & BBQ`, `Sunset Sailing Cruise with Unlimited Drinks`,
    `Private Yacht Charter with Custom Itinerary & Snorkel Gear`.
  - **No `highlights[0]` field on the card component;** the `highlights` array stays on the tour object for
    the detail page.
- **Fix 6 — Outlined check-circle icon for Free Cancellation.**
  - Replace the plain `✓` character with an **outlined check-circle icon** (circle outline + checkmark inside).
  - Reason: a plain `✓` reads as a text character, not an icon, and scans weaker beside duration and pickup.
  - **CRITICAL: all meta-row icons (duration clock, pickup car, cancellation check) share the same style,
    stroke-width, size and colour**, pulled from a **SINGLE icon library** (Heroicons, Lucide or Feather —
    whichever the rest of the UI uses).
  - **Style outlined, NOT filled.** Filled check-circles read as "success/confirmed" (form submission,
    booking confirmation) and create cognitive mismatch on a not-yet-booked card.
  - **Size 16–20px**, matched to duration and pickup icons. **Colour: muted neutral gray**, same as other
    meta-row icons.
  - Source examples: `CheckCircle` (Heroicons-outline) or `CircleCheck` (Lucide).
  - Cheap for dev: no custom icon, just swap the character for a library icon already in the set.
- **Fix 7 — Copy fixes.** `Pickup is available` → `Pick-up available` (hyphenated form signals
  optional/at-extra-cost, matching operator reality; unhyphenated "Pickup" implies included; the word "is"
  is dead weight); `Best Seller` → `Bestseller`.
  - ⚠️ CONFLICT — see D.5.2: LD3 locks **"Pickup" with NO hyphen platform-wide**, `[ALLTOURS-IMP]` locks
    `Pickup included`, and B.69 resolves it per `pickup_model`.
- **Fix 8 — Thousand separator on review count.**
  - The `4.8 (1738)` format is almost correct — **omitting the word "reviews" is the right choice**.
  - **Only fix: add a locale-formatted thousand separator** — `4.8 (1,738)` for en/es/pt; `4.8 (1.738)` for
    nl/de — via `toLocaleString()` per active locale. **Same format across all viewports.**
  - **Accessibility:** `aria-label="4.8 out of 5 stars, 1,738 reviews"` on the rating element. Sighted users
    see clean numbers; screen readers get the full context.
  - **Master-spec correction:** the master UI/UX Structure doc's mobile `(3)` vs desktop `(3 reviews)`
    distinction is **WRONG**; the wireframe is right.
- **Fix 9 — Duration formatter** — see D.15.1 for the locked rules.

**Banned words (platform-wide, enforced by LD9)**

- `paradise` (emptied of meaning; every Caribbean ad uses it) · `luxury` (not our positioning; we're
  authentic, not premium) · `exclusive` (implies gatekeeping; we're the opposite) · `seamless` (corporate
  SaaS language) · `world-class` (says nothing) · `curated` in headlines (overused by every DTC brand; fine
  internally, never customer-facing) · `discover` as verb opener (every travel platform's verb; we don't
  discover, we know) · `unlock` (growth-marketing speak) · `adventure awaits` (travel cliché hall of fame) ·
  `committed to` (corporate mission-statement filler).
- Also banned (§4.2): `magical`, `amazing`, `incredible` (without specifics), `hassle-free`,
  `curated by experts`, `premium` (without justification), `don't miss out`, `hurry`, `Subscribe` (use
  "Email me"), `Submit`, `Customer support` (use "WhatsApp us"), and `cart`/`checkout` in customer-facing labels.
- **No em-dashes anywhere.** Use periods, commas, colons, occasional semicolons.
- **Two sanctioned exceptions:** the category label `Luxury Experiences` with its category-page H1, and the
  homepage hero H1 which **subverts** "discover" instead of using it.
- **Operator names never appear in discovery-layer copy** (cards, hub comparison tables, Our Pick,
  collections). Operators are named in exactly two contexts: the tour-page `Supplied by {operatorName}` line
  and post-booking surfaces (TYP, confirmation email).
- **Claims must be verifiable.** No invented stats; directional benchmark language only when honestly labeled.
- Tagline usage: `Island Tours. Built by Islanders.` full form beneath the logo and in brand contexts;
  closing form `Built by Islanders.` as sign-off in the global footer, email sign-offs, and end of long-form
  copy. **The tagline stays English in all locales.**
- **US English platform-wide** ("travelers" is locked in multiple strings).
- **24-hour clock** in all transactional and deadline copy; **"(local time)" retained wherever a
  money-relevant deadline is stated**; arrival buffer language is **dynamic** ("arrive 5 minutes early" for
  pickup, "arrive 30 minutes early" for meeting-point tours, overridable per tour).

**Icon system (LD20)**

- **Single SVG icon set, line style, monochrome.**
- Sub-headers that DO use icons: **What's Included** (check + cross) and **Meeting & Pickup** (pin/clock/van).
- Sub-headers that do NOT use icons: **Important Info subsections** (typography only).
- **Specifications: 18–20px size; line style ~1.5px stroke; monochrome.** Colour neutral gray (`#6B7280` or
  equivalent) for sub-header icons; **brand orange `#E8611A` reserved for active/highlighted states only**.
- **NO mixing of icon sets across the page. NO emoji rendered in production UI** — rendering varies across
  OS/locales, casual brand feel, unprofessional for $150+ products.
- **Body copy uses NO inline icons** (preserve scanability and reading rhythm).
- Icons are **decorative/scan-aid only** — sub-header text must be self-sufficient.
- **Markdown convention:** wireframes in specs use emoji as text-shorthand for SVG icons (`📍` = map-pin,
  `🕐` = clock, `✓` = check); implementations use proper SVG.
- **Required minimum icon set for v1 launch:** check, x (cross), pin, clock, van/bus, star, sparkle,
  heart-outline, arrow-up-right, globe.
- Recommended library: **Lucide** (or Heroicons as alternative — the design team chooses one and locks it).

---

### D.17 Homepage CMS and the Pages/CMS system

> Two related but **deliberately separate** systems: (1) **Homepage content** — fixed sections, editable
> content; (2) **Pages** — a WordPress-like permalink system, **scoped to legal pages for now**.

#### D.17.1 Why two systems and not one page builder

- The instinct is to make the homepage "just another page" in the Pages system. **We deliberately did not.**
- Homepage sections are **pixel-locked Figma layouts**: a fanned three-card deck, a fixed-width Embla
  carousel with a fixed dot count, a specific hero crop. **A block builder would hand an admin the ability
  to compose layouts that do not exist in code — effort spent building freedom we would then have to defend
  against.**
- **So the homepage lets an admin change WHAT IS IN a section, never WHETHER a section exists. Section order
  and structure stay in code.**
- **Legal pages are the opposite case:** genuinely arbitrary long-form documents that will grow (about, help,
  contact). **Those get a real permalink system.**

#### D.17.2 The fallback contract (the load-bearing decision)

- **Every homepage content field is nullable, and null means "use the built-in i18n dictionary default"** —
  `content.heroTitle || dict.home.hero.title`.
- This makes the work shippable incrementally:
  - **An empty table renders exactly the pre-CMS homepage.** No content-entry milestone gates the deploy.
  - **Clearing a field restores its default** rather than blanking the section.
  - **Rollback is "empty the table".**
  - **A backend outage degrades to bundled copy** — hence `publicGet`, **never `publicGetStrict`**: the
    site's front door must not 404.
- **Note the operator is `||`, not `??`:** an empty string from the DB **must fall back too**, or a cleared
  field renders a broken image / empty heading.

#### D.17.3 Editable blocks and fields

- **`HomePage` singleton** (`id @default("default")`): `heroImage`, `editorialImages String[]`,
  `editorialDestinationId`, `ogImage`. **The destination FK is `onDelete: SetNull`** — deleting an island
  must not delete the homepage row.
- **`HomePageTranslation`** keyed `@@unique([homeId, locale])`, mirroring every other `*Translation` table:
  `heroTitle`, `heroSubtitle`, `experiencesTitle`, `editorialTitleLine1`, `editorialTitleLine2`,
  `editorialBody`, `editorialCta`, `faqTitle`, `faqSubtitle`, `isMachineTranslated`.
- **Routes** (`MANAGE_EDITORIAL`, admin-only — this is editorial curation, so it sits with the other manual
  admin flags):
  - `GET /home-page/public?locale=` — `@Public()`
  - `GET /home-page` · `PATCH /home-page`
  - `GET /home-page/translations` · `PATCH /home-page/translations/:locale`
- **Service invariants:**
  - **The public read is a `findUnique`, NEVER the self-seeding upsert the admin read uses — an anonymous
    GET must not write.** A missing row returns an **all-null payload rather than 404**.
  - **An archived editorial destination reports `editorialDestinationSlug: null`** so the homepage never
    advertises a link that 404s.
  - **Writes use conditional spreads** so an absent field is untouched and an explicit `null` clears it.
  - **Translation writes seed the singleton first**, so the FK always resolves.
  - Translation copy uses the **`{ fields: {...} }` wrapper**. **There is no delete route: clearing is a
    null upsert** (the English-tab "Clear Fields" pattern), because **deleting the base locale would strand
    the section headings**.
- **Public loader** `lib/api/public/home-page.ts`: `'use cache'` + `cacheLife('days')` +
  `cacheTag('homepage')`, `publicGet` with an all-null fallback.
- **Cache-tag contract:** `homepage` added to `COARSE_CACHE_TAGS` in **both repos** (byte-identical), plus a
  `case 'home-page'` in the dashboard's `tagsForMutation`. **Coarse rather than granular because there is
  exactly one homepage.**
- **Wired on the public site:** `Hero` takes an optional `image`; `EditorialCardFan` takes optional `images`
  **matched by index** (a short array leaves the remaining cards on bundled photos — **the deck always
  renders three**); `EditorialBanner` passes them through; `page.tsx` resolves **DB-over-dictionary** for
  hero title/subtitle, experiences heading, editorial title lines/body/CTA, and FAQ title/subtitle. The
  editorial CTA targets the admin-chosen island, falling back to the previous "Curaçao, else first
  destination, else /search" chain.
- **All three loaders are cached, so the homepage stays part of the prerendered shell — no Suspense boundary
  was added**, consistent with the render policy.

#### D.17.4 Featured experiences (Top Island Experiences)

- **`FeaturedExperience` already existed** (`prisma/destinations.prisma`), migrated and demo-seeded, **with
  ZERO application code**: `entityType (CATEGORY|HUB) + entityId + destinationId? + videoUrl + displayOrder
  + isActive`. **The `videoUrl` column exists precisely for the video cards `top-experiences.tsx` hardcodes.**
  It survived the slot-economy purge deliberately. **Top Island Experiences is therefore a wiring job, not a
  design job.**
- **Top Island Experiences is admin-curated and covers Categories and Hubs ONLY — never individual tours.**
- **Routes:** `GET /featured-experiences/public?locale=&destination=` (`@Public()`); `GET`, `POST`,
  `PATCH /:id`, `DELETE /:id` (all `MANAGE_EDITORIAL`).
- The resolver returns `{ id, entityType, title, image, videoUrl, href }` where **everything except
  `videoUrl` comes from the referenced Category/Hub — so a card inherits that entity's translations and can
  never drift from its target page.**
- **THE GATE IS THE FEATURE.** Every card **mirrors the exact condition its target page 404s on**, and
  anything that fails is **dropped**:
  - **category:** `destination.isActive && category.isActive && liveTourCount > 0`
  - **hub:** `isActive && status === PUBLISHED && liveTourCount > 0`
  - **a hub pinned to an island other than its own** (a curation mistake) is dropped
  - **an orphan row whose target no longer exists** is dropped
- **Image falls back `heroImage || ogImage || null`**; the frontend then falls back to bundled art. (The demo
  seed populates `ogImage` but NOT `heroImage` on categories, so without this fallback every card rendered grey.)
- **Public loader carries `cacheTag('homepage', 'tours')`. The second tag is load-bearing:** card visibility
  depends on the target still having a live tour, **so a tour going dark must regenerate the list or the
  carousel keeps advertising a page that now 404s.**
- **Frontend:** `TopExperiences` takes an `experiences` array and **derives its slide count, loop copies,
  start index and dot row from it** instead of module constants. **Fewer than 3 resolved cards falls back to
  the bundled deck** — the same never-blank contract, and it avoids a one-card "carousel" reading as a glitch.
  Cards are now navigable, closing a real UX gap (they were previously `<button>`s with no link at all).
- **Two implementation details easy to get wrong:** the link is a **stretched overlay sibling**
  (`absolute inset-0 z-10`), **not a wrapper**, because the play control is a `<button>` and **a button
  nested inside an anchor is invalid HTML** (the button sits at `z-20`); and **Embla 8 has NO
  `clickAllowed()`** (that was v7), so **drag-vs-click is decided by measuring pointer travel against an 8px
  slop** — a card that is not centred **pulls into the centre instead of navigating**.
- **Plan corrections:** (1) "Add relations + cascade" was **impossible for `entityId`** — it points at either
  a Category or a Hub depending on `entityType`, and a relational FK targets exactly one table; handled by
  skipping unresolvable rows, validating existence in the service, and clearing rows in the one hard-delete
  transaction. (2) A **destination-less CATEGORY row had no URL at all** — category pages exist only
  per-destination and **all 7 seeded rows were `destinationId: null`, i.e. every one was unresolvable**;
  they now resolve to **the destination where the category has the most live tours (ties broken by id, so
  the pick is stable)**, guaranteeing `count > 0`.
- **Duplicate protection:** `FeaturedExperience` had no uniqueness protection, so the identical card could
  render twice. **A unique index cannot express this** — `destinationId` is nullable and Postgres treats
  NULLs as distinct. **`assertNotAlreadyFeatured` on create AND update, returning 409.**
- ⚠️ CONFLICT — the hub gate's comment claimed parity with `hubs.service.render()`. **It does not have it:**
  `render()` gates only on `isActive` + `PUBLISHED`, and `assertPublishable` never requires a tour, **so a
  hub with zero tours renders a valid page**. The extra live-tour check is **kept deliberately** ("a 'top
  experience' with nothing bookable is a dead end even at 200"), but the comment/swagger now say so, and
  note the admin-facing consequence: **a published hub can be featured and silently not appear**.

#### D.17.5 Homepage FAQ

- **Schema:** a single `ALTER TYPE "FaqPageType" ADD VALUE 'homepage'`, plus `FAQ_PAGE_TYPE.HOMEPAGE`.
- **Routes** (all `MANAGE_EDITORIAL`), thin delegation to the `@Global` `FaqGroupService` which treats the
  homepage as just another `(pageType, entityId)` pair: `GET/POST /home-page/:entityId/faqs/groups`,
  `PATCH/DELETE /home-page/:entityId/faqs/groups/:groupId`,
  `PUT /home-page/:entityId/faqs/groups/:groupId/translations/:locale`.
- **`:entityId` is always the singleton key `'default'`, and anything else 404s** — a typo must not write
  orphan FAQ rows. It stays in the path purely so the dashboard's shared `FaqManager` and `faqGroupsApi`
  work here with **ZERO dashboard changes**.
- **Public FAQs ride along inside the existing `GET /home-page/public` payload** rather than getting their
  own endpoint: the homepage needs copy and FAQs together, so one cached read beats two.
- **Locale rule: only FAQs that exist in the REQUESTED locale are returned** — an untranslated FAQ is
  **omitted rather than falling back to English**, because a Dutch reader should not hit an English answer
  mid-list. **An empty list means the frontend keeps its full bundled dictionary set**, so an untranslated
  locale shows a complete block rather than a half-English one.
- **Frontend swaps `faqDict.items` WHOLESALE** when curated FAQs exist — not appended, because a
  half-curated, half-hardcoded list would be impossible to reorder or reason about from the dashboard.
- **Pre-flight check that mattered:** `FaqSection` is shared by **five page types**, and the destination page
  passes `dict.home.faq` — **it reuses the homepage dictionary block**. So `FaqSection` and the dictionary
  were both left untouched; the homepage composes its own `faqDict`.

#### D.17.6 Dashboard Content group (the editor)

- **Nav: a `Pages` group, placed immediately before `Account`**, holding Homepage and gated
  `MANAGE_EDITORIAL`. **Grouped by what the items ARE — pages you edit — rather than by permission**, so the
  Phase-5 legal and marketing pages land beside the homepage rather than in Curate.
- **The route stays root-level (`/homepage`)**, like every other route; the editor uses **no
  `EntityDetailShell`** because it is a top-level tabbed singleton, same as Settings.
- `EntityTabs` **in the order the sections appear ON THE PAGE (Hero, Experiences, CTA Card, FAQs, then SEO)**,
  so **scanning the tab row is scanning the homepage top to bottom**.
- **Design rules, each enforced in one shared place:**
  - **Label by consequence** — a `where` prop describing where the text lands ("the large text over the hero
    photo"), **never a column name**.
  - **Show the fallback** — the shipped copy is the placeholder AND, while a field is empty, an explicit
    **"Currently showing the built-in default"** note. **Empty state on a fallback CMS otherwise reads as a
    missing section.** Defaults live in `lib/home-page/defaults.ts` — **the ONE cross-repo duplication**
    (display-only, so drift costs a stale hint, never wrong data).
  - **Publishing honesty** — "Saving publishes straight to the live homepage" beside every save button;
    **there is no draft state, so nothing should imply one**.
  - **English inline, other locales in the Console** — each translatable card links straight to the workspace.
- `useSaveHomepageSection` composes the two endpoints a tab spans (locale-agnostic fields + English copy) so
  **one button saves both, sequentially rather than in parallel** — both write the same singleton, and a
  half-applied pair is easier to reason about than two racing writes.
- **The Experiences tab is where the real product logic sits.** It surfaces the two ways curation silently
  does nothing: a card whose target has no live tour is dropped by the backend (**and for hubs that bar is
  HIGHER than the hub page's own**), and **below 3 live cards the site ignores curation entirely and keeps
  its bundled deck**, so 1–2 cards produce no visible change — the notice says so with the count. It also
  **warns past 5** (carousel geometry), **flags rows whose target was deleted**, and surfaces the 409
  duplicate error inline.
- **Translation Console:** `homepage` registered as a `TranslatableEntityType` with `HOMEPAGE_FIELDS`, a
  `HomepageWorkspace`, and **a single fixed `HomepageRow` in the matrix (no search, no pagination)**. Two
  additive singleton accommodations: `ContentWorkspace`'s page-content props became **optional** (the
  homepage has no About/SEO body, and rendering fields that save nowhere is worse than omitting them), and
  **`paginated` now excludes `homepage`**.
- **Review fixes (four real defects):**
  1. **The shared FaqManager pointed the homepage at a dead link** — `CONSOLE_TYPE_BY_BASE` had no
     `/home-page` entry and fell back to `?? 'destination'`. Added the mapping **and removed the fallback: an
     unmapped basePath now renders NO pointer, because a wrong link is worse than a missing one.**
  2. **The forms duplicated the shared settings kit** — `HomepageSectionCard`/`HomepageField` were
     re-implementations of `SettingsCard`/`TextField`/`TextareaField`/`ImageField`. **Both duplicates are
     deleted**; the label-by-consequence and show-the-fallback behaviour survived as
     `describeField(where, value, fallback)`.
  3. **A media field asked for a pasted URL** — the featured-experience video was a raw `<Input>`, the one
     field not backed by the media library. `MediaGalleryManager`/`MediaSelector` now take a **`kind`
     restriction** that seeds the type filter AND omits the setter (hiding the type dropdown entirely);
     selector toasts take their noun from the kind; `VideoSelectorField` + `VideoField` render a real
     `<video>` preview. **Kind is tested with `getMediaKind`, never `resourceType === 'video'`, because
     Cloudinary stores AUDIO under resourceType `video`.**
  4. Hand-written row types replaced by `Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>`.
- **Security fix (HIGH): unvalidated media URLs could take the homepage down site-wide.**
  `heroImage`/`ogImage`/`editorialImages`/`videoUrl` were `@IsString()` only. **`next/image` THROWS at render
  on a src it cannot load, and this row is a singleton inside the prerendered shell of every locale's front
  page — so one bad save blanked the site's front door in every language.** Fixed in **two layers**: write
  time `@IsUrl({ protocols: ['https'] })` + `@MaxLength(2048)` (**nulls still pass, so clearing still
  restores defaults**); render time `lib/images/remote-hosts.ts` as the **SINGLE source of truth for allowed
  hosts**, with `next.config.ts` deriving `remotePatterns` from it and `safeRemoteImage()` re-checking at
  render, falling back to bundled art. **Host allow-listing is deliberately NOT duplicated in the backend.**
- **Nav caveat worth recording:** `NavItem.items` is **TYPED for nesting but `nav-main.tsx` renders exactly
  one flat level (`group.items.map`, no recursion), so a nested child silently disappears from the sidebar.**

#### D.17.7 The Pages system (rich text) — NOT STARTED, two open decisions

- **Schema:** `Page { slug @unique, pageType, status DRAFT|PUBLISHED|ARCHIVED, publishedAt, ogImage }` +
  `PageTranslation { title, body, metaTitle, metaDescription }`.
- **Not SlugRegistry:** that table is **destination-namespaced (every row requires a `destinationSlug`) and
  legal pages are global. Forcing them in means a sentinel value that corrupts the table's meaning.** Instead:
  **`@unique` slug plus a shared `RESERVED_ROOT_SLUGS` constant validated on BOTH Page create and Destination
  create** — which also closes the pre-existing shadowing bug.
- **Known bug the guard closes:** **static route segments silently shadow destination slugs.** A destination
  slugged `terms` or `search` becomes **permanently unreachable**, and **no reserved-word guard exists
  anywhere** today.
- **OPEN DECISION 1 — Routing:** `/{locale}/{slug}` **collides with `/{locale}/{destination}`**. Letting
  admins create pages without shipping code means page resolution **falls through the destination resolver:
  destination → else Page → else 404**. The alternative, **namespacing under `/legal/{slug}`**, is cheaper
  but **changes six live SEO-indexed URLs the legal handover README specifies. Recommendation: fall-through,
  keep the URLs.**
- **OPEN DECISION 2 — Rich text:** **neither repo has any editor, markdown lib, or sanitizer** — long-form is
  a `rows={8}` textarea end to end. **A full working TipTap v3 setup exists at
  `/Users/devripon/devripon/Final & Running Project/wattup-frontend` to port from.** Caveats found on inspection:
  1. Its four `@tiptap/extension-table*` packages are **installed but NEVER wired** — no extension, no toolbar
     button, no CSS. **Since the existing legal copy contains tables (`LegalTableScroller`), table support is
     a build, not a copy. This is the main argument for storing HTML rather than markdown.**
  2. `simple-editor.scss` **styles global `html`/`body`/`:root` and overrides shadcn tokens to hardcoded
     light-mode values — importing it anywhere leaks app-wide and breaks dark mode. Scope those selectors
     first. Biggest porting hazard.**
  3. Its renderer **sanitizes client-side in a `useEffect` (empty first paint, bad for SEO on public legal
     pages)** and **runs `marked` over content that is already HTML**. **Sanitize server-side on the write
     path instead, and drop `marked`.**
  4. **No react-hook-form integration exists**; the `value`/`onChange` signature maps onto
     `field.value`/`field.onChange` but **the `Controller` wrapper must be written**, and **`onChange` wants
     debouncing (it serializes the whole document per keystroke).**
- **Migration:** convert the six authored legal pages to `Page` rows via a **seed script**, **swap the routes
  last**, and **delete the old JSX only after verification.**

#### D.17.8 ⚠️ CONFLICT — the public homepage is REVERTED

- `frontend/app/(frontend)/[locale]/page.tsx` was **restored to its pre-CMS state (`ee2106f^`)**. The public
  homepage renders **bundled dictionary copy and bundled images again**, exactly as before Phase 1. **The
  public site is off-limits until the dashboard and backend work is signed off** (user, 2026-07-20).
- **Everything else stayed:** the backend modules, migrations, dashboard editor, and the frontend data layer
  (`lib/api/public/home-page.ts`, `featured-experiences.ts`, `lib/images/remote-hosts.ts`, the `homepage`
  cache tag). **Those loaders are simply unreferenced for now.**
- **Re-wiring later is a ONE-FILE change**, because the fallback contract was built to allow exactly this:
  `Hero`, `EditorialBanner`, `EditorialCardFan` and `TopExperiences` all take their CMS props as **OPTIONAL
  with bundled fallbacks**. **Nothing was stubbed or commented out.** To restore, **recover the page from
  `ee2106f` — do not rewrite it from memory**:
  `git show ee2106f:'frontend/app/(frontend)/[locale]/page.tsx'`.
- **UI unverified:** every dashboard route 307s to `/portal` without a session, so **the editor needs a human
  pass before it is trusted.**

---

### D.18 Customer accounts and the `/account` area

> Decision record + design + build checklist. **Founder-approved 2026-07-20.** Frontend/dashboard code lives
> in the **SEPARATE dashboard repo** (`tripwheel-x-islandtours-dashboard`).

#### D.18.1 The policy amendment (recorded, not silent)

- The login spec locked **"no passwords / no signup for travelers"** and a **three-doors model** (operators
  `/portal`, staff `/staff`, travelers only on the public site). The founder's 2026-07-20 decision **AMENDS
  this**:
- **Passwordless stays primary.** The public `/bookings` pair login, TYP, cancel page, HMAC traveler session,
  and the confirmation-email CTA to `island.tours/bookings` are **UNCHANGED and remain the no-account path**.
- **Customer accounts are additive.** **Every booking now auto-creates (or links to) a `Role.USER` account**;
  a welcome email offers a set-password link. **Setting a password is optional — nothing about the trip
  requires it.**
- **FOUR doors.** The dashboard app gains **`/account` (customer door)** beside `/portal` and `/staff`.
  **Doors still never share pages or link each other.**
- ⚠️ CONFLICT (the traveler-password contradiction) — the login design spec (v0.1, July 3 2026) states
  **"This is not a classic account login: there are no passwords and no sign-up"** and lists
  **"No 'keep me logged in' on the traveler surface"** under explicit v1 exclusions; the 2026-07-20 amendment
  introduces **traveler passwords (`Role.USER` + set-password email) and a fourth `/account` door**, softening
  both the "no traveler passwords" rule and the three-doors model. **Both are on record; the amendment is the
  later founder decision.**

#### D.18.2 Data model

- **`prisma/customers.prisma` — `customers` table: one row per `(userId, operatorId)`, unique-compound**;
  aggregates `firstBookingAt`, `lastBookingAt`, `bookingsCount`, `totalSpendEur` (Decimal 12,2). Migration
  `20260720002912_customer_accounts`.
- **Aggregates are recompute-on-write** (groupBy over **CONFIRMED+REDEEMED** bookings, then upsert) —
  **idempotent, self-healing**.
- They feed the **FUTURE operator-facing "Customers" page only**; **refunds do not adjust `totalSpendEur`**
  (it is a confirmed-booking EUR value snapshot). **Customer-facing totals always come live from
  `GET /bookings/me/summary`.**

#### D.18.3 Auto-provisioning on booking

- **`CustomerProvisioningService.provisionForBooking(booking)` — fire-and-forget (never throws, never blocks
  a booking/webhook):**
  1. **No contact email → no-op.**
  2. **Email belongs to a non-USER account (operator/staff/admin) → skip entirely** (no link, no email).
     **Linking would inject bookings into their ops dashboard lists**; those bookers keep the publicRef flow.
  3. **No account →** `provisionInvitedAccount(role: USER)` +
     `auth.api.requestPasswordReset({ redirectTo: getAccountUrl() + '/reset' })` → **welcome email (ONLY on
     this create path)**. A `ConflictException` race (settle vs webhook) → **refetch, continue, no second
     welcome**.
  4. **Existing USER with `hasPassword=false` → re-send the set-password link, capped 1 per 24h per email**
     (own `TargetRateLimiter` instance, bucket `customer-welcome`); **`hasPassword=true` → silent**.
  5. **Backfill:** `updateMany` links this booking **AND ALL past bookings with the same `contactEmail`
     (case-insensitive) where `userId IS NULL`**.
  6. **Upsert `customers` rows for each distinct operator + recompute aggregates.**
- **Call sites in `bookings.service.ts` (all `void ...`):** `finalizeConfirmation` (**winner branch — confirm
  endpoint + Stripe webhook paths**), `update()` when contact lands on an already-CONFIRMED booking
  (**OPERATOR_FULL insurance; note OPERATOR_FULL is rejected at reserve in v1**), and `cancel()` (**recomputes
  aggregates when the booking was linked**).
- **Trust model:** **the account is inert until the emailed set-password link proves mailbox ownership — the
  same trust basis as lookup/recover. `emailVerified: true` at creation is safe for the same reason.**

#### D.18.4 Welcome / set-password email

- `src/mail/templates/customer-welcome.template.ts` on the shared `auth-email-shell`: "Your booking created
  an account… set a password"; **explicitly notes confirmation links keep working without one**.
- `MailService.sendCustomerWelcomeEmail(to, inviteUrl, { name? })` — signature matches the operator-invite one.
- **`auth.instance.ts sendResetPassword`:** the server-initiated (invite) branch now **checks the user's role
  FIRST — `USER` → customer welcome**; then the existing staff-row branching (operator vs staff copy)
  unchanged. **Genuine forgot-password requests keep the role-neutral reset template.**
- **`getAccountUrl()` in `invite-provisioning.util.ts` derives `/account` from `PORTAL_URL`** (like
  `getStaffUrl`) — **NO NEW ENV VAR.**
- **The welcome-email cap covers the FIRST send too** (creation seeds the `customer-welcome` 1/24h bucket) —
  server-initiated resets bypass Better Auth's route limiter, so this is the backstop.

#### D.18.5 Self-scoped bookings and payments API

- **`ROLE_PERMISSIONS[USER]` (roles.config.ts + the dashboard `rbac.ts` mirror) adds `VIEW_BOOKINGS` +
  `VIEW_PAYMENTS`.** **Verified blast radius: exactly `GET /bookings`, `GET /bookings/:id`, `GET /payments` —
  all self-scoped:**
  - `BookingsService.list` already scoped non-platform roles via `where.userId = actor.id`; `getById` had the
    owner check.
  - **`PaymentsService.list` gained the USER branch: `where.booking = { userId: actor.id }`** (it previously
    ran operator-resolution for all non-ADMIN).
- **Booking list rows carry ledger-derived `paymentStatus`** (`PAID | PARTIALLY_PAID | UNPAID | REFUNDED`)
  **+ `paidAmount`** (SUCCEEDED non-REFUND minus SUCCEEDED REFUND vs totalRetail) — **for operators too,
  unconditional**. `derivePaymentState`: **zero-value bookings read as PAID, not UNPAID.**
- **`GET /bookings/me/summary`** (**declared ABOVE `:id` — route order matters**):
  `{ bookingsCount, upcomingCount, totalSpend: [{currency, amount}] }`, **live from the payment ledger**.
- **`POST /bookings/:id/cancellation-request`** (session-authed): the shared post-gate core of the traveler
  flow was extracted to **`submitCancellationRequest`** (limiter → status check → stamp → admin email →
  notices); **the public TYP route keeps its HMAC gate verbatim**; **`requestCancellationAsCustomer` 404s
  (never 403s) foreign/unlinked ids.**

#### D.18.6 The `/account` door (dashboard repo)

- **`/account` door:** `app/(login)/account/{layout,page,forgot,reset}` +
  `components/login/account-{login,forgot,reset}.tsx` — **portal-style split-screen with traveler copy**;
  `AuthForm` gained the **`'account'` variant**; **the welcome email's set-password link lands on
  `/account/reset`** (the shared `ResetCard` doubles as invite set-password, **12-char min**).
- **Role-shaped shell:** **`customerNav` (My Bookings / Payments / Profile) is a SEPARATE nav array** chosen
  by `app-sidebar` when `role === 'USER'` — **the permission grant never lights operator nav items**.
  **Root `/` redirects USER → `/bookings`; sign-out sends USER → `/account`.** **Unauthenticated deep links
  still land on `/portal`** (documented; **customer emails always link `/account`**).
- **Customer pages:** `customer-bookings-view.tsx` (stat row from `me/summary` + own-bookings table + details
  sheet), `customer-booking-details.tsx` (trip/payment sections + cancellation request with "nothing is
  cancelled until we process it" copy), `customer-payments-view.tsx` (charges/refunds table),
  `payment-state.tsx` (badge meta). `app/(app)/bookings|payments/page.tsx` **branch on role server-side**.
  The Profile page was already role-aware (change/set password works).
- **`CustomerRouteGuard`** (client leaf in the shell) redirects USER off non-customer routes — **single source
  of truth `['/bookings','/payments','/profile']`**.

#### D.18.7 Customer UI pass (every value added is a field the API already returns — no new endpoints, no estimated numbers)

- **Bookings table:** new **Travelers** column; the payment cell carries the **amount paid** under its badge;
  the total carries the **balance still due to the operator**; **confirmed bookings inside their free window
  show "Free cancellation until <date>"** under the status badge.
- **Payments table:** stat row (**transaction count from the paginated total, net paid from
  `/bookings/me/summary`**) plus **Travel date** and the **provider under the method**. **Page-local sums are
  deliberately NOT used — a figure that reads as a lifetime total must not silently mean "this page".**
- **Details sheet:** ticket lines **grouped by unit price** (age-band names are not on the list payload, so we
  group by what we have), confirmed timestamp, **deposit / paid / balance split**, and **a plain-language note
  per payment model** explaining whether the traveller still owes anything and to whom.
- **Cancellation: four explicit states** (already requested / eligible / window closed / not cancellable),
  **each stating what happens to the money**. **The request is two-step — a mis-click on a table row cannot
  fire it** — and the already-requested state reports **whether the request landed inside the free window and
  what refund follows**.
- New shared helpers in `lib/bookings/format.ts`: `isFreeWindowOpen`, `freeCancellationNote`,
  `partyPriceLines` (beside the existing `refundDue`); `CustomerStatCard` extracted so both views share one
  stat header.

#### D.18.8 Lifecycle gates (booking-lifecycle security, resolved same day, founder-approved)

All three pre-existing `@Public` gaps are now gated (unit-tested; checkout and admin dashboard flows verified
unaffected — the public frontend never called `/confirm` or raw `/cancel`; the Stripe webhook/settle path uses
`confirmFromPayment`, untouched):

1. **`POST /bookings/:id/confirm`** now requires **the amount due at confirmation (deposit, or full total for
   PAID_IN_FULL) to be captured in the payment ledger** — one indexed `payment.aggregate` (SUCCEEDED
   non-REFUND) before the existing atomic transition; **402 otherwise**. **A raw booking id is no longer a
   free-confirmation (or forced-welcome-email) capability.**
2. **`PATCH /bookings/:id`:** contact changes on a **CONFIRMED** booking require an **`X-Traveler-Session`
   owning the booking (401 otherwise)**. **The ON_HOLD checkout contact PATCH is unchanged** (the id is a
   short-lived secret held by the reserving client). **Notes/pickup remain ungated.**
3. **`POST /bookings/:id/cancel`:** **ON_HOLD releases stay open** (checkout-abandon path); anything past
   ON_HOLD requires an **authenticated ops actor** — platform-wide booking role, or the operator owning the
   booking (**foreign ids 404, no existence oracle; `Role.USER` rejected — customers use the
   cancellation-request flow**). The dashboard admin flow still works because AuthGuard attaches the session
   user even on `@Public` routes.
- **All guarded `updateMany`/`$transaction` atomic transitions are unchanged — the gates are pre-checks, each
  a single indexed query.**
- **`cancel()` authorization now runs BEFORE the idempotent `CANCELLED` early-return.** Previously the
  early-return sat above the gate, so **a raw id alone returned the full payload (totals, refund, commission)
  for any already-cancelled booking — an existence oracle plus a data leak.** The checkout-abandon release and
  its idempotent retry stay open via **`utcConfirmedAt === null` ("this was only ever a hold")**.
  **Authorization also outranks the status check, so a 409 can no longer name a stranger's booking status.**
- **Departed trips can no longer be put up for cancellation.** **The verdict is computed SERVER-side and
  shipped on the payload — clients must not re-derive it**, because `tourStartDateTime` is a LOCAL wall clock
  and is meaningless without `tourTimeZone` (which the list payload does not carry).
  - **`cancellationEligibility()` returns `{ canRequest, reason }`** with reason
    `ALREADY_REQUESTED | NOT_CONFIRMED | DEPARTED`; surfaced as **`canRequestCancellation` +
    `cancellationBlockedReason`**, **and enforced by the same predicate inside `submitCancellationRequest`
    (409). One rule, so the UI can never offer something the endpoint refuses.**
  - **`hasDeparted()` edge cases:** start + zone gives an **exact instant**; **a legacy row with no zone falls
    back to the travel DAY and counts as departed only once that day has ended in EVERY timezone (36h)**,
    deliberately lenient rather than refusing a trip that has not happened; **`localDate` is NOT NULL so there
    is always a floor**. **A re-submit on an already-requested booking still works even after departure.**

#### D.18.9 Commission-withheld-from-traveler-payloads rule

- **Commission is withheld from EVERY traveler-facing booking payload.**
- **`stripCommissionForCustomer` nulls `commissionRate`/`commissionAmount` on `GET /bookings` and
  `GET /bookings/:id` for `Role.USER`** — the same withholding rule as the public TYP payload.
- The first review pass covered only the list/detail routes; **`reserve`, `confirm`, `extend`, `update` and
  the public `cancel` still returned `commissionRate`/`commissionAmount` to whoever held the booking id.**
  Fixed with **`mapBookingPublic`** (and **`mapBookingForActor`** for cancel, where an ops actor keeps the
  full payload). **Verified no frontend/dashboard consumer reads commission outside the list/detail views.**
- On the unverified TYP, the **conversion value (EUR commission) is withheld as business-sensitive take-rate**.
- **INVARIANT: commission never rides a traveler-facing payload — only authenticated ops actors see it. New
  booking response paths use `mapBookingPublic`/`mapBookingForActor`, never raw `mapBooking`.**

#### D.18.10 E2E finding — empty customer dashboard (FIXED)

- The first real end-to-end run (book → welcome email → set password → log in) produced **a dashboard with no
  bookings and no payments.** **Root cause was two bugs, not configuration:**
  1. **`reserve()` stamped `booking.userId` with whoever was logged into the browser.** The route is
     `@Public`, **but AuthGuard still attaches a session**, and the controller passed `user?.id` straight
     through. **Testing checkout while signed in as ADMIN made the admin account the booking's "traveller" —
     16 of 18 test bookings for one contact email were owned by `admin@islandtours.com` or a demo operator.**
     **`reserve` now accepts the actor and stamps the owner ONLY for a `Role.USER` session.**
  2. **The backfill only claimed `userId IS NULL` bookings, so those mis-stamped rows were invisible to it.**
     **The customer's identity is the contact email**, so the backfill now **also reclaims bookings owned by a
     non-USER account. Bookings owned by a different CUSTOMER are never stolen.**
- **Payments needed no separate fix:** a payment has **no owner column, it is scoped through `booking.userId`**,
  so re-linking the booking restores the payments view and the spend summary at the same time.
- **Historical rows** carrying an ops `userId` are repaired **either by the next confirmed booking for that
  email (provisioning re-runs the corrected backfill) or by the one-off re-link script, which dry-runs by
  default and writes a JSON backup of prior ownership before applying.**

#### D.18.11 Command-palette gating

- **The palette leaked operator entries to customers.** The sidebar picked the separate `customerNav`, **but
  the command palette still permission-filtered the OPERATOR nav** — and **`Role.USER` holds `VIEW_TRIPS`
  (legacy) plus the self-scoped `VIEW_BOOKINGS`/`VIEW_PAYMENTS`, so Bookings, Cancellations, Payments, Tours
  and Translations all survived the filter.**
- **`navGroupsForRole(nav, role, permissions)` is now the ONE place the role → nav decision lives**; the
  sidebar and the palette both resolve through it, **so they cannot drift again**.
- **Catalogue entity search (tours, destinations) is OFF for customers** — those results link into operator
  screens (`/trips/:id/edit`) they cannot open, **and permission alone does not gate it because USER carries
  `VIEW_TRIPS`. Booking search stays on** (the backend scopes USER to their own rows).
- **`resolvePermissions(role, userPermissions, roleMap)` shared too:** the palette used the **STATIC** role map
  while the sidebar preferred the **backend's effective grants**, so a narrowed STAFF seat saw palette entries
  the sidebar hid. `userPermissions` now threads shell → header → palette.

#### D.18.12 Invariants (do not break) — all 11

1. **Provisioning is fire-and-forget and must NEVER fail or slow a booking, webhook, or cancellation.**
2. **Welcome email fires ONLY on account creation**; unset-password resends are **capped 1/24h per email**;
   **password-holders get nothing.**
3. **Emails belonging to non-USER accounts are never linked or converted.**
4. **The public passwordless flow and `booking-email.context.ts` CTA stay untouched;
   `traveler-session.util.ts` is off-limits.**
5. **`GET /bookings/me/summary` must stay declared above `GET /bookings/:id`.**
6. **Customer-facing money comes from the live ledger, never the `customers` aggregate snapshots.**
7. **Commission never rides a traveler-facing payload** — only authenticated ops actors see it.
8. **In `cancel()`, authorization runs before both the idempotent early-return and the status check.**
9. **`booking.userId` is the CUSTOMER who owns the booking — never "whoever was logged in". Only a `Role.USER`
   session may be stamped as the owner; an ops session browsing checkout must leave it null.**
10. **Role → navigation is decided ONLY by `navGroupsForRole`.**
11. **Cancellation eligibility is computed server-side and shipped as `canRequestCancellation`. Clients render
    it, never re-derive it.**

- **Supporting infrastructure notes:** **one shared `TargetRateLimiter`** via `src/common/rate-limit.module.ts`
  (no duplicate instance/sweep timer); **retention is per-bucket (`maxWindowByBucket`)** because sharing one
  instance made `maxWindowMs` global, holding every short-window bucket's keys 24× longer than useful;
  **`MAX_TRACKED_KEYS` is a real bound with least-recently-touched eviction** (`sweepStale` alone is not one:
  a flood of distinct fresh keys has nothing stale to drop), so a high-cardinality bucket cannot crowd out a
  security-critical one; **`isPlatformWideBookingRole` moved to `common/utils/operator.util.ts`** and is used
  by `PaymentsService.list` too (it previously routed every non-ADMIN through `resolveOperatorId`, so a
  platform STAFF/EDITOR with `VIEW_PAYMENTS` but no operator record got a 400).
- **Tests: 298/298 across bookings/payments/staff/auth/customers, then 1245/1245 backend unit tests green**,
  `tsc` clean, eslint clean on the touched modules. **Manual E2E pending at time of writing.**

---

### D.19 Traveler booking session and security

> The end-to-end model after the **2026-07-19 hardening** (incl. post-review fixes). Master authority:
> master 6.4 (email + reference login), 8.2 (TYP route), B.47 (`public_ref` vs `display_ref` split).

#### D.19.1 The cast

| Piece | What it is | Where it lives |
|---|---|---|
| `public_ref` | **Unguessable UUID in the TYP URL. A permanent VIEWING capability — never an identity** | `bookings.publicRef`, in the URL |
| `display_ref` | `IT-2026-XXXXX`, the customer-facing reference. **Half of the login credential** | `bookings.displayRef`, in emails + on the TYP |
| Session token | `v1.<payload>.<hmac>` — **24h, HMAC-SHA256. TWO SCOPES.** The proof of identity | Issued by the backend, parked in the HttpOnly cookie |
| `it.travelerSession` | First-party **HttpOnly** cookie holding the token. **Browser JS can never read it** | Set by the frontend route handler `POST /api/traveler-session` (**same-origin only**) |
| `it.travelerBooking` | Client-readable cookie with `{email, ref, path}` — **display sugar only** (navbar identity, deep link). **Authorizes nothing** | Set by client JS after a lookup |
| Backend verifier | **The ONLY place tokens are checked:** signature + expiry + "do these claims own THIS booking?" | `backend/src/bookings/traveler-session.util.ts` |

#### D.19.2 The two token scopes (the load-bearing distinction)

- **A token proves only as much as the caller actually demonstrated**, so the payload carries **exactly one**
  of two claims:
- **EMAIL scope `{ e }`** — issued **ONLY by the pair login (`POST /bookings/lookup`)**, where the caller
  proved knowledge of **email + booking reference (both delivered to that inbox)**. **Unlocks every booking
  whose `contactEmail` matches.**
- **BOOKING scope `{ b }`** — issued by **checkout's contact PATCH**. **The email there is caller-supplied and
  unproven**; what the caller DID prove is **possession of the unguessable booking `id` it just created**. So
  this token unlocks **exactly that one booking and nothing else.**
  - **Minting an email-scoped token here was the critical review finding: anyone could reserve a throwaway
    booking, type a victim's email, and get a token valid against the victim's real bookings. Booking-scope
    closes it.**
- **`sessionOwnsBooking(claims, booking)` enforces this:** **booking-scope requires an exact `id` match;
  email-scope requires a `contactEmail` match** (and a booking with no contact email can never be email-owned).
- **Two principles run through everything:**
  1. **Possession of a URL is never identity.** The publicRef link may show a booking exists; **only a session
     that OWNS the booking (by id or by proven email) unlocks identity and actions.**
  2. **One verifier.** **The frontend never validates tokens (it has no secret). It only ferries them.** A
     forged, expired, or wrong-scope token **simply renders the masked page.**
- **Session TTL: 24 hours** (the login-spec session ceiling). **Tokens self-expire; an expired token in the
  cookie is simply ignored by the verifier** — the TYP quietly renders masked with the verify card and the
  traveler re-verifies in one form. **Nothing is stored server-side, so there is nothing to clean.**
- **Secret:** `TRAVELER_SESSION_SECRET`, falling back to `BETTER_AUTH_SECRET`.

#### D.19.3 Scene 1 — booking a tour (the fresh booker)

```
Checkout form (browser)
  1. POST /bookings                      -> reserve, ON_HOLD (no contact yet)
  2. PATCH /bookings/:id { contact }     -> backend writes contact, and because this
                                            patch SET the email, it returns
                                            { ...booking, sessionToken }        (A)
  3. POST /api/traveler-session {token}  -> Next route handler sets the HttpOnly
                                            it.travelerSession cookie (24h)     (B)
  4. POST /payments/.../intent           -> Stripe charge -> /payment/processing
  5. webhook confirms -> redirect to /{dest}/thank-you/{publicRef}
```

- **(A)** lives in `bookings.service.ts update()`: it issues a **BOOKING-scoped** token for `updated.id`
  (**NOT the caller-supplied email**).
- **(B)** lives in `checkout-form.tsx` right after `updateBookingContact`, **awaited BEFORE any navigation, so
  the very first TYP render is already verified**.
- **Result: the booker lands on a fully unmasked Thank You page without ever "logging in".**

#### D.19.4 Scene 2 — masked vs verified TYP (server-side decision)

- In `thank-you/[publicRef]/page.tsx`, **inside the Suspense body after `connection()`**:
  `cookie = await getTravelerSessionToken()` then
  `booking = await getThankYouBooking(ref, locale, cookie)` →
  `GET /bookings/typ/:publicRef` with `X-Traveler-Session: <token>`.
- The backend (`getThankYou`) verifies the token and runs `sessionOwnsBooking` (**booking-id match for a
  checkout token, case-insensitive `contactEmail` match for a pair-login token**).
- **Unverified, every identifying field is WITHHELD (null), not masked** — the bare link proves a booking
  exists, nothing about who it belongs to (**founder decision 2026-07-19, tightened from the earlier
  mask-to-initials approach**):

| Field | verified: true | verified: false (bare link) |
|---|---|---|
| Guest name | Ripon Mia | **withheld (row hidden)** |
| Guest email / phone | shown | **withheld** |
| Operator email / phone (support line) | shown | **withheld (row hidden)** |
| Pickup address | full address | **withheld** |
| Card brand / last4 | visa ••••4242 | **withheld** |
| Conversion (EUR commission) | present | **withheld (business-sensitive take-rate)** |
| Tour name, date, duration, free-cancel, party count, operator NAME | shown | **shown (non-identifying)** |
| Page extra | management actions / celebratory hero | `ThankYouVerifyNotice` card → "Verify it's you" → `/bookings` |

- ⚠️ CONFLICT — the reconciliation doc's earlier note describes the unverified payload as **MASKED**
  (`d•••@g•••.com`, last-name initial, phone last-2); the 2026-07-19 founder decision **tightened this to
  fully WITHHELD (rows hidden)**. The withheld model is the later state.
- **Three presentations of the same booking**, chosen server-side:
  - **celebratory** — the **ONE-TIME** "You're booked, {name}! 🌴" moment right after checkout. The
    `/payment/processing` page **drops a short-lived `it.justBooked` cookie (publicRef, ~15 min)** before
    redirecting; the TYP shows the **green-check hero + add-to-calendar + resend**, plus the cross-sell and
    apartment upsell.
  - **management** — **any later verified visit** (via the `/bookings` login, or after the justBooked cookie
    expires). Calmer `BookingManageHeader`: a "Confirmed" status chip, "Your booking", the ref, and management
    actions **including Cancel booking**. **No celebratory hero, no upsell.**
  - **masked** — unverified shared link: the `ThankYouVerifyNotice` card + the non-identifying summary only.
    **No hero, no upsell.**
- **Masked, never omitted:** the unverified page **keeps its exact shape**, so the design is identical and
  **the real traveler immediately sees there IS more behind verification**.
- **The TYP fetch is UNCACHED by design** (per-traveler data streams after `connection()`), **so a verified
  payload can never be cached and served to someone else.**
- Per-user headers must **NEVER enter a `'use cache'` scope** — `extraHeaders` exists on the uncached fetch only.

#### D.19.5 Scene 3 — the `/bookings` pair login (booking lookup)

```
/bookings (traveler-login.tsx)
  POST /bookings/lookup { email, reference }
    - LookupRateLimiter.assertAllowed()   5 fails/email + 10 fails/reference per 15min
    - match?  no  -> recordFailure + uniform 404 (enumeration-proof)
              yes -> recordSuccess + { publicRef, displayRef, destinationSlug, sessionToken }
  saveTravelerBooking(...)                display cookie (navbar identity)
  await storeTravelerSession(token)       HttpOnly cookie via the route handler
  router.push(returnTo ?? TYP path)
```

- **Per-credential lookup caps: 5 failed pair attempts per email per 15 minutes AND 10 failed attempts per
  reference per 15 minutes**, on top of the per-IP throttle. **Silent until lockout**; **audit log lines +
  lockout warn**. **In-memory (single-process deploy) — move to Redis if the API scales out.**
- **Enumeration-proof:** **uniform 404 body on mismatch; uniform 429 on lockout**; identical 404 body for
  wrong email vs wrong reference.
- **`returnTo`** exists so a guarded surface can bounce through the login and come straight back. **It is
  validated against `/^\/(?:[a-z0-9-]+\/thank-you|cancel)\/[A-Za-z0-9-]+$/` — same-app paths only, an open
  redirect is impossible.** It is read from `window.location.search` at submit time (not `useSearchParams`)
  so the login page stays prerenderable.
- **"Lost your reference?" recovery:** `POST /bookings/lookup/recover-reference` (`@Public`, human-pace per-IP
  throttle **1/10s, 3/min, 10/hr**). **Always acks `{ sent: true }`**; when the email has bookings it sends
  **ONE branded notice** (the shared `booking-notice` shell) to the **STORED contact address**, listing **up
  to the 5 most recent references + a TYP CTA**, **fire-and-forget so response timing doesn't leak whether
  mail went out**.
  - Spec target limits: **1 send per email per minute, 5 per day, per-IP caps, CAPTCHA behind the abuse
    threshold**. **Per-email caps still pending Redis** as built.
- Traveler lookup throttle as built: per-IP `@Throttle` tiers **2/10s, 6/min, 30/hr** (browser-only — the SSR
  internal-key bypass would skip limits).

#### D.19.6 Scene 4 — 401-gated cancellation (the guarded mutation)

- The email's "Cancel booking" button opens **`/cancel/{publicRef}` (locale-less, proxy rewrite)**.

```
cancel page (server)
  token   = await getTravelerSessionToken()
  booking = getThankYouBooking(ref, locale, token)

  booking.verified == false  ->  "Verify it's you first" card
                                 -> /bookings?returnTo=/cancel/{publicRef}
  booking not CONFIRMED      ->  "nothing to cancel" card
  past the free window       ->  locked no-refund copy
  else                       ->  CancelRequestCard (gets sessionToken as a prop)
                                   POST /bookings/typ/:ref/cancellation-request
                                   with X-Traveler-Session
```

- **Backend ordering in `requestCancellation`:** load booking → **401 unless the session owns the contact
  email** → **409 unless CONFIRMED** → **stamp `utcCancellationRequestedAt` (first request only — the refund
  deadline is judged on THIS instant)** → **email admin (throws if that fails)**, then **best-effort traveler
  ack + operator notice**.
- **Viewing rides the link; MUTATING requires the session. A leaked TYP URL can no longer get someone's trip
  cancelled.**
- **Resend and calendar.ics stay link-keyed on purpose** (they open from mail clients with no session):
  **resend only emails the STORED address**, and **the ICS carries only tour facts — the pickup street address
  was stripped** (it is exactly the field the TYP masks, so a shared calendar entry must not hand it back).
- **All three mail-sending actions (resend / recover-reference / cancellation-request) carry a per-target cap
  (`TargetRateLimiter`) on top of the per-IP throttle, so a multi-IP caller can't mail-bomb one inbox.**
- **Cancellation entry point (C1, v1):** the "Cancel booking" button in the confirmation email leads to a
  **TOKENIZED confirmation page** on island.tours (e.g. "Cancel Sunset Reef Snorkel, Tue 28 May? Refund $48")
  — **NOT a cancel-on-raw-click**. This prevents accidental and wrong-party cancellations. A **lightweight
  booking-lookup fallback (booking reference + email)** exists for lost or spam-filtered emails — **not a full
  account area**. Precedent: Viator manages cancellation via booking number + email.
  - ⚠️ CONFLICT — the C1 note says "No account area in v1"; the 2026-07-20 amendment adds the `/account` door.
  - ⚠️ CONFLICT — the email wireframe's cancel flow is "request → admin email → admin processes refund and
    confirms" (**request-based**); the as-built endpoint is **session-gated (401 without an owning traveler
    session)** — consistent, but it adds an authentication gate the wireframe does not mention.

#### D.19.7 Scene 5 — sign-out and expiry

- **Navbar sign-out** → `clearTravelerBooking()` clears the display cookie **AND** fires
  **`DELETE /api/traveler-session`** to drop the HttpOnly cookie.
- Tokens self-expire after 24h; an expired token renders masked with the verify card.

#### D.19.8 Scene 6 — the attacker's day (why each attack dies)

| Attack | What happens |
|---|---|
| Guess TYP URLs | **publicRef is a UUID — not enumerable** |
| Got a leaked TYP link | Sees the **masked view**: tour facts, no identity, no pickup address, no card, **and every mutation 401s** |
| Brute-force the pair login | **Per-IP throttle + 5 fails/email + 10 fails/reference per 15min**, **uniform errors, silent until a uniform 429**; **lockout writes an ops warning** |
| Probe which emails have bookings | **Identical 404 body for wrong email vs wrong reference** |
| Forge/tamper a token | **HMAC-SHA256 over the payload, constant-time compare**; any bit flip = null = masked |
| Replay a stolen token | **Bounded to 24h**; email-scope only unlocks bookings whose contactEmail matches, **booking-scope only its one id** |
| Mint a token for a victim's email via the checkout PATCH | **Closed:** that endpoint issues a **BOOKING-scoped** token (its own id only) |
| Plant their own valid token in a victim's cookie (**fixation**) | **Yields nothing:** the token only unlocks the ATTACKER's own booking(s) |
| CSRF the session route to plant/clear a cookie | **`POST`/`DELETE /api/traveler-session` reject cross-site requests (`Sec-Fetch-Site` / Origin check)** |
| Read the pickup address from the public calendar.ics | **Closed: the ICS `LOCATION` no longer contains the street address** |
| `Origin: null` credentialed CORS from a sandboxed iframe | **Closed: `origin === 'null'` removed from the allow-list** |
| Operator insider (legitimately sees email + reference) | **The pair unlocks single-booking manage only**; invoices/cross-booking history will require the **email-code step-up** (deferred with those features) |

#### D.19.9 Design decisions on record (founder, 2026-07-19)

1. **Bare TYP link = permanently valid, masked.** (Not full-forever, not hard expiry.)
2. **Cancellation requires the verified session.**
3. **Email-code step-up deferred** until invoices / cross-booking history exist — **the session already covers
   everything v1 ships.**
- **Deliberately NOT done:** no Better Auth involvement for travelers (spec: thin endpoint over bookings);
  **no server-side session store** (stateless HMAC + per-use ownership check + 24h expiry); **the traveler
  surface stays on the public frontend — never the ops dashboard** (three-doors isolation).
- ⚠️ CONFLICT (traveler step-up, three-way) — rationale **D5** defers the traveler step-up email code to
  **v1.1**; **D16** and spec **2.4.5** put invoice/cross-booking step-up **in v1**; the reconciliation records
  a **founder decision (2026-07-19) deferring it entirely** because v1 has no invoice download or
  cross-booking surface.
- ⚠️ CONFLICT (traveler session) — the spec says the traveler surface issues a **24-hour session cookie**; the
  plan's initial EXECUTED note (2026-07-18) says **no token was minted** and success was a client-side 90-day
  `it.travelerBooking` cookie; the reconciliation's later EXECUTED note (2026-07-19) replaces that with a
  **24h HMAC HttpOnly server session**, matching the spec.

---

### D.20 Login / auth across all surfaces

> **Status of the source spec:** `island-tours-login-design-spec.md` is **proposal v0.1, July 3, 2026. NOT
> folded into the master. Where this doc and the master disagree, the master wins.**
> Master **6.4 locks the traveler login model** (email plus booking reference at `island.tours/bookings`,
> rate-limited, accounts auto-created at booking), so Section 2 *implements a locked decision*.
> Master **0.3 explicitly places operator and admin tooling out of scope** — Sections 3 and 4 fill a gap the
> master deliberately leaves open.

#### D.20.1 Architecture — three doors, one design language

- **Three audiences, three jobs, three threat models. They never share a login page.**

| Surface | URL | Who | Auth model |
|---|---|---|---|
| Your bookings | `island.tours/bookings` | Travelers | Email + booking reference (master 6.4, locked) |
| Operator portal | `operators.island.tours` | Tour operators and their staff | Email + password, mandatory 2FA |
| Staff | `admin.island.tours` | Island Tours team | Google Workspace SSO only |

- Rationale for separate subdomains: OTA/SaaS convention (`admin.booking.com`, `supplier.viator.com`,
  `supplier.getyourguide.com`, `expediapartnercentral.com`), **cookie isolation via `__Host-` scoped
  cookies**, and **stricter CSP per surface**.
- **A hidden URL is never treated as a security control; authorization is always server-side.**
- ⚠️ CONFLICT — the 2026-07-20 amendment adds a **FOURTH door, `/account`** (customer), softening the
  three-doors model (see D.18.1).
- **Why three doors (rationale):** travelers, operators and staff differ on **every axis that matters to
  authentication**: (a) **what they protect** — one booking vs payout rails + traveler PII vs the whole
  platform; (b) **how often they log in** — once per trip vs daily vs all day; (c) **who attacks them** —
  opportunists vs industrial credential harvesters vs targeted attackers. **Airbnb's shared guest/host account
  with a mode switch is the documented outlier**, and it comes with host-security machinery Island Tours has
  no reason to rebuild.

#### D.20.2 Shared principles (all surfaces)

- **1.1 No account enumeration, anywhere.** Identical **generic error message, identical HTTP status,
  consistent response timing** whether an account exists or not (OWASP). Recovery flows use "if that email
  exists, it's on its way" phrasing.
- **1.2 No SMS, anywhere.** Reasons: **NIST SP 800-63B-4 (final, July 2025) classes PSTN/SMS as a restricted
  authenticator**; SMS pumping fraud is a documented cost sink; Caribbean SMS deliverability is variable.
  Permitted channels instead: **authenticator app (TOTP), WhatsApp codes, email.**
- **1.3 Form mechanics bundle (EVERY form):** labels **above** fields, **never placeholder-as-label**; correct
  `autocomplete` attributes (`email`, `current-password`, `new-password`, `one-time-code`);
  `inputmode="numeric"` on code fields; **paste always allowed**; **show-password toggle that reverts to
  hidden on submit**; **no confirm-password field**; submit inside a **real `<form>`** so password managers
  and autofill work.
- **1.4 Rate limiting and throttling per NIST:** escalating delays on failures, **hard per-account AND per-IP
  caps**, **silent to the user until the lockout state**, then a **warm lockout message with the WhatsApp
  path**. **CAPTCHA (hCaptcha) only behind an abuse threshold, never by default.**
- **1.5 Password rules (operator only):** **minimum 12 characters**, **no composition rules**, **no periodic
  rotation**, **compromised-credential screening at set AND at login**, password managers and paste explicitly
  supported (NIST SHALL requirements).
- **1.6 Auditability:** every **login, failed attempt, 2FA event, recovery, and role change** writes an audit
  line with **actor, surface, event, ip, device, timestamp**.
- **1.7 Design/brand:** design tokens per master section 3; **WCAG AA**; **`prefers-reduced-motion`
  respected**; brand voice per master section 4 — the words **"Submit" and "Customer support" NEVER appear**;
  **WhatsApp is the human fallback everywhere**.
- **1.8 Locales:** the traveler surface ships in **all seven locales** through next-intl. The operator portal
  ships **EN**, with **NL and ES on the roadmap (O3)**. **Admin is EN only.**

#### D.20.3 Traveler surface — `island.tours/bookings`

**Job, model, entry points**

- Job: get a traveler from a confirmation email or the footer to their booking with **near-zero friction**.
- **This is not a classic account login: there are no passwords and no sign-up** (per the v0.1 spec; see the
  D.18.1 amendment conflict).
- The email+reference pair is the **industry-standard no-account pattern** (airlines: PNR + last name;
  Expedia: itinerary number + email; Booking.com: confirmation number + PIN), with one structural advantage:
  **both halves of the pair arrive in the same confirmation email, so possession of the email inbox is the
  real credential.**
- **Entry points:** confirmation and reminder emails ("Manage your booking"), the **global footer link**, the
  **TYP account pointer**, **WhatsApp support sending the link**. **Direct navigation is secondary.**
- **Page properties:** URL `island.tours/bookings` — **no locale prefix** (matching the TYP posture), locale
  via **Accept-Language**, **switchable on page**; **`noindex, follow`**, **excluded from sitemaps**;
  **SSR, never cached**; **24-hour cookie** after successful login; **logout link in the account area**.

**Layout**

- **Minimal takeover chrome** (checkout family, not the browse family).
- Logo top-left linking home; **"WhatsApp us" top-right**; **centered card, max 440px**, on the off-white
  background; **micro footer** with legal links and the **"Built by Islanders." sign-off small**.
- **No nav, no search, no distractions.**
- Card order top to bottom: **H1 → one-line sub → email field → reference field with helper → primary button
  → "Lost your reference?" link → quiet operator cross-link at the bottom of the page.**

**Copy (locked set, EN source)**

- H1: `Your bookings`
- Sub: `Log in with the email you booked with and your booking reference.`
- Email label: `Email` · Reference label: `Booking reference`
- Reference placeholder: `IT-2026-K3M9P` · Reference helper: `Top of your confirmation email.`
- Primary button: `Show my bookings`
- Lost link: `Lost your reference?`
- Lost panel header: `We'll email it to you` · Lost panel sub: `Enter the email you booked with.`
- Lost panel button: `Email me my reference`
- Lost panel result (**ALWAYS**, no enumeration): `If that email has bookings with us, the reference is on its way.`
- Error (pair mismatch, generic): `That email and reference don't match. Check your confirmation email, or WhatsApp us and we'll fix it.`
- Lockout: `Too many tries. Wait 15 minutes, or WhatsApp us and we'll help you in.`
- Operator cross-link: `Tour operator? Log in to the operator portal →`

**Fields and attributes (as built in the mockup)**

- Top bar: logo left (`aria-label="Island Tours home"`); at right two pill controls — a **language switcher**
  pill showing `EN` with a globe icon (`aria-label="Change language"`) and a **"WhatsApp us"** pill.
- Card: `max-width:440px`, white, border, radius 16, shadow, padding `32px 30px 28px`; wrapper
  `padding:5vh 20px 40px`, centered. H1 at **26px weight 650, `letter-spacing:-.01em`**; sub at 14.5px muted.
- Error block `#tError` with **`role="alert"`**, containing the generic mismatch copy with **"WhatsApp us" as
  an inline underlined link**.
- **Email input:** `type="email"`, `name="email"`, **`autocomplete="email"`**, **`inputmode="email"`**,
  `placeholder="you@example.com"`, **`aria-describedby="tError"`**.
- **Reference input:** `type="text"`, `name="reference"`, **`autocomplete="off"`**,
  **`autocapitalize="characters"`**, **`spellcheck="false"`**, `placeholder="IT-2026-K3M9P"`,
  `aria-describedby="tError"`, plus the helper.
- Primary submit inside a real `<form>`.
- **Success state:** green check well, `Logged in.`, then *"The bookings list opens here: bookings, invoices,
  and your saved tours."* — **confirms the account area contains bookings, invoices, and saved tours
  (wishlist)**.
- **Lost-reference panel replaces the login panel in-place** (panel swap, not a new page), with a "Back" link
  at top and an `.info-note` envelope result shown **always** on submit.
- Micro footer: `Built by Islanders.` (weight 800, 15px, ink) plus a legal row of **Terms · Privacy Policy ·
  Help** links, 12.5px muted.
- **Demo behavior (documents intended states):** first submit shows the **generic error**; second submit
  succeeds and hides the sub, the form, and all quiet links, revealing the success panel.

**Security posture**

- **Rate limits:** **5 failed pair attempts per email per 15 minutes** with **escalating delays**, a **per-IP
  daily cap**, and a **per-reference cap**; **all silent until lockout**. Limits live in a **central store,
  never in serverless memory**.
- **`display_ref` generation:** **random within the `IT-2026-XXXXX` format, never sequential, ambiguous
  characters excluded**, mirroring the `public_ref` non-enumerable posture. **References are treated as
  identifiers, not secrets** (airline PNR research shows why) — which is exactly why the pair, the rate
  limits, and the enumeration rules do the protecting **together**.
- The lookup **never returns partial matches** and **never confirms that an email exists**.
- **Reference-recovery endpoint has its own limits:** **one send per email per minute, 5 per day, per-IP
  caps, CAPTCHA behind the abuse threshold**. Protects both travelers and the **transactional domain's
  sending reputation**.
- **The insider path is closed in v1:** operators legitimately see traveler emails and full references (LD4
  makes the reference the check-in credential), so the pair alone must not open everything. **Viewing or
  managing the single booking works with the pair; invoices and cross-booking history require a 6-digit email
  code step-up from v1.**
- **Support never grants access on chat alone.** Lockout script: **support verifies booking facts, then
  triggers a code or link to the booking email; identity is proven by inbox possession, not by conversation.**
- **Booking-email correction** (typo at checkout) is **support-mediated**: verify against **booking facts plus
  payment context**, **rebind**, **write an audit line**, **send confirmation to the new address**. Without
  this, one typo means **permanent lockout**.
- **Session:** **fresh session ID issued on every successful login** (session-fixation defense), **24-hour
  ceiling**, **logout always visible**.

**Tracking**

- GA4 **`login`** event with **`method: booking_ref`** on success.
- **Silent failure counter** — **no PII**, and **never the reference itself in the dataLayer**.
- **Lockout fires an ops alert, not an analytics event.**

#### D.20.4 Operator portal — `operators.island.tours`

**Job and threat model**

- Job: **daily availability management** (non-API operators are expected in the portal **ideally daily**,
  closing dates that fill up), **bookings**, **tier selection**, **payouts**.
- Threat model is **documented, not hypothetical**: **Booking.com partner credentials industrially harvested
  from March 2023 onward** (SecureWorks/Vidar per Krebs); **buy offers up to $5,000 per hotel account** on
  crime forums; **stolen extranet access used to scam guests through trusted in-platform messages**;
  **Booking.com blocked 85 million fraudulent reservations across more than 1.5 million phishing attempts in
  2023**; **phishing targeting travelers rose 900%**; **attacks continued into 2025 via malware on partner
  devices even after 2FA enforcement** (Microsoft Storm-1865).
- Conclusion: **2FA is not the finish line** — pair it with **trusted-device management and
  sign-out-everywhere**. "Retrofitting security after an incident is the documented failure path."
- "An operator account here exposes **traveler PII and payout rails**; it gets **bank-grade treatment with
  island-grade warmth**."

**Auth model**

- **Per-person seats, never shared logins.** `operator_users` with roles **owner, manager, staff**. **Payout
  and bank changes are owner-only, always step-up re-authenticated, and email-notified.**
- **Email plus password**, then **mandatory 2FA on every login on untrusted devices**. Precedent:
  GetYourGuide (every login, authenticator or SMS, **explicitly no email codes**); FareHarbor (mandatory
  rollout, SMS primary); Booking.com (2FA enforced at partner registration). **Two deliberate deviations owned
  as ours:** (a) **trusted devices skip the every-login prompt** (daily-use reality); (b) **SMS is replaced
  entirely**.
- **2FA channels, phased:**
  - **v1:** **authenticator app (TOTP) plus backup codes, with white-glove enrollment during operator
    onboarding** (at launch scale every operator gets a guided setup anyway).
  - **v1.1:** **WhatsApp code as the fallback channel** via **Meta authentication templates (one-tap or
    copy-code)**; requires **template approval and business verification**, so it is **scheduled work, not a
    launch dependency**. **WhatsApp capability of the target number is validated at enrollment.**
  - **Never SMS, never email codes.**
  - **Codes delivered over WhatsApp are valid 10 minutes; any code is invalidated after 5 failed attempts.**
- **Backup codes:** **10, single-use, shown once at enrollment, regenerate under owner re-auth.**
- **Device trust:** **"Remember this device for 30 days"** (opt-in checkbox **at the 2FA step**), **rolling
  14-day session**, biometric-gated persistence reserved for a future mobile app. **Daily-use friction is
  solved with device trust, never with fewer factors.** Because the documented post-2FA attack path is
  **session and trust-cookie theft via malware**, device trust comes with management: **portal settings list
  trusted devices and active sessions**, offer **"Sign out everywhere"**, and **every password or 2FA change
  invalidates all sessions and trusted devices**.
- **Step-up re-auth (fresh 2FA) required for: payout details, bank changes, user management, tier changes.**
  Mirrors Viator's finance-tab step-up and Peek's admin-gated payout edits.
- **Recovery:** **backup codes first**; then a **support reset executed by an admin with an audit line**, with
  **owner approval required for non-owner resets**. **Channel separation rule: the recovery channel must
  differ from the seat's 2FA channel.** A seat using WhatsApp codes (v1.1) **never** gets a WhatsApp-based
  reset; support verifies through the registered **`contact_email` plus a callback to `contact_phone`**; one
  compromised WhatsApp account must never defeat both the factor and the reset path. **No security questions,
  ever.**
- **Anti-phishing line on the login page AND in the portal footer:** `We'll never ask for your password or codes by email, text, or phone.`

**Layout**

- **Split screen.** **Left panel (desktop only):** brand image or gradient, the wordmark, **one line of
  purpose copy**, the **anti-phishing line pinned at the bottom**. **Right panel:** the form card, **max
  400px**. **Mobile: form only**, anti-phishing line **under the card**.
- "The portal is a **workplace**: calm, fast, **zero marketing**."
- As-built specifics: grid `1fr 1fr`, `min-height:100vh`; left gradient
  `linear-gradient(155deg,#2E86AB 0%,#1B5E7E 55%,#123F55 100%)` with a radial white highlight; portal tag
  `OPERATOR PORTAL` (11px, weight 700, `letter-spacing:.12em`, uppercase, opacity .75); anti-phishing card
  with translucent white fill and shield icon; right side `--bg-soft` background, card `max-width:400px`.
  **Responsive breakpoint 860px:** the grid collapses to one column, **the brand panel is hidden**, and the
  **mobile anti-phishing note appears** (`#EFF6FF` fill, `#BFDBFE` border, `#1E3A5F` text).

**Copy (locked set, EN source)**

- H1: `Operator portal` · Sub: `Manage your tours, availability, and bookings.`
- Brand panel H2: `Your tours, availability, and bookings. One place, every day.`
- Brand panel sub: `Close a date in one tap, keep your content current, and see every booking the moment it lands.`
  (the one-tap close is the specced availability action; "content" is the founder-chosen container for photos,
  prices, and copy, July 3 2026).
- Email / Password labels: `Email` / `Password` · Show-password toggle: `Show` / `Hide`
- Forgot link: `Forgot your password?` · Primary button: `Log in`
- Reset result (**ALWAYS**, enumeration-proof): `If that email has an operator account, a reset link is on its way.`
- 2FA header: `Enter your code` · 2FA sub (TOTP): `The 6-digit code from your authenticator app.`
- 2FA code field label: `6-digit code`
- 2FA WhatsApp link (v1.1): `Send the code to WhatsApp instead`
- 2FA WhatsApp sub (v1.1): `Code sent to the WhatsApp number ending in {last2}.`
- Backup link: `Use a backup code` · Backup sub: `Enter one of your backup codes.`
- Remember checkbox: `Remember this device for 30 days` · 2FA button: `Verify`
- Resend (v1.1, **WhatsApp state only, after a 30s timer**): `Send a new code`
- Error (credentials, generic): `That email and password don't match.`
- Error (TOTP code): `That code didn't work. Your app makes a new one every 30 seconds, try the newest.`
- Error (WhatsApp code, v1.1): `That code didn't work. WhatsApp codes are valid for 10 minutes.`
- Error (backup code): `That backup code didn't work. Each one works once.`
- Lockout: `Too many tries. Wait 15 minutes, or WhatsApp us from your registered number.`
- Anti-phishing line: `We'll never ask for your password or codes by email, text, or phone.`
- Traveler cross-link: `Looking for your booking? Go to island.tours/bookings →`
- Apply link: `New here? Apply to list your tours →`

**Fields, states and channel modes (as built)**

- **Email input:** `type="email"`, `name="email"`, **`autocomplete="username"`**, `inputmode="email"`,
  `placeholder="you@yourcompany.com"`.
- **Password input:** `type="password"`, `name="password"`, **`autocomplete="current-password"`**, no
  placeholder, with the **Show/Hide toggle** (`aria-live="polite"`; toggles input `type` and its own label).
- **Code input:** `type="text"`, `name="code"`, **`inputmode="numeric"`**, **`autocomplete="one-time-code"`**,
  **`pattern="\d{6}"`**, **`maxlength="6"`**, `placeholder="000000"`, `aria-describedby="oError2"`. Styling:
  **200px wide, centered, 24px, `letter-spacing:.35em`, weight 650, `font-variant-numeric:tabular-nums`**,
  orange focus ring. The form is `novalidate` (custom validation).
- **Remember checkbox:** `accent-color` orange, 16×16.
- **Resend row:** hidden by default; `aria-live="polite"`; the button starts **disabled** reading
  `Send a new code in 30s` counting down; at 0 it becomes enabled and orange with text `Send a new code`.
  **Shown only in WhatsApp mode.** The "Back" link returns to step 1 **and stops the resend timer**.
- **Three channel modes: `totp` | `wa` | `backup`.**
  - **WhatsApp mode:** sub becomes the "ending in {last2}" line; label stays "6-digit code"; placeholder
    `000000`; maxlength 6; field cleared; error cleared; **resend row shown and timer started**.
  - **Backup mode:** sub becomes "Enter one of your backup codes."; **label becomes `Backup code`**;
    placeholder **`XXXX-XXXX`**; **maxlength 9**; field cleared; error cleared; **resend row hidden and timer
    stopped**. Validation accepts **≥8 alphanumeric characters** (backup codes are ~8 chars, displayed
    hyphenated).
  - **TOTP mode:** validation requires **≥6 digits**.
- **Enumerated states:** happy path (Credentials → 2FA on untrusted device → portal), WhatsApp code sent
  (v1.1), backup code entry, **locked**, password reset requested, reset form, **expired reset link**, and
  **seat invited** (first login **sets password plus enrolls 2FA in one flow**; enrollment shows **QR plus
  manual key plus backup codes**).
- **Success state:** green check, `Logged in.`, then *"The portal opens on the availability screen with
  one-tap Close today."* — **confirms the post-login landing screen is availability, with a one-tap "Close
  today" action.**

**Seat lifecycle**

- **Invites:** **single-use token, 7-day validity**; **expired invites offer a re-send by the inviter**;
  **inviting an email that already holds a seat surfaces the existing seat instead of creating a duplicate.**
- **Reset links:** **single-use, 60-minute validity**; **completing a reset does not bypass 2FA**; a password
  change **invalidates every other session and trusted device** and **sends a notification email to the seat**.
- **Revocation:** removing a seat **kills its active sessions and trusted devices immediately (not at next
  request)** and **writes an audit line**. **Owner seats can only be removed by another owner.**
- **Seat email change:** **owner-approved**, **re-verifies the new address before it becomes the login
  identifier**, **audit-logged**.

**Data model (proposed E.11, auth)**

- `operator_users`: `id`, `operator_id` FK, `email` unique, `role` enum **owner/manager/staff**,
  `password_hash`, `totp_secret` nullable, `totp_enrolled_at`, `whatsapp_e164` nullable (**2FA fallback
  channel, defaults from `contact_phone` for the owner seat**), `backup_codes_hash[]`, `status`
  **invited/active/suspended**, `last_login_at`.
- `trusted_devices`: `id`, `operator_user_id` FK, `device_hash`, `trusted_until`, `created_ip`.
- `auth_audit`: `id`, `surface` enum **traveler/operator/admin**, `actor` (**user id or email hash**), `event`
  enum, `ip`, `user_agent`, `created_at`. **Retention 12 months.**

**Tracking**

- **No marketing analytics on the portal (no GA4, no pixels).**
- **Product telemetry only:** login success/failure counters, 2FA method mix, recovery volume — **all
  server-side and PII-free**. These feed **the security review, not campaigns**.

#### D.20.5 Staff surface — `admin.island.tours`

- **Google Workspace SSO only. No passwords exist at the application level.** One button:
  **`Continue with Google`**.
- **MFA, passkeys, and session policy are enforced once, at the IdP** (Google 2SV with **security keys or
  passkeys**), which satisfies NIST's phishing-resistance preference **without app-level buildout**.
  Supabase-native passkeys stay off the table while the API is experimental.
- **Server-side authorization, TWICE:** (1) the Google **`hd` claim is verified server-side** against the
  Workspace domain (**the parameter alone is client-modifiable, per Google's own docs**); (2) the email
  **must exist in `admin_allowlist` with a role**. **UI checks count for nothing.**
- **Sessions: 12-hour maximum**; **fresh SSO for destructive or money-adjacent actions** — explicitly:
  **forfeit confirmation, refunds, capacity below `booked_count`, allowlist changes**.
- **Every action is audit-logged.**
- **noindex plus no public links**; the subdomain isolates cookies and CSP. **Obscurity is a courtesy, not a
  control.**
- **Layout and copy:** **minimal, quiet, near-monochrome within the token set** — "the one surface with no
  marketing job"; **small wordmark, centered card**.
  - Header: `Staff access` · Button: `Continue with Google`
  - Fine print: `Island Tours staff only. Every login and action is logged.`
  - Denied (post-auth; **specific is safe here** because identity is already verified by Google, so **no
    enumeration risk**): `This Google account doesn't have staff access. Ask an admin to add you.`
  - Success state: green check, `Logged in.`, then `Role and domain checked server-side, session 12 hours.`
  - Footnote below the card: `admin.island.tours · linked from nowhere, noindex, authorization always server-side`
  - As built: full-viewport **dark ink background**, white wordmark at 85% opacity, card `max-width:380px`
    with **heavy shadow `0 20px 60px rgba(0,0,0,.4)`**, H1 19px weight 650, the 4-color Google `g-mark` SVG
    (18px, `#EA4335`/`#4285F4`/`#FBBC05`/`#34A853`), denied state `role="alert"` with left-aligned text inside
    the centered card. **Demo behavior: first click shows the denied state, second click succeeds — both
    states are first-class screens.**
- **Data model:** `admin_allowlist`: `email`, `role` enum **admin/support/content**, `added_by`, `added_at`.
  Plus the shared `auth_audit`.
- **How the super admin logs in:** **super admin = the `ADMIN` role. There is no tier above it** and **no
  admin password anywhere**. Flow: open `admin.island.tours` (today `/staff`) → Continue with Google →
  **server-side `hd` claim check + `admin_allowlist` membership with a role** → **12h session, every login and
  action writes an `auth_audit` line**.
  - **Bootstrapping the first super admin:** you cannot add yourself to `admin_allowlist` through the UI
    before you are an admin, so **the first super admin is created by database seed only** — seed the
    first super-admin email into `admin_allowlist` (+ the `User` row with `role = ADMIN`); that person logs in
    via Google SSO, then **adds the rest of the staff from the admin UI**.
  - **Hard constraint (O5):** Google SSO only succeeds if the super admin's email is a **Google Workspace
    account in the org domain**. **A super admin whose email is not on the Workspace cannot use `/staff` at all.**
  - **Transition safety:** until `/staff` + Google SSO + the allowlist are built and cut over, **admins keep
    logging in through the existing `/login` (email+password → `/dashboard`). Do not remove that path first,
    or super admins lock themselves out.**

#### D.20.6 Wrong-door routing

- Separate URLs with **one quiet cross-link each way** (the OTA convention).
- The traveler page links to the operator portal **at the bottom**; the operator portal links to
  `island.tours/bookings`.
- **The global footer carries "For operators" next to "Manage your booking".**
- **The admin surface is linked from nowhere.**

#### D.20.7 Explicit exclusions (v1)

- **No social login.** Travelers have no accounts to link (the pair is the credential); operators are business
  seats where Google/Facebook buttons add **recovery ambiguity** (Airbnb dropped Facebook Login entirely;
  **Apple relay emails break support flows**).
- **No SMS OTP anywhere.**
- **No app-level passkeys in v1.** Staff get phishing resistance via the Google IdP today; traveler and
  operator passkeys are **V2** once Supabase support leaves experimental status.
- **No CAPTCHA by default**, only behind abuse thresholds.
- **No security questions, no forced password rotation, no composition rules, ever.**
- **No "keep me logged in" on the traveler surface** — the **24h session is the ceiling**; the page holds
  **PII and invoices**.

#### D.20.8 V2 roadmap

1. Traveler **step-up email code for multi-booking accounts (O2)**, then **optional magic-link sessions for
   returning multi-bookers**, keeping the pair as the **universal fallback**.
2. **Operator passkeys** (Supabase GA), **WebOTP autofill for WhatsApp codes on Android**, **operator mobile
   app with biometric session**.
3. Admin: **hardware-key requirement at the IdP once the team grows past 10**; **SAML SSO only if an
   enterprise IdP ever replaces Workspace**.
4. **Operator portal NL and ES locales (O3)**.

#### D.20.9 Decision log D1–D16

- **D1** Three separate doors on three URLs, one design language — OTA convention; cookie/CSP isolation.
- **D2** Traveler surface implements **6.4 verbatim**: pair login, no passwords, no sign-up — master lock.
- **D3** **Enumeration-proof responses everywhere, tested in DoD.**
- **D4** **Reference recovery by email, always-positive response** — airline/Expedia "forgot reference" convention.
- **D5** **Traveler step-up email code deferred to v1.1 (O2)** — v1 accounts hold single bookings; the master
  locks the pair as credential. *(Sits alongside D16, which pulls the invoice/cross-booking step-up into v1.)*
- **D6** Operator: **mandatory 2FA, per-person seats, roles, owner-gated payouts.**
- **D7** Operator 2FA channels: **TOTP + backup codes in v1** (white-glove enrollment at launch scale),
  **WhatsApp fallback in v1.1**, **no SMS, no email codes** — GYG precedent on strict channels; **YAGNI at
  25 operators**.
- **D8** **30-day device trust, 14-day rolling session, step-up on money mutations** — Viator/Peek step-up precedent.
- **D9** Recovery: **backup codes, then WhatsApp-verified admin reset against `contact_phone`.**
- **D10** **Anti-phishing line adapted from the 6.5 email line onto the portal** — "one sentence, two
  audiences, same platform voice".
- **D11** Admin: **Google Workspace SSO only, `hd` claim plus allowlist server-side, MFA at the IdP.**
- **D12** **Supabase-native everything, no custom crypto; RLS `aal2` and role claims.**
- **D13** **No SMS anywhere on the platform's auth.**
- **D14** **No app-level passkeys in v1**; staff get phishing resistance via the IdP today.
- **D15** **Channel separation: a seat's recovery path never uses its 2FA channel** — red-team finding on
  **WhatsApp dual-role takeover**.
- **D16** **Invoice and cross-booking views behind an email-code step-up from v1** — red-team insider path:
  **operators legitimately hold traveler email + reference pairs**.

#### D.20.10 Verified findings that shaped the design (F1–F14, with confidence levels)

- **F1** Passwordless email-code flows are mainstream traveler behavior and **measurably outperform passwords**
  (Expedia One Key merged sign-up and sign-in into one email+OTP flow → **login success +19%, sign-up success
  +30%, password-based authentication use −92%**, Expedia Group Tech August 2023, first-party). **Confidence:
  high.**
- **F2** Booking references must be treated as **enumerable identifiers** (CCC PNR research; Booking.com PIN
  guidance). **High.**
- **F3** **Mandatory supplier 2FA is table stakes in this exact industry** (GYG every login; FareHarbor
  mandatory; Booking.com enforced at registration). **High.**
- **F4** **Credential-only partner logins are a documented catastrophe** (2023–2025 Booking.com partner
  phishing economy). **High.**
- **F5** **SMS is the wrong channel here.** Honesty note: **GetYourGuide's own fallback IS SMS**; replacing SMS
  with WhatsApp is **our deviation, chosen for island reality, and owned as such**. **High on NIST/GYG, medium
  on the Twitter ~$60M figure.**
- **F6** **WhatsApp authentication templates (one-tap and copy-code OTP buttons) are a supported Meta pattern.**
  **High (Meta developer docs).** **No public pricing-vs-SMS claim is made.** **Second-order risk (red team):
  WhatsApp registration itself rides on SMS**, so WhatsApp codes never serve as the recovery path for a
  WhatsApp-2FA seat.
- **F7** **Daily-use B2B friction is solved with device trust and sessions, not weaker auth.** **High.**
- **F8** **Recovery design decides whether mandatory 2FA locks out the people it protects.** **High.**
- **F9** **Forced account creation is a conversion killer: 19% of US online shoppers abandoned an order in the
  past quarter because the site wanted an account** (Baymard, September 2025 update; earlier rounds measured
  24–26%). **High.**
- **F10** **Login form mechanics are standards-grade, not taste** — labels above fields, autocomplete
  attributes, **show-password toggle (GOV.UK removed confirm-password fields after adding it)**, paste-friendly
  `one-time-code` inputs (**Goibibo cut OTP retries 25% with auto-fill**). **High.**
- **F11** **Account-enumeration prevention requires identical message, status, AND timing** (OWASP). **High.**
- **F12** **Magic links are fragile where codes are robust** — **corporate scanners consume one-time links**,
  **cross-browser opens break sessions**, NN/g documents the app-switching cost. **Medium-high.** Used in:
  **codes over links everywhere a choice existed**.
- **F13** **Social login buys little here and costs recovery clarity.** **Medium-high.**
- **F14** **Hidden admin URLs are not a control; server-side authorization is.** **High.**
- **Competitive landscape (traveler):** Booking.com email-first with an emailed verification code as a
  first-class login path and password optional, passkeys in settings, guest bookings via confirmation number +
  PIN; Airbnb code-first via email or phone with password as manual alternative, Apple and Google, **Facebook
  Login removed**; Expedia One Key single email + OTP for both sign-up and login; Klook **account required to
  book**; Hopper phone-number based, passwordless; airlines/hotels universal no-account pattern.
- **Competitive landscape (supplier portals):** Booking.com Extranet (2FA required at login via PIN by SMS or
  Pulse app, forced at partner registration, per-device trust, step-up prompts, in-product anti-phishing
  line); GetYourGuide (2FA mandatory for all account types on every login, authenticator or SMS, **email codes
  explicitly not offered**, backup codes, support-mediated reset); FareHarbor (2-step mandatory phased
  rollout, SMS primary + email fallback, remember-this-device opt-in, **14-day sessions**, per-user seats urged
  over shared logins, company recovery phone role-gated); Viator (**step-up 2FA for high-risk areas — Finance
  tab: emailed code, 20-minute validity, 1-hour lockout**); Peek Pro (payouts, tax forms, employee access
  gated to admin users); Checkfront / Rezgo / Rezdy (per-user MFA, admin can mandate 2FA, brute-force lockouts).
- **Standards:** **NIST SP 800-63B rev 4 (final, July 2025)** — no composition rules (SHALL NOT), no periodic
  rotation (SHALL NOT), password managers and autofill allowed (SHALL), paste supported (SHOULD), throttling
  required, PSTN/SMS a restricted authenticator, OTP methods not phishing-resistant, syncable passkeys
  acceptable at AAL2. **OWASP** — generic errors with identical status codes and timing; MFA as the strongest
  credential-stuffing defense; short admin sessions with re-auth for sensitive operations. **Google OIDC** —
  the `hd` parameter is a UI optimization only; the returned ID token's `hd` claim must be validated server-side.
- **What we deliberately did NOT copy:** Booking.com's SMS-first 2FA (**their phishing history shows SMS 2FA
  did not stop session-theft malware anyway**); Airbnb's single account with host mode (it **welds the weakest
  consumer recovery path to the strongest attack target**); Klook's account-required-to-book (**the exact
  pattern Baymard's abandonment data punishes**); KAYAK-style passkey-first (right direction, wrong year for
  this stack); CAPTCHA-by-default and security questions (**"friction theater"**); WhatsApp OTP at launch
  (right channel, wrong moment — **25 operators can be white-glove enrolled on authenticator apps faster than
  the integration ships**).
- **Known weak spots, stated openly:** the X/Twitter ~$60M SMS-pumping figure is an **unverified company
  claim** (the *withdrawal* of free SMS 2FA is verified); the **$5,000 partner-account figure is a crime-forum
  buy offer, not a confirmed sale price**; Krebs notes it is **unclear whether Booking.com's 2FA mandate covers
  legacy partners**; **KAYAK's password elimination is a stated plan, not an independently confirmed
  completion**; **magic-link folklore numbers (Slack, Substack) were found untraceable and are not used
  anywhere in this design**; **Viator's consumer login methods were not verifiable from primary sources and
  are not load-bearing**.
- **Measurement plan:** *Traveler* — pair-login success rate, **reference-recovery volume (a proxy for email
  findability)**, lockout rate, **WhatsApp-assist rate**. *Operator* — **2FA method mix**, **remember-device
  adoption**, **median login time**, recovery volume, **step-up friction on payout changes**. *Security* —
  **failed-attempt patterns per surface**, **enumeration-probe detection**, **audit-log review cadence
  (monthly)**, **time-to-revoke on seat removal**. *Admin* — **allowlist size vs actual actors**,
  **denied-login events**, **re-auth frequency on destructive actions**.

#### D.20.11 Definition of Done (DoD 1–13)

1. **Enumeration test passes on all three surfaces** — identical **message, status code, and timing** for
   existing vs non-existing identifiers, **in every locale**.
2. Rate limits and lockouts **verified per surface**; **lockout copy renders the WhatsApp path**.
3. **Password managers autofill both operator fields and the traveler email on first render** — autocomplete
   attributes verified in **Safari, Chrome, Firefox, iOS, Android**.
4. **OTP field accepts paste**, **`inputmode` numeric**, **`autocomplete="one-time-code"` verified on iOS**.
5. **2FA enrollment issues backup codes exactly once**, and **the QR plus manual key both work against Google
   Authenticator, 1Password, and Apple Passwords.**
6. **Step-up re-auth fires on every payout, bank, seat, and tier mutation**; **audit lines written and queryable.**
7. **`hd` claim and allowlist checked server-side** (test with a **spoofed `hd` parameter**); **denied state renders.**
8. All copy passes the **LD9 banned-word check** and the **em-dash check (zero em-dashes)**.
9. **Traveler surface renders in all seven locales; the reference-format placeholder is never localized.**
10. **Session cookies `__Host-` prefixed, httpOnly, SameSite=Lax minimum, Secure; a fresh session ID is issued
    on every successful login.**
11. **Codes capped at 5 attempts each; WhatsApp codes (v1.1) expire at 10 minutes; both verified by test.**
12. **Seat revocation and password change kill active sessions and trusted devices immediately** — verified
    **with a live session in a second browser**.
13. **Reference-recovery endpoint honors its cooldowns and caps under a distributed-IP test.**
- **DoD → phase mapping:** enumeration test → Phases 1/5/6 + tests; rate limits/lockout → Phase 0 (Redis
  store) + 1 + 3; password-manager autofill → Phase 1/3/5 form audit; OTP field → Phase 3; 2FA enrollment →
  Phase 3; step-up + audit → Phase 4; `hd` + allowlist → Phase 5; zero em-dashes/banned words → content
  review; 7 locales → Phase 1; `__Host-` cookies + fresh session id → Phase 6; code attempt caps → Phase 3/7;
  seat revocation → Phase 2/3; recovery cooldowns under distributed IP → Phase 1.

#### D.20.12 Feature matrices (v1 / v1.1 / V2 / Excluded)

**Phase legend — a rule set, not just labels**

- **v1 = Launch scope.** Everything required to go live; **the platform does not open to operators/travelers
  without these.**
- **v1.1 = Fast-follow.** Built shortly after launch; **deliberately deferred from v1 because it has external
  lead times (vendor approval, integrations)** but is not needed to open the doors.
- **V2 = Later roadmap.** Genuine future work, revisited once the platform is established or a dependency
  matures; **not scheduled against launch.**
- **Excluded = deliberately not built, ever (in the current design); rejected on evidence, not just deferred.**
- **Ordering logic:** v1 proves the product is **safe to launch**; v1.1 **removes the launch dependencies that
  would have slowed v1**; V2 is **upside once the basics are proven**; Excluded is **what the research says to
  avoid.**

**Traveler surface (`island.tours/bookings`)**

- **v1:** email + booking-reference pair login (no password, no signup); noindex, SSR never cached, 24h session
  cookie; minimal takeover chrome, centered card (max 440px), WhatsApp link; non-sequential `display_ref`
  generation (`IT-2026-XXXXX`, ambiguous chars excluded); enumeration-proof responses (identical
  message/status/timing); rate limits (5 fails/email/15min, per-IP daily cap, per-reference cap, silent until
  lockout); "Lost your reference?" recovery by email, always-positive response; recovery endpoint limits
  (1 send/email/min, 5/day, per-IP); **email-code step-up for invoices + cross-booking history (insider-path
  defense)**; support-mediated booking-email typo correction (rebind + audit); all 7 locales with the
  reference placeholder never localized; GA4 `login` event (`method: booking_ref`), PII-free, lockout → ops alert.
- **V2:** optional magic-link sessions for returning multi-bookers.
- **Excluded:** "Keep me logged in" on the traveler surface.

**Operator portal (`operators.island.tours`)**

- **v1:** email + password (min 12 chars, no composition rules, no rotation); compromised-credential screening
  at set + login; per-person seats with roles (owner/manager/staff); mandatory 2FA on every login on untrusted
  devices; 2FA channel authenticator app (TOTP) + backup codes; white-glove 2FA enrollment during onboarding
  (QR + manual key + backup codes); backup codes (10, single-use, shown once, regen under owner re-auth);
  device trust ("Remember this device 30 days") + 14-day rolling session; trusted-device + active-session list
  with "Sign out everywhere"; password/2FA change invalidates all sessions + trusted devices; step-up re-auth
  for payout, bank, seat management, tier changes; recovery (backup codes → admin-executed reset,
  owner-approved for non-owner); channel-separation rule; anti-phishing line on login page + portal footer;
  seat lifecycle (invites 7-day, reset links 60-min, immediate revocation, email change); split-screen layout
  (brand panel + form card max 400px); product telemetry only (no GA4/pixels), server-side, PII-free.
- **v1.1:** 2FA fallback channel — WhatsApp codes (Meta auth templates).
- **V2:** operator portal NL + ES locales; operator passkeys + mobile app biometric session.
- **Excluded:** SMS as any factor or channel; email codes as a 2FA channel.

**Staff surface (`admin.island.tours`)**

- **v1:** Google Workspace SSO only ("Continue with Google", no app passwords); server-side `hd` claim
  verification; `admin_allowlist` role check (admin/support/content); 12h max session with fresh SSO for
  destructive/money-adjacent actions; every action audit-logged; noindex, no public links, isolated cookies + CSP.
- **V2:** hardware-key requirement at the IdP (once team > 10); SAML SSO (only if an enterprise IdP ever
  replaces Workspace).

**Shared / platform-wide**

- **v1:** three separate subdomains, `__Host-` cookies, per-surface CSP; no account enumeration on any surface
  (verified in DoD); research-grade form mechanics; central rate-limit/lockout store (Postgres or Upstash
  Redis), **never in-memory**; `auth_audit` table (actor/surface/event/ip/device/ts), **12-month retention**;
  design tokens per master, WCAG AA, `prefers-reduced-motion`; wrong-door cross-links (traveler ↔ operator;
  admin linked from nowhere); Resend transactional email for recovery + reset.
- **V2:** app-level passkeys (traveler + operator).
- **Excluded:** social login (Google/Facebook buttons); CAPTCHA by default (only behind abuse threshold);
  security questions / forced rotation / composition rules.
- **Bottom line as written:** "A well-researched, standards-grounded proposal for three separate,
  purpose-built login surfaces — **passwordless friction-free for travelers, bank-grade-with-warmth for
  operators, IdP-delegated for staff** — built on Supabase Auth + Google SSO with no custom crypto,
  enumeration-proof everywhere, and SMS-free by principle. **It's a proposal awaiting founder sign-off (5 open
  items), not yet locked into the master.**"

#### D.20.13 Open items for founder confirmation (O1–O5)

- **O1 — Operator 2FA rollout:** v1 TOTP + backup codes with white-glove enrollment; v1.1 WhatsApp code
  fallback; **never SMS, never email codes**.
- **O2 — Traveler step-up scope:** invoice and cross-booking views require the **email-code step-up from v1**;
  **broader every-login step-up stays v1.1**.
- **O3 — Operator portal locales:** **EN v1; NL and ES on roadmap**.
- **O4 — Device trust duration:** **30-day remember-device, 14-day rolling session**.
- **O5 — Google Workspace:** confirm **all staff seats live in one Workspace org with enforced 2SV (passkeys
  or security keys)**.

#### D.20.14 ⚠️ CONFLICT — the engine divergence (Supabase proposed vs Better Auth built), and its resolution

- The spec and rationale (**D12**) repeatedly specify **Supabase Auth** (password + native TOTP MFA, `aal2` via
  **RLS policies**, roles via a **custom access token hook**, "no custom crypto anywhere"). **The platform runs
  Better Auth `^1.6.9` inside NestJS.**

| Dimension | Proposal | As-built |
|---|---|---|
| Auth engine | Supabase Auth | **Better Auth `^1.6.9`** |
| Runs where | Supabase (managed) | **NestJS backend only**; CLAUDE.md rule 12 |
| DB access | Postgres RLS policies | **Prisma ORM + service-layer guards** (no RLS anywhere) |
| Authz mechanism | `aal2` JWT claim in RLS | **`RolesGuard` + `PermissionsGuard`** on the `role` column + `ROLE_PERMISSIONS` map |
| Session store | Supabase | Better Auth `session` table (Prisma), **7-day expiry** |
| Multi-tenant seats | `operator_users` table | **None** — `Operator.userId` is `@unique` (one user per operator) |

- **RESOLUTION: Better Auth.** The proposal is flagged "proposal v0.1, not folded into the master," and "the
  master wins." The master + CLAUDE.md lock Better Auth. **"Almost none of the login proposal is built yet,
  BUT almost all of it is buildable on the existing Better Auth stack without adopting Supabase. The gaps are
  feature gaps, not engine gaps."**
- **Capability mapping (every "missing" piece maps to a supported plugin/option, verified in official docs):**
  operator 2FA (TOTP) → **`twoFactor` plugin** (`POST /two-factor/enable` returns a `totpURI` for the QR +
  `backupCodes`; `POST /two-factor/verify-totp` **accepts ±1 period for clock drift**); backup codes (10,
  single-use, regenerable, single-use enforced by the plugin); trusted device (30-day) →
  `verifyTotp({ trustDevice: true })`, **refreshed on each sign-in — matches spec O4 exactly**; operator seats
  → the `organization` plugin (or a custom table); admin Google SSO → `socialProviders.google`; traveler magic
  link (V2) → `magicLink` plugin; central rate-limit/session store → **`secondaryStorage` pointed at Redis**;
  custom rate rules → `rateLimit.customRules`; revoke-everything → `revokeSessionsOnPasswordReset` + session
  APIs; extra fields → `additionalFields`; step-up re-auth → **session freshness + `twoFactor` re-verify,
  enforced in a NestJS guard**.
- **What Better Auth genuinely CANNOT do (and the honest workarounds):** (1) **Google `hd` claim verification
  is not automatic** — verify `hd` (and cross-check `admin_allowlist`) inside a Better Auth OAuth
  `mapProfileToUser` / sign-in hook, server-side ("a few lines"; the spec already requires it be server-side);
  (2) **WhatsApp OTP is not a built-in channel — neither is it in Supabase**; both require a custom Meta
  integration, and it is **v1.1 regardless**; (3) **app-level passkeys** exist as a plugin but the spec defers
  them to V2 anyway; (4) **no managed hosted UI** — Better Auth gives APIs, not pre-built login screens, **which
  we want anyway** because the spec's whole point is three bespoke on-brand surfaces (Supabase's hosted UI
  would be discarded for the same reason).
- **Why switching would be costly and risky HERE:** (1) **we do not use RLS at all** — Supabase's headline
  benefit only pays off if the whole data layer is rewritten behind RLS with Supabase-issued JWTs, **a
  re-platform of the entire backend, not an auth feature**; (2) **two sources of truth for users**; (3) **our
  RBAC would be rebuilt twice**, with the frontend mirror thrown away; (4) **every existing authenticated
  feature breaks during migration**; (5) **it contradicts locked project rules 12 and 14**; (6) **the migration
  buys nothing the spec needs.**
- **The security insight that settles it:** the rationale doc's own threat model shows the attacks that
  **actually caused damage** were **infostealer malware + session/cookie theft that defeated 2FA** (Storm-1865
  continued **after** 2FA enforcement). The defense against that class is **trusted-device management +
  sign-out-everywhere + session hygiene + step-up on money actions** — **all session/app-layer controls**.
  **"The security bar is met by HOW sessions and step-up are managed, not by WHO hosts the password hash."**
  **A managed auth vendor would not have prevented those breaches either.**
- **Why not a managed service (Auth0 / Clerk / WorkOS / Cognito / Firebase / Stytch):** what they genuinely add
  is breached-password detection, anomaly/bot/adaptive MFA, **SOC2 / ISO attestations**, hosted enterprise
  SAML, and dashboards — but breached-password is **one HIBP hook**; adaptive MFA / SAML are **not in v1**;
  compliance attestations are **a legal/commercial call, not a technical gap**; dashboards are convenient, not
  load-bearing. Switching costs: identity forks out of our Postgres (**violates rule 14**), RBAC/guards rebuilt,
  every authenticated feature re-touched, **vendor lock-in + per-MAU billing**, and **PII leaves our database**.
  **MAU note:** travelers do **not** use the auth engine in v1 (their `/bookings` surface is a thin sessionless
  lookup), so managed-service MAU cost would only cover **operators (~25) + admins** — cheap on MAU, but it
  would still fork identity from the `Operator` aggregate.
- **When we would reconsider (scoped addition for operator/admin, not a full migration):** a formal SOC2/ISO
  attestation for auth specifically; enterprise SAML SSO for operators on the near-term roadmap (**WorkOS the
  natural fit**); no in-house capacity to maintain security-critical auth; or a genuine **multi-org model**
  (one person managing several operator accounts with an org switcher). **None are in the spec today.**

#### D.20.15 As-built reconciliation (verified July 5, 2026; amended 2026-07-20)

**Already built and directly reusable**

- Better Auth instance: **email+password**, **`disableSignUp: true`**, **`requireEmailVerification: true`**,
  **`minPasswordLength: 12`**, **`resetPasswordTokenExpiresIn: 3600` (60 min — matches the spec exactly)**,
  **`revokeSessionsOnPasswordReset: true`**.
- Guard chain (global, correct order): **`ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`**.
- RBAC: `Role` enum (`ADMIN, EDITOR, STAFF, GUIDE, TOUR_OPERATOR, USER`), **~90-value `Permission` enum**,
  `ROLE_PERMISSIONS` map, mirrored on the frontend (`lib/config/rbac.ts`, `useRole()`).
- DB hooks: **block runtime `ADMIN` creation**; track `hasPassword` / `passwordChangedAt`.
- Rate limiting, **two layers**: Better Auth's per-path limiter (`/sign-in/email`, `/forget-password`,
  `/reset-password` = **5/60s**) + NestJS `ThrottlerGuard` (**20/s, 300/min, 3000/hr**) with the
  **`INTERNAL_API_SECRET` trusted-origin bypass**.
- Operator invite flow: admin creates the operator user, links a **throwaway credential**, fires a
  **server-initiated password reset** routed to the invite email.
- Booking references: **`Booking.displayRef`** (`IT-2026-00042`, unique) and **`Booking.publicRef`** (uuid TYP token).
- Cross-subdomain cookies: `advanced.crossSubDomainCookies` enabled in production (`COOKIE_DOMAIN`).

**Traveler verdict: core surface BUILT end to end** — pair login, HttpOnly server session, masked-vs-verified
TYP, owner-only cancellation, credential rate caps, audit lines. **Remaining:** non-sequential `display_ref`
(generation is `IT-2026-00042`, which **looks sequential**; spec wants **random within format, ambiguous chars
excluded**), the GA4 `login` event, and the deferred email-code step-up. **Still no Better Auth involvement for
travelers, per the spec.**

**Operator verdict:** the **credential half is built** (email+password at 12 chars already meets NIST), but
**everything that makes it "bank-grade" is missing**: 2FA, seats/roles, device trust, step-up. **The two biggest
builds in the whole proposal. No engine change required.**

**Staff verdict: ~0% built.** Needs Google OAuth, an allowlist table, an `hd` verification hook, and a separate
admin login surface. **All feasible on Better Auth.**

**Shared gaps:** no `__Host-` prefix, no per-surface CSP, single frontend host; enumeration **not
audited/tested for identical timing**; **Better Auth's limiter is in-memory by default with no
`secondaryStorage` configured** (Redis exists but only for BullMQ) — **the spec explicitly warns in-memory
fails in prod**; no `auth_audit` table; no wrong-door cross-links.

**Phased build plan (S = 1-2 days, M = 3-5 days, L = 1-2 weeks; each phase independently shippable)**

- **Phase 0 — Foundations & decisions (S):** confirm the engine and seats approach; **add Better Auth
  `secondaryStorage` (Redis)**; **create the `auth_audit` table** (12-month retention); add an audit-write
  helper called from `AuthGuard` and Better Auth hooks; document the enumeration + form-mechanics DoD baseline
  so every subsequent page is built to it.
- **Phase 1 — Traveler surface (M):** `POST /api/v1/bookings/lookup`; rate limits; non-sequential `display_ref`
  (**excluding ambiguous characters 0/O, 1/I/L**, migrating **the generator only — existing refs stay**);
  recovery endpoint; **email-code step-up (6-digit code emailed to the booking address, short-lived, 5-attempt
  cap)**; the `/bookings` page; tracking.
  - **EXECUTED 2026-07-18 (partial):** lookup DONE simplified (both fields case-insensitive, same generic 404
    on every failure; **constant-time comparison NOT implemented** — it is a Prisma lookup and timing is
    dominated by the query); rate limits **PARTIAL** (per-IP `@Throttle` 2/10s, 6/min, 30/hr — browser-only);
    `/bookings` page **PARTIAL** (**no locale prefix**, copy **English-only**, screens built pre-i18n);
    recovery **DONE**. **NOT DONE:** non-sequential `displayRef`, email-code step-up, tracking events.
    (Later superseded by the 2026-07-19 hardening in D.19.)
- **Phase 2 — Operator seats & roles (L):** add the seats table, migrate existing operators (one owner seat
  each), extend `resolveOperatorId`, seat management (invite/list/change role/revoke), owner-only gates, and
  the RBAC note that **all seats keep the `TOUR_OPERATOR` platform `Role`; `seatRole` is the intra-operator
  distinction, checked in the service, not via a new platform role.**
  - ⚠️ CONFLICT (seats shape) — the plan specified **`operator_users`**; the **EXECUTED 2026-07-19 build used a
    unified `staff_members` + `staff_designations`** table covering **both** operator team seats
    (`operatorId` set) **and** platform admin-side staff (`operatorId` NULL), preserving E.11's shape
    (seatRole owner/manager/staff, status invited/active/suspended, invitedBy, lastLoginAt) inside it, **plus a
    fine-grained effective-permission engine beyond the spec** — effective set =
    **(designation.permissions ∪ extraPermissions) − revokedPermissions**, capped to a per-scope **grant
    ceiling** and a **non-revocable floor (VIEW_PROFILE/EDIT_PROFILE)**, computed by a `@Global`
    `StaffPermissionsService` (60s cache, invalidated on every staff mutation). **A STAFF-role user WITHOUT a
    staff record resolves to the floor only** (closing the role-flip escalation path).
  - Rationale for the custom table over the `organization` plugin: the plugin **models the wrong shape**
    (multi-tenant SaaS with org switching; **our operators are single-business, ~25 at launch**); **we already
    have the tenant root — `Operator`**, and the plugin would add a parallel table that **1:1 shadows it
    forever with permanent "which is canonical" drift risk**; **every FK points at `operators.id`**; it avoids
    **a second permission system**; and the "less code" edge is small and front-loaded. **The one thing that
    would flip this to the plugin: a near-term need for one person to manage multiple operator accounts.**
- **Phase 3 — Operator 2FA (L):** enable the `twoFactor` plugin; white-glove enrollment (QR + manual key + 10
  backup codes shown exactly once, verified by a first code); login flow with trusted-device skip; backup-code
  regeneration under owner re-auth; device & session management UI with "Sign out everywhere"; recovery;
  the operator login page.
- **Phase 4 — Step-up re-auth (M):** a **`@StepUp()` guard/interceptor** on payout, bank, seat-management and
  tier-change routes requiring **a fresh session AND a recent successful 2FA**, returning a challenge the
  frontend turns into a re-verify prompt. **This is our replacement for Supabase's RLS `aal2`.** Audit every
  challenge and result.
- **Phase 5 — Staff surface (M):** `google` social provider; **`hd` verification hook** rejecting any token
  whose `hd` != the Workspace domain, server-side; `admin_allowlist` table; the admin login page; **12h max
  admin session** with fresh SSO for destructive/money actions.
- **Phase 6 — Platform hardening: subdomains, cookies, CSP (M).**
  - **6.0 Decision — separate subdomains, NOT separate applications.** The spec's stated reasons are all
    **runtime isolation** (cookie scoping, stricter CSP per surface, OTA convention) — **none of which require
    separate codebases.** **Chosen approach: one codebase, host-based routing (Option A), with admin promotable
    to its own deploy later (Option B).** Option C (fully separate apps/repos) has the highest isolation and
    the highest cost. **Why A over C:** the design system (`--it-*` tokens), the Better Auth client, the API
    client, shared types and form components are used by every surface; **splitting into three codebases
    triplicates all of it for a small team.** **Admin is the natural (and only) candidate for physical
    separation.**
  - **6.1 Better Auth cookie changes (the current config is WRONG for this).** **Problem:**
    `advanced.crossSubDomainCookies` with `domain: process.env.COOKIE_DOMAIN ?? '.esenc.cloud'` **SHARES the
    auth cookie across all subdomains**, so **an XSS or token theft on the operator surface could reach an
    admin session on a sibling subdomain — exactly what three doors is meant to prevent.**
    - **Target cookie model:** traveler `/bookings` — **no Better Auth session**, host-only, short-lived (24h
      ceiling), `__Host-` prefix, **separate cookie name, never shared**; operator portal — Better Auth session
      + 2FA, **host-only to `operators.island.tours`**; admin — Better Auth session (Google SSO), **host-only
      to `admin.island.tours`, 12h ceiling**.
    - **Changes:** (1) stop sharing the auth cookie across sibling subdomains; (2) add the **`__Host-` prefix**
      (`Secure`, path `/`, **no `Domain` attribute** — **`__Host-` and a shared `Domain` are mutually
      exclusive**); (3) per-surface `httpOnly`, `Secure`, `SameSite=Lax` minimum; (4) **fresh session id on
      every successful login** (verify Better Auth rotates it; enforce if not); (5) **different cookie names
      per surface**; (6) **`trustedOrigins` must list all three subdomains**, keeping the `INTERNAL_API_SECRET`
      SSR bypass working per origin; (7) **session ceilings per surface** — operator 14-day rolling (with
      30-day device trust), admin 12h — **Better Auth's `expiresIn` is global, so per-surface ceilings are
      enforced in a guard/hook**; (8) **revocation stays global at the identity level.**
    - **Migration caution:** changing the cookie domain **invalidates existing sessions — everyone is logged
      out once**. Ship in a window where a forced re-login is acceptable, **and only after the operator/admin
      login surfaces exist**.
  - **6.2 Remaining hardening:** per-surface CSP set in middleware per host; **noindex on `/bookings` and all
    admin routes**; **compromised-credential screening** at password set + login (HaveIBeenPwned range API in
    a Better Auth password hook); wrong-door cross-links + global-footer "For operators"; **enumeration/timing
    audit across all three surfaces in all locales**.
- **Phase 7 — v1.1 / V2:** WhatsApp 2FA codes; enforce channel-separation in recovery; WebOTP autofill on
  Android; then operator + traveler passkeys, traveler magic-link sessions, operator NL/ES locales, admin
  hardware-key requirement.

**Risks & call-outs (R1–R7)**

- **R1 Seats is the biggest change** — it turns a 1:1 user-operator into a **1-operator-many-users** model.
  Get the founder decision before starting Phase 2 and plan the data migration carefully.
- **R2 2FA lockouts are a support cost** — **white-glove enrollment + backup codes + a documented admin-reset
  path are mandatory, not optional.**
- **R3 The traveler surface does not need Better Auth sessions in v1** — keep it a thin lookup **so we do not
  accidentally create real accounts for travelers**.
- **R4 Redis `secondaryStorage` must land first** — shipping rate limits on in-memory storage is **the
  documented production failure**.
- **R5 Admin currently shares the generic `/login`** — **do not remove that until the Google-only admin surface
  is live**, or admins lock themselves out.
- **R6 Cookie-domain change logs everyone out once.**
- **R7 Separate subdomains do not mean separate apps** — build one codebase with host-based routing; keep only
  admin as an easy future candidate for its own deploy. **Do not fork into three codebases.**
- ⚠️ CONFLICT (rate-limit store) — spec and plan both mandate a **central store, never in-memory**; the
  as-built traveler limiter and the staff permission cache are **both in-process today** — explicit known
  limits before multi-instance deployment.

---

### D.21 Reviews

#### D.21.1 Booking-gated submission and moderation

- **Trust sub-line rendered under the Reviews H2 (locked):** `Every review from a confirmed booking. No exceptions.`
- **Tour-level aggregate fields are derived from APPROVED Review records only** — moderation status is a
  first-class field on the review entity.
- **Review-level entity fields:** reviewer name (**first name + last initial only, privacy-preserving**),
  reviewer type (enum), **travel month + year (no exact dates)**, rating (1–5 int), text per locale, photos
  array, helpful count, **platform response**, moderation status.
- **⚠️ CONFLICT — operator response:** the CMS review entity states the response is **"Platform response —
  Island Tours-authored, NOT operator-authored"**. No operator-authored response field is specified anywhere
  in these fragments; if an operator response is expected, that is a spec gap to raise, not something the
  master supports today.
- Reviews and rating for tier eligibility use **APPROVED reviews only** — the same `review_count` and
  `aggregate_rating` the tour page renders.

#### D.21.2 Aggregates (computed fields)

- `tour.review_count` — int (computed) — total approved native reviews; drives the Reviews rating-header count
  + the LD11 cold-start threshold (<3) + the LD30 sort/filter conditional thresholds (<10 / <20).
- `tour.aggregate_rating` — float (computed) — average rating across all approved reviews, **1 decimal place**.
- `tour.rating_distribution` — array (computed) — per-star count, e.g.
  `[{stars: 5, count: 38}, {stars: 4, count: 7}, ...]`.
- `tour.photo_review_count` — int (computed) — count of approved reviews with ≥1 photo; **drives the photo
  carousel conditional render (activates at ≥3)**.
- `operator.aggregate_rating` and `operator.aggregate_review_count` — computed, used for the Provider Rating
  fallback.

#### D.21.3 Display rules

- **Card rating renders only at `review_count >= 3`.** At 0–2 reviews the rating row is hidden entirely; a tour
  **<30 days old with 0 reviews shows the `New` badge instead of the rating row**.
- **LD11 — Provider Rating cold-start.** When a tour has **<3 native reviews AND its operator has ≥10 reviews +
  ≥4.0 average across all their tours**, display the **operator-aggregate rating** with **explicit attribution:
  "From this host's N reviews across all tours"**. **Otherwise hide the rating row entirely.**
- **LD29 — Review preview module above Overview (three-tier phased implementation).** A content block in the
  left column between the Quick Info badges / booking-widget intro and the Sticky TOC activation zone.
  **NOT a TOC-anchored section** — a content module without an H2 anchor in the 7-item structure.
  - **Tier 1 (cold-start, <3 verified reviews) — LAUNCH SCOPE:** the module is **hidden entirely. No DOM
    rendering, no empty state, no "Be the first to review" placeholder.** The LD11 Provider Rating fallback in
    the meta row remains the primary trust signal. Rationale: **an empty review preview weakens the brand
    promise more than absence does.**
  - **Tier 2 (established, 3–9 verified reviews AND aggregate rating ≥4.0) — LAUNCH SCOPE:** the module renders
    with header `What our guests say · [rating] ([count]) · See all reviews →` plus **2 review cards in a
    2-column grid on desktop, stacked on mobile**.
    - Card content: 5-star rating · reviewer first name + last initial · `[Month DD, YYYY]` from
      `review.created_at` (e.g. "March 12, 2026") · 2–3 sentence snippet · **"Read more" expand inline (NO modal)**.
    - **Card selection logic: the 2 most recent verified reviews with rating ≥4** (mathematically guaranteed to
      exist when aggregate ≥4.0 and ≥3 reviews).
    - **If aggregate <4.0 the module reverts to Tier 1 (hidden)** — a single outlier review does not
      permanently disqualify, but consistent low quality does.
    - Transparency is handled at aggregate level (rating + count in the meta row and module header) AND at
      deep-dive level (the full Reviews section shows ALL reviews including <4-star). **The preview module is
      section-appropriate curation, NOT cherry-picking.**
    - "See all reviews" smooth-scrolls to the Reviews TOC anchor.
  - **Tier 3 (mature, ≥10 verified reviews) — V2 SCOPE:** AI-generated category chips above the cards
    (`[All] [Great crew] [Crystal water] [BBQ lunch] [Snorkel safari]`, Viator pattern); clicking a chip filters
    cards inline; mobile chips horizontally scrollable. **Hard dependency on the LD28 AI pipeline.**
  - **Mobile layout: cards stack vertically (1 per row), NOT a carousel.**
  - **Performance: server-side rendered, inline — NO lazy load** (above-fold zone).
  - **Schema.org `Review` structured data per card**; `AggregateRating` lives in the Reviews section.
  - Rationale: industry standard 2026 (Viator "Why travelers loved this", GYG "What travelers loved"); reviews
    are the **#1 conversion driver (Baymard: 95% of users rely on reviews)**; high-on-page placement = early
    trust signal. Effort: Tier 1+2 ≈ 3–4 days design, 5–7 days dev.
- **LD30 — Reviews section sort & filter conditional rendering.**
  - **Sort dropdown HIDDEN when `tour.review_count < 10`** — at <10 reviews all cards fit on one screen, so
    sort is decoration without UX value.
  - **Filter row HIDDEN when `tour.review_count < 20`** — at <20 reviews, filtering by Traveler type / Language
    / With photos returns 0–2 matches in most combinations (**dead UX**).
  - **Default ordering at ALL volumes: `ORDER BY review.created_at DESC`** (most recent first).
  - Above thresholds (V2) the sort dropdown surfaces with `Most relevant` (hybrid recency × helpful-vote ×
    rating-balance), `Most recent`, `Highest rated`, `Lowest rated`, `Most helpful`; the filter row surfaces
    with Traveler type enum (requires v2 `reviewer_type` collection), Language, and "With photos only".
  - **Helpful vote button DEFERRED to V2** — at launch volumes "↑ Found this helpful (0)" counts read as a
    negative signal rather than social validation. CMS impact: `review.helpful_count` and
    `review.reviewer_type` deferred, re-added at V2.
- **LD31 — Star distribution chart: clickable rows in v1.**
  - Each row (5★ / 4★ / 3★ / 2★ / 1★) is **clickable from launch** (not v2-deferred); clicking filters the
    review list to that rating, **regardless of `review_count` threshold (functional from review #1)**.
  - Rationale: **96% of users actively look for negative reviews; 52% specifically seek 1-star reviews.** The
    clickable star chart is the **PRIMARY fast-path to critical reviews** — especially important because no
    "Most helpful critical" surfaced pair is rendered.
  - **With the filter row hidden below 20 reviews (LD30), the star chart is the ONLY v1 mechanism to filter
    reviews by rating.**
  - **The chart itself renders when `tour.review_count >= 3`**; at 0–2 reviews only the rating + count line shows.
  - Active filter state: the clicked row is highlighted in **brand orange `#E8611A`**, with an inline link
    above the review cards: `Showing X reviews at [N]★ · Clear filter`.
  - **Multi-row selection NOT supported in v1** (single-rating filter only).
- **LD32 — Review translation = machine translation + show-original toggle.**
  - Non-EN locale reviews are translated **on demand, server-side, via Google Translate API** (or equivalent:
    DeepL, Azure Translator).
  - Each review card displays in the user's current locale by default, with a subtle **"Translated by Google"**
    label beneath the text.
  - **"Show original" toggle reverts to source-locale text inline — no modal, no reload. Toggle state is
    per-card, not section-wide.**
  - Rationale: human translation is cost-prohibitive at scale (100 tours × 20 reviews × 6 non-EN locales ≈
    **12,000 translations × $0.10/word recurring**); machine translation with a transparency label is the OTA
    industry standard (Booking, Viator, GYG all use Google Translate); **88% of users prefer reviews with text
    over star-only**.
  - **The brand voice rule does NOT apply to review translations** (user-generated content, not editorial).
  - CMS: `review.text_{locale}` simplified to **`review.text` (single source of truth in the original locale)**
    plus a **translation cache table**; `review.original_locale` retained.
- **LD28 — AI Review Summary pipeline DEFERRED to V2.**
  - Original two-tier implementation: Tier 1 cold-start (<10 verified reviews) hid the summary with the Provider
    Rating fallback as primary signal; Tier 2 (≥10 verified reviews) rendered an AI summary box at the top of
    Reviews — a 3–5 sentence LLM synthesis with disclaimer + "Report inaccuracy" link, **regenerated weekly and
    on-demand after every 5 new reviews**, multi-locale via **7 direct LLM calls per regenerate**.
  - **Reason for deferral:** at May 1, 2026 launch **zero tours have ≥10 reviews** — Tier 1 logic means the AI
    summary **renders for nobody**. The pipeline-prep cost (~1.5–2 weeks dev + LLM integration + cron
    infrastructure + multi-locale + moderation queue + visual design) is investment for a feature first
    rendering for one tour in month 3–6 post-launch. On a launching marketplace, **AI synthesis on 10-review
    tours can feel suspicious rather than reassuring**, weakening "Built by Islanders" authenticity.
  - **Reactivation trigger: when the first tour reaches ≥30 reviews** (genuine synthesis substrate).
  - CMS fields `tour.ai_review_summary_*` removed from the launch data model; re-added at reactivation.

#### D.21.4 Platform reviews

- The homepage **social proof strip** carries the **Trustpilot aggregate plus rotating review quotes**, and
  **renders only at 100 or more platform reviews**.
- **No Trustpilot badge on the destination page at launch** — a thin review base is a liability, not a trust signal.
- Reviews feed the tier eligibility engine: `boosted`/`featured`/`premium` require **5 reviews · rating ≥4.0 ·
  operator cancellation rate ≤10%**; **Destination Spotlight (35%)** requires **10 reviews · rating ≥4.5 ·
  cancellation rate ≤10% · manual approval · max 3 simultaneous per destination**.
- The `Most popular` badge is **editorial/quality-based** — organic tour, `review_count ≥ 10`, rating ≥ 4.5,
  **max 1 per category** — **never commission-driven**.

---

### D.22 Wishlist

- **The wishlist heart is REQUIRED on every tour card** (Fix 3): desktop **top-right overlay on the image**,
  mobile **bottom-right overlay** (avoids badge collision); **~32px white circular backdrop, subtle shadow,
  heart icon inside**; states **outlined (default) → filled brand-orange (wishlisted)**; **click toggles**;
  **optimistic UI — fill immediately, revert on API failure**; **no page navigation on click**.
- **The wishlist icon lives in the destination-context nav bar** alongside logo, location selector, Categories
  dropdown, search, language switcher and account.
- **GA4 `add_to_wishlist`** fires from the card, with **list id and index** (alongside `view_item_list` and
  `select_item`).
- Wishlist grids use the **sitewide tour-grid standard**.
- The traveler account area contains **bookings, invoices, and saved tours (wishlist)** — confirmed by the
  traveler login success state copy.
- `heart-outline` is in the **required minimum icon set for v1 launch**.

---

### D.23 Tracking & analytics

> **Provenance:** master §8 (deep source `island-tours-typ-tracking-dev-spec.md`). One `booking_complete` event
> on the TYP fanning out to four GTM tags plus a server-side Meta CAPI, with `commission_amount` (EUR) as the
> conversion value and mark-first idempotency.
> **Status: target architecture, NOT yet built** — no payments/Stripe processing, no webhooks, no tracking
> layer in code today.

#### D.23.1 The seven principles

1. **Conversion value = `commission_amount` in EUR, never GMV.** Smart Bidding learns from **real margin, not
   gross booking total**. The conversion value is **always `bookings.commission_amount`, never
   `booking_total_eur`**.
2. **One `booking_complete` dataLayer event** on the TYP feeds **four GTM tags**: Conversion Linker, Google Ads,
   GA4 (`purchase`), Meta Pixel. **No per-tour or per-campaign tags.**
3. **Enhanced Conversions / Advanced Matching** on all available **hashed PII** — email, phone (E.164 via
   `libphonenumber-js`), name, address — hashed **server-side (SHA-256)**. **One hash pass serves Google and
   Meta alike.**
4. **Server-side Meta CAPI fires IN PARALLEL with the browser Pixel, deduplicated by event id** (iOS 14+ recovery).
5. **Server-side idempotency via `conversion_fired_at`** on the bookings table. Refreshes, email revisits, and
   shared links never double-fire. **Never `localStorage`.**
6. **Cancellation/refund adjustments flow back to Google Ads and Meta via API** — which requires **click-id
   (`gclid`, `gbraid`, `wbraid`, `fbclid`) and UTM capture at booking creation**.
7. **Consent Mode v2 from scratch, regional defaults: EEA denied by default, US/CA granted.** **CMP selection
   (Cookiebot or Iubenda) precedes the GTM build.**

#### D.23.2 The flow, step by step

- **`/payment/processing`** — a lean intermediate page that waits for the webhook. **ZERO tags.**
- **Stripe webhook confirms** — idempotent; processed Stripe event ids live in the **`stripe_webhook_events`
  table**; retries are safe.
- **302 → `/{destination}/thank-you/{public_ref}`** (NO locale prefix, `noindex`).
- **TYP server component** — loads the booking, normalizes currency, hashes PII, **sets `conversion_fired_at`
  BEFORE render (mark-first)**.
- **TYP client component** — pushes `booking_complete` **ONCE** (production only; **staging guard**).
- **GTM fans out** — Conversion Linker · Google Ads · GA4 `purchase` · Meta Pixel.
- **Meta CAPI** — server-side POST with the **SHARED event id** (dedup).
- **Mark-first idempotency:** the server sets `conversion_fired_at` **before render**. A client push that never
  executes (user closes the tab) is an **accepted false negative, never a double fire. The guard is the
  database column, not client storage.**
- **`operator_full` bypass:** those bookings take **no charge and no webhook**; the booking is created
  **confirmed at commit** and redirects **straight to the TYP**, where mark-first idempotency and the data
  contract apply **unchanged**.
- See D.11.2 for the full server-component implementation and D.11.3 for `detectBookingState`.

#### D.23.3 The `booking_complete` data contract — EVERY field with its source

The push carries the **shared event id** for CAPI deduplication, plus:

| dataLayer field | Source |
|---|---|
| `booking_value` | `bookings.commission_amount` — **EUR, always; never `booking_total_eur`** |
| `booking_currency` | hardcoded `'EUR'` — tracking currency is always EUR; the customer UI shows `original_currency` |
| `booking_ref` | `bookings.display_ref` — transaction id for dedupe across all platforms |
| `tour_id`, `tour_name` | `bookings.tour_id`, `tours.name` — GA4 `item_id` and `item_name` |
| `operator_id`, `operator_name` | `bookings.operator_id`, `operators.name` — `item_brand` and segmentation |
| `island` | `bookings.island` — denormalized at creation |
| `items[]` | composed: `{ item_id, item_name, item_brand, item_category, price, quantity: 1 }`; `item_category` from `tours.category`; `price` = commission_amount |
| `user_id` | `bookings.customer_id` — GA4 cross-device tracking |
| `click_ids.gclid` / `.gbraid` / `.wbraid` / `.fbclid` | the E.8 click-id columns — Google Ads and Meta adjustments, offline conversions |
| `user_data.sha256_email_address` | SHA-256 of lowercased, trimmed `customer_email` — **REQUIRED** |
| `user_data.sha256_phone_number` | SHA-256 of the E.164 `customer_phone` — optional when no phone (normalized using `billing_country`) |
| `user_data.sha256_first_name`, `.sha256_last_name` | SHA-256 of the split name fields — **match rate +20–40%** |
| `user_data.address.sha256_city` / `.sha256_postal_code` / `.sha256_country` | SHA-256 of the Stripe billing fields — optional, each only when the underlying field is present |

- **Contract rules:**
  - **One SHA-256 pass serves Google and Meta alike — never per-platform hashing.**
  - **The payload is type-checked in CI; a missing REQUIRED field is a BUILD ERROR, not a runtime fallback.**
  - **A confirmed booking with a null `commission_amount` is DATA CORRUPTION: render an error and fire NO
    conversion.** The same no-silent-fallback rule covers a missing cancellation window and an operator with
    **neither** contact field.
- **Conflict resolution — where the §13 UI columns disagree, the master governs:**
  - The stale **72h payment deadline** and `cancellation_window_hours` are **superseded by the unified
    `cancellation_hours` window**.
  - The **unmasked confirmation email** is superseded by the **masked render**.
  - **en-US-only dates** are superseded by the **seven-locale scope** (`customer_locale`).

#### D.23.4 Booking schema fields added for tracking

- **Identification:** `public_ref` (uuid NOT NULL UNIQUE — used in the URL); `display_ref` (varchar NOT NULL —
  `IT-2026-XXXXX`, customer-facing + used as transaction_id); `status`; `island` (varchar NOT NULL, e.g.
  `'Curaçao'`, multi-island ready, **populated at booking creation from `tours.island`** for faster queries and
  less fragility against future tour relocations).
- **Multi-currency:** `original_currency` (char(3) NOT NULL — `'EUR'` or `'USD'`, what Stripe charged);
  `original_amount` (decimal(10,2) NOT NULL); `booking_total_eur` (decimal(10,2) NOT NULL); `fx_rate_to_eur`
  (decimal(10,6) NOT NULL — **snapshot at booking time, for audit**).
- **Commission (the conversion value):** `commission_rate` (decimal(5,4) NOT NULL, e.g. 0.20, **snapshot at
  booking time**); `commission_amount` (decimal(10,2) NOT NULL, **in EUR — the conversion value for ALL
  platforms**).
- **Idempotency:** `conversion_fired_at` (timestamptz NULL).
- **Click-ID attribution:** `gclid`, `gbraid` (iOS app), `wbraid` (web app), `fbclid` — all varchar NULL.
- **UTM parameters:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` — all varchar NULL.
- **Customer identity:** `customer_first_name` (NOT NULL, **split for hashing**), `customer_last_name` (NOT
  NULL), `customer_email` (NOT NULL), `customer_phone` (NULL, **normalize to E.164**).
  - **If the booking form has a single `customer_name` field, change the form to collect first + last
    SEPARATELY** — this improves the Enhanced Conversions match rate substantially (**Google: +20–40%**).
  - **Backwards compatibility:** parse existing `customer_name` heuristically (first word = first name, rest =
    last name), accepting that this is sometimes wrong for historic data.
- **Billing data (from the Stripe `payment_method`):** `billing_country` (char(2), ISO-3166-1 alpha-2 —
  `'NL'`, `'US'`, `'CW'`); `billing_postal_code` (from `payment_method.card.address_zip`); `billing_city`
  (optional). **Billing data adds NO extra friction to the booking form** — these are pulled automatically from
  the Stripe payment intent / payment method during webhook handling. **No UI change needed.**
- **Cross-device:** `customer_id` (varchar NULL — for GA4 `user_id`, e.g. a hash of the email).

#### D.23.5 Definition of Done (37 checks, headlined by)

- **Tag Assistant** clean fires.
- **GA4 DebugView: exactly ONE `purchase` per test booking.**
- **Meta Events Manager: ONE deduplicated `Purchase`** (browser + CAPI).
- **Enhanced Conversions match rate ABOVE 60%.**

#### D.23.6 Supporting infrastructure & current code state (all Not built)

- Conversion idempotency — `bookings.conversion_fired_at` (timestamptz, set server-side pre-render) — **Not built**.
- Webhook idempotency — dedicated `stripe_webhook_events` table — **Not built** (no payments/webhook layer).
- Click-id / UTM capture columns, captured at creation — **Not built**.
- PII hashing — SHA-256 server-side, phone normalized via `libphonenumber-js` — **Not built**.
- Consent — Consent Mode v2 + CMP (Cookiebot/Iubenda) before the GTM build — **Not built**.
- **The current `Booking` model carries NONE of the tracking columns** (`public_ref`, `display_ref`,
  `commission_amount`, `conversion_fired_at`, click-ids, UTM, split customer name, billing fields). **Building
  this architecture depends first on the E.8 booking schema and the payments/webhook layer.**
- **Tracking stack:** GTM, Google Ads, GA4, Meta Pixel plus server-side Meta CAPI.

#### D.23.7 Separation invariant

- **Settlement is separate from conversion tracking.** Regardless of payment model, **exactly one
  `booking_complete` fires with `booking_value = commission_amount` in EUR (never GMV)**.
- **The settlements ledger is the money-movement record; the conversion event is the marketing-value record.
  They must never be conflated.**

#### D.23.8 Other page-level tracking events

- Homepage: standard GA4 page view; **destination selection fires `select_content`**.
- Tour cards (every listing surface): `view_item_list`, `select_item`, `add_to_wishlist` — **with list id and index**.
- Related tours: `related_tour_click` with `{source_tour_id, target_tour_id, row: "category"|"destination",
  position: 1-3, is_mobile: boolean}`.
- Search: GA4 `search` fires on **every render** with `results_count`.
- Traveler login: GA4 `login` with `method: booking_ref` on success; **silent failure counter with no PII and
  never the reference itself in the dataLayer**; **lockout fires an ops alert, not an analytics event**.
- Operator portal: **no marketing analytics (no GA4, no pixels) — product telemetry only**, server-side and
  PII-free.

#### D.23.9 Ethical CRO signals (no dark patterns)

- **Transparency is a brand pillar: no fake urgency, no fake scarcity, no badge inflation, no pre-checked
  add-ons.**
- **Paid placement ALWAYS carries the `Sponsored` badge.**
- **The only demand signal is the single sell-out trigger**, driven by real `recent_sellouts` data (see D.15.3).
- **Capacity messaging uses live availability** ("Only N left" in the party selector), **never invented
  countdowns**. Date-level scarcity is rendered **only below 5 spots**, in **muted neutral gray**, with
  **no "Only", no exclamation, no "HURRY"**.
- **CRO counters `booking_count`, `booking_count_today`, `spots_remaining`, `last_booked_at` exist in the model
  but have NO consumer urgency surface in v1.**
- **`Most popular` is editorial/quality-based — organic tour, `review_count ≥ 10`, rating ≥ 4.5, max 1 per
  category — never commission-driven.**
- **No countdown timer or "Only N spots left" badge at widget level** — urgency belongs on the time slot only,
  and only when REAL.
- The **results-counter transparency tooltip** explains ranking and the Sponsored label in one sentence; the
  **sort dropdown never carries the tooltip**.
- **Tier names, commission, and `tier_rank` are never shown to travelers.**
- Search results carry **no paid placements**.
- Collections: **commission never influences curation or order, and no Sponsored badge appears on collection cards.**
- **Search pages are `noindex, follow`** so search URLs never compete for or bloat the index.
- Cookie consent: **Consent Mode v2 with regional defaults — EEA denied by default, US/CA granted** — and a
  **CMP (Cookiebot or Iubenda) selected before the GTM build**. A `manage-cookies` page already exists in the
  legal set.

---

### D.24 Motion, interaction and loading/skeleton policy

- **`prefers-reduced-motion` is respected** — in the login mockup `@media (prefers-reduced-motion: reduce)`
  **kills every animation and transition**; the reduced-motion requirement is implemented, not merely stated.
- **WCAG AA** across all surfaces; visible focus rings (the login forms use `outline:2px solid var(--orange)`,
  `outline-offset:0`, border transparent).
- **Unified loading state pattern — ONE rule for ALL async operations:**
  - `< 200ms` → **no skeleton** (avoid visual flash).
  - `200–1500ms` → **skeleton or spinner appears**.
  - `> 1500ms` → **skeleton + secondary indicator `Loading...`**.
  - `> 5000ms` → **timeout error + retry option**.
- **Applies to:** date picker initial load → **skeleton calendar grid**; date picker month change → **skeleton
  calendar grid**; time-slot fetch after date select → **skeleton chip row beneath the date pill**;
  availability check on Continue tap → **CTA becomes a spinner; the widget greys to 50% opacity**; payment
  processing → **final CTA shows "Processing..." spinner; the widget locks; the trust strip stays visible**;
  country/phone validation → **inline spinner next to the field**.
- **Don'ts:** ❌ **don't show a skeleton for operations under 200ms** — it causes flash and looks broken;
  ❌ **don't use different patterns per surface** — one rule, applied everywhere; ❌ **don't block the entire UI
  for non-critical async** — **only payment processing locks the widget**.
- **Card micro-interactions:** carousel dots always visible; **arrows fade in on card hover only**; carousel
  transition **slide, 300ms ease-out**; **lazy load — only the first image loads immediately**; the wishlist
  heart uses **optimistic UI (fill immediately, revert on API failure)** with **no page navigation on click**.
- **Sticky behaviours:** the nav is sticky; the tour-page booking widget is **in-flow at first, pinned-sticky
  on scroll** with a sticky offset of **global nav height + 16px**, **releasing above the global footer**; the
  Sticky TOC appears only after the user scrolls past the Quick Info badges; hub anchor nav becomes sticky once
  past the hero; the All Tours filter row is **sticky on mobile**; a **mobile sticky bottom CTA bar** appears
  when the in-flow widget scrolls past the viewport.
- **Smooth scroll** with `scroll-margin-top` accounting for TOC height on TOC clicks; "See all reviews"
  smooth-scrolls to the Reviews anchor; hero date selection **auto-scrolls to the tour listings**.
- **The demand card is never animated and not clickable in v1.**
- **Errors are inline and animated in place** — red text on a neutral background, **never a red banner across
  the top of the form**, with focus returning to the first errored field; form errors carry `role="alert"`.
- **`aria-live="polite"`** on the show/hide password toggle and the 2FA resend row; **`aria-describedby`**
  wiring on inputs to their error blocks.

---

### D.25 Affiliate program

> Master §7.3, confirmed June 10, 2026. (Carried in from `frag-architecture-b.md` §8 for brief item 13.)

- **Rate: 8% of GMV** (total tour price), **funded entirely out of Island Tours' commission take — not added on
  top**.
- **Worked example:** a **$240** booking at the **25%** tier yields **$60** commission; **the affiliate earns
  $19.20, Island Tours nets $40.80**.
- **Platform: Trackdesk (primary)** — chosen for **server-side postback, dynamic commission amounts, an
  on-hold→approved lifecycle, the widest payout rails, and scriptless GDPR-compliant tracking**.
  - **Tapfiliate** = mature alternative; **FirstPromoter** = middle option.
  - **Stripe-native tools (PromoteKit, Rewardful, Tolt) are structurally incompatible** — they calculate off the
    ~20% Stripe charge, **not the full tour price**.
- **Attribution is owned by the platform's own backend** via the **`booking_complete`** event. **Promo codes
  double as attribution identifiers** in the booking widget. **The platform purchase buys the partner portal,
  payout rails, and fraud detection — NOT the attribution itself.**
- **Lifecycle:** commission goes **on hold at booking** and **approves after the cancellation window closes**
  (**clawback-safe**) — mapped to the per-tour cancellation window. **Payouts in USD and EUR.**
- **Partner types:** influencers/creators, accommodation owners, travel agents/concierges, local businesses.
  **Terms transparent; no dark patterns.**
- The booking schema carries an **`affiliateId` (Trackdesk)** column alongside the click-id and UTM columns.
- The affiliate on-hold-then-approve lifecycle is the same clawback-safe pattern the `paid_in_full` scheduled
  payout follows (payout released **after the cancellation window closes / tour completion**).

---

## E. Roles & Access, Dashboard, Operations, Infrastructure & OCTO

> Sources: `frag-crosscutting.md` (ROLES-AND-ACCESS-MANAGEMENT, STAFF-AND-TEAMS, DEPLOYMENT,
> VPS-DEPLOYMENT-STEPS, VPS-OPERATIONS-GUIDE, HOMEPAGE-AND-PAGES, CUSTOMER-ACCOUNTS, all OCTO docs),
> `frag-dashboard-spec.md` (dashboard-extraction 00/01/02/02B/02C/02D/03/04/05/06),
> `frag-impl-misc.md` (DASHBOARD-ANALYTICS, STRIPE-PAYMENTS-SETUP),
> `frag-architecture.md` (ARCHITECTURE-OVERVIEW, EVENT-DRIVEN-AND-QUEUES).

---

### E.1 Roles, permissions, guards & rate limits

#### E.1.1 The role set — six modeled, three launch-active

- Six roles are modeled: `USER`, `TOUR_OPERATOR`, `ADMIN`, `EDITOR`, `STAFF`, `GUIDE`.
- **Active at launch: `USER`, `TOUR_OPERATOR`, `ADMIN`.** `EDITOR` / `STAFF` / `GUIDE` are modeled for future use and are **not launch-active**.
- **`USER`** — created **automatically on first booking**. Capabilities: browse, book, review, wishlist; plus a customer dashboard at `/account` exposing OWN bookings + payments (`VIEW_BOOKINGS` / `VIEW_PAYMENTS`, **self-scoped server-side**), profile, and cancellation requests.
- **`TOUR_OPERATOR`** — created by **self-registration with email verification** (per ROLES-AND-ACCESS-MANAGEMENT). Capabilities: create/manage own tours, pick a commission tier, manage availability, view own bookings, request Destination Spotlight.
- ⚠️ CONFLICT — operator creation path: `ROLES-AND-ACCESS-MANAGEMENT.md` and `ARCHITECTURE-OVERVIEW.md` §4 say **self-registration (email verify)**; the project `CLAUDE.md` says **admin-invited (set-password email)**. Recorded as-is; **the master arbitrates.**
- **`ADMIN`** — created by **database seed only** (email + password). Full platform management: destinations, categories, hubs, collections, attributes dictionary, operator approval, Destination Spotlight approval, force-majeure pardons, settings.
- **`EDITOR`** — admin-created (designed, not launch-active): content management; **no** system config, user management, or commercial approvals.
- **`STAFF`** — admin-created (designed, not launch-active): operational support; read-only content, manage inquiries.
- **`GUIDE`** — admin-created (designed, not launch-active): read-only (tours, bookings, reviews).
- **Inheritance:** operators inherit **all `USER` capabilities**; admins inherit **all `USER` + `TOUR_OPERATOR` capabilities**.

#### E.1.2 Hard rules on roles

- **ADMIN is a strict superset.** `ROLE_PERMISSIONS[ADMIN]` must include every permission granted to any lower role. **Re-check whenever the `Permission` enum is extended.**
- **Roles are set server-side only.** Role changes happen only through endpoints guarded by `@Roles(Role.ADMIN)`. **The frontend never sends a `role` field.**
- **RBAC stays in sync:** `backend/src/config/roles.config.ts` is the source of truth; the frontend/dashboard `lib/config/rbac.ts` mirror **must match exactly**.
- **Better Auth lives on the NestJS backend only** — the frontend never runs `betterAuth()`.
- `AuthGuard` reads **`better-auth.session_token`** (cookie **or Bearer**), calls `getSession()`, and attaches `{ user, session }` to the request.
- **CORS must use `credentials: true`** via `parseCorsOrigins()` in **both** `main.ts` and `auth.instance.ts`.
- Use **`AuthenticatedRequest` / `TypedAuthUser`** for typed access — never inline casts.
- **Tour ownership uses `operator.id`, not `user.id`.** `trips.operatorId` is an FK to `operators.id`; the service resolves `user.id` → `operator.id` via `resolveOperatorId` before any write or ownership check. **Admins bypass the ownership check** and are **auto-provisioned an operator record on first tour create**.
- `disableSignUp: true` is in force on Better Auth.

#### E.1.3 Guard execution order — do not reorder

```
ThrottlerGuard   → rate limits before any DB work
AuthGuard        → validates session cookie/Bearer; populates request.user
RolesGuard       → checks @Roles() metadata
PermissionsGuard → checks @RequirePermissions() metadata
```

- **Use `@RequirePermissions()` on endpoints, not `@Roles()` on individual routes.** (Verified: there is **no live `@Roles()` usage anywhere** in the API.)
- `ThrottlerGuard` is global and registered in `backend/src/auth/auth.module.ts`.
- `PermissionsGuard` is now **`async`**, injects `StaffPermissionsService`, and checks required permissions against the caller's **EFFECTIVE** set; a miss returns `403 Missing permissions: X, Y`. Routes without `@RequirePermissions` pass untouched.
- `AuthGuard` calls `getSession` with **`query: { disableCookieCache: true }`** — Better Auth's cookie cache would otherwise serve a signed snapshot for **up to 5 minutes** and keep a **revoked session alive** that long after suspension.
- `AuthGuard` rejects any session whose user is **`SUSPENDED` or `DELETED` with 401** — this **covers bearer tokens too**.

#### E.1.4 The permission key list

Per-module map (create / edit / delete-or-manage):

| Module | Create | Edit | Delete / Manage |
|---|---|---|---|
| Destinations | `CREATE_DESTINATION` | `EDIT_DESTINATION` | `DELETE_DESTINATION` |
| Categories | `CREATE_CATEGORY` | `EDIT_CATEGORY` | `DELETE_CATEGORY` |
| Hubs | `MANAGE_HUBS` | `MANAGE_HUBS` | `MANAGE_HUBS` |
| Collections | `CREATE_COLLECTION` | `EDIT_COLLECTION` | `DELETE_COLLECTION` |
| Tours | `CREATE_TRIP` | `EDIT_TRIP` | `DELETE_TRIP` / `MANAGE_TRIPS` (admin) |
| Attributes dictionary | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` |
| Availability | `EDIT_TRIP` (own) | `EDIT_TRIP` | `MANAGE_TRIPS` (admin override) |
| Bookings | — | — | `VIEW_BOOKINGS` / `MANAGE_BOOKINGS` |
| Reviews | (traveler, booking-gated) | operator response | `MODERATE_REVIEWS` (admin) |
| Operators | `CREATE_OPERATOR` | `EDIT_OPERATOR_PROFILE` | `MANAGE_OPERATORS` |
| Settings | — | `MANAGE_SETTINGS` | `MANAGE_SETTINGS` |
| Users | — | — | `MANAGE_USERS` |
| Media | `UPLOAD_MEDIA` | — | `MANAGE_MEDIA` |

Additional permission keys named across the doc set: `MANAGE_STAFF`, `MANAGE_TEAM`, `VIEW_PERMISSIONS`, `VIEW_PROFILE`, `EDIT_PROFILE`, `VIEW_USERS`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `MANAGE_OPERATOR_PAYMENTS`, `MANAGE_EDITORIAL`, `VIEW_PAYMENTS`, `VIEW_TRIPS`, `VIEW_REVIEWS`, `EDIT_REVIEW`, `DELETE_REVIEW`, `APPROVE_REVIEW`, `MANAGE_AVAILABILITY`, `MANAGE_BOOKINGS`, `MANAGE_PAYMENTS`, `MANAGE_TIERS`, `APPROVE_SPOTLIGHT`, `VIEW_ANALYTICS`, `EDIT_BOOKING`. Vestigial in the dashboard mirror only: `VIEW_ENQUIRIES`, `VIEW_LEADS`.

- **Removed (slot economy):** `MANAGE_SLOTS`, `VIEW_SLOT_ANALYTICS`.
- **ADMIN holds 81 permissions** (verified live after the 2026-07-19 ceiling changes).
- `ROLE_PERMISSIONS[USER]` was extended (2026-07-20) with **`VIEW_BOOKINGS` + `VIEW_PAYMENTS`**; verified blast radius is exactly `GET /bookings`, `GET /bookings/:id`, `GET /payments`, all self-scoped.
- `Role.USER` also carries legacy **`VIEW_TRIPS`** — which is why customer navigation must never be derived by permission-filtering the operator nav.

#### E.1.5 Commercial permissions (master §7)

- **Operator self-service tier selection:** an operator picks their own commission tier in the dashboard, subject to eligibility validation and the **30-day tier lock**. **No special permission beyond owning the tour** — enforced in the service.
- **Spotlight approval (admin):** Destination Spotlight is request → admin approve, **max 3 per destination**. Permission: `MANAGE_OPERATORS` / `MANAGE_SYSTEM` (admin-only).
- **Force-majeure pardons (admin):** exclude operator cancellations within a date range + destination from the eligibility cancellation metric. Permission: `MANAGE_SYSTEM`.
- **`is_locals_favourite`** is an editorial flag: **admin-only, never operator-set, never tier-linked**, gated on `MANAGE_EDITORIAL`.

#### E.1.6 Rate limiting — built and active

- `@nestjs/throttler` with a **global `ThrottlerGuard`**, running **first in the guard chain, before auth**.
- Current per-client-IP tiers:
  - `{ name: 'short',  ttl: 1_000,     limit: 60   }` — 60 req/sec burst, sized for an authed dashboard page's parallel fan-out.
  - `{ name: 'medium', ttl: 60_000,    limit: 300  }` — 300 req/min sustained.
  - `{ name: 'long',   ttl: 3_600_000, limit: 3000 }` — 3000 req/hr hard cap.
- ⚠️ CONFLICT — burst tier: `ARCHITECTURE-OVERVIEW.md` §2 and project `CLAUDE.md` state the three tiers as **20/s · 300/min · 3000/hr**; `VPS-OPERATIONS-GUIDE.md` (code-read) states **60/s · 300/min · 3000/hr**. The operations guide reflects the code as measured.
- **Trusted-origin bypass:** `skipIf: isTrustedInternalOrigin`. The SSR/build server sends **`x-internal-api-key` matching `INTERNAL_API_SECRET`**, so Vercel prerender bursts are not throttled; everyone else is limited.
- **`INTERNAL_API_SECRET` is REQUIRED in production** (both apps, **min 32 chars**) — the env validator **fails to boot** if it is unset in prod, not merely warns.
- **Real client IP:** `main.ts` sets **`trust proxy = 1`** and the nginx conf forwards `X-Real-IP` / `X-Forwarded-For`.
- ⚠️ Tripwire: `trust proxy = 1` assumes **EXACTLY ONE proxy hop (nginx)**. Adding a CDN/LB in front makes it two hops — **`trust proxy` must be bumped to `2`** (or nginx `real_ip` with the CDN header). Left at `1`, clients can spoof `X-Forwarded-For` to evade the per-IP limit or poison a victim's bucket.
- **Auth brute-force is handled separately** by Better Auth's own per-path limiter (`auth.instance.ts` → `rateLimit.customRules`, **5/min on sign-in / forget / reset**). The internal-key bypass does **not** touch this layer, and `/api/auth/*` is `@SkipThrottle()`'d from the NestJS guard — **login limits are governed solely by Better Auth**.
- Tuning: global limits → the `throttlers` array in `auth.module.ts`; per-route → `@Throttle({ short: { limit: 5, ttl: 60_000 } })`; skip → `@SkipThrottle()` (**already on `/health` and Stripe webhooks**).
- **Webhook endpoints bypass AuthGuard and ThrottlerGuard** (`@Public()` + `@SkipThrottle()`).
- **Distributed rate limiting:** the default throttler stores counters **in memory**. With multiple replicas each has its own counter (effective limits multiply). Sharing requires `@nest-lab/throttler-storage-redis` (or community Redis storage) against the existing Redis.
- Human-pace throttles exist on the resend-invite endpoints: **1/10s, 3/min, 10/hr**.
- A shared `TargetRateLimiter` (`src/common/rate-limit.module.ts`) backs per-bucket application limits (`customer-welcome` 1/24h, resend, recover, cancel-request, settle). **Retention is per-bucket (`maxWindowByBucket`)** and **`MAX_TRACKED_KEYS` enforces least-recently-touched eviction**, so a high-cardinality bucket cannot grow the map without limit or crowd out a security-critical bucket.

---

### E.2 Staff & Teams (built 2026-07-19)

#### E.2.1 The problem and the unifying decision

- Staff are needed on **two sides**: admins hire **platform staff** (support agents, content editors, operations managers); tour operators hire **their own team** (reservations desk, deck crew, managers) scoped to that one operator.
- **Each person gets their own login** (email + password on the existing Better Auth door) — **no shared accounts** — and access is controlled **individually**: a reusable **Designation** template plus per-person grant/revoke overrides.
- The login doc specified an `operator_users` seats table for the operator side only; the implementation **unifies both sides into ONE model**, where a single column decides the world a row belongs to:

| `staff_members.operatorId` | Meaning | Platform `Role` |
|---|---|---|
| `NULL` | Platform (admin-side) staff | `STAFF` |
| set (FK to `operators.id`) | Operator team seat | `TOUR_OPERATOR` |

- One table, one service, one permission engine, one dashboard page — **the scope column does the branching**. The login doc's E.11 shape (seatRole, status, invitedBy, lastLoginAt) is preserved inside it.

#### E.2.2 Data layer

- **Where:** `backend/prisma/staff.prisma` + `backend/prisma/enums.prisma`; migration `backend/prisma/migrations/20260719180644_staff_and_designations/migration.sql`.
- **`enum StaffSeatRole { OWNER MANAGER STAFF }`** — intra-operator seat role. **MANAGER/STAFF is an ORGANIZATIONAL LABEL in v1** with **no permission semantics**; access comes only from designation/overrides, and the UI copy says so. **OWNER is created only by operator create/backfill, never via the API.**
- **`enum StaffStatus { INVITED ACTIVE SUSPENDED }`**.
- **Two new `Permission` values:**
  - **`MANAGE_STAFF`** — manage platform staff + platform designations. **ADMIN only**, and deliberately **outside every grant ceiling** (self-escalation guard).
  - **`MANAGE_TEAM`** — manage an operator's own team. In the `TOUR_OPERATOR` role set and ADMIN's; **outside the seat ceiling**, so non-owner seats can never be granted it (**seat management is owner-only**).
- **`StaffDesignation`** (the permission template): `id · operatorId (NULL = platform) · name · description · permissions Permission[] · isSystem · createdById · timestamps`, `@@unique([operatorId, name])`, `@@index([operatorId])`.
- **Postgres NULL gotcha, handled:** `@@unique([operatorId, name])` does **not** deduplicate rows where `operatorId IS NULL`. Platform-scope name uniqueness is enforced **in the service** (case-insensitive `findFirst` → **409**), with the DB constraint covering the operator scope and a **`P2002` catch as the race fallback**.
- **`StaffMember`** (the person): `id · userId (unique — one seat per account) · operatorId · seatRole (default STAFF) · designationId (SetNull on designation delete) · extraPermissions Permission[] · revokedPermissions Permission[] · status (default INVITED) · invitedById · invitedAt · activatedAt · lastLoginAt · timestamps`; relations `user (Cascade)`, `operator (Cascade)`, `designation`, `invitedBy`; indexes on `operatorId`, `status`, `designationId`.
- **Migration side-effects beyond DDL:**
  - **Backfill** — every existing operator's login user became the **`ACTIVE OWNER` seat of its own team (7 rows)**; **admin-owned auto-provisioned operator records were excluded** (ADMIN accounts are never staff-managed). Going forward `OperatorsService.create` writes the OWNER seat for every new operator.
  - **Seeded 3 platform system designations (`isSystem = true`)**: *Operations Manager* (bookings/payments/review moderation/analytics — **16 permissions**), *Content Editor* (catalog + editorial + media — **18 permissions**), *Support Agent* (read-mostly support — **13 permissions**). **None reference enum values added in the same migration** (Postgres forbids using a new enum value inside the transaction that added it).
- `User` gained `staffMember StaffMember?` + `staffInvitesSent`; `Operator` gained `staffMembers` + `staffDesignations`.

#### E.2.3 The effective-permission engine

- **Where:** policy in `backend/src/config/staff.config.ts`; runtime in `backend/src/staff/staff-permissions.service.ts`, provided by the **`@Global` `staff-permissions.module.ts`**.
- **The formula** — one pure function `computeEffectivePermissions(parts)`:

```
(designation.permissions ∪ extraPermissions) − revokedPermissions
        ∩ CEILING (per scope)
        ∪ FLOOR
```

- **Designation** = the baseline; **extraPermissions** = individual grants on top; **revokedPermissions** = individual removals from the template.
- **CEILING** = what may be granted at all, per scope. **Applied at COMPUTE time, not only at write time** — even a tampered DB row cannot re-grant an out-of-ceiling permission.
- **FLOOR** = `VIEW_PROFILE` + `EDIT_PROFILE`, always present for a non-suspended member, and **not revocable**.
- **OWNER seats** (and the `Operator.userId` account itself) return the **full `TOUR_OPERATOR` role set**; owners are not permission-managed and **`revokedPermissions` on an owner row is ignored**.
- **SUSPENDED members return the empty set.**
- **`PLATFORM_STAFF_CEILING` = `ROLE_PERMISSIONS[ADMIN]` minus:**
  - `MANAGE_SYSTEM` (system administration stays with real ADMIN accounts)
  - `MANAGE_STAFF` (staff must never manage staff — self-escalation)
  - `MANAGE_TEAM` (operator-side concern)
  - `MANAGE_USERS`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER` (identity mutations are an escalation surface: a role flip hands out an un-ceilinged static permission set; an email change redirects password resets. **`VIEW_USERS` stays grantable.**)
  - `MANAGE_OPERATOR_PAYMENTS` (owner-only downstream — listing it would offer a permission that always 403s)
- **`OPERATOR_SEAT_CEILING` = `ROLE_PERMISSIONS[TOUR_OPERATOR]` minus:** `MANAGE_TEAM` (seat management is owner-only) and `MANAGE_OPERATOR_PAYMENTS` (payout/bank config is owner-only).
- **Fallback rules (no staff row present):**
  - `TOUR_OPERATOR` with no staff row → **full role set** (the operator account itself / legacy).
  - **`STAFF` with no staff row → the FLOOR only** — never the legacy static STAFF list from `roles.config.ts`. Otherwise anyone able to flip a user's role to STAFF would mint a broad-powered account. **Power comes ONLY from an explicit designation/grant.**
  - Every other role (ADMIN, EDITOR, GUIDE, USER) → its static `ROLE_PERMISSIONS` set, **with zero DB cost** (short-circuit before any query).
- **Runtime + cache** — `StaffPermissionsService.getEffectivePermissions({id, role})`: non-staff-manageable roles short-circuit; otherwise **one small `staff_members` read** (designation permissions included) feeds the pure function; the result is cached **in-process for 60 seconds per userId**. Every staff mutation calls `invalidate(userId)`; **designation permission edits call `invalidateAll()`**. Service and guard share **ONE instance** (the module is `@Global`; providing it elsewhere would fork the cache), so changes apply on the very next request.
- `hasPermissions(user, required)` returns `{granted, missing}` for the guard's error message.
- **Why one pure function matters:** the guard path AND the API responses (`effectivePermissions` echoed on every member object) both call `computeEffectivePermissions`, so **display and enforcement can never drift**.
- **Known limit (accepted, documented):** the cache is **per-process**. Correct on the current single-VPS deployment; **before the backend ever runs multi-instance, invalidation must move to a shared store (Redis pub/sub or key check)**. Suspension is unaffected (it also deletes sessions and is re-checked live by AuthGuard).

#### E.2.4 Service-level scoping

- **`resolveOperatorId`** (`src/common/utils/operator.util.ts`) is the shared util used by tours, availability, bookings, payments, reviews, tiers, notifications; `tours.service.ts`'s private copy delegates to it. Resolution order:
  1. `Operator.userId` direct match → the owner account.
  2. **NEW:** an **ACTIVE (non-suspended)** `staff_members` seat → that seat's `operatorId`.
  3. An **ADMIN** with neither gets an operator record **auto-provisioned**.
  4. Anyone else → **400** "complete your operator registration".
- The two layers on any request: **permission** answers "may this person do this kind of thing at all" (guard); **scoping** answers "on whose data" (service). Independent, both server-side.
- **Owner-only vs member-level operator resources** (`operators.service.ts`):
  - **`assertOwnerOrAdmin`** — **payout config** (Stripe/Mollie get/update). **Team seats, even managers, never pass.**
  - **`assertMemberOrAdmin`** (new) — profile-level resources (operator detail, company info, social media). Passes owner, admin, or an **ACTIVE seat of that same operator**. **A seat without the profile permissions still gets 403 — both layers must pass.**

#### E.2.5 The API surface (22 endpoints)

- **Where:** `backend/src/staff/` following the standard module pattern; registered in `AppModule` with the `@Global` `StaffPermissionsModule`. **Every static segment (`permission-catalog`, `designations`, `team`, `invite`) is declared BEFORE the dynamic `:id` routes.** Base URL `http://localhost:5050/api/v1`.
- **Shared:** `GET /staff/permission-catalog?scope=platform|team` (`VIEW_PERMISSIONS`) — grouped, human-labeled catalog **already intersected with the requested scope's ceiling**, plus the flat `ceiling` and the `base` floor. Feeds the matrix UI, so it **physically cannot offer an ungrantable permission**.
- **Platform staff (admin) — all `@RequirePermissions(MANAGE_STAFF)`:**
  - `GET /staff` — paginated members list (search name/email; status + designation filters)
  - `POST /staff/invite` — provision + invite (email, name, designationId?, extraPermissions?)
  - `GET /staff/:id` — one member incl. `effectivePermissions`
  - `PATCH /staff/:id` — designation (nullable to clear) + extra/revoked overrides
  - `PATCH /staff/:id/status` — ACTIVE ⇄ SUSPENDED; **INVITED is never settable manually**
  - `POST /staff/:id/resend-invite` — INVITED only; throttled **1/10s, 3/min, 10/hr**
  - `DELETE /staff/:id` — remove member + their login account
  - `GET/POST /staff/designations`, `PATCH/DELETE /staff/designations/:id` — platform designation CRUD
- **Operator team — all `@RequirePermissions(MANAGE_TEAM)` (owners + admins):** the same shapes under `/staff/team[...]` and `/staff/team/designations[...]`. **Owners are auto-resolved to their own operator; admins must pass an explicit `operatorId`** (body on POST/PATCH, query on GET/DELETE/resend). `resolveTeamOperatorId` throws **400** for an admin without it, **403** for an owner passing a foreign one, and **404** pins every `:id` to the resolved operator — **no cross-tenant reads or writes**.
- **Team-only:** invites create `TOUR_OPERATOR`-role users with `seatRole` **MANAGER | STAFF** (default STAFF, label only). **OWNER can never be created, edited, suspended or removed through this API** — the owner is managed via the operators module.
- **Service rules enforced on every mutation:**
  - **`assertWithinCeiling`** rejects out-of-ceiling permission arrays with a **400 naming the offenders** (defense-in-depth on top of compute-time capping).
  - **Designations:** platform-name dedup in service + DB unique for operator scope; **`isSystem` rows reject rename/delete (403) but allow permission edits**; **delete while `memberCount > 0` is 409**; a designation reference must belong to the same scope (**400** otherwise).
  - **Self-protection:** you **cannot suspend or remove your own account** (400).
  - **Every mutating action writes a `Logger` line with the actor id.**
- **Hardened alongside:** `GET /bookings` and `GET /bookings/:id` were **auth-only**; both now require **`VIEW_BOOKINGS`**, and **`isPlatformWideBookingRole()` (ADMIN/STAFF/EDITOR — one helper used by both `list` and `assertCanView`)** grants platform-wide read; operators stay operator-scoped.

#### E.2.6 Seat lifecycle — invite → accept → activate → remove

- **Invite:**
  1. Admin/owner submits → `POST /staff/invite` or `POST /staff/team/invite`.
  2. **`provisionInvitedAccount`** (`src/common/utils/invite-provisioning.util.ts` — **ONE shared implementation** used by operator creation, platform staff and team invites): normalizes the email (lowercase/trim), **409 if a user exists**; creates the auth user with the correct role (`STAFF` or `TOUR_OPERATOR`) and **`emailVerified: true`** (admin/owner-vouched; ownership re-proven by the invite link); links a **throwaway credential** — **24 random bytes, hashed, never displayed or transmitted** — so the reset flow has a credential account to overwrite; **rolls back the user if the credential link fails.** Better Auth's `user.create.before` `allowedRoles` was extended with `Role.STAFF`; **ADMIN creation stays blocked at runtime.**
  3. The `staff_members` row is created: scope, seatRole, status **`INVITED`**, designation + extraPermissions (ceiling-validated), **`invitedById` for audit**.
  4. **Invite email (dynamic per audience):** the service calls `auth.api.requestPasswordReset({ email, redirectTo: getPortalUrl() + '/reset' })`. The `sendResetPassword` hook sees no originating HTTP request → server-initiated → and because **every invite flow creates the `staff_members` row BEFORE firing the reset**, it looks the row up and picks the copy: `operatorId` NULL → **platform staff invite** (`staff-invite.template.ts`, variant `platform`); `operatorId` set with MANAGER/STAFF → **team-seat invite** (variant `team`); **OWNER seat or no staff row** → the original **operator-invite template**. Subjects are dynamic the same way; **all interpolations are HTML-escaped**; resend goes through the same hook. **Fire-and-forget with `.catch` logging — a mail-provider outage cannot fail the invite API.**
  5. **Any failure after user creation rolls back via `internalAdapter.deleteUser`** — no orphans.
- **Accept:** the invitee lands on the **surface-matched reset screen** — platform staff on **`/staff/reset`**, team seats and operators on **`/portal/reset`** (`StaffService.resetRedirectFor(operatorId)`; the staff base URL is derived from **`PORTAL_URL`** by swapping the `/portal` segment via `getStaffUrl()`, so **one env var still configures the app**). Password **min 12 chars**; `revokeSessionsOnPasswordReset` applies. They sign in at their door — **`/staff` for platform staff, `/portal` for seats/operators**. Both doors hit the same Better Auth backend; **the separation is surface branding + noindex, never a security control.**
- **Activate:** on successful sign-in the Better Auth **`databaseHooks.session.create.after`** hook stamps **`lastLoginAt = now`** and flips **`INVITED → ACTIVE`** (+ `activatedAt`) via two `updateMany` calls (no-ops for non-staff users), **wrapped in try/catch so bookkeeping can never break a login**. The dashboard layout then renders exactly the nav and actions their grants cover.
- **Remove:** deletes the login account (`internalAdapter.deleteUser` — sessions and staff row cascade), then **invalidates the permission cache**. **OWNER seats are refused (403).**
- **Operator deletion** now also deletes its team-seat user accounts (they are `TOUR_OPERATOR` users who would otherwise linger with live sessions and no operator), then the owner user.

#### E.2.7 Suspension enforcement

- `PATCH .../:id/status { SUSPENDED }` does four things: (1) `staff_members.status = SUSPENDED` (engine computes the **empty set**); (2) `user.status = SUSPENDED`; (3) **`session.deleteMany`** — every live session dies; (4) permission-cache **`invalidate(userId)`**.
- **Three independent locks then hold:**
  - **Existing sessions** die instantly — AuthGuard checks the **session STORE** (`disableCookieCache`) and the sessions are gone. (Live smoke found the cookie cache keeping a deleted session alive **≤5 min** — exactly why the flag exists.)
  - **Re-login** is refused by the **`databaseHooks.session.create.before`** hook with `APIError('FORBIDDEN', 'This account has been suspended.')` — a clean **403**, and **safe to name the reason because the hook only runs AFTER the password verified** (no enumeration).
  - **Belt-and-suspenders:** even with a session, **AuthGuard 401s SUSPENDED/DELETED users**, and a suspended member's effective set is empty.
- **Reactivation (`ACTIVE`)** restores `user.status` and the staff row, **stamps `activatedAt` if they had never logged in**, and invalidates the cache.
- **Unified with the users module:** `PATCH /users/:id/status` and the `status` field of `PATCH /users/:id` previously flipped **only `user.status`**. `user.service.ts` now runs the same **`syncStatusSideEffects`** (session kill + staff-row mirror + cache invalidation) so **the two suspension paths cannot drift**.

#### E.2.8 Live-proven data scoping

| Check | Result |
|---|---|
| Invited platform staff with "Operations Manager" | `effectivePermissions` = **16** (template + floor) |
| Staff `GET /bookings` with `VIEW_BOOKINGS` granted | **200**, platform-wide (**total 254**) |
| Same staff, `VIEW_BOOKINGS` revoked via override | **403** on the very next request |
| Staff `GET /staff` (MANAGE_STAFF gated) | **403** always (outside ceiling) |
| Owner invites seat with `MANAGE_OPERATOR_PAYMENTS` | **400** naming the permission |
| Seat (VIEW_BOOKINGS granted) `GET /bookings` | **200**, **operator-scoped: 70 rows** (identical to the owner's view, not the platform's 254) |
| Seat `GET /staff/team` | **403** (MANAGE_TEAM outside seat ceiling) |
| Seat `GET /operators/:id/stripe-config` | **403** (owner-only gate) |
| Seat `GET /operators/:id/company-info` w/o profile permission | **403** (fine-grained layer) |
| Admin `GET /staff/team` without `operatorId` | **400** |
| Suspend → existing session · re-login | **401** instantly · **403** |
| INVITED → first login | status **ACTIVE**, `activatedAt` + `lastLoginAt` stamped |

#### E.2.9 The `/team` page (shipped as `/users`)

- Effective permissions reach the UI: `app/_actions/userActions.ts` `getUserProfile` fetches **`GET /users/me/permissions`** in the same `Promise.all` as the session + `/users/me`. **On a transient failure it stays `undefined` (never cached wrong).** `app/(app)/layout.tsx` passes it to `DashboardShell` → `RoleProvider` → **`useRole()` exposes `{ role, permissions, can, canAny }`**.
- **Consequence:** every pre-existing `useRole().can()` gate and the sidebar's `filterNavGroups` **automatically honor fine-grained staff grants, with zero changes to those components**.
- **Fallback rule:** on fetch failure **ADMIN/operator fall back to the static `lib/config/rbac.ts` mirror**; a **STAFF user falls back to the profile-only floor** (RoleProvider) / **empty nav** (app-sidebar) — never the broad legacy static STAFF list. **The client set is cosmetic; the backend guards enforce regardless.**
- **The route is `/users`, labeled "Users"** (owner decision) — it replaced the old placeholder stub; **the short-lived `/team` route was removed**. `navigations.ts` adds **Users** (UserGroupIcon, Account group) gated by **`[MANAGE_STAFF, MANAGE_TEAM]` (any-of)**. Non-owner seats hold neither, so the item never renders; `components/staff/team-view.tsx` **re-checks as the belt for hand-typed URLs**.
- **Role branch:** `ADMIN` + `can(MANAGE_STAFF)` → **platform scope**; otherwise `can(MANAGE_TEAM)` → **team scope**. Both render the same two tabs (Members / Designations).
- **Components (`components/staff/`):** `team-view.tsx` (scope branch + tabs) · `staff-members-tab.tsx` (`useTableState` URL-synced page/limit/search/status + `useStaffMembers` + `DataTable` + invite button) · `staff-columns.tsx` (member, designation — Owner label / name / "Custom permissions", seat, permission count, `STAFF_MEMBER_STATUS` badge **INVITED=info, ACTIVE=success, SUSPENDED=danger**, last login, actions) · `staff-row-actions.tsx` (Edit access · Resend invite (INVITED only) · Suspend/Reactivate · Remove via shared `ForceDeleteDialog`; **OWNER rows render no actions at all**) · `staff-invite-dialog.tsx` (RHF+zod name/email, seat-role select with honest descriptions, designation select — **deliberately minimal**) · `staff-member-sheet.tsx` ("Edit access": designation + seat-role + the matrix showing the **would-be effective set**; picking a designation resets the matrix; **manual ticks save as diffs: `extra = checked − template`, `revoked = template − checked`** — the exact mirror of the backend formula) · `designations-tab.tsx` (cards, create/edit/delete, **delete disabled while in use**) · `designation-dialog.tsx` (**System designations lock name/description but allow permission edits**) · `permission-matrix.tsx` (grouped checkbox matrix from the catalog endpoint; per-group tri-state select-all, counts, **locked floor permissions rendered checked + disabled**; ceiling-intersected server-side so **the UI cannot offer an ungrantable permission**).
- **Data layer:** `types/staff.ts` mirrors `staff.dto.ts`; `lib/api/staff.ts` has one client where **`base(scope)` picks `/staff` vs `/staff/team`**; **`operatorId` placement matches the backend on all 12 endpoints**; `hooks/staff/use-staff.ts` is a TanStack Query key factory (`staffKeys`) with `keepPreviousData`, toast-in-hook, and **designation edits invalidating everything**.
- **The staff login surface (`/staff/*`)** has its **own three screens, never shared with the operator portal**: `app/(login)/staff/layout.tsx` is a **dark, near-monochrome takeover shell** (logo + "STAFF ACCESS" chip + "Island Tours staff only. Every sign-in and action is logged."), persisting across `/staff`, `/staff/forgot`, `/staff/reset` with **MountReveal keyed by pathname**. Form/card logic is shared, not duplicated: `AuthForm` takes a `variant` prop (`'staff'` pins the `/staff/forgot` link, monochrome `staffBtn`, staff placeholder); `forgot-card.tsx` / `reset-card.tsx` hold the **enumeration-proof** state machines once.
- **Environment variables — NONE ADDED.** The module rides `DATABASE_URL`, `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET`, `RESEND_API_KEY` + `MAIL_FROM` (**without a key the invite API still succeeds — the send fails loudly in logs**), and `PORTAL_URL` (**default `http://localhost:3001/portal`**). **The 3-file env rule was not triggered.**
- **Testing:** **113 new unit tests** across `staff.config.spec.ts`, `staff-permissions.service.spec.ts` (**real 60s TTL with fake timers**), `staff.service.spec.ts`, `permissions.guard.spec.ts`, plus updated `user.service` / `tours.service` specs. **Full suite 55 → 58 suites, 1197 tests, all green**; both repos `tsc --noEmit` clean; `pnpm build` clean. A **live end-to-end curl pass** surfaced the cookie-cache bypass, the permissionless bookings reads, and the 500-on-suspended-login — **none of which unit tests alone would have caught.**
- **Security/code review round (same day, all fixed):** Critical **role-flip escalation** (`MANAGE_USERS` inside the platform ceiling + `PATCH /users/:id/role` only blocking ADMIN assignment) → identity permissions excluded from the ceiling **AND** `updateUserRole` now requires `requester.role === ADMIN`; Critical **IDOR** on `GET /users/:id/permissions` (gated only by `VIEW_PERMISSIONS`, held by every operator) → admin-or-self enforced; Major non-atomic `updateTeamMember` → validate-then-write-once; Major duplicated invite provisioning → extracted; Medium `PATCH /users/:id(/status)` side-effects → `syncStatusSideEffects`; Low permission catalog readable by any authenticated user → `VIEW_PERMISSIONS`; Low resend-invite inbox-bombing → human-pace `@Throttle`; Low `MANAGE_OPERATOR_PAYMENTS` offered but always 403 → removed from the ceiling; Low dashboard over-render for narrow STAFF → floor/empty fallback; Minor duplicated platform-read role list → `isPlatformWideBookingRole()`. **Accepted:** the in-process cache (≤60s multi-instance staleness) with a **documented pre-deployment gate: shared invalidation before scaling out.**
- **Deliberately NOT built (future login-plan phases):** 2FA/TOTP + backup codes (Phase 3), step-up re-auth (Phase 4), Google Workspace SSO for the admin door (Phase 5), subdomain/cookie isolation (Phase 6), a dashboard UI for admins browsing a specific operator's team (**the API supports it via `?operatorId=`**), and **Redis-backed permission-cache invalidation (required before any multi-instance deployment)**.

---

### E.3 The dashboard — every module and page

#### E.3.1 Scale and route inventory (as audited)

| Measure | Count |
|---|---|
| Dashboard route files (`app/(dashboard)/**`) | 42 |
| Dashboard route pages (excl. layout) | 41 across 21 modules |
| Dashboard components (`components/dashboard/**`) | 166 files |
| Total dashboard `.tsx` (routes + components) | 207 |
| Marked `'use client'` | **161 (77.8%)** |
| Dashboard component LOC | ~35,328 |
| `components/ui/` (shadcn) | 35 files, 4,518 LOC |
| Trips module alone | 28 components, 10,363 LOC |

- Base path was `/dashboard/*` with layout `app/(dashboard)/dashboard/layout.tsx` (52 lines); it is now served at **root `/`** in the extracted repo.
- Route inventory by module: **overview** (`page.tsx`) · **trips** (`page.tsx`, `new/`, `[id]/` redirect, `[id]/edit/`) · **destinations**, **hubs**, **categories**, **collections** (same 4-route shape each) · **attributes** (`page.tsx`, `new/`, `[key]/edit/` — keyed by `key`, no detail route) · **tour-operators** (4-route shape) · **bookings** (`page.tsx`) · **payments** (`page.tsx`) · **cancellation-requests** (`page.tsx`, zero components — renders `<BookingsListView cancellationView />`) · **spotlight** · **locals-favourites** · **media** (**the only module with `export const metadata`**) · **settings** · **profile** · **users** (`page.tsx`, `new/page.tsx` — **stub**, static JSX, 8 lines each) · **reviews** (**stub**) · **leads** (**stub**, deleted in Phase 4) · **enquiries** (**stub**, deleted in Phase 4).
- **All five `[id]/page.tsx` are pure `redirect()` shims to `[id]/edit`.**
- **Adjacent surfaces travelling with the dashboard:** `app/(login)/portal` (operator/admin login), `app/(login)/staff` (staff login), `app/onboarding/`, `components/onboarding/`. **Not travelling:** `app/(login)/apply`, `app/(login)/bookings` (traveler-facing). Dead backup dirs: `app/__backup(auth)/`, `components/__backup_auth/`.
- Added by later work: **`/homepage`** (Homepage CMS editor, `Pages` nav group), **`/translations`** (Translation Console, planned Phase 17), **`/account`** customer door + customer `bookings`/`payments`/`profile` views, **`/users`** (Staff & Teams).

#### E.3.2 Information architecture — four groups by task frequency

```
┌─ OPERATE ──────────────── daily
│  Overview
│  Bookings            (badge: needs attention)
│  Cancellations       (badge: pending count)
│  Payments
├─ CATALOG ──────────────── weekly
│  Tours
│  Media
│  Translations        ← NEW
├─ CURATE ──────────────── admin, weekly            [ADMIN]
│  Destinations · Hubs · Categories · Collections
│  Spotlight           (badge: pending approvals)
│  Locals' Favourites
├─ CONFIGURE ────────────── admin, rarely           [ADMIN]
│  Attributes · Tour Operators
│  Users                                            [BLOCKED: A3]
│  Reviews                                          [BLOCKED: A2]
│  Settings
└─ (footer)  Profile · Theme · Sign out
```

- Group by **frequency, not entity type** — an operator opens Bookings every morning and Attributes never.
- **Badges on actionable counts only.** Never a decorative count. **A badge is a promise that something needs a human.**
- **`Translations` is a top-level destination** — the single largest workload, currently smeared across 7 tabs of every entity.
- **`Leads` and `Enquiries` deleted** — stubs; "book instantly — no enquiry model".
- **`Trips` renamed `Tours`** in labels; **routes stay `/trips`** (the rename is DEFERRED).
- As shipped in Phase 14, `navigations.ts` became `NavGroup[]` with **Operate / Catalog / Curate / Configure / Account** — a **5th group** holding Settings + Profile for BOTH roles. `filterNavGroups` filters each group then **drops empty groups** — headers disappear with their contents. A **`Pages` group** (Homepage) was later added **immediately before Account**, gated `MANAGE_EDITORIAL`.
- **`NavItem.items` is TYPED for nesting but `nav-main.tsx` renders exactly one flat level** (`group.items.map`, no recursion) — **a nested child silently disappears from the sidebar.**

#### E.3.3 Admin vs operator — the per-role IA

- **The two roles are different products sharing a chassis.** Today they share one structure and differ only by hidden items, which is why the operator's sidebar has holes.
- **Tour Operator sees nine destinations:** `OPERATE: Overview · Bookings · Cancellations · Payments`; `CATALOG: Tours · Media · Translations`; `ACCOUNT: Settings (Company, Payments) · Profile`. **`CURATE` and `CONFIGURE` do not exist for them — not greyed, absent.**
- **System Admin sees all four groups.**
- **Rule:** an operator must never see a disabled item they can never enable. `filterNavigationByPermissions` already **removes rather than disables** — keep that, and let **group headers disappear with their contents**.
- **Customers (`Role.USER`)** get a **separate `customerNav` array** (My Bookings / Payments / Profile) chosen by `app-sidebar` when `role === 'USER'` — **the permission grant never lights operator nav items.** Root `/` redirects USER → `/bookings`; sign-out sends USER → `/account`; unauthenticated deep links still land on `/portal`.
- **`navGroupsForRole(nav, role, permissions)` in `lib/rbac-utils.ts` is the ONE place the role → nav decision lives**; sidebar and command palette both resolve through it so they cannot drift. `resolvePermissions(role, userPermissions, roleMap)` is shared too (the palette previously used the STATIC role map while the sidebar used backend effective grants, so a narrowed STAFF seat saw palette entries the sidebar hid).
- **`CustomerRouteGuard`** (client leaf in the shell) redirects USER off non-customer routes — single source of truth `['/bookings','/payments','/profile']`.
- **Two gating idioms are mixed throughout** — capability checks `can('X')` and raw `role === 'ADMIN'` equality, **inside the same file** at `destination-row-actions.tsx:134` vs `:146`, and at `bookings-table.tsx:110`. **Target: `can()` only, never `role ===`.**

#### E.3.4 Module-by-module — what each manages and the admin/operator difference

**Overview (`/`)** — S1 for trust, S3 for effort. **The first screen after login is fabricated:** `getDashboardStats()` is a hardcoded literal (`totalRevenue: 125000.50`, `bookings.total: 1240`, `'John Doe'` booking `'Bali Adventure'`, `alice@example.com`), and `statistics.tsx:408`/`:516` force mock chart branches with `|| true ?`. **BLOCKED on backend request A1.** Interim: replace fake data with an honest empty state plus counts from existing endpoints. Target architecture: SERVER page, per-card `<Suspense>`, charts stay client (Recharts), `statistics.tsx` (1,078 LOC) split per card, **delete `dashboardActions.ts`**. Role split when unblocked — **Operator:** today's departures · bookings needing action · tours not listed (and why) · translation completeness · payout summary. **Admin:** platform GMV + commission · bookings by status · spotlight approvals pending · cancellation requests pending · operator activity. **Every card links to the filtered list that produced it. A number nobody can act on is decoration.**

**Tours / Trips (`/trips`, admin + operator)** — the core workflow and its weakest contract (S1). Manages the tour entity and every child collection. **28 components, 10,363 LOC, all 28 `'use client'`.**
- **Editor shell** `trip-edit-view.tsx` (431 LOC): a single flat `<Tabs>` with **13 tabs**, presented as peers, grouped only in source comments; **no tab gated or disabled**. Header carries the status badge, lifecycle buttons (Publish/Pause/Unpause/Archive, gated on `can('MANAGE_TRIPS')`), a warnings banner fed by `onWarnings` from Details, a **"Published, not yet listed"** notice on `LIVE && !isBookable`, and a **5-item Publish Readiness card shown only for DRAFT** (5 images, hero set, 3 highlights, EN overview, price set).
- **The 13 tabs:** Details · Pricing · Schedules · Images · Highlights · Inclusions · Exclusions · Itinerary (locations) · Pickups · Info & Terms (features) · Attributes · Promotion · Translations, plus SEO.
- **Create flow** `trip-form.tsx` (704 LOC): a single long form, one submit, no wizard, no draft-save; ~30 fields of which **4 are truly required** — `name` (≥3), `slug` (auto from name), `destinationId`, `categoryIds` (≥1); conditionally required `basePrice` + `wholeUnitType` when `pricingModel === 'UNIT'`. After create → `router.push('/dashboard/trips/${created.id}/edit')`.
- **Save model per tab:** Details 1 RHF form with **2 buttons** calling the same handler · Details→Guide Languages per-chip immediate · Pricing **3 independent forms** + per-row saves · Schedules 3 sections immediate-per-action · Images immediate per action + dialog save · Highlights/Inclusions/Exclusions/Info add-form + per-row delete + per-locale save · Itinerary/Pickups per-row "Save Details" + 7 per-locale saves · **Attributes — the only true bulk save** · Translations per-locale · SEO per-locale + a separate OG save. **No global save, no autosave.**
- **URL state:** `?tab=` is read once into an uncontrolled `<Tabs defaultValue>` — **not linkable; browser back exits the editor.** Row actions deep-link to **6 of 13 tabs** via `?tab=`.
- **Publish lies twice:** the readiness card is advisory and the **button is always enabled** (the backend rejects); and passing all 5 checks does **not list the tour** — it also needs **schedules + capacity**, revealed only afterward by the "Published, not yet listed" banner — **a 6th requirement the card omits.**
- **Request fan-out:** schedule creation loops `weekdays × startTimes` awaiting one POST per pair (**7×3 = 21 sequential**) · image add = 1 POST per image · **image reorder = 2 PATCHes per arrow click** · start-time add/remove = a full `PATCH /tours/:id` rewriting the `startTimes` array.
- **Child collections:** Images (grid, hover controls, `MediaSelector` dialog, `ImageEditDialog`, up/down arrows, **cap 24**) · Age bands (inline row, chevron-expand, local `useState` per field) · Add-ons (same) · Highlights (inline row + 7-locale `TranslationRow`, **cap 6, "need at least 3"**, numeric `displayOrder`) · Inclusions/Exclusions/Features (same) · Itinerary/Pickups (chevron-expand to RHF + 7 `DualTranslationRow`s) · Schedules (flat rows grouped into **weekday sub-tabs** — Tabs inside Tabs inside Tabs) · Start times (badge chips + HH:MM text input; **in-use times lock their remove control**) · Exceptions (type-driven conditional form, 4 types × `timeMode` matrix, **no edit — create/delete only**) · Attributes (dynamic inputs grouped by category; **derived attributes filtered out**).
- **No drag-and-drop anywhere**, despite `@dnd-kit/*` being a dependency (used only by the dead `data-table.tsx`).
- **Files over 400 lines — 7 of 28 = 4,873 lines = 47% of the module:** `trip-schedules-tab.tsx` 1,165 · `trip-pricing-tab.tsx` 1,095 · `trip-details-tab.tsx` 1,060 · `trip-form.tsx` 704 · `trip-images-tab.tsx` 523 · `trip-locations-tab.tsx` 469 · `trip-edit-view.tsx` 431. **`trip-form.tsx` + `trip-details-tab.tsx` = 1,764 lines maintaining one form twice.**
- **Target redesign:** create collects **4 fields** (name, destination, category, slug auto-derived/editable) and `trip-form.tsx` is **deleted**; 13 tabs → **4 routed phase groups** — `/tours/[id]/setup` (Details · Pricing · Schedules), `/tours/[id]/content` (Images · Highlights · Inclusions · Itinerary · Pickups · Info), `/tours/[id]/reach` (Attributes · Promotion · SEO), `/tours/[id]/translations` (deep-links into the Translation Console). **Routes, not in-page tabs** — fixes URL state, back-button, bookmarking, and gives each group its own server boundary.
- **Gating rule, deliberately soft:** Setup always · Content always · Reach **always, but SEO shows an inline notice** if no EN overview exists · Translations **always, but shows an empty state** if no EN content exists. **Gate with information, not with disabled controls.**
- **The readiness rail (the publish contract):** the DRAFT-only card becomes a **persistent right rail on every tour route** showing Name/destination/category · Price set · 5+ images (5/5) · Hero image · Highlights (2/3) · EN overview — then a separate **"To be LISTED (not just live)"** block: At least one schedule · Capacity set. Three changes: (1) **Publish disabled until checks pass**, naming the blocking item; (2) **listing requirements shown alongside publish requirements**; (3) each unmet item **links to the exact sub-tab that fixes it**. **The backend contract is unchanged** — the client stops offering an action it knows will fail. `readiness-rail.tsx` is a **SERVER component** (pure computation, zero interactivity, zero JS). ⚠️ Risk: **the client readiness rule must be a strict subset of the backend validator** — if it disagrees, an operator is blocked from a legal action; **warn rather than disable if uncertain.** The rail **is** the empty state for a new tour (6 unmet items).
- **One save per route, dirty-tracked** — a sticky-footer primary Save enabled only when dirty (replacing ~20 scattered buttons), an unsaved-changes navigation guard (does not exist today), **child collections stay immediate-per-action** (adding an image *is* the save), and an explicit "Saved" state.
- **Drag-and-drop reorder BLOCKED on A6** (keep arrows — without a bulk endpoint, drag-drop fires N PATCHes per drop, worse than today). **Schedule batching BLOCKED on A5** (keep the loop, add a progress indicator and a **partial-failure summary naming what succeeded**).
- **Click depth today:** publish a new tour **~25-30 clicks across 5 tabs** minimum · change one price 5 (row-action deep link) / 6 without · add a date exception 8-10 · translate the overview into German 5 clicks with **no German source reference on screen**.
- **`trip-promotion-tab.tsx:49`** carries `SHOW_DEMAND_BADGE_OVERRIDE = false` — DemandBadgeCard is dead behind a flag.

**Destinations · Hubs · Categories · Collections (admin only, `CURATE`)** — treated as one family because the audit proves they *are* one: ~90% identical translation forms, ~60% identical SEO tabs, 138-202-line diffs between table scaffolds, 32-line diffs between detail shells.
- **Current tab sets drift for no reason:** destinations `Details, Translations, Page Content, SEO, FAQs` (5) · categories `Details, Sub-categories*, Translations, Page Content, FAQs, SEO` (6, *conditional) · collections `Details, Tours, Translations, Page Content, FAQs, SEO` (6) · **hubs `Details, Allowed Categories, Translations, Our Picks, Comparison, Page Content, FAQs, SEO` (8)**. **Tab ORDER drifts too** (destinations puts SEO before FAQs with a justifying comment; the other three do the opposite).
- Other problems: four forks of one editor (~4,300 LOC near-mechanical duplication); collections diverges arbitrarily (no row-actions, no delete dialog, no quick-edit — its actions live in `collection-columns.tsx`); **three pagination strategies** (collections/attributes/spotlight client-paginated **and with no loading skeleton**); **four delete-confirm abstractions + 4 clone wrappers**; no URL tab state. **An admin who learns Destinations must re-learn Hubs.**
- **Target:** **one canonical editor shape, same tabs, same order, every module** — `Details · Page Content · SEO · FAQs · [module extras] · Translations→console`. **Hubs' 4 extras (Allowed Categories, Our Picks, Comparison, Content Sections) become one "Curation" tab with sections — 8 tabs → 5.** **Routed tabs** (`/destinations/[id]/details`). **One `EntityTable`** (server pagination, one skeleton, one empty state, one bulk bar, `PAGE_SIZE_OPTIONS` once). **One `ConfirmDialog`** (delete the other 3 abstractions + 4 wrappers). **Sheet quick-edit** replacing the 3 cloned dialogs. ~10,500 → ~4,000 LOC.
- ⚠️ CONFLICT / RETRACTED: **defect B-7 ("Collections: 594-line CRUD form, zero RBAC gating") is FACTUALLY FALSE.** Collections imported `useRole` in **two** files and has gated `CREATE_/EDIT_/DELETE_COLLECTION` since **2026-06-08 — five weeks before the audit**. `02` §5.4, `04` §5, Phase 9's risk line and parity check #20 all inherit the error. **"The one known intentional delta" does not exist.**

**Attributes dictionary (`/attributes`, admin only)** — the thinnest module (748 LOC), structurally fine. Manages `attribute_definitions`; per-tour values are edited on the tour's Attributes tab. Keyed by `key` not `id` with no detail route (a defensible quirk). Two real issues: **client-side pagination with no loading skeleton**, and a create/edit `Dialog` inconsistent with every other module's route-based form. **Solution:** adopt the shared `EntityTable`; **keep the dialog** (attributes are small and a dialog is genuinely right here — the inconsistency is worth naming and accepting); **add a "used by N tours" column** so an admin can see blast radius before editing. ~748 → ~600.

**Bookings (`/bookings`, admin + operator)** — the daily-throughput surface. Exposes exactly **one** transition: `CANCELLABLE = ['ON_HOLD','PENDING','CONFIRMED'] → CANCELLED`, gated on `EDIT_BOOKING`. **No confirm, no hold, no refund.** Detail is a cramped `max-w-lg` read-only Dialog with ~15 label/value pairs and **no fetch** (it just re-renders the list row). **Commission column visible to ADMIN, hidden from operator.** 7 palette classes; two gating idioms in one file; business logic (`refundDue()`, `paymentModelLabel()`) exported from a **columns** file. **Target:** detail moves to a **Sheet** (same data, room to breathe, list context preserved, arrow through bookings without closing) — **the single biggest throughput win in the module**; `StatusBadge` everywhere; **move `refundDue`/`paymentModelLabel` to `lib/bookings/`**; one gating idiom (`can()`).
  - **Preserve exactly:** commission is **ADMIN-only**; conversion value is **`commission_amount` in EUR, never GMV**; a confirmed booking with a null commission renders an **error**, never a conversion.
  - Booking list rows now carry ledger-derived **`paymentStatus`** (`PAID | PARTIALLY_PAID | UNPAID | REFUNDED`) **+ `paidAmount`** — for operators too, unconditional.

**Payments (`/payments`, admin + operator)** — **a dead end**: no actions column, no row-actions file, no detail view, no status transitions. **The only money-touching module with no drill-in**, while Bookings — sharing the same `types/booking` shape — has a details dialog and a cancel action. **Payments detail + refund transitions are BLOCKED on backend request A7**; until then the read-only list is at least *honestly* read-only — **do not add affordances the API cannot serve.** Parity requires correct provider/method rendering and **money with exact decimals and the correct currency**.

**Cancellation requests (`/cancellation-requests`, admin + operator)** — today a boolean: `<BookingsListView cancellationView />`, **zero components** — clever reuse, invisible as a workflow. Shows 3 extra columns. **Target: a real queue** — pending first, **the free-cancellation window and refund-due surfaced as columns not prose**, approve/reject inline, nav badge.

**Refunds** — no dedicated module. Refund handling is the `refundDue` computation in the bookings surface plus the confirm dialog's branching copy; **transitions are BLOCKED on A7**. In the ledger, **a refund flips the original payment to `REFUNDED` *and* writes a separate `kind = REFUND` row** (see E.4).

**Settlements / payouts** — **no dashboard module exists.** `payoutDueEur` is surfaced in analytics as **earned-and-unsettled**; the settlements ledger (SETTLEMENT-AND-PAYOUTS Phase 1) is **unbuilt**, so it reports what is **owed**, not what is **unpaid**.

**Reviews & moderation (`/reviews`)** — **a static JSX stub in production navigation**, and the more damaging of the two absences: homepage social proof is gated on approved reviews and **there is no moderation UI at all**. **BLOCKED on A2** (`GET /reviews` + moderation transitions). Target: a moderation queue — pending first, approve/reject inline, filter by tour/rating/status, bulk approve, gated by `APPROVE_REVIEW`; operators respond to reviews on their own tours. **Until unblocked, show an honest empty state naming what is coming. Do not ship a fake table.**

**Platform reviews (third-party)** — `/platform-reviews` module: an admin configures a **Trustpilot API or Google Reviews API** key in dashboard **Settings → Reviews** (**encrypted key, DB-cached payload, 12h lazy refresh, manual "Fetch now"**). The homepage Testimonials band renders the live payload and **stays hidden until enabled AND platform review count > 100** — the gate is enforced **server-side in `GET /platform-reviews/public`**. The public loader `getPlatformReviews` is an **external-provider aggregate with no change event**, so it is deliberately excluded from the cache-tag/ISR-cost passes.

**Customers / Users (`/users`)** — two distinct things share the name:
  - The **audited `users` stub** (static JSX, `page.tsx` + `new/page.tsx`, 8 lines each) is **BLOCKED on A3** (`GET /users` paginated + filterable, plus role management). Target: `EntityTable` + role column + invite flow; **role changes via the admin-only endpoint, never client-set**; same queue shape as Spotlight and Cancellations — **three inboxes, one pattern**.
  - The **shipped `/users` page is Staff & Teams** (E.2.9), role-branched platform-scope vs team-scope, gated `[MANAGE_STAFF, MANAGE_TEAM]` any-of.
  - **Customer-facing surfaces** (`Role.USER`): `components/customer/customer-bookings-view.tsx` (stat row from `me/summary` + own-bookings table + details sheet), `customer-booking-details.tsx` (trip/payment sections + cancellation request with "nothing is cancelled until we process it" copy), `customer-payments-view.tsx` (charges/refunds table), `payment-state.tsx`. `app/(app)/bookings|payments/page.tsx` **branch on role server-side**. A **backend `customers` table** (one row per `(userId, operatorId)`, aggregates `firstBookingAt`/`lastBookingAt`/`bookingsCount`/`totalSpendEur`) exists to feed a **FUTURE operator-facing "Customers" page only** — **customer-facing totals always come live from `GET /bookings/me/summary`**, never the aggregates.

**Tour Operators (`/tour-operators`, admin only)** — 1,001 LOC. **A `DashboardTabNav` wrapping a single tab labeled "Details"** — a navigation primitive rendering navigation for nothing, and a *different* primitive from the four entity editors. Own hand-rolled `<Input>` search instead of the shared `TableSearchInput`. 5 palette classes. **No onboarding visibility.** **Target:** delete the single-tab nav and render the form; adopt `EntityTable` + `TableSearchInput`; **add an onboarding status column** (the data exists — the layout already branches on `user.operator`); add **tour count + tier distribution** so an admin can assess an operator without leaving the row. ~1,001 → ~800.

**Tiers & Spotlight approval (`/spotlight`, admin approves / operator requests)** — Spotlight is 1,042 LOC with **24 palette classes in `spotlight-columns.tsx`** (#3 offender), its own `statusStyles` convention, client pagination, no skeleton, a shallower empty state. **Neither Spotlight nor Locals' Favourites is discoverable** — both are editorial powers with real commercial consequence, buried in a flat sidebar. **Target:** both under `CURATE`, adjacent; **Spotlight approvals get a queue shape** — pending first, approve/reject inline, badge on the nav item (**it is an inbox; make it one**); `StatusBadge` for both. Tier selection itself lives on the tour's **Promotion tab** (tier change with the **30-day lock** enforced, plus the spotlight request).

**Locals' Favourites (`/locals-favourites`, admin only)** — 591 LOC, **inline columns** (the only table without a sibling `*-columns.tsx`), two overlapping shells. **Target:** extract columns; delete the orphan shell; **show coverage against the ~30% target** (the editorial goal exists in the docs and is invisible in the UI). **Preserve exactly:** `is_locals_favourite` is **admin-only, never operator-set, never tier-linked, `MANAGE_EDITORIAL` only.** ⚠️ `locals-favourites-list-view.tsx` was called an orphan by an early scan and is **NOT dead — the chain is live end to end** (`locals-favourites/page.tsx` → `LocalsFavouritesView` → `LocalsFavouritesListView`); deleting it would have removed a live admin page.

**Media library (`/media`)** — see E.7.

**Settings (`/settings`)** — see E.8.

**Homepage CMS (`/homepage`, admin, `MANAGE_EDITORIAL`)** — see E.3.6.

**Pages / CMS (legal pages)** — **NOT STARTED**; see E.3.7.

**Analytics** — backend `src/analytics/`, dashboard UI `components/statistics.tsx`; see E.4.

**Featured experiences** — edited on the Homepage editor's **Experiences tab**; see E.3.6.

**Translations console (`/translations`)** — see E.3.5.

**Slug registry / redirects** — **no dedicated dashboard module.** The slug field lives on each entity's create/edit form (editable on create with auto-generation from name; editable on edit **with a note that renaming issues a 301 redirect**). `types/slug-registry.ts` exists dashboard-side; the dashboard's only interaction is the **`slug-registry` cache tag** emitted on tour and entity writes. Parity check 53: *rename a slug → 301 works, slug-registry tag busted.*

**Notifications** — **no dashboard module.** OCTO `octo/notifications` subscriptions are an API surface (E.11); transactional email is a BullMQ concern (E.9). Nav badges for pending counts were **DEFERRED** to the module phases that own the counts — **a badge is a promise that something needs a human, and a hardcoded one would lie.**

**FX admin** — **no dashboard module.** FX is backend-side (`src/fx/`), still on the **STATIC provider**; the analytics payload carries one live **EUR → USD** `fx` rate for dual-currency rendering and is **`null` when no fresh rate exists** (the UI then shows **EUR alone rather than converting at a stale rate**).

**Profile / Account (`/profile`)** — 1,188 LOC. One long page with a **single `isEditing` boolean toggling the entire page** between read and edit (changing an avatar puts every field into edit mode). The only module using framer-motion stagger. Gated by `Role.USER` equality rather than `can()`. `change-password-dialog.tsx` is 268 lines. **Target:** **per-card edit**, not per-page; a Security card (password + sessions + last login — **session list BLOCKED**, needs a backend endpoint); **keep the avatar cropper** (it is good and it works); drop the stagger; `can()` not `role ===`. ~1,188 → ~900. The profile page is already role-aware (change/set password works for customers).

**Onboarding (`/onboarding`)** — travels with the dashboard; the layout **redirects a `TOUR_OPERATOR` with no operator record to `/onboarding`**; `checkOnboardingStatus()` / `onboardOperator(data)` server actions; `lib/validations/onboarding.ts` is one of only two shared schema files.

**Command palette** — `Cmd+K`, `cmdk` already a dependency. Jump to any tour by name, any booking by ref, any destination. **This is the real answer to click depth — it makes the sidebar a map rather than the only road.** As shipped: nav commands come from the **SAME filtered groups** as the sidebar; gated quick actions; server-side search (tours by role-appropriate hook, bookings by ref/guest, destinations client-filtered) enabled only while open with **≥ 2 chars**; `useBookings`/`useDestinations` gained a non-breaking `enabled` param. **Catalogue entity search (tours, destinations) is OFF for customers** — those results link into operator screens they cannot open, **and permission alone does not gate it because USER carries `VIEW_TRIPS`**. Booking search stays on (the backend scopes USER to their own rows).

**Global layout** — Sidebar 240px / 56px collapsed, persisted, groups by `2xs` uppercase, active = `bg-sidebar-active` **plus a 2px leading indicator** (never color alone). Header 56px: breadcrumb (left) · global search `Cmd+K` (center) · theme · profile (right). Content max-width 1440, `p-6` gutter. **The weather widget** (`weather-slider.tsx` 193 LOC + `utils/weather.ts` ~300 LOC + an OpenWeather API key + an external network dependency in an admin CRM) — **02 Appendix C1 defaults to carrying it; 04 recommends removing it. OPEN decision; still in the header as of Phase 14.**

#### E.3.5 Translations console (the 7-locale strategy)

- **Severity S1 — the single largest source of bloat.** Locales `['en','es','nl','pt','fr','de','zh']`. `LOCALE_LABELS` is commented "English labels (admin UI)" — **the admin interface itself is English-only; the 7 locales are a content translation workflow, not an i18n system.**
- **Cost for one realistic tour (5 highlights, 5 inclusions, 3 exclusions, 4 itinerary stops, 2 pickups) × 6 non-English locales:** Translations tab (7 locale tabs × 13 fields) **6 saves** · Highlights 30 · Inclusions 30 · Exclusions 18 · Info & Terms (features) 6N · Itinerary (`DualTranslationRow` title+description × 6 × 4) 24 · Pickups 12 · SEO 6 → **~120 saves, 300+ clicks, 7 tabs.** Each child row must be expanded first. No progress indicator, no completeness view.
- **The 13 translatable core fields:** `title`, `overview` (**required for publish, EN only**), `description`, `shortDescription`, `whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, `whatToExpectIntro`, `categoryDisplay`, `localTipTitle`, `localTipBody`, `operatorNote`, `meetingPointText`. **Three are `string[]` on the backend**, edited as newline-delimited textareas (`linesToArray`/`arrayToLines`).
- **Three aggravators:** (1) **the source text is never on screen** — the German tab renders 13 empty inputs placeheld "Overview in German" and the English it translates *from* appears nowhere; (2) **no machine translation exists** although `isMachineTranslated` threads through the whole type layer (14 occurrences in `types/trip.ts`), is settable on the upsert payload, and renders a "Machine Translated" badge in 6 components — **the data model is complete for a feature the UI never built** (`grep -E "autoTranslate|translateAll|deepl|openai"` returns **zero**; the SEO tab's "Regenerate" is client-side `truncate(collapse(...))`, not translation); (3) **no completeness view** — "which tours are ready for the German market?" is unanswerable without opening every tour and clicking every locale tab.
- **There is no shared `LocaleTab`** — it is redefined from scratch in 5 modules (`trips/trip-translations-tab.tsx:80`, `destinations/destination-translation-form.tsx:39`, `categories/category-translation-form.tsx:39`, `hubs/hub-translation-form.tsx:40`, `collections/collection-translation-form.tsx:41`), plus a 6th variant `rationale-translation-tabs.tsx` (97 LOC). `destination-` vs `category-translation-form.tsx` are **272 lines each and identical except mechanical renames** (~30-line diff, one of which is the string "destination page" → "category page").
- **Diagnosis:** translation was modeled as a *field attribute* ("every field has 7 versions") when it is a *workload* ("a person renders one entity into one language"). **The UI mirrors the database schema instead of the job.**
- **The console:** `/translations` (matrix: what needs doing) and `/translations/[type]/[id]/[locale]` (workspace: do it).
  - **The matrix** — rows = entities, columns = the 7 locales, cells = ✓ complete / ⬤ partial / ○ missing, filterable by type/destination/status, with a **Bulk pre-translate** action. A cell is a completeness ratio across **every** translatable surface for that entity, not just the Translations tab.
  - **The workspace** — one locale, every field, **source beside target**, one save. Header shows `[ 8 / 21 fields ]`; left column English (source, read-only), right column the target inputs; covers all 13 core fields **plus** every highlight, inclusion, exclusion, feature, itinerary stop, pickup and SEO field. Footer: `[ Pre-translate all empty ]  [ Save all (13 changes) ]`.
  - **Outcome:** clicks 300+ → ~30; saves ~120 → 6; screens 7 tabs × 6 locales → 6; source text visible; completeness visible; LOC ~1,145 (5 forks) + trips' tab → ~450 (one console).
- **Pre-translate** fills every empty target from the EN source, marks each `isMachineTranslated: true`, and leaves them editable for review — the badge then means something. **BLOCKED on A4** (the DB column, DTO field, type and badge already exist end-to-end; **only the generator is missing**).
- **Delete the Translations tab from all 5 modules.** Every entity editor's Translations tab becomes a **link into the console** showing a locale completeness summary; the five private `LocaleTab` implementations (~1,145 LOC) are deleted. **This is the make-or-break instruction** — adding a console while leaving the tabs in place gives operators two ways to do one job and deletes nothing.
- **`lib/translatable-schema.ts` is the design** — one declarative registry describing what is translatable per entity type (tour: 13 core + highlights[] + inclusions[] + exclusions[] + features[] + locations[] + pickups[] + seo{}; destination: name, overview, h1Override, breadcrumbLabel + pageContent + seo; category/hub/collection the same shape; collection + per-tour rationale). **Adding a translatable field is one registry entry, not a change in 5 forked forms.** It also retires `trip-translations-tab.tsx`'s worst property: restating the same 13-field list **four times**.
- **Architecture:** `app/(app)/translations/page.tsx` SERVER (filters + matrix); `[type]/[id]/[locale]/page.tsx` SERVER (fetch source + target); `translation-matrix.tsx` client (virtualized grid); `completeness-cell.tsx` SERVER pure; `workspace/workspace.tsx` client (ONE RHF form, all fields); `field-pair.tsx` SERVER (source read-only | target client input); `pretranslate-button.tsx` client **[BLOCKED A4]**.
- **States:** *Empty* — "No EN content yet. Translations need a source." + link to Setup. *Loading* — two-column skeleton. *Error* — per-field inline; a failed field never blocks the rest. *Saving* — one progress row with per-field success/failure. *Conflict* — flag "source updated" if EN changed since the translation was saved (**BLOCKED**: needs a source-updated timestamp; verify whether `updatedAt` on the EN translation suffices).
- **Deleted by the console:** 5 `LocaleTab` implementations, `trip-translations-tab.tsx`, `rationale-translation-tabs.tsx`, `translation-row.tsx`, `dual-translation-row.tsx` — **~1,400 LOC.**
- **Preserve the EN rule exactly:** English "Clear Fields" **upserts nulls**, never calls delete (the backend blocks it). Translation upserts always use the **`{ fields: { ... } }` wrapper**; flat sends 400 on `forbidNonWhitelisted`.
- **Rollback is large** — the one defensible R7 exception: land the console first and delete the tabs in an **immediate, same-day** follow-up (**not same-quarter**). ⚠️ Risk: `lib/translatable-schema.ts` must be exhaustive — **a missed field silently becomes untranslatable.**
- **Homepage in the console:** `homepage` is registered as a `TranslatableEntityType` with `HOMEPAGE_FIELDS`, a `HomepageWorkspace`, and **a single fixed `HomepageRow` in the matrix (no search, no pagination — there is one row)**. Two singleton accommodations in shared code, both additive: `ContentWorkspace`'s page-content props became **optional** (the homepage has no About/SEO body, and **rendering fields that save nowhere is worse than omitting them**), and **`paginated` now excludes `homepage`**.

#### E.3.6 Homepage CMS + featured experiences

- **Two related but deliberately separate systems:** (1) **Homepage content** — fixed sections, editable content; (2) **Pages** — a WordPress-like permalink system, scoped to legal pages.
- **Why not one page builder:** the homepage sections are **pixel-locked Figma layouts** (a fanned three-card deck, a fixed-width Embla carousel with a fixed dot count, a specific hero crop). **A block builder would hand an admin the ability to compose layouts that do not exist in code.** **So the homepage lets an admin change WHAT IS IN a section, never WHETHER a section exists. Section order and structure stay in code.**
- **The fallback contract (load-bearing):** **every homepage content field is nullable, and null means "use the built-in i18n dictionary default"** — `content.heroTitle || dict.home.hero.title`. This makes the work shippable incrementally: **an empty table renders exactly the pre-CMS homepage**; **clearing a field restores its default**; **rollback is "empty the table"**; **a backend outage degrades to bundled copy** (hence `publicGet`, **never `publicGetStrict`** — the site's front door must not 404). **The operator is `||`, not `??`** — an empty string from the DB must fall back too.
- ⚠️ **PUBLIC HOMEPAGE IS REVERTED (user, 2026-07-20)** — `frontend/app/(frontend)/[locale]/page.tsx` was restored to its pre-CMS state (`ee2106f^`) and renders bundled dictionary copy and bundled images again. **The public site is off-limits until the dashboard and backend work is signed off.** Everything else stayed (backend modules, migrations, dashboard editor, frontend data layer, the `homepage` cache tag) — those loaders are simply unreferenced. **Re-wiring is a ONE-FILE change**; **recover the page from `ee2106f`, do not rewrite it from memory.**
- **Schema** (`backend/prisma/home-page.prisma`, migration `20260720131212_home_page_content`, **purely additive**): **`HomePage` singleton** (`id @default("default")`) with `heroImage`, `editorialImages String[]`, `editorialDestinationId`, `ogImage` — **the destination FK is `onDelete: SetNull`** (deleting an island must not delete the homepage row); **`HomePageTranslation`** keyed `@@unique([homeId, locale])` with `heroTitle`, `heroSubtitle`, `experiencesTitle`, `editorialTitleLine1/2`, `editorialBody`, `editorialCta`, `faqTitle`, `faqSubtitle`, `isMachineTranslated`.
- **Backend routes** (`src/home-page/`): `GET /home-page/public?locale=` (`@Public()`); `GET /home-page`, `PATCH /home-page`, `GET /home-page/translations`, `PATCH /home-page/translations/:locale` — all **`MANAGE_EDITORIAL`** (editorial curation, so it sits with the other manual admin flags, **not `MANAGE_SETTINGS`**).
- **Service invariants:** **the public read is a `findUnique`, NEVER the self-seeding upsert the admin read uses — an anonymous GET must not write** (a missing row returns an **all-null payload rather than 404**); **an archived editorial destination reports `editorialDestinationSlug: null`** so the homepage never advertises a link that 404s; writes use **conditional spreads** so an absent field is untouched and an explicit `null` clears it; **translation writes seed the singleton first**; **there is no delete route — clearing is a null upsert.**
- **Homepage FAQ** (migration `20260720151119_faq_page_type_homepage`, one `ALTER TYPE "FaqPageType" ADD VALUE 'homepage'`): `GET/POST /home-page/:entityId/faqs/groups`, `PATCH/DELETE /home-page/:entityId/faqs/groups/:groupId`, `PUT /home-page/:entityId/faqs/groups/:groupId/translations/:locale` — all `MANAGE_EDITORIAL`, thin delegation to the `@Global` `FaqGroupService`. **`:entityId` is always the singleton key `'default'` and anything else 404s**; it stays in the path purely so the dashboard's shared `FaqManager` and `faqGroupsApi` work with **zero dashboard changes**. **Public FAQs ride along inside `GET /home-page/public`** (one cached read beats two; no new cache tag). **Locale rule: only FAQs that exist in the REQUESTED locale are returned** — an untranslated FAQ is **omitted rather than falling back to English**; an empty list means the frontend keeps its **full bundled dictionary set** (a complete block rather than a half-English one). The frontend **swaps `faqDict.items` wholesale**, never appends.
- **Featured experiences (Top Island Experiences)** — `FeaturedExperience` already existed in `prisma/destinations.prisma`, migrated and demo-seeded, **with ZERO application code**: `entityType (CATEGORY|HUB) + entityId + destinationId? + videoUrl + displayOrder + isActive`. **The `videoUrl` column exists precisely for the video cards `top-experiences.tsx` hardcodes.** Migration `20260720133830_featured_experience_destination_fk` gave `destinationId` a real relation with **`onDelete: Cascade`**; **`entityId` deliberately does NOT, because it cannot** (it points at either a Category or a Hub, and a relational FK targets exactly one table).
  - **Routes** (`src/featured-experiences/`): `GET /featured-experiences/public?locale=&destination=` (`@Public()`); `GET`, `POST`, `PATCH /:id`, `DELETE /:id` — all **`MANAGE_EDITORIAL`**.
  - The resolver returns `{ id, entityType, title, image, videoUrl, href }` where **everything except `videoUrl` comes from the referenced Category/Hub** — a card inherits that entity's translations and **can never drift from its target page**.
  - **THE GATE IS THE FEATURE.** Every card **mirrors the exact condition its target page 404s on**, and anything failing is **dropped**: **category** → `destination.isActive && category.isActive && liveTourCount > 0`; **hub** → `isActive && status === PUBLISHED && liveTourCount > 0`; **a hub pinned to an island other than its own**; **an orphan row whose target no longer exists**.
  - **Image falls back `heroImage || ogImage || null`**, then the frontend falls back to bundled art (the demo seed populates `ogImage` but not `heroImage` on categories, so without this every card rendered grey).
  - **A destination-less CATEGORY row had no URL at all** (category pages exist only per-destination; there is no global category route, and the navbar's destination-less branch is dead code). Rows now resolve to **the destination where the category has the most live tours (ties broken by id, so the pick is stable)** — guaranteeing a page that renders and picking the most convincing one.
  - **Frontend:** `TopExperiences` derives its slide count, loop copies, start index and dot row from the array; **fewer than 3 resolved cards falls back to the bundled deck**; the link is a **stretched overlay sibling** (`absolute inset-0 z-10`), not a wrapper, because **a button nested inside an anchor is invalid HTML** (the play button sits at `z-20`); **Embla 8 has NO `clickAllowed()`**, so drag-vs-click is decided by measuring pointer travel against an **8px slop**.
  - **Fixed in passing:** `categories.forceDelete` claimed Prisma cascade handled FAQs — **it does not** (`Faq` is polymorphic with no FK), so every hard-deleted category was **leaking its FAQ rows**. The transaction now deletes both `Faq` and `FeaturedExperience` rows by discriminator.
- ⚠️ CONFLICT — category gating: `CLAUDE.md` says a category page renders at **≥3** published tours per destination; **the code gates at ≥1** (`categories.service.ts` `getPublishedTourCount` + the detail 404). **The featured-card gate mirrors the CODE**, because its job is to match the real 404 condition. **If ≥3 is intended, both the category service and this gate change together.**
- **Dashboard editor (Phase 4):** nav is a **`Pages` group placed immediately before `Account`**, gated `MANAGE_EDITORIAL`; **the route stays root-level (`/homepage`)**; the editor uses **no `EntityDetailShell`** because it is a top-level tabbed singleton, same as Settings. `app/(app)/homepage` → `HomepageEditView` → `EntityTabs`, **tabs in the order the sections appear ON THE PAGE (Hero, Experiences, CTA Card, FAQs, then SEO)** — scanning the tab row is scanning the homepage top to bottom.
  - **Label by consequence** — `HomepageField` takes a `where` prop describing where the text lands ("the large text over the hero photo"), **never a column name**.
  - **Show the fallback** — the shipped copy is the placeholder AND, while a field is empty, an explicit **"Currently showing the built-in default"** note. Defaults live in `lib/home-page/defaults.ts` — **the ONE cross-repo duplication in this feature**, display-only, so drift costs a stale hint, never wrong data.
  - **Publishing honesty** — `HomepageSectionCard` renders **"Saving publishes straight to the live homepage"** beside every save button; **there is no draft state, so nothing should imply one.**
  - **English inline, other locales in the Console** — each translatable card links straight to the workspace.
  - `useSaveHomepageSection` composes the two endpoints a tab spans (locale-agnostic fields + English copy) **so one button saves both, sequentially rather than in parallel** — both write the same singleton, and a half-applied pair is easier to reason about than two racing writes.
  - **The Experiences tab carries the real product logic:** it states that **a card whose target has no live tour is dropped, and for hubs that bar is HIGHER than the hub page's own**; that **below 3 live cards the site ignores curation entirely and keeps its bundled deck** (so 1-2 cards produce no visible change — the notice says so with the count); it **warns past 5** (carousel geometry), **flags rows whose target was deleted** (`entityName: null`), and **surfaces the 409 duplicate error inline**.
- **Review round (2026-07-20) — five points, four real defects, all fixed:**
  1. **The shared FaqManager pointed the homepage at a dead link** — `CONSOLE_TYPE_BY_BASE` had no `/home-page` entry and fell back to `?? 'destination'`, so every homepage FAQ linked to a route that does not exist. Added the mapping **and removed the fallback: an unmapped basePath now renders NO pointer, because a wrong link is worse than a missing one.**
  2. **The forms duplicated the shared settings kit** — `HomepageSectionCard`/`HomepageField` re-implemented `SettingsCard`/`TextField`/`TextareaField`/`ImageField`. **Both duplicates deleted;** the behaviour survived as **`describeField(where, value, fallback)`** building the `description` the shared field already accepts.
  3. FAQs already used the shared manager and console — correct; only the link was broken.
  4. Tabs already used the shared `EntityTabs` — the divergence was form internals.
  5. **A media field asked for a pasted URL** — the featured-experience video was a raw `<Input>`, **the one field in the dashboard not backed by the media library**. A video picker now exists (see E.7).
  - **Security (HIGH): unvalidated media URLs could take the homepage down site-wide.** `heroImage`/`ogImage`/`editorialImages`/`videoUrl` were `@IsString()` only; **`next/image` THROWS at render on a src it cannot load**, and this singleton sits inside the prerendered shell of every locale's front page — **one bad save blanked the site's front door in every language.** Fixed in two layers: **write time** `@IsUrl({ protocols: ['https'] })` + `@MaxLength(2048)` (**nulls still pass, so clearing still restores defaults**); **render time** `lib/images/remote-hosts.ts` is the **SINGLE source of truth for allowed hosts** — `next.config.ts` derives `remotePatterns` from it and **`safeRemoteImage()` re-checks at render, falling back to bundled art**. **Host allow-listing is deliberately NOT duplicated in the backend.**
- **Cache-tag contract:** `homepage` added to `COARSE_CACHE_TAGS` **in both repos**, plus `case 'home-page'` in the dashboard's `tagsForMutation`. **Coarse rather than granular because there is exactly one homepage.** The featured-experiences loader carries **`cacheTag('homepage', 'tours')`** — **the second tag is load-bearing**: card visibility depends on the target still having a live tour, so a tour going dark must regenerate the list. Dashboard maps `case 'featured-experiences'` → `homepage`.
- **NOT verified: the rendered dashboard UI.** Every dashboard route 307s to `/portal` without a session; **the editor needs a human pass before it is trusted.**

#### E.3.7 Pages / CMS (Phase 5 — NOT STARTED, two open decisions)

- **Schema:** `Page { slug @unique, pageType, status DRAFT|PUBLISHED|ARCHIVED, publishedAt, ogImage }` + `PageTranslation { title, body, metaTitle, metaDescription }`.
- **Not SlugRegistry:** that table is **destination-namespaced (every row requires a `destinationSlug`) and legal pages are global. Forcing them in means a sentinel value that corrupts the table's meaning.** Instead: **`@unique` slug plus a shared `RESERVED_ROOT_SLUGS` constant validated on BOTH Page create and Destination create** — which also closes the pre-existing shadowing bug (**static route segments silently shadow destination slugs: a destination slugged `terms` or `search` becomes permanently unreachable, and no reserved-word guard exists anywhere**).
- ⚠️ **OPEN DECISION — routing:** `/{locale}/{slug}` **collides with `/{locale}/{destination}`**. Letting admins create pages without shipping code means page resolution **falls through the destination resolver: destination → else Page → else 404**. The alternative, **namespacing under `/legal/{slug}`**, is cheaper but **changes six live SEO-indexed URLs the legal handover README specifies. Recommendation: fall-through, keep the URLs.**
- ⚠️ **OPEN DECISION — rich text:** **neither repo has any editor, markdown lib, or sanitizer** — long-form is a `rows={8}` textarea end to end. A full working **TipTap v3** setup exists at `/Users/devripon/devripon/Final & Running Project/wattup-frontend` to port from. Caveats found on inspection: (1) its four `@tiptap/extension-table*` packages are **installed but NEVER wired**, and since the existing legal copy contains tables, **table support is a build, not a copy — the main argument for storing HTML rather than markdown**; (2) `simple-editor.scss` **styles global `html`/`body`/`:root` and overrides shadcn tokens to hardcoded light-mode values — importing it anywhere leaks app-wide and breaks dark mode** (biggest porting hazard); (3) its renderer **sanitizes client-side in a `useEffect`** (empty first paint, bad for SEO on public legal pages) and **runs `marked` over content that is already HTML** — **sanitize server-side on the write path and drop `marked`**; (4) **no react-hook-form integration exists** — the `Controller` wrapper must be written and **`onChange` wants debouncing** (it serializes the whole document per keystroke).
- **Prior art:** the legal pages already exist as hand-authored JSX — `privacy-policy` **516 lines**, `terms` **541**, plus `cookie-policy`, `cancellation-policy`, `legal-notice`, `manage-cookies` — **English on every locale**, via `components/frontend/legal/legal-page-shell`, with a header comment stating **verbatim handover copy, change only through Denley per the README**. **Phase 5 is a migration of authored copy, not greenfield.**
- **Migration:** convert the six authored legal pages to `Page` rows via a **seed script**, **swap the routes last**, and **delete the old JSX only after verification.**

---

### E.4 Dashboard analytics

> Built **2026-07-20**. Backend `backend/src/analytics/`; dashboard UI `tripwheel-x-islandtours-dashboard/components/statistics.tsx`. Canonical rules: master §1.4, §5.8, `SETTLEMENT-AND-PAYOUTS.md`, `FX-AND-MULTI-CURRENCY.md`.

#### E.4.1 The four defects of the old server action (fed by 22 list endpoints)

1. **Revenue summed only the first 100 payments** (`/payments?limit=100`) — silently under-reported past that page.
2. **Mixed currencies added together** under a hardcoded `$` — USD and EUR summed as the same unit.
3. **`Total Customers` was the literal constant `0`**; "No customers yet" was the else-branch of a value also pinned to `0`. Not computed from anything.
4. **6-month trend charts were fabricated** — one real current-month value × a fixed `0.6 / 0.7 / 0.8 / 0.85 / 0.9 / 1.0` ramp, with hardcoded `Jun`–`Nov` labels that never moved with the calendar. **Both empty-state guards were short-circuited with `|| true // Forced true for mock visualization`**, so a brand-new tenant saw a flat-zero chart instead of an empty state.
- Also: **`Inquiries & Leads`** and **`Customer Insights`** were hardcoded zeros with no backing model.
- **Module rule: every number is a live aggregate. A zero on screen means the query genuinely returned zero. Nothing is estimated, extrapolated, or placeheld.**

#### E.4.2 Money model

Per master §1.4/§5.8 the traveler pays the tier-driven **deposit (20–30%) to Island Tours** at checkout, and **that deposit IS the platform's commission**; the operator keeps the balance, collected on their own rails.

| Model | IT collects at checkout | Operator collects | Platform tracks the operator's half? |
|---|---|---|---|
| `OPERATOR_LINK` (default) | deposit | balance, via their link | **No** |
| `ON_ARRIVAL` | deposit | balance, in person | **No** |
| `PAID_IN_FULL` | 100% | nothing | Yes, and IT **owes** them the net |
| `OPERATOR_FULL` | nothing | everything | **Dropped for v1** |

#### E.4.3 Role-shaped payload — `GET /analytics/dashboard` returns the same keys with audience-dependent meaning

| Field | ADMIN | OPERATOR |
|---|---|---|
| `earnedEur` | commission earned | retail minus commission (**net**) |
| `commissionEur` | what the marketplace made | what they **paid** the marketplace |
| `payoutDueEur` | liability owed **out** to operators | money owed **to** them |
| `untrackedBalanceEur` | balance never flowing through IT | their own off-platform takings |
| `cashCollectedEur` / `refundedEur` | Stripe ledger | **null** (not applicable) |
| `customers.registered` | USER-account count | **null** (not their data) |
| `breakdowns.topOperators` / `topDestinations` / `byTier` | populated | **empty** (no cross-operator leakage) |

Additional metrics carried in the response blocks: `revenue`, `bookings` (incl. `byPaymentModel` + `funnel`), `trips`, `customers`, `payments`, `trend`, `breakdowns`, `recent`, plus `fx`. **`pendingEur`** reports confirmed-but-not-travelled money separately.

#### E.4.4 The three honesty rules baked into the code

- **Recognition on completion.** `earnedEur` counts **`REDEEMED`** bookings only ("revenue is recognized on tour completion"). Confirmed-but-not-travelled money is reported separately as **`pendingEur`** and must **never** be added to earned.
- **`untrackedBalanceEur` is EXPECTED, never received.** The platform does not track the operator-rails balance in v1. **Every surface showing it must say so.**
- **`payoutDueEur` is earned-and-unsettled.** No settlements ledger exists yet, so this is what is **owed**, not what is **unpaid**.

#### E.4.5 The five data-layer traps handled

- **Refunds are double-recorded.** A refund flips the original payment to `REFUNDED` *and* writes a separate `kind = REFUND` row. **Gross counts `SUCCEEDED` inbound kinds only; refunds count `REFUND` rows only.** Summing `status='REFUNDED'` would double count.
- **Mixed currency.** Every money aggregate multiplies by the booking's own **snapshotted `fxRateToEur`** → USD/EUR ledger sums correctly and historically. **Never a live rate.**
- **Guest bookings.** A customer is a distinct booker keyed by **`COALESCE(userId, lower(contactEmail))`**. `reserve()` writes `userId: null` for guests, so counting `User` rows alone would report **zero customers while bookings flow**.
- **Freesale bookings.** "Upcoming" keys off **`booking.localDate`**, not the `departure` relation, because freesale bookings carry `departureId: null`.
- **Trend bucketing.** Earnings bucket by **`utcRedeemedAt`** (recognition); booking volume by **`createdAt`**. **Empty buckets are emitted as real zeros** so the axis stays continuous.

#### E.4.6 API contract

```
GET /api/v1/analytics/dashboard?granularity=month|day&buckets=2..24
@RequirePermissions(VIEW_ANALYTICS)
```

- **Scope follows the caller:** `ADMIN`/`STAFF`/`EDITOR` are platform-wide; `TOUR_OPERATOR` resolves to its own `operatorId` — **mirroring `isPlatformWideBookingRole` in `bookings.service`, so a KPI can never exceed what the caller's booking list justifies.**
- **`fx`** carries one live **EUR → USD** rate so the UI renders both currencies from a single conversion. It is **`null`** when no fresh rate exists, and the UI then shows **EUR alone rather than converting at a stale rate**.
- **`bookings.funnel`** is labelled **"booking outcomes", not a marketing funnel**: the platform stores only a booking's *current* status and has no view/cart event store, so pre-booking steps cannot be reported honestly. It reports **created → committed → completed** with `commitRate`, `completionRate`, `expiryRate`, `cancellationRate`.

#### E.4.7 Verified against live data (2026-07-20, platform scope, demo-seeded DB, 263 bookings)

| Figure | Value |
|---|---|
| Commission earned (REDEEMED) | 8,914.30 EUR |
| Commission pending (CONFIRMED) | 3,568.30 EUR |
| GMV | 50,154.14 EUR |
| Payouts due to operators | 11,419.19 EUR |
| Untracked operator-rail balance | 26,279.74 EUR |
| Stripe cash collected / refunded | 23,874.29 / 2,006.68 EUR |
| Customers (distinct bookers) | 15 (12 registered) |
| Funnel | 263 created, 80.6% commit, 70.8% completion, 9% cancellation |

Operator scope (Miss Ann Boat Trips) returns the **other half**: `earnedEur` 9,282.78 (net), `commissionEur` 3,112.36 (paid to IT), `cashCollectedEur` null, `registered` null, `topOperators` empty. Tests: `analytics.service.spec.ts` (15); full backend suite **1228 pass**.

#### E.4.8 Analytics status ledger

- [x] Backend `analytics` module, role-shaped, EUR-normalized, FX dual-currency
- [x] Booking outcomes funnel + payment-model mix + breakdown leaderboards
- [x] Dashboard rewired to a single aggregate call (**22-request fan-out removed**)
- [x] All fabricated series, forced empty-state guards, and unbacked cards removed
- [ ] Settlements ledger (SETTLEMENT-AND-PAYOUTS Phase 1) — `payoutDueEur` becomes *unsettled* rather than *earned* once it exists
- [ ] Operator-rails balance tracking — would retire `untrackedBalanceEur`'s caveat
- [ ] Pre-booking funnel (views, add-to-cart) — needs a tracking event store

---

### E.5 Dashboard extraction

#### E.5.1 Confirmed parameters and target repo

| Parameter | Decision |
|---|---|
| Split | **Own repo, now. Hard cut.** |
| Target repo | `github.com/devripon-tr/tripwheel-x-islandtours-dashboard` |
| Domains (interim, in force) | `islandtours.esenc.cloud` · `dashboard.islandtours.esenc.cloud` · `api.islandtours.esenc.cloud` — one apex, all same-site |
| Domains (target, deferred) | `island.tours` · `dashboard.tripwheel.io` · `api.tripwheel.io` |
| Auth | Cookie, cross-subdomain on `.islandtours.esenc.cloud` — already the configured default |
| Base path | Root `/` |
| Travels with | portal + staff, onboarding, media gallery |
| `components/ui/` | **Fork.** The dashboard diverges. |
| Design | Free rein, new palette. Dark mode kept, both to WCAG AA. |
| Backend | **No changes.** Requests live in 02 Appendix A. |
| Deploy | Dockerfile + Next standalone → **changed to Vercel** (Phase 8 deviation) |
| Locales | 7, as a content workflow. **Admin UI stays English.** |
| Deleted | Leads, Enquiries (vestigial — "no enquiry model") |
| Designed but blocked | Overview (A1), Reviews (A2), Users (A3), Pre-translate (A4) |
| Local port map | **5050 backend · 3000 public site · 3001 dashboard** |

```
tripwheel-dashboard/                    # repo root = the app, no monorepo
├── app/
│   ├── layout.tsx                      # NEW dashboard-only root layout
│   ├── globals.css                     # NEW dashboard-only token system
│   ├── not-found.tsx · error.tsx · loading.tsx
│   ├── (auth)/  layout.tsx · portal/ · staff/
│   ├── onboarding/
│   └── (app)/                          # authenticated dashboard, served at /
│       ├── layout.tsx · page.tsx (overview)
│       ├── tours/ (renamed from trips — DEFERRED)
│       ├── destinations/ · hubs/ · categories/ · collections/ · attributes/
│       ├── bookings/ · payments/ · cancellation-requests/
│       ├── spotlight/ · locals-favourites/
│       ├── media/ · operators/ · users/ · reviews/
│       ├── settings/ · profile/
│       └── translations/               # NEW translation console
├── components/ ui/ · shell/ · data-table/ · common/ · <module>/
├── contexts/role-context.tsx · hooks/<domain>/
├── lib/ api/ · config/rbac.ts · i18n/locales.ts · auth-client.ts · cache/ · validations/ · utils.ts
├── navigations/navigations.ts · types/ · utils/ · public/
├── proxy.ts · next.config.ts · tsconfig.json · components.json
├── Dockerfile · .dockerignore   (superseded — Vercel)
├── .env.example · .env.production.example
└── e2e/
```

- **Rule: the repo root is the app.** No `apps/` dir, no workspace. **Isolation test = "clone and `pnpm dev`".**
- **Expected outcome:** LOC ~35,300 → ~19,500 (**−45%**); client components 161/207 (78%) → ~110/190 (~58%); translate 1 tour × 6 locales 300+ clicks/~120 saves → ~30 clicks/6 saves; publish a tour ~25-30 clicks/5 tabs → ~12 guided; hardcoded palette classes 187 → 0 (lint-enforced); distinct spacing values 59 → 9; fonts 5 → 2; icon libraries 2 → 1; dead code 1,574 LOC → 0; "Is this tour ready for Germany?" unanswerable → 1 click.

#### E.5.2 Verified defects

| # | Defect | Severity |
|---|---|---|
| B-1 / D-1 | `PATCH /settings/site` never busts public `site-info`. Duplicate `case 'settings'` in `cache-revalidation.ts:142,150`; the second is unreachable. `site-info` is `cacheLife('days')`. **Live production bug.** | S1 |
| B-2 / D-7 | `statistics.tsx:408,516` — `|| true ?` forces mock chart branches on | S2 |
| B-3 | Dashboard home 100% fabricated (`'John Doe'`, `'Bali Adventure'`, `totalRevenue: 125000.50`, `alice@example.com`) | S2 |
| B-4 / D-2 | `ui/sidebar.tsx:478` wraps oklch tokens in `hsl()` — invalid CSS, renders nothing | S3 |
| B-5 / D-3,D-4,D-5 | `--shadow-2xl` / `--tracking-normal` self-referential; `--destructive-foreground` never defined | S3 |
| B-6 / D-9 | `refundDue` / `paymentModelLabel` (money logic) exported from a columns file | S3 |
| ~~B-7~~ | ~~Collections: 594-line CRUD form, zero RBAC gating~~ **RETRACTED — false finding. Gated since 2026-06-08.** | ~~S2~~ |
| D-6 | `dashbaord-wraper.tsx:45` `bg-[#f1f4fa]`, no dark variant on the outermost container | — |
| D-8 | `bookings-dashboard.ts:16-29` local `buildQuery` duplicating `lib/api/query.ts:8` | — |

**The five things that matter:** (1) **161 of 207 dashboard files are `'use client'` (77.8%)** — the root cause of the perf profile, skeleton-first UX and tabs-instead-of-routes. (2) **7-locale entry costs 300+ clicks and ~120 saves per tour** — a missing system, not a bad screen. (3) **The cache bridge dies silently on split** — the only extraction risk no build/typecheck/import graph catches. (4) **Tour editor: 13 flat tabs, no save model, a publish contract that lies.** (5) **A stripped badge primitive caused 149 hardcoded colors** — highest leverage-to-effort fix.

**The governing pattern:** *this codebase's failure mode is not missing abstractions, it is un-adopted ones.* The generic `DataTable` (813 LOC) — all 10 tables ignored it. `ConfirmDialog`, documented for "any potentially-destructive dashboard action" — 2 of ~10 consumers. Shared `DatePickerField` — the schedules tab redefined it locally. Shared `deactivate-dialog` — behind four clone wrappers. **`FaqManager` (477 LOC, 4 consumers, zero forks) is the one that won.** **Therefore R7: a PR that adds a shared component and does not delete every fork it replaces is incomplete and must be rejected. Same PR, not a follow-up ticket.**

**What is NOT covered by the extraction docs:** (1) **No accessibility audit was run** — no axe, no keyboard sweep, no screen reader, no focus order; §E of 01 is static analysis only and **must not be cited as a WCAG audit**. (2) **No bundle measurement** — no `@next/bundle-analyzer`; client-component counts are a proxy. (3) **Contrast ratios in 03 are design targets, not compliance claims.** (4) **The public site's cross-site auth break is reported, not solved.**

#### E.5.3 The 7 hard coupling blockers (dashboard imports FROM public site)

| File | Line | Import |
|---|---|---|
| `collections/collection-form.tsx` | 24 | `TourBadgeChip` from `@/components/frontend/tour-badge` |
| `collections/collection-tour-select.tsx` | 10 | same |
| `collections/collection-tours-manager.tsx` | 17 | same |
| `hubs/hub-comparison-manager.tsx` | 17 | same |
| `hubs/hub-our-picks-manager.tsx` | 19 | same |
| `hubs/hub-tour-select.tsx` | 9 | same |
| `lib/tours/listing.ts` | 5 | type `TourListing` from `@/components/frontend/tour-card` |
| `lib/tours/listing.ts` | 6 | type `TourBadge` from `@/components/frontend/tour-badge` |

- **Resolution:** **REIMPLEMENT** `TourBadgeChip` as `components/common/tour-badge.tsx` (an admin-styled signal, **not a replica of customer chrome**); **REIMPLEMENT** `TourListing` as a local `AdminTourRow` type; **REIMPLEMENT** `TourBadge` locally. **Split `lib/tours/listing.ts` in two:** `deriveTourBadge` → dashboard `lib/tours/derive-badge.ts`; `formatTourSignals` → dashboard `lib/tours/signals.ts`; the public mappers **LEAVE**.
- **Public imports FROM dashboard: none.** One non-dashboard file does: `components/site-header.tsx:5-6` imports `ProfileDropdown` + `WeatherSlide` from `@/components/dashboard/*`.
- **Genuinely shared modules and their resolution:** `lib/constants/locales` (56 public importers) → **COPY-REDUCED** to `lib/i18n/locales.ts` (~40 lines not 150; needs `Locale`, `ALL_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_LABELS`, `Currency`/`ALL_CURRENCIES`; **NOT** `LOCALE_NATIVE_LABELS`, `LOCALE_CURRENCY`, `LOCALE_COOKIE`) · `lib/motion` (49 importers; dashboard needs `pageEnter` only) → **REIMPLEMENT** (~8 lines) · `lib/tours/listing` → split · `lib/currency/current` → **COPY-REDUCED** · `components/ui/calendar`, `popover` → **COPY** (part of the ui fork) · `lib/auth-client` → **COPY verbatim** (6 lines) · `lib/utils` (`cn`) → **COPY verbatim** · `lib/api/query.ts` (`buildQuery`) → **COPY**; delete the dup at `bookings-dashboard.ts:16-29` · `lib/api/availability.ts` → **COPY-REDUCED** · `types/collection`, `hub`, `search`, `review`, `category`, `destination` → **COPY**.
- **Types decision: COPY all dashboard-consumed types. Do not treat as duplication.** `types/*.ts` are hand-written mirrors of backend DTOs; **two independent consumers each maintaining their own view of a shared HTTP contract is correct microservice shape.** Extracting to a shared package would recreate the coupling the split exists to remove. **Risk: hand-mirrored, no codegen; drift is caught only at runtime.**
- **Files mixing both concerns (extraction blockers):** `app/globals.css:4` imports `./(frontend)/frontend-tokens.css` — **149 `--it-*` public tokens on every dashboard route**, while the imported file's own header says "(frontend) routes only / never in (dashboard)" → REWRITE · `app/globals.css` (276 lines serving both trees) → REWRITE · `app/layout.tsx` (root for both; `metadata.title = 'Island Tours - Admin'`; 5 fonts; mounts `QueryProvider`/`ThemeProvider`/`TooltipProvider`/`Toaster` for both) → REWRITE · `proxy.ts` (`guardDashboard()` **and** the full public i18n redirect/rewrite scheme) → REWRITE to guard only · `lib/tours/listing.ts` → SPLIT · `components/site-header.tsx` → `components/shell/` · `components/skelitons/` (mixes both; directory typo) → SPLIT + fix typo · `components/` root (dashboard-only files beside `smooth-scroll.tsx`) → sort by owner.
- **Deletions — do not carry:** `components/data-table.tsx` (813 LOC, 0 importers) · `components/section-cards.tsx` · `components/chart-area-interactive.tsx` (sole importer of `ui/toggle-group.tsx`) · `trips/trip-content-tab.tsx` (255) · `trips/trip-languages-tab.tsx` (205, inlined into `trip-details-tab.tsx:65-197`) · `common/image-upload-selector.tsx` (235, superseded by `media/image-selector-field.tsx`) · `app/__backup(auth)/`, `components/__backup_auth/` · `dashboard/{leads,enquiries}/page.tsx` · `frontend/lint_errors.log` (45KB) · `ui/{progress,breadcrumb,drawer,toggle,toggle-group,input-otp,input-group}.tsx` (unused/transitive-only — re-verify after the table rewrite) · plus `nav-user.tsx`, `nav-documents.tsx`, `nav-secondary.tsx`, `collection-tour-card-skeleton.tsx`.
- ⚠️ **Do NOT delete `lib/api/cache-revalidation.ts`** — it is live at `lib/api/fetch.ts:7`; **deleting it would have taken the whole public-cache bridge with it.** ⚠️ **`locals-favourites-list-view.tsx` is NOT dead.** **Both were wrongly called dead by the same early scan — verify every "dead" claim against a real importer.**
- **Leave behind (public-owned):** `app/(frontend)/**`, `components/frontend/**`, `lib/api/public/**`, `lib/api/{wishlist,search,reviews,categories-public,slug-registry,bookings}.ts`, `contexts/booking-context.tsx`, `hooks/tours/{use-booking,use-booking-quote}.ts`, `hooks/use-drag-scroll.ts`, `app/(login)/{apply,bookings}`, `components/smooth-scroll.tsx`, public skeletons, `types/{tour-detail,facets}.ts`, `app/(frontend)/frontend-tokens.css`.

#### E.5.4 The two independent fetch stacks

| | `apiFetch` (`lib/api/fetch.ts`) | `publicGet` / `publicFetch` |
|---|---|---|
| Owner | Dashboard | Public site |
| Context | Browser | `import 'server-only'` |
| Base URL | `${NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1` | same |
| Auth | `credentials: 'include'` (session cookie) | `x-internal-api-key: INTERNAL_API_SECRET` |
| Retry | `[300, 800]` + **full jitter, GET only**, on 429/503 | `[300, 800]` fixed, **no jitter** (no `Math.random()` inside `'use cache'`) |
| Errors | throws `Error(message)` | returns `null`, never throws |
| Caching | none (TanStack Query owns it) | none at fetch level |
| Next coupling | calls `revalidatePublicForPath()` on success (`:64`) | `cacheTag()` in callers |

- **Third variant:** `lib/server/auth-headers.ts` (`serverAuthHeaders`) forwards **both** the cookie and the internal key; used by server actions. **Copy as-is.** `INTERNAL_API_SECRET` must match the backend's and exempts SSR from the per-IP throttle.
- `apiFetch` **copies as-is**: error normalization `body.message` (string or `string[]`) → `throw new Error`; `204` → `undefined`; **text-first parse to survive empty-body 200s**. **One change:** the tail call `revalidatePublicForPath(path, method)` keeps its signature with a replaced implementation. **Error handling and retries are explicitly NOT in scope to redesign.**
- **API boundary contract:** the dashboard's only permitted contact with the backend is **HTTP to `${NEXT_PUBLIC_BACKEND_URL}/api/v1`. No shared database, no shared package, no shared process.**
- **Dashboard API modules → backend base paths:** `trips.ts` (519 LOC) → `/tours`, `/tours/:id/{images,addons,age-bands,languages,highlights,inclusions,exclusions,features,locations,pickup-locations,translations}`, `/tours/:id/{publish,pause,unpause,archive,restore}`, `/availability/{schedules,exceptions}` · `destinations.ts` → `/destinations`, `/destinations/:id/{translations,page-content,faqs,force}` · `categories.ts` → `/categories`, `/categories/destination/:slug`, `/categories/:id/{translations,page-content,faqs,force}` · `collections.ts` → `/collections`, `/collections/:id/{translations,page-content,faqs,status,tours,resolved-tours,force}` · `hubs.ts` → `/hubs`, `/hubs/:id/{translations,page-content,faqs,allowed-categories,content-sections,our-picks,comparison}` · `attributes.ts` → `/attributes`, `/tours/:tripId/attributes` · `tiers.ts` → `/tiers/tours/:tourId/{tier,spotlight}`, `/tiers/admin/spotlight` · `bookings-dashboard.ts` → `GET /bookings`, `POST /bookings/:id/cancel`, `GET /payments` · `operators.ts`/`operator-settings.ts` → `/operators`, `/operators/:id/{company-info,stripe-config,mollie-config}` · `settings.ts` → `/settings/{site,seo,social-media,company,payment/stripe,payment/mollie,smtp,mailchimp}` · `profile.ts` → `/users/me`, `/operators/:id/{company-info,social-media}` · `media.ts` → `/media-gallery`, `/media-gallery/{bulk,upload,sign,confirm}` · `faq-groups.ts` → `${basePath}/:id/faqs/groups` (generic, 4 modules) · `locals-favourites.ts` → `/tours/admin/locals-favourite/stats`, `PATCH /tours/:tourId/locals-favourite` · `availability.ts` → `POST /availability/{check,calendar}` (shared with public).
- **No dashboard module exists for `/reviews` or a `/users` list** — those pages are stubs. **Naming:** the frontend says "trip", the backend route base is `/tours`; `tripId` params post `{ tourId }` bodies.
- **Server actions (`app/_actions/`):** `revalidate.ts` → `revalidateCacheTags(tags)` (called over RPC from the browser) · `userActions.ts` → `getUserProfile(cookie)` (React `cache()`-wrapped, **NOT `'use cache'`**) and `setPasswordAction(newPassword)` · `onboardingActions.ts` → `checkOnboardingStatus()`, `onboardOperator(data)` · `dashboardActions.ts` → `getDashboardStats()` (**hardcoded mock, no backend call**).
- **Data-fetching style is uniform:** every list/edit route is a thin server shim rendering a `*-view`/`*-client` client component; all entity data flows through TanStack Query hooks calling `apiFetch`. **Zero `useEffect` fetching, zero server-component entity fetches.** Exceptions: `layout.tsx` (server, `await getUserProfile(cookie)` inside `<Suspense>`, redirects `/portal` or `/onboarding`) and overview `page.tsx` (passes an **unawaited** `getDashboardStats()` promise). `QueryClientProvider` is mounted in the **root** layout so it wraps both trees; defaults `staleTime: 30_000`, `retry: 2` (exp backoff, 10s cap), `refetchOnWindowFocus: true`, `mutations.retry: 0`. Hooks: one directory per domain (15 dashboard domains); `hooks/trips/use-trips.ts` is **921 LOC — 14 queries + 44 mutations**, `tripKeys` factory at `:39-59`.
- **Forms:** `react-hook-form@7.75` + `zod@4.4.3` + `@hookform/resolvers@5.2.2`. Schemas are **colocated inline in ~44 dashboard components**; no `schemas/` directory; only two shared schema files (`lib/validations/onboarding.ts`, `lib/validations/profile.ts`). The cast `as unknown as Resolver<T>` repeats at `trip-form.tsx:170`, `trip-details-tab.tsx:380`, `trip-pricing-tab.tsx:532`, `:721`, `:783`.

#### E.5.5 Auth flow, proxy and base-path migration

```
Browser → dashboard origin
  proxy.ts guardDashboard()        cookie presence + shape only, NO network
    no cookie        → 302 /portal
    malformed cookie → 302 /portal + clearSessionCookies()
    ok               → next()
  app/(app)/layout.tsx (Server Component)
    getUserProfile(cookie)         React cache(), NOT 'use cache'
      → authClient.getSession() + GET /users/me  (parallel)
      null                           → redirect('/portal')
      TOUR_OPERATOR without operator → redirect('/onboarding')
    → RoleProvider role={user.role} → useRole() → { role, can, canAny }
```

- **Three load-bearing, non-obvious properties (R11 — read the source comment before touching the line):** (1) **`guardDashboard` does no network call** — a cheap cookie-shape check; the layout is the authority; moving validation into middleware puts a backend round-trip on every navigation. (2) **`getUserProfile` uses React `cache()`, never `'use cache'`** — **a cached `null` from a transient 429 would bounce logged-in users to `/portal`. This is a trap. Do not "optimize" it during the migration.** (3) **`RoleContext` defaults to deny-all** — a missing provider denies rather than permits.
- `better-auth@1.6.9` is referenced in exactly **2 files**: `proxy.ts:7` (`getSessionCookie`) and `lib/auth-client.ts:1` (`createAuthClient`).
- **Cookie names are never hardcoded.** `clearSessionCookies()` matches by substring — `name.includes('session_token')`, `name.includes('session_data')` — covering `__Secure-` prefixes. **Keep.**
- Prod cookie domain default **`.islandtours.esenc.cloud`**, overridable via `COOKIE_DOMAIN` (`proxy.ts:126`). **It must match backend `crossSubDomainCookies.domain` — a mismatch is a login loop.**
- `contexts/role-context.tsx` resolves `ROLE_PERMISSIONS[role]` from `lib/config/rbac.ts` into `PermissionKey[]` and exposes `{ role, can, canAny }` — **27 dashboard consumers**. `navigations/navigations.ts` → `filterNavigationByPermissions` (`lib/rbac-utils.ts`) → `components/app-sidebar.tsx` (sole consumer).
- **`lib/config/rbac.ts` header: "Mirrors backend: `src/config/roles.config.ts` + `prisma/enums.prisma`. Keep in sync." — more dangerous after the split** (different repos, no shared CI).
- **New dashboard-only `proxy.ts`** deletes everything the public site needs (locale redirects, `NON_LOCALIZED_PREFIXES`, thank-you/cancel rewrites, `LOCALE_COOKIE`). Remaining responsibilities: (1) `guardDashboard` for everything under `/` except `(auth)` and `/onboarding`; (2) legacy redirects `/login` → `/portal`, `/forgot-password` → `/portal/forgot`, `/reset-password` → `/portal/reset`; (3) legacy `/dashboard/*` → `/*` **308 permanent redirect**. Matcher unchanged: `['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']`. **The file is named `proxy.ts`, not `middleware.ts`** — Next 16 renamed it; **keep the name**.
- **As shipped, the guard inverts:** guard everything EXCEPT `UNGUARDED_PREFIXES` = `/portal`, `/staff`, `/onboarding`, `/api`, and **the legacy 308 runs FIRST** so an unauthenticated hit on a legacy URL keeps its destination. ⚠️ `proxy.ts` sits at the repo root, outside the rewritten dirs, **which is what saved it**: a blanket `startsWith('/dashboard/')` → `startsWith('/')` rewrite would have guarded `/portal` and produced an **infinite redirect loop**.
- **Base-path migration steps:** move `app/(dashboard)/dashboard/*` → `app/(app)/*` · strip the `/dashboard` prefix from every nav `url` · grep `'/dashboard` repo-wide and rewrite every `router.push`/`redirect`/`<Link href>` (known sites: `trip-form.tsx:287`, all `[id]/page.tsx` shims, `trip-row-actions.tsx:103-123` `?tab=` deep links, breadcrumbs, layout redirects) · add the 308 in `proxy.ts` · update `e2e/` specs · verify no `basePath` in `next.config.ts` (there is none). **Validation:** `grep -rn "/dashboard" app components lib navigations` returns only the legacy-redirect rule.
- ⚠️ **The `DASH_ROOT` trap:** `nav-main.tsx:30` had `const DASH_ROOT = '/dashboard'` with hrefs `` `${DASH_ROOT}/${url}` ``. A blanket `'/dashboard'` → `'/'` rewrite turns that into `` `//trips` `` — **a protocol-relative URL the browser resolves to host "trips". Every sidebar link would have broken and the build stays green.** Replaced with a `toHref()` helper (which also fixed a latent `/undefined` href). **`navigations.ts` itself needed NO change** — its urls are already relative.
- **The trip/tour naming split is not required for extraction.** Recommendation was to rename during the Phase-6 file move (one churn not two); **risk: a large mechanical diff on top of a large mechanical diff — harder review, worse bisect. Recorded as an explicit go/no-go — DEFERRED.** Phase 14 labels say "Tours"; routes stay `/trips`.

#### E.5.6 Environment variables (dashboard)

**Project rule adapted: every var appears in `.env.example` AND `.env.production.example` in the same change.**

| Var | Public? | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | yes | Backend base | `https://api.islandtours.esenc.cloud` |
| `INTERNAL_API_SECRET` | no | SSR throttle exemption; must match backend | 32+ chars |
| `COOKIE_DOMAIN` | no | Session cookie scope; must match backend | `.islandtours.esenc.cloud` |
| ~~`NEXT_PUBLIC_SITE_URL`~~ | — | **GHOST — does not exist. Do not add it.** No code reads it. | — |
| `REVALIDATE_TARGET_URL` | no | Public revalidate endpoint | `https://islandtours.esenc.cloud/api/revalidate` |
| `REVALIDATE_SECRET` | no | Shared secret; must match the public site | 32+ chars |
| `NEXT_PUBLIC_OPEN_WEATHER_API_KEY` | yes | Header weather widget | |
| `NEXT_PUBLIC_STAGING_APP_URL` | yes | `setup-guide.tsx:53` | |

- **The dashboard reads exactly seven vars** (+ `NODE_ENV`), confirmed Phase 8.
- **Backend-side changes required (config only, no code):** `COOKIE_DOMAIN` = `.islandtours.esenc.cloud` (**unchanged, already the default**); `CORS_ORIGINS` += `https://dashboard.islandtours.esenc.cloud` while keeping the public origin (**in dev also add `http://localhost:3001`**). **`CORS_ORIGINS` feeds BOTH `main.ts:43` (CORS) and `auth.instance.ts:17` (Better Auth `trustedOrigins`) — one var, two consumers. A miss rejects sign-in, not just fetches.** `main.ts` must keep `credentials: true`.
- **Public-site side:** `REVALIDATE_SECRET` (matching) + the new `/api/revalidate` route handler.
- ⚠️ **PORT COLLISION (a real defect the split introduced, fixed in Phase 8):** `playwright.config.ts` ran `pnpm dev` and tested `localhost:3000` while `.env.local.example` pointed `REVALIDATE_TARGET_URL` at `localhost:3000` as the **public site**. Both cannot own 3000, and `reuseExistingServer: true` meant **Playwright would silently attach to a running public site and run the dashboard suite against the wrong app.** The dashboard is now **pinned to 3001**.
- `serverActions.bodySizeLimit: '100mb'` is **vestigial and its comment was false** — media uploads go browser → backend directly via `apiFetch` and never traverse Next; **no Server Action in the app takes a file.** On Vercel it is also unenforceable (the platform caps function request bodies at **4.5 MB**). Left in place with a truthful comment; a candidate deletion.

#### E.5.7 Cross-app cache revalidation

- **The problem:** today `apiFetch` (`fetch.ts:64`) → `revalidatePublicForPath` (`cache-revalidation.ts:167`) → `revalidateCacheTags` Server Action → `updateTag(tag)` → invalidates `lib/api/public/*` `cacheTag(...)` entries. **This works for exactly one reason: both apps are the same Next.js process.** After the split, `updateTag` mutates only the calling app's cache. **Build error: none. Type error: none. Runtime error: none. Test failure: none.** The symptom is public pages serving stale content until `cacheLife` expires — worst case today `getPublicSiteInfo` is `cacheLife('days')`, so a logo/WhatsApp change is invisible for **days**. **This is process separation, not domain** — two Next apps are two caches on any host; the subdomain decision changes only `REVALIDATE_TARGET_URL`.
- **Pre-existing coverage gap (not a regression):** only writes originating in the **dashboard browser** ever bust the cache. These never have and still will not: **BullMQ nightly jobs** (quality-score, eligibility, materialization), **Stripe webhooks** (booking confirmed → capacity → `isBookable` flips), **backend admin scripts/seeds**, and any future backend-initiated mutation.
- **Options considered:** (1) dashboard Server Action → HTTP POST → public `/api/revalidate`, no backend change, dashboard-originated coverage — **CHOSEN for v1**; (2) backend emits via outbox/BullMQ → POST, backend change required, **all** writes — **TARGET STATE**; (3) browser POSTs the public endpoint directly — **REJECTED** (the secret ships to the browser; CORS on a cache-control endpoint); (4) drop push and rely on short `cacheLife` — **REJECTED** (trades correctness for origin load); (5) shared Redis cache handler — **REJECTED** (re-couples the two frontends).
- **v1 architecture:**

```
Browser (dashboard) → apiFetch → revalidatePublicForPath [UNCHANGED LOGIC]
  → revalidateCacheTags()  'use server'   (secret stays server-side)
    → POST https://<public>/api/revalidate
       headers: x-revalidate-secret: <REVALIDATE_SECRET>
       body:    { tags: ["tour:abc","tours","search"] }
         → public app/api/revalidate/route.ts [NEW]
            ├─ timing-safe secret compare → 401
            ├─ validate every tag vs union → 400 (drift guard)
            └─ revalidateTag(tag) each     → 200 { revalidated: [...] }
```

- **The Server Action stays** because (1) `REVALIDATE_SECRET` must never reach the client, (2) a cross-origin browser POST needs CORS on a cache-control endpoint, (3) it is already there.
- **The single most important implementation detail: `revalidateTag`, NOT `updateTag`, in the Route Handler.** `updateTag` can only be called from within a Server Action and **throws** in a Route Handler; a naive port throws at runtime on every call and, because the caller is fire-and-forget, **fails silently.** ⚠️ The spec's "call `revalidateTag(tag)` with no profile" **does not compile on Next 16.2.4** — `profile` is required, and the bare call logs a deprecation **per tag per write**. **Shipped `revalidateTag(tag, { expire: 0 })`** (`revalidate.js:208` puts it in the same branch as both no-profile and `updateTag`'s own internal call). **`'max'` (stale-while-revalidate) remains DEFERRED** — a real behavior change, to revisit only if measured.
- **Endpoint contract:** `POST /api/revalidate`; auth `x-revalidate-secret` header with a **timing-safe** compare (`crypto.timingSafeEqual`); body `{ "tags": string[] }`, **max 32 entries**; `200 { "revalidated": string[] }`; `400 { "error": "unknown_tag", "tags": [...] }` (drift guard); `401 { "error": "unauthorized" }` (no detail); `405` on non-POST; secret-gated with a modest per-IP cap advised; **Node runtime (needs `crypto.timingSafeEqual`) — do NOT set `export const runtime = 'nodejs'`, which is incompatible with `cacheComponents` and breaks the build (`tsc --noEmit` passes it, so it would have failed the Vercel deploy); Node is the default anyway**; must not be crawlable or cached. Requirements: timing-safe comparison (compare lengths first without early-returning on content); **batch** (one POST per write carries all tags); **never echo the secret**; **bounded**.
- **The tag contract:**

```
Coarse:   tours | search | hubs | categories | collections | destinations
          | reviews | slug-registry | site-info | user-profile | homepage
Granular: tour:<id> | destination:<id> | hub:<id> | category:<id>
          | collection:<id> | operator:<id>
```

  Validation: valid if in the coarse set, **or** it splits on `:` into exactly two parts whose prefix is in the granular set and whose suffix is non-empty. **Reject partial batches wholly** — any unknown tag 400s the whole request and revalidates nothing, because **partial success would leave the caller believing it succeeded.** **Failure mode without the guard:** public renames `site-info` → `site`, dashboard POSTs `site-info`, public returns `200 { revalidated: ["site-info"] }`, the cache is never busted — **green checkmarks all the way down, stale content forever.**
  **Two special cases to keep:** `/availability/check` short-circuits (`:76`) — it is a read shaped as a POST and revalidating loops; and `seg1 === 'slug'` is excluded from the granular `tour:<id>` tag (`:64-66`) — `/tours/slug/:slug` is a lookup, not an entity id.
  **Where the contract lives:** `lib/cache-tags.ts`, **byte-identical at the same path in both repos**, with types **derived** from the arrays (`type CoarseCacheTag = (typeof COARSE_CACHE_TAGS)[number]`). **No shared npm package.** The drift check is `diff <dashboard>/lib/cache-tags.ts <public>/lib/cache-tags.ts` — empty output means the contract holds. **Changing a tag: edit both repos in the same change, and ship the public site FIRST.** ⚠️ **Nothing enforces this:** there is no CI guard and no cheap way to add one (**the dashboard repo has no CI at all**; a shared package is rejected; token-clone is fragile; a committed hash goes stale). **The 400 is runtime detection, not prevention. `diff` is the prevention and it is manual.**
  ⚠️ **`user-profile` is a phantom tag in BOTH repos** — the mapping emits it for `/users/me` and every `/settings/*` write, but **nothing anywhere calls `cacheTag('user-profile')`** (`getUserProfile` is React `cache()`), so `updateTag('user-profile')` has been a no-op since long before the split. **Kept in the union for parity** (cost: a few no-op POSTs). **Remove from both repos together or not at all.**
- **Reliability requirements** (today's `void revalidateCacheTags(tags).catch(() => {})` **is indefensible across a network** — DNS, TLS, a deploy, a 401 on a rotated secret, a 400 on drift, a timeout, a 5xx all mean the public site is silently stale):
  - **R1 — Keep the write path non-blocking.** A revalidation failure must never fail or delay the operator's save. **Non-negotiable.**
  - **R2 — Log every failure** with the tags, the status, and the path.
  - **R3 — Retry transient failures** (network, 5xx, timeout) with the same `[300, 800]` + jitter backoff `apiFetch` uses.
  - **R4 — Never retry 400 or 401.** Both are permanent (400 = tag drift/code bug; 401 = secret mismatch/config bug).
  - **R5 — Timeout at ~3s.** This bounds each *attempt*, not the operation — **worst case ~11s for 3 attempts + backoff + jitter. Accepted** (fire-and-forget so R1 holds; the dashboard is self-hosted so there is no serverless `maxDuration`; shortening it would fight R3).
  - **R6 — Surface a persistent failure to a human** — at minimum a structured `console.error` the log drain alerts on.
  - **The honest gap: a revalidation lost to a hard failure is lost forever.** No queue, no replay. Mitigated by the TTL backstop + alerting, **not solved**.
- **Efficiency / coalescing.** Volume today: a 7-day × 3-time schedule save = **21 sequential writes → 21 POSTs** (`tours`, `search`); adding 5 images = 5; reordering one image = 2; adding/removing one start time = 1 full `PATCH /tours/:id` (+ `slug-registry`); translating one tour into 6 locales = **~120 saves → ~120 POSTs**.
  - **Fix 1 (largest): reduce the writes, not the revalidations** — the save-model redesign + bulk endpoints A5/A6 remove ~95% of volume at source (translate 120→6, tour details ~20→1 per route, 7×3 schedule 21→1, image reorder 2-per-arrow→1-per-drop).
  - **Fix 2 (immediate): leading + trailing throttle, ~1s window, per unique tag set.** The leading edge fires immediately (**a single isolated save is unchanged — no regression**); the trailing edge flushes once at window end; tags accumulate into a `Set`; flush on `pagehide`/`visibilitychange`. **Spec said 21 → 2; measured 21 → 3** (the burst spans ~1.05s and outlives one 1s window) — **still 86% off.** Not a plain trailing debounce (that would delay every revalidation). **`navigator.sendBeacon` is not an option** (it cannot invoke a Server Action, and a direct call would leak the secret).
  - **Fix 3 (deferred): the `'max'` profile.** Only if measurement shows it hurts. **Do not adopt as a guess.**
  - **Fix 4: DO NOT narrow the tag mapping.** Over-invalidation costs a regeneration; **under-invalidation serves wrong prices** — not symmetric. Concrete trap: `use-trips.ts:362-363` and `:858-861` invalidate `tripKeys.detail` on age-band/highlight/inclusion/exclusion/schedule/exception mutations because **`priceFrom`/`isBookable`/counts recompute server-side** — a child-collection write genuinely can change the public listing.
  - **Fix 5: backend-emitted** — coalesces naturally, emits precise tags, gives durable retries.
  - **Order: 2 now, 1 as the redesign lands, then re-measure before touching 3.**
- **`cacheLife` as a safety net** (a public-repo tuning request, **not a mandate**): `site-info` `days` → **`hours`** (confirmed too long); `tour:<id>`, `tours`, `search` → `hours` (price and availability — the highest-cost staleness); `destinations`, `categories`, `collections`, `hubs` → `hours`-`days` (editorial); `slug-registry` → `hours` (a stale registry serves 404s/wrong pages); `reviews` → `days` (low stakes). **Principle: TTL is a bound on damage, not a cache strategy.**
- **Secret rotation and unset behaviour:** the endpoint accepts a **comma-separated list of valid secrets**, so rotation is a **two-deploy operation** (verified: it accepts both old and new). **`REVALIDATE_TARGET_URL` absent → skip revalidation and log once at startup; it must not throw.**
- **Target state (backend-emitted):** `api → entity write (dashboard, BullMQ job, Stripe webhook, script) └─ outbox row [exists] → BullMQ worker [exists] → POST public /api/revalidate { tags }`. This fixes: the dashboard stops knowing the public site exists; backend-originated writes bust the cache; lost revalidations are retried durably; the tag taxonomy lives with the write's owner; new consumers get fan-out for free. **Migration path:** the endpoint is identical in both designs, only the caller changes; both can run in parallel briefly (**`revalidateTag` is idempotent, no flag-day**); then the dashboard's mapping becomes a no-op behind a flag and `cache-revalidation.ts` + `revalidate.ts` are deleted.
- **Known debt accepted in v1:** (1) the dashboard knows the public site exists and knows its cache-tag vocabulary; (2) backend-originated writes never bust the cache; (3) lost revalidations are not replayed; (4) the tag contract is duplicated across two repos, enforced only by the 400 at runtime. **All four are resolved by the target state; none blocks the split.**

#### E.5.8 Cross-domain auth (the registrable-domain constraint)

- **VERDICT: the `island.tours` + `dashboard.tripwheel.io` + `api.tripwheel.io` topology is viable** — 3 files on the public site (**corrected to FOUR**), 2 env vars, **zero backend code**, dashboard untouched. **It is a separate project from the split — do the split on the interim topology first.**
- **The crux asymmetry:** both browsers must **send** credentials to the API, but only the **dashboard's own server** must **read** the session cookie (`guardDashboard` **and** the layout's `getUserProfile(cookie)`). The public site's server does **not** — `getSessionCookie` appears only at `proxy.ts:87`, and public auth is client-side only (`wishlist-provider.tsx:63` `useSession()`). **Why: the public site is built on a `'use cache'` static shell, which cannot be per-user, so per-user data was already pushed to the browser by design. The caching architecture made the domain split easy as a side effect.**
- **Why "just add `api.island.tours`" does not work** — `dist/cookies/index.mjs:22`: `const domain = crossSubdomainEnabled ? options.advanced?.crossSubDomainCookies?.domain || (baseURLString ? new URL(baseURLString).hostname : void 0) : void 0;`

| Config | Cookie `Domain` | Public leg | Dashboard leg |
|---|---|---|---|
| `domain: '.tripwheel.io'` (static) | always `.tripwheel.io` | **broken** — the browser rejects a `.tripwheel.io` cookie from `api.island.tours` | works |
| `domain` omitted + dynamic `baseURL` | the API hostname | works (same-site, host-scoped, the public server never reads it) | **broken** — invisible to `dashboard.tripwheel.io`; guard + layout see nothing; login appears to succeed then bounces |

  **Conclusion: one Better Auth instance cannot emit cookies for two registrable domains.**
- **Evidence base** (installed `better-auth@^1.6.9` dist source + context7): cookie `domain` resolution **verified (source read)**; cookie defaults `sameSite:'lax'`, `httpOnly:true`, `secure` per prefix, `path:'/'` **verified**; `crossSubDomainCookies.enabled` without `domain` throws unless the baseURL is dynamic **verified**; the cookie getter is re-created per request when cross-subdomain is enabled **verified**; `isDynamicBaseURLConfig` = an object with an `allowedHosts` array **verified**; `bearer()` emits `set-auth-token` and adds it to `Access-Control-Expose-Headers` **verified**; **`bearer()` is ALREADY ENABLED** (`auth.instance.ts:177`) **verified**. **INFERRED, must be proven by test:** whether `resolved.options.baseURL` is per-request under a dynamic config.
- **Options:** **C — bearer token for the public site** (no new hosts, **no backend change — already enabled**; public: not HttpOnly, dashboard: still HttpOnly) — **RECOMMENDED**. **A** — two API hostnames + two auth instances (A-i two deployments / A-ii `authForHost(host)` in one process); HttpOnly on both; fallback if C's XSS trade is unacceptable. **B** — the public site proxies `/api/*` through its own origin; viable, worst latency; **must rewrite the `Set-Cookie` domain**; puts the public Next app on the auth-critical path. **D** — partitioned cookies (CHIPS): **REJECTED** (partitions per top-level site, the opposite of the need; Safari ITP still blocks). **E** — do nothing: **not viable.**
- **Option C change set:** backend `CORS_ORIGINS` += `https://island.tours` (1 env var) and `COOKIE_DOMAIN` = `.tripwheel.io` (1 env var); `bearer()` plugin **already enabled**; public `lib/auth-client.ts` global token capture + send (~10 lines); public `lib/api/wishlist.ts:16`, `lib/api/categories.ts:86` and **`lib/api/fetch.ts:29` — THE MISSING ROW** switch `credentials:'include'` → `Authorization` (1 line each); **dashboard: none.**
- ⚠️ **CORRECTION:** `lib/api/fetch.ts:29` carries `credentials: 'include'` and is imported by two public-only clients — **`lib/api/bookings.ts`** (`/bookings/quote`, `POST /bookings`, `/bookings/:id`; consumed by `checkout-form`, `checkout-processing`, `thank-you-hero-actions`, `cancel-request-card`, `lib/checkout/checkout.ts`, `lib/stores/booking-store.ts`) — **the entire booking flow, the revenue path** — and **`lib/api/availability.ts`** (`hub-trips-panel`, `use-availability-sync`). **Omit it and Safari users cannot complete a booking while Chrome users can, so it will not surface in testing.** *The original count was wrong because it came from grepping the literal `credentials: 'include'`.* ***Grep the helper's importers, not just the literal.*** **Do not delete `fetch.ts` reflexively during dashboard cleanup — it looks dashboard-shaped but the checkout needs it.**
- **Client pattern:**

```ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  fetchOptions: {
    onSuccess: (ctx) => {
      const t = ctx.response.headers.get('set-auth-token');
      if (t) localStorage.setItem('bearer_token', t);
    },
    auth: { type: 'Bearer', token: () => localStorage.getItem('bearer_token') || '' },
  },
});
```

  Both hooks are **global**, so a session refresh re-issuing a token is captured automatically; `useSession()` is unchanged; raw-`fetch` call sites need a factored `publicAuthHeaders()` helper.
- **Why business logic cannot break:** bearer carries **the same session token value from the same DB row** — the plugin's `after` hook lifts it out of the `Set-Cookie` the backend was already producing. Unchanged: roles, permissions, RBAC, `disableSignUp: true`, auto-user-creation on first booking, wishlist semantics, booking flow, every guard. **A transport swap, not an auth redesign. Bonus: bearer is CSRF-immune.**
- **The three costs, accepted knowingly:** (1) the public token is **not HttpOnly** — any XSS on `island.tours` exfiltrates it; **a strict CSP is the actual control, not a nice-to-have**; bounded to the USER role, cannot reach operator endpoints, and the dashboard keeps HttpOnly. (2) **Safari ITP caps script-writable storage at ~7 days** without first-party interaction — a dormant traveler is silently signed out; UX degradation, not a break; **verify, do not assume**. (3) **Operator password-reset currently lives on the public site** (`operator-forgot.tsx`, `operator-reset.tsx`) and must move to the dashboard with `portal`/`staff` — **verified 2026-07-17: these are DUPLICATED in both repos, not moved. Delete the PUBLIC copies.**
- **Verification — 15 checks, none reproducible on localhost** (`localhost:3000` → `localhost:5050` is same-site and `crossSubDomainCookies.enabled` is gated on `NODE_ENV === 'production'`): (1) prove/disprove per-request `baseURL` under a dynamic config [blocks A]; (2) sign in on `island.tours` in **Safari** with ITP on → session persists across reload; (3) same in **Firefox** with Total Cookie Protection; (4) wishlist add/remove/list on Safari; (5) `set-auth-token` readable cross-origin; (6) sign-out revokes **server-side**; (7) dashboard login works, cookie scoped `.tripwheel.io`; (8) `guardDashboard` reads the cookie, malformed → `/portal` + cleared; (9) `getUserProfile` resolves the role server-side; (10) a public USER token **cannot** reach an operator endpoint; (11) CSP blocks inline script; (12) Safari ITP 7-day cap — does a token survive a week; (13) session refresh re-issues `set-auth-token` and the global `onSuccess` captures it; (14) **no surviving `credentials: 'include'` on the public site**; (15) operator reset/forgot moved to the dashboard. **Checks 2 and 3 are the acceptance criteria. Check 14 is the one most likely to be missed — a stray `credentials: 'include'` fails only on Safari, only in production, and looks like an intermittent bug.**
- **What does NOT change:** server-to-server SSR (`x-internal-api-key`, no cookies); cache revalidation (**process** separation — unrelated, applies regardless); dashboard auth (same-site under every option); RBAC (server-side); `disableSignUp: true`.
- **Branding note:** `island.tours` for travelers, `tripwheel.io` for the platform is a normal SaaS shape (Shopify runs the same split), and it **reinforces** the argument for a distinct admin palette.

#### E.5.9 The domain-move runbook

**Prerequisite: Phase 9 green and the dashboard cut over on the interim topology. Do not attempt the domain move and the repo split in one window.**

| Step | Action |
|---|---|
| **1** | **Code the public site's bearer support (no domains involved).** Four files, public repo, on the CURRENT domains where cookies still work and bearer is redundant-but-harmless. **1a** `lib/auth-client.ts` global capture + send. **1b** Factor `publicAuthHeaders()` once and apply at the three raw-`fetch` surfaces: `lib/api/fetch.ts:29` (serves `bookings.ts` = the ENTIRE checkout + `availability.ts`), `lib/api/wishlist.ts:16`, `lib/api/categories.ts:86`. **Both transports work at once** — independently shippable and revertible. **Validation:** on the current domains, sign in, clear cookies, confirm the app still works off the bearer token alone. |
| **2** | **Delete the dashboard's leftovers from the public repo.** Verified DUPLICATED, not moved: `app/(login)/portal`, `app/(login)/staff`, `components/frontend/login/{operator-login,operator-forgot,operator-reset,operator-two-factor,staff-login}.tsx`. **Keep** `app/(login)/apply` and `app/(login)/bookings`. **DO NOT delete `lib/api/fetch.ts` — deleting it takes the checkout with it.** |
| **3** | **CSP on `island.tours` — BEFORE the move, not after.** It is the entire compensating mechanism for the security property being given up. Ship it first, verify it blocks inline script, then move domains. |
| **4** | **DNS + certs, no traffic yet.** Stand up all three; leave the old hosts serving. |
| **5** | **Backend env — the whole backend change: two vars, zero code.** `COOKIE_DOMAIN=.tripwheel.io`, `CORS_ORIGINS=https://island.tours,https://dashboard.tripwheel.io`. **This invalidates every existing session.** Everyone signs in again, once — schedule it and tell operators. |
| **6** | **Cut over, public first.** (1) Deploy public to `island.tours` (bearer live from step 1). (2) Deploy dashboard to `dashboard.tripwheel.io` — **zero code change**. (3) Point old hosts at new ones with 301s. (4) Update dashboard `REVALIDATE_TARGET_URL` → `https://island.tours/api/revalidate` and `NEXT_PUBLIC_BACKEND_URL` → `https://api.tripwheel.io`. **`NEXT_PUBLIC_*` are inlined at build time — this needs a REDEPLOY, not a restart.** |
| **7** | **Verify on real hostnames in a real Safari.** Run all 15 checks, plus **#16** complete a real booking end-to-end in Safari (quote → POST → thank-you → cancel) — the `fetch.ts` surface the earlier analysis missed — and **#17** hub trips panel + availability sync in Safari. |

**Rollback:** steps 1-3 revert freely (bearer is additive); step 5 restore `COOKIE_DOMAIN`/`CORS_ORIGINS` (sessions invalidate again); step 6 DNS back, with old hosts staying live until certain. **The only irreversible act is time: step 5 signs everyone out, twice if you roll back.**

#### E.5.10 Design-system spec

- **Four principles:** (1) **The neutral ramp is the design** — color is reserved for state and action; 90% neutral means the 10% carries meaning. (2) **Density comes from spacing and line-height, never from type size.** (3) **Every semantic state is a token triplet, never a palette class** — if a developer must choose `amber-100` vs `amber-50`, the system has already failed. (4) **Light and dark are one ramp at two lightnesses**, not two unrelated ramps sharing token names.
- **Palette decisions:** **Primary teal, hue 220** — (a) **it is not the storefront** (the public primary is coral `#e8611a`), and an admin tool that looks like the customer site invites acting on production thinking it is a preview; (b) it leaves the warm half free for semantics; (c) it carries domain meaning (maritime/Caribbean); (d) it survives at both ends of the lightness range. **Neutrals cool, hue 250, one ramp.** **Semantics: 4 states × 4 roles.** **Charts: 6 hues across the wheel.**
- **What was wrong with the old primary:** `oklch(0.5417 0.179 288.0332)`, stock shadcn violet, identical in light and dark; **all five chart tokens were variants of it** (hues 276-289 = one color five times), **likely why `statistics.tsx` forces mock branches on — the charts were never usable with real data**; and it is generic.
- **Neutral ramp (hue 250):** `--n-0` `oklch(1 0 0)` · `n-25` 0.985 · `n-50` 0.97 · `n-100` 0.94 · `n-200` 0.90 · `n-300` 0.84 · `n-400` 0.70 · **`n-450` 0.65 (ADDED — light `--line-control`)** · `n-500` 0.58 · **`n-550` 0.55 (ADDED — light `--content-subtle`)** · `n-600` 0.48 · `n-700` 0.38 · `n-800` 0.28 · `n-900` 0.21 · `n-950` 0.16 · `n-1000` 0.12. Chroma rises toward the middle and falls at both ends.
- **Brand ramp (hue 220):** `brand-50` 0.97/0.015 → `brand-900` 0.28/0.060. **Primary is `brand-600` in light and `brand-400` in dark — a primary must move between modes.**
- **Semantic ramps — the single highest-leverage artifact:**

| State | Hue | `-subtle` (bg) | `-border` | `-fg` | `-solid` |
|---|---|---|---|---|---|
| success | 150 | L 0.95 / dark 0.26 | 0.85 / 0.36 | 0.42 / 0.80 | 0.55 / 0.62 |
| warning | 75 | 0.96 / dark 0.27 | 0.86 / 0.37 | 0.44 / 0.82 | 0.70 / 0.75 |
| danger | 25 | 0.95 / dark 0.26 | 0.85 / 0.36 | 0.45 / 0.80 | 0.55 / 0.62 |
| info | 250 | 0.96 / dark 0.27 | 0.86 / 0.37 | 0.45 / 0.82 | 0.55 / 0.62 |

  Chroma: `-subtle` ~0.02, `-border` ~0.05, `-fg` ~0.12, `-solid` ~0.15. **Every role flips between modes.** **The rule, enforced by lint: a status surface is `bg-{state}-subtle border-{state}-border text-{state}-fg`. There is no other way to color a status.** No `amber-100`. No `emerald-700`. **If a state does not exist in this table, add it to the table.**
- **Chart ramp (6 hues, dark-mode lightness compensation):** chart-1 brand teal 220 · chart-2 coral 25 · chart-3 green 150 · chart-4 amber 75 · chart-5 violet 300 · chart-6 cyan 190. **Ordering constraint: chart-1 and chart-2 must be distinguishable under deuteranopia** (2-series is the common case) — **must be verified with a simulator, not assumed.**
- **ADDED `--rating`** — star-rating gold, light `oklch(0.77 0.16 75)` / dark `oklch(0.80 0.15 78)`. **Ratings are NOT a status:** mapping star fills onto the warning quartet would make a 4.8-star tour render like a warning. Decorative, no contrast target.
- **Token architecture (Tailwind v4):** `@theme` defines tokens and generates utilities; **`@theme inline` maps a utility name to a `var()` resolved at use time** — required when the value must switch by mode; mode-switching values live in `:root` / `.dark` with `@theme inline` pointing at them; `@custom-variant dark (&:where(.dark, .dark *));`.
- **Mode-independent primitives:** `--spacing: 0.25rem` (v4 derives multiplicatively; **do not restrict here — lint enforces**). Radius `none / sm 4px / md 6px / lg 8px / xl 12px / full` — **radius is NOT a function of theme; it must never appear in `.dark`.** Type scale, 6 steps: `2xs` 11px (**uppercase micro-labels ONLY**) · `xs` 12px · **`sm` 14px DEFAULT body + table cells** · `base` 16px (form inputs) · `lg` 20px · `xl` 24px · `2xl` 30px. Fonts `Inter Variable` + `JetBrains Mono`. Tracking tight −0.011em / normal 0 / caps 0.06em. Motion `--ease-out-quart`, `--ease-in-out`, `--duration-fast 120ms / normal 180ms / slow 260ms`.
- **Semantic layer:** `--surface/-raised/-sunken/-overlay/-inset`; `--content/-muted/-subtle/-inverse`; `--line/-strong/-subtle/**-control**`; `--primary/-hover/-content/-subtle/-subtle-content`; `--focus-ring`; the 4 state quartets; 6 chart tokens; `--shadow-xs/sm/md/lg`; `--sidebar/-content/-active/-active-content/-line`.
- **Base layer:** `* { border-color: var(--color-line) }`; `body { bg-surface text-content font-sans antialiased; font-size: var(--text-sm) }` (**14px default, not 12px**); `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`; `button { cursor: pointer }`.
- **Density strategy — density is spacing and line-height; type size is information hierarchy; they are different axes and must stop being conflated.** Row density has **two modes on data tables only**, persisted per user in `localStorage`, **Comfortable is the default**: Comfortable 44px row / `py-2.5 px-3` / `text-sm`; Compact 32px row / `py-1 px-3` / `text-sm`. **Font size does not change between modes.** Compact fits ~37% more rows without making anything less readable.
- **Type roles:** page title `xl` (one per page) · section/card title `lg` · **body/table cells/labels/buttons `sm` (~80% of the UI)** · form inputs `base` · dense meta `xs` (never primary content) · uppercase micro-labels `2xs` + `tracking-caps` (**the only permitted uppercase in the product**) · metrics `2xl` (overview cards only). **Hard rules: `text-[10px]` and every arbitrary `text-[...]` value are banned. Uppercase is permitted only at `2xs` on table headers** — which retires the `button.tsx` rule forcing `uppercase tracking-widest` on every button.
- **Spacing** — permitted steps `0.5, 1, 2, 3, 4, 6, 8, 12, 16` (59 distinct → 9); banned long tail `gap-5`, `gap-10`, `p-12`, `py-5`, `py-10`, `space-y-0`, half-steps beyond `0.5`. **AMENDED 2026-07-17 (user decision): the scale gains `1.5` (6px) and `2.5` (10px).** `1.5` is used **128 times** — the third most-used spacing value, ahead of `8`; with `2.5` (47) that was ~60% of all spacing violations. **Not drift; a scale missing a step it genuinely needs.** It dropped the rule from **232 → 95 warnings**. **The `SPACING` regex in `eslint.config.mjs` and the `--spacing-*` tokens in `globals.css` are the same decision expressed twice — change them together.** Context values: icon→label `gap-2` · form field stack `space-y-4` · related controls `gap-3` · card padding `p-4`/`p-6` · section stack `space-y-6` · page gutter `p-6`.
- **`StatusBadge` — the keystone. Build this first** (impact 4 / effort 2). Variants `neutral | success | warning | danger | info`; anatomy `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium`; color **always the triplet** `bg-{v}-subtle border-{v}-border text-{v}-fg`; **non-color cue: a leading 8px dot AND the text label — mandatory (WCAG 1.4.1 Level A, not decoration)**; optional leading icon `size-3`. Every status declared in one map: `BookingStatus` → ON_HOLD warning · PENDING warning · CONFIRMED success · CANCELLED danger · COMPLETED neutral; plus `PaymentStatus`; `TourStatus` → DRAFT neutral · LIVE success · PAUSED warning · ARCHIVED neutral; `SpotlightState`. **Acceptance:** `grep -E "(bg|text|border)-(amber|emerald|green|red|rose|sky|violet|blue)-[0-9]" components/` returns **zero**. **Adding `StatusBadge` without deleting the 149 call sites reproduces the codebase's central failure.**
- **Forms:** input height 36px default / 32px compact · **input font `--text-base` 16px** (**iOS Safari force-zooms the viewport on focus of any input below 16px — a functional requirement, not a preference**) · radius `sm` · border `--color-line`, focus 2px `--focus-ring` outline offset 2 · label `sm` medium `--content` · helper `xs` `--content-muted` · error `xs` `--danger-fg` **with an icon** · required explicit `*` **and** `aria-required` · disabled `opacity-60` + `cursor-not-allowed`.
- **Tables — ONE `DataTable`:** header `2xs` uppercase `tracking-caps` `--content-muted` sticky 36px · row 44/32px, `hover:bg-surface-sunken`, `--line-subtle` divider · **zebra none** (zebra + hover + selection is three competing signals) · numeric right-aligned `--font-mono` tabular-nums · selection checkbox column + header select-all + a bulk bar on `count > 0` · **pagination server-side only** · loading skeleton matching real row height and column count · empty = icon + one-line title + one-line explanation + primary action · error inline with retry · page sizes `[10, 25, 50, 100]` declared **once**.
- **Disclosure — adopt the sheet:** **Sheet** (right, 480/640/800px) to inspect or edit a record without losing list context (booking details, payment details, quick-edit, media inspector) · **Dialog** (centered, ≤560px) for a focused decision that must interrupt (destructive confirm, password change) · **AlertDialog** for destructive confirm **only** (delete, archive, cancel booking) · **Popover** for lightweight pickers (date, column visibility) · **Full route** for sustained multi-section work (tour editor, entity editors) · **Inline expand** for a row's own detail (schedule rows). **Rule: `Dialog` and `AlertDialog` must stop being interchangeable. Destructive → `AlertDialog`, always.**
- **Buttons:** retire the forced `uppercase tracking-widest text-xs`. Variants `primary` (`bg-primary text-primary-content`, hover `bg-primary-hover`) · `secondary` · `ghost` · **`destructive` = `bg-danger-solid text-n-0`, a SOLID fill** ("Delete tour" should not look quieter than "Save") · `link`. Sizes **8 → 5**: `sm` 32px · `md` 36px default · `lg` 40px · `icon-sm`/`icon` 32/36px square. Text sentence case at 14px.
- **Card:** `bg-surface-raised border border-line rounded-lg shadow-xs`, `p-4`/`p-6`. **No nested cards** — a card inside a card is a section; use a `--line-subtle` divider. **Sidebar:** `--sidebar` bg, 240px expanded / 56px collapsed, groups by `2xs` uppercase labels, active = `bg-sidebar-active text-sidebar-active-content` **plus a 2px leading indicator** (not color alone), persisted collapse. **Toasts (sonner):** success 3s, **error sticky until dismissed** (an operator must not miss a failed save), bottom-right, max 3 stacked, every toast carries an icon. **Empty states:** icon `size-8` `--content-subtle` + `sm` medium title + `xs` `--content-muted` explanation + primary action. **Loading:** skeletons mirror the real layout's dimensions; **never a spinner for page-level loads.** **Icons — lucide-react only:** inline with `sm` = `size-4` · buttons `size-4` · micro/badge dots `size-3` · empty states `size-8`; decorative → `aria-hidden="true"`; **icon-only buttons → `aria-label` required.**
- **shadcn inventory actions:** `badge.tsx` **REPLACE** → `StatusBadge` · `button.tsx` **EXTEND** (drop forced uppercase/tracking; 8 sizes → 5; solid destructive) · `table.tsx` **EXTEND** (retarget header to `2xs` + `tracking-caps`) · `sidebar.tsx` **EXTEND** (**fix `hsl(var(--sidebar-border))` at `:478`** — B-4) · `chart.tsx` **EXTEND** (replace `#ccc`/`#fff` THEMES literals with tokens; wire the 6-hue ramp) · `sheet.tsx` **ADOPT** (installed, unused; becomes the standard secondary-disclosure primitive) · `input, label, field, textarea, checkbox, select, card, tabs, dialog, alert-dialog, dropdown-menu, popover, tooltip, skeleton, separator, collapsible, command, calendar, avatar, sonner` **AS-IS** (re-token only) · `multi-select.tsx` **STANDARDIZE** (custom, keep — 9 consumers) · `progress.tsx` **KEEP** (0 importers today, but the translation console needs completeness bars) · `breadcrumb.tsx` **RESOLVE** (two implementations) · `drawer.tsx` **DROP** (vaul; only consumer was the dead `data-table.tsx`) · `toggle.tsx`, `toggle-group.tsx` **DROP** · `input-otp.tsx` **DROP** (public site only) · `input-group.tsx` **REVIEW**. **Dependencies removed:** `@hugeicons/react`, `@hugeicons/core-free-icons`, `vaul`. **Keep `@dnd-kit`.** **Fonts five → two:** ADD Inter Variable · KEEP JetBrains Mono (21 usages; refs, IDs, money) · DROP Playfair Display (70 usages — an editorial display serif in an operational CRM) · DROP DM Sans (1) · DROP General Sans (3) · DROP Noto Sans.
- **Enforcement — lint** (*a design system that is not lintable is a suggestion*): (1) no numeric Tailwind palette classes — ESLint `no-restricted-syntax` on className regex; (2) no hex/`rgb()`/`hsl()`/`oklch()` in components; (3) no inline `style={{}}` except TanStack column sizing (allowlist); (4) spacing restricted to `0.5, 1, **1.5**, 2, **2.5**, 3, 4, 6, 8, 12, 16` — regex on `(p|px|py|m|gap|space-[xy])-`; (5) no arbitrary `text-[...]`; (6) uppercase only at `--text-2xs` (review); (7) every icon-only button has `aria-label` (`eslint-plugin-jsx-a11y`); (8) contrast gate. **Rules 1-5 are mechanical and land WITH (in practice BEFORE) the token system. A migration that introduces tokens without the lint that forbids the alternatives will regrow the 187 classes within a quarter.**
- **Accessibility gate — the merge gate for the token system:** (1) `--content` on `--surface` ≥ 7:1 (AAA); (2) `--content-muted` on `--surface` ≥ 4.5:1; (3) `--content-subtle` on `--surface` ≥ 4.5:1; (4) every `{state}-fg` on its `{state}-subtle` ≥ 4.5:1; (5) `--primary-content` on `--primary` ≥ 4.5:1; (6) `--focus-ring` on `--surface` and `--surface-raised` ≥ 3:1; (7) ~~`--line` on `--surface`~~ → **`--line-control` on `--surface` and `--surface-raised` ≥ 3:1 (AMENDED)**; (8) all of 1-7 **in both modes**; (9) chart-1 vs chart-2 under deuteranopia and protanopia, distinguishable in a simulator; (10) every `StatusBadge` variant carries a **non-color** cue. **Any value failing its target is adjusted here, before implementation — not after.**
  > **MEASURED 2026-07-17: the gate ran RED and caught two defects in the spec's own palette.** (1) **`--content-subtle` was unfixable as written** — `n-500` in BOTH modes, but light needs `L ≤ 0.556` and dark needs `L ≥ 0.567`: **the windows do not overlap.** Measured light `n-500` = **4.10:1 FAIL**; fix = `--color-n-550` for light (**4.64:1**), dark keeps `n-500` (**4.75:1**). (2) **Check 7 tested the wrong token and could not be passed** — `--line` on `--surface` = **1.29:1** light / **1.39:1** dark, `--line-strong` 1.56/2.03; reaching 3:1 forces `L = 0.658`, a near-black hairline around every card, row and input. **WCAG 1.4.11 applies only where the boundary is the ONLY thing identifying a control**, so `--line`/`--line-strong` are decorative with **no** target, and the new **`--line-control`** (light `n-450` **3.09:1**, dark `oklch(0.50 0.014 250)` **3.39:1**) is the tested token, with the shadcn `--input` alias pointing at it. **Also fixed:** `--warning-foreground` was near-white on `oklch(0.769)` amber and had never passed contrast — now dark ink.
- **Motion:** **No `whileHover` motion** — no scale-ups, lifts or nudges; hover is a color/opacity CSS transition, full stop. **Press is `whileTap` scale DOWN** (0.97 for buttons). Durations from tokens (`fast` hover/focus · `normal` disclosure · `slow` route/sheet). **`prefers-reduced-motion: reduce` → all transitions to 0.01ms. Mandatory.** **A CRM is not a place for delight animation. Motion has one job: explain where a thing came from.**
- **Impact/effort order: 3 (lint), 1 (StatusBadge), 4 (fonts), 5 (icons), 2 (tokens), 8 (sheet), 6 (type scale), 7 (DataTable), 9 (buttons), 10 (sidebar `hsl()` fix). Lint first** — cheapest, and the only one that stops the problem coming back.

#### E.5.11 UX-strategy spec (constraint: no business-logic, API-contract or backend-behavior changes)

- The IA problem, the four groups, the per-role IA, the global layout, the tour progressive-disclosure redesign and the Translation Console are covered in E.3.2-E.3.5.
- **Click-depth summary:** publish a new tour ~25-30 clicks / 5 tabs → **~12, guided by the readiness rail** · translate a tour to 6 locales **300+ clicks, ~120 saves, 7 tabs → ~30 clicks, 6 saves, 6 screens** · change one price 5-6 → **3** (`Cmd+K` → tour → Pricing) · add a date exception 8-10 → **4** · find a booking by ref: scroll/search the list → **2** (`Cmd+K`) · answer "is this tour ready for Germany?": **impossible → 1** (matrix).
- **Code targets per module:** Tours 10,363 → ~6,500 · Entity modules ×4 ~10,500 → ~4,000 · Translations (5 forks) ~1,400 → ~450 · Bookings/Payments 1,529 → ~1,100 · Media 1,949 → ~1,400 · Settings 1,673 → ~1,300 · Profile 1,188 → ~900 · Spotlight/Locals 1,633 → ~1,000 · Operators 1,001 → ~800 · Dead code 1,574 → **0** · **Total ~35,300 → ~19,500 (−45%)**.
- **UX ranked by impact/effort:** 1 `StatusBadge` + semantic tokens (5/2 = **2.5**) · 2 command palette (4/2 = **2.0**) · 3 publish readiness as a real contract (4/2 = **2.0**) · 4 create 30 fields → 4 (4/2 = **2.0**) · 5 booking detail → Sheet (3/2 = 1.5) · 6 media pagination, unblock item 101 (3/2 = 1.5) · 7 **Translation Console (5/4 = 1.3)** · 8 Tours 13 tabs → 4 routes (5/4 = 1.3) · 9 one `EntityTable` (4/4 = 1.0) · 10 entity editor unification (4/4 = 1.0). **Sequence 1, 2, 3, 4 first** (all ratio ≥ 2.0, all independent, all shippable in isolation), then 7, then 8, 9, 10.
- **Duplication hotspots (measured by `diff`):** translation forms 4 files ~1,145 LOC (dest 272 vs cat 272 diff ≈ 30 lines, all renames) · SEO tabs 4 files ~1,448 LOC (dest 362 vs cat 366 = 139; vs hub 361 = 133; vs coll 359 = 137) · table scaffolds 10 (dest 352 vs cat 332 = 138; vs hubs 361 = 202) · row actions 3+ (dest 185 vs cat 185 = 139) · quick-edit dialogs 3, 422 LOC (dest 142 vs cat 142 = 64) · delete confirms **4 competing abstractions + 4 clone wrappers** (`confirm-dialog.tsx` 72/2 consumers · `common/deactivate-dialog.tsx` 70 · `common/force-delete-dialog.tsx` 76 · `media/delete-confirmation-dialog.tsx` 55; wrappers destination/category/hub-delete-dialog all 47 lines with mutual diff 44, plus operator-delete-dialog 52; **`Dialog` and `AlertDialog` both used for semantically identical destructive confirms**) · status badges 4 conventions (**the audit undercounted: there were SIX**) · list-view shells 4+ (bookings vs payments = the same 500ms-debounce state machine twice) · detail shells 4 ~200 LOC · `trip-form` vs `trip-details-tab` 2 files 1,764 LOC near-identical.
- **What is genuinely good (a redesign discarding these would be a regression):** (1) **the API boundary is already clean** — two deliberately separate fetch stacks with different auth models and retry strategies, and correct reasoning about each (`public/fetch.ts:31-33` avoids `Math.random()`/`Date.now()` because `'use cache'` bans them; `fetch.ts:19-22` explains why the client stack *can* use jitter); (2) **`userActions.ts:41-48`** deliberately uses React `cache()` instead of `'use cache'`; (3) **`apiFetch` retries GETs only** — "a retried POST/PATCH/DELETE could double-apply a mutation"; (4) **`FaqManager` (477 LOC)** consumed identically by all four entity modules with **zero forks**; (5) **`image-selector-field.tsx`** — 10 consumers, no forks; (6) **all 10 tables use TanStack consistently** — nobody hand-rolled a `<table>`; (7) route-level server/client split is correct where it exists; (8) **`cache-revalidation.ts` is thoughtfully specified** — one bug (B-1), not a bad design.

#### E.5.12 Component-architecture rules (R1-R12, D1-D5)

- **R1 · Server by default. `'use client'` is opt-in and must be justified.** A file gets it **only if it uses** `useState`/`useReducer`/`useEffect`/`useRef`-for-DOM, an event handler, a browser API, a Context consumer, or a client-only library (RHF, TanStack Query, Recharts, framer-motion, dnd-kit). **If none apply it is a Server Component. No exceptions.** *`trip-detail-shell.tsx` is the canonical violation: 49 lines — a `Breadcrumb`, an `<h1>`, a `<Skeleton>`, `{children}` — marked `'use client'`. The directive is inert anyway because a client parent imports it, **which is exactly what makes it insidious: it costs nothing to add and nothing visibly breaks, so it spread to 161 files.***
- **R2 · The boundary goes at the deepest leaf that needs it.** **Corollary:** a server component may render a client component, but not vice versa — **except through `children`.** Passing server-rendered JSX as `children` into a client component is the primary tool for keeping the boundary deep. **Use it.**
- **R3 · Data fetching belongs to the server unless it is user-interactive.** The entity being edited → **server, in `layout.tsx`, once** (every tab needs it; today half the tabs get it as a prop and half re-query). Lists with URL-driven state → **server, from `searchParams`** (the URL is already the state). Child collections mutated in place → TanStack Query (client) — correct today. Session/role → **server, in `layout.tsx`** — correct today, **do not touch (R11)**. Anything behind a user interaction → client.
- **R4 · Never a client boundary for a provider you can hoist.** Mount at the shallowest node that *needs* it, not the shallowest node available.
- **R5 · One file, one responsibility. Hard limits:** component soft 150 / **hard 250** · hook 100 / 200 · API module 200 / 400. **The limit is a smoke alarm, not a rule of taste.**
- **R6 · Business logic never lives in a view file.** Moves: `scheduledSlotsForDate` (`trip-schedules-tab.tsx:770-790`) → `lib/tours/availability.ts` · `refundDue`, `paymentModelLabel` (`booking-columns.tsx`, exported and imported by 2 others) → `lib/bookings/refund.ts` · `deriveTourBadge`, `formatTourSignals` → `lib/tours/derive-badge.ts`, `signals.ts` · `toSlug` (duplicated in `trip-form.tsx` + `trip-details-tab.tsx`) → `lib/utils/slug.ts`, **one copy kept in sync with the backend util** · `numOrNull`, `numOrUndef`, `strOrNull` (`trip-locations-tab.tsx:78-80`, verbatim in `trip-pickup-locations-tab.tsx:58-60`) → `lib/utils/coerce.ts` · `durationHint` (`trip-details-tab.tsx:352-364`) → `lib/tours/duration.ts` · the local `buildQuery` dup → delete, import `lib/api/query.ts`. **Test: if it can be unit-tested without React, it does not belong in a `.tsx`.**
- **R7 · Extract a shared component only on the third occurrence — and then delete the forks.** **A PR that adds a shared component and does not delete every fork it replaces is incomplete and must be rejected.** Not "follow-up ticket". Same PR. **The only rule in this document with teeth against the specific way this codebase decays.**
- **R8 · Composition over configuration.** `<EntityTable module="tours" showBulk showCommission={role==='ADMIN'} variant="compact" />` is **BAD**; slotted `<DataTable data={...} columns={...}>` with `DataTable.Toolbar` / `DataTable.BulkBar` children is **GOOD**. **A boolean prop that gates JSX is a slot wearing a disguise.** The 813-line `data-table.tsx` failed partly because it was configuration-shaped: adapting it to a real module was harder than writing a new table.
- **R9 · One system per kind of state. No overlap.** Server data → **TanStack Query. Only.** Form state → **react-hook-form + zod. Only.** URL state (page, sort, filter, tab) → **`searchParams`. Only.** Ephemeral UI → `useState`, colocated. Cross-cutting (role, sidebar collapse, upload progress) → Context / zustand. *Today four systems overlap: `AgeBandRow` holds **8 `useState`s**; `AddOnRow` 5; the schedules add-form 6 **plus a hand-rolled `errors` object**; `ExceptionsSection` 5 + errors. And **two validation systems coexist** — zod resolvers in some rows, imperative `if (!HHMM.test(...))` in others (`trip-schedules-tab.tsx:423`, `:928`).* **All `useState` row editors migrate to RHF. All imperative validation migrates to zod. No exceptions.**
- **R10 · URL state is the default for anything a user would bookmark, share, or expect back to work.** Page, sort, filter, search, tab, and selected-record all live in the URL; tabs become **routes**.
- **R11 · Do not "optimize" the auth path** (the three load-bearing properties, E.5.5).
- **R12 · Delete every `as unknown as Resolver<T>`.** Five occurrences. **That cast is the type system reporting a real modeling problem and being told to be quiet.** Fix the schema (use `z.coerce` consistently, or type the form values to match) and the cast disappears on its own. **If it does not disappear, the model is still wrong.**
- **Dependency direction:** `app/ → components/ → hooks/ → lib/api/ → lib/ → types/`. **Arrows point right. Never left. Never sideways at the same layer.** **D1** `lib/` **never** imports from `components/` (violated today: `lib/tours/listing.ts:5-6`). **D2** `types/` imports nothing but `types/`. **D3** `components/<module>/` never imports `components/<other-module>/` — shared goes to `components/common/`. **D4** `hooks/<domain>/` may import `lib/api/<domain>` and `types/`, nothing else (violated today: `hooks/tiers/use-tiers.ts` and `hooks/locals-favourites/*` import `hooks/trips/use-trips`). **D5** **No file outside this repo** — `grep -rn "@/components/frontend\|@/lib/api/public" .` returns zero, forever. **Enforce D1-D5 with `eslint-plugin-import/no-restricted-paths`. Rules that are not lintable are aspirations.**
- **Directory structure:** `components/ui/` forked shadcn primitives (imports: react, radix, `cn` — **NOTHING else**; **if a file in `ui/` imports from `lib/api/`, it is not a primitive**) · `common/` cross-module (StatusBadge, ConfirmDialog, EntityShell, SeoForm, FaqManager — **earns its place by R7**) · `data-table/` THE table system · `shell/` sidebar, header, nav, command palette · `skeletons/` (typo fixed) · `<module>/` **private — reaching into another module's folder is D3**.
- **The `DataTable` system:** `data-table.tsx` (client, TanStack shell + slots) · `data-table-toolbar.tsx` (client — search, filters, column visibility) · `data-table-bulk-bar.tsx` (client, appears on selection) · `data-table-pagination.tsx` (client, server-driven only) · `data-table-skeleton.tsx` (**SERVER**, matches real row height + column count) · `data-table-empty.tsx` (**SERVER**, icon + title + explanation + action) · `use-table-state.ts` (client, URL-synced page/sort/filter/search). `use-table-state` also retires the duplicated 500ms-debounce state machine written twice. **Adoption is the deliverable, not the component. The PR that lands `data-table/` deletes all 10 forks and the dead `data-table.tsx`. If it lands with 10 forks alive, we have written an eleventh table.**
- **Existing table capability matrix:** destinations / hubs / categories — sort, filter, row-selection, column-visibility, `TableSearchInput`, **server** pagination, skeleton, 3 bulk actions, row actions · collections / attributes / spotlight — sort, filter, no row-selection, column-visibility, `TableSearchInput`, **client** pagination, **NO skeleton**, no bulk, no row actions · operators — sort, no filter, row-selection, no column-visibility, **own `<Input>`**, server, skeleton, partial bulk, row actions · bookings — sort, no filter, no row-selection, column-visibility, `searchValue` prop, server, skeleton, no bulk, row actions · payments — same as bookings but **no row actions** · locals-favourites — sort, filter, no row-selection, column-visibility, `searchValue` prop, server, skeleton, no bulk, inline actions.
- **Testing layers:** pure logic (`lib/`) → vitest (slug, refund, availability, coerce, tag mapping) · contract → vitest + live backend (rbac vs `/auth/permissions`; types vs Swagger) · component → RTL (`StatusBadge` variants, `DataTable` states) · E2E → Playwright (the parity checklist). **Priority: the tag-mapping tests and the rbac contract test. Both guard silent failures — the only class of bug this migration can produce that nothing else will catch.**
- **Definition of done (per module):** route files are Server Components · `'use client'` only on leaves that need it · no file over 250 lines · no business logic in `.tsx` · **every fork it replaces is deleted in the same PR** · one state system per kind · page/sort/filter/tab in the URL · zero palette classes, zero hex, zero arbitrary `text-[...]` · `StatusBadge` for every status with its non-color cue · loading, empty and error states exist · dependency direction clean (D1-D5) · no `as unknown as`. **Target 161/207 client → ~110/190 (~58%) — not zero; this is a CRM and forms and tables are genuinely interactive. The wins are concentrated in shells, rails, tab navs, skeletons, empty states and column definitions: the things that never needed to be client and became client by contagion.**

#### E.5.13 Backend requests (blockers) and cross-repo contracts

| # | Request | Unblocks | Priority |
|---|---|---|---|
| **A1** | `GET /dashboard/stats` returning real revenue / bookings / tours / customers + recent activity | Kills `dashboardActions.ts` (B-3). **The first screen after login is currently fabricated data.** | **High** |
| **A2** | `GET /reviews` + moderation transitions | The `reviews` stub | High |
| **A3** | `GET /users` (paginated, filterable) + role management | The `users` stub | Medium |
| **A4** | Machine-translation job `POST /tours/:id/translations/:locale/generate` setting `isMachineTranslated: true` | The console's pre-translate step. **The flag, payload field and badge already exist end-to-end; only the generator is missing.** | **High** |
| **A5** | Bulk schedule create `POST /availability/schedules/bulk` accepting `{ weekdays[], startTimes[] }` | Collapses 21 sequential POSTs to 1 | Medium |
| **A6** | Bulk image reorder `PATCH /tours/:id/images/order` accepting an ordered id array | Drag-drop reorder in 1 request instead of 2-per-arrow | Medium |
| **A7** | Payment detail + refund transitions | Payments is currently a dead end | Medium |
| **A8** | Backend-emitted cache revalidation via the existing outbox/BullMQ | The correct end-state; removes the dashboard's knowledge of the public site | Medium |

Also blocked, no request number: **media tags** (needs a backend field) — Low; **profile session list** (needs an endpoint) — Low; **translation "source updated" conflict flag** (verify whether `updatedAt` on the EN translation suffices).

**Contracts that survive the split only by discipline:** **B1** `lib/config/rbac.ts` ↔ `backend/src/config/roles.config.ts` + `prisma/enums.prisma` — failure = an operator sees a button that 403s, or is denied something they may do; guard = backend exposes `GET /auth/permissions` returning the role→permission map and a dashboard test asserts its local map matches (**cheap, and it kills a whole class of bug**) · **B2** `types/*.ts` ↔ backend DTOs — failure = runtime `undefined` on a renamed field; guard = generate types from Swagger in CI and diff, or a contract test per module against a live backend · **B3** `CacheTag` union ↔ the public site's `cacheTag()` calls — failure = **silent staleness**; guard = the public endpoint's 400-on-unknown-tag · **B4** `lib/config/derived-attributes.ts` ↔ the backend's derived-attribute list — failure = the dashboard offers an attribute the backend rejects; guard = contract test · **B5** `COOKIE_DOMAIN` ↔ backend `crossSubDomainCookies.domain` — failure = login loop; guard = deployment checklist · **B6** `INTERNAL_API_SECRET` ↔ backend — failure = SSR throttled; guard = deployment checklist · **B7** `REVALIDATE_SECRET` ↔ public site — failure = revalidation 401s silently; guard = it must be logged, not swallowed. **The honest summary: the split trades one large implicit coupling (a shared process) for seven small explicit ones. That is the right trade — explicit couplings can be tested, implicit ones cannot — but it is only an improvement if the guards actually get built. B1, B2 and B3 are the ones that will bite.**

**Open questions:** C1 the **weather widget** (default: carry it as-is; removing it is a product decision — flagged as the only external service dependency in the dashboard) · C2 the **tour/trip rename** (default: defer, to keep the extraction diff reviewable) · C3 `app/(login)/apply` and `app/(login)/bookings` (default: stay with the public site) · C4 `locals-favourites-list-view.tsx` orphan status (**verify before deleting — later proven LIVE**) · C5 the public site's cross-site auth (raise before DNS cutover; does not block the dashboard).

#### E.5.14 Extraction status (as recorded)

- **Stage A (Decouple, phases 1-4): done** in the monorepo — B-1 fixed, the 7 imports severed, `components/` sorted by owner, **2,725 LOC of dead code deleted** (vs >1,574 estimated) across 20 files. **Stage A has value even if the split never happens.**
- **Stage B (Extract, phases 5-9): 5-8 done, 9 automated half done.** New repo exists, serves at `/` on port 3001, deploys to Vercel, reaches the backend only over HTTP. **Phase 9: NO REGRESSION FOUND** — 171 component files compared (95 byte-identical, 76 differing *only* in import paths or the `/dashboard/x` → `/x` prefix, **0 behavioural**), route sets identical 19/19; **227 e2e tests run against both dashboards — 102 failures identical name-for-name, 0 failing only on old**, and the 4 failing only on new **fail on old too when run in isolation** (database residue). **The suite is ~45% red on BOTH sides — it is measuring its own decay, not the extraction.**
- **Stage C/D (Redesign, phases 10-20):** Phase 10 lint rules **DONE** (8 rules as `warn`, **428 warnings / 0 errors**, all validated firing) · Phase 11 token system **DONE** (gate GREEN, 34 checks × 2 modes; it caught 2 defects in the spec's own palette) · Phase 12 StatusBadge **DONE** (**zero palette classes repo-wide**; **6 conventions deleted — the audit counted 4**) · Phase 13 fonts/icons/primitives **DONE** (Playfair dropped by user decision, **hugeicons KEPT by user decision — overrides D-7 and the grep validation is WAIVED**, B-4 fixed, buttons de-shouted) · Phase 14 command palette + IA **DONE** · Phase 15 DataTable **DONE** (**11/11 forks converted — the audit counted 10**; 3,552 → 2,524 LOC including the new system) · Phase 16 Tours create + readiness **NEXT** · Phases 17-20 not started · Stage E (21-23) blocked on A1/A4/A2/A3/A5/A6/A7.
- **Owed to the user (cannot be agent-completed):** the Vercel project for `dashboard.islandtours.esenc.cloud` + DNS, and adding that origin to the backend's **real** `.env.production` `CORS_ORIGINS` (only the committed examples were changed) — **a `*.vercel.app` URL cannot authenticate** (the session cookie is scoped to a different registrable domain), **so there is no "deploy now, domain later"**; parity checks **#2, #9** on staging; parity **#6, #7, #10, #43-45, #49** and the visual half of the module rows; **the sidebar-font visual delta** (DM Sans + General Sans → Noto Sans); the visual check of the 6 tour pickers.
- **Five open decisions:** the trips→tours rename timing (**DEFERRED**), the weather widget (**OPEN**), the `revalidateTag` profile (**RESOLVED — `{ expire: 0 }`, `'max'` deferred**), the Phase 17 rollback shape (**OPEN**), dropping Playfair Display (**RESOLVED — dropped**).
- **Risk register:** cache revalidation failing silently (Critical) · the publish gate blocking a legal action (High) · **forks surviving the shared component (High — this is *how this codebase decayed*)** · `COOKIE_DOMAIN` mismatch → login loop (High) · contrast gate skipped (High) · the translation schema missing a field (High) · the tours refactor being too large (Medium) · rbac/types drift post-split (Medium) · the public site's cross-site auth breaking (**High, not ours**) · lint-as-`error` blocking all work (Medium — land as `warn`, flip at 20).
- **Governing principles:** (1) extraction and redesign never interleave; (2) decoupling work lands in the current repo first; (3) every phase is independently revertible — one phase, one PR, one revert; (4) **a PR that adds a shared component and does not delete its forks is rejected — non-negotiable**; (5) **lint lands before the pattern it protects.** **The gate at Phase 9 is the plan's spine: extraction proven before redesign begins. Break it and every subsequent bug becomes an argument about whether the move or the redesign caused it.**
- **Two traps recorded from execution:** ⚠️ `git mv` from `frontend/` stages into `frontend/.git`, **a different repo on a different branch** — 23 renames landed in the wrong index. **Run every git command from the repo ROOT.** ⚠️ **Never let a comparison's failure mode look like success:** a `diff -rq` with stderr suppressed read a **missing directory** as "identical", and a zsh `ls *.tsx *.ts` **aborted on any directory with no `.ts` file**, silently skipping it — both inflated parity. The same class of error appears in lint (**a regex selector that fails to parse reports zero and looks identical to a clean codebase** — every rule was proved to fire against positive **and negative** cases before being trusted) and in grep (**a `grep` over a missing path returns nothing and reads exactly like a clean result** — check the directory exists first).
- ⚠️ **The login surfaces keep the public brand tokens, permanently.** "The split resolves F-3 for free" was **WRONG** — `/portal` and `/staff` are built on the PUBLIC site's `--it-*` tokens (**81 usages across 20 tokens**, wrapped in `.frontend-root`), so dropping the import renders them **unstyled**. Resolution (user): fork the tokens into `app/login-tokens.css` (130 lines, reduced from 524, scoped by `.frontend-root`) — **intentional architecture, not debt; the token phase must leave the login surfaces alone.** **Enabling fact:** ZERO files in `components/dashboard`, `components/ui`, `components/onboarding` or `app/(dashboard)` use `--it-*`. **A green build proves nothing here — Tailwind silently skips unknown utilities**; verified in the BUILT CSS (14/14 utilities generate).
- ⚠️ **External theme dumps and this token system cannot coexist.** A shadcn/studio dump applied three times overwrote 27 ui files, **reduced `lib/utils.ts` to bare `cn` (deleting `formatDate`/`toSlug`/`formatFileSize`)**, swapped fonts and colors, and introduced a **`--radius` calc CYCLE that collapses every radius**. **Taste changes route through the token block** — the Vega radius re-cut was ONE edit. **Frequent checkpoint commits made each overwrite a one-command restore.**

---

### E.6 Shared UI kit rules

- **Compose the shared settings form kit; never hand-roll form chrome.** The kit lives in `components/settings/settings-fields.tsx` — `SettingsCard`, `TextField`, `TextareaField`, `ImageField` (plus the new `VideoField`) — and is **the kit every settings form already uses**. The Homepage editor's `HomepageSectionCard` / `HomepageField` were re-implementations and **both duplicates were deleted**; their label-by-consequence and show-the-fallback behaviour survived as **`describeField(where, value, fallback)`**, which builds the `description` string the shared field already accepts — **so no new component was needed.**
  - ⚠️ Tension to resolve: the design spec separately asks to **fold `settings-fields.tsx` into the shared form primitives**, because as it stands it is "a settings-local design system no other module uses". The Homepage review resolved in the opposite direction — **compose the existing kit rather than fork it** — which is the operative rule today.
- **Use the shared `EntityTabs` for any tabbed entity/singleton editor.** The Homepage editor uses `EntityTabs` and **no `EntityDetailShell`**, because it is a top-level tabbed singleton, same as Settings. Tabs are ordered by **where the sections appear on the page**, so scanning the tab row scans the page top to bottom.
- **Use the shared `FaqManager` for every FAQ surface.** `faq/faq-manager.tsx` (477 LOC, 4 entity-module consumers, **zero forks**) is the proof the shared-component approach works — **it was achieved once; do it four more times.** It composes with the generic `faqGroupsApi`, which builds `{basePath}/{id}/faqs/groups` for every entity — which is why the homepage kept `:entityId` in its path and needed **zero dashboard changes**.
  - ⚠️ `FaqManager` maps a `basePath` to a Translation-Console type via `CONSOLE_TYPE_BY_BASE`. **The `?? 'destination'` fallback was removed: an unmapped `basePath` now renders NO pointer, because a wrong link is worse than a missing one.** That silent default is what turned a missing entry into a broken link instead of a visible error.
- **EVERY media field goes through the media library — never a pasted URL.** The featured-experience video was a raw `<Input>`, **the one field in the dashboard not backed by the media library**. There was no video picker, **so one now exists**:
  - `MediaGalleryManager` and `MediaSelector` take a **`kind` restriction**, which **seeds the type filter AND omits the setter, hiding the type dropdown entirely** — a field that can only accept a video should not offer "All types".
  - **Selector toasts take their noun from the kind**, so a video picker never says "image".
  - `VideoSelectorField` + a `VideoField` in the shared kit render **a real `<video>` preview**.
  - ⚠️ **Kind is tested with `getMediaKind`, never `resourceType === 'video'`, because Cloudinary stores AUDIO under resourceType `video`** — the raw check would accept an mp3 for a video slot.
- **Other proven shared components (do not fork):** `media/image-selector-field.tsx` (296 LOC, **10 consumers, no forks**) · `table-search-input.tsx` (67 LOC, 6 of 10 tables) · `rationale-translation-tabs.tsx` (97 LOC, 3 consumers) · `common/deactivate-dialog.tsx` (70 LOC, **but only reachable through 4 duplicated wrappers — the anti-pattern**).
- **Targets for consolidation:** ONE `SeoForm` (was 4 × ~360 LOC) · ONE `ConfirmDialog` (**delete 3 competing abstractions + 4 clone wrappers**) · ONE `EntityTable` / `DataTable` (E.5.12) · ONE `EntityShell` (SERVER) · ONE `StatusBadge` + `status-maps.ts` (**one map per domain: `BOOKING_STATUS`, `PAYMENT_STATUS`, `TRIP_STATUS`, `SCHEDULE_STATUS`, `SPOTLIGHT_STATUS`, `OPERATOR_VERIFICATION`, `ACTIVE_STATUS`, `STAFF_MEMBER_STATUS`, `BOOKING_PAYMENT_STATE` — a new backend status now costs one line in one file**) · ONE `useTableState` hook.

---

### E.7 Media gallery

- **Provider: Cloudinary.** Backend module `media-gallery/`; endpoints `/media-gallery`, `/media-gallery/{bulk,upload,sign,confirm}`. Media upload is one of the two modules that register a **BullMQ queue** (`bull:media-upload:*`).
- **Uploads go browser → backend directly via `apiFetch` and never traverse Next** — **no Server Action in the app takes a file** (which is why `serverActions.bodySizeLimit` is vestigial).
- **Supported kinds:** the picker/field layer is **kind-aware** (`kind` restriction on `MediaGalleryManager` / `MediaSelector`; `ImageField` and `VideoField` in the shared kit; a real `<video>` preview). ⚠️ **Cloudinary stores AUDIO under `resourceType: 'video'`, so kind must always be tested with `getMediaKind`, never `resourceType === 'video'`.** Parity check 43 exercises **image + mp4 + mov** upload with progress and cache prepend.
- ⚠️ NOT COVERED by these four fragments: the exhaustive supported-mimetype list (image/svg/video/audio) and the size-aware Cloudinary transformation policy. They are not stated in ROLES/STAFF/DEPLOYMENT/VPS/OCTO, the dashboard-extraction set, DASHBOARD-ANALYTICS/STRIPE-PAYMENTS-SETUP, or ARCHITECTURE-OVERVIEW/EVENT-DRIVEN-AND-QUEUES; do not assert them from this section.
- **The hard operational ceiling: the library is capped at 100 items.** `useMediaList('limit=100&page=1')` is hardcoded; **no pagination, no infinite scroll — item 101 is unreachable through the UI. The 100-cap is a bug wearing a config's clothes.**
- **No folders, no tags, no albums.** The only `folder` reference is a hardcoded server destination `folder='users/media'` at `media-gallery.tsx:275`.
- **Search is a client-side filename substring.** **No type/date/size filter, no sort.** Bulk actions are **delete-only**.
- **The picker is a `Dialog` styled `inset-0 w-screen h-screen` borderless `rounded-none` — a dialog cosplaying as a route.**
- Second icon library lives here (7 of 14 hugeicons files). Own skeleton, own empty state, own delete dialog — **none shared**.
- **Solutions:** (1) **pagination or infinite scroll — table stakes**; (2) **server-side search + filters** (type, date, size, unused) — **BLOCKED if `/media-gallery` lacks query params; verify early** (if it supports them this is frontend-only); (3) **tags over folders** — an image belongs to a tour *and* a destination, and folders force one truth — **BLOCKED: needs a backend field**; (4) the picker becomes a **Sheet** (`media-selector.tsx` → `media-picker-sheet.tsx`); (5) **a "used by" indicator** — delete is currently blind and an operator cannot see that an image is a tour's hero — **the highest-value non-blocked item here**; (6) lucide only, plus the shared skeleton, empty state and `ConfirmDialog`. **Keep the zustand upload store** — correct for cross-component progress. Architecture: `media/page.tsx` SERVER shell → `<MediaGrid/>` client (virtualized). ~1,949 → ~1,400 LOC.
- **Metadata surfaces in use:** alt text and focal point (edited via `ImageEditDialog` on the tour Images tab), hero flag, display order, and the **24-image cap per tour**.
- **Media is the only dashboard module with `export const metadata`.**

---

### E.8 Settings

- **Backend endpoints:** `/settings/site`, `/settings/seo`, `/settings/social-media`, `/settings/company`, `/settings/payment/stripe`, `/settings/payment/mollie`, `/settings/smtp`, `/settings/mailchimp`. Settings are **singletons** (the `id @default("default")` convention `HomePage` also follows). Guarded by **`MANAGE_SETTINGS`**.
- **`SiteInfo`** — site identity (logo, WhatsApp and the other branding fields the public footer/header read). ⚠️ **`PATCH /settings/site` is the one settings write backing a public read** — the reason defect B-1 mattered; it must bust the public `site-info` tag, whose `cacheLife` is currently `days` (proposed `hours`).
- **`SiteSEO`** — **global SEO defaults live in the `SiteSEO` singleton.** ⚠️ `PATCH /settings/seo` maps to `["user-profile"]` and **not** `site-info` in the cache-tag mapping (an asserted unit test), and `user-profile` is a **phantom tag** (E.5.7).
- **Social media** — `/settings/social-media`; operators have their own social links under `/operators/:id/social-media`.
- **Mailchimp** — `/settings/mailchimp`, an Integrations-tab concern. The design spec asks for a **connection status** indicator (connected / error / not configured) with a test action on **Stripe, Mollie and Mailchimp**.
- **Stripe** — `/settings/payment/stripe`. **Credentials live encrypted in the database (Settings → Payments), never in `.env`.** Fields: **Payment Label** (display name), **Publishable Key** (`pk_test_...`/`pk_live_...`), **Secret Key** (`sk_test_...`/`sk_live_...`, stored encrypted; **leave blank on edit to keep the current one**), **Webhook Secret** (`whsec_...`), and **Payment Methods** — only **Card, iDEAL, PayPal** are selectable today (enabling one shows a short setup guide; disabling asks to confirm).
  - **Prerequisite `ENCRYPTION_KEY`** in the backend env: a **stable** value, the same across restarts and **distinct per environment**. **If it changes, previously saved secrets cannot be decrypted and must be re-entered.**
  - **Never mix test + live keys** (e.g. a live secret with a test publishable) → auth error → **500 at intent creation**.
  - **Because the intent uses `automatic_payment_methods`, real eligibility is whatever is activated on the Stripe account for the booking currency** — a method selected here still will not appear until it is activated in Stripe. **Card** is on by default and works in every currency, collected **inline** (no redirect); **iDEAL is EUR-only** and auto-hidden for USD; **PayPal** requires completing the PayPal connection. **Until activated, a method stays greyed at checkout with a hint — that is the eligibility gate working, not a bug.**
  - **Webhooks — local:** `POST http://localhost:5050/api/v1/payments/webhook`, **`@Public()` + `@SkipThrottle()`**, verifying the Stripe signature against the **raw** body (`main.ts` sets `rawBody: true`). `brew install stripe/stripe-cli/stripe` → `stripe login` → `stripe listen --forward-to localhost:5050/api/v1/payments/webhook` → paste the printed `whsec_...` into Settings. **Keep `stripe listen` running while testing checkout locally, else the booking never leaves `ON_HOLD`** (the `/payment/processing` page polls, then falls back to the manual "View my booking" link).
  - **Webhooks — production:** Stripe Dashboard → Developers → Webhooks → Add endpoint `https://<your-domain>/api/v1/payments/webhook`; **minimum events `payment_intent.succeeded`, `payment_intent.payment_failed`**; paste the endpoint's signing secret (live mode). **Redeliveries are safe: the backend records each event id in `stripe_webhook_events` and skips duplicates (idempotent).**
  - **Money flow recap:** checkout collects **card inline** (styled Stripe **Card Elements**, no Stripe-hosted UI) and **redirects** for **PayPal / iDEAL**; the up-front PaymentIntent uses **`automatic_payment_methods`**; on a successful charge the **webhook confirms the booking** (`payment_intent.succeeded` → `confirmFromPayment`), which **fires the EUR conversion** and the **confirmation email**. **Without a working webhook, bookings stay `ON_HOLD`.**
  - **Test cards (test mode only):** `4242 4242 4242 4242` succeeds · `4000 0025 0000 3155` requires 3-D Secure (inline modal) · `4000 0000 0000 9995` declines (insufficient funds).
  - **Troubleshooting:** 500 on `.../intent` with "currency invalid for payment method" → a method incompatible with the currency was forced; `automatic_payment_methods` is used now, re-check you are on the latest backend · **503 "Payments are not configured"** → no secret + webhook secret saved · booking stuck on `/payment/processing` → the webhook is not reaching the backend · iDEAL/PayPal greyed out → not activated in Stripe, or currency-incompatible · auth error at intent creation → test/live key mismatch, or a wrong `ENCRYPTION_KEY`.
  - **Intent creation:** `POST /api/v1/payments/bookings/:id/intent` → returns `clientSecret`, `publishableKey`, `paymentMethodTypes`. Code: `backend/src/payments/` (`stripe.service.ts`, `payments.service.ts`).
- **Mollie** — `/settings/payment/mollie`, plus `/operators/:id/mollie-config`. Webhook `POST /api/v1/payments/webhook/mollie` — **recorded only**.
- **Company** — `/settings/company` (the platform's legal entity, `CompanyInformations`); distinct from `/operators/:id/company-info` (an operator's own business).
- **Platform-reviews config** — dashboard **Settings → Reviews** configures a **Trustpilot API or Google Reviews API** key for the `/platform-reviews` module: **encrypted key, DB-cached payload, 12h lazy refresh, manual "Fetch now"**. The homepage Testimonials band **stays hidden until enabled AND platform review count > 100**, enforced **server-side in `GET /platform-reviews/public`**.
- **Email is Resend, env-configured — not a dashboard integration.** (The `/settings/smtp` endpoint predates the **Resend provider swap executed 2026-07-19**, migration `20260719105425_resend_replaces_smtp`.)
- **Structure today: two products at one URL.** `settings-client.tsx` is a **role branch, not a tab set** — **admin 6 tabs (General, SEO, Social, Company, Payments, Integrations); operator 2 tabs (Company, Payments)** — at the same route, with **no URL state at all** (worse than the entity editors, which at least read `?tab=`). **A naming collision:** admin has both **General** (`site-info-form`) and **Company** (`company-info-form`), while the operator's **Company** is a different component with different semantics.
- **Solutions:** (1) **routed sections** (`/settings/general`), deep-linkable — **these are the URLs people paste into support threads**; (2) **rename to end the collision** — admin `General` → **Site**, admin `Company` → **Legal Entity**, operator `Company` → **Your Business**; (3) **search within settings**, fed by the command palette ("Where do I set Mailchimp?" should not require knowing it is under Integrations); (4) **connection status** on Stripe/Mollie/Mailchimp with a test action; (5) fold `settings-fields.tsx` into the shared form primitives; (6) **preserve `PATCH /settings/site` as the one settings write backing a public read.** Architecture: `settings/layout.tsx` SERVER (role-branched nav) → per-section SERVER pages → client forms. ~1,673 → ~1,300 LOC.

---

### E.9 Background workers, queues and jobs

#### E.9.1 The decision: synchronous transactional core, asynchronous edges

| Concern | Correct mechanism | Queue? |
|---|---|---|
| Overbooking / two travelers race for the last seats | **single atomic guarded `UPDATE departures` (row-level lock)** | **No** |
| Booking create + unit items + add-ons + settlement row | one DB transaction (synchronous) | **No** |
| Payment intent creation | idempotent per `(bookingId, kind)` (synchronous) | **No** |
| Confirmation / operator-balance email | BullMQ job, retryable, idempotent | **Yes** |
| Server-side Meta CAPI conversion | BullMQ job, idempotent by event id | **Yes** |
| Hold expiry (release seats at `utcExpiresAt`) | BullMQ delayed/repeatable sweeper | **Yes** |
| Scheduled `paid_in_full` payout after the cancellation window | BullMQ delayed job | **Yes** |
| Pre-tour reminder (24h before start) | BullMQ delayed job | **Yes** |
| Affiliate postback (on-hold, approve after window) | BullMQ delayed job | **Yes** |
| Nightly quality_score / eligibility / materialization | BullMQ repeatable (cron) | **Yes** |

- **Rule of thumb: synchronous transactional core, asynchronous edges.**
- **Why a queue is the wrong tool for overbooking:** it does **not remove the need for the atomic update** (you would still run it inside the consumer, so you would have both); it **serializes bookings**, fighting the master's **instant booking** requirement by adding latency and a new failure surface; and the only case where a queue or virtual waiting room helps is **true flash-sale hot inventory**. **A tour departure has ~20 to 40 seats and a handful of concurrent bookers. Do not build for contention we will not have.**
- **The canonical seat claim:** `UPDATE departures SET booked_count = booked_count + :seats, status = CASE WHEN booked_count + :seats >= capacity THEN 'sold_out' ELSE status END, … WHERE id = :departure_id AND tour_id = :tour_id AND status = 'open' AND booked_count + :seats <= capacity;` — **if the update affects zero rows, the booking fails. That is the concurrency control.** PostgreSQL takes a **row-level lock** on the conditional `UPDATE`, so **exactly one of two racers wins — atomically, at the database, with no extra infrastructure.**
- **Inside ONE DB transaction, in order:** (1) atomic seat claim; (2) create `Booking` (+ `BookingUnitItem`, `BookingAddOn`, `Settlement` row); (3) **write an `outbox` row for each domain event this booking emits**. Then, **outside the transaction**: (4) create the payment intent, idempotent per `(bookingId, kind)` — except `operator_full`, which is confirmed at commit with no charge (*and `operator_full` is dropped in v1; that is the v2 behavior*).

#### E.9.2 Job inventory (job / trigger / type / idempotency key)

- `booking.confirmation-email` — `booking.confirmed` — standard — `bookingId:confirmation`
- `booking.operator-balance-email` — `booking.confirmed` **and `operator_link`** — standard — `bookingId:operator-balance`
- `tracking.capi-conversion` — `booking.confirmed` (**EUR commission present**) — standard — `bookingId:capi` (**dedup by event id**)
- `booking.hold-expiry-sweep` — schedule — **repeatable (cron)** — run-window guarded
- `settlement.paid-in-full-payout` — `booking.confirmed` **and `paid_in_full`**, **released after the cancellation window** — **delayed** — `bookingId:payout`
- `booking.pre-tour-reminder` — `booking.confirmed`, **fires 24h before start** — **delayed** — `bookingId:reminder`
- `affiliate.postback` — `booking.confirmed` with attribution, **approve after the window** — **delayed** — `bookingId:affiliate`
- `commercial.quality-score` — nightly — **repeatable (cron)** — run-date guarded
- `commercial.eligibility-enforce` — nightly — **repeatable (cron)** — run-date guarded
- `availability.materialization` — nightly — **repeatable (cron)** — run-date guarded
- Additional queues named elsewhere: **`media-upload`** (`bull:media-upload:*`), **`notifications`** (`bull:notifications:*`), **`notification-delivery`** (the OCTO webhook delivery worker), and **AI/machine translation** (generate machine translations after English is saved, marking `isMachineTranslated = true`; **proper nouns — destination and hub names — are never machine-translated**).
- Architecture-doc framing of the same set: **4 nightly jobs** — quality_score recompute, departures materialization, eligibility check → notify → grace → auto-demote, operator aggregate recompute; and **5 queued/delayed jobs** — email, pre-tour reminder email, AI translation, departures materialization (on schedule/exception change or the nightly tick), demotion.

#### E.9.3 Schedules and horizons

- **Nightly cron pattern example:** `queue.upsertJobScheduler('nightly-quality-score', { pattern: '0 15 3 * * *' } /* 03:15 daily */, { name: 'commercial.quality-score', opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnFail: 1000 } })`. **Delayed and repeatable jobs need the BullMQ scheduler running; the modern `upsertJobScheduler` API supersedes the older `QueueScheduler` + `repeat` pattern.**
- **Departures materialization horizon: 12 rolling months** from `availability_schedules` (weekly pattern) + `availability_exceptions` (per-date overrides). **Never touches departures that have bookings, manual edits, or `source = api`. Single-day tours only (v1).** Idempotent via **upsert by `(tourId, localDateTimeStart)`**; the departures table's uniqueness is **UNIQUE (tour_id, date, start_time)**.
- **Status recompute during materialization:** `vacancies == 0 → SOLD_OUT`; `vacancies <= lowThreshold → LIMITED`; **past `utcCutoffAt` → `CLOSED`.**
- **Bookability rule: a tour is bookable iff it has ≥1 open/`AVAILABLE` departure within the next 30 days.** This feeds search/ranking; **`quality_score` and the eligibility check are read-only at query time** — ranking never recomputes them inline.
- **Eligibility engine:** after a tour's one-time **90-day provisional window** (from first publish), nightly enforcement of the flat bar (**5 reviews · rating ≥ 4.0 · operator cancellation rate ≤ 10% trailing 90 days, min 10 bookings, admin force-majeure pardons**). On failure: **notify the operator → 30 days of grace → auto-demote to the highest tier the tour still qualifies for.** **Existing bookings keep their snapshotted commission.**
- **`quality_score` formula (nightly, 0-100):** `(avg_rating/5)*40 + (min(review_count,100)/100)*25 + (listing_completeness/100)*20 + (conversion_rate/max_conv)*15`, where `max_conv` is the highest conversion rate among active tours **in the same category**, recomputed per run.
- **Delayed-job timing:** compute the delay **from tour-local time** (payout: after the cancellation window closes; reminder: 24h before start) and **re-check state in the consumer**, because the booking may have been cancelled or refunded in the meantime.
- **Hold-expiry sweeper:** move `ON_HOLD` bookings past `utcExpiresAt` → `EXPIRED` and **restore vacancies atomically**.

#### E.9.4 Reliability rules (these matter more than the queue itself)

- **Idempotent consumers — durable queues redeliver on retry, so every job must be safe to run twice.** Two layers: **queue-level dedup via a custom deterministic `jobId`** (BullMQ ignores a second `add()` with an existing `jobId` and emits a `duplicated` event) — ⚠️ **caveat: `removeOnComplete` / `removeOnFail` remove the job, after which the same `jobId` is no longer seen as a duplicate, so `jobId` dedup alone is not correctness**; and **a DB-level guard as the real backstop** — `conversion_fired_at` is stamped **before** the conversion payload is exposed (**mark-first**), and Stripe events are recorded in **`stripe_webhook_events` before processing**. **Each consumer checks and sets its own guard.**
- **Transactional outbox** — the one place teams lose events is the gap between committing to Postgres and enqueuing the job. **Fix: write the event to an `outbox` table inside the same transaction as the booking**, then a **relay publishes outbox rows to BullMQ and marks them dispatched.** Model: `OutboxEvent { id String @id @default(uuid()); aggregate String; aggregateId String; type String /* 'booking.confirmed' | 'booking.cancelled' | 'payment.succeeded' | 'hold.expired' */; payload Json; dispatchedAt DateTime?; createdAt DateTime @default(now()); @@index([dispatchedAt]); @@map("outbox_events") }`. **Guarantees "booking confirmed" always eventually fires its email, conversion and payout — exactly once in effect. For a payments system this is worth doing.**
- **Retries and backoff:** configure `attempts` with **exponential backoff** (BullMQ delay grows as `2^(attempt-1) * delay`). Example: `{ jobId: '${bookingId}:confirmation', attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: false }` → retries at **1s, 2s, 4s, 8s, 16s**, **keeping failures for inspection / DLQ**.
- **Failed jobs — do not silently drop.** Keep them (`removeOnFail: false` or a numeric retention) and **surface them (Bull Board or an admin view)** so a stuck payout/conversion is visible. **A confirmed booking with a null `commission_amount` is data corruption: the conversion job must fail loudly, not fire.**
- **Implementation notes:** BullMQ is Redis-backed; register once and **add a queue per bounded concern** (or one queue with named jobs for v1 simplicity) using **`@nestjs/bullmq`**. **Cap worker concurrency** — `new Worker('platform', processor, { connection, concurrency: 10 })`. **One Redis, one connection config**, mirroring "only one Prisma instance per process". **Producers** publish outbox rows after commit; **consumers** are `@Processor` classes, each **idempotent** and **re-validating booking state before acting**. **Keep the critical booking path (seat claim, booking create, payment intent) off the queue entirely.**
- **What NOT to do:** do **not** route bookings through a queue to prevent overbooking; do **not** adopt **Kafka, SNS, or event sourcing** (**a heavy event bus is complexity we would pay for and not use**); do **not** use an in-process emitter (**`@nestjs/event-emitter`**) for anything that must not be lost — **not durable, disappears on crash** — everything money- or customer-facing goes through the durable queue + outbox; do **not** rely on `jobId` dedup alone once `removeOnComplete`/`removeOnFail` are set.
- **Edge-case mapping:** two users race for the last seats → **atomic guarded update, one winner** · departure closes / cutoff passes after a calendar read → **the atomic update's `WHERE status='open'` fails the claim** · payment intent retried → **provider idempotency key + `(bookingId, kind)`** · webhook redelivered → **`stripe_webhook_events` ledger before processing** · payment succeeds after the hold expired → **the consumer re-validates state; prefer refund/void over confirming an expired hold** · TYP refresh / email revisit double-fires the conversion → **mark-first `conversion_fired_at` DB guard** · a cancellation refunded after the operator was paid → **the payout is delayed until after the cancellation window, so this cannot happen for `paid_in_full`**.
- **Redis backs BullMQ only.** It is **not a primary store and not a pub/sub bus for live UI**; **SSE, WebSockets and Redis pub/sub for live UI are out of scope** (there is no slot economy, so no real-time requirement) — **ISR revalidation is sufficient for keeping content pages current.**
- ⚠️ **Multi-instance caveat:** multiple backend replicas all process the same queues (usually fine — BullMQ is built for concurrency), **but nightly cron-style jobs (`workers/nightly-jobs.service.ts` via `@nestjs/schedule`) must not double-run. Use a Redis lock or run schedulers in exactly one instance.**

---

### E.10 Infrastructure, deployment and operations

#### E.10.1 Topology

**Frontend on Vercel; backend + Postgres + Redis on a Hostinger VPS via Docker Compose; GitHub Actions CI/CD.**

```
travelers ──▶ Vercel (Next.js)  https://www.your-domain.com
                    │ HTTPS (NEXT_PUBLIC_BACKEND_URL)
                    ▼
              nginx + certbot (TLS)  https://api.your-domain.com
              (host, port 443 → 127.0.0.1:5050)
                    │
   ┌────────────────┴──── docker compose (island-net) ────┐
   │  backend (NestJS) ──▶ postgres:16   redis:7          │
   │  127.0.0.1:5050       (volume)      (--requirepass)  │
   └──────────────────────────────────────────────────────┘
```

- **The frontend never touches the database and has no `DATABASE_URL`** — it only calls the backend API over HTTPS.
- **Postgres and Redis are internal to the compose network (no published ports)**; only the backend reaches them. The backend binds to **`127.0.0.1:5050`**, so **nothing is exposed publicly except through nginx**.
- Three containers on one bridge network **`island-net`**: `postgres` (16-alpine), `redis` (7-alpine), `backend` (NestJS 11 + Prisma 7). **nginx runs on the host, not in Docker.**
- **Stack:** NestJS 11 (strict TypeScript) · PostgreSQL via **Prisma 7** with a **split schema** (`backend/prisma/*.prisma`, merged by Prisma 7; `prisma generate` prepended to `build`/`start`) · Better Auth (backend only) · Next.js App Router + next-intl (7 locales) · Stripe · Resend (Postmark fallback) on a dedicated transactional subdomain with **SPF/DKIM/DMARC**, separate from marketing · BullMQ (Redis) · GTM + Google Ads + GA4 + Meta Pixel + server-side Meta CAPI · Trackdesk affiliate (**8% of GMV from Island Tours' commission**) · `@nestjs/swagger` at **`/api/docs`** · `class-validator`/`class-transformer` with a **global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`)** · `@nestjs/throttler` · pnpm.
- **Monorepo conventions:** backend and frontend are **independent apps in one repo — no Turborepo**; **Better Auth runs on NestJS only**; **one Prisma instance per process**.
- **Rendering strategy per page type:** Homepage / Destination / All Tours / Category / Collection **ISR 60s** · Activity Hub **ISR 300s** · Tour detail **ISR 30s** (the shortest, because **availability and pricing must stay current**) · Search **SSR, not cached** · TYP **server-rendered, no revalidation, noindex**, with **`conversion_fired_at` set server-side before render** for mark-first idempotency. **All content API endpoints accept a `locale` query param defaulting to `en`, with English fallback.**

#### E.10.2 Files

| Path | Purpose |
|---|---|
| `backend/Dockerfile` | Multi-stage production image (build → slim runner) |
| `backend/docker-entrypoint.sh` | `migrate deploy` (+ optional seed) then start |
| `backend/.dockerignore` | Keeps secrets/deps/tests out of the build context |
| `docker-compose.yml` | Production stack: postgres + redis + backend |
| `docker-compose.dev.yml` | Local dev infra: postgres + redis only (host ports) |
| `.env.example` | Compose infra vars (Postgres/Redis creds, image tag) |
| `backend/.env.production.example` | Backend app secrets for the prod stack |
| `.github/workflows/ci.yml` | Lint + build + test on PR/push |
| `.github/workflows/deploy-backend.yml` | SSH deploy to the VPS on push to main |
| `deploy/nginx/island-api.conf` | Tracked nginx site config |

#### E.10.3 Local development — two supported setups

- The backend reads Postgres from **`DATABASE_URL`** and Redis from **`REDIS_HOST` / `REDIS_PORT`** (**no `UPSTASH_REDIS_URL`**).
- **Option A — Docker for the infra (recommended):** `cp backend/.env.example backend/.env` → `docker compose -f docker-compose.dev.yml up -d` → `pnpm install:all` → `pnpm prisma:migrate` → `pnpm prisma:seed` → `pnpm dev` (backend :5050 + frontend :3000). Dev compose defaults (`island/island/island_tours`, Redis on `localhost:6379`, **no password**) match `backend/.env.example`; **leave `REDIS_PASSWORD` blank for dev.**
- **Option B — native Postgres + Redis:** `brew install postgresql@16 redis`, start services, `createdb island_tours`, point `DATABASE_URL` at local pg, `REDIS_HOST=localhost`.
- ⚠️ **Either way: do NOT set `UPSTASH_REDIS_URL` locally** — that is what previously **exhausted the Upstash free-tier command quota via BullMQ's constant polling.**
- **Server start order:** the local dashboard is pinned to **:3001**, the public site to **:3000**, the backend to **:5050**.

#### E.10.4 VPS setup and the deployment runbook

- **Prerequisites:** a domain with DNS access, a Hostinger VPS (Ubuntu 22.04/24.04, root or sudo SSH), a GitHub repo, a Vercel account, and Cloudinary + Resend API keys. Decide two hostnames: **frontend `www.your-domain.com` (Vercel)** and **backend API `api.your-domain.com` (VPS)**.
- **Part 1 — DNS:** an `A` record `api` → the VPS IPv4; a `CNAME` `www` → `cname.vercel-dns.com`; leave the apex for Vercel. **Checkpoint:** `dig +short api.your-domain.com` returns the VPS IP.
- **Part 1B — no domain?** A bare IP is not enough: **the HTTPS frontend can only call an HTTPS backend, and TLS needs a hostname.** **DuckDNS** (recommended — stable, you choose the name) or **sslip.io** (zero signup; any `<label>.<your-ip>.sslip.io` resolves). Vercel auto-assigns `https://<project>.vercel.app`. **You cannot know the exact `*.vercel.app` URL until after the first Vercel deploy — do Part 7 first, then set `FRONTEND_URL`/`CORS_ORIGINS` and `docker compose up -d`. Port 80 must be open for certbot.**
- **Part 2 — VPS setup + firewall:** create a non-root `deploy` user (`adduser deploy`, `usermod -aG sudo deploy`, rsync SSH keys). **Only SSH + HTTP/HTTPS are public — Postgres/Redis stay internal to Docker and are never exposed:** `ufw allow OpenSSH`, `ufw allow 80/tcp`, `ufw allow 443/tcp`, `ufw --force enable`.
- **Part 3 — Docker + Compose plugin:** `curl -fsSL https://get.docker.com | sh`, `sudo usermod -aG docker $USER` (log out/in). **Checkpoint:** `docker run --rm hello-world` and `docker compose version` both succeed **without `sudo`**.
- **Part 4 — clone + env files:** `sudo mkdir -p /opt/island-tours && sudo chown $USER`, `git clone`, `cp .env.example .env`, `cp backend/.env.production.example backend/.env.production`. Generate secrets with `openssl rand -base64 24` (Postgres/Redis), `openssl rand -base64 32` (`BETTER_AUTH_SECRET`), `openssl rand -hex 32` (`ENCRYPTION_KEY`). **Both files are gitignored and live only on the VPS; `git reset --hard` during deploys never touches them (they are untracked).**
- **Part 5 — first boot:** `docker compose up -d --build`; the log shows in order (1) `Applying database migrations (prisma migrate deploy)...` (2) `RUN_SEED=true -> seeding database...` (3) `Nest application successfully started`. Then `sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env` + `docker compose up -d`. Confirm `curl -i http://127.0.0.1:5050/api/v1/destinations`. **Checkpoint:** `docker compose ps` shows postgres, redis, backend all `Up (healthy)`.
- **Part 6 — nginx + HTTPS:** install nginx + certbot; copy `deploy/nginx/island-api.conf` to `/etc/nginx/sites-available/island-api`, replace the subdomain, symlink to `sites-enabled`, `nginx -t && systemctl reload nginx`, then `sudo certbot --nginx -d api.your-domain.com` (which edits the config to add HTTPS + redirect and sets up auto-renewal); verify with `sudo certbot renew --dry-run`. **nginx essentials:** `proxy_pass http://127.0.0.1:5050` with `proxy_http_version 1.1` and `Host` / `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` headers; **Stripe webhooks need the raw body intact — nginx passes it through as-is**; `client_max_body_size 15m` for media uploads. **The backend already trusts one proxy hop (`trust proxy: 1`)**, so `ThrottlerGuard` and Better Auth see the real client IP / HTTPS scheme.
- **Part 7 — frontend on Vercel:** import the repo with **Root Directory = `frontend`**; framework preset **Next.js**; env vars (Production + Preview) `NEXT_PUBLIC_BACKEND_URL = https://api.your-domain.com` and `NEXT_PUBLIC_OPEN_WEATHER_API_KEY`; add custom domains under Settings → Domains. **Vercel CI/CD is automatic** — production on `main`, previews on PRs — **no GitHub workflow needed for the frontend.** After the domain is live, confirm it is in `CORS_ORIGINS` and `FRONTEND_URL`, then redeploy the backend.
- **Part 8 — CI/CD:** the backend redeploys automatically on every push to `main` touching `backend/**` or `docker-compose.yml`. Create a dedicated SSH deploy key (`ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/island_deploy -N ""`) and add the public half to the VPS `deploy` user. **GitHub repo secrets:** `VPS_SSH_HOST`, `VPS_SSH_USER` (in the `docker` group), `VPS_SSH_KEY`, `VPS_SSH_PORT` (**optional, defaults to 22**), `VPS_APP_DIR` (e.g. `/opt/island-tours`). The workflow SSHes in, **`git reset --hard` to the pushed commit**, rebuilds the `backend` image and runs `docker compose up -d`; **migrations apply automatically inside the entrypoint.** **Workflows:** `ci.yml` — on every PR and push to `main`: lint, build, unit-test both apps (**no DB needed — unit specs are mocked**); `deploy-backend.yml` — the SSH deploy. **Registry alternative:** the default builds on the VPS (simplest, no registry); **if the VPS is small, switch to building + pushing to GHCR in CI and only `docker compose pull && up -d` on the VPS.**
- ⚠️ **Coolify note:** `docker-compose.yml`'s header mentions Coolify's Traefik proxy and the backend publishes a port (not loopback-only). **If deployed via Coolify**, use the Coolify dashboard for logs/redeploys/env vars — the credential model is identical. **If deployed plain docker compose + host nginx**, use `deploy/nginx/island-api.conf` and **change the port back to `127.0.0.1:5050:5050` so only nginx is public.**

#### E.10.5 Env-var inventory and the 3-file rule

- **Two credential layers by design.** **`.env` (repo root, on the VPS)** holds `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `BACKEND_PORT`, `BACKEND_IMAGE_TAG`, `RUN_SEED` — **the source of truth for DB + Redis passwords** (template `.env.example`). **`backend/.env.production`** holds app secrets only: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLOUDINARY_*`, `RESEND_API_KEY`/`MAIL_FROM`, `ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `FX_USD_TO_EUR`, and optional Google OAuth + Meta CAPI (template `backend/.env.production.example`).
- ⚠️ **Critical detail:** `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `NODE_ENV`, `PORT` and `RUN_SEED` are **NOT** set in `backend/.env.production`. The `environment:` block of the `backend` service in `docker-compose.yml` builds them from the root `.env` and **overrides anything in the env_file**: `DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public`, `REDIS_HOST: redis` (**the compose service name, NOT localhost**), `REDIS_PORT: '6379'`, `REDIS_PASSWORD: ${REDIS_PASSWORD}`. **On the VPS the backend talks to `postgres:5432` and `redis:6379` over the internal Docker network — never to localhost or Upstash.**
- **First-deploy flag:** `RUN_SEED=true` **for the first boot only** (it seeds the admin user), then set it back to `false`.
- **Sample compose infra `.env`:** `POSTGRES_USER=island`, `POSTGRES_PASSWORD=<generated>`, `POSTGRES_DB=island_tours`, `REDIS_PASSWORD=<generated>`, `BACKEND_PORT=5050`, `BACKEND_IMAGE_TAG=latest`, `RUN_SEED=true`.
- **Other named vars across the doc set:** `PORTAL_URL` (dashboard base embedded in invite links, **default `http://localhost:3001/portal`**; `getStaffUrl()` and `getAccountUrl()` derive `/staff` and `/account` from it — **no new env var**), `SENTRY_DSN` (**not installed**), `OTEL_EXPORTER_OTLP_ENDPOINT` (**not installed**), and the dashboard's seven (E.5.6).
- **The 3-file env rule:** **every new env var lands in `env.validate.ts` + `backend/.env.example` + `backend/.env.production.example` in the same change**; the root `.env.example` is compose-infra only. For the dashboard the adapted rule is `.env.example` **AND** `.env.production.example` in the same change. **The Staff & Teams module deliberately added none, so the rule was not triggered.**
- **Validation:** `backend/src/env.validate.ts` runs at boot (called from `main.ts`) and requires **either `UPSTASH_REDIS_URL` or both `REDIS_HOST`+`REDIS_PORT`**; **`INTERNAL_API_SECRET` unset in production is a boot failure.** After any secret rotation, verify with `docker compose logs -f backend` — **`validateEnv()` fails loudly if something is missing or malformed.**
- **Credential resolution in code:** Postgres via `backend/src/prisma/prisma.service.ts` → `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (**Prisma 7 `@prisma/adapter-pg` driver adapter**), with the same URL feeding `backend/prisma.config.ts` for migrations/seed — **the `.prisma` schema has no hardcoded URL**. Redis via `backend/src/common/utils/redis.util.ts` → `buildRedisConnection()`: **if `UPSTASH_REDIS_URL` is set it parses host/port/password from it (TLS when `rediss://`); otherwise it uses `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`.** Redis is used **only by BullMQ** — **there is no separate cache/session Redis.**
- **Rotating the Postgres password:** the password is **baked into the Postgres data volume the first time the container initialises**; changing the env var alone does not change an existing DB's password. **Option A (recommended, keeps data):** `ALTER USER ... WITH PASSWORD` inside the running DB → update root `.env` → `docker compose up -d --force-recreate backend`. **Option B (DESTROYS data, only for a fresh DB):** `docker compose down`, edit `.env`, `docker volume rm island-tour-development_postgres-data`, `up -d --build`, `RUN_SEED=true` for the first boot then back to false.
- **Rotating the Redis password:** Redis reads it from the launch command (`redis-server ... --requirepass ${REDIS_PASSWORD}`), so a change just needs a restart — edit `.env` → `docker compose up -d --force-recreate redis backend`. **Redis AOF data (`redis-data` volume) is not password-encrypted, so no data is lost.**
- **Security cleanup (resolved):** the previously exposed secrets (`INTERNAL_API_SECRET`, the Upstash token, DB credentials) were **rotated**, so the old values are dead; **`backend/.env.test` was untracked** (it contained a real `DATABASE_URL`/`BETTER_AUTH_SECRET`); **`backend/.env.example` was scrubbed** of a non-placeholder `DATABASE_URL` and a stray `redis://pixelvega:...` line; **only `*.example` templates remain tracked** and `backend/.env` was never tracked. **Remaining (optional): old values still exist in git history** — harmless since keys are rotated, but `git filter-repo`/BFG can purge the old `.env.test` blobs. **Never reuse any value from these files in production — always generate fresh secrets.**

#### E.10.6 Day-2 operations

- **Everyday container ops:** `docker compose ps` (status + health) · `logs -f backend` · `restart backend` · `down` (stop all, volumes preserved) · ⚠️ **`down -v` (stop AND delete volumes — DESTROYS data)**.
- **Redeploy after a code change:** `git pull` → `docker compose up -d --build backend` (rebuild only the app; DB + Redis stay up) → `docker compose logs -f backend`. **On every boot the entrypoint runs `prisma migrate deploy` (idempotent), optionally seeds, then starts the server — so redeploying = rebuild + up; migrations apply automatically.**
- **Roll back:** `git reset --hard <previous-sha> && docker compose up -d --build`.
- **Migration by hand:** `docker compose exec backend pnpm prisma:migrate:deploy`.
- **Backup / restore (manual):** `docker compose exec -T postgres pg_dump -U island island_tours > backup-$(date +%F).sql` and `cat backup.sql | docker compose exec -T postgres psql -U island -d island_tours`. **Data survives container/image rebuilds via the `postgres-data` and `redis-data` named volumes.**
- **Redis health:** `docker compose exec redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" ping`. **Is the app actually using it?** BullMQ only connects when a queue is registered (media-gallery + notifications). Confirm end-to-end: trigger a media upload, then `redis-cli --scan --pattern 'bull:*'` (e.g. `bull:media-upload:*`, `bull:notifications:*`). **No `bull:*` keys after using those features = the app is not reaching Redis.** ⚠️ **Common gotcha: `maxRetriesPerRequest: null` is set intentionally (a BullMQ requirement), so if Redis is down the app will not crash — it will keep retrying silently. Do not mistake "app booted fine" for "Redis is connected."**
- **Inspection tools:** `redis-cli` interactive, `--scan`, `--scan --pattern 'bull:*'`, `monitor`, `info`; GUIs **RedisInsight** (free, official, best BullMQ queue view), Another Redis Desktop Manager, TablePlus. **Production Redis has no public port** — the reliable path is `docker compose exec redis redis-cli -a <password>`; to use a desktop GUI, temporarily publish `ports: ['127.0.0.1:6379:6379']` or tunnel through a container, **keeping it off the public internet either way.**
- **Database GUI:** **Prisma Studio is already wired** (`pnpm prisma:studio` → `localhost:5555`, reads `DATABASE_URL`); **against production**, run it inside the backend container (`docker compose exec backend npx prisma studio --port 5555 &`) then `ssh -L 5555:localhost:5555`. Desktop clients: TablePlus, DBeaver, pgAdmin 4, Postico. **Reaching the production DB (no public port, by design):** temporarily add `ports: ['127.0.0.1:5432:5432']` to the postgres service, `up -d postgres`, then `ssh -L 5432:localhost:5432 user@your-vps`. ⚠️ **Remove the `ports:` line again when done — never leave Postgres publicly reachable.**
- **Backups — there is NO backup automation in the repo today.** Data lives in the `postgres-data` Docker volume. **Manual:** `pg_dump --format=custom` inside the container + `docker compose cp`, or stream to the host with `-Fc`. **Restore:** `pg_restore -U <user> -d island_tours --clean --if-exists <dump>`. **Automate — nightly cron (the recommended baseline):** `/usr/local/bin/island-backup.sh` doing `pg_dump -Fc` into `backups/`, **keeping 14 days** (`find backups -name 'island_*.dump' -mtime +14 -delete`), scheduled **`15 3 * * *` (03:15 daily)** with logging. **Better: off-site + managed** — push dumps off the VPS (`rclone`/`aws s3 cp` to S3/Backblaze/Cloudflare R2), because **a VPS failure should not take your only backup with it**; **managed Postgres** (Neon, Supabase, Railway, RDS) gives point-in-time recovery and automatic backups and would just change `DATABASE_URL` — **worth considering once you have real bookings.** ⚠️ **Test a restore at least once. A backup you have never restored is a hope, not a backup.** **Redis backups:** the `redis-data` volume has **AOF persistence (`--appendonly yes`)** so queue state survives restarts; **BullMQ data is transient (jobs) so it usually does not need backup**, but `BGSAVE` writes an RDB snapshot into the volume if wanted.
- **Audit logs — what exists today:** **there is NO dedicated audit-log table or module** (the only "audit" reference in the schema is a comment on a `requestedBy` field in `tiers.prisma`). What exists is **structured application logging** — every service uses `private readonly logger = new Logger(<Service>.name)` and logs mutating admin actions to **stdout/stderr**, which Docker captures. **Visualizing today (zero setup):** `docker compose logs -f backend`, `--since 1h`, `| grep -i "error"`, `> backend_$(date +%F).log`. **Add Docker log rotation** so logs do not fill the disk — `/etc/docker/daemon.json`: `{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }`, then restart docker. **For a real queryable audit log, two levels:** **(A) aggregate existing stdout logs into a UI, no code change** — **Grafana Loki + Promtail** (lightweight, self-hosted, best fit for a single VPS), **Dozzle** (dead-simple real-time Docker log viewer in the browser), or hosted (Better Stack/Logtail, Datadog, Axiom); **(B) a true business audit trail** (who changed what, when) — needs an **`audit_log` Prisma model (`actorId`, `action`, `entityType`, `entityId`, `before`/`after` JSON, `ip`, `createdAt`)** written from a **NestJS interceptor on mutating routes** — the right approach for compliance/forensics but **a feature to build, not config.** **Recommendation for now: Docker log rotation + Dozzle; move to Loki+Grafana when metrics/Sentry arrive so it is one dashboard.**
- **Health endpoint:** **`/api/v1/health` exists** (`@Public()` + `@SkipThrottle()`) but is **shallow** — it returns `{ status: 'ok', timestamp, uptime }` and **does NOT check Postgres or Redis liveness.** An uptime monitor wired to it only tells you the process is up, not that the DB is reachable. **Deepening it (DB/Redis pings via `@nestjs/terminus`) is a small future code task.**
- **Sentry — NOT installed today** (no `@sentry/*` dependency in either app, no `SENTRY_DSN`). **Backend steps:** create a project and copy the **DSN**; `pnpm add @sentry/nestjs @sentry/profiling-node`; create `backend/src/instrument.ts` with `Sentry.init({ dsn, environment, tracesSampleRate: 0.1, enabled: NODE_ENV === 'production' })` and **import it FIRST in `main.ts`**; add `SentryModule.forRoot()` to `AppModule.imports` and use the Sentry global filter (or keep `AllExceptionsFilter` and call `Sentry.captureException` inside it); **add `SENTRY_DSN` to `backend/.env.production` AND to the `OPTIONAL` map in `env.validate.ts`**; rebuild and trigger a test error. **Frontend (Vercel):** `pnpm add @sentry/nextjs` then `npx @sentry/wizard@latest -i nextjs`. **Sentry correlates frontend + backend errors if you propagate trace headers**, and gives error grouping, stack traces, release tracking, alerts and (with `tracesSampleRate`) basic performance tracing — **often enough that you may not need full OpenTelemetry on day one.**
- **OpenTelemetry — NOT installed today.** **Route A (simplest): Sentry's built-in tracing** — with `tracesSampleRate` set, **Sentry already uses OpenTelemetry under the hood for the NestJS SDK** and gives request traces with no extra infra. **Start here.** **Route B (full OTel, vendor-neutral):** install `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`; create `backend/src/tracing.ts` with `NodeSDK` + `OTLPTraceExporter` + `getNodeAutoInstrumentations()` and **import it FIRST in `main.ts`**; **auto-instrumentation covers HTTP, Express (NestJS), Prisma/pg, and ioredis/BullMQ with no per-route code**; run a collector (**Grafana Tempo + Grafana**, **Jaeger all-in-one**, or **SigNoz** for traces+metrics+logs in one); add `OTEL_EXPORTER_OTLP_ENDPOINT` to env + the `env.validate.ts` OPTIONAL map.
- **Auto-scaling — honest framing: a single Hostinger VPS does not "auto-scale".** **Tier 1 — vertical scaling (you are here):** resize the VPS in the Hostinger panel. **Zero code change. Do this first; one well-sized VPS handles a lot.** **Tier 2 — horizontal on the same VPS (manual):** `docker compose up -d --scale backend=3` behind nginx/Traefik load balancing. **Requirements first: move rate-limit state to Redis** so limits are shared; **ensure nightly cron-style jobs do not double-run** (a Redis lock, or run schedulers in exactly one instance); **the app is already stateless** (sessions are cookie/DB-backed via Better Auth). ⚠️ **Also required: shared permission-cache invalidation (E.2.3).** **Tier 3 — real auto-scaling (platform change):** Docker Swarm (closest to compose), Kubernetes (k3s + HPA — powerful but a big operational step up), or **managed container hosts (Railway, Render, Fly.io, AWS ECS/Fargate, Google Cloud Run) — real request-based autoscaling with almost no ops; if autoscaling is a hard requirement, moving the backend here (keeping Postgres/Redis managed) is far less work than running k8s yourself.** The image is already a clean, migrate-on-boot Dockerfile, **so it ports easily.** **Recommendation: right-size one VPS + set up backups + Sentry; revisit horizontal scaling only when a single instance is genuinely saturated.**
- **Built vs to-add summary:** rate limiter ✅ built & active (tune limits; set `INTERNAL_API_SECRET` in prod) · DB credentials ✅ defined · Redis ✅ configured (verify with the `bull:*` scan) · DB GUI ✅ Prisma Studio wired · **DB backups ❌ no automation** (add cron + off-site) · **business audit log ❌ no table/module** (stdout only) · **Sentry ❌ not installed** · **OpenTelemetry ❌ not installed** · **auto-scaling ❌ single VPS**.

#### E.10.7 Troubleshooting matrix

| Symptom | Cause / fix |
|---|---|
| `ERR max requests limit exceeded` (Redis) | Still on the Upstash free tier / `UPSTASH_REDIS_URL` still set somewhere. Unset it; use the self-hosted `redis` service (no quota). |
| `Environment validation failed: ... is missing` | A required var is absent. Check `backend/.env.production` against `*.example`; compose injects `DATABASE_URL`/`REDIS_*`. |
| Redis `NOAUTH` / `WRONGPASS` | `REDIS_PASSWORD` in `.env` must match the `redis` service `--requirepass`. Re-run `docker compose up -d` after editing. |
| CORS error in the browser | Add the **exact** origin (scheme + host, comma-separated, **no spaces, no trailing slash**) to `CORS_ORIGINS`, redeploy the backend. |
| Better Auth links point at localhost | Set `BETTER_AUTH_URL=https://api.your-domain.com`. |
| Stripe webhook signature fails | Ensure nginx forwards the raw body (no buffering middleware); the app uses `rawBody: true`. |
| Backend container restarts on boot | Usually a failed `migrate deploy` — `docker compose logs backend`. Postgres must be healthy first (compose `depends_on` handles ordering). |
| 502 from nginx | Backend not healthy or not on `127.0.0.1:5050`. Check `docker compose ps` / logs. |
| certbot fails | The DNS A record for `api` must resolve to the VPS **and port 80 must be open (ufw)** before running certbot. |

---

### E.11 OCTO migration

#### E.11.1 Goal, naming and base path

- **Goal:** revamp the Island Tours backend API to strictly follow the **OCTO specification** (docs.octo.travel) for the **tour → availability → booking** surface. **OCTO is the API contract for that core; the master rules remain the business logic.**
- **One entity name across the whole stack: `tour`.** We deliberately deviate from OCTO's wire term **`product`** and expose that concept as **`tour`**. **There is no `trip` and no `product` anywhere we control — DB, code, routes and JSON all say `tour`.**

| OCTO canonical | Our API |
|---|---|
| `GET /products` · `GET /products/{id}` | `GET /tours` · `GET /tours/{id}` |
| field `productId` | field `tourId` |
| error `INVALID_PRODUCT_ID` | error `INVALID_TOUR_ID` |
| DTO `Product` | DTO `OctoTour` |

  **Everything else in the OCTO contract is kept verbatim** — `option`, `unit`, `availability`, `booking`, `supplier`, capabilities, status values, money encoding, error envelope. **Only the `product` → `tour` rename is ours.**
- **Base path — Decision D0:** the recommendation was a **dedicated OCTO namespace `/api/octo/v1/*`** alongside the existing `/api/v1/*`. ⚠️ **The built path as executed is `/api/v1/octo/...`** (e.g. `OctoToursController` at **`/api/v1/octo/tours`**), and the capabilities middleware is applied `forRoutes('octo')` in `OctoModule`. **If D0 changes, only the path prefixes move.** The alternative — replacing the public-read tour/availability/booking routes under `/api/v1` in place — was rejected because it **mixes OCTO + native conventions (errors, money) on one prefix**.
- ⚠️ **Strict-OCTO consumers (D11):** a third-party OCTO client (e.g. an OTA) expects `productId` / `/products`. If/when we expose the API to one, **add a compatibility alias** (accept `productId` as a synonym for `tourId`, mount `/products` → `/tours`). **Our API stays `tour`.** *(OCTO already speaks "tours" in its content model — the `octo/content` `categoryLabels` enum contains `boat-tours`, `walking-tours`, `day-trips` — so naming the container `tour` is a natural fit.)*
- **The Prisma rename is documentation-only for now** and lands with the OCTO build: `Trip` model → `Tour`, `trips.prisma` → `tours.prisma`, `TripTranslation/TripImage/TripStatus/...` → `Tour*`, module `trips/` → `tours/`, routes `/api/v1/trips` → `/api/v1/tours`, **and the physical table `trips` → `tours` (DS2 — `@@map("tours")`, no `@@map("trips")` alias)**. One coordinated migration + import updates + frontend API clients.

#### E.11.2 Scope — what is OCTO and what stays native

| Layer | API shape | Why |
|---|---|---|
| **Catalog read** (tours/options/units) | **OCTO** (`GET /tours`, `/tours/{id}`, `/supplier`) | Standard, consumable by the frontend + future OTAs |
| **Availability** (check + calendar) | **OCTO** (`POST /availability`, `/availability/calendar`) | The standard slot model maps to departures |
| **Booking transaction** (reserve→confirm→cancel) | **OCTO** (`/bookings/*`) | Standard two-step flow |
| **Pricing / content / pickups** | **OCTO capabilities** | `octo/pricing`, `octo/content`, `octo/pickups` |
| **Commercial engine** (tiers, ranking, quality score, eligibility, Spotlight, tracking) | **Native** | Not in OCTO; stays under `/api/v1/...` |
| **Admin/operator management** (create/edit tours, translations, page content, FAQ, attributes, hubs, collections, settings) | **Native** (existing `/api/v1/...`) | Authoring surface; **OCTO is read/transact only** |
| **Discovery** (categories, hubs, collections, search, filters) | **Native** | Marketplace IA; not OCTO |

- **Explicitly NOT covered by OCTO** (and therefore native or out of scope): the commercial tier economy and ranking, quality score, eligibility, Destination Spotlight, tracking/attribution, the slug registry and flat URLs, multilingual page content and FAQ authoring, categories/hubs/collections/search, per-tour reviews (**OCTO has no review capability**), add-ons (**add-ons are NOT OCTO units** — defer to `octo/extras`, which is not standardized, or keep them as a native booking extra), and **iCal** (secondary sync only, never the availability source).
- **Also not standardized / to verify:** `octo/promotions` is **in development — defer**; header examples mention `octo/offers` but it is **not a documented capability — treat as non-standard**; `octo/cart`, `octo/adjustments`, `octo/extras`, `octo/questions`, `octo/packages`, `octo/maps`, `octo/resources` were **not confirmed** in the captured docs. The **Ticket schema** (booking `voucher` and per-unitItem `ticket`) was **NOT fully captured — confirm against the live spec before relying on specific fields**; expected shape is a delivery payload (`deliveryOptions[]` with `deliveryFormat` + `value`) plus redemption metadata. Also unverified: the **`Octo-Env` header** (`live`/`test`, seen in examples but not formally documented), the exact **`PATCH /bookings/{uuid}`** and **`GET /bookings/`** paths and full query-param set, the **GeoJSON `geometry` structure on `Place`**, whether **`contact` may be supplied at create as well as confirm**, the **`pickupAreas` schema**, **notification webhook retry policy and signature/verification** (**not specified — implementers add their own**) plus the exact `data` payload per type and whether a delivery-history endpoint exists, and the **notification subscriptions path spelling** (one doc table showed a `subcriptions` typo).

#### E.11.3 Conventions

- **Base URL & versioning:** OCTO does **not** mandate a path prefix — the **Supplier** object advertises its `endpoint` (base URL, **no trailing slash**), and every operation path is relative to it.
- **Auth:** `Authorization: Bearer <token>` is **mandatory on every request** in the spec; `Content-Type: application/json` on `POST`/`PATCH`/`DELETE`. ⚠️ **Decision D1:** our platform uses Better Auth cookie sessions, and for the public frontend the OCTO booking surface is effectively public until checkout. Options: (a) accept the Better Auth session cookie on the OCTO routes; (b) issue a public reseller bearer token; (c) both. **Recommendation (a) for v1**, adding bearer when a real third-party reseller integrates. **As built, v1 catalog reads are `@Public()`; the bearer guard is pending.**
- **Headers:** `Octo-Capabilities: <ids>` on the request (comma-separated capability IDs, e.g. `octo/content, octo/pricing`) and **echoed on the response** with what the server actually initialized; `Octo-Env: live | test`; `Accept-Language` / `Content-Language` / `Available-Languages` for localization with `octo/content`.
- **Capabilities are the core mechanism.** The response shape is controlled by the `Octo-Capabilities` header (or the `_capabilities` query param). **Core (no capabilities) returns only the mandatory fields**; each enabled capability **adds gated fields**. **Practical rule: a consumer must request the capabilities it needs and must not assume gated fields exist otherwise.**
- **Money encoding (D2):** with `octo/pricing`, all monetary amounts are **integers in the currency's minor units**, converted with **`amount / 10^currencyPrecision`** (e.g. `retail: 7500`, `currencyPrecision: 2`, `currency: "EUR"` → €75.00). **Never floats/decimals for money on the wire.** **We keep `Decimal(10,2)` in the DB (precision for accounting/commission) and convert to minor units at the OCTO serialization boundary only. Do not change the DB money types.**
- **Cross-cutting conventions BUILT:** the **capabilities middleware** (`src/octo/common/octo-capabilities.ts` — `OctoCapabilitiesMiddleware` + `@OctoCaps()`), supporting `octo/content`, `octo/pricing`, `octo/pickups`, `octo/dropoffs`, `octo/notifications`, with **locale negotiation in `octo-locale.ts` (`Content-Language`)**; **capability-gated serializers** (`octo-tour.serializer.ts`, `octo-supplier.serializer.ts`); the **money serializer** `octo-money.ts` (`Decimal → { amount(minorUnits), currency, currencyPrecision }`, building `Pricing` with `original/retail/net` and `includedTaxes`); the **OCTO error filter** `octo-error.ts` (`OctoException` + `OctoExceptionFilter`, bound per-controller via `@UseFilters`) emitting the flat `{ error, errorMessage, <contextId> }` shape instead of the native envelope; **Swagger grouping under the `OCTO` `@ApiTags`** (**OCTO DTO classes deferred — responses are spec-shaped**). **Pending:** the bearer auth guard (D1) and **`Octo-Env` (live/test) handling** plus booking `testMode` (the header is allowed in CORS; consumed once bookings land).

#### E.11.4 Endpoints (complete OCTO list, paths relative to the supplier `endpoint`)

| Operation | Method | Path | Notes |
|---|---|---|---|
| Get Supplier | `GET` | `/supplier/` | Supplier metadata + contact |
| Get Product List | `GET` | `/products/` (**ours: `/tours/`**) | Full catalog (paginated) |
| Get Product | `GET` | `/products/{id}` (**ours: `/tours/{id}`**) | Single product, same shape as the list item |
| Availability Check | `POST` | `/availability/` | Concrete bookable slots for a date range / specific ids |
| Availability Calendar | `POST` | `/availability/calendar` | Day-level availability summary for a range |
| Create Booking (reserve) | `POST` | `/bookings/` | Holds availability → `ON_HOLD` |
| Get Booking | `GET` | `/bookings/{uuid}` | Single booking |
| Get Booking List | `GET` | `/bookings/` | Filter via query params |
| Confirm Booking | `POST` | `/bookings/{uuid}/confirm` | `ON_HOLD → CONFIRMED` |
| Update Booking | `PATCH` | `/bookings/{uuid}` | Modify unit items / contact / notes |
| Cancel Booking | `POST` | `/bookings/{uuid}/cancel` | `→ CANCELLED` + refund decision |
| Extend Booking | `POST` | `/bookings/{uuid}/extend` | Push out `utcExpiresAt` |
| Get Pickup Locations | `GET` | `/bookings/{uuid}/pickupLocations?latitude=&longitude=` | `octo/pickups` only |
| Create Notification Subscription | `POST` | `/notifications/subscriptions` | `octo/notifications` |
| List Notification Subscriptions | `GET` | `/notifications/subscriptions` | `octo/notifications` |
| Get Notification Subscription | `GET` | `/notifications/subscriptions/{id}` | `octo/notifications` |
| Update Notification Subscription | `PATCH` | `/notifications/subscriptions/{id}` | `octo/notifications` |
| Delete Notification Subscription | `DELETE` | `/notifications/subscriptions/{id}` | `octo/notifications` |

**Get Booking List query filters (commonly supported):** `resellerReference`, `supplierReference`, `localDate` / `localDateStart` / `localDateEnd`, `productId`, `optionId`. *(Exact param set — verify against the OpenAPI definition.)*

#### E.11.5 Schemas

- **Supplier:** `id`, `name`, `endpoint` (base URL, no trailing slash), `contact` (`website|null`, `email|null`, `telephone|null` **E.164**, `address|null`), `shortDescription|null`, `media` (Media[], may be null). ⚠️ **Decision D4 — supplier scope: platform-as-supplier**, not supplier-per-operator; the operator is exposed as tour-level metadata. **As built, `GET /supplier/` returns platform-as-supplier from `SiteInfo` + `CompanyInformations`, with `endpoint` derived from the request. Per-operator supplier contact fields are N/A — we are not building per-operator suppliers.**
- **Product / Tour:** **Core (always present)** — `id`, `internalName`, `reference|null`, `locale`, `timeZone` (**IANA, e.g. "America/Curacao"**), `allowFreesale`, `instantConfirmation`, `instantDelivery`, `availabilityRequired`, `availabilityType` (`START_TIME | OPENING_HOURS`), `deliveryFormats` (`["PDF_URL","QRCODE","CODE128","PKPASS_URL"]`), `deliveryMethods` (`["VOUCHER","TICKET"]`), `redemptionMethod` (`DIGITAL | PRINT | MANIFEST`), `options[]`. **`octo/pricing`** adds `defaultCurrency`, `availableCurrencies`, `pricingPer` (`UNIT | BOOKING`). **`octo/content`** adds `title`, `shortDescription|null`, `description|null`, `features[]`, `faqs[]` (`{question, answer}`), `media[]`, `locations[]`, `categoryLabels[]`, `durationMinutesFrom`, `durationMinutesTo`, `commentary[]`. **As built:** derived attributes — `availabilityType` constant `START_TIME` for scheduled tours (`OPENING_HOURS` later); `deliveryFormats`/`deliveryMethods`/`redemptionMethod` default **`["PDF_URL","QRCODE"] / ["VOUCHER"] / DIGITAL`**; `instantConfirmation`/`instantDelivery` true for an instant-book platform; **`timeZone` per destination**.
- **Option:** **Core** — `id`, `default`, `internalName`, `reference|null`, **`availabilityLocalStartTimes` (≥1 required)**, `cancellationCutoff` (**ISO 8601 duration, e.g. "PT24H"**), `cancellationCutoffAmount`, `cancellationCutoffUnit` (`hour | minute | day`), `requiredContactFields`, `restrictions` (`{minUnits, maxUnits}`), `units[]`. **`octo/pricing`** adds `pricingFrom[]`, `pricing[]`; **`octo/pickups`** adds `pickupAvailable`, `pickupRequired`, `pickupLocations[]`, `pickupAreas[]`; **`octo/content`** adds the content block. ⚠️ **Decision D3:** a Tour has no explicit "options" today, so **one synthetic `DEFAULT` Option per tour** (multi-option deferred). **As built, the serializer reads a persisted `TourOption` — no synthesis needed, the D3 schema landed**; start times come from `availabilityLocalStartTimes`, `cancellationCutoff` from `cancellationCutoffAmount/Unit`, restrictions from `minPartySize`/`maxPartySize`.
- **Unit:** **Core** — `id`, `internalName`, `reference|null`, `type` (`ADULT | YOUTH | CHILD | INFANT | FAMILY | SENIOR | STUDENT | MILITARY | OTHER`), **`restrictions`** (`minAge`, `maxAge`, `idRequired`, `minQuantity`, `maxQuantity`, **`paxCount` — headcount this unit consumes toward capacity**, **`accompaniedBy`** — unit ids/types that must accompany, `minHeight`, `maxHeight`, `heightUnit`, `minWeight`, `maxWeight`, `weightUnit`), `requiredContactFields` (per ticket). **`octo/pricing`** adds `pricingFrom[]`, `pricing[]`; **`octo/content`** adds `title|null`, `shortDescription`, `features[]`. **Sourced from `TourAgeBand`** (`bandType` → `type`, `minAge`/`maxAge`/`minCount`/`maxCount` → `restrictions`, `price` → `pricing`); **as built, units come from `TourUnit`** (D3). ⚠️ **D10:** map ADULT/CHILD/INFANT now, extend to richer unit types later.
- **Availability request (`POST /availability/`):** `productId`(→`tourId`), `optionId`, `localDateStart` (YYYY-MM-DD), `localDateEnd`, `availabilityIds[]` (optional — check specific slots), `units[]` (`{id, quantity}` — optional, for capacity + pricing), `currency` (octo/pricing), `pickupLocationId` + `pickupRequested` (octo/pickups).
- **Availability object:** `id` (**an opaque slot id used as `availabilityId` in Create Booking — it must be stable and resolvable back to a departure**), `localDateTimeStart`, `localDateTimeEnd`, `allDay`, `available`, `status` (`AVAILABLE | FREESALE | SOLD_OUT | LIMITED | CLOSED`), `vacancies|null`, `capacity|null`, `maxUnits|null` (**max units per booking on this slot**), `utcCutoffAt`, `openingHours[]`; **octo/pricing** adds `unitPricing[]` + `pricing`; **octo/pickups** adds `localPickupDateTimeStart`/`End`. **Status mapping thresholds must be defined (e.g. LIMITED when vacancies ≤ N)**; `utcCutoffAt` comes from `bookingCutoffMinutes`.
- **AvailabilityCalendar (one per day):** `localDate`, `available`, `status`, `vacancies|null`, `capacity|null`, `openingHours[]`; **octo/pricing — UNIT mode → `unitPricingFrom`; BOOKING mode → `pricingFrom`**. **Aggregate multiple departures per day into a day summary.**
- **Booking:** `id`, **`uuid`** (**client-supplied at create; the primary identifier**), `testMode`, `resellerReference|null`, `supplierReference|null`, `status`, `utcCreatedAt`, `utcUpdatedAt`, `utcExpiresAt|null`, `utcRedeemedAt|null`, `utcConfirmedAt|null`, `productId` + `product`, `optionId` + `option`, `cancellable`, `cancellation` (`BookingCancellation|null`), `freesale`, `availabilityId|null` + `availability`, `contact`, `notes|null`, `deliveryMethods`, `voucher` (Ticket|null), `unitItems[]`, `pricing`; **octo/pickups** adds `pickupRequested`, `pickupLocationId|null`, `pickupLocation|null`, `pickupNotes|null`.
- **UnitItem (one per participant/ticket):** `uuid`, `resellerReference|null`, `supplierReference|null`, `unitId` + `unit`, `status`, `utcRedeemedAt|null`, `contact`, `ticket|null`, `pricing`.
- **Contact:** `fullName|null`, `firstName|null`, `lastName|null`, `emailAddress|null`, `phoneNumber|null`, `locales[]`, `postalCode|null`, `country|null`, `notes|null`. **Which fields are required is declared by `Option.requiredContactFields` (lead traveler) and `Unit.requiredContactFields` (per ticket).**
- **Shared sub-schemas:** **Media** (`src` permanent URL, `type` ∈ `image/jpeg | image/png | video/mp4 | video/avi | external/youtube | external/vimeo`, `rel` ∈ `LOGO | COVER | GALLERY`, `title|null`, `caption|null`, `copyright|null`) · **Feature** (`shortDescription|null`, `type`) — **Feature has NO `id` and no free-form `value`; the text lives in `shortDescription`, classified by `type`** · **Location** (`title`, `shortDescription|null`, `types[]`, `minutesTo`, `minutesAt`, `place`) with **Place** (`latitude`, `longitude`, `postalAddress`, `identifiers` — google/apple/tripadvisor ids, `sameAs[]`) and **PostalAddress** (`streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry`, `postOfficeBoxNumber|null`) · **Commentary** (`format` ∈ `IN_PERSON | RECORDED_AUDIO | WRITTEN | OTHER`, `language`) · **Ticket** (delivery artifact — code/QR/PDF/PKPASS + redemption state; **fields not captured**) · **BookingCancellation** (`refund` ∈ `FULL | PARTIAL | NONE`, `reason|null`, `utcCancelledAt`).
- **Enum appendix:** `AvailabilityType` `START_TIME, OPENING_HOURS` · `AvailabilityStatus` `AVAILABLE, FREESALE, SOLD_OUT, LIMITED, CLOSED` · `BookingStatus` `ON_HOLD, CONFIRMED, EXPIRED, CANCELLED, REDEEMED, PENDING, REJECTED` · `DeliveryFormat` `PDF_URL, QRCODE, CODE128, PKPASS_URL` · `DeliveryMethod` `VOUCHER, TICKET` · `RedemptionMethod` `DIGITAL, PRINT, MANIFEST` · `PricingPer` `UNIT, BOOKING` · `UnitType` `ADULT, YOUTH, CHILD, INFANT, FAMILY, SENIOR, STUDENT, MILITARY, OTHER` · `ContactField` `firstName, lastName, fullName, emailAddress, phoneNumber, postalCode, country, notes, locales, allowMarketing` · `FeatureType` `INCLUSION, EXCLUSION, HIGHLIGHT, PREBOOKING_INFORMATION, PREARRIVAL_INFORMATION, REDEMPTION_INSTRUCTION, ACCESSIBILITY_INFORMATION, ADDITIONAL_INFORMATION, BOOKING_TERM, CANCELLATION_TERM` · `LocationType` `START, ITINERARY_ITEM, POINT_OF_INTEREST, ADMISSION_INCLUDED, END, REDEMPTION` · `CommentaryFormat` `IN_PERSON, RECORDED_AUDIO, WRITTEN, OTHER` · `MediaType` / `MediaRel` as above · `CancellationRefund` `FULL, PARTIAL, NONE` · `CategoryLabel` (34 fixed values: `multi-day, city-cards, adults-only, animals, audio-guide, beaches, bike-tours, boat-tours, classes, day-tours, family-friendly, fast-track, food, guided-tours, history, hop-on-hop-off, literature, live-music, museums, nightlife, outdoors, private-tours, romantic, recurring-events, self-guided, small-group-tours, sports, theme-parks, walking-tours, wheelchair-accessible, accommodation-included, tour-difficulty-easy, tour-difficulty-medium, tour-difficulty-hard`).
- **New Prisma enums to add:** `AvailabilityStatus`, `OctoAvailabilityType`, `DeliveryFormat`, `DeliveryMethod`, `RedemptionMethod`, `OctoUnitType` (or map from `AgeBandType`), `CancellationRefund`, `FeatureType`, `MediaRel`, `LocationType`, `CommentaryFormat`. **`BookingStatus` migrates to the OCTO set** (⚠️ **D9:** PENDING→PENDING/ON_HOLD, CONFIRMED→CONFIRMED, CANCELLED→CANCELLED, COMPLETED→REDEEMED, REFUNDED→CANCELLED+refund; **preserve historical rows**). **Remove legacy slot/waitlist enums** (`SlotStatus`, `WaitlistStatus`). **New table `BookingUnitItem`**; OCTO fields added to `Booking`; optional Tour fields `availabilityType`, delivery/redemption config, `timeZone`. **Content tables (DS1 — keep dedicated):** `TourHighlight`/`TourInclusion`/`TourExclusion` (+ translations) stay as separate tables; **add `TourFeature` + `TourFeatureTranslation`** for the other OCTO feature types; **the serializer merges all four into `features[]`** (no migration of the existing tables).

#### E.11.6 Entity mapping (Island Tours → OCTO)

| OCTO concept | Island Tours source | Notes / gap |
|---|---|---|
| **Supplier** | `Operator` (+ platform `SiteInfo`) | ⚠️ **D4: platform-as-supplier**; the operator is tour-level metadata |
| Supplier contact | `OperatorCompanyInfo.companyPhone`, `User.email` | Add operator `contactEmail`/`contactPhone` (**E.164**) |
| **Tour** | `Tour` | Derive `availabilityType` (START_TIME), `instantConfirmation` (true), `deliveryMethods` (VOUCHER), `redemptionMethod` |
| Tour.options | *(none)* | Synthesize a `DEFAULT` option (D3) |
| Tour.pricingPer | `Tour.pricingModel` | `PER_PERSON`→`UNIT`, `UNIT`(group/boat)→`BOOKING` |
| Tour.durationMinutesFrom/To | `Tour.durationMinutes` | Map both from the single value (or add a range) |
| Tour content | `TourTranslation`, `TourHighlight`/`TourInclusion`/`TourExclusion` + `TourFeature`, `TourImage`, FAQ, `TourLocation` | `octo/content`: the serializer **merges** all into `features[]`, `media[]`, `faqs[]`, `locations[]` |
| **Option** | synthetic / persisted `TourOption` | start times ← schedules' `startTime`; `cancellationCutoff` ← `cancellationHours`; `restrictions.min/maxUnits` ← `minPartySize`/`maxPartySize` |
| **Unit** | `TourAgeBand` → `TourUnit` | `bandType`→`type`; ages/counts→`restrictions`; `price`→`pricing` |
| **Availability** | `TourSchedule` → master `departures` | `startDate+startTime`→`localDateTimeStart`; `availableSpots`→`vacancies`; `totalSpots`→`capacity`; `status`→OCTO status; **calendar = aggregate per day** |
| **Booking** | `Booking` (thin) | **Expand heavily:** `uuid`, two-step status, `unitItems`, `contact`, `pricing`, currency, refs, expiry |
| **UnitItem** | *(none)* | **New child table — one row per pax** |
| **Contact** | `User` + new booking contact fields | Add a guest contact override on the booking |
| **Pricing** | `Decimal` money fields | Serialize to minor units at the boundary (D2) |
| **Pickup** | `Tour.pickupModel` + pickup add-on | Map to `octo/pickups` |
| Booking status | `BookingStatus` | Replace/extend to the OCTO set |

#### E.11.7 What is built vs to build

- **BUILT — catalog:** `GET /supplier/` (`OctoSupplierController` + serializer) and `GET /tours/`, `GET /tours/{id}` (`OctoToursController` at `/api/v1/octo/tours`, public for v1). The **core serializer** emits `id, internalName, reference, locale, timeZone, allowFreesale, instantConfirmation, instantDelivery, availabilityRequired, availabilityType, deliveryFormats, deliveryMethods, redemptionMethod, options[]`; the **DEFAULT option serializer** and **units from `TourUnit`**; the **`octo/content` serializer** emits `features[]`, `media[]`, `faqs[]`, `locations[]`, `commentary[]`, `categoryLabels[]` (our category slugs) and durations, **localized via `Accept-Language` against `TourTranslation` with `Content-Language` set** (*the `Available-Languages` response header is deferred*); the **`octo/pricing` serializer** emits `defaultCurrency`, `availableCurrencies`, `pricingPer`, `pricingFrom` on option + units. ⚠️ **Pagination pending (D5): the list currently returns the full LIVE catalog as a bare array (tier-ranked).**
- **BUILT — `octo/notifications`:** subscription endpoints `POST /notifications/subscriptions` (body `url`, `notificationTypes[]`, `headers?`; **returns the subscription with its `id` + signing `secret`, once**), `GET /notifications/subscriptions` (**scoped to the caller: operator = own, admin = all**), `GET /notifications/subscriptions/{id}` (+ `:id/deliveries` delivery log), `PATCH`, `DELETE`. **Event types (the only three):** **`PRODUCT_UPDATE`** (`data.productId` = tourId; ⚠️ **the tour publish/edit emit hook is deferred to the tours module**), **`AVAILABILITY_UPDATE`** (emitted when departures/inventory change — reserve, cancel, expiry, materialize, schedule/exception/departure edits; `data` carries Availability-Check-compatible params so **the subscriber re-fetches `POST /availability/`** — **this is how availability propagates, not polling**), **`BOOKING_UPDATE`** (booking status transitions; **`data.uuid` = the booking `publicRef`**). **Delivery payload** `{ id, subscriptionId, notificationType, utcCreatedAt, data }` (**delivery id = notification id**). **BullMQ `notification-delivery` worker** POSTs to each matching subscription `url` with its custom `headers`, **exponential backoff (5 attempts)**, recording `NotificationDelivery` (status/attempts/lastError/deliveredAt) and **marking `DEAD` on the final failed attempt**. **Signing (D13): `Octo-Signature: sha256=<hmac>` over the raw body** with the per-subscription `secret` (**stored encrypted at rest**), plus an **`Octo-Notification-Id`** header and a `verifyNotification` helper.
- **TO BUILD — availability:** `POST /availability/` (`OctoAvailabilityController`) and `POST /availability/calendar`. **Depends on the availability/departures model (master Stage 5)** — today only `TourSchedule` exists. **Caching policy: the calendar/list may cache briefly (e.g. 30–60s ISR/Redis); the reservation path reads live (no cache). Document it.** Performance: **index-backed range queries; avoid N+1; return arrays (the OCTO shape).**
- **TO BUILD — bookings (the largest gap: `Booking` is model-only today, no controller/service, and thin):** `POST /bookings/` (reserve — **atomic capacity claim**, `ON_HOLD` + `BookingUnitItem` rows, `utcExpiresAt = now + expirationMinutes` **clamped to supplier/master limits**, unit-restriction validation, pricing computation, and a **freesale** path when `allowFreesale`) · `POST /bookings/{uuid}/confirm` (**reject if expired**; trigger the Stripe PaymentIntent per `payment_model`, **`operator_full` confirms with no charge**; **snapshot `commission_amount`**; on success set `CONFIRMED` + `utcConfirmedAt`, persist contact, issue voucher/tickets, send the Resend confirmation email, fire `booking_complete` tracking with **conversion = commission EUR**) · `POST /bookings/{uuid}/cancel` (compute refund **FULL/PARTIAL/NONE** from the `cancellationHours` window, **release capacity atomically**, set `CANCELLED` + `BookingCancellation`, Stripe refund per the decision, **respect commission reversal rules**) · `POST /bookings/{uuid}/extend` (**only while `ON_HOLD`**) · `PATCH /bookings/{uuid}` (⚠️ **D8** — re-validate capacity + pricing) · `GET /bookings/{uuid}` and `GET /bookings/` (**authZ: a reseller/operator sees only its own bookings; admin sees all**) · plus a **BullMQ expiry job** sweeping `ON_HOLD` past `utcExpiresAt` → `EXPIRED` and **releasing held capacity**.
- **Booking schema expansion:** `uuid` (client-supplied, unique), `resellerReference`, `supplierReference`, `utcExpiresAt`, `utcConfirmedAt`, `utcRedeemedAt`, `freesale`, `cancellable`, `testMode`, `currency`, `notes`, pricing-breakdown fields, `cancellationRefund`/`cancellationReason`/`utcCancelledAt`; **contact** fields (`contactFirstName/LastName/FullName/Email/Phone/PostalCode/Country/Locales/Notes` — a guest override falling back to `User`); the **new `BookingUnitItem` table** (`id, bookingId, uuid, unitId, status, utcRedeemedAt`, contact/ticket/pricing fields, `resellerReference`, `supplierReference`). ⚠️ **D6: reconcile with master E.8** (public_ref/display_ref, multi-currency, commission snapshot, click IDs/UTM, payment_model, billing) — **OCTO fields and E.8 fields coexist**; align names where they overlap (`public_ref` ↔ `uuid`?, `display_ref` ↔ `resellerReference`?).
- **TO BUILD — `octo/pickups` / `octo/dropoffs`:** pickup/dropoff location tables (or reuse `TourLocation` typed as pickup/dropoff) + Option flags; option/availability/booking serializer additions; **`GET /bookings/{uuid}/pickupLocations?latitude=&longitude=`** (full list, or reordered/subset/virtual location with coordinates). Map `Tour.pickupModel` (INCLUDED/PAID_ADDON/NONE) → pickup capability flags; **PAID_ADDON pickups link to the pickup add-on (⚠️ D12 — first-class pickup locations)**.
- **Error structure:** the OCTO filter emits `{ error, errorMessage, tourId?, optionId?, unitId?, availabilityId? }`. **Map:** validation → `BAD_REQUEST` (400); unknown ids → `INVALID_*_ID` / `INVALID_BOOKING_UUID` (400); sold-out / restriction / expired → **`UNPROCESSABLE_ENTITY` (422)**; auth → `UNAUTHORIZED` (401) / `FORBIDDEN` (403); unhandled → `INTERNAL_SERVER_ERROR` (500). **Keep the native `{statusCode,timestamp,path,message}` for `/api/v1` (admin/discovery) — do not change those.** Swagger error DTOs (`OctoErrorDto`) for OCTO routes.

#### E.11.8 The availability & booking engine (real-time, no overbooking)

- **Six non-negotiables:** (1) **the single source of truth is the `departures` table** (materialized inventory) in PostgreSQL — **not iCal, not a cache, not the operator's external calendar**; (2) **real-time** — availability reads hit live inventory, **with short, safe caching only on the public list/calendar, never on the final reservation step**; (3) **no overbooking, ever** — every seat decrement is **atomic and conditional**, and **concurrency is handled at the database, not in application memory**; (4) **reserve → confirm** (the OCTO two-step) — a reservation **holds** inventory for a short window and **expiry releases it automatically**; (5) **iCal is secondary** — export a feed for operators and optionally import external "blocked dates", **but availability decisions are made on our inventory**; (6) **event-driven** — booking/availability changes emit webhooks so operators/partners stay in sync.
- ⚠️ **A1 — the seat-claim mechanism.** **Recommended (1): an atomic conditional UPDATE** (no explicit lock, fewest round-trips): `UPDATE departures SET vacancies = vacancies - $units WHERE id = $departureId AND status = 'AVAILABLE' AND vacancies >= $units RETURNING id, vacancies;` — **if 0 rows are returned there is not enough capacity → reject `UNPROCESSABLE_ENTITY`.** A single atomic statement; **two concurrent requests for the last seat — exactly one wins.** **Run it inside the same `prisma.$transaction` that creates the booking + unit items, so a booking failure rolls the seats back.** Alternatives: (2) `SELECT … FOR UPDATE` inside a transaction (more explicit, slightly more locking — use for multi-row inventory claims); (3) serializable isolation with retry (strongest, needs retry-on-conflict handling, costs throughput — reserve for complex multi-row claims). **Default to (1).**
- **Hold accounting:** a reservation **decrements `vacancies` immediately**; expiry or cancellation **increments it back atomically**; **confirmation does NOT change `vacancies` again (already decremented at hold).**
- **Idempotency:** Create Booking carries a client `uuid` — **enforce `UNIQUE(uuid)`** so a retried request never double-decrements, and **handle the unique violation by returning the existing booking, not a duplicate**. Optionally honor an `Idempotency-Key` header on POSTs.
- **Backstop:** a DB **`CHECK (vacancies >= 0)`** constraint guards against negative inventory.
- **Concurrency tests are the make-or-break suite:** fire **50 / 100 / 500 simultaneous reservations** at a 1-seat and an N-seat departure and assert **exactly `capacity` succeed**, the rest get `UNPROCESSABLE_ENTITY`, and final **`vacancies == 0` (never negative)**. Plus a **load test** of the availability + reserve endpoints (p95 latency, error rate under burst).
- **Phase plan:** 0 discovery/planning (**define the hold-window default, e.g. 15–30 min `expirationMinutes`, and the supplier max**; cancellation/refund rules from **`cancellationHours` enum `[24,48,72,168]`, default 48**; **document iCal's limitations — not real-time, no atomic capacity**) → 1 data model (`availability_schedules`, `availability_exceptions`, `departures`, bookings expansion, `booking_unit_items`, `webhook_subscriptions` + `webhook_deliveries`, `ical_sync_logs`) → 2 materialization → 3 OCTO availability API → 4 booking lifecycle → 5 **concurrency & overbooking protection (MOST CRITICAL)** → 6 real-time updates & webhooks → 7 payments wired into confirm/cancel → 8 iCal (secondary) → 9 security & access (**per-operator API keys + permissions; scope bookings/availability to the owning operator; throttle tuned for the booking burst path; audit logs on inventory + booking mutations**) → 10-11 documentation & testing/QA.
- **`departures` fields:** `id`, `tourId`, `optionId`, `localDateTimeStart`, `localDateTimeEnd`, `allDay`, **`capacity` (int), `vacancies` (int, the live counter), `status`** (`AVAILABLE|LIMITED|SOLD_OUT|CLOSED|FREESALE`), `utcCutoffAt`, `priceOverride?`; **indexes `(tourId, localDateTimeStart)` and `(status)`.**
- **MVP cut — must have:** the `departures` inventory model + nightly materializer; `POST /availability` + `/availability/calendar` (OCTO-shaped); `POST /bookings` (reserve, atomic claim) → confirm → cancel, with extend; **atomic conditional decrement + `prisma.$transaction` + `UNIQUE(uuid)` + `CHECK(vacancies>=0)`**; the hold-expiry sweeper; the OCTO error shape on the OCTO namespace; **a concurrency test proving no overbooking.** **Later:** webhooks/partner subscriptions, iCal export/import, multi-option tours, pickups/dropoffs, richer unit types, full pricing-capability taxes and multi-currency display, **OTA integrations (Viator / GetYourGuide adapters)**.

#### E.11.9 Per-tour reviews (native, not OCTO)

- **Native, booking-gated, per-tour, moderated, multilingual — it stays under `/api/v1` (not the OCTO namespace)** because **OCTO has no review capability**. It surfaces as `AggregateRating`/`Review` JSON-LD on the tour page and feeds `qualityScore`.
- Expand `Review` to **master E.7** (sub-ratings, reviewer identity, travel month/year, photos, helpful count, operator response, moderation) + `ReviewTranslation` (per-locale text).
- **Create** `POST /api/v1/tours/{id}/reviews` — **booking-gated**: only a `REDEEMED`/completed booking by this user, **one review per booking (`bookingId @unique`)**; starts `PENDING`.
- **List** `GET /api/v1/tours/{id}/reviews` — public, **approved only**, paginated, sortable (**newest / highest / most-helpful**), per-locale text via `Accept-Language` → **EN fallback**.
- **Operator response** `POST /api/v1/reviews/{id}/response`; **moderation** `PATCH /api/v1/reviews/{id}/moderate` (admin, approve/reject + reason).
- **Aggregates:** on approve/unapprove, recompute `Tour.aggregateRating`/`Count` and `Operator.aggregateRating`/`Count` (cached).
- **LD11 cold-start (service rule):** a tour shows **its own rating only at ≥3 approved**; else the **operator fallback only if ≥10 reviews & ≥4.0**; **else no rating.** The frontend must **never render a fabricated one.**
- **RBAC:** `VIEW_REVIEWS` / `EDIT_REVIEW` / `DELETE_REVIEW` / `APPROVE_REVIEW`.

#### E.11.10 Reconciliation with the master (do not regress)

- **Commission tiers / ranking / quality score** stay native — the OCTO tour list does **not** expose tier internals, but our own listing endpoints still order by `tier_rank, quality_score, id`. (**OCTO `/tours` ordering — define: keep ranked, or stable.** As built it returns the LIVE catalog **tier-ranked**.)
- **Commission snapshot on confirm** (conversion value = `commission_amount` EUR) fires from the OCTO confirm path.
- **Payment models** (operator_link / on_arrival / paid_in_full / operator_full) map onto OCTO confirm + Stripe (⚠️ **D7: OCTO confirm is synchronous; our Stripe deposit/full flow may need a `PENDING` intermediate — use OCTO `PENDING`**).
- **7 locales** — `octo/content` localization via `Accept-Language` ↔ our `TourTranslation`.
- **Multi-category / multi-hub** — categories → `categoryLabels` (**lossy; the OCTO enum is fixed**), hubs → `locations`; **keep the native category/hub pages.**
- **TYP / tracking / Consent Mode v2 / Meta CAPI** fire from OCTO confirm; **the TYP route is unchanged.**
- **Slug registry / flat URLs** unchanged (native discovery).
- **Cancellation window** (`cancellation_hours` enum, default 48) → OCTO `cancellationCutoff` + refund computation.
- **Decisions D0–D13 (recommendations):** D0 dedicated `/api/octo/v1` (⚠️ built as `/api/v1/octo`) · D1 cookie for v1, bearer for OTAs · D2 Decimal in the DB, minor units at the boundary · D3 a single DEFAULT option, age bands → units, add-ons native · D4 platform-as-supplier · D5 confirm list pagination against the spec · D6 align booking reference names, both sets coexist · D7 use the OCTO `PENDING` intermediate · D8 confirm Update-Booking semantics · D9 the BookingStatus migration mapping as specified · D10 map ADULT/CHILD/INFANT now, extend later · D11 add the `productId`/`/products` alias only when an external OCTO client integrates · D12 first-class pickup locations, PAID_ADDON links the pickup add-on · D13 HMAC signature header + backoff retry as our convention. **DS1 → keep dedicated content tables (NOT unified); DS2 → rename the physical table `trips` → `tours` with no alias.**
- **Build sequence:** 0 conventions → 1 `GET /supplier/` + `/tours` + `/tours/{id}` → 2 the availability model (master Stage 5) → 3 `POST /availability` + `/availability/calendar` → 4 booking schema expansion + `BookingUnitItem` + `BookingStatus` migration → 5 the booking lifecycle + expiry job → 6 payments + tracking + email on confirm → 7 per-tour reviews (native) → 8 `octo/notifications` → 9 pickups/dropoffs + frontend alignment. **The migration is complete only when every endpoint and capability row in the coverage matrix is checked.**

#### E.11.11 Frontend alignment

| Area | Before | After (OCTO) |
|---|---|---|
| Tour detail data | `GET /tours/slug/:slug` (native shape) | `GET /tours/{id}` (Tour → Option → Unit) with `Octo-Capabilities` |
| Availability | `GET /tours/:id/schedules` (flat list) | `POST /availability` + `POST /availability/calendar` |
| Booking | none (no API) | reserve → confirm two-step (`POST /bookings`, `/confirm`, `/cancel`, `/extend`) |
| Money | decimals from the API | **integer minor units** + `currencyPrecision` → convert in a helper |
| Pax selection | age bands | **units** (with restrictions: min/max age, counts, `accompaniedBy`) |
| Errors | `{statusCode,message}` | `{ error, errorMessage, <contextId> }` |
| Capabilities | n/a | send `Octo-Capabilities: octo/content, octo/pricing` (+ pickups when used) |

- **The native discovery surface (homepage, destination, category, hub, collection, search, filters, slug routing) stays on `/api/v1` and does NOT change.** Only the tour detail data, availability, and the booking/checkout flow move to OCTO.
- **Types (`types/octo.ts`):** `OctoTour`, `OctoOption`, `OctoUnit`, `OctoUnitRestrictions`, `OctoAvailability`, `OctoAvailabilityCalendar`, `OctoBooking`, `OctoUnitItem`, `OctoContact`, `OctoPricing`, `OctoTax`, `OctoFeature`, `OctoMedia`, `OctoLocation`, `OctoBookingCancellation`, plus the status unions. **Mark capability-gated fields optional so core responses typecheck.**
- **Client (`lib/api/octo.ts`):** always send `Octo-Capabilities` (default `octo/content, octo/pricing`); methods `getTour`, `getTours`, `checkAvailability`, `getAvailabilityCalendar`, `createBooking`, `confirmBooking`, `cancelBooking`, `extendBooking`, `getBooking`. **Error parsing reads `{ error, errorMessage }`, NOT `{ message }`**, and branches on codes (`UNPROCESSABLE_ENTITY` → "sold out / try another slot", `INVALID_BOOKING_UUID` → "session expired"). **Generate the booking `uuid` client-side (`crypto.randomUUID()`) and reuse it across retries (idempotency).**
- **Money helper (`lib/money.ts`):** `formatPrice(pricing, locale)` → **`retail / 10^currencyPrecision`** via `Intl.NumberFormat`. **Never do float math on minor units beyond the single divide-at-display.** Currency selection respects the locale default (EN/ZH → USD, others → EUR) plus the footer selector, and is passed into availability/booking requests.
- **Booking widget (the big change):** a **unit selector** honoring `restrictions` (**`accompaniedBy` — e.g. a CHILD requires an ADULT**) and `option.restrictions.min/maxUnits`; a **date/slot selector** from calendar → slots, showing `status` (**LIMITED → "Only N left" from `vacancies`; SOLD_OUT disabled**); **live price** from `unitPricing`/`pricing`; **Step 1 Reserve** (`POST /bookings` with the client `uuid`, `availabilityId`, `unitItems`, `expirationMinutes`; store the returned `uuid` + `utcExpiresAt`); a **hold timer** counting down to `utcExpiresAt` with "extend" or graceful expiry handling (re-check availability, re-reserve); **Step 2 Confirm** (collect `contact` per `option.requiredContactFields` + per-unit `unit.requiredContactFields`, run payment, then `POST /bookings/{uuid}/confirm`). **Add-ons stay UNCHECKED by default (EU Digital Fairness Act)** and are sent as native booking extras.
- **Errors and edge cases:** map OCTO codes to user-facing messages; **handle hold expiry mid-checkout by prompting to re-reserve — never silently lose the seat**; **handle race loss (`UNPROCESSABLE_ENTITY` on reserve) by refreshing availability and asking the user to pick again.**
- **Dashboard availability authoring writes `availability_schedules` / `availability_exceptions` via the NATIVE admin API, not the OCTO read endpoints**, and shows live `departures` (capacity vs vacancies, status) plus operator-scoped booking management.

---

### E.12 Testing infrastructure

- **Unit tests (backend):** Jest-style `*.spec.ts` files colocated with each service. **Unit specs are mocked — CI runs them with no database.** Suite growth on record: **1197 tests / 58 suites (all green)** after Staff & Teams (**113 new tests**), **1228 pass** after analytics (**15 new**), **1245/1245** after the customer-accounts review rounds, and **1285/1286** during the homepage work.
  - Named suites: `staff.config.spec.ts` (the formula, both ceiling directions, floor non-revocability, owner/suspended cases) · `staff-permissions.service.spec.ts` (short-circuits, fallbacks, **the real 60s TTL with fake timers**, invalidation) · `staff.service.spec.ts` (invite 409/400/rollback, the operator-resolution matrix, owner/self protections, suspend cascades, designation rules, catalog scoping — **Better Auth mocked the same way as `operators.service.spec.ts`**) · `permissions.guard.spec.ts` · `user.service` / `tours.service` · `analytics.service.spec.ts` (15) · `customer-provisioning.service.spec.ts` (10 — create+welcome-once, no-email no-op, non-USER skip, linked-silent, resend cap hit/ok, conflict race, never-throws, aggregate recompute) · `bookings.service.spec.ts` · `payments.service.spec.ts` · `fx-rates.service.spec.ts` · `fx-refresh.service.spec.ts` · `booking-pricing.util.spec.ts` · home-page specs (12 service + 16 FAQ + 16 featured-experiences + 9 DTO).
  - **NOT unit-tested (covered manually):** the `auth.instance` invite branch — **a module-level Better Auth singleton**, covered by the manual E2E pass.
  - ⚠️ **Known pre-existing failure:** the `tours.service.spec.ts` date-filter test **hardcodes `2026-07-20` and "expires the moment that morning passes"**. Confirmed failing at clean HEAD via `git stash` — **not caused by any of the work above. Everything else is green.**
  - ⚠️ **Baseline before blame:** never call a failure a regression until the same check has been run against the pre-change code; **diff test NAMES, not counts.**
- **Live end-to-end verification (curl against the built backend with real admin/operator/staff/seat logins)** is a first-class step, not a formality: **it is what surfaced the session cookie-cache revocation bypass, the permissionless bookings reads, and the 500-on-suspended-login — none of which unit tests alone would have caught.** The customer-accounts E2E run (book → welcome email → set password → log in) likewise surfaced **two real bugs** (`reserve()` stamping `booking.userId` with whoever was logged into the browser, and a backfill that only claimed `userId IS NULL` rows).
- **E2E (dashboard):** **Playwright**, `e2e/` with 11 specs — **all 11 are dashboard tests**, so "leave the public-site specs behind" had nothing to act on. **The stored auth state `e2e/.auth/user.json` is deliberately NOT carried between repos — it is a credential.** `playwright.config.ts` is pinned to **:3001** (the port-collision fix) with `workers: 1, fullyParallel: false`.
  - ⚠️ **The e2e suite is NOT a parity gate — it is ~45% red on BOTH sides.** Old: 125 passed / **102 failed**; new: 120 passed / **107 failed**. After a clean uncontended re-run (106 failed / 121 passed, 29.3m) the name-by-name diff was **102 failures identical on both sides, 0 failing only on old, 4 failing only on new — and all four fail on old too when run in isolation.** **ZERO REGRESSIONS; all 227 tests behave identically.** The four were **DATABASE RESIDUE**: they passed in the full old-suite run and fail standalone on old too. **A count (102 vs 106) would have read as "4 regressions"; a full-suite re-run would have reshuffled the residue and produced a different four. Only isolation holds the variable still. It indicts the suite, not the app.**
  - **Suite trim (Phase 9B, PARTIAL):** **user decision — keep behaviour/contract tests, cut presence-only. Not by red/green — those are anti-correlated here:** the green tests are mostly the worthless ones ("Key input is rendered"), the red ones mostly the contracts ("confirming deactivation calls DELETE"). **Cutting by colour would have deleted everything worth having.** The rule: *would this test still pass if the feature were broken?* **55 presence-only tests deleted, 227 → 172**, with **23 rescued** despite presence-shaped names — **a regex classified; a human eye rescued. Do not re-run the regex and trust it.**
  - ⚠️ **THE MOCKS ADDRESSED AN API THAT DOES NOT EXIST.** Tests routed `**/api/v1/trips/*` while the app calls `/api/v1/tours/*`; every mock missed, every request hit the real backend, the page rendered **"Trip not found"**, and `beforeEach` waited 15s for a form that never came — **that is the entire ~17s signature across the Edit Trip block: 38 failures, one cause.** Also corrected: `/tours/my-tours` (not `my-trips`), and **schedules live at `/availability/schedules?tourId=`, not under the tour — a blind `trips`→`tours` replace would have been wrong.**
  - **PARKED — the trips fixtures are archaeological (~1 day):** with mocks matching, the app now crashes on the fixture (`TypeError: Cannot read properties of undefined (reading '0')` at `tripToDefaults`, `trip.categoryIds[0]`). `MOCK_TRIP_DRAFT` has **35 keys against a `TripListItem` of ~60** and predates **four migrations**: `categoryId` → `categoryIds[]` + `primaryCategoryId`; `hubId` → `hubIds[]`; `durationMinutes` → `durationMinutesFrom`/`To`; `featuredSlotNumber`/`featuredSlotStatus` → **the slot economy is REMOVED**, now `tierKey`/`tierRank`/`commissionTier`; plus the whole OCTO block. **These tests have been asserting against a schema that no longer exists, on both dashboards, for a long time. Do NOT "fix" the app to tolerate the fixture.** ~41 failures (collections 12 · attributes 11 · categories 9 · destinations 5 · hubs 4) remain undiagnosed.
  - **Deliberately NOT done: isolation.** `workers: 1, fullyParallel: false` stays. **Isolation is what makes `workers: 4` safe (~172 tests in ~2-3 min vs today's ~19-29). It is the expensive half and it is owed.**
- **Neither frontend repo has a unit-test runner (Playwright only).** As a consequence, the cache-tag mapping and revalidate-endpoint checks were **run as harnesses against the real files, not committed tests** — **so the tag contract is guarded at runtime by the 400 only.** A CI check is **not cheaply possible: the dashboard repo has no CI at all.** The target test layering is vitest for pure `lib/` logic, vitest + a live backend for contract tests, RTL for components, and Playwright for E2E — **with the tag-mapping tests and the rbac contract test as the priority, because both guard silent failures.**
- **Test database:** the backend e2e setup uses a dedicated **`island_tours_test`** database with an explicit reset consent step. **Sign-up is disabled**, so test users must be provisioned through the Better Auth internal adapter, and cleanup must follow an FK-safe order. *(This detail comes from project convention rather than the four fragments assigned here; treat the fragment-backed statements above as the primary record.)*
- **Seeding — two distinct seeds:**
  - **Production/base seed** — `pnpm prisma:seed`, run by `backend/docker-entrypoint.sh` when **`RUN_SEED=true`** (**first boot only**, then set to `false`). It seeds **the admin user** (from `ADMIN_EMAIL`/`ADMIN_PASSWORD`) **+ base data** (destinations, the 19 global categories, and the other pre-seeded content). `is_seeded = true` destinations **cannot be deleted**.
  - **Removable demo seed** — **`pnpm prisma:seed:demo`** (with a clean counterpart), used to populate a rich local dataset: it is what the Phase 9 parity run requires locally (**backend on :5050 with the demo seed, `http://localhost:3001` in `CORS_ORIGINS`, and the public site on :3000 for the cross-service rows**), and it is the dataset the analytics module was verified against (**263 bookings, 15 distinct bookers, 12 registered**). It also seeds the 7 `FeaturedExperience` rows used to prove the homepage resolver. ⚠️ **Known demo-seed quirk: it populates `ogImage` but NOT `heroImage` on categories** — without the resolver's `heroImage || ogImage` fallback every featured card rendered grey.
- **Verification discipline applied throughout:** `tsc --noEmit` clean and `eslint` clean on every touched file in **both** repos, plus `pnpm build` / `next build` green, are treated as the floor — **not the proof.** ⚠️ **A green build proves nothing about CSS** (Tailwind silently skips unknown utilities — verify in the BUILT output), ⚠️ **`tsc --noEmit` passes route-segment config that `next build` rejects** (`export const runtime = 'nodejs'` under `cacheComponents`), and ⚠️ **a check whose failure mode looks like success is worse than no check** (a suppressed-stderr `diff` reading a missing directory as "identical"; a `grep` over a missing path; an ESLint regex that fails to parse and reports zero). **Every lint rule was proved to fire against positive AND negative cases before being trusted, then the probe was deleted.**

---
