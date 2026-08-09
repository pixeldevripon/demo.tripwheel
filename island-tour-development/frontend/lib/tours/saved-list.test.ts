import { describe, expect, it } from 'vitest';

import { parseIdList, savedPriceWas, soleDestinationSlug } from './saved-list';

/**
 * The three judgement calls the saved tours page makes about its own list
 * (mck-17). Each one is a place where the honest answer is "say nothing", and
 * each one shipped as a rule rather than as a component, so it can be checked.
 */
describe('savedPriceWas', () => {
    it('reports the old price when it moved, in both directions', () => {
        expect(
            savedPriceWas({ price: 79, currency: 'USD' }, { price: 89, currency: 'USD' })
        ).toBe(79);
        expect(
            savedPriceWas({ price: 99, currency: 'USD' }, { price: 89, currency: 'USD' })
        ).toBe(99);
    });

    it('says nothing when the price has not moved', () => {
        expect(
            savedPriceWas({ price: 89, currency: 'USD' }, { price: 89, currency: 'USD' })
        ).toBeNull();
    });

    it('says nothing when we never captured a price', () => {
        expect(savedPriceWas(null, { price: 89, currency: 'USD' })).toBeNull();
    });

    it('says nothing across a currency switch - that is an exchange rate, not a price change', () => {
        expect(
            savedPriceWas({ price: 79, currency: 'USD' }, { price: 72, currency: 'EUR' })
        ).toBeNull();
    });

    it('ignores float noise below half a cent', () => {
        expect(
            savedPriceWas(
                { price: 89.0, currency: 'USD' },
                { price: 89.001, currency: 'USD' }
            )
        ).toBeNull();
    });
});

describe('soleDestinationSlug', () => {
    it('names the island when every saved tour is on it', () => {
        expect(
            soleDestinationSlug([
                { destinationSlug: 'curacao' },
                { destinationSlug: 'curacao' },
            ])
        ).toBe('curacao');
    });

    it('names none when the list spans islands, rather than picking a winner', () => {
        expect(
            soleDestinationSlug([
                { destinationSlug: 'curacao' },
                { destinationSlug: 'aruba' },
            ])
        ).toBeNull();
    });

    it('ignores cards with no island at all', () => {
        expect(
            soleDestinationSlug([
                { destinationSlug: 'curacao' },
                { destinationSlug: null },
            ])
        ).toBe('curacao');
        expect(soleDestinationSlug([{ destinationSlug: null }])).toBeNull();
        expect(soleDestinationSlug([])).toBeNull();
    });
});

describe('parseIdList', () => {
    it('reads a shared or emailed list', () => {
        expect(parseIdList('a,b,c')).toEqual(['a', 'b', 'c']);
        expect(parseIdList(' a , b ')).toEqual(['a', 'b']);
    });

    it('deduplicates - a doubled id would render the same card twice', () => {
        expect(parseIdList('a,b,a')).toEqual(['a', 'b']);
    });

    it('drops anything that is not a plausible id', () => {
        // This value is attacker-controlled and goes on to a backend query.
        expect(parseIdList('a,../../etc/passwd,b')).toEqual(['a', 'b']);
        expect(parseIdList('a,<script>,b')).toEqual(['a', 'b']);
        expect(parseIdList(`a,${'x'.repeat(65)},b`)).toEqual(['a', 'b']);
    });

    it('is empty for an absent parameter', () => {
        expect(parseIdList(null)).toEqual([]);
        expect(parseIdList('')).toEqual([]);
        expect(parseIdList(',, ,')).toEqual([]);
    });

    it('caps at the resolver limit', () => {
        const many = Array.from({ length: 130 }, (_, i) => `t${i}`).join(',');
        expect(parseIdList(many)).toHaveLength(100);
    });
});
