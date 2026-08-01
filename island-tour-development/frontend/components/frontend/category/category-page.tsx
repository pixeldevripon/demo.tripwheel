import { ToursListingSkeleton } from '@/components/frontend/skeletons/tours-page-skeleton';
import {
    getCategoryBySlugForDestination,
    getCategoryFaqs,
    getCategoryPageContent,
    getDestinationBySlug,
    getDestinationCategories,
} from '@/lib/api/public';
import { type Locale } from '@/lib/constants/locales';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { JsonLd } from '../seo/json-ld';
import { CategoryAbout } from './category-about';

import {
    CategoryYouMightLike,
    RelatedCategory,
} from '../category-you-might-like';
import { FaqSection } from '../faq-section';
import { ToursBreadcrumb } from '../tours/tours-breadcrumb';
import { ToursHeader } from '../tours/tours-header';
import { ToursListingSection } from '../tours/tours-listing-section';

/**
 * Category page - the CATEGORY branch of the polymorphic `[slug]` route
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
 *   - Slugs are English at every locale - the URL never changes per locale.
 */


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
    /** Route search params (forwarded unresolved so the shell stays prerenderable). */
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function CategoryPage({
    destinationSlug,
    categorySlug,
    categoryId,
    destinationName,
    locale,
    dict,
    searchParams,
}: CategoryPageProps) {
    // Fetch localized detail (gated), editorial content, FAQs, the active
    // categories (for related links) and the destination (for its id, used to
    // scope the dynamic listing) in parallel. The detail gate is authoritative -
    // a `null` means 0 published tours → notFound().
    const [category, pageContent, faqs, activeCategories, destination, siteUrl] =
        await Promise.all([
            getCategoryBySlugForDestination(
                destinationSlug,
                categorySlug,
                locale
            ),
            getCategoryPageContent(categoryId, locale),
            getCategoryFaqs(categoryId, locale),
            getDestinationCategories(destinationSlug, locale),
            getDestinationBySlug(destinationSlug, locale),
            getSiteUrl(),
        ]);

    if (!category) notFound();
    // The category belongs to a destination; a null here means the destination
    // lookup failed (backend down / stale slug). We cannot scope the tour listing
    // without its id, so 404 - same guard the collection page uses.
    if (!destination) notFound();

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

    const breadcrumbJsonLd = buildBreadcrumbJsonLd({
        siteUrl,
        locale,
        trail: [
            { name: destinationName, path: `/${destinationSlug}` },
            {
                name: breadcrumbLabel,
                path: `/${destinationSlug}/${categorySlug}`,
            },
        ],
    });

    // Subtitle: the category's own localized overview when authored, else the
    // generic promise. It used to be a hardcoded English sentence about boat
    // tours, which was untranslated everywhere and untrue for most categories.
    const subtitle = category.overview || dict.destination.categorySubtitle;

    // "You might also like" - sibling categories at this destination (current one
    // excluded), up to 3. Real data only: a category with no `heroImage` renders
    // the flat paper surface (no placeholder), and an empty set hides the section.
    const relatedCategories: RelatedCategory[] = activeCategories
        .filter(c => c.slug !== category.slug)
        .slice(0, 3)
        .map(c => ({
            name: c.name,
            slug: c.slug,
            image: c.heroImage ?? undefined,
            tours: c.publishedTourCount,
        }));

    // "About {category} in {destination}" editorial heading (Figma 47171:5647).
    const aboutTitle = dict.destination.categoryAboutTitle
        .replace('{category}', category.name)
        .replace('{destination}', destinationName);
    // Body copy from the backend; falls back to the shared island-level template
    // until this category's page content is authored. `||` so a cleared field
    // falls back too, and the substitution applies only to the bundled string.
    const aboutDescription =
        pageContent?.aboutText ||
        dict.destination.about.description.replaceAll(
            '{destination}',
            destinationName
        );

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
            <JsonLd data={breadcrumbJsonLd} />
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                dict={{ home: t.breadcrumb.home, current: breadcrumbLabel }}
            />

            <section className='bg-it-white'>
                {/* Page header (.pagehead) - the crumbs render above inside
                    the same container; the sticky filter row + grid stream in
                    below at FULL WIDTH (the toolbar owns its own containers,
                    so its sticky band can bleed edge to edge). */}
                <div className='it-container'>
                    {/* Category header - reuses the All-Tours heading with a
                        pre-resolved "{category} in {destination}" title and a
                        category-specific subtitle. */}
                    <ToursHeader
                        dict={t.heading}
                        destinationName={destinationName}
                        total={total}
                        title={heading}
                        subtitle={subtitle}
                    />
                </div>

                {/* ── Toolbar + grid ──────────────────────────────────
                    Streamed, URL-driven listing locked to this category
                    (reuses the All Tours section; toolbar hides category
                    selection since the route fixes it). The section fetches
                    real category-scoped tours and renders the shared empty
                    state (ToursEmptyState) when a filter combination or the
                    category itself yields no results. */}
                <Suspense fallback={<ToursListingSkeleton />}>
                    <ToursListingSection
                        destinationId={destination.id}
                        destination={destinationSlug}
                        locale={locale}
                        dict={dict}
                        searchParams={searchParams}
                        lockedCategory={{
                            id: categoryId,
                            slug: category.slug,
                            subCategories: category.subCategories,
                        }}
                    />
                </Suspense>
            </section>

            {/* "You might also like" - related sibling categories (v2 .relgrid). */}
            <CategoryYouMightLike
                title={dict.destination.youMightLike}
                items={relatedCategories}
                locale={locale}
                destinationSlug={destinationSlug}
                toursWord={dict.nav.tours}
            />

            {/* Editorial "about" section (Figma 47171:5647). */}
            <CategoryAbout
                title={aboutTitle}
                description={aboutDescription}
                learnMoreLabel={dict.destination.about.learnMore}
                readLessLabel={dict.destination.about.readLess}
            />

            {/* Category FAQs - title + accordion only (Figma 47070:2456). */}
            <FaqSection dict={faqDict} minimal />
        </>
    );
}

