import { computeQualityScore, listingCompleteness } from './quality-score';

describe('quality-score (master §7.2)', () => {
  describe('listingCompleteness', () => {
    const full = {
      imageCount: 5,
      hasOverview: true,
      hasShortDescription: true,
      highlightCount: 3,
      inclusionCount: 2,
      exclusionCount: 1,
      languageCount: 1,
      attributeCount: 4,
      hasMeetingPoint: true,
      locationCount: 1,
    };

    it('returns 1 for a fully-filled listing and 0 for an empty one', () => {
      expect(listingCompleteness(full)).toBe(1);
      expect(
        listingCompleteness({
          imageCount: 0,
          hasOverview: false,
          hasShortDescription: false,
          highlightCount: 0,
          inclusionCount: 0,
          exclusionCount: 0,
          languageCount: 0,
          attributeCount: 0,
          hasMeetingPoint: false,
          locationCount: 0,
        }),
      ).toBe(0);
    });

    it('each check contributes equally (one missing check = 0.9)', () => {
      expect(listingCompleteness({ ...full, hasMeetingPoint: false })).toBe(
        0.9,
      );
      // Below-threshold counts fail their check outright.
      expect(listingCompleteness({ ...full, highlightCount: 2 })).toBe(0.9);
      expect(listingCompleteness({ ...full, imageCount: 3 })).toBe(0.9);
    });

    // The `description` -> `shortDescription` swap (the old field was removed
    // from the product) must not change the arithmetic: still ten checks,
    // still equally weighted, and the new one behaves like every other.
    it('keeps ten equally weighted checks after the shortDescription swap', () => {
      expect(listingCompleteness(full)).toBe(1);
      expect(listingCompleteness({ ...full, hasShortDescription: false })).toBe(
        0.9,
      );
      expect(
        listingCompleteness({
          ...full,
          hasShortDescription: false,
          hasOverview: false,
        }),
      ).toBe(0.8);
    });
  });

  describe('computeQualityScore', () => {
    it('applies the master weights: rating 40 + reviews 25 + completeness 20 + conversion 15', () => {
      expect(
        computeQualityScore({
          avgRating: 5,
          reviewCount: 100,
          completeness: 1,
          conversionRate: 1,
          maxCategoryConversion: 1,
        }),
      ).toBe(100);
      expect(
        computeQualityScore({
          avgRating: 2.5, // 20
          reviewCount: 50, // 12.5
          completeness: 0.5, // 10
          conversionRate: null, // 0 until tracking lands
          maxCategoryConversion: null,
        }),
      ).toBe(42.5);
    });

    it('caps the review-volume term at 100 reviews', () => {
      const at100 = computeQualityScore({
        avgRating: null,
        reviewCount: 100,
        completeness: 0,
        conversionRate: null,
        maxCategoryConversion: null,
      });
      const at5000 = computeQualityScore({
        avgRating: null,
        reviewCount: 5000,
        completeness: 0,
        conversionRate: null,
        maxCategoryConversion: null,
      });
      expect(at100).toBe(25);
      expect(at5000).toBe(25);
    });

    it('conversion is category-relative and guards a zero max', () => {
      expect(
        computeQualityScore({
          avgRating: null,
          reviewCount: 0,
          completeness: 0,
          conversionRate: 0.02,
          maxCategoryConversion: 0.04,
        }),
      ).toBe(7.5);
      expect(
        computeQualityScore({
          avgRating: null,
          reviewCount: 0,
          completeness: 0,
          conversionRate: 0.02,
          maxCategoryConversion: 0,
        }),
      ).toBe(0);
    });
  });
});
