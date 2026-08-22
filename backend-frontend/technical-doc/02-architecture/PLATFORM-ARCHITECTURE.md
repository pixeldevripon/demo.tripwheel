# Island Tours — Information Architecture & Discovery

> **Canonical source:** master §2 (information architecture) — hierarchy, page types, URL, slug registry, categories, rendering, structured data, breadcrumbs.
> **Purpose:** the discovery / IA spine of the public site — the core hierarchy, the page-type catalog, the three parallel discovery layers, the 19 global categories, multi-category tagging, structured data, and breadcrumbs. For URLs/resolution see [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md) and [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md); for ranking/placement see [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md); for entity fields see [`DATA-MODEL.md`](./DATA-MODEL.md).

---

## Table of Contents

1. [Core Hierarchy](#1-core-hierarchy)
2. [Page Types and When Each Is Used](#2-page-types-and-when-each-is-used)
3. [The Three Parallel Discovery Layers](#3-the-three-parallel-discovery-layers)
4. [Hub vs Collection — Decision Rule](#4-hub-vs-collection--decision-rule)
5. [The 19 Global Categories](#5-the-19-global-categories)
6. [Multi-Category Tagging](#6-multi-category-tagging)
7. [Category Page Visibility (≥3 published tours)](#7-category-page-visibility-3-published-tours)
8. [Structured Data (summary)](#8-structured-data-summary)
9. [Breadcrumbs](#9-breadcrumbs)
10. [Rendering Strategy](#10-rendering-strategy)

---

## 1. Core Hierarchy

Island Tours is a Caribbean tour marketplace (reseller; commission on local operators), built on the "Built by Islanders" ethos — local curation as the ethical alternative to global OTAs. The discovery hierarchy (master §2.1):

```
Homepage
  → Destinations            (Curaçao, Aruba, Sint Maarten live; expansion-ready)
    → Discovery layer        Categories | Activity Hubs | Collections | All Tours
      → Tour detail pages
        → Booking widget → Checkout → Thank You page
```

- **Categories are global** — one set of 19, reused per destination (§5).
- **Destinations scale without structural change.** They are grouped by **region** (a data attribute, no URL layer — there is no `/caribbean/`). `parent_destination_id` is nullable for future sub-destinations (e.g. `/bahamas/nassau/`), unused at launch.
- A **tour** belongs to exactly **1 destination**, **1+ categories** (one `isPrimary`) via `TourCategory`, and **0–n hubs** via `TourHub`. A hub is a discovery tag with **no URL effect**. Multi-category overlaps are intentional (§6).
- Every tour has **one** canonical flat URL `/{locale}/{destination}/{tour-slug}/` but can be discovered through many category/hub/collection pages. See [`ROUTING-AND-RESOLUTION.md`](./ROUTING-AND-RESOLUTION.md).

**Launch scope (master §1.2):** 3 live destinations in rollout order — Curaçao (launch), Aruba, Sint Maarten. Saint Lucia and Bahamas are seeded pipeline rows only. The schema scales to other regions (Atlantic, Mediterranean, Asia, Africa) with no structural change.

---

## 2. Page Types and When Each Is Used

Master §2.1. Examples show the path after the always-present locale prefix.

| Page type | Job | Example |
|---|---|---|
| Homepage | Destination selection, nothing else | `/` |
| Destination | Island overview; entry to all discovery layers | `/en/curacao/` |
| All Tours | Full filterable catalog per destination | `/en/curacao/tours/` |
| Category | One activity type per destination; SEO workhorse | `/en/curacao/boat-tours/` |
| Activity Hub | One location, highlight, or area with its own decision logic | `/en/curacao/klein-curacao/` |
| Collection | Persona / intent-driven curated list, cuts across categories | `/en/curacao/best-things-to-do/` |
| Tour detail | Conversion page | `/en/curacao/{tour-slug}/` |
| Checkout + TYP | Transaction and confirmation | see [`BOOKING-AND-PAYMENTS.md`](./BOOKING-AND-PAYMENTS.md) |
| Search results | Query results within a destination | `/en/search?q={query}&destination={dest}` |
| Help Center | Site-level FAQ with FAQPage schema | `/help` (spec to be written) |

`tours` is a **reserved slug** at every destination, resolving to the All Tours page (§5, [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md)).

---

## 3. The Three Parallel Discovery Layers

The discovery layer sits between Destination and Tour. Three layers run in parallel, plus All Tours; all four lead to the same flat tour pages.

| Layer | Anchored to | Carries | Purpose |
|---|---|---|---|
| **Category** | Type of activity (taxonomy) | The 19 global categories | Browse by activity; SEO workhorse |
| **Activity Hub** | A place or product reality (Klein Curaçao, Willemstad, sunset cruises as an experience cluster) | Comparison logic, rich SEO content | Location/highlight/area discovery |
| **Collection** | A persona or intent (best things to do, couples, families, day trips) | Editorial ranking | Curated/promotional grouping |
| **All Tours** | The destination's full catalog | Filters + sort | Full filterable browse (reserved `tours` slug) |

A tour appears on many discovery pages but resolves to one canonical URL. Cannibalization between layers is prevented by the **slug registry: one slug, one page type, per destination** (§4, [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md)).

Ranking/ordering within these listing pages (tier rank, quality score, bookability, Sponsored labeling, the "Locals' favorites" sort label) is owned by the placement engine — see [`COMMERCIAL-MODEL.md`](./COMMERCIAL-MODEL.md).

---

## 4. Hub vs Collection — Decision Rule

Master §2.1. The two layers are distinguished by what the page is *about*:

- **Activity Hub** — anchored to a **place or product reality** (a location, attraction, area, or an experience cluster like sunset cruises) and carries **comparison logic** and rich informational content (what it is, best time to visit, how to get there).
- **Collection** — anchored to a **persona or intent** (best things to do, couples, families, day trips) and carries **editorial ranking**; primarily a curated tour listing with a short intro.

**Rule of thumb:** rich informational content deserving its own SEO page → **Hub**. Primarily a curated tour list cutting across categories → **Collection**. The slug registry enforces one slug → one page type per destination, so the two never collide on the same slug.

---

## 5. The 19 Global Categories

19 global categories, one set reused across every destination. Together with the reserved `tours` slug they form the **20 pre-seeded protected slugs per destination** (master §2.3, §2.4). Slugs are always English, never translated.

| # | Category | Slug | Examples |
|---|---|---|---|
| 1 | Boat Tours & Cruises | `boat-tours` | catamaran, sailing |
| 2 | Snorkeling Tours | `snorkeling` | reef snorkel |
| 3 | Scuba Diving | `scuba-diving` | dive trips |
| 4 | Sunset Cruises | `sunset-cruises` | sunset sailing |
| 5 | Sightseeing Tours | `sightseeing-tours` | island highlights, city tours |
| 6 | Day Trips | `day-trips` | remote island trips |
| 7 | Off-Road Tours | `off-road-tours` | buggy, ATV, quad, jeep safari, 4x4, UTV |
| 8 | Jet Ski Tours | `jet-ski` | jetski trips |
| 9 | Parasailing | `parasailing` | parasail flights |
| 10 | Water Sports | `water-sports` | kayaking, paddleboard, SUP |
| 11 | Fishing Trips | `fishing-trips` | deep sea fishing, sport fishing |
| 12 | Nature & Wildlife Tours | `nature-wildlife-tours` | dolphins, parks |
| 13 | Hiking Tours | `hiking-tours` | volcano hikes |
| 14 | Adventure Tours | `adventure-tours` | zipline, bungee, skydiving |
| 15 | Cultural & Historical Tours | `cultural-tours` | heritage, art tours |
| 16 | Food & Drink Tours | `food-tours` | street food, rum tours |
| 17 | Attraction Tickets | `attraction-tickets` | museums, parks |
| 18 | Luxury Experiences | `luxury-experiences` | yacht experiences |
| 19 | Workshops & Classes | `workshops-classes` | cooking class |

Category create seeds **1 `slug_registry` row per active destination**, transactionally (`CLAUDE.md` Rule #5). It does **not** seed FeaturedSlot rows — there is no slot economy.

**Naming note (master §2.4):** "Luxury Experiences" is the single sanctioned platform-wide use of the word "luxury" (category label + category-page H1). In running copy the word stays banned; describe what makes a tour premium instead (private skipper, small group, champagne).

---

## 6. Multi-Category Tagging

A tour can belong to multiple categories, and key overlaps are intentional (master §2.4). A tour carries 1+ categories via `TourCategory`, exactly one flagged `isPrimary` (which drives the breadcrumb, §9).

| Tour | Categories |
|---|---|
| Sunset catamaran cruise | `boat-tours` + `sunset-cruises` |
| Klein Curaçao trip by boat | `boat-tours` + `day-trips` |
| Jet ski + snorkel combo | `jet-ski` + `snorkeling` + `water-sports` |

**Day Trips** is the one duration-based category: it groups tours of roughly 6 hours or more regardless of activity, and is almost always paired with the activity category. See [`DATA-MODEL.md`](./DATA-MODEL.md) for the `TourCategory` join shape.

---

## 7. Category Page Visibility (≥3 published tours)

A category page is publicly live **only when it has at least 3 published tours** in that destination+category combination (master §2.4). Below the threshold the page is automatically `status: draft`:

- excluded from navigation, sitemaps, internal links, and search.
- The check runs on **every tour status change in both directions** — publishing can flip a category live; unpublishing can flip it back to draft.

This supersedes the earlier ≥1-tour threshold. The slug_registry CATEGORY row stays in place regardless (it protects the slug); only the page render/visibility is gated. See [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) and [`SEO-STRATEGY.md`](./SEO-STRATEGY.md).

---

## 8. Structured Data (summary)

JSON-LD per surface (master §2.6). Detail in [`SEO-STRATEGY.md`](./SEO-STRATEGY.md).

| Surface | Schema |
|---|---|
| Every page with breadcrumbs | `BreadcrumbList` |
| Tour detail | `Product`/`Offer` with `acceptedPaymentMethod` (incl. ApplePay, GooglePay); `audience.suggestedMinAge` from `tour.min_age_years`; accessibility fields; `refundPolicy` from `tour.cancellation_hours`; `includes`/`excludes` arrays; `Review` + `AggregateRating` |
| Help Center `/help` | `FAQPage` |
| Collection, Activity Hub | `FAQPage` on their FAQ sections |
| Destination | `FAQPage` on the NeedHelp FAQ column |
| All Tours | `ItemList` on the tour grid + `BreadcrumbList`; server-rendered crawlable list; filtered URLs carry self-referencing canonicals to the clean URL |
| Search results | None — `noindex, follow` |

---

## 9. Breadcrumbs

Master §2.7. Separator: `›` exclusively. Final crumb is the current page, not clickable. `BreadcrumbList` JSON-LD on every page with breadcrumbs.

Tour pages have **three path variants** depending on the tour's primary attachment:

- `Home › Destination › Hub › Tour`
- `Home › Destination › Category › Tour`
- `Home › Destination › Tour`

This supersedes the older "first assigned category" rule — the variant follows the tour's primary attachment, not simply its first category.

**Mobile visibility** is a deliberate per-page divergence: breadcrumbs are visible on tour detail pages, hidden on destination pages (replaced by the nav back-arrow).

---

## 10. Rendering Strategy

Next.js ISR per page type (master §2.5). Full table and the backend rendering rationale live in [`ARCHITECTURE-OVERVIEW.md` §6](./ARCHITECTURE-OVERVIEW.md#6-nextjs-rendering-strategy-per-page-type).

| Page type | Rendering | Revalidation |
|---|---|---|
| Homepage / Destination / All Tours / Category / Collection | ISR | 60s |
| Activity Hub | ISR | 300s |
| Tour detail | ISR | 30s |
| Search results | SSR | not cached |
| Thank You page | Server-rendered | — (noindex) |

All content API endpoints accept a `locale` query param defaulting to `en`, with English fallback for missing translations. See [`../04-multilingual/MULTILINGUAL-CONTENT.md`](../04-multilingual/MULTILINGUAL-CONTENT.md).
