# Activity Hub page - data & logic

> What data an Activity Hub needs, how it should be shaped, and the logic for rendering one.
> Reconciles the current schema (`backend/prisma/destinations.prisma` - the `Hub*` models) against the
> master and the Figma hub page. Companion to `COLLECTION-DATA.md`, `TOUR-MODULE-DATA.md`.
>
> Sources (master is canonical, it wins on any conflict):
> - master 5.5 "Activity Hub page" + the long-form drawer (hero, fast facts, anchor nav, sections)
> - master E.4 "activity_hubs" (field list)
> - `02-architecture/PLATFORM-ARCHITECTURE.md` §3-4 (discovery layers, Hub vs Collection rule)
> - Figma `island-tours-ui` node `48024-11145` (Klein Curaçao - the locked reference design)
>
> Legend: **✓** present today · **+ TO ADD** missing/recommended · **W** = writer (`ADM` admin,
> `SYS` system/computed, `RO` read-only/derived).

---

## 0. What an Activity Hub is (and is not)

| | |
|---|---|
| Job | **One place, highlight, or area with full decision support.** The platform's **primary Google Ads landing page**. The only list-type page that **earns a full hero image** (pages that sell a specific place get a hero; pages that just list options - All Tours, Category - get a thin header). |
| URL | `/{locale}/{destination}/{hub-slug}/` (flat, one slug per destination) |
| Created by | **Admin only** (editorial). Writes a `HUB` `slug_registry` row in the same transaction. Operators never create hubs. |
| Hub types | `location` (Klein Curaçao) / `highlight` (Dolphins) / `area` (West Coast) - each with its own anchor-nav set and content template. |
| Tour link | A tour attaches to **0-n hubs** (`TourHub`); hubs are **discovery tags with no URL effect** on the tour. A hub only shows tours whose category is in its allowed-category list. |

**Hub vs Collection:** a Hub is anchored to a **place/landmark** with rich informational content +
comparison logic; a Collection is anchored to a **persona/intent** and is mostly a curated list. The
slug registry enforces one slug -> one page type per destination.

---

## 1. Page anatomy - Figma traceability (Klein Curaçao reference)

Master 5.5 and the Figma node lock the same top-to-bottom structure. Each section mapped to its data:

| # | Section (Figma text) | Data source | Status |
|---|---|---|---|
| 1 | **Nav + breadcrumb** `Home / Curaçao / Klein Curaçao` | global nav + `breadcrumbLabel` | ✓ |
| 2 | **Full hero**: H1 `Klein Curaçao day trips` + tagline `Where islanders send their visitors` + **fast facts** `Full day (8-9h) · From $120 · BBQ lunch · Daily` + date picker `Select date` / `Check Availability` | `heroImage` **GAP** · H1 `h1Override` ✓ · **tagline GAP (§2)** · **fast facts GAP (§6)** · date picker = availability | partial |
| 2b | **Sticky anchor nav** (5 locked): `Why Klein Curaçao` · `Trips` · `Private charters` · `Compare` · `Discover` | template-driven from sections present | derived |
| 3 | **Editorial lead** `Why Klein Curaçao` - *"The best beach in Curaçao isn't on Curaçao..."* (max 150 words, no visible header) | `HubTranslation.overview` ✓ (apply 150-word directive) | ✓ |
| 4 | **Shared tours grid** `9 Klein Curaçao day trips. Pick yours.` - filter chips + date; cards carry a **`Sponsored` badge** (hubs DO show it, unlike collections) | `TourHub` membership + tour facts; ranked by tier/quality | ✓ (derived) |
| 5 | **Private charters** `14 private charters. Yours alone.` split into `Day charters (11)` + `Overnight charters (3)` | derived: hub tours where `bookingType=PRIVATE` (whole-unit pricing) | ✓ (derived) |
| 6 | **Our Pick** `We've been on every boat` - 3 picks `BEST OVERALL` / `MOST POPULAR` / `BEST FOR FAMILIES`, **tour titles not operator names**, editorial blurb each | `HubOurPick` (+ `HubPickType`) ✓ - **per-locale blurb GAP (§7)** | partial |
| 7 | **Comparison table** `Which trip is right for you?` - two groups `Comfort trips` / `Adventure trips`, frozen first column, booking buttons in header, tour-title columns. Rows: What stands out · On the island · Breakfast · Open bar · Crossing · Boat & group · Free cancel · from $X | `HubComparisonGroup` + `HubComparisonTour` exist, but **the cell/row values are not modeled (§8)** | partial |
| 8 | **Discover deep-dive** `Discover Klein Curaçao` - named subsections: The White Beach · History · Sea Turtles · Snorkeling & Diving · The Pink Lighthouse · Shipwrecks | **content sections - GAP (§5)**; today only a single `aboutText` | **GAP** |
| 9 | **Local tips** `What we tell first-timers...` - ~8 titled tip cards (Take water shoes, Sit at the back, ...) | **content sections - GAP (§5)** | **GAP** |
| 10 | **FAQ** `Frequently asked questions` - 7+ AEO questions, FAQPage schema (Figma shows 9) | polymorphic `Faq`, `pageType='hub'` (§10) | ✓ (wired) |
| 11 | **Related hubs** `Also worth your time on Curaçao` - 3 cross-hub cards | derived (§11) | derived |
| 12 | **Footer** | global | ✓ |

