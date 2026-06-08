# 02 — Backend Change List (What Must Change & Where)

> **What this is:** the complete, itemized list of backend + core-logic changes required to align with `../02-architecture/PLATFORM-ARCHITECTURE-V2.md`. Each row names the exact file/model and the change. Use this as the build backlog; `03-BACKEND-MIGRATION-STEPS.md` sequences it; `04-BEFORE-AFTER-AND-LOGIC.md` explains the reasoning.
>
> **Retained, do not touch:** featured-slot economy, waitlist, bookings, payments, reviews, operators, auth, mail, media. The slot machinery on category-create stays.
>
> Legend: 🟢 additive/low-risk · 🟡 medium · 🔴 breaking (data migration + API change). `[mig]` = needs a Prisma migration.

---

## Group 1 — Schema additions (additive) 🟢

| # | Change | File(s) |
|---|---|---|
| 1.1 `[mig]` | Add `Region` enum (`CARIBBEAN, ATLANTIC, MEDITERRANEAN, ASIA, AFRICA`) | `prisma/enums.prisma` |
| 1.2 `[mig]` | `Destination`: add `region Region` (required), `country String`, `latitude Float`, `longitude Float`, `timezone String`, `currency String`, `language String`, `galleryImages String[]`, `parentDestinationId String?` (+ self-relation) | `prisma/destinations.prisma` |
| 1.3 `[mig]` | `Destination`: add `ogImage String?` (or extend `DestinationPageContent` with `ogImage`) | `prisma/destinations.prisma` |
| 1.4 `[mig]` | `Category`: add `description String?`, `icon String?`, `sortOrder Int @default(0)`, `parentCategoryId String?` (+ self-relation), `metaTitleTemplate String?`, `metaDescriptionTemplate String?` | `prisma/categories.prisma` |
| 1.5 `[mig]` | Add `HubType` enum (`LOCATION, HIGHLIGHT, AREA`); `Hub`: add `hubType HubType`, `latitude Float?`, `longitude Float?` | `prisma/enums.prisma`, `prisma/destinations.prisma` |
| 1.6 | Surface all new fields in DTOs + Swagger + responses | `*/dto/*.dto.ts`, `*/*.swagger.ts`, service `*Select` consts |

## Group 2 — Seed correction 🟡

| # | Change | File(s) |
|---|---|---|
| 2.1 | Replace `SEED_CATEGORIES` with the **canonical 19** (name + slug per V2 §3). Remove non-categories (Private Charters, Catamaran Trip, Dolphin Encounters); rename Buggy→Off-Road (`off-road-tours`), Snorkeling Trips→`snorkeling` | `prisma/seed.ts` |
| 2.2 | Add **Bahamas** to `SEED_DESTINATIONS` (5 total); set `region: CARIBBEAN` on all 5 | `prisma/seed.ts` |
| 2.3 | Fix `SEED_HUBS` Klein Curaçao `allowedCategorySlugs` to canonical slugs (`boat-tours, snorkeling, day-trips`); set `hubType: LOCATION` | `prisma/seed.ts` |
| 2.4 | Add a data-fix migration/script for existing DBs: rename/re-map old category slugs, add missing categories, add Bahamas, backfill region (idempotent) | `prisma/migrations/` + one-off script |

## Group 3 — Tour cardinality (many-to-many) 🔴 `[mig]`

