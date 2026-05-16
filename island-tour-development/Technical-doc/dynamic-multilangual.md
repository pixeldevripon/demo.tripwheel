# Dynamic Content Translation — Architecture & Strategy

> Describes how dynamic (database-driven) multilingual content is structured, stored, fetched, and rendered across the Island Tours platform.
> For step-by-step implementation flows see: `category-translation-flow.md` · `destination-translation-flow.md`

---

## Supported Locales

| Code | Language   | Currency |
|------|------------|----------|
| `en` | English    | EUR (primary) |
| `nl` | Dutch      | EUR |
| `de` | German     | EUR |
| `fr` | French     | EUR |
| `es` | Spanish    | EUR |
| `pt` | Portuguese | EUR |
| `zh` | Chinese    | USD |

All 7 locales are active from launch. The `Locale` enum is DB-native — enforced at the database level, not just in application code.

```prisma
// prisma/enums.prisma
enum Locale { en  es  nl  pt  fr  de  zh }
```

Import everywhere as:

```typescript
import { Locale } from '@/common/constants/locales'; // thin re-export of @prisma/client
```

Validate with `@IsEnum(Locale)` — never a plain string array.

---

## Translation Pattern — Per-Entity Typed Tables

The platform uses **per-entity translation tables**, not a generic EAV `translations` table.

### Why not EAV

An EAV table (`entity_type, entity_id, locale, field, value`) has no DB-level type safety, allows field name typos that create silent orphaned rows, and cannot enforce which fields belong to which entity. TypeScript cannot type it without casts.

### What is used instead

Each entity that has translatable content owns its own typed translation table. Fields are explicit columns — not a `field/value` pair.

```
Category         → CategoryTranslation         @@unique([categoryId, locale])
Destination      → DestinationTranslation      @@unique([destinationId, locale])
Hub              → HubTranslation              @@unique([hubId, locale])   (Phase 3)
Trip             → TripTranslation             @@unique([tripId, locale])  (Phase 4)
TourHighlight    → TourHighlightTranslation    (Phase 4)
TourInclusion    → TourInclusionTranslation    (Phase 4)
```

Every translation table follows the same structure:

```prisma
model CategoryTranslation {
  id                  String   @id @default(uuid())
  categoryId          String
  category            Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  locale              Locale                         // DB-enforced enum
  name                String?                        // null → falls back to Category.name
  overview            String?
  h1Override          String?
  breadcrumbLabel     String?
  isMachineTranslated Boolean  @default(false)
  updatedAt           DateTime @updatedAt

  @@unique([categoryId, locale])
  @@index([categoryId, locale])
  @@map("category_translations")
}
```

---

## SEO Page Content — Separate Concern

Editorial SEO content (`aboutText`, `metaTitle`, `metaDescription`) lives in its own table, separate from the core translations. This allows the SEO team to update meta tags without touching the translation workflow.

```prisma
model CategoryPageContent {
  id              String   @id @default(uuid())
  categoryId      String
  category        Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  locale          Locale
  aboutText       String?
  metaTitle       String?
  metaDescription String?

  @@unique([categoryId, locale])
  @@map("category_page_content")
}
```

Same pattern: `DestinationPageContent`, `HubPageContent`.

---

## FAQ — Shared Polymorphic Table

FAQs share one table across all entity types. This is not EAV — it has fixed, typed columns. The `pageType` discriminator enforces which entity type owns each row.

```prisma
model Faq {
  id           String  @id @default(uuid())
  pageType     String  // 'category' | 'destination' | 'hub' | 'tour'
  entityId     String  // UUID of owning entity
  locale       Locale
  question     String
  answer       String
  displayOrder Int     @default(0)
  isActive     Boolean @default(true)

  @@index([pageType, entityId, locale])
  @@map("faqs")
}
```

The service layer enforces that `entityId` belongs to the correct `pageType` before any write.

---

## Fetch Pattern — Single Locale Query + Service Fallback

The backend fetches only the requested locale in one query. Fallback to English happens in the service layer, not by fetching both locales from the DB.

```typescript
// categories.service.ts → getById()

const category = await this.prisma.category.findUnique({
  where: { id },
  select: {
    id: true, name: true, slug: true, isActive: true, isSeeded: true,
    createdAt: true, updatedAt: true,
    translations: {
      where: { locale },                              // single locale — not { in: [locale, 'en'] }
      select: { name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
    },
  },
});

const t = category.translations[0];

return {
  ...applyTranslation(category, t, locale),           // name fallback handled here
  overview:        t?.overview        ?? null,
  h1Override:      t?.h1Override      ?? null,
  breadcrumbLabel: t?.breadcrumbLabel ?? null,
};
```

