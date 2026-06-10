# Routing Structure & Resolution Strategy

> **Status:** Canonical. Consolidates the routing/URL/slug-resolution material previously split across
> `PLATFORM-ARCHITECTURE-V2.md` (§2–§12), `SLUG-REGISTRY.md` (§1–§9), `MULTILINGUAL-CONTENT.md` (§1.3–§6.12, §10.4),
> and `06-v2-backend-migration/05-FRONTEND-IMPACT-LOG.md` ("Public-site routing contract").
> **Scope:** This document defines **only** the public-site URL structure and how a URL is resolved to a page.
> It deliberately does *not* cover slug-write lifecycle in depth (see `SLUG-REGISTRY.md`) or content translation (see `MULTILINGUAL-CONTENT.md`).
> **Source of truth in code:** Next.js `app/(frontend)/[locale]/[destination]/…`, `backend/src/slug-registry/`.

---

## 1. The URL Model

Every public page is one of exactly **two URL shapes**, both locale-prefixed:

```text
/{locale}/{destination}/            → Destination page                      (2 segments)
/{locale}/{destination}/{slug}/     → Category | Hub | Collection | Tour | "tours"   (3 segments)
```

There is **no fourth segment.** Tours are flat — never nested under a category or hub. Any deeper path that is not an explicitly-defined route is a `404`.

| URL | Resolves to |
|---|---|
| `/en/curacao/` | **Destination** page |
| `/en/curacao/boat-tours/` | **Category** page |
| `/en/curacao/klein-curacao/` | **Activity Hub** page |
| `/en/curacao/top-10-tours/` | **Collection** page |
| `/en/curacao/sunset-catamaran-cruise/` | **Tour** detail page |
| `/en/curacao/tours/` | **Reserved** "all tours in destination" listing |

```text
Destination  /{locale}/{destination}/
├── Categories      /{locale}/{destination}/{category}/
├── Activity Hubs   /{locale}/{destination}/{activity-hub}/
├── Collections     /{locale}/{destination}/{collection}/
└── Tours           /{locale}/{destination}/{tour-slug}/      ← always flat, never nested
```

### Three invariants of the URL model

1. **One canonical URL per tour.** A tour is discovered via many pages (categories, hubs, collections) but every link points to the single flat URL `/{locale}/{destination}/{tour-slug}/`. Tours are **never** nested:
   - ✅ `/en/curacao/klein-curacao-catamaran-day-trip/`
   - ❌ `/en/curacao/boat-tours/klein-curacao-catamaran/`
2. **All third-segment entities share one namespace.** Category, hub, collection, tour, and the reserved `tours` slug all compete for the same `(destination, slug)` slot — uniqueness is enforced per destination by the slug registry (§4).
3. **Slugs are English at every locale.** The locale prefix selects the *translation*; it never changes the slug. `/en/curacao/boat-tours/` and `/nl/curacao/boat-tours/` are the same entity with different rendered content.

---

## 2. The Three Segments

### 2.1 `{locale}` — handled by middleware, never the registry

```typescript
// middleware.ts (next-intl)
createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',
})
```

| Property | Value |
|---|---|
| Supported locales | `en`, `nl`, `de`, `fr`, `es`, `pt`, `zh` (all active from launch) |
| Default locale | `en` |
| Prefix policy | `always` — every public URL carries a locale prefix |
| No-prefix request | `/curacao/boat-tours/` → **302** to the user's preferred language (via `Accept-Language`), defaulting to `/en/…` |
| Effect on resolution | **None.** The slug resolver ignores locale; `(destination, slug)` → same entity for every locale. Locale only selects which translation row is read. |

### 2.2 `{destination}` — resolved directly, no registry lookup

The destination slug **is** the route segment. Next.js routes `/{locale}/{destination}/` straight to the destination page; it is validated against `Destination.slug`, not the slug registry.

```
app/(frontend)/[locale]/[destination]/page.tsx
   data ← GET /api/v1/destinations/slug/{destination}?locale=   (404 if missing/inactive)
```

Launch destinations (all Caribbean): `curacao`, `aruba`, `sint-maarten`, `saint-lucia`, `bahamas`.

### 2.3 `{slug}` — polymorphic, resolved by the registry

The third segment is **ambiguous** — from the URL alone Next.js cannot tell a category from a hub from a tour. They all share one route file and one namespace. The **slug registry** is the lookup table that disambiguates it (§4).

---

## 3. Slug Normalization Rules

Every slug — destination, category, hub, collection, tour — is normalized through the same `generateSlug()` util before storage and is **immutable after creation**.

