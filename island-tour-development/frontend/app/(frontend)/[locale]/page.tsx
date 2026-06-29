

import { Hero } from '@/components/frontend/home/hero';
import { TrustStrip } from '@/components/frontend/trust-strip';
import { TopExperiences } from '@/components/frontend/top-experiences';
import { Testimonials } from '@/components/frontend/testimonials';
import { ExploreIslands } from '@/components/frontend/explore-islands';
import { EditorialBanner } from '@/components/frontend/editorial-banner';
import { FaqSection } from '@/components/frontend/faq-section';
import { getActiveDestinations } from '@/lib/api/public';
import type { Locale } from '@/lib/constants/locales';
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
            <ExploreIslands dict={home.explore} locale={locale as Locale} />
            <EditorialBanner dict={home.editorial} />
            <FaqSection dict={home.faq} />
        </>
    );
}
