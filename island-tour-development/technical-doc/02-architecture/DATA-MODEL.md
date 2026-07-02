# Consolidated Data Model (Appendix E)

> **Canonical source:** master Appendix E (`island-tours-platform-master.html` v1.9).
> **Purpose:** The single engineer reference for every platform entity, using the master's **canonical field names**. This doc is the **bridge between master fields and the Prisma schema** — each entity carries a "Current code" note stating how the existing model differs.

> **Conventions.** Localized fields use the `_{locale}` suffix across all 7 locales (EN, NL, DE, FR, ES, PT, ZH). Computed fields are **read-only at query time**. Where two source documents named a field differently, the canonical name below wins and the superseded name is noted.
>
> **Siblings:** [`AVAILABILITY-AND-DEPARTURES.md`](./AVAILABILITY-AND-DEPARTURES.md) (E.9 detail) · [`TRACKING-AND-ANALYTICS.md`](./TRACKING-AND-ANALYTICS.md) (E.8 tracking columns) · [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md) · [`PLATFORM-ARCHITECTURE.md`](./PLATFORM-ARCHITECTURE.md).

---

## E.1 destinations

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `slug` | uuid, string, string | Slug is locale-independent (§2.2) |
| `region`, `country` | enum, string | Region: Caribbean at launch |
| `description`, `long_description` | text | `long_description` drives the 350–500 word SEO section (§5.2) |
| `hero_image`, `gallery_images[]`, `og_image` | URL | |
| `latitude`, `longitude`, `timezone` | float, float, IANA string | Timezone drives every "(local time)" computation |
| `currency`, `language` | string | **Operator and payout context only**; display currency is locale-fixed (§1.3) |
| `meta_title`, `meta_description` | string | |
| `parent_destination_id` | uuid nullable | Future sub-destinations; unused at launch |
| `status`, `created_at`, `updated_at` | enum, timestamps | `draft` / `published` / `archived` |

**Current code** (`destinations.prisma`): largely aligned — `region` (required), `country`, `latitude`, `longitude`, `timezone`, `currency`, `galleryImages`, `ogImage`, `parentDestinationId` all present. Differences: status is modeled as a boolean `isActive` (+ `isSeeded`) rather than a `draft/published/archived` enum; `long_description`/`description` and SEO `meta_*` live on `DestinationTranslation`/`DestinationPageContent`, not the base row.

---

## E.2 categories

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `slug` | uuid, string, string | The 19 global categories (§2.4); slug is **global** |
| `description` | text | |
| `icon`, `sort_order` | string, int | Icon identifier from the §3.3 SVG set |
| `parent_category_id` | uuid nullable | Future grouping; no URL impact; unused at launch |
| `meta_title_template`, `meta_description_template` | string | e.g. `"{category} in {destination}"`; resolved per destination |
| `status` (per destination combination) | enum | Driven by the **≥3 published tours** threshold automation (§2.4), never hand-set |

