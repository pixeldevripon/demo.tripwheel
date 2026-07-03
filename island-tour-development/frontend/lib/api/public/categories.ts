/**
 * Public category data (server-side, cached). Backs the destination hero's
 * "activities" row and any destination-scoped category listing. Hits the
 * tour-gated `GET /categories/destination/:slug`, so every returned category
 * has at least one published tour (its link never 404s).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type {
  CategoryByDestination,
  CategoryDetailByDestination,
  CategoryPageContent,
} from '@/types/category';
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

/**
 * Destination-scoped, tour-gated category detail (localized). Returns `null` when
 * the category has zero published tours at this destination (backend 404) or the
 * backend is unreachable. Cached hourly and tagged `categories`.
 */
export async function getCategoryBySlugForDestination(
  destinationSlug: string,
  categorySlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryDetailByDestination | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('categories');

  return publicGet<CategoryDetailByDestination>(
    `/categories/destination/${destinationSlug}/${categorySlug}${buildQuery({ locale })}`,
  );
}

/**
 * Editorial page content (meta title / description, about copy, …) for a category
 * by id. Returns `null` when unset or the backend is unreachable. Cached hourly.
 */
export async function getCategoryPageContent(
  categoryId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryPageContent | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('categories');

  return publicGet<CategoryPageContent>(
    `/categories/${categoryId}/page-content${buildQuery({ locale })}`,
  );
}
