/**
 * Client-side public reviews fetch (browser). Powers the tour detail page's
 * "Show more" pagination. Hits the same `@Public()` `GET /reviews` endpoint as
 * the server loader (`lib/api/public/reviews.ts`) - no auth cookie needed, so it
 * calls the backend directly with a plain GET.
 */
import { buildQuery } from '@/lib/api/query';
import type { Locale } from '@/lib/constants/locales';
import type { PublicReviewList, ReviewSort } from '@/types/review';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/** Reviews page size - shared by the server's initial load and client paging. */
export const REVIEWS_PAGE_SIZE = 10;

/**
 * Cap for the guest-photo strip on the tour page, so a long review set never
 * renders hundreds of tiles. Lives here (a shared, non-client module) because
 * both the server block that fetches the photos and the client section that
 * renders them need it - importing it from the 'use client' component would
 * hand the server a client-reference proxy instead of a number.
 */
export const PHOTO_STRIP_LIMIT = 12;

/** One page of approved reviews for a tour (by id). Throws on a non-2xx. */
export async function fetchTourReviews(params: {
  tourId: string;
  locale?: Locale;
  sort?: ReviewSort;
  page?: number;
  limit?: number;
  /** Single star value 1-5 (the clickable chart, LD31). */
  rating?: number;
  /** Exact theme-tag match (the theme chips, FE-9). */
  themeTag?: string;
  /** Phase 7 depth filters. */
  reviewerType?: string;
  withPhotos?: boolean;
  /** Language the review was WRITTEN in - not the display locale. */
  writtenIn?: string;
}): Promise<PublicReviewList> {
  const {
    tourId,
    locale,
    sort,
    page,
    limit,
    rating,
    themeTag,
    reviewerType,
    withPhotos,
    writtenIn,
  } = params;
  const res = await fetch(
    `${BASE_URL}/reviews${buildQuery({ tourId, locale, sort, page, limit, rating, themeTag, reviewerType, withPhotos, writtenIn })}`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
  return (await res.json()) as PublicReviewList;
}