| Rule | Detail |
|---|---|
| Lowercase | `Boat Tours` → `boat-tours` |
| ASCII-only | diacritics folded: `Curaçao` → `curacao`, `ü`→`u`, `é`→`e` |
| Separators | spaces / underscores → single hyphen |
| Strip | no special characters; no leading/trailing/double hyphens |
| Language | **always English** — slugs are never translated |
| Mutability | **immutable** — once created a slug never changes (decision 2026-06-07). No `slug_redirects` table; immutability protects bookmarked/indexed/booking URLs. *(V2 originally specified a 301 redirect table — explicitly dropped.)* |

---

## 4. The Slug Registry — Single Source of Truth for Resolution

```prisma
model SlugRegistry {
  id              String         @id @default(uuid())
  destinationSlug String         // 'curacao' — denormalized copy of Destination.slug (no join needed)
  slug            String         // 'boat-tours', 'klein-curacao'
  entityType      SlugEntityType // TOUR | CATEGORY | HUB | COLLECTION | RESERVED
  entityId        String?        // FK-by-value; null ONLY when entityType = RESERVED
  isActive        Boolean        @default(true) // false → 404, but slug stays claimed
  createdAt       DateTime       @default(now())

  @@unique([destinationSlug, slug])
  @@index([destinationSlug, slug, isActive])
  @@map("slug_registry")
}
```

### Entity types

| Type | Meaning | `entityId` | Example URL |
|---|---|---|---|
| `CATEGORY` | Global category (one row per active destination) | `category.id` | `/en/curacao/boat-tours/` |
| `HUB` | Destination-scoped discovery tag | `hub.id` | `/en/curacao/klein-curacao/` |
| `COLLECTION` | Curated/filtered list (destination-scoped) | `collection.id` | `/en/curacao/top-10-tours/` |
| `TOUR` | Individual tour detail page | `trip.id` | `/en/curacao/sunset-catamaran-cruise/` |
| `RESERVED` | Protected slug (`tours`) | `null` | `/en/curacao/tours/` |

> `entityId` is `null` **iff** `entityType === RESERVED`.

### Two invariants

1. **Uniqueness** — `@@unique([destinationSlug, slug])`. Within one destination a slug maps to exactly one entity. The *same* slug under *different* destinations is independent (`curacao/boat-tours` ≠ `aruba/boat-tours`).
2. **`isActive` is a tombstone, not a delete** — when an entity is soft-disabled the row stays with `isActive=false`: the page 404s but the slug remains claimed, so no other entity can silently steal a URL that may be bookmarked or indexed. Only a **hard delete** removes the row and frees the slug.

> Full write/lifecycle rules (who writes rows, fan-out on create, soft-disable vs hard-delete, the `resolveUniqueSlug()` collision algorithm) live in **`SLUG-REGISTRY.md`**. This doc covers only how those rows are *read* to route a request.

---

## 5. The Resolution Algorithm

### 5.1 The resolve endpoint

```
GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}
```

```typescript
// slug-registry.service.ts → resolve()
async resolve(destinationSlug: string, slug: string) {
  const entry = await this.prisma.slugRegistry.findUnique({
    where: { destinationSlug_slug: { destinationSlug, slug } },
    select: { destinationSlug: true, slug: true, entityType: true, entityId: true, isActive: true },
  });

  if (!entry || !entry.isActive) {
    throw new NotFoundException(`No active slug "${slug}" found for destination "${destinationSlug}"`);
  }
  return { destinationSlug, slug, entityType: entry.entityType, entityId: entry.entityId };
}
```

- **200** → `{ destinationSlug, slug, entityType, entityId }`
- **404** → slug is **unknown** OR **inactive** (soft-deleted). The public router treats both identically.

`@Public()` endpoint — no auth, locale-independent, cacheable.

### 5.2 The routing switch (frontend)

```ts
// app/(frontend)/[locale]/[destination]/[slug]/page.tsx
const r = await resolveSlug(destination, slug); // 404 → notFound()

switch (r.entityType) {
  case 'CATEGORY':   return <CategoryPage   destination={destination} categoryId={r.entityId}   locale={locale} />;
  case 'HUB':        return <HubPage        destination={destination} hubId={r.entityId}        locale={locale} />;
  case 'COLLECTION': return <CollectionPage destination={destination} collectionId={r.entityId} locale={locale} />;
  case 'TOUR':       return <TourPage       destination={destination} slug={slug}               locale={locale} />;
  case 'RESERVED':   return <AllToursListing destination={destination}                          locale={locale} />;
  default:           return notFound();
}
```

