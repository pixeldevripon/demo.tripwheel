import { DestinationAbout } from '@/components/frontend/destination/destination-about';
import { DestinationInstagram } from '@/components/frontend/destination/destination-instagram';
import {
    DestinationCollectionsSection,
    DestinationHeroSection,
    DestinationLocalFavourites,
} from '@/components/frontend/destination/destination-page-sections';
import { FaqSection } from '@/components/frontend/faq-section';
import { getActiveDestinations, getDestinationBySlug } from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';

const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/** Prerender the active destinations from the backend (public cached loader). */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            return destinations.map(d => ({ destination: d.slug }));
        }
    } catch {
        // Fallback if backend is unavailable during build
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }));
}

/**
 * Destination page - `/[locale]/[destination]` (e.g. /en/curacao).
 *
 * The route resolves the island + dictionary (fast cached loaders) and gates a
 * 404 for unknown/inactive islands. This route is prerendered
 * (`generateStaticParams`), and every section reads only cached (`'use cache'`)
 * data, so the whole page is baked static (instant, SEO content in the initial
 * HTML, no skeleton flash) and kept fresh via cache tags. The route's
 * `loading.tsx` covers client navigation and a cold island's first on-demand
 * render.
 */
export default async function DestinationPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, island] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale),
    ]);
    // Unknown or not-yet-launched (inactive) island → 404. getDestinationBySlug
    // resolves any slug, so we gate on isActive here for the public site.
    if (!island || !island.isActive) notFound();

    const destinationName = island.name;

    return (
        <>
            <DestinationHeroSection
                destination={destination}
                locale={locale as Locale}
                dict={dict}
                destinationName={destinationName}
                heroImage={island.heroImage ?? undefined}
            />

            <DestinationLocalFavourites
                destination={destination}
                locale={locale as Locale}
                dict={dict}
                islandId={island.id}
                destinationName={destinationName}
            />

            <DestinationCollectionsSection
                destination={destination}
                locale={locale as Locale}
                dict={dict}
            />

            <DestinationInstagram dict={dict.destination.instagram} />

            <FaqSection dict={dict.home.faq} />

            <DestinationAbout
                destinationName={destinationName}
                dict={dict.destination.about}
            />
        </>
    );
}

