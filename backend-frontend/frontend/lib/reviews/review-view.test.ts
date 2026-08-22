import { describe, expect, it } from 'vitest';

import type { PublicReview } from '@/types/review';
import { reviewerLead, toFullReview, toTourReview } from './review-view';

/**
 * The reviewer line (Pastel #55).
 *
 * Two things are worth pinning here: that the country really is localized -
 * the previous version looked like it was and was not - and that the preview
 * cards and the full section compose the SAME line, which is the client's
 * actual requirement ("so the page has one format").
 */

const review = (over: Partial<PublicReview> = {}): PublicReview =>
    ({
        id: 'r1',
        rating: 5,
        reviewerInitial: 'Maria S.',
        reviewerCountry: 'Netherlands',
        createdAt: '2026-07-30T10:00:00.000Z',
        comment: 'Lovely day.',
        photos: [],
        isVerified: true,
        isMachineTranslated: false,
        originalComment: null,
        originalLocale: null,
        travelMonth: 7,
        travelYear: 2026,
        reviewerType: null,
        ...over,
    }) as unknown as PublicReview;

describe('countryName — via toTourReview', () => {
    it('localizes a country stored as an ENGLISH NAME', () => {
        // The column is a bare `String?` and the rows hold names, not codes.
        // The old mapper assumed a code, threw, caught, and returned the input -
        // so every locale silently showed English.
        expect(toTourReview(review(), 'nl').country).toBe('Nederland');
        expect(toTourReview(review(), 'de').country).toBe('Niederlande');
    });

    it('still localizes a country stored as an ISO code', () => {
        expect(toTourReview(review({ reviewerCountry: 'GB' }), 'nl').country).toBe(
            'Verenigd Koninkrijk',
        );
    });

    it('is case-insensitive about the stored name', () => {
        expect(
            toTourReview(review({ reviewerCountry: 'netherlands' }), 'nl').country,
        ).toBe('Nederland');
    });

    it('returns something unrecognised verbatim rather than dropping it', () => {
        expect(
            toTourReview(review({ reviewerCountry: 'Atlantis' }), 'en').country,
        ).toBe('Atlantis');
    });

    it('is empty when the reviewer gave no country', () => {
        expect(toTourReview(review({ reviewerCountry: null }), 'en').country).toBe(
            '',
        );
    });
});

describe('the date on the reviewer line', () => {
    it('is month and year, from WHEN THE TOUR WAS TAKEN', () => {
        // Not when the review was written: a review left six months late would
        // otherwise claim the wrong season.
        expect(
            toTourReview(
                review({ travelMonth: 3, travelYear: 2026 }),
                'en',
            ).date,
        ).toBe('March 2026');
    });

    it('falls back to the written date rather than losing the time', () => {
        expect(
            toTourReview(
                review({ travelMonth: null, travelYear: null }),
                'en',
            ).date,
        ).toBe('July 2026');
    });
});

describe('reviewerLead — one line for both surfaces', () => {
    it('orders it Name, Country, Month Year', () => {
        expect(
            reviewerLead({
                name: 'Maria S.',
                country: 'Netherlands',
                when: 'July 2026',
            }),
        ).toEqual(['Maria S.', 'Netherlands', 'July 2026']);
    });

    it('drops empty parts rather than leaving a stray separator', () => {
        expect(
            reviewerLead({ name: 'Maria S.', country: '', when: 'July 2026' }),
        ).toEqual(['Maria S.', 'July 2026']);
    });

    it('gives the preview card and the full section the SAME parts', () => {
        // This equivalence IS the requirement.
        const r = review();
        const preview = toTourReview(r, 'en');
        const full = toFullReview(r, 'en', 'Host', 'Island Tours');
        expect(
            reviewerLead({
                name: preview.name,
                country: preview.country,
                when: preview.date,
            }),
        ).toEqual(
            reviewerLead({
                name: full.name,
                country: full.country,
                when: full.date,
            }),
        );
    });
});
