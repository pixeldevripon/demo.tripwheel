import { Reveal } from '../reveal';
import { ExpandableText } from '../expandable-text';

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
 * Review preview module (design v2 .rpreview, LD29) - the paper panel under
 * the quick-info badges: a display heading over two white review cards, each
 * with an amber score + "name · date · verified" top row and the excerpt.
 *
 * Localized fields fall back to canonical English on the backend; the review
 * bodies use the LD32 translate-with-show-original path (not built yet).
 */
export function TourReviews({
    reviews,
    dict,
}: {
    reviews: TourReview[];
    dict: TourReviewsDict;
}) {
    return (
        <section className='rounded-it-lg bg-it-bg px-[22px] py-5'>
            <h2 className='m-0 mb-3 font-it-display text-[18px] font-bold leading-[1.2] tracking-[-0.01em] text-it-ink'>
                {dict.title}
            </h2>
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
    return (
        <article className='h-full rounded-it-md border border-it-divider bg-it-white px-4 py-3.5'>
            <div className='flex flex-wrap items-center gap-2 text-[12.5px] leading-[1.6] text-it-text-muted'>
                <span className='font-bold text-it-star'>
                    ★ {review.rating.toFixed(1)}
                </span>
                <span>
                    {[review.name, review.date, review.verified ? dict.verified : null]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
            </div>
            <div className='mt-1.5 text-[13.5px] leading-[1.55] text-it-ink'>
                <ExpandableText
                    text={review.text}
                    moreLabel={dict.readMore}
                    lessLabel={dict.readLess}
                />
            </div>
        </article>
    );
}