> **Mandatory sections** (master 5.5): Discover ("Our {hub}"), Local Tips, Related Hubs. The editorial
> H2 defaults to "Our {hub}" via i18n template; a hub may override it per locale and the override passes
> the LD9 banned-list check. **No trust bar** on hubs. Share pill matches the tour page.

---

## 2. `Hub` entity (current vs needed)

| Field | Type | W | Master / Figma | Status |
|---|---|---|---|---|
| `id` | uuid | SYS | E.4 | ✓ |
| `destinationId` | FK | ADM | E.4 `destination_id`; mandatory | ✓ |
| `name` | string | ADM | E.4 | ✓ |
| `slug` | string | ADM | E.4; unique per destination | ✓ |
| `description` | string? | ADM | E.4 `short_description` (card/meta blurb). Rename/clarify intent. | ✓ (clarify) |
| `hubType` | `HubType?` | ADM | E.4 `hub_type` location/highlight/area. **Nullable today** (Stage 1 backfill); master treats it as set. | ✓ (tighten to required after backfill) |
| `latitude` / `longitude` | Float? | ADM | E.4; location-type hubs | ✓ |
| `isSeeded` / `isActive` | bool | ADM/SYS | delete-guard + slug-registry `is_active` toggle | ✓ |
| `createdBy` / timestamps | - | - | audit | ✓ |
| **`heroImage`** | string? | ADM | E.4 `hero_image`. The hub's defining feature - full-bleed hero. **Not on the schema today.** **+ TO ADD** | **GAP (High)** |
| **`ogImage`** | string? | ADM | E.4 `og_image`. **+ TO ADD** (Destination has it; Hub doesn't) | **GAP** |
| **`status`** | enum | ADM | E.4 lists `status`; today only `isActive` boolean. **+ TO ADD** `HubStatus { DRAFT, PUBLISHED, ARCHIVED }` or keep `isActive` + publish guard (decide, §13 G6) | **GAP** |

`HubTranslation` adds the per-locale **`heroTagline`** below (§3, the `Where islanders send their
visitors` line - distinct from H1).

---

## 3. `HubTranslation` (per-locale text)

| Field | Type | Master / Figma | Status |
|---|---|---|---|
| `name` | string? | falls back to `Hub.name` | ✓ |
| `overview` | string? | **the editorial lead** ("Why Klein Curaçao", max 150 words, no header) | ✓ (apply directive) |
| `h1Override` | string? | hero H1 (`hub_h1`, per hub per locale, **never templated**) | ✓ |
| `breadcrumbLabel` | string? | breadcrumb leaf | ✓ |
| **`heroTagline`** | string? | hero subtitle under H1 (`Where islanders send their visitors`). Figma splits H1 and tagline; not modeled. **+ TO ADD** | **GAP** |
| `isMachineTranslated` | bool | provenance (hubs: proper nouns, admin-set, usually false) | ✓ |

---

## 4. `HubPageContent` (per-locale SEO)

| Field | Type | Master / Figma | Status |
|---|---|---|---|
| `aboutText` | string? | currently the only long-copy slot - **insufficient** for the multi-block Discover + Local Tips (§5) | ✓ (keep, but not enough) |
| `metaTitle` / `metaDescription` | string? | E.4 | ✓ |

---

## 5. Content sections - Discover + Local Tips (MAIN GAP)

Master E.4: `content_sections[]` JSON `{heading, body}` - *"Discover, Local Tips and the editorial
blocks."* Figma proves this is **multi-block, ordered, and titled**:

- **Discover Klein Curaçao**: 6 named subsections - The White Beach, History, Sea Turtles, Snorkeling
  & Diving, The Pink Lighthouse, Shipwrecks (each heading + body).
- **Local tips** ("What we tell first-timers..."): ~8 titled tip cards - Take water shoes, Sit at the
  back, No need to rush ashore, Bring reef-safe sunscreen, Book weeks ahead, Mind the lighthouse stairs...

Today there is **only `HubPageContent.aboutText`** (one blob). That cannot carry titled, ordered,
per-locale blocks. Recommended fix - a relational, typed, per-locale section table:

```prisma
enum HubSectionType {
  DISCOVER     // "Discover {hub}" deep-dive subsection
  LOCAL_TIP    // a first-timer tip card
  EDITORIAL    // any extra editorial block
}

model HubContentSection {
  id           String   @id @default(uuid())
  hubId        String
  locale       Locale
  sectionType  HubSectionType
  heading      String
  body         String
  displayOrder Int      @default(0)
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  @@index([hubId, locale, sectionType, displayOrder])
  @@map("hub_content_sections")
}
```

- **Why relational, not master's literal JSON:** matches the rest of the schema (per-locale rows,
  queryable, translatable per block, ordered). Master's `content_sections[] JSON {heading, body}` is
  the lighter alternative if you prefer a single JSON column on `HubPageContent` - call it
  `contentSections Json?` keyed by `sectionType`. Either satisfies master; the table is cleaner.
