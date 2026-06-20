# Slug Registry — Architecture & Lifecycle Reference

> **Canonical source:** master §2.3 (slug registry, 301 renames, 90-day cooldown), §2.2 (URL structure), §2.4 (categories). `island-tours-platform-master.html` v1.9.
> **Purpose:** The single reference for how the destination-scoped slug registry works — the table shape, when a row is written vs. tombstoned vs. removed, the 301-on-rename redirect table, the 90-day reuse cooldown, and how a flat tour slug is generated.
> **Source of truth in code:** `backend/prisma/slug-registry.prisma`, `backend/src/slug-registry/slug-registry.service.ts`, and the `slugRegistry` write sites in `destinations`, `categories`, `hubs`, `collections`, and `trips` services.

Companion docs: how rows are *read* to route a request → [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md); indexing impact → [`SEO-STRATEGY.md`](./SEO-STRATEGY.md); why deletes are deactivations → [`SOFT-DELETE-STRATEGY.md`](./SOFT-DELETE-STRATEGY.md).

---

## 1. Why the registry exists

Every public page other than the destination root lives under one ambiguous URL shape:

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

Next.js cannot tell these apart from the URL alone — they share the same route file. The **slug registry** is the single lookup table that maps `{destination} + {slug}` → `{ entityType, entityId }`, so the frontend knows which page component to render and which API to call (master §2.3).

> **Design rule:** a tour has **one** canonical flat URL `/{locale}/{destination}/{tour-slug}/`. The categories and hubs a tour belongs to are *discovery tags* — they affect listing/filtering, **not** the tour's URL. There is no hub-nested tour URL and no `/tour/` segment.

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
| `slug` | The English URL segment. **Always English, never translated** (translations change the *page content*, not the URL). Normalized via `generateSlug()`. |
| `entityType` | Tells the frontend which page to render and which entity table to query. One of `TOUR · CATEGORY · HUB · COLLECTION · RESERVED`. |
| `entityId` | FK-by-value to the owning row (`Category.id`, `Hub.id`, `Collection.id`, `Trip.id`). `null` **only** for `RESERVED`. |
| `isActive` | `true` = page renders. `false` = **slug stays claimed but the page 404s** (tombstone). This disables an entity without freeing its slug. |

### The two invariants

