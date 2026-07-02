'use client';

import Image from 'next/image';
import { useState } from 'react';
import { type Locale } from '@/lib/constants/locales';
import { fetchTourReviews } from '@/lib/api/reviews';
import { toFullReview } from '@/lib/reviews/review-view';
import type { ReviewSort } from '@/types/review';

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
};

const SORT_OPTIONS: { value: ReviewSort; labelKey: keyof TourReviewsSectionDict }[] = [
    { value: 'newest', labelKey: 'sortNewest' },
    { value: 'rating_desc', labelKey: 'sortRatingHigh' },
    { value: 'rating_asc', labelKey: 'sortRatingLow' },
    { value: 'helpful', labelKey: 'sortHelpful' },
];

// Cap the customer-photo strip so a long review set doesn't render hundreds of tiles.
const PHOTO_STRIP_LIMIT = 12;

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
 * pages on "Show more" and re-fetches from page 1 when the sort changes, hitting
 * the public `GET /reviews` endpoint directly (no auth). Header aggregate + star
 * histogram come from the tour payload; the customer-photo strip is aggregated
 * from the loaded reviews. Renders an empty state when the tour has no reviews.
 */
export function TourReviewsSection({
    tourId,
    locale,
    rating,
    reviewCount,
    histogram,
    initialReviews,
    total,
    pageSize,
    hostLabel,
    dict,
}: {
    tourId: string;
    locale: Locale;
    rating: number;
    reviewCount: number;
    histogram: ReviewHistogramRow[];
    initialReviews: FullReview[];
    total: number;
    pageSize: number;
    hostLabel: string;
    dict: TourReviewsSectionDict;
}) {
    const [reviews, setReviews] = useState<FullReview[]>(initialReviews);
    const [sort, setSort] = useState<ReviewSort>('newest');
    const [loadedPages, setLoadedPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const hasMore = reviews.length < total;
    const photoStrip = reviews
        .flatMap(r => r.photos ?? [])
        .slice(0, PHOTO_STRIP_LIMIT);

    async function loadPage(page: number, nextSort: ReviewSort, append: boolean) {
        setLoading(true);
        try {
            const res = await fetchTourReviews({
                tourId,
                locale,
                sort: nextSort,
                page,
                limit: pageSize,
            });
            const mapped = res.data.map(r => toFullReview(r, locale, hostLabel));
            setReviews(prev => (append ? [...prev, ...mapped] : mapped));
            setLoadedPages(page);
        } catch {
            // Keep whatever is already shown; the button/control stays for retry.
        } finally {
            setLoading(false);
        }
    }

    function handleSortChange(next: ReviewSort) {
        if (next === sort || loading) return;
        setSort(next);
        void loadPage(1, next, false);
    }

    function handleShowMore() {
        if (loading || !hasMore) return;
        void loadPage(loadedPages + 1, sort, true);
    }

    // Empty state - keep the heading (it's the tab-nav target) and show a message.
    if (total === 0) {
        return (
            <section id='tour-reviews' className='flex scroll-mt-36 flex-col gap-4'>
                <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {dict.title}
                </h2>
                <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.empty}
                </p>
            </section>
        );
    }

    return (
        <section id='tour-reviews' className='flex scroll-mt-36 flex-col gap-8'>
            {/* Header + rating summary */}
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.title}
                    </h2>
                    <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {dict.subtitle}
                    </p>
                </div>

                <div className='flex flex-col gap-8'>
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
                        <span>{dict.reviewsCount.replace('{count}', String(reviewCount))}</span>
                    </div>

                    {/* Histogram */}
                    <div className='flex max-w-91 flex-col gap-1'>
                        {histogram.map(row => (
                            <div key={row.stars} className='flex items-center gap-3'>
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
                                        className='absolute inset-y-0 left-0 rounded-it-full bg-it-primary'
                                        style={{
                                            width: `${reviewCount ? (row.count / reviewCount) * 100 : 0}%`,
                                        }}
                                    />
                                </span>
                                <span className='w-6 shrink-0 text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {row.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sort control */}
            <div className='flex items-center gap-8'>
                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.sortBy}
                </span>
                <div className='relative'>
                    <select
                        value={sort}
                        onChange={e => handleSortChange(e.target.value as ReviewSort)}
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

            {/* Customer photo strip - real review photos */}
            {photoStrip.length > 0 && (
                <div className='flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                    {photoStrip.map((src, i) => (
                        <div
                            key={`${src}-${i}`}
                            className='relative size-20 shrink-0 overflow-hidden rounded-it-full bg-it-border'>
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
            )}

            {/* Review cards */}
            <div className='flex flex-col gap-4'>
                {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                ))}
            </div>

            {/* Show more */}
            {hasMore && (
                <button
                    type='button'
                    onClick={handleShowMore}
                    disabled={loading}
                    className='flex w-fit cursor-pointer items-center justify-center self-center rounded-it-full border border-it-primary bg-transparent px-10 py-[10px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5 disabled:cursor-default disabled:opacity-60'>
                    {loading ? dict.loading : dict.showMore}
                </button>
            )}
        </section>
    );
}

function ReviewCard({ review }: { review: FullReview }) {
    return (
        <article className='flex flex-col gap-4 rounded-[16px] border border-it-border bg-it-white p-6'>
            <div className='flex flex-col gap-2'>
                <div className='flex flex-col gap-4'>
                    <Stars rating={review.rating} size={16} />
                    <div className='flex flex-col'>
                        <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {review.name}
                        </span>
                        <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {review.date}
                        </span>
                    </div>
                </div>
                <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {review.text}
                </p>
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
