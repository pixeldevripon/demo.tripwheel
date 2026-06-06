# Platform Architecture V2 — Gap Analysis & Reconciliation

> **Compares:** `Island Tours Platform Architecture V2 (Notion).pdf` (41 pages, "Production-ready briefing")
> **Against:** everything in `technical-doc/` + the live Prisma schema in `backend/prisma/`.
>
> **Purpose:** surface every conflict, every missing piece, and every change needed to bring our docs and schema in line with V2 — then propose what to change.
>
> Generated 2026-06-04. Read top-to-bottom: §0 is the headline, §A–§D are the work, §E reconciles scope, §F is the action plan + the decisions only you can make.

---

## 0. The One-Paragraph Headline

V2 is a **pure SEO/discovery marketplace architecture**. It is built around five entities — Destination → Category → Tour → Attributes, plus two parallel discovery layers (Activity Hubs, Collections) — and a heavy SEO/filter/search/structured-data layer on top. **Our docs describe a different center of gravity:** a transactional marketplace with a *featured-slot economy* (operators compete for 3 paid slots per category, soft-lock/hard-reserve, waitlist, commissions, SSE, BullMQ). The two are **not contradictory in business model** (both are "reseller, commission on local operators"), but V2 is silent on the slot economy and our docs are silent on most of V2's discovery/SEO machinery. The biggest *true conflicts* are three structural ones: **tour↔category cardinality, tour↔hub cardinality, and tour URL nesting.** Everything else is either "we're missing it" or "V2 doesn't mention it."

---

## A. Direct Conflicts — Our Docs/Schema Say X, V2 Says Y

These are real contradictions. They cannot both be true; a decision is required for each.

### A1. Tour ↔ Category cardinality — **single vs many** 🔴 High impact
| | Value |
|---|---|
| **V2** (p.12, p.10) | A tour belongs to **1+ categories** (many-to-many). Explicit overlap rules: "Sunset catamaran cruise → `boat-tours` + `sunset-cruises`", "Klein Curaçao day trip → `boat-tours` + `day-trips`". |
| **Ours** (`trips.prisma:9,50`) | `Trip.categoryId String` — exactly **one** category (many-to-one). |
| **Why it matters** | Drives tour visibility on multiple category pages, category-specific filters, and the breadcrumb (V2 uses the *first/primary* category). Single-category cannot represent "snorkeling from a boat". |
| **Change needed** | Introduce a `TourCategory` join table (`tourId, categoryId, isPrimary`). Keep one `isPrimary=true` for breadcrumbs. Update TRIP-MODULE, filters, slug logic. |

### A2. Tour ↔ Activity Hub cardinality — **single vs many** 🔴 High impact
| | Value |
|---|---|
| **V2** (p.12, p.15) | Tour belongs to **0–n activity hubs** (many-to-many). A hub lists all tours assigned to it; a tour can appear in several hubs. |
| **Ours** (`trips.prisma:10,51`) | `Trip.hubId String?` — **one** optional hub. |
| **Change needed** | Introduce a `TourHub` join table. This interacts with A3 (URL nesting). |

### A3. Tour URL structure — **hub-nested vs always-flat** 🔴 High impact
| | Value |
|---|---|
| **V2** (p.14, p.29–30) | A tour has **exactly one canonical URL**: `/{destination}/{tour-slug}/`. Tours are **never nested under categories or hubs**. ✅ `/curacao/klein-curacao-catamaran-day-trip/`  ❌ `/curacao/boat-tours/klein-curacao-catamaran/`. |
| **Ours** (`TRIP-MODULE.md:133,151`, `02-architecture`) | Two tour URL patterns: destination-only `/{dest}/{tour-slug}/` **and hub-anchored `/{dest}/{hub-slug}/{tour-slug}/`** (the hub-anchored case writes **no** slug_registry row and is resolved by the two-segment pattern). |
| **Conflict** | V2 explicitly forbids the two-segment hub-nested tour URL that our TRIP-MODULE depends on. |
| **Change needed** | If we adopt V2: drop the hub-anchored URL pattern entirely; **every** tour gets one flat `/{dest}/{tour-slug}/` URL and a slug_registry `TOUR` row; hub membership becomes a pure many-to-many tag (A2) with no URL effect. This also removes CLAUDE.md Rule #8 ("hub-anchored tours never write to slug_registry") as currently worded. |

