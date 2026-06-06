# 04 — Before → After & The Logic Behind Each Change

> **What this is:** for every V2 change, a plain-language **what was built before**, **what it becomes**, and **why** (the logic/business reason). Read this to understand the migration without reading code. Pairs with `01-BACKEND-IMPLEMENTATION-ANALYSIS.md` (current state in detail), `02-BACKEND-CHANGE-LIST.md` (the backlog), `03-BACKEND-MIGRATION-STEPS.md` (the runbook).

---

## 1. Categories: the 7 wrong seeds → the canonical 19

**Before.** `seed.ts` seeds 7 categories: Boat Tours, Sunset Cruises, **Buggy Tours**, **Snorkeling Trips**, **Private Charters**, **Catamaran Trip**, **Dolphin Encounters**. The slug registry pre-seeds *these* slugs per destination.

**After.** Exactly the **19 global categories** from V2 §3 with their canonical slugs (`boat-tours, snorkeling, scuba-diving, sunset-cruises, …, workshops-classes`). The four bad entries are removed/remapped: Buggy → `off-road-tours`, Snorkeling Trips → `snorkeling`; Private Charters / Catamaran Trip / Dolphin Encounters are **not categories at all**.

**Why.** V2's taxonomy is fixed and global — it's what powers category pages, filters, breadcrumbs, sitemaps, and the "19 reserved slugs per destination" rule. The current seeds confuse three different concepts:
- **Private Charters** is really an *attribute* (`booking_type = private`) → belongs in the Attributes system / a Collection, not a category.
- **Catamaran Trip** is a *boat_type attribute* of Boat Tours, not its own activity type.
- **Dolphin Encounters** is a *hub/wildlife theme*, not a global activity.

