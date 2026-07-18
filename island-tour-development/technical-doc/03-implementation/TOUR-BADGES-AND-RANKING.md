# Tour Cards: Complete Badge & Position Logic + Lifecycle

The full, end-to-end reference for **what badge a tour card shows** and **where it
ranks in a listing**. Derives master §3.6 (Badges), §3.7 (Demand signaling), §7.2
(Ranking), §3.8 (Diversity pass), §B.63 (Peach tint). The master HTML
(`technical-doc/island-tours-platform-master.html`) is canonical on any conflict.

> **EXECUTED 2026-07-18 — master alignment pass.** Fixed after a full master
> cross-check: (1) Sponsored badge — FINAL after two iterations: earned badges
> lead, Sponsored is the **fallback label for any paid placement** (Spotlight
> or tier P1-P3) with no earned badge (§2.2); ranking = spotlight first, then
> full master logic; (2) bookability gate added to
> `search()`, `suggest()` tour hits, and `findPublicByIds` (collections);
> (3) Most-popular **max-1-per-category** cap implemented page-local
> (`applyMostPopularCap`); (4) §B.63 peach tint implemented on All Tours card #1
> (default sort, page 1); (5) nightly **quality_score** job built
> (`src/tours/quality-score.ts`); (6) **eligibility engine** built: flat bar +
> provisional window enforced in `changeTier`, nightly grace/demotion lifecycle
> (`runEligibilityLifecycle`); (7) public sorts restricted to the 3 launch
> options (`LAUNCH_TOUR_SORTS`). Sections below updated to match.

> Quick references: [`TOUR-BADGES.md`](./TOUR-BADGES.md) ·
> [`TOUR-RANKING.md`](./TOUR-RANKING.md). This document is the deep dive.

---

## 0. The one principle

**Badge and position are computed on the backend, once, in a single code path, and
served identically to every listing surface.** Frontend cards are pure renderers —
they never re-sort and never recompute a badge.

- **Position** is decided by `ToursService.findAll` → `buildOrderBy` (DB sort) →
  `applyDiversityPass` (in-memory reorder).
- **Badge** is decided by `ToursService.deriveTourBadge`, attached as a `badge`
  field on every list item.

Surfaces that consume this identical pipeline: destination "Locals' favorites"
grid, All Tours, category pages, hub tours, and search (search results are one
flat set ordered by the same canonical `tier_rank` sort — there are no relevance
buckets; ILIKE matching only decides membership).

---

## 1. Data model — every field that matters

All on `Tour` unless noted (`backend/prisma/tours.prisma`):

| Field | Type | Maintained by | Feeds |
|---|---|---|---|
| `status` | enum (DRAFT/LIVE/PAUSED/ARCHIVED) | Publish lifecycle | Bookability filter |
| `isActive` | bool | Soft-delete | Bookability filter |
| `isBookable` | bool | Availability job (no 30-day availability ⇒ false) | Bookability filter |
| `tierKey` / `tierRank` | enum / int (1=premium…5=standard) | Tier change (denormalized, never client-set) | Ranking key 1 |
| `qualityScore` | float 0–100 | Nightly quality-score job | Ranking key 2 |
| `priceFrom` / `basePrice` | decimal | Pricing | Price sorts |
| `isSponsored` | bool | **Spotlight lifecycle** (mirrors an ACTIVE `SpotlightRequest`) | Badge: `sponsored` |
| `likelyToSellOut` | bool | Nightly demand recompute (§3.7) | Badge: `likelyToSellOut` |
| `likelyToSellOutOverride` | bool? | Manual CMS (launch override) | Badge: `likelyToSellOut` |
| `aggregateRating` | float? | Reviews module (recompute on approve) | Badge: `mostPopular` |
| `aggregateReviewCount` | int | Reviews module | Badge: `mostPopular`, `new` |
| `publishedAt` / `firstPublishedAt` | datetime? | Publish | Badge: `new`; demand age |
| `isLocalsFavourite` | bool | Manual editorial (≈30% of catalog) | Not a card badge — meta-row ✦ + featured-grid selector |

Related entities:
- **`SpotlightRequest`** (`backend/prisma/tiers.prisma`): `status`
  (REQUESTED/APPROVED/ACTIVE/EXPIRED/REJECTED), `startsAt`, `endsAt`, `tourId`. Max
  3 ACTIVE/APPROVED per destination.
