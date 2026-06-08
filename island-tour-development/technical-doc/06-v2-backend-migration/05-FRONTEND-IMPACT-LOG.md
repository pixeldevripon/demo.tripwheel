# 05 — Frontend Impact Log (Backend → UI Change Tracker)

> **Purpose:** a single, always-current place that records — for every backend migration stage — exactly **what changed on the backend** and **what the frontend must do as a result** (admin dashboard + public site). When we switch to frontend work, this is the only doc you need to read to catch up.
>
> **Update protocol (MANDATORY):** after finishing each backend Stage in `03-BACKEND-MIGRATION-STEPS.md`, append/refresh that stage's section here **in the same work session** — new/changed endpoints, DTO field changes, required-field changes, behavior changes, and the concrete frontend tasks they create. Never leave this log behind the backend.
>
> **Frontend conventions** (from `frontend/DASHBOARD-PATTERNS.md` + root `CLAUDE.md`):
> - Types: `types/<module>.ts` · API client: `lib/api/<module>.ts` · Query hooks: `hooks/<module>/use-<module>.ts`
> - Admin UI: `components/dashboard/<module>/<module>-form.tsx` (+ list/table/row-actions) · pages: `app/(dashboard)/dashboard/<module>/…`
> - Public site: `app/(frontend)/[locale]/[destination]/…` · public API base `${NEXT_PUBLIC_BACKEND_URL}/api/v1`
> - Forms: React Hook Form + Zod · data: TanStack Query · RBAC via `useRole().can()`
>
> **Status legend:** 🔵 backend done, frontend TODO · 🟢 frontend done · ⚪ upcoming (backend not yet built)

---

## Quick index

| Stage | Backend status | Frontend status | Headline frontend work |
|---|---|---|---|
| 1 — Additive fields | ✅ done | 🔵 TODO | New fields in destination/category/hub admin forms + types; `region` & `hubType` now **required** on create |
| 2 — Seed / taxonomy | ✅ done | 🔵 TODO | 19 canonical category slugs (renamed), Bahamas added, region grouping available |
| 3 — Category gating | ✅ done | 🔵 TODO | Public category page must use destination-scoped endpoint + 404 on empty; nav uses non-empty list |
| 4 — Multi-cat / multi-hub | ✅ done | 🔵 TODO | Tour form: multi-select categories (+primary) & hubs; cards/breadcrumb use primary |
| 5 — Flat tour URLs | ✅ done (with 4) | 🔵 TODO | Remove hub-nested route; all tour links → `/{dest}/{tour-slug}/`; drop `hubSlug` param |
| 6a — Attributes (dictionary + assignment) | ✅ done | 🔵 TODO | Admin: dictionary mgmt screens + per-tour attribute editor (dictionary-driven) |
| 6b — Filters / sort (listing) | ✅ done | 🔵 TODO | Public: filter sidebar/bottom-sheet + sort dropdown consuming `/filters` + `/trips` params |
| 7 — Collections | ✅ done | 🔵 TODO | Admin CRUD (manual/dynamic) + public collection page at `/{dest}/{slug}/` |
| 8 — Search / SEO / CRO | ✅ backend (search + CRO fields) | 🔵 TODO | Search page; JSON-LD / sitemaps / breadcrumbs / internal-linking = frontend rendering (data ready); CRO badges |

---

## Public-site routing contract (cross-cutting — read first) 🔵

How the public site decides **which page type to render** for a URL. This is the canonical frontend routing reference (no separate routing doc exists; `MULTILINGUAL-CONTENT.md §4.8` shows a partial, older version).

**URL shapes (after the `/{locale}/` prefix handled by next-intl middleware):**
```
/{locale}/{destination}/            → Destination page         (2 segments)
/{locale}/{destination}/{slug}/     → category | hub | collection | tour | "tours"  (3 segments)
```

**Rule 1 — depth disambiguates the destination page.** Two segments = destination; no lookup needed.
```
app/(frontend)/[locale]/[destination]/page.tsx          → DestinationPage
   data ← GET /api/v1/destinations/slug/{destination}?locale=   (404 if missing/inactive)
```

