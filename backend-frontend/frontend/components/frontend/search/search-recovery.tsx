import { CalendarDays, X } from 'lucide-react';
import Link from 'next/link';

import {
    ExploreTypesRail,
    type ExploreType,
} from '@/components/frontend/destination/explore-types-rail';
import { SectionHead } from '@/components/frontend/section-head';
import {
    TourCard,
    type TourCardDict,
    type TourListing,
} from '@/components/frontend/tour-card';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { TOUR_CARD_GRID } from '@/lib/tours/listing';
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
    /** Zero-state kicker when a DATE is what emptied the search. */
    noMatchesOnDate: string;
    /** Zero-state kicker with no date in play. */
    noMatches: string;
    /** Zero-state heading. */
    tryOneOfThese: string;
    /** Thin-state kicker, carries `{count}`. */
    onlyMatches: string;
    /** Singular of the above - "Only 1 match", not "Only 1 matches". */
    onlyMatchesOne: string;
    /** Thin-state heading. */
    keepLooking: string;
    /** The date-drop line, carries `{count}` and `{query}`. */
    dropDate: string;
    /** Reset every active filter, keeping the term. */
    clearFilters: string;
    /** Inline label before the popular-search links. */
    popularSearches: string;
    /** Carries `{destination}`. */
    seeAllDestinationTours: string;
    /** Carries `{count}` and `{destination}`. */
    seeAllDestinationToursCount: string;
};

/** The "Locals' favorites" head - borrowed whole from the destination page. */
export type LocalsFavouritesDict = {
    kicker: string;
    title: string;
};

/**
 * Below this many island tours, the "See all" link drops the number - a small
 * count reads as scarcity and works against the link. Same rule, same threshold
 * as the destination page's browse CTA.
 */
const COUNT_LINK_THRESHOLD = 20;

/** A removable constraint: the thing that emptied the page, with a way to drop it. */
function ConstraintChip({
    href,
    label,
    icon,
}: {
    href: string;
    label: string;
    icon?: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className='inline-flex w-fit shrink-0 self-start items-center gap-2 rounded-it-full border border-it-primary bg-it-white py-2 pl-3.5 pr-3 text-[12px] font-medium leading-none text-it-primary-hover no-underline transition-colors hover:bg-it-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary tracking-[-0.012em]'>
            {icon}
            {label}
            <X className='size-3.5 shrink-0' strokeWidth={2.5} aria-hidden='true' />
        </Link>
    );
}

/**
 * The search recovery band - the way out of a search that found little or
 * nothing (Pastel #46; the content set is locked in APPLICATION-FEATURES §D.12:
 * "popular-search chips, the Category Quick Links row, and See all {Destination}
 * tours").
 *
 * ONE component for BOTH the thin and the zero state, because they differ only
 * in their kicker and heading and in whether a grid sits above them. Building
 * them separately is how the two drift into saying different things about the
 * same dead end.
 *
 * Laid out as a full-bleed tinted band rather than a card, per the client
 * mockup (mck-12): head + a removable-constraint line, then the popular-search
 * links, the category/hub tile rail, and the island's Locals' favorites. It is
 * a section of the page in its own right, not a notice box floating in one.
 *
 * THE DATE-DROP LINE COMES FIRST, and only when dropping the date would
 * actually bring tours back - the caller re-runs the search without it and
 * passes the real count. Offering "drop the date" when the date is not the
 * problem sends the traveller round a loop to the same empty page.
 */
