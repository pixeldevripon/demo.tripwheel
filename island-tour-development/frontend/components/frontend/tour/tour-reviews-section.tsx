'use client';

import {
    MotionButton,
    MotionDiv,
} from '@/components/frontend/motion-primitives';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useScrollHintNudge } from '@/hooks/use-scroll-hint-nudge';
import { reviewerLead } from '@/lib/reviews/review-view';
import { fetchTourReviews, PHOTO_STRIP_LIMIT } from '@/lib/api/reviews';
import { type Locale } from '@/lib/constants/locales';
import { dragGlide, springPop } from '@/lib/motion';
import { toFullReview } from '@/lib/reviews/review-view';
import type { ReviewFacet, ReviewSort, ThemeFacet } from '@/types/review';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type ReviewHistogramRow = { stars: number; count: number };

export type ReviewResponse = { text: string; name: string; date: string };

export type FullReview = {
    id: string;
    /** Whole-star rating 0-5. */
    rating: number;
    name: string;
    date: string;
    text: string;
    /** Attached photo URLs. */
    photos?: string[];
    /** Optional operator response. */
    response?: ReviewResponse;
    /** Booking-gated (FE-5). Always true at launch - only booked guests can review. */
    verified: boolean;
    /** Localized country name; '' when the reviewer gave none. */
    country: string;
    /** Localized travel month, e.g. "March 2026". '' when unknown (FE-8). */
    travelLabel: string;
    /** Raw guest type (`COUPLE`|`FAMILY`|`FRIENDS`|`SOLO`) or null; localized here. */
    guestType: string | null;
    /** LD32: `text` is machine output rather than the guest's own words. */
    isMachineTranslated: boolean;
    /** The guest's own words, for the show-original toggle. */
    originalText: string | null;
    /** Language the guest wrote in, in the reader's language ("Dutch"). */
    originalLanguage: string;
};

export type TourReviewsSectionDict = {
    title: string;
    subtitle: string;
    /** "{count} reviews" */
    reviewsCount: string;
    sortBy: string;
    sortNewest: string;
    sortRatingHigh: string;
    sortRatingLow: string;
    sortHelpful: string;
    showMore: string;
    loading: string;
    empty: string;
    /** FE-5 badge + its disclosure tooltip. */
    verified: string;
    verifiedTooltip: string;
    /** FE-8 "Travelled {month}" and the guest-type labels. */
    guestCouple: string;
    guestFamily: string;
    guestFriends: string;
    guestSolo: string;
    /** FE-3/FE-9 filtering. */
    filterStars: string;
    filterStarsOne: string;
    clearFilter: string;
    noMatch: string;
    /** FE-10 photo carousel. */
    photosTitle: string;
    /** FE-7a/b low-volume + LD11 fallback copy. */
    operatorFallback: string;
    earlyReviews: string;
    /** FE-11 Omnibus disclosure link. */
    howWeHandle: string;
    /** Phase 7 photo-forward cards. */
    photoOpen: string;
    photoClose: string;
    /** Lightbox prev/next navigation. */
    photoPrev: string;
    photoNext: string;
    /** Phase 7 depth filters. */
    filterGuest: string;
    filterLanguage: string;
    filterWithPhotos: string;
    filterAny: string;
    /** Author label for a PLATFORM-authored response (LD37). */
    responseByPlatform: string;
    /** FE-6 LD32 translation label + toggle. */
    translatedBy: string;
    showOriginal: string;
    showTranslation: string;
};

// No "Most helpful" option: helpful votes are deferred to V2 by the master, and
// the endpoint that backed them took no identity at all, so the counter was
// forgeable. `sortHelpful` stays in the dict (unused) so re-enabling it in V2 is
// not a seven-locale copy change.
const SORT_OPTIONS: {
    value: ReviewSort;
    labelKey: keyof TourReviewsSectionDict;
}[] = [
    { value: 'newest', labelKey: 'sortNewest' },
    { value: 'rating_desc', labelKey: 'sortRatingHigh' },
    { value: 'rating_asc', labelKey: 'sortRatingLow' },
];

/** LD31: the star distribution chart renders at 3 or more reviews. */
const MIN_REVIEWS_FOR_CHART = 3;
/** LD30: the sort control is hidden under 10 reviews. */
const MIN_REVIEWS_FOR_SORT = 10;
/** LD30: the theme-chip filter bar needs 20 - below that a chip selects a handful. */
const MIN_REVIEWS_FOR_FILTERS = 20;
/**
 * FE-10: the photo carousel needs 3 reviews WITH photos, not 3 photos. One
 * guest's three snapshots are one opinion; a strip implies several.
 */
const MIN_PHOTO_REVIEWS = 3;

/** Guest-type code -> dictionary key. Unknown codes render nothing. */
const GUEST_TYPE_KEYS: Record<string, keyof TourReviewsSectionDict> = {
    COUPLE: 'guestCouple',
    FAMILY: 'guestFamily',
    FRIENDS: 'guestFriends',
    SOLO: 'guestSolo',
};

