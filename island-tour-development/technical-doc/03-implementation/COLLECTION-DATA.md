# Collection page - data & logic

> What data a collection needs, how it should be shaped, and the logic for rendering one. Reconciles
> the current schema (`backend/prisma/collections.prisma`) against the master and the Figma collection
> page. Companion to `TOUR-MODULE-DATA.md`, `BOOKING-AND-PAYMENT-DATA.md`, `SPOTLIGHT-DATA.md`.
>
> Sources (master is canonical, it wins on any conflict):
> - master 5.6 "Collection page" + the long-form drawer "Collection Page is the persona/intent layer"
> - master E.5 "collections" (field list)
> - `02-architecture/PLATFORM-ARCHITECTURE.md` §3-4 (discovery layers, Hub vs Collection rule)
> - Figma `island-tours-ui` node `47433-2051` (Best Things to Do - the locked reference design)
>
> Legend: **✓** present today · **+ TO ADD** missing/recommended · **W** = writer (`ADM` admin,
> `SYS` system/computed, `RO` read-only/derived).

---

## 0. What a collection is (and is not)

| | |
|---|---|
| Job | A **persona or intent-driven curated list** (best things to do, couples, families, day trips). The only page type that cuts **across** activity categories on a persona/intent basis. |
| URL | `/{locale}/{destination}/{collection-slug}/` (flat, one slug per destination) |
| Created by | **Admin only** (editorial). Writes a `COLLECTION` `slug_registry` row in the same transaction. |
| Two kinds | **MANUAL** = an ordered `tourIds[]` list (the order IS the product). **DYNAMIC** = a saved `filterQuery` resolved at read time. |
| Commission | **Never influences curation or order.** No Sponsored badge ever appears on a collection card. |

**Hub vs Collection (the guard):** a Hub is anchored to a **place/landmark** and carries rich
informational content + comparison logic; a Collection is anchored to a **persona/intent** and is
primarily a curated tour list with a short intro. The slug registry enforces one slug -> one page type
per destination, so the collection slug **must not collide with a category slug** (cannibalization
guard - already noted on `Collection.slug` and enforced by the unique `slug_registry` row).

---

## 1. Page anatomy - the 7 sections (Figma traceability)

Master 5.6 and the Figma node both lock the same 7-section layout. Each section mapped to its data:

| # | Section (Figma text) | Data source | Status |
|---|---|---|---|
| 1 | **Nav** (`Curaçao` · `Categories` · `Search` · `EN`) + breadcrumb `Home / Curaçao / Collections / Best things to do` | Global nav + `breadcrumbLabel` (translation) | ✓ |
| 2 | **Thin editorial banner** (~300px, text on gradient): eyebrow `BEST THINGS TO DO` · H1 `The 10 best things to do in Curaçao` · curation note `Chosen by Islanders - in the order we'd book them` · fast stats `10 tours · From $36` · `Share` pill | `heroImage` ✓ · H1 `h1Override` ✓ · **eyebrow + curation note = GAP** · fast stats = **derived** | partial |
| 3 | **One-sentence intro** (body text, max 30 words, AEO "include" structure) | `CollectionTranslation.overview` ✓ (apply the 30-word + AEO directive) | ✓ |
| 4 | **Curated 3-column grid** - no sort, no filter chips. Each card: numbered badge `01`-`10`, rating `4.8 (1,738)`, title, **rationale sentence**, duration, `From $X`, `Free cancellation` | `tourIds[]` order ✓ · card facts come from the Tour ✓ · **per-card rationale = the main GAP (§5)** · badge style = **GAP (§8)** | partial |
| 5 | **Need help before booking?** (`Chat on WhatsApp`, trust lines) with the collection FAQ as the right column | Static block + FAQ (§6) | ✓ |
| 6 | **FAQ** - 6 AEO questions, FAQPage schema | `Faq` polymorphic, `pageType='collection'` (§6) | **GAP (wire-up)** |
| 7 | **Keep exploring** (`Best for couples` / `Best for families` / `Day trips`) + recovery CTA `Not sure yet? See all Curaçao tours ->` | Related collections - **derived** (§7) | derived |

