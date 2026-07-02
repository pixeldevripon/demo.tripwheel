import Image from 'next/image';
import { notFound } from 'next/navigation';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { toSlug } from '@/lib/utils';
import { getTourBySlug } from '@/lib/api/public/tours';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { formatDuration } from '@/lib/tours/listing';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { TourListing } from './tour-card';
import { TourRelatedSection } from './tour-related-section';
import { ToursBreadcrumb, type BreadcrumbAnchor } from './tours-breadcrumb';
import { TourSection } from './tour-section';
import { TourMeetingCard } from './tour-meeting-card';
import { TourReviewsSection, type FullReview } from './tour-reviews-section';
import { TourHeader } from './tour-header';
import { TourGallery, type TourGalleryMeta } from './tour-gallery';
import { TourBookingCard } from './tour-booking-card';
import { TourReviews, type TourReview } from './tour-reviews';
import { TourDetailTabs, type TourTab } from './tour-detail-tabs';

/**
 * Tour detail page - the TOUR branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{tour-slug}/`, always flat - ROUTING-AND-RESOLUTION
 * §5.2). The tour resolves by its flat slug via `getTourBySlug`; the page is
 * built section-by-section against Figma (node 47936:3354) and wired to the API
 * one section at a time. Localized fields fall back to canonical English on the
 * backend; slugs are English at every locale.
 *
 * Wired to the live tour (`GET /tours/slug/:slug`):
 *   - reusable breadcrumb (flat `Home › {Destination} › {Tour}` - master §9,
 *     hub/category anchor added once related-entity resolution lands)
 *   - title + header band (node 47936:3370): H1, rating / locals' favorite /
 *     location meta, Save / Share pills
 *
 * Still on MOCK data (wired in later steps): gallery images/meta, review cards,
 * overview, inclusions/exclusions, itinerary, meeting, info, cancellation,
 * related tours.
 */

// Last-resort gallery fallback: a LIVE tour is expected to carry images, but the
// gallery must never receive an empty set (its mobile slider indexes image[0]),
// so an image-less tour falls back to these placeholders.
const FALLBACK_GALLERY_IMAGES = [
    '/images/tours/tour-1-1.jpg',
    '/images/tours/tour-1-2.jpg',
    '/images/tours/tour-1-3.jpg',
    '/images/tours/tour-2-1.jpg',
    '/images/tours/tour-2-3.jpg',
];

/**
 * Compact language pill from ISO 639-1 codes: "EN", "EN, NL", "EN, NL, +2".
 * (The gallery meta strip, Figma node 47940:12742.)
 */
function formatLanguageCodes(codes: string[]): string {
    const upper = codes.map(c => c.toUpperCase());
    if (upper.length <= 2) return upper.join(', ');
    return `${upper.slice(0, 2).join(', ')}, +${upper.length - 2}`;
}

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

// Overview section content (Figma node 47936:3606) - placeholder editorial copy
// until the tour-by-slug API returns the localized overview / local tip.
const MOCK_OVERVIEW = {
    intro: "The boat trip locals tell their friends to book. You'll sail the south coast on the original Klein Curaçao yacht with a crew that's been running this route for 40 years they know exactly where the turtles are and which reef has the best visibility this week.",
    highlights: [
        'Reach Klein Curaçao in 1h15',
        'Snorkel with sea turtles',
        'BBQ lunch and drinks',
        'Private beach house & shower',
        'Max 30 travelers - never crowded',
    ],
    // Tip line 1 is full strength; line 2 (subtext) is the same colour at 60%.
    tipTitle: 'Book the morning departure',
    tipBody: 'Afternoon wind picks up and the water gets choppier.',
};

// "What's Included" section (Figma node 47936:3621) - two columns: included
// (green check) and not included / add-ons (orange cross). Placeholder until the
// tour-by-slug API returns inclusions/exclusions.
const MOCK_INCLUDED = [
    'Round-trip yacht',
    'BBQ lunch & drinks',
    'Snorkel gear',
    'Captain & crew',
    'Bottled water',
    'Towels',
];
const MOCK_EXCLUDED = [
    'Hotel transfer (available - from $17 pp)',
    'Massage on board (available - $50)',
    'Scuba dive (available - $80)',
    'Alcoholic beverages (pay on the day)',
    'WiFi on board',
    'Outside food & drinks not permitted',
];

