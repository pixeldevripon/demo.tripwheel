# Platform Architecture V2 — Canonical Discovery & SEO Architecture

> **Source of truth** for the public-facing discovery, URL, attribute, filter, search, and SEO architecture of Island Tours.
> Faithfully reflects `Island Tours Platform Architecture V2 (Notion).pdf` (41 pages, "Production-ready briefing").
>
> **Scope note:** V2 specifies the **discovery / SEO / content** architecture. The **transactional layer** — featured-slot economy, waitlist, bookings, payments, reviews, operator onboarding, notifications, chat — is **retained as-is** and specified in `01-project-scope/PROJECT-SCOPE.md` and `02-architecture/ARCHITECTURE-OVERVIEW.md`. Where the two meet (e.g. categories own 3 featured slots), this doc cross-references the slot economy and does not replace it.
>
> **Migration:** Several points below differ from what is currently built. The concrete code/schema changes are tracked in `V2-DEVELOPMENT-ALIGNMENT-PLAN.md`. The rationale for each delta is in `ARCHITECTURE-V2-GAP-ANALYSIS.md`. **This doc states the target state.**

---

## Table of Contents
1. [Platform Overview & Core Hierarchy](#1-platform-overview--core-hierarchy)
2. [Destinations (+ Region Layer)](#2-destinations--region-layer)
3. [Categories (Global)](#3-categories-global)
4. [Tours](#4-tours)
5. [Activity Hubs](#5-activity-hubs)
6. [Collections](#6-collections)
7. [Attributes / Filters](#7-attributes--filters)
8. [Complete URL Structure](#8-complete-url-structure)
9. [Slug Registry — Routing & Uniqueness](#9-slug-registry--routing--uniqueness)
10. [Technical Implementation (Rendering, API, Search, SEO)](#10-technical-implementation)
11. [Internationalization (Multi-Language)](#11-internationalization-multi-language)
12. [Architecture Rules Summary](#12-architecture-rules-summary)

---

## 1. Platform Overview & Core Hierarchy

Island Tours is a tour marketplace where travelers discover and book tours and activities across multiple island destinations. **Business model:** reseller — commission on tours from local operators.

The architecture is designed to be: **highly scalable** (100+ destinations, 10,000+ tours), **SEO optimized**, **filterable/searchable** (faceted filters + full-text search), **structured for discovery**, and **conversion optimized (CRO)**.

### Core Hierarchy

```
Homepage
  ↓
Destinations            (Curaçao, Aruba, …)
  ↓
Discovery Layer         Categories | Activity Hubs | Collections
  ↓
Tours                   (bookable products)
  ↓
Attributes & Filters    (duration, boat_type, price, …)
```

```
                     ┌─────────────────────┐
                     │     Destinations    │
                     │  (Curaçao, Aruba)   │
                     └──────────┬──────────┘
                                │
                 ┌──────────────┼──────────────┐
         ┌───────▼───────┐ ┌────▼───────┐ ┌────▼─────────┐
         │   Categories  │ │  Activity  │ │ Collections  │
         │ (Boat Tours)  │ │   Hubs     │ │ (Top Tours)  │
         └───────┬───────┘ └────┬───────┘ └────┬─────────┘
                 └──────────┬───┴┬─────────────┘
                      ┌─────▼────▼─────┐
                      │      Tours     │
                      └───────┬────────┘
                         ┌────▼─────────┐
                         │ Attributes / │
                         │   Filters    │
                         └──────────────┘
```

**Every destination has the same structure. Categories are global. Destinations scale infinitely.**

### Discovery Layers (three parallel)

| Layer | Meaning | Purpose |
|---|---|---|
| **Category** | Type of activity (taxonomy) | Browse by activity |
| **Activity Hub** | Location / attraction / theme | SEO + rich content |
| **Collection** | Curated or filtered list | Editorial / promotional |

All three lead to tour pages. A tour has **one** canonical URL but can appear on **many** discovery pages.

### Entity Definitions

| Entity | Definition | Example |
|---|---|---|
| Destination | Island or geographic location | Curaçao, Aruba |
| Region | Geographic grouping of destinations (data attribute, no URL) | Caribbean, Mediterranean |
| Category | Global type of activity | Boat Tours, Snorkeling |
| Activity Hub | Location/attraction/theme SEO page within a destination | Klein Curaçao, Dolphins |
| Collection | Curated or filter-based editorial page | Top 10 Tours, Family-Friendly |
| Tour | Bookable product | Klein Curaçao Catamaran Day Trip |
| Attributes | Structured properties of tours, used for filtering/sorting | duration, boat_type, price |

### Decision Matrix: Activity Hub vs Collection

| If the page is about… | Entity type | Example |
|---|---|---|
| A physical location or area | **Activity Hub** | Klein Curaçao, West Coast |
| A specific attraction or animal | **Activity Hub** | Dolphins, Lighthouse |
| A theme deserving its own SEO content | **Activity Hub** | Snorkeling Spots, Shipwrecks |
| A curated list by popularity/editorial choice | **Collection** | Top 10 Tours, Best Tours |
| A filtered selection based on attributes | **Collection** | Private Boat Tours, Family-Friendly |
| A seasonal or promotional grouping | **Collection** | Summer Deals, Holiday Specials |

**Rule of thumb:** rich informational content (what is it, how to get there, best time to visit) → **Activity Hub**. Primarily a tour listing with a short intro → **Collection**.

### Scaling Principle
Targets: 100+ destinations · 20+ categories · 10,000+ tours · unlimited hubs and collections per destination. Categories stay global; destinations scale infinitely; regions group destinations for navigation at scale.

---

## 2. Destinations (+ Region Layer)

A destination represents a geographic location (typically an island) and acts as the root URL and main hub for all tours, categories, activity hubs, and collections within that island.

### Region Layer
Destinations are grouped by **region** for navigation and filtering. **Regions are a data attribute on destinations — they do not have their own URL layer** (no `/caribbean/`).

| Region | Destinations |
|---|---|
| **Caribbean** | Curaçao, Aruba, Bonaire, Sint Maarten, Bahamas, Saint Lucia, Barbados, Cayman Islands, Antigua & Barbuda, Grenada |
| **Atlantic** | Cabo Verde, Madeira, Azores |
| **Mediterranean** | Mallorca, Ibiza, Santorini, Mykonos |
| **Asia** | Bali |
| **Africa** | Zanzibar, Mauritius |

`region` is **required** on every destination. Used for: homepage navigation (browse by region), search filtering, internal linking / related destinations, and future region landing pages.

### Destination Data Model

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| name | String | Yes | Display name ("Curaçao") |
| slug | String | Yes | URL slug ("curacao") |
| region | ENUM | Yes | Geographic region |
| country | String | Yes | Country name |
| description | Text | Yes | Short SEO/display description |
| long_description | Text | No | Extended content |
| hero_image | URL | Yes | Primary image |
| gallery_images | URL[] | No | Additional images |
| latitude | Float | Yes | Geo coordinate |
| longitude | Float | Yes | Geo coordinate |
| timezone | String | Yes | IANA timezone |
| currency | String | Yes | Default currency code (USD, EUR) |
| language | String | Yes | Primary language |
| meta_title | String | Yes | SEO meta title |
| meta_description | String | Yes | SEO meta description |
| og_image | URL | Yes | Open Graph image |
| parent_destination_id | UUID/FK | No | Optional parent for sub-destinations |
| status | ENUM | Yes | draft, published, archived |
| created_at / updated_at | Timestamp | Yes | |

> **`parent_destination_id`** supports future sub-destinations (e.g. Bahamas → Nassau, Exumas). Nullable, not used at launch, but the schema must support it.
>
> **Our mapping:** translated `description`/meta fields live in `DestinationTranslation` + `DestinationPageContent` per locale; `status: published` ≈ our `isActive: true`. See `MULTILINGUAL-CONTENT.md`.

### URL & Slug Normalization
Pattern: `/{destination}/` → `/curacao/`, `/sint-maarten/`, `/saint-lucia/`.
Slug rules: lowercase only · ASCII only (ç→c, ü→u, é→e) · spaces/underscores → hyphens · no special characters · no double/leading/trailing hyphens.

### Launch Destinations (5)

| # | Destination | Slug | Region |
|---|---|---|---|
| 1 | Curaçao | `/curacao/` | Caribbean |
| 2 | Aruba | `/aruba/` | Caribbean |
| 3 | Sint Maarten | `/sint-maarten/` | Caribbean |
| 4 | Saint Lucia | `/saint-lucia/` | Caribbean |
| 5 | Bahamas | `/bahamas/` | Caribbean |

### Destination Structure
```
/{destination}/                  → Destination page
/{destination}/{category}/       → Category page
/{destination}/{activity-hub}/   → Activity hub page
/{destination}/{collection}/     → Collection page
/{destination}/{tour-slug}/      → Tour page
```

---

## 3. Categories (Global)

Categories represent **types of activities**, are defined **globally**, and reused across destinations. Category pages are generated per destination; each category has a single global slug.

> **Critical rule:** A category page must only be generated when there is **≥ 1 published tour** in that category+destination combination. Empty category pages must not exist — harmful for SEO and UX.
>
> **Our mapping:** the slug_registry `CATEGORY` row may stay seeded/reserved, but the page render must return 404 when the published-tour count is 0. See alignment plan §Category-Gating.

### The 19 Global Categories

| # | Category | Slug | Examples |
|---|---|---|---|
| 1 | Boat Tours & Cruises | `boat-tours` | catamaran, sailing |
| 2 | Snorkeling Tours | `snorkeling` | reef snorkel |
| 3 | Scuba Diving | `scuba-diving` | dive trips |
| 4 | Sunset Cruises | `sunset-cruises` | sunset sailing |
| 5 | Sightseeing Tours | `sightseeing-tours` | island highlights, city tours |
| 6 | Day Trips | `day-trips` | remote island trips |
| 7 | Off-Road Tours | `off-road-tours` | buggy, ATV, quad, jeep safari, 4×4, UTV |
| 8 | Jet Ski Tours | `jet-ski` | jetski trips |
| 9 | Parasailing | `parasailing` | parasail flights |
| 10 | Water Sports | `water-sports` | kayaking, paddleboard, SUP |
| 11 | Fishing Trips | `fishing-trips` | deep sea fishing, sport fishing |
| 12 | Nature & Wildlife Tours | `nature-wildlife-tours` | dolphins, whales, parks, jungles |
| 13 | Hiking Tours | `hiking-tours` | volcano hikes |
| 14 | Adventure Tours | `adventure-tours` | zipline, bungee, skydiving |
| 15 | Cultural & Historical Tours | `cultural-tours` | heritage tours, art tours |
| 16 | Food & Drink Tours | `food-tours` | street food, rum tours |
| 17 | Attraction Tickets | `attraction-tickets` | museums, parks |
| 18 | Luxury Experiences | `luxury-experiences` | yacht experiences |
| 19 | Workshops & Classes | `workshops-classes` | cooking class |

> These 19 slugs are **reserved at every destination** on destination creation (see §9). `seed.ts` must enumerate exactly these 19.

### Category Overlap & Tagging Guidelines
A tour can belong to **multiple categories** (see §4). Apply consistently:

| Scenario | Categories to assign |
|---|---|
| Sunset catamaran cruise | `boat-tours` + `sunset-cruises` |
| Klein Curaçao day trip by boat | `boat-tours` + `day-trips` |
| Snorkeling from a boat | `boat-tours` + `snorkeling` |
| Jet ski + snorkeling combo | `jet-ski` + `snorkeling` + `water-sports` |
| ATV tour to beach with snorkeling | `off-road-tours` (+ `snorkeling` if significant) |

> **Day Trips** is the only category based on duration/commitment (typically 6+ hours) rather than activity type. It is almost always *also* tagged with its activity category.

### Category Data Model

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| name | String | Yes | Display name |
| slug | String | Yes | Global SEO slug |
| description | Text | Yes | Category description |
| icon | String | No | Icon identifier for UI |
| sort_order | Integer | Yes | Display order |
| parent_category_id | UUID/FK | No | Future sub-category support |
| meta_title_template | String | Yes | e.g. "{category} in {destination}" |
| meta_description_template | String | Yes | SEO template per destination |

> **`parent_category_id`** prepares future grouping (e.g. "Water Sports" as parent of "Jet Ski", "Parasailing"). No URL impact.
>
> **Our mapping:** `description` lives per-locale in `CategoryTranslation.overview`; final meta lives per-locale in `CategoryPageContent`. The `*_template` fields generate defaults when no per-locale meta exists. `icon`, `sort_order`, `parent_category_id` are **new fields to add**.
>
> **Slot economy (retained):** every category still seeds exactly **3 FeaturedSlot rows** on create (CLAUDE.md Rule #6). V2 does not mention this; it coexists.

### Category URL
Pattern `/{destination}/{category}/` — `/curacao/boat-tours/`, `/aruba/snorkeling/`. Each page lists tours within that category for that destination.

---

## 4. Tours

Tours are bookable products. Each tour:
- Belongs to **exactly 1 destination**
- Belongs to **1+ categories** (global) ← **many-to-many**
- May belong to **0–n activity hubs** (many-to-many)
- Has **exactly 1 canonical URL**

> **Migration note:** today `Trip` carries a single `categoryId` and a single optional `hubId`. V2 requires many-to-many for both. Target: `TourCategory` join (`tourId, categoryId, isPrimary`) and `TourHub` join. The `isPrimary` category drives the tour breadcrumb. See alignment plan §Cardinality.

### Tour Data Model (V2)

| Field | Type | Req | Description |
|---|---|---|---|
| id | UUID | Yes | Primary key |
| title | String | Yes | Tour name |
| slug | String | Yes | URL slug (unique per destination) |
| destination_id | UUID/FK | Yes | Single destination |
| short_description | String(160) | Yes | Card/preview text |
| description | Text | Yes | Full description |
| highlights | String[] | Yes | Key selling points |
| includes | String[] | Yes | What's included |
| excludes | String[] | No | What's not included |
| hero_image | URL | Yes | Primary image |
| gallery_images | URL[] | Yes | Min 3 |
| operator_id | UUID/FK | Yes | Operator/supplier |
| categories | UUID[]/FK | Yes | **1+ category references** |
| activity_hubs | UUID[]/FK | No | **0–n hub references** |
| price_type | ENUM | Yes | per_person, per_group |
| price_adult | Decimal | Yes | Base adult price |
| price_child / price_infant | Decimal | No | |
| currency | String | Yes | ISO currency |
| duration_minutes | Integer | Yes | |
| start_times | String[] | No | Departure times |
| meeting_point (+lat/lng) | Text/Float | No | |
| minimum_age / maximum_travelers | Integer | No | |
| booking_type | ENUM | Yes | private, shared |
| instant_confirmation | Boolean | Yes | |
| free_cancellation | Boolean | Yes | |
| cancellation_window_hours | Integer | No | |
| pickup_available | Boolean | Yes | |
| guide_languages | String[] | No | |
| wheelchair_accessible / family_friendly / suitable_for_beginners | Boolean | No | |
| rating / review_count | Decimal/Int | No | |
| **booking_count / booking_count_today / spots_remaining / last_booked_at** | — | No | **CRO fields** (see §10) |
| meta_title / meta_description / og_image | String/URL | Yes | SEO |
| status | ENUM | Yes | draft, published, archived |
| created_at / updated_at | Timestamp | Yes | |

> Category-specific structured properties are **not** columns here — they live in `tour_attributes` (see §7).
>
> **Our mapping:** we already store `basePrice`, `pricingModel`, `durationMinutes`, `pickupModel`, party sizes, `aggregateRating`, `aggregateReviewCount`, and per-locale `title/overview/description` (`TripTranslation`), `highlights`/`inclusions` (translated child tables). Many remaining V2 fields (`booking_type`, `instant_confirmation`, `free_cancellation`, `wheelchair_accessible`, `family_friendly`, `guide_languages`, etc.) should be modeled as **attributes** (§7), not Trip columns. CRO counters are new.

### Tour Example
```yaml
Tour: Klein Curaçao Catamaran Trip
destination: curacao
categories: [boat-tours, day-trips]
activity_hubs: [klein-curacao]
attributes:
  booking_type: shared
  duration_minutes: 480
  boat_type: catamaran
  pickup_available: true
  wildlife_type: [turtles]
  food_included: true
  drinks_included: true
  snorkeling_included: true
```

### Tour Visibility & Canonical URL
A tour appears on multiple discovery pages but has one canonical URL:
```
canonical:  /{destination}/{tour-slug}/      e.g. /curacao/klein-curacao-catamaran-day-trip/
discovered via:
  /curacao/boat-tours/      (category)
  /curacao/day-trips/       (category)
  /curacao/klein-curacao/   (activity hub)
  /curacao/top-10-tours/    (collection)
```

> **Rule (target):** Tours are **NOT nested** under categories or hubs. Every tour URL is flat: `/{destination}/{tour-slug}/`.
> ✅ `/curacao/klein-curacao-catamaran-day-trip/`  ❌ `/curacao/boat-tours/klein-curacao-catamaran/`
>
> **Migration note:** current TRIP-MODULE allows a hub-anchored two-segment URL `/{dest}/{hub}/{tour}/`. V2 removes this — every tour gets one flat URL + a slug_registry `TOUR` row regardless of hub membership. See alignment plan §Tour-URL.

### Tour Slug Uniqueness
Unique per destination (enforced by slug registry, §9). Auto-generate from title; on collision append operator name (`klein-curacao-catamaran-trip-bluefin`). **Never append numbers** (`-2`, `-3`) — confusing and bad for SEO.

---

## 5. Activity Hubs

Activity hubs represent specific locations, highlights, or themes within a destination. They group related tours **and** serve as SEO content pages.

### Relations
- A hub belongs to **exactly 1 destination**.
- Tours belong to **0–n hubs** (many-to-many).
- Each hub should have **≥ 3 related tours** to justify its existence.
- Types: **Location** (Klein Curaçao) · **Highlight/theme** (Dolphins) · **Area** (West Coast).

### Data Model

| Field | Type | Req | Description |
|---|---|---|---|
| id | UUID | Yes | |
| name | String | Yes | Display name |
| slug | String | Yes | Unique per destination |
| destination_id | UUID/FK | Yes | Parent destination |
| **hub_type** | ENUM | Yes | location, highlight, area |
| short_description | String | Yes | Preview text |
| hero_image | URL | Yes | |
| content_sections | JSON[] | Yes | `{heading, body}` blocks |
| faq | JSON[] | No | `{question, answer}` for FAQ schema |
| latitude / longitude | Float | No | For location type |
| meta_title / meta_description / og_image | String/URL | Yes | SEO |
| status | ENUM | Yes | draft, published, archived |

> **Our mapping:** we use richer relational tables instead of JSON: `HubTranslation`, `HubPageContent`, `Faq (pageType='hub')`, plus extras V2 lacks — `HubOurPick`, `HubComparisonGroup`/`HubComparisonTour`, `FeaturedExperience` ("Top Island Experiences"). **New fields to add:** `hub_type`, `latitude`, `longitude`. See `MULTILINGUAL-CONTENT.md §6`.

### Page Structure & Content Template
Two sections: **(1) Tours** (dynamic listing) and **(2) Content** (SEO blocks).

| Section | Required | Description |
|---|---|---|
| Introduction | Yes | What is this place/topic |
| Best time to visit | Recommended | Seasonal tips |
| What to expect | Recommended | Practical info |
| How to get there | If location type | Directions, transport |
| Tips | Recommended | Insider advice |
| FAQ | Yes | Structured Q&A for schema markup |

**Guideline:** 5–10 activity hubs per destination at launch, based on search volume; each hub ≥ 3 related tours.

### URL
Pattern `/{destination}/{activity-hub}/` — `/curacao/klein-curacao/`, `/curacao/dolphins/`, `/curacao/west-coast/`.

---

## 6. Collections

Collections are **editorial or curated lists** of tours within a destination — SEO landing pages grouping tours by filter, popularity, or manual curation. **Collections are not part of the core taxonomy**; tours are not structurally assigned to them the way they are to categories.

> **Status in our system:** `SlugEntityType.COLLECTION` exists in the enum and the slug resolver, but there is **no Collection model/service/UI yet**. This is a **new module to build** (or formally defer). See alignment plan §Collections.

### Collection Types

| Type | How tours are selected | Example |
|---|---|---|
| **manual** | Editor handpicks ordered tour IDs | Top 10 Tours |
| **dynamic** | Saved attribute `filter_query`, resolved at render | Private Boat Tours |

A dynamic collection stores e.g. `{ booking_type: "private", categories: ["boat-tours"] }` and resolves matching tours at render time.

### Data Model

| Field | Type | Req | Description |
|---|---|---|---|
| id | UUID | Yes | |
| name | String | Yes | Display name |
| slug | String | Yes | Unique per destination |
| destination_id | UUID/FK | Yes | Parent destination |
| collection_type | ENUM | Yes | manual, dynamic |
| tour_ids | UUID[] | If manual | Ordered tour IDs |
| filter_query | JSON | If dynamic | Attribute filter query |
| description | Text | Yes | Intro / SEO content |
| hero_image | URL | No | |
| sort_order | String | Yes | popularity, price_asc, price_desc, rating |
| meta_title / meta_description | String | Yes | |
| status | ENUM | Yes | draft, published, archived |

### URL & Naming (avoid keyword cannibalization)
Pattern `/{destination}/{collection}/`. Collection slugs must be **semantically distinct** from category slugs.

| ✅ Good | ❌ Bad (cannibalizes a category) |
|---|---|
| `top-10-tours` | `best-tours` (too generic) |
| `private-boat-tours` | `boat-tours-private` |
| `family-friendly-tours` | `snorkeling-best` |
| `luxury-yacht-experiences` | `luxury-experiences` (exact category slug) |

> **Rule:** if a collection is essentially a filtered category (e.g. "private boat tours" = `boat-tours` filtered by `booking_type=private`), prefer **filter URL params on the category page** (`/curacao/boat-tours/?booking_type=private`) with a canonical pointing to the category — instead of a separate collection page.

---

## 7. Attributes / Filters

Attributes define structured tour properties used to filter, sort, and power discovery. A **central attribute dictionary** ensures consistency. Attributes are global and applicable to tours in any destination.

> **Status in our system:** **not built.** This is the single largest missing subsystem. New module + `06-discovery/ATTRIBUTES-AND-FILTERS.md`. See alignment plan §Attributes.

### Two Groups
- **Global attributes** — apply to any tour regardless of category.
- **Category-specific attributes** — only relevant for tours in specific categories; shown as filters only on those category pages.

Both live in the same system; category-specific filters appear only on their category pages.

### Global Attributes

| Attribute | Type | Values / Format | Filterable | Sortable |
|---|---|---|---|---|
| booking_type | enum | private, shared | Yes | No |
| duration_minutes | integer | 30/60/120/240/480 | Yes (ranges) | Yes |
| start_times | string[] | ["08:00",…] | Yes | No |
| pickup_available | boolean | | Yes | No |
| meeting_point | text | free text | No | No |
| instant_confirmation | boolean | | Yes | No |
| free_cancellation | boolean | | Yes | No |
| cancellation_window_hours | integer | 24, 48 | No | No |
| minimum_age | integer | 4, 12, 18 | Yes | No |
| maximum_travelers | integer | 8, 12, 20 | No | No |
| guide_languages | string[] | ["english",…] | Yes | No |
| wheelchair_accessible | boolean | | Yes | No |
| family_friendly | boolean | | Yes | No |
| suitable_for_beginners | boolean | | Yes | No |
| food_included / drinks_included / equipment_included | boolean | | Yes | No |
| snorkeling_included / sunset_tour | boolean | | Yes | No |

Price/rating attributes live on the tour entity (not the attributes table): `price_adult` (filter range, sortable), `rating` (filter min, sortable), `review_count` (sortable).

### Category-Specific Attributes (summary)

| Category | Attributes |
|---|---|
| Boat Tours | boat_type(catamaran/yacht/speedboat/sailboat/glass_bottom), snorkeling_stop_count, sunset_cruise, onboard_toilet, open_bar_included |
| Snorkeling | snorkeling_equipment_included, wildlife_type[](turtles/coral/tropical_fish/rays), guide_included, swimming_required |
| Scuba Diving | dive_type(discover_scuba/certified/night_dive), certification_required, max_depth(12m/18m/30m) |
| Off-Road | vehicle_type(buggy/atv/utv/jeep), driver_license_required, offroad_difficulty(easy/moderate/extreme) |
| Water Sports / Jet Ski / Parasailing | water_sport_type(jet_ski/kayak/sup/surf/parasail), instructor_included, passenger_allowed |
| Nature & Wildlife | wildlife_type[](dolphins/turtles/whales/flamingos), animal_guarantee |
| Food & Drink | tasting_type(food/wine/rum/cocktail), meal_included |
| Adventure | adventure_type(zipline/bungee/skydiving/cliff_jumping), height_requirement |
| Hiking | fitness_level(easy/moderate/hard), trail_distance_km |
| Attraction Tickets | ticket_type(museum/park/attraction/show) |
| Luxury | tier(premium/luxury/ultra_luxury) |
| Workshops & Classes | class_type(cooking/surf_lesson/art/craft) |

### Data Model — `tour_attributes` (key-value)

| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| tour_id | UUID/FK | Reference to tour |
| attribute_key | VARCHAR(100) | From dictionary |
| attribute_value | VARCHAR(500) | string, number, or JSON array |

Indexes: `(tour_id, attribute_key)` unique (one value per attribute per tour) · `(attribute_key, attribute_value)` for filter queries.

### Data Model — `attribute_definitions` (dictionary)

| Column | Type | Description |
|---|---|---|
| id | UUID | PK |
| key | VARCHAR(100) | e.g. boat_type |
| display_name | VARCHAR(100) | UI label |
| data_type | ENUM | boolean, enum, enum_multi, integer, decimal, text |
| allowed_values | JSON | For enums: valid values |
| applies_to_categories | UUID[] | NULL = global; else specific categories |
| is_filterable | boolean | |
| is_sortable | boolean | |
| filter_display_type | ENUM | checkbox, range_slider, radio, dropdown |
| sort_order | integer | Display order in filter panel |

### Filter Logic Per Page Type

| Page | Filters shown |
|---|---|
| Destination | Global only: duration, booking_type, price, rating, free_cancellation, family_friendly |
| Category | Global + category-specific for that category |
| Activity Hub | Global only (tours span multiple categories) |
| Collection | Global only |
| Search results | Global + category facet |

All category pages always show: price (range), rating (minimum), free_cancellation (checkbox).

### Filter UX
- **Position:** left sidebar (desktop), bottom sheet/modal (mobile).
- **Render types:** boolean→checkbox; single enum→radio/pills; multi enum→checkboxes; numeric→range slider; rating→star selector.
- **Behavior:** client-side via URL query params (`?boat_type=catamaran&booking_type=private`); multi-values comma-separated (`?boat_type=catamaran,yacht`); URL-preserved for shareability/SEO; re-fetch listing on change (no full reload); zero-result filters grayed (not hidden); show active count on mobile ("Filters (3)"); "Clear all" when active.
- **Canonical rule:** filtered URLs use a canonical tag pointing to the base category page (`/curacao/boat-tours/`) to prevent duplicate content.

### Filter Priority (build first — highest CRO impact)
1. price (range) · 2. duration_minutes · 3. booking_type (private/shared) · 4. free_cancellation · 5. rating · 6. category-specific type filter (e.g. boat_type).

### Sorting (every listing page)

| Sort | Logic | Default |
|---|---|---|
| **Recommended** | `bookings×0.4 + rating×0.3 + recency×0.2 + review_count×0.1` | ✅ Default |
| Price: Low→High | price_adult ASC | |
| Price: High→Low | price_adult DESC | |
| Rating | rating DESC, then review_count DESC | |
| Newest | created_at DESC | |

### Missing / Inconsistent Attribute Data

| Scenario | Behavior |
|---|---|
| Missing a filterable attribute | Excluded from results when that filter is active |
| No price | "Price on request" — do not exclude |
| No rating | "New" badge; sort to bottom by rating |
| Value not in dictionary | Reject on save — admin must use valid values |
| Attribute applies to wrong category | Allow save (multi-category tours); show as filter only on relevant category pages |

### Admin Assignment Flow
Select destination → select 1+ categories → admin UI shows global + relevant category-specific attributes → editor fills applicable values → on save, validate against dictionary → store as key-value rows in `tour_attributes`.

---

## 8. Complete URL Structure

All URLs are prefixed with a locale code (`/en/`, `/es/`, `/nl/`, …). Patterns below show the path **after** the locale prefix. Regions have **no** URL layer.

| Entity | Pattern | Example |
|---|---|---|
| Destination | `/{destination}/` | `/curacao/` |
| Category | `/{destination}/{category}/` | `/curacao/boat-tours/` |
| Activity Hub | `/{destination}/{activity-hub}/` | `/curacao/klein-curacao/` |
| Collection | `/{destination}/{collection}/` | `/curacao/top-10-tours/` |
| Tour | `/{destination}/{tour-slug}/` | `/curacao/klein-curacao-catamaran-day-trip/` |

```
Destination
├── Categories      /{destination}/{category}/
├── Activity Hubs   /{destination}/{activity-hub}/
├── Collections     /{destination}/{collection}/
└── Tours           /{destination}/{tour-slug}/
```

**Canonical rule:** each tour has one canonical URL `/{destination}/{tour-slug}/`. Tours appear on multiple discovery pages but every link points to the same canonical page. Tours are **never** nested under categories or hubs.

---

## 9. Slug Registry — Routing & Uniqueness

> **Detailed reference:** [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) — when rows are added vs. skipped, full lifecycle sync (toggle/delete/cascade), the frontend routing switch, and how a tour resolves with a flat slug.

Categories, activity hubs, collections, and tours all live at the same URL level `/{destination}/{slug}/`. The slug registry is the single source of truth that resolves which entity a slug points to and prevents collisions.

### Table: `slugs` (our model: `SlugRegistry`)

| Column (V2) | Our field | Notes |
|---|---|---|
| id | id | |
| destination_id | destinationSlug | we store the destination **slug** string |
| slug | slug | the URL slug |
| entity_type | entityType | V2: `category/tour/activity_hub/collection`; ours: `CATEGORY/TOUR/HUB/COLLECTION/RESERVED` |
| entity_id | entityId | NULL only for RESERVED |
| is_reserved | (via `RESERVED` entityType) | ours folds "reserved" into the type enum |
| is_active | isActive | false = 404, slug stays protected |

Unique constraint: `(destination_slug, slug)` — one slug per destination.

### Validation Rules
1. **Uniqueness** — before saving any entity, check the slug isn't taken in that destination; if taken, block save with an error.
2. **Normalization** — lowercase, ASCII-only, hyphen separators, no special chars, no double hyphens.
3. **Reserved slug protection** — the **19 global category slugs** + `tours` are reserved when a destination is created.
4. **Redirect on slug change** — V2 expects a **301 redirect** (old → new) on slug change. **Our decision (2026-06-07): slugs are IMMUTABLE** — they never change after creation, so no `slug_redirects` table and no 301 layer are built. Deliberate, documented divergence from V2 (safer for a booking platform: slugs tied to indexed URLs and bookings never move).
5. **Soft-delete cooldown** — V2 keeps a deleted slug reserved 90 days. *(Our build keeps it reserved indefinitely via soft-delete — a deliberate, safer divergence; see `SOFT-DELETE-STRATEGY.md`.)*

### Pre-Seeding (on destination create)
Reserve all 19 category slugs + the `tours` slug. (Our destination-create transaction already writes a RESERVED `tours` row + one CATEGORY row per existing active category — see `MULTILINGUAL-CONTENT.md §5.3`.)

### Routing Logic (Next.js)
```
Route: app/[locale]/[destination]/[slug]/page.tsx
1. Extract destination + slug
2. Validate destination exists
3. SELECT entity_type, entity_id FROM slugs WHERE destination_slug=:d AND slug=:s
4. entity_type → render correct page component
5. No result → check redirect table for 301
6. No redirect → 404
```
Resolution: `boat-tours`→CategoryPage · tour-slug→TourPage · `klein-curacao`→ActivityHubPage · `top-10-tours`→CollectionPage · RESERVED `tours`→All-Tours page.

### Redirect Table: `slug_redirects` *(target — not yet built)*

| Column | Type |
|---|---|
| id | UUID |
| destination_id | UUID/FK |
| old_slug | VARCHAR(255) |
| new_slug | VARCHAR(255) |
| redirect_type | INT (301/302) |
| created_at | TIMESTAMP |

### Admin Interface Requirements
Auto-generate slug from title · live URL preview (`island.tours/curacao/your-slug-here/`) · real-time validation against the registry · on collision show "This slug is already in use by [entity_type]: [entity_name]" · on delete offer redirect creation.

---

## 10. Technical Implementation

### Rendering Strategy (Next.js)

| Page Type | Rendering | Revalidation | Reason |
|---|---|---|---|
| Homepage | ISR | 60s | Dynamic content, not per-request |
| Destination | ISR | 60s | Listings change gradually |
| Category | ISR | 60s | Listings change gradually |
| Activity Hub | ISR | 300s | More static SEO content |
| Collection | ISR | 60s | Dynamic tour selection |
| Tour | ISR | 30s | Availability/pricing must be current |
| Search results | SSR | — | Fully dynamic, not cacheable |

> Reconcile these exact values with `MULTILINGUAL-CONTENT.md §10.3`.

### API Endpoints
All content endpoints accept `?locale=xx` (defaults to `en`, falls back to English for missing translations).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/destinations?locale=xx` | List destinations |
| GET | `/api/destinations/:slug?locale=xx` | Destination detail |
| GET | `/api/destinations/:dest/tours?locale=xx` | Tour listing with filters + sorting |
| GET | `/api/destinations/:dest/categories?locale=xx` | Categories with **non-zero** tour count |
| GET | `/api/tours/:slug?locale=xx` | Tour detail with all attributes |
| GET | `/api/slug-lookup/:dest/:slug` | Slug type resolver (locale-independent) |
| GET | `/api/hubs/:dest/:slug?locale=xx` | Hub content + tours |
| GET | `/api/collections/:dest/:slug?locale=xx` | Collection content + tours |
| GET | `/api/search?locale=xx` | Full-text search across tours |
| GET | `/api/filters/:dest/:category` | Available filters + value counts (locale-independent) |

Tour-listing query params: `?category=&booking_type=&boat_type=catamaran,yacht&duration_min=&duration_max=&price_min=&price_max=&rating_min=&free_cancellation=&sort=recommended&page=&limit=`.

> **Our base URL** is `http://localhost:5050/api/v1` and our endpoints differ in shape (see `TRIP-MODULE.md §5`). Treat V2's list as the **target contract** for public discovery endpoints; reconcile naming during implementation.

### Search Architecture
Primary conversion driver. Full-text across tour **title + description + highlights + category names + activity hub names**. Features: autocomplete (destination + category suggestions); destination-scoped or global; same filters/sort as category pages; URL `/search?q=catamaran&destination=curacao`. **Recommended:** Algolia or ElasticSearch (faceted). **Fallback / our starting point:** PostgreSQL full-text (`tsvector`). *(New build — see alignment plan §Search.)*

> **Implemented (V1) vs target.** This section is the **target**. What's shipped (`src/search/` → `TripsService.search`) is a **keyword V1**: case-insensitive `contains` (ILIKE) across the field set above, destination-scoped/global, paginated, Recommended-sorted. **Not yet built:** `tsvector`/GIN ranking, autocomplete, and faceted filtering *on `/search`* (faceted filters + sort live on `GET /trips`, the category-listing endpoint — not on `/search`). The upgrade to tsvector/Algolia is a later perf pass and is transparent to the frontend (same response contract).

### Structured Data (JSON-LD / Schema.org) — on every page

| Page Type | Schema Types |
|---|---|
| Tour | `TouristTrip` + `AggregateOffer` + `AggregateRating` + `BreadcrumbList` |
| Category | `CollectionPage` + `ItemList` + `BreadcrumbList` |
| Destination | `Place` + `ItemList` + `BreadcrumbList` |
| Activity Hub | `Place` + `ItemList` + `Article` + `FAQPage` + `BreadcrumbList` |
| Collection | `CollectionPage` + `ItemList` + `BreadcrumbList` |

*(New build — JSON-LD emitters per page type.)*

### Breadcrumbs (every page)

| Page Type | Breadcrumb Path |
|---|---|
| Destination | Home → Destination |
| Category | Home → Destination → Category |
| Activity Hub | Home → Destination → Activity Hub |
| Collection | Home → Destination → Collection |
| Tour | Home → Destination → **Primary Category** → Tour |

The tour breadcrumb uses the **first/primary** category (depends on §4 multi-category + `isPrimary`). Render as both visible UI and `BreadcrumbList` JSON-LD.

### Sitemap Strategy
Dynamic XML sitemaps segmented by type **and** locale, behind a sitemap index:
```
/sitemap.xml                                  → index
/sitemaps/sitemap-en-destinations.xml
/sitemaps/sitemap-en-curacao-categories.xml
/sitemaps/sitemap-en-curacao-tours.xml
/sitemaps/sitemap-en-curacao-hubs.xml
/sitemaps/sitemap-en-curacao-collections.xml
… (repeated per locale)
```
Rules: one file per locale per content type · only `status=published` pages · only category pages with **≥1 published tour** · update `lastmod` on change · full locale-prefixed URLs · submit index to Google Search Console. *(New build.)*

### Internal Linking Strategy

| From | To | Logic |
|---|---|---|
| Destination | All categories with tours, top hubs, featured collections | Navigation + discovery |
| Category | Related categories (boat-tours → sunset-cruises) | Cross-category discovery |
| Tour | Related tours (same category+destination, by rating) | Cross-sell |
| Tour | Activity hub (if assigned) | Contextual link |
| Activity Hub | Related hubs in same destination | Exploration |
| All pages | Destination page via breadcrumbs | Navigation |

### CRO Elements (tour card + detail)

| Element | Data source | Display |
|---|---|---|
| Social proof | booking_count_today | "Booked 12 times today" |
| Urgency | spots_remaining | "Only 3 spots left" |
| Recency | last_booked_at | "Last booked 2 hours ago" |
| Trust signals | free_cancellation, instant_confirmation | Badges |
| Rating | rating + review_count | ⭐ 4.8 (124 reviews) |
| Price anchor | price_adult | "From $45 per person" |

*(`booking_count_today`, `spots_remaining`, `last_booked_at`, `booking_count` are new Trip fields/derivations.)*

---

## 11. Internationalization (Multi-Language)

Multi-language from launch. English is primary; all others fully supported.

| Language | Locale | Priority |
|---|---|---|
| English | en | Primary (default) |
| Spanish | es | Launch |
| Dutch | nl | Launch |
| Portuguese | pt | Launch |
| French | fr | Launch |
| German | de | Launch |
| Chinese | zh | Launch |

> ✅ **Already aligned** with our build (`MULTILINGUAL-CONTENT.md` — same 7 locales incl. `zh`).

### URL Strategy: Locale Prefix + English Slugs
Slugs stay **English** across all locales; only the locale prefix and page content change (Viator's approach).
```
/en/curacao/boat-tours/   /es/curacao/boat-tours/   /nl/curacao/boat-tours/ …
```
**Why English slugs:** avoids 7× slug-registry multiplication; international tourists predominantly search in English; SEO value lives in translated titles/meta/H1/body, not the slug; keeps the registry simple (one slug per entity per destination).

**Routing rules:** every URL has a locale prefix · `/curacao/boat-tours/` (no prefix) → **302** to the user's preferred language via `Accept-Language`, defaulting to `/en/…` · each locale version has its own canonical · the slug registry resolves identically across locales (prefix only selects the translation).

> ⚠️ **Confirm:** our next-intl config uses `localePrefix: 'always'` (`MULTILINGUAL-CONTENT.md §4.8`). Verify the no-prefix → 302 fallback is wired per V2.

### Data Model Requirements
All content fields (title, description, highlights, short_description, meta_title, meta_description) support per-locale storage. V2 *suggests* a generic `translations(entity_type, entity_id, locale, field, value)` EAV table with English fallback; slugs are never translated.

> ✅ **Our improvement:** we deliberately use **typed per-entity translation tables** instead of EAV (DB-level type safety, no orphaned rows). This is an intentional upgrade over V2's suggestion — see `MULTILINGUAL-CONTENT.md §2.1`. Behavior (English fallback, English slugs) is identical.

### Frontend & SEO Requirements
- `next-intl` (or react-i18next) for **all** UI strings — no hardcoded English.
- Language switcher on every page · `<html lang="xx">` set correctly · language preference in cookie.
- **hreflang** tags on every page linking all 7 locale versions + `x-default` → English (✅ already in our build).
- Separate XML sitemap per locale (§10) · translated meta titles/descriptions (highest SEO value) · per-locale Open Graph (`og:locale`, translated `og:title`/`og:description`).

### What Gets Translated (Priority Order)
1. UI strings (buttons, labels, filters, nav) — usability
2. **Meta titles & descriptions** — SEO (highest impact)
3. Tour titles & short descriptions — discovery + conversion
4. Category & destination names/descriptions — SEO + navigation
5. Full tour descriptions & highlights — conversion
6. Activity hub content sections — SEO (long-tail)
7. Collection descriptions — lower priority

---

## 12. Architecture Rules Summary

**Core entities (required):** Destination → Category → Tour → Attributes.
**Discovery layers (optional, parallel):** Activity Hubs (SEO content + tours) · Collections (curated/filtered lists).

**URL rules:**
- All URLs locale-prefixed: `/{locale}/{destination}/{slug}/`.
- All pages within a destination live at `/{locale}/{destination}/{slug}/`.
- Every slug unique per destination (slug registry).
- Slugs are English across all locales (not translated).
- Every tour has exactly one canonical URL per locale.
- Tours are never nested under categories or hubs.
- Filtered URLs use query params with canonical pointing to the base page.
- Slug changes create 301 redirects *(target; see §9 note)*.

**Data rules:**
- Categories are global, instantiated per destination.
- Category pages only exist when they have ≥1 published tour.
- Tours belong to 1 destination, 1+ categories, 0–n activity hubs.
- Attributes validated against the central dictionary.
- All slugs normalized: lowercase, ASCII, hyphenated.
- All content fields support per-locale translations with English fallback.

**Technical rules:**
- Slug registry resolves all `/{destination}/{slug}/` routes (locale-independent).
- ISR for content pages; SSR for search only.
- Structured data (JSON-LD) on every page · breadcrumbs on every page.
- hreflang tags on every page linking all 7 locale versions.
- Dynamic XML sitemaps per content type per locale.
- `next-intl`/react-i18next for all UI strings — no hardcoded English.

**Retained (not in V2, kept as-is):** the **featured-slot economy** (3 slots/category, soft-lock→hard-reserve, waitlist, commission tiers, SSE, BullMQ), bookings/payments, reviews, wishlist, operator onboarding, 6-role RBAC, notifications, chat, media gallery, and hub editorial extras (OurPicks, ComparisonGroups, FeaturedExperience). See `PROJECT-SCOPE.md` and `ARCHITECTURE-OVERVIEW.md`.
