import { twitterCard } from '@/lib/seo/twitter-card';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { ToursBreadcrumb } from '@/components/frontend/tours/tours-breadcrumb';
import { ToursTrustStrip } from '@/components/frontend/tours/tours-trust-strip';
import { ToursHeaderSection } from '@/components/frontend/tours/tours-header-section';
import { ToursListingSection } from '@/components/frontend/tours/tours-listing-section';
import { ToursListingSkeleton } from '@/components/frontend/skeletons/tours-page-skeleton';
import { getActiveDestinations, getDestinationBySlug } from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getCurrentYear } from '@/lib/current-year';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo/alternates';
import { ogImageMeta } from '@/lib/seo/og-image';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';
import { JsonLd } from '@/components/frontend/seo/json-ld';
import type { Metadata } from 'next';

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
 * The All Tours listing had NO metadata at all, so every island's page served
 * the root layout's global title and had neither a canonical nor hreflang.
 *
 * There is no CMS row behind this page (`tours` is a reserved slug, not an
 * entity), so the copy comes from the same localized dictionary templates the
 * page's own H1 renders - title and `<title>` stay in step by construction, in
 * all 7 locales. The year comes from the shared cached helper for the same
 * reason.
 *
 * The canonical is deliberately the bare path: this page is driven by
 * searchParams (filters, sort, date, party size), and without a self-referencing
 * canonical every filter combination would be a separate indexable URL
 * (ROUTING-AND-RESOLUTION.md §11.3).
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}): Promise<Metadata> {
    const { locale, destination } = await params;
    if (!isLocale(locale)) return {};

    const alternates = buildAlternates(locale, `/${destination}/tours`);

    const [dict, dest] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale),
    ]);
    // Unknown or not-yet-launched island: emit only the alternates so the page's
    // own notFound() still governs the response.
    if (!dest || !dest.isActive) return { alternates };

    const heading = dict.destination.allTours.heading;

    const allToursTitle = heading.title
        .replace('{destination}', dest.name)
        .replace('{year}', String(await getCurrentYear()));
    const allToursDescription = heading.subtitle.replace(
        '{destination}',
        dest.name,
    );

    return {
        title: allToursTitle,
        description: allToursDescription,
        ...(await ogImageMeta(dest.ogImage, locale, allToursTitle)),
        ...twitterCard(allToursTitle, allToursDescription),
        alternates,
    };
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
    searchParams,
}: {
    params: Promise<{ locale: string; destination: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, dest, siteUrl] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale as Locale),
        getSiteUrl(),
    ]);
    if (!dest || !dest.isActive) notFound();
    const destinationName = dest.name;

    const breadcrumbJsonLd = buildBreadcrumbJsonLd({
        siteUrl,
        locale: locale as Locale,
        trail: [
            { name: destinationName, path: `/${destination}` },
            {
                name: dict.destination.allTours.breadcrumb.current,
                path: `/${destination}/tours`,
            },
        ],
    });

    return (
        <>
            <JsonLd data={breadcrumbJsonLd} />
            <ToursBreadcrumb
                locale={locale as Locale}
                destinationName={destinationName}
                destinationSlug={destination}
                dict={dict.destination.allTours.breadcrumb}
            />

            {/* No bottom padding: the trust strip's own 56px top margin sets
                the gap below the pager (mockup .truststrip). */}
            <section className='bg-it-white'>
                {/* Page header (.pagehead) in the container; the sticky filter
                    row + grid stream below at FULL WIDTH (the toolbar owns its
                    own containers so its sticky band bleeds edge to edge). */}
                <div className='it-container'>
                    {/* Header is a cheap cached count on a prerendered route,
                        so it bakes into the static shell (instant, no skeleton
                        flash). Only the searchParams-driven listing below
                        streams. */}
                    <ToursHeaderSection
                        destinationId={dest.id}
                        destinationName={destinationName}
                        dict={dict}
                    />
                </div>

                <Suspense fallback={<ToursListingSkeleton />}>
                    <ToursListingSection
                        destinationId={dest.id}
                        destination={destination}
                        locale={locale as Locale}
                        dict={dict}
                        searchParams={searchParams}
                    />
                </Suspense>
            </section>

            <ToursTrustStrip dict={dict.destination.allTours.trust} />
        </>
    );
}
