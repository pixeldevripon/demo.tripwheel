import { CategoryPage } from '@/components/frontend/category/category-page';
import { CollectionPage } from '@/components/frontend/collection/collection-page';
import { HubPage } from '@/components/frontend/hub/hub-page';
import { TourPage } from '@/components/frontend/tour/tour-page';
import {
    getActiveCollectionsForDestination,
    getActiveDestinations,
    getCategoryBySlugForDestination,
    getCategoryPageContent,
    getCollectionPageContent,
    getCollectionRender,
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
    getHubPageContent,
    getHubRender,
} from '@/lib/api/public';
import { resolveSlug } from '@/lib/api/slug-registry';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { EntityPageSkeleton } from '@/components/frontend/skeletons/entity-page-skeleton';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Localized destination display name from the public cached loader. On a backend
 * 404 we fall back to a prettified slug rather than 404 - a successful slug
 * resolve already implies the destination is active (§5.10). A backend outage
 * throws (strict loader) and fails the render/revalidation instead.
 */
async function resolveDestinationName(
    destination: string,
    locale: Locale
): Promise<string> {
    const dest = await getDestinationBySlug(destination, locale);
    return (
        dest?.name ??
        destination.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    );
}

type PageParams = { locale: string; destination: string; slug: string };

const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/**
 * All LIVE tour slugs for a destination, paginated - the public listing DTO caps
 * `limit` at 100, so a single oversized request would 400 (and the soft loader
 * would silently turn that into ZERO prerendered tours). Page cap bounds the
 * build if a destination ever grows past 1000 tours; later tours just render on
 * demand.
 */
async function getAllTourSlugs(destinationId: string): Promise<string[]> {
    const slugs: string[] = [];
    const limit = 100;
    for (let page = 1; page <= 10; page++) {
        const res = await getDestinationTours({ destinationId, limit, page });
        slugs.push(...res.data.map(t => t.slug));
        if (slugs.length >= res.total || res.data.length < limit) break;
    }
    return slugs;
}

const LAUNCH_CATEGORY_SLUGS = [
    'boat-tours',
    'snorkeling',
    'scuba-diving',
    'sunset-cruises',
    'sightseeing-tours',
    'day-trips',
    'off-road-tours',
    'jet-ski',
    'parasailing',
    'water-sports',
    'fishing-trips',
    'nature-wildlife-tours',
    'hiking-tours',
    'adventure-tours',
    'cultural-tours',
    'food-tours',
    'attraction-tickets',
    'luxury-experiences',
    'workshops-classes',
];

/**
 * Prerender EVERY known slug under this route - categories, hubs, collections,
 * and tours - not just categories. On Vercel, only prerendered paths serve the
 * proper RSC flight payload to client navigations; on-demand paths were served
 * the cached HTML document instead, which forced the router into a full browser
 * reload on every tour-card click. Entities created after a deploy still render
 * on demand via the default `dynamicParams` (and get prerendered by the next
 * build). If the backend is unreachable at build this falls back to the static
 * launch list below.
 */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            const combos = await Promise.all(
                destinations.map(async d => {
                    const [cats, hubs, collections, tourSlugs] =
                        await Promise.all([
                            getDestinationCategories(d.slug, DEFAULT_LOCALE),
                            getDestinationHubs(d.slug, DEFAULT_LOCALE),
                            getActiveCollectionsForDestination(
                                d.slug,
                                DEFAULT_LOCALE
                            ),
                            getAllTourSlugs(d.id),
                        ]);
                    const slugs = [
                        ...cats.map(c => c.slug),
                        ...hubs.map(h => h.slug),
                        ...collections.map(c => c.slug),
                        ...tourSlugs,
                    ];
                    return slugs.map(slug => ({
                        destination: d.slug,
                        slug,
                    }));
                })
            );
            const flatCombos = combos.flat();
            if (flatCombos.length > 0) {
                return flatCombos;
            }
        }
    } catch {
        // Fallback if backend is unavailable during build
    }

    // Return permutations of launch destinations and categories
    const fallbackCombos: { destination: string; slug: string }[] = [];
    for (const destination of LAUNCH_DESTINATION_SLUGS) {
        for (const slug of LAUNCH_CATEGORY_SLUGS) {
            fallbackCombos.push({ destination, slug });
        }
        // Also add the reserved 'tours' slug and the seeded hub
        fallbackCombos.push({ destination, slug: 'tours' });
        if (destination === 'curacao') {
            fallbackCombos.push({ destination, slug: 'klein-curacao' });
        }
    }
    return fallbackCombos;
}

