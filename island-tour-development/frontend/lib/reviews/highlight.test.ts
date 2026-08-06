import { describe, expect, it } from 'vitest';

import {
    countHighlightEligible,
    HIGHLIGHT_MIN_RATING,
    HIGHLIGHT_REVIEW_COUNT,
    pickHighlightReviews,
} from './highlight';

const review = (id: string, rating: number) => ({ id, rating });

describe('pickHighlightReviews', () => {
    it('keeps only reviews at or above the threshold', () => {
        const picked = pickHighlightReviews([
            review('a', 5),
            review('b', 3),
            review('c', 4),
        ]);
        expect(picked.map(r => r.id)).toEqual(['a', 'c']);
    });

    it('preserves the incoming order rather than sorting by rating', () => {
        // The strip is "the newest that qualify", not "the best" - reordering
        // would quietly turn a review feed into a leaderboard.
        const picked = pickHighlightReviews([review('a', 4), review('b', 5)]);
        expect(picked.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('returns nothing when only one review qualifies', () => {
        // The reported bug: the block padded itself with a 3-star review.
        expect(pickHighlightReviews([review('a', 5), review('b', 3)])).toEqual(
            []
        );
    });

    it('returns nothing when no review qualifies', () => {
        expect(pickHighlightReviews([review('a', 3), review('b', 2)])).toEqual(
            []
        );
    });

    it('returns nothing for an empty list', () => {
        expect(pickHighlightReviews([])).toEqual([]);
    });

    it('does not round a 3.5 up into the block', () => {
        expect(
            pickHighlightReviews([
                review('a', 3.5),
                review('b', 3.9),
                review('c', 5),
            ])
        ).toEqual([]);
    });

    it('caps the block at the display count', () => {
        const picked = pickHighlightReviews([
            review('a', 5),
            review('b', 5),
            review('c', 5),
            review('d', 4),
        ]);
        expect(picked).toHaveLength(HIGHLIGHT_REVIEW_COUNT);
    });
});

describe('countHighlightEligible', () => {
    const distribution = (counts: Record<number, number>) =>
        [5, 4, 3, 2, 1].map(stars => ({ stars, count: counts[stars] ?? 0 }));

    it('sums only the buckets at or above the threshold', () => {
        expect(
            countHighlightEligible(distribution({ 5: 7, 4: 2, 3: 11, 1: 4 }))
        ).toBe(9);
    });

    it('is zero when every review sits below the threshold', () => {
        expect(countHighlightEligible(distribution({ 3: 6, 2: 1 }))).toBe(0);
    });

    it('is zero for an empty distribution', () => {
        expect(countHighlightEligible([])).toBe(0);
    });

    it('agrees with pickHighlightReviews on the same review set', () => {
        // The page gate and the block must not be able to disagree about what
        // "enough to highlight" means.
        const reviews = [review('a', 5), review('b', 3), review('c', 4)];
        const buckets = distribution({ 5: 1, 4: 1, 3: 1 });
        expect(countHighlightEligible(buckets) >= HIGHLIGHT_REVIEW_COUNT).toBe(
            pickHighlightReviews(reviews).length > 0
        );
    });

    it('uses the same threshold as the filter', () => {
        expect(
            countHighlightEligible([{ stars: HIGHLIGHT_MIN_RATING, count: 1 }])
        ).toBe(1);
        expect(
            countHighlightEligible([
                { stars: HIGHLIGHT_MIN_RATING - 1, count: 1 },
            ])
        ).toBe(0);
    });
});
