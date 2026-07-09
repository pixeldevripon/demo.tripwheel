import { collectionsApi } from '@/lib/api/collections';
import { getDestinationBySlug } from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { toSlug } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { CategoryYouMightLike } from './category-you-might-like';
import { CollectionHero } from './collection-hero';
import { CollectionToursSection } from './collection-tours-section';
import { FaqSection } from './faq-section';
import type { TourListing } from './tour-card';
import { ToursBreadcrumb } from './tours-breadcrumb';

/**
 * Collection page - the COLLECTION branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{collection-slug}/`).
 */

// Editorial lead-in above the ranked grid (Figma 47433:2088). English mock until
// the collection editorial content API is wired.
const MOCK_INTRO =
    'The best things to do in Curaçao include Klein Curaçao day trips, swimming with dolphins, Westcoast Tours, sunset cruises, and off-road buggy tours - chosen by Islanders who have done all of them.';

// Fallback "Keep exploring" tiles when the destination has no other published
// collections yet (Figma 47433:2429). English placeholders until real siblings exist.
const MOCK_RELATED = [
    {
        name: 'Best for couples',
        slug: 'best-for-couples',
        image: '/images/tours/tour-1-1.jpg',
    },
    {
        name: 'Best for families',
        slug: 'best-for-families',
        image: '/images/tours/tour-2-1.jpg',
    },
    {
        name: 'Day trips',
        slug: 'day-trips',
        image: '/images/tours/tour-3-1.jpg',
    },
];

