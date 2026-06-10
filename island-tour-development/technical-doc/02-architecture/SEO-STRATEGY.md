# SEO Strategy & Implementation Reference

> **Status:** Canonical. Consolidates the SEO material previously split across
> `PLATFORM-ARCHITECTURE-V2.md` (§2–§4, §8–§11), `MULTILINGUAL-CONTENT.md` (§4.8, §5.9, §10.4),
> `03-implementation/TRIP-MODULE.md` (§6.10), `06-v2-backend-migration/04-BEFORE-AFTER-AND-LOGIC.md` (§10),
> `V2-DEVELOPMENT-ALIGNMENT-PLAN.md` (Workstream G), `APPLICATION-FEATURES.md` (§23), and `MASTER-CHECKLIST.md` (Phase 19).
> **Scope:** All SEO concerns — meta tags, canonical/hreflang, structured data, sitemaps, robots, breadcrumbs, CRO signals, and the indexing rules baked into routing.
> **Companion doc:** URL structure & slug resolution live in `ROUTING-AND-RESOLUTION.md`; this doc covers what makes those URLs *rank*.
> **Source of truth in code:** `backend/prisma/settings.prisma` (`SiteSEO`), the four `*PageContent` models, and the frontend `app/(frontend)/…` metadata layer (largely **not yet built** — see §12).

---

## 1. SEO Model at a Glance

The platform's SEO rests on four layers:

| Layer | What it controls | Where it lives |
|---|---|---|
| **Global defaults** | Site-wide meta fallbacks, analytics IDs, verification tokens, robots.txt body | `SiteSEO` singleton (backend, built) |
| **Per-entity / per-locale content** | `metaTitle`, `metaDescription`, `aboutText` for each destination/category/hub/collection in each of 7 locales | `*PageContent` tables (backend, built) |
| **Derived / template** | Tour meta derived at render time; category meta templates | Trip fields + `metaTitleTemplate` (backend, built) |
| **Rendering** | `<title>`, `<meta>`, canonical, hreflang, JSON-LD, sitemaps, robots, breadcrumbs | Next.js frontend (**mostly not built** — §12) |

**The central tension:** backend SEO infrastructure is ~80% complete and dormant; the frontend rendering layer that would activate it is ~0% built. §12 is the authoritative build-status table.

---

## 2. Meta Tags (Title, Description, Open Graph)

### 2.1 Where meta is stored

| Entity | Meta storage | Per-locale? | Fields |
|---|---|---|---|
| Destination | `DestinationPageContent` | Yes | `metaTitle`, `metaDescription`, `aboutText` (+ `ogImage` on `Destination`) |
| Category | `CategoryPageContent` | Yes | `metaTitle`, `metaDescription`, `aboutText` (+ `metaTitleTemplate`, `metaDescriptionTemplate` on `Category`) |
| Hub | `HubPageContent` | Yes | `metaTitle`, `metaDescription`, `aboutText` |
| Collection | `CollectionPageContent` | Yes | `metaTitle`, `metaDescription`, `aboutText` |
| Tour (Trip) | **No PageContent model** — derived at render | n/a | `h1Override`, `breadcrumbLabel` columns only |

All `*PageContent` rows are keyed by `(entityId, locale)` and exposed via:

```
GET   /{entity}/{id}/page-content?locale={locale}
PATCH /{entity}/{id}/page-content/{locale}
```

### 2.2 Tour meta is derived (no stored meta columns)

Tours carry no `metaTitle`/`metaDescription`. They are computed at render time:

| Output | Derived from |
|---|---|
| `<title>` | `trip.translation?.title ?? trip.name` |
| meta description | `trip.translation?.overview` truncated to ~160 chars |
| `og:image` | hero image — `trip.images.find(i => i.isHero)?.url` |
| `<h1>` | `trip.h1Override ?? <generated from name + primary category>` |
| breadcrumb leaf | `trip.breadcrumbLabel ?? trip.name` |

### 2.3 Category meta templates

Categories carry `metaTitleTemplate` / `metaDescriptionTemplate` (e.g. `"{category} in {destination}"`). These generate sensible defaults per destination when no per-locale `CategoryPageContent.metaTitle` exists.

### 2.4 Per-locale fallback at render

```tsx
<title>{pageContent.metaTitle ?? `${entity.name} | Island Tours`}</title>
<meta name="description" content={pageContent.metaDescription ?? ''} />
```

Fallback rules (from `MULTILINGUAL-CONTENT.md`): a missing translation row falls back to canonical English `name`; missing `metaTitle` falls back to `{name} | Island Tours`; missing `metaDescription` → empty string. `name` is always populated.