- **`Departure`** (`availability.prisma`): `soldOutAt`, `capacity`, `bookedCount`,
  `status`, `date`. Source of the §3.7 demand signal.

---

## 2. BADGES

A card shows **at most one** badge in its top-left slot.

### 2.1 The set, visuals, triggers

| Badge (`TourBadge` key) | Trigger | Colour |
|---|---|---|
| `sponsored` | **Fallback for any paid placement with no earned badge**: ACTIVE Destination Spotlight (`isSponsored=true`) OR paid tier P1–P3 (`tier_rank <= 3`, master §3.6 "Paid tiers P1 to P3 placements"). An earned badge always replaces it. | Gray (`bg-it-surface`) |
| `likelyToSellOut` | §3.7 demand signal true (`likelyToSellOut`/override). | Navy `#193c5e` |
| `mostPopular` | `aggregateReviewCount ≥ 10` AND `aggregateRating ≥ 4.5`. | Orange `#e8611a` |
| `new` | `publishedAt` < 30 days ago AND `aggregateReviewCount == 0`. | Cream `#fdf6f0` |

Not in `deriveTourBadge` (handled elsewhere): **Numbered rank 01–10** (circle;
Top-10 collections only) and **Locals' favorite ✦** (tour-page meta-row; manual
`isLocalsFavourite`).

### 2.2 Priority (resolving overlaps) — FINAL, product decision 2026-07-18

`deriveTourBadge` returns the **first** match — earned badges lead, `sponsored`
is the **fallback** label for a paid placement with nothing better to show:

1. `likelyToSellOut` — most selective (~5–10% of catalog).
2. `mostPopular` — organic social proof; *never on commission-tier grounds*.
3. `new` — freshness.
4. `sponsored` — paid placement fallback: ACTIVE Spotlight (`isSponsored`) **or**
   paid tier P1–P3 (`tier_rank <= 3`). It answers "why is this unrated tour at
   the top?" — a card with an earned badge already explains itself, so the
   earned badge always replaces it.

Most pairs are mutually exclusive by definition (`new` needs 0 reviews ⇒ can't be
`mostPopular`; `likelyToSellOut` needs age ≥ 90d, `new` needs < 30d). The real
overlap is a paid placement that also earns a badge — the earned badge wins.
Code: `backend/src/tours/tours.service.ts → deriveTourBadge`.

### 2.2b How each badge is earned (summary)

| Badge | Earned when… | Who sets the input | Timing | Position effect |
|---|---|---|---|---|
| `sponsored` | paid placement (ACTIVE Spotlight OR tier P1–P3) **and** no earned badge | operator tier pick / admin spotlight approval + lifecycle | immediate on tier change; spotlight on approve or nightly | **none** — the badge itself never reorders (the spotlight FLAG and tier_rank already did) |
| `likelyToSellOut` | age ≥ 90d **and** ≥ 3 sellouts/60d **and** < 40% availability/30d | nightly demand recompute (or manual override) | nightly | **none** |
| `mostPopular` | `aggregateReviewCount ≥ 10` **and** `aggregateRating ≥ 4.5` | reviews module (recompute on approve) | real-time | **none** |
| `new` | `publishedAt` < 30d ago **and** `aggregateReviewCount == 0` | publish + reviews | real-time | **none** |

**Every badge is independent of position.** None of them change `tier_rank` or
ranking; they are labels computed *on top of* the tier-driven order. (The only
correlation you'll see — Sponsored often appearing first — is because the ACTIVE
Spotlight tends to sit on a high-tier tour, not because the badge sorts.)

### 2.3 Per-badge lifecycle (the full story)

#### `sponsored` — the paid-placement fallback label

**Final product decision 2026-07-18** (after two iterations): a paid placement
— ACTIVE Spotlight or paid tier P1–P3 — wears Sponsored **only when it has no
earned badge**. Rationale: top-ranked unrated cards need to explain why they
lead ("transparency is a brand pillar"), but an earned badge (Likely to sell
out / Most popular / New) is more valuable information and takes the slot.
Open-tier tours are never labeled Sponsored. Ranking is untouched:
`is_sponsored DESC, tier_rank ASC, quality_score DESC, id`.

