/**
 * Public category data (server-side, cached). Backs the destination hero's
 * "activities" row and any destination-scoped category listing. Hits the
 * tour-gated `GET /categories/destination/:slug`, so every returned category
 * has at least one published tour (its link never 404s).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { CategoryByDestination } from '@/types/category';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Active, tour-gated categories for a destination (localized names, ordered by
 * sortOrder, each with `publishedTourCount`). Returns `[]` if the backend is
 * unreachable.
 *
 * Cached hourly and tagged `categories`; `destinationSlug` + `locale` are the
 * cache key.
 */
export async function getDestinationCategories(
  destinationSlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryByDestination[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('categories');

  const data = await publicGet<CategoryByDestination[]>(
    `/categories/destination/${destinationSlug}${buildQuery({ locale })}`,
  );
  return data ?? [];
}
