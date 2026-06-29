import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SearchPagination } from '@/components/frontend/search-pagination';
import { TourCard } from '@/components/frontend/tour-card';
import { getActiveDestinations, searchTours } from '@/lib/api/public';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';

const PAGE_SIZE = 12;

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
 * Global tour search results — `/[locale]/search?q=…`. Server-rendered and
 * paginated; reads the query from `searchParams` so it is request-time dynamic
 * (the layout already wraps children in Suspense). When `?destination=` is set
 * (carried over from the navbar's active island), results are scoped to it.
 */
export default async function SearchPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ q?: string; page?: string; destination?: string }>;
}) {
    const [{ locale }, sp] = await Promise.all([params, searchParams]);
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);
    const t = dict.search;
    const query = (sp.q ?? '').trim();
    const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
    const destination = sp.destination?.trim() || undefined;

    // Card labels live in the shared listings dictionary (the canonical TourCard
    // label set); the search section only adds page chrome + duration units.
    const cardDict = dict.destination.listings;

    // Resolve the scoped destination's display name (for the filter chip).
    let destinationName: string | null = null;
    if (destination) {
        const destinations = await getActiveDestinations(locale as Locale);
        destinationName = destinations.find((d) => d.slug === destination)?.name ?? null;
    }

    const results =
        query.length >= 2
            ? await searchTours({
                  q: query,
                  locale: locale as Locale,
                  destinationSlug: destination,
                  page,
                  limit: PAGE_SIZE,
              })
            : null;

    const listings =
        results?.data.map((hit) => searchHitToListing(hit, locale as Locale, t)) ?? [];
    const totalPages = results ? Math.max(1, Math.ceil(results.total / PAGE_SIZE)) : 0;

    // "Remove filter" link → same query without the destination scope.
    const searchAllHref = `${localizeHref(locale as Locale, '/search')}?q=${encodeURIComponent(query)}`;

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                {/* ── Heading ──────────────────────────────────────────────── */}
                <header className='flex flex-col gap-2'>
                    <h1 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {t.title}
                    </h1>
                    {results && results.total > 0 && (
                        <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                            {(results.total === 1 ? t.resultFor : t.resultsFor)
                                .replace('{count}', String(results.total))
                                .replace('{query}', query)}
                        </p>
                    )}
                    {destinationName && (
                        <Link
                            href={searchAllHref}
                            className='inline-flex w-fit items-center gap-2 rounded-it-full border border-it-border px-3 py-1.5 text-[13px] text-it-heading no-underline transition-colors hover:bg-it-surface'>
                            {destinationName}
                            <span aria-hidden='true' className='text-it-heading/50'>
                                ✕
                            </span>
                        </Link>
                    )}
                </header>

                {/* ── States ───────────────────────────────────────────────── */}
                {query.length < 2 ? (
                    <EmptyState title={t.promptTitle} hint={t.promptHint} />
                ) : results && results.total === 0 ? (
                    <EmptyState
                        title={t.noResults.replace('{query}', query)}
                        hint={t.noResultsHint}
                    />
                ) : (
                    <>
                        <div className='grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10'>
                            {listings.map((tour) => (
                                <TourCard key={tour.id} tour={tour} dict={cardDict} />
                            ))}
                        </div>

                        <SearchPagination pageCount={totalPages} />
                    </>
                )}
            </div>
        </section>
    );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
    return (
        <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <p className='m-0 font-medium text-[18px] md:text-[22px] leading-[1.3] text-it-heading'>
                {title}
            </p>
            <p className='m-0 max-w-md text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                {hint}
            </p>
        </div>
    );
}