```
operator requestSpotlight()            SpotlightRequest: REQUESTED
        │  (eligibility-gated: ≥10 reviews, ≥4.5 rating)
        ▼
admin approveSpotlight(window)         → APPROVED   (or → ACTIVE if window already open,
        │                                            and then tour.isSponsored = true)
        ▼
nightly runSpotlightLifecycle()
        │  now ≥ startsAt   →  APPROVED → ACTIVE   →  tour.isSponsored = true
        │  now >  endsAt    →  ACTIVE   → EXPIRED  →  tour.isSponsored = false
        ▼
deriveTourBadge: isSponsored ? 'sponsored'   →  gray badge on the card
```

- `isSponsored` is **denormalized** (like `tier_rank`) so listings never join the
  spotlight table per card. It is recomputed from ground truth (true iff the tour
  has ≥1 ACTIVE spotlight), so the rare multi-request case is correct.
- Maintained in `TiersService.approveSpotlight` (immediate activation when the
  window is already open) and `TiersService.runSpotlightLifecycle` (nightly).
- Removed automatically when the window closes (next lifecycle run) or — to be
  added — when an ACTIVE spotlight is cancelled.

#### `mostPopular` — earned by reviews (real-time, no job)

Reads `aggregateRating` + `aggregateReviewCount`, which the **reviews module**
recomputes whenever a review is approved/edited/removed
(`ReviewsService.recomputeAggregates`). The badge appears the moment a tour crosses
`≥10 reviews ∧ ≥4.5 rating` and disappears if it drops below. No scheduled job — it
tracks live review data. Master's *"max 1 per category"* cap is applied
**page-local at listing level** (`applyMostPopularCap`, run after the final
ordering in `findAll`, `search`, and the typeahead strips): the first-ranked tour
of each primary category keeps the badge, later ones drop to no badge.

#### `new` — freshness (real-time, no job)

True while `publishedAt` < 30 days ago **and** `aggregateReviewCount == 0`.
Auto-expires the instant the tour gets its first review or crosses 30 days — both
are read live, so no job is needed. On the card it replaces the rating row.

#### `likelyToSellOut` — the §3.7 demand signal (nightly job)

ONE algorithm powers both this badge and the tour-page demand card. All three
conditions, evaluated daily (`backend/src/tours/demand-signal.ts →
evaluateLikelyToSellOut`):

1. `tour_age_days ≥ 90` (from `firstPublishedAt`, falling back to `publishedAt`).
2. `≥ 3 sellouts in the last 60 days` — `Departure.soldOutAt` within the window.
3. `upcoming_availability_ratio < 0.40` over the next 30 days —
   `Σ remaining_seats / Σ capacity` across non-cancelled departures in `[today,
   today+30]`.

```
departures sell out (soldOutAt stamped) ─┐
tour ages past 90d ──────────────────────┤→ evaluateLikelyToSellOut() = true
availability tightens (<40% next 30d) ───┘
        │
nightly recomputeLikelyToSellOut() writes tour.likelyToSellOut = true/false
        │   (manual likelyToSellOutOverride wins when set — launch mechanism,
        │    since no tour has 90 days of history at launch)
        ▼
deriveTourBadge: (override ?? likelyToSellOut) ? 'likelyToSellOut'
```

- Computation is shared by the nightly job, the admin endpoint, and the demo seed —
  single source of truth, never drifts.
- Recompute entry points: nightly cron (§4), admin `POST
  /api/v1/tours/admin/recompute-demand?tourId=` (MANAGE_TRIPS), or set the override.

### 2.4 Where served & rendered

- **Computed:** `deriveTourBadge` in `findAll` and `flattenSearchHit`'s caller.
- **API field:** `badge` on every `/tours` list item and `SearchHitDto.badge`.
- **Frontend:** `frontend/components/frontend/tour-card.tsx` → `BadgeChip`
  (type `TourBadge`); the mapper `lib/tours/listing.ts → searchHitToListing` passes
  `hit.badge` through unchanged. Hub variant: `hub-tour-card.tsx` (`HubTourBadge`,
  no `new` by design — it keeps a rating row).
- **First-card highlight (final product decision 2026-07-18, beyond master):**
  the FIRST card of each main tour listing (All Tours page 1, destination grid,
  collection tours, hub trips panel) renders the hover treatment statically —
  cream `#fdf6f0` fill, image corners merged, inset content. Position-based via
  a `highlighted` prop the listing passes (`i === 0`), NOT badge- or
  spotlight-based. **No layout shift rule:** the content inset is static-only
  and hover animates ONLY background + corner radius — animating horizontal
  padding shrinks the text box, re-wraps titles and shifts the fixed-width
  grid (bug fixed 2026-07-18 in `tour-card.tsx` + `hub-tour-card.tsx`).
  Distinct from the §B.63 peach tint (`tinted`), which the cream highlight
  visually overrides on card #1.