### A4. Category page existence — **always-seeded vs tour-gated** 🟠 Medium
| | Value |
|---|---|
| **V2** (p.9, p.35) | "Category pages **must only be generated when there is at least 1 published tour** in that category+destination. Empty category pages must not exist — harmful for SEO." |
| **Ours** (`MULTILINGUAL-CONTENT.md §4.2`, destination create) | On category create, a slug_registry `CATEGORY` row is written for **every active destination** with `isActive:true` — so `/aruba/scuba-diving/` resolves and renders even with **zero** tours. |
| **Change needed** | Either (a) gate the page render on `publishedTourCount > 0` (return 404 when empty) while keeping the slug reserved, or (b) flip the slug_registry row active only when the first tour publishes. Recommend (a) — keeps slug protected, matches our soft-delete philosophy. |

### A5. Slug change & redirects — **immutable vs 301-on-change** 🟠 Medium
| | Value |
|---|---|
| **V2** (p.31–32) | Slugs **can change**; on change create a **301 redirect** in a `slug_redirects` table. Soft-delete keeps a slug reserved for a **90-day cooldown**. Admin UI offers redirect creation on delete. |
| **Ours** | Slugs are **immutable after creation** (TRIP-MODULE §4.13, slug field pattern). No `slug_redirects` table exists. Soft-delete keeps the slug forever (no 90-day concept). |
| **Conflict** | Different philosophies (immutable vs mutable-with-redirect). Our "forever" reservation is arguably safer than V2's 90-day cooldown for booking integrity. |
| **Change needed** | Decision: keep immutable (simpler, already built) **or** add `slug_redirects` + 301 handling + editable slugs. If we keep immutable, document the deliberate divergence so V2's redirect section isn't treated as a requirement. |