**Rule 2 — the 3rd segment is resolved by ONE slug-registry call**, then switch on `entityType`:
```
app/(frontend)/[locale]/[destination]/[slug]/page.tsx   ← NOT YET BUILT (only [destination]/page.tsx + /tours exist today)

const entity = await resolveSlug(destination, slug);   // 404 → notFound()
switch (entity.entityType) {
  case 'CATEGORY':   → CategoryPage   → GET /categories/destination/{destination}/{slug}?locale=  (Stage 3: 404 when 0 published tours)
  case 'HUB':        → HubPage        → GET /hubs/{destination}/{slug}?locale=
  case 'TOUR':       → TourPage       → GET /trips/slug/{slug}?destinationSlug={destination}&locale=   (flat URL — NO hubSlug, Stage 5)
  case 'COLLECTION': → CollectionPage (Stage 7)
  case 'RESERVED':   → AllToursPage   (the seeded 'tours' slug)
  default:           → notFound()
}
```

**The resolve endpoint (exact):**
```
GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}
→ 200 { destinationSlug, slug, entityType, entityId }     entityType ∈ TOUR|CATEGORY|HUB|COLLECTION|RESERVED
→ 404 when the slug is unknown OR inactive (soft-deleted entity)
```

**Key properties for the frontend:**
- **Locale-independent:** slugs are English at every locale; the resolver ignores locale. Same `(destination, slug)` → same entity for `/en/…` and `/nl/…`. Cache it (changes rarely) — a `slug-lookup` cache is the intended optimization.
- **Two 404 layers for categories:** resolver 404 (slug unknown/inactive) **and** Stage 3 gating 404 (active category but 0 published tours in this destination). Both → `notFound()`.
- **Tours are always flat:** every tour has a `TOUR` registry row at `/{dest}/{tour-slug}/`; there is no hub-nested tour route and no `hubSlug` param (Stage 4/5).
- **`/{destination}/tours/`** resolves to `RESERVED` → render the "all tours in destination" listing (a `/tours` route folder already exists).

**Frontend tasks (to build the public site):**
- Add `app/(frontend)/[locale]/[destination]/[slug]/page.tsx` implementing the resolve→switch above.
- `lib/api/slug-registry.ts`: `resolveSlug(destinationSlug, slug)` → typed `{ entityType, entityId }`; map non-200 to `notFound()`.
- Build the four page components (CategoryPage, HubPage, TourPage, CollectionPage) + AllToursPage; each calls its matching detail endpoint listed above.

---

## Stage 1 — Additive data-model fields 🔵

**Backend change.** New columns on Destination, Category, Hub, exposed in Create/Update/Response DTOs + Swagger. Two fields became **required on create**: `Destination.region`, `Hub.hubType`.

### Destinations
- **New fields:** `region` (enum, **required**), `country`, `latitude`, `longitude`, `timezone`, `currency`, `language`, `galleryImages` (string[]), `ogImage`, `parentDestinationId`.
- **Enum `Region`** values: `CARIBBEAN | ATLANTIC | MEDITERRANEAN | ASIA | AFRICA`.
- **API:** `POST /destinations` body now **requires `region`**; `PATCH /destinations/:id` accepts all new fields; responses include them.
- **Frontend tasks:**
  - `types/destination.ts`: add fields to `Destination`, `CreateDestinationPayload` (region required), `UpdateDestinationPayload`.
  - `components/dashboard/destinations/destination-form.tsx`: add a **required Region `<Select>`**, plus inputs for country, lat/lng (number), timezone, currency, language, gallery (multi-image), ogImage, parentDestination (optional select of destinations). Zod: `region: z.nativeEnum(Region)`.
  - Detail/list views may surface region/country.

### Categories
- **New fields:** `description`, `icon`, `sortOrder` (int, default 0), `metaTitleTemplate`, `metaDescriptionTemplate`, `parentCategoryId`. All optional.
- **API:** `POST/PATCH /categories` accept them; responses include them.
- **Frontend tasks:**
  - `types/category.ts`: add fields to interfaces + payloads.
  - `components/dashboard/categories/category-form.tsx`: add description (textarea), icon (text/icon-picker), sortOrder (number), metaTitleTemplate / metaDescriptionTemplate (text, show `{category}`/`{destination}` token hint), parentCategory (optional select).
  - List ordering should respect `sortOrder`.