// "What to Expect" section (Figma node 47936:3707) - intro + a numbered timeline.
// Placeholder until the tour-by-slug API returns the itinerary.
const MOCK_EXPECT = {
    intro: 'The Miss Ann sets sail from Spanish Water Marina at 8:30 AM. Over 8 hours, Captain Mike guides you through three remote snorkel spots, with BBQ lunch on a private Klein Curaçao beach in between.',
    steps: [
        {
            title: 'Departure from Spanish Water Marina - 8:30 AM',
            detail: "Captain's welcome with breakfast pastries and rum punch",
        },
        {
            title: 'Snorkel stop at Tugboat Reef - 9:30 AM',
            detail: 'Three coves with green turtles and parrotfish',
        },
        {
            title: 'BBQ lunch on Klein Curaçao beach - 11:30 AM',
            detail: 'Grilled mahi-mahi, fresh salads, and unlimited drinks',
        },
        {
            title: 'Beach time & lighthouse walk - 1:00 PM',
            detail: 'Free time to swim or walk the abandoned lighthouse path',
        },
        {
            title: 'Return sail to Curaçao - 3:00 PM',
            detail: 'Drinks on the way back, arriving in marina around 4:30 PM',
        },
    ],
};

// "Meeting & Pickup" section (Figma node 47936:3746) - placeholder until the
// tour-by-slug API returns the meeting point / pickup / departure details.
const MOCK_MEETING = {
    meeting: {
        label: 'MEETING POINT',
        title: 'Spanish Water Marina',
        detail: 'Caracasbaaiweg 1, Willemstad, Curaçao',
    },
    mapLink: {
        label: 'Open in Google Maps',
        href: 'https://www.google.com/maps/search/?api=1&query=Spanish+Water+Marina+Cura%C3%A7ao',
    },
    pickup: {
        label: 'HOTEL PICKUP (OPTIONAL)',
        title: 'Available from select Willemstad hotels',
        detail: '7:45-8:15 AM window\nConfirm pickup location at booking',
    },
    departure: {
        label: 'DEPARTURE TIME',
        title: '8:30 AM',
        detail: 'Please arrive 15 minutes early for check-in',
    },
};

// "Important Info" section (Figma node 47936:3779) - labeled bulleted lists.
// Placeholder until the tour-by-slug API returns notSuitableFor / knowBeforeYouGo
// / whatToBring.
const MOCK_INFO_GROUPS = [
    {
        title: 'Not suitable for (conditional)',
        items: [
            'Minimum age 8 years; younger children cannot board the vessel',
            'Not suitable for pregnant guests in 2nd or 3rd trimester',
            'Moderate swimming ability recommended (life vests provided for non-swimmers)',
        ],
    },
    {
        title: 'Know before you go',
        items: [
            'Wheelchair-accessible vessel via boarding ramp at Spanish Water marina',
            'Weather-dependent - captain confirms 24h in advance if rescheduling required',
            'Small group, max 12 travelers',
            'Captain speaks English, Dutch, and Papiamentu',
            'Vegetarian and pescatarian options with 48h advance notice',
            'Snorkel masks included: bring your own if you prefer',
            'No outside food or alcoholic beverages on board',
            'No glass containers on board',
            'Route may adjust based on sea conditions',
        ],
    },
    {
        title: 'What to bring',
        items: [
            'Reef-safe sunscreen - protects coral and protects your skin',
            'Cash for tips (optional)',
        ],
    },
];

// "Cancellation Policy" section (Figma node 47936:3794) - placeholder until the
// tour-by-slug API returns the cancellation window + operator.
const MOCK_CANCELLATION = {
    title: 'Plans change. No problem.',
    body: "Free cancellation up to 48 hours before your tour starts. Full refund, no forms, no questions asked.\n\nIf you cancel less than 48 hours before the tour start time, unfortunately we can't refund or change the booking",
    // "Supplied by" is muted; the operator name is dark.
    suppliedByPrefix: 'Supplied by',
    operatorName: 'Miss Ann',
};