export function SearchRecovery({
    locale,
    dict,
    localsDict,
    cardDict,
    /** Plural noun after a tile's tour count - the rail's own label ("tours"). */
    toursLabel,
    query,
    /** Formatted date currently filtering the search (e.g. "6 Aug"); null if none. */
    dateLabel,
    /** The same date as `YYYY-MM-DD` - carried onto every link out of here. */
    dateParam,
    /** The same search minus its date, or null when the query had no date. */
    withoutDateHref,
    /** How many tours that date-less search returns. 0 hides the line. */
    withoutDateCount,
    /** The bare term with every filter dropped; null when none are active. */
    clearFiltersHref,
    popular,
    exploreTypes,
    localsFavourites,
    destinationSlug,
    destinationName,
    /** Live tours on the island - numbers the "See all" link when it is worth it. */
    destinationTourCount,
    /** Result count - present for the thin state, omitted for the zero state. */
    thinCount,
}: {
    locale: Locale;
    dict: SearchRecoveryDict;
    localsDict: LocalsFavouritesDict;
    cardDict: TourCardDict;
    toursLabel: string;
    query: string;
    dateLabel: string | null;
    dateParam: string | null;
    withoutDateHref: string | null;
    withoutDateCount: number;
    clearFiltersHref: string | null;
    popular: DestinationPopularLink[];
    exploreTypes: ExploreType[];
    localsFavourites: TourListing[];
    destinationSlug?: string;
    destinationName?: string | null;
    destinationTourCount?: number;
    thinCount?: number;
}) {
    const isThin = thinCount != null;

    /*
     * THE CHOSEN DATE TRAVELS WITH THE TRAVELLER.
     *
     * Every link in this band leaves the search page, and without this the date
     * they picked is silently dropped at the door: they land on a category or
     * an island listing showing every departure, re-pick the same date, and
     * wonder why the site forgot. The listing pages all read `?date=` (it is
     * the same filter model the toolbar writes), so appending it is enough to
     * keep the whole journey on one date.
     *
     * The one link that deliberately does NOT get it is the date-drop chip -
     * removing the date is its entire purpose.
     */
    const withDate = (href: string) =>
        dateParam
            ? `${href}${href.includes('?') ? '&' : '?'}date=${dateParam}`
            : href;

    const kicker = isThin
        ? thinCount === 1
            ? dict.onlyMatchesOne
            : dict.onlyMatches.replace('{count}', String(thinCount))
        : dateLabel
          ? dict.noMatchesOnDate
          : dict.noMatches;
    const heading = isThin ? dict.keepLooking : dict.tryOneOfThese;

    // "See all N Curacao tours" - the closing move of the locked content set,
    // and the one link here that always leads somewhere with tours on it.
    const seeAllHref =
        destinationSlug && destinationName
            ? withDate(localizeHref(locale, `/${destinationSlug}/tours`))
            : null;
    const seeAllLabel =
        destinationName == null
            ? null
            : destinationTourCount && destinationTourCount >= COUNT_LINK_THRESHOLD
              ? dict.seeAllDestinationToursCount
                    .replace('{count}', String(destinationTourCount))
                    .replace('{destination}', destinationName)
              : dict.seeAllDestinationTours.replace(
                    '{destination}',
                    destinationName
                );

    /*
     * THE PILL IS THE STATE; THE SENTENCE IS THE INCENTIVE.
     *
     * The pill shows whenever a date is narrowing this search, because that is
     * the single most likely reason the page is empty and the traveller has to
     * be able to SEE the constraint before they can drop it - the toolbar that
     * would otherwise show it is hidden on the zero state.
     *
     * "and N tours come back" is only printed when tours really do come back.
     * Promising a number we then cannot deliver is worse than saying nothing,
     * so on 0 the pill stands alone and simply offers to remove the date.
     */
    const showDateDrop = withoutDateHref != null && dateLabel != null;

    return (
        <section
            aria-label={heading}
            className='mt-9 bg-it-surface py-11 md:mt-12 md:py-14'>
            <div className='it-container flex flex-col gap-7 md:gap-9'>
                <SectionHead
                    kicker={kicker}
                    title={heading}
                    action={
                        seeAllHref && seeAllLabel ? (
                            <Link
                                href={seeAllHref}
                                className='whitespace-nowrap text-[13px] font-medium text-it-primary-hover underline underline-offset-[3px] max-sm:hidden tracking-[-0.012em]'>
                                {seeAllLabel} →
                            </Link>
                        ) : undefined
                    }
                />

                {/* ── The constraint that emptied the page, and the way to drop
                    it. The date first: it is usually what did it, and it is the
                    only one we can put a number on. */}
                {(showDateDrop || (clearFiltersHref && !isThin)) && (
                    <div className='flex flex-col gap-3'>
                        {showDateDrop && (
                            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
                                <ConstraintChip
                                    href={withoutDateHref}
                                    label={dateLabel}
                                    icon={
                                        <CalendarDays
                                            className='size-4 shrink-0'
                                            strokeWidth={2}
                                            aria-hidden='true'
                                        />
                                    }
                                />
                                {withoutDateCount > 0 && (
                                    <p className='m-0 text-[13px] leading-[1.6] text-it-heading md:text-[13px] tracking-[-0.012em]'>
                                        {dict.dropDate
                                            .replace(
                                                '{count}',
                                                String(withoutDateCount)
                                            )
                                            .replace('{query}', query)}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ZERO STATE ONLY, because that is the only state
                            that needs it: the toolbar is hidden there, so this
                            is the sole way back for someone whose filter
                            emptied the page. On the thin state the toolbar is
                            still up the page with its own "Clear all" beside
                            the chips it would remove - repeating it here is a
                            second button for the same job, in the wrong place.

                            NOT a chip either. A chip stands for one constraint
                            that is currently ON, with an x to take it off; this
                            is the single action that removes all of them, so it
                            reads as the band's other actions do. */}
                        {clearFiltersHref && !isThin && (
                            <Link
                                href={clearFiltersHref}
                                className='w-fit self-start text-[13px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors hover:text-it-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary tracking-[-0.012em]'>
                                {dict.clearFilters}
                            </Link>
                        )}
                    </div>
                )}

                {/* ── Popular searches: one inline run of links, not a chip
                    row. They are alternative TERMS, and reading them as a
                    sentence is faster than scanning a grid of pills. */}
                {popular.length > 0 && destinationSlug && (
                    <p className='m-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-[1.6] tracking-[-0.012em]'>
                        <span className='font-medium text-it-heading tracking-[-0.012em]'>
                            {dict.popularSearches}
                        </span>
                        <span aria-hidden='true' className='text-it-text-muted tracking-[-0.012em]'>
                            :
                        </span>
                        {popular.map((p, i) => (
                            <span
                                key={`${p.kind}-${p.slug}`}
                                className='inline-flex items-center gap-2'>
                                {i > 0 && (
                                    <span
                                        aria-hidden='true'
                                        className='text-it-text-muted tracking-[-0.012em]'>
                                        ·
                                    </span>
                                )}
                                <Link
                                    href={withDate(
                                        localizeHref(
                                            locale,
                                            `/${destinationSlug}/${p.slug}`
                                        )
                                    )}
                                    className='font-medium text-it-heading no-underline underline-offset-[3px] transition-colors hover:text-it-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary tracking-[-0.012em]'>
                                    {p.name}
                                </Link>
                            </span>
                        ))}
                    </p>
                )}

                {/* ── Category Quick Links, as the site's own tile rail. */}
                {exploreTypes.length > 0 && destinationSlug && (
                    <ExploreTypesRail
                        locale={locale}
                        destinationSlug={destinationSlug}
                        categories={exploreTypes}
                        toursLabel={toursLabel}
                        // The band is `bg-it-surface`; the rail's default
                        // fallback is the same grey, so an image-less tile
                        // would disappear into it entirely.
                        tileFallbackClassName='bg-it-white'
                        linkQuery={dateParam ? `date=${dateParam}` : undefined}
                    />
                )}

                {/* ── Locals' favorites: the one group here that is actual
                    tours, so the band ends on something bookable rather than on
                    another list of links. */}
                {localsFavourites.length > 0 && (
                    <div className='mt-2 flex flex-col gap-5'>
                        <SectionHead title={localsDict.title} />
                        <div className={TOUR_CARD_GRID}>
                            {localsFavourites.map(tour => (
                                <TourCard
                                    key={tour.id}
                                    tour={tour}
                                    dict={cardDict}
                                    mobileRow
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* The head's "See all" link is desktop-only (it would crowd the
                    heading on a phone); this is its mobile home. */}
                {seeAllHref && seeAllLabel && (
                    <Link
                        href={seeAllHref}
                        className='w-fit text-[13px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-[3px] sm:hidden tracking-[-0.012em]'>
                        {seeAllLabel} →
                    </Link>
                )}
            </div>
        </section>
    );
}
