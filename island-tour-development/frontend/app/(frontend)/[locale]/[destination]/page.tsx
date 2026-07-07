import { DestinationAbout } from '@/components/frontend/destination-about';
import { DestinationInstagram } from '@/components/frontend/destination-instagram';
import {
    DestinationCollectionsSection,
    DestinationHeroSection,
    DestinationLocalFavourites,
} from '@/components/frontend/destination/destination-page-sections';
import { FaqSection } from '@/components/frontend/faq-section';
import {
    DestinationHeroSkeleton,
    DestinationListingsSkeleton,
} from '@/components/skelitons/destination-page-skeleton';
import { getActiveDestinations, getDestinationBySlug } from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

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
 * 404 for unknown/inactive islands, then streams each data-heavy section into its
 * own `<Suspense>` boundary behind a section-mirroring skeleton (Cache Components
 * PPR): hero + explore (hubs/categories) and locals' favorites (tours). The
 * About / Instagram / FAQ sections need only the name + dictionary, so they render
 * in the static shell. The route's `loading.tsx` covers the initial resolve.
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
            <Suspense fallback={<DestinationHeroSkeleton />}>
                <DestinationHeroSection
                    destination={destination}
                    locale={locale as Locale}
                    dict={dict}
                    destinationName={destinationName}
                    heroImage={island.heroImage ?? undefined}
                />
            </Suspense>

            <Suspense fallback={<DestinationListingsSkeleton />}>
                <DestinationLocalFavourites
                    destination={destination}
                    locale={locale as Locale}
                    dict={dict}
                    islandId={island.id}
                    destinationName={destinationName}
                />
            </Suspense>

            <Suspense fallback={<DestinationListingsSkeleton />}>
                <DestinationCollectionsSection
                    destination={destination}
                    locale={locale as Locale}
                    dict={dict}
                />
            </Suspense>

            <DestinationInstagram dict={dict.destination.instagram} />

            <FaqSection dict={dict.home.faq} />

            <DestinationAbout
                destinationName={destinationName}
                dict={dict.destination.about}
            />
        </>
    );
}

