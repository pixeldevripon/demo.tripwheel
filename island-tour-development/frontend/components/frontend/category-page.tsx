import { notFound } from 'next/navigation';
import { categoriesApi } from '@/lib/api/categories';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { DestinationAbout } from './destination-about';
import { FaqSection } from './faq-section';
import type { TourListing } from './tour-card';
import { ToursBreadcrumb } from './tours-breadcrumb';
import { ToursDatePill } from './tours-date-pill';
import {
    type FilterCategory,
    ToursFilterBar,
} from './tours-filter-bar';
import { ToursListing } from './tours-listing';
import { ToursTrustStrip } from './tours-trust-strip';

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
        images: ['/images/tours/tour-1-1.jpg', '/images/tours/tour-1-2.jpg', '/images/tours/tour-1-3.jpg'],
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
        images: ['/images/tours/tour-3-1.jpg', '/images/tours/tour-3-2.jpg', '/images/tours/tour-3-3.jpg'],
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
        images: ['/images/tours/tour-4-1.jpg', '/images/tours/tour-4-2.jpg', '/images/tours/tour-4-3.jpg'],
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
        images: ['/images/tours/tour-5-1.jpg', '/images/tours/tour-3-2.jpg', '/images/tours/tour-3-3.jpg'],
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
        images: ['/images/tours/tour-6-1.jpg', '/images/tours/tour-1-2.jpg', '/images/tours/tour-6-3.jpg'],
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
        categoriesApi.getBySlugForDestination(destinationSlug, categorySlug, locale),
        categoriesApi.getPageContent(categoryId, locale),
        categoriesApi.getFaqs(categoryId, locale),
        categoriesApi.getActiveByDestination(destinationSlug, locale).catch(() => []),
    ]);

    if (!category) notFound();

    const t = dict.destination.allTours;
    const total = category.publishedTourCount;

    // Heading: prefer the localized H1 override, else the (already localized) name.
    const heading = category.h1Override ?? category.name;
    const breadcrumbLabel = category.breadcrumbLabel ?? category.name;
    const count = t.heading.availableCount.replace('{count}', String(total));

    // Localized quick-filter pills; current category pinned + pre-selected.
    const filterCategories: FilterCategory[] = activeCategories.map((c) => ({
        label: c.name,
        slug: c.slug,
    }));
    const currentChip: FilterCategory = { label: category.name, slug: category.slug };

    // FAQs come from the backend (per locale); reuse the FAQ section chrome from
    // the dictionary and swap in the localized items. Hidden when there are none.
    const faqDict = {
        ...dict.home.faq,
        items: faqs.map((f) => ({ q: f.question, a: f.answer })),
    };

    return (
        <>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                dict={{ home: t.breadcrumb.home, current: breadcrumbLabel }}
            />

            <section className='bg-it-white pb-32.5'>
                <div className='it-container'>
                    <div className='flex flex-col max-md:gap-8 gap-10 pt-8 md:pt-15'>
                        {/* ── Category header (localized H1 + overview + count) ── */}
                        <div className='flex flex-col gap-4 md:gap-2'>
                            <div className='flex flex-col gap-2 md:gap-1'>
                                <h1 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                    {heading}
                                </h1>
                                {category.overview && (
                                    <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {category.overview}
                                    </p>
                                )}
                            </div>
                            <div className='flex items-center justify-between gap-2'>
                                <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    <span className='font-medium text-it-heading'>{count}</span>{' '}
                                    <span className='text-it-text-muted'>{t.heading.availableLabel}</span>
                                </p>
                                <ToursDatePill
                                    selectDateLabel={t.toolbar.selectDate}
                                    className='md:hidden'
                                />
                            </div>
                        </div>

                        <div className='h-px w-full bg-it-heading/10' aria-hidden='true' />

                        {/* ── Toolbar + grid ────────────────────────────────── */}
                        <div className='flex flex-col gap-8'>
                            <ToursFilterBar
                                dict={t.toolbar}
                                sortDict={t.sort}
                                filterDict={t.filterModal}
                                hasReviews
                                categories={filterCategories}
                                guestCount={2}
                                shown={Math.min(MOCK_TOURS.length, total)}
                                total={total}
                                initialSelected={[category.slug]}
                                initialChips={[currentChip]}
                            />

                            <ToursListing
                                tours={MOCK_TOURS}
                                dict={dict.destination.listings}
                                pageCount={Math.max(1, Math.ceil(total / MOCK_TOURS.length))}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <ToursTrustStrip dict={t.trust} />

            {/* Editorial "about" section — only when the locale has aboutText. */}
            {pageContent.aboutText && (
                <DestinationAbout
                    destinationName={destinationName}
                    dict={{ ...dict.destination.about, description: pageContent.aboutText }}
                />
            )}

            {/* Category FAQs (localized) — hidden when none exist for this locale. */}
            {faqs.length > 0 && <FaqSection dict={faqDict} />}
        </>
    );
}
