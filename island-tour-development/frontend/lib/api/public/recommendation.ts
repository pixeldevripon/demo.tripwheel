/**
 * Island Tours' post-booking recommendation (server-side, cached).
 *
 * Hits `GET /recommendations/public`, which returns the ONE recommendation a
 * surface should feature - the first enabled, complete one in the admin's order,
 * placed on that surface - flattened onto one locale. It renders as the last card
 * on the thank-you page, promoting a place to stay / eat / do to a traveller who
 * has just booked a tour. (Generalises the old single-purpose "apartment" promo.)
 *
 * THE CONTRACT IS `enabled`, and it differs from the homepage's on purpose.
 * There, every null field falls back to a bundled dictionary default, because the
 * homepage must always render. Here there is no honest built-in fallback: we ship
 * no default name, photo or link, and inventing one would advertise a place that
 * does not exist. So the backend decides whether the card is renderable and nulls
 * everything when it is not. Chrome labels (the eyebrow, the CTA text) still fall
 * back to the dictionary, which is already translated in all 7 locales.
 *
 * `external` decides how the CTA links: EXTERNAL recommendations open off-site in
 * a new tab; INTERNAL ones link same-tab to an on-site page (`linkUrl` is a
 * site-relative path the caller localises).
 *
 * Uses `publicGet` (soft null on any failure), never `publicGetStrict`: a backend
 * outage must drop one promo card off a confirmation page, never 404 the page that
 * tells a traveller they are booked.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

import { buildQuery, publicGet } from './fetch';

/** Surfaces a recommendation may be featured on (mirrors the backend enum). */
export type RecommendationPlacement = 'THANK_YOU_PAGE' | 'CONFIRMATION_EMAIL';

export interface PublicRecommendation {
    /**
     * The ONLY gate the section obeys. False when nothing qualifies for this
     * surface (switched off, none placed here, or missing an essential), in which
     * case every field below is null.
     */
    enabled: boolean;
    locale: Locale;
    /**
     * Whether the CTA links OFF-SITE (opens in a new tab). INTERNAL recommendations
     * are false and link same-tab to an on-site page.
     */
    external: boolean;
    imageUrl: string | null;
    /** Absolute https for EXTERNAL; a site-relative path for INTERNAL. */
    linkUrl: string | null;
    /** Numbers, not Decimal strings - the backend converts before sending. */
    rating: number | null;
    reviewCount: number | null;
    sleeps: number | null;
    priceAmount: number | null;
    /** The price's OWN currency; the card renders this symbol, never a literal $. */
    currency: Currency;
    /** Null keeps the bundled (already translated) eyebrow label. */
    eyebrow: string | null;
    areaLabel: string | null;
    title: string | null;
    /** One entry per paragraph; the backend splits the stored text on newlines. */
    descriptionLines: string[];
    /** Null keeps the bundled (already translated) CTA label. */
    ctaLabel: string | null;
}

/** The "do not render" answer - what an outage or a wrong-shaped response means. */
function hiddenRecommendation(locale: Locale): PublicRecommendation {
    return {
        enabled: false,
        locale,
        external: false,
        imageUrl: null,
        linkUrl: null,
        rating: null,
        reviewCount: null,
        sleeps: null,
        priceAmount: null,
        currency: 'USD',
        eyebrow: null,
        areaLabel: null,
        title: null,
        descriptionLines: [],
        ctaLabel: null,
    };
}

/**
 * The recommendations featured on a surface - up to a few, in promotion order.
 * Empty means the section does not render.
 *
 * Content an admin changes rarely but expects to see live, same contract as
 * `getHomePageContent`: `cacheLife('days')` under the `recommendations` tag, which
 * the dashboard busts on save - so the long window costs nothing in staleness.
 *
 * Cached even though the page around it is not: the booking lookup is
 * per-traveller and uncached, but these cards are the same for everyone.
 */
export async function getRecommendations(
    locale: Locale = DEFAULT_LOCALE,
    placement: RecommendationPlacement = 'THANK_YOU_PAGE',
): Promise<PublicRecommendation[]> {
    'use cache';
    cacheLife('days');
    cacheTag('recommendations');

    const res = await publicGet<Partial<PublicRecommendation>[]>(
        `/recommendations/public${buildQuery({ locale, placement })}`,
    );

    if (!Array.isArray(res)) return [];
    // Drop any wrong-shaped item rather than render a broken card - the two
    // services deploy independently, so an older/newer backend degrades to fewer
    // cards, never a crash inside `.map()` on the page a traveller reaches straight
    // after paying.
    return res
        .filter((item): item is Partial<PublicRecommendation> => item?.enabled === true)
        .map((item) => normalize(item, locale));
}

/** Fill in whatever the API did not send for one card item. */
function normalize(
    res: Partial<PublicRecommendation>,
    locale: Locale,
): PublicRecommendation {
    return {
        ...hiddenRecommendation(locale),
        ...res,
        enabled: true,
        locale,
        external: res.external === true,
        descriptionLines: Array.isArray(res.descriptionLines)
            ? res.descriptionLines
            : [],
    };
}