**Current code** (`categories.prisma`): aligned — `icon`, `sortOrder`, `metaTitleTemplate`, `metaDescriptionTemplate`, `parentCategoryId` present. Differences: per-destination `status` automation is not the ≥3-published-tours gate yet (likely ≥1; tracked in the alignment plan); category-create currently also seeds 3 `FeaturedSlot` rows — **that rule is removed under the tier model** (see [§E.3 commercial tier](#commercial-tier)).

---

## E.3 tours

The richest entity. Field groups follow the master's reconciled registry.

### Identity and routing

| Field | Type | Notes |
|---|---|---|
| `id`, `title`, `slug`, `destination_id`, `operator_id` | | Slug unique per destination; exactly one destination |
| `categories[]`, `activity_hubs[]` | FK arrays | **1+ categories** (one `isPrimary`); **0+ hubs** |
| `h1_override` | string nullable | For awkward template H1s (LD15) |
| `breadcrumb_label` | string nullable | Editorial short form when the H1 tour-name portion exceeds 35 chars |
| `departure_city` | string nullable | Drives the meta-row location label (LD13); empty renders island only |

### Content (localized)

| Field | Type | Notes |
|---|---|---|
| `short_description` | string 160 | Card and preview text |
| `overview_{locale}` | markdown | Paragraph breaks only; no headings, lists, or bold (LD22) |
| `highlights_{locale}[]` | string[] | 3–6 items, 5–15 words; merged into Overview rendering (LD22) |
| `included_items[]` | string[] | Supersedes the architecture field `includes` (LD18) |
| `excluded_items[]` | object[] | `{item, type: paid_advance / paid_onsite / unavailable / not_permitted, price_text?}`; type drives inline rendering; supersedes `excludes` (LD18) |
| `what_to_bring_{locale}[]` | string[] | 3–8 bullets, max 25 words; must not duplicate included items (CMS warning) |
| `know_before_you_go_{locale}[]` | string[] | 3–10 bullets; operational caveats and positive accessibility status |
| `not_suitable_for_{locale}[]` | string[] nullable | Restrictions affecting bookability; hidden when empty; renamed from `not_allowed` (LD23) |
| `local_tip_{locale}` | string nullable | Optional Overview tail (LD22) |
| `category_display_{locale}` | string | Plural noun phrase driving "More {category_display} in {destination}" (LD33); CMS validates plural form |
| `gallery_images[]` | array | Ordered, first marked `is_hero`, manual focal point per image |

### Pricing and party

| Field | Type | Notes |
|---|---|---|
| `pricing_model` | enum | `per_person` / `unit`; supersedes the architecture `price_type` |
| `unit_type` | enum nullable | If `unit`: `group` / `boat` / `vehicle` / `aircraft` / `package` |
| `price_adult`, `price_child`, `price_infant` | decimal | Base band prices; "from" price on cards is the lowest applicable |
| `age_bands[]` | array nullable | When age-banded pricing applies; drives the widget Pattern B selector; **all bands count toward capacity** |
| `add_ons[]` | array nullable | Optional extras at the booking step; spectator pricing lives here |
| `max_party_size`, `min_party_size` | int | Capacity ceiling; minimum defaults to 1, some tours require 4+ |

### Booking logic

| Field | Type | Notes |
|---|---|---|
| `booking_cutoff_minutes` | int | Default 120, range 0–10080; after cutoff the date cell shows "Closed" (§6.1) |
| `cancellation_hours` | int enum | **`[24, 48, 72, 168]`, default 48**; drives 5 render locations + Schema `refundPolicy` (LD1); canonical name, supersedes `cancellation_window_hours` (C5) |
| `free_cancellation` | boolean | Redundant by rule — free cancellation is a listing requirement (§6.2), always `true`, derivable from `cancellation_hours`; **drop at the C5 migration** |
| `deposit_pct` | decimal | 20–30 in 2.5 steps, **tier-driven** (LD24) |
| `payment_model` | enum | `operator_link` / `on_arrival` / `paid_in_full` / `operator_full` (§1.4); **snapshotted onto the booking** |
| `start_times[]`, `instant_confirmation`, `booking_type` | | Time-slot chips (§6.1); private/shared. `start_times` is the slot template for the availability schedules ([E.9](#e9-availability-and-departures)); unit-priced private charters: one booking takes the whole departure |
| `pickup_model` | enum | `included` / `paid_addon` / `none`; supersedes the boolean `pickup_available` |
| `meeting_point`, `meeting_point_lat`, `meeting_point_lng` | text, floats | Meeting & Pickup block (LD19) |
| `duration_minutes`, `duration_minutes_max` | int, int nullable | Formatter input (§3.5); max for ranges |

### Flags and accessibility

| Field | Type | Notes |
|---|---|---|
| `min_age_years` | int nullable | Widget enforcement + Schema `suggestedMinAge`; supersedes `minimum_age` |
| `fitness_level` | enum nullable | `easy` (default, hidden) / `moderate` / `challenging` |
| `weather_dependent` | boolean | Default false |
| `wheelchair_accessible` | boolean | Default true; false routes to "Not suitable for" |
| `family_friendly`, `suitable_for_beginners`, `guide_languages[]` | | Languages drive the third quick-info badge (LD7) |
| `is_locals_favourite` | boolean | **Manual editorial flag**, single source of truth for every Locals' favorite surface; target ~30% coverage; **never tier-linked** |

### Computed (read-only)

| Field | Type | Notes |
|---|---|---|
| `aggregate_rating`, `review_count` | float, int | Render thresholds: rating at 3+ reviews; LD11 fallback under 3; LD30 sort/filter gates at 10 and 20 |
| `rating_distribution[]`, `photo_review_count` | array, int | Star chart (LD31); photo carousel activates at 3+ photo reviews |
| `booking_count` | int | Most-booked sort, parked until the §3.12 reactivation threshold |
| `booking_count_today`, `spots_remaining`, `last_booked_at` | | Present in the model; **no consumer urgency surface in v1** (ethical CRO). Capacity messaging uses live availability ("Only N left" in the party selector); capacity values derive from [departures (E.9)](#e9-availability-and-departures) |
| `quality_score` | decimal(6,2) | Nightly formula (§7.2): `(avg_rating/5)*40 + (min(review_count,100)/100)*25 + (listing_completeness/100)*20 + (conversion_rate/max_conv)*15` |

### Commercial tier

> Replaces the featured-slot economy entirely. There is **no** slot economy in the target architecture. Placement = commission tiers + a ranking query + an eligibility engine.

| Field | Type | Notes |
|---|---|---|
| `tier_key`, `commission_tier` | varchar(20), decimal(4,1) | Updated together on tier change. `commission_tier` default `20.0`, `tier_key` default `'standard'` |
| `tier_rank` | smallint default 5 | Denormalized from `tier_key` for index/sort; **never client-written** |
| `tier_locked_until` | timestamp nullable | `now + 30 days` on every tier change |
| `first_published_at`, `eligibility_state` | timestamp, enum | Eligibility window anchor; `eligible` / `provisional` / `grace` / `demoted` with `grace_started_at` and `grace_metric` (§7.2) |
| `is_bookable`, `status` | boolean, enum | Bookability filter inputs (§7.2) |

**Tiers:** `premium` 30% (rank 1), `featured` 27.5% (2), `boosted` 25% (3), `organic` 22.5% (4), `standard` 20% (5, default — deliberately below `organic`). **Destination Spotlight** = 35%, a separate labeled block, never interleaved, max 3 per destination, manual approval.
**Ranking** (category page / search): `ORDER BY tier_rank ASC, quality_score DESC, id ASC`, then a diversity pass; bookability filter excludes a tour when `status != active`, `is_bookable = false`, or no open departure in the next 30 days.

### SEO

`meta_title`, `meta_description`, `og_image`.

**Current code** (`trips.prisma`, model `Trip`): multi-category (`TourCategory`, `isPrimary`) and multi-hub (`TourHub`) are built; `pricingModel`/`unitType`, `bookingCutoffMinutes` (default 120), `pickupModel`, `h1Override`, `breadcrumbLabel`, `durationMinutes`, party sizes, and the CRO counters (`bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt`) exist. **Missing / mismatched vs. master:**

- **No commercial-tier columns** — `commission_tier`, `tier_key`, `tier_rank`, `tier_locked_until`, `quality_score`, `first_published_at`, `eligibility_state`, `is_bookable` are all absent. Instead the schema carries the **slot economy** (`FeaturedSlot`, `SlotLock`, `WaitlistEntry` relations + `isSponsored`) which **must be removed**.
- **No `payment_model`** field and **no `deposit_pct`**.
- `cancellationHours` is a plain `Int @default(24)` — must become **enum `[24,48,72,168]`, default 48**.
- **No** `short_description`, `what_to_bring_{locale}`, `not_suitable_for_{locale}`, `know_before_you_go_{locale}`, `local_tip_{locale}`, `category_display_{locale}`, `is_locals_favourite`, `excluded_items` object shape, `fitness_level`, `weather_dependent`, `wheelchair_accessible`, `min_age_years`, `departure_city`, `start_times[]`, `duration_minutes_max`, `meeting_point*`.
- Localized content currently lives in `TripTranslation` / child tables (`TourHighlight`, `TourInclusion`, `TourExclusion`) rather than `_{locale}` suffixed array columns.

---

## E.4 activity_hubs

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `slug`, `destination_id` | | Slug unique per destination |
| `hub_type` | enum | `location` / `highlight` / `area` (§5.5) |
| `short_description`, `hero_image`, `og_image` | | |
| `content_sections[]` | JSON `{heading, body}` | Discover, Local Tips, and the editorial blocks |
| `faq[]` | JSON `{question, answer}` | 7 AEO questions; FAQPage schema (§2.6) |
| `latitude`, `longitude` | float nullable | Location type |
| `meta_title`, `meta_description`, `status`, timestamps | | |

**Current code** (`destinations.prisma`): `Hub` with `hubType`, destination FK, and supporting models (`HubContent`, `HubOurPick`, `HubComparisonGroup`, `HubAllowedCategory`) is built. FAQ is the shared polymorphic `Faq` model (pageType + entityId) rather than an inline `faq[]` JSON column; content sections live in `HubContent`.

---

## E.5 collections

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `slug`, `destination_id` | | |
| `collection_type` | enum | `manual` / `dynamic` |
| `tour_ids[]` | UUID[] if manual | The ordered editorial list; **order is the product** (§5.6) |
| `filter_query` | JSON if dynamic | |
| `collection_rationale` (per tour, per locale) | string | Required CMS field before publish, max 20 words (§3.5) |
| `description`, `hero_image`, `sort_order` | | Sort applies to dynamic collections only |
| `faq[]` | JSON | 6 locked AEO questions on "Best Things to Do" (§5.6) |
| `meta_title`, `meta_description`, `status`, timestamps | | |

**Current code** (`collections.prisma`): `Collection` + translations + page content is built (per the brief's "Schema 100%"). Confirm `collection_type` (manual/dynamic), `tour_ids[]`/`filter_query`, and per-tour `collection_rationale` shapes against the master when wiring the module.

---

## E.6 operators

| Field | Type | Notes |
|---|---|---|
| `display_name` | string | The only tour-page surface is "Supplied by {operatorName}" (LD14); named on post-booking surfaces (§1.4) |
| `aggregate_rating`, `aggregate_review_count` | computed | LD11 Provider Rating fallback inputs |
| `cancellation_rate_90d` | computed nightly | Operator-initiated cancellations over confirmed bookings, trailing 90 days, **null under 10 bookings**; eligibility input (§7.2) |
| `contact_email` | varchar nullable | Support surfaces on TYP and email; `mailto` pre-fills the subject with the booking `display_ref` |
| `contact_phone` | varchar nullable | Stored E.164, normalized at onboarding via `libphonenumber-js` (default country CW); invalid numbers rejected, never stored as plain text. Display uses international formatting; `tel:` keeps raw E.164 |

Either contact field may be null: the TYP renders whichever is present and omits the empty row. **Both null is invalid operator data and a render error, never a silent fallback** (dev spec §13).

**Current code** (`operators.prisma`): `Operator` + `OperatorCompanyInfo`/`SocialMedia`/`StripeConfig`/`MollieConfig` built, with `aggregateRating`/`aggregateReviewCount`. Missing vs. master: `display_name`, `contact_email`/`contact_phone` on the operator row (likely in `OperatorCompanyInfo` — confirm + add E.164 normalization), and the nightly `cancellation_rate_90d`. The `slotLocks`/`waitlistEntries`/`featuredSlots` relations are part of the slot economy and **must be removed**.

---

## E.7 reviews

One record per submitted review. Submission is **gated on a confirmed `booking_id`** ("Every review from a confirmed booking. No exceptions."). Tour aggregates in E.3 derive from **approved records only**.

| Field group | Notes |
|---|---|
| Reviewer identity | First name + **last initial only**; reviewer type enum |
| Travel date | Travel **month + year**, no exact dates |
| Rating | 1–5 |
| Text | Per locale with translation cache behind LD32 (Google Translate + show-original) |
| Media | Photos array; `helpful_count` |
| Operator response | No editing once posted |
| Moderation | Moderation status |

**Cold start (LD11):** a tour shows its own rating at **≥3 reviews**; below that, the operator aggregate is the fallback (operator ≥10 reviews at ≥4.0).

**Current code** (`reviews.prisma`): `Review` is **thin** — `bookingId` (unique, so one-per-booking is enforced), `rating`, `comment`, `isApproved`. **Missing vs. master:** split reviewer name (first + last initial), reviewer type enum, travel month/year, per-locale text + translation cache, photos, `helpful_count`, operator response, a full moderation-status enum (only a boolean `isApproved` today). No reviews service exists yet.

---

## E.8 bookings

Folded in verbatim from tracking dev spec §2/§13. Pre-existing core fields remain: `tour_id`, `operator_id`, `tour_start_datetime`, `tour_end_datetime`, party composition (`adults_count`, `children_count` + child ages), `pickup_address` (tour meeting point as TYP fallback), special requests, timestamps. **The cancellation deadline is computed, never stored** (`cancelDeadline = tour start − cancellation_hours`, tour-local).

### Identity and status

| Field | Type | Notes |
|---|---|---|
| `public_ref` | uuid unique | TYP URL credential; random, never incremental — booking URLs cannot be enumerated |
| `display_ref` | varchar | Customer-facing, format `IT-2026-XXXXX`; the transaction id in all tracking and, with the email, the account login (§6.4) |
| `status` | enum | `pending_payment` / `confirmed` / `cancelled` and further states; drives the cancellation-adjustment trigger (§8.1 item 6) |
| `island` | varchar | Denormalized from the tour at creation (default `'Curaçao'`); stable under future tour relocation |

### Money and commission

| Field | Type | Notes |
|---|---|---|
| `original_currency` | char(3) | Checkout display currency (USD or EUR): what Stripe charged; on `operator_full` (nothing charged) the session display-currency snapshot (C22). Every customer-facing amount renders in this currency |
| `original_amount` | decimal(10,2) | Full booking total in the original currency |
| `booking_total_eur` | decimal(10,2) | Full total normalized to EUR |
| `fx_rate_to_eur` | decimal(10,6) | Snapshot at booking time, audit trail |
| `deposit_amount` | decimal | Paid at booking; TYP balance row = `original_amount − deposit_amount` (original currency); **0 on `operator_full`** |
| `payment_method_last4` + `brand` | | From the Stripe payment method, for the TYP payment row; **null on `operator_full`** |
| `commission_rate` | decimal(5,4) | Snapshot at creation, **never retroactive** (§7.1) |
| `commission_amount` | decimal(10,2) | **In EUR; the conversion value on every platform** (§8.1 item 1) |
| `payment_model` | enum | The four-model enum (§1.4), snapshotted from the tour at creation (added via the C5 migration) |

### Attribution and idempotency

| Field | Type | Notes |
|---|---|---|
| `conversion_fired_at` | timestamptz nullable | Mark-first idempotency guard, set server-side before render (§8.2) |
| `gclid`, `gbraid`, `wbraid`, `fbclid` | varchar nullable | Click ids captured at booking creation; required for adjustments and offline conversions |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | varchar nullable | Non-Google attribution |

### Customer identity and billing

| Field | Type | Notes |
|---|---|---|
| `customer_first_name`, `customer_last_name` | varchar | Stored **split** (the checkout form asks separately, §5.8); legacy single-field names parse heuristically |
| `customer_email`, `customer_phone` | varchar | Phone normalized to E.164 via `libphonenumber-js` |
| `customer_id` | varchar nullable | Hash of the email; GA4 `user_id` for cross-device tracking |
| `customer_locale` | varchar | Locale captured at booking; drives localized TYP and email rendering (§1.3) |
| `billing_country`, `billing_postal_code`, `billing_city` | char(2), varchar, varchar | Pulled from the Stripe payment method during webhook handling, no extra form friction; hashed into Enhanced Conversions; **null on `operator_full`** |

**Current code** (`bookings.prisma`): the `Booking` model is **thin** vs. E.8 — it has `tripId`, `userId`, `operatorId`, `scheduleId`, `date`, `time`, `partySize`, `totalAmount`, `depositAmount`, `status`, `confirmationCode`, `selectedAddOns` (JSON), `notes`. **Missing essentially all of E.8:** `public_ref`/`display_ref` (only a `confirmationCode` uuid today), the full money/commission block (`original_currency`, `original_amount`, `booking_total_eur`, `fx_rate_to_eur`, `commission_rate`, `commission_amount`), `payment_model`, `island`, `conversion_fired_at`, click-ids, UTM, split customer name + locale + billing, `payment_method_last4`/`brand`. `scheduleId` FKs `TourSchedule` and must move to the [`departures`](#e9-availability-and-departures) model. No bookings/payments service exists yet.

---

## E.9 availability and departures

Replaces the simple `TourSchedule`. Three tables: `availability_schedules` (weekly pattern), `availability_exceptions` (per-date deviations: `close_date` / `close_slot` / `add_slot` / `set_capacity`), and `departures` — the materialized truth, `UNIQUE (tour_id, date, start_time)`, carrying `capacity` / `booked_count` / `status` (`open`/`closed`/`sold_out`/`cancelled`) / `sold_out_at` / `source` / `external_ref` / `manually_edited`.

A nightly job materializes a **12-month rolling window** and never touches departures with bookings, manual edits, or `source = api`. Capacity is claimed atomically at booking. Bookability = **EXISTS an open departure within 30 days**. Single-day tours only (v1).

**See [`AVAILABILITY-AND-DEPARTURES.md`](./AVAILABILITY-AND-DEPARTURES.md) for the full field tables, the materialization rules, the read contract, atomic capacity claim, stop-sell workflow, all-sold-out recovery, and API-adapter upsert rules.**

**Current code:** only a basic `TourSchedule` (`startDate`/`endDate`/`startTime`/`totalSpots`/`availableSpots`/`status`) exists — this entire three-table model is **to build**.
