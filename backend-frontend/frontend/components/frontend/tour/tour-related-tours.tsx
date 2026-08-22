import { connection } from 'next/server';
import { type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import { getTourBySlug, getDestinationTours } from '@/lib/api/public/tours';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { searchHitToListing } from '@/lib/tours/listing';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { TourRelatedSection } from './tour-related-section';

interface TourRelatedToursProps {
    destinationSlug: string;
    slug: string;
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

/**
 * Related tours (Figma node 47936:3964). Two grids scoped to this destination,
 * both excluding the current tour: same primary category ("More {category} in
 * {destination}") and destination-wide ("More to explore in {destination}"), the
 * latter also dropping any tour already shown in the first.
 *
 * The category heading interpolates the name and nothing else. Every category on
 * the platform is already a complete noun phrase in every locale - "Boat Tours &
 * Cruises", "Bootstouren & Kreuzfahrten", "Water Sports" - so a template that
 * appended its own noun produced "More Boat Tours & Cruises tours in Curacao"
 * (Pastel #40). Do not reintroduce one, and do not try to decide per-category by
 * looking for the word "tours" in the name: it is the English word, and the name
 * arriving here is translated.
 *
 * `await connection()` marks it dynamic so its `<Suspense>` skeleton streams under
 * Cache Components (the data loaders stay cached). Reuses the cached
 * `getTourBySlug` (deduped with the main content) to get the tour's ids. Renders
 * nothing when both grids are empty.
 */
export async function TourRelatedTours({
    destinationSlug,
    slug,
    destinationName,
    locale,
    dict,
}: TourRelatedToursProps) {
    await connection();
    // Resolve the shopper currency first, then fetch the detail WITH it so this
    // `getTourBySlug` shares a cache key with the main content's currency-aware
    // fetch (dedup); the related listings below reuse the same currency.
    const currency = await getServerCurrency(locale);
    const detail = await getTourBySlug({
        slug,
        destinationSlug,
        locale,
        currency,
    });
    if (!detail) return null;

    // Localized primary-category name for the same-category grid's heading.
    let primaryCategoryName: string | null = null;
    if (detail.primaryCategoryId) {
        const categories = await getDestinationCategories(
            destinationSlug,
            locale
        );
        primaryCategoryName =
            categories.find(c => c.id === detail.primaryCategoryId)?.name ??
            null;
    }

    // Fetch a few extra per grid to absorb the self-exclusion, then slice.
    const RELATED_COUNT = 3;
    const [similarRes, moreRes] = await Promise.all([
        detail.primaryCategoryId
            ? getDestinationTours({
                  destinationId: detail.destinationId,
                  categoryId: detail.primaryCategoryId,
                  locale,
                  currency,
                  sort: 'recommended',
                  limit: RELATED_COUNT + 4,
              })
            : null,
        getDestinationTours({
            destinationId: detail.destinationId,
            locale,
            currency,
            sort: 'recommended',
            limit: RELATED_COUNT + 8,
        }),
    ]);
    // A category we cannot name cannot head a grid - the heading would render
    // with a hole where the name belongs. This is reachable: the category list
    // only carries categories gated in at >= 3 published tours, so a tour whose
    // primary category has one or two is simply absent from it. Nothing is lost
    // by dropping the grid; those tours fall through to the destination-wide one
    // below, which no longer excludes them.
    const similarTours = primaryCategoryName
        ? (similarRes?.data ?? [])
              .filter(hit => hit.id !== detail.id)
              .slice(0, RELATED_COUNT)
              .map(hit => searchHitToListing(hit, locale, dict.search))
        : [];
    const shownSimilarIds = new Set(similarTours.map(t => t.id));
    const moreTours = moreRes.data
        .filter(hit => hit.id !== detail.id && !shownSimilarIds.has(hit.id))
        .slice(0, RELATED_COUNT)
        .map(hit => searchHitToListing(hit, locale, dict.search));

    if (similarTours.length === 0 && moreTours.length === 0) return null;

    const tourDict = dict.destination.tour;
    const similarTitle = tourDict.related.moreInCategory
        .replace('{category}', primaryCategoryName ?? '')
        .replace('{destination}', destinationName);
    const moreTitle = tourDict.related.moreToExplore.replace(
        '{destination}',
        destinationName
    );

    // `max-md:gap-[42px]` matches the seam every other section pair gets on
    // mobile (the stack's 34px plus the 8px `TourSection` adds). At the plain
    // 32px this pair was the tightest join on the phone page, and a row of
    // cards running straight into the next heading reads as one list
    // (Pastel #34). Desktop keeps 32px.
    return (
        <div className='flex flex-col gap-8 pt-8.5 max-md:gap-12.5'>
            <TourRelatedSection
                title={similarTitle}
                tours={similarTours}
                dict={dict.destination.listings}
            />
            <TourRelatedSection
                title={moreTitle}
                tours={moreTours}
                dict={dict.destination.listings}
            />
        </div>
    );
}