// Full "Reviews" section (Figma node 47936:3804) - placeholder until the reviews
// module + tour-by-slug API are wired.
const MOCK_REVIEW_SUMMARY = {
    rating: 4.8,
    reviewCount: 47,
    histogram: [
        { stars: 5, count: 38 },
        { stars: 4, count: 7 },
        { stars: 3, count: 2 },
        { stars: 2, count: 0 },
        { stars: 1, count: 0 },
    ],
    photoCount: 9,
};
const MOCK_FULL_REVIEWS: FullReview[] = [
    {
        id: 'fr-1',
        rating: 5,
        name: 'Lina N.',
        date: 'March 12, 2026',
        text: 'Easily the best day of our trip. Captain Mike knew every reef and we swam with three green turtles at the first stop. The BBQ lunch on the beach was fresh and generous, and the whole crew made it feel personal rather than packaged.',
        photos: 3,
        response: {
            text: "Thank you, Lina! Glad you enjoyed Director's Bay. Hope to welcome you back soon.",
            name: 'Miss Ann',
            date: 'March 14, 2026',
        },
    },
    {
        id: 'fr-2',
        rating: 5,
        name: 'Marco R.',
        date: 'March 8, 2026',
        text: 'Perfectly organised from pickup to drop-off. The snorkel gear was in great condition and the crossing was smooth. Worth booking the morning departure as recommended - calm water and no crowds at the reef.',
    },
    {
        id: 'fr-3',
        rating: 5,
        name: 'Sophie L.',
        date: 'March 5, 2026',
        text: 'A relaxed, beautiful day on the water. Small group so it never felt crowded, and the unlimited drinks on the sail back were a nice touch. Would happily do it again.',
    },
];

