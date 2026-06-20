# 03 — Backend Migration Steps (Execute In Order)

> **What this is:** the step-by-step runbook to migrate the backend to V2 **smoothly and reversibly**. Steps are ordered by dependency and risk. Each step has: scope, exact commands/edits, a backfill where data exists, and a verification check. Follow top-to-bottom; do not skip the verification.
>
> **Golden rules**
> - One Prisma migration per logical step; never edit a migration after it's applied.
> - Every destructive/structural change is preceded by a **backfill** of existing data, then the old column is dropped in a **separate** later migration.
> - Keep the slot economy intact — none of these steps touch `featured-slots`, `waitlist`, `bookings`.
> - Run `pnpm prisma:validate` and the test suite after each stage. Commit per stage.
> - **After each stage, update `05-FRONTEND-IMPACT-LOG.md`** with the backend→UI deltas (new/changed endpoints, required fields, behavior) so the frontend can pick up every point later. This is mandatory, not optional.

Commands (from `backend/` or root):
```bash
pnpm prisma:format && pnpm prisma:validate
pnpm prisma:migrate           # dev: create + apply
pnpm prisma:generate
pnpm prisma:migrate:deploy     # prod
```

---

## STAGE 0 — Safety net
- [ ] Branch: `git checkout -b feat/v2-backend-alignment`.
- [ ] Backup the dev DB (and a prod dump for rehearsal): `pg_dump`.
- [ ] Confirm tests pass on a clean tree: `pnpm --filter backend test`.

---

## STAGE 1 — Additive schema fields (no behavior change) 🟢
*Implements Change List Group 1. Safe to ship alone.*

1. **Enums** — `prisma/enums.prisma`: add
   ```prisma
   enum Region { CARIBBEAN ATLANTIC MEDITERRANEAN ASIA AFRICA }
   enum HubType { LOCATION HIGHLIGHT AREA }
   ```
2. **Destination** — `prisma/destinations.prisma`: add `region Region?` *(nullable for now — made required in Stage 2 after backfill)*, `country String?`, `latitude Float?`, `longitude Float?`, `timezone String?`, `currency String?`, `language String?`, `galleryImages String[] @default([])`, `parentDestinationId String?` + self-relation, `ogImage String?`.
3. **Category** — `prisma/categories.prisma`: add `description String?`, `icon String?`, `sortOrder Int @default(0)`, `parentCategoryId String?` + self-relation, `metaTitleTemplate String?`, `metaDescriptionTemplate String?`.
4. **Hub** — `prisma/destinations.prisma`: add `hubType HubType?` *(nullable; backfilled Stage 2)*, `latitude Float?`, `longitude Float?`.
5. `pnpm prisma:migrate -n add_v2_fields` → `pnpm prisma:generate`.
6. Extend DTOs/Swagger/`*Select` consts to expose new fields (destinations, categories, hubs).
- **Verify:** `pnpm prisma:validate` passes; admin create/edit forms accept new fields; existing rows unaffected (new columns null/default).

---

## STAGE 2 — Seed correction + data backfill 🟡
*Implements Group 2. Fixes the wrong 7 categories → canonical 19, adds Bahamas, backfills region/hub_type.*

1. **`prisma/seed.ts` — `SEED_CATEGORIES`** → exactly the 19 (V2 §3): `boat-tours, snorkeling, scuba-diving, sunset-cruises, sightseeing-tours, day-trips, off-road-tours, jet-ski, parasailing, water-sports, fishing-trips, nature-wildlife-tours, hiking-tours, adventure-tours, cultural-tours, food-tours, attraction-tickets, luxury-experiences, workshops-classes`. Add `sortOrder` per list order.
2. **`SEED_DESTINATIONS`** → add `{ name: 'Bahamas', slug: 'bahamas' }`; set `region: 'CARIBBEAN'` on all 5.
3. **`SEED_HUBS`** → Klein Curaçao: `hubType: 'LOCATION'`, `allowedCategorySlugs: ['boat-tours','snorkeling','day-trips']`.
4. **One-off backfill script** `prisma/scripts/v2-backfill.ts` (idempotent) for **existing** databases:
   - Rename/re-map legacy category slugs: `buggy-tours→off-road-tours`, `snorkeling-trips→snorkeling` (update Category + all `slug_registry` rows with that slug).
   - Reclassify non-categories (`private-charters`, `catamaran-trip`, `dolphin-encounters`): if they have published trips, keep temporarily and flag for manual remap; else deactivate. **Do not hard-delete** (booking/slug safety).
   - Insert the 12+ missing categories (with 3 FeaturedSlots each + slug_registry rows per active destination — reuse `CategoryService.create` logic).
   - Insert Bahamas destination (reuse `DestinationService.create`).
   - Backfill `region='CARIBBEAN'` and hub `hubType` for existing rows.
