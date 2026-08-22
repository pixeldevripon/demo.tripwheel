/**
 * Public review data (server-side, cached). Backs the tour detail page's review
 * preview strip and full reviews section. Hits the public
 * `GET /reviews?tourId=…`, which returns approved reviews only, paginated
 * `{ total, page, limit, data }`, with each `comment` localized (EN/any
 * fallback). The endpoint is keyed by the tour UUID, so resolve the tour by slug
 * first (`getTourBySlug`) and pass its `id` here.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type {
  PublicReviewList,
  PublicReviewSummary,
  ReviewSort,
} from '@/types/review';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Approved reviews for a tour (by id), newest first by default. Returns
 * `{ total: 0, page: 1, limit, data: [] }` if the backend is unreachable.
 *
 * Cached daily (review moderation busts the tags); every param is part of the
 * cache key.
 */
export async function getTourReviews(params: {
  tourId: string;
  locale?: Locale;
  sort?: ReviewSort;
  page?: number;
  limit?: number;
  /** Only reviews carrying photos - feeds the guest-photo strip. */
  withPhotos?: boolean;
}): Promise<PublicReviewList> {
  'use cache';
  cacheLife('days');
  // Granular `tour:<id>` too, so approving/removing a review for one tour (or
  // editing that tour) refreshes only its reviews, not every tour's.
  cacheTag('reviews', `tour:${params.tourId}`);

  const { tourId, locale = DEFAULT_LOCALE, sort, page, limit, withPhotos } =
    params;
  const res = await publicGet<PublicReviewList>(
    `/reviews${buildQuery({ tourId, locale, sort, page, limit, withPhotos })}`,
  );
  return res ?? { total: 0, page: 1, limit: limit ?? 10, data: [] };
}

/**
 * LD11 rating summary for a tour: which rating to show, the count behind it, and
 * the approved-only star distribution.
 *
 * This exists because the tour payload's `aggregateRating` / `aggregateReviewCount`
 * are the TOUR's own numbers and cannot express the cold-start fallback. Only this
 * endpoint knows whether a rating is the tour's, borrowed from the operator, or
 * absent - so read `source` here rather than re-deriving the 3 / 10 / 4.0
 * thresholds on the frontend, where they would drift from
 * `backend/src/reviews/review-display.util.ts`.
 *
 * Returns a `none` summary if the backend is unreachable, so an outage hides the
 * rating rather than breaking the page.
 */
export async function getTourReviewSummary(
  tourId: string,
): Promise<PublicReviewSummary> {
  'use cache';
  cacheLife('days');
  cacheTag('reviews', `tour:${tourId}`);

  const res = await publicGet<PublicReviewSummary>(
    `/reviews/summary${buildQuery({ tourId })}`,
  );
  if (!res) {
    return {
      tourId,
      source: 'none',
      rating: null,
      reviewCount: 0,
      approvedCount: 0,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })),
      themes: [],
      guestTypes: [],
      languages: [],
      photoCount: 0,
      avgValue: null,
      avgGuide: null,
      avgSafety: null,
    };
  }
  // `themes` and `photoCount` were added after launch, and this loader is
  // `'use cache'` with a `days` lifetime - so a cached entry written by the
  // previous shape, or a frontend deployed ahead of the backend, hands back an
  // object with those keys simply absent. The consumers call `.length` and
  // `.map` on them, which would be a TypeError rather than a missing chip bar.
  return {
    ...res,
    themes: res.themes ?? [],
    guestTypes: res.guestTypes ?? [],
    languages: res.languages ?? [],
    photoCount: res.photoCount ?? 0,
  };
}