```typescript
// applyTranslation helper — used in every entity service
private applyTranslation<T extends { name: string }>(
  base: T,
  t: { name: string | null; isMachineTranslated: boolean } | undefined,
  locale: Locale,
) {
  return {
    ...base,
    name: t?.name ?? base.name,               // fallback to canonical English name
    locale,
    isMachineTranslated: t?.isMachineTranslated ?? false,
  };
}
```

### Fallback behaviour

| State | `name` returned | Other translated fields |
|---|---|---|
| Translation row exists, `name` set | Translated name | As stored |
| Translation row exists, `name` is `null` | Canonical English name | Other fields as stored (may be null) |
| No translation row at all | Canonical English name | All null |
| `locale` not in enum | — | 400 Bad Request (ValidationPipe) |

`name` is **always** non-null thanks to the canonical fallback. Frontend never needs a null-check on `name`.

---

## Upsert Pattern — Partial Field Updates

Translation writes use `upsert` with the composite unique key. Only supplied fields are written — omitted fields stay unchanged.

```typescript
await this.prisma.categoryTranslation.upsert({
  where: { categoryId_locale: { categoryId: id, locale } },
  create: {
    categoryId: id, locale, isMachineTranslated,
    name: fields.name,
    overview: fields.overview,
    h1Override: fields.h1Override,
    breadcrumbLabel: fields.breadcrumbLabel,
  },
  update: {
    isMachineTranslated,
    ...(fields.name !== undefined        && { name: fields.name }),
    ...(fields.overview !== undefined    && { overview: fields.overview }),
    ...(fields.h1Override !== undefined  && { h1Override: fields.h1Override }),
    ...(fields.breadcrumbLabel !== undefined && { breadcrumbLabel: fields.breadcrumbLabel }),
  },
  select: { locale: true, name: true, overview: true, h1Override: true,
            breadcrumbLabel: true, isMachineTranslated: true },
});
// First call  → INSERT (no row for this locale)
// Second call → UPDATE (@@unique match found)
```

---

## AI Translation Rules

| Content | AI-translate? | Reason |
|---|---|---|
| Category name, overview, h1Override | Yes — BullMQ background job | Short-to-medium text, AI produces good results |
| Trip overview, highlights, inclusions | Yes — BullMQ background job | Long-form editorial, AI handles well |
| FAQ questions and answers | Yes — BullMQ background job | Structured Q&A, consistent tone |
| **Destination name** (Curaçao, Aruba) | **Never** | Proper noun — identical across all locales |
| **Hub name** (Klein Curaçao) | **Never** | Proper noun — admin sets manually |
| Slug | **Never** | Always English — URL segments are never translated |

When an AI translation is saved, `isMachineTranslated = true` is set. The frontend renders a "Machine translated" badge when this flag is true.

### BullMQ background job (Phase 7)

AI translation runs as an async background job triggered after English content is saved. The job must use `ioredis` with a TCP Redis URL — never the Upstash HTTP REST client.

```typescript
// workers/translation.worker.ts (Phase 7)

const translationQueue = new Queue('translation', { connection: ioredis });

// Triggered after English category content saved
translationQueue.add('translate-category', { categoryId, fields: ['name', 'overview'] });

// Worker processes job
translationQueue.process('translate-category', async (job) => {
  const { categoryId, fields } = job.data;
  const targetLocales: Locale[] = ['es', 'nl', 'pt', 'fr', 'de', 'zh']; // never 'en'

  for (const locale of targetLocales) {
    const translated = await aiTranslateFields(fields, locale);
    await categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId, locale } },
      // ...
      data: { ...translated, isMachineTranslated: true },
    });
  }
});
```

---

## Array Fields — Highlights & Inclusions (Phase 4)

Highlights and inclusions are list-based. Each item has its own parent row; translations live in separate child tables — not JSON columns.

```
TourHighlight ──── TourHighlightTranslation (highlight_id, locale, text, is_machine_translated)
TourInclusion ──── TourInclusionTranslation (inclusion_id, locale, text, is_machine_translated)
```

This keeps translations queryable, indexable, and individually updateable without rewriting the whole array.

---

## Slug Registry — Locale-Agnostic URL Resolution

Slugs are always English. The same slug is served at every locale prefix:

```
/en/curacao/boat-tours/   ✅
/nl/curacao/boat-tours/   ✅   ← slug unchanged, only locale prefix changes
/nl/curacao/boottochten/  ❌   ← translated slugs are never used
```

The slug registry table resolves the ambiguous `[slug]` URL segment (could be category, hub, or tour):

