/**
 * Third-party platform reviews (Trustpilot / Google) - admin-configured in the
 * dashboard (Settings > Reviews), fetched + cached by the backend, rendered as
 * the homepage testimonials band.
 *
 * The backend applies the social-proof gate: `visible` is false when the
 * integration is disabled, unconfigured, never fetched, or the platform's
 * review count has not passed 100 - so consumers only check `visible`.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

export interface PlatformReview {
    author: string;
    avatarUrl: string | null;
    rating: number;
    text: string;
    publishedAt: string | null;
    relativeTime: string | null;
}

export interface PublicPlatformReviews {
    visible: boolean;
    provider: string | null;
    rating: number | null;
    reviewCount: number | null;
    reviews: PlatformReview[];
    displayPages: string[];
}

const HIDDEN: PublicPlatformReviews = {
    visible: false,
    provider: null,
    rating: null,
    reviewCount: null,
    reviews: [],
    displayPages: [],
};

/**
 * `cacheLife('hours')`: the backend already caches the provider payload for
 * 12h, this is just the render-side layer on top. Falls back to hidden on any
 * failure - a missing reviews band is never worth an error surface.
 */
export async function getPlatformReviews(): Promise<PublicPlatformReviews> {
    'use cache';
    cacheLife('hours');
    cacheTag('platform-reviews');

    const res = await publicGet<PublicPlatformReviews>(
        '/platform-reviews/public',
    );
    return res ?? HIDDEN;
}
