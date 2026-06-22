import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CategoryPage } from '@/components/frontend/category-page';
import { HubPage } from '@/components/frontend/hub-page';
import { categoriesApi } from '@/lib/api/categories';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { destinationsApi } from '@/lib/api/destinations';
import { resolveSlug } from '@/lib/api/slug-registry';

/**
 * Localized destination display name from the backend. A successful slug resolve
 * already implies the destination is active (deactivating an island tombstones
 * all its registry rows - §5.10), so on any fetch error we fall back to a
 * prettified slug rather than 404.
 */
async function resolveDestinationName(
    destination: string,
    locale: Locale,
): Promise<string> {
    const dest = await destinationsApi.getBySlug(destination, locale).catch(() => null);
    return (
        dest?.name ??
        destination.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
}

type PageParams = { locale: string; destination: string; slug: string };

// Fallback combos for static generation if the backend is unreachable at build.
// Pairing the launch destinations with a few canonical category slugs guarantees
// `generateStaticParams` is never empty, which keeps `[destination]`/`[slug]` in
// static-generation mode (so the shared `[locale]` layout's `await params` is not
// treated as request-time data and the static shell prerenders without blocking).
const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];
const FALLBACK_CATEGORY_SLUGS = ['boat-tours', 'snorkeling', 'sunset-cruises'];

/**
 * Prerender the destination × category combos from the backend (gating-consistent
 * with `getActiveByDestination`, so every prerendered path actually renders).
 * Non-listed slugs (hubs, etc.) render on demand via the default `dynamicParams`.
 *
 * This must stay non-empty: providing ≥1 sample keeps the dynamic segments in
 * static-generation mode, which is what stops the `[locale]` layout from blocking
 * on `params` under Cache Components.
 */
export async function generateStaticParams() {
    try {
        const destinations = await destinationsApi.getActive();
        if (destinations.length > 0) {
            const combos = await Promise.all(
                destinations.map(async (d) => {
                    const cats = await categoriesApi
                        .getActiveByDestination(d.slug, DEFAULT_LOCALE)
                        .catch(() => []);
                    return cats.map((c) => ({ destination: d.slug, slug: c.slug }));
                }),
            );
            const flat = combos.flat();
            if (flat.length > 0) return flat;
        }
    } catch {
        // backend unavailable at build - fall through to launch combos
    }
    return LAUNCH_DESTINATION_SLUGS.flatMap((destination) =>
        FALLBACK_CATEGORY_SLUGS.map((slug) => ({ destination, slug })),
    );
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
            categoriesApi.getBySlugForDestination(destination, slug, locale as Locale),
            categoriesApi.getPageContent(resolution.entityId, locale as Locale),
        ]);
        if (!category) return { alternates };

        const destinationName = await resolveDestinationName(destination, locale as Locale);
        return {
            title:
                pageContent.metaTitle ??
                `${category.name} in ${destinationName} | Island Tours`,
            description: pageContent.metaDescription ?? category.overview ?? undefined,
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
 * Only the CATEGORY branch is implemented today; HUB / COLLECTION / TOUR are
 * tracked as not-yet-built (ROUTING-AND-RESOLUTION.md §11) and 404 until then.
 * RESERVED `tours` is normally served by the static `tours/` route; the redirect
 * here is a defensive fallback.
 */
export default async function EntityPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) notFound();

    const resolution = await resolveSlug(destination, slug);
    if (!resolution) notFound();

    const dict = await getDictionary(locale);
    const destinationName = await resolveDestinationName(destination, locale);

    switch (resolution.entityType) {
        case 'CATEGORY':
            if (!resolution.entityId) notFound();
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
            if (!resolution.entityId) notFound();
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

        case 'RESERVED':
            redirect(localizeHref(locale, `/${destination}/tours`));

        // COLLECTION / TOUR pages are not built yet (see routing doc §11).
        case 'COLLECTION':
        case 'TOUR':
        default:
            notFound();
    }
}