| # | Change | File(s) |
|---|---|---|
| 3.1 `[mig]` | New `TourCategory` join: `(tripId, categoryId, isPrimary Boolean)`, `@@unique([tripId, categoryId])`, index on `categoryId`. Exactly one `isPrimary=true` per trip | `prisma/trips.prisma` |
| 3.2 `[mig]` | New `TourHub` join: `(tripId, hubId)`, `@@unique`, index on `hubId` | `prisma/trips.prisma` |
| 3.3 `[mig]` | Backfill: each existing `Trip.categoryId` → one `TourCategory` (`isPrimary=true`); each `Trip.hubId` (if set) → one `TourHub` | data migration |
| 3.4 `[mig]` | Drop `Trip.categoryId` and `Trip.hubId` after backfill (or keep `primaryCategoryId` as a denormalized cache for breadcrumbs/sort) | `prisma/trips.prisma` |
| 3.5 | `CreateTripDto`/`UpdateTripDto`: accept `categoryIds: string[]` (≥1) + `primaryCategoryId` + `hubIds: string[]` (0–n) instead of single ids | `trips/dto/trip.dto.ts` |
| 3.6 | `TripsService.create`: validate all categories active; validate each hub belongs to destination AND **any** of the tour's categories is in that hub's `HubAllowedCategory`; create join rows in the transaction | `trips/trips.service.ts` |
| 3.7 | `TripsService.findAll`: filter category/hub via join tables (`some:`); add multi-category facet | `trips/trips.service.ts` |
| 3.8 | `CategoryService.remove` trip-count guard: count via `TourCategory` join, not `categoryId` FK | `categories/categories.service.ts` |
| 3.9 | Breadcrumb + canonical use `isPrimary` category | trips read paths + frontend |

## Group 4 — Tour always-flat URL 🔴

| # | Change | File(s) |
|---|---|---|
| 4.1 | `TripsService.create`: **always** write a `TOUR` slug_registry row (remove the `if (!dto.hubId)` skip) | `trips/trips.service.ts` |
| 4.2 | `resolveUniqueSlug`: always consult slug_registry (drop the `isHubAnchored` branch) | `trips/trips.service.ts` |
| 4.3 | `findBySlug`: remove `hubSlug` handling + the two-segment path; resolve every tour at `/{dest}/{tour-slug}/` | `trips/trips.service.ts` |
| 4.4 | `archive`/`restore`/`remove`: always update/delete the `TOUR` slug_registry row (remove `if (!trip.hubId)` guards) | `trips/trips.service.ts` |
| 4.5 `[mig]` | Backfill: write `TOUR` slug_registry rows for existing hub-anchored trips; resolve any slug collisions with the operator-suffix rule | data migration |
| 4.6 | Remove/deprecate the frontend hub-nested route `[dest]/[hub]/[tour]`; 301 old → flat (if redirects adopted, Group 8) | frontend |
| 4.7 | Update `CLAUDE.md` Rule #8 + `TRIP-MODULE.md` §3/§4.12/§4.13/§6.7 | docs |

## Group 5 — Category page gating 🟡

| # | Change | File(s) |
|---|---|---|
| 5.1 | Add `getPublishedTourCount(categoryId, destinationId)` (count LIVE+active tours via `TourCategory`) | `categories/categories.service.ts` |
| 5.2 | Public category detail / `GET /destinations/:dest/categories`: return only categories with count > 0; expose `publishedTourCount` | category + destination services/controllers |
| 5.3 | Slug resolver/category page: 404 when published count = 0 (slug stays reserved/active) | slug resolution + frontend category page |

## Group 6 — Attributes / Filters (new module) 🔴 `[mig]`

| # | Change | File(s) |
|---|---|---|
| 6.1 `[mig]` | `attribute_definitions` model (key, displayName, dataType enum, allowedValues JSON, appliesToCategories String[], isFilterable, isSortable, filterDisplayType enum, sortOrder) | `prisma/attributes.prisma` (new) |
| 6.2 `[mig]` | `tour_attributes` model (`tripId, attributeKey, attributeValue`), `@@unique([tripId, attributeKey])`, index `(attributeKey, attributeValue)` | `prisma/attributes.prisma` |
| 6.3 | New `attributes/` module: dictionary CRUD (admin) + seed global + category-specific from V2 §7 | `src/attributes/**` |
| 6.4 | Per-tour attribute assignment endpoints with **dictionary validation** (reject unknown key/value) | `src/attributes/**` or trips-children |
| 6.5 | `GET /filters/:dest/:category` — available filters + value counts | `src/attributes/**` |
| 6.6 | `TripsService.findAll`: parse attribute query params (incl. comma-separated multi-values, ranges) and filter via `tour_attributes` | `trips/trips.service.ts` |
| 6.7 | Sorting incl. **Recommended** weighted score (`bookings×0.4 + rating×0.3 + recency×0.2 + review_count×0.1`) | `trips/trips.service.ts` |
| 6.8 | Missing-data handling (exclude-on-missing filter, price-on-request, "New" badge sort) | `trips/trips.service.ts` |
| 6.9 | Author `06-discovery/ATTRIBUTES-AND-FILTERS.md` | docs |

