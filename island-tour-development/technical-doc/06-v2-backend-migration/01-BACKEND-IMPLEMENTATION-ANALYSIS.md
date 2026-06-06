# 01 — Backend Implementation Analysis (Current State)

> **What this is:** a faithful snapshot of what the backend **actually does today**, read from the code in `backend/src/**` and `backend/prisma/**` on 2026-06-06. No changes proposed here — this is the "before" baseline for the V2 migration.
> **Companion docs:** `02-BACKEND-CHANGE-LIST.md` (what changes), `03-BACKEND-MIGRATION-STEPS.md` (how), `04-BEFORE-AFTER-AND-LOGIC.md` (why).
> **Target spec:** `../02-architecture/PLATFORM-ARCHITECTURE-V2.md`.

---

## 0. Module inventory

Registered in `app.module.ts`: `Prisma, Auth, Mail, User, Settings, Operators, MediaGallery, Categories, Destinations, Hubs, SlugRegistry, Trips`.

| Domain module | Files | V2 relevance |
|---|---|---|
| `destinations/` | service, controller, swagger, dto | **High** — missing region + ~12 fields |
| `categories/` | service, controller, swagger, dto | **High** — missing fields, gating, wrong seed |
| `hubs/` | service, controller, swagger, dto | Medium — missing hub_type, geo |
| `slug-registry/` | service, controller, swagger, dto | Medium — resolver only, no redirects |
| `trips/` | trips.* + trips-children.* | **High** — single cat/hub, hub-nested URL, no attributes |
| `operators/`, `users/`, `media-gallery/`, `settings/`, `mail/`, `auth/` | — | Out of V2 scope (transactional/infra) |
| **Missing entirely** | — | **Collections, Attributes/Filters, Search** |

---

## 1. Destinations (`destinations/destinations.service.ts`)

**Model fields actually selected (`destinationSelect`):** `id, name, slug, heroImage, isSeeded, isActive, createdAt, updatedAt`. Plus per-locale `DestinationTranslation` (name, overview, h1Override, breadcrumbLabel) and `DestinationPageContent` (aboutText, metaTitle, metaDescription) and `Faq (pageType=destination)`.

**Create (`create`)** — one transaction:
1. `destination.create` (name, slug, heroImage, createdBy).
2. Seed **1 RESERVED** slug_registry row (`slug='tours'`).
3. Find all active categories → seed **1 CATEGORY** slug_registry row per category.

**Update** — name/heroImage/isActive only. On `isActive` change, cascades `isActive` to **all** slug_registry rows for that destination slug.

**Delete** — soft (`isActive=false`) + blocks if `isSeeded` or if active non-DRAFT trips exist. `forceDelete` hard-deletes + clears slug_registry.

**What's absent vs V2 §2:** `region` (required in V2), `country`, `latitude`, `longitude`, `timezone`, `currency`, `language`, `galleryImages`, `parentDestinationId`, `status` enum (uses `isActive`), `og_image` (only meta in page content). No "browse by region" support possible.

---

## 2. Categories (`categories/categories.service.ts`)

**Model fields selected (`categorySelect`):** `id, name, slug, heroImage, isActive, isSeeded, createdAt, updatedAt`. (Note: a `heroImage` field exists on Category — not part of V2 but harmless.) Plus translations / page content / FAQ as per the multilingual pattern.

**Create (`create`)** — one transaction:
1. `category.create` (name, slug, heroImage, createdBy).
2. Seed **exactly 3 FeaturedSlot** rows (slotNumber 1–3, AVAILABLE) — slot economy, retained.
3. Find all active destinations → seed **1 CATEGORY** slug_registry row per destination.

**Update** — name/heroImage/isActive. On `isActive` change, cascades to slug_registry rows for this category.

**Delete** — soft; blocks if `isSeeded` or if active non-DRAFT trips reference it (`where: { categoryId: id }` — single FK). `forceDelete` tears down featured slots + slot children + slug_registry, then deletes.