### Hubs
- **New fields:** `hubType` (enum, **required**), `latitude`, `longitude`.
- **Enum `HubType`** values: `LOCATION | HIGHLIGHT | AREA`.
- **API:** `POST /hubs` body now **requires `hubType`**; `PATCH /hubs/:id` accepts hubType/lat/lng.
- **Frontend tasks:**
  - `types/hub.ts`: add fields; `CreateHubPayload.hubType` required.
  - `components/dashboard/hubs/hub-form.tsx`: add **required HubType `<Select>`** + lat/lng inputs.

> ⚠️ **Breaking for existing admin forms:** until the Region/HubType selects are added, destination/hub **create** calls will 400 (missing required field). Prioritize these two.

---

## Stage 2 — Seed / taxonomy correction 🔵

**Backend change.** The category taxonomy is now the **canonical 19** with V2 slugs; the old 7 seeds were renamed/removed. Bahamas added (5 destinations). All destinations have `region=CARIBBEAN`. Klein Curaçao `allowedCategories` = boat-tours/snorkeling/day-trips.

- **Slug renames that break hardcoded references:** `buggy-tours`→`off-road-tours`, `snorkeling-trips`→`snorkeling`. Removed as categories: `private-charters`, `catamaran-trip`, `dolphin-encounters`.
- **Canonical 19 slugs:** boat-tours, snorkeling, scuba-diving, sunset-cruises, sightseeing-tours, day-trips, off-road-tours, jet-ski, parasailing, water-sports, fishing-trips, nature-wildlife-tours, hiking-tours, adventure-tours, cultural-tours, food-tours, attraction-tickets, luxury-experiences, workshops-classes.
- **Frontend tasks:**
  - Find & fix any **hardcoded category slugs/names** (nav links, icon maps, filters, fixtures). Search the frontend for `buggy-tours`, `snorkeling-trips`, `catamaran`, `dolphin`, `private-charters`.
  - Build/extend a **category-icon map** keyed by the 19 slugs (pairs with the new `icon` field from Stage 1).
  - Homepage: a **"browse by region"** grouping is now possible (region data exists on destinations) — wire when building homepage nav.
  - Add **Bahamas** wherever destinations are listed/linked (it's data-driven, so usually automatic).

---

## Stage 3 — Category page tour-gating 🔵

**Backend change.** Category pages are now **destination-scoped and tour-gated**. Two new public endpoints:

- **`GET /api/v1/categories/destination/:destinationSlug`** → array of categories that have **≥1 published tour** in that destination, each with `publishedTourCount`, ordered by `sortOrder`. (Zero-count categories are omitted.)
- **`GET /api/v1/categories/destination/:destinationSlug/:categorySlug`** → category detail **+ `publishedTourCount`**, or **HTTP 404** when there are no published tours (or the destination/category is inactive).

Both accept `?locale=`.

- **Frontend tasks:**
  - **Public category page** (`app/(frontend)/[locale]/[destination]/[slug]/` when the slug resolves to a CATEGORY): fetch via `GET /categories/destination/{destination}/{slug}`; on a 404 response call Next's `notFound()` so empty category pages never render (V2 rule). Render `publishedTourCount` (e.g. "7 tours").
  - **Destination page** category grid / nav: use `GET /categories/destination/{destination}` (non-empty only) instead of the global `GET /categories/active`. Do **not** link categories with 0 tours.
  - **Sitemap** (Stage 8) must also exclude zero-tour category URLs — note for later.
  - `lib/api/category.ts` + `hooks/category/…`: add `getCategoriesByDestination(destinationSlug, locale)` and `getCategoryByDestination(destinationSlug, categorySlug, locale)`; new query keys.
  - Types: add `publishedTourCount` to the destination-scoped category response type.

---

## Stage 4 — Multi-category / multi-hub tours 🔵 (DONE — implemented with Stage 5)

**Backend change.** `Trip.categoryId`/`hubId` removed; replaced by join tables `TourCategory(tripId, categoryId, isPrimary)` and `TourHub(tripId, hubId)`. Migration `20260606203433_tours_multi_category_hub`.

**API payload changes (breaking):**
- **Create `POST /trips`** body: `categoryId` → **`categoryIds: string[]`** (≥1); new optional **`primaryCategoryId`** (must be one of `categoryIds`, defaults to the first); `hubId` → **`hubIds?: string[]`** (0–n).
- **Update `PATCH /trips/:id`**: supply **`categoryIds`** to replace the whole set (+ optional `primaryCategoryId`); supply **`primaryCategoryId` alone** to re-point the primary among existing categories; supply **`hubIds`** to replace the hub set.
- **Responses** (list, detail, my-trips, admin) now expose **`categoryIds: string[]`, `primaryCategoryId: string|null`, `hubIds: string[]`** instead of `categoryId`/`hubId`. List/admin views also include **`categoryNames`, `primaryCategoryName`, `hubNames`** (and no longer `categoryName`/`hubName`).
- **Filtering** `GET /trips?categoryId=&hubId=` still takes single ids but now matches via the join (a tour appears under every assigned category/hub).
- **Validation:** each hub must belong to the tour's destination AND allow **at least one** of the tour's categories (was: the single category).

**Frontend tasks:**
- `types/trip.ts`: replace `categoryId`/`hubId` with `categoryIds`/`primaryCategoryId`/`hubIds` on Trip + payloads; add `categoryNames`/`primaryCategoryName`/`hubNames` to list types.
- **Tour create/edit form** (`components/dashboard/trips/trip-form.tsx`): category single-select → **multi-select with a "primary" radio/toggle**; hub single-select → **multi-select (0–n)**. Zod: `categoryIds` min 1, `primaryCategoryId` ∈ `categoryIds`.
- **Tour cards / breadcrumb / canonical** use `primaryCategoryId` / `primaryCategoryName`.
- `lib/api/trip.ts` + hooks: update create/update payloads and response types.

## Stage 5 — Flat tour URLs 🔵 (DONE — implemented with Stage 4)

**Backend change.** Every tour now has exactly one flat canonical URL `/{destination}/{tour-slug}/` and **always** writes a `TOUR` slug_registry row (the old hub-nested two-segment URL and the "hub-anchored skips slug_registry" rule are gone). `GET /trips/slug/:slug` **no longer accepts `hubSlug`** — resolve purely by `destinationSlug` + `slug`.

**Frontend tasks:**
- **Remove** the hub-nested tour route `app/(frontend)/[locale]/[destination]/[hub]/[tour]/` (if present); every tour resolves at `/{locale}/{destination}/{tour-slug}/`.
- Update **all tour links** to the flat URL; the slug resolver always treats a tour slug as `entityType=TOUR`.
- Drop the `hubSlug` query param from the tour-detail fetch.
- Hubs are now a **discovery tag only** (hub page lists its tours via the join) — no hub segment in any tour URL.

## Stage 6a — Attribute dictionary + per-tour assignment 🔵 (DONE — backend)

**Backend change.** New `attribute_definitions` dictionary + `tour_attributes` key-value table (migration `20260606210321_attributes_and_tour_attributes`), seeded with **46 V2 definitions** (18 global + category-specific). New `attributes` module.

**New endpoints:**
- **Dictionary (read public, write admin `MANAGE_SYSTEM`):**
  - `GET /api/v1/attributes?category={slug}&globalOnly=&filterableOnly=` → definitions (global + that category's), ordered by `sortOrder`. Each: `key, displayName, dataType (BOOLEAN|ENUM|ENUM_MULTI|INTEGER|DECIMAL|TEXT), allowedValues, appliesToCategories (slugs; []=global), isFilterable, isSortable, filterDisplayType (CHECKBOX|RANGE_SLIDER|RADIO|DROPDOWN), sortOrder`.
  - `GET /attributes/:key` · `POST /attributes` · `PATCH /attributes/:key` · `DELETE /attributes/:key` (soft-deactivate).
- **Per-tour values (operator-owner / admin):**
  - `GET /api/v1/trips/:tripId/attributes` → `[{ key, value, displayName, dataType }]`.
  - `POST /api/v1/trips/:tripId/attributes` body `{ attributes: [{ key, value }] }` — **upsert**; each key must exist in the dictionary; value validated against dataType + allowedValues. **ENUM_MULTI** takes a **comma-separated** string (`"turtles,coral"`) and is stored as a JSON array.
  - `DELETE /api/v1/trips/:tripId/attributes/:key`.

**Frontend tasks (admin, buildable now):**
- **Per-tour attribute editor** on the trip form: fetch `GET /attributes?category={tour's primary category}` to get the applicable global + category-specific fields, render each by `dataType`/`filterDisplayType` (checkbox / radio / dropdown / multi-checkbox / number), and `POST /trips/:id/attributes`. Show validation errors from the API.
- **Attribute dictionary admin screens** (list/create/edit/deactivate) for `MANAGE_SYSTEM` users — `key`, `displayName`, `dataType`, `allowedValues`, `appliesToCategories` (category-slug multi-select), `isFilterable`/`isSortable`/`filterDisplayType`/`sortOrder`.
- `types/attribute.ts` + `lib/api/attribute.ts` + hooks.

## Stage 6b — Filters / sort on listings 🔵 (DONE — backend)

**Backend change.** `GET /trips` now supports attribute filters, duration/rating filters, and sorting; new `GET /filters/:dest/:category` returns the filter sidebar data.

**Endpoints:**
- **`GET /api/v1/filters/{destinationSlug}/{categorySlug}`** → `{ destination, category, total, priceRange{min,max}|null, durationRange{min,max}|null, filters: [{ key, displayName, dataType, filterDisplayType, isSortable, sortOrder, values:[{value,count}] }] }`. `values` is populated for ENUM/ENUM_MULTI/BOOLEAN (present values + counts in the current published set); empty for numeric/text (use `priceRange`/`durationRange` for sliders). Use this to render the sidebar.
- **`GET /api/v1/trips?...`** filtering + sorting:
  - Typed params: `destinationId, categoryId, hubId, pricingModel, minPrice, maxPrice, durationMin, durationMax, ratingMin, search, sort, page, limit`.
  - `sort` ∈ `recommended` (default) | `price_asc` | `price_desc` | `rating` | `newest`.
  - **Dynamic attribute filters:** any **dictionary attribute key** as a query param, comma-separated for OR within a key, multiple keys AND-ed. Example: `?categoryId=…&boat_type=catamaran,yacht&booking_type=private&free_cancellation=true&durationMin=60&durationMax=480&ratingMin=4&sort=recommended`. Unknown keys are ignored. Response adds `sort` and each item has `categoryIds`/`primaryCategoryId`/`hubIds`.

**Frontend tasks:**
- **Filter panel** (sidebar desktop / bottom-sheet mobile): fetch `/filters/{dest}/{category}`, render each filter by `filterDisplayType` (CHECKBOX/RADIO/DROPDOWN/RANGE_SLIDER), show counts, gray zero-count, "Clear all", active count.
- **URL-param state:** mirror filters into the query string (comma multi-values) and pass straight through to `GET /trips`; keep a canonical pointing to the base category URL.
- **Sort dropdown:** the 5 `sort` options, default Recommended.
- Price/duration sliders use `priceRange`/`durationRange` bounds.
- ⚠️ **Note:** attribute query keys are **dynamic** (data-driven from the dictionary), so they're documented as a *pattern* in Swagger (description + examples), not as fixed fields — the authoritative list of keys for a category is `GET /filters` / `GET /attributes?category=`.

## Stage 7 — Collections 🔵 (DONE — backend)

**Backend change.** New `Collection` (+ translations + page content + FAQ) module (migration `20260606213217_collections`). A collection registers a `COLLECTION` slug in the slug registry, so the public resolver's `COLLECTION` branch now points at a real page.

**Endpoints:**
- **Public:**
  - `GET /api/v1/collections?destinationSlug={slug}&locale=` → active collections for a destination (localized).
  - `GET /api/v1/collections/slug/{slug}?destinationSlug={slug}&locale=` → collection detail **+ resolved `tours[]`** (MANUAL = ordered `tourIds`; DYNAMIC = `filterQuery` resolved via the tour-listing engine, reusing Stage 6 filters).
  - `GET /collections/:id/page-content?locale=` · `GET /collections/:id/faqs?locale=` (same shape as category/hub).
- **Admin (`CREATE_CONTENT`/`EDIT_CONTENT`/`DELETE_CONTENT`/`MANAGE_SYSTEM`):** `POST /collections`, `PATCH /collections/:id`, `DELETE /collections/:id` (soft), `DELETE /collections/:id/force`, translations (`GET`/`GET :locale`/`PATCH :locale`/`DELETE :locale`), `PATCH /collections/:id/page-content/:locale`, FAQ CRUD.

**`CreateCollectionDto`:** `destinationId, name, slug?, collectionType (MANUAL|DYNAMIC), tourIds?[], filterQuery? (object), heroImage?, sortOrder?`. MANUAL requires `tourIds`; DYNAMIC requires `filterQuery` (e.g. `{ categoryId, attributes: { booking_type: 'private', boat_type: ['catamaran','yacht'] }, minPrice, maxPrice, durationMin, durationMax, ratingMin }`). **Slug must not equal a category slug** (cannibalization guard → 409).

**Frontend tasks:**
- **Public:** wire the slug resolver's `COLLECTION` case → `CollectionPage` at `/{locale}/{dest}/{slug}/`, fetch `GET /collections/slug/{slug}?destinationSlug=`, render `tours[]` (already in tour-card shape) + page content + FAQ.
- **Admin:** Collection CRUD — type toggle (manual = tour multi-select with ordering; dynamic = filter-query builder reusing the attribute dictionary), slug field with **category-slug cannibalization warning**, translations/page-content/FAQ tabs (same pattern as category/hub), `sortOrder` select.
- `types/collection.ts` + `lib/api/collection.ts` + hooks.

## Stage 8 — Search / SEO / CRO 🔵 (backend: search + CRO fields DONE)

**Backend change.**
- **Search:** `GET /api/v1/search?q={term}&destinationSlug={slug}&page=&limit=` (public). Matches tour name/translations + category & hub names + highlight text; optional destination scope; Recommended ordering; returns `{ total, page, limit, query, data: [tour cards] }`. (V1 = case-insensitive `contains`; tsvector/Algolia is the documented upgrade.)
- **CRO fields on `Trip`** (migration `20260607025718_trip_cro_fields`): `bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt` — columns exist and are in **all** trip responses, and the **Recommended sort leads with `bookingCount`**. ⚠️ **But they are NOT populated yet** — the bookings module (`src/bookings/`, Phase 4) that would maintain them **does not exist**, so values are always `0 / 0 / null / null` and the sort key is inert. Build the CRO badges, but expect empty/zero values until bookings ship (hide a badge when its value is 0/null).

**Pricing (no schema change — model kept; V2's flat price_adult/child/infant NOT added):**
- Tour pricing = `pricingModel` (PER_PERSON | UNIT) + `unitType` + `basePrice` (flat) and/or `TourAgeBand[]` (ADULT/CHILD/INFANT, custom bands). `price_adult/child/infant` are represented by age bands.
- `priceFrom` (the "From $X" anchor) is now **auto-recomputed** on basePrice/age-band changes — frontend can trust it for display.
- **Publish now requires a price:** a tour needs `basePrice` OR ≥1 age band, else publish 400s. The trip form should enforce this before enabling publish.

**Frontend tasks:**
- **Search page** `/search?q=&destination=` consuming `GET /search`; optional autocomplete.
- **CRO badges** on tour card/detail from `bookingCountToday` ("Booked 12 times today"), `spotsRemaining` ("Only 3 left"), `lastBookedAt`, plus trust signals (free_cancellation/instant_confirmation attributes) and price anchor.
- **SEO (frontend rendering — all data already exposed):**
  - **JSON-LD** per page type — Tour=`TouristTrip`+`AggregateOffer`(price)+`AggregateRating`(aggregateRating/Count)+`BreadcrumbList`; Category/Collection=`CollectionPage`+`ItemList`(from tours); Destination=`Place`+`ItemList`; Hub adds `Article`+`FAQPage`(from `/faqs`).
  - **Breadcrumbs** everywhere; tour crumb uses **`primaryCategoryId`** (already in responses).
  - **Per-locale XML sitemaps**: published-only; exclude zero-tour categories (use `GET /categories/destination/:dest`); collections from `GET /collections?destinationSlug=`.
  - **Internal linking** + per-locale Open Graph (page-content `metaTitle`/`metaDescription` + `ogImage`).

---

### Maintenance note
Keep the **Quick index** statuses and per-stage sections in sync as backend stages complete and as frontend work is done (flip 🔵→🟢). If a backend change is later revised, update the matching stage section here so the frontend never works from stale assumptions.
