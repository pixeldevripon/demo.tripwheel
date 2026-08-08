import Link from 'next/link';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { DestinationPopularLink } from '@/types/destination';

/**
 * How few results still counts as "thin" (Pastel #46).
 *
 * ONE named constant so the threshold can be tuned without hunting through
 * components - which is exactly what it was for: it started at 3 and moved to 4
 * on review, a one-line change with no component touched.
 *
 * Deliberately generous. Four matches for a broad term like "boat" is still a
 * dead end even though the grid is not empty, and that is the whole point of
 * the issue - the grid being non-empty is not the same as the traveller having
 * somewhere to go.
 */
export const THIN_RESULTS_MAX = 4;

export type SearchRecoveryDict = {
    /** Zero state heading, carries `{query}`. */
    noResults: string;
    /** Zero state lead-in under the heading. */
    tryOneOfThese: string;
    /** Thin state kicker, carries `{count}`. */
    onlyMatches: string;
    /** Thin state heading. */
    keepLooking: string;
    /** The date-less retry, carries `{query}`. */
    searchAnyDate: string;
    /** Heading above the popular-search chips. */
    popularSearches: string;
    /** Heading above the category quick links. */
    browseByType: string;
    /** Carries `{destination}`. */
    seeAllDestinationTours: string;
    /** Reset every active filter, keeping the term. */
    clearFilters: string;
};

/** A category quick link - the shape the search section already has to hand. */
export type RecoveryCategory = { name: string; slug: string };

function Chip({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className='inline-flex items-center rounded-it-full border border-it-border bg-it-white px-3.5 py-2 text-[13.5px] font-semibold leading-none text-it-heading no-underline transition-colors hover:border-it-heading/40 hover:bg-it-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
            {label}
        </Link>
    );
}

function Group({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex flex-col gap-2.5'>
            <span className='text-[12.5px] font-bold uppercase tracking-[0.08em] text-it-text-muted'>
                {title}
            </span>
            <div className='flex flex-wrap gap-2'>{children}</div>
        </div>
    );
}

/**
 * The search recovery block - the way out of a search that found little or
 * nothing (Pastel #46; the content set is locked in APPLICATION-FEATURES §D.12:
 * "popular-search chips, the Category Quick Links row, and See all {Destination}
 * tours").
 *
 * ONE component for BOTH the thin and the zero state, because they differ only
 * in their intro line and in whether a grid sits above them. Building them
 * separately is how the two drift into saying different things about the same
 * dead end.
 *
 * THE DATE-LESS RETRY COMES FIRST, and only when a date was actually part of
 * the query: a date is usually what emptied the result set, so offering
 * anything else first asks the traveller to re-plan their trip before offering
 * to simply widen it. With no date in the query the option is meaningless and
 * is omitted entirely rather than rendered disabled.
 */
