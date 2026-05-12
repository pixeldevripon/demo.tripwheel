# Island Tours — Claude Code Context Document

> **Purpose:** এই document টা Claude Code এর জন্য complete technical context। Platform architecture, all design decisions, database schema, এবং implementation rules সব এখানে আছে।
> **Stack:** Next.js (App Router), PostgreSQL, Prisma ORM, next-intl
> **Last updated:** May 2026

---

## 1. Platform Overview

Island Tours একটা Caribbean tour booking platform। Users এখানে tours browse করে, compare করে, এবং instantly book করতে পারে।

**Core entities:**
- **Destinations** — Caribbean islands (Curaçao, Aruba, Sint Maarten, etc.)
- **Categories** — Activity types (Boat Tours, Sunset Cruises, Buggy Tours, etc.)
- **Hubs** — Special location-based entities (Klein Curaçao) যেখানে multiple operators যায়
- **Tours** — Individual bookable experiences, operators create করে
- **Operators** — Tour providers (Miss Ann, BlueFinn, Powerboat, etc.)

---

## 2. URL Architecture

```
/{locale}/{destination}/                          → Destination page
/{locale}/{destination}/tours/                    → All Tours page (reserved)
/{locale}/{destination}/{slug}/                   → Dynamic: Category | Hub | Tour
/{locale}/{destination}/{hub-slug}/{tour-slug}/   → Hub-anchored Tour
```

**Examples:**
```
/en/curacao/                              → Curaçao destination page
/en/curacao/tours/                        → All tours in Curaçao
/en/curacao/boat-tours/                   → Boat Tours category page
/en/curacao/klein-curacao/                → Klein Curaçao hub page
/en/curacao/sunset-cruise-bluefinn/       → Destination-only tour
/en/curacao/klein-curacao/miss-ann/       → Hub-anchored tour
```

**Slug rules:**
- Slugs always English, even for non-English locales
- Same destination এ same slug দুইটা entity নিতে পারবে না
- `tours` slug প্রতিটা destination এ reserved (protect করা)

---

## 3. Multi-language

**7 locales at launch:** `en` (primary), `es`, `nl`, `pt`, `fr`, `de`, `zh`

- URL prefix: always present (`/en/`, `/es/`, etc.)
- Slugs: always English across all locales
- Static UI strings: `next-intl` via `i18n/messages/*.json`
- Dynamic content: `translations` database table
- Fallback: English যদি locale translation missing হয়
- Currency: EUR for en/nl/de/fr/es/pt → USD for zh

```
/en/curacao/boat-tours/  → English content
/es/curacao/boat-tours/  → Spanish content, same slug
/nl/curacao/boat-tours/  → Dutch content, same slug
```

---

## 4. Rendering Strategy

| Content | Method | Revalidation |
|---|---|---|
| Page shell, H1, overview | SSR / ISR | 300 seconds |
| Tour availability | Client-side fetch | On date-picker open only |
| Booking widget | Client hydration (requestIdleCallback after LCP) | Per interaction |
| Static UI strings | Build-time (next-intl) | On deploy |
| Hreflang tags | SSR (head) | Per page |

**Performance targets:**
- LCP < 2.5s
- INP (page) < 200ms
- INP (booking widget) < 100ms
- CLS < 0.05

---

## 5. Entity Rules — Locked Decisions

### Destinations
- Admin-only create করতে পারবে। Operators পারবে না।
- Predefined Caribbean islands, seeded at launch
- `is_seeded = true` items delete করলে warning দেখাবে

### Categories
- Admin-only create করতে পারবে। Operators পারবে না।
- **Global** — destination-specific নয়। একটা category সব destinations এ available।
- Category create হলে → সব active destinations এর জন্য `slug_registry` এ row insert হবে
- Seeded at launch

