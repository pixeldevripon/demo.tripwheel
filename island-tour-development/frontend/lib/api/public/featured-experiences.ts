/**
 * "Top Island Experiences" - admin-curated categories and hubs (never individual
 * tours), resolved server-side into renderable cards.
 *
 * Title and href come from the referenced category/hub, so a card inherits that
 * entity's translations and can never drift from the page it points at. `image`
 * is the card's own poster when an admin set one, falling back to the entity's
 * photo - already resolved here, so there is nothing to choose between at render
 * time. The backend drops any row that fails the target page's own visibility
 * gate, so every card returned here is a link that resolves.
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
    /** Poster if set, else the entity photo. Also the `<video poster>`. */
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

    // Array-checked, not just null-checked: this feeds a `.map`, and an API that
    // answers with an object (an error envelope, an older route, a proxy page)
    // would otherwise crash the prerender of the homepage rather than costing it
    // one section. Callers fall back to their bundled deck on an empty list.
    return Array.isArray(data) ? data : [];
}
