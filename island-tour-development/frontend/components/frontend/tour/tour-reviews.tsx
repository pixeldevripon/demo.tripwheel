import Image from 'next/image';

import { ReviewStars } from '../review-stars';

import { ExpandableText } from '../expandable-text';
import { Reveal } from '../reveal';
import { SmoothScrollLink } from '../smooth-scroll-link';

export type TourReview = {
    id: string;
    name: string;
    /** Localized country name; '' when the reviewer gave none. */
    country: string;
    /** Localized month + year, e.g. "July 2026". */
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
 * Sentences shown before the excerpt is cut (Pastel #55).
 *
 * Sentences, not characters: a character budget cuts mid-thought, and the
 * client asked for "two or three sentences". Two is the floor that keeps both
 * cards to a readable block - the point of truncating at all is that the
 * longest review no longer decides how tall the whole strip is.
 */
const PREVIEW_SENTENCES = 2;

/**
 * Where the reviews section lands under the sticky chrome, in px.
 *
 * The same 144 as the section's own `scroll-mt-36`, so the animated jump and
 * the native one (no JS, or a pasted `#tour-reviews` URL) settle in the same
 * place - a link that lands somewhere different depending on whether hydration
 * has finished is worse than one that always lands slightly low.
 */
const REVIEWS_SCROLL_OFFSET = 144;

/**
 * Review preview module (design v2 .rpreview, LD29) - the paper panel under
 * the quick-info badges: a header row over two white review cards, each with an
 * amber score, the shared reviewer line and a truncated excerpt.
 *
 * THE HEADER ROW IS THE POINT OF PASTEL #55. With only a title, two reviews
 * read as two quotes we picked ourselves. The rating and the count beside the
 * title say how many there are in total, and `See all reviews` says where the
 * rest are - which is what turns a pair of quotes into a sample.
 *
 * Localized fields fall back to canonical English on the backend; the review
 * bodies use the LD32 translate-with-show-original path (not built yet).
 */
export function TourReviews({
    reviews,
    rating,
    reviewCount,
    dict,
}: {
    reviews: TourReview[];
    /** Displayed aggregate rating; null hides the score beside the title. */
    rating: number | null;
    reviewCount: number;
    dict: TourReviewsDict;
}) {
    return (
        // Figma 47936:3499. The grey panel is gone - the block sits on the page
        // and the CARDS carry the chrome (white, 10% ink hairline, radius 16).
        <section className='flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
                <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                        <h2 className='m-0 it-h2 leading-[1.2] text-it-heading font-medium '>
                            {dict.title}
                        </h2>
                        {rating != null && reviewCount > 0 && (
                            <span className='flex items-center gap-2 it-text text-it-text-muted '>
                                <Image
                                    src='/icons/tour/star.svg'
                                    alt=''
                                    width={20}
                                    height={19}
                                    className='size-4 shrink-0 lg:size-4'
                                />
                                <span className='tabular-nums'>{`${rating.toFixed(1)} (${reviewCount.toLocaleString()})`}</span>
                            </span>
                        )}
                    </div>
                    {/* Same page, not another route: the full section is further
                        down this one. `SmoothScrollLink` is still a real
                        `<a href='#tour-reviews'>` - it only intercepts the click
                        to animate it, and falls back to the native jump before
                        hydration or when the target is not in the DOM. */}
                    <SmoothScrollLink
                        targetId='tour-reviews'
                        offset={REVIEWS_SCROLL_OFFSET}
                        className='flex items-center gap-1 it-text font-medium text-it-primary no-underline transition-colors hover:text-it-primary-hover '>
                        {dict.seeAll}
                        <Image
                            src='/icons/tour/arrow.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 shrink-0 lg:size-5'
                        />
                    </SmoothScrollLink>
                </div>
                <p className='m-0 it-text text-it-text-muted '>
                    {dict.subtitle}
                </p>
            </div>
            <div className='grid gap-6 md:grid-cols-2'>
                {reviews.map(review => (
                    <Reveal key={review.id} listItem>
                        <ReviewCard review={review} dict={dict} />
                    </Reveal>
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
        // Figma 47936:3499 card: 24px padding, the head block and the body
        // pushed apart so every card in the row agrees on where its text
        // starts, whatever the reviewer line wraps to.
        <article className='flex h-full min-h-[281px] flex-col justify-between gap-4 rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
            <div className='flex flex-col gap-2'>
                <ReviewStars rating={review.rating} />
                <div className='flex flex-col'>
                    {/* Name and country at full ink; the dot only when both are
                        there, so a reviewer who gave no country does not get a
                        dot pointing at nothing. */}
                    <span className='flex flex-wrap items-center gap-x-2.5 gap-y-0.5 it-text font-medium text-it-heading '>
                        {review.name}
                        {review.country && (
                            <>
                                <span
                                    aria-hidden='true'
                                    className='size-[5px] shrink-0 rounded-full bg-it-heading/20'
                                />
                                {review.country}
                            </>
                        )}
                    </span>
                    <span className='flex flex-wrap items-center gap-x-2.5 gap-y-0.5 it-meta text-it-heading/40 '>
                        {review.date}
                        {review.verified && (
                            <>
                                <span
                                    aria-hidden='true'
                                    className='size-1 shrink-0 rounded-full bg-it-heading/20'
                                />
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
            <div className='it-text text-it-heading '>
                <ExpandableText
                    text={review.text}
                    moreLabel={dict.readMore}
                    lessLabel={dict.readLess}
                    sentenceLimit={PREVIEW_SENTENCES}
                    className='m-0'
                    buttonClassName='cursor-pointer whitespace-nowrap border-none bg-transparent p-0 it-text font-medium text-it-primary underline underline-offset-[3px] '
                />
            </div>
        </article>
    );
}
