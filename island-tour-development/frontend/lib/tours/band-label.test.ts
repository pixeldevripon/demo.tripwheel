import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/dictionaries/en.json';
import de from '@/lib/i18n/dictionaries/de.json';
import { bandCountLabel, type BandPluralDict } from './band-label';

/**
 * The booking card and the checkout summary describe the same booking one
 * navigation apart, so they name a band with the same helper. They used to
 * word it two ways - "2 adults × $150" on the card, "2 Adult × $150" on the
 * summary (Pastel #58).
 *
 * The grammar is the point: the count decides the form, per locale.
 */
const EN = en.destination.tour.booking.bands as BandPluralDict;
const DE = de.destination.tour.booking.bands as BandPluralDict;

const band = (bandType: string, label = 'Adult (13+)') => ({
    bandType,
    label,
});

describe('bandCountLabel', () => {
    it('declines the noun with the count', () => {
        expect(bandCountLabel(band('ADULT'), 1, EN, 'en')).toBe('1 adult');
        expect(bandCountLabel(band('ADULT'), 2, EN, 'en')).toBe('2 adults');
    });

    it('uses the irregular plural, never a bare -s', () => {
        expect(bandCountLabel(band('CHILD'), 1, EN, 'en')).toBe('1 child');
        expect(bandCountLabel(band('CHILD'), 5, EN, 'en')).toBe('5 children');
    });

    it('takes the plural from the locale, not from English', () => {
        expect(bandCountLabel(band('CHILD'), 1, DE, 'de')).toBe('1 Kind');
        expect(bandCountLabel(band('CHILD'), 5, DE, 'de')).toBe('5 Kinder');
    });

    it('names an infant band as an infant', () => {
        expect(bandCountLabel(band('INFANT'), 1, EN, 'en')).toBe('1 infant');
        expect(bandCountLabel(band('INFANT'), 3, EN, 'en')).toBe('3 infants');
    });

    it('falls back to the operator noun for a type it does not know', () => {
        // Their bracket is dropped - it is English on all seven locales - but
        // the noun they chose is theirs to keep.
        expect(
            bandCountLabel(band('STUDENT_PASS', 'Student (16-24)'), 2, EN, 'en')
        ).toBe('2 Student');
    });

    it('falls back when the dictionary has no band copy at all', () => {
        expect(bandCountLabel(band('ADULT'), 2, undefined, 'en')).toBe(
            '2 Adult'
        );
    });
});
