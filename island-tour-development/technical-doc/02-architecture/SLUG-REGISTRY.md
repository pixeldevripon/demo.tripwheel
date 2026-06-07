# Slug Registry — Architecture & Lifecycle Reference

> **Status:** Canonical. Reflects the V2 flat-URL model (see `PLATFORM-ARCHITECTURE-V2.md` §9).
> **Audience:** Backend + frontend engineers.
> **Source of truth in code:** `backend/prisma/slug-registry.prisma`, `backend/src/slug-registry/slug-registry.service.ts`, and the `slugRegistry` write sites in `destinations`, `categories`, `hubs`, `collections`, and `trips` services.

This document consolidates everything previously scattered across `CLAUDE.md`, `PLATFORM-ARCHITECTURE-V2.md` §9, `MULTILINGUAL-CONTENT.md`, the Frontend Impact Log, and `04-BEFORE-AFTER-AND-LOGIC.md`. It is the one place to understand: **how the registry works, when a row is written vs. skipped, how the full lifecycle stays in sync, how the frontend uses it to route, and how a trip resolves with a flat slug.**

---

## 1. Why the registry exists

Every public page (other than the destination root) lives under one ambiguous URL shape:

```text
/{locale}/{destination}/{slug}/
```

The `{slug}` segment is **polymorphic** — it could be:

| Example URL | What `{slug}` is |
|---|---|
| `/en/curacao/boat-tours/` | a **Category** page |
| `/en/curacao/klein-curacao/` | an **Activity Hub** page |
| `/en/curacao/best-family-trips/` | a **Collection** page |
| `/en/curacao/sunset-catamaran-cruise/` | a **Tour** detail page |
| `/en/curacao/tours/` | the **reserved** "all tours" listing |

Next.js cannot tell these apart from the URL alone — they share the same route file. The **slug registry** is the single lookup table that resolves `{destination} + {slug}` → `{ entityType, entityId }`, so the frontend knows which page component to render and which API to call.

> **Design rule:** a tour has **one** canonical flat URL. Hubs and categories a tour belongs to are *discovery tags* — they affect listing/filtering, **not** the tour's URL. There is no hub-nested tour URL.

---

## 2. The table

`backend/prisma/slug-registry.prisma`:

```prisma
model SlugRegistry {
  id              String         @id @default(uuid())
  destinationSlug String         // 'curacao' — matches Destination.slug
  slug            String         // 'boat-tours', 'klein-curacao', 'miss-ann'
  entityType      SlugEntityType // TOUR | CATEGORY | HUB | COLLECTION | RESERVED
  entityId        String?        // null ONLY when entityType = RESERVED
  isActive        Boolean        @default(true) // false = 404 but slug stays reserved
  createdAt       DateTime       @default(now())

  @@unique([destinationSlug, slug])
  @@index([destinationSlug, slug, isActive])
  @@map("slug_registry")
}
```

`SlugEntityType` (`enums.prisma`): `TOUR · CATEGORY · HUB · COLLECTION · RESERVED`.

### Column semantics

| Column | Meaning |
|---|---|
| `destinationSlug` | The island namespace. Denormalized copy of `Destination.slug` so resolution is a single-table lookup with no join. |
| `slug` | The English URL segment. **Always English, never translated** (translations change the *page content*, not the URL). |
| `entityType` | Tells the frontend which page to render and which entity table to query. |
| `entityId` | FK-by-value to the owning row (`Category.id`, `Hub.id`, `Collection.id`, `Trip.id`). `null` **only** for `RESERVED`. |
| `isActive` | `true` = page renders. `false` = **slug stays claimed but the page 404s**. This is how we disable an entity without freeing its slug (prevents a different entity from silently stealing a URL that may be bookmarked/indexed). |

### The two invariants

