# Commercial Model — Tiers, Ranking & Eligibility

Canonical source: master §1.4, §7.1, §7.2, §7.3 (`island-tours-platform-master.html` v1.9).

Purpose: defines the commission-tier economy that governs tour placement on Island Tours. A tour's commercial tier sets both its commission rate and its sort position; a nightly quality score and a flat eligibility bar keep paid placement honest. **This engine fully replaces the old featured-slot economy** (see "Removed: the slot economy" at the bottom).

Sibling docs: [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md) · [DATA-MODEL.md](./DATA-MODEL.md) · [AVAILABILITY-AND-DEPARTURES.md](./AVAILABILITY-AND-DEPARTURES.md) · [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md) · [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md)

> Status: **canonical/target**. None of this is built yet — there is no commission-tier, quality_score, ranking, or eligibility code. The current schema still carries slot scaffolding (`FeaturedSlot` / `SlotLock` / `SlotHistory` / `WaitlistEntry`) and category-create still seeds 3 `FeaturedSlot` rows. That scaffolding must be removed; the work is tracked in [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).

---

## 1. The tier table

Island Tours is a commission marketplace. Operators pay a tiered commission; placement is a commercial choice within a flat quality bar. Tier mechanics are **internal commercial logic, never user-facing** — travelers never see "tier", commission, or `tier_rank`.

| Tier (`tier_key`) | Commission | `tier_rank` |
|---|---|---|
| `premium`  | 30%   | 1 |
| `featured` | 27.5% | 2 |
| `boosted`  | 25%   | 3 |
| `organic`  | 22.5% | 4 |
| `standard` | 20%   | 5 |

- **`standard` is the default tier** for every new tour and the locked rate for operators on a negotiated 20% agreement. It **deliberately ranks below `organic`**: a 20% operator who wants to outrank other base-rate tours must move up to `organic` at 22.5%. This is intentional, not a bug.
- `tier_rank` is the sole tier-derived sort key (lower wins). It is **denormalized from `tier_key`** for index/sort performance and is **never written by the client directly** — it is set on tier change alongside `commission_tier`.

### Destination Spotlight (35%) — separate block

Spotlight is **not** a sixth interleaved tier. It is a separate, labeled placement block:

| | |
|---|---|
| Commission | **35%** |
| Placement | Separate labeled block, **never interleaved** with the ranked list |
| Cap | **Max 3 simultaneous per destination** |
| Approval | **Manual** — operator requests, Island Tours approves (not self-serve) |
| Extra eligibility | 10 reviews · rating ≥ 4.5 (on top of the flat bar) |

---

## 2. Tour tier columns

Fields on the `tours` table (master §10220-ff "Data model"):

```
commission_tier   DECIMAL(4,1)  default 20.0     -- the commission percentage
tier_key          VARCHAR(20)   default 'standard'
tier_rank         SMALLINT      default 5        -- denormalized from tier_key; sort key
tier_locked_until TIMESTAMP     nullable         -- 30-day lock after a tier change
quality_score     DECIMAL(6,2)  default 0        -- nightly job, read-only at query time
```

### Tier change + 30-day lock

Operators pick their tier in the operator dashboard. On any tier change, **all three tier columns update together** and the lock is set:

```
tier_key          = <new tier>
commission_tier   = <new commission %>
tier_rank         = <new rank>          -- denormalized, server-set
tier_locked_until = now() + 30 days
```

Further tier changes are **rejected while `tier_locked_until` is in the future**. Tier selection is additionally gated by the eligibility engine (§5) — the requested tier must be one the tour currently qualifies for.

> `tier_rank` and `quality_score` are server-owned. The client may set `tier_key` (subject to lock + eligibility); the server derives the rest.

---

## 3. Commission snapshot on booking

`commission_rate` and `commission_amount` **snapshot onto every booking at creation and never change retroactively** (master §7.1). A later tier change, demotion, or rate edit does not touch existing bookings.

| Booking field | Type | Meaning |
|---|---|---|
| `commission_rate`   | `decimal(5,4)` | e.g. `0.20` for 20% — snapshot at booking time |
| `commission_amount` | `decimal(10,2)` | **in EUR** — the conversion value for every analytics platform |

`commission_amount` (EUR) is the conversion value reported to Google Ads, GA4, and Meta — **never GMV**. See [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md) and the booking schema in [DATA-MODEL.md](./DATA-MODEL.md).

### Deposit percentage is tier-driven

Tier also drives the deposit a traveler pays at booking (master §1.4, LD24):