### 2.5 Global defaults — the `SiteSEO` singleton

`SiteSEO` (id = `"default"`, `settings.prisma`) holds site-wide fallbacks and integration tokens. **Built**, managed via `GET/PATCH /settings/seo` (admin-gated). Fields:

```prisma
model SiteSEO {
  id String @id @default("default")

  metaTitle  metaDescription  metaKeywords  canonicalUrl  robotsMeta          // base meta
  ogTitle    ogDescription    ogImage                                          // Open Graph defaults
  twitterTitle  twitterDescription  twitterImage                              // Twitter Card defaults
  googleAnalyticsId  googleTagManagerId  googleSearchConsole  facebookPixelId // analytics / verification
  schemaType  customSchema                                                     // org-level JSON-LD
  autoGenerateSitemap  robotsTxt                                              // sitemap/robots config
}
```

> These provide *defaults and tokens*. Per-page meta (above) overrides them. The analytics IDs, verification tokens, and `robotsTxt` body are stored but **not yet wired into the frontend** (§12).

---

## 3. Canonical URLs

| Rule | Detail |
|---|---|
| One canonical per tour | Every tour has exactly one flat canonical URL `/{locale}/{destination}/{tour-slug}/`. It appears on many discovery pages (category, hub, collection) but every link points to this single URL. |
| Never nested | ✅ `/curacao/klein-curacao-catamaran-day-trip/` — ❌ `/curacao/boat-tours/klein-curacao-catamaran/` |
| Filtered views | Filter params get a canonical pointing to the base page: `/curacao/boat-tours/?booking_type=private` → canonical `/curacao/boat-tours/`. Prefer a filtered category URL over a near-duplicate collection page. |
| Per-locale canonical | Each locale version is its own canonical (`/en/…`, `/nl/…`), cross-linked by hreflang (§4). |
| Immutability | Slugs never change after creation — so canonical URLs are stable for the life of the entity. No redirect table needed. |

The canonical URL guarantee is enforced in the backend (flat slug-registry `TOUR` rows, built). Emitting the `<link rel="canonical">` tag is a **frontend task not yet built** (§12).

---

## 4. Hreflang & Internationalized SEO

- **7 locales:** `en`, `nl`, `de`, `fr`, `es`, `pt`, `zh`; default `en`; `localePrefix: 'always'`.
- **English slugs at every locale** — the slug never translates; only the prefix and rendered content change. SEO value lives in translated titles/meta/H1/body, not the slug.
- **Every entity page outputs hreflang** for all 7 locales **plus `x-default → English`**:

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

- **Per-locale Open Graph:** `og:locale`, translated `og:title`/`og:description` per locale.
- `x-default` always points to the English URL, regardless of the rendering locale.

Status: locales and the English-slug rule are built into routing; **hreflang/OG emission is a frontend task not yet built** (§12).

---

## 5. Structured Data (JSON-LD / schema.org)

Each page type emits a defined set of schema.org types as `application/ld+json`. **`BreadcrumbList` appears on every page.**

| Page type | JSON-LD types |
|---|---|
| Tour | `TouristTrip` + `AggregateOffer` (price) + `AggregateRating` (rating + count) + `BreadcrumbList` |
| Category | `CollectionPage` + `ItemList` + `BreadcrumbList` |
| Destination | `Place` + `ItemList` + `BreadcrumbList` |
| Activity Hub | `Place` + `ItemList` + `Article` + `FAQPage` + `BreadcrumbList` |
| Collection | `CollectionPage` + `ItemList` + `BreadcrumbList` |

**Data availability (all backend-ready):**

- `aggregateRating` + review count → on Trip response.
- `AggregateOffer` price → from trip pricing fields.
- `primaryCategoryId` (for breadcrumb + ItemList grouping) → on Trip response.
- FAQ entries → `GET /{entity}/{id}/faqs?locale=` (drives `FAQPage`).
- `ItemList` members → category/hub/collection tour lists (published-only, non-empty).

Status: **all source data is exposed by the backend; the JSON-LD emitters are a frontend task not yet built** (§12). An org-level schema can also be seeded from `SiteSEO.schemaType` / `customSchema`.

---

## 6. Breadcrumbs

| Page type | Breadcrumb path |
|---|---|
| Destination | Home → Destination |
| Category | Home → Destination → Category |
| Activity Hub | Home → Destination → Activity Hub |
| Collection | Home → Destination → Collection |
| Tour | Home → Destination → **Primary Category** → Tour |