### Hubs
- Admin-only create করতে পারবে।
- **Destination-specific** — Hub create করার সময় destination mandatory।
- Hub page এ tabs আছে: Book now | Private charter | Our Pick | Compare | Tips & FAQ
- Tab logic:
  - `pricing_model = 'per_person'` → Book now tab
  - `pricing_model = 'unit'` → Private charter tab
  - Our Pick, Compare → Admin manually manage করে

### Tours
- Operators create করে।
- Operator flow: Destination → Category → Hub (optional, conditional) → Tour details
- Hub selector শুধু দেখাবে যদি selected category সেই hub এ allowed হয় (`hub_allowed_categories` table)
- `hub_id = NULL` → destination-only tour → slug registry তে add হবে
- `hub_id = SET` → hub-anchored tour → slug registry তে add হবে না

### Top Island Experiences
- **Categories এবং Hubs only।** Individual tours এখানে add করা যাবে না।
- Admin manually featured mark করে + video attach করে

### Badges (Tour Cards — Listing page only)
- Tour Detail Page এ badges দেখাবে না (spec LD7)
- `New` → tour created < 30 days
- `Sponsored` → admin toggle
- `Likely to sell out` → < 20% capacity in next 7 days
- `Most popular` → highest bookings last 30 days per category

---

## 6. Slug Registry — How It Works

### কেন দরকার
`/en/curacao/boat-tours/` এবং `/en/curacao/klein-curacao/` এবং `/en/curacao/miss-ann/` — এই তিনটা URL একই Next.js route pattern `[slug]`। Registry ছাড়া কোনটা কী বোঝা যাবে না।

### কোন entity registry তে যাবে

| Entity | Registry তে যাবে? | কারণ |
|---|---|---|
| Destination | ❌ না | URL এ fixed position, `[destination]` directly catch করে |
| Category | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Hub | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Tour (destination-only, hub_id=NULL) | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Tour (hub-anchored, hub_id=SET) | ❌ না | `[slug]/[tourSlug]` structure sufficient |
| Reserved (`tours`) | ✅ হ্যাঁ | Protect করতে |

### Registry insert হয় কখন
- **Hub create** → registry তে 1 row (নিজের destination এর জন্য)
- **Category create** → registry তে N rows (সব active destinations এর জন্য)
- **Tour create (destination-only)** → registry তে 1 row
- **Tour create (hub-anchored)** → registry তে 0 row

### Slug conflict rule
- Same `(destination_slug, slug)` combination → UNIQUE constraint block করবে
- `tours` slug সব destinations এ reserved as seeded rows

---

## 7. Complete Database Schema

### destinations
```sql
destinations (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  is_seeded       BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  created_by      INTEGER REFERENCES admins(id),
  created_at      TIMESTAMP DEFAULT now()
)
```

### categories
```sql
categories (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  is_seeded       BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  created_by      INTEGER REFERENCES admins(id),
  created_at      TIMESTAMP DEFAULT now()
)
```

### hubs
```sql
hubs (
  id              SERIAL PRIMARY KEY,
  destination_id  INTEGER NOT NULL REFERENCES destinations(id),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      INTEGER REFERENCES admins(id),
  created_at      TIMESTAMP DEFAULT now(),

  UNIQUE (destination_id, slug)
)
```

### hub_allowed_categories
```sql
hub_allowed_categories (
  id              SERIAL PRIMARY KEY,
  hub_id          INTEGER NOT NULL REFERENCES hubs(id),
  category_id     INTEGER NOT NULL REFERENCES categories(id),

  UNIQUE (hub_id, category_id)
)
```
> এই table define করে কোন category এর tours কোন hub এ assign হতে পারবে।
> Operator tour create করার সময় category select করলে — এই table check করে hub selector দেখাবে কিনা।