/**
 * Localized SEO metadata + hreflang. Slugs are identical across locales - only
 * the locale prefix changes - so every entity page emits an alternate for all 7
 * locales plus `x-default → English` (ROUTING-AND-RESOLUTION.md §9.2).
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<PageParams>;
}): Promise<Metadata> {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) return {};

    const resolution = await resolveSlug(destination, slug);
    if (!resolution) return {};

    const path = `/${destination}/${slug}`;
    const languages: Record<string, string> = {};
    for (const loc of ALL_LOCALES) languages[loc] = `/${loc}${path}`;
    languages['x-default'] = `/${DEFAULT_LOCALE}${path}`;

    const alternates = { canonical: `/${locale}${path}`, languages };

    if (resolution.entityType === 'CATEGORY' && resolution.entityId) {
        const [category, pageContent, destinationName] = await Promise.all([
            getCategoryBySlugForDestination(
                destination,
                slug,
                locale as Locale
            ),
            getCategoryPageContent(resolution.entityId, locale as Locale),
            resolveDestinationName(destination, locale as Locale),
        ]);
        if (!category) return { alternates };
        return {
            title:
                pageContent?.metaTitle ??
                `${category.name} in ${destinationName} | Island Tours`,
            description:
                pageContent?.metaDescription ?? category.overview ?? undefined,
            alternates,
        };
    }

    if (resolution.entityType === 'COLLECTION' && resolution.entityId) {
        const dest = await getDestinationBySlug(destination, locale as Locale);
        if (!dest) return { alternates };

        const [render, pageContent] = await Promise.all([
            getCollectionRender(slug, dest.id, locale as Locale),
            getCollectionPageContent(resolution.entityId, locale as Locale),
        ]);
        // Only PUBLISHED collections render; a null render (draft/404) emits just
        // the alternates so the page's own notFound() still governs the response.
        if (!render) return { alternates };

        return {
            title:
                pageContent?.metaTitle ??
                `${render.h1Override ?? render.name} | Island Tours`,
            description:
                pageContent?.metaDescription ?? render.overview ?? undefined,
            alternates,
        };
    }

    if (resolution.entityType === 'HUB' && resolution.entityId) {
        const dest = await getDestinationBySlug(destination, locale as Locale);
        if (!dest) return { alternates };

        const [render, pageContent] = await Promise.all([
            getHubRender(slug, dest.id, locale as Locale),
            getHubPageContent(resolution.entityId, locale as Locale),
        ]);
        // Only PUBLISHED hubs render; a null render (draft/404) emits just the
        // alternates so the page's own notFound() still governs the response.
        if (!render) return { alternates };

        return {
            title: pageContent?.metaTitle ?? `${render.hero.h1} | Island Tours`,
            description:
                pageContent?.metaDescription ??
                render.editorialLead ??
                undefined,
            alternates,
        };
    }

    return { alternates };
}

/**
 * Polymorphic entity route - `/{locale}/{destination}/{slug}/`.
 *
 * The `{slug}` segment is ambiguous (category | hub | collection | tour |
 * reserved). It is resolved via the slug registry, then dispatched to the
 * matching page component (ROUTING-AND-RESOLUTION.md §5.2).
 *
 * STREAMING SHAPE: the page itself awaits nothing but `params` and returns the
 * `<Suspense>` shell immediately - `<EntityDispatch>` does the slug resolution
 * behind the boundary. This keeps the resolver awaits out of the first paint:
 * on a cold path (new entity, expired cache entry) the visitor gets the
 * `EntityPageSkeleton` instantly and the content streams in, instead of the
 * click blocking until the backend answers. On prerendered paths the boundary
 * resolves at build time, so the baked page is unchanged.
 */
export default function EntityPage({
    params,
    searchParams,
}: {
    params: Promise<PageParams>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    return (
        <Suspense fallback={<EntityPageSkeleton />}>
            <EntityDispatch params={params} searchParams={searchParams} />
        </Suspense>
    );
}

/**
 * Resolves the ambiguous slug and renders the matching entity page. Runs behind
 * the page's `<Suspense>` boundary; the three lookups are independent
 * (registry, dictionary, destination name), so they run in parallel.
 *
 * CATEGORY / HUB / TOUR / COLLECTION branches are implemented. RESERVED `tours`
 * is normally served by the static `tours/` route; the redirect here is a
 * defensive fallback.
 */
async function EntityDispatch({
    params,
    searchParams,
}: {
    params: Promise<PageParams>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) notFound();

    const [resolution, dict, destinationName] = await Promise.all([
        resolveSlug(destination, slug),
        getDictionary(locale),
        resolveDestinationName(destination, locale),
    ]);

    // Tours are the flat catch-all entity: a slug the registry can't resolve is
    // treated as a TOUR, and `TourPage` fetches it by slug (`getTourBySlug`) and
    // 404s itself when the tour doesn't exist / isn't LIVE. So an unknown slug
    // still 404s - just one level down, inside the TOUR branch.
    const entityType = resolution?.entityType ?? 'TOUR';

    switch (entityType) {
        case 'CATEGORY':
            if (!resolution?.entityId) notFound();
            return (
                <CategoryPage
                    destinationSlug={destination}
                    categorySlug={slug}
                    categoryId={resolution.entityId}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                    searchParams={searchParams}
                />
            );

        case 'HUB':
            if (!resolution?.entityId) notFound();
            return (
                <HubPage
                    destinationSlug={destination}
                    hubSlug={slug}
                    hubId={resolution.entityId}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                />
            );

        case 'TOUR':
            // Flat resolution: the tour fetches by its slug, not entityId
            // (ROUTING-AND-RESOLUTION.md §5.2).
            return (
                <TourPage
                    destinationSlug={destination}
                    slug={slug}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                />
            );

        case 'RESERVED':
            redirect(localizeHref(locale, `/${destination}/tours`));

        case 'COLLECTION':
            if (!resolution?.entityId) notFound();
            return (
                <CollectionPage
                    destinationSlug={destination}
                    collectionSlug={slug}
                    collectionId={resolution.entityId}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                />
            );

        default:
            notFound();
    }
}