---

## 3. POSITION / RANKING

### 3.0 Commission tiers & eligibility — the position engine (master §7.1)

**Placement is governed by commission tiers, not slots.** Each operator picks one
tier *per tour*; the tier sets both the commission Island Tours keeps and the tour's
`tier_rank`, which is the dominant ranking key (§3.1). There is no auction and no
slot economy.

#### The five tiers (`TierKey`)

Source of truth: `TIER_MAP` in `backend/src/tiers/tiers.service.ts`.

| Tier key | `tier_rank` | Commission | How a tour qualifies to hold it | Default? |
|---|---|---|---|---|
| `premium` | **1** (top) | 30.0% | Flat eligibility bar | — |
| `featured` | **2** | 27.5% | Flat eligibility bar | — |
| `boosted` | **3** | 25.0% | Flat eligibility bar | — |
| `organic` | **4** | 22.5% | Open (no bar) | — |
| `standard` | **5** (bottom) | 20.0% | Open (no bar) | ✅ new tours |

- **`tier_rank` is denormalized** from `tier_key` (1 = best placement, 5 = worst) and
  is **never client-written**. New tours default to `standard` (rank 5, 20%).
- `boosted`/`featured`/`premium` are the three **paid** (eligibility-gated) tiers;
  `organic`/`standard` are the open baseline. A higher commission "buys" a lower
  `tier_rank` = higher placement.
- Note: `standard` deliberately ranks **below** `organic` (rank 5 vs 4) even though
  both are open — `organic` is the "good citizen" baseline, `standard` the floor.

#### Destination Spotlight — a +35% overlay, NOT a tier

Separate from the five tiers (`tiers.prisma → SpotlightRequest`). Admin-approved,
**max 3 ACTIVE per destination**. While ACTIVE it:
1. Overrides commission to **35%** *at booking time only* — never written into
   `commissionTier` (`TiersService.effectiveCommissionRate`).
2. Sets `tour.isSponsored = true` → the **Sponsored** badge (§2).

It does **not** change `tier_rank`, and the master renders it as its own labeled
block (not interleaved into the main ranked grid).

#### How a tour "claims" its position

```
operator picks tier (changeTier)
   → denormalize commission_tier + tier_rank from TIER_MAP
   → tier_locked_until = now + 30 days   (further changes rejected while locked)
        │
ranking sort uses tier_rank ASC  → the picked tier IS the claimed placement,
                                    refined by quality_score within the tier (§3.1)
```

So "claiming position" = picking a tier you're eligible for. Two tours in the same
tier are ordered by `quality_score` then `id`; there is **no per-category tier cap**
and same-tier collisions are expected.

#### Eligibility bars (who MAY hold a tier)

| Bar | Requirement | Opens | Enforced? |
|---|---|---|---|
| Flat bar | ≥ 5 reviews **and** rating ≥ 4.0 **and** operator 90-day cancellation rate ≤ 10% (min 10 bookings; admin force-majeure pardons) | `boosted`, `featured`, `premium` | **Enforced** — `evaluateFlatBar` gates `changeTier` (unless inside the provisional window; admins bypass) + nightly `runEligibilityLifecycle` |
| Spotlight bar | ≥ 10 reviews **and** rating ≥ 4.5 **and** manual admin approval **and** < 3 active in destination | Destination Spotlight | **Enforced** — `assertSpotlightEligible` + `SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION` |
| (none) | — | `organic`, `standard` | n/a |

#### Lifecycle: provisional window → grace → demotion (`EligibilityState`)

Every tour gets a **one-time 90-day provisional window** from first publish during
which *any* tier may be held (no tour has history at launch). After it, a nightly
check enforces the bar: fail → notify → **30 days GRACE** → automatic demotion to the
highest tier the tour still qualifies for (= `organic`, since the flat bar gates all
three paid tiers). Existing bookings keep their snapshotted commission (tier changes
are never retroactive). States (`enums.prisma → EligibilityState`): `LOCKED` ·
`PROVISIONAL` · `ELIGIBLE` · `GRACE` · `DEMOTED`. **Built:**
`TiersService.runEligibilityLifecycle` runs in the §4 nightly job — it also
refreshes `operator.cancellationRate90d`. Grace entry/demotion are logged; the
operator email notice lands with the operator notification templates
(wireframe-gated, TODO). `DEMOTED` stays visible on the (now open-tier) tour until
the bar passes again.