- The editorial H2 override ("Our {hub}" -> custom) can live as an `EDITORIAL` section heading or a
  dedicated `HubTranslation` field; pick one and document it.

---

## 6. Fast facts bar (hero) - GAP

Master locks a **4-fact** hero bar; Figma shows `Full day (8-9h)` · `From $120` · `BBQ lunch` · `Daily`.
Some facts are **derived** (Price from = `min(fromPrice)` across hub tours; Daily = from departures),
but others are **hub-specific editorial** (`45min-1.5h crossing · 10km offshore`, `BBQ lunch included`)
and are **not stored anywhere today**.

**+ TO ADD** a per-locale fast-facts store. Simplest: `HubContentSection` rows with a `FAST_FACT` type
(label + value packed into heading/body), or a dedicated `fastFacts Json?` per locale on
`HubPageContent` (`[{icon, label, value}]`). Flag: decide store vs derive per fact - at least
"getting there" and the inclusion note must be editable.

---

## 7. Our Pick (`HubOurPick`) - per-locale gap

`HubOurPick(hubId, tourId, pickType, description, displayOrder)` with `HubPickType
{ BEST_OVERALL, MOST_POPULAR, BEST_FOR_FAMILIES, BEST_VALUE }` - matches Figma's three picks. Rules:

- **Tour titles, never operator names** (master 5.5 / LD14). Card facts (rating, boat type, from $X)
  come from the Tour. ✓
- Editorial line ("Our honest picks, not paid placements") is static copy.
- **GAP:** `description` is a single `String` - it must be **per locale**. **+ TO ADD** a
  `HubOurPickTranslation(ourPickId, locale, description)` child (or move the blurb into
  `HubContentSection`). Medium.

---

