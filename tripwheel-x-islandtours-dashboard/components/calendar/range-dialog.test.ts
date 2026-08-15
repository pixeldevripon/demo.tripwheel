/**
 * The range modal's consequence line (client review #5): the sentence must
 * state departures, tours and kept guests with correct number agreement -
 * a wrong plural in a destructive-action confirmation reads as sloppiness
 * exactly where trust matters most.
 */
import { describe, expect, it } from 'vitest';
import { impactSentence } from './range-dialog';

describe('impactSentence', () => {
    it('states the full blast radius across tours with guests', () => {
        expect(
            impactSentence(
                { departures: 14, tours: 3, bookedGuests: 46 },
                true,
            ),
        ).toBe(
            'This closes 14 departures across 3 tours. 46 booked guests keep their bookings.',
        );
    });

    it('drops the tour clause for a single-tour scope', () => {
        expect(
            impactSentence(
                { departures: 5, tours: 1, bookedGuests: 0 },
                false,
            ),
        ).toBe('This closes 5 departures.');
    });

    it('agrees in number for one departure and one guest', () => {
        expect(
            impactSentence({ departures: 1, tours: 1, bookedGuests: 1 }, false),
        ).toBe('This closes 1 departure. 1 booked guest keeps their booking.');
    });

    it('keeps a singular tour clause when the scope spans tours but only one is hit', () => {
        expect(
            impactSentence({ departures: 2, tours: 1, bookedGuests: 0 }, true),
        ).toBe('This closes 2 departures across 1 tour.');
    });

    it('says out loud when nothing is scheduled yet', () => {
        expect(
            impactSentence({ departures: 0, tours: 0, bookedGuests: 0 }, true),
        ).toBe(
            'No departures are scheduled in these days yet - the days still close.',
        );
    });

    it('omits the guest sentence when nobody is booked', () => {
        expect(
            impactSentence({ departures: 3, tours: 2, bookedGuests: 0 }, true),
        ).not.toContain('guest');
    });
});
