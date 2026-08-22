# Routing Structure & Resolution Strategy

> **Canonical source:** master §2.2 (URL structure), §2.5 (rendering), §2.7 (breadcrumbs), Appendix "Destination URL Structure" — `island-tours-platform-master.html` v1.9.
> **Purpose:** Define the public-site URL shapes and the exact algorithm that resolves a URL to a page (locale → destination → polymorphic slug → entity type), including the two independent 404 layers and the three breadcrumb variants.
> **Source of truth in code:** Next.js `app/(frontend)/[locale]/[destination]/…`, `backend/src/slug-registry/`.

Companion docs: slug-write lifecycle → [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md); indexing/meta → [`SEO-STRATEGY.md`](./SEO-STRATEGY.md); deactivation semantics → [`SOFT-DELETE-STRATEGY.md`](./SOFT-DELETE-STRATEGY.md); translation/locale fallback → [`../04-multilingual/MULTILINGUAL-CONTENT.md`](../04-multilingual/MULTILINGUAL-CONTENT.md).

---

## 1. The URL Model

Every public content page is one of exactly **two URL shapes**, both locale-prefixed:

```text
/{locale}/{destination}/            → Destination page                              (2 segments)
/{locale}/{destination}/{slug}/     → Category | Hub | Collection | Tour | "tours"  (3 segments)
```

There is **no fourth segment.** Tours are flat — never nested under a category or hub, and there is no `/tour/` path segment. Any deeper path that is not an explicitly-defined route is a `404`.

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

> The Thank You page (`/{destination}/thank-you/{bookingRef}`) is the one exception to the locale-prefix rule: it carries **no** locale prefix and is `noindex`. See §10 and master §8.2.

### Three invariants of the URL model

1. **One canonical URL per tour.** A tour is discovered via many pages (categories, hubs, collections) but every link points to the single flat URL `/{locale}/{destination}/{tour-slug}/`. Tours are **never** nested:
   - Correct: `/en/curacao/klein-curacao-catamaran-day-trip/`
   - Wrong: `/en/curacao/boat-tours/klein-curacao-catamaran/`
2. **All third-segment entities share one namespace.** Category, hub, collection, tour, and the reserved `tours` slug all compete for the same `(destination, slug)` slot — uniqueness is enforced per destination by the slug registry (§4).
3. **Slugs are English at every locale.** The locale prefix selects the *translation*; it never changes the slug. `/en/curacao/boat-tours/` and `/nl/curacao/boat-tours/` are the same entity with different rendered content.

---

## 2. The Three Segments

### 2.1 `{locale}` — handled by middleware, never the registry (master §2.2)

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
| Supported locales | `en`, `nl`, `de`, `fr`, `es`, `pt`, `zh` — all 7 active from launch (EN primary) |
| Default locale | `en` |
| Prefix policy | `always` — every public content URL carries a locale prefix |
| No-prefix request | `/curacao/boat-tours/` → **302** to the user's preferred language via `Accept-Language` detection, defaulting to `/en/…` |
| Effect on resolution | **None.** The slug resolver ignores locale; `(destination, slug)` → same entity for every locale. Locale only selects which translation row is read. |

### 2.2 `{destination}` — resolved directly, no registry lookup (master Appendix "Destination URL Structure")

The destination slug **is** the route segment. Next.js routes `/{locale}/{destination}/` straight to the destination page; it is validated against `Destination.slug`, **not** the slug registry.

```text
app/(frontend)/[locale]/[destination]/page.tsx
   data ← GET /api/v1/destinations/slug/{destination}?locale=   (404 if missing/inactive)
```

**Destination slug normalization** (master, applies to every slug):

| Rule | Detail |
|---|---|
| Lowercase only | `Curaçao` → `curacao` |
| ASCII only | diacritics folded: `ç`→`c`, `ü`→`u`, `é`→`e` |
| Separators | spaces and underscores → hyphens |
| Strip | no special characters; no double hyphens |
| Trim | no leading or trailing hyphens |

Launch destinations (rollout order): `curacao` (launch), `aruba`, `sint-maarten`. Pipeline (seeded, not yet live): `saint-lucia`, `bahamas`.

### 2.3 `{slug}` — polymorphic, resolved by the registry

