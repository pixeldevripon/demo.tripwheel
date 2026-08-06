import { PAID_TIER_MAX_RANK } from '@/tiers/tiers.service';

/**
 * Listing badges (master §3.6 "Badges" + §3.7 "Demand signaling"), as pure
 * functions so EVERY surface that renders a tour card derives them the same
 * way. Full write-up: `technical-doc/03-implementation/TOUR-BADGES.md`.
 *
 * These lived as private methods on `ToursService`, which meant any listing
 * built by another service silently shipped badge-less cards - the wishlist did
 * exactly that: its own narrow `tourSelect` never fetched the inputs, so every
 * saved card rendered with an empty badge slot while the same tour showed
 * "Most popular" on All Tours.
 */

/** The frontend `TourBadge` key. At most one per card. */
export type TourBadge =
  | 'sponsored'
  | 'likelyToSellOut'
  | 'mostPopular'
  | 'new'
  | null;

/** Everything `deriveTourBadge` reads. Select all of it or the badge is wrong. */
export type BadgeInput = {
  isSponsored: boolean;
  tierRank: number;
  likelyToSellOut: boolean;
  likelyToSellOutOverride: boolean | null;
  publishedAt: Date | null;
  aggregateRating: number | null;
  aggregateReviewCount: number;
};

/**
 * The Prisma select fragment for the fields above. Spread it into any card
 * select that wants badges, so the field list cannot drift from the function
 * that reads it.
 *
 * `tierRank` is load-bearing but PRIVATE: strip it from public payloads AFTER
 * deriving (see `ToursService.neutralizeForPublic`). `isSponsored` stays - it
 * is a boolean, not a rate, and the card renders it.
 */
export const badgeSelect = {
  isSponsored: true,
  tierRank: true,
  likelyToSellOut: true,
  likelyToSellOutOverride: true,
  publishedAt: true,
  aggregateRating: true,
  aggregateReviewCount: true,
} as const;

/**
 * A card shows AT MOST ONE badge in its top-left slot; this resolves overlaps
 * by priority and returns the frontend key directly (no translation layer).
 *
 * Priority (first match wins) - PRODUCT DECISION 2026-07-18 (final): earned
 * badges lead; 'sponsored' is the FALLBACK label for any paid placement with
 * nothing better to show, so a top-ranked card always explains why it is up
 * there ("transparency is a brand pillar"):
 *
 *   1. 'likelyToSellOut'  Demand signal (§3.7), evaluated daily: tour_age >= 90d
 *                         AND >= 3 sellouts in the last 60d AND < 40% availability
 *                         over the next 30d. Computed by `evaluateLikelyToSellOut`
 *                         (src/tours/demand-signal.ts) into `tour.likelyToSellOut`;
 *                         the manual CMS launch override (`likelyToSellOutOverride`)
 *                         wins when set. Read here as `override ?? computed`. The
 *                         most selective badge (~5-10% of catalog).
 *   2. 'mostPopular'      Organic social proof: review_count >= 10 AND rating
 *                         >= 4.5. Never granted on commission grounds. The
 *                         "max 1 per category" cap is listing-level
 *                         (`applyMostPopularCap`); this returns per-tour
 *                         eligibility only.
 *   3. 'new'              Freshness: published < 30 days ago AND review_count == 0.
 *                         On the card it replaces the rating row.
 *   4. 'sponsored'        Paid placement with no earned badge: an ACTIVE
 *                         Destination Spotlight (`isSponsored`) OR a paid tier
 *                         P1-P3 (`tier_rank <= 3`, master §3.6 "Paid tiers P1
 *                         to P3 placements"). Labels why an unrated card sits
 *                         at the top; an earned badge is always more valuable
 *                         and replaces it.
 *
 * 1 and 3 are mutually exclusive (age >= 90 vs < 30); 2 and 3 are mutually
 * exclusive (>= 10 reviews vs 0). RANKING is untouched by any of this:
 * `is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC`.
 */
export function deriveTourBadge(
  tour: BadgeInput,
  now: Date = new Date(),
): TourBadge {
  // 1. Likely to sell out (§3.7) - the daily-evaluated demand signal stored on
  //    `likelyToSellOut` (worker output, see src/tours/demand-signal.ts), with the
  //    manual CMS launch override taking precedence (`override ?? computed`).
  if (tour.likelyToSellOutOverride ?? tour.likelyToSellOut)
    return 'likelyToSellOut';

  // 2. Most popular - earned by organic reviews (never on commission-tier grounds).
  if (tour.aggregateReviewCount >= 10 && (tour.aggregateRating ?? 0) >= 4.5) {
    return 'mostPopular';
  }

  // 3. New - recently published with no reviews yet.
  if (tour.aggregateReviewCount === 0 && tour.publishedAt) {
    const ageDays = (now.getTime() - tour.publishedAt.getTime()) / 86_400_000;
    if (ageDays < 30) return 'new';
  }

  // 4. Sponsored - fallback label for a paid placement (spotlight or paid
  //    tier P1-P3) with no earned badge: explains an otherwise unexplained
  //    top position.
  if (tour.isSponsored || tour.tierRank <= PAID_TIER_MAX_RANK)
    return 'sponsored';

  return null;
}

/**
 * Master §3.6: the "Most popular" badge is capped at MAX 1 PER CATEGORY.
 * Page-local like the diversity pass: walking the final display order, the
 * first tour of each primary category keeps the badge; later ones fall back
 * to the next badge down the priority - 'sponsored' when the tour is a paid
 * placement (spotlight or tier P1-P3), otherwise no badge ('new' can never
 * apply here: it needs zero reviews, mostPopular needs >= 10). Mutates in
 * place.
 */
export function applyMostPopularCap<
  T extends {
    badge: TourBadge;
    primaryCategoryId: string | null;
    isSponsored: boolean;
    tierRank: number;
  },
>(items: T[]): T[] {
  const seen = new Set<string | null>();
  for (const item of items) {
    if (item.badge !== 'mostPopular') continue;
    if (seen.has(item.primaryCategoryId)) {
      item.badge =
        item.isSponsored || item.tierRank <= PAID_TIER_MAX_RANK
          ? 'sponsored'
          : null;
    } else {
      seen.add(item.primaryCategoryId);
    }
  }
  return items;
}
