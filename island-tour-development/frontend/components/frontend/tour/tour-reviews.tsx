import { reviewerLead } from '@/lib/reviews/review-view';

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
        <section className='rounded-it-lg bg-it-bg px-[22px] py-5'>
            {/* Title + score left, "See all reviews" right. Wraps rather than
                breaking at a breakpoint: on a phone the link drops to its own
                line under the title (the client's ask), and `ml-auto` only
                pushes it right once there is room for it beside the title. */}
            <div className='mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5'>
                <h2 className='m-0 font-it-display text-[18px] font-bold leading-[1.2] tracking-[-0.01em] text-it-ink'>
                    {dict.title}
                </h2>
                {rating != null && reviewCount > 0 && (
                    <span className='text-[13px] leading-[1.6] text-it-text-muted tabular-nums'>
                        <span className='font-bold text-it-star'>
                            ★ {rating.toFixed(1)}
                        </span>{' '}
                        ({reviewCount})
                    </span>
                )}
                {/* Same page, not another route: the full section is further
                    down this one. `SmoothScrollLink` is still a real
                    `<a href='#tour-reviews'>` - it only intercepts the click to
                    animate it, and falls back to the native jump before
                    hydration or when the target is not in the DOM. The whole
                    page's in-page jumps already run on this easing (the section
                    tab nav), and a link that teleports while the tabs glide
                    reads as two different pages. */}
                <SmoothScrollLink
                    targetId='tour-reviews'
                    offset={REVIEWS_SCROLL_OFFSET}
                    className='w-full text-[13px] font-bold leading-[1.6] text-it-primary-hover no-underline transition-colors hover:text-it-primary sm:ml-auto sm:w-auto'>
                    {dict.seeAll} →
                </SmoothScrollLink>
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
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
    // `Name · Country · Month Year`, composed by the shared helper so this card
    // and the full section below cannot drift into two formats.
    const lead = reviewerLead({
        name: review.name,
        country: review.country,
        when: review.date,
    });

    return (
        <article className='h-full rounded-it-md border border-it-divider bg-it-white px-4 py-3.5'>
            <div className='flex flex-wrap items-center gap-2 text-[12.5px] leading-[1.6] text-it-text-muted'>
                <span className='font-bold text-it-star'>
                    ★ {review.rating.toFixed(1)}
                </span>
                <span>
                    {[...lead, review.verified ? dict.verified : null]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </div>
            <div className='mt-1.5 text-[13.5px] leading-[1.55] text-it-ink'>
                <ExpandableText
                    text={review.text}
                    moreLabel={dict.readMore}
                    lessLabel={dict.readLess}
                    sentenceLimit={PREVIEW_SENTENCES}
                    className='m-0'
                    buttonClassName='cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[13.5px] font-bold leading-[1.55] text-it-primary-hover'
                />
            </div>
        </article>
    );
}