### tours
```sql
tours (
  id                      SERIAL PRIMARY KEY,
  operator_id             INTEGER NOT NULL REFERENCES operators(id),
  destination_id          INTEGER NOT NULL REFERENCES destinations(id),
  category_id             INTEGER NOT NULL REFERENCES categories(id),
  hub_id                  INTEGER REFERENCES hubs(id),  -- nullable

  name                    VARCHAR(200) NOT NULL,
  slug                    VARCHAR(100) NOT NULL,

  pricing_model           VARCHAR(20) NOT NULL,  -- 'per_person' | 'unit'
  unit_type               VARCHAR(20),           -- 'group' | 'boat' | 'vehicle' | 'aircraft' | 'package'
  base_price              DECIMAL(10,2),

  duration_minutes        INTEGER,
  pickup_model            VARCHAR(20) NOT NULL,  -- 'included' | 'paid_addon' | 'none'
  max_party_size          INTEGER,
  min_party_size          INTEGER DEFAULT 1,
  booking_cutoff_minutes  INTEGER DEFAULT 120,   -- range: 0–10080
  cancellation_hours      INTEGER DEFAULT 24,

  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMP DEFAULT now(),

  CONSTRAINT hub_destination_match CHECK (
    hub_id IS NULL OR (
      SELECT destination_id FROM hubs WHERE id = hub_id
    ) = destination_id
  ),

  UNIQUE (destination_id, slug)
)
```

**hub_destination_match constraint:** Hub-anchored tour এর hub এর destination আর tour এর destination same হতে হবে। Data integrity এর জন্য।

**pricing_model logic:**
- `per_person` → Hub এর Book now tab এ দেখাবে
- `unit` → Hub এর Private charter tab এ দেখাবে

**pickup_model display:**
- `included` → "Pickup included"
- `paid_addon` → "Pickup available"
- `none` → "Meeting point only"

### slug_registry
```sql
slug_registry (
  id                SERIAL PRIMARY KEY,
  destination_slug  VARCHAR(100) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  entity_type       VARCHAR(20)  NOT NULL,  -- 'category' | 'hub' | 'tour' | 'collection' | 'reserved'
  entity_id         INTEGER,                -- NULL only for 'reserved'
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT now(),

  UNIQUE (destination_slug, slug)
)
```

**entity_id NULL only for reserved:**
- `category/hub/tour` → entity_id = সেই entity র actual table id → resolver এটা দিয়ে data fetch করে
- `reserved` → কোনো real entity নেই, শুধু slug protect করা → entity_id = NULL → resolver redirect করে

### translations
```sql
translations (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(20) NOT NULL,  -- 'tour' | 'destination' | 'category' | 'hub'
  entity_id     INTEGER NOT NULL,
  locale        VARCHAR(5) NOT NULL,   -- 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh'
  field         VARCHAR(50) NOT NULL,  -- 'name' | 'overview' | 'highlights' | 'h1_override' | 'breadcrumb_label'
  value         TEXT NOT NULL,

  UNIQUE (entity_type, entity_id, locale, field)
)
```

### page_content
```sql
page_content (
  id          SERIAL PRIMARY KEY,
  page_type   VARCHAR(20) NOT NULL,   -- 'destination' | 'category' | 'hub'
  entity_id   INTEGER NOT NULL,
  locale      VARCHAR(5) NOT NULL,
  field       VARCHAR(50) NOT NULL,   -- 'about_text' | 'meta_title' | 'meta_description'
  value       TEXT NOT NULL,

  UNIQUE (page_type, entity_id, locale, field)
)
```

### faqs
```sql
faqs (
  id            SERIAL PRIMARY KEY,
  page_type     VARCHAR(20) NOT NULL,  -- 'destination' | 'category' | 'hub' | 'tour'
  entity_id     INTEGER NOT NULL,
  locale        VARCHAR(5) NOT NULL,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true
)
```

### hub_our_picks
```sql
hub_our_picks (
  id            SERIAL PRIMARY KEY,
  hub_id        INTEGER NOT NULL REFERENCES hubs(id),
  tour_id       INTEGER NOT NULL REFERENCES tours(id),
  pick_type     VARCHAR(30) NOT NULL,  -- 'best_overall' | 'most_popular' | 'best_for_families' | 'best_value'
  description   TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,

  UNIQUE (hub_id, tour_id)
)
```

