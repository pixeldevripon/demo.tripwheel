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
 * dictionary (a fast cached loader) and renders the static heading; the
 * result-count line, destination-scope chip, filter/sort toolbar and paginated
 * result grid all read the query from `searchParams`, so they stream into their
 * own `<Suspense>` boundary (Cache Components PPR) instead of blocking the whole
 * page. When `?destination=` is set (carried over from the navbar's active
 * island), results are scoped to it.
 *
 * Only the heading is inside a container here: the streamed section mounts the
 * shared listing toolbar, whose sticky band bleeds edge to edge and owns its own
 * containers (same split as the All Tours page).
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
            {/* ── Heading (static shell) ───────────────────────────────────── */}
            <div className='it-container mb-6'>
                <h1 className='m-0 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1] tracking-[-0.018em] text-it-heading'>
                    {dict.search.title}
                </h1>
            </div>

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