**What's absent vs V2 §3:** `description` base column (uses translation overview), `icon`, `sort_order`, `parent_category_id`, `meta_title_template`, `meta_description_template`. **No tour-count gating** — a category slug row is seeded `isActive:true` for every destination, so an empty category page would resolve and render (V2 forbids this). The trip-count guard on delete uses the single `categoryId` FK and will break under many-to-many.

---

## 3. Hubs (`hubs/hubs.service.ts`) + `seed.ts`

Hubs are destination-specific. On create: writes **1 HUB** slug_registry row (same transaction) and manages `HubAllowedCategory`, `HubOurPick`, `HubComparisonGroup`/`Tour`, translations, page content, FAQ. Richer editorial structure than V2 specifies.

**What's absent vs V2 §5:** `hub_type` enum (location/highlight/area), `latitude`, `longitude`. (Content/FAQ are relational tables, not JSON — an intentional improvement.)

---

## 4. Slug Registry (`slug-registry/slug-registry.service.ts`)

Single method `resolve(destinationSlug, slug)`: looks up `SlugRegistry` by unique `(destinationSlug, slug)`, throws 404 if missing or `isActive=false`, else returns `{ destinationSlug, slug, entityType, entityId }`.

`SlugEntityType` enum = `TOUR, CATEGORY, HUB, COLLECTION, RESERVED`. **`COLLECTION` exists but nothing writes or reads it** (dangling stub — no Collection module).

**What's absent vs V2 §9:** no `slug_redirects` table, no 301 handling (step 5 of V2's routing logic), no editable slugs (slugs are immutable), no 90-day cooldown (soft-delete keeps slug reserved indefinitely — a deliberate, safer divergence). The "tours" reserved slug is handled; the 19 category slugs are **not** correctly pre-seeded because the seed list is wrong (see §6).

---

## 5. Trips (`trips/trips.service.ts`, `trips-children.service.ts`)

**Cardinality (the core V2 gap):**
- `Trip.categoryId` — **single** category (FK).
- `Trip.hubId` — **single** optional hub (FK).

