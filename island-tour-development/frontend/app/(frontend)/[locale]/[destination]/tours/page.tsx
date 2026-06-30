import { ToursBreadcrumb } from '@/components/frontend/tours-breadcrumb';
import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursHeader } from '@/components/frontend/tours-header';
import { ToursListing } from '@/components/frontend/tours-listing';
import { ToursTrustStrip } from '@/components/frontend/tours-trust-strip';
import { destinationsApi } from '@/lib/api/destinations';
import {
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationTours,
} from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';
import { notFound } from 'next/navigation';

// All bookable tours for the destination; the grid paginates client-side.
const TOURS_LIMIT = 48;

// Fallback slugs for static generation if the backend is unreachable at build.
const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/** Prerender active destinations from the backend; fall back to launch slugs. */
export async function generateStaticParams() {
    try {
        const destinations = await destinationsApi.getActive();
        if (destinations.length > 0) {
            return destinations.map(d => ({ destination: d.slug }));
        }
    } catch {
        // backend unavailable at build - fall through to launch slugs
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }));
}

/**
 * All Tours page - `/[locale]/[destination]/tours` (the RESERVED `tours` slug).
 * Built section by section; the breadcrumb is first.
 */
export default async function AllToursPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);

    // Resolve the destination + its categories from the backend (cached).
    const [dest, categories] = await Promise.all([
        getDestinationBySlug(destination, locale as Locale),
        getDestinationCategories(destination, locale as Locale),
    ]);
    if (!dest || !dest.isActive) notFound();
    const destinationName = dest.name;

    // `recommended` applies the master §7.2 order (tier_rank ASC, quality_score DESC,
    // id) + the §3.8 diversity pass + bookability filter, server-side.
    const tourList = await getDestinationTours({
        destinationId: dest.id,
        locale: locale as Locale,
        sort: 'recommended',
        limit: TOURS_LIMIT,
    });

    // Cards keep the backend order; searchHitToListing carries the badge + flat URL.
    const tours = tourList.data.map(hit =>
        searchHitToListing(hit, locale as Locale, dict.search),
    );
    const total = tourList.total;

    // Real category quick-filter pills (tour-gated, so each links somewhere live).
    const filterCategories: FilterCategory[] = categories.map(category => ({
        label: category.name,
        slug: category.slug,
    }));

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
                        <ToursHeader
                            dict={dict.destination.allTours.heading}
                            destinationName={destinationName}
                            total={total}
                            selectDateLabel={dict.destination.allTours.toolbar.selectDate}
                        />

                        <div
                            className='h-px w-full bg-it-heading/10'
                            aria-hidden='true'
                        />

                        {/* Toolbar + grid frame - 32px between toolbar and grid. */}
                        <div className='flex flex-col gap-8'>
                            {/* Filters/sort/date are still client-side UI only - the
                                grid is the live recommended order. Wiring the filter
                                state to query params is a separate task. */}
                            <ToursFilterBar
                                dict={dict.destination.allTours.toolbar}
                                sortDict={dict.destination.allTours.sort}
                                filterDict={
                                    dict.destination.allTours.filterModal
                                }
                                hasReviews
                                categories={filterCategories}
                                guestCount={2}
                                shown={tours.length}
                                total={total}
                                initialSelected={[]}
                                initialChips={[]}
                            />

                            <ToursListing
                                tours={tours}
                                dict={dict.destination.listings}
                                pageCount={1}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <ToursTrustStrip dict={dict.destination.allTours.trust} />
        </>
    );
}

