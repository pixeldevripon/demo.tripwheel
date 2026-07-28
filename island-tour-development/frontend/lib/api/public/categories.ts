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
  CategoryFaq,
  CategoryPageContent,
} from '@/types/category';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet, publicGetStrict } from './fetch';

/**
 * Active, tour-gated categories for a destination (localized names, ordered by
 * sortOrder, each with `publishedTourCount`). Returns `[]` if the backend is
 * unreachable.
 *
 * Cached daily (tag-busted on writes) and tagged `categories`; `destinationSlug` + `locale` are the
 * cache key.
 */
export async function getDestinationCategories(
  destinationSlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryByDestination[]> {
  'use cache';
  cacheLife('days');
  // `tours` too: tour-gating + each category's `publishedTourCount` depend on
  // which tours are published.
  cacheTag('categories', 'tours');

  const data = await publicGet<CategoryByDestination[]>(
    `/categories/destination/${destinationSlug}${buildQuery({ locale })}`,
  );
  return data ?? [];
}

/**
 * Destination-scoped, tour-gated category detail (localized). Returns `null` only
 * on a backend 404 (zero published tours at this destination) - callers
 * `notFound()` on null. When the backend is unreachable it throws
 * (`publicGetStrict`) so revalidation fails and the last good page keeps serving.
 * Cached daily (tag-busted on writes); tagged granularly `category:<id>` (from the response) plus
 * coarse `tours` (its published-tour count depends on tours). Falls back to
 * coarse `categories` when not found.
 */
export async function getCategoryBySlugForDestination(
  destinationSlug: string,
  categorySlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryDetailByDestination | null> {
  'use cache';
  cacheLife('days');

  const data = await publicGetStrict<CategoryDetailByDestination>(
    `/categories/destination/${destinationSlug}/${categorySlug}${buildQuery({ locale })}`,
  );
  cacheTag('tours', data ? `category:${data.id}` : 'categories');
  return data;
}

/**
 * Editorial page content (meta title / description, about copy, …) for a category
 * by id. Returns `null` when unset or the backend is unreachable. Cached daily (tag-busted on writes);
 * tagged granularly `category:<id>` (id is the arg) so a category's SEO edit
 * refreshes only it.
 */
export async function getCategoryPageContent(
  categoryId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryPageContent | null> {
  'use cache';
  cacheLife('days');
  cacheTag(`category:${categoryId}`);

  return publicGet<CategoryPageContent>(
    // `fallback` fills blanks from English: a field cleared in the Translation
    // Console must show English here, not an empty About band.
    `/categories/${categoryId}/page-content${buildQuery({ locale, fallback: true })}`,
  );
}

/**
 * Active FAQs for a category (by id), localized and ordered. Returns `[]` when
 * unset or the backend is unreachable. Cached daily (tag-busted on writes); tagged granularly
 * `category:<id>` so authoring/editing this category's FAQs refreshes only it.
 */
export async function getCategoryFaqs(
  categoryId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CategoryFaq[]> {
  'use cache';
  cacheLife('days');
  cacheTag(`category:${categoryId}`);

  const data = await publicGet<CategoryFaq[]>(
    `/categories/${categoryId}/faqs${buildQuery({ locale })}`,
  );
  return data ?? [];
}
