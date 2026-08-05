import { twitterCard } from '@/lib/seo/twitter-card';
import { LAUNCH_DESTINATION_SLUGS } from '@/lib/constants/locales';
import { CategoryPage } from '@/components/frontend/category/category-page';
import { CollectionPage } from '@/components/frontend/collection/collection-page';
import { HubPage } from '@/components/frontend/hub/hub-page';
import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { PageBody } from '@/components/frontend/legal/page-body';
import { TourPage } from '@/components/frontend/tour/tour-page';
import {
    filterIndexableImages,
    getMediaSeo,
    normalizeUrl,
    getActiveCollectionsForDestination,
    getActiveDestinations,
    getCategoryBySlugForDestination,
    getCategoryPageContent,
    getCollectionRender,
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
    getHubRender,
    getPublishedPage,
    getTourBySlug,
} from '@/lib/api/public';
import { resolveSlug } from '@/lib/api/slug-registry';
import {
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildAlternates , NOT_FOUND_METADATA } from '@/lib/seo/alternates';
import { ogImageMeta } from '@/lib/seo/og-image';
import { EntityPageSkeleton } from '@/components/frontend/skeletons/entity-page-skeleton';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
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
    const alternates = buildAlternates(locale, `/${destination}/${slug}`);

    if (!resolution) {
        // Not a registry entity. When the first segment is not an active
        // island either, this may be a NESTED Pages permalink
        // (`legal/terms`) - mirror the render fall-through below.
        const island = await getDestinationBySlug(
            destination,
            locale as Locale
        );
        if (!island || !island.isActive) {
            const page = await getPublishedPage(
                `${destination}/${slug}`,
                locale as Locale
            );
            if (page && !page.redirectToSlug) {
                return {
                    title: page.metaTitle || page.title,
                    ...(page.metaDescription && {
                        description: page.metaDescription,
                    }),
                    ...(page.ogImage && {
                        openGraph: { images: [{ url: page.ogImage }] },
                    }),
                    ...twitterCard(
                        page.metaTitle || page.title,
                        page.metaDescription,
                    ),
                    alternates,
                };
            }
        }
        return {};
    }

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
        if (!category) return NOT_FOUND_METADATA;
        const categoryTitle =
            pageContent?.metaTitle ??
            `${category.name} in ${destinationName} | Island Tours`;
        const categoryDescription =
            pageContent?.metaDescription ?? category.overview ?? undefined;
        return {
            title: categoryTitle,
            description: categoryDescription,
            // The category branch published NO og:image at all, so sharing a
            // category page fell back to the sitewide default card. `ogImage`
            // first, then the hero photo, with localized alt from the library.
            ...(await ogImageMeta(
                category.ogImage ?? category.heroImage,
                locale,
                categoryTitle
            )),
            ...twitterCard(categoryTitle, categoryDescription),
            alternates,
        };
    }

    if (resolution.entityType === 'COLLECTION' && resolution.entityId) {
        const dest = await getDestinationBySlug(destination, locale as Locale);
        if (!dest) return NOT_FOUND_METADATA;

        const render = await getCollectionRender(
            slug,
            dest.id,
            locale as Locale
        );
        // Only PUBLISHED collections render; a null render (draft/404) emits just
        // the alternates so the page's own notFound() still governs the response.
        if (!render) return NOT_FOUND_METADATA;

        const collectionTitle =
            render.pageContent?.metaTitle ??
            `${render.h1Override ?? render.name} | Island Tours`;
        const collectionDescription =
            render.pageContent?.metaDescription ?? render.overview ?? undefined;
        return {
            title: collectionTitle,
            description: collectionDescription,
            // Also had no og:image before this.
            ...(await ogImageMeta(
                render.ogImage ?? render.heroImage,
                locale,
                collectionTitle
            )),
            ...twitterCard(collectionTitle, collectionDescription),
            alternates,
        };
    }

    if (resolution.entityType === 'HUB' && resolution.entityId) {
        const dest = await getDestinationBySlug(destination, locale as Locale);
        if (!dest) return NOT_FOUND_METADATA;

        const render = await getHubRender(slug, dest.id, locale as Locale);
        // Only PUBLISHED hubs render; a null render (draft/404) emits just the
        // alternates so the page's own notFound() still governs the response.
        if (!render) return NOT_FOUND_METADATA;

        const entityTitle =
            render.pageContent?.metaTitle ??
            `${render.hero.h1} | Island Tours`;
        const entityDescription =
            render.pageContent?.metaDescription ??
            render.editorialLead ??
            undefined;

        return {
            title: entityTitle,
            description: entityDescription,
            ...(await ogImageMeta(
                render.ogImage ?? render.hero.heroImage,
                locale,
                entityTitle
            )),
            ...twitterCard(entityTitle, entityDescription),
            alternates,
        };
    }

    if (resolution.entityType === 'TOUR') {
        const tour = await getTourBySlug({
            slug,
            destinationSlug: destination,
            locale: locale as Locale,
        }).catch(() => null);
        if (!tour) return NOT_FOUND_METADATA;

        // og:image respects the media library's "exclude from indexing" flag:
        // hero first, then gallery order, excluded URLs filtered out.
        const orderedImages = [...tour.images].sort(
            (a, b) =>
                Number(b.isHero) - Number(a.isHero) ||
                a.displayOrder - b.displayOrder
        );
        const indexable = await filterIndexableImages(
            orderedImages.map(img => img.url)
        );
        const tourTitle = tour.translation?.title ?? tour.name;
        // Alt text prefers the LIVE media-library value for the visitor's locale.
        // `TourImage.altText` is a snapshot taken when the image was picked, so
        // it is English-only and goes stale the moment the library is edited -
        // it stays as the second choice, ahead of the tour title.
        const mediaSeo = await getMediaSeo(indexable.slice(0, 3), locale);
        const ogImages = indexable.slice(0, 3).map(url => {
            const img = orderedImages.find(i => i.url === url);
            return {
                url,
                alt:
                    mediaSeo.get(normalizeUrl(url))?.altText ||
                    img?.altText ||
                    tourTitle,
                width: img?.width,
                height: img?.height,
            };
        });

        const tourMetaTitle = `${tourTitle} | Island Tours`;
        const tourMetaDescription =
            tour.translation?.shortDescription ?? undefined;
        return {
            title: tourMetaTitle,
            description: tourMetaDescription,
            alternates,
            openGraph: ogImages.length ? { images: ogImages } : undefined,
            // Stated explicitly: the root layout carries an admin-authored
            // sitewide twitter title/description, and Next merges `twitter`
            // shallowly - so a page that omits it inherits the generic site
            // copy even though og:* correctly describes the page. Without this
            // a shared tour link previewed as "Island Tours".
            twitter: {
                title: tourMetaTitle,
                ...(tourMetaDescription && {
                    description: tourMetaDescription,
                }),
            },
        };
    }

    return NOT_FOUND_METADATA;
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

    // NESTED Pages fall-through: when the registry misses AND the first
    // segment is not an active island, this is not entity territory at all -
    // it may be a nested Pages permalink (`/legal/terms`). Pages can never
    // start with a real destination segment (the backend rejects that), so
    // this branch cannot shadow the flat-tour default below.
    if (!resolution) {
        const island = await getDestinationBySlug(destination, locale);
        if (!island || !island.isActive) {
            const page = await getPublishedPage(
                `${destination}/${slug}`,
                locale
            );
            if (!page) notFound();
            if (page.redirectToSlug) {
                permanentRedirect(`/${locale}/${page.redirectToSlug}`);
            }
            return (
                <LegalPageShell
                    locale={locale}
                    title={page.title}
                    showEnglishNotice={page.isEnglishFallback}>
                    <PageBody html={page.body} />
                </LegalPageShell>
            );
        }
    }

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

        case 'TOUR': {
            // Flat resolution: the tour fetches by its slug, not entityId
            // (ROUTING-AND-RESOLUTION.md §5.2).
            //
            // `?date=` is the day the traveller already picked upstream (a
            // date-filtered search or listing). Read here and handed to the
            // booking widget so it opens on that day instead of asking again.
            // Only a well-formed YYYY-MM-DD is honoured; the widget re-checks
            // that it is not in the past.
            const sp = await searchParams;
            const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
            const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')
                ? raw
                : undefined;
            return (
                <TourPage
                    destinationSlug={destination}
                    slug={slug}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                    initialDate={initialDate}
                />
            );
        }

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

