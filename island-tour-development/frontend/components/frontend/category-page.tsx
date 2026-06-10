import { FILTER_CATEGORIES } from '@/app/(frontend)/[locale]/[destination]/tours/page';
import { categoriesApi } from '@/lib/api/categories';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';
import { CategoryAbout } from './category-about';
import { CategoryFilterBar } from './category-filter-bar';
import { CategoryTrustStrip } from './category-trust-strip';
import {
    CategoryYouMightLike,
    type RelatedCategory,
} from './category-you-might-like';
import { FaqSection } from './faq-section';
import type { TourListing } from './tour-card';
import { ToursBreadcrumb } from './tours-breadcrumb';
import { type FilterCategory, ToursFilterBar } from './tours-filter-bar';
import { ToursHeader } from './tours-header';
import { ToursListing } from './tours-listing';

/**
 * Category page — the CATEGORY branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{category}/`).
 *
 * A category page is a destination-scoped, category-filtered tour listing, so it
 * reuses the exact All-Tours layout (breadcrumb → header → filter bar → grid →
 * trust strip) and adds the category's editorial content (about + FAQs).
 *
 * Multilingual + slug-registry contract (MULTILINGUAL-CONTENT.md §4.8,
 * ROUTING-AND-RESOLUTION.md §5.2):
 *   - The localized detail is fetched per `locale`; missing fields fall back to
 *     the canonical English value on the backend (`name` always resolved).
 *   - The detail endpoint gates on `publishedTourCount > 0` (Stage-3 gating);
 *     a 404 here renders `notFound()`.
 *   - Slugs are English at every locale — the URL never changes per locale.
 */

