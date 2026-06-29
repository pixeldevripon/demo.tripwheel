

import { Hero } from '@/components/frontend/home/hero';
import { TrustStrip } from '@/components/frontend/trust-strip';
import { TopExperiences } from '@/components/frontend/top-experiences';
import { Testimonials } from '@/components/frontend/testimonials';
import { ExploreIslands } from '@/components/frontend/explore-islands';
import { EditorialBanner } from '@/components/frontend/editorial-banner';
import { FaqSection } from '@/components/frontend/faq-section';
import { getActiveDestinations } from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const [dict, destinations] = await Promise.all([
        getDictionary(locale as Locale),
        getActiveDestinations(locale as Locale),
    ]);
    const { home } = dict;
    // Hero search + Popular are driven by the live destinations (name + slug).
    const islands = destinations.map((d) => ({ name: d.name, slug: d.slug }));
    // "Explore islands" cards need the hero image + live tour count too.
    const exploreIslands = destinations.map((d) => ({
        name: d.name,
        slug: d.slug,
        tours: d.tourCount,
        image: d.heroImage ?? '/images/home-page/islands/curacao.jpg',
    }));
    // The editorial banner copy is themed to the launch island (Curaçao); link
    // its CTA there if active, else the first destination, else all-tours search.
    const editorialIsland =
        destinations.find((d) => d.slug === 'curacao') ?? destinations[0];
    const editorialCtaHref = editorialIsland
        ? localizeHref(locale as Locale, `/${editorialIsland.slug}`)
        : localizeHref(locale as Locale, '/search');

    return (
        <>
            <Hero
                dict={home.hero}
                locale={locale as Locale}
                destinations={islands}
            />
            <TrustStrip items={home.trust} />
            <TopExperiences dict={home.experiences} />
            {/* Testimonials are database-driven - not translated via the i18n dictionary */}
            <Testimonials />
            <ExploreIslands
                dict={home.explore}
                locale={locale as Locale}
                islands={exploreIslands}
            />
            <EditorialBanner dict={home.editorial} ctaHref={editorialCtaHref} />
            <FaqSection dict={home.faq} />
        </>
    );
}
