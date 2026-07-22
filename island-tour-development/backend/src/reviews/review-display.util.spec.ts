import {
  containsBannedWord,
  resolveRatingSource,
  reviewerInitial,
  roundRating,
} from './review-display.util';

describe('reviewerInitial', () => {
  it('builds "First L."', () => {
    expect(reviewerInitial('Ada', 'Byron')).toBe('Ada B.');
  });
  it('uses first name only when last name is missing', () => {
    expect(reviewerInitial('Ada', null)).toBe('Ada');
    expect(reviewerInitial('Ada', '   ')).toBe('Ada');
  });
  it('returns null without a first name', () => {
    expect(reviewerInitial(null, 'Byron')).toBeNull();
    expect(reviewerInitial('', 'Byron')).toBeNull();
  });
});

describe('containsBannedWord', () => {
  it('matches a banned word case-insensitively', () => {
    expect(containsBannedWord('What the FUCK')).toBe(true);
  });
  it('only matches whole words', () => {
    expect(containsBannedWord('assassin classic passing')).toBe(false);
  });
  it('is false for clean text or empty', () => {
    expect(containsBannedWord('Wonderful sunset cruise')).toBe(false);
    expect(containsBannedWord(null)).toBe(false);
    expect(containsBannedWord('')).toBe(false);
  });
});

describe('roundRating', () => {
  it('rounds to 1dp', () => {
    expect(roundRating(4.27)).toBe(4.3);
    expect(roundRating(4.0)).toBe(4);
  });
  it('passes through null', () => {
    expect(roundRating(null)).toBeNull();
    expect(roundRating(undefined)).toBeNull();
  });
});

/**
 * LD11 boundary table. The three thresholds (3 tour reviews / 10 operator
 * reviews / 4.0 operator average) are the whole decision, and an off-by-one on
 * any of them either hides a rating a tour has earned or lends one it has not.
 * Each pair below straddles exactly one boundary.
 */
describe('resolveRatingSource - LD11 boundaries (3 / 10 / 4.0)', () => {
  // Operator is deliberately UNQUALIFIED here, so the only thing that can
  // produce a 'tour' result is the tour-count boundary itself.
  const noFallback = { operatorCount: 0, operatorRating: null };

  it.each([
    [2, 'operator' as const],
    [3, 'tour' as const],
  ])('tour with %i own reviews resolves to %s', (tourCount, expected) => {
    const r = resolveRatingSource({
      tourCount,
      tourRating: 4.5,
      operatorCount: 40,
      operatorRating: 4.9,
    });
    expect(r.source).toBe(expected);
  });

  it.each([
    [9, 'none' as const],
    [10, 'operator' as const],
  ])('operator with %i reviews resolves to %s', (operatorCount, expected) => {
    const r = resolveRatingSource({
      tourCount: 0,
      tourRating: null,
      operatorCount,
      operatorRating: 4.5,
    });
    expect(r.source).toBe(expected);
  });

  it.each([
    [3.9, 'none' as const],
    [4.0, 'operator' as const],
  ])('operator rated %s resolves to %s', (operatorRating, expected) => {
    const r = resolveRatingSource({
      tourCount: 0,
      tourRating: null,
      operatorCount: 40,
      operatorRating,
    });
    expect(r.source).toBe(expected);
  });

  it('never lends a rating when the operator misses EITHER condition', () => {
    // High rating, too few reviews.
    expect(
      resolveRatingSource({
        tourCount: 1,
        tourRating: 5,
        operatorCount: 9,
        operatorRating: 5,
      }).source,
    ).toBe('none');
    // Many reviews, rating too low.
    expect(
      resolveRatingSource({
        tourCount: 1,
        tourRating: 5,
        operatorCount: 500,
        operatorRating: 3.9,
      }).source,
    ).toBe('none');
  });

  it('falls through to none when a 3+ review tour somehow has a null average', () => {
    // Guards the `&& input.tourRating != null` half of the first branch: a tour
    // cannot show a rating it does not have, however many reviews it has.
    expect(
      resolveRatingSource({
        tourCount: 5,
        tourRating: null,
        ...noFallback,
      }).source,
    ).toBe('none');
  });

  it('reports the TOUR count even when showing no rating', () => {
    // `reviewCount` is what the page renders beside the (absent) rating, and it
    // must describe this tour, not the operator that failed to qualify.
    const r = resolveRatingSource({
      tourCount: 2,
      tourRating: 5,
      operatorCount: 9,
      operatorRating: 5,
    });
    expect(r).toEqual({ source: 'none', rating: null, reviewCount: 2 });
  });
});

describe('resolveRatingSource (LD11)', () => {
  it('uses the tour rating at ≥3 approved reviews', () => {
    const r = resolveRatingSource({
      tourCount: 3,
      tourRating: 4.5,
      operatorCount: 50,
      operatorRating: 4.9,
    });
    expect(r).toEqual({ source: 'tour', rating: 4.5, reviewCount: 3 });
  });

  it('falls back to the operator when <3 tour reviews but operator qualifies', () => {
    const r = resolveRatingSource({
      tourCount: 1,
      tourRating: 5,
      operatorCount: 10,
      operatorRating: 4.0,
    });
    expect(r).toEqual({ source: 'operator', rating: 4.0, reviewCount: 10 });
  });

  it('shows nothing when neither tour nor operator qualifies', () => {
    expect(
      resolveRatingSource({
        tourCount: 2,
        tourRating: 5,
        operatorCount: 9,
        operatorRating: 4.9,
      }),
    ).toMatchObject({ source: 'none', rating: null });
    expect(
      resolveRatingSource({
        tourCount: 0,
        tourRating: null,
        operatorCount: 40,
        operatorRating: 3.9,
      }),
    ).toMatchObject({ source: 'none', rating: null });
  });
});