/** Locale code -> its name in the READER's language ("nl" -> "Dutch"). */
function languageLabel(code: string, locale: Locale): string {
    try {
        return (
            new Intl.DisplayNames([locale], { type: 'language' }).of(code) ??
            code
        );
    } catch {
        return code;
    }
}

/**
 * Full reviews section (Figma node 47936:3804) - the `#tour-reviews` target of
 * the detail tab nav (the preview strip's "See all reviews" scrolls here). Unlike
 * the other detail sections it is NOT collapsible.
 *
 * Dynamic + paginated: seeded server-side with the first page, it fetches further
 * pages on "Show more" and re-fetches from page 1 when the sort or a filter
 * changes, hitting the public `GET /reviews` endpoint directly (no auth). Header
 * aggregate, star histogram, theme facets and the photo count come from the
 * review summary; the photo strip itself is aggregated from the loaded reviews.
 *
 * Both filters (star bar, theme chip) round-trip to the server rather than
 * filtering what is already loaded - a client-side filter would only ever see
 * the pages fetched so far, so "4 stars" would mean something different from one
 * scroll depth to the next, and the count beside it would be a lie.
 */
export function TourReviewsSection({
    tourId,
    locale,
    rating,
    reviewCount,
    ownReviewCount,
    ratingSource,
    operatorName,
    histogram,
    themes,
    guestTypes,
    languages,
    photoCount,
    stripPhotos,
    initialReviews,
    total,
    pageSize,
    hostLabel,
    explainerHref,
    dict,
}: {
    tourId: string;
    locale: Locale;
    /** DISPLAYED rating - the tour's own, or the operator's under LD11. */
    rating: number;
    /** Count behind the displayed rating (the operator's when borrowed). */
    reviewCount: number;
    /**
     * The tour's OWN approved count, which is what the LD30/LD31 thresholds are
     * about. A tour borrowing an operator's rating has no distribution of its own
     * to chart and nothing to sort, however large `reviewCount` looks.
     */
    ownReviewCount: number;
    /** Which entity the displayed rating belongs to (LD11). */
    ratingSource: 'tour' | 'operator' | 'none';
    /** Operator display name, for the LD11 fallback sentence. */
    operatorName: string;
    histogram: ReviewHistogramRow[];
    themes: ThemeFacet[];
    /** Phase 7 depth facets - only options that return something. */
    guestTypes: ReviewFacet[];
    languages: ReviewFacet[];
    /** Approved reviews carrying photos - the FE-10 carousel gate. */
    photoCount: number;
    /**
     * EVERY guest photo for the tour (server-fetched withPhotos, capped at
     * PHOTO_STRIP_LIMIT) - so the strip is not limited to whatever page of
     * reviews happens to be loaded. Falls back to aggregating the loaded
     * reviews when absent.
     */
    stripPhotos?: string[];
    initialReviews: FullReview[];
    total: number;
    pageSize: number;
    hostLabel: string;
    /** Locale-prefixed href of the "How we handle reviews" explainer (FE-11). */
    explainerHref: string;
    dict: TourReviewsSectionDict;
}) {
    const [reviews, setReviews] = useState<FullReview[]>(initialReviews);
    const [sort, setSort] = useState<ReviewSort>('newest');
    const [loadedPages, setLoadedPages] = useState(1);
    const [loading, setLoading] = useState(false);
    // Server-side filters. `matchTotal` is the count for the CURRENT filter, which
    // is why it is state and not the `total` prop - the prop is the unfiltered
    // seed and must stay put so clearing a filter restores the right paging.
    const [starFilter, setStarFilter] = useState<number | null>(null);
    const [themeFilter, setThemeFilter] = useState<string | null>(null);
    // Phase 7 depth filters. Same round-trip model as the star bar and chips.
    const [guestFilter, setGuestFilter] = useState<string | null>(null);
    const [photoFilter, setPhotoFilter] = useState(false);
    const [languageFilter, setLanguageFilter] = useState<string | null>(null);
    const [matchTotal, setMatchTotal] = useState(total);
    /** Index of the strip photo opened in the lightbox, or null. */
    const [stripLightbox, setStripLightbox] = useState<number | null>(null);
    // The strip is a framer drag track (mouse AND touch): real momentum on
    // release instead of raw scrollLeft writes fighting the scroll snap.
    // The viewport ref doubles as the drag constraint box.
    const stripViewportRef = useRef<HTMLDivElement>(null);
    // True while (and just after) a drag - a tile click at drag-end must not
    // open the lightbox. Cleared a tick later so a real tap still works.
    const stripDragging = useRef(false);

    /**
     * Hydration marker, for tests and for anything that needs to know this
     * section is live rather than streamed-but-inert.
     *
     * This boundary streams, and React's streaming SSR parks a SECOND, hidden
     * copy of the content in the DOM until it swaps the real one in. Both match
     * `#tour-reviews`, DOM order between them is not stable, and the hidden copy
     * has no layout box - so positional or visibility-based selection is flaky
     * by construction. The holding-pen copy is never HYDRATED, though, so an
     * effect can only ever run on the live one. Waiting on this attribute also
     * waits for interactivity, which is what a click test actually needs.
     */
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);

    const isFiltered =
        starFilter !== null ||
        themeFilter !== null ||
        guestFilter !== null ||
        photoFilter ||
        languageFilter !== null;
    const hasMore = reviews.length < matchTotal;
    const showChart = ownReviewCount >= MIN_REVIEWS_FOR_CHART;
    const showSort = ownReviewCount >= MIN_REVIEWS_FOR_SORT;
    const pastFilterGate = ownReviewCount >= MIN_REVIEWS_FOR_FILTERS;
    const showThemeChips = pastFilterGate && themes.length > 0;
    // A one-option filter is not a filter - it can only ever be a no-op or an
    // empty list, so it is never offered.
    const showGuestFilter = pastFilterGate && guestTypes.length > 1;
    const showLanguageFilter = pastFilterGate && languages.length > 1;
    const showPhotoFilter = pastFilterGate && photoCount > 0;
    const showPhotoStrip = photoCount >= MIN_PHOTO_REVIEWS;
    /**
     * FE-7b low-volume state, keyed off `'none'` rather than `'tour'`.
     *
     * LD11 returns `source: 'tour'` ONLY at >= 3 approved reviews, so a
     * "1-2 of the tour's own reviews" state can never carry a tour rating -
     * a `ratingSource === 'tour' && count <= 2` test is unreachable by
     * construction. The state that DOES exist is a tour with 1-2 reviews whose
     * operator is not established enough to lend one: reviews to show, no
     * qualifying rating. That case previously rendered `rating ?? 0` as a
     * literal "0.0" next to a star, so a tour with two five-star reviews
     * advertised itself as zero-rated.
     */
    const isEarly = ratingSource === 'none' && ownReviewCount > 0;
    // Prefer the server-fetched full photo set (every review's photos, not just
    // the loaded page's); the loaded-page aggregate is only the fallback.
    const photoStrip = showPhotoStrip
        ? (stripPhotos && stripPhotos.length > 0
              ? stripPhotos
              : reviews.flatMap(r => r.photos ?? [])
          ).slice(0, PHOTO_STRIP_LIMIT)
        : [];

    /**
     * The active filter set, as ONE object.
     *
     * Positional parameters stopped scaling at five filters - every new one
     * meant touching every call site, and a mis-ordered argument would have
     * silently filtered by the wrong thing. Handlers pass an override rather
     * than the whole set, so adding a filter is a one-line change here.
     */
    type ReviewFilters = {
        star: number | null;
        theme: string | null;
        guest: string | null;
        photos: boolean;
        language: string | null;
    };

    const activeFilters: ReviewFilters = {
        star: starFilter,
        theme: themeFilter,
        guest: guestFilter,
        photos: photoFilter,
        language: languageFilter,
    };

    async function loadPage(
        page: number,
        nextSort: ReviewSort,
        f: ReviewFilters,
        append: boolean
    ) {
        setLoading(true);
        try {
            const res = await fetchTourReviews({
                tourId,
                locale,
                sort: nextSort,
                page,
                limit: pageSize,
                ...(f.star !== null && { rating: f.star }),
                ...(f.theme !== null && { themeTag: f.theme }),
                ...(f.guest !== null && { reviewerType: f.guest }),
                ...(f.photos && { withPhotos: true }),
                ...(f.language !== null && { writtenIn: f.language }),
            });
            const mapped = res.data.map(r =>
                toFullReview(r, locale, hostLabel, dict.responseByPlatform)
            );
            setReviews(prev => (append ? [...prev, ...mapped] : mapped));
            setMatchTotal(res.total);
            setLoadedPages(page);
        } catch {
            // Keep whatever is already shown; the button/control stays for retry.
        } finally {
            setLoading(false);
        }
    }

    /** Apply one filter change and refetch from page 1. */
    function applyFilter(patch: Partial<ReviewFilters>) {
        if (loading) return;
        const next = { ...activeFilters, ...patch };
        setStarFilter(next.star);
        setThemeFilter(next.theme);
        setGuestFilter(next.guest);
        setPhotoFilter(next.photos);
        setLanguageFilter(next.language);
        void loadPage(1, sort, next, false);
    }

    function handleSortChange(next: ReviewSort) {
        if (next === sort || loading) return;
        setSort(next);
        void loadPage(1, next, activeFilters, false);
    }

    function handleShowMore() {
        if (loading || !hasMore) return;
        void loadPage(loadedPages + 1, sort, activeFilters, true);
    }

    /** Clicking the active option clears it - every control is its own toggle. */
    function handleStarClick(stars: number) {
        applyFilter({ star: starFilter === stars ? null : stars });
    }

    function handleThemeClick(tag: string) {
        applyFilter({ theme: themeFilter === tag ? null : tag });
    }

    function handleClearFilters() {
        applyFilter({
            star: null,
            theme: null,
            guest: null,
            photos: false,
            language: null,
        });
    }

    // FE-7b: a tour with no reviews and no operator rating to borrow renders NO
    // section at all. An empty "no reviews yet" block is a hole in the page that
    // says the tour is untested; the "New" badge carries that far better. The
    // caller drops the nav tab in the same condition, so nothing links here.
    if (total === 0 && ratingSource === 'none') return null;

    const starLabel = (stars: number) =>
        (stars === 1 ? dict.filterStarsOne : dict.filterStars).replace(
            '{stars}',
            String(stars)
        );

    return (
        <section
            id='tour-reviews'
            data-hydrated={hydrated ? 'true' : undefined}
            // `max-md:not-first:mt-2` mirrors `TourSection`: this is the last
            // block in the same stack but builds its own <section>, so without
            // it the reviews seam stayed 34px on mobile while every seam above
            // opened to 42 (Pastel #34).
            className='flex scroll-mt-36 flex-col gap-8 max-md:not-first:mt-2'>
            {/* Header + rating summary */}
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <h2 className='m-0 text-[21px] md:text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {dict.title}
                    </h2>
                    <p className='m-0 flex flex-wrap items-center gap-[7px] text-[14.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        <Image
                            src='/icons/trust-check-green.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-3.5 shrink-0'
                        />
                        {dict.subtitle}{' '}
                        {/* Omnibus Art. 7(6): the "how we verify" disclosure has to
                            be reachable from where the reviews are shown (FE-11). */}
                        <Link
                            href={explainerHref}
                            className='underline underline-offset-2 transition-colors hover:text-it-primary tracking-[-0.012em]'>
                            {dict.howWeHandle}
                        </Link>
                    </p>
                </div>

                <div className='grid items-center gap-6 sm:grid-cols-[150px_1fr] sm:gap-[26px]'>
                    {/* LD11: when the rating is BORROWED from the operator, say so
                        in words. Showing an operator's 4.8 under a tour heading
                        with no explanation is the whole reason LD11 needed a
                        display rule and not just a fallback value. */}
                    {ratingSource === 'operator' ? (
                        <p className='m-0 max-w-160 text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {dict.operatorFallback
                                .replace('{operator}', operatorName)
                                .replace('{rating}', rating.toFixed(1))
                                .replace('{count}', String(reviewCount))}
                        </p>
                    ) : isEarly ? (
                        // FE-7b. Deliberately NO star and NO number: LD11 has
                        // declined to show a rating for this tour, and printing
                        // one anyway - even the honest average of two reviews -
                        // is the exact thing the 3-review threshold exists to
                        // prevent. The reviews themselves are still listed below.
                        <p className='m-0 text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.earlyReviews.replace(
                                '{count}',
                                String(ownReviewCount)
                            )}
                        </p>
                    ) : (
                        // Only reachable with `source === 'tour'`, which LD11
                        // guarantees means >= 3 reviews and a real rating.
                        <div className='flex flex-col'>
                            <div className='m-0 font-it-display text-[35px] font-medium leading-none tracking-[-0.012em] text-it-heading'>
                                <span className='align-[6px] text-[22.5px] text-it-star tracking-[-0.012em]'>
                                    ★
                                </span>{' '}
                                {rating.toFixed(1)}
                            </div>
                            <div className='mt-1 text-[11.5px] leading-[1.6] text-it-text-muted tabular-nums tracking-[-0.012em]'>
                                {dict.reviewsCount.replace(
                                    '{count}',
                                    String(reviewCount)
                                )}
                            </div>
                        </div>
                    )}

                    {/* Histogram (LD31) - renders at 3 or more of the tour's OWN
                        reviews, and each bar is a filter (FE-3). The denominator
                        is `ownReviewCount`, never `reviewCount`: under LD11 the
                        latter can be the operator's, which would scale every bar
                        against the wrong total. */}
                    {showChart && (
                        <div className='flex max-w-91 flex-col gap-[5px]'>
                            {histogram.map(row => {
                                const active = starFilter === row.stars;
                                return (
                                    <MotionButton
                                        key={row.stars}
                                        type='button'
                                        onClick={() =>
                                            handleStarClick(row.stars)
                                        }
                                        disabled={loading || row.count === 0}
                                        aria-pressed={active}
                                        aria-label={starLabel(row.stars)}
                                        whileTap={{ scale: 0.98 }}
                                        transition={springPop}
                                        className={`flex cursor-pointer items-center gap-3 rounded-it-full px-2 py-0.5 text-left transition-colors hover:bg-it-surface disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent ${
                                            active ? 'bg-it-surface' : ''
                                        }`}>
                                        <span className='w-[46px] shrink-0 text-left text-[11.5px] leading-[1.6] text-it-text-muted tabular-nums tracking-[-0.012em]'>
                                            {starLabel(row.stars)}
                                        </span>
                                        <span className='relative h-[7px] flex-1 overflow-hidden rounded-it-full bg-it-divider'>
                                            <span
                                                className={`absolute inset-y-0 left-0 rounded-it-full transition-colors ${
                                                    active
                                                        ? 'bg-it-ink'
                                                        : 'bg-it-star'
                                                }`}
                                                style={{
                                                    width: `${ownReviewCount ? (row.count / ownReviewCount) * 100 : 0}%`,
                                                }}
                                            />
                                        </span>
                                        <span className='w-[26px] shrink-0 text-right text-[11.5px] leading-[1.6] text-it-text-muted tabular-nums tracking-[-0.012em]'>
                                            {row.count}
                                        </span>
                                    </MotionButton>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Theme chips (FE-9, gated at 20 by LD30) */}
            {showThemeChips && (
                <div className='flex flex-wrap gap-2'>
                    {themes.map(theme => {
                        const active = themeFilter === theme.tag;
                        return (
                            <MotionButton
                                key={theme.tag}
                                type='button'
                                onClick={() => handleThemeClick(theme.tag)}
                                disabled={loading}
                                aria-pressed={active}
                                whileTap={{ scale: 0.95 }}
                                transition={springPop}
                                className={`cursor-pointer rounded-it-full border px-4 py-2 text-[13px] leading-[1.6] tracking-[-0.012em] transition-colors disabled:cursor-default disabled:opacity-60 ${
                                    active
                                        ? 'border-it-heading bg-it-heading text-it-white tracking-[-0.012em]'
                                        : 'border-it-border bg-it-white text-it-heading hover:border-it-heading tracking-[-0.012em]'
                                }`}>
                                {theme.tag}
                                <span className='ml-2 opacity-60'>
                                    {theme.count}
                                </span>
                            </MotionButton>
                        );
                    })}
                </div>
            )}

            {/* Depth filters (Phase 7), same 20-review LD30 gate as the chips.
                Each control offers only values the facets say will return
                something, so a filter is never a dead end. */}
            {(showGuestFilter || showLanguageFilter || showPhotoFilter) && (
                <div className='flex flex-wrap items-center gap-3'>
                    {showGuestFilter && (
                        <label className='flex items-center gap-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.filterGuest}
                            <select
                                value={guestFilter ?? ''}
                                disabled={loading}
                                onChange={e =>
                                    applyFilter({
                                        guest: e.target.value || null,
                                    })
                                }
                                className='cursor-pointer rounded-it-full border border-it-border bg-it-white px-4 py-1.5 text-[14.5px] md:text-[13px] text-it-heading disabled:cursor-default disabled:opacity-60 tracking-[-0.012em]'>
                                <option value=''>{dict.filterAny}</option>
                                {guestTypes.map(g => (
                                    <option key={g.value} value={g.value}>
                                        {
                                            (dict[GUEST_TYPE_KEYS[g.value]] ??
                                                g.value) as string
                                        }{' '}
                                        ({g.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {showLanguageFilter && (
                        <label className='flex items-center gap-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.filterLanguage}
                            <select
                                value={languageFilter ?? ''}
                                disabled={loading}
                                onChange={e =>
                                    applyFilter({
                                        language: e.target.value || null,
                                    })
                                }
                                className='cursor-pointer rounded-it-full border border-it-border bg-it-white px-4 py-1.5 text-[14.5px] md:text-[13px] text-it-heading disabled:cursor-default disabled:opacity-60 tracking-[-0.012em]'>
                                <option value=''>{dict.filterAny}</option>
                                {languages.map(l => (
                                    <option key={l.value} value={l.value}>
                                        {languageLabel(l.value, locale)} (
                                        {l.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {showPhotoFilter && (
                        <MotionButton
                            type='button'
                            onClick={() =>
                                applyFilter({ photos: !photoFilter })
                            }
                            disabled={loading}
                            aria-pressed={photoFilter}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className={`cursor-pointer rounded-it-full border px-4 py-2 text-[13px] leading-[1.6] tracking-[-0.012em] transition-colors disabled:cursor-default disabled:opacity-60 ${
                                photoFilter
                                    ? 'border-it-heading bg-it-heading text-it-white tracking-[-0.012em]'
                                    : 'border-it-border bg-it-white text-it-heading hover:border-it-heading tracking-[-0.012em]'
                            }`}>
                            {dict.filterWithPhotos}
                            <span className='ml-2 opacity-60'>
                                {photoCount}
                            </span>
                        </MotionButton>
                    )}
                </div>
            )}

            {/* Active-filter row + sort. Both live on one line so the filter state
                is never off-screen while the list below it is filtered. */}
            {(isFiltered || showSort) && (
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    {isFiltered ? (
                        <div className='flex flex-wrap items-center gap-3'>
                            {starFilter !== null && (
                                <span className='flex items-center gap-2 rounded-it-full bg-it-surface px-4 py-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {starLabel(starFilter)}
                                </span>
                            )}
                            {themeFilter !== null && (
                                <span className='flex items-center gap-2 rounded-it-full bg-it-surface px-4 py-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {themeFilter}
                                </span>
                            )}
                            <MotionButton
                                type='button'
                                onClick={handleClearFilters}
                                disabled={loading}
                                whileTap={{ scale: 0.95 }}
                                transition={springPop}
                                className='cursor-pointer text-[13px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 disabled:cursor-default disabled:opacity-60'>
                                {dict.clearFilter}
                            </MotionButton>
                        </div>
                    ) : (
                        <span />
                    )}

                    {/* Sort control (LD30) - hidden under 10 of the tour's own
                        reviews; below that there is not enough to reorder for it
                        to mean anything. */}
                    {showSort && (
                        <div className='flex items-center gap-8'>
                            <span className='text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {dict.sortBy}
                            </span>
                            <div className='relative'>
                                <select
                                    value={sort}
                                    onChange={e =>
                                        handleSortChange(
                                            e.target.value as ReviewSort
                                        )
                                    }
                                    disabled={loading}
                                    aria-label={dict.sortBy}
                                    className='cursor-pointer appearance-none rounded-it-full border border-it-border bg-it-white py-2 pr-12 pl-6 text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-heading disabled:cursor-default disabled:opacity-60'>
                                    {SORT_OPTIONS.map(opt => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}>
                                            {dict[opt.labelKey]}
                                        </option>
                                    ))}
                                </select>
                                <Image
                                    src='/icons/caret-down.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className='pointer-events-none absolute top-1/2 right-4 size-5 shrink-0 -translate-y-1/2'
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Customer photo carousel (FE-10) - gated on 3+ reviews WITH photos,
                and hidden while filtered, since the strip is aggregated from the
                loaded page and would otherwise silently become "photos matching
                this filter" under a heading that says otherwise. */}
            {photoStrip.length > 0 && !isFiltered && (
                <div className='flex flex-col gap-3'>
                    <h3 className='m-0 font-medium text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {dict.photosTitle}
                    </h3>
                    {/* Circle tiles (founder call 2026-08-02): the strip is a
                        teaser, and the lightbox shows the full uncropped
                        photo. Click opens it. The row is a framer drag track
                        (founder 2026-08-02: raw scrollLeft writes fought the
                        scroll snap and felt laggy) - one physics model for
                        mouse AND touch, with real momentum on release.
                        touch-action pan-y keeps vertical page scroll native
                        on mobile while the track owns the horizontal axis. */}
                    <div ref={stripViewportRef} className='overflow-hidden'>
                        <MotionDiv
                            drag='x'
                            dragConstraints={stripViewportRef}
                            dragElastic={0.12}
                            dragTransition={dragGlide}
                            onDragStart={() => {
                                stripDragging.current = true;
                            }}
                            onDragEnd={() => {
                                // Cleared a tick later: the click that follows
                                // a drag-release must still see "dragging".
                                setTimeout(() => {
                                    stripDragging.current = false;
                                }, 60);
                            }}
                            className='flex w-max gap-2'
                            style={{ touchAction: 'pan-y' }}>
                            {photoStrip.map((src, i) => (
                                <button
                                    key={`${src}-${i}`}
                                    type='button'
                                    onClick={() => {
                                        if (stripDragging.current) return;
                                        setStripLightbox(i);
                                    }}
                                    aria-label={dict.photoOpen}
                                    className='relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-it-full border-0 bg-it-border p-0'>
                                    <Image
                                        src={src}
                                        alt=''
                                        fill
                                        sizes='80px'
                                        // Framer needs the pointer stream - a native
                                        // image drag would cancel it mid-gesture.
                                        draggable={false}
                                        className='pointer-events-none object-cover transition-opacity duration-300 hover:opacity-90'
                                    />
                                </button>
                            ))}
                        </MotionDiv>
                    </div>
                    {stripLightbox !== null && photoStrip[stripLightbox] && (
                        <PhotoLightbox
                            photos={photoStrip}
                            index={stripLightbox}
                            onClose={() => setStripLightbox(null)}
                            onIndexChange={setStripLightbox}
                            dict={dict}
                        />
                    )}
                </div>
            )}

            {/* Review cards, or the filtered-to-nothing state. The two empty
                states are deliberately different: "no reviews" is about the tour,
                "no matches" is about the filter the guest just set, and offering
                "clear" on the former would be nonsense. */}
            {reviews.length === 0 ? (
                <div className='flex flex-col items-start gap-3'>
                    <p className='m-0 text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {isFiltered ? dict.noMatch : dict.empty}
                    </p>
                    {isFiltered && (
                        <MotionButton
                            type='button'
                            onClick={handleClearFilters}
                            disabled={loading}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className='cursor-pointer text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 disabled:cursor-default disabled:opacity-60'>
                            {dict.clearFilter}
                        </MotionButton>
                    )}
                </div>
            ) : (
                <div className='flex flex-col gap-4'>
                    {reviews.map(review => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            dict={dict}
                        />
                    ))}
                </div>
            )}

            {/* Show more */}
            {hasMore && (
                <MotionButton
                    type='button'
                    onClick={handleShowMore}
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    transition={springPop}
                    className='flex w-fit cursor-pointer items-center justify-center self-center rounded-it-full border border-it-primary bg-transparent px-10 py-[10px] font-medium text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5 disabled:cursor-default disabled:opacity-60'>
                    {loading ? dict.loading : dict.showMore}
                </MotionButton>
            )}
        </section>
    );
}

function ReviewCard({
    review,
    dict,
}: {
    review: FullReview;
    dict: TourReviewsSectionDict;
}) {
    // LD32 toggle state is PER CARD, not section-wide: a reader who wants to see
    // one guest's own words has said nothing about the next guest's.
    const [showingOriginal, setShowingOriginal] = useState(false);
    /** Index of the photo opened full-size, or null. */
    const [lightbox, setLightbox] = useState<number | null>(null);
    const photoRowRef = useDragScroll<HTMLDivElement>();
    // Sitewide announce-itself nudge (mck-16 §4.8). One `groupId` across every
    // review card: the first overflowing photo row on screen hints for all of
    // them - a wiggle per card would be noise, not an announcement.
    useScrollHintNudge(photoRowRef, { groupId: 'review-photos' });
    const hasPhotos = Boolean(review.photos && review.photos.length > 0);
    const canToggle =
        review.isMachineTranslated && Boolean(review.originalText);
    const body =
        showingOriginal && review.originalText
            ? review.originalText
            : review.text;

    const guestKey = review.guestType
        ? GUEST_TYPE_KEYS[review.guestType]
        : undefined;
    const guestLabel = guestKey ? dict[guestKey] : '';
    /*
     * THE SAME REVIEWER LINE AS THE PREVIEW CARDS (Pastel #55: "so the page has
     * one format"), composed by the shared helper: `Name · Country · Month Year`.
     *
     * The month moved UP into it, so the second line is the guest type alone.
     * It used to read "Travelled in July 2026" down there while the preview
     * card said "July 2026" up here - the same fact, said twice, differently.
     */
    const lead = reviewerLead({
        name: review.name,
        country: review.country,
        when: review.date,
    });

    return (
        <article className='flex flex-col gap-3 border-t border-it-divider py-4'>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2.5'>
                    <span
                        aria-hidden='true'
                        className='grid size-[34px] shrink-0 place-items-center rounded-it-full bg-it-bg text-[11.5px] font-medium text-it-primary-hover tracking-[-0.012em]'>
                        {review.name
                            .split(/\s+/)
                            .map(part => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                    </span>
                    <div className='flex flex-col text-it-text-muted tracking-[-0.012em]'>
                        <span className='flex flex-wrap items-center gap-x-2'>
                            <b className='text-[12.5px] font-medium text-it-heading tracking-[-0.012em]'>
                                {review.name}
                            </b>
                            {lead.slice(1).join(' · ')}
                            {/* FE-5. A native `title` rather than a hand-rolled
                                popover: it is the disclosure of last resort and
                                must work with no JS, and the full Omnibus
                                explanation already has a linked page of its own. */}
                            {review.verified && (
                                <span
                                    title={dict.verifiedTooltip}
                                    className='cursor-help'>
                                    · {dict.verified}
                                </span>
                            )}
                        </span>
                        <span className='flex flex-wrap items-center gap-x-2'>
                            <span
                                aria-label={`${review.rating} / 5`}
                                className='text-[11.5px] tracking-[1px] text-it-star'>
                                {'★'.repeat(review.rating)}
                            </span>
                            {/* Guest type only - the travel month is in the
                                reviewer line above now. */}
                            {guestLabel && <span>{guestLabel}</span>}
                        </span>
                    </div>
                </div>
                {/* Photo-forward (Phase 7). A guest's own photo is the most
                    persuasive thing on the card, and it used to sit BELOW the
                    text at thumbnail size where it read as an afterthought.
                    Leading with it - and at a size you can actually see - is
                    the whole point of the "photo-forward" item.
                    Horizontal scroll rather than wrap: a review with four
                    photos should not push the next card off the fold. */}
                {hasPhotos && (
                    <div
                        ref={photoRowRef}
                        className='-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                        {review.photos!.map((src, i) => (
                            <button
                                key={`${src}-${i}`}
                                type='button'
                                onClick={() => setLightbox(i)}
                                aria-label={dict.photoOpen}
                                className='relative aspect-[4/3] w-40 shrink-0 cursor-pointer snap-start overflow-hidden rounded-[12px] border-0 bg-it-border p-0 sm:w-52'>
                                <Image
                                    src={src}
                                    alt=''
                                    fill
                                    sizes='(min-width: 640px) 208px, 160px'
                                    className='object-cover transition-opacity duration-300 hover:opacity-90'
                                />
                            </button>
                        ))}
                    </div>
                )}

                <p className='m-0 mt-1 text-[14.5px] leading-[1.6] text-it-heading tracking-[-0.012em]'>
                    {body}
                </p>

                {/* FE-6a. Attribution is not optional politeness: presenting
                    machine output as a guest's own words misstates who said it,
                    and the toggle is what makes the claim checkable. Both texts
                    are already in the payload, so this never refetches and there
                    is no per-review translation URL to index (FE-6b). */}
                {canToggle && (
                    <div className='flex flex-wrap items-center gap-2 text-[12px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {!showingOriginal && <span>{dict.translatedBy}</span>}
                        <MotionButton
                            type='button'
                            onClick={() => setShowingOriginal(v => !v)}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className='cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2'>
                            {showingOriginal
                                ? dict.showTranslation
                                : dict.showOriginal.replace(
                                      '{language}',
                                      review.originalLanguage
                                  )}
                        </MotionButton>
                    </div>
                )}
            </div>

            {review.response && (
                <div className='flex flex-col gap-4'>
                    <div className='flex flex-col gap-3 rounded-it-md bg-it-bg px-4 py-3.5'>
                        <p className='m-0 text-[14.5px] leading-[1.6] text-it-heading tracking-[-0.012em]'>
                            {review.response.text}
                        </p>
                        <div className='flex flex-col'>
                            <span className='font-medium text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {review.response.name}
                            </span>
                            <span className='text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {review.response.date}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            {/* Full-size view. A photo-forward card is only worth it if the
                photo can actually be looked at; the inline tile is a preview. */}
            {lightbox !== null && review.photos?.[lightbox] && (
                <PhotoLightbox
                    photos={review.photos}
                    index={lightbox}
                    onClose={() => setLightbox(null)}
                    onIndexChange={setLightbox}
                    dict={dict}
                />
            )}
        </article>
    );
}

/**
 * Full-size photo view shared by the guest-photo strip and the review cards.
 * Plain fixed overlay rather than a dialog library - it has one job, closes on
 * backdrop click and Escape, and adds no dependency. With more than one photo
 * it pages via the arrow buttons or the keyboard arrows (wrapping), so a set
 * can be browsed without reopening tile by tile.
 */
function PhotoLightbox({
    photos,
    index,
    onClose,
    onIndexChange,
    dict,
}: {
    photos: string[];
    index: number;
    onClose: () => void;
    onIndexChange: (next: number) => void;
    dict: TourReviewsSectionDict;
}) {
    const hasMany = photos.length > 1;
    const goPrev = () =>
        onIndexChange((index - 1 + photos.length) % photos.length);
    const goNext = () => onIndexChange((index + 1) % photos.length);

    return (
        <div
            role='dialog'
            aria-modal='true'
            aria-label={dict.photoOpen}
            tabIndex={-1}
            onClick={onClose}
            onKeyDown={e => {
                if (e.key === 'Escape') onClose();
                else if (hasMany && e.key === 'ArrowLeft') goPrev();
                else if (hasMany && e.key === 'ArrowRight') goNext();
            }}
            // Inline on purpose: the callback's identity changes per render,
            // so React re-runs it on every index change - which re-focuses
            // the dialog after a prev/next button click steals focus, keeping
            // the arrow keys and Escape working. Do not "stabilize" this ref.
            ref={el => el?.focus()}
            className='fixed inset-0 z-100 flex cursor-zoom-out items-center justify-center bg-black/80 p-4'>
            <div className='relative h-full max-h-[80vh] w-full max-w-4xl'>
                <Image
                    src={photos[index]}
                    alt=''
                    fill
                    sizes='100vw'
                    className='object-contain'
                />
            </div>
            {hasMany && (
                <>
                    <button
                        type='button'
                        aria-label={dict.photoPrev}
                        onClick={e => {
                            e.stopPropagation();
                            goPrev();
                        }}
                        className='absolute left-4 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border-0 bg-it-white/90 text-it-heading tracking-[-0.012em]'>
                        <ChevronLeft size={20} strokeWidth={1.5} />
                    </button>
                    <button
                        type='button'
                        aria-label={dict.photoNext}
                        onClick={e => {
                            e.stopPropagation();
                            goNext();
                        }}
                        className='absolute right-4 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border-0 bg-it-white/90 text-it-heading tracking-[-0.012em]'>
                        <ChevronRight size={20} strokeWidth={1.5} />
                    </button>
                    <span className='absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] leading-[1.6] text-white/90 tabular-nums tracking-[-0.012em]'>
                        {index + 1} / {photos.length}
                    </span>
                </>
            )}
            <button
                type='button'
                aria-label={dict.photoClose}
                onClick={onClose}
                className='absolute top-5 right-5 cursor-pointer rounded-it-full border-0 bg-it-white/90 px-4 py-2 text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
                {dict.photoClose}
            </button>
        </div>
    );
}