```
tour.deposit_pct : 20 to 30, in 2.5 steps   (20, 22.5, 25, 27.5, 30)
```

`deposit_pct` governs how much of the booking is taken to Island Tours via Stripe on the deposit payment models; the balance handling is defined in [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md).

---

## 4. Ranking (listing order)

Canonical: master §7.2 and the appended ranking rule (master §10220). On any **category page or search query**, tours sort by:

```
ORDER BY
  tier_rank ASC,        -- 1 (premium) before 5 (standard)
  quality_score DESC,   -- within a tier, higher quality first
  id ASC                -- stable final tiebreaker
```

Reference query (category page):

```sql
SELECT *
FROM tours
WHERE category_slug = $1
  AND status = 'active'
  AND is_bookable = true
ORDER BY
  tier_rank ASC,
  quality_score DESC,
  id ASC
LIMIT $2 OFFSET $3;
```

For search queries, replace the `category_slug` filter with the search match condition; the `ORDER BY` block is **identical**.

- The earlier weighted ranking formulas (architecture document, early tier doc, the All Tours sort spec) are **superseded** by this rule.
- Same-tier collisions are **expected and valid** — tours in a tier order by `quality_score`, then `id`. There is **no per-category tier cap**.

### Bookability filter

A tour is **excluded from every ranked result set, regardless of tier**, when:

- `status != 'active'`, **or**
- `is_bookable = false`, **or**
- it has **no open departure in the next 30 days**.

An excluded tour does **not occupy a position** (the next eligible tour moves up) and is **not billed for its tier** during the unbookable period. "No open departure in the next 30 days" is resolved against the departures model — see [AVAILABILITY-AND-DEPARTURES.md](./AVAILABILITY-AND-DEPARTURES.md) (bookability = EXISTS an open departure within 30 days).

### Diversity pass

A **diversity pass runs after ranking** (master §3.8) to avoid one operator dominating the top of a result set. It reorders within the already-ranked, already-filtered set; it does not change tier economics.

---

## 5. Quality score (nightly job)

`quality_score` is computed by a **nightly job**, is **read-only at query time**, and ranges **0 to 100** (master §7.2):

```
quality_score =
  (avg_rating / 5)               * 40 +
  (min(review_count, 100) / 100) * 25 +
  (listing_completeness / 100)   * 20 +
  (conversion_rate / max_conv)   * 15
```

| Component | Weight | Notes |
|---|---|---|
| `avg_rating / 5`                 | 40 | Approved reviews only (see review aggregates) |
| `min(review_count, 100) / 100`   | 25 | Caps at 100 reviews |
| `listing_completeness / 100`     | 20 | Listing-fill score, 0–100 |
| `conversion_rate / max_conv`     | 15 | Normalized against the best in-category converter |

- **`max_conv`** = the **highest conversion rate among active tours in the same category, recomputed per run**. This normalizes the conversion component so the best in-category converter contributes the full 15 points and everyone else scales against it.
- The score is never computed at query time — the ranking query reads the stored column. The nightly job is the only writer.

---

## 6. Eligibility engine

Canonical: master §7.2 and the appended eligibility spec (master §10247-ff, locked June 10, 2026). A **flat bar** was chosen over the earlier "March ladder" draft: one threshold proves base quality, after which the tier is a purely commercial visibility choice. Only Spotlight carries a higher bar plus manual approval.

### The flat bar (opens `boosted`, `featured`, `premium`)

A tour's operator must meet **all three**:

| Requirement | Definition |
|---|---|
| **≥ 5 reviews** | Approved reviews only (review moderation); the same `review_count` the tour page renders |
| **rating ≥ 4.0** | The same `aggregate_rating` the tour page renders |
| **cancellation rate ≤ 10%** | Operator-initiated cancellations ÷ confirmed bookings, **trailing 90 days, across all the operator's tours** |

One flat bar opens all three paid self-serve tiers — there is no per-tier ladder.

**Cancellation-rate details:**
- **Traveler cancellations never count** — only operator-initiated cancellations.
- The gate applies **only at ≥ 10 confirmed bookings** in the trailing-90-day window. Below that the denominator is too thin to be fair (1 cancellation of 2 bookings is not a 50% operator).
- **Force-majeure pardons:** an admin can pardon an event (date range + destination — e.g. a hurricane day). Operator cancellations inside a pardoned range are **excluded for everyone at once**. Weather is otherwise an ordinary cancellation: the customer harm is identical and weather resilience is operator quality.

