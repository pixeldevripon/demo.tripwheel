import { ToursBreadcrumb } from '@/components/frontend/tours-breadcrumb';
import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursHeader } from '@/components/frontend/tours-header';
import {
    type TourListing,
    ToursListing,
} from '@/components/frontend/tours-listing';
import { ToursTrustStrip } from '@/components/frontend/tours-trust-strip';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';

// Destination display names (proper nouns — not translated, only resolved from the slug).
const DESTINATION_NAMES: Record<string, string> = {
    curacao: 'Curaçao',
    aruba: 'Aruba',
    'sint-maarten': 'Sint Maarten',
    'saint-lucia': 'Saint Lucia',
    bonaire: 'Bonaire',
};

// Category quick-filter pills (placeholder — comes from the API later).
const FILTER_CATEGORIES: FilterCategory[] = [
    { label: 'Klein Curaçao', slug: 'klein-curacao' },
    { label: 'Boat Tours', slug: 'boat-tours' },
    { label: 'Snorkeling', slug: 'snorkeling' },
    { label: 'Sunset Cruises', slug: 'sunset-cruises' },
    { label: 'Off-Road Tours', slug: 'off-road-tours' },
    { label: 'Under €100 (21)', slug: 'under-100' },
];

// Tour grid mock — 6 base cards (replace with paginated API data later).
const BASE_TOURS: TourListing[] = [
    {
        id: 'tour-1',
        images: [
            '/images/tours/tour-1-1.jpg',
            '/images/tours/tour-1-2.jpg',
            '/images/tours/tour-1-3.jpg',
        ],
        badge: 'new',
        title: 'Klein Curaçao Catamaran Day Trip with Open bar & BBQ included',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: false,
    },
    {
        id: 'tour-2',
        images: ['/images/tours/tour-2-1.jpg', '/images/tours/tour-2-3.jpg'],
        badge: 'likelyToSellOut',
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'tour-3',
        images: [
            '/images/tours/tour-3-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
        ],
        badge: 'mostPopular',
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'tour-4',
        images: [
            '/images/tours/tour-4-1.jpg',
            '/images/tours/tour-4-2.jpg',
            '/images/tours/tour-4-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Private Yacht Charter for up to 12 guests with Custom itinerary & snorkel gear',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 270,
        priceUnit: 'perGroup',
        freeCancellation: false,
    },
    {
        id: 'tour-5',
        images: [
            '/images/tours/tour-5-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Snorkeling at Tugboat Beach with Small group (max 8)',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 270,
        priceUnit: 'perGroup',
        priceVaries: true,
        freeCancellation: true,
    },
    {
        id: 'tour-6',
        images: [
            '/images/tours/tour-6-1.jpg',
            '/images/tours/tour-1-2.jpg',
            '/images/tours/tour-6-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
];

// 18 cards (6 rows × 3) for the grid — cycle the base set with unique ids.
const ALL_TOURS: TourListing[] = [0, 1, 2].flatMap(group =>
    BASE_TOURS.map(tour => ({ ...tour, id: `${tour.id}-${group}` }))
);

/** Prerender the known destinations so `params` is static. */
export function generateStaticParams() {
    return Object.keys(DESTINATION_NAMES).map(destination => ({ destination }));
}

/**
 * All Tours page — `/[locale]/[destination]/tours` (the RESERVED `tours` slug).
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
    const destinationName =
        DESTINATION_NAMES[destination] ??
        destination.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <>
            <ToursBreadcrumb
                locale={locale as Locale}
                destinationName={destinationName}
                destinationSlug={destination}
                dict={dict.destination.allTours.breadcrumb}
            />
            <section className='bg-it-white pb-32.5'>
                <div className='it-container'>
                    {/* Content stack — 60px below the breadcrumb, 40px between blocks. */}
                    <div className='flex flex-col gap-10 pt-15'>
                        <ToursHeader
                            dict={dict.destination.allTours.heading}
                            destinationName={destinationName}
                            total={32}
                        />

                        <div
                            className='h-px w-full bg-it-heading/10'
                            aria-hidden='true'
                        />

                        {/* Toolbar + grid frame — 32px between toolbar and grid. */}
                        <div className='flex flex-col gap-8'>
                            <ToursFilterBar
                                dict={dict.destination.allTours.toolbar}
                                sortDict={dict.destination.allTours.sort}
                                filterDict={
                                    dict.destination.allTours.filterModal
                                }
                                hasReviews
                                categories={FILTER_CATEGORIES}
                                guestCount={2}
                                shown={28}
                                total={32}
                                initialSelected={['klein-curacao']}
                                initialChips={[
                                    {
                                        label: 'Klein Curaçao',
                                        slug: 'klein-curacao',
                                    },
                                ]}
                            />

                            <ToursListing
                                tours={ALL_TOURS}
                                dict={dict.destination.listings}
                                pageCount={6}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <ToursTrustStrip dict={dict.destination.allTours.trust} />
        </>
    );
}

