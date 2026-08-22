/**
 * `Product` + `Offer` + `AggregateRating` + `Review` structured data for a tour
 * detail page (FE-2). Pure builder - no fetching, no React - so the emission
 * rules below are testable and live in exactly one place.
 *
 * ## The rules are compliance, not SEO tuning
 *
 * Google's review-snippet policy and the EU Omnibus Directive point the same
 * way: marked-up ratings must be the ones a visitor actually sees on the page.
 * So this returns `null` unless ALL of the following hold, and every condition
 * is a rule someone can otherwise break by accident:
 *
 * 1. **The rating is the TOUR's own.** Under LD11 a new tour may DISPLAY its
 *    operator's rating. Marking that up as the tour's `aggregateRating` would
 *    tell Google 4.8-from-40-reviews about a product with no reviews at all -
 *    review fraud in the eyes of both regimes, however well-intentioned the
 *    cold-start fallback is on the page itself.
 * 2. **At least 3 approved reviews**, matching the threshold at which the page
 *    itself starts showing a distribution.
 * 3. **Only reviews that are actually rendered** are listed. Marking up reviews
 *    a visitor cannot find on the page is "reviews not visible to users".
 *
 * It also never attaches to `Organization` / `LocalBusiness`: self-serving
 * markup on the publisher's own entity is explicitly disallowed.
 */
import type { PublicReview } from '@/types/review';

/** The subset of the tour detail this needs. Keeps the builder decoupled. */
export interface TourJsonLdProduct {
    name: string;
    description: string | null;
    /** Absolute image URLs (Cloudinary already returns absolute). */
    images: string[];
    /** Absolute canonical URL, or null when the site URL is unknown. */
    url: string | null;
    /** Display "from" price as a decimal string, or null when unpriced. */
    price: string | null;
    /** ISO 4217 code matching `price`. */
    currency: string;
}

/** LD31/FE-2: below this the page shows no distribution, so nothing is marked up. */
const MIN_REVIEWS_FOR_MARKUP = 3;

export function buildTourReviewJsonLd(input: {
    product: TourJsonLdProduct;
    /** Which entity the DISPLAYED rating belongs to (LD11). */
    ratingSource: 'tour' | 'operator' | 'none';
    /** Displayed rating - only trustworthy as the tour's when source is 'tour'. */
    rating: number | null;
    /** The tour's OWN approved-review count. */
    ownReviewCount: number;
    /** The reviews rendered on the page (the first page), in render order. */
    visibleReviews: PublicReview[];
}): Record<string, unknown> | null {
    const { product, ratingSource, rating, ownReviewCount, visibleReviews } =
        input;

    // Rule 1 + 2. `ratingSource !== 'tour'` covers both the LD11 operator
    // fallback and the no-rating case in one check.
    if (ratingSource !== 'tour') return null;
    if (rating === null) return null;
    if (ownReviewCount < MIN_REVIEWS_FOR_MARKUP) return null;

    // Rule 3. Only reviews with a body are listed: a `Review` whose `reviewBody`
    // is empty is a rating, and marking it up as a review overstates the depth
    // of what is on the page.
    const reviews = visibleReviews
        .filter(r => (r.comment ?? '').trim().length > 0)
        .map(r => ({
            '@type': 'Review',
            author: {
                '@type': 'Person',
                // Already a short label ("Ada B.") - never a full name.
                name: r.reviewerInitial ?? 'Guest',
            },
            datePublished: r.createdAt.slice(0, 10),
            reviewBody: r.comment,
            reviewRating: {
                '@type': 'Rating',
                ratingValue: r.rating,
                bestRating: 5,
                worstRating: 1,
            },
        }));

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        ...(product.description && { description: product.description }),
        ...(product.images.length > 0 && { image: product.images }),
        ...(product.url && { url: product.url }),
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            // The tour's OWN count, matching `ratingValue`. Using the displayed
            // count would pair a tour rating with an operator total.
            reviewCount: ownReviewCount,
            bestRating: 5,
            worstRating: 1,
        },
        ...(product.price && {
            offers: {
                '@type': 'Offer',
                price: product.price,
                priceCurrency: product.currency,
                availability: 'https://schema.org/InStock',
                ...(product.url && { url: product.url }),
            },
        }),
        ...(reviews.length > 0 && { review: reviews }),
    };
}
