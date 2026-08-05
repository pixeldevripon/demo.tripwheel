/**
 * Public destination data (server-side, cached). Powers the navbar island
 * selector, the footer, and the "Explore islands" homepage section.
 */
import { seg } from '@/lib/api/api-path';
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type {
  DestinationActive,
  DestinationDetail,
  DestinationFaq,
  DestinationPageContent,
  DestinationPopularLink,
} from '@/types/destination';
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
 * The island hero's ADMIN-CURATED "Popular" quick links, already resolved,
 * localized and re-gated by the backend: a curated target whose page would not
 * open (a category under the 3-tour bar, an unpublished hub or collection) is
 * dropped there rather than linked here.
 *
 * `[]` means "this island is not curated" - the caller composes the automatic
 * row (hub, lead collection, then categories) instead. It is not an error, and
 * it is also what a backend outage returns, which degrades to the same safe
 * automatic row rather than an empty hero.
 *
 * Cached daily (tag-busted on writes); `slug` + `locale` are the cache key.
 * Tagged `destinations` (the curation itself) plus `categories`, `collections`
 * and `tours` - the gate reads all three, so publishing a tour can legitimately
 * bring a curated link back into the row.
 */
export async function getDestinationPopularLinks(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationPopularLink[]> {
  'use cache';
  cacheLife('days');
  cacheTag('destinations', 'categories', 'collections', 'tours');

  const data = await publicGet<DestinationPopularLink[]>(
    `/destinations/slug/${seg(slug)}/popular-links${buildQuery({ locale })}`,
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
    `/destinations/slug/${seg(slug)}${buildQuery({ locale })}`,
  );
  cacheTag(data ? `destination:${data.id}` : 'destinations');
  return data;
}

/**
 * Editorial page content (about copy + meta title/description) for an island by
 * id. Returns `null` when unauthored or the backend is unreachable - the page
 * falls back to its bundled copy, so a null here is a normal state, not an error.
 *
 * Keyed by id rather than slug because that is the shape the backend exposes
 * (`GET /destinations/:id/page-content`); callers already hold the island from
 * `getDestinationBySlug`. Cached daily (tag-busted on writes) and tagged
 * granularly `destination:<id>` so an admin's edit refreshes only that island.
 */
export async function getDestinationPageContent(
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationPageContent | null> {
  'use cache';
  cacheLife('days');
  cacheTag(`destination:${destinationId}`);

  return publicGet<DestinationPageContent>(
    // `fallback` fills blanks from English (see the category loader).
    `/destinations/${seg(destinationId)}/page-content${buildQuery({ locale, fallback: true })}`,
  );
}

/**
 * Active FAQs for an island (by id), localized and ordered. Returns `[]` when
 * unauthored or the backend is unreachable, which the page reads as "use the
 * bundled questions".
 *
 * `locale` is always sent: the backend returns EVERY locale's rows mixed
 * together when it is omitted, which would render each question seven times.
 *
 * Cached daily (tag-busted on writes); tagged `destination:<id>` so authoring
 * this island's FAQs refreshes only its page.
 */
export async function getDestinationFaqs(
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationFaq[]> {
  'use cache';
  cacheLife('days');
  cacheTag(`destination:${destinationId}`);

  const data = await publicGet<DestinationFaq[]>(
    `/destinations/${seg(destinationId)}/faqs${buildQuery({ locale })}`,
  );
  return data ?? [];
}