### hub_comparison_groups
```sql
hub_comparison_groups (
  id            SERIAL PRIMARY KEY,
  hub_id        INTEGER NOT NULL REFERENCES hubs(id),
  group_name    VARCHAR(100) NOT NULL,  -- 'Comfort trips' | 'Adventure trips'
  display_order INTEGER DEFAULT 0
)
```

### hub_comparison_tours
```sql
hub_comparison_tours (
  id            SERIAL PRIMARY KEY,
  group_id      INTEGER NOT NULL REFERENCES hub_comparison_groups(id),
  tour_id       INTEGER NOT NULL REFERENCES tours(id),
  display_order INTEGER DEFAULT 0,

  UNIQUE (group_id, tour_id)
)
```

### featured_experiences
```sql
featured_experiences (
  id              SERIAL PRIMARY KEY,
  entity_type     VARCHAR(20) NOT NULL,       -- 'category' | 'hub' ONLY, never 'tour'
  entity_id       INTEGER NOT NULL,
  destination_id  INTEGER REFERENCES destinations(id),  -- NULL = show everywhere
  video_url       VARCHAR(500),
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true
)
```

### tour_languages
```sql
tour_languages (
  id          SERIAL PRIMARY KEY,
  tour_id     INTEGER NOT NULL REFERENCES tours(id),
  language    VARCHAR(10) NOT NULL,  -- 'en' | 'nl' | 'es'

  UNIQUE (tour_id, language)
)
```

### tour_addons
```sql
tour_addons (
  id          SERIAL PRIMARY KEY,
  tour_id     INTEGER NOT NULL REFERENCES tours(id),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  unit        VARCHAR(20) DEFAULT 'per_person',
  is_active   BOOLEAN DEFAULT true
)
```

### tour_age_bands
```sql
tour_age_bands (
  id          SERIAL PRIMARY KEY,
  tour_id     INTEGER NOT NULL REFERENCES tours(id),
  label       VARCHAR(20) NOT NULL,  -- 'Adult' | 'Child' | 'Infant'
  min_age     INTEGER,
  max_age     INTEGER,
  price       DECIMAL(10,2) NOT NULL
)
```

### tour_gallery
```sql
tour_gallery (
  id            SERIAL PRIMARY KEY,
  tour_id       INTEGER NOT NULL REFERENCES tours(id),
  image_url     VARCHAR(500) NOT NULL,
  is_hero       BOOLEAN DEFAULT false,
  focal_point_x DECIMAL(4,2),
  focal_point_y DECIMAL(4,2),
  display_order INTEGER DEFAULT 0
)
```

---

## 8. Entity Relationships

```
destinations
    │
    ├── hubs (destination_id) ──── hub_allowed_categories ──── categories
    │       │
    │       ├── hub_our_picks (hub_id → tours)
    │       ├── hub_comparison_groups (hub_id)
    │       │       └── hub_comparison_tours (→ tours)
    │       └── slug_registry (1 row per hub)
    │
    ├── tours (destination_id, category_id, hub_id?)
    │       ├── tour_languages
    │       ├── tour_addons
    │       ├── tour_age_bands
    │       └── tour_gallery
    │
    └── slug_registry (N rows per category × destinations)

slug_registry    → resolves any [slug] to entity
translations     → all multilingual dynamic content
page_content     → editorial content per page
faqs             → FAQ content per entity
featured_experiences → categories | hubs only
```

---

## 9. Next.js Route Structure

```
app/
└── [locale]/
    ├── layout.tsx                          ← locale-aware root layout
    ├── page.tsx                            ← Homepage
    └── [destination]/
        ├── page.tsx                        ← Destination page
        ├── tours/
        │   └── page.tsx                    ← All Tours (reserved slug)
        └── [slug]/
            ├── page.tsx                    ← Dynamic resolver ← main logic here
            └── [tourSlug]/
                └── page.tsx                ← Hub-anchored tour only
```

