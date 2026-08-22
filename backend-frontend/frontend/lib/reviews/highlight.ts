/**
 * Which reviews are allowed into the tour page's "What our guests say" highlight
 * block (Pastel #38).
 *
 * The block is a pull-quote, not a sample: it sits above the fold beside the
 * price and is the first thing a traveller reads about the tour, so it carries
 * only reviews the operator would be happy to be judged on. Anything below four
 * stars belongs in the full Reviews section further down the page - which stays
 * completely unfiltered, because that is where a traveller goes to find out what
 * is wrong with a tour, and a review section that only ever agrees with itself
 * is worth nothing to them.
 *
 * Padding the block with a weaker review to reach two is not an option either -
 * a lone highlight reads as "this is the best we could find". Under two
 * qualifying reviews the block does not render at all.
 *
 * The rule lives here rather than at the call site so the threshold is one
 * number: the block filters by it, and the page uses it to decide whether the
 * block is worth streaming in the first place.
 */

/**
 * Minimum star rating for the highlight block. Compared against the raw value,
 * so a 3.5 is NOT rounded up into it - the client asked for four stars, and
 * "3.5 displayed as 4" is exactly the kind of rounding that puts a three-star
 * review back in the block.
 */
export const HIGHLIGHT_MIN_RATING = 4;

/** How many reviews the block shows - and the minimum it will render for. */
export const HIGHLIGHT_REVIEW_COUNT = 2;

/**
 * The reviews the highlight block should render, or an empty array when it
 * should not render at all.
 *
 * Returning `[]` rather than a short list is deliberate: "fewer than two" is a
 * hide, not a degrade, so the caller has one thing to check.
 */
export function pickHighlightReviews<T extends { rating: number }>(
    reviews: T[]
): T[] {
    const qualifying = reviews.filter(r => r.rating >= HIGHLIGHT_MIN_RATING);
    return qualifying.length >= HIGHLIGHT_REVIEW_COUNT
        ? qualifying.slice(0, HIGHLIGHT_REVIEW_COUNT)
        : [];
}

/**
 * How many of the tour's approved reviews clear the bar, read off the star
 * distribution the page has already fetched.
 *
 * This is the whole review set, not the page of reviews the block renders from,
 * which is what makes it useful as a pre-flight check: it lets the page skip
 * streaming a block (and flashing its skeleton) that could never fill itself.
 * It cannot replace `pickHighlightReviews` - the distribution knows the counts
 * but not which reviews are on the first page.
 */
export function countHighlightEligible(
    distribution: { stars: number; count: number }[]
): number {
    return distribution.reduce(
        (total, bucket) =>
            bucket.stars >= HIGHLIGHT_MIN_RATING ? total + bucket.count : total,
        0
    );
}
