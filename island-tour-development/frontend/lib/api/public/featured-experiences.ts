/**
 * "Top Island Experiences" - admin-curated categories and hubs (never individual
 * tours), resolved server-side into renderable cards.
 *
 * Title, image and href come from the referenced category/hub, so a card
 * inherits that entity's translations and can never drift from the page it
 * points at. The backend drops any row that fails the target page's own
 * visibility gate, so every card returned here is a link that resolves.
 *
 * `publicGet` (soft null) rather than strict: an outage should cost the homepage
 * its carousel content, not the page. The component falls back to its bundled
 * cards when fewer than three resolve.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

import { buildQuery, publicGet } from './fetch';

export interface PublicExperience {
    id: string;
    entityType: 'CATEGORY' | 'HUB';
    title: string;
    image: string | null;
    videoUrl: string | null;
    /** Locale-less path (`/curacao/snorkeling`) - localize before rendering. */
    href: string;
}

/**
 * Tagged `homepage` (curation changes) AND `tours` (gate changes).
 *
 * The second tag is the important one: a card's visibility depends on its target
 * still having a live tour, so a tour going dark must regenerate this list -
 * otherwise the carousel keeps advertising a category page that now 404s. That
 * is the exact failure the server-side gate exists to prevent, and a stale cache
 * would reintroduce it.
 */
export async function getFeaturedExperiences(
    locale: Locale = DEFAULT_LOCALE,
    destination?: string,
): Promise<PublicExperience[]> {
    'use cache';
    cacheLife('days');
    cacheTag('homepage', 'tours');

    const data = await publicGet<PublicExperience[]>(
        `/featured-experiences/public${buildQuery({ locale, destination })}`,
    );

    return data ?? [];
}
