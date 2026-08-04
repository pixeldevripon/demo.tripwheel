/**
 * "Top Island Experiences" - the homepage reel, resolved server-side into
 * renderable cards.
 *
 * PRESENTATION ONLY (founder, 2026-08-04): a card is an admin-typed label +
 * poster + optional video. It references no category or hub and links
 * nowhere - the reel is a mood board of the platform's activities. The label
 * is a single admin-entered string, so it renders identically in every
 * locale. The backend drops any card without a poster.
 *
 * `publicGet` (soft null) rather than strict: an outage should cost the
 * homepage its carousel content, not the page. The component hides the whole
 * section when fewer than its minimum resolve.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

export interface PublicExperience {
    id: string;
    title: string;
    /** The card's poster - never null here. Also the `<video poster>`. */
    image: string | null;
    videoUrl: string | null;
}

/** Tagged `homepage`: the deck only changes when an admin edits the cards. */
export async function getFeaturedExperiences(): Promise<PublicExperience[]> {
    'use cache';
    cacheLife('days');
    cacheTag('homepage');

    const data = await publicGet<PublicExperience[]>(
        '/featured-experiences/public',
    );

    // Array-checked, not just null-checked: this feeds a `.map`, and an API that
    // answers with an object (an error envelope, an older route, a proxy page)
    // would otherwise crash the prerender of the homepage rather than costing it
    // one section. The section hides itself on an empty list.
    return Array.isArray(data) ? data : [];
}