---

## 10. Core Logic — Slug Resolution

### resolveSlug
```typescript
// lib/slug-registry.ts

export async function resolveSlug(destinationSlug: string, slug: string) {
  return await db.slugRegistry.findFirst({
    where: { destination_slug: destinationSlug, slug, is_active: true }
  });
}

export async function slugExists(destinationSlug: string, slug: string): Promise<boolean> {
  const entry = await db.slugRegistry.findFirst({
    where: { destination_slug: destinationSlug, slug }
  });
  return !!entry;
}

export async function generateUniqueSlug(name: string, destinationSlug: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  let slug = base;
  let counter = 1;

  while (await slugExists(destinationSlug, slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }

  return slug;
}
```

### Dynamic Page Resolver
```typescript
// app/[locale]/[destination]/[slug]/page.tsx

export default async function DynamicPage({ params }) {
  const { locale, destination, slug } = params;

  const dest = await db.destinations.findFirst({
    where: { slug: destination, is_active: true }
  });
  if (!dest) notFound();

  const entity = await resolveSlug(destination, slug);
  if (!entity) notFound();

  switch (entity.entity_type) {
    case 'hub':
      return <HubPage hubId={entity.entity_id} locale={locale} />;
    case 'category':
      return <CategoryPage categoryId={entity.entity_id} locale={locale} />;
    case 'tour':
      return <TourDetailPage tourId={entity.entity_id} locale={locale} />;
    case 'collection':
      return <CollectionPage collectionId={entity.entity_id} locale={locale} />;
    case 'reserved':
      redirect(`/${locale}/${destination}/tours/`);
    default:
      notFound();
  }
}
```

### Hub-Anchored Tour Resolver
```typescript
// app/[locale]/[destination]/[slug]/[tourSlug]/page.tsx

export default async function HubTourPage({ params }) {
  const { locale, destination, slug, tourSlug } = params;

  const hubEntry = await resolveSlug(destination, slug);
  if (!hubEntry || hubEntry.entity_type !== 'hub') notFound();

  const tour = await db.tours.findFirst({
    where: { slug: tourSlug, hub_id: hubEntry.entity_id, is_active: true }
  });
  if (!tour) notFound();

  return <TourDetailPage tourId={tour.id} locale={locale} />;
}
```

---

## 11. Create Flows — Backend Logic

### Hub Create
```typescript
// Transaction: hub + slug_registry (1 row)
const result = await db.$transaction(async (tx) => {
  const hub = await tx.hubs.create({ data: { name, slug, destination_id } });

  await tx.slugRegistry.create({
    data: {
      destination_slug: destination.slug,
      slug,
      entity_type: 'hub',
      entity_id: hub.id,
      is_active: true
    }
  });

  return hub;
});
```

### Category Create
```typescript
// Transaction: category + slug_registry (N rows — one per active destination)
const destinations = await db.destinations.findMany({ where: { is_active: true } });

const result = await db.$transaction(async (tx) => {
  const category = await tx.categories.create({ data: { name, slug } });

  await tx.slugRegistry.createMany({
    data: destinations.map(dest => ({
      destination_slug: dest.slug,
      slug,
      entity_type: 'category',
      entity_id: category.id,
      is_active: true
    }))
  });

  return category;
});
```

### Tour Create (Destination-only)
```typescript
// hub_id = null → slug_registry তে add করো
const result = await db.$transaction(async (tx) => {
  const tour = await tx.tours.create({
    data: { name, slug, destination_id, category_id, hub_id: null, ...rest }
  });

  await tx.slugRegistry.create({
    data: {
      destination_slug: destination.slug,
      slug,
      entity_type: 'tour',
      entity_id: tour.id,
      is_active: true
    }
  });

  return tour;
});
```

