/**
 * Public destination data (server-side, cached). Powers the navbar island
 * selector, the footer, and the "Explore islands" homepage section.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { DestinationActive, DestinationDetail } from '@/types/destination';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet, publicGetStrict } from './fetch';

/**
 * Active destinations for the given locale (name already localized server-side),
 * ordered alphabetically. Returns `[]` if the backend is unreachable.
 *
 * Cached daily (tag-busted on writes) and tagged `destinations`; bust on demand via `updateTag`
 * (fired from the dashboard-write revalidation hook) after an admin edit. `locale`
 * is part of the cache key.
 */
export async function getActiveDestinations(
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationActive[]> {
  'use cache';
  cacheLife('days');
  cacheTag('destinations');

  const data = await publicGet<DestinationActive[]>(
    `/destinations/active${buildQuery({ locale })}`,
  );
  return data ?? [];
}

/**
 * A single destination by slug (localized name + page fields). Returns `null`
 * only when the backend says the slug is unknown (404) - callers `notFound()`
 * on null. When the backend is unreachable it THROWS (`publicGetStrict`), so a
 * background revalidation fails and keeps serving the last good page instead of
 * caching a 404 over every destination page.
 *
 * Cached daily (tag-busted on writes); `slug` + `locale` are the cache key. Tagged granularly
 * `destination:<id>` (from the response) so editing one destination regenerates
 * only its page; falls back to coarse `destinations` when not found.
 */
export async function getDestinationBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationDetail | null> {
  'use cache';
  cacheLife('days');

  const data = await publicGetStrict<DestinationDetail>(
    `/destinations/slug/${slug}${buildQuery({ locale })}`,
  );
  cacheTag(data ? `destination:${data.id}` : 'destinations');
  return data;
}
