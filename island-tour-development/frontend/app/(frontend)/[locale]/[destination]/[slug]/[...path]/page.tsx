import { twitterCard } from '@/lib/seo/twitter-card';
import { LegalPageShell } from '@/components/frontend/legal/legal-page-shell';
import { PageBody } from '@/components/frontend/legal/page-body';
import { getPublishedPage } from '@/lib/api/public';
import { getSitemapEntries } from '@/lib/api/public/sitemap';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { buildAlternates } from '@/lib/seo/alternates';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

/**
 * Deep Pages catch-all - `/{locale}/{a}/{b}/{c...}` (3+ segments).
 *
 * One and two-segment paths are owned by the destination and entity routes
 * (which fall through to the Pages system themselves); anything DEEPER can
 * only be a published Page with a nested permalink (`help/faq/payments`),
 * so this route resolves the joined path against the Pages system and 404s
 * on a miss. Static children (checkout, processing) always win over this
 * catch-all - Next matches static segments first.
 */

type PageParams = {
    locale: string;
    destination: string;
    slug: string;
    path: string[];
};

/** Join the dynamic segments back into the stored permalink path. */
function pagePath({
    destination,
    slug,
    path,
}: Pick<PageParams, 'destination' | 'slug' | 'path'>): string {
    return [destination, slug, ...path].join('/');
}

/**
 * Prerender the 3+-segment published pages from the sitemap enumeration.
 * Cache Components needs at least ONE entry or every layout await becomes a
 * request-time Blocking Route error, so an empty result falls back to a
 * placeholder that renders the 404 shell.
 */
export async function generateStaticParams() {
    try {
        const entries = await getSitemapEntries();
        const deep = entries
            .filter(e => e.type === 'page')
            .map(e => e.path.replace(/^\//, '').split('/'))
            .filter(segments => segments.length >= 3)
            .map(segments => ({
                destination: segments[0],
                slug: segments[1],
                path: segments.slice(2),
            }));
        if (deep.length > 0) return deep;
    } catch {
        // Backend unavailable at build - fall through to the placeholder.
    }
    return [{ destination: 'pages', slug: 'placeholder', path: ['none'] }];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<PageParams>;
}): Promise<Metadata> {
    const { locale, ...rest } = await params;
    if (!isLocale(locale)) return {};

    const path = pagePath(rest);
    const alternates = buildAlternates(locale, `/${path}`);

    const page = await getPublishedPage(path, locale);
    if (page && !page.redirectToSlug) {
        return {
            title: page.metaTitle || page.title,
            ...(page.metaDescription && { description: page.metaDescription }),
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
    return { alternates };
}

export default async function DeepPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale, ...rest } = await params;
    if (!isLocale(locale)) notFound();

    const page = await getPublishedPage(pagePath(rest), locale);
    if (!page) notFound();

    if (page.redirectToSlug) {
        permanentRedirect(`/${locale}/${page.redirectToSlug}`);
    }

    return (
        <LegalPageShell
            locale={locale as Locale}
            title={page.title}
            showEnglishNotice={page.isEnglishFallback}>
            <PageBody html={page.body} />
        </LegalPageShell>
    );
}
