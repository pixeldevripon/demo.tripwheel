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
      resolveRatingSource({ tourCount: 2, tourRating: 5, operatorCount: 9, operatorRating: 4.9 }),
    ).toMatchObject({ source: 'none', rating: null });
    expect(
      resolveRatingSource({ tourCount: 0, tourRating: null, operatorCount: 40, operatorRating: 3.9 }),
    ).toMatchObject({ source: 'none', rating: null });
  });
});