- **TOUR** → the page fetches by the *flat slug* it already has; it does **not** need `entityId`:
  `GET /api/v1/trips/slug/{slug}?destinationSlug={destination}&locale=` (no `hubSlug` — flat resolution).
- **CATEGORY / HUB / COLLECTION** → use `entityId` to fetch the page payload + filtered tour list.
- **RESERVED** → render the "all tours in this destination" listing.

### 5.3 End-to-end request flow (category example)

```text
Browser  /nl/curacao/boat-tours/
  → middleware.ts            extracts locale=nl, destination=curacao, slug=boat-tours
  → [locale]/[destination]/[slug]/page.tsx
      → GET /api/v1/slug-registry/resolve?destinationSlug=curacao&slug=boat-tours
            → { entityType: CATEGORY, entityId: abc-123 }   (404 if missing/inactive → notFound)
      → <CategoryPage categoryId=abc-123 locale=nl>
            ┌─ GET /categories/destination/curacao/boat-tours?locale=nl   (404 if 0 published tours)
            ├─ GET /categories/abc-123/page-content?locale=nl
            └─ GET /categories/abc-123/faqs?locale=nl
      → render
```

---

## 6. Depth & Disambiguation Rules

| Path shape | How it resolves |
|---|---|
| `/{locale}/` | Homepage |
| `/{locale}/{destination}/` (2 segments) | Destination page — **direct** match on `Destination.slug`, **no registry lookup** |
| `/{locale}/{destination}/{slug}/` (3 segments) | **Always** one `slug-registry/resolve` call, then switch on `entityType` |
| 4+ segments | `404` unless an explicitly-defined route exists. **No 2-segment tour URL** — hubs add a discovery *tag*, never a URL prefix. |

---

## 7. The Two 404 Layers (Category Gating)

A successful `CATEGORY` resolve is **necessary but not sufficient** to render the page. There are two independent reasons a category URL 404s:

1. **Registry 404** — the slug is unknown or `isActive=false`.
2. **Gating 404** — the category resolves fine, but it has **zero published tours** at this destination. `categories.service.ts` `getBySlugForDestination` returns 404 when `publishedTourCount === 0`.

The registry answers *"what is this slug?"*; the category service answers *"is this page allowed to render right now?"*. Both map to `notFound()` on the frontend. Empty category pages must never exist (bad for SEO/UX).

> This gating applies to categories only. Hubs, collections, and tours render whenever their resolve succeeds and `isActive=true`.

---

## 8. The Reserved `tours` Slug

Every destination is seeded with one `RESERVED` row for slug `tours` (`entityId = null`) at creation time. It:

- Protects `/{destination}/tours/` so no category/hub/collection/tour can ever claim it.
- Lets the frontend render the "all tours in this destination" listing from a known, stable URL.
- Resolves to `entityType: RESERVED` → `<AllToursListing>`.

Alongside it, the **19 global category slugs** are reserved at every destination on creation, so categories route consistently across all islands.

---

## 9. Internationalization & SEO Routing

### 9.1 English slugs, locale-prefixed URLs

```
/en/curacao/boat-tours/   ✅
/nl/curacao/boat-tours/   ✅   ← same slug, only the prefix changes
/nl/curacao/boottochten/  ❌   ← translated slugs are never used
```

**Why English slugs:** avoids 7× registry multiplication; tourists predominantly search in English; SEO value lives in translated titles/meta/H1/body, not the slug; keeps the registry to one row per entity per destination.

### 9.2 Canonical & hreflang

- Each locale version has its **own canonical** URL.
- Every entity page outputs hreflang tags for all 7 locales **plus `x-default → English`**. The slug is identical across locales; only the prefix changes.

```html
<!-- /*/curacao/boat-tours/ -->
<link rel="alternate" hreflang="en" href="/en/curacao/boat-tours/" />
<link rel="alternate" hreflang="nl" href="/nl/curacao/boat-tours/" />
<link rel="alternate" hreflang="es" href="/es/curacao/boat-tours/" />
<link rel="alternate" hreflang="de" href="/de/curacao/boat-tours/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/boat-tours/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/boat-tours/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/boat-tours/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />
```

### 9.3 Filtered pages use query params, not new slugs

A filtered view of a category is a **query string on the category page**, with the canonical pointing back to the base page — never a new slug:

```
/en/curacao/boat-tours/?booking_type=private     canonical → /en/curacao/boat-tours/
```

