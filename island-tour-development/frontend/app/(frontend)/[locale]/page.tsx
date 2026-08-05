import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FaqSection } from '@/components/frontend/faq-section';
import { CtaCard } from '@/components/frontend/home/cta-card';
import { EditorialBanner } from '@/components/frontend/home/editorial-banner';
import { ExploreIslands } from '@/components/frontend/home/explore-islands';
import { Hero } from '@/components/frontend/home/hero';
import { Testimonials } from '@/components/frontend/home/testimonials';
import { TopExperiences } from '@/components/frontend/home/top-experiences';
import { TrustStrip } from '@/components/frontend/home/trust-strip';
import { HomePageSkeleton } from '@/components/frontend/skeletons/home-page-skeleton';
import {
    getActiveDestinations,
    getFeaturedExperiences,
    getHomePageContent,
} from '@/lib/api/public';
import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';
import { getServerCurrency } from '@/lib/currency/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { safeRemoteImage } from '@/lib/images/remote-hosts';
import { buildAlternates } from '@/lib/seo/alternates';
import { ogImageMeta } from '@/lib/seo/og-image';

/**
 * The homepage's search-engine listing, per locale, from the dashboard's
 * homepage SEO tab. Anything unset is simply omitted, so the site-wide defaults
 * apply - the same fallback contract as every other homepage field.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    // Same cached loader the page uses, so this costs no extra request.
    const content = await getHomePageContent(locale);

    return {
        ...(content.metaTitle && { title: content.metaTitle }),
        ...(content.metaDescription && {
            description: content.metaDescription,
        }),
        ...(await ogImageMeta(
            content.ogImage,
            locale,
            content.metaTitle || 'Island Tours'
        )),
        // Self-referencing canonical + hreflang for the 7 locales (homepage = the
        // locale root, so the locale-less path is '').
        alternates: buildAlternates(locale, ''),
    };
}

export default function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    // STREAMING SHAPE (same as the destination route): return the <Suspense>
    // shell without awaiting anything, so a cold path (expired cache entry,
    // dev compile) paints the design v2 skeleton instantly and streams,
    // instead of blocking on the backend. Prerendered locales resolve the
    // boundary at build - their baked page is unchanged (no skeleton flash).
    return (
        <Suspense fallback={<HomePageSkeleton />}>
            <HomeContent params={params} />
        </Suspense>
    );
}

async function HomeContent({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // The shopper's display currency, so the editorial cards' starting prices
    // come back converted. Reading the cookie opts this subtree into dynamic
    // rendering - it already sits inside the page's Suspense boundary.
    const currency = await getServerCurrency(locale as Locale);
    // All four are cached loaders, so this stays part of the prerendered shell
    // (no Suspense boundary needed - nothing here is request-specific).
    const [dict, destinations, content, experiences] = await Promise.all([
        getDictionary(locale as Locale),
        getActiveDestinations(locale as Locale),
        getHomePageContent(locale as Locale, currency),
        getFeaturedExperiences(),
    ]);
    const { home } = dict;
    // Hero alt text from the media library, per locale. A second await rather
    // than a member of the Promise.all above: the URL to look up comes out of
    // `content`, so it cannot be requested until that resolves.
    const heroSeo = await getMediaSeo([content.heroImage], locale as Locale);
    const heroImageUrl = safeRemoteImage(content.heroImage);
    const heroImageAlt = content.heroImage
        ? (heroSeo.get(normalizeUrl(content.heroImage))?.altText ?? null)
        : null;
    // Hero search + Popular are driven by the live destinations (name + slug).
    const islands = destinations.map(d => ({ name: d.name, slug: d.slug }));
    // "Explore islands" cards need the hero image + live tour count too.
    const exploreIslands = destinations.map(d => ({
        name: d.name,
        slug: d.slug,
        tours: d.tourCount,
        image: d.heroImage,
    }));
    // The editorial banner CTA points at whichever island an admin picked. With
    // none set (or the chosen one archived, which the API reports as null) it
    // falls back to the themed launch island, then the first destination, then
    // all-tours search - the behaviour before this section was editable.
    const editorialIsland =
        destinations.find(d => d.slug === content.editorialDestinationSlug) ??
        destinations.find(d => d.slug === 'curacao') ??
        destinations[0];
    const editorialCtaHref = editorialIsland
        ? localizeHref(locale as Locale, `/${editorialIsland.slug}`)
        : localizeHref(locale as Locale, '/search');

    // Admin content wins; null/empty falls back to the bundled dictionary copy,
    // so an unconfigured homepage renders exactly as it did pre-CMS.
    const heroDict = {
        ...home.hero,
        title: content.heroTitle || home.hero.title,
        subtitle: content.heroSubtitle || home.hero.subtitle,
    };
    const experiencesDict = {
        ...home.experiences,
        title: content.experiencesTitle || home.experiences.title,
    };
    const editorialDict = {
        ...home.editorial,
        titleLine1: content.editorialTitleLine1 || home.editorial.titleLine1,
        titleLine2: content.editorialTitleLine2 || home.editorial.titleLine2,
        body: content.editorialBody || home.editorial.body,
        cta: content.editorialCta || home.editorial.cta,
    };
    // The API returns locale-less paths so it stays locale-agnostic; localizing
    // here keeps the carousel presentational.
    // Every DB-sourced image passes through safeRemoteImage: next/image throws at
    // render on an unconfigured host, and this page is the prerendered front door
    // for every locale, so one bad row would take the homepage down rather than
    // degrade one card.
    // A card with no renderable photo is DROPPED, not passed on with a null:
    // the slide is a full-bleed image with the title over it, so a null renders
    // as a grey rectangle mid-carousel. The backend drops these too - this is
    // the same invariant held on both sides, because the two deploy separately
    // and a frontend must not depend on the age of the API it is talking to.
    const experienceCards = experiences.flatMap(e => {
        const image = safeRemoteImage(e.image);
        if (!image) return [];
        return [
            {
                id: e.id,
                title: e.title,
                image,
                videoUrl: e.videoUrl ?? null,
            },
        ];
    });
    // Fan cards. An unrenderable photo DROPS the card rather than rendering an
    // empty slot: the deck then keeps its bundled card for that position, which
    // is the same never-blank rule the rest of this page follows.
    //
    // The href is built HERE, from the island resolved for the button above
    // plus the card's category slug - so the whole banner always points at one
    // island. Without a resolvable island there is nowhere to send anyone, so
    // the card stays a photo with its caption.
    const editorialCards = content.editorialCards.flatMap(card => {
        const image = safeRemoteImage(card.image);
        if (!image) return [];
        return [
            {
                image,
                // Already this locale's category name; null keeps the bundled
                // label for the slot.
                name: card.name,
                href:
                    card.categorySlug && editorialIsland
                        ? localizeHref(
                              locale as Locale,
                              `/${editorialIsland.slug}/${card.categorySlug}`
                          )
                        : null,
                // The backend already converted this into the shopper's
                // currency; formatting it is all that is left (the frontend
                // never does FX). Null = nothing bookable behind the card, so
                // the card simply carries no price line.
                priceFrom:
                    card.priceFrom && card.priceCurrency
                        ? `${home.editorial.from} ${formatPriceFrom(
                              card.priceFrom,
                              card.priceCurrency,
                              locale as Locale
                          )}`
                        : null,
            },
        ];
    });
    const faqDict = {
        ...home.faq,
        title: content.faqTitle || home.faq.title,
        subtitle: content.faqSubtitle || home.faq.subtitle,
        // Admin-curated FAQs replace the bundled set wholesale rather than
        // appending to it: a half-curated, half-hardcoded list would be
        // impossible to reorder or reason about from the dashboard.
        items: content.faqs.length
            ? content.faqs.map(f => ({ q: f.question, a: f.answer }))
            : home.faq.items,
    };

    return (
        <>
            <Hero
                dict={heroDict}
                image={heroImageUrl}
                imageAlt={heroImageAlt}
                locale={locale as Locale}
                destinations={islands}
                search={{
                    ...dict.search,
                    // Card meta labels live in the shared listings dictionary
                    // (same composition as the navbar search in the layout).
                    pickupAvailable: dict.destination.listings.pickupAvailable,
                    freeCancellation:
                        dict.destination.listings.freeCancellation,
                    from: dict.destination.listings.from,
                }}
            />
            <TrustStrip items={home.trust} />
            <TopExperiences
                dict={experiencesDict}
                experiences={experienceCards}
            />
            {/* Live third-party reviews (Trustpilot/Google, admin-configured).
                Renders nothing until enabled AND the platform count passes 100.
                Review text comes from the platform - not translated. */}
            <Testimonials />
            <ExploreIslands
                dict={home.explore}
                locale={locale as Locale}
                islands={exploreIslands}
            />
            <EditorialBanner
                dict={editorialDict}
                ctaHref={editorialCtaHref}
                cards={editorialCards}
            />
            <FaqSection dict={faqDict} />
            {/* Dark photo CTA card before the footer (design v2). Reuses the
                editorial island's CTA label + href so both promos agree. */}
            <CtaCard
                dict={home.cta}
                cta={editorialDict.cta}
                ctaHref={editorialCtaHref}
                image={heroImageUrl}
            />
        </>
    );
}

