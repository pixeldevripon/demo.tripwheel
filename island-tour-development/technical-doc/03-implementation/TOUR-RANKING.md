# Tour Listing Ranking & Position

> **Full end-to-end reference (badges + position + lifecycles + scheduler):**
> [`TOUR-BADGES-AND-RANKING.md`](./TOUR-BADGES-AND-RANKING.md). This file is the
> focused ranking quick-ref.

Engineer-facing derivation of master §7.2 ("Ranking / listing order") + §3.8
("Diversity pass"). The master HTML is canonical on any disagreement. Companion:
`TOUR-BADGES.md`.

Every tour listing surface (destination "Locals' favorites", All Tours, category,
hub tours, search-within-bucket) orders results through **one** code path -
`ToursService.findAll` → `buildOrderBy` → `applyDiversityPass`. Change it there and
every listing moves together.

## The canonical order (master §7.2)

The default sort - shown to travelers as **"Locals' favorites"** (a.k.a.
"Recommended") - is exactly:

```
tier_rank ASC, quality_score DESC, id ASC
```

- **`tier_rank`** (`1` = premium … `5` = standard) is denormalized from the
  operator's commission tier. Paid placements float to the top **through tier_rank
  alone** - there is no separate "sponsored" sort key. The Sponsored *badge* (§3.6)
  is cosmetic and never changes position.
- **`quality_score`** (0-100, nightly job, read-only at query time):
  ```
  quality_score = (avg_rating / 5)              * 40
                + (min(review_count, 100) / 100) * 25
                + (listing_completeness / 100)   * 20
                + (conversion_rate / max_conv)   * 15
  ```
  `max_conv` = highest conversion rate among active tours in the same category.
- **`id`** is the stable final tie-break. Same-tier collisions are expected and
  valid; there is **no per-category tier cap**.

> This supersedes the earlier weighted formulas (architecture doc + All Tours spec:
> bookings 0.4 / rating 0.3 / recency 0.2 / reviews 0.1) per conflict log **B.17**
> and **B.46** - "Locals' favorites" is just the UI label for the tier ordering.

### Sort options at launch (conflict log 68)

| UI label | Logic |
|---|---|
| Locals' favorites (default) | `tier_rank ASC, quality_score DESC, id` |
| Price: low to high | `price_from ASC` (then `base_price`) |
| Price: high to low | `price_from DESC` |

"Highest rated" / "Most booked" return once review/booking volume is meaningful;
"Newest" stays out (the New badge covers recency).

## Bookability filter (master §7.2)

A tour is excluded from **every** ranked result set, regardless of tier, when
`status != LIVE`, `is_active = false`, `is_bookable = false`, or it has no
availability in the next 30 days. An excluded tour does **not** occupy a position
(the next eligible tour moves up). In `findAll` the where-clause enforces
`status = LIVE AND isActive AND isBookable`; the "no availability in 30 days" rule
is carried by `isBookable`, which the nightly availability job clears (avoids a
per-request departures join).

## Diversity pass (master §3.8)

Runs **after** ranking, on the default sort only: *never more than 2 tours of the
same subtype consecutively*. Implemented in `applyDiversityPass` over the fetched
page, using `primaryCategoryId` as the subtype. When a 3rd same-subtype tour would
land back-to-back-to-back, the next tour of a different subtype is pulled up to
break the run; if none is available it keeps strict rank order. It is **page-local**
(operates on the returned page, not across pagination). Explicit price/rating sorts
are never reordered.

## Peach tint (master §B.63) — frontend only

A subtle peach background (`#FFF5EE`) on **card #1 of the All Tours page under the
default sort only**, dropped during price sorts. **Excluded:** hub pages and
numbered collections. The destination "Locals' favorites" grid is not the All Tours
page, so it carries no peach tint. This is a pure presentation rule (no effect on
order); apply it in the All Tours listing component when built.

## Pointers

- Order + diversity: `backend/src/tours/tours.service.ts` → `buildOrderBy`,
  `applyDiversityPass`, and the `findAll` where-clause / return.
- API: `GET /api/v1/tours?sort=recommended|price_asc|price_desc|rating|newest`
  (default `recommended`); `total` reflects the bookability-filtered set.
- Frontend: listings consume the API order verbatim and must not re-sort - see the
  header comment in `frontend/components/frontend/destination/destination-listings.tsx`.
- Badges (independent of position): `TOUR-BADGES.md`.
