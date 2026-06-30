# Tour Listing Badges

> **Full end-to-end reference (badges + position + lifecycles + scheduler):**
> [`TOUR-BADGES-AND-RANKING.md`](./TOUR-BADGES-AND-RANKING.md). This file is the
> focused badge quick-ref.

Engineer-facing derivation of master §3.6 ("Badges") + §3.7 ("Demand signaling: one
trigger"). The master HTML is canonical on any disagreement.

A tour card shows **at most one** badge, in the top-left slot. The badge is derived
**once, on the backend** (`ToursService.deriveTourBadge`) and returned as a `badge`
field on every public tour-list item, so every listing surface (destination
"Locals' favorites", search results + typeahead, All Tours, hub tours) renders the
exact same badge with zero client-side logic. The frontend just paints
`hit.badge` (see `frontend/components/frontend/tour-card.tsx` → `BadgeChip`).

## The badge set (master §3.6)

| Badge (key) | Trigger | Shape / colour |
|---|---|---|
| `sponsored` | Paid placement = an **ACTIVE Destination Spotlight** (mirrored onto `tour.isSponsored`). Commission tier alone does NOT make a tour sponsored. | Rounded rect, **gray** (`bg-it-surface`) |
| `likelyToSellOut` | §3.7 demand signal (below). | Rounded rect, **navy** `#193c5e` |
| `mostPopular` | Organic: `aggregateReviewCount >= 10` AND `aggregateRating >= 4.5`, not sponsored. | Rounded rect, **brand orange** `#e8611a` |
| `new` | `publishedAt` < 30 days ago AND `aggregateReviewCount == 0`. Replaces the rating row. | Rounded rect, cream `#fdf6f0` |

Not card badges (handled elsewhere, intentionally **not** in `deriveTourBadge`):
- **Numbered rank 01-10** - circle, Best Things to Do / Top 10 collections only.
- **Locals' favorite ✦** - meta-row element on the tour page; manual
  `tour.isLocalsFavourite` (it also selects the destination featured grid).

## Priority (only one badge wins)

`deriveTourBadge` checks in this order and returns the first match:

1. **`sponsored`** - master: *"always shown on paid placement; transparency is a
   brand pillar"*, so it outranks every earned badge.
2. **`likelyToSellOut`** - the most selective signal (~5-10% of catalog), ranked
   above social proof.
3. **`mostPopular`** - earned by reviews; *"never on commission-tier grounds"*.
4. **`new`** - freshness fallback.

Most pairs are mutually exclusive by definition (`new` needs 0 reviews, so it can't
also be `mostPopular`; `likelyToSellOut` needs age ≥ 90d, `new` needs < 30d). The
only real overlaps are *sponsored vs any earned badge* (sponsored wins) and
*likelyToSellOut vs mostPopular* (sell-out wins).

> **Known simplification:** master caps `mostPopular` at *"max 1 per category"*.
> That dedup is a **listing-level** concern and belongs to the ranking pass (§7.2);
> `deriveTourBadge` returns per-tour eligibility only. See `TOUR-RANKING.md`.

## "Sponsored" = active Destination Spotlight (master §3.6 / §7.2)

"Paid placements P1–P3" are the **max-3 Destination Spotlight slots per destination**
— NOT the self-serve commission tiers (those drive *position* via `tier_rank`, not a
badge). Flow:

1. Operator **requests** Spotlight on an owned tour (`POST /tiers/...`, eligibility-
   gated → `SpotlightRequest.status = REQUESTED`).
2. Admin **approves** with a window (`approveSpotlight`): `→ APPROVED`, or `→ ACTIVE`
   immediately if the window is already open (and then `tour.isSponsored = true`).
3. The nightly **lifecycle** (`runSpotlightLifecycle`) flips `APPROVED → ACTIVE` at
   `startsAt` and `ACTIVE → EXPIRED` at `endsAt`, recomputing `tour.isSponsored` from
   ground truth (true iff the tour has ≥1 ACTIVE spotlight).
4. While `isSponsored` is true, `deriveTourBadge` returns `sponsored` (top priority),
   so the card shows the gray **Sponsored** badge. When the window closes the badge
   clears automatically on the next lifecycle run.

`isSponsored` is denormalized (like `tier_rank`) so listings don't join the spotlight
table per card. The lifecycle is wired into the nightly scheduler
(`src/workers/nightly-jobs.service.ts`).

## §3.7 demand signal — "Likely to sell out"

ONE algorithm powers both the card badge and the tour-page demand card. All three
conditions must hold, **evaluated daily**:

1. `tour_age_days >= 90`
2. `recent_sellouts >= 3` in the past 60 days (from `departures.sold_out_at`, E.9)
3. `upcoming_availability_ratio < 0.40` over the next 30 days
   (`Σ remaining_seats / Σ capacity` across non-cancelled departures in the window)

Implemented in `backend/src/tours/demand-signal.ts` (`evaluateLikelyToSellOut`) -
the **single source of truth** shared by the production recompute job and the demo
seed, so they can never drift. The computed result is stored on
`tour.likelyToSellOut`; a nullable `tour.likelyToSellOutOverride` is the manual CMS
launch override (no tour has 90 days of history at launch). Read-time logic is
`override ?? computed`.

### Where it is computed
- **Production:** `ToursService.recomputeLikelyToSellOut()` sweeps LIVE tours and
  writes `likelyToSellOut`. Runs nightly (BullMQ, master §workers) and on demand via
  `POST /api/v1/tours/admin/recompute-demand?tourId=` (admin only).
- **Demo:** `backend/prisma/demo/demand-showcase.ts` makes the three conditions
  genuinely true for one tour per live destination, then calls the same evaluator.

## Data sources (per badge)

| Badge | Fields read |
|---|---|
| `sponsored` | `tour.isSponsored` (← ACTIVE `SpotlightRequest`) |
| `likelyToSellOut` | `tour.likelyToSellOut` / `tour.likelyToSellOutOverride` (← `departures.soldOutAt`, capacity vs bookedCount, `firstPublishedAt`) |
| `mostPopular` | `tour.aggregateReviewCount`, `tour.aggregateRating`, `tour.isSponsored` |
| `new` | `tour.publishedAt`, `tour.aggregateReviewCount` |

## Demo coverage

The demo seed surfaces **all four** badges in **every live destination**
(Curaçao, Aruba, Sint Maarten) - one `isLocalsFavourite` tour per badge, so each
appears in the destination "Locals' favorites" grid. Slug sets live in
`backend/prisma/demo/tours.ts` (`SHOWCASE_*`). Re-seed with
`pnpm prisma:seed:demo:clean && pnpm prisma:seed:demo`.

## Pointers

- Backend logic: `backend/src/tours/tours.service.ts` → `deriveTourBadge`
- Demand signal: `backend/src/tours/demand-signal.ts`
- API field: `SearchHitDto.badge` and the `/tours` list item `badge`
- Frontend render: `frontend/components/frontend/tour-card.tsx` → `BadgeChip`,
  type `TourBadge`; hub variant `hub-tour-card.tsx` (`HubTourBadge`)
- Ranking / position: `TOUR-RANKING.md`
