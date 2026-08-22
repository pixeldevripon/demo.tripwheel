/**
 * Public tour-listing data (server-side, cached). Backs destination-page tour
 * grids (e.g. "Locals' favorites"). Hits the public `GET /tours` listing, which
 * returns LIVE tours with localized titles, hero image, price, rating, the
 * backend-derived `badge` (sponsored = paid tiers P1-P3 / spotlight), and the
 * `isLocalsFavourite` flag - the same shape as a search hit (`SearchHit`).
 */
import { seg } from '@/lib/api/api-path';
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { SearchHit } from '@/types/search';
import type { PublicTourDetail } from '@/types/tour-detail';
import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet, publicGetStrict } from './fetch';

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
 * Deliberately SHORT (not 'days' like the entity loaders): the nightly re-rank
 * DOES bust `tours`/`search` now (backend `NightlyJobsService` ->
 * `PublicCacheService` -> POST /api/revalidate), but date-anchored results
 * (`date`/`guests`/`timeOfDay`) also shift intraday as TRAVELER bookings eat
 * capacity, and bookings emit no tag bust - the hourly window is what keeps a
 * selling-out departure from showing as available all day. Move to 'days' only
 * if booking confirmation starts busting `tours` too.
 */
export async function getDestinationTours(params: {
  destinationId: string;
  locale?: Locale;
  /** Shopper display currency; adds converted `money` to each card (guide §20.9). */
  currency?: Currency;
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
    currency,
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
      currency,
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
 * with a field-by-field English fallback already applied. Returns `null` only on
 * a backend 404 (unknown/unpublished tour) - callers `notFound()` on null. When
 * the backend is unreachable it throws (`publicGetStrict`) so revalidation fails
 * and the last good page keeps serving instead of caching a 404.
 *
 * Cached daily (writes bust the tags below); `slug` + `destinationSlug` +
 * `locale` are the cache key. Tagged
 * granularly `tour:<id>` (from the response) so editing ONE tour regenerates only
 * this page - not every tour page. Falls back to coarse `tours` when not found so
 * a later publish (which busts `tours`) clears the cached 404.
 */
export async function getTourBySlug(params: {
  slug: string;
  destinationSlug: string;
  locale?: Locale;
  /** Shopper display currency; adds converted `money` to the detail (guide §20.9). */
  currency?: Currency;
}): Promise<PublicTourDetail | null> {
  'use cache';
  cacheLife('days');

  const { slug, destinationSlug, locale = DEFAULT_LOCALE, currency } = params;
  const data = await publicGetStrict<PublicTourDetail>(
    `/tours/slug/${seg(slug)}${buildQuery({ destinationSlug, locale, currency })}`,
  );
  // `tour:<id>` for the tour's own edits; `operator:<id>` because the operator's
  // company name/logo is rendered here (and only here, not on cards), so an
  // operator edit must reach this page. Both are granular - a different tour or
  // operator never regenerates this page. Fall back to coarse `tours` when not
  // found so a later publish (which busts `tours`) clears the cached 404.
  if (data) cacheTag(`tour:${data.id}`, `operator:${data.operatorId}`);
  else cacheTag('tours');
  return data;
}
