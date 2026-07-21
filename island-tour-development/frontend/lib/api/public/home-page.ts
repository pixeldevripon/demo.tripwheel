/**
 * Admin-managed homepage content (server-side, cached).
 *
 * Hits `GET /home-page/public`, the unauthenticated projection of the homepage
 * singleton flattened onto one locale.
 *
 * THE FALLBACK CONTRACT: every field is nullable, and null means "keep the
 * built-in i18n dictionary default". The homepage sections are pixel-locked
 * Figma layouts, so an admin edits what is IN a section, never whether it
 * exists - which is why this returns content rather than a layout. Callers are
 * expected to write `content.heroTitle ?? dict.home.hero.title`.
 *
 * Consequently this uses `publicGet` (soft null on any failure), never
 * `publicGetStrict`: a backend outage must degrade the homepage to its bundled
 * copy, not 404 the site's front door.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

import { buildQuery, publicGet } from './fetch';

export interface PublicHomePageFaq {
    question: string;
    answer: string;
}

/**
 * One fanned editorial CTA card.
 *
 * `name` is the CATEGORY's name in THIS locale (never admin-typed), and is null
 * when the card is a plain photo - keep the bundled dictionary label then.
 *
 * `categorySlug` carries no island on purpose: the banner is themed to ONE
 * island, so the page joins this to the island it already resolved for the
 * button. That is what guarantees a card and the button beside it can never
 * open different islands. Null whenever the card should not be clickable: no
 * category, the link switched off, or the category archived since.
 */
export interface PublicEditorialCard {
    image: string;
    name: string | null;
    categorySlug: string | null;
}

export interface PublicHomePage {
    locale: Locale;
    heroImage: string | null;
    /** Fanned editorial CTA cards, in fan order. Short arrays keep bundled defaults. */
    editorialCards: PublicEditorialCard[];
    /** Null = let the frontend resolve the CTA target itself. */
    editorialDestinationSlug: string | null;
    ogImage: string | null;
    heroTitle: string | null;
    heroSubtitle: string | null;
    experiencesTitle: string | null;
    editorialTitleLine1: string | null;
    editorialTitleLine2: string | null;
    editorialBody: string | null;
    editorialCta: string | null;
    faqTitle: string | null;
    faqSubtitle: string | null;
    /**
     * Search-engine listing for this locale, admin-edited in the dashboard's
     * homepage SEO tab. Null keeps the site-wide defaults from Settings, the
     * same fallback rule as every field above.
     */
    metaTitle: string | null;
    metaDescription: string | null;
    /**
     * Published FAQs for this locale, in display order. Empty means "keep the
     * bundled dictionary FAQs" - the same fallback rule as every field above.
     * Untranslated FAQs are omitted by the backend rather than falling back to
     * English, so a locale nobody has translated yet shows the full bundled set
     * instead of a half-English list.
     */
    faqs: PublicHomePageFaq[];
}

/** All-null content: renders the homepage exactly as it was before the CMS. */
function emptyHomePage(locale: Locale): PublicHomePage {
    return {
        locale,
        heroImage: null,
        editorialCards: [],
        editorialDestinationSlug: null,
        ogImage: null,
        heroTitle: null,
        heroSubtitle: null,
        experiencesTitle: null,
        editorialTitleLine1: null,
        editorialTitleLine2: null,
        editorialBody: null,
        editorialCta: null,
        faqTitle: null,
        faqSubtitle: null,
        metaTitle: null,
        metaDescription: null,
        faqs: [],
    };
}

/**
 * Content an admin changes rarely but expects to see live, same contract as
 * `getPublicSiteInfo`: `cacheLife('days')` under the `homepage` tag, which the
 * dashboard busts on save - so the long window costs nothing in staleness.
 */
export async function getHomePageContent(
    locale: Locale = DEFAULT_LOCALE,
): Promise<PublicHomePage> {
    'use cache';
    cacheLife('days');
    cacheTag('homepage');

    const res = await publicGet<Partial<PublicHomePage>>(
        `/home-page/public${buildQuery({ locale })}`,
    );

    return normalize(res, locale);
}

/**
 * Fill in whatever the API did not send.
 *
 * The soft-null `publicGet` only covers "no response". It does NOT cover a
 * response of the WRONG SHAPE, and the two deploys are independent: ship a
 * frontend that reads `editorialCards` against a backend that still returns
 * `editorialImages` and the field is `undefined`, so the first `.flatMap` on it
 * takes down the prerender of the site's front door in every locale. That is
 * exactly what happened on the first deploy of this feature.
 *
 * Merging over the all-null baseline makes an older (or newer) backend a
 * DEGRADATION rather than an outage: unknown fields are ignored, missing ones
 * fall back to their bundled defaults, and the page renders. The two arrays are
 * re-checked explicitly because a present-but-not-an-array value would survive
 * the spread and only fail later, at the call site.
 */
function normalize(
    res: Partial<PublicHomePage> | null,
    locale: Locale,
): PublicHomePage {
    const empty = emptyHomePage(locale);
    if (!res) return empty;

    return {
        ...empty,
        ...res,
        locale,
        editorialCards: Array.isArray(res.editorialCards)
            ? res.editorialCards
            : [],
        faqs: Array.isArray(res.faqs) ? res.faqs : [],
    };
}