5. Run: fresh DB → `pnpm prisma:migrate:reset` (re-seeds). Existing DB → run the backfill script, then verify counts.
6. **Make `region` required:** once backfilled, change `region Region?` → `region Region` and migrate (`-n region_required`).
- **Verify:** `category` table has 19 active canonical rows; each active destination has 19 CATEGORY + 1 RESERVED slug_registry rows; Bahamas exists; no orphaned legacy slugs resolve.

---

## STAGE 3 — Category page gating 🟡
*Implements Group 5. No schema change.*

1. `CategoryService`: add `getPublishedTourCount(categoryId, destinationId?)` counting `status=LIVE, isActive=true` trips (via `TourCategory` after Stage 4; until then via `categoryId`).
2. `GET /destinations/:dest/categories` (or category list): include `publishedTourCount`; exclude zero-count from public nav/listing responses.
3. Slug resolver / category page render: return 404 when published count = 0 (slug row stays `isActive:true`, still reserved).
- **Verify:** `/curacao/scuba-diving/` (no tours) → 404; slug still blocks reuse; a category with ≥1 LIVE tour renders.

---

## STAGE 4 — Tour cardinality: many-to-many 🔴
*Implements Group 3. Biggest change — do in one window, with backfill before dropping old columns.*

1. **Add join tables** (`prisma/trips.prisma`), keep `categoryId`/`hubId` for now:
   ```prisma
   model TourCategory { id String @id @default(uuid()) tripId String categoryId String isPrimary Boolean @default(false)
     trip Trip @relation(fields:[tripId],references:[id],onDelete:Cascade)
     category Category @relation(fields:[categoryId],references:[id])
     @@unique([tripId, categoryId]) @@index([categoryId]) @@map("tour_categories") }
   model TourHub { id String @id @default(uuid()) tripId String hubId String
     trip Trip @relation(fields:[tripId],references:[id],onDelete:Cascade)
     hub Hub @relation(fields:[hubId],references:[id])
     @@unique([tripId, hubId]) @@index([hubId]) @@map("tour_hubs") }
   ```
   `pnpm prisma:migrate -n add_tour_joins`.
2. **Backfill** (script or SQL): for each trip → `TourCategory(tripId, categoryId, isPrimary=true)`; if `hubId` not null → `TourHub(tripId, hubId)`.
3. **DTOs** (`trips/dto/trip.dto.ts`): `categoryIds: string[]` (`@ArrayMinSize(1)`), `primaryCategoryId: string`, `hubIds: string[]` (optional). Validate `primaryCategoryId ∈ categoryIds`.
4. **`TripsService.create`/`update`:** write join rows in the transaction; validate every category active; for each hub validate it belongs to the destination AND **at least one** of the tour's categories is in that hub's `HubAllowedCategory`.
5. **`TripsService.findAll`:** filter `category` → `{ categories: { some: { categoryId } } }`; `hub` → `{ hubs: { some: { hubId } } }`. Tour now lists under every assigned category/hub.
6. **`CategoryService.remove` guard:** count assigned trips via `TourCategory`.
7. **Breadcrumb/canonical:** read the `isPrimary` category. *(Optional: add denormalized `primaryCategoryId` cache column for cheap reads.)*
8. **Drop old columns** in a **separate** migration once code no longer reads them: remove `Trip.categoryId`, `Trip.hubId` (`-n drop_single_cat_hub`).
- **Verify:** create a tour with 2 categories + 1 hub → appears on both category pages and the hub page; breadcrumb uses primary; deleting/deactivating a category with assigned tours is correctly blocked.

---

## STAGE 5 — Tour always-flat URL 🔴
*Implements Group 4. Do after Stage 4 (hub is now a tag, not a URL segment).*

1. **`TripsService.create`:** remove the `if (!dto.hubId)` guard — **always** write the `TOUR` slug_registry row.
2. **`resolveUniqueSlug`:** drop the `isHubAnchored` param/branch — always check slug_registry for collisions.
3. **`findBySlug`:** delete `hubSlug` handling and the two-segment branch; resolve every tour at `/{dest}/{tour-slug}/`.
4. **`archive`/`restore`/`remove`:** drop the `if (!trip.hubId)` guards — always toggle/delete the `TOUR` slug_registry row.
5. **Backfill** (script): for every existing hub-anchored trip (had `hubId`, no registry row), create a `TOUR` slug_registry row; on collision apply the operator-suffix rule (`resolveUniqueSlug`); record old→new slug pairs for redirects (Stage 8/Group 9 if adopted).
6. **Frontend:** remove the `[locale]/[destination]/[hub]/[tour]` route; point all tour links to the flat URL; 301 the old path if redirects are adopted.
7. Update `CLAUDE.md` Rule #8 and `TRIP-MODULE.md` §3/§4.12/§4.13/§6.7.
- **Verify:** a previously hub-anchored tour now resolves at `/{dest}/{tour-slug}/` and has a TOUR slug_registry row; no tour is reachable via a hub-nested path; slug uniqueness holds per destination.

---

## STAGE 6 — Attributes / Filters (new module) 🔴
*Implements Group 6. Independent of Stages 4–5; can run in parallel after Stage 1.*

