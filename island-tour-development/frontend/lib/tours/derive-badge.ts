/**
 * Dashboard-owned tour badge derivation.
 *
 * The public site receives `badge` already derived by the backend and passes it
 * through. Admin tour rows carry no server-derived badge, so the dashboard
 * derives it from the raw signals to show the operator the same classification a
 * shopper would see.
 *
 * This module is a client-side mirror of the backend `deriveTourBadge` - the
 * backend is the source of truth. Full logic:
 * technical-doc/03-implementation/TOUR-BADGES.md. If the two disagree, the
 * backend wins and this file is the bug.
 *
 * Pure: no imports, no server/client-only APIs, safe in either bundle.
 */

/** Master §3.6 badge set. The dashboard's own copy - see the file header. */
export type TourBadge = 'new' | 'likelyToSellOut' | 'mostPopular' | 'sponsored' | null;

/** A tour is "new" for this long after publication, while it has no reviews. */
const NEW_TOUR_WINDOW_MS = 30 * 864e5;

/** Highest tier_rank that counts as a PAID placement (premium/featured/boosted). */
const PAID_TIER_MAX_RANK = 3;

/**
 * Derive the single badge for a tour. Priority (product decision 2026-07-18,
 * final): earned badges lead, 'sponsored' is the FALLBACK label for a paid
 * placement (active Spotlight OR paid tier P1-P3) with nothing better to show:
 *
 *   likelyToSellOut > mostPopular > new > sponsored
 *
 * First match wins.
 */
export function deriveTourBadge(t: {
  isSponsored?: boolean;
  tierRank?: number;
  likelyToSellOut?: boolean;
  likelyToSellOutOverride?: boolean | null;
  aggregateRating?: number | null;
  aggregateReviewCount?: number;
  publishedAt?: string | null;
}): TourBadge {
  if (t.likelyToSellOutOverride ?? t.likelyToSellOut ?? false) return 'likelyToSellOut';
  const reviews = t.aggregateReviewCount ?? 0;
  if (reviews >= 10 && (t.aggregateRating ?? 0) >= 4.5) return 'mostPopular';
  if (reviews === 0 && t.publishedAt) {
    const published = new Date(t.publishedAt).getTime();
    if (Number.isFinite(published) && Date.now() - published < NEW_TOUR_WINDOW_MS) return 'new';
  }
  if (t.isSponsored || (t.tierRank ?? 99) <= PAID_TIER_MAX_RANK) return 'sponsored';
  return null;
}