### Destination Spotlight (extra bar)

On top of the flat bar, Spotlight requires:

- **≥ 10 reviews**
- **rating ≥ 4.5**
- cancellation rate ≤ 10%
- **manual approval** (operator requests, Island Tours approves)
- **max 3 simultaneous per destination** (hard cap)

### Provisional window + nightly enforcement

```
First publish ──► one-time 90-day PROVISIONAL window
                  (any tier may be held, ungated)
                          │
                  window ends
                          │
                          ▼
            Nightly check (after the window):
            tour still meets the bar for its held tier?
                  │yes                    │no
                  ▼                       ▼
            keep tier            NOTIFY operator
                                 ──► 30-day GRACE period
                                          │ still failing at end of grace
                                          ▼
                                 AUTO-DEMOTE to the highest tier
                                 the tour still qualifies for
```

- **One-time 90-day provisional window** from first publish: during it, **any tier may be held** with no eligibility check. It does not reset.
  - The window is measured from `tours.firstPublishedAt`, stamped **once** by
    `ToursService.publish` and never moved by a later pause/republish (that is
    `publishedAt`, which tracks the current spell). A null reads as "still
    provisional", so the column must be written on the first publish or the
    tour is exempt from demotion forever. Fixed 2026-07-29 - publish previously
    wrote `publishedAt` only, and migration
    `20260729210000_backfill_first_published_at` backfills the tours that
    shipped with a null.
- **After the window**, a **nightly check** enforces the bar. On failure: **notify → 30-day grace → automatic demotion** to the highest tier the tour still qualifies for.
- **Existing bookings keep their snapshotted commission** through any demotion (§3). Demotion only changes future bookings' rate and the tour's `tier_rank`.

---

## 7. Badges & labels (high level)

These are the user-facing surfaces of the otherwise-internal tier system. **Visuals and exact copy live in the design system / page specs — this doc states the rules, not the pixels.**

| Surface | Rule |
|---|---|
| **Sponsored** badge | On paid placements **P1–P3** (gray). Marks tier-paid positions in the ranked list. |
| **"Most popular"** | Per master §3.6 — a single highlighted card; not a tier label. |
| **"Locals' favorites"** | The **UI label for the tier ranking itself** (master §7.2). The earlier weighted "Locals' favourites" sort formula is superseded; the label now names this ordering. |
| Results-counter tooltip | Explains ranking and Sponsored placement in **one sentence**. |

Tier names, commission, and `tier_rank` are **never shown to travelers**.

---

## 8. Affiliate program

Canonical: master §7.3 (confirmed June 10, 2026).

- **Rate:** **8% of GMV** (total tour price), **funded entirely out of Island Tours' commission take** — not added on top. Worked example: a $240 booking at the 25% tier yields $60 commission; the affiliate earns $19.20, Island Tours nets $40.80.
- **Platform:** **Trackdesk** (primary) — chosen for server-side postback, dynamic commission amounts, an on-hold→approved lifecycle, the widest payout rails, and scriptless GDPR-compliant tracking. Tapfiliate is the mature alternative, FirstPromoter the middle option. Stripe-native tools (PromoteKit, Rewardful, Tolt) are **structurally incompatible** — they calculate off the ~20% Stripe charge, not the full tour price.
- **Attribution is owned by the platform's own backend** via the `booking_complete` event (see [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md)). **Promo codes double as attribution identifiers** in the booking widget. The platform purchase buys the partner portal, payout rails, and fraud detection — not the attribution itself.
- **Lifecycle:** commission goes **on hold at booking** and **approves after the cancellation window closes** (clawback-safe) — mapped to the per-tour cancellation window in [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md). Payouts in USD and EUR.
- **Partner types:** influencers/creators, accommodation owners, travel agents/concierges, local businesses. Terms transparent; no dark patterns.

---

## 9. Removed: the slot economy

The old **featured-slot economy is removed** from the target architecture. There is no longer:

- `FeaturedSlot` / `SlotLock` / `SlotHistory` / `WaitlistEntry`
- `lockSlot` → `publishTrip`, soft-lock / hard-reserve flows
- "3 featured slots per category" as the placement mechanism
- category-create seeding 3 `FeaturedSlot` rows

Placement is governed **entirely** by commission tiers + the ranking query + the eligibility engine described above.

> **Current code state:** the slot scaffolding still **exists in the schema** and category-create still seeds 3 `FeaturedSlot` rows. This is a known mismatch to be deleted — tracked in [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md). Do not build new code against the slot tables.
