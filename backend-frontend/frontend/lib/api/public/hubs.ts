/**
 * Public hub data (server-side, cached). Backs the destination page's discovery
 * rows (hero "Popular" + "Explore by type"). Hits the tour-gated
 * `GET /hubs/destination/:slug`, so every returned hub is PUBLISHED, active, and
 * has at least one published tour (its link never 404s).
 */
import { seg } from '@/lib/api/api-path';
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { HubByDestination, HubRender } from '@/types/hub';
import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet, publicGetStrict } from './fetch';

/**
 * Tour-gated, published hubs for a destination (localized names, ordered by name,
 * each with `publishedTourCount`). Returns `[]` if the backend is unreachable.
 *
 * Cached daily (tag-busted on writes) and tagged `hubs`; `destinationSlug` + `locale` are the cache key.
 */
export async function getDestinationHubs(
  destinationSlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<HubByDestination[]> {
  'use cache';
  cacheLife('days');
  // `tours` too: each hub carries `publishedTourCount`, which changes when a tour
  // is published/unpublished.
  cacheTag('hubs', 'tours');

  const data = await publicGet<HubByDestination[]>(
    `/hubs/destination/${seg(destinationSlug)}${buildQuery({ locale })}`,
  );
  return data ?? [];
}

/**
 * Full render payload for a published hub page (master 5.5). `destinationId` (the
 * destination UUID) scopes the lookup; get it from `getDestinationBySlug(...).id`.
 * Returns `null` only for a draft/inactive/unknown hub (backend 404) - callers
 * `notFound()` on null. When the backend is unreachable it throws
 * (`publicGetStrict`) so revalidation fails and the last good page keeps serving.
 *
 * Cached daily (tag-busted on writes); `slug` + `destinationId` + `locale` are the key. Tagged
 * granularly `hub:<id>` (editing this hub regenerates only this page) plus coarse
 * `tours` because the render embeds tour cards (price/rating), which must refresh
 * when any embedded tour changes. Falls back to coarse `hubs` when not found.
 */
export async function getHubRender(
  slug: string,
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
  currency?: Currency,
): Promise<HubRender | null> {
  'use cache';
  cacheLife('days');

  const data = await publicGetStrict<HubRender>(
    `/hubs/render/${seg(slug)}${buildQuery({ destinationId, locale, currency })}`,
  );
  cacheTag('tours', data ? `hub:${data.id}` : 'hubs');
  return data;
}

// The hub's authored meta + About copy is no longer fetched separately: it
// arrives on `getHubRender` as `pageContent`, already resolved locale → English.
// `/hubs/:id/page-content` returns a single locale's row with no fallback, which
// is what the dashboard editor wants and what a public page must not use.
