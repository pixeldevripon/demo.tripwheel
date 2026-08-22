import { describe, expect, it } from 'vitest';
import type { PublicTourAgeBand, PublicTourDetail } from '@/types/tour-detail';
import { bandTypeRank, buildTourBookingData } from './booking';

/**
 * Pastel #58 · the party rows come out in a FIXED age order - adults, then
 * children, then infants - in the panel and in the breakdown alike.
 *
 * In the build they came out in the operator's `displayOrder`, which is assigned
 * in the order the bands happened to be created. So adding an infant band to a
 * live tour dropped its row between Adult and Child, and nobody who edited that
 * tour had any reason to expect it.
 */

function band(over: Partial<PublicTourAgeBand>): PublicTourAgeBand {
    return {
        id: 'b',
        bandType: 'ADULT',
        participation: 'PARTICIPANT',
        label: 'Adult',
        minAge: null,
        maxAge: null,
        price: '100',
        priceOriginal: null,
        priceNet: null,
        isDefault: false,
        displayOrder: 0,
        ...over,
    };
}

/**
 * The smallest tour payload `buildTourBookingData` reads. Cast rather than
 * spelled out: the mapper touches a dozen of ~80 fields, and a full fixture
 * would be mostly noise that goes stale on the next payload change.
 */
function detailWith(ageBands: PublicTourAgeBand[]): PublicTourDetail {
    return {
        ageBands,
        addOns: [],
        pickupLocations: [],
        startTimes: ['09:00'],
        pricingModel: 'PER_PERSON',
        defaultCurrency: 'USD',
        priceFrom: '100',
        basePrice: '100',
        extraPersonPrice: null,
        unitIncludedGuests: null,
        wholeUnitType: null,
        bookingType: null,
        paymentModel: 'OPERATOR_LINK',
        cancellationHours: 48,
        depositPct: '20',
        minPartySize: 1,
        maxPartySize: 20,
        pickupModel: 'NONE',
        pickupRequired: false,
        likelyToSellOut: false,
        likelyToSellOutOverride: null,
    } as unknown as PublicTourDetail;
}

const idsOf = (bands: PublicTourAgeBand[]) =>
    buildTourBookingData(detailWith(bands)).bands.map(b => b.id);

describe('bandTypeRank', () => {
    it('orders adults before children before infants', () => {
        expect(bandTypeRank('ADULT')).toBeLessThan(bandTypeRank('CHILD'));
        expect(bandTypeRank('CHILD')).toBeLessThan(bandTypeRank('INFANT'));
    });

    it('sorts an unrecognised type last, never first', () => {
        // An unknown type is a band we cannot place; guessing the top of the
        // list is the louder mistake.
        expect(bandTypeRank('SOMETHING_NEW')).toBeGreaterThan(
            bandTypeRank('INFANT')
        );
    });
});

describe('party row order', () => {
    it('puts an added infant last, not between adult and child', () => {
        // Exactly the shape that goes wrong: the infant band was created after
        // the other two, so its displayOrder says nothing about its age.
        const ids = idsOf([
            band({ id: 'adult', bandType: 'ADULT', displayOrder: 0 }),
            band({ id: 'infant', bandType: 'INFANT', displayOrder: 1 }),
            band({ id: 'child', bandType: 'CHILD', displayOrder: 2 }),
        ]);
        expect(ids).toEqual(['adult', 'child', 'infant']);
    });

    it('holds the order whatever displayOrder says', () => {
        const ids = idsOf([
            band({ id: 'infant', bandType: 'INFANT', displayOrder: 0 }),
            band({ id: 'child', bandType: 'CHILD', displayOrder: 1 }),
            band({ id: 'adult', bandType: 'ADULT', displayOrder: 2 }),
        ]);
        expect(ids).toEqual(['adult', 'child', 'infant']);
    });

    it('falls back to displayOrder between two bands of the same type', () => {
        const ids = idsOf([
            band({ id: 'adult-b', bandType: 'ADULT', displayOrder: 5 }),
            band({ id: 'adult-a', bandType: 'ADULT', displayOrder: 1 }),
        ]);
        expect(ids).toEqual(['adult-a', 'adult-b']);
    });

    it('keeps spectators after every participant', () => {
        const ids = idsOf([
            band({
                id: 'spec',
                bandType: 'ADULT',
                participation: 'SPECTATOR',
                displayOrder: 0,
            }),
            band({ id: 'infant', bandType: 'INFANT', displayOrder: 1 }),
            band({ id: 'adult', bandType: 'ADULT', displayOrder: 2 }),
        ]);
        expect(ids).toEqual(['adult', 'infant', 'spec']);
    });

    it('carries the age bounds through, so the label can be localized', () => {
        const [adult] = buildTourBookingData(
            detailWith([
                band({ id: 'adult', bandType: 'ADULT', minAge: 13 }),
            ])
        ).bands;
        expect(adult.bandType).toBe('ADULT');
        expect(adult.minAge).toBe(13);
        expect(adult.maxAge).toBeNull();
    });
});
