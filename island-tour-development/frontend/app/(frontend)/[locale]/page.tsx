import { Hero } from '@/components/frontend/hero';
import { TrustStrip } from '@/components/frontend/trust-strip';
import { TopExperiences } from '@/components/frontend/top-experiences';
import { Testimonials } from '@/components/frontend/testimonials';
import { ExploreIslands } from '@/components/frontend/explore-islands';
import { EditorialBanner } from '@/components/frontend/editorial-banner';
import { FaqSection } from '@/components/frontend/faq-section';
import type { Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const { home } = await getDictionary(locale as Locale);

    return (
        <>
            <Hero dict={home.hero} />
            <TrustStrip items={home.trust} />
            <TopExperiences dict={home.experiences} />
            {/* Testimonials are database-driven — not translated via the i18n dictionary */}
            <Testimonials />
            <ExploreIslands dict={home.explore} />
            <EditorialBanner dict={home.editorial} />
            <FaqSection dict={home.faq} />
        </>
    );
}
