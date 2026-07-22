'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { type Locale } from '@/lib/constants/locales';
import { fetchTourReviews } from '@/lib/api/reviews';
import { toFullReview } from '@/lib/reviews/review-view';
import { MotionButton } from '@/components/frontend/motion-primitives';
import { springPop } from '@/lib/motion';
import type { ReviewFacet, ReviewSort, ThemeFacet } from '@/types/review';

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
    travelledIn: string;
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
    /** Phase 7 depth filters. */
    filterGuest: string;
    filterLanguage: string;
    filterWithPhotos: string;
    filterAny: string;
    /** FE-6 LD32 translation label + toggle. */
    translatedBy: string;
    showOriginal: string;
    showTranslation: string;
};

// No "Most helpful" option: helpful votes are deferred to V2 by the master, and
// the endpoint that backed them took no identity at all, so the counter was
// forgeable. `sortHelpful` stays in the dict (unused) so re-enabling it in V2 is
// not a seven-locale copy change.
const SORT_OPTIONS: { value: ReviewSort; labelKey: keyof TourReviewsSectionDict }[] = [
    { value: 'newest', labelKey: 'sortNewest' },
    { value: 'rating_desc', labelKey: 'sortRatingHigh' },
    { value: 'rating_asc', labelKey: 'sortRatingLow' },
];

// Cap the customer-photo strip so a long review set doesn't render hundreds of tiles.
const PHOTO_STRIP_LIMIT = 12;

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
            new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
        );
    } catch {
        return code;
    }
}