Keeping them as categories fragments the taxonomy, produces thin/duplicate category pages (bad SEO — the exact thing V2's gating rule prevents), and makes filters impossible to reason about. Fixing the seed is the foundation everything else builds on.

---

## 2. Destinations: bare record → region-aware, geo-rich

**Before.** Destination = `name, slug, heroImage, isActive, isSeeded`. No region, no geo, no currency/timezone. Only 4 destinations (no Bahamas).

**After.** Adds `region` (required), `country`, `latitude/longitude`, `timezone`, `currency`, `language`, `galleryImages`, `parentDestinationId`, `ogImage`; Bahamas added (5 total), all `region=CARIBBEAN`.

**Why.**
- **Region** is a V2 navigation primitive — "browse by region" on the homepage, region search filtering, internal linking, and future region landing pages. It's a data attribute (no URL), so it's cheap to add and high-value.
- **Geo/timezone/currency** drive map display, "best time to visit", correct price/currency rendering, and per-destination scheduling — all needed for a real booking product.
- **`parentDestinationId`** is forward-looking: the Bahamas is 700+ islands; one day `/bahamas/` becomes a hub over `/bahamas/nassau/`. Adding the nullable column now means no structural migration later.
- These are **additive and nullable first**, then `region` is made required after backfill — zero downtime, no risk to existing rows.

---

## 3. Tour ↔ Category: one → many (with a primary)

**Before.** `Trip.categoryId` — a tour has exactly **one** category. The category-delete guard counts trips by this single FK.

**After.** A `TourCategory` join table — a tour has **1+ categories**, one flagged `isPrimary`. Filters, listings, and the delete-guard all go through the join.

**Why.** Real tours are multi-category by nature, and V2 says so explicitly: a *sunset catamaran cruise* is both `boat-tours` **and** `sunset-cruises`; a *Klein Curaçao day trip by boat* is `boat-tours` **and** `day-trips`. With a single category the tour can only appear on one category page, halving its discoverability and forcing operators to mis-tag. The `isPrimary` flag preserves a deterministic breadcrumb (`Home → Destination → Primary Category → Tour`) and a stable canonical, so multi-category doesn't create ambiguous navigation. We keep the old column until the backfill is verified, then drop it — so the change is reversible mid-flight.

---

## 4. Tour ↔ Hub: one → many

**Before.** `Trip.hubId` — a tour belongs to **one** optional hub.

**After.** A `TourHub` join table — a tour belongs to **0–n** hubs.

**Why.** A tour can legitimately belong to several themed hubs (a dolphin snorkeling trip → both the "Dolphins" highlight hub and the "West Coast" area hub). V2 models hubs as many-to-many discovery tags. Combined with change #5, hub membership becomes a pure *tagging/discovery* concern with no effect on the tour's URL.

---

## 5. Tour URL: two shapes → one flat canonical

**Before.** Two URL patterns:
- destination-only (`hubId=null`) → flat `/{dest}/{tour-slug}/`, **writes** a slug_registry TOUR row;
- hub-anchored (`hubId` set) → nested `/{dest}/{hub-slug}/{tour-slug}/`, **skips** slug_registry, resolved via a `hubSlug` query param.

**After.** **Every** tour has one flat canonical URL `/{dest}/{tour-slug}/` and **always** writes a slug_registry TOUR row. The hub-nested path is removed.

**Why.** This is the cleanest SEO model and exactly what V2 mandates ("tours are never nested under categories or hubs; each tour has one canonical URL"). The current dual scheme has real problems:
- The **same tour** could be reachable at two different URLs if its hub assignment changed → duplicate-content risk and unstable canonicals.
- Hub-anchored tours **bypass the slug registry**, so the registry isn't actually the single source of truth for routing — a latent collision/consistency hole.
- Making hubs many-to-many (#4) makes a hub-in-the-URL nonsensical anyway (which of N hubs would be in the path?).
One flat URL + always-registered slug makes routing uniform, canonical-safe, and registry-authoritative. Existing hub-anchored tours get TOUR rows backfilled (collisions resolved by the operator-name suffix rule already in `resolveUniqueSlug`), with optional 301s from the old nested paths.

---

## 6. Category pages: always render → render only with tours

**Before.** Every category slug is seeded `isActive:true` for every destination, so `/curacao/scuba-diving/` resolves and renders even with **zero** tours.

**After.** A category page returns **404 when it has no published tours** for that destination; the slug row stays reserved (so nothing else can claim it).

**Why.** V2 is explicit: "empty category pages must not exist — harmful for SEO and UX." Thin, tour-less pages get crawled, dilute crawl budget, and can trigger soft-404/penalty signals. Gating the *render* (not the slug) keeps the URL protected for the day a tour appears, while never serving an empty page or listing it in nav/sitemaps. It also aligns the `categories` API (`non-zero only`) with V2's endpoint contract.

---

## 7. Attributes / Filters: nothing → a dictionary-backed facet engine

**Before.** Tours carry a handful of fixed columns (`basePrice, durationMinutes, pickupModel, party sizes`). Public listing filters only by destination/category/hub/price. No facets, no structured properties, no "Recommended" sort.

**After.** A central `attribute_definitions` dictionary + a `tour_attributes` key-value table. Global + category-specific attributes, validated on save, exposed as filters per page type, with the weighted **Recommended** sort as default.

**Why.** Faceted filtering is, per V2, "a primary conversion driver." A traveler narrows by price, duration, private/shared, free cancellation, boat type, wildlife, etc. — none of which exist today. Two reasons for the **dictionary + key-value** design rather than more Trip columns:
- **Consistency:** the dictionary is the single source of valid keys/values, so filters stay coherent across 10,000+ tours and admin can't invent ad-hoc values.
- **Extensibility:** new attributes (and new categories' attributes) are data, not migrations — add a dictionary row, not a column.
Most of V2's "tour fields" (`booking_type, instant_confirmation, free_cancellation, wheelchair_accessible, guide_languages, …`) are modeled here, not as Trip columns, for exactly this reason. We ship the **top-6 highest-CRO filters first** so value lands before the full dictionary is built.

---

## 8. Collections: dangling enum → real editorial layer

**Before.** `SlugEntityType.COLLECTION` exists in the enum and the slug-resolver switch references a `CollectionPage`, but there is **no Collection model, service, or admin UI**. It's a stub that resolves to nothing.

**After.** A full `Collection` module — `manual` (handpicked tour IDs) and `dynamic` (saved attribute `filterQuery`) collections, each with a slug_registry row, translations, and a cannibalization guard against category slugs.

**Why.** Collections are V2's third discovery layer — editorial/SEO landing pages ("Top 10 Tours", "Family-Friendly", "Private Boat Tours") that don't fit the fixed category taxonomy. They let marketing spin up campaign/seasonal/curated pages without polluting categories. **Dynamic** collections reuse the Attributes filter engine (#7), which is why Collections come *after* Attributes. The cannibalization guard (reject a collection slug equal to a category slug) prevents two pages competing for the same keyword — a concrete SEO rule from V2 §6.

---

## 9. Search: none → full-text, faceted

**Before.** No search backend exists (the UI implies "search" but nothing serves it).

**After.** Postgres `tsvector` full-text over tour title + description + highlights + category + hub names; `GET /search` (SSR) with the same filters/sort as category pages; autocomplete. Algolia/ES is the documented scale-up path.

**Why.** Search is the other primary conversion driver in V2. Starting with Postgres `tsvector` avoids a new infra dependency and is sufficient at launch volume; the API contract is engine-agnostic so swapping to Algolia later is transparent to the frontend.

---

## 10. SEO layer & CRO: none → structured-data, sitemaps, social proof

**Before.** No JSON-LD, no XML sitemaps, no breadcrumb spec; Trip has `aggregateRating/reviewCount` but none of the CRO counters.

**After.** Per-page JSON-LD (TouristTrip/CollectionPage/Place/FAQPage + BreadcrumbList), per-locale sitemap index (published-only, non-empty categories), breadcrumb paths (tour uses primary category), and CRO fields (`bookingCountToday`, `spotsRemaining`, `lastBookedAt`).

**Why.** These are how the platform earns and converts organic traffic — the entire point of the "SEO-optimized, CRO-optimized" framing in V2. Structured data drives rich results; sitemaps drive indexation (and must exclude the empty pages from #6); CRO signals ("Booked 12 times today", "Only 3 spots left") lift booking rates. The CRO counters are partly derivable from bookings/schedules, so they're cheap to add.

---

## 11. Slug redirects: immutable — KEPT (deliberate divergence from V2)

**Decision (2026-06-07): KEEP IMMUTABLE.** Slugs remain immutable after creation; soft-delete keeps a slug reserved **indefinitely**. No `slug_redirects` table, no editable-slug UI, no 90-day cooldown.

**Why.** V2 assumes slugs can change and emit 301s. For a booking platform our immutable model is **safer**: a slug tied to indexed URLs and booking references never moves, so there's no class of broken links or stale redirects to manage, and indefinite reservation is stronger than V2's 90-day cooldown. This is a documented, intentional divergence from V2 §9 (recorded there and in `SOFT-DELETE-STRATEGY.md`). The flat-URL backfill (#5) still records an old→new slug log for audit, but no live 301 layer is built.

---

## 12. What deliberately does NOT change

| Kept as-is | Why |
|---|---|
| Featured-slot economy (3 slots/category, lock→reserve, waitlist, commissions, SSE) | V2 doesn't cover the transactional layer; it's our core monetization and stays. Category-create still seeds 3 slots. |
| Bookings, payments, reviews, wishlist, operators, notifications, chat | Out of V2's discovery/SEO scope. |
| Typed per-entity translation tables (not EAV) | A deliberate improvement over V2's suggested EAV table — DB type safety, no orphan rows. Behavior (English fallback, English slugs) matches V2. |
| Indefinite slug reservation via soft-delete | Safer than V2's 90-day cooldown for a booking product (unless redirects are adopted). |
| Hub editorial extras (OurPicks, ComparisonGroups, FeaturedExperience) | Richer than V2; no reason to remove. |

---

### One-line summary of the migration's logic
Make the **taxonomy correct and global** (categories), make **tours multi-dimensional and flat-URL'd** (cardinality + URL), make **discovery rich** (attributes, collections, search), and make it **findable** (gating, SEO) — while leaving the **money/transaction machinery** (slots, bookings) untouched.