1. **Schema** `prisma/attributes.prisma`: `AttributeDefinition` + `TourAttribute` (per Change List 6.1–6.2) + enums (`AttributeDataType`, `FilterDisplayType`). Migrate.
2. **Seed** the dictionary: global + category-specific definitions from V2 §7 (extend `seed.ts` or a dedicated seeder).
3. **`attributes/` module:** dictionary CRUD (admin, `MANAGE_*`); per-tour assignment with **validation against the dictionary** (reject unknown key/value, wrong data_type).
4. **`GET /filters/:dest/:category`:** return filterable definitions + value counts for the current result set.
5. **`TripsService.findAll`:** parse attribute params (`booking_type`, `boat_type=catamaran,yacht`, `duration_min/max`, `price_min/max`, `rating_min`, `free_cancellation`, …); filter via `tour_attributes`; comma = OR within a key, AND across keys.
6. **Sorting:** implement the 5 sorts incl. **Recommended** weighted score; default = Recommended.
7. **Missing-data rules:** exclude-on-missing when a filter is active; price-on-request; "New" badge sorts last on rating.
8. Ship **Filter-Priority top-6 first** (price, duration, booking_type, free_cancellation, rating, one category type), then the full dictionary.
9. Author `06-discovery/ATTRIBUTES-AND-FILTERS.md`.
- **Verify:** category page returns global + category-specific filters with counts; filtering narrows the listing via URL params; Recommended sort is default and matches the formula.

---

## STAGE 7 — Collections (new module) 🟡
*Implements Group 7. **Decision LOCKED: build now.***

1. **Schema** `prisma/collections.prisma`: `Collection` + `CollectionTranslation` + `CollectionPageContent` (+ FAQ uses existing polymorphic `Faq` with `pageType='collection'`). Migrate.
2. **`collections/` module:** admin CRUD; on create write a `COLLECTION` slug_registry row in the same transaction; **cannibalization guard** (reject slug == any category slug).
3. **Dynamic resolver:** evaluate `filterQuery` against tours + `tour_attributes` at read (reuse the Stage 6 filter engine).
4. **Frontend:** wire the existing `COLLECTION` case in the slug resolver to a real CollectionPage.
5. Author `06-discovery/COLLECTIONS.md`.
- **Verify:** manual `top-10-tours` and dynamic `private-boat-tours` both resolve at `/{dest}/{slug}/` and render the correct tour set; a collection slug colliding with a category slug is rejected.

---

## STAGE 8 — Search, SEO, i18n confirmations 🟡
*Implements Group 8 (and Group 9 if redirects adopted).*

1. **Search** `search/` module (**shipped as V1 = ILIKE**): `GET /search?q=&destinationSlug=&locale=&page=&limit=` → case-insensitive `contains` over tour name+translations+category+hub names+highlight text, optional destination scope, Recommended sort, paginated. **Deferred to a later perf pass (target):** `tsvector` GIN index/ranking, autocomplete endpoint, and faceting on `/search` (faceted filters + sort already exist on `GET /trips`, not `/search`).
2. **SEO (frontend):** JSON-LD per page type (Tour/Category/Destination/Hub/Collection) + `BreadcrumbList` everywhere; breadcrumb tour-crumb = primary category.
3. **Sitemaps (frontend):** `/sitemap.xml` index + per-type/per-locale files; published-only; exclude zero-tour categories (Stage 3).
4. **CRO fields** `[mig]`: add/derive `bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt` on `Trip`; expose on card/detail.
5. **i18n confirmations:** wire no-prefix → 302 locale fallback in `middleware.ts`; per-locale Open Graph; add the translate-priority list to `MULTILINGUAL-CONTENT.md`.
6. **Slug redirects (Group 9): DECISION = KEEP IMMUTABLE.** No `slug_redirects` table, no editable-slug flow. Document the deliberate divergence in `PLATFORM-ARCHITECTURE-V2.md §9` + `SOFT-DELETE-STRATEGY.md`. (Keep the flat-URL backfill's old→new slug log for audit only.)
- **Verify:** Google Rich Results passes per page type; sitemap index lists per-locale files; search returns scoped/global results; (if adopted) old hub-nested tour URLs 301 to flat.

---

## Rollout & rollback

| Stage | Risk | Rollback |
|---|---|---|
| 1 Additive fields | none | drop columns (reverse migration) |
| 2 Seed/backfill | medium | restore DB dump; script is idempotent |
| 3 Gating | low | feature-flag the 404 behavior |
| 4 Cardinality | high | keep old `categoryId/hubId` until Stage 4.8; revert by reading old columns |
| 5 Flat URL | high | re-enable hub-nested route; keep redirect map |
| 6 Attributes | medium | additive tables; disable filter parsing |
| 7 Collections | low | additive module; hide route |
| 8 Search/SEO | low | additive |

**Suggested shipping order:** 1 → 2 → 3 → 6 → (decisions) → 4 → 5 → 7 → 8. Stages 1–3 and 6 deliver value with no breaking risk; 4–5 are the breaking core; 7–8 round out discovery/SEO.