**Two URL shapes (conflicts with V2's always-flat rule):**
- Destination-only (`hubId=null`): flat `/{dest}/{tour-slug}/`, **writes** a `TOUR` slug_registry row.
- Hub-anchored (`hubId` set): two-segment `/{dest}/{hub-slug}/{tour-slug}/`, **skips** slug_registry. Resolved by `findBySlug` via the `hubSlug` query param.

**`create`:** resolves operator → validates destination+category active → `resolveUniqueSlug` (auto-suffixes with operator name on collision; checks slug_registry only for non-hub-anchored) → in a transaction: validates hub (exists, belongs to destination, category in `HubAllowedCategory`) → creates trip → if `!hubId`, writes `TOUR` slug_registry row.

**`resolveUniqueSlug`:** the `isHubAnchored` flag toggles whether slug_registry is consulted — hub-anchored slugs only need uniqueness within `trips`, not the registry.

**Lifecycle:** `DRAFT → publish → LIVE ⇄ pause/unpause PAUSED`; `archive` → ARCHIVED + soft `isActive=false` + deactivates the `TOUR` slug_registry row (only for non-hub trips); `restore` → back to DRAFT; `remove` → hard delete, **requires ARCHIVED first** (non-admin) — *note: `TRIP-MODULE.md` still says "delete DRAFT only", a doc drift.*

**Publish blocks:** ≥5 images, a hero image, English overview present, ≥3 highlights. (Matches docs.)

**`findAll` (public):** filters by `destinationId, categoryId (single), hubId (single), pricingModel, minPrice/maxPrice, search(name)`. No attribute facets, no "Recommended" sort (orders by `publishedAt desc`).

**Child models (`trips-children.service.ts`):** images, age bands, add-ons, languages, highlights(+translations), inclusions(+translations), trip translations, schedules. **No `tour_attributes`** — V2's attribute values have nowhere to live.

**What's absent vs V2 §4/§7:** multi-category, multi-hub, always-flat URL, `tour_attributes`, attribute-based filtering, "Recommended" weighted sort, CRO counters (`booking_count_today`, `spots_remaining`, `last_booked_at`), `short_description`, `excludes`, `og_image`, and the many boolean/enum properties V2 models as attributes.

---

## 6. Seed (`backend/prisma/seed.ts`) — **materially wrong vs V2**

This is the most concrete divergence and breaks the "19 category slugs reserved per destination" rule.

**Categories seeded (7, and several are NOT categories):**
| Seeded | V2 verdict |
|---|---|
| Boat Tours `boat-tours` | ✅ valid category |
| Sunset Cruises `sunset-cruises` | ✅ valid (V2 slug `sunset-cruises`) |
| Buggy Tours `buggy-tours` | ❌ should be **Off-Road Tours** `off-road-tours` |
| Snorkeling Trips `snorkeling-trips` | ❌ slug should be `snorkeling` |
| Private Charters `private-charters` | ❌ not a category — a **Collection / attribute** (`booking_type=private`) |
| Catamaran Trip `catamaran-trip` | ❌ not a category — a **boat_type attribute** |
| Dolphin Encounters `dolphin-encounters` | ❌ not a category — a **hub/wildlife attribute** |

Missing the other 14 canonical categories (scuba-diving, day-trips, jet-ski, parasailing, water-sports, fishing-trips, nature-wildlife-tours, hiking-tours, adventure-tours, cultural-tours, food-tours, attraction-tickets, luxury-experiences, workshops-classes).

**Destinations seeded (4):** Curaçao, Aruba, Sint Maarten, Saint Lucia. **Missing Bahamas** (V2 launch list = 5). No `region` set (field doesn't exist yet).

**Hubs seeded (1):** Klein Curaçao (Curaçao) with allowed categories — fine, but references the wrong category slugs (`snorkeling-trips`, `catamaran-trip`).

> Consequence: the slug registry pre-seeds the wrong 7 slugs per destination, not the canonical 19. Any V2-aligned category page (`/curacao/scuba-diving/`) is unroutable today.

---

## 7. Cross-cutting current-state facts

- **Status model:** `isActive` boolean on destination/category/hub; `TripStatus` enum (`DRAFT/LIVE/PAUSED/ARCHIVED`) on trips. No `published/draft/archived` enum on the discovery entities.
- **Soft-delete everywhere** (see `SOFT-DELETE-STRATEGY.md`) — slugs reserved indefinitely.
- **Slot economy fully wired into category create** (3 slots) and trip lifecycle hooks — **retained**, not touched by this migration.
- **i18n is solid and V2-aligned** — 7 locales, typed translation tables, English slugs, fallback. Only confirmations remain (no-prefix 302, OG per locale).
- **No discovery extras:** no attributes table, no collections, no search, no JSON-LD/sitemap/breadcrumb emitters.

---

## 8. Summary scorecard (current vs V2)

| V2 area | Current backend state |
|---|---|
| Destinations + region | ⚠️ core only; **no region/geo/country/currency** |
| 19 global categories | ❌ **7 wrong categories seeded** |
| Category page gating | ❌ empty pages would render |
| Category fields (icon/sort/templates) | ❌ absent |
| Tour ↔ 1+ categories | ❌ single `categoryId` |
| Tour ↔ 0–n hubs | ❌ single `hubId` |
| Tour always-flat URL | ❌ hub-anchored two-segment URL exists |
| Attributes / filters | ❌ none |
| Collections | ❌ enum stub only |
| Search | ❌ none |
| Slug registry resolve | ✅ works; ❌ no redirects |
| Hubs | ✅ rich; ❌ no hub_type/geo |
| i18n | ✅ aligned |
| Slot economy | ✅ retained (out of V2 scope) |
