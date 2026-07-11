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

import type { PublicReviewList, ReviewSort } from '@/types/review';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Approved reviews for a tour (by id), newest first by default. Returns
 * `{ total: 0, page: 1, limit, data: [] }` if the backend is unreachable.
 *
 * Cached hourly and tagged `reviews`; every param is part of the cache key.
 */
export async function getTourReviews(params: {
  tourId: string;
  locale?: Locale;
  sort?: ReviewSort;
  page?: number;
  limit?: number;
}): Promise<PublicReviewList> {
  'use cache';
  cacheLife('hours');
  // Granular `tour:<id>` too, so approving/removing a review for one tour (or
  // editing that tour) refreshes only its reviews, not every tour's.
  cacheTag('reviews', `tour:${params.tourId}`);

  const { tourId, locale = DEFAULT_LOCALE, sort, page, limit } = params;
  const res = await publicGet<PublicReviewList>(
    `/reviews${buildQuery({ tourId, locale, sort, page, limit })}`,
  );
  return res ?? { total: 0, page: 1, limit: limit ?? 10, data: [] };
}