// Related tours (Figma node 47936:3964) - "More {category} tours in
// {destination}" + "More to explore in {destination}". Placeholder card sets
// (href built at render from locale + destination + slug).
const MOCK_SIMILAR_TOURS: TourListing[] = [
    {
        id: 'rel-1',
        images: ['/images/tours/tour-2-1.jpg', '/images/tours/tour-2-3.jpg'],
        badge: 'mostPopular',
        rating: 4.9,
        reviewCount: 642,
        title: 'Tugboat & Reef Snorkel with Small Group',
        duration: '3 hours',
        pickupAvailable: true,
        price: 55,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'rel-2',
        images: ['/images/tours/tour-5-1.jpg', '/images/tours/tour-3-2.jpg'],
        badge: null,
        rating: 4.7,
        reviewCount: 318,
        title: 'Mushroom Forest & Blue Room Cave Snorkel',
        duration: '4 hours',
        pickupAvailable: true,
        price: 69,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'rel-3',
        images: ['/images/tours/tour-3-1.jpg', '/images/tours/tour-3-3.jpg'],
        badge: 'likelyToSellOut',
        rating: 4.8,
        reviewCount: 1204,
        title: 'Sunset Snorkel & Turtle Encounter at Playa Piskado',
        duration: '2.5 hours',
        pickupAvailable: false,
        price: 49,
        priceUnit: 'per',
        freeCancellation: true,
    },
];
const MOCK_MORE_TOURS: TourListing[] = [
    {
        id: 'more-1',
        images: ['/images/tours/tour-4-1.jpg', '/images/tours/tour-4-2.jpg'],
        badge: 'new',
        rating: 4.9,
        reviewCount: 89,
        title: 'Private Yacht Charter with Custom Itinerary',
        duration: 'Full day',
        pickupAvailable: true,
        price: 1200,
        priceUnit: 'perGroup',
        freeCancellation: true,
    },
    {
        id: 'more-2',
        images: ['/images/tours/tour-6-1.jpg', '/images/tours/tour-6-3.jpg'],
        badge: null,
        rating: 4.8,
        reviewCount: 530,
        title: 'Christoffel National Park Sunrise Hike',
        duration: '5 hours',
        pickupAvailable: true,
        price: 75,
        priceUnit: 'per',
        freeCancellation: false,
    },
    {
        id: 'more-3',
        images: ['/images/tours/tour-1-1.jpg', '/images/tours/tour-1-3.jpg'],
        badge: null,
        rating: 4.7,
        reviewCount: 411,
        title: 'Willemstad Food & Culture Walking Tour',
        duration: '3 hours',
        pickupAvailable: false,
        price: 42,
        priceUnit: 'per',
        freeCancellation: true,
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
    const detail = await getTourBySlug({ slug, destinationSlug, locale });
    if (!detail) notFound();

    const tourDict = dict.destination.tour;

    // Live header / breadcrumb / title values (localized with EN fallback applied
    // server-side). `title` prefers the localized translation, then the canonical
    // name; `breadcrumbLabel` is the shorter English crumb, falling back to title.
    const title = detail.translation?.title ?? detail.name;
    const breadcrumbLabel = detail.breadcrumbLabel ?? title;
    const rating = detail.aggregateRating;
    const reviewCount = detail.aggregateReviewCount;
    const isLocalsFavourite = detail.isLocalsFavourite;
    const locationLabel = detail.departureCity
        ? `${detail.departureCity}, ${destinationName}`
        : destinationName;
    // Breadcrumb variant (master §2.7): anchor on the tour's primary attachment.
    // The only relation flagged primary in the data model is the isPrimary
    // category (`TourCategory.isPrimary`), so a tour is category-anchored
    // (`Home › Destination › Category › Tour`) and falls back to flat when it has
    // no primary category. The hub-anchored variant is reserved for a primary-hub
    // attachment, which the schema doesn't express yet. The primary category of a
    // LIVE tour always appears in the destination's tour-gated category list (it
    // has ≥1 published tour - this one), so its crumb link never 404s.
    let anchor: BreadcrumbAnchor | null = null;
    if (detail.primaryCategoryId) {
        const categories = await getDestinationCategories(destinationSlug, locale);
        const primary = categories.find(c => c.id === detail.primaryCategoryId);
        if (primary) {
            anchor = {
                label: primary.name,
                href: `/${destinationSlug}/${primary.slug}`,
            };
        }
    }

    // Gallery (Figma node 47940:12742): live images in displayOrder (backend-
    // ordered), with a placeholder fallback so the slider never gets an empty set.
    const galleryImages =
        detail.images.length > 0
            ? detail.images.map(img => img.url)
            : FALLBACK_GALLERY_IMAGES;

    // Meta strip pills - only the applicable ones render (duration / pickup /
    // languages), all localized.
    const galleryMeta: TourGalleryMeta[] = [];
    const durationLabel = formatDuration(
        detail.durationMinutesFrom,
        detail.durationMinutesTo,
        dict.search,
    );
    if (durationLabel) {
        galleryMeta.push({ icon: '/icons/clock.svg', label: durationLabel });
    }
    if (detail.pickupModel !== 'NONE') {
        galleryMeta.push({
            icon: '/icons/car.svg',
            label: dict.destination.listings.pickupAvailable,
        });
    }
    if (detail.languages.length > 0) {
        galleryMeta.push({
            icon: '/icons/nav-globe.svg',
            label: formatLanguageCodes(detail.languages),
        });
    }

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

    // Link each related card to its flat tour URL (slug derived from the title
    // until the related-tours API is wired).
    const linkTours = (tours: TourListing[]) =>
        tours.map(t => ({
            ...t,
            href: localizeHref(locale, `/${destinationSlug}/${toSlug(t.title)}`),
        }));
    const primaryCategory = 'Snorkeling';

    return (
        <>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                anchor={anchor}
                dict={{
                    home: dict.destination.allTours.breadcrumb.home,
                    current: breadcrumbLabel,
                }}
            />
            <TourHeader
                title={title}
                rating={rating}
                reviewCount={reviewCount}
                isLocalsFavourite={isLocalsFavourite}
                locationLabel={locationLabel}
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
                                images={galleryImages}
                                title={title}
                                meta={galleryMeta}
                                showAllPhotosLabel={tourDict.showAllPhotos}
                            />
                            <TourReviews
                                rating={rating}
                                reviewCount={reviewCount}
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

            {/* Detail sections - sticky tab nav (Figma 47936:3592) + collapsible
                sections. Each section is separated by a hairline with 40px above
                and below (the gap-10 rhythm includes the separators). */}
            <section className='bg-it-white pb-16 md:pb-24'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10'>
                        <TourDetailTabs tabs={sectionTabs} />

                        {/* Content sections - left-aligned readable measure. */}
                        <div className='flex max-w-178.5 flex-col gap-10'>
                            <TourSection
                                id='tour-overview'
                                title={tourDict.sections.overview}>
                                <div className='flex flex-col gap-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    <p className='m-0'>{MOCK_OVERVIEW.intro}</p>
                                    <ul className='m-0 list-disc pl-5'>
                                        {MOCK_OVERVIEW.highlights.map(h => (
                                            <li key={h}>{h}</li>
                                        ))}
                                    </ul>
                                </div>
                                {/* Local tip callout - title full strength, body at 60%. */}
                                <div className='flex items-start gap-2 rounded-[8px] border border-it-primary/30 bg-it-primary/5 p-6'>
                                    <Image
                                        src='/icons/tip-bulb.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-6 shrink-0'
                                    />
                                    <p className='m-0 flex flex-col text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                        <span className='text-[#8b390e]'>{MOCK_OVERVIEW.tipTitle}</span>
                                        <span className='text-[#8b390e]/60'>{MOCK_OVERVIEW.tipBody}</span>
                                    </p>
                                </div>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            <TourSection
                                id='tour-included'
                                title={tourDict.sections.included}>
                                <div className='grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-0'>
                                    <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                        {MOCK_INCLUDED.map(item => (
                                            <li
                                                key={item}
                                                className='flex items-start gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                <Image
                                                    src='/icons/check-green.svg'
                                                    alt=''
                                                    width={20}
                                                    height={20}
                                                    className='size-5 shrink-0'
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                    <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                        {MOCK_EXCLUDED.map(item => (
                                            <li
                                                key={item}
                                                className='flex items-start gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                <Image
                                                    src='/icons/exclude-cross.svg'
                                                    alt=''
                                                    width={20}
                                                    height={20}
                                                    className='size-5 shrink-0'
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            <TourSection
                                id='tour-expect'
                                title={tourDict.sections.expect}>
                                <p className='m-0 max-w-172 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {MOCK_EXPECT.intro}
                                </p>
                                {/* Numbered timeline - orange step badges joined
                                    by a vertical connector. */}
                                <ol className='m-0 flex list-none flex-col p-0'>
                                    {MOCK_EXPECT.steps.map((step, i) => (
                                        <li
                                            key={step.title}
                                            className={`relative flex gap-4 ${
                                                i < MOCK_EXPECT.steps.length - 1 ? 'pb-8' : ''
                                            }`}>
                                            {i < MOCK_EXPECT.steps.length - 1 && (
                                                <span
                                                    aria-hidden='true'
                                                    className='absolute top-10 bottom-0 left-5 w-px -translate-x-1/2 bg-it-heading/15'
                                                />
                                            )}
                                            <span className='relative z-10 grid size-10 shrink-0 place-items-center rounded-it-full bg-it-primary font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                {i + 1}
                                            </span>
                                            <div className='flex flex-col gap-1 pt-1'>
                                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    {step.title}
                                                </span>
                                                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                    {step.detail}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            <TourSection
                                id='tour-meeting'
                                title={tourDict.sections.meeting}>
                                <TourMeetingCard
                                    meeting={MOCK_MEETING.meeting}
                                    mapLink={MOCK_MEETING.mapLink}
                                    pickup={MOCK_MEETING.pickup}
                                    departure={MOCK_MEETING.departure}
                                />
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            <TourSection
                                id='tour-info'
                                title={tourDict.sections.info}>
                                <div className='flex flex-col gap-6'>
                                    {MOCK_INFO_GROUPS.map(group => (
                                        <div
                                            key={group.title}
                                            className='flex flex-col gap-2'>
                                            <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {group.title}
                                            </h3>
                                            <ul className='m-0 list-disc pl-5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                {group.items.map(item => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            <TourSection
                                id='tour-cancellation'
                                title={tourDict.sections.cancellation}>
                                <div className='flex flex-col gap-4'>
                                    <div className='flex flex-col gap-2'>
                                        <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {MOCK_CANCELLATION.title}
                                        </h3>
                                        <p className='m-0 whitespace-pre-line text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                            {MOCK_CANCELLATION.body}
                                        </p>
                                    </div>
                                    <span className='self-end font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                        <span className='text-it-text-muted'>
                                            {MOCK_CANCELLATION.suppliedByPrefix}
                                        </span>{' '}
                                        <span className='text-it-heading'>
                                            {MOCK_CANCELLATION.operatorName}
                                        </span>
                                    </span>
                                </div>
                            </TourSection>

                            <div className='h-px w-full bg-it-heading/10' />

                            {/* Full reviews section - not collapsible. */}
                            <TourReviewsSection
                                rating={MOCK_REVIEW_SUMMARY.rating}
                                reviewCount={MOCK_REVIEW_SUMMARY.reviewCount}
                                histogram={MOCK_REVIEW_SUMMARY.histogram}
                                photoCount={MOCK_REVIEW_SUMMARY.photoCount}
                                reviews={MOCK_FULL_REVIEWS}
                                dict={{
                                    title: tourDict.sections.reviews,
                                    subtitle: 'Every review from a confirmed booking. No exceptions.',
                                    reviewsCount: '{count} reviews',
                                    sortBy: 'Sort by:',
                                    sortValue: 'Most recent',
                                    showMore: 'Show 10 more reviews',
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Related tours - reuses <TourCard> with the All Tours grid
                responsiveness (Figma node 47936:3964). */}
            <section className='it-section pt-0! bg-it-white'>
                <div className='it-container flex flex-col gap-16 md:gap-24'>
                    <TourRelatedSection
                        title={`More ${primaryCategory} tours in ${destinationName}`}
                        tours={linkTours(MOCK_SIMILAR_TOURS)}
                        dict={dict.destination.listings}
                    />
                    <TourRelatedSection
                        title={`More to explore in ${destinationName}`}
                        tours={linkTours(MOCK_MORE_TOURS)}
                        dict={dict.destination.listings}
                    />
                </div>
            </section>
        </>
    );
}
