import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SearchResultsSection } from '@/components/frontend/search/search-results-section';
import { SearchResultsSkeleton } from '@/components/frontend/skeletons/search-page-skeleton';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ locale }, { q }] = await Promise.all([params, searchParams]);
    if (!isLocale(locale)) return {};
    const dict = await getDictionary(locale);
    const query = (Array.isArray(q) ? q[0] : (q ?? '')).trim();
    const title = query ? `${dict.search.title}: ${query}` : dict.search.title;
    // Search result pages should never be indexed. A self-referencing canonical
    // to the bare path consolidates the `?q=` variants; hreflang is deliberately
    // omitted (Google ignores it on noindex pages).
    return {
        title,
        robots: { index: false, follow: true },
        alternates: { canonical: `/${locale}/search` },
    };
}

/**
 * Global tour search results — `/[locale]/search?q=…`. The shell resolves the
 * dictionary (a fast cached loader) and opens the Suspense boundary; the scope
 * pill, heading, filter/sort toolbar, result grid and recovery band all read the
 * query from `searchParams`, so they stream into that boundary (Cache Components
 * PPR) instead of blocking the whole page. When `?destination=` is set (carried
 * over from the navbar's active island), results are scoped to it.
 *
 * THE `h1` IS STREAMED, not prerendered: it states the outcome ("12 results for
 * “boat”" / "No results for “boat”"), which is not knowable until the search has
 * run. A static "Search" heading above it was the alternative and it told a
 * traveller who had just searched nothing at all. The skeleton holds its place
 * so nothing shifts, and the page is `noindex`, so there is no crawler that
 * needs the heading in the shell.
 *
 * Nothing here is inside a container: the streamed section mounts the shared
 * listing toolbar, whose sticky band bleeds edge to edge, and the recovery band
 * does the same - both own their own containers (as on the All Tours page).
 */
export default async function SearchPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);

    return (
        <section className='it-section bg-it-white'>
            {/* ── Streamed, request-time results ───────────────────────────── */}
            <Suspense fallback={<SearchResultsSkeleton />}>
                <SearchResultsSection
                    locale={locale as Locale}
                    dict={dict}
                    searchParams={searchParams}
                />
            </Suspense>
        </section>
    );
}

