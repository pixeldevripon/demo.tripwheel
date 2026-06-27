import Image from 'next/image';

export type ReviewHistogramRow = { stars: number; count: number };

export type ReviewResponse = { text: string; name: string; date: string };

export type FullReview = {
    id: string;
    /** Whole-star rating 0-5. */
    rating: number;
    name: string;
    date: string;
    text: string;
    /** Number of attached photo thumbnails (placeholder squares). */
    photos?: number;
    /** Optional operator response. */
    response?: ReviewResponse;
};

export type TourReviewsSectionDict = {
    title: string;
    subtitle: string;
    /** "{count} reviews" */
    reviewsCount: string;
    sortBy: string;
    sortValue: string;
    showMore: string;
};

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
 * the detail tab nav. Unlike the other detail sections it is NOT collapsible.
 *
 * Header + aggregate rating histogram, a sort control, a scrollable strip of
 * customer photos, the review cards (a featured card may carry photo thumbnails
 * and an operator response), and a "Show more" button. Static/presentational
 * until the reviews module + tour-by-slug API are wired.
 */
export function TourReviewsSection({
    rating,
    reviewCount,
    histogram,
    photoCount,
    reviews,
    dict,
}: {
    rating: number;
    reviewCount: number;
    histogram: ReviewHistogramRow[];
    photoCount: number;
    reviews: FullReview[];
    dict: TourReviewsSectionDict;
}) {
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
                <button
                    type='button'
                    className='flex cursor-pointer items-center gap-4 rounded-it-full border border-it-border bg-it-white px-6 py-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {dict.sortValue}
                    <Image
                        src='/icons/caret-down.svg'
                        alt=''
                        width={20}
                        height={20}
                        className='size-5 shrink-0'
                    />
                </button>
            </div>

            {/* Customer photo strip */}
            <div className='flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {Array.from({ length: photoCount }).map((_, i) => (
                    <div
                        key={i}
                        className='size-20 shrink-0 rounded-it-full bg-it-border'
                    />
                ))}
            </div>

            {/* Review cards */}
            <div className='flex flex-col gap-4'>
                {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                ))}
            </div>

            {/* Show more */}
            <button
                type='button'
                className='flex w-fit cursor-pointer items-center justify-center self-center rounded-it-full border border-it-primary bg-transparent px-10 py-[10px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5'>
                {dict.showMore}
            </button>
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

            {(review.photos || review.response) && (
                <div className='flex flex-col gap-4'>
                    {review.photos ? (
                        <div className='flex gap-2'>
                            {Array.from({ length: review.photos }).map((_, i) => (
                                <div
                                    key={i}
                                    className='size-10 shrink-0 rounded-[10px] bg-it-border'
                                />
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
