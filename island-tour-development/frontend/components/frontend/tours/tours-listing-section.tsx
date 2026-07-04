import { connection } from 'next/server';

import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursListing } from '@/components/frontend/tours-listing';
import { EMPTY_FILTERS } from '@/components/frontend/tours-filter-modal';
import {
    getCategoryFacets,
    getDestinationCategories,
    getDestinationFacets,
    getDestinationTours,
} from '@/lib/api/public';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    filtersToTourQuery,
    parseToursFilters,
    PRICE_MAX,
} from '@/lib/tours/filters';
import { searchHitToListing } from '@/lib/tours/listing';

/**
 * Async, streamed listing of the All Tours page: the toolbar (filters / sort /
 * category pills) + the recommended-order, paginated, FILTERED tour grid. Marked
 * dynamic with `await connection()` so its `<Suspense>` skeleton streams under
 * Cache Components (the loaders stay cached). Filter + sort + page state all live
 * in the URL (`@/lib/tours/filters`); changing any of them re-renders this
 * section and streams the new result behind the same skeleton.
 */

// Tours per page; the backend paginates and returns the destination-wide total.
const TOURS_LIMIT = 12;

interface ListingSectionProps {
    destinationId: string;
    destination: string;
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<Record<string, string | string[] | undefined>>;
    /**
     * Category-page mode: the listing is scoped to this category (fixed by the
     * route). Its `subCategories` become the quick-filter pills - selecting them
     * narrows to those sub-categories, otherwise the whole category tree (parent +
     * subs) is shown. Omit on the All Tours page (free category multi-select).
     */
    lockedCategory?: {
        id: string;
        /** Category slug - used to fetch category-scoped facets. */
        slug: string;
        subCategories: { id: string; slug: string; name: string }[];
    };
}

export async function ToursListingSection({
    destinationId,
    destination,
    locale,
    dict,
    searchParams,
    lockedCategory,
}: ListingSectionProps) {
    await connection();

    // Faceted filters (price bounds + attribute sections). Category-scoped on the
    // category page, destination-wide on All Tours. Cheap cached call; a null
    // (backend down / unknown) falls back to static bounds + no attribute sections.
    const facets = lockedCategory
        ? await getCategoryFacets(destination, lockedCategory.slug)
        : await getDestinationFacets(destination);
    const priceMax =
        facets?.priceRange?.max != null
            ? Math.max(10, Math.ceil(facets.priceRange.max / 10) * 10)
            : PRICE_MAX;

    const filters = parseToursFilters(await searchParams, priceMax);

    // Resolve the pills + the backend `categoryIds` filter.
    //  - All Tours: pills = the destination's categories; the URL selection maps
    //    slug -> id (free multi-select).
    //  - Category page: pills = this category's sub-categories. Selected subs
    //    narrow the results; with none selected we show the whole tree
    //    (parent + all subs) so tours tagged on either level still appear.
    let filterCategories: FilterCategory[];
    let selectedCategories: string[];
    let categoryIds: string | undefined;
    let lockCategory: boolean;

    if (lockedCategory) {
        const subs = lockedCategory.subCategories;
        const subIdBySlug = new Map(subs.map(s => [s.slug, s.id]));
        selectedCategories = filters.categories.filter(slug =>
            subIdBySlug.has(slug),
        );
        const selectedSubIds = selectedCategories.map(
            slug => subIdBySlug.get(slug)!,
        );
        categoryIds =
            (selectedSubIds.length
                ? selectedSubIds
                : [lockedCategory.id, ...subs.map(s => s.id)]
            ).join(',') || undefined;
        filterCategories = subs.map(s => ({ label: s.name, slug: s.slug }));
        // No sub-categories -> nothing to select, so hide the pills row.
        lockCategory = subs.length === 0;
    } else {
        const categories = await getDestinationCategories(destination, locale);
        selectedCategories = filters.categories;
        categoryIds =
            filters.categories
                .map(slug => categories.find(c => c.slug === slug)?.id)
                .filter((id): id is string => Boolean(id))
                .join(',') || undefined;
        filterCategories = categories.map(category => ({
            label: category.name,
            slug: category.slug,
        }));
        lockCategory = false;
    }

    const query = filtersToTourQuery(filters, priceMax);
    const fetchPage = (p: number) =>
        getDestinationTours({
            destinationId,
            locale,
            limit: TOURS_LIMIT,
            page: p,
            categoryIds,
            attributes: filters.attributes,
            ...query,
        });

    let page = filters.page;
    let tourList = await fetchPage(page);
    const total = tourList.total;
    const pageCount = Math.max(1, Math.ceil(total / TOURS_LIMIT));

    // Out-of-range page (e.g. a hand-edited `?page=99`, or a page that no longer
    // exists after tightening a filter): clamp to the last page and refetch.
    if (page > pageCount) {
        page = pageCount;
        tourList = await fetchPage(page);
    }

    // Cards keep the backend order; searchHitToListing carries the badge + flat URL.
    const tours = tourList.data.map(hit =>
        searchHitToListing(hit, locale, dict.search),
    );

    return (
        <div className='flex flex-col gap-8'>
            <ToursFilterBar
                dict={dict.destination.allTours.toolbar}
                sortDict={dict.destination.allTours.sort}
                filterDict={dict.destination.allTours.filterModal}
                hasReviews
                categories={filterCategories}
                lockCategory={lockCategory}
                priceMax={priceMax}
                attributes={filters.attributes}
                shown={tours?.length}
                total={total}
                selectedCategories={selectedCategories}
                selectedDate={filters.date ?? undefined}
                guests={filters.guests}
                sort={filters.sort}
                activeFilters={{
                    ...EMPTY_FILTERS,
                    price: filters.price,
                    rating: filters.rating,
                    durations: filters.durations,
                    times: filters.timeOfDay,
                    cancellation: filters.cancellation,
                    pickupAvailable: filters.pickup,
                }}
            />

            <ToursListing
                tours={tours}
                dict={dict.destination.listings}
                pageCount={pageCount}
                currentPage={page}
            />
        </div>
    );
}
