import Image from 'next/image';
import { type Locale } from '@/lib/constants/locales';
import { ExpandableText } from './expandable-text';
import { SmoothScrollLink } from './smooth-scroll-link';

export type TourReview = {
    id: string;
    name: string;
    country: string;
    /** Pre-formatted date label, e.g. "March 12, 2026". */
    date: string;
    /** Whole-star rating 0-5. */
    rating: number;
    text: string;
    verified: boolean;
};

export type TourReviewsDict = {
    title: string;
    subtitle: string;
    seeAll: string;
    verified: string;
    readMore: string;
    readLess: string;
};

/**
 * Reviews preview block (Figma node 47936:3499) - sits under the gallery in the
 * left column. A header ("What our guests say" + aggregate rating + a "See all
 * reviews" link) over a short subtitle, then two review cards (5-star row, name •
 * country, date • Verified, a clamped excerpt, and a "Read More" link).
 *
 * Localized fields fall back to canonical English on the backend; the review
 * bodies use the LD32 translate-with-show-original path (not built yet).
 */
export function TourReviews({
    rating,
    reviewCount,
    reviews,
    locale,
    dict,
}: {
    rating: number | null;
    reviewCount: number;
    reviews: TourReview[];
    locale: Locale;
    dict: TourReviewsDict;
}) {
    const muted = 'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted';

    return (
        <section className='flex flex-col gap-6'>
            {/* Header */}
            <div className='flex flex-col gap-2'>
                <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
                    <div className='flex items-center gap-4'>
                        <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.title}
                        </h2>
                        {rating != null && (
                            <span className='flex items-center gap-2'>
                                <Image
                                    src='/icons/star-listings.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className='size-5 shrink-0'
                                />
                                <span className={muted}>
                                    {rating.toFixed(1)} ({new Intl.NumberFormat(locale).format(reviewCount)})
                                </span>
                            </span>
                        )}
                    </div>
                    <SmoothScrollLink
                        targetId='tour-reviews'
                        offset={144}
                        className='group inline-flex items-center gap-1 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary no-underline'>
                        {dict.seeAll}
                        <Image
                            src='/icons/cta-arrow-right.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5'
                        />
                    </SmoothScrollLink>
                </div>
                <p className={`m-0 ${muted}`}>{dict.subtitle}</p>
            </div>

            {/* Review cards */}
            <div className='grid gap-4 md:grid-cols-2 md:gap-6'>
                {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} dict={dict} />
                ))}
            </div>
        </section>
    );
}

function ReviewCard({
    review,
    dict,
}: {
    review: TourReview;
    dict: TourReviewsDict;
}) {
    return (
        <article className='flex min-h-[281px] flex-col justify-between gap-4 rounded-[16px] border border-it-border bg-it-white p-6'>
            <div className='flex flex-col gap-2'>
                {/* Star rating */}
                <div className='flex items-center gap-1.5'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Image
                            key={i}
                            src={
                                i < review.rating
                                    ? '/icons/star-listings.svg'
                                    : '/icons/star-empty.svg'
                            }
                            alt=''
                            width={16}
                            height={16}
                            className='size-4 shrink-0'
                        />
                    ))}
                </div>
                {/* Name / country + date / verified */}
                <div className='flex flex-col'>
                    <span className='flex items-center gap-2.5 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {review.name}
                        <span className='size-[5px] shrink-0 rounded-it-full bg-it-heading' />
                        {review.country}
                    </span>
                    <span className='flex items-center gap-2.5 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {review.date}
                        {review.verified && (
                            <>
                                <span className='size-1 shrink-0 rounded-it-full bg-it-heading' />
                                <span className='flex items-center gap-2'>
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
                </div>
            </div>

            {/* Excerpt with an inline, dynamic "Read More" / "Read less" toggle
                right after the text (Figma: the link sits at the end of the
                truncated copy, not on its own row). */}
            <ExpandableText
                text={review.text}
                moreLabel={dict.readMore}
                lessLabel={dict.readLess}
            />
        </article>
    );
}
