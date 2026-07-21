import {
    DestinationAbout,
    fallbackAboutSections,
} from '@/components/frontend/destination/destination-about';
import { InstagramSection } from '@/components/frontend/instagram/instagram-section';
import {
    DestinationCollectionsSection,
    DestinationHeroSection,
    DestinationLocalFavourites,
} from '@/components/frontend/destination/destination-page-sections';
import { FaqSection } from '@/components/frontend/faq-section';
import { DestinationPageSkeleton } from '@/components/frontend/skeletons/destination-page-skeleton';
import {
    getActiveDestinations,
    getDestinationBySlug,
    getDestinationFaqs,
    getDestinationPageContent,
} from '@/lib/api/public';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo/alternates';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/** Prerender the active destinations from the backend (public cached loader). */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            return destinations.map(d => ({ destination: d.slug }));
        }
    } catch {
        // Fallback if backend is unavailable during build
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }));
}

/**
 * The island's search-engine listing, per locale, from the dashboard's
 * destination Page Content tab. Anything unset is omitted so the site-wide
 * defaults apply - the same fallback contract the homepage uses.
 *
 * Both loaders are the cached ones the page itself calls, so resolving the
 * island here to reach its id costs no extra request.
 *
 * The canonical + hreflang set is emitted even when the island does not resolve,
 * so the page's own notFound() governs the response rather than this function.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}): Promise<Metadata> {
    const { locale, destination } = await params;
    if (!isLocale(locale)) return {};

    const alternates = buildAlternates(locale, `/${destination}`);

    const island = await getDestinationBySlug(destination, locale);
    if (!island) return { alternates };

    const pageContent = await getDestinationPageContent(island.id, locale);

    return {
        ...(pageContent?.metaTitle && { title: pageContent.metaTitle }),
        ...(pageContent?.metaDescription && {
            description: pageContent.metaDescription,
        }),
        ...(island.ogImage && {
            openGraph: { images: [{ url: island.ogImage }] },
        }),
        alternates,
    };
}

/**
 * Destination page - `/[locale]/[destination]` (e.g. /en/curacao).
 *
 * The route resolves the island + dictionary (fast cached loaders) and gates a
 * 404 for unknown/inactive islands. This route is prerendered
 * (`generateStaticParams`), and every section reads only cached (`'use cache'`)
 * data, so the whole page is baked static (instant, SEO content in the initial
 * HTML, no skeleton flash) and kept fresh via cache tags. The route's
 * `loading.tsx` covers client navigation and a cold island's first on-demand
 * render.
 */
export default function DestinationPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    // STREAMING SHAPE: return the <Suspense> shell without awaiting anything, so
    // a cold path (newly-activated island, expired cache entry) paints the
    // skeleton instantly and streams, instead of blocking the click until the
    // backend answers. Prerendered destinations resolve the boundary at build -
    // their baked page is unchanged (no skeleton flash).
    return (
        <Suspense fallback={<DestinationPageSkeleton />}>
            <DestinationContent params={params} />
        </Suspense>
    );
}

async function DestinationContent({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, island] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale),
    ]);
    // Unknown or not-yet-launched (inactive) island → 404. getDestinationBySlug
    // resolves any slug, so we gate on isActive here for the public site.
    if (!island || !island.isActive) notFound();

    // Editorial content + FAQs are keyed by island id, so they can only start
    // once the slug resolves; they are independent of each other, so they run
    // together. Both fall back to bundled copy, so neither can fail the page.
    const [pageContent, faqs] = await Promise.all([
        getDestinationPageContent(island.id, locale),
        getDestinationFaqs(island.id, locale),
    ]);

    const destinationName = island.name;

    // `||` not `??`: an admin who clears the field leaves an empty string, and
    // that must fall back to the bundled copy rather than render a blank block.
    // The substitution is applied only to the bundled template - authored copy
    // is an admin's own words and is rendered exactly as written.
    const aboutDescription =
        pageContent?.aboutText ||
        dict.destination.about.description.replaceAll(
            '{destination}',
            destinationName
        );

    // Authored per-island blocks when they exist, otherwise the three bundled
    // label links. Same rule as `aboutDescription`: the CMS wins, and an island
    // nobody has authored yet still renders the band it renders today.
    const aboutSections = pageContent?.sections?.length
        ? pageContent.sections
        : fallbackAboutSections(dict.destination.about);

    // Per-island questions when authored, otherwise the bundled generic set.
    // Only `items` is swapped - the surrounding chrome (title, WhatsApp prompt,
    // guarantees) is shared with the homepage on purpose.
    const faqDict = {
        ...dict.home.faq,
        ...(faqs.length > 0 && {
            items: faqs.map(f => ({ q: f.question, a: f.answer })),
        }),
    };

    return (
        <>
            <DestinationHeroSection
                destination={destination}
                locale={locale as Locale}
                dict={dict}
                destinationName={destinationName}
                heroImage={island.heroImage ?? undefined}
            />

            <DestinationLocalFavourites
                destination={destination}
                locale={locale as Locale}
                dict={dict}
                islandId={island.id}
                destinationName={destinationName}
            />

            <DestinationCollectionsSection
                destination={destination}
                locale={locale as Locale}
                dict={dict}
            />

            <InstagramSection
                dict={dict.destination.instagram}
                destination={destination}
            />

            <FaqSection dict={faqDict} />

            <DestinationAbout
                destinationName={destinationName}
                description={aboutDescription}
                sections={aboutSections}
                dict={dict.destination.about}
            />
        </>
    );
}

