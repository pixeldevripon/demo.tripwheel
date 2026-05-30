# Multilingual Content — Complete Developer Reference

> Merged from: `dynamic-multilangual.md` · `category-translation-flow.md` · `destination-translation-flow.md` · `hub-translation-flow.md`
>
> This document is the single authoritative reference for all dynamic multilingual content on the Island Tours platform. It covers architecture, data models, API contracts, backend service patterns, frontend rendering, and background jobs.

---

## Table of Contents

1. [Multilingual Architecture Overview](#1-multilingual-architecture-overview)
   - 1.1 Supported Locales and Currencies
   - 1.2 Locale Enum — DB-Native Enforcement
   - 1.3 Slug Registry — Locale-Agnostic URL Resolution
   - 1.4 URL Structure
2. [Translation Pattern — Per-Entity Typed Tables](#2-translation-pattern--per-entity-typed-tables)
   - 2.1 Why Not EAV
   - 2.2 What Is Used Instead
   - 2.3 Universal Translation Table Structure
   - 2.4 Implementation Status by Entity
3. [Shared Schema Pieces](#3-shared-schema-pieces)
   - 3.1 SEO Page Content — Separate Concern
   - 3.2 FAQ — Shared Polymorphic Table
   - 3.3 The `isMachineTranslated` Flag
4. [Category Translation Flow](#4-category-translation-flow)
   - 4.1 Data Model (4 tables per category)
   - 4.2 Create Transaction Side Effects
   - 4.3 Admin CRUD — Phase A: Creating a Category
   - 4.4 Admin CRUD — Phase B: Adding Translations
   - 4.5 Admin CRUD — Phase C: Adding SEO Page Content
   - 4.6 Admin CRUD — Phase D: Adding FAQs
   - 4.7 DB State After All Admin Steps
   - 4.8 Public Fetch — User-Facing Page
   - 4.9 Complete Request Map
   - 4.10 Full API Surface
5. [Destination Translation Flow](#5-destination-translation-flow)
   - 5.1 Key Differences from Categories
   - 5.2 Data Model (4 tables per destination)
   - 5.3 Create Transaction Side Effects
   - 5.4 Admin CRUD — Phase A: Creating a Destination
   - 5.5 Admin CRUD — Phase B: Adding Translations
   - 5.6 Admin CRUD — Phase C: Adding SEO Page Content
   - 5.7 Admin CRUD — Phase D: Adding FAQs
   - 5.8 DB State After All Admin Steps
   - 5.9 Public Fetch — User-Facing Page
   - 5.10 isActive Toggle — Slug Registry Propagation
   - 5.11 Complete Request Map
   - 5.12 Full API Surface
6. [Hub Translation Flow](#6-hub-translation-flow)
   - 6.1 Key Differences from Destinations and Categories
   - 6.2 Data Model (4 tables per hub)
   - 6.3 Create Transaction Side Effects
   - 6.4 Admin CRUD — Phase A: Creating a Hub
   - 6.5 Admin CRUD — Phase B: Adding Translations
   - 6.6 Admin CRUD — Phase C: Adding SEO Page Content
   - 6.7 Admin CRUD — Phase D: Adding FAQs and Managing Allowed Categories
   - 6.8 DB State After All Admin Steps
   - 6.9 Public Fetch — User-Facing Page
   - 6.10 Hub-Specific: allowedCategories Sub-Resource
   - 6.11 isActive Lifecycle and Seeded Guard
   - 6.12 Complete Request Map
   - 6.13 Full API Surface
7. [Fetch Pattern — Single Locale Query + Service Fallback](#7-fetch-pattern--single-locale-query--service-fallback)
   - 7.1 Query Strategy
   - 7.2 `applyTranslation` Helper
   - 7.3 Fallback Behaviour Table
   - 7.4 Upsert Pattern — Partial Field Updates
   - 7.5 Parallel Server Component Data Fetching
8. [Frontend Translation Form Patterns](#8-frontend-translation-form-patterns)
   - 8.1 Admin Translation Workflow (Overview)
   - 8.2 Upsert Payload Shape — Required `fields` Wrapper
   - 8.3 English Tab Special Rules
   - 8.4 Delete vs Clear
   - 8.5 Locale Tab Component Pattern
   - 8.6 Rendering Translated Fields
9. [AI Translation and Background Jobs](#9-ai-translation-and-background-jobs)
   - 9.1 AI Translation Rules by Content Type
   - 9.2 BullMQ Background Job (Phase 7)
   - 9.3 Array Fields — Highlights and Inclusions (Phase 4)
10. [On-Demand ISR Revalidation](#10-on-demand-isr-revalidation)
    - 10.1 Trigger Points
    - 10.2 Locale Loop Pattern
    - 10.3 Rendering Strategy Table
    - 10.4 Hreflang Tags

---

## 1. Multilingual Architecture Overview

### 1.1 Supported Locales and Currencies

| Code | Language   | Currency |
|------|------------|----------|
| `en` | English    | EUR (primary) |
| `nl` | Dutch      | EUR |
| `de` | German     | EUR |
| `fr` | French     | EUR |
| `es` | Spanish    | EUR |
| `pt` | Portuguese | EUR |
| `zh` | Chinese    | USD |

All 7 locales are active from launch.

### 1.2 Locale Enum — DB-Native Enforcement

The `Locale` enum is DB-native — enforced at the database level, not just in application code.

```prisma
// prisma/enums.prisma
enum Locale { en  es  nl  pt  fr  de  zh }
```

Import everywhere as:

```typescript
import { Locale } from '@/common/constants/locales'; // thin re-export of @prisma/client
```

Validate with `@IsEnum(Locale)` — never a plain string array. Any locale value outside this enum returns 400 Bad Request from ValidationPipe before the service layer is reached.

### 1.3 Slug Registry — Locale-Agnostic URL Resolution

Slugs are always English. The same slug is served at every locale prefix:

```
/en/curacao/boat-tours/   ✅
/nl/curacao/boat-tours/   ✅   ← slug unchanged, only locale prefix changes
/nl/curacao/boottochten/  ❌   ← translated slugs are never used
```

The slug registry table resolves the ambiguous `[slug]` URL segment (could be a category, hub, or tour):

```sql
slug_registry
  destination_slug  VARCHAR(100)   -- 'curacao'
  slug              VARCHAR(100)   -- 'boat-tours'
  entity_type       VARCHAR(20)    -- 'CATEGORY' | 'HUB' | 'TOUR' | 'RESERVED'
  entity_id         UUID nullable  -- NULL only for 'reserved'
  is_active         BOOLEAN        -- false = entity deactivated, page returns 404
  UNIQUE (destination_slug, slug)
```

`is_active = false` when an entity is disabled — the row stays (protects the slug), the page returns 404. Frontend slug resolver (`app/[locale]/[destination]/[slug]/page.tsx`) queries this table, then dispatches to the correct page component with the resolved `entityId` and requested `locale`.

### 1.4 URL Structure

| URL Pattern | Route File | Slug Registry Used? |
|---|---|---|
| `/{locale}/{destination}/` | `app/[locale]/[destination]/page.tsx` | No — destination slug is the segment itself |
| `/{locale}/{destination}/{slug}/` | `app/[locale]/[destination]/[slug]/page.tsx` | Yes — `[slug]` is ambiguous |

The destination page routes directly without a slug registry lookup. All sub-pages (category, hub, tour) require the registry to resolve entity type.

---

## 2. Translation Pattern — Per-Entity Typed Tables

### 2.1 Why Not EAV

An EAV table (`entity_type, entity_id, locale, field, value`) has no DB-level type safety, allows field name typos that create silent orphaned rows, and cannot enforce which fields belong to which entity. TypeScript cannot type it without casts.

### 2.2 What Is Used Instead

Each entity that has translatable content owns its own typed translation table. Fields are explicit columns — not a `field/value` pair.

```
Category         → CategoryTranslation         @@unique([categoryId, locale])
Destination      → DestinationTranslation      @@unique([destinationId, locale])
Hub              → HubTranslation              @@unique([hubId, locale])   (Phase 3)
Trip             → TripTranslation             @@unique([tripId, locale])  (Phase 4)
TourHighlight    → TourHighlightTranslation    (Phase 4)
TourInclusion    → TourInclusionTranslation    (Phase 4)
```

### 2.3 Universal Translation Table Structure

Every translation table follows the same structure. Category is shown as the canonical example:

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

The same shape applies to `DestinationTranslation` (foreign key `destinationId`) and `HubTranslation` (foreign key `hubId`). The `name` field is nullable in all translation tables — a `null` value signals fallback to the canonical English name on the base record.

### 2.4 Implementation Status by Entity

| Entity | Translation table | Page content table | FAQ | Status |
|---|---|---|---|---|
| Category | `category_translations` | `category_page_content` | `faqs` (pageType='category') | Done |
| Destination | `destination_translations` | `destination_page_content` | `faqs` (pageType='destination') | Done |
| Hub | `hub_translations` | `hub_page_content` | `faqs` (pageType='hub') | Phase 3 |
| Trip | `trip_translations` | — | `faqs` (pageType='tour') | Phase 4 |
| TourHighlight | `tour_highlight_translations` | — | — | Phase 4 |
| TourInclusion | `tour_inclusion_translations` | — | — | Phase 4 |

---

## 3. Shared Schema Pieces

### 3.1 SEO Page Content — Separate Concern

Editorial SEO content (`aboutText`, `metaTitle`, `metaDescription`) lives in its own table, separate from the core translations. This allows the SEO team to update meta tags without touching the translation workflow. All three entity types follow the same pattern:

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

Same pattern: `DestinationPageContent` (foreign key `destinationId`), `HubPageContent` (foreign key `hubId`).

Page content endpoints return an empty shape — not 404 — when no row exists. Missing content is valid state, not an error:

```typescript
return row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null };
```

### 3.2 FAQ — Shared Polymorphic Table

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

The service layer enforces that `entityId` belongs to the correct `pageType` before any write. `displayOrder` controls render sequence within a locale. FAQs return an empty array — not 404 — when no rows exist for a locale.

### 3.3 The `isMachineTranslated` Flag

Every translation row carries an `isMachineTranslated: Boolean` field. This flag is:

- `true` when content was written by the BullMQ AI translation job
- `false` when an admin wrote the content manually

The frontend renders a "Machine translated" badge when `isMachineTranslated: true`. The flag is always `false` for destinations and hubs because their names are proper nouns and are never AI-translated.

---

## 4. Category Translation Flow

### 4.1 Data Model (4 tables per category)

```
Category                      — canonical English base record
  id, name, slug, isActive, isSeeded, createdAt, updatedAt

CategoryTranslation           — one row per locale
  categoryId → Category (onDelete: Cascade)
  locale: Locale              — DB-enforced enum (en | es | nl | pt | fr | de | zh)
  name, overview, h1Override, breadcrumbLabel
  isMachineTranslated: Boolean
  @@unique([categoryId, locale])

CategoryPageContent           — one row per locale (SEO + editorial, separate concern)
  categoryId → Category (onDelete: Cascade)
  locale: Locale
  aboutText, metaTitle, metaDescription
  @@unique([categoryId, locale])

Faq                           — shared polymorphic table (not EAV — typed columns)
  pageType: 'category'        — discriminator
  entityId: categoryId        — UUID of owning category
  locale: Locale
  question, answer, displayOrder, isActive
```

### 4.2 Create Transaction Side Effects

Side-effects on category create (same transaction, never split):

```
FeaturedSlot  — 3 rows seeded (slotNumber: 1, 2, 3 — status: AVAILABLE — permanent, never deleted)
SlugRegistry  — 1 row per active destination (destinationSlug + categorySlug)
```

**FeaturedSlot rows are permanent.** Never DELETE them — only UPDATE `status`, `tripId`, `acquiredAt`, `expiresAt`. Every category always has exactly 3 rows. This invariant is established at creation and must not be broken.

**SlugRegistry rows are written for all active destinations.** When a new destination is later created, the destination creation transaction back-fills a CATEGORY slug_registry row for every existing active category.

### 4.3 Admin CRUD — Phase A: Creating a Category

**Step 1 — Admin submits the new category form**

Frontend renders one field: `name`. No slug field — slug is auto-generated by the backend.

```http
POST /api/v1/categories
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{ "name": "Boat Tours" }
```

**Step 2 — Guard chain runs (in order, every request)**

```
ThrottlerGuard      → rate limits: 20/s · 300/min · 3 000/hr → passes
AuthGuard           → reads session cookie → Better Auth validates → populates req.user
RolesGuard          → no @Roles() on this endpoint → skips
PermissionsGuard    → checks @RequirePermissions(CREATE_CATEGORY)
                      → found in req.user.permissions → passes
```

**Step 3 — ValidationPipe processes the body**

```typescript
// CreateCategoryDto
{ name: "Boat Tours" }
// IsString() ✓  MinLength(2) ✓  whitelist strips any unknown fields
```

**Step 4 — Controller delegates to service**

```typescript
// categories.controller.ts
create(@Body() dto: CreateCategoryDto, @AuthenticatedUser() user: TypedAuthUser) {
  return this.categoryService.create(dto, user.id);
}
```

**Step 5 — Service runs one Prisma transaction (4 DB operations)**

```typescript
// categories.service.ts → create()

const slug = generateSlug("Boat Tours");  // → "boat-tours"

await this.prisma.$transaction(async (tx) => {

  // 1. INSERT category
  const category = await tx.category.create({
    data: { name: "Boat Tours", slug: "boat-tours", createdBy: adminId },
    select: { id, name, slug, isActive, isSeeded, createdAt, updatedAt },
  });
  // Unique violation on slug → P2002 → caught → 409 ConflictException

  // 2. INSERT 3 FeaturedSlot rows (seeded once, never deleted)
  await tx.featuredSlot.createMany({
    data: [
      { categoryId: category.id, slotNumber: 1, status: 'AVAILABLE' },
      { categoryId: category.id, slotNumber: 2, status: 'AVAILABLE' },
      { categoryId: category.id, slotNumber: 3, status: 'AVAILABLE' },
    ],
  });

  // 3. Find all active destinations
  const destinations = await tx.destination.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  // e.g. [{ slug: 'curacao' }, { slug: 'aruba' }]

  // 4. INSERT one slug_registry row per destination
  await tx.slugRegistry.createMany({
    data: destinations.map(dest => ({
      destinationSlug: dest.slug,
      slug: 'boat-tours',
      entityType: 'CATEGORY',
      entityId: category.id,
    })),
  });
  // Result rows:
  //   (curacao, boat-tours, CATEGORY, abc-123)
  //   (aruba,   boat-tours, CATEGORY, abc-123)

  return category;
});
```

Any failure rolls back the entire transaction — no partial state is possible.

**Step 6 — Response to admin**

```json
HTTP 201 Created
{
  "id": "abc-123",
  "name": "Boat Tours",
  "slug": "boat-tours",
  "isActive": true,
  "isSeeded": false,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z"
}
```

State at this point:
- Category exists with English name as canonical
- 3 FeaturedSlots are ready for operators
- Slug registry seeded — `/en/curacao/boat-tours/` resolves correctly
- **No translation rows yet** — `?locale=nl` falls back to "Boat Tours" automatically

### 4.4 Admin CRUD — Phase B: Adding Translations

**Step 1 — Admin opens the Translations tab**

```http
GET /api/v1/categories/abc-123/translations
Cookie: better-auth.session_token=<token>
```

Response when no translations exist yet:
```json
[]
```

**Step 2 — Admin selects a locale and fills in the translation form**

```http
PATCH /api/v1/categories/abc-123/translations/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "fields": {
    "name": "Boottochten",
    "overview": "Ontdek de mooiste boottochten van het eiland.",
    "h1Override": "Boottochten op Curaçao",
    "breadcrumbLabel": "Boottochten"
  },
  "isMachineTranslated": false
}
```

Guard chain runs same as creation step, checks `EDIT_CATEGORY`.

**Step 3 — Service upserts the translation row**

```typescript
// categories.service.ts → upsertTranslations()

// Verify category exists first
await this.findCategoryOrThrow("abc-123");
// → SELECT ... WHERE id = 'abc-123'
// → Not found: 404 NotFoundException | Found: continues

await this.prisma.categoryTranslation.upsert({
  where: { categoryId_locale: { categoryId: "abc-123", locale: "nl" } },
  create: {
    categoryId: "abc-123",
    locale: "nl",
    name: "Boottochten",
    overview: "Ontdek de mooiste boottochten van het eiland.",
    h1Override: "Boottochten op Curaçao",
    breadcrumbLabel: "Boottochten",
    isMachineTranslated: false,
  },
  update: {
    isMachineTranslated: false,
    name: "Boottochten",
    overview: "Ontdek de mooiste boottochten van het eiland.",
    h1Override: "Boottochten op Curaçao",
    breadcrumbLabel: "Boottochten",
    // Only supplied fields written — omitted fields stay unchanged
  },
  select: { locale, name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
});
// First call  → INSERT (no row with locale=nl exists)
// Second call → UPDATE (@@unique match found)
```

**Step 4 — Response**

```json
HTTP 200 OK
{
  "locale": "nl",
  "name": "Boottochten",
  "overview": "Ontdek de mooiste boottochten van het eiland.",
  "h1Override": "Boottochten op Curaçao",
  "breadcrumbLabel": "Boottochten",
  "isMachineTranslated": false
}
```

Admin repeats for each locale: `es`, `pt`, `fr`, `de`, `zh`.

**Partial update (single field):**

```http
PATCH /api/v1/categories/abc-123/translations/nl
{
  "fields": {
    "overview": "Updated overview text only."
  }
}
```

Service `update` block writes only:
```typescript
update: {
  isMachineTranslated: false,
  overview: "Updated overview text only.",
  // name, h1Override, breadcrumbLabel → NOT in fields → NOT written → unchanged in DB
}
```

**Other translation management endpoints:**

```http
GET    /categories/:id/translations             → all locale rows (admin translation dashboard)
GET    /categories/:id/translations/:locale     → single locale row (pre-fill form)
DELETE /categories/:id/translations/:locale     → wipe entire locale (removes the row)
```

### 4.5 Admin CRUD — Phase C: Adding SEO Page Content

```http
PATCH /api/v1/categories/abc-123/page-content/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "aboutText": "Boottochten in Curaçao zijn een geweldige manier om het eiland te verkennen...",
  "metaTitle": "Beste Boottochten in Curaçao | Island Tours",
  "metaDescription": "Ontdek topbeoordeelde boottochten in Curaçao. Boek direct en bevestig in seconden."
}
```

Service upserts `CategoryPageContent`:

```typescript
await this.prisma.categoryPageContent.upsert({
  where: { categoryId_locale: { categoryId: "abc-123", locale: "nl" } },
  create: {
    categoryId: "abc-123",
    locale: "nl",
    aboutText: "...",
    metaTitle: "...",
    metaDescription: "...",
  },
  update: {
    aboutText: "...",
    metaTitle: "...",
    metaDescription: "...",
  },
  select: { locale, aboutText, metaTitle, metaDescription },
});
```

Managed separately from translations — editorial content can be updated independently on any cadence.

### 4.6 Admin CRUD — Phase D: Adding FAQs

```http
POST /api/v1/categories/abc-123/faqs
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "locale": "nl",
  "question": "Wat is inbegrepen in de rondvaart?",
  "answer": "Een zwemvest, snorkeluitrusting en een gids zijn inbegrepen.",
  "displayOrder": 0
}
```

Service inserts one row in the shared `Faq` table:

```typescript
await this.prisma.faq.create({
  data: {
    pageType: 'category',
    entityId: 'abc-123',
    locale: 'nl',
    question: "Wat is inbegrepen...",
    answer: "Een zwemvest...",
    displayOrder: 0,
  },
});
```

FAQ management endpoints:
```http
GET    /categories/:id/faqs                 → active FAQs (optional ?locale= filter)
POST   /categories/:id/faqs                 → create item
PATCH  /categories/:id/faqs/:faqId          → update question / answer / order / isActive
DELETE /categories/:id/faqs/:faqId          → hard delete
```

### 4.7 DB State After All Admin Steps

```
category (1 row)
  id: abc-123 | name: "Boat Tours" | slug: "boat-tours" | isActive: true

category_translations (7 rows — one per locale)
  (abc-123, en, "Boat Tours",     "Discover stunning...", ...)
  (abc-123, nl, "Boottochten",    "Ontdek...", ...)
  (abc-123, es, "Paseos en barco","Descubre...", ...)
  ...

category_page_content (7 rows — one per locale)
  (abc-123, en, "Boat tours in Curaçao...", "Best Boat Tours | Island Tours", ...)
  (abc-123, nl, "Boottochten in Curaçao...", "Beste Boottochten | Island Tours", ...)
  ...

faq (multiple rows per locale)
  (pageType: 'category', entityId: abc-123, locale: 'nl', "Wat is...", ...)
  (pageType: 'category', entityId: abc-123, locale: 'en', "What is...", ...)
  ...

slug_registry (1 row per active destination)
  (curacao, boat-tours, CATEGORY, abc-123, isActive: true)
  (aruba,   boat-tours, CATEGORY, abc-123, isActive: true)

featured_slots (3 rows — permanent, never deleted)
  (abc-123, slotNumber: 1, status: AVAILABLE)
  (abc-123, slotNumber: 2, status: AVAILABLE)
  (abc-123, slotNumber: 3, status: AVAILABLE)
```

### 4.8 Public Fetch — User-Facing Page

A Dutch-speaking traveler visits: `https://islandtours.com/nl/curacao/boat-tours/`

**Step 1 — next-intl middleware runs first**

```typescript
// middleware.ts
createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',
})
```

Parses URL → extracts `locale = "nl"`, `destination = "curacao"`, `slug = "boat-tours"`.

**Step 2 — Slug registry lookup**

```http
GET /api/v1/slug-registry?destination=curacao&slug=boat-tours
```

Backend queries:
```sql
SELECT entity_type, entity_id, is_active
FROM slug_registry
WHERE destination_slug = 'curacao' AND slug = 'boat-tours'
```

Returns: `{ entityType: 'CATEGORY', entityId: 'abc-123', isActive: true }`

- `isActive = false` → `notFound()` → Next.js renders 404
- Row missing entirely → `notFound()`

**Step 3 — Router dispatches to the correct page component**

```typescript
switch (entity.entityType) {
  case 'CATEGORY': return <CategoryPage categoryId="abc-123" locale="nl" />;
  case 'HUB':      return <HubPage hubId={entity.entityId} locale={locale} />;
  case 'TOUR':     return <TourDetailPage tourId={entity.entityId} locale={locale} />;
  case 'RESERVED': redirect(`/${locale}/${destination}/tours/`);
  default:         notFound();
}
```

**Step 4 — CategoryPage fires 3 parallel backend calls**

```typescript
const [category, pageContent, faqs] = await Promise.all([
  fetch(`/api/v1/categories/abc-123?locale=nl`),
  fetch(`/api/v1/categories/abc-123/page-content?locale=nl`),
  fetch(`/api/v1/categories/abc-123/faqs?locale=nl`),
]);
```

**Step 5 — Backend: Call 1 (category detail)**

```typescript
// categories.service.ts → getById("abc-123", "nl")

const category = await this.prisma.category.findUnique({
  where: { id: "abc-123" },
  select: {
    id, name, slug, isActive, isSeeded, createdAt, updatedAt,
    translations: {
      where: { locale: "nl" },
      select: { name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
    },
  },
});

const t = category.translations[0];

return {
  ...applyTranslation(category, t, "nl"),
  overview:        t?.overview        ?? null,
  h1Override:      t?.h1Override      ?? null,
  breadcrumbLabel: t?.breadcrumbLabel ?? null,
};
```

Response:
```json
{
  "id": "abc-123",
  "name": "Boottochten",
  "slug": "boat-tours",
  "locale": "nl",
  "isMachineTranslated": false,
  "overview": "Ontdek de mooiste boottochten van het eiland.",
  "h1Override": "Boottochten op Curaçao",
  "breadcrumbLabel": "Boottochten",
  "isActive": true,
  "isSeeded": false
}
```

**Step 6 — Backend: Call 2 (page content)**

```typescript
const row = await this.prisma.categoryPageContent.findUnique({
  where: { categoryId_locale: { categoryId: "abc-123", locale: "nl" } },
  select: { locale, aboutText, metaTitle, metaDescription },
});

return row ?? { locale: "nl", aboutText: null, metaTitle: null, metaDescription: null };
```

**Step 7 — Backend: Call 3 (FAQs)**

```typescript
await this.prisma.faq.findMany({
  where: {
    pageType: 'category',
    entityId: "abc-123",
    isActive: true,
    locale: "nl",
  },
  select: { id, question, answer, displayOrder, isActive, locale },
  orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
});
```

**Step 8 — CategoryPage renders the full HTML**

```typescript
// <head>
<title>{pageContent.metaTitle ?? `${category.name} | Island Tours`}</title>
<meta name="description" content={pageContent.metaDescription ?? ''} />

// hreflang for all 7 locales + x-default → English
<link rel="alternate" hreflang="nl" href="/nl/curacao/boat-tours/" />
<link rel="alternate" hreflang="en" href="/en/curacao/boat-tours/" />
<link rel="alternate" hreflang="es" href="/es/curacao/boat-tours/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />

// <body>
<nav>Home › Curaçao › {category.breadcrumbLabel ?? category.name}</nav>
//                      → "Boottochten"

<h1>{category.h1Override ?? generateH1(category.name)}</h1>
//   → "Boottochten op Curaçao"

<p>{category.overview}</p>
//   → "Ontdek de mooiste boottochten van het eiland."

<section id="about">
  {pageContent.aboutText && <p>{pageContent.aboutText}</p>}
</section>

<section id="faqs">
  {faqs.map(faq => <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />)}
</section>
```

**Locale fallback rules:**

| Scenario | `category.name` returned | Extra fields |
|---|---|---|
| `nl` translation row exists, `name` set | `"Boottochten"` | as stored |
| `nl` translation row exists, `name` is `null` | `"Boat Tours"` (canonical) | `overview` etc. as stored (may also be null) |
| No `nl` translation row at all | `"Boat Tours"` (canonical) | all `null` |
| Locale not in enum (e.g. `?locale=xx`) | — | 400 Bad Request from ValidationPipe |

Frontend convention:
- `name` always has a value (canonical fallback guarantees it)
- `h1Override`, `breadcrumbLabel`, `overview` → hide the section or use a generated default when `null`
- `isMachineTranslated: true` → show a "Machine translated" badge in UI

### 4.9 Complete Request Map

```
Browser
  → middleware.ts
      extracts: locale=nl, destination=curacao, slug=boat-tours
  → app/[locale]/[destination]/[slug]/page.tsx
      → GET /slug-registry?destination=curacao&slug=boat-tours
            DB: slug_registry WHERE destination_slug='curacao' AND slug='boat-tours'
            → { entityType: CATEGORY, entityId: abc-123, isActive: true }
      → <CategoryPage categoryId="abc-123" locale="nl">
            ┌─ GET /categories/abc-123?locale=nl
            │     DB: category
            │       + LEFT JOIN category_translations WHERE categoryId='abc-123' AND locale='nl'
            │     → merged: name, overview, h1Override, breadcrumbLabel, isMachineTranslated
            │
            ├─ GET /categories/abc-123/page-content?locale=nl
            │     DB: category_page_content WHERE categoryId='abc-123' AND locale='nl'
            │     → aboutText, metaTitle, metaDescription (or empty shape if no row)
            │
            └─ GET /categories/abc-123/faqs?locale=nl
                  DB: faq WHERE pageType='category' AND entityId='abc-123'
                               AND locale='nl' AND isActive=true
                  → ordered FAQ array
      → render HTML combining all 3 responses
```

### 4.10 Full API Surface

```
Public (no auth required)
  GET  /categories                            paginated list with locale filter
  GET  /categories/active                     dropdown list for tour wizard / nav
  GET  /categories/slug/:slug                 detail by slug + locale
  GET  /categories/:id                        detail by id + locale
  GET  /categories/:id/page-content           aboutText, metaTitle, metaDescription
  GET  /categories/:id/faqs                   active FAQs (optional ?locale= filter)

Admin (EDIT_CATEGORY / CREATE_CATEGORY / DELETE_CATEGORY permission required)
  POST   /categories                          create + seed slots + seed slug_registry
  PATCH  /categories/:id                      update name / isActive
  DELETE /categories/:id                      soft-delete (blocked if seeded or has trips)

  GET    /categories/:id/translations         all locale translation rows
  GET    /categories/:id/translations/:locale single locale (pre-fill edit form)
  PATCH  /categories/:id/translations/:locale create or partially update a locale
  DELETE /categories/:id/translations/:locale wipe entire locale row

  PATCH  /categories/:id/page-content/:locale create or partially update SEO content

  POST   /categories/:id/faqs                create FAQ item
  PATCH  /categories/:id/faqs/:faqId         update question / answer / order / isActive
  DELETE /categories/:id/faqs/:faqId         hard delete FAQ item
```

---

## 5. Destination Translation Flow

### 5.1 Key Differences from Categories

| Aspect | Category | Destination |
|---|---|---|
| Slug registry | 1 row per active destination | Not applicable — destination IS the top-level URL segment |
| Featured slots | 3 seeded per category | Not applicable |
| Create transaction side effects | FeaturedSlots + SlugRegistry rows | RESERVED 'tours' slug + CATEGORY SlugRegistry rows |
| Translation of name | AI-translated to 6 locales | **Never AI-translated — proper nouns (Curaçao, Aruba). Admin sets manually** |
| User-facing URL | `/{locale}/{destination}/{slug}/` resolved via slug_registry | `/{locale}/{destination}/` — direct route, no slug_registry lookup needed |
| `isMachineTranslated` | Can be true | Always false |

### 5.2 Data Model (4 tables per destination)

```
Destination                   — canonical English base record
  id, name, slug, heroImage, isActive, isSeeded, createdBy, createdAt, updatedAt

DestinationTranslation        — one row per locale
  destinationId → Destination (onDelete: Cascade)
  locale: Locale              — DB-enforced enum (en | es | nl | pt | fr | de | zh)
  name, overview, h1Override, breadcrumbLabel
  isMachineTranslated: Boolean  — always false for destinations (proper nouns)
  @@unique([destinationId, locale])

DestinationPageContent        — one row per locale (SEO + editorial, separate concern)
  destinationId → Destination (onDelete: Cascade)
  locale: Locale
  aboutText, metaTitle, metaDescription
  @@unique([destinationId, locale])

Faq                           — shared polymorphic table (not EAV — typed columns)
  pageType: 'destination'     — discriminator
  entityId: destinationId     — UUID of owning destination
  locale: Locale
  question, answer, displayOrder, isActive
```

### 5.3 Create Transaction Side Effects

Side-effects on destination create (same transaction):

```
SlugRegistry  — 1 RESERVED row: (destinationSlug='curacao', slug='tours', entityType=RESERVED)
              — 1 CATEGORY row per existing active category:
                (destinationSlug='curacao', slug='boat-tours', entityType=CATEGORY, entityId=<catId>)
```

The RESERVED 'tours' row protects the `/{locale}/{destination}/tours/` URL. Without this row, the slug could be claimed by a hub or tour with the slug "tours". No destination page has a URL conflict because the destination slug itself is the second path segment.

### 5.4 Admin CRUD — Phase A: Creating a Destination

**Step 1 — Admin submits the new destination form**

Frontend renders two fields: `name` (required) and `heroImage` (optional URL). No slug field.

```http
POST /api/v1/destinations
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{ "name": "Aruba" }
```

Guard chain checks `CREATE_DESTINATION`.

**Step 2 — Service runs one Prisma transaction (4 DB operations)**

```typescript
// destinations.service.ts → create()

const slug = generateSlug("Aruba");  // → "aruba"

await this.prisma.$transaction(async (tx) => {

  // 1. INSERT destination
  const destination = await tx.destination.create({
    data: { name: "Aruba", slug: "aruba", heroImage: null, createdBy: adminId },
    select: { id: true, slug: true },
  });
  // Unique violation on slug → P2002 → caught → 409 ConflictException

  // 2. INSERT 1 RESERVED slug_registry row (protects /{destination}/tours/ URL)
  await tx.slugRegistry.create({
    data: {
      destinationSlug: "aruba",
      slug: "tours",
      entityType: SlugEntityType.RESERVED,
      entityId: null,
    },
  });

  // 3. Find all existing active categories
  const categories = await tx.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });
  // e.g. [{ slug: 'boat-tours', id: 'abc-123' }, { slug: 'sunset-cruises', id: 'def-456' }]

  // 4. INSERT one CATEGORY slug_registry row per existing active category
  if (categories.length > 0) {
    await tx.slugRegistry.createMany({
      data: categories.map(cat => ({
        destinationSlug: "aruba",
        slug: cat.slug,
        entityType: SlugEntityType.CATEGORY,
        entityId: cat.id,
      })),
    });
  }
  // Result rows:
  //   (aruba, tours,          RESERVED, null)
  //   (aruba, boat-tours,     CATEGORY, abc-123)
  //   (aruba, sunset-cruises, CATEGORY, def-456)

  const result = await tx.destination.findUniqueOrThrow({
    where: { id: destination.id },
    select: destinationSelect,
  });

  return result;
});
```

**Step 3 — Response to admin**

```json
HTTP 201 Created
{
  "id": "xyz-789",
  "name": "Aruba",
  "slug": "aruba",
  "heroImage": null,
  "isSeeded": false,
  "isActive": true,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z"
}
```

State at this point:
- Destination exists with English name as canonical
- RESERVED 'tours' slug locked — `/en/aruba/tours/` resolves to "All Tours" page
- All existing categories are immediately routable under Aruba: `/en/aruba/boat-tours/`
- **No translation rows yet** — `?locale=nl` falls back to `"Aruba"` automatically

### 5.5 Admin CRUD — Phase B: Adding Translations

```http
GET /api/v1/destinations/xyz-789/translations
```

Response when no translations exist: `[]`

```http
PATCH /api/v1/destinations/xyz-789/translations/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "fields": {
    "name": "Aruba",
    "overview": "Aruba is een zonnig eiland in het zuidelijke Caribisch gebied, bekend om zijn witte stranden.",
    "h1Override": "Rondleidingen & Activiteiten op Aruba",
    "breadcrumbLabel": "Aruba"
  },
  "isMachineTranslated": false
}
```

> **Rule:** Destination names are proper nouns — `isMachineTranslated` must always be `false`. The name field often stays identical across all locales (e.g. "Aruba" is "Aruba" in every language).

Guard chain checks `EDIT_DESTINATION`.

Service upserts:

```typescript
// destinations.service.ts → upsertTranslations()

await this.findDestinationOrThrow("xyz-789");

const { fields, isMachineTranslated = false } = dto;

await this.prisma.destinationTranslation.upsert({
  where: { destinationId_locale: { destinationId: "xyz-789", locale: "nl" } },
  create: {
    destinationId: "xyz-789",
    locale: "nl",
    name: "Aruba",
    overview: "Aruba is een zonnig eiland...",
    h1Override: "Rondleidingen & Activiteiten op Aruba",
    breadcrumbLabel: "Aruba",
    isMachineTranslated: false,
  },
  update: {
    isMachineTranslated: false,
    name: "Aruba",
    overview: "Aruba is een zonnig eiland...",
    h1Override: "Rondleidingen & Activiteiten op Aruba",
    breadcrumbLabel: "Aruba",
    // Only supplied fields written — omitted fields stay unchanged
  },
  select: { locale, name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
});
// First call  → INSERT (no row with locale=nl exists)
// Second call → UPDATE (@@unique match on destinationId_locale found)
```

Response:
```json
HTTP 200 OK
{
  "locale": "nl",
  "name": "Aruba",
  "overview": "Aruba is een zonnig eiland in het zuidelijke Caribisch gebied...",
  "h1Override": "Rondleidingen & Activiteiten op Aruba",
  "breadcrumbLabel": "Aruba",
  "isMachineTranslated": false
}
```

Admin repeats for each locale: `es`, `pt`, `fr`, `de`, `zh`, `en`.

Other translation management endpoints:

```http
GET    /destinations/:id/translations             → all locale rows (admin translation dashboard)
GET    /destinations/:id/translations/:locale     → single locale row (pre-fill form)
DELETE /destinations/:id/translations/:locale     → wipe entire locale (removes the row)
```

### 5.6 Admin CRUD — Phase C: Adding SEO Page Content

```http
PATCH /api/v1/destinations/xyz-789/page-content/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "aboutText": "Aruba is een van de mooiste eilanden van het Caribisch gebied, met perfecte weersomstandigheden het hele jaar door...",
  "metaTitle": "Beste Rondleidingen & Activiteiten op Aruba | Island Tours",
  "metaDescription": "Ontdek topbeoordeelde boottochten, snorkeltrips en eilandactiviteiten op Aruba. Boek direct en bevestig in seconden."
}
```

Service upserts `DestinationPageContent`:

```typescript
await this.prisma.destinationPageContent.upsert({
  where: { destinationId_locale: { destinationId: "xyz-789", locale: "nl" } },
  create: {
    destinationId: "xyz-789",
    locale: "nl",
    aboutText: "Aruba is een van de mooiste eilanden...",
    metaTitle: "Beste Rondleidingen & Activiteiten op Aruba | Island Tours",
    metaDescription: "Ontdek topbeoordeelde boottochten...",
  },
  update: {
    aboutText: "Aruba is een van de mooiste eilanden...",
    metaTitle: "Beste Rondleidingen & Activiteiten op Aruba | Island Tours",
    metaDescription: "Ontdek topbeoordeelde boottochten...",
  },
  select: { locale, aboutText, metaTitle, metaDescription },
});
```

### 5.7 Admin CRUD — Phase D: Adding FAQs

```http
POST /api/v1/destinations/xyz-789/faqs
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "locale": "nl",
  "question": "Wat is de beste tijd om Aruba te bezoeken?",
  "answer": "Aruba heeft het hele jaar door goed weer, maar januari–juni biedt de rustigste zee.",
  "displayOrder": 0
}
```

Service inserts in the shared `Faq` table:

```typescript
await this.prisma.faq.create({
  data: {
    pageType: 'destination',
    entityId: 'xyz-789',
    locale: 'nl',
    question: "Wat is de beste tijd om Aruba te bezoeken?",
    answer: "Aruba heeft het hele jaar door goed weer...",
    displayOrder: 0,
  },
});
```

FAQ management endpoints:

```http
GET    /destinations/:id/faqs                 → active FAQs (optional ?locale= filter)
POST   /destinations/:id/faqs                 → create item
PATCH  /destinations/:id/faqs/:faqId          → update question / answer / order / isActive
DELETE /destinations/:id/faqs/:faqId          → hard delete
```

### 5.8 DB State After All Admin Steps

```
destinations (1 row)
  id: xyz-789 | name: "Aruba" | slug: "aruba" | heroImage: null | isActive: true

destination_translations (7 rows — one per locale)
  (xyz-789, en, "Aruba",  "Aruba is a sun-drenched island...",          ...)
  (xyz-789, nl, "Aruba",  "Aruba is een zonnig eiland...",              ...)
  (xyz-789, es, "Aruba",  "Aruba es una isla soleada en el Caribe...", ...)
  (xyz-789, fr, "Aruba",  "Aruba est une île ensoleillée des Caraïbes...", ...)
  (xyz-789, de, "Aruba",  "Aruba ist eine sonnige Insel in der Karibik...", ...)
  (xyz-789, pt, "Aruba",  "Aruba é uma ilha ensolarada no Caribe...", ...)
  (xyz-789, zh, "阿鲁巴",  "阿鲁巴是加勒比海南部的一个阳光岛屿...",         ...)

destination_page_content (7 rows — one per locale)
  (xyz-789, en, "Aruba is one of the most beautiful islands...",   "Best Tours in Aruba | Island Tours", ...)
  (xyz-789, nl, "Aruba is een van de mooiste eilanden...",         "Beste Rondleidingen op Aruba | Island Tours", ...)
  ...

faq (multiple rows per locale)
  (pageType: 'destination', entityId: xyz-789, locale: 'nl', "Wat is de beste tijd...", ...)
  (pageType: 'destination', entityId: xyz-789, locale: 'en', "What is the best time...", ...)
  ...

slug_registry (seeded at destination create)
  (aruba, tours,          RESERVED, null,    isActive: true)
  (aruba, boat-tours,     CATEGORY, abc-123, isActive: true)
  (aruba, sunset-cruises, CATEGORY, def-456, isActive: true)
```

### 5.9 Public Fetch — User-Facing Page

A Dutch-speaking traveler visits: `https://islandtours.com/nl/aruba/`

**Step 1 — next-intl middleware** extracts `locale = "nl"`, `destination = "aruba"`.

**Step 2 — Next.js hits the destination route handler**

```typescript
// app/[locale]/[destination]/page.tsx
export default async function DestinationPage({ params }) {
  const { locale, destination } = params;
  // locale = 'nl', destination = 'aruba'
```

> **No slug-registry lookup here.** The destination slug IS the URL segment — Next.js routes directly to this file. Slug-registry is only used for `/{locale}/{destination}/{slug}/` (category / hub / tour pages).

**Step 3 — DestinationPage fires 3 parallel backend calls**

```typescript
const [destination, pageContent, faqs] = await Promise.all([
  fetch(`/api/v1/destinations/slug/aruba?locale=nl`),
  fetch(`/api/v1/destinations/${destinationId}/page-content?locale=nl`),
  fetch(`/api/v1/destinations/${destinationId}/faqs?locale=nl`),
]);
```

**Step 4 — Backend: Call 1 (destination detail by slug)**

```typescript
// destinations.service.ts → getBySlug("aruba", "nl")

const destination = await this.prisma.destination.findUnique({
  where: { slug: "aruba" },
  select: {
    id, name, slug, heroImage, isSeeded, isActive, createdAt, updatedAt,
    translations: {
      where: { locale: "nl" },
      select: { name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
    },
  },
});

const { translations, ...dest } = destination;
const t = translations[0];

return {
  ...applyTranslation(dest, t, "nl"),
  overview:        t?.overview        ?? null,
  h1Override:      t?.h1Override      ?? null,
  breadcrumbLabel: t?.breadcrumbLabel ?? null,
};
```

Response:
```json
{
  "id": "xyz-789",
  "name": "Aruba",
  "slug": "aruba",
  "heroImage": "https://cdn.example.com/aruba-hero.jpg",
  "locale": "nl",
  "isMachineTranslated": false,
  "overview": "Aruba is een zonnig eiland in het zuidelijke Caribisch gebied...",
  "h1Override": "Rondleidingen & Activiteiten op Aruba",
  "breadcrumbLabel": "Aruba",
  "isActive": true,
  "isSeeded": true
}
```

**Step 5 — DestinationPage renders the full HTML**

```typescript
// <head>
<title>{pageContent.metaTitle ?? `${destination.name} | Island Tours`}</title>
<meta name="description" content={pageContent.metaDescription ?? ''} />

// hreflang for all 7 locales + x-default → English
<link rel="alternate" hreflang="nl" href="/nl/aruba/" />
<link rel="alternate" hreflang="en" href="/en/aruba/" />
<link rel="alternate" hreflang="es" href="/es/aruba/" />
<link rel="alternate" hreflang="de" href="/de/aruba/" />
<link rel="alternate" hreflang="fr" href="/fr/aruba/" />
<link rel="alternate" hreflang="pt" href="/pt/aruba/" />
<link rel="alternate" hreflang="zh" href="/zh/aruba/" />
<link rel="alternate" hreflang="x-default" href="/en/aruba/" />

// <body>
<nav>Home › {destination.breadcrumbLabel ?? destination.name}</nav>
//           → "Aruba"

<h1>{destination.h1Override ?? destination.name}</h1>
//   → "Rondleidingen & Activiteiten op Aruba"

<p>{destination.overview}</p>
//   → "Aruba is een zonnig eiland in het zuidelijke Caribisch gebied..."

<section id="about">
  {pageContent.aboutText && <p>{pageContent.aboutText}</p>}
</section>

<section id="faqs">
  {faqs.map(faq => <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />)}
</section>
```

**Locale fallback rules:**

| Scenario | `destination.name` returned | Extra fields |
|---|---|---|
| `nl` translation row exists, `name` set | `"Aruba"` (or localized if different) | as stored |
| `nl` translation row exists, `name` is `null` | `"Aruba"` (canonical) | `overview` etc. as stored (may also be null) |
| No `nl` translation row at all | `"Aruba"` (canonical) | all `null` |
| Locale not in enum (e.g. `?locale=xx`) | — | 400 Bad Request from ValidationPipe |

Frontend convention:
- `name` always has a value (canonical fallback guarantees it)
- `h1Override`, `breadcrumbLabel`, `overview` → hide the section or use a generated default when `null`
- `isMachineTranslated` is always `false` for destinations (proper nouns — never AI-translated)

**List queries (nav / dropdown):**

```typescript
// destinations.service.ts → getActive("nl")

const data = await this.prisma.destination.findMany({
  where: { isActive: true },
  select: {
    id, name, slug, heroImage, isSeeded, isActive, createdAt, updatedAt,
    translations: {
      where: { locale: "nl" },
      select: { name: true, isMachineTranslated: true },  // only name needed for lists
    },
  },
  orderBy: { name: 'asc' },
});

return data.map(({ translations, ...dest }) =>
  applyTranslation(dest, translations[0], "nl"),
);
```

Single query — no N+1.

### 5.10 isActive Toggle — Slug Registry Propagation

When admin calls `PATCH /destinations/xyz-789 { "isActive": false }`:

```typescript
// destinations.service.ts → update()

await tx.slugRegistry.updateMany({
  where: { destinationSlug: "aruba" },
  data: { isActive: false },
});
```

All slug_registry rows for this destination flip to `isActive: false`. Any attempt to visit `/*/aruba/boat-tours/` returns 404 from the slug resolver. The destination page `/*/aruba/` also returns 404 (frontend checks `destination.isActive` before rendering).

### 5.11 Complete Request Map

```
Browser
  → middleware.ts
      extracts: locale=nl, destination=aruba
  → app/[locale]/[destination]/page.tsx
      (no slug-registry lookup — destination is the top-level URL segment)
      → <DestinationPage destinationSlug="aruba" locale="nl">
            ┌─ GET /destinations/slug/aruba?locale=nl
            │     DB: destinations
            │       + LEFT JOIN destination_translations
            │           WHERE destinationId='xyz-789' AND locale='nl'
            │     → merged: name, overview, h1Override, breadcrumbLabel, isMachineTranslated
            │
            ├─ GET /destinations/xyz-789/page-content?locale=nl
            │     DB: destination_page_content
            │           WHERE destinationId='xyz-789' AND locale='nl'
            │     → aboutText, metaTitle, metaDescription (or empty shape if no row)
            │
            └─ GET /destinations/xyz-789/faqs?locale=nl
                  DB: faq WHERE pageType='destination' AND entityId='xyz-789'
                               AND locale='nl' AND isActive=true
                  → ordered FAQ array
      → render HTML combining all 3 responses
```

### 5.12 Full API Surface

```
Public (no auth required)
  GET  /destinations                              paginated list with locale filter
  GET  /destinations/active                       dropdown list for nav / tour wizard
  GET  /destinations/slug/:slug                   detail by slug + locale (primary frontend call)
  GET  /destinations/:id                          detail by UUID + locale
  GET  /destinations/:id/page-content             aboutText, metaTitle, metaDescription
  GET  /destinations/:id/faqs                     active FAQs (optional ?locale= filter)

Admin (EDIT_DESTINATION / CREATE_DESTINATION / DELETE_DESTINATION permission required)
  POST   /destinations                            create + seed RESERVED slug + seed CATEGORY slugs
  PATCH  /destinations/:id                        update name / heroImage / isActive
  DELETE /destinations/:id                        soft-delete (blocked if seeded or has trips)

  GET    /destinations/:id/translations           all locale translation rows
  GET    /destinations/:id/translations/:locale   single locale (pre-fill edit form)
  PATCH  /destinations/:id/translations/:locale   create or partially update a locale
  DELETE /destinations/:id/translations/:locale   wipe entire locale row

  PATCH  /destinations/:id/page-content/:locale   create or partially update SEO content

  POST   /destinations/:id/faqs                   create FAQ item
  PATCH  /destinations/:id/faqs/:faqId            update question / answer / order / isActive
  DELETE /destinations/:id/faqs/:faqId            hard delete FAQ item
```

---

## 6. Hub Translation Flow

### 6.1 Key Differences from Destinations and Categories

| Aspect | Category | Destination | Hub |
|---|---|---|---|
| Slug uniqueness | Global | Global | **Per destination** — `@@unique([destinationId, slug])` |
| Slug registry on create | 1 row per active destination (CATEGORY type) | RESERVED 'tours' + CATEGORY rows per existing category | **1 row for its own destination** (HUB type) |
| Featured slots | 3 seeded per category | Not applicable | Not applicable |
| Translation of name | AI-translated to 6 locales | Never — proper noun | **Never — proper noun (Klein Curaçao). Admin sets manually** |
| `isMachineTranslated` | Can be true | Always false | Always false |
| Slug lookup query | `slug` only | Not applicable | **`slug` + `destinationSlug`** — required because hub slugs are not globally unique |
| User-facing URL | `/{locale}/{destination}/{slug}/` via slug_registry (CATEGORY) | `/{locale}/{destination}/` — direct route | **`/{locale}/{destination}/{slug}/` via slug_registry (HUB)** |
| Extra sub-resource | — | — | **`allowedCategories`** — which tour categories operators can assign to trips in this hub |
| Canonical description | — | — | `Hub.description` (English) + `HubTranslation.overview` (translated) |
| Hub-anchored tour slugs | — | — | Tours with `hubId` set get **no** slug_registry row (they live under the hub's URL space) |

### 6.2 Data Model (4 tables per hub)

```
Hub                           — canonical English base record
  id, destinationId, name, slug, description, isActive, isSeeded, createdBy, createdAt, updatedAt
  @@unique([destinationId, slug])   ← slug unique per destination, NOT globally

HubTranslation                — one row per locale
  hubId → Hub (onDelete: Cascade)
  locale: Locale              — DB-enforced enum (en | es | nl | pt | fr | de | zh)
  name, overview, h1Override, breadcrumbLabel
  isMachineTranslated: Boolean  — always false for hubs (proper nouns)
  @@unique([hubId, locale])

HubPageContent                — one row per locale (SEO + editorial, separate concern)
  hubId → Hub (onDelete: Cascade)
  locale: Locale
  aboutText, metaTitle, metaDescription
  @@unique([hubId, locale])

Faq                           — shared polymorphic table (not EAV — typed columns)
  pageType: 'hub'             — discriminator
  entityId: hubId             — UUID of owning hub
  locale: Locale
  question, answer, displayOrder, isActive
```

Note on description vs overview: `Hub.description` is the canonical English short description on the base Hub model. `HubTranslation.overview` is the translated editorial text. Both can appear on the hub page simultaneously — description renders from the base record; overview renders from the translation row.

### 6.3 Create Transaction Side Effects

Side-effects on hub create (same transaction):

```
SlugRegistry  — 1 HUB row for the hub's destination:
                (destinationSlug='curacao', slug='klein-curacao', entityType=HUB, entityId=<hubId>)

HubAllowedCategory (optional) — 0 or more rows if allowedCategoryIds supplied at creation:
                (hubId=<hubId>, categoryId=<catId>)
```

> **Rule:** Tours assigned to this hub (`hubId` set on Trip) do NOT write their own slug_registry row. Their URL is served from the hub's slug namespace via the hub page itself. This is a hard invariant — never add slug_registry rows for hub-anchored trips.

### 6.4 Admin CRUD — Phase A: Creating a Hub

**Step 1 — Admin submits the new hub form**

Frontend renders: `destinationId` (required dropdown), `name` (required), `description` (optional), `allowedCategoryIds` (optional multi-select). No slug field — auto-generated.

```http
POST /api/v1/hubs
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "destinationId": "dst-001",
  "name": "Klein Curaçao",
  "description": "A small uninhabited island off the south-east coast of Curaçao.",
  "allowedCategoryIds": ["cat-abc", "cat-def"]
}
```

Guard chain checks `MANAGE_HUBS`.

**Step 2 — ValidationPipe processes the body**

```typescript
// CreateHubDto
{
  destinationId: "dst-001",  // IsUUID() ✓
  name: "Klein Curaçao",     // IsString() ✓  MinLength(2) ✓
  description: "...",        // IsOptional() IsString() ✓
  allowedCategoryIds: ["cat-abc", "cat-def"],  // IsArray() IsUUID each ✓
}
// whitelist strips any unknown fields
```

**Step 3 — Service runs one Prisma transaction (4 DB operations)**

```typescript
// hubs.service.ts → create()

const slug = generateSlug("Klein Curaçao");  // → "klein-curacao"

await this.prisma.$transaction(async (tx) => {

  // 1. Verify destination exists and fetch its slug for slug_registry
  const destination = await tx.destination.findUnique({
    where: { id: "dst-001" },
    select: { slug: true },
  });
  if (!destination) throw new NotFoundException("Destination dst-001 not found");
  // destination.slug = "curacao"

  // 2. INSERT the hub
  const hub = await tx.hub.create({
    data: {
      destinationId: "dst-001",
      name: "Klein Curaçao",
      slug: "klein-curacao",
      description: "A small uninhabited island...",
      createdBy: adminId,
    },
    select: { id: true },
  });
  // Unique violation on (destinationId, slug) → P2002 → caught → 409 ConflictException

  // 3. INSERT 1 HUB slug_registry row for this hub's destination
  await tx.slugRegistry.create({
    data: {
      destinationSlug: "curacao",
      slug: "klein-curacao",
      entityType: SlugEntityType.HUB,
      entityId: hub.id,
    },
  });
  // (curacao, klein-curacao, HUB, hub-001)
  // Slug collision → P2002 → caught → 409 ConflictException

  // 4. Seed initial allowed categories if provided
  if (dto.allowedCategoryIds && dto.allowedCategoryIds.length > 0) {
    await tx.hubAllowedCategory.createMany({
      data: dto.allowedCategoryIds.map(categoryId => ({ hubId: hub.id, categoryId })),
      skipDuplicates: true,
    });
  }
  // hub_allowed_categories rows:
  //   (hub-001, cat-abc)
  //   (hub-001, cat-def)

  return tx.hub.findUniqueOrThrow({
    where: { id: hub.id },
    select: hubDetailSelect,  // includes allowedCategories
  });
});
```

**Step 4 — Response to admin**

```json
HTTP 201 Created
{
  "id": "hub-001",
  "destinationId": "dst-001",
  "name": "Klein Curaçao",
  "slug": "klein-curacao",
  "description": "A small uninhabited island off the south-east coast of Curaçao.",
  "isSeeded": false,
  "isActive": true,
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z",
  "allowedCategories": [
    { "id": "ac-1", "categoryId": "cat-abc", "category": { "id": "cat-abc", "name": "Boat Tours", "slug": "boat-tours" } },
    { "id": "ac-2", "categoryId": "cat-def", "category": { "id": "cat-def", "name": "Snorkelling", "slug": "snorkelling" } }
  ]
}
```

State at this point:
- Hub exists with English name as canonical
- Slug `klein-curacao` locked under `curacao` in slug_registry — `/en/curacao/klein-curacao/` resolves to this hub
- Operators can now create hub-anchored trips here, but only for the allowed categories
- **No translation rows yet** — `?locale=nl` falls back to `"Klein Curaçao"` automatically

### 6.5 Admin CRUD — Phase B: Adding Translations

```http
GET /api/v1/hubs/hub-001/translations
```

Response when no translations exist: `[]`

```http
PATCH /api/v1/hubs/hub-001/translations/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "fields": {
    "name": "Klein Curaçao",
    "overview": "Klein Curaçao is een onbewoond eilandje voor de zuidoostkust van Curaçao, bekend om zijn kristalhelder water en witte zandstranden.",
    "h1Override": "Dagtochten naar Klein Curaçao",
    "breadcrumbLabel": "Klein Curaçao"
  },
  "isMachineTranslated": false
}
```

> **Rule:** Hub names are proper nouns (Klein Curaçao, Spanish Water) — `isMachineTranslated` must always be `false`. The name field typically stays identical across all locales.

Guard chain checks `MANAGE_HUBS`.

Service upserts:

```typescript
// hubs.service.ts → upsertTranslations()

await this.findHubOrThrow("hub-001");

const { fields, isMachineTranslated = false } = dto;

await this.prisma.hubTranslation.upsert({
  where: { hubId_locale: { hubId: "hub-001", locale: "nl" } },
  create: {
    hubId: "hub-001",
    locale: "nl",
    name: "Klein Curaçao",
    overview: "Klein Curaçao is een onbewoond eilandje...",
    h1Override: "Dagtochten naar Klein Curaçao",
    breadcrumbLabel: "Klein Curaçao",
    isMachineTranslated: false,
  },
  update: {
    isMachineTranslated: false,
    name: "Klein Curaçao",
    overview: "Klein Curaçao is een onbewoond eilandje...",
    h1Override: "Dagtochten naar Klein Curaçao",
    breadcrumbLabel: "Klein Curaçao",
    // Only supplied fields written — omitted fields stay unchanged
  },
  select: { locale, name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
});
// First call  → INSERT (no row with locale=nl exists)
// Second call → UPDATE (@@unique match on hubId_locale found)
```

Response:
```json
HTTP 200 OK
{
  "locale": "nl",
  "name": "Klein Curaçao",
  "overview": "Klein Curaçao is een onbewoond eilandje voor de zuidoostkust van Curaçao...",
  "h1Override": "Dagtochten naar Klein Curaçao",
  "breadcrumbLabel": "Klein Curaçao",
  "isMachineTranslated": false
}
```

Admin repeats for each locale: `es`, `pt`, `fr`, `de`, `zh`, `en`.

Other translation management endpoints:

```http
GET    /hubs/:id/translations             → all locale rows (admin translation dashboard)
GET    /hubs/:id/translations/:locale     → single locale row (pre-fill form)
DELETE /hubs/:id/translations/:locale     → wipe entire locale (removes the row)
```

### 6.6 Admin CRUD — Phase C: Adding SEO Page Content

```http
PATCH /api/v1/hubs/hub-001/page-content/nl
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "aboutText": "Klein Curaçao is een van de meest afgelegen bestemmingen vanuit Curaçao. Het eiland heeft geen vaste bewoners en is alleen bereikbaar per boot. De stranden behoren tot de mooiste van het Caribisch gebied.",
  "metaTitle": "Dagtochten naar Klein Curaçao | Island Tours",
  "metaDescription": "Boek een dagtocht naar Klein Curaçao. Kristalhelder water, witte stranden en de beste snorkellocaties van de regio."
}
```

Service upserts `HubPageContent`:

```typescript
await this.prisma.hubPageContent.upsert({
  where: { hubId_locale: { hubId: "hub-001", locale: "nl" } },
  create: {
    hubId: "hub-001",
    locale: "nl",
    aboutText: "Klein Curaçao is een van de meest afgelegen bestemmingen...",
    metaTitle: "Dagtochten naar Klein Curaçao | Island Tours",
    metaDescription: "Boek een dagtocht naar Klein Curaçao...",
  },
  update: {
    aboutText: "Klein Curaçao is een van de meest afgelegen bestemmingen...",
    metaTitle: "Dagtochten naar Klein Curaçao | Island Tours",
    metaDescription: "Boek een dagtocht naar Klein Curaçao...",
  },
  select: { locale, aboutText, metaTitle, metaDescription },
});
```

### 6.7 Admin CRUD — Phase D: Adding FAQs and Managing Allowed Categories

**FAQ creation:**

```http
POST /api/v1/hubs/hub-001/faqs
Cookie: better-auth.session_token=<token>
Content-Type: application/json

{
  "locale": "nl",
  "question": "Hoe lang duurt de boottocht naar Klein Curaçao?",
  "answer": "De overtocht duurt ongeveer 1,5 tot 2 uur afhankelijk van de vaartroute en het weer.",
  "displayOrder": 0
}
```

Service inserts in the shared `Faq` table:

```typescript
await this.prisma.faq.create({
  data: {
    pageType: 'hub',
    entityId: 'hub-001',
    locale: 'nl',
    question: "Hoe lang duurt de boottocht naar Klein Curaçao?",
    answer: "De overtocht duurt ongeveer 1,5 tot 2 uur...",
    displayOrder: 0,
  },
});
```

**Allowed category management (post-creation):**

If the initial `allowedCategoryIds` was incomplete or new categories were added to the platform later, the admin adds or removes them via:

```http
POST   /api/v1/hubs/hub-001/allowed-categories
{ "categoryId": "cat-ghi" }

DELETE /api/v1/hubs/hub-001/allowed-categories/cat-abc
```

Allowed categories control which tour categories operators can pick when creating hub-anchored trips. This list is publicly readable:

```http
GET /api/v1/hubs/hub-001/allowed-categories
```

FAQ management endpoints:

```http
GET    /hubs/:id/faqs                 → active FAQs (optional ?locale= filter)
POST   /hubs/:id/faqs                 → create item
PATCH  /hubs/:id/faqs/:faqId          → update question / answer / order / isActive
DELETE /hubs/:id/faqs/:faqId          → hard delete
```

### 6.8 DB State After All Admin Steps

```
hubs (1 row)
  id: hub-001 | destinationId: dst-001 | name: "Klein Curaçao" | slug: "klein-curacao"
  description: "A small uninhabited island off the south-east coast of Curaçao."
  isActive: true | isSeeded: false

hub_translations (7 rows — one per locale)
  (hub-001, en, "Klein Curaçao", "Klein Curaçao is a small uninhabited island...", ...)
  (hub-001, nl, "Klein Curaçao", "Klein Curaçao is een onbewoond eilandje...",     ...)
  (hub-001, es, "Klein Curaçao", "Klein Curaçao es una pequeña isla deshabitada...", ...)
  (hub-001, fr, "Klein Curaçao", "Klein Curaçao est une petite île inhabitée...",  ...)
  (hub-001, de, "Klein Curaçao", "Klein Curaçao ist eine kleine unbewohnte Insel...", ...)
  (hub-001, pt, "Klein Curaçao", "Klein Curaçao é uma pequena ilha desabitada...", ...)
  (hub-001, zh, "克莱因库拉索", "克莱因库拉索是库拉索东南海岸的一个无人居住的小岛...", ...)

hub_page_content (7 rows — one per locale)
  (hub-001, en, "Klein Curaçao is one of the most remote destinations...", "Day Trips to Klein Curaçao | Island Tours", ...)
  (hub-001, nl, "Klein Curaçao is een van de meest afgelegen bestemmingen...", "Dagtochten naar Klein Curaçao | Island Tours", ...)
  ...

faq (multiple rows per locale)
  (pageType: 'hub', entityId: hub-001, locale: 'nl', "Hoe lang duurt de boottocht?", ...)
  (pageType: 'hub', entityId: hub-001, locale: 'en', "How long is the boat trip?", ...)
  ...

hub_allowed_categories
  (hub-001, cat-abc)   ← Boat Tours
  (hub-001, cat-def)   ← Snorkelling
  (hub-001, cat-ghi)   ← added later via POST /allowed-categories

slug_registry (seeded at hub create)
  (curacao, klein-curacao, HUB, hub-001, isActive: true)
```

### 6.9 Public Fetch — User-Facing Page

A Dutch-speaking traveler visits: `https://islandtours.com/nl/curacao/klein-curacao/`

**Step 1 — next-intl middleware** extracts `locale = "nl"`, `destination = "curacao"`, `slug = "klein-curacao"`.

**Step 2 — Next.js hits the dynamic slug route handler**

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export default async function SlugPage({ params }) {
  const { locale, destination, slug } = params;
  // locale = 'nl', destination = 'curacao', slug = 'klein-curacao'
```

Unlike a destination page, the `[slug]` segment is ambiguous — it could be a category, a hub, or a tour. The slug registry resolves it.

**Step 3 — Slug registry lookup**

```typescript
const entry = await prisma.slugRegistry.findUnique({
  where: { destinationSlug_slug: { destinationSlug: "curacao", slug: "klein-curacao" } },
  select: { entityType: true, entityId: true, isActive: true },
});

// entry = { entityType: 'HUB', entityId: 'hub-001', isActive: true }

if (!entry || !entry.isActive) notFound();  // → 404

switch (entry.entityType) {
  case 'CATEGORY': return <CategoryPage entityId={entry.entityId} locale={locale} />;
  case 'HUB':      return <HubPage entityId={entry.entityId} locale={locale} />;       // ← this path
  case 'TOUR':     return <TourPage entityId={entry.entityId} locale={locale} />;
  case 'RESERVED': notFound();
}
```

**Step 4 — HubPage fires 3 parallel backend calls**

```typescript
const [hub, pageContent, faqs] = await Promise.all([
  fetch(`/api/v1/hubs/hub-001?locale=nl`),
  fetch(`/api/v1/hubs/hub-001/page-content?locale=nl`),
  fetch(`/api/v1/hubs/hub-001/faqs?locale=nl`),
]);
```

**Step 5 — Backend: Call 1 (hub detail by ID)**

```typescript
// hubs.service.ts → getById("hub-001", "nl")

const hub = await this.prisma.hub.findUnique({
  where: { id: "hub-001" },
  select: {
    id, destinationId, name, slug, description,
    isSeeded, isActive, createdAt, updatedAt,
    allowedCategories: {
      select: { id, categoryId, category: { select: { id, name, slug } } },
    },
    translations: {
      where: { locale: "nl" },
      select: { name, overview, h1Override, breadcrumbLabel, isMachineTranslated },
    },
  },
});

const { translations, ...hubData } = hub;
const t = translations[0];

return {
  ...applyTranslation(hubData, t, "nl"),
  overview:        t?.overview        ?? null,
  h1Override:      t?.h1Override      ?? null,
  breadcrumbLabel: t?.breadcrumbLabel ?? null,
};
```

Response:
```json
{
  "id": "hub-001",
  "destinationId": "dst-001",
  "name": "Klein Curaçao",
  "slug": "klein-curacao",
  "description": "A small uninhabited island off the south-east coast of Curaçao.",
  "locale": "nl",
  "isMachineTranslated": false,
  "overview": "Klein Curaçao is een onbewoond eilandje voor de zuidoostkust van Curaçao...",
  "h1Override": "Dagtochten naar Klein Curaçao",
  "breadcrumbLabel": "Klein Curaçao",
  "isActive": true,
  "isSeeded": false,
  "allowedCategories": [
    { "id": "ac-1", "categoryId": "cat-abc", "category": { "id": "cat-abc", "name": "Boat Tours", "slug": "boat-tours" } },
    { "id": "ac-2", "categoryId": "cat-def", "category": { "id": "cat-def", "name": "Snorkelling", "slug": "snorkelling" } }
  ]
}
```

**Step 6 — HubPage renders the full HTML**

```typescript
// <head>
<title>{pageContent.metaTitle ?? `${hub.name} | Island Tours`}</title>
<meta name="description" content={pageContent.metaDescription ?? ''} />

// hreflang for all 7 locales + x-default → English
<link rel="alternate" hreflang="nl" href="/nl/curacao/klein-curacao/" />
<link rel="alternate" hreflang="en" href="/en/curacao/klein-curacao/" />
<link rel="alternate" hreflang="es" href="/es/curacao/klein-curacao/" />
<link rel="alternate" hreflang="de" href="/de/curacao/klein-curacao/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/klein-curacao/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/klein-curacao/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/klein-curacao/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/klein-curacao/" />

// <body>
<nav>Home › Curaçao › {hub.breadcrumbLabel ?? hub.name}</nav>
//                    → "Klein Curaçao"

<h1>{hub.h1Override ?? hub.name}</h1>
//   → "Dagtochten naar Klein Curaçao"

<p className="description">{hub.description}</p>
//   → "A small uninhabited island..." (canonical English, always from Hub.description)

<p className="overview">{hub.overview}</p>
//   → "Klein Curaçao is een onbewoond eilandje..." (from HubTranslation.overview)

<section id="about">
  {pageContent.aboutText && <p>{pageContent.aboutText}</p>}
</section>

<section id="faqs">
  {faqs.map(faq => <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />)}
</section>
```

**Locale fallback rules:**

| Scenario | `hub.name` returned | Extra fields |
|---|---|---|
| `nl` translation row exists, `name` set | `"Klein Curaçao"` (or localized if different) | as stored |
| `nl` translation row exists, `name` is `null` | `"Klein Curaçao"` (canonical) | `overview` etc. as stored (may also be null) |
| No `nl` translation row at all | `"Klein Curaçao"` (canonical) | all `null` |
| Locale not in enum (e.g. `?locale=xx`) | — | 400 Bad Request from ValidationPipe |

Frontend convention:
- `name` always has a value (canonical fallback guarantees it)
- `hub.description` is always the canonical English short description (from base Hub model)
- `hub.overview` is the translated editorial text — hide the section when `null`
- `h1Override`, `breadcrumbLabel` → fall back to `hub.name` when `null`
- `isMachineTranslated` is always `false` for hubs (proper nouns — never AI-translated)

### 6.10 Hub-Specific: allowedCategories Sub-Resource

`allowedCategories` is always included in hub detail responses (both admin and public). The operator tour-creation wizard uses it to filter available tour categories per hub.

```http
GET /api/v1/hubs/slug/klein-curacao?destinationSlug=curacao&locale=nl
GET /api/v1/hubs/hub-001/allowed-categories
```

The second call returns the allowed categories list so the wizard knows which tour categories are valid for trips assigned to this hub.

**List queries (nav / dropdown) include allowedCategories:**

```typescript
// hubs.service.ts → getActive({ destinationId: "dst-001", locale: "nl" })

const data = await this.prisma.hub.findMany({
  where: { isActive: true, destinationId: "dst-001" },
  select: {
    id, destinationId, name, slug, description,
    isSeeded, isActive, createdAt, updatedAt,
    allowedCategories: {
      select: { id, categoryId, category: { select: { id, name, slug } } },
    },
    translations: {
      where: { locale: "nl" },
      select: { name: true, isMachineTranslated: true },
    },
  },
  orderBy: { name: 'asc' },
});

return data.map(({ translations, ...hub }) =>
  applyTranslation(hub, translations[0], "nl"),
);
```

Single query — no N+1. `allowedCategories` is included because the tour-creation wizard needs it to filter categories per hub.

### 6.11 isActive Lifecycle and Seeded Guard

**When admin deactivates a hub** (`PATCH /hubs/hub-001 { "isActive": false }`):

```typescript
// hubs.service.ts → update()

await tx.slugRegistry.updateMany({
  where: { entityType: SlugEntityType.HUB, entityId: "hub-001" },
  data: { isActive: false },
});
```

The slug_registry row flips to `isActive: false`. The slug resolver returns 404 for any locale visiting `/*/curacao/klein-curacao/`. The row is never deleted — the slug stays reserved permanently.

**Guard on delete (soft-delete):**

```typescript
// hubs.service.ts → remove()

if (hub.isSeeded) throw new ForbiddenException('Seeded hubs cannot be deactivated');

const tripCount = await prisma.trip.count({ where: { hubId: "hub-001" } });
if (tripCount > 0) throw new ConflictException(`Cannot deactivate hub: ${tripCount} trip(s) assigned`);
```

Seeded hubs (pre-loaded at platform launch) and hubs with active trips cannot be deactivated.

### 6.12 Complete Request Map

```
Browser
  → middleware.ts
      extracts: locale=nl, destination=curacao, slug=klein-curacao
  → app/[locale]/[destination]/[slug]/page.tsx
      ┌─ slug_registry lookup:
      │     SELECT entityType, entityId, isActive
      │       FROM slug_registry
      │      WHERE destinationSlug='curacao' AND slug='klein-curacao'
      │   → { entityType: 'HUB', entityId: 'hub-001', isActive: true }
      │
      └─ <HubPage entityId="hub-001" locale="nl">
              ┌─ GET /hubs/hub-001?locale=nl
              │     DB: hubs
              │       + LEFT JOIN hub_translations
              │           WHERE hubId='hub-001' AND locale='nl'
              │       + hub_allowed_categories (always included)
              │     → merged: name, overview, h1Override, breadcrumbLabel,
              │               isMachineTranslated, allowedCategories
              │
              ├─ GET /hubs/hub-001/page-content?locale=nl
              │     DB: hub_page_content
              │           WHERE hubId='hub-001' AND locale='nl'
              │     → aboutText, metaTitle, metaDescription (or empty shape if no row)
              │
              └─ GET /hubs/hub-001/faqs?locale=nl
                    DB: faq WHERE pageType='hub' AND entityId='hub-001'
                                 AND locale='nl' AND isActive=true
                    → ordered FAQ array
        → render HTML combining all 3 responses
```

### 6.13 Full API Surface

```
Public (no auth required)
  GET  /hubs                                 paginated list with locale + destinationId filter
  GET  /hubs/active                          hub list for nav / tour wizard (with allowedCategories)
  GET  /hubs/slug/:slug                      detail by slug + locale (requires ?destinationSlug=)
  GET  /hubs/:id                             detail by UUID + locale
  GET  /hubs/:id/allowed-categories          which tour categories operators may assign to trips here
  GET  /hubs/:id/page-content                aboutText, metaTitle, metaDescription
  GET  /hubs/:id/faqs                        active FAQs (optional ?locale= filter)

Admin (MANAGE_HUBS permission required)
  POST   /hubs                               create + seed 1 slug_registry row + optional allowed categories
  PATCH  /hubs/:id                           update name / description / isActive
  DELETE /hubs/:id                           soft-delete (blocked if seeded or has trips)

  GET    /hubs/:id/translations              all locale translation rows
  GET    /hubs/:id/translations/:locale      single locale (pre-fill edit form)
  PATCH  /hubs/:id/translations/:locale      create or partially update a locale
  DELETE /hubs/:id/translations/:locale      wipe entire locale row

  PATCH  /hubs/:id/page-content/:locale      create or partially update SEO content

  POST   /hubs/:id/faqs                      create FAQ item
  PATCH  /hubs/:id/faqs/:faqId               update question / answer / order / isActive
  DELETE /hubs/:id/faqs/:faqId               hard delete FAQ item

  POST   /hubs/:id/allowed-categories        add a category to the allowed set
  DELETE /hubs/:id/allowed-categories/:categoryId   remove a category from the allowed set
```

---

## 7. Fetch Pattern — Single Locale Query + Service Fallback

### 7.1 Query Strategy

The backend fetches only the requested locale in one query. Fallback to English happens in the service layer — not by fetching both locales from the DB.

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

Do not change this to `{ in: [locale, 'en'] }` — the fallback logic lives in `applyTranslation`, not in the DB query.

### 7.2 `applyTranslation` Helper

Used in every entity service. The helper returns a merged object with the canonical name as fallback for the translated name when absent.

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

### 7.3 Fallback Behaviour Table

| State | `name` returned | Other translated fields |
|---|---|---|
| Translation row exists, `name` set | Translated name | As stored |
| Translation row exists, `name` is `null` | Canonical English name | Other fields as stored (may be null) |
| No translation row at all | Canonical English name | All null |
| `locale` not in enum | — | 400 Bad Request (ValidationPipe) |

`name` is **always** non-null thanks to the canonical fallback. Frontend never needs a null-check on `name`.

### 7.4 Upsert Pattern — Partial Field Updates

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

The spread-with-undefined check (`fields.name !== undefined && { name: fields.name }`) ensures that omitted fields from the request body do not overwrite existing DB values.

### 7.5 Parallel Server Component Data Fetching

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

## 8. Frontend Translation Form Patterns

### 8.1 Admin Translation Workflow (Overview)

Admins do not translate at creation time. The workflow is always sequential:

```
1. Create entity (English content only) → 201 response
2. Open Translations tab → GET /:id/translations → shows [] or existing rows
3. Select locale → fill fields → PATCH /:id/translations/:locale
4. Repeat for each locale
5. Open SEO tab → PATCH /:id/page-content/:locale (aboutText, metaTitle, metaDescription)
6. Open FAQs tab → POST /:id/faqs (one item per request, per locale)
```

For category and trip content, an "Auto-translate" button in the admin UI triggers the BullMQ job which fills the remaining 6 locales with `isMachineTranslated = true`. The admin can then review and manually override individual fields.

Destination and hub names are always set manually — the admin panel must not show an "Auto-translate" button for name fields on these entities.

### 8.2 Upsert Payload Shape — Required `fields` Wrapper

The backend wraps translation fields inside a `fields` key. Never send them flat — the global `ValidationPipe` (`forbidNonWhitelisted: true`) will reject flat fields with 400.

```typescript
// ✅ correct
{ fields: { name, overview, h1Override, breadcrumbLabel }, isMachineTranslated?: false }

// ❌ wrong — causes 400 "property X should not exist"
{ name, overview, h1Override, breadcrumbLabel }
```

Frontend type must match:

```typescript
export interface UpsertTranslationPayload {
  fields: {
    name?: string | null;
    overview?: string | null;
    h1Override?: string | null;
    breadcrumbLabel?: string | null;
  };
  isMachineTranslated?: boolean;
}
```

### 8.3 English Tab Special Rules

The English tab in the locale management UI has these special constraints:

- **Name is read-only** — it is the canonical value, edited only in the Details tab
- **All other fields** (overview, h1Override, breadcrumbLabel, etc.) are **fully editable** via `LocaleTab` with `disableNameField` prop

```tsx
// English tab
<LocaleTab destinationId={id} locale="en" disableNameField />

// In LocaleTab — name field
<Input
  {...register('name')}
  readOnly={disableNameField}
  className={disableNameField ? 'opacity-60 cursor-not-allowed' : undefined}
/>
```

### 8.4 Delete vs Clear

The "Delete Translation" button on the English locale tab must **not** call the DELETE endpoint — the backend blocks deletion of the English translation row. Instead:

- Label it "Clear Fields"
- Call upsert with the editable fields set to `null`

```tsx
// In handleDelete — branch on disableNameField
if (disableNameField) {
  // English tab — clear editable fields only via upsert
  upsert({ id, locale, payload: { fields: { overview: null, h1Override: null, breadcrumbLabel: null } } })
} else {
  // Other locale tabs — call DELETE endpoint
  deleteTranslation({ id, locale })
}
```

For non-English locales, the DELETE endpoint removes the entire translation row.

### 8.5 Locale Tab Component Pattern

```tsx
// Locale tab passes disableNameField for English
<LocaleTab
  entityId={id}
  locale="en"
  disableNameField        // name becomes read-only; delete button becomes "Clear Fields"
/>

// Other locales — no prop, full editing including delete
<LocaleTab entityId={id} locale="nl" />
```

### 8.6 Rendering Translated Fields

Frontend conventions when consuming the API response:

| Field | When null | Rendering rule |
|---|---|---|
| `name` | Never null (fallback guaranteed) | Render as-is |
| `h1Override` | Possible | Fall back to generated H1 or `name` |
| `breadcrumbLabel` | Possible | Fall back to `name` |
| `overview` | Possible | Hide the section entirely |
| `aboutText` | Possible | Hide the section entirely |
| `metaTitle` | Possible | Fall back to `${name} \| Island Tours` |
| `metaDescription` | Possible | Fall back to `''` |
| `isMachineTranslated: true` | — | Show "Machine translated" badge |

```tsx
<nav>Home › Destination › {category.breadcrumbLabel ?? category.name}</nav>
<h1>{category.h1Override ?? generateH1(category.name)}</h1>
{category.overview && <p>{category.overview}</p>}
{pageContent.aboutText && <section id="about"><p>{pageContent.aboutText}</p></section>}
<title>{pageContent.metaTitle ?? `${category.name} | Island Tours`}</title>
```

---

## 9. AI Translation and Background Jobs

### 9.1 AI Translation Rules by Content Type

| Content | AI-translate? | Reason |
|---|---|---|
| Category name, overview, h1Override | Yes — BullMQ background job | Short-to-medium text, AI produces good results |
| Trip overview, highlights, inclusions | Yes — BullMQ background job | Long-form editorial, AI handles well |
| FAQ questions and answers | Yes — BullMQ background job | Structured Q&A, consistent tone |
| **Destination name** (Curaçao, Aruba) | **Never** | Proper noun — identical across all locales |
| **Hub name** (Klein Curaçao) | **Never** | Proper noun — admin sets manually |
| **Destination overview, h1Override** | Admin only | Not AI-translated — admin writes each locale manually |
| **Hub overview, h1Override** | Admin only | Not AI-translated — admin writes each locale manually |
| Slug | **Never** | Always English — URL segments are never translated |

When an AI translation is saved, `isMachineTranslated = true` is set. The frontend renders a "Machine translated" badge when this flag is true. Admins can manually override any AI-translated field — subsequent manual saves must set `isMachineTranslated: false` in the request body.

The admin panel must not show an "Auto-translate" button for name fields on destinations or hubs.

### 9.2 BullMQ Background Job (Phase 7)

AI translation runs as an async background job triggered after English content is saved. The job uses `ioredis` with a TCP Redis URL — never the Upstash HTTP REST client.

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

The target locale list is always the 6 non-English locales: `['es', 'nl', 'pt', 'fr', 'de', 'zh']`. English is never targeted — it is the source language.

### 9.3 Array Fields — Highlights and Inclusions (Phase 4)

Highlights and inclusions are list-based. Each item has its own parent row; translations live in separate child tables — not JSON columns.

```
TourHighlight ──── TourHighlightTranslation (highlight_id, locale, text, is_machine_translated)
TourInclusion ──── TourInclusionTranslation (inclusion_id, locale, text, is_machine_translated)
```

This keeps translations queryable, indexable, and individually updateable without rewriting the whole array. The same `isMachineTranslated` flag applies per row.

---

## 10. On-Demand ISR Revalidation

### 10.1 Trigger Points

After any translation or page content write, the service triggers cache busting. Revalidation is triggered by:

- `PATCH /:entity/:id/translations/:locale`
- `PATCH /:entity/:id/page-content/:locale`
- `DELETE /:entity/:id/translations/:locale` (locale removed — page must reflect fallback)

### 10.2 Locale Loop Pattern

**Category (appears at every destination × every locale):**

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

**Destination (appears at every locale, no sub-destinations):**

```typescript
// Triggered after PATCH /destinations/:id/translations/:locale
//                   or PATCH /destinations/:id/page-content/:locale

const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];

for (const locale of locales) {
  revalidatePath(`/${locale}/aruba/`);
}
```

**Hub (appears at every locale, under one specific destination):**

```typescript
// Triggered after PATCH /hubs/:id/translations/:locale
//                   or PATCH /hubs/:id/page-content/:locale

const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];

for (const locale of locales) {
  revalidatePath(`/${locale}/curacao/klein-curacao/`);
}
```

Next.js drops the stale ISR page. The next visitor triggers a fresh server render and sees updated content immediately.

### 10.3 Rendering Strategy Table

| Content | Method | Revalidation |
|---|---|---|
| Entity name, overview, H1, breadcrumb | SSR / ISR | 300s (tour detail) · 60s (listing pages) |
| About text, meta title/description | SSR / ISR | On-demand after admin write |
| FAQs | SSR / ISR | On-demand after admin write |
| Tour availability | Client-side fetch | On date-picker open only — never on page load |
| Booking widget | Client hydration (`requestIdleCallback` after LCP) | Per interaction |
| Static UI strings | Build-time (`next-intl`) | On deploy |
| Hreflang tags | SSR (`<head>`) | Per page |

### 10.4 Hreflang Tags

Every entity page must output hreflang tags for all 7 locales plus `x-default → English`. Slug is identical across all locales — only the locale prefix changes.

```html
<!-- Category example: /*/curacao/boat-tours/ -->
<link rel="alternate" hreflang="en" href="/en/curacao/boat-tours/" />
<link rel="alternate" hreflang="nl" href="/nl/curacao/boat-tours/" />
<link rel="alternate" hreflang="es" href="/es/curacao/boat-tours/" />
<link rel="alternate" hreflang="de" href="/de/curacao/boat-tours/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/boat-tours/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/boat-tours/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/boat-tours/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/boat-tours/" />

<!-- Destination example: /*/aruba/ -->
<link rel="alternate" hreflang="en" href="/en/aruba/" />
<link rel="alternate" hreflang="nl" href="/nl/aruba/" />
<link rel="alternate" hreflang="es" href="/es/aruba/" />
<link rel="alternate" hreflang="de" href="/de/aruba/" />
<link rel="alternate" hreflang="fr" href="/fr/aruba/" />
<link rel="alternate" hreflang="pt" href="/pt/aruba/" />
<link rel="alternate" hreflang="zh" href="/zh/aruba/" />
<link rel="alternate" hreflang="x-default" href="/en/aruba/" />

<!-- Hub example: /*/curacao/klein-curacao/ -->
<link rel="alternate" hreflang="en" href="/en/curacao/klein-curacao/" />
<link rel="alternate" hreflang="nl" href="/nl/curacao/klein-curacao/" />
<link rel="alternate" hreflang="es" href="/es/curacao/klein-curacao/" />
<link rel="alternate" hreflang="de" href="/de/curacao/klein-curacao/" />
<link rel="alternate" hreflang="fr" href="/fr/curacao/klein-curacao/" />
<link rel="alternate" hreflang="pt" href="/pt/curacao/klein-curacao/" />
<link rel="alternate" hreflang="zh" href="/zh/curacao/klein-curacao/" />
<link rel="alternate" hreflang="x-default" href="/en/curacao/klein-curacao/" />
```

`x-default` always points to the English URL regardless of which locale is being rendered.