export function SearchRecovery({
    locale,
    dict,
    query,
    /** The current search minus its date, or null when the query had no date. */
    withoutDateHref,
    /** The bare term with every filter dropped; null when none are active. */
    clearFiltersHref,
    popular,
    categories,
    destinationSlug,
    destinationName,
    /** Result count - present for the thin state, omitted for the zero state. */
    thinCount,
}: {
    locale: Locale;
    dict: SearchRecoveryDict;
    query: string;
    withoutDateHref: string | null;
    clearFiltersHref: string | null;
    popular: DestinationPopularLink[];
    categories: RecoveryCategory[];
    destinationSlug?: string;
    destinationName?: string | null;
    thinCount?: number;
}) {
    const isThin = thinCount != null;

    // A category link resolves under the scoped island when there is one. An
    // all-islands search has no destination to hang a category URL on, so those
    // chips are dropped rather than pointed somewhere arbitrary.
    const categoryHref = (slug: string) =>
        destinationSlug ? localizeHref(locale, `/${destinationSlug}/${slug}`) : null;

    const categoryChips = destinationSlug
        ? categories
              .map(c => ({ ...c, href: categoryHref(c.slug) }))
              .filter((c): c is RecoveryCategory & { href: string } => !!c.href)
        : [];

    return (
        <section
            aria-label={isThin ? dict.keepLooking : dict.tryOneOfThese}
            className={
                isThin
                    ? 'rounded-[16px] border border-it-border bg-it-surface p-5 sm:p-7'
                    : // Zero: a centred card carrying the WHOLE state, since
                      // there is no grid for it to sit under - so it is sized to
                      // hold the page on its own rather than float in it.
                      //
                      // Scales rather than jumping: full width inside the
                      // container's gutter on a phone, then a wider measure and
                      // more padding at each step up. `max-w-4xl` keeps the chip
                      // rows to a readable line length instead of letting them
                      // stretch the full 1200px container.
                      'mx-auto my-6 w-full max-w-4xl rounded-[16px] border border-it-border bg-it-surface p-6 text-center sm:my-10 sm:p-10 lg:p-14'
            }>
            {/* Intro - the only thing that differs between the two states. */}
            <div className={`flex flex-col gap-1 ${isThin ? '' : 'items-center'}`}>
                {isThin ? (
                    <>
                        <span className='text-[12.5px] font-bold uppercase tracking-[0.08em] text-it-primary-hover'>
                            {dict.onlyMatches.replace(
                                '{count}',
                                String(thinCount)
                            )}
                        </span>
                        <p className='m-0 font-it-display text-[19px] font-bold leading-[1.2] tracking-[-0.012em] text-it-ink sm:text-[21px]'>
                            {dict.keepLooking}
                        </p>
                    </>
                ) : (
                    <>
                        <p className='m-0 font-it-display text-[24px] font-bold leading-[1.15] tracking-[-0.015em] text-it-ink sm:text-[30px] lg:text-[34px]'>
                            {dict.noResults.replace('{query}', query)}
                        </p>
                        <p className='m-0 mt-1 text-[15px] leading-[1.68] text-it-text-muted sm:text-[16px]'>
                            {dict.tryOneOfThese}
                        </p>
                    </>
                )}
            </div>

            <div
                className={`flex flex-col gap-5 ${isThin ? 'mt-6' : 'mt-8 items-center sm:mt-10'}`}>
                {/* 0. When a FILTER emptied the page, the way back is to drop
                    it. Offered above everything else because nothing below can
                    help while the filter is still applied - and because the
                    toolbar is hidden on the zero state, this is the only way
                    out. */}
                {clearFiltersHref && (
                    <Link
                        href={clearFiltersHref}
                        className='inline-flex w-fit items-center gap-2 rounded-it-full border border-it-heading/20 bg-it-white px-5 py-2.5 text-[14px] font-bold leading-none text-it-heading no-underline transition-colors hover:border-it-heading/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                        {dict.clearFilters}
                    </Link>
                )}

                {/* 1. The same search, without the date. */}
                {withoutDateHref && (
                    <Link
                        href={withoutDateHref}
                        className='inline-flex w-fit items-center gap-2 rounded-it-full bg-it-primary px-5 py-2.5 text-[14px] font-bold leading-none text-it-primary-fg no-underline transition-colors hover:bg-it-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                        {dict.searchAnyDate.replace('{query}', query)}
                    </Link>
                )}

                {/* 2. Popular searches. */}
                {popular.length > 0 && destinationSlug && (
                    <Group title={dict.popularSearches}>
                        {popular.map(p => (
                            <Chip
                                key={`${p.kind}-${p.slug}`}
                                href={localizeHref(
                                    locale,
                                    `/${destinationSlug}/${p.slug}`
                                )}
                                label={p.name}
                            />
                        ))}
                    </Group>
                )}

                {/* 3. Category Quick Links. */}
                {categoryChips.length > 0 && (
                    <Group title={dict.browseByType}>
                        {categoryChips.map(c => (
                            <Chip key={c.slug} href={c.href} label={c.name} />
                        ))}
                    </Group>
                )}

                {/* 4. See all {Destination} tours. */}
                {destinationSlug && destinationName && (
                    <Link
                        href={localizeHref(
                            locale,
                            `/${destinationSlug}/tours`
                        )}
                        className='w-fit text-[14px] font-bold leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors hover:text-it-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                        {dict.seeAllDestinationTours.replace(
                            '{destination}',
                            destinationName
                        )}{' '}
                        →
                    </Link>
                )}
            </div>
        </section>
    );
}