#### Worked example — the Curaçao "Locals' favorites" grid

Pure `tier_rank ASC` (badges do **not** reorder):

Spotlight tours lead, then pure `tier_rank ASC` (badges never reorder):

| # | Tour | Spotlight | Tier (rank) | quality | Badge |
|---|---|---|---|---|---|
| 1 | Klein Curaçao Full-Day | ACTIVE | premium (1) | 65 | Sponsored (fallback) |
| 2 | Curaçao Street Food | — | featured (2) | 70 | Sponsored (fallback) |
| 3 | Sunset Sail with Open Bar | — | featured (2) | 70 | New (earned wins) |
| 4 | West Point Snorkel | — | boosted (3) | 75 | Most popular (earned wins) |
| 5 | Willemstad Old Town | — | boosted (3) | 75 | Sponsored (fallback) |
| 6 | Tugboat & Coral Garden | — | organic (4) | 80 | Likely to sell out |

Every paid-placement card explains itself: an earned badge when it has one
(#3, #4), the Sponsored fallback otherwise (#1, #2, #5). Open tiers are only
labeled when earned (#6). "Most popular" sits at #4 (not higher) because it's
*boosted* tier — a plain tier-2 tour outranks a badged tier-3 tour; that is the
commercial model working as designed.

### 3.1 Canonical order (master §7.2 + spotlight-first) — the "Locals' favorites" / Recommended sort

```
is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC
```

- **`is_sponsored`** (product decision 2026-07-18): the ACTIVE Spotlight tours
  (max 3/destination) lead every listing — the master's "separate labeled block,
  never interleaved" is realized as spotlight-first within the single grid.
- **`tier_rank`** (1=premium…5=standard), denormalized from the commission tier.
  Below the spotlight leaders, paid placements float up through tier_rank; the
  Sponsored badge itself is cosmetic (the spotlight FLAG is the sort key).
- **`quality_score`** (0–100, nightly job, read-only at query time):
  ```text
  quality_score = (avg_rating / 5)               * 40
                + (min(review_count, 100) / 100)  * 25
                + (listing_completeness / 100)    * 20
                + (conversion_rate / max_conv)    * 15
  ```
  `max_conv` = highest conversion rate among active tours in the same category.
- **`id`** = stable final tie-break. Same-tier collisions are valid; no per-category
  tier cap.

This supersedes the old weighted formula (conflict log B.17/B.46).

#### quality_score in full (master §7.2)

A 0–100 score, **only a tie-breaker within a tier** (it never lets a worse tier
outrank a better one — `tier_rank` is always the dominant key). Recomputed by the
nightly quality-score job and read-only at query time.

| Term | Weight | Definition | Range |
|---|---|---|---|
| Rating | **40** | `avg_rating / 5` | 0 (no/low rating) → 40 (5.0★) |
| Review volume | **25** | `min(review_count, 100) / 100` — caps at 100 reviews | 0 → 25 (≥100 reviews) |
| Listing completeness | **20** | fraction of the listing spec filled (images, description, attributes, meeting point, …) | 0 → 20 (fully complete) |
| Conversion | **15** | `conversion_rate / max_conv`, where `max_conv` = the **highest** conversion rate among active tours **in the same category** (recomputed per run, so it's relative) | 0 → 15 (category leader) |

- Total = 0–100. Higher is better, so the sort uses `quality_score DESC`.
- **Why it's category-relative:** the conversion term normalises against the best
  performer in the *same category*, so a niche category isn't penalised for lower
  absolute conversion than, say, day trips.
- **Demo placeholder:** the seed sets `quality_score = 60 + tier_rank*5` (65/70/75/
  80/85) — but the real formula (nightly job §4, `recomputeQualityScores`) now
  overwrites it on the first run after seeding.
- **Stored on** `tour.qualityScore`; **never** computed at request time.

### 3.2 Sort options (launch)

| UI label | Logic |
|---|---|
| Locals' favorites (default) | `is_sponsored DESC, tier_rank ASC, quality_score DESC, id` |
| Price: low to high | `price_from ASC` then `base_price` |
| Price: high to low | `price_from DESC` |

`buildOrderBy(sort)` maps these. "Highest rated"/"Most booked" return once volume is
meaningful; "Newest" stays out (the New badge covers recency).

### 3.3 Bookability filter (master §7.2)

Excluded from **every** ranked set: `status != LIVE`, `isActive=false`,
`isBookable=false`, or no availability in the next 30 days. An excluded tour does
not occupy a slot (the next tour moves up). Enforced by `findAll`, `search()`, the
`suggest()` tour hits, AND `findPublicByIds` (manual collections) — the "30-day
availability" rule is carried by `isBookable` (recomputed by the nightly
availability job) to avoid a per-request departures join.

### 3.4 Diversity pass (master §3.8)

Runs **after** ranking, on the default sort only: *never more than 2 tours of the
same subtype (primary category) consecutively.* Implemented in `applyDiversityPass`:

- Default behaviour: keep strict rank order, taking the earliest-ranked tour that
  won't form a 3-run.
- It deviates **only** when the most-abundant remaining subtype is *tight*
  (`count*2 - 1 ≥ remaining`) — i.e. it needs an every-other slot to stay
  interleavable — then it leads with that subtype so it isn't stranded into a tail
  3-run. This keeps `tier_rank` order intact except where §3.8 forces a minimal
  change, so **paid tiers are never pushed down for cosmetic spacing**.
- **Page-local** (operates on the fetched page, not across pagination). Explicit
  price/rating sorts are never reordered.

### 3.5 Peach tint (master §B.63) — frontend only

A peach background (`#FFF5EE`) on **card #1 of the All Tours page, default sort
only**, dropped during price sorts. Excluded: hub pages, numbered collections,
search results, related tours, category pages, and the destination "Locals'
favorites" grid. Pure presentation — no effect on order. **Built:**
`ToursListingSection` passes `peachFirst` (All Tours + default sort only) →
`ToursListing` tints card #1 on page 1 → `TourCard tinted` (resting bg `#FFF5EE`;
the hover / sponsored cream `#fdf6f0` still takes over when active).

---

## 4. The nightly scheduler

`@nestjs/schedule` (in-process cron — these are idempotent recomputes, not
retry/concurrency queues, so no Redis/BullMQ needed). Registered via
`ScheduleModule.forRoot()` in `AppModule`; jobs live in
`backend/src/workers/nightly-jobs.service.ts` (`WorkersModule`).

**`NightlyJobsService.nightly()` — `@Cron(EVERY_DAY_AT_3AM, tz: UTC)`** runs:
1. `TiersService.runSpotlightLifecycle()` — activate/expire spotlights + mirror
   `isSponsored`.
2. `ToursService.recomputeLikelyToSellOut()` — recompute the §3.7 demand signal for
   every LIVE tour.
3. `AvailabilityService.materializeAllLive()` + `recomputeAllBookable()` — departures
   + the §7.2 bookability gate.
4. `ToursService.recomputeQualityScores()` — the §7.2 `quality_score` formula
   (`src/tours/quality-score.ts`: rating 40 + reviews 25 + completeness 20 +
   conversion 15; conversion contributes 0 until pageview tracking lands).
5. `TiersService.runEligibilityLifecycle()` — provisional window → flat bar →
   30-day grace → demotion (+ refresh `operator.cancellationRate90d`).

Each is also a plain method, callable on demand (admin endpoint / tests / seed) and
exposed together via `NightlyJobsService.run()`.

---

## 5. End-to-end: one listing request

```
GET /tours?destinationId=…&sort=recommended
   │
   1. WHERE  status=LIVE ∧ isActive ∧ isBookable (+ destination/category/hub/…)   ← bookability §7.2
   2. ORDER BY is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC       ← spotlight-first + §7.2
   3. flattenTour → attach localized title, destinationSlug, primaryCategoryId
   4. deriveTourBadge(tour) → badge                                               ← badges §3.6/§3.7
   5. applyDiversityPass(page)  (recommended sort only)                           ← diversity §3.8
   │
   ▼ JSON: { total, data: [{ …tour, title, badge, … }] }
   │
frontend: TourCard renders the card; BadgeChip paints `badge`; order is consumed verbatim
```

`total` reflects the bookability-filtered set, so pagination counts are honest.

---

## 6. Lifecycle timelines

**Sponsored (Spotlight):**
```
day -7  operator requests           REQUESTED
day -7  admin approves (window -5…+25)   APPROVED
day -5  startsAt reached (nightly)   ACTIVE      isSponsored=true   → badge ON
day +25 endsAt passed (nightly)      EXPIRED     isSponsored=false  → badge OFF
```

**Likely to sell out (demand):**
```
publish … +90d                  age condition becomes satisfiable
rolling 60d window              ≥3 departures stamped soldOutAt
next 30d                        availability ratio drops < 0.40
nightly recompute               likelyToSellOut=true  → badge ON
… demand eases / window opens   nightly recompute      likelyToSellOut=false → badge OFF
```

---

## 7. Demo coverage

The demo surfaces **all four badges in every LIVE destination** (Curaçao, Aruba,
Sint Maarten), each on an `isLocalsFavourite` tour so they appear in the
destination's "Locals' favorites" grid:

- `sponsored` — an ACTIVE Spotlight on the per-destination lead
  (`commercial.ts`; sets `isSponsored` exactly as the prod lifecycle does).
- `mostPopular` — `SHOWCASE_MOST_POPULAR` tours get ≥10 redeemed bookings →
  forced-approved 5★ reviews (`bookings-payments.ts` + `reviews.ts`).
- `new` — `SHOWCASE_NEW` tours: `publishedDaysAgo: -8` and **zero** bookings.
- `likelyToSellOut` — `SHOWCASE_LIKELY_TO_SELL_OUT` tours: aged 100 days, 3 past
  SOLD_OUT departures + filled upcoming, then the **real** evaluator runs
  (`demand-showcase.ts`).

Slug sets live in `backend/prisma/demo/tours.ts`. Re-seed:
`pnpm prisma:seed:demo:clean && pnpm prisma:seed:demo` (the seed skips existing
rows, so clean first).

---

## 8. Invariants & edge cases

- **One badge per card.** Priority is total; ties resolved as in §2.2.
- **Sponsored = paid-placement FALLBACK** (final decision 2026-07-18) — shown on
  Spotlight/paid-tier cards only when no earned badge applies; earned badges
  always take the slot. Spotlight tours LEAD the ranking (`is_sponsored DESC`
  is the first sort key) regardless of which chip they wear.
- **`isSponsored` is derived state.** Never set it manually outside the spotlight
  lifecycle (prod) or the demo seed; it is recomputed from ACTIVE spotlights.
- **`tier_rank` is never client-written**; it is denormalized from `tier_key` on
  tier change (30-day lock).
- **Diversity never sacrifices a paid tier for spacing** — it deviates from
  `tier_rank` order only when a subtype would otherwise strand into a 3-run.
- **Bookability removes, never reorders** — an unbookable tour vanishes; positions
  close up.
- **Demo helpers are not production code.** `demand-showcase.ts` and the
  `SHOWCASE_*` sets only seed visible data; the evaluator/recompute they call are
  the production code.

---

## 9. Code map

| Concern | File |
|---|---|
| Badge derivation + priority | `backend/src/tours/tours.service.ts → deriveTourBadge` |
| Demand signal (§3.7) | `backend/src/tours/demand-signal.ts` |
| Demand recompute + admin endpoint | `tours.service.ts → recomputeLikelyToSellOut`, `tours.controller.ts` |
| Ranking order + bookability + diversity | `tours.service.ts → buildOrderBy`, `findAll`, `applyDiversityPass` |
| Spotlight lifecycle ↔ `isSponsored` | `backend/src/tiers/tiers.service.ts → approveSpotlight`, `runSpotlightLifecycle` |
| Nightly scheduler | `backend/src/workers/nightly-jobs.service.ts`, `workers.module.ts`, `ScheduleModule` in `app.module.ts` |
| API field | `SearchHitDto.badge`; `/tours` list item `badge` |
| Frontend render | `frontend/components/frontend/tour-card.tsx → BadgeChip`; `lib/tours/listing.ts`; hub `hub-tour-card.tsx` |
| Frontend listing (position consumer) | `frontend/components/frontend/destination/destination-listings.tsx` |
| Demo | `backend/prisma/demo/{tours,bookings-payments,reviews,demand-showcase,commercial}.ts` |