// Placeholder ranked tours to render until the collection tour API is wired. Each
// carries a `rank` + `description` so <TourCard> renders the ranked variant.
const MOCK_TOURS: TourListing[] = [
    {
        id: 'coll-1',
        rank: 1,
        images: ['/images/tours/tour-1-1.jpg'],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Klein Curaçao - BlueFinn Catamaran',
        description:
            'An uninhabited island, 10km offshore, sea turtles, no signal. The day Curaçao is famous for.',
        duration: 'Full day',
        pickupAvailable: false,
        price: 120,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-2',
        rank: 2,
        images: ['/images/tours/tour-2-1.jpg'],
        badge: null,
        rating: 4.9,
        reviewCount: 982,
        title: 'Swim with Wild Dolphins at Dolphin Academy',
        description:
            'Get in the water with dolphins in a natural lagoon reef - the closest encounter on the island.',
        duration: '2 hours',
        pickupAvailable: false,
        price: 165,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-3',
        rank: 3,
        images: ['/images/tours/tour-3-1.jpg'],
        badge: null,
        rating: 4.7,
        reviewCount: 1204,
        title: 'West Coast & Shete Boka Off-Road Tour',
        description:
            'Rugged north-shore blowholes, hidden coves, and Playa Kenepa reached by 4x4.',
        duration: '6 hours',
        pickupAvailable: false,
        price: 95,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-4',
        rank: 4,
        images: ['/images/tours/tour-1-1.jpg'],
        badge: null,
        rating: 4.8,
        reviewCount: 1051,
        title: 'Sunset Sailing Cruise on Spanish Water',
        description:
            'Golden-hour sail with unlimited drinks and appetizers along the calm south coast.',
        duration: '3 hours',
        pickupAvailable: false,
        price: 72,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-5',
        rank: 5,
        images: ['/images/tours/tour-2-1.jpg'],
        badge: null,
        rating: 4.7,
        reviewCount: 766,
        title: 'Snorkel the Blue Room Cave',
        description:
            'Boat out to the glowing underwater cave, then drift over the Tugboat wreck reef.',
        duration: 'Half day',
        pickupAvailable: false,
        price: 60,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-6',
        rank: 6,
        images: ['/images/tours/tour-3-1.jpg'],
        badge: null,
        rating: 4.6,
        reviewCount: 534,
        title: 'Sea Aquarium & Animal Encounters',
        description:
            'Feed sea lions, meet flamingos, and snorkel with rays a step from Mambo Beach.',
        duration: '3 hours',
        pickupAvailable: false,
        price: 48,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-7',
        rank: 7,
        images: ['/images/tours/tour-1-1.jpg'],
        badge: null,
        rating: 4.9,
        reviewCount: 318,
        title: 'Private Yacht Charter for up to 12',
        description:
            'Your own crewed yacht - hidden beaches, snorkel stops, and drinks on your schedule.',
        duration: 'Full day',
        pickupAvailable: false,
        price: 270,
        priceUnit: 'perGroup',
        freeCancellation: true,
    },
    {
        id: 'coll-8',
        rank: 8,
        images: ['/images/tours/tour-2-1.jpg'],
        badge: null,
        rating: 4.8,
        reviewCount: 642,
        title: 'Willemstad UNESCO Walking & Food Tour',
        description:
            'Handelskade colours, Punda alleys, and six local tastings with an island guide.',
        duration: '3 hours',
        pickupAvailable: false,
        price: 55,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-9',
        rank: 9,
        images: ['/images/tours/tour-3-1.jpg'],
        badge: null,
        rating: 4.9,
        reviewCount: 401,
        title: 'Scuba Diving Discovery for Beginners',
        description:
            'No licence needed - a guided first dive over Curaçao easy house-reef walls.',
        duration: 'Half day',
        pickupAvailable: false,
        price: 110,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'coll-10',
        rank: 10,
        images: ['/images/tours/tour-1-1.jpg'],
        badge: null,
        rating: 4.7,
        reviewCount: 289,
        title: 'Christoffel National Park Sunrise Hike',
        description:
            'Summit the island highest peak at dawn before the heat, with a park ranger.',
        duration: '4 hours',
        pickupAvailable: false,
        price: 40,
        priceUnit: 'per',
        freeCancellation: true,
    },
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
    const [collection, destination, relatedCollections] = await Promise.all([
        collectionsApi
            .getBySlug(collectionSlug, destinationSlug, locale)
            .catch(() => null),
        getDestinationBySlug(destinationSlug, locale),
        collectionsApi.getActive(destinationSlug, locale).catch(() => []),
    ]);

    if (!collection) notFound();

    const t = dict.destination.allTours;
    const listings = dict.destination.listings;
    const collectionDict = dict.destination.collections;
    const breadcrumbLabel = collection.breadcrumbLabel ?? collection.name;
    const heading = collection.h1Override ?? collection.name;
    const subtitle = collection.overview ?? null;
    const total = Array.isArray(collection.tours)
        ? collection.tours.length
        : MOCK_TOURS.length;

    const tours = MOCK_TOURS.map(tour => ({
        ...tour,
        href: localizeHref(locale, `/${destinationSlug}/${toSlug(tour.title)}`),
    }));

    // Related collections - real siblings when available, else mock placeholders.
    const fetchedRelated = relatedCollections
        .filter(c => c.slug !== collectionSlug)
        .slice(0, 3)
        .map(c => ({ name: c.name, slug: c.slug, image: c.heroImage ?? undefined }));
    const relatedItems = fetchedRelated.length ? fetchedRelated : MOCK_RELATED;
    const related = collectionDict.related;

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
                title={'The 10 best things to do in Curaçao'}
                eyebrow={'BEST THINGS TO DO'}
                subtitle={"Chosen by Islanders — in the order we'd book them"}
                heroImage={collection.heroImage ?? null}
                tourCount={total}
                startingPrice={40}
                dict={{
                    tours: collectionDict?.tours ?? 'tours',
                    from: listings?.from ?? 'From',
                    share: collectionDict?.share ?? 'Share',
                }}
            />

            {/* Ranked tour grid - Figma 47433:2088 */}
            <CollectionToursSection
                intro={MOCK_INTRO}
                tours={tours}
                dict={{
                    new: listings.new,
                    likelyToSellOut: listings.likelyToSellOut,
                    mostPopular: listings.mostPopular,
                    sponsored: listings.sponsored,
                    pickupAvailable: listings.pickupAvailable,
                    freeCancellation: listings.freeCancellation,
                    priceVaries: listings.priceVaries,
                    from: listings.from,
                    per: listings.per,
                    perGroup: listings.perGroup,
                }}
            />

            {/* FAQ - reuses the shared <FaqSection>; chrome from the localized
                home.faq, collection-specific guarantees + questions from the
                localized destination.collections.faq (Figma 47433:2306). */}
            <FaqSection
                dict={{
                    ...dict.home.faq,
                    ...collectionDict.faq,
                }}
            />

            {/* "Keep exploring {destination}" related collections - Figma 47433:2429 */}
            {relatedItems.length > 0 && (
                <CategoryYouMightLike
                    variant='collection'
                    title={related.heading.replace('{destination}', destinationName)}
                    items={relatedItems}
                    locale={locale}
                    destinationSlug={destinationSlug}
                    footer={{
                        prompt: related.prompt,
                        cta: related.cta.replace('{destination}', destinationName),
                        href: `/${destinationSlug}/tours`,
                    }}
                />
            )}
        </>
    );
}