1. **Uniqueness:** `@@unique([destinationSlug, slug])` — within one destination a slug maps to exactly one entity. The *same* slug may exist under different destinations (`curacao/boat-tours` and `aruba/boat-tours` are independent rows).
2. **Transactional integrity:** every registry row is written **in the same Prisma `$transaction` as the entity it represents.** A failed entity create rolls back its registry row, and vice-versa. There are never orphan rows or unrouteable entities. *(CLAUDE.md Critical Rule #4.)*

---

## 3. When a row is ADDED (and when it is SKIPPED)

### 3.1 Quick reference

| Action | Registry write | `entityType` | `entityId` | Notes |
|---|---|---|---|---|
| **Destination create** | 1 `RESERVED` row + **1 `CATEGORY` row per existing active category** | `RESERVED` / `CATEGORY` | `null` / category id | Backfills every already-existing category into the new island. |
| **Category create** | **1 `CATEGORY` row per existing active destination** | `CATEGORY` | category id | Fans out across all islands (categories are global). |
| **Hub create** | exactly **1 `HUB` row** | `HUB` | hub id | Scoped to its one destination. |
| **Collection create** | exactly **1 `COLLECTION` row** | `COLLECTION` | collection id | Scoped to its one destination. |
| **Tour (Trip) create** | **always exactly 1 `TOUR` row** | `TOUR` | trip id | Unconditional — flat URL for every tour. |
| **Translation create/edit** | ❌ **skipped** | — | — | Translations never touch the registry; slugs are English-only. |
| **Tour edit (any field incl. slug-affecting name)** | ❌ **skipped** | — | — | Slugs are **immutable after create** (no `slug_redirects` table by decision). |
| **Page-content / FAQ / featured-experience edits** | ❌ **skipped** | — | — | These are page payloads, not routable entities. |

### 3.2 The "skip" rule, stated plainly

A registry row is written **only when a new routable entity is born.** It is **never** written on update of routable fields, because **slugs are immutable** — once a tour/category/hub/collection has a slug, that slug is frozen for the life of the entity. We deliberately chose immutability over a redirect table so that **booking links and indexed URLs never break** (V2 Group 9 decision: "keep immutable").

The only registry writes after creation are **state toggles and deletes** (next section) — never the creation of a *new* slug for an existing entity.

### 3.3 Where each rule lives in code

- Destination → `destinations.service.ts` `create()` — writes `RESERVED 'tours'` (entityId `null`) then `createMany` of one `CATEGORY` row per active category.
- Category → `categories.service.ts` `create()` — `createMany` of one `CATEGORY` row per active destination (same transaction as the 3 `FeaturedSlot` rows).
- Hub → `hubs.service.ts` `create()` — single `HUB` row.
- Collection → `collections.service.ts` `create()` — single `COLLECTION` row.
- Tour → `trips.service.ts` `create()` — single `TOUR` row, **unconditional**, after `resolveUniqueSlug()` (see §5).

### 3.4 The reserved `tours` slug

Every destination is seeded with one `RESERVED` row for slug `tours` (`entityId = null`). This:
- Protects `/{destination}/tours/` so no category/hub/collection/tour can ever claim it.
- Lets the frontend render the "all tours in this destination" listing page from a known, stable URL.

`RESERVED` is the only `entityType` whose `entityId` is `null`.

---

## 4. Full lifecycle — how rows stay in sync

Creation is only half the story. Each routable entity keeps its registry row(s) consistent through its whole lifecycle.

### 4.1 Soft disable (deactivate) → `isActive = false`

When an entity is deactivated (its `remove()` / soft-delete path), the matching registry row(s) are flipped to `isActive = false` **in the same transaction** — the row stays, the page 404s, the slug stays claimed.

| Entity | What gets toggled |
|---|---|
| Destination deactivate | `updateMany` **all** rows `WHERE destinationSlug = <slug>` → `isActive:false` (the whole island goes dark: its reserved row, categories, hubs, collections, tours). |
| Destination reactivate (`update` with `isActive:true`) | `updateMany` all rows for that `destinationSlug` → `isActive:true`. |
| Category deactivate / reactivate | `updateMany` `WHERE entityType=CATEGORY AND entityId=<id>` (flips that category's row on **every** island at once). |
| Hub deactivate / reactivate | `updateMany` `WHERE entityType=HUB AND entityId=<id>`. |
| Collection deactivate / reactivate | `updateMany` `WHERE entityType=COLLECTION AND entityId=<id>`. |
| Tour archive | `updateMany` `WHERE entityType=TOUR AND entityId=<id>` → `isActive:false`. |
| Tour restore | `updateMany` same filter → `isActive:true`. |

> **Guarded deactivation:** destinations and categories refuse to deactivate while active non-draft trips are still assigned (throws `409`). This prevents stranding live, bookable tours behind a 404 parent.

### 4.2 Hard delete (force delete) → row removed

Permanent deletes physically `deleteMany` the registry rows in the same transaction as the entity delete:

| Entity | Registry cleanup |
|---|---|
| Destination force-delete | `deleteMany WHERE destinationSlug = <slug>` (removes reserved + all child rows). Blocked if `isSeeded`. |
| Category force-delete | `deleteMany WHERE entityType=CATEGORY AND entityId=<id>` (all islands). Blocked if `isSeeded`. |
| Collection force-delete | `deleteMany WHERE entityType=COLLECTION AND entityId=<id>`. |
| Tour remove (hard) | `deleteMany WHERE entityType=TOUR AND entityId=<id>`. |

After a hard delete the slug is **free** and can be claimed by a future entity. (Contrast with soft disable, which keeps it claimed.)

### 4.3 State-machine summary for a single slug

```text
        create()                deactivate()              forceDelete()
  ∅ ─────────────▶ isActive:true ───────────▶ isActive:false ───────────▶ ∅ (row gone, slug free)
                        ▲                            │
                        └──────── reactivate ────────┘
```

`isActive:false` is the "tombstone" state: routable lookups 404, but the unique `(destinationSlug, slug)` pair is still occupied so nothing else can take the URL.

---

## 5. How a TOUR resolves with a flat slug

Tours are the high-volume, operator-created entity, so slug assignment is the most defensive. It runs in `trips.service.ts`.

### 5.1 Building the base slug (`create()`)

```ts
const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
```

- Operator may pass an explicit `slug`; otherwise it's derived from the tour name.
- Either way it's normalized through `generateSlug()` (lowercase, ASCII-fold, hyphenate) so the stored value is always URL-safe.

### 5.2 Ensuring uniqueness (`resolveUniqueSlug()`)

Tours share the `(destinationSlug, slug)` namespace with categories, hubs, collections, and the reserved `tours` slug — so a tour slug must be unique against **both** the `trips` table **and** the `slug_registry`. The resolver enforces this in layers:

1. **Own-duplicate guard.** If *this same operator* already has a trip with `baseSlug` at this destination → throw `409` (no silent auto-fix; the operator is duplicating their own listing).

2. **Cross-entity collision check.** Look up, in parallel:
   - any trip (any operator) with `baseSlug` at this destination, and
   - any `slug_registry` row at `(destinationSlug, baseSlug)`.

   If **neither** exists → `baseSlug` is free, return it as-is.

3. **Suffixing (one attempt, never numeric).** If the slug is taken by *another* entity, append a single operator-identity suffix:
   - suffix = `generateSlug(companyName ?? userName ?? operatorId[:8])`
   - candidate = `"{baseSlug}-{suffix}"`.
   - Re-check the candidate against both the trips table and the registry. If free → use it.
   - If the candidate is taken by *this* operator → `409` (their own duplicate again).
   - If the candidate is taken by *another* entity → `409` ("choose a different tour name or slug"). **No numeric suffix is ever tried** (V2 pages 11–15: numbers are bad for SEO).

This gives human-readable, collision-free URLs like `sunset-cruise`, then `sunset-cruise-miss-ann` when two operators pick the same name. A third collision is rejected rather than turned into `sunset-cruise-miss-ann-1`.

### 5.3 Atomic write

Inside the create `$transaction`:
1. `trip.create(...)` (with nested `TourCategory` / `TourHub` rows).
2. `slugRegistry.create({ destinationSlug, slug: trip.slug, entityType: TOUR, entityId: trip.id, isActive: true })`.

Both succeed or both roll back. A `P2002` on either is mapped to a `409` — including a **race-condition fallback**: if another request claimed the slug between the pre-check and the write, the unique constraint catches it and the operator is told to retry.

### 5.4 Reading a tour back (`findBySlug`)

The public tour page resolves **purely by destination + slug** — hubs/categories play no part in the URL:

```ts
trip = prisma.trip.findFirst({
  where: { slug, status: LIVE, isActive: true, destination: { slug: destinationSlug } },
  ...
});
```

Only `LIVE` + `isActive` trips are returned; drafts/paused/archived 404 on the public side.

---

## 6. Step-by-step create cycles (per entity)

This section walks the **complete** create flow for each entity — what the admin/operator submits, what the service validates, every row written, and (for tours) exactly how the flat slug is generated. Each cycle runs inside a single Prisma `$transaction`: if any step throws, **everything rolls back** and no slug is claimed.

### 6.1 Create a DESTINATION (admin)

`destinations.service.ts` `create()`.

```text
Admin submits: { name: "Curaçao", slug?: "curacao", region: CARIBBEAN, heroImage, country?, lat?, lng?, … }

1. Slug   → slug = generateSlug(dto.slug ?? dto.name)        // "Curaçao" → "curacao"
2. BEGIN TRANSACTION
3. destination.create({ name, slug, region, …, createdBy })  // P2002 on slug → 409 "already exists"
4. slugRegistry.create({                                     // reserve the listing URL
       destinationSlug: "curacao", slug: "tours",
       entityType: RESERVED, entityId: null })
5. categories = category.findMany({ isActive: true })        // every global category that exists now
6. IF categories.length > 0:
     slugRegistry.createMany(                                // backfill each into the new island
       categories.map(c => ({ destinationSlug:"curacao", slug:c.slug,
                              entityType: CATEGORY, entityId:c.id })))
7. COMMIT  → log "seeded N category slug(s) + 1 reserved"
```

**Rows written:** 1 `RESERVED` (`tours`) + 1 `CATEGORY` row per already-existing active category.
**Result:** `/curacao/tours/` is reserved, and every existing category (`/curacao/boat-tours/`, `/curacao/diving/`, …) is immediately routable for the new island. New categories created *later* fan back into this destination via the category cycle (§6.2).

### 6.2 Create a CATEGORY (admin)

`categories.service.ts` `create()`. Categories are **global** — one category spans every island.

```text
Admin submits: { name: "Boat Tours", slug?: "boat-tours", description?, icon?, sortOrder?, … }

1. Slug   → slug = generateSlug(dto.slug ?? dto.name)        // "boat-tours"
2. BEGIN TRANSACTION
3. category.create({ name, slug, …, createdBy })             // P2002 on slug → 409
4. featuredSlot.createMany([                                 // CLAUDE.md Rule #6 — exactly 3, here only
       {categoryId, slotNumber:1, status:AVAILABLE},
       {categoryId, slotNumber:2, status:AVAILABLE},
       {categoryId, slotNumber:3, status:AVAILABLE} ])
5. destinations = destination.findMany({ isActive: true })   // fan out across all islands
6. IF destinations.length > 0:
     slugRegistry.createMany(
       destinations.map(d => ({ destinationSlug:d.slug, slug:"boat-tours",
                                entityType: CATEGORY, entityId: category.id })))
7. COMMIT  → log "seeded N slug_registry row(s)"
```

**Rows written:** 3 `FeaturedSlot` rows (always, only here) + 1 `CATEGORY` registry row **per active destination**.
**Result:** `/curacao/boat-tours/`, `/aruba/boat-tours/`, … all resolve to this one category. The page still won't *render* until that destination has ≥1 published tour in the category (the gating rule, §7.4).

### 6.3 Create an ACTIVITY HUB (admin)

`hubs.service.ts` `create()`. A hub is **destination-scoped** (one island).

```text
Admin submits: { name: "Klein Curaçao", destinationId, hubType: HIGHLIGHT, description, lat?, lng? }
                 // NOTE: hub does NOT accept an explicit slug — always derived from name

1. Slug   → slug = generateSlug(dto.name)                    // "klein-curacao"
2. BEGIN TRANSACTION
3. destination = destination.findUnique({ id: destinationId })   // 404 if missing
4. hub.create({ destinationId, name, slug, hubType, …, createdBy })
       // P2002 → 409 "Hub slug already exists for this destination"
5. slugRegistry.create({ destinationSlug: destination.slug, slug: "klein-curacao",
                         entityType: HUB, entityId: hub.id })
       // P2002 → 409 "Slug already taken for destination"
6. COMMIT
```

**Rows written:** exactly 1 `HUB` registry row, scoped to the hub's destination.
**Result:** `/curacao/klein-curacao/` resolves to `HUB`. A hub is a **discovery tag** — it never becomes a URL prefix for the tours attached to it.

### 6.4 Create a TOUR (operator, or admin)

`trips.service.ts` `create()`. This is the most defensive cycle because tour slugs share the destination namespace with categories, hubs, collections, and the reserved `tours` slug.

```text
Operator submits: { name, slug?, destinationId, categoryIds:[…], primaryCategoryId?,
                    hubIds?:[…], pricingModel, basePrice?, … }

1. operatorId = resolveOperatorId(userId, role)   // user.id → operator.id (admin auto-provisions)
2. baseSlug   = generateSlug(dto.slug ?? dto.name)

3. Validate destination  → must exist AND isActive            // else 400
4. Validate categories:
     - dedupe categoryIds; require ≥1                          // else 400
     - primaryCategoryId = dto.primaryCategoryId ?? categoryIds[0]; must be in categoryIds
     - every categoryId must exist AND isActive                // else 400

5. slug = resolveUniqueSlug(baseSlug, destinationId, destinationSlug, operatorId)   // ← see §6.5

6. BEGIN TRANSACTION
7.   Validate each hubId (TOCTOU-safe, inside tx):
        - hub exists AND isActive                              // else 400
        - hub.destinationId === dto.destinationId              // else 400
        - ≥1 of the tour's categories is in hub's allowed list // else 400
8.   trip.create({ name, slug, operatorId, destinationId, pricing…,
                   categories: { create: categoryIds.map(id => ({ categoryId:id,
                                          isPrimary: id === primaryCategoryId })) },
                   hubs:       { create: hubIds.map(id => ({ hubId:id })) } })
        // P2002 on slug → 409 "taken concurrently, retry"  (race fallback)
9.   slugRegistry.create({ destinationSlug, slug: trip.slug,
                          entityType: TOUR, entityId: trip.id, isActive: true })
        // P2002 → 409
10. COMMIT
```

**Rows written:** 1 `Trip` + N `TourCategory` (one `isPrimary`) + M `TourHub` + **always** 1 `TOUR` registry row.
**Result:** one flat canonical URL `/{destination}/{slug}/`. The tour's categories/hubs drive discovery and filtering only — they never appear in the URL.

### 6.5 How the TOUR slug is generated / resolved (the `klein-curacao-boat-trip` case)

This is `resolveUniqueSlug()` — the reason two operators can both name a tour the same thing and still get clean, distinct flat URLs.

**Step 1 — normalize.** `generateSlug()` lowercases, strips diacritics (Curaçao → curacao), removes punctuation, and joins words with hyphens:

```text
"Klein Curaçao Boat Trip"  →  generateSlug  →  "klein-curacao-boat-trip"
```

This already *looks* joined/flat — the words of the tour name are hyphen-joined into one segment. That is the **base slug**.

**Step 2 — own-duplicate guard.** If *this same operator* already has `klein-curacao-boat-trip` at this destination → `409` immediately (they're duplicating their own listing; no auto-rename).

**Step 3 — cross-entity collision check.** In parallel, look for:
- any **trip** (any operator) with that slug at this destination, and
- any **slug_registry** row at `(destinationSlug, "klein-curacao-boat-trip")` — i.e. a category/hub/collection/reserved slug.

If **both are empty** → the base slug is free, use it as-is:

```text
/curacao/klein-curacao-boat-trip/
```

**Step 4 — suffix with operator identity (one attempt, no numbers).** If the slug is already claimed by *another* entity (e.g. another operator already took it, or it clashes with the `klein-curacao` hub's namespace), append the operator's identity **once**:

```text
suffix    = generateSlug(companyName ?? userName ?? operatorId[:8])   // e.g. "bluefin-charters"
candidate = "klein-curacao-boat-trip-bluefin-charters"
```

Re-check the candidate against **both** the trips table and the registry:
- candidate is free → use it.
- candidate is taken by *this* operator → `409` (their own duplicate).
- candidate is taken by *another* entity → **`409` "choose a different tour name or slug"**.

**Numbers are never appended** (`-2`, `-3`, …) — per V2 pages 11–15 they are confusing for users and bad for SEO. The operator-name suffix is the single fallback; if even that collides, the create is rejected and the operator must rename.

**Step 5 — atomic claim.** The winning slug is written as the `Trip.slug` **and** the `TOUR` registry row in the same transaction (§6.4 steps 8–9). A unique-constraint race between the pre-check and the write is caught as `409 "taken concurrently, retry"`.

> **Resolution example, end to end:**
> - Operator A publishes "Klein Curaçao Boat Trip" → free → `/curacao/klein-curacao-boat-trip/`.
> - Operator B (Bluefin Charters) publishes the same name → base taken → `/curacao/klein-curacao-boat-trip-bluefin-charters/`.
> - Operator C (also "Bluefin Charters", or anyone whose suffix collides too) → **rejected with `409`**; C must choose a different name/slug. No `-1`/`-2` is ever generated.
> - All accepted slugs are flat, human-readable, collision-free, and immutable for the life of the tour.

---

## 7. How the FRONTEND uses the registry

### 7.1 The resolve endpoint

```
GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}
```

`slug-registry.service.ts` → `resolve()`:
- Looks up the unique `(destinationSlug, slug)` row.
- **404 if the row is missing OR `isActive === false`** (tombstoned slugs are treated as not-found by the public router).
- On success returns:

```json
{ "destinationSlug": "curacao", "slug": "boat-tours", "entityType": "CATEGORY", "entityId": "uuid…" }
```

### 7.2 The routing switch

The Next.js `[locale]/[destination]/[slug]` route resolves first, then branches on `entityType`:

```ts
const r = await resolveSlug(destination, slug); // 404 → notFound()

switch (r.entityType) {
  case 'CATEGORY':   return <CategoryPage   destination={destination} categoryId={r.entityId} locale={locale} />;
  case 'HUB':        return <HubPage        destination={destination} hubId={r.entityId}      locale={locale} />;
  case 'COLLECTION': return <CollectionPage destination={destination} collectionId={r.entityId} locale={locale} />;
  case 'TOUR':       return <TourPage       destination={destination} slug={slug}             locale={locale} />;
  case 'RESERVED':   return <DestinationToursListing destination={destination} locale={locale} />;
}
```

- For **TOUR**, the frontend then calls the flat `findBySlug` endpoint (it already has the slug; it does not need `entityId`).
- For **CATEGORY/HUB/COLLECTION**, it uses `entityId` to fetch that entity's page payload + filtered tour list.

### 7.3 Depth / segment rule

- **1 segment** after destination (`/{dest}/{slug}/`) → always goes through the registry resolve.
- The destination root (`/{dest}/`) is resolved directly against `Destination.slug`, **not** the registry.
- There is **no** 2-segment tour URL. Any deeper path that isn't an explicitly defined route is a 404. (Hubs add a discovery *tag*, never a URL prefix.)

### 7.4 Category-gating nuance

A `CATEGORY` resolve succeeding is **necessary but not sufficient** to render the page. Category pages additionally gate on **having ≥1 published tour at that destination** (`categories.service.ts` `getBySlugForDestination` returns 404 when `publishedTourCount === 0`). So the frontend may receive a valid `CATEGORY` resolution and still render `notFound()` if the category page payload comes back empty. The registry answers *"what is this slug?"*; the category service answers *"is this page allowed to render right now?"*.

### 7.5 Recommended frontend caching

Resolve results are safe to cache per `(destination, slug)` with revalidation, because slugs are immutable — the only thing that changes is `isActive`, which should bust the cache on the (rare) admin toggle. Treat a `404` from resolve as authoritative (render `notFound()`); do not fall back to guessing the entity type.

---

## 8. End-to-end worked examples

**A) Operator publishes "Sunset Catamaran Cruise" in Curaçao**
1. `generateSlug("Sunset Catamaran Cruise")` → `sunset-catamaran-cruise`.
2. `resolveUniqueSlug` — no trip, no registry row at `(curacao, sunset-catamaran-cruise)` → free.
3. Transaction: `trip.create` + `slugRegistry.create(TOUR, isActive:true)`.
4. Public URL `/en/curacao/sunset-catamaran-cruise/` → resolve → `TOUR` → `findBySlug`.

**B) Two operators both name a trip "Island Hopping" in Aruba**
1. Operator A: gets `island-hopping`.
2. Operator B (Blue Bay Tours): `island-hopping` taken in registry → suffix with company name → `island-hopping-blue-bay-tours`. Both tours have stable, distinct flat URLs.
3. A third operator whose suffix would also collide is **rejected with `409`** and must rename — no `island-hopping-2` is ever generated.

**C) Admin adds a new category "Diving" after islands already exist**
1. `category.create` fans out: one `CATEGORY` registry row per active destination (`curacao/diving`, `aruba/diving`, …) + 3 FeaturedSlots — all one transaction.
2. `/en/curacao/diving/` resolves to `CATEGORY`, but the page still 404s until ≥1 published diving tour exists in Curaçao (§7.4).

**D) Admin deactivates the "Diving" category**
1. `updateMany WHERE entityType=CATEGORY AND entityId=<diving>` → `isActive:false` on every island.
2. All `/{dest}/diving/` URLs now resolve-404, but the slug stays claimed — no hub/collection can grab `diving` while it's parked.