### A6. Slot economy — **core feature vs absent** 🔴 Scope decision
| | Value |
|---|---|
| **Ours** (`PROJECT-SCOPE.md §Featured Slot`, `ARCHITECTURE-OVERVIEW §7`, `featured-slots.prisma`) | The headline feature: 3 `FeaturedSlot` rows/category, soft-lock (15 min) → hard-reserve (90 days), commission tiers 20/22/25/30%, FIFO waitlist with 24h offer + paid skips, SSE + BullMQ. |
| **V2** | **No mention** of paid slots, slot locking, waitlist, or commission tiers anywhere in 41 pages. V2's "featured/promotion" notion is editorial **Collections** + a weighted "Recommended" **sort**, not a paid placement market. |
| **Nature** | Not a contradiction of fact — V2 is simply scoped to discovery/SEO and omits the transactional layer. But it means V2 does **not** validate or describe our single most complex subsystem. |
| **Decision needed** | Confirm the slot economy still ships (V2 just doesn't cover it), **or** V2 represents a pivot away from paid slots toward editorial collections + organic ranking. This affects Phases 5–7 entirely. |

### A7. Status model — **`status` enum vs `isActive` boolean** 🟡 Low
| | Value |
|---|---|
| **V2** | Every entity (destination, category, hub, tour, collection) has `status ENUM(draft, published, archived)`. |
| **Ours** | Destinations/categories/hubs use `isActive Boolean`; only `Trip` has an enum, and it's `DRAFT/LIVE/PAUSED/ARCHIVED` (note `LIVE`, not `published`). |
| **Change needed** | Mostly terminology. Decide whether to keep boolean+TripStatus (recommended — less churn) and just map V2's `published`≈`isActive:true`/`LIVE`. Document the mapping. |

### A8. Slug entity-type values — **casing & `activity_hub` vs `HUB`** 🟡 Low
| | Value |
|---|---|
| **V2** (p.31) | `entity_type ENUM('category','tour','activity_hub','collection')` + a separate `is_reserved BOOLEAN`. |
| **Ours** (`enums.prisma SlugEntityType`) | `TOUR, CATEGORY, HUB, COLLECTION, RESERVED` (uppercase; `HUB` not `activity_hub`; `RESERVED` is an entity-type value, not a separate boolean). |
| **Change needed** | Cosmetic — keep ours, just note the naming map in docs so future readers don't expect V2's strings. |

---

## B. Missing Systems — V2 Has Them, We Have Nothing (or Only a Stub)

These are whole features in V2 with **no doc and no implementation** on our side.

### B1. Collections (editorial/curated discovery layer) 🔴 Entirely missing
- **V2** (p.18–20): a third discovery layer beside Categories and Hubs. Two types: `manual` (handpicked `tour_ids`) and `dynamic` (saved `filter_query` resolved at render). Full data model, URL `/{dest}/{collection}/`, and **keyword-cannibalization naming rules** (`top-10-tours` good, `boat-tours-private` bad).
- **Ours**: `SlugEntityType.COLLECTION` exists in the enum and the slug resolver switch references it — **but there is no `Collection` model, no service, no controller, no doc.** It's a dangling stub.
- **Change needed**: full module (model + translations + page content + FAQ + slug_registry row + admin CRUD + dynamic filter resolver) **or** a documented decision to defer it. The decision matrix on V2 p.5 (Activity Hub vs Collection) should be copied into our docs either way.

### B2. Attributes / Filters system 🔴 Entirely missing
- **V2** (p.20–28): the entire filtering engine.
  - `attribute_definitions` central dictionary (key, data_type, allowed_values, applies_to_categories, is_filterable, is_sortable, filter_display_type, sort_order).
  - `tour_attributes` key-value table (`tour_id, attribute_key, attribute_value`).
  - Global attributes (booking_type, duration, pickup, free_cancellation, languages, …) + category-specific attributes (boat_type, dive_type, vehicle_type, wildlife_type, …).
  - Filter logic per page type, filter UX spec (sidebar/bottom-sheet, render types, URL query params, comma-separated multi-values, canonical-to-base rule), filter **priority** order, and **sort** options incl. the weighted "Recommended" formula.
- **Ours**: nothing. `Trip` carries only `basePrice`, `durationMinutes`, `pickupModel`, party sizes. No attribute dictionary, no facets, no filter spec. Public `GET /trips` filters are limited to destination/category/hub/price (`TRIP-MODULE §5.3`).
- **Change needed**: this is the largest missing build. Needs its own module + doc (`ATTRIBUTES-AND-FILTERS.md`). Decide scope: full dictionary now, or ship V2's "Filter Priority" top-5 (price, duration, booking_type, free_cancellation, rating) first.

### B3. Search architecture 🟠 Missing design
- **V2** (p.34): full-text search across title+description+highlights+category+hub names; autocomplete; destination-scoped or global; same filters as category pages; `/search?q=…&destination=…`; Algolia/ElasticSearch recommended, Postgres `tsvector` fallback; SSR (not cached).
- **Ours**: PROJECT-SCOPE says users can "browse and search," but **no search design doc, no module, no implementation** exists.
- **Change needed**: a `SEARCH.md` design + decision on engine (Postgres tsvector is the cheapest start).

### B4. Region layer 🟠 Missing field + nav concept
- **V2** (p.6): `region ENUM` is **required** on every destination (Caribbean/Atlantic/Mediterranean/Asia/Africa). Used for homepage "browse by region", search filtering, internal linking. **No `/region/` URL** — data attribute only.
- **Ours**: `Destination` has no `region` field at all (`destinations.prisma`).
- **Change needed**: add `region` enum + field; surface in homepage nav and destination filtering. Low build cost, real SEO/nav value.

### B5. Structured data (JSON-LD / Schema.org) 🟠 Missing
- **V2** (p.34): per-page-type JSON-LD — Tour=`TouristTrip`+`AggregateOffer`+`AggregateRating`+`BreadcrumbList`; Category/Collection=`CollectionPage`+`ItemList`; Destination=`Place`+`ItemList`; Hub adds `Article`+`FAQPage`.
- **Ours**: not mentioned anywhere.
- **Change needed**: add a structured-data section to the frontend SEO doc; implement JSON-LD emitters per page type.

### B6. Sitemap strategy 🟠 Missing
- **V2** (p.35): dynamic XML sitemaps segmented **per content type per locale**, a sitemap index, published-only + non-empty-category rule, `lastmod` updates, GSC submission.
- **Ours**: not mentioned.
- **Change needed**: implement `/sitemap.xml` index + per-type/per-locale sitemaps (ties to A4's "no empty category" rule).

### B7. Breadcrumbs spec 🟡 Partial
- **V2** (p.35): explicit breadcrumb path per page type, tour uses **primary category** as the intermediate crumb, rendered as both UI and `BreadcrumbList` JSON-LD.
- **Ours**: we store `breadcrumbLabel` per entity but have **no documented breadcrumb-path structure** and (per A1) no concept of a *primary* category to anchor the tour crumb.
- **Change needed**: document breadcrumb paths; depends on A1 (primary category).

### B8. Internal linking & CRO display fields 🟡 Partial
- **V2** (p.36): internal-linking matrix (destination→categories, category→related categories, tour→related tours/hub) and CRO fields on the tour card/detail: `booking_count_today`, `spots_remaining`, `last_booked_at`, trust badges, price anchor.
- **Ours**: `Trip` has `aggregateRating`, `aggregateReviewCount`, `isSponsored` — but **none** of `booking_count_today`, `spots_remaining`, `last_booked_at`, `booking_count`. (We *do* have a 24h pre-booking window job, a different concept.)
- **Change needed**: add CRO fields (some derivable from bookings/schedules at query time); document the internal-linking strategy.

---

## C. Data-Model Field Gaps (V2 fields we don't carry)

Same entities, but V2 specifies many more columns. Not conflicts — additive.

### C1. Destination (V2 p.6–7) — we carry ~6 of ~20 fields
| V2 field | Have it? |
|---|---|
| name, slug, isActive/status, heroImage | ✅ |
| **region** (required) | ❌ (see B4) |
| **country** | ❌ |
| **description / long_description** | ⚠️ via `overview` in translation, no base `description` |
| **gallery_images** | ❌ |
| **latitude / longitude** | ❌ |
| **timezone** | ❌ |
| **currency** | ❌ (we map currency per-locale globally, not per-destination) |
| **language** | ❌ |
| **meta_title / meta_description / og_image** | ⚠️ meta in `DestinationPageContent`; no `og_image` |
| **parent_destination_id** (future sub-destinations) | ❌ |

### C2. Category (V2 p.11) — missing structural fields
| V2 field | Have it? |
|---|---|
| name, slug, isActive | ✅ |
| **description** | ⚠️ via translation `overview` |
| **icon** | ❌ |
| **sort_order** | ❌ |
| **parent_category_id** (future sub-categories) | ❌ |
| **meta_title_template / meta_description_template** | ❌ (we store final meta per locale, not templates) |
| The canonical **19 global categories + exact slugs** (p.10) | ⚠️ verify `seed.ts` enumerates exactly these 19 |

### C3. Activity Hub (V2 p.15–16) — mixed: we're richer in some ways, missing others
| V2 field | Have it? |
|---|---|
| name, slug, destinationId, isActive, description | ✅ |
| **hub_type ENUM(location, highlight, area)** | ❌ |
| **latitude / longitude** | ❌ |
| content_sections / faq / meta / og_image | ✅ (we use separate `HubPageContent` + `Faq` tables, arguably cleaner) |
| **Extra we have that V2 lacks:** `HubOurPick`, `HubComparisonGroup`, `FeaturedExperience` ("Top Island Experiences") | ✅ ours-only |
| V2 guideline: 5–10 hubs/destination, ≥3 tours each | document as a rule |

### C4. Tour (V2 p.12–13) — many display/attribute fields missing
Beyond A1/A2, V2's tour model includes fields we don't store: `short_description (160)`, `excludes`, `start_times[]`, `meeting_point(+lat/lng)`, `minimum_age`, `maximum_travelers`, `guide_languages`, `wheelchair_accessible`, `family_friendly`, `suitable_for_beginners`, `instant_confirmation`, `free_cancellation`, `og_image`, and all CRO counters (B8). Many of these are really **attributes** (B2) rather than core columns — fold them into the attribute system rather than the Trip table.

---

## D. SEO / i18n — Mostly Aligned, A Few Deltas

Our `MULTILINGUAL-CONTENT.md` is strong and **already matches V2** on the big things: 7 locales (`en es nl pt fr de zh`), English-only slugs, locale-prefixed URLs, per-entity typed translation tables, English fallback, hreflang + x-default, ISR. Deltas:

| Topic | V2 | Ours | Delta |
|---|---|---|---|
| Locale list | en, es, nl, pt, fr, de + **zh** (and shows `/zh/`) | Identical 7 incl. zh | ✅ aligned |
| No-prefix URL | `/curacao/…` → **302** to preferred locale via Accept-Language | We use `localePrefix: 'always'` (next-intl) | ⚠️ confirm the 302 fallback is wired (next-intl `as-needed` vs `always`) |
| Translation storage | V2 *suggests* a generic EAV `translations(entity,locale,field,value)` table | We deliberately use **typed per-entity tables** (and document why EAV is rejected) | ✅ ours is better — note this is an intentional improvement over V2's suggestion |
| Rendering/ISR | homepage 60s, dest/cat 60s, hub 300s, collection 60s, tour 30s, search SSR | We have a rendering table (`MULTILINGUAL §10.3`) | ⚠️ reconcile exact revalidate values with V2's table |
| What-gets-translated priority | explicit 7-tier priority list (p.39) | implicit | add the priority list to our doc |

---

## E. What We Have That V2 Omits (Scope Reconciliation)

These are **ours-only**; V2's silence is scope, not rejection. Keep them, but note V2 doesn't validate them:

- **Slot economy** (FeaturedSlot/SlotLock/SlotHistory, commissions, SSE) — see A6.
- **Waitlist** (FIFO, 24h offer, paid skips).
- **Bookings / Payments** (Stripe, Mollie, PayPal) / **Reviews** / **Wishlist**.
- **Operator registration & admin approval**; **6-role RBAC** (ADMIN/EDITOR/STAFF/GUIDE/TOUR_OPERATOR/USER) — V2 only implies admin + operator + traveler.
- **Chat system** (deferred).
- **Media gallery / Cloudinary uploads.**
- **Notifications** (email + push).
- **Hub editorial extras**: OurPicks, ComparisonGroups, FeaturedExperience.

None of these need to change *because of* V2 — but V2 should be annotated as "discovery/SEO architecture only; transactional layer specified separately in PROJECT-SCOPE."

---

## F. Recommended Changes & Decisions Needed

### F.1 Decisions only you can make (blocking)
1. **Slot economy vs V2 collections (A6):** Does the paid 3-slot economy still ship, or does V2 signal a pivot to editorial Collections + organic "Recommended" ranking? Everything in Phases 5–7 hinges on this.
2. **Tour↔Category many-to-many (A1):** Adopt V2's multi-category tours (schema migration + filter/breadcrumb rework), or stay single-category?
3. **Tour URL nesting (A3):** Drop hub-anchored `/{dest}/{hub}/{tour}/` URLs in favor of V2's always-flat tour URLs? (Recommended yes — simpler, one canonical URL, matches V2.)
4. **Slug mutability (A5):** Keep immutable slugs (current, simpler) or add `slug_redirects` + 301 + editable slugs per V2?

### F.2 High-value, low-controversy additions (recommend doing regardless)
- **Region field (B4)** — cheap, real nav/SEO value.
- **Category page tour-gating (A4)** — prevents empty-page SEO harm; aligns with our soft-delete model.
- **Structured data / JSON-LD (B5)**, **Sitemaps (B6)**, **Breadcrumb spec (B7)** — core SEO, V2 treats as mandatory.
- **Document the intentional divergences**: typed translation tables > EAV (D), `isActive`≈`published` mapping (A7), uppercase slug entity types (A8).

### F.3 Large new builds to scope as their own phases
- **Attributes/Filters system (B2)** — new module + `ATTRIBUTES-AND-FILTERS.md`. Phase it: ship the top-5 priority filters first.
- **Collections (B1)** — finish the dangling `COLLECTION` enum stub into a real module, or formally defer.
- **Search (B3)** — design doc + engine decision (start with Postgres `tsvector`).

### F.4 Doc edits to make once decisions land
| Doc | Edit |
|---|---|
| `CLAUDE.md` | Rule #8 (hub tours & slug_registry) — revise per A3; add Collections/Attributes/Region/Search to module list & entity table. |
| `PROJECT-SCOPE.md` | Add Collections, Attributes/Filters, Search, Region, Structured-data, Sitemaps as scoped features; note V2 alignment. |
| `ARCHITECTURE-OVERVIEW.md` | Add the V2 five-entity hierarchy + discovery-layer diagram; reconcile with the slot economy section. |
| `TRIP-MODULE.md` | Multi-category (A1), multi-hub (A2), flat tour URL (A3), tour-gated category pages (A4), attribute fields (C4/B2). |
| `MULTILINGUAL-CONTENT.md` | Confirm no-prefix 302 (D), reconcile ISR table (D), add the translate-priority list. |
| **New:** `06-discovery/ATTRIBUTES-AND-FILTERS.md`, `COLLECTIONS.md`, `SEARCH.md`, `SEO-STRUCTURED-DATA.md` | Author once scoped. |
| `MASTER-CHECKLIST.md` | Add all the above as new phase items; update Summary Stats. |

### F.5 Suggested sequencing
1. **Resolve F.1 decisions** (blocking everything below).
2. Land the cheap SEO/nav wins (F.2): region, category gating, structured data, sitemaps, breadcrumbs.
3. Schema migration for A1/A2/A3 if adopted (do together — they touch the same tables).
4. Stand up the Attributes/Filters module (B2), then Collections (B1), then Search (B3).
5. Sweep all docs (F.4) and the master checklist in the same pass as each build.

---

### Appendix — V2 sections vs our coverage (quick map)
| V2 section | Our coverage |
|---|---|
| 1. Hierarchy / discovery layers | Partial — missing Collections layer |
| 2. Destinations (+ Region) | Partial — missing region + ~12 fields |
| 3. Categories (global, 19, gating) | Partial — missing icon/sort/templates/gating |
| 4. Tours (multi-cat, attributes, CRO) | Partial — single-cat, no attributes |
| 5. Activity Hubs | ✅ strong (+ extras), missing hub_type/geo |
| 6. Collections | ❌ enum stub only |
| 7. Attributes / Filters | ❌ none |
| 8. Complete URL structure | Partial — A3 conflict |
| 9. Slug registry (+redirects/cooldown) | ✅ core, ❌ redirects/cooldown |
| 10. Tech impl (ISR, JSON-LD, sitemaps, search) | Partial — ISR yes; JSON-LD/sitemaps/search no |
| 11. Internationalization | ✅ strong, minor deltas |
