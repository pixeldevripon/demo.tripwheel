import { notFound } from 'next/navigation';
import { collectionsApi } from '@/lib/api/collections';
import { getDestinationBySlug } from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { toSlug } from '@/lib/utils';
import { ToursBreadcrumb } from './tours-breadcrumb';
import { CollectionHero } from './collection-hero';
import { ToursListing } from './tours-listing';
import type { TourListing } from './tour-card';

/**
 * Collection page - the COLLECTION branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{collection-slug}/`).
 */

// Placeholder tours to render until the collection tour API is wired.
const MOCK_TOURS: TourListing[] = [
    {
        id: 'coll-1',
        images: ['/images/tours/tour-1-1.jpg', '/images/tours/tour-1-2.jpg', '/images/tours/tour-1-3.jpg'],
        badge: 'mostPopular',
        rating: 4.8,
        reviewCount: 1738,
        title: 'Klein Curaçao Catamaran Day Trip with Open bar & BBQ included',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: false,
    },
    {
        id: 'coll-2',
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
        id: 'coll-3',
        images: ['/images/tours/tour-3-1.jpg', '/images/tours/tour-3-2.jpg', '/images/tours/tour-3-3.jpg'],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Private Yacht Charter for up to 12 guests',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 270,
        priceUnit: 'perGroup',
        freeCancellation: false,
    }
];

interface CollectionPageProps {
    destinationSlug: string;
    collectionSlug: string;
    collectionId: string;
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export async function CollectionPage({
    destinationSlug,
    collectionSlug,
    collectionId,
    destinationName,
    locale,
    dict,
}: CollectionPageProps) {
    const [collection, destination] = await Promise.all([
        collectionsApi.getBySlug(collectionSlug, destinationSlug, locale).catch(() => null),
        getDestinationBySlug(destinationSlug, locale),
    ]);

    if (!collection) notFound();

    const t = dict.destination.allTours;
    const listings = dict.destination.listings;
    const collectionDict = dict.destination.collections;
    const breadcrumbLabel = collection.breadcrumbLabel ?? collection.name;
    const heading = collection.h1Override ?? collection.name;
    const subtitle = collection.overview ?? null;
    const total = Array.isArray(collection.tours) ? collection.tours.length : MOCK_TOURS.length;

    const tours = MOCK_TOURS.map(tour => ({
        ...tour,
        href: localizeHref(locale, `/${destinationSlug}/${toSlug(tour.title)}`),
    }));

    return (
        <>
            {/* Breadcrumb: Home › Curaçao › Collections › {Collection Name} */}
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                anchor={{
                    label: collectionDict?.breadcrumb ?? 'Collections',
                    href: `/${destinationSlug}#collections`,
                }}
                dict={{ home: t.breadcrumb.home, current: breadcrumbLabel }}
            />

            {/* Full-width Hero — matches Figma 47433-2069 */}
            <CollectionHero
                title={heading}
                eyebrow={null}
                subtitle={subtitle}
                heroImage={collection.heroImage ?? null}
                tourCount={total}
                startingPrice={null}
                dict={{
                    tours: collectionDict?.tours ?? 'tours',
                    from: listings?.from ?? 'From',
                    share: collectionDict?.share ?? 'Share',
                }}
            />

            {/* Tour listing */}
            <section className='bg-it-white pb-17.5 md:pb-32.5'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10 pt-8 md:pt-15'>
                        <div className='h-px w-full bg-it-heading/10' aria-hidden='true' />

                        <ToursListing
                            tours={tours}
                            dict={listings}
                            pageCount={1}
                        />
                    </div>
                </div>
            </section>
        </>
    );
}