```sql
slug_registry
  destination_slug  VARCHAR(100)   -- 'curacao'
  slug              VARCHAR(100)   -- 'boat-tours'
  entity_type       VARCHAR(20)    -- 'CATEGORY' | 'HUB' | 'TOUR' | 'RESERVED'
  entity_id         UUID nullable
  is_active         BOOLEAN        -- false = entity deactivated, page returns 404
  UNIQUE (destination_slug, slug)
```

Frontend slug resolver (`app/[locale]/[destination]/[slug]/page.tsx`) queries this table, then dispatches to the correct page component with the resolved `entityId` and requested `locale`.

---

## Parallel Server Component Data Fetching

Each entity page fires 3 concurrent backend calls in the Next.js server component. All resolve in a single network round-trip.

```typescript
// app/[locale]/[destination]/[slug]/page.tsx (CategoryPage example)

const [category, pageContent, faqs] = await Promise.all([
  fetch(`/api/v1/categories/${entityId}?locale=${locale}`),
  fetch(`/api/v1/categories/${entityId}/page-content?locale=${locale}`),
  fetch(`/api/v1/categories/${entityId}/faqs?locale=${locale}`),
]);
```

| Call | Returns |
|---|---|
| Entity detail | `name`, `overview`, `h1Override`, `breadcrumbLabel`, `isMachineTranslated` |
| Page content | `aboutText`, `metaTitle`, `metaDescription` |
| FAQs | Ordered array of `question`, `answer` for requested locale |

Page content and FAQs return an empty shape (not 404) when no row exists — missing content is valid state, not an error.

---

## On-Demand ISR Revalidation

After any translation or page content write, the service triggers cache busting for every locale × destination combination that references the updated entity.

```typescript
// Triggered after PATCH /categories/:id/translations/:locale
//                   or PATCH /categories/:id/page-content/:locale

const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
const destinations = ['curacao', 'aruba', 'sint-maarten']; // all active destination slugs

for (const locale of locales) {
  for (const dest of destinations) {
    revalidatePath(`/${locale}/${dest}/boat-tours/`);
  }
}
```

Next.js drops the stale ISR page. The next visitor triggers a fresh server render and sees updated content immediately.

---

## Rendering Strategy

| Content | Method | Revalidation |
|---|---|---|
| Entity name, overview, H1, breadcrumb | SSR / ISR | 300s (tour detail) · 60s (listing pages) |
| About text, meta title/description | SSR / ISR | On-demand after admin write |
| FAQs | SSR / ISR | On-demand after admin write |
| Tour availability | Client-side fetch | On date-picker open only — never on page load |
| Booking widget | Client hydration (`requestIdleCallback` after LCP) | Per interaction |
| Static UI strings | Build-time (`next-intl`) | On deploy |
| Hreflang tags | SSR (`<head>`) | Per page |

Every entity page must output hreflang tags for all 7 locales plus `x-default → English`:

```html
<link rel="alternate" hreflang="en" href="/en/curacao/boat-tours/" />
<link rel="alternate" hreflang="nl" href="/nl/curacao/boat-tours/" />
<link rel="alternate" hreflang="es" href="/es/curacao/boat-tours/" />
<link rel="alternate" hreflang="de" href="/de/curacao/boat-tours/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/boat-tours/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/boat-tours/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/boat-tours/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />
```

---

## Admin Translation Workflow

Admins do not translate at creation time. The workflow is:

```
1. Create entity (English content only) → 201 response
2. Open Translations tab → GET /:id/translations → shows [] or existing rows
3. Select locale → fill fields → PATCH /:id/translations/:locale
4. Repeat for each locale
5. Open SEO tab → PATCH /:id/page-content/:locale (aboutText, metaTitle, metaDescription)
6. Open FAQs tab → POST /:id/faqs (one item per request, per locale)
```

For category and trip content, an "Auto-translate" button in the admin UI triggers the BullMQ job which fills the remaining 6 locales with `isMachineTranslated = true`. The admin can then review and manually override individual fields.

Destination and hub names are always set manually — the admin panel should not show an "Auto-translate" button for name fields on these entities.

---

## What is Implemented vs Planned

| Entity | Translation table | Page content table | FAQ | Status |
|---|---|---|---|---|
| Category | `category_translations` | `category_page_content` | `faqs` (pageType='category') | Done |
| Destination | `destination_translations` | `destination_page_content` | `faqs` (pageType='destination') | Done |
| Hub | `hub_translations` | `hub_page_content` | `faqs` (pageType='hub') | Phase 3 |
| Trip | `trip_translations` | — | `faqs` (pageType='tour') | Phase 4 |
| TourHighlight | `tour_highlight_translations` | — | — | Phase 4 |
| TourInclusion | `tour_inclusion_translations` | — | — | Phase 4 |