// Tour grid mock — placeholder until the category-filtered trips API is wired
// (matches the convention used by the destination + all-tours pages). The
// backend gating guarantees ≥1 published tour, so the grid is never empty.
const MOCK_TOURS: TourListing[] = [
    {
        id: 'c-1',
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
        id: 'c-2',
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
        id: 'c-3',
        images: [
            '/images/tours/tour-3-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
        ],
        badge: 'mostPopular',
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
        id: 'c-4',
        images: [
            '/images/tours/tour-4-1.jpg',
            '/images/tours/tour-4-2.jpg',
            '/images/tours/tour-4-3.jpg',
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
        id: 'c-5',
        images: [
            '/images/tours/tour-5-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
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
    {
        id: 'c-6',
        images: [
            '/images/tours/tour-6-1.jpg',
            '/images/tours/tour-1-2.jpg',
            '/images/tours/tour-6-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Off-Road Buggy Adventure across the rugged north coast',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
];

// "You might also like" card imagery. Used directly for the placeholder set
// (when the backend returns no siblings) and as a per-card fallback when a real
// sibling category has no `heroImage` yet — so every card always shows an image.
const RELATED_IMAGES = [
    '/images/home-page/categories/catamaran-trips.jpg',
    '/images/home-page/categories/snorkel-trips.jpg',
    '/images/home-page/islands/curacao.jpg',
];
const FALLBACK_RELATED: RelatedCategory[] = [
    {
        name: 'Sunset Cruises',
        slug: 'sunset-cruises',
        image: RELATED_IMAGES[0],
    },
    { name: 'Snorkelling', slug: 'snorkeling', image: RELATED_IMAGES[1] },
    {
        name: 'Dolphin Experience',
        slug: 'dolphin-experience',
        image: RELATED_IMAGES[2],
    },
];

// Quick-filter pills for the secondary "active tours" listing block (Figma
// 47171:1499) — distinct from the top listing's FILTER_CATEGORIES. Placeholder
// until the per-attribute filter API is wired.
const SECONDARY_FILTER_CATEGORIES: FilterCategory[] = [
    { label: 'Catamaran', slug: 'catamaran' },
    { label: 'Speedboat', slug: 'speedboat' },
    { label: 'Sailing boat', slug: 'sailing-boat' },
    { label: 'Sunset Cruises', slug: 'sunset-cruises' },
    { label: 'Buggy Tours', slug: 'buggy-tours' },
    { label: 'Under €100 (21)', slug: 'under-100' },
];

interface CategoryPageProps {
    /** Destination slug from the URL (e.g. `curacao`). */
    destinationSlug: string;
    /** Resolved category slug from the URL (e.g. `boat-tours`). */
    categorySlug: string;
    /** Category id from the slug-registry resolution (`entityId`). */
    categoryId: string;
    /** Proper-noun destination display name (resolved by the route). */
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export async function CategoryPage({
    destinationSlug,
    categorySlug,
    categoryId,
    destinationName,
    locale,
    dict,
}: CategoryPageProps) {
    // Fetch localized detail (gated), editorial content, FAQs, and the active
    // categories (for the localized quick-filter pills) in parallel. The detail
    // gate is authoritative — a `null` means 0 published tours → notFound().
    const [category, pageContent, faqs, activeCategories] = await Promise.all([
        categoriesApi.getBySlugForDestination(
            destinationSlug,
            categorySlug,
            locale
        ),
        categoriesApi.getPageContent(categoryId, locale),
        categoriesApi.getFaqs(categoryId, locale),
        categoriesApi
            .getActiveByDestination(destinationSlug, locale)
            .catch(() => []),
    ]);

    if (!category) notFound();

    const t = dict.destination.allTours;
    const total = category.publishedTourCount;

    // Heading: prefer the localized H1 override, else the localized
    // "{category} in {destination}" pattern (Figma category header).
    const heading =
        category.h1Override ??
        t.heading.categoryTitle
            .replace('{category}', category.name)
            .replace('{destination}', destinationName);
    const breadcrumbLabel = category.breadcrumbLabel ?? category.name;

    const currentChip: FilterCategory = {
        label: category.name,
        slug: category.slug,
    };

    // "You might also like" — sibling categories at this destination (current one
    // excluded), up to 3. Falls back to the placeholder set until the backend
    // returns siblings.
    const relatedFromApi: RelatedCategory[] = activeCategories
        .filter(c => c.slug !== category.slug)
        .slice(0, 3)
        .map((c, i) => ({
            name: c.name,
            slug: c.slug,
            image: c.heroImage ?? RELATED_IMAGES[i % RELATED_IMAGES.length],
        }));
    const relatedCategories =
        relatedFromApi.length > 0 ? relatedFromApi : FALLBACK_RELATED;

    // "About {category} in {destination}" editorial heading (Figma 47171:5647).
    const aboutTitle = dict.destination.categoryAboutTitle
        .replace('{category}', category.name)
        .replace('{destination}', destinationName);
    // Body copy from the backend; falls back to the localized placeholder until
    // category page-content is authored (mirrors the MOCK_TOURS convention).
    const aboutDescription =
        pageContent.aboutText ?? dict.destination.about.description;

    // FAQs come from the backend (per locale); reuse the FAQ accordion chrome and
    // swap in the localized items + the "Frequently asked questions" title. Falls
    // back to the placeholder items until category FAQs are authored.
    const faqItems =
        faqs.length > 0
            ? faqs.map(f => ({ q: f.question, a: f.answer }))
            : dict.home.faq.items;
    const faqDict = {
        ...dict.home.faq,
        title: dict.destination.faqTitle,
        items: faqItems,
    };

    return (
        <>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                dict={{ home: t.breadcrumb.home, current: breadcrumbLabel }}
            />

            <section className='bg-it-white pb-17.5 md:pb-32.5'>
                <div className='it-container'>
                    {/* Content stack — 60px below the breadcrumb, 40px between blocks. */}
                    <div className='flex flex-col max-md:gap-8 gap-10 pt-8 md:pt-15'>
                        {/* Category header — reuses the All-Tours heading with a
                            pre-resolved "{category} in {destination}" title and a
                            category-specific subtitle. */}
                        <ToursHeader
                            dict={t.heading}
                            destinationName={destinationName}
                            total={total}
                            selectDateLabel={t.toolbar.selectDate}
                            title={heading}
                            subtitle='Most boat tours offer free cancellation up to 48h before'
                        />

                        <div
                            className='h-px w-full bg-it-heading/10'
                            aria-hidden='true'
                        />

                        {/* ── Toolbar + grid ────────────────────────────────── */}
                        <div className='flex flex-col gap-8'>
                            <ToursFilterBar
                                dict={t.toolbar}
                                sortDict={t.sort}
                                filterDict={t.filterModal}
                                hasReviews
                                categories={FILTER_CATEGORIES}
                                guestCount={2}
                                shown={Math.min(MOCK_TOURS.length, total)}
                                total={total}
                                initialSelected={[category.slug]}
                                initialChips={[currentChip]}
                            />

                            <ToursListing
                                tours={MOCK_TOURS}
                                dict={dict.destination.listings}
                                pageCount={6}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* "You might also like" — related sibling categories (Figma 47070:2238). */}
            <CategoryYouMightLike
                title={dict.destination.youMightLike}
                items={relatedCategories}
                locale={locale}
                destinationSlug={destinationSlug}
            />

            {/* ── Big section (Figma 47171:1499): trust strip + a second
                "active tours" header/filter/listing block. ── */}
            <section className='it-section max-md:pt-8! pb-[32px]! md:pb-[56px]! bg-it-white'>
                <div className='it-container'>
                    {/* 56px between the header/filter block and the grid. */}
                    <div className='flex flex-col gap-14'>
                        {/* 40px between the trust strip and the header/filter. */}
                        <div className='flex flex-col max-md:-mb-4 gap-10'>
                            <CategoryTrustStrip
                                dict={dict.destination.categoryTrust}
                            />

                            {/* Header + filter toolbar (Figma 2147227767) — 24px mobile / 40px md+. */}
                            <div className='flex flex-col gap-6 md:gap-10'>
                                <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                    Boat tours active
                                </h2>
                                <CategoryFilterBar
                                    dict={dict.destination.categoryFilter}
                                    filterDict={t.filterModal}
                                    categories={SECONDARY_FILTER_CATEGORIES}
                                />
                            </div>
                        </div>

                        {/* Listing grid — 6 cards, no pagination (Figma 2147227769). */}
                        <ToursListing
                            tours={MOCK_TOURS}
                            dict={dict.destination.listings}
                            pageCount={1}
                        />
                    </div>
                </div>
            </section>

            {/* Editorial "about" section (Figma 47171:5647). */}
            <CategoryAbout
                title={aboutTitle}
                description={aboutDescription}
                learnMoreLabel={dict.destination.about.learnMore}
                readLessLabel='Read Less'
            />

            {/* Category FAQs — title + accordion only (Figma 47070:2456). */}
            <FaqSection dict={faqDict} minimal />
        </>
    );
}