## 8. Comparison table (`HubComparison*`) - cell content gap

`HubComparisonGroup(groupName, displayOrder)` + `HubComparisonTour(groupId, tourId, displayOrder)` model
the **two groups** (Comfort / Adventure) and **which tours** sit in each column. But the Figma table has
**rich per-row cells** the schema cannot store:

| Row (Figma) | Where it should come from |
|---|---|
| Free cancel (`48h`/`72h`), from $X, Boat & group | **derived from the Tour** (`cancellationHours`, fromPrice, `wholeUnitType` + capacity) |
| Crossing (`1 hour`), Breakfast (Included/-), Open bar (Premium/Optional) | likely **Tour attributes** (`attributes.prisma` dictionary) - reuse if defined |
| **What stands out** (free text: "Dive school, massage with a view") | **curated per hub/tour - not modeled** |

**GAP:** there is no place for the curated cells, and `groupName` is not per-locale. **+ TO ADD**:
(a) `HubComparisonGroupTranslation(groupId, locale, groupName)`; (b) a way to hold the "what stands out"
cell - either `HubComparisonTour.standoutNote` (+ a translation child) or a small
`HubComparisonCell(comparisonTourId, attributeKey, value)` if you want fully dynamic rows. Decide how
many rows are derived-from-tour-attributes vs curated, then model only the curated remainder. Medium-High.

---

## 9. Allowed categories & tour assignment (no gap)

- `HubAllowedCategory(hubId, categoryId)` gates which category of tours an operator may attach to the
  hub. ✓ The operator tour-create hub selector checks this.
- **Shared vs private split** (Figma sections 4 vs 5) is **derived** from the hub's tours by
  `bookingType` (SHARED grid vs PRIVATE charters), and charters sub-split day vs overnight by the
  backend-served `isOvernight` verdict: operator `sleepAboard` flag OR duration >= 16h
  (`backend/src/tours/overnight.ts` - the frontend never re-derives it). No hub schema field needed.
- **Sponsored badge** shows on the hub shared grid (tier/spotlight driven) - derived, no field.

---

## 10. FAQ (already wired)

`Faq` is polymorphic and **already lists `'hub'`** in its `pageType` discriminator. Hub FAQ = `Faq`
rows where `pageType='hub'`, `entityId=hub.id`, `locale`, `isActive`, ordered by `displayOrder`. Master:
7 AEO questions + FAQPage schema (Figma shows 9 - count is editorial, not a schema constraint). **No
change needed.**

---

## 11. Related hubs (derived)

"Also worth your time on Curaçao" (3 cross-hub cards) + the section is **mandatory**. Default to
**derived**: other active hubs in the same destination, excluding self (cap 3). Add a curated relation
only if editorial control is later required. No schema change for launch.

---

## 12. Display & business rules (master 5.5, locked)

- **Full hero image** is mandatory and must show the **specific** place/attraction, not the generic
  destination (hero-specificity rule). Operator-sourced photos preferred.
- **Anchor nav** = 5 locked items, sticky on scroll; derived from sections present.
- **No trust bar** on hubs (unlike the tour page).
- **Our Pick uses tour titles, not operator names.** "Our honest picks, not paid placements."
- Hub shared grid **does** rank by tier/quality and **does** show the `Sponsored` badge.

---

## 13. Gap summary (apply order)

| # | Gap | Where | Severity |
|---|---|---|---|
| **G1** | `heroImage` - the hub's defining element, master E.4 | `Hub` (§2) | **High** |
| **G2** | `content_sections` - Discover deep-dive + Local Tips (titled, ordered, per-locale). Only `aboutText` today | new `HubContentSection` + `HubSectionType` (§5) | **High** |
| **G3** | Comparison cell content ("what stands out") + per-locale `groupName`; cells otherwise undefined | `HubComparison*` extensions (§8) | Medium-High |
| **G4** | Fast-facts bar store (editorial facts like crossing time / inclusion) | `HubContentSection` or `fastFacts Json` (§6) | Medium |
| **G5** | `heroTagline` (hero subtitle, per locale) | `HubTranslation` (§3) | Medium |
| **G6** | `status` - master lists it; today only `isActive` | `Hub` + `HubStatus` enum (§2) | Medium |
| **G7** | `ogImage` (E.4) | `Hub` (§2) | Low-Medium |
| **G8** | `HubOurPick.description` must be per-locale | `HubOurPickTranslation` (§7) | Medium |
| **G9** | `overview` directive: editorial lead max 150 words, no visible header (no new field) | `HubTranslation` | Low |
| **G10** | `hubType` nullable -> tighten to required after Stage-2 backfill | `Hub` (§2) | Low |

