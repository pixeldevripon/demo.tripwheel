/**
 * Public destination data (server-side, cached). Powers the navbar island
 * selector, the footer, and the "Explore islands" homepage section.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { DestinationActive, DestinationDetail } from '@/types/destination';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Active destinations for the given locale (name already localized server-side),
 * ordered alphabetically. Returns `[]` if the backend is unreachable.
 *
 * Cached hourly and tagged `destinations`; bust on demand with
 * `revalidateTag('destinations')` after an admin edit. `locale` is part of the
 * cache key.
 */
export async function getActiveDestinations(
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationActive[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('destinations');

  const data = await publicGet<DestinationActive[]>(
    `/destinations/active${buildQuery({ locale })}`,
  );
  return data ?? [];
}

/**
 * A single destination by slug (localized name + page fields). Returns `null`
 * when the slug is unknown/inactive or the backend is unreachable - callers
 * should `notFound()` on null.
 *
 * Cached hourly and tagged `destinations`; `slug` + `locale` are the cache key.
 */
export async function getDestinationBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('destinations');

  return publicGet<DestinationDetail>(
    `/destinations/slug/${slug}${buildQuery({ locale })}`,
  );
}
