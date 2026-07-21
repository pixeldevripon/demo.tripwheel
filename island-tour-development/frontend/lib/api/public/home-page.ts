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
 * `name` is the linked island's name in THIS locale (never admin-typed), and is
 * null when the card is a plain photo - keep the bundled dictionary label then.
 * `href` is null whenever the card should not be clickable: no island, the link
 * switched off, or the island archived since.
 */
export interface PublicEditorialCard {
    image: string;
    name: string | null;
    href: string | null;
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

    const res = await publicGet<PublicHomePage>(
        `/home-page/public${buildQuery({ locale })}`,
    );

    return res ?? emptyHomePage(locale);
}