Already present and correct: `id`, `name`, `slug`, `destination_id`, `hub_type`, `short_description`
(`description`), `latitude`/`longitude`, `meta_title`/`meta_description`, timestamps, allowed
categories, Our Pick structure, comparison group/tour links, FAQ wiring (`pageType='hub'`).

---

## 14. Render logic - how a hub page is built

```
GET /{locale}/{destination}/{hub-slug}/
  1. slug_registry resolves slug -> entity_type='hub', entity_id. is_active=false -> 404.
  2. Load Hub (+ translation, + page content, + content sections, + fast facts).
  3. Hero: heroImage, h1Override, heroTagline, fast facts (mix of stored + derived), date picker.
  4. Editorial lead = overview.
  5. Shared grid: tours via TourHub (category in allowedCategories), bookingType=SHARED,
     ranked tier_rank ASC, quality_score DESC, id ASC; Sponsored badge per tier/spotlight; date filter.
  6. Private charters: same membership, bookingType=PRIVATE, split day/overnight by the served
     `isOvernight` (sleepAboard OR >= 16h).
  7. Our Pick: HubOurPick ordered by displayOrder, blurb in locale, tour titles.
  8. Comparison: HubComparisonGroup -> HubComparisonTour columns; cells = derived (tour/attributes) + curated.
  9. Discover + Local Tips: HubContentSection by sectionType, ordered.
 10. FAQ: Faq pageType='hub'. Related hubs: other active hubs in destination (cap 3).
```

**Publish guard (G6):** a hub may go `PUBLISHED` only when `heroImage` is set, base-locale H1 +
editorial lead exist, `hubType` is set, and the mandatory sections (Discover, Local Tips) have at least
one base-locale block. (Tune to taste; the master makes those sections mandatory.)

---

## 15. Write & ownership

- **Admin-only** create/edit/delete (`MANAGE_HUBS`). Operators never create hubs; they only *attach*
  their tours to an allowed hub during tour creation (`TourHub`, gated by `HubAllowedCategory`).
- Create/rename/disable is **transactional with the `slug_registry` row** (create writes one `HUB` row
  for the destination; rename issues a 301 + 90-day cooldown; `isActive=false` flips the registry row
  and the page 404s).
- `isSeeded=true` rows are delete-protected.

---

## 16. API surface (suggested, base `/api/v1`)

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/hubs?destinationId=` | public/ADM | List hubs for a destination |
| `GET` | `/hubs/:slug?destinationId=&locale=` | public | Full render payload (§14) |
| `POST` | `/hubs` | ADM | Create (+ slug-registry row) |
| `PATCH` | `/hubs/:id` | ADM | Edit core fields (hero, type, status) |
| `PUT` | `/hubs/:id/translations/:locale` | ADM | Upsert translation (`{ fields: {...} }`) |
| `PUT` | `/hubs/:id/sections` | ADM | Replace content sections (Discover / Local Tips) |
| `PUT` | `/hubs/:id/allowed-categories` | ADM | Set allowed categories |
| `PUT` | `/hubs/:id/our-picks` | ADM | Set the 3 Our Pick selections + blurbs |
| `PUT` | `/hubs/:id/comparison` | ADM | Set comparison groups + tour columns + cells |
| `DELETE` | `/hubs/:id` | ADM | Delete (blocked if `isSeeded`) |

FAQ is managed through the shared FAQ endpoints with `pageType='hub'`.