function Stars({ rating, size }: { rating: number; size: 16 | 20 }) {
    return (
        <span className={`flex items-center ${size === 16 ? 'gap-1.5' : 'gap-1'}`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Image
                    key={i}
                    src={i < rating ? '/icons/star-listings.svg' : '/icons/star-empty.svg'}
                    alt=''
                    width={size}
                    height={size}
                    className={`${size === 16 ? 'size-4' : 'size-5'} shrink-0`}
                />
            ))}
        </span>
    );
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
    const photoStrip = showPhotoStrip
        ? reviews.flatMap(r => r.photos ?? []).slice(0, PHOTO_STRIP_LIMIT)
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
            const mapped = res.data.map(r => toFullReview(r, locale, hostLabel));
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
        <section id='tour-reviews' className='flex scroll-mt-36 flex-col gap-8'>
            {/* Header + rating summary */}
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.title}
                    </h2>
                    <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.subtitle}{' '}
                        {/* Omnibus Art. 7(6): the "how we verify" disclosure has to
                            be reachable from where the reviews are shown (FE-11). */}
                        <Link
                            href={explainerHref}
                            className='underline underline-offset-2 transition-colors hover:text-it-primary'>
                            {dict.howWeHandle}
                        </Link>
                    </p>
                </div>

                <div className='flex flex-col gap-8'>
                    {/* LD11: when the rating is BORROWED from the operator, say so
                        in words. Showing an operator's 4.8 under a tour heading
                        with no explanation is the whole reason LD11 needed a
                        display rule and not just a fallback value. */}
                    {ratingSource === 'operator' ? (
                        <p className='m-0 max-w-160 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
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
                        <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.earlyReviews.replace(
                                '{count}',
                                String(ownReviewCount)
                            )}
                        </p>
                    ) : (
                        // Only reachable with `source === 'tour'`, which LD11
                        // guarantees means >= 3 reviews and a real rating.
                        <div className='flex items-center gap-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            <span className='flex items-center gap-1'>
                                <Image
                                    src='/icons/star-listings.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className='size-5 shrink-0'
                                />
                                <span className='font-medium'>{rating.toFixed(1)}</span>
                            </span>
                            <span className='size-1 shrink-0 rounded-it-full bg-it-heading' />
                            <span>
                                {dict.reviewsCount.replace(
                                    '{count}',
                                    String(reviewCount)
                                )}
                            </span>
                        </div>
                    )}

                    {/* Histogram (LD31) - renders at 3 or more of the tour's OWN
                        reviews, and each bar is a filter (FE-3). The denominator
                        is `ownReviewCount`, never `reviewCount`: under LD11 the
                        latter can be the operator's, which would scale every bar
                        against the wrong total. */}
                    {showChart && (
                        <div className='flex max-w-91 flex-col gap-1'>
                            {histogram.map(row => {
                                const active = starFilter === row.stars;
                                return (
                                    <MotionButton
                                        key={row.stars}
                                        type='button'
                                        onClick={() => handleStarClick(row.stars)}
                                        disabled={loading || row.count === 0}
                                        aria-pressed={active}
                                        aria-label={starLabel(row.stars)}
                                        whileTap={{ scale: 0.98 }}
                                        transition={springPop}
                                        className={`flex cursor-pointer items-center gap-3 rounded-it-full px-2 py-0.5 text-left transition-colors hover:bg-it-surface disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent ${
                                            active ? 'bg-it-surface' : ''
                                        }`}>
                                        <span className='flex w-9 shrink-0 items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {row.stars}
                                            <Image
                                                src='/icons/star-listings.svg'
                                                alt=''
                                                width={16}
                                                height={16}
                                                className='size-4 shrink-0'
                                            />
                                        </span>
                                        <span className='relative h-2 flex-1 overflow-hidden rounded-it-full bg-[#dddfe3]'>
                                            <span
                                                className={`absolute inset-y-0 left-0 rounded-it-full transition-colors ${
                                                    active
                                                        ? 'bg-it-heading'
                                                        : 'bg-it-primary'
                                                }`}
                                                style={{
                                                    width: `${ownReviewCount ? (row.count / ownReviewCount) * 100 : 0}%`,
                                                }}
                                            />
                                        </span>
                                        <span className='w-6 shrink-0 text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
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
                                className={`cursor-pointer rounded-it-full border px-4 py-2 text-[14px] leading-[1.6] tracking-[-0.012em] transition-colors disabled:cursor-default disabled:opacity-60 ${
                                    active
                                        ? 'border-it-heading bg-it-heading text-it-white'
                                        : 'border-it-border bg-it-white text-it-heading hover:border-it-heading'
                                }`}>
                                {theme.tag}
                                <span className='ml-2 opacity-60'>{theme.count}</span>
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
                        <label className='flex items-center gap-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.filterGuest}
                            <select
                                value={guestFilter ?? ''}
                                disabled={loading}
                                onChange={e =>
                                    applyFilter({ guest: e.target.value || null })
                                }
                                className='cursor-pointer rounded-it-full border border-it-border bg-it-white px-4 py-1.5 text-[14px] text-it-heading disabled:cursor-default disabled:opacity-60'>
                                <option value=''>{dict.filterAny}</option>
                                {guestTypes.map(g => (
                                    <option key={g.value} value={g.value}>
                                        {(dict[GUEST_TYPE_KEYS[g.value]] ??
                                            g.value) as string}{' '}
                                        ({g.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {showLanguageFilter && (
                        <label className='flex items-center gap-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.filterLanguage}
                            <select
                                value={languageFilter ?? ''}
                                disabled={loading}
                                onChange={e =>
                                    applyFilter({
                                        language: e.target.value || null,
                                    })
                                }
                                className='cursor-pointer rounded-it-full border border-it-border bg-it-white px-4 py-1.5 text-[14px] text-it-heading disabled:cursor-default disabled:opacity-60'>
                                <option value=''>{dict.filterAny}</option>
                                {languages.map(l => (
                                    <option key={l.value} value={l.value}>
                                        {languageLabel(l.value, locale)} ({l.count})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {showPhotoFilter && (
                        <MotionButton
                            type='button'
                            onClick={() => applyFilter({ photos: !photoFilter })}
                            disabled={loading}
                            aria-pressed={photoFilter}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className={`cursor-pointer rounded-it-full border px-4 py-2 text-[14px] leading-[1.6] tracking-[-0.012em] transition-colors disabled:cursor-default disabled:opacity-60 ${
                                photoFilter
                                    ? 'border-it-heading bg-it-heading text-it-white'
                                    : 'border-it-border bg-it-white text-it-heading hover:border-it-heading'
                            }`}>
                            {dict.filterWithPhotos}
                            <span className='ml-2 opacity-60'>{photoCount}</span>
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
                                <span className='flex items-center gap-2 rounded-it-full bg-it-surface px-4 py-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {starLabel(starFilter)}
                                </span>
                            )}
                            {themeFilter !== null && (
                                <span className='flex items-center gap-2 rounded-it-full bg-it-surface px-4 py-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {themeFilter}
                                </span>
                            )}
                            <MotionButton
                                type='button'
                                onClick={handleClearFilters}
                                disabled={loading}
                                whileTap={{ scale: 0.95 }}
                                transition={springPop}
                                className='cursor-pointer text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 disabled:cursor-default disabled:opacity-60'>
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
                            <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {dict.sortBy}
                            </span>
                            <div className='relative'>
                                <select
                                    value={sort}
                                    onChange={e =>
                                        handleSortChange(e.target.value as ReviewSort)
                                    }
                                    disabled={loading}
                                    aria-label={dict.sortBy}
                                    className='cursor-pointer appearance-none rounded-it-full border border-it-border bg-it-white py-2 pr-12 pl-6 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading disabled:cursor-default disabled:opacity-60'>
                                    {SORT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
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
                    <h3 className='m-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {dict.photosTitle}
                    </h3>
                    <div className='flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                        {photoStrip.map((src, i) => (
                            <div
                                key={`${src}-${i}`}
                                className='relative size-20 shrink-0 snap-start overflow-hidden rounded-it-full bg-it-border'>
                                <Image
                                    src={src}
                                    alt=''
                                    fill
                                    sizes='80px'
                                    className='object-cover'
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Review cards, or the filtered-to-nothing state. The two empty
                states are deliberately different: "no reviews" is about the tour,
                "no matches" is about the filter the guest just set, and offering
                "clear" on the former would be nonsense. */}
            {reviews.length === 0 ? (
                <div className='flex flex-col items-start gap-3'>
                    <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {isFiltered ? dict.noMatch : dict.empty}
                    </p>
                    {isFiltered && (
                        <MotionButton
                            type='button'
                            onClick={handleClearFilters}
                            disabled={loading}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className='cursor-pointer text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 disabled:cursor-default disabled:opacity-60'>
                            {dict.clearFilter}
                        </MotionButton>
                    )}
                </div>
            ) : (
                <div className='flex flex-col gap-4'>
                    {reviews.map(review => (
                        <ReviewCard key={review.id} review={review} dict={dict} />
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
                    className='flex w-fit cursor-pointer items-center justify-center self-center rounded-it-full border border-it-primary bg-transparent px-10 py-[10px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5 disabled:cursor-default disabled:opacity-60'>
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
    const canToggle = review.isMachineTranslated && Boolean(review.originalText);
    const body =
        showingOriginal && review.originalText ? review.originalText : review.text;

    const guestKey = review.guestType
        ? GUEST_TYPE_KEYS[review.guestType]
        : undefined;
    const guestLabel = guestKey ? dict[guestKey] : '';
    // Travel month and guest type share one meta line; either can be absent
    // (guest type is the one optional step in the submit flow).
    const meta = [
        review.travelLabel
            ? dict.travelledIn.replace('{month}', review.travelLabel)
            : '',
        guestLabel,
    ].filter(Boolean);

    return (
        <article className='flex flex-col gap-4 rounded-[16px] border border-it-border bg-it-white p-6'>
            <div className='flex flex-col gap-2'>
                <div className='flex flex-col gap-4'>
                    <Stars rating={review.rating} size={16} />
                    <div className='flex flex-col'>
                        <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {review.name}
                        </span>
                        <span className='flex flex-wrap items-center gap-2.5 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {review.date}
                            {/* FE-5. A native `title` rather than a hand-rolled
                                popover: it is the disclosure of last resort and
                                must work with no JS, and the full Omnibus
                                explanation already has a linked page of its own. */}
                            {review.verified && (
                                <>
                                    <span className='size-1 shrink-0 rounded-it-full bg-it-heading' />
                                    <span
                                        title={dict.verifiedTooltip}
                                        className='flex cursor-help items-center gap-2'>
                                        <Image
                                            src='/icons/review-verified.svg'
                                            alt=''
                                            width={16}
                                            height={16}
                                            className='size-4 shrink-0'
                                        />
                                        {dict.verified}
                                    </span>
                                </>
                            )}
                        </span>
                        {/* FE-8 travel month + guest type */}
                        {meta.length > 0 && (
                            <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {meta.join(' · ')}
                            </span>
                        )}
                    </div>
                </div>
                <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {body}
                </p>

                {/* FE-6a. Attribution is not optional politeness: presenting
                    machine output as a guest's own words misstates who said it,
                    and the toggle is what makes the claim checkable. Both texts
                    are already in the payload, so this never refetches and there
                    is no per-review translation URL to index (FE-6b). */}
                {canToggle && (
                    <div className='flex flex-wrap items-center gap-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {!showingOriginal && <span>{dict.translatedBy}</span>}
                        <MotionButton
                            type='button'
                            onClick={() => setShowingOriginal(v => !v)}
                            whileTap={{ scale: 0.95 }}
                            transition={springPop}
                            className='cursor-pointer border-0 bg-transparent p-0 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2'>
                            {showingOriginal
                                ? dict.showTranslation
                                : dict.showOriginal.replace(
                                      '{language}',
                                      review.originalLanguage,
                                  )}
                        </MotionButton>
                    </div>
                )}
            </div>

            {((review.photos && review.photos.length > 0) || review.response) && (
                <div className='flex flex-col gap-4'>
                    {review.photos && review.photos.length > 0 ? (
                        <div className='flex flex-wrap gap-2'>
                            {review.photos.map((src, i) => (
                                <div
                                    key={`${src}-${i}`}
                                    className='relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-it-border'>
                                    <Image
                                        src={src}
                                        alt=''
                                        fill
                                        sizes='80px'
                                        className='object-cover'
                                    />
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {review.response && (
                        <div className='flex flex-col gap-4 rounded-[12px] border border-it-border bg-it-surface p-6'>
                            <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {review.response.text}
                            </p>
                            <div className='flex flex-col'>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {review.response.name}
                                </span>
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {review.response.date}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
