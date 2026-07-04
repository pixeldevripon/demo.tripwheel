import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { ToursBreadcrumb } from '@/components/frontend/tours-breadcrumb';
import { ToursTrustStrip } from '@/components/frontend/tours-trust-strip';
import { ToursHeaderSection } from '@/components/frontend/tours/tours-header-section';
import { ToursListingSection } from '@/components/frontend/tours/tours-listing-section';
import {
    ToursHeaderSkeleton,
    ToursListingSkeleton,
} from '@/components/skelitons/tours-page-skeleton';
import { getActiveDestinations, getDestinationBySlug } from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

// Fallback slugs for static generation if the backend is unreachable at build
// (Cache Components requires generateStaticParams to return at least one entry).
const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/** Prerender the active destinations from the backend; fall back to launch slugs. */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            return destinations.map(d => ({ destination: d.slug }));
        }
    } catch {
        // backend unavailable at build - fall through to launch slugs
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }));
}

/**
 * All Tours page - `/[locale]/[destination]/tours` (the RESERVED `tours` slug).
 *
 * The shell resolves the island + dictionary (fast cached loaders) and gates a
 * 404 for unknown/inactive islands, then renders the breadcrumb + trust strip
 * (static). The two data-heavy blocks - the header count and the toolbar + tour
 * grid - each stream into their own `<Suspense>` boundary behind a
 * section-mirroring skeleton (Cache Components PPR). The route's `loading.tsx`
 * covers the initial navigation.
 */
export default async function AllToursPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, dest] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale as Locale),
    ]);
    if (!dest || !dest.isActive) notFound();
    const destinationName = dest.name;

    return (
        <>
            <ToursBreadcrumb
                locale={locale as Locale}
                destinationName={destinationName}
                destinationSlug={destination}
                dict={dict.destination.allTours.breadcrumb}
            />

            <section className='bg-it-white pb-8 md:pb-32.5'>
                <div className='it-container'>
                    {/* Content stack - 60px below the breadcrumb, 40px between blocks. */}
                    <div className='flex flex-col max-md:gap-8 gap-10 pt-8 md:pt-15'>
                        <Suspense fallback={<ToursHeaderSkeleton />}>
                            <ToursHeaderSection
                                destinationId={dest.id}
                                destinationName={destinationName}
                                dict={dict}
                            />
                        </Suspense>

                        <div
                            className='h-px w-full bg-it-heading/10'
                            aria-hidden='true'
                        />

                        <Suspense fallback={<ToursListingSkeleton />}>
                            <ToursListingSection
                                destinationId={dest.id}
                                destination={destination}
                                locale={locale as Locale}
                                dict={dict}
                            />
                        </Suspense>
                    </div>
                </div>
            </section>

            <ToursTrustStrip dict={dict.destination.allTours.trust} />
        </>
    );
}
