import { type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { ToursBreadcrumb, type BreadcrumbAnchor } from './tours-breadcrumb';
import { TourHeader } from './tour-header';
import { TourGallery, type TourGalleryMeta } from './tour-gallery';
import { TourBookingCard } from './tour-booking-card';
import { TourReviews, type TourReview } from './tour-reviews';
import { TourDetailTabs, type TourTab } from './tour-detail-tabs';

/**
 * Tour detail page - the TOUR branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{tour-slug}/`, always flat - ROUTING-AND-RESOLUTION
 * §5.2). The tour resolves by its flat slug; the page is built section-by-section
 * against Figma (node 47936:3354).
 *
 * The public by-slug tour endpoint is not wired yet, so the page runs on MOCK
 * data (same convention as HubPage) until `tripsApi.getBySlug` exists. Localized
 * fields fall back to canonical English on the backend; slugs are English at
 * every locale.
 *
 * Built so far:
 *   - reusable breadcrumb (flat `Home › {Destination} › {Tour}` - master §9,
 *     auto-anchored to a primary hub/category when real data is wired)
 *   - title + header band (node 47936:3370): H1, rating / locals' favorite /
 *     location meta, Save / Share pills
 */

// Representative tour matching the Figma wireframe - placeholder until the public
// tour-by-slug API is wired. `breadcrumbLabel` is the shorter, title-cased crumb
// (distinct from the H1).
const MOCK_TOUR = {
    title: 'Curaçao: Sunset reef snorkel & boat tour',
    breadcrumbLabel: 'Sunset Reef Snorkel & Boat Tour',
    rating: 4.8,
    reviewCount: 1738,
    isLocalsFavourite: true,
    locationLabel: 'Willemstad, Curaçao',
    // No primary hub/category anchor in this wireframe → flat breadcrumb.
    anchor: null as BreadcrumbAnchor | null,
    images: [
        '/images/tours/tour-1-1.jpg',
        '/images/tours/tour-1-2.jpg',
        '/images/tours/tour-1-3.jpg',
        '/images/tours/tour-2-1.jpg',
        '/images/tours/tour-2-3.jpg',
    ],
};

// Gallery meta pills (duration / pickup / languages) - placeholder values until
// the tour-by-slug API is wired. Icons are the platform's Figma SVG exports.
const MOCK_GALLERY_META: TourGalleryMeta[] = [
    { icon: '/icons/clock.svg', label: '8 hours' },
    { icon: '/icons/car.svg', label: 'Pickup available' },
    { icon: '/icons/nav-globe.svg', label: 'EN, NL, +2' },
];

// Review preview cards (Figma node 47936:3499) - placeholder until the reviews
// module + tour-by-slug API are wired.
const MOCK_REVIEWS: TourReview[] = [
    {
        id: 'rev-1',
        name: 'Lina N.',
        country: 'Netherlands',
        date: 'March 12, 2026',
        rating: 5,
        text: 'Amazing snorkel spot. It was outstanding. The crew was friendly, the reef was full of life, and the sunset on the way back was...',
        verified: true,
    },
    {
        id: 'rev-2',
        name: 'Marco R.',
        country: 'Germany',
        date: 'March 8, 2026',
        rating: 5,
        text: 'Perfectly organised from pickup to drop-off. The gear was in great condition and the guide pointed out turtles and rays we would never have...',
        verified: true,
    },
];

interface TourPageProps {
    /** Destination slug from the URL (e.g. `curacao`). */
    destinationSlug: string;
    /** Resolved tour slug from the URL (e.g. `sunset-reef-snorkel-boat-tour`). */
    slug: string;
    /** Proper-noun destination display name (resolved by the route). */
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export async function TourPage({
    destinationSlug,
    slug,
    destinationName,
    locale,
    dict,
}: TourPageProps) {
    const tour = MOCK_TOUR;
    const tourDict = dict.destination.tour;

    // In-page tab nav over the detail sections. Each tab scrolls to its `#id`
    // section; sections are added incrementally (each is collapsible, separated
    // by a hairline), so a tab whose section is not built yet is inert.
    const sectionTabs: TourTab[] = [
        { id: 'tour-overview', label: tourDict.sections.overview },
        { id: 'tour-included', label: tourDict.sections.included },
        { id: 'tour-expect', label: tourDict.sections.expect },
        { id: 'tour-meeting', label: tourDict.sections.meeting },
        { id: 'tour-info', label: tourDict.sections.info },
        { id: 'tour-cancellation', label: tourDict.sections.cancellation },
        { id: 'tour-reviews', label: tourDict.sections.reviews },
    ];

    return (
        <>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                anchor={tour.anchor}
                dict={{
                    home: dict.destination.allTours.breadcrumb.home,
                    current: tour.breadcrumbLabel,
                }}
            />
            <TourHeader
                title={tour.title}
                rating={tour.rating}
                reviewCount={tour.reviewCount}
                isLocalsFavourite={tour.isLocalsFavourite}
                locationLabel={tour.locationLabel}
                locale={locale}
                dict={{
                    save: tourDict.save,
                    share: tourDict.share,
                    localsFavorite: tourDict.localsFavorite,
                }}
            />

            {/* Left column (gallery + reviews) + static booking card (right rail,
                sticky on lg). Figma nodes 47940:12742 + 47936:3499 + 47936:3386. */}
            <section className='bg-it-white pb-16 md:pb-18'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-6'>
                        <div className='flex flex-col gap-10'>
                            <TourGallery
                                images={tour.images}
                                title={tour.title}
                                meta={MOCK_GALLERY_META}
                                showAllPhotosLabel={tourDict.showAllPhotos}
                            />
                            <TourReviews
                                rating={tour.rating}
                                reviewCount={tour.reviewCount}
                                reviews={MOCK_REVIEWS}
                                destinationSlug={destinationSlug}
                                tourSlug={slug}
                                locale={locale}
                                dict={tourDict.reviews}
                            />
                        </div>
                        <div className='lg:sticky lg:top-24'>
                            <TourBookingCard dict={tourDict.booking} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Detail sections - sticky tab nav (Figma 47936:3592); the
                collapsible content sections are added one per build. */}
            <section className='bg-it-white pb-16 md:pb-24 '>
                <div className='it-container'>
                    <TourDetailTabs tabs={sectionTabs} />
                </div>
            </section>
        </>
    );
}
