# V2 Development Alignment Plan

> **Goal:** bring the codebase (schema, backend, frontend) in line with `02-architecture/PLATFORM-ARCHITECTURE-V2.md`.
> **Companion docs:** target spec = `PLATFORM-ARCHITECTURE-V2.md` · rationale/deltas = `ARCHITECTURE-V2-GAP-ANALYSIS.md`.
> **Constraint:** the **featured-slot economy is retained as-is** (V2 omits it; it coexists). Do not remove slot/waitlist/booking machinery.
>
> Status legend: ⬜ not started · ⚠️ partial · ✅ done. Update inline as work lands, and mirror into `MASTER-CHECKLIST.md`.

---

## How to read this plan
Work is grouped into **workstreams** (A–H), ordered by dependency. Each item lists: the change, the files/models touched, and the acceptance check. Items marked **[migration]** require a Prisma migration; **[breaking]** changes an existing built pattern.

A quick map of "current → target":

| Area | Current | Target (V2) | Workstream |
|---|---|---|---|
| Tour ↔ Category | single `categoryId` | many-to-many (+ `isPrimary`) | B |
| Tour ↔ Hub | single `hubId?` | many-to-many | B |
| Tour URL | flat **+** hub-nested | always flat | B |
| Category page | always renders | gated on ≥1 published tour | C |
| Destination fields | ~6 | +region, geo, country, currency, … | A |
| Category fields | name/slug | +icon, sort_order, parent, templates | A |
| Hub fields | name/slug/desc | +hub_type, lat/lng | A |
| Attributes/Filters | none | full dictionary + facets + sort | D |
| Collections | enum stub only | full module | E |
| Search | none | tsvector → (Algolia later) | F |
| Structured data / sitemaps / breadcrumbs | none | full SEO layer | G |
| Slug redirects | immutable slugs | decision: keep vs 301 table | H |

---

## Workstream A — Additive data-model fields (low risk, do first)
No behavior changes; pure schema additions that unblock later work.

- ⬜ **[migration]** Add `region` enum + `Destination.region` (required). Values: `CARIBBEAN, ATLANTIC, MEDITERRANEAN, ASIA, AFRICA`. Backfill the 5 launch destinations = `CARIBBEAN`. — `enums.prisma`, `destinations.prisma`, `seed.ts`
- ⬜ **[migration]** Add remaining V2 destination fields: `country`, `latitude`, `longitude`, `timezone`, `currency`, `language`, `galleryImages String[]`, `parentDestinationId String?` (self-relation, nullable, unused at launch). Note: translated `description`/meta already covered by `DestinationTranslation`/`DestinationPageContent`; add base `og_image` handling to page content. — `destinations.prisma`
- ⬜ **[migration]** Add category fields: `icon String?`, `sortOrder Int`, `parentCategoryId String?` (self-relation), `metaTitleTemplate String?`, `metaDescriptionTemplate String?`. — `categories.prisma`
- ⬜ **[migration]** Add hub fields: `hubType` enum (`LOCATION, HIGHLIGHT, AREA`), `latitude Float?`, `longitude Float?`. — `enums.prisma`, `destinations.prisma`
- ⬜ Verify `seed.ts` enumerates **exactly the 19 canonical categories + slugs** from `PLATFORM-ARCHITECTURE-V2.md §3`, and the 5 launch destinations from §2. Fix any drift.
- ⬜ Expose new fields in DTOs/Swagger + admin forms (destination/category/hub create+edit). Follow existing module patterns in `CLAUDE.md`.
- **Acceptance:** `pnpm prisma:validate` passes; admin can set region/geo/icon/sort_order/hub_type; seed produces 19 categories + 5 destinations.

---

## Workstream B — Tour cardinality & URL (breaking, schema-heavy)
The structural core of V2. Do A first. Decision required before starting (see §Decisions).

