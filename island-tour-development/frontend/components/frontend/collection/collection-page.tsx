import { getCollectionRender, getDestinationBySlug } from '@/lib/api/public';
import { type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { collectionTourToListing } from '@/lib/tours/listing';
import { notFound } from 'next/navigation';
import { CategoryYouMightLike } from '../category-you-might-like';
import { CollectionHero } from './collection-hero';
import { CollectionToursSection } from './collection-tours-section';
import { FaqSection } from '../faq-section';
import { ToursBreadcrumb } from '../tours/tours-breadcrumb';

/**
 * Collection page - the COLLECTION branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{collection-slug}/`).
 *
 * Fully backed by `GET /collections/render/:slug` (published-only, §10): it
 * returns the localized banner copy (eyebrow / curation note / H1 / overview),
 * the resolved ranked tours (MANUAL cards carry their per-locale rationale), fast
 * stats, FAQs, and up to 3 related collections in one round-trip. A draft /
 * inactive / unknown collection yields a null render → `notFound()`.
 */

interface CollectionPageProps {
    destinationSlug: string;
    collectionSlug: string;
    /** Collection id from the slug-registry resolution (unused: render keys on slug + destinationId). */
    collectionId: string;
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export async function CollectionPage({
    destinationSlug,
    collectionSlug,
    destinationName,
    locale,
    dict,
}: CollectionPageProps) {
    // The render endpoint keys on the destination UUID, so resolve the destination
    // first, then fetch the full collection payload for this locale.
    const destination = await getDestinationBySlug(destinationSlug, locale);
    const collection = destination
        ? await getCollectionRender(collectionSlug, destination.id, locale)
        : null;

    if (!collection) notFound();

    const listings = dict.destination.listings;
    const collectionDict = dict.destination.collections;

    const breadcrumbLabel = collection.breadcrumbLabel ?? collection.name;
    const heading = collection.h1Override ?? collection.name;

    // Collection cards are ALWAYS rendered as a numbered ranked list (Top 10 /
    // Best Things to Do). Order is the product (master 5.6); each card's blurb is
    // its rationale (MANUAL) or the tour's own overview (DYNAMIC, Option 1).
    const tours = collection.tours.map((tour, index) =>
        collectionTourToListing(tour, destinationSlug, locale, dict.search, index + 1)
    );

    // FAQs come from the render (per locale); fall back to the localized collection
    // FAQ chrome when none are authored yet.
    const faqItems =
        collection.faqs.length > 0
            ? collection.faqs.map(f => ({ q: f.question, a: f.answer }))
            : undefined;

    // "Keep exploring" - real sibling collections (current one already excluded by
    // the backend), each linking to its flat collection URL.
    const relatedItems = collection.relatedCollections.map(c => ({
        name: c.name,
        slug: c.slug,
        image: c.heroImage ?? undefined,
    }));
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
                dict={{ home: dict.destination.allTours.breadcrumb.home, current: breadcrumbLabel }}
            />

            {/* Full-width hero - Figma 47433-2069 */}
            <CollectionHero
                title={heading}
                eyebrow={collection.eyebrowLabel}
                subtitle={collection.curationNote}
                heroImage={collection.heroImage}
                tourCount={collection.fastStats.tourCount}
                startingPrice={collection.fastStats.fromPrice}
                dict={{
                    tours: collectionDict?.tours ?? 'tours',
                    from: listings?.from ?? 'From',
                    share: collectionDict?.share ?? 'Share',
                }}
            />

            {/* Ranked tour grid - Figma 47433:2088 */}
            <CollectionToursSection
                intro={collection.overview ?? ''}
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
                    perBoat: listings.perBoat,
                    perVehicle: listings.perVehicle,
                    perAircraft: listings.perAircraft,
                    perPackage: listings.perPackage,
                }}
            />

            {/* FAQ - reuses the shared <FaqSection>; chrome from the localized
                home.faq + collection.faq, with real per-locale questions when
                authored (Figma 47433:2306). */}
            <FaqSection
                dict={{
                    ...dict.home.faq,
                    ...collectionDict.faq,
                    ...(faqItems ? { items: faqItems } : {}),
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