Prefer this over a dedicated collection page when a "collection" is really just a filtered category. Collection slugs must be **semantically distinct** from category slugs (`top-10-tours` ✅, never `boat-tours-private` ❌).

### 9.4 ISR revalidation follows the URL shape

Because a category lives at every destination × locale, content edits revalidate the full matrix; a hub/destination revalidates per-locale at its one path:

```typescript
// Category edit
for (const locale of LOCALES)
  for (const dest of ACTIVE_DESTINATIONS)
    revalidatePath(`/${locale}/${dest}/boat-tours/`);

// Hub edit
for (const locale of LOCALES) revalidatePath(`/${locale}/curacao/klein-curacao/`);

// Destination edit
for (const locale of LOCALES) revalidatePath(`/${locale}/aruba/`);
```

---

## 10. Frontend Caching Guidance

- Resolve results are safe to cache per `(destination, slug)` with revalidation — slugs are immutable; the only thing that changes is `isActive`, which should bust the cache on the (rare) admin toggle. A `slug-lookup` cache is the intended optimization.
- The resolver is **locale-independent** — one cached resolution serves all 7 locales for a given `(destination, slug)`.
- Treat a `404` from resolve as **authoritative**: render `notFound()`. Never fall back to guessing the entity type.

---

## 11. Implementation Status (as of 2026-06-10)

| Layer | Status |
|---|---|
| Backend `GET /api/v1/slug-registry/resolve` | ✅ Built (`backend/src/slug-registry/`) — production-ready |
| Backend registry writes (destination/category/hub/collection/tour) | ✅ Built (see `SLUG-REGISTRY.md`) |
| Flat tour URLs (Stage 4/5 — no hub-nested route, no `hubSlug` param) | ✅ Implemented |
| Frontend `[locale]/[destination]/page.tsx` (destination) | ✅ Built |
| Frontend `[locale]/[destination]/tours/page.tsx` (RESERVED listing) | ✅ Built |
| Frontend `[locale]/[destination]/[slug]/page.tsx` (polymorphic resolver + switch) | ✅ Built — resolve→switch + localized metadata/hreflang |
| `lib/api/slug-registry.ts` → `resolveSlug()` | ✅ Built (returns `null` on 404 → `notFound()`) |
| `CategoryPage` component | ✅ Built (`components/frontend/category-page.tsx`) — gated detail + page-content + FAQs, reuses the All-Tours layout |
| `HubPage` / `CollectionPage` / `TourPage` components | ⬜ Not yet built — `[slug]` switch 404s these branches for now |

**Remaining piece** for full public routing is the HUB / COLLECTION / TOUR page components (the `[slug]` resolve→switch and the CATEGORY branch are built). Everything they depend on (the resolve endpoint, the registry rows, the detail endpoints) already exists.

### Frontend build tasks

1. `lib/api/slug-registry.ts`: `resolveSlug(destinationSlug, slug)` → typed `{ entityType, entityId }`; map any non-200 to `notFound()`.
2. `app/(frontend)/[locale]/[destination]/[slug]/page.tsx`: implement the resolve→switch (§5.2).
3. Build `CategoryPage`, `HubPage`, `CollectionPage`, `TourPage`, `AllToursListing`; each calls its matching detail endpoint:
   - CATEGORY → `GET /categories/destination/{dest}/{slug}?locale=` (404 on 0 published tours)
   - HUB → `GET /hubs/{dest}/{slug}?locale=`
   - TOUR → `GET /trips/slug/{slug}?destinationSlug={dest}&locale=` (flat — no `hubSlug`)
   - COLLECTION → `GET /collections/slug/{slug}?destinationSlug={dest}`
   - RESERVED → all-tours listing

---

## 12. Related Docs

- `SLUG-REGISTRY.md` — full slug-write lifecycle, `resolveUniqueSlug()` collision algorithm, per-entity create cycles.
- `PLATFORM-ARCHITECTURE-V2.md` §2–§12 — discovery architecture, the 19 global categories, destinations/hubs/collections model.
- `04-multilingual/MULTILINGUAL-CONTENT.md` — locale fallback, translation payloads, hreflang detail.
- `06-v2-backend-migration/05-FRONTEND-IMPACT-LOG.md` — "Public-site routing contract", flat-URL migration before/after.
- `02-architecture/SOFT-DELETE-STRATEGY.md` — `isActive` tombstone semantics platform-wide.
- `CLAUDE.md` — Critical Rules #4, #5, #8 (slug registry transactional integrity, fan-out, flat tour URLs).
