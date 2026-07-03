import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CategoryPage } from '@/components/frontend/category-page';
import { HubPage } from '@/components/frontend/hub-page';
import { TourPage } from '@/components/frontend/tour-page';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
    getActiveDestinations,
    getCategoryBySlugForDestination,
    getCategoryPageContent,
    getDestinationBySlug,
    getDestinationCategories,
} from '@/lib/api/public';
import { resolveSlug } from '@/lib/api/slug-registry';

/**
 * Localized destination display name from the public cached loader. On any fetch
 * error we fall back to a prettified slug rather than 404 - a successful slug
 * resolve already implies the destination is active (§5.10).
 */
async function resolveDestinationName(
    destination: string,
    locale: Locale,
): Promise<string> {
    const dest = await getDestinationBySlug(destination, locale);
    return (
        dest?.name ??
        destination.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
 * Prerender the destination × category combos from the backend (gating-consistent
 * with the public category loader, so every prerendered path actually renders).
 * Tours and other slugs (hubs, etc.) render on demand via the default
 * `dynamicParams`; if the backend is unreachable at build this returns `[]` and
 * those paths render on demand too (covered by the route's `loading.tsx`).
 */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            const combos = await Promise.all(
                destinations.map(async (d) => {
                    const cats = await getDestinationCategories(d.slug, DEFAULT_LOCALE);
                    return cats.map((c) => ({ destination: d.slug, slug: c.slug }));
                }),
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
        const [category, pageContent] = await Promise.all([
            getCategoryBySlugForDestination(destination, slug, locale as Locale),
            getCategoryPageContent(resolution.entityId, locale as Locale),
        ]);
        if (!category) return { alternates };

        const destinationName = await resolveDestinationName(destination, locale as Locale);
        return {
            title:
                pageContent?.metaTitle ??
                `${category.name} in ${destinationName} | Island Tours`,
            description: pageContent?.metaDescription ?? category.overview ?? undefined,
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
 * CATEGORY / HUB / TOUR branches are implemented; COLLECTION is tracked as
 * not-yet-built (ROUTING-AND-RESOLUTION.md §11) and 404s until then. RESERVED
 * `tours` is normally served by the static `tours/` route; the redirect here is
 * a defensive fallback.
 */
export default async function EntityPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) notFound();

    const resolution = await resolveSlug(destination, slug);

    const dict = await getDictionary(locale);
    const destinationName = await resolveDestinationName(destination, locale);

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

        // COLLECTION page is not built yet (see routing doc §11).
        case 'COLLECTION':
        default:
            notFound();
    }
}