- **Tour breadcrumb uses the primary category** (`trip.primaryCategoryId` + `primaryCategoryName`, both on the trip response) — the one `TourCategory` row with `isPrimary = true`. The URL stays flat; only the breadcrumb reflects the category.
- **Label fallback:** `breadcrumbLabel ?? name` for destination/category/hub; `breadcrumbLabel ?? trip.name` for the tour leaf.
- Render **both** as visible UI **and** as `BreadcrumbList` JSON-LD.

Status: a semantic UI breadcrumb component exists (`components/frontend/tours-breadcrumb.tsx`) with `aria-label`/`aria-current`, **but it emits no JSON-LD** and the full per-page-type breadcrumb wiring is **not yet built** (§12).

---

## 7. Sitemaps

A segmented, per-locale, per-type sitemap with an index:

```text
/sitemap.xml                                  → index (lists all per-locale/per-type files)
/sitemaps/sitemap-en-destinations.xml
/sitemaps/sitemap-en-curacao-categories.xml
/sitemaps/sitemap-en-curacao-tours.xml
/sitemaps/sitemap-en-curacao-hubs.xml
/sitemaps/sitemap-en-curacao-collections.xml
… repeated per locale (es, nl, pt, fr, de, zh)
```

**Rules:**

- Segmented by **content type** and **locale**; the index lists per-locale files.
- **Published only** — draft/archived/inactive pages excluded.
- **Category sitemaps exclude zero-tour categories** — never list a page that would 404 under gating (§9). Backend exposes `publishedTourCount` to support this.
- Update `lastmod` on change; submit the index to Google Search Console.

Status: architecture defined and data ready; **no `sitemap.ts` route handlers built** (§12). `SiteSEO.autoGenerateSitemap` is a stored flag, not yet acted on.

---

## 8. Robots & Indexing Control

The platform controls indexing primarily through **HTTP status codes and canonicals**, not `noindex` meta:

| Mechanism | Effect |
|---|---|
| Slug-registry `isActive = false` | Disabled entity → **404** (slug stays claimed but page is gone) |
| Category gating (0 published tours) | Resolvable category with no tours → **404** (no thin/empty pages) |
| Filtered URLs | Query-param views carry canonical → base page (no duplicate indexing) |
| `robots.txt` (planned) | Disallow `/admin/*`, `/api/*`, `/dashboard/*`; allow `/`; declare `Sitemap: /sitemap.xml` |

`SiteSEO.robotsMeta` and `SiteSEO.robotsTxt` are stored fields. Status: the 404-based controls are **built in the backend**; `robots.txt` emission and any `<meta name="robots">` rendering are **frontend tasks not yet built** (§12).

---

## 9. SEO Rationale Behind Routing Decisions

These URL/slug rules (defined fully in `ROUTING-AND-RESOLUTION.md`) exist for SEO reasons:

| Decision | SEO rationale |
|---|---|
| **Flat tour URLs** (never nested) | One canonical per tour; avoids duplicate/competing URLs and keeps link equity on a single page. |
| **No numeric suffixes** on collisions | `-2`/`-3` slugs are confusing and dilute relevance; collisions append the operator name once (`…-bluefin`), else reject. |
| **English slugs everywhere** | Avoids 7× slug multiplication; tourists search in English; ranking signal lives in translated meta/H1/body, not the slug. |
| **Category gating (≥1 published tour)** | Empty category pages are thin content — harmful to rankings; gated to 404 and excluded from sitemaps. |
| **Immutable slugs** | Stable canonical/indexed URLs; bookmarked & inbound links never break; no redirect-chain decay. |
| **Filtered = query params + canonical** | Prevents near-duplicate collection/category pages from competing. |

---

## 10. CRO Signals (Conversion-Rate Optimization)

CRO badges are not strictly SEO but share the rendering layer and trust-signal surface. Tour CRO fields (migration `trip_cro_fields`, exposed on every trip response):

| Badge | Field | Show when | Example |
|---|---|---|---|
| Social proof | `bookingCountToday` | `> 0` | "Booked 12 times today" |
| Urgency | `spotsRemaining` | `> 0` | "Only 3 spots left" |
| Recency | `lastBookedAt` | within ~24h | "Last booked 2 hours ago" |
| Price anchor | `basePrice` | always | "From $89 per person" |
| Rating | `rating` + `reviewCount` | when reviewed | "⭐ 4.8 (124 reviews)" |
| Trust | `freeCancellation`, `instantConfirmation` | when true | badges |

`bookingCount` also drives the **Recommended** sort key.

Status: **columns exist and are exposed**, but the values are **inert (0 / null)** until the bookings module (Phase 4) writes them; badge **rendering is not yet built**.

---

## 11. Internal Linking Strategy