The Figma card rationale lines (e.g. *"An uninhabited island, 10km offshore, sea turtles, no signal.
The day Curaçao is famous for."*) are exactly the **Collection Rationale** field from master E.5 / 5.6.
They are not Tour fields - they are per-collection, per-tour, per-locale editorial copy, and they are
**not modeled anywhere today**. This is the single biggest gap (§5).

---

## 2. `Collection` entity (current vs needed)

| Field | Type | W | Master / Figma | Status |
|---|---|---|---|---|
| `id` | uuid | SYS | E.5 | ✓ |
| `destinationId` | FK | ADM | E.5 `destination_id` | ✓ |
| `name` | string | ADM | E.5 | ✓ |
| `slug` | string | ADM | E.5; unique per dest; no category collision | ✓ |
| `collectionType` | `CollectionType` (MANUAL/DYNAMIC) | ADM | E.5 `collection_type` | ✓ |
| `tourIds[]` | String[] | ADM | E.5 `tour_ids[]` - ordered editorial list (MANUAL) | ✓ (see §5 note) |
| `filterQuery` | Json? | ADM | E.5 `filter_query` (DYNAMIC) | ✓ |
| `heroImage` | string? | ADM | E.5 `hero_image` (banner image) | ✓ |
| `sortOrder` | string | ADM | E.5 `sort_order` - **applies to DYNAMIC only**; MANUAL order = `tourIds[]` | ✓ (add directive) |
| `isActive` | bool | ADM | toggles slug-registry `is_active`; page 404s when false | ✓ |
| `isSeeded` | bool | SYS | protects seeded rows | ✓ |
| `createdBy` | string? | ADM | audit | ✓ |
| `createdAt` / `updatedAt` | DateTime | SYS | E.5 timestamps | ✓ |
| **`status`** | enum | ADM | E.5 lists `status`. Today only `isActive` boolean. The "rationale required before publish" rule implies a real draft state. **+ TO ADD** `CollectionStatus { DRAFT, PUBLISHED, ARCHIVED }` (or keep `isActive` + a publish guard - decide, see §9 G5) | **GAP** |
| **`displayStyle`** | enum | ADM | numbered badges `01`-`10` only on "Best Things to Do" / "Top 10"; persona collections get a peach card-#1 highlight instead. **+ TO ADD** `CollectionDisplayStyle { NUMBERED, PERSONA }` (§8) | **GAP** |

---

## 3. `CollectionTranslation` (per-locale text)

| Field | Type | Master / Figma | Status |
|---|---|---|---|
| `name` | string? | falls back to `Collection.name` | ✓ |
| `overview` | string? | **the section-3 intro** - one sentence, **max 30 words**, AEO "include" structure | ✓ (apply directive) |
| `h1Override` | string? | banner H1 (`The 10 best things to do in Curaçao.` - period required on Best Things to Do) | ✓ |
| `breadcrumbLabel` | string? | breadcrumb leaf (`Best things to do`) | ✓ |
| **`eyebrowLabel`** | string? | banner eyebrow / persona label (`BEST THINGS TO DO`). Distinct from H1 and breadcrumb. **+ TO ADD** (or derive by upper-casing `name` - flag the choice) | **GAP** |
| **`curationNote`** | string? | banner subtitle (`Chosen by Islanders - in the order we'd book them`). **+ TO ADD** | **GAP** |
| `isMachineTranslated` | bool | translation provenance | ✓ |

> Reminder: translation upserts use the `{ fields: { ... } }` wrapper. English (base locale) keeps
> `name` read-only and "delete translation" clears fields rather than deleting the row (same pattern as
> Category/Hub).

---

## 4. `CollectionPageContent` (per-locale SEO + long copy)

| Field | Type | Master / Figma | Status |
|---|---|---|---|
| `aboutText` | string? | optional long-form editorial body | ✓ |
| `metaTitle` | string? | E.5 `meta_title` | ✓ |
| `metaDescription` | string? | E.5 `meta_description` | ✓ |

No gap here. (SEO + about copy already covered for the page; the tour module still needs its own SEO
fields - see `TOUR-MODULE-DATA.md` §1.8.)

---

## 5. Collection Rationale - the per-tour editorial line (MAIN GAP)

Master E.5: `collection_rationale` **(per tour, per locale)** - *"Required CMS field before publish,
max 20 words."* Master 5.6: *"Collection Rationale is a required CMS field before publish."* Figma:
the sentence under every card title. **Nothing in the schema models this today.**

`tourIds String[]` stores order but cannot hang per-tour-per-locale copy off it. Recommended fix -
promote the array to a join table so order + rationale live together:

```prisma
// MANUAL collections: ordered membership + per-locale rationale.
model CollectionTour {
  id           String   @id @default(uuid())
  collectionId String
  tourId       String
  position     Int                      // editorial order (the product)
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  // tour relation as appropriate
  translations CollectionTourRationale[]
  @@unique([collectionId, tourId])
  @@index([collectionId, position])
  @@map("collection_tours")
}

model CollectionTourRationale {
  id               String   @id @default(uuid())
  collectionTourId String
  locale           Locale
  rationale        String                 // max 20 words (validate in service)
  collectionTour   CollectionTour @relation(fields: [collectionTourId], references: [id], onDelete: Cascade)
  @@unique([collectionTourId, locale])
  @@map("collection_tour_rationales")
}
```

- **Validation:** `rationale` <= 20 words; **required for the base locale before a MANUAL collection
  can be published** (this is what `status`/publish guard enforces, §9 G5).
- **DYNAMIC collections:** rationale is optional (cards come from a live query, not curated copy).
- **Lighter alternative** (if you keep `tourIds[]`): a standalone
  `CollectionRationale(collectionId, tourId, locale, text)` table. The join-table approach is cleaner
  because it co-locates order + membership + copy and matches the rest of the schema's relational style.

---

## 6. Collection FAQ (6 AEO questions)

Master E.5 lists `faq[]` as JSON; master 5.6 says **6 AEO questions with FAQPage schema**. The
platform already has a **polymorphic `Faq`** model (`question`, `answer`, `displayOrder`, `locale`,
`isActive`, `pageType` + `entityId`) used by category/hub/destination/tour.

**Directive:** reuse the polymorphic `Faq` with `pageType='collection'` (extend the comment list in
`faq.prisma` - it currently reads `'category' | 'hub' | 'destination' | 'tour'`). Do **not** add a JSON
blob on `Collection`; FAQ rows are content and should be queryable/translatable like every other FAQ.
The 6 locked questions for Best Things to Do (verbatim in Figma):

1. What are the best things to do in Curaçao?
2. How far in advance should I book these tours?
3. When is the best time to visit Curaçao?
4. Do these tours include hotel pickup?
5. Can I combine multiple tours in one trip?
6. How does Island Tours choose which tours to feature? *(master B.23: was "Are these paid placements?")*

---

## 7. Derived / computed (no schema change)

| Surface | How it is computed |
|---|---|
| **Fast stats** `10 tours · From $36` | count of resolved tours + `min(fromPrice)` across them (in the active currency) |
| **Card facts** (rating, duration, From $X, Free cancellation) | read from each resolved Tour; the collection stores only order + rationale |
| **"Keep exploring" related collections** (3 cross-intent cards) | derived: other active collections in the same destination, excluding self. Curate later only if editorial control is needed - default to dynamic. |
| **Recovery CTA** `See all Curaçao tours ->` | links to `/{locale}/{destination}/` - no data |

---

## 8. Display rules (master 5.6, locked)

- **Numbered badges** `01`-`10`: only on **Best Things to Do** and **Top 10** collections -> drive via
  `displayStyle = NUMBERED` (§2). Numbered badges **never** appear on destination sections.
- **Persona collections** (couples/families/day trips): **no numbers**; a **peach highlight marks card
  #1** instead -> `displayStyle = PERSONA`.
- **No Sponsored badge** on collection cards, ever. **Commission never influences curation or order.**
- Card price label is always **"from $X"**.

---

## 9. Gap summary (apply order)

| # | Gap | Where | Severity |
|---|---|---|---|
| **G1** | **Collection Rationale** per tour/locale (required before publish, max 20 words) - not modeled | new `CollectionTour` + `CollectionTourRationale` (§5) | **High** - on every card in Figma + master E.5 |
| **G2** | `curationNote` (banner subtitle) per locale | `CollectionTranslation` (§3) | Medium |
| **G3** | `eyebrowLabel` / persona label per locale (or derive from `name`) | `CollectionTranslation` (§3) | Low (decide: store vs derive) |
| **G4** | `overview` directive: max 30 words + AEO "include" structure (no new field, validation/doc only) | `CollectionTranslation` | Low |
| **G5** | `status` - master lists it; today only `isActive`. Needed for the "rationale required before publish" gate | `Collection` + `CollectionStatus` enum (§2) | Medium |
| **G6** | `displayStyle` (NUMBERED vs PERSONA) for badge/peach rules | `Collection` + enum (§2, §8) | Medium |
| **G7** | FAQ wire-up: add `'collection'` to `Faq.pageType`; do not use a JSON blob | `faq.prisma` (§6) | Medium |
| **G8** | `sortOrder` directive: applies to DYNAMIC only; MANUAL order = `tourIds[]`/`CollectionTour.position` | service rule | Low |

Everything else in master E.5 (`id`, `name`, `slug`, `destination_id`, `collection_type`,
`tour_ids[]`, `filter_query`, `hero_image`, `meta_title`, `meta_description`, timestamps) is **already
present**.

---

## 10. Render logic - how a collection page is built

```
GET /{locale}/{destination}/{collection-slug}/
  1. slug_registry resolves slug -> entity_type='collection', entity_id. is_active=false -> 404.
  2. Load Collection (+ translation for locale, + page content for SEO).
  3. Resolve tours:
       MANUAL  -> CollectionTour ordered by position; attach each tour's CollectionTourRationale[locale].
       DYNAMIC -> run filterQuery against published tours in the destination, then apply sortOrder.
  4. Compute fast stats (count + min fromPrice) over the resolved set.
  5. Load Faq rows (pageType='collection', entityId=collection.id, locale, isActive) ordered by displayOrder.
  6. Related collections: other active collections in the destination, excluding self (cap 3).
  7. Render badges per displayStyle (NUMBERED -> 01..n; PERSONA -> peach on card #1).
```

**Publish guard (G5):** a MANUAL collection may go `PUBLISHED` only when every member tour has a base
-locale rationale (<=20 words), `heroImage` is set, and the base-locale H1/overview exist. DYNAMIC
collections skip the per-tour rationale requirement.

---

## 11. Write & ownership

- **Admin-only** create/edit/delete (`CREATE_COLLECTION` / `EDIT_COLLECTION` / `DELETE_COLLECTION`).
  Operators never touch collections - they are editorial.
- Create/rename/disable is **transactional with the `slug_registry` row** (create writes one
  `COLLECTION` row for the destination; rename issues a 301 + 90-day cooldown; `isActive=false` flips
  the registry row's `is_active` and the page 404s).
- `isSeeded=true` rows are delete-protected (same rule as destinations/categories).

---

## 12. API surface (suggested, base `/api/v1`)

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/collections?destinationId=` | public/ADM | List collections for a destination |
| `GET` | `/collections/:slug?destinationId=&locale=` | public | Full render payload (§10) |
| `POST` | `/collections` | ADM | Create (+ slug-registry row) |
| `PATCH` | `/collections/:id` | ADM | Edit fields / membership / filterQuery |
| `PUT` | `/collections/:id/tours` | ADM | Replace ordered membership (MANUAL) |
| `PUT` | `/collections/:id/translations/:locale` | ADM | Upsert translation (`{ fields: {...} }`) |
| `PUT` | `/collections/:id/tours/:tourId/rationale/:locale` | ADM | Upsert per-tour rationale (G1) |
| `DELETE` | `/collections/:id` | ADM | Delete (blocked if `isSeeded`) |

FAQ is managed through the shared FAQ endpoints with `pageType='collection'`.
