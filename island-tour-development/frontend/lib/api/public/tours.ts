/**
 * Public tour-listing data (server-side, cached). Backs destination-page tour
 * grids (e.g. "Locals' favorites"). Hits the public `GET /tours` listing, which
 * returns LIVE tours with localized titles, hero image, price, rating, and the
 * `isLocalsFavourite` flag - the same shape as a search hit (`SearchHit`).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { SearchHit } from '@/types/search';
import type { PublicTourDetail } from '@/types/tour-detail';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

export interface TourListResult {
  total: number;
  data: SearchHit[];
}

/**
 * LIVE tours for a destination (by id), ordered `recommended` by default. Pass
 * `localsFavourite` to restrict to flagged tours, `categoryId` to restrict to a
 * single category (e.g. related "same-category" grids), `limit: 1` to cheaply
 * read the destination-wide `total`. Returns `{ total: 0, data: [] }` if the
 * backend is unreachable.
 *
 * Cached hourly and tagged `tours`; every param is part of the cache key.
 */
export async function getDestinationTours(params: {
  destinationId: string;
  locale?: Locale;
  localsFavourite?: boolean;
  categoryId?: string;
  /** Multi-select category filter (CSV of ids); a tour in ANY matches. */
  categoryIds?: string;
  /** Restrict to tours assigned to this activity hub (by hub UUID). */
  hubId?: string;
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  /** Price range filter (on `basePrice`). */
  minPrice?: number;
  maxPrice?: number;
  /** Minimum aggregate rating (0-5). */
  ratingMin?: number;
  /** Duration filter in minutes (on `durationMinutesFrom`). */
  durationMin?: number;
  durationMax?: number;
  /** Free-cancellation cutoff ceiling in hours (cancellationHours <= value). */
  cancellationMaxHours?: number;
  /** Restrict to tours that offer pickup (pickupModel != NONE). */
  pickupAvailable?: boolean;
  /** Availability anchor date (YYYY-MM-DD). Enables `guests`/`timeOfDay`. */
  date?: string;
  /** Party size; only applied together with `date`. */
  guests?: number;
  /** Time-of-day buckets CSV (morning|afternoon|evening); needs `date`. */
  timeOfDay?: string;
  /**
   * Dynamic attribute filters (AttributeDefinition.key -> selected values), sent
   * as raw `?key=v1,v2` params. The backend's `buildAttributeFilters` applies them
   * (comma = OR within a key, multiple keys = AND).
   */
  attributes?: Record<string, string[]>;
  limit?: number;
  page?: number;
}): Promise<TourListResult> {
  'use cache';
  cacheLife('hours');
  cacheTag('tours');

  const {
    destinationId,
    locale = DEFAULT_LOCALE,
    localsFavourite,
    categoryId,
    categoryIds,
    hubId,
    sort,
    minPrice,
    maxPrice,
    ratingMin,
    durationMin,
    durationMax,
    cancellationMaxHours,
    pickupAvailable,
    date,
    guests,
    timeOfDay,
    attributes,
    limit,
    page,
  } = params;
  // Flatten attribute filters to `key: 'v1,v2'` so they ride the raw query string
  // (buildQuery drops empty values).
  const attributeParams = Object.fromEntries(
    Object.entries(attributes ?? {}).map(([k, v]) => [k, v.join(',')]),
  );
  const res = await publicGet<TourListResult>(
    `/tours${buildQuery({
      destinationId,
      locale,
      isLocalsFavourite: localsFavourite,
      categoryId,
      categoryIds,
      hubId,
      sort,
      minPrice,
      maxPrice,
      ratingMin,
      durationMin,
      durationMax,
      cancellationMaxHours,
      pickupAvailable,
      date,
      guests,
      timeOfDay,
      ...attributeParams,
      limit,
      page,
    })}`,
  );
  return res ?? { total: 0, data: [] };
}

/**
 * A single LIVE tour by its flat slug, scoped to a destination
 * (`/{locale}/{destinationSlug}/{slug}/` - ROUTING-AND-RESOLUTION.md §5.2). The
 * backend filters `status: LIVE, isActive: true` and returns localized fields
 * with a field-by-field English fallback already applied. Returns `null` when
 * the tour is unknown/unpublished or the backend is unreachable - callers should
 * `notFound()` on null.
 *
 * Cached hourly and tagged `tours`; `slug` + `destinationSlug` + `locale` are the
 * cache key. Slugs are English at every locale.
 */
export async function getTourBySlug(params: {
  slug: string;
  destinationSlug: string;
  locale?: Locale;
}): Promise<PublicTourDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('tours');

  const { slug, destinationSlug, locale = DEFAULT_LOCALE } = params;
  return publicGet<PublicTourDetail>(
    `/tours/slug/${slug}${buildQuery({ destinationSlug, locale })}`,
  );
}
