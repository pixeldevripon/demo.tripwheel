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

import type { CollectionPageContent, CollectionRender } from '@/types/collection';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Full render payload for a published collection. `destinationId` (the destination
 * UUID) scopes the lookup; get it from `getDestinationBySlug(...).id`.
 *
 * Cached hourly and tagged `collections`; `slug` + `destinationId` + `locale` are
 * the cache key. Bust with `revalidateTag('collections')` after an admin edit.
 */
export async function getCollectionRender(
  slug: string,
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CollectionRender | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('collections');

  return publicGet<CollectionRender>(
    `/collections/render/${slug}${buildQuery({ destinationId, locale })}`,
  );
}

/**
 * Per-locale editorial meta (metaTitle / metaDescription / aboutText) for a
 * collection by id — authored in the dashboard SEO tab. Returns `null` when unset
 * or the backend is unreachable. Cached hourly and tagged `collections`.
 */
export async function getCollectionPageContent(
  collectionId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<CollectionPageContent | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('collections');

  return publicGet<CollectionPageContent>(
    `/collections/${collectionId}/page-content${buildQuery({ locale })}`,
  );
}
