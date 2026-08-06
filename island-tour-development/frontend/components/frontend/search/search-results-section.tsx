import { format, parse } from 'date-fns';
import Link from 'next/link';

import { Reveal } from '@/components/frontend/reveal';
import { SearchPagination } from '@/components/frontend/search-pagination';
import { SearchBrowser } from '@/components/frontend/search/search-browser';
import { TourCard } from '@/components/frontend/tour-card';
import { getActiveDestinations, searchTours } from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing, TOUR_CARD_GRID } from '@/lib/tours/listing';

const PAGE_SIZE = 12;

/**
 * A removable scope chip above the results (destination, date).
 *
 * Every active filter needs one: results were already being narrowed by the
 * date carried from the hero, but only the DESTINATION said so, which read as
 * "search is missing tours" rather than "you asked for one day".
 */
function ScopeChip({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className='inline-flex w-fit items-center gap-2 rounded-it-full border border-it-border px-3 py-1.5 text-[13px] text-it-heading no-underline transition-colors hover:bg-it-surface'>
            {label}
            <span aria-hidden='true' className='text-it-heading/50'>
                ✕
            </span>
        </Link>
    );
}

interface SearchResultsSectionProps {
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<{
        q?: string;
        page?: string;
        destination?: string;
        date?: string;
    }>;
}

/**
 * Async, streamed body of the global search page (`/[locale]/search`): the
 * result-count subtitle, the destination-scope chip, and the paginated result
 * grid (or an empty/prompt state). Reads the query from `searchParams` (`await
 * searchParams` below), which is itself the request-time trigger that makes it
 * stream into its own `<Suspense>` boundary under Cache Components while the shell
 * (heading + navbar/footer) prerenders. No `connection()` needed.
 */
export async function SearchResultsSection({
    locale,
    dict,
    searchParams,
}: SearchResultsSectionProps) {
    const sp = await searchParams;
    const t = dict.search;
    const query = (sp.q ?? '').trim();
    const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
    const destination = sp.destination?.trim() || undefined;
    // Only honor a well-formed YYYY-MM-DD (the backend 400s on anything else).
    const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '')
        ? sp.date
        : undefined;

    // Card labels live in the shared listings dictionary (the canonical TourCard
    // label set); the search section only adds page chrome + duration units.
    const cardDict = dict.destination.listings;

    // Resolve the scoped destination's display name (for the filter chip).
    let destinationName: string | null = null;
    if (destination) {
        const destinations = await getActiveDestinations(locale);
        destinationName =
            destinations.find(d => d.slug === destination)?.name ?? null;
    }

    const currency = await getServerCurrency(locale);
    const results =
        query.length >= 2
            ? await searchTours({
                  q: query,
                  locale,
                  currency,
                  destinationSlug: destination,
                  date,
                  page,
                  limit: PAGE_SIZE,
              })
            : null;

    const listings =
        results?.data.map(hit => searchHitToListing(hit, locale, t, date)) ??
        [];
    const totalPages = results
        ? Math.max(1, Math.ceil(results.total / PAGE_SIZE))
        : 0;

    /*
     * Each chip drops ONLY its own filter and keeps the others - removing the
     * island must not silently also throw away the day you picked.
     */
    const base = `${localizeHref(locale, '/search')}?q=${encodeURIComponent(query)}`;
    const withoutDestination = `${base}${date ? `&date=${date}` : ''}`;
    const withoutDate = `${base}${destination ? `&destination=${destination}` : ''}`;

    // Same "13 Aug" shape the All Tours filter bar uses, so one date reads the
    // same wherever it is shown. Parsed at midnight LOCAL, not UTC: `new
    // Date('2026-08-13')` is UTC midnight and prints as the 12th west of
    // Greenwich, which would show a different day than the one searched.
    const dateLabel = date
        ? format(parse(date, 'yyyy-MM-dd', new Date()), 'd MMM')
        : null;

    return (
        <SearchBrowser
            header={
                (results && results.total > 0) || destinationName || dateLabel ? (
                    <div className='flex flex-col gap-2'>
                        {results && results.total > 0 && (
                            <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                                {(results.total === 1
                                    ? t.resultFor
                                    : t.resultsFor
                                )
                                    .replace('{count}', String(results.total))
                                    .replace('{query}', query)}
                            </p>
                        )}
                        {(destinationName || dateLabel) && (
                            <div className='flex flex-wrap items-center gap-2'>
                                {destinationName && (
                                    <ScopeChip
                                        href={withoutDestination}
                                        label={destinationName}
                                    />
                                )}
                                {dateLabel && (
                                    <ScopeChip
                                        href={withoutDate}
                                        label={dateLabel}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ) : null
            }
            results={
                query.length < 2 ? (
                    <EmptyState title={t.promptTitle} hint={t.promptHint} />
                ) : results && results.total === 0 ? (
                    <EmptyState
                        title={t.noResults.replace('{query}', query)}
                        hint={t.noResultsHint}
                    />
                ) : (
                    <Reveal className='flex flex-col gap-12 sm:gap-18'>
                        <div className={TOUR_CARD_GRID}>
                            {listings.map((tour, i) => (
                                <TourCard
                                    key={tour.id}
                                    tour={tour}
                                    dict={cardDict}
                                    // Pairs with TOUR_CARD_GRID's single mobile
                                    // column - the two are one decision.
                                    mobileRow
                                    // First ROW only (4 at lg) - see TourCardProps.
                                    priority={i < 4}
                                />
                            ))}
                        </div>

                        <SearchPagination pageCount={totalPages} />
                    </Reveal>
                )
            }
        />
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

