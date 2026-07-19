/**
 * Public collection data (server-side, cached). Backs the collection page — the
 * COLLECTION branch of the polymorphic `[slug]` route. Hits the published-only
 * `GET /collections/render/:slug`, which resolves the ordered tours (MANUAL cards
 * carry their per-locale rationale), fast stats, FAQs, and related collections in
 * one round-trip. Returns `null` for a draft/inactive/unknown collection (backend
 * 404) or when the backend is unreachable — callers `notFound()` on null.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type {
  CollectionLocalized,
  CollectionPageContent,
  CollectionRender,
} from '@/types/collection';
import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet, publicGetStrict } from './fetch';

/**
 * Active (published) collections for a destination, localized - backs the
 * destination page's "Collections" shelf. Returns `[]` if the backend is
 * unreachable. Cached daily (tag-busted on writes) and tagged coarse `collections` (the cards show only
 * each collection's own name/image, so any collection create/edit/status change
 * at this destination should refresh the shelf; no tour dependency).
 */
export async function getActiveCollectionsForDestination(
  destinationSlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CollectionLocalized[]> {
  'use cache';
  cacheLife('days');
  cacheTag('collections');

  const data = await publicGet<CollectionLocalized[]>(
    `/collections${buildQuery({ destinationSlug, locale })}`,
  );
  return data ?? [];
}

/**
 * Full render payload for a published collection. `destinationId` (the destination
 * UUID) scopes the lookup; get it from `getDestinationBySlug(...).id`. Returns
 * `null` only on a backend 404 (draft/unknown collection) - callers `notFound()`
 * on null. When the backend is unreachable it throws (`publicGetStrict`) so
 * revalidation fails and the last good page keeps serving.
 *
 * Cached daily (tag-busted on writes); `slug` + `destinationId` + `locale` are the cache key. Tagged
 * granularly `collection:<id>` (editing this collection regenerates only this
 * page) plus coarse `tours` because the render embeds tour cards (price/rating),
 * which must refresh when any embedded tour changes. Falls back to coarse
 * `collections` when not found.
 */
export async function getCollectionRender(
  slug: string,
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
  currency?: Currency,
): Promise<CollectionRender | null> {
  'use cache';
  cacheLife('days');

  const data = await publicGetStrict<CollectionRender>(
    `/collections/render/${slug}${buildQuery({ destinationId, locale, currency })}`,
  );
  cacheTag('tours', data ? `collection:${data.id}` : 'collections');
  return data;
}

/**
 * Per-locale editorial meta (metaTitle / metaDescription / aboutText) for a
 * collection by id — authored in the dashboard SEO tab. Returns `null` when unset
 * or the backend is unreachable. Cached daily (tag-busted on writes); tagged granularly
 * `collection:<id>` (id is the arg) so a collection's SEO edit refreshes only it.
 */
export async function getCollectionPageContent(
  collectionId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CollectionPageContent | null> {
  'use cache';
  cacheLife('days');
  cacheTag(`collection:${collectionId}`);

  return publicGet<CollectionPageContent>(
    `/collections/${collectionId}/page-content${buildQuery({ locale })}`,
  );
}