- ⬜ **[migration][breaking]** Introduce `TourCategory` join: `(tourId, categoryId, isPrimary Boolean)`, `@@unique([tourId, categoryId])`, exactly one `isPrimary=true` per tour. Migrate existing `Trip.categoryId` → one `TourCategory` row with `isPrimary=true`. Keep `categoryId` temporarily as a generated/primary mirror or drop after backfill. — `trips.prisma`
- ⬜ **[migration][breaking]** Introduce `TourHub` join: `(tourId, hubId)`, `@@unique`. Migrate existing `Trip.hubId` → a `TourHub` row where set. — `trips.prisma`
- ⬜ **[breaking]** Tour URL: make **every** tour flat `/{destination}/{tour-slug}/`. On create, **always** write a slug_registry `TOUR` row (remove the "hub-anchored tours skip slug_registry" branch). Remove the two-segment `/{dest}/{hub}/{tour}/` route + resolver. — `trips.service.ts`, slug resolver, frontend `[locale]/[destination]/[slug]/page.tsx`
- ⬜ Update `HubAllowedCategory` checks: a tour may be in a hub if **any** of its categories is allowed (was: its single category).
- ⬜ Update public `GET /trips`: filter by category/hub via the join tables; tour appears under every assigned category/hub.
- ⬜ Breadcrumb + canonical use the `isPrimary` category.
- ⬜ Update docs that assert single-category / hub-nested URLs: `CLAUDE.md` Rule #8, `TRIP-MODULE.md §3, §4.12, §4.13, §6.7`.
- **Acceptance:** a tour tagged `boat-tours`+`sunset-cruises`+hub `klein-curacao` shows on all three listing pages and resolves at one flat URL; breadcrumb uses the primary category.

---

## Workstream C — Category page gating (low risk)
- ⬜ Public category page returns **404 when published-tour count = 0** (slug stays reserved/active in registry). — category page render + `GET /destinations/:dest/categories` returns non-zero only
- ⬜ `categories` API: include `publishedTourCount`; omit zero-count categories from nav/listings.
- ⬜ Reflect in sitemap (G) and internal-linking (only link categories with tours).
- **Acceptance:** a destination with no scuba tours does not list/serve `/curacao/scuba-diving/` (404), but the slug remains protected.

---

## Workstream D — Attributes / Filters system (new module, largest build)
Author `technical-doc/06-discovery/ATTRIBUTES-AND-FILTERS.md` alongside the build (use `PLATFORM-ARCHITECTURE-V2.md §7` as the spec).

- ⬜ **[migration]** `attribute_definitions` table (key, display_name, data_type enum, allowed_values JSON, applies_to_categories String[], is_filterable, is_sortable, filter_display_type enum, sort_order). Seed global + category-specific definitions from §7.
- ⬜ **[migration]** `tour_attributes` table (`tourId, attribute_key, attribute_value`), `@@unique([tourId, attribute_key])`, index `(attribute_key, attribute_value)`.
- ⬜ Backend `attributes` module: dictionary CRUD (admin), per-tour attribute assignment with **dictionary validation on save** (reject unknown key/value).
- ⬜ `GET /filters/:dest/:category` — available filters + value counts (locale-independent).
- ⬜ Tour listing filter query params (`booking_type`, `boat_type=catamaran,yacht`, `duration_min/max`, `price_min/max`, `rating_min`, `free_cancellation`, …) + comma-separated multi-values.
- ⬜ Sorting incl. **Recommended** weighted score (`bookings×0.4 + rating×0.3 + recency×0.2 + review_count×0.1`).
- ⬜ Filter-per-page-type rules (§7) + missing-data handling (price-on-request, "New" badge, exclude-on-missing).
- ⬜ Frontend filter panel: sidebar/bottom-sheet, render types, URL-driven state, grayed zero-results, active count, clear-all, canonical→base.
- ⬜ **Phasing:** ship the **Filter Priority top-6** first (price, duration, booking_type, free_cancellation, rating, one category type filter), then full dictionary.
- **Acceptance:** category page shows global + category-specific filters; filtering updates the listing via URL params with a canonical to the base page; Recommended sort is default.

---

## Workstream E — Collections module (new module)
Finish the dangling `SlugEntityType.COLLECTION` stub into a real feature (or formally defer — see Decisions). Author `technical-doc/06-discovery/COLLECTIONS.md` from `PLATFORM-ARCHITECTURE-V2.md §6`.

- ⬜ **[migration]** `Collection` model (name, slug, destinationId, collection_type enum `MANUAL|DYNAMIC`, tourIds String[] (manual), filterQuery JSON (dynamic), description, heroImage, sortOrder, status) + `CollectionTranslation`/`CollectionPageContent` per the multilingual pattern + `Faq (pageType='collection')`.
- ⬜ Slug_registry `COLLECTION` row written on create (same transaction).
- ⬜ Dynamic resolver: evaluate `filter_query` against tours+attributes at render.
- ⬜ Naming guard: warn/block collection slugs that collide with category slugs (cannibalization rules §6).
- ⬜ Admin CRUD + frontend collection page (`CollectionPage` already referenced in the slug resolver switch).
- **Acceptance:** a manual `top-10-tours` and a dynamic `private-boat-tours` both resolve and render correct tour sets at `/curacao/{slug}/`.

---