---

## 9. Invariants checklist (for reviewers)

- [ ] Every registry write is inside the entity's create/update `$transaction`.
- [ ] Category create → one row **per active destination** (+ 3 FeaturedSlots).
- [ ] Destination create → one `RESERVED 'tours'` row (+ one row per existing active category).
- [ ] Tour create → **always** one `TOUR` row; archive/restore toggle `isActive`; hard remove deletes it.
- [ ] No code path writes a registry row on a *translation* or on a routable-field *edit* (slugs immutable).
- [ ] Deactivate → `isActive:false` (row kept); force-delete → row removed.
- [ ] `entityId` is `null` **iff** `entityType === RESERVED`.
- [ ] Public `resolve()` treats `isActive:false` as 404.

---

## 10. Related docs

- `PLATFORM-ARCHITECTURE-V2.md` §9 — discovery/URL architecture (canonical).
- `04-multilingual/MULTILINGUAL-CONTENT.md` — why slugs are English-only; locale routing.
- `02-architecture/SOFT-DELETE-STRATEGY.md` — `isActive` tombstone semantics platform-wide.
- `06-v2-backend-migration/04-BEFORE-AFTER-AND-LOGIC.md` §5 — before/after of the flat-URL migration.
- `06-v2-backend-migration/05-FRONTEND-IMPACT-LOG.md` — "Public-site routing contract" section.
- `CLAUDE.md` — Critical Rules #4, #5, #6, #7, #8; "Slug Registry — How It Works".