The third segment is **ambiguous** — from the URL alone Next.js cannot tell a category from a hub from a collection from a tour. They all share one route file and one namespace. The **slug registry** is the lookup table that disambiguates it (§4–§5).

---

## 3. Slug Normalization & Mutability

Every slug — destination, category, hub, collection, tour — is normalized through the same `generateSlug()` util before storage (rules in §2.2).

| Rule | Detail |
|---|---|
| Lowercase | `Boat Tours` → `boat-tours` |
| ASCII-only | diacritics folded |
| Separators | spaces / underscores → single hyphen |
| Strip | no special characters; no leading/trailing/double hyphens |
| Language | **always English** — slugs are never translated |
| Mutability | **Slugs are NOT immutable** (master §2.3). A rename is permitted; on rename the platform writes a **301 redirect entry** from the old URL to the new one (a redirect table), and a deleted slug enters a **90-day soft-delete cooldown** before it can be reused. Lifecycle detail in [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md). |

> **Supersedes the older "immutable, no 301" stance.** The master adopts renames-with-301; the earlier divergence that slugs were frozen for the life of an entity is dropped.

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
2. **`isActive` is a tombstone, not a delete** — when an entity is soft-disabled the row stays with `isActive=false`: the page 404s but the slug remains claimed, so no other entity can silently steal a bookmarked/indexed URL. A hard delete removes the row, after which the freed slug is held in a 90-day cooldown before reuse ([`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md)).

> Full write/lifecycle rules (who writes rows, fan-out on create, soft-disable vs hard-delete, the `resolveUniqueSlug()` collision algorithm, the 301 redirect table, the cooldown) live in [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md). This doc covers only how those rows are *read* to route a request.

---

## 5. The Resolution Algorithm

### 5.1 The resolve endpoint

```text
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
- **404** → slug is **unknown** OR **inactive** (tombstoned). The public router treats both identically.

`@Public()` endpoint — no auth, locale-independent, cacheable.

> **Renames:** because a slug can change, a request for the *old* slug should resolve to a **301** to the new flat URL via the redirect table (master §2.3) before the registry 404s. See [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) §"301 redirects on rename".

### 5.2 The routing switch (frontend)

```ts
// app/(frontend)/[locale]/[destination]/[slug]/page.tsx
const r = await resolveSlug(destination, slug); // 404 → notFound()  (301 first if renamed)

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
- **CATEGORY / HUB / COLLECTION** → use `entityId` to fetch the page payload + filtered/ranked tour list.
- **RESERVED** → render the "all tours in this destination" listing.

### 5.3 End-to-end request flow (category example)

```text
Browser  /nl/curacao/boat-tours/
  → middleware.ts            extracts locale=nl, destination=curacao, slug=boat-tours
  → [locale]/[destination]/[slug]/page.tsx
      → GET /api/v1/slug-registry/resolve?destinationSlug=curacao&slug=boat-tours
            → { entityType: CATEGORY, entityId: abc-123 }   (404 if missing/inactive → notFound)
      → <CategoryPage categoryId=abc-123 locale=nl>
            ┌─ GET /categories/destination/curacao/boat-tours?locale=nl   (404 if <3 published tours)
            ├─ GET /categories/abc-123/page-content?locale=nl
            └─ GET /categories/abc-123/faqs?locale=nl
      → render (tours ordered by tier_rank ASC, quality_score DESC, id ASC)
```

---

## 6. Depth & Disambiguation Rules

| Path shape | How it resolves |
|---|---|
| `/{locale}/` | Homepage |
| `/{locale}/{destination}/` (2 segments) | Destination page — **direct** match on `Destination.slug`, **no registry lookup** |
| `/{locale}/{destination}/{slug}/` (3 segments) | **Always** one `slug-registry/resolve` call, then switch on `entityType` |
| 4+ segments | `404` unless an explicitly-defined route exists. **No nested tour URL** — hubs add a discovery *tag*, never a URL prefix. |

---

## 7. The Two 404 Layers (Category Gating)

A successful `CATEGORY` resolve is **necessary but not sufficient** to render the page. There are two independent reasons a category URL 404s:

1. **Registry 404** — the slug is unknown or `isActive=false`.
2. **Gating 404** — the category resolves fine, but it has **fewer than 3 published tours** at this destination+category combination. `categories.service.ts` returns 404 when `publishedTourCount < 3`.

The registry answers *"what is this slug?"*; the category service answers *"is this page allowed to render right now?"*. Both map to `notFound()` on the frontend. The visibility threshold is **≥3 published tours** (master §2.4 — supersedes the older ≥1 threshold). Below it the category is `status: draft`: excluded from nav, sitemaps, internal links, and search. The check runs on **every tour status change in both directions** (a publish can flip a category live; an unpublish can flip it back to draft).

> This gating applies to categories only. Hubs, collections, and tours render whenever their resolve succeeds and `isActive=true`.

---

## 8. The Reserved `tours` Slug

Every destination is seeded with one `RESERVED` row for slug `tours` (`entityId = null`) at creation time. It:

- Protects `/{destination}/tours/` so no category/hub/collection/tour can ever claim it.
- Lets the frontend render the "all tours in this destination" listing from a known, stable URL.
- Resolves to `entityType: RESERVED` → `<AllToursListing>`.

Alongside it, the **19 global category slugs** are reserved at every destination on creation — **20 protected slugs per destination** (19 categories + `tours`). See [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md).

---

## 9. Breadcrumbs (master §2.7)

Separator: `›` exclusively. The final crumb is the current page and is not clickable. JSON-LD `BreadcrumbList` is emitted on every page that has breadcrumbs (master §2.6).

**Tour pages have three path variants**, chosen by the tour's primary attachment (this supersedes the older "first assigned category" rule):

| Variant | Breadcrumb path | When |
|---|---|---|
| Hub-anchored | `Home › Destination › Hub › Tour` | tour's primary attachment is an activity hub |
| Category-anchored | `Home › Destination › Category › Tour` | tour's primary attachment is its `isPrimary` category |
| Flat | `Home › Destination › Tour` | no hub/category anchor applies |

Non-tour page breadcrumbs:

| Page type | Breadcrumb path |
|---|---|
| Destination | `Home › Destination` |
| Category | `Home › Destination › Category` |
| Activity Hub | `Home › Destination › Activity Hub` |
| Collection | `Home › Destination › Collection` |

- **Mobile visibility is a deliberate per-page divergence:** breadcrumbs are visible on tour detail pages, hidden on destination pages (replaced by the nav back-arrow).
- The URL stays **flat** regardless of which breadcrumb variant renders — the breadcrumb reflects discovery context, not the URL.

---

## 10. Rendering Per Page Type (master §2.5)

Next.js rendering strategy per page type:

| Page type | Rendering | Revalidation |
|---|---|---|
| Homepage | ISR | 60 s |
| Destination | ISR | 60 s |
| All Tours | ISR | 60 s |
| Category | ISR | 60 s |
| Collection | ISR | 60 s |
| Activity Hub | ISR | 300 s |
| Tour detail | ISR | 30 s |
| Search results | SSR | not cached |
| Thank You (TYP) | Server-rendered | n/a (`noindex`) |

All content API endpoints accept a `locale` query parameter defaulting to `en`, with English fallback for missing translations.

**Thank You page route** (master §8.2): `/{destination}/thank-you/{bookingRef}` where `bookingRef = public_ref` (a UUID, non-enumerable). It carries **no** locale prefix and is `noindex`; TYP strings localize via next-intl from the booking's `customer_locale`. Because it is `noindex`, the §2.2 locale-prefix rule for content pages does not apply.

---

## 11. Internationalization & SEO Routing

### 11.1 English slugs, locale-prefixed URLs

```text
/en/curacao/boat-tours/   correct
/nl/curacao/boat-tours/   correct   ← same slug, only the prefix changes
/nl/curacao/boottochten/  wrong     ← translated slugs are never used
```

**Why English slugs:** avoids 7× registry multiplication; tourists predominantly search in English; SEO value lives in translated titles/meta/H1/body, not the slug; keeps the registry to one row per entity per destination.

### 11.2 Canonical & hreflang

- Each locale version has its **own canonical** URL (the flat per-locale URL).
- Every entity page outputs hreflang tags for all 7 locales **plus `x-default → English`**. The slug is identical across locales; only the prefix changes.
- On a rename, the old URL 301-redirects to the new canonical (master §2.3). Detail in [`SEO-STRATEGY.md`](./SEO-STRATEGY.md).

```html
<!-- /*/curacao/boat-tours/ -->
<link rel="alternate" hreflang="en" href="/en/curacao/boat-tours/" />
<link rel="alternate" hreflang="nl" href="/nl/curacao/boat-tours/" />
<link rel="alternate" hreflang="de" href="/de/curacao/boat-tours/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/boat-tours/" />
<link rel="alternate" hreflang="es" href="/es/curacao/boat-tours/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/boat-tours/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/boat-tours/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />
```

### 11.3 Filtered pages use query params, not new slugs

A filtered view of a category is a **query string on the category page**, with a self-referencing canonical pointing back to the base page — never a new slug:

```text
/en/curacao/boat-tours/?booking_type=private     canonical → /en/curacao/boat-tours/
```

Prefer this over a dedicated collection page when a "collection" is really just a filtered category. Collection slugs must be **semantically distinct** from category slugs (`top-10-tours` correct, never `boat-tours-private`).

### 11.4 ISR revalidation follows the URL shape

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

## 12. Frontend Caching Guidance

- Resolve results are cacheable per `(destination, slug)` with revalidation. Because slugs can now change, cache invalidation must also fire on a **rename** (write the 301, bust the old key) and on an `isActive` toggle, not only on hard delete.
- The resolver is **locale-independent** — one cached resolution serves all 7 locales for a given `(destination, slug)`.
- Treat a `404` from resolve as **authoritative**: render `notFound()`. Never fall back to guessing the entity type. Check the redirect table for a 301 *before* deciding a slug is gone.

---

## 13. Implementation Status (as of 2026-06-20)

| Layer | Status |
|---|---|
| Backend `GET /api/v1/slug-registry/resolve` | Built (`backend/src/slug-registry/`) |
| Backend registry writes (destination/category/hub/collection/tour) | Built (see [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md)) |
| Flat tour URLs (no hub-nested route, no `hubSlug` param) | Built |
| 301 redirect table on rename | **Not built** — target (master §2.3) |
| 90-day slug reuse cooldown | **Not built** — target (master §2.3) |
| Category gating threshold | **Canonical ≥3, shipped 2026-08-05** — one constant (`CATEGORY_PAGE_MIN_TOURS`) shared by the page 404, the discovery lists, the sitemap and the homepage card gate |
| Frontend `[locale]/[destination]/page.tsx` (destination) | Built |
| Frontend `[locale]/[destination]/tours/page.tsx` (RESERVED listing) | Built |
| Frontend `[locale]/[destination]/[slug]/page.tsx` (polymorphic resolver + switch) | Built — resolve→switch + localized metadata/hreflang |
| `CategoryPage` component | Built (`components/frontend/category-page.tsx`) |
| `HubPage` component | In progress (`components/frontend/hub-page.tsx`) |
| `CollectionPage` / `TourPage` components | Not yet built — those `[slug]` branches 404 for now |
| Tour ranking (`tier_rank ASC, quality_score DESC, id ASC`) on category/search lists | **Not built** — no tier/quality model yet (master §2.4 commercial model) |

---

## 14. Related Docs

- [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) — slug-write lifecycle, `resolveUniqueSlug()` collision algorithm, the 301 redirect table, the 90-day cooldown.
- [`SEO-STRATEGY.md`](./SEO-STRATEGY.md) — meta, canonical/hreflang, structured data, sitemaps, the indexing rules baked into routing.
- [`SOFT-DELETE-STRATEGY.md`](./SOFT-DELETE-STRATEGY.md) — `isActive` tombstone semantics platform-wide.
- [`PLATFORM-ARCHITECTURE.md`](./PLATFORM-ARCHITECTURE.md) — discovery architecture, the 19 global categories, destinations/hubs/collections model.
- [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md) — commission tiers, ranking, eligibility (the ordering applied to listing pages).
- [`../04-multilingual/MULTILINGUAL-CONTENT.md`](../04-multilingual/MULTILINGUAL-CONTENT.md) — locale fallback, translation payloads, hreflang detail.