## Workstream F — Search (new module)
Author `technical-doc/06-discovery/SEARCH.md` from `PLATFORM-ARCHITECTURE-V2.md §10`.

- ⬜ Start with **PostgreSQL `tsvector`** full-text over tour title + description + highlights + category names + hub names.
- ⬜ `GET /search?q=&destination=&locale=` (SSR, not cached); same filters/sort as category pages.
- ⬜ Autocomplete endpoint (destination + category suggestions).
- ⬜ Frontend `/search` page with filters; URL `/search?q=catamaran&destination=curacao`.
- ⬜ Document the Algolia/ElasticSearch upgrade path for scale.
- **Acceptance:** searching "catamaran" returns matching tours, scoped or global, filterable.

---

## Workstream G — SEO layer (structured data, sitemaps, breadcrumbs, internal links, CRO)
Author `technical-doc/06-discovery/SEO-STRUCTURED-DATA.md` from `PLATFORM-ARCHITECTURE-V2.md §10`.

- ⬜ **JSON-LD** emitters per page type (Tour=`TouristTrip`+`AggregateOffer`+`AggregateRating`+`BreadcrumbList`; Category/Collection=`CollectionPage`+`ItemList`; Destination=`Place`+`ItemList`; Hub adds `Article`+`FAQPage`). All + `BreadcrumbList`.
- ⬜ **Breadcrumbs** on every page per §10 table; tour uses primary category (depends on B); render UI + JSON-LD.
- ⬜ **Sitemaps**: `/sitemap.xml` index + per-type/per-locale files; published-only; category sitemaps exclude zero-tour categories (depends on C); `lastmod` on change; submit to GSC.
- ⬜ **Internal linking** matrix (destination→categories/hubs/collections, category→related categories, tour→related tours/hub, hub→related hubs).
- ⬜ **CRO fields** **[migration]**: add/derive `bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt` on `Trip` (some derivable at query time from bookings/schedules); render social-proof/urgency/recency/trust badges/price anchor on tour card + detail.
- ⬜ Confirm **ISR revalidation** values match §10 (homepage/dest/cat 60s, hub 300s, collection 60s, tour 30s, search SSR); reconcile with `MULTILINGUAL-CONTENT.md §10.3`.
- **Acceptance:** Rich Results Test passes for each page type; sitemap index lists per-locale files; tour cards show CRO signals.

---

## Workstream H — Slug redirects (decision-gated)
- ⬜ **Decision:** keep **immutable slugs** (current, simpler, safest for bookings) **or** adopt V2's editable slugs + `slug_redirects` 301 table + 90-day cooldown.
- ⬜ If adopting: **[migration]** `slug_redirects` table (§9), 301 handling in the slug resolver (step 5), editable slug in admin with redirect-on-change, soft-delete 90-day cooldown.
- ⬜ If keeping immutable: document the deliberate divergence in `PLATFORM-ARCHITECTURE-V2.md §9` (already noted) and `SOFT-DELETE-STRATEGY.md`.
- **Acceptance:** either redirects work end-to-end, or the divergence is documented and the editable-slug UI is explicitly out of scope.

---

## i18n confirmations (small)
- ⬜ Confirm/implement **no-prefix → 302** locale fallback (`Accept-Language`) alongside `localePrefix: 'always'`. — `middleware.ts`
- ⬜ Add the **What-Gets-Translated priority list** (§11) to `MULTILINGUAL-CONTENT.md`.
- ⬜ Ensure per-locale Open Graph (`og:locale`, translated `og:title`/`og:description`) is emitted.

---

## Decisions required before B/E/H start
1. **Multi-category & multi-hub tours (B):** adopt V2 many-to-many (recommended for V2 fidelity) — yes/no?
2. **Flat tour URLs (B):** drop hub-nested tour URLs — yes/no? (recommended yes)
3. **Collections (E):** build now or defer? (enum stub already exists)
4. **Slug redirects (H):** keep immutable or add 301 table?

> A/C/D/F/G can proceed regardless of these decisions. B/E/H are gated.

---

## Suggested sequencing
1. **A** (additive fields) — unblocks everything, zero risk.
2. **C** (category gating) + **G** SEO basics (breadcrumbs, JSON-LD, sitemaps) — high SEO value, low risk.
3. **B** (cardinality + flat URLs) once decisions 1–2 land — do all of B in one migration window.
4. **D** (attributes/filters) — biggest build; ship top-6 filters first.
5. **E** (collections) and **F** (search).
6. **H** (slug redirects) per decision 4.
7. Sweep docs + `MASTER-CHECKLIST.md` with each workstream as it completes.