### Tour Create (Hub-anchored)
```typescript
// hub_id = set → slug_registry তে add করো না
const result = await db.$transaction(async (tx) => {
  const tour = await tx.tours.create({
    data: { name, slug, destination_id, category_id, hub_id, ...rest }
    // slug_registry insert নেই
  });

  return tour;
});
```

---

## 12. Tour Detail Page — Spec Summary (Section 4.7)

### Locked Decisions
| # | Decision |
|---|---|
| LD1 | Cancellation default: 24h before tour, free. Per-tour overrides allowed. |
| LD2 | CTA progression: Check availability → Continue → Secure your spot |
| LD3 | "Pickup" — no hyphen. Platform-wide. |
| LD4 | Email confirmation = entry pass. No QR, no app, no mobile ticket. |
| LD5 | Trust strip exactly 4 lines: Free cancel 24h • Reserve from 20% • Confirmed in seconds • Chat 24/7 / WhatsApp 08:00-22:00 |
| LD6 | Closing trust block ends with: "Built by Islanders." |
| LD7 | Quick-info row = exactly 3 badges: Duration, Pickup, Languages |
| LD8 | Mobile breadcrumbs visible on tour detail page |
| LD9 | Banned words: paradise, luxury, exclusive, seamless, world-class, discover (as verb), unlock, adventure-awaits, committed-to |
| LD10 | Real Curaçao operator names in spec examples only |
| LD11 | Provider Rating cold-start: <3 native reviews → show operator aggregate if ≥10 reviews + ≥4.0 avg |
| LD12 | Total price always visible before payment. All fees itemized. No surprises. |

### Page Section Order
```
4.7.1  Breadcrumbs
4.7.2  H1
4.7.3  Rating row
4.7.4  Image gallery
4.7.5  Quick-info badges (Duration, Pickup, Languages — exactly 3)
4.7.6  Booking widget
4.7.7  Tour overview
4.7.8  Highlights
4.7.9  Inclusions
4.7.10 Itinerary
4.7.11 Meeting + Pickup
4.7.12 What to Bring
4.7.13 Know Before You Go
4.7.14 Accessibility
4.7.15 Languages
4.7.16 Cancellation Policy
4.7.17 About Your Hosts
4.7.18 Reviews
4.7.19 FAQ
4.7.20 Related Tours
4.7.21 Closing Trust Block
```

### Booking Widget States
```
S1 Initial    → Price-from, date prompt, party selector, "Check availability", trust strip
S2 Date picker → 14-day chip view
S3 Date selected → Time-slot chips
S4 Ready      → "Continue" replaces "Check availability", total recalculates
S5 Edge       → Sold out, no availability, API failure
```

---

## 13. Pending — Product Owner Confirmation Required

এগুলো এখনো confirm হয়নি। Implement করার আগে confirm নিতে হবে:

| # | Question |
|---|---|
| P1 | Exact destination list কী কী থাকবে launch এ? Phased rollout আছে? |
| P2 | Final category list কী কী? |
| P3 | Klein Curaçao Hub এ কোন categories এর tours allowed? (`hub_allowed_categories` seed data) |
| P4 | Launch এ Curaçao ছাড়া অন্য destinations এ Hub থাকবে? |

---

## 14. Key Constraints Summary

```
1. Tour এর hub_id set থাকলে → hub এর destination = tour এর destination (DB constraint)
2. Hub-anchored tour → slug_registry তে যাবে না
3. Category create → সব active destinations এ slug_registry এ entry হবে
4. Same (destination_slug, slug) → UNIQUE constraint block করবে
5. featured_experiences → শুধু category | hub, কখনো tour নয়
6. hub_allowed_categories → কোন category এর tour কোন hub এ যেতে পারবে সেটা define করে
7. Tours reserved slug হিসেবে প্রতিটা destination এ seeded থাকবে
8. entity_id = NULL শুধু entity_type = 'reserved' এর জন্য
9. Operator tour create করার সময় category select করলে hub_allowed_categories check হবে
10. Hub create করার সময় destination mandatory
```

---

## 15. middleware.ts

```typescript
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```