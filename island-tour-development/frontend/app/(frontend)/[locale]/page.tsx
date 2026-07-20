import { FaqSection } from '@/components/frontend/faq-section';
import { EditorialBanner } from '@/components/frontend/home/editorial-banner';
import { ExploreIslands } from '@/components/frontend/home/explore-islands';
import { Hero } from '@/components/frontend/home/hero';
import { Testimonials } from '@/components/frontend/home/testimonials';
import { TopExperiences } from '@/components/frontend/home/top-experiences';
import { TrustStrip } from '@/components/frontend/home/trust-strip';
import {
    getActiveDestinations,
    getFeaturedExperiences,
    getHomePageContent,
} from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { safeRemoteImage } from '@/lib/images/remote-hosts';

export default async function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // All three are cached loaders, so this stays part of the prerendered shell
    // (no Suspense boundary needed - nothing here is request-specific).
    const [dict, destinations, content, experiences] = await Promise.all([
        getDictionary(locale as Locale),
        getActiveDestinations(locale as Locale),
        getHomePageContent(locale as Locale),
        getFeaturedExperiences(locale as Locale),
    ]);
    const { home } = dict;
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
    const experienceCards = experiences.map(e => ({
        id: e.id,
        title: e.title,
        image: safeRemoteImage(e.image),
        videoUrl: e.videoUrl,
        href: localizeHref(locale as Locale, e.href),
    }));
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
                image={safeRemoteImage(content.heroImage)}
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
                images={content.editorialImages.map(src =>
                    safeRemoteImage(src, ''),
                )}
            />
            <FaqSection dict={faqDict} />
        </>
    );
}

