import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { SearchResultsSection } from '@/components/frontend/search/search-results-section';
import { SearchResultsSkeleton } from '@/components/frontend/skeletons/search-page-skeleton';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string }>;
}) {
    const [{ locale }, { q }] = await Promise.all([params, searchParams]);
    if (!isLocale(locale)) return {};
    const dict = await getDictionary(locale);
    const query = (q ?? '').trim();
    const title = query ? `${dict.search.title}: ${query}` : dict.search.title;
    // Search result pages should never be indexed.
    return { title, robots: { index: false, follow: true } };
}

/**
 * Global tour search results — `/[locale]/search?q=…`. The shell resolves the
 * dictionary (a fast cached loader) and renders the static heading; the
 * result-count subtitle, destination-scope chip, and paginated result grid all
 * read the query from `searchParams`, so they stream into their own `<Suspense>`
 * boundary (Cache Components PPR) instead of blocking the whole page. When
 * `?destination=` is set (carried over from the navbar's active island), results
 * are scoped to it.
 */
export default async function SearchPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string; page?: string; destination?: string; date?: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                {/* ── Heading (static shell) ───────────────────────────────── */}
                <h1 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {dict.search.title}
                </h1>

                {/* ── Streamed, request-time results ───────────────────────── */}
                <Suspense fallback={<SearchResultsSkeleton />}>
                    <SearchResultsSection
                        locale={locale as Locale}
                        dict={dict}
                        searchParams={searchParams}
                    />
                </Suspense>
            </div>
        </section>
    );
}