| From | To | Purpose |
|---|---|---|
| Destination | Categories *with tours*, top hubs, featured collections | Navigation + discovery |
| Category | Related categories (e.g. boat-tours → sunset-cruises) | Cross-category discovery |
| Tour | Related tours (same category + destination, by rating) | Cross-sell |
| Tour | Its activity hub (if assigned) | Contextual link |
| Activity Hub | Related hubs in same destination | Exploration |
| All pages | Destination page (via breadcrumbs) | Navigation + equity flow |

**Key principle:** never link to zero-tour category pages (they 404). Link only to categories with `publishedTourCount > 0`.

---

## 12. Implementation Status (as of 2026-06-10)

The decisive split: **backend SEO data is built and dormant; the frontend rendering layer that activates it is largely missing.**

| Component | Backend | Frontend | Notes |
|---|---|---|---|
| `SiteSEO` global settings (`GET/PATCH /settings/seo`) | ✅ Built | ⬜ Not consumed | Meta/OG/Twitter defaults, analytics IDs, verification tokens, robots.txt body all stored |
| Per-entity `*PageContent` (metaTitle/metaDescription/aboutText × locale) | ✅ Built | ⚠️ Admin forms only | Public pages don't yet read it via `generateMetadata()` |
| Category meta templates (`metaTitleTemplate`/`metaDescriptionTemplate`) | ✅ Built | ⬜ Not consumed | |
| Tour derived meta (title/description/og from translation + hero) | ✅ Data ready | ⬜ Not rendered | No tour PageContent model by design |
| Canonical tour URLs (flat, immutable, slug-registry rows) | ✅ Built | ⬜ `<link rel=canonical>` not emitted | |
| hreflang + `x-default` + per-locale OG | ✅ Locales/rules built | ⬜ Not emitted | No `alternates` in metadata |
| JSON-LD per page type + `BreadcrumbList` | ✅ Source data exposed | ⬜ Not emitted | No `application/ld+json` output anywhere |
| Breadcrumbs | ✅ Data exposed (`primaryCategoryId` etc.) | ⚠️ UI partial, no JSON-LD | `tours-breadcrumb.tsx` exists |
| Sitemaps (index + per-locale/per-type) | ✅ Data ready (`publishedTourCount`) | ⬜ No `sitemap.ts` | |
| robots.txt | ✅ Body stored in `SiteSEO` | ⬜ No `robots.ts` | |
| Category gating (404 on 0 tours) | ✅ Built | ✅ Honored (`notFound()`) | Prevents thin pages |
| CRO fields | ✅ Columns + exposure | ⬜ Badges not rendered | Values inert until bookings (Phase 4) |
| Analytics / GTM / Pixel scripts | ✅ IDs stored | ⬜ Not injected | |

### Frontend build tasks to activate SEO

1. Add `generateMetadata()` to each public page (`[destination]`, `[slug]` once built) — fetch `*PageContent` for `(entity, locale)`, fall back to templates → `SiteSEO` defaults.
2. Emit `<link rel="canonical">`, hreflang `alternates` (7 + `x-default`), and per-locale Open Graph/Twitter tags.
3. Render JSON-LD emitters per page type (§5) + `BreadcrumbList` on every page.
4. Add `app/sitemap.ts` (index + per-locale/per-type, published-only, non-empty categories) and `app/robots.ts` (from `SiteSEO.robotsTxt`).
5. Wire breadcrumb JSON-LD into the existing UI component; tour breadcrumb uses `primaryCategoryId`.
6. Inject analytics/GTM/Pixel from `SiteSEO` IDs.
7. Render CRO badges (hide when value is 0/null) — fully live only after the bookings module populates the counters.

---

## 13. Related Docs

- `ROUTING-AND-RESOLUTION.md` — URL structure, slug resolution, the two 404 layers (the routing rules SEO depends on).
- `SLUG-REGISTRY.md` — slug immutability, flat tour URLs, registry lifecycle.
- `PLATFORM-ARCHITECTURE-V2.md` §10–§11 — canonical discovery/SEO architecture, internal linking, i18n SEO.
- `04-multilingual/MULTILINGUAL-CONTENT.md` — per-locale meta fallback, hreflang detail, ISR revalidation.
- `03-implementation/TRIP-MODULE.md` §6.10 — tour H1/meta/breadcrumb override fields.
- `06-v2-backend-migration/04-BEFORE-AFTER-AND-LOGIC.md` §10 — SEO/CRO before/after.
- `V2-DEVELOPMENT-ALIGNMENT-PLAN.md` Workstream G · `MASTER-CHECKLIST.md` Phase 19 — task-level SEO status.