## Group 7 — Collections (new module) 🟡 `[mig]`

| # | Change | File(s) |
|---|---|---|
| 7.1 `[mig]` | `Collection` model (name, slug, destinationId, collectionType enum `MANUAL\|DYNAMIC`, tourIds String[], filterQuery JSON, description, heroImage, sortOrder, isActive) + `CollectionTranslation` + `CollectionPageContent` + FAQ(`pageType=collection`) | `prisma/collections.prisma` (new) |
| 7.2 | New `collections/` module: admin CRUD; write `COLLECTION` slug_registry row on create (same transaction) | `src/collections/**` |
| 7.3 | Dynamic resolver: evaluate `filterQuery` against tours + attributes at read | `src/collections/**` |
| 7.4 | Cannibalization guard: reject collection slug equal to a category slug | `src/collections/**` |
| 7.5 | Wire `COLLECTION` case in the frontend slug resolver to a real CollectionPage | frontend |
| 7.6 | Author `06-discovery/COLLECTIONS.md` | docs |

## Group 8 — Search + SEO + i18n confirmations 🟡

| # | Change | File(s) |
|---|---|---|
| 8.1 | Search (**V1 shipped**): `GET /search` — ILIKE `contains` over tour name+translations+category+hub names+highlights, destination-scoped, paginated, Recommended sort. `tsvector`/GIN, autocomplete, and faceted `/search` are **target, not built** (facets/sort live on `GET /trips`). | `src/search/**` (new) |
| 8.2 | JSON-LD emitters per page type; breadcrumbs (tour uses primary category) — **NOT built** (frontend; data ready) | frontend |
| 8.3 | XML sitemap index + per-type/per-locale files (published-only, non-empty categories) — **NOT built** (frontend; data ready) | frontend route handlers |
| 8.4 | CRO fields `[mig]`: `bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt` on `Trip` — **columns + response exposure shipped, but unpopulated** (no bookings module yet → always 0/null; Recommended sort key inert) | `prisma/trips.prisma` + read paths |
| 8.5 | Confirm no-prefix → 302 locale fallback; per-locale Open Graph; add translate-priority list to multilingual doc | `frontend/middleware.ts`, docs |

## Group 9 — Slug redirects (decision-gated) 🟡

| # | Change | File(s) |
|---|---|---|
| 9.1 | **Decision:** keep immutable slugs (recommended) **or** adopt editable slugs + `slug_redirects` 301 table + 90-day cooldown | — |
| 9.2 `[mig]` | If adopting: `slug_redirects` model; 301 step in `SlugRegistryService.resolve`; editable-slug admin flow | `prisma/`, `slug-registry/` |

---

## Decisions — LOCKED (2026-06-07)
1. Multi-category & multi-hub tours (Group 3) — ✅ **ADOPT**.
2. Flat tour URLs (Group 4) — ✅ **YES**, drop hub-nested.
3. Collections (Group 7) — ✅ **BUILD NOW**.
4. Slug redirects (Group 9) — ✅ **KEEP IMMUTABLE**. Group 9 becomes doc-only: record the divergence in `PLATFORM-ARCHITECTURE-V2.md §9` + `SOFT-DELETE-STRATEGY.md`; no `slug_redirects` table, no editable-slug UI. (9.2 is dropped.)

All groups are unblocked.
