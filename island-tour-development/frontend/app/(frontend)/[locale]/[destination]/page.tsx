import Image from 'next/image';
import { twitterCard } from '@/lib/seo/twitter-card';
import { LAUNCH_DESTINATION_SLUGS } from '@/lib/constants/locales';
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
import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { PageBody } from '@/components/frontend/legal/page-body';
import {
    getActiveDestinations,
    getDestinationBySlug,
    getDestinationFaqs,
    getDestinationPageContent,
    getPublishedPage,
} from '@/lib/api/public';
import { getSitemapEntries } from '@/lib/api/public/sitemap';
import { JsonLd } from '@/components/frontend/seo/json-ld';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildAlternates , NOT_FOUND_METADATA } from '@/lib/seo/alternates';
import { ogImageMeta } from '@/lib/seo/og-image';
import {
    buildBreadcrumbJsonLd,
    buildTouristDestinationJsonLd,
} from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Prerender the active destinations PLUS every published Page (public cached
 * loaders). This route is the fall-through for both: `/{locale}/{slug}` is a
 * destination first, else a published Page (legal/policy permalinks), else 404.
 */
export async function generateStaticParams() {
    const params: { destination: string }[] = [];
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            params.push(...destinations.map(d => ({ destination: d.slug })));
        }
    } catch {
        // Fallback if backend is unavailable during build
    }
    if (params.length === 0) {
        params.push(
            ...LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }))
        );
    }

    // Published pages ride the sitemap enumeration (type 'page' = `/{path}`),
    // so there is no second endpoint to keep in sync. Only SINGLE-segment
    // permalinks belong to this route - nested ones (`legal/terms`) resolve
    // through the entity route / the deep catch-all. Best-effort: a page that
    // is not prerendered still renders on demand.
    try {
        const entries = await getSitemapEntries();
        params.push(
            ...entries
                .filter(e => e.type === 'page')
                .map(e => e.path.replace(/^\//, ''))
                .filter(path => !path.includes('/'))
                .map(destination => ({ destination }))
        );
    } catch {
        // Pages render on-demand when the enumeration is unavailable.
    }

    return params;
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
    if (!island) {
        // Fall-through: not an island - maybe a published Page (legal/policy
        // permalink). Same metadata contract as the hand-authored legal pages:
        // title + canonical/hreflang; description/OG only when authored.
        const page = await getPublishedPage(destination, locale);
        if (page && !page.redirectToSlug) {
            return {
                title: page.metaTitle || page.title,
                ...(page.metaDescription && {
                    description: page.metaDescription,
                }),
                ...(await ogImageMeta(
                    page.ogImage,
                    locale,
                    page.metaTitle || page.title,
                )),
                ...twitterCard(
                    page.metaTitle || page.title,
                    page.metaDescription,
                ),
                alternates,
            };
        }
        return NOT_FOUND_METADATA;
    }

    const pageContent = await getDestinationPageContent(island.id, locale);

    return {
        ...(pageContent?.metaTitle && { title: pageContent.metaTitle }),
        ...(pageContent?.metaDescription && {
            description: pageContent.metaDescription,
        }),
        ...(await ogImageMeta(
            island.ogImage,
            locale,
            pageContent?.metaTitle || island.name,
        )),
        ...twitterCard(pageContent?.metaTitle, pageContent?.metaDescription),
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
    // Unknown or not-yet-launched (inactive) island → fall through to the
    // Pages system before 404ing: `/{locale}/{slug}` is a destination first,
    // else a published Page (the legal/policy permalinks live here), else 404.
    // getDestinationBySlug resolves any slug, so we gate on isActive for the
    // public site.
    if (!island || !island.isActive) {
        const page = await getPublishedPage(destination, locale);
        if (!page) notFound();

        // A renamed permalink: send the crawler and the visitor to the new
        // slug permanently (the backend collapses chains to one hop).
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

    // Editorial content + FAQs are keyed by island id, so they can only start
    // once the slug resolves; they are independent of each other, so they run
    // together. Both fall back to bundled copy, so neither can fail the page.
    const [pageContent, faqs, siteUrl] = await Promise.all([
        getDestinationPageContent(island.id, locale),
        getDestinationFaqs(island.id, locale),
        getSiteUrl(),
    ]);

    const destinationName = island.name;

    // Structured data: breadcrumb trail (Home > Island) + the island itself as a
    // TouristDestination. FAQPage is emitted by FaqSection below, not here.
    const destPath = `/${destination}`;
    const breadcrumbJsonLd = buildBreadcrumbJsonLd({
        siteUrl,
        locale,
        trail: [{ name: destinationName, path: destPath }],
    });
    const touristDestinationJsonLd = buildTouristDestinationJsonLd({
        siteUrl,
        locale,
        path: destPath,
        name: destinationName,
        description: pageContent?.metaDescription || null,
        image: island.ogImage || island.heroImage || null,
    });

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
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={touristDestinationJsonLd} />
            {/* Breadcrumbs above the hero, desktop only (design v2 .crumbs;
                LD8 divergence: hidden on mobile). */}
            <nav
                aria-label='Breadcrumb'
                className='it-container hidden items-center gap-2 py-4 md:flex'>
                <Link
                    href={localizeHref(locale, '/')}
                    className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline hover:underline'>
                    {dict.destination.allTours.breadcrumb.home}
                </Link>
                <Image
                    src='/icons/breadcrumb-arrow.svg'
                    alt=''
                    aria-hidden
                    width={20}
                    height={20}
                    className='size-5 shrink-0'
                />
                <span
                    aria-current='page'
                    className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {destinationName}
                </span>
            </nav>
            <DestinationHeroSection
                destination={destination}
                locale={locale as Locale}
                dict={dict}
                islandId={island.id}
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