1. **Uniqueness:** `@@unique([destinationSlug, slug])` — within one destination a slug maps to exactly one entity. The *same* slug may exist under different destinations (`curacao/boat-tours` and `aruba/boat-tours` are independent rows).
2. **Transactional integrity:** every registry row is written **in the same Prisma `$transaction` as the entity it represents.** A failed entity create rolls back its registry row, and vice-versa — never orphan rows or unrouteable entities. *(CLAUDE.md Critical Rule #4.)*

---

## 3. The 20 protected slugs per destination

At destination creation the registry is pre-seeded with **20 protected slugs**:

- **19 global category slugs** (one `CATEGORY` row each), and
- the reserved `tours` slug (one `RESERVED` row, `entityId = null`).

The 19 canonical category slugs (master §2.4):

```text
boat-tours · snorkeling · scuba-diving · sunset-cruises · sightseeing-tours ·
day-trips · off-road-tours · jet-ski · parasailing · water-sports · fishing-trips ·
nature-wildlife-tours · hiking-tours · adventure-tours · cultural-tours · food-tours ·
attraction-tickets · luxury-experiences · workshops-classes
```

Categories are **global** — the same 19-slug set is reused for every destination; a new category fans a row out to every active destination, and a new destination backfills a row for every existing active category (§5).

---

## 4. When a row is ADDED, TOMBSTONED, or REMOVED

### 4.1 Write-on-create quick reference

| Action | Registry write | `entityType` | `entityId` | Notes |
|---|---|---|---|---|
| **Destination create** | 1 `RESERVED` row + **1 `CATEGORY` row per existing active category** | `RESERVED` / `CATEGORY` | `null` / category id | Backfills every existing category into the new island. |
| **Category create** | **1 `CATEGORY` row per existing active destination** | `CATEGORY` | category id | Fans out across all islands (categories are global). Writes slug rows only — **no FeaturedSlot rows** (see §4.2). |
| **Hub create** | exactly **1 `HUB` row** | `HUB` | hub id | Scoped to its one destination. |
| **Collection create** | exactly **1 `COLLECTION` row** | `COLLECTION` | collection id | Scoped to its one destination. |
| **Tour (Trip) create** | **always exactly 1 `TOUR` row** | `TOUR` | trip id | Unconditional — flat URL for every tour. |
| **Translation create/edit** | skipped | — | — | Translations never touch the registry; slugs are English-only. |
| **Page-content / FAQ edits** | skipped | — | — | Page payloads, not routable entities. |
| **Rename (slug change)** | updates the row's `slug` **and writes a 301 redirect entry** | unchanged | unchanged | See §6. |

### 4.2 No FeaturedSlot seeding — slots are removed

> **CRITICAL CHANGE.** The earlier rule that "Category create seeds exactly 3 FeaturedSlot rows in the same transaction" is **removed.** The featured-slot economy (FeaturedSlot / SlotLock / SlotHistory / Waitlist) does not exist in the target architecture. Placement is governed by **commission tiers + a ranking query + an eligibility engine** (master §2.4 commercial model — see [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md)).
>
> Category create now writes **only** its slug-registry rows (one per active destination), transactionally. The category-create service must be updated to drop the `featuredSlot.createMany([...])` call.

### 4.3 The reserved `tours` slug

Every destination is seeded with one `RESERVED` row for slug `tours` (`entityId = null`). This:

- Protects `/{destination}/tours/` so no category/hub/collection/tour can ever claim it.
- Lets the frontend render the "all tours in this destination" listing from a known, stable URL.

`RESERVED` is the only `entityType` whose `entityId` is `null`.

### 4.4 Soft disable (deactivate) → `isActive = false` (tombstone)

When an entity is deactivated, the matching registry row(s) are flipped to `isActive = false` **in the same transaction** — the row stays, the page 404s, the slug stays claimed.

| Entity | What gets toggled |
|---|---|
| Destination deactivate | `updateMany` **all** rows `WHERE destinationSlug = <slug>` → `isActive:false` (reserved row + categories + hubs + collections + tours). |
| Destination reactivate | `updateMany` all rows for that `destinationSlug` → `isActive:true`. |
| Category deactivate / reactivate | `updateMany WHERE entityType=CATEGORY AND entityId=<id>` (flips that category's row on **every** island at once). |
| Hub deactivate / reactivate | `updateMany WHERE entityType=HUB AND entityId=<id>`. |
| Collection deactivate / reactivate | `updateMany WHERE entityType=COLLECTION AND entityId=<id>`. |
| Tour archive / restore | `updateMany WHERE entityType=TOUR AND entityId=<id>` → `isActive:false` / `true`. |

> **Guarded deactivation:** destinations and categories refuse to deactivate while active non-draft trips are still assigned (throws `409`). This prevents stranding live, bookable tours behind a 404 parent.

### 4.5 Hard delete (force delete) → row removed, then 90-day cooldown

Permanent deletes `deleteMany` the registry rows in the same transaction as the entity delete:

| Entity | Registry cleanup |
|---|---|
| Destination force-delete | `deleteMany WHERE destinationSlug = <slug>`. Blocked if `isSeeded`. |
| Category force-delete | `deleteMany WHERE entityType=CATEGORY AND entityId=<id>` (all islands). Blocked if `isSeeded`. |
| Collection force-delete | `deleteMany WHERE entityType=COLLECTION AND entityId=<id>`. |
| Tour remove (hard) | `deleteMany WHERE entityType=TOUR AND entityId=<id>`. |

After a hard delete the slug is **not immediately reusable** — it enters a **90-day soft-delete cooldown** (§7) before any new entity can claim it, protecting against stale external links and search-index confusion (master §2.3).

### 4.6 State-machine summary for a single slug

```text
        create()                deactivate()              forceDelete()           +90 days
  ∅ ─────────────▶ isActive:true ───────────▶ isActive:false ──────────▶ cooldown ──────────▶ ∅ (free)
                        ▲   │                       │
                rename  │   └──────── reactivate ───┘
                301 ────┘
```

`isActive:false` is the "tombstone" state: routable lookups 404, the unique `(destinationSlug, slug)` pair is still occupied so nothing else can take the URL. A hard delete frees the pair only after the cooldown window expires.

---

## 5. Step-by-step create cycles (per entity)

Each cycle runs inside a single Prisma `$transaction`: if any step throws, **everything rolls back** and no slug is claimed.

### 5.1 Create a DESTINATION (admin)

`destinations.service.ts` `create()`.

```text
Admin submits: { name: "Curaçao", slug?: "curacao", region: CARIBBEAN, heroImage, … }

1. slug = generateSlug(dto.slug ?? dto.name)                 // "Curaçao" → "curacao"
2. BEGIN TRANSACTION
3. destination.create({ name, slug, region, …, createdBy })  // P2002 on slug → 409 "already exists"
4. slugRegistry.create({ destinationSlug:"curacao", slug:"tours",
                         entityType: RESERVED, entityId: null })   // reserve the listing URL
5. categories = category.findMany({ isActive: true })        // every global category that exists now
6. IF categories.length > 0:
     slugRegistry.createMany(categories.map(c => ({
       destinationSlug:"curacao", slug:c.slug, entityType: CATEGORY, entityId:c.id })))
7. COMMIT  → log "seeded N category slug(s) + 1 reserved"
```

**Rows written:** 1 `RESERVED` (`tours`) + 1 `CATEGORY` row per already-existing active category.

### 5.2 Create a CATEGORY (admin)

`categories.service.ts` `create()`. Categories are **global** — one category spans every island.

```text
Admin submits: { name: "Boat Tours", slug?: "boat-tours", description?, icon?, sortOrder?, … }

1. slug = generateSlug(dto.slug ?? dto.name)                 // "boat-tours"
2. BEGIN TRANSACTION
3. category.create({ name, slug, …, createdBy })             // P2002 on slug → 409
4. destinations = destination.findMany({ isActive: true })   // fan out across all islands
5. IF destinations.length > 0:
     slugRegistry.createMany(destinations.map(d => ({
       destinationSlug:d.slug, slug:"boat-tours", entityType: CATEGORY, entityId: category.id })))
6. COMMIT  → log "seeded N slug_registry row(s)"
```

**Rows written:** 1 `CATEGORY` registry row **per active destination**. **No FeaturedSlot rows** (§4.2).
**Result:** `/curacao/boat-tours/`, `/aruba/boat-tours/`, … all resolve to this one category. The page does not *render* until that destination has **≥3 published tours** in the category (the gating rule, master §2.4 — see [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) §7).

### 5.3 Create an ACTIVITY HUB (admin)

`hubs.service.ts` `create()`. A hub is **destination-scoped** (one island).

```text
Admin submits: { name: "Klein Curaçao", destinationId, hubType: HIGHLIGHT, … }
                 // hub does NOT accept an explicit slug — always derived from name

1. slug = generateSlug(dto.name)                             // "klein-curacao"
2. BEGIN TRANSACTION
3. destination = destination.findUnique({ id: destinationId })   // 404 if missing
4. hub.create({ destinationId, name, slug, hubType, …, createdBy })   // P2002 → 409
5. slugRegistry.create({ destinationSlug: destination.slug, slug: "klein-curacao",
                         entityType: HUB, entityId: hub.id })          // P2002 → 409
6. COMMIT
```

**Rows written:** exactly 1 `HUB` registry row. A hub is a **discovery tag** — never a URL prefix for its tours.

### 5.4 Create a COLLECTION (admin)

`collections.service.ts` `create()`. Destination-scoped, manual or dynamic/filtered.

```text
1. slug = generateSlug(dto.slug ?? dto.name)
2. BEGIN TRANSACTION
3. collection.create({ destinationId, name, slug, … })       // P2002 → 409
4. slugRegistry.create({ destinationSlug, slug, entityType: COLLECTION, entityId: collection.id })
5. COMMIT
```

Collection slugs must be **semantically distinct** from category slugs (`top-10-tours` correct, never `boat-tours-private` — that should be a filtered category URL instead, [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) §11.3).

### 5.5 Create a TOUR (operator, or admin)

`trips.service.ts` `create()`. The most defensive cycle — tour slugs share the destination namespace with categories, hubs, collections, and the reserved `tours` slug.

```text
Operator submits: { name, slug?, destinationId, categoryIds:[…], primaryCategoryId?,
                    hubIds?:[…], pricingModel, basePrice?, … }

1. operatorId = resolveOperatorId(userId, role)   // user.id → operator.id (admin auto-provisions)
2. baseSlug   = generateSlug(dto.slug ?? dto.name)
3. Validate destination  → must exist AND isActive            // else 400
4. Validate categories: dedupe; require ≥1; primaryCategoryId ∈ categoryIds; each exists+isActive
5. slug = resolveUniqueSlug(baseSlug, destinationId, destinationSlug, operatorId)   // ← see §6.x below
6. BEGIN TRANSACTION
7.   Validate each hubId (TOCTOU-safe, inside tx): exists+isActive; same destination; allowed-category match
8.   trip.create({ … categories:{create:…(one isPrimary)}, hubs:{create:…} })   // P2002 on slug → 409 (race)
9.   slugRegistry.create({ destinationSlug, slug: trip.slug, entityType: TOUR, entityId: trip.id, isActive:true })
10. COMMIT
```

**Rows written:** 1 `Trip` + N `TourCategory` (one `isPrimary`) + M `TourHub` + **always** 1 `TOUR` registry row. The tour belongs to exactly **1 destination, 1+ categories, 0–n hubs**; categories/hubs drive discovery and filtering only — never the URL.

---

## 6. Slug collision resolution (`resolveUniqueSlug`) — implementation note

This is the algorithm `trips.service.ts` uses today so two operators can both name a tour the same thing and still get clean, distinct flat URLs. It is an **implementation detail**, reconciled below with the new 301/cooldown rules.

**Step 1 — normalize.** `generateSlug()` lowercases, ASCII-folds (Curaçao → curacao), strips punctuation, hyphen-joins words → the **base slug** (`"Klein Curaçao Boat Trip"` → `klein-curacao-boat-trip`).

**Step 2 — own-duplicate guard.** If *this same operator* already has the base slug at this destination → `409` immediately (they are duplicating their own listing; no auto-rename).

**Step 3 — cross-entity collision check.** In parallel, look for any **trip** (any operator) with that slug at this destination, and any **slug_registry** row at `(destinationSlug, baseSlug)`. If **both empty** → the base slug is free, use it as-is. (This check must also treat a slug still inside its 90-day cooldown as taken — §7.)

**Step 4 — suffix with operator identity (one attempt, never numeric).** If the slug is claimed by *another* entity, append the operator identity once:

```text
suffix    = generateSlug(companyName ?? userName ?? operatorId[:8])   // e.g. "bluefin-charters"
candidate = "klein-curacao-boat-trip-bluefin-charters"
```

Re-check the candidate against both the trips table and the registry:
- free → use it;
- taken by *this* operator → `409` (own duplicate);
- taken by *another* entity → **`409` "choose a different tour name or slug"**.

**No numeric suffix is ever tried** (`-2`, `-3`, …) — numbers are confusing for users and poor for SEO. The operator-name suffix is the single fallback; a further collision is rejected.

**Step 5 — atomic claim.** The winning slug is written as `Trip.slug` **and** the `TOUR` registry row in the same transaction. A unique-constraint race between the pre-check and the write is caught as `409 "taken concurrently, retry"`.

> **Worked example:** Operator A → `klein-curacao-boat-trip`. Operator B (Bluefin Charters), same name → `klein-curacao-boat-trip-bluefin-charters`. Operator C whose suffix also collides → rejected with `409`; must rename. No `-1`/`-2` is ever generated.

---

## 7. 301 redirects on rename, and the 90-day reuse cooldown (master §2.3)

The master supersedes the older "slugs are immutable, no redirect table" stance. Slugs **can** change, and two mechanisms keep old links and the search index safe.

### 7.1 Rename → automatic 301

When an entity's slug is changed:

1. In the same transaction, the registry row's `slug` is updated to the new value.
2. A **redirect entry** is written to a redirect table mapping the **old** `(destinationSlug, oldSlug)` → the new flat URL, with `status = 301`.
3. The public resolver checks the redirect table **before** returning a 404: a request for the old slug issues a permanent redirect to the new canonical URL ([`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) §5.1).

A suggested redirect table (target schema, not yet built):

```prisma
model SlugRedirect {
  id              String   @id @default(uuid())
  destinationSlug String   // 'curacao'
  fromSlug        String   // old slug being vacated
  toSlug          String   // new slug (or full target path for cross-type moves)
  statusCode      Int      @default(301)
  createdAt       DateTime @default(now())

  @@unique([destinationSlug, fromSlug])
  @@map("slug_redirects")
}
```

### 7.2 Deletion → 90-day cooldown before reuse

A hard-deleted slug is **not** immediately available to a new entity. The freed `(destinationSlug, slug)` pair is held for **90 days** (the soft-delete cooldown) so that stale external links and indexed URLs are not silently rebound to an unrelated page. After the cooldown the slug may be reclaimed.

Implementation options (target): keep a tombstone row with a `deletedAt` timestamp and refuse reuse until `now > deletedAt + 90 days`, or carry the cooldown in the redirect/registry table. `resolveUniqueSlug` (§6 step 3) must treat a slug still inside its cooldown window as **taken**.

> **Reconciling §6 with §7:** the operator-name-suffix collision logic is unchanged for *concurrent* live entities. The 301/cooldown rules add two extra "taken" conditions to the freshness check: a slug with an outstanding 301 source, and a slug inside its 90-day cooldown, both count as unavailable for a new claim.

---

## 8. How the FRONTEND uses the registry

### 8.1 Resolve endpoint

```text
GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}
```

- Looks up the unique `(destinationSlug, slug)` row.
- **404 if the row is missing OR `isActive === false`** (tombstoned slugs are not-found to the public router) — *unless* a 301 redirect entry exists for that old slug, in which case it redirects first (§7.1).
- On success returns `{ destinationSlug, slug, entityType, entityId }`.

### 8.2 Routing switch & depth rule

The Next.js `[locale]/[destination]/[slug]` route resolves first, then branches on `entityType` (full switch in [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) §5.2). The destination root `/{dest}/` is matched directly against `Destination.slug`, not the registry. There is no 2-segment tour URL.

### 8.3 Category-gating nuance

A `CATEGORY` resolve succeeding is **necessary but not sufficient**. Category pages additionally gate on **≥3 published tours** at that destination (master §2.4); below the threshold the category service returns 404 and the category is `status: draft` (excluded from nav, sitemaps, internal links, search). The registry answers *"what is this slug?"*; the category service answers *"is this page allowed to render right now?"*.

---

## 9. Invariants checklist (for reviewers)

- [ ] Every registry write is inside the entity's create/update `$transaction`.
- [ ] Category create → one row **per active destination**. **No FeaturedSlot rows** (slots removed).
- [ ] Destination create → one `RESERVED 'tours'` row (+ one row per existing active category). 20 protected slugs per destination once all 19 categories exist.
- [ ] Tour create → **always** one `TOUR` row; archive/restore toggle `isActive`; hard remove deletes it.
- [ ] No code path writes a registry row on a *translation* or a page-content edit.
- [ ] Rename → 301 entry written + registry `slug` updated, same transaction.
- [ ] Hard delete → slug held in a 90-day cooldown before reuse; `resolveUniqueSlug` treats in-cooldown slugs as taken.
- [ ] Deactivate → `isActive:false` (row kept); force-delete → row removed.
- [ ] `entityId` is `null` **iff** `entityType === RESERVED`.
- [ ] Public `resolve()` treats `isActive:false` as 404 (after checking the 301 redirect table).

---

## 10. Implementation status (as of 2026-06-20)

| Piece | Status |
|---|---|
| `SlugRegistry` table + `resolve()` endpoint | Built |
| Transactional write sites (destination/category/hub/collection/tour) | Built |
| `resolveUniqueSlug()` (operator-name suffix, no numerics) | Built |
| Flat `TOUR` rows / no hub-nesting | Built |
| Category-create FeaturedSlot seeding | **Exists in code — must be REMOVED** (slots gone) |
| `SlugRedirect` table + 301-on-rename | **Not built** — target (master §2.3) |
| 90-day reuse cooldown | **Not built** — target (master §2.3) |
| Category gating threshold | Built at **≥1** — must change to canonical **≥3** (master §2.4) |

---

## 11. Related docs

- [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) — how rows are read to route a request, the two 404 layers, breadcrumbs.
- [`SEO-STRATEGY.md`](./SEO-STRATEGY.md) — canonical/hreflang, sitemaps, why renames issue a 301.
- [`SOFT-DELETE-STRATEGY.md`](./SOFT-DELETE-STRATEGY.md) — `isActive` tombstone semantics and the cooldown rationale.
- [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md) — commission tiers + ranking + eligibility (what replaced the removed FeaturedSlot economy).
- [`../04-multilingual/MULTILINGUAL-CONTENT.md`](../04-multilingual/MULTILINGUAL-CONTENT.md) — why slugs are English-only; locale routing.
- `CLAUDE.md` — Critical Rules #4, #5, #8 (slug registry transactional integrity, fan-out, flat tour URLs).
