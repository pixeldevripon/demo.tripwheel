import { describe, expect, it } from 'vitest';

import type { TourBookingData } from '@/lib/tours/booking';
import { buildBookingSelection, SYNTHETIC_BAND_IDS } from './checkout';

/**
 * THE contract between the live quote and the checkout reserve.
 *
 * Both endpoints are handed a party payload built by this one function. If the
 * two ever build it differently, the price quoted in the booking widget is not
 * the price reserved at checkout - which is why the live quote hook was moved
 * onto this helper rather than keeping its own copy.
 */

type Band = TourBookingData['bands'][number];

const band = (id: string, kind: Band['kind'] = 'participant') =>
    ({ id, kind, label: id, price: 0 }) as unknown as Band;

const tour = (
    pricingModel: TourBookingData['pricingModel'],
    bands: Band[],
): TourBookingData => ({ pricingModel, bands }) as unknown as TourBookingData;

const PER_PERSON = tour('PER_PERSON', [
    band('adult'),
    band('child'),
    band('spectator', 'spectator'),
]);
const UNIT = tour('UNIT', [band('unit-guests')]);

describe('buildBookingSelection - PER_PERSON', () => {
    it('sends one line per counted band', () => {
        expect(buildBookingSelection(PER_PERSON, { adult: 2, child: 1 })).toEqual({
            items: [
                { ageBandId: 'adult', quantity: 2 },
                { ageBandId: 'child', quantity: 1 },
            ],
        });
    });

    it('includes spectators - they are age bands too', () => {
        expect(
            buildBookingSelection(PER_PERSON, { adult: 1, spectator: 2 }),
        ).toEqual({
            items: [
                { ageBandId: 'adult', quantity: 1 },
                { ageBandId: 'spectator', quantity: 2 },
            ],
        });
    });

    it('omits zero-count bands', () => {
        expect(buildBookingSelection(PER_PERSON, { adult: 2, child: 0 })).toEqual({
            items: [{ ageBandId: 'adult', quantity: 2 }],
        });
    });

    it('IGNORES a band id this tour does not have', () => {
        // REGRESSION. This used to iterate the `counts` object, and at checkout
        // `counts` is parsed from the URL, which accepts any id. A stale or
        // crafted id became a line the backend then rejected - while the live
        // quote, which filtered against `data.bands`, had priced without it.
        expect(
            buildBookingSelection(PER_PERSON, { adult: 2, 'ghost-band': 5 }),
        ).toEqual({ items: [{ ageBandId: 'adult', quantity: 2 }] });
    });

    it('returns null when nothing is selected', () => {
        expect(buildBookingSelection(PER_PERSON, {})).toBeNull();
        expect(buildBookingSelection(PER_PERSON, { adult: 0 })).toBeNull();
    });

    it('returns null on a synthetic band - it has no real ageBandId to send', () => {
        const synthetic = tour('PER_PERSON', [band('default-adult')]);
        expect(buildBookingSelection(synthetic, { 'default-adult': 2 })).toBeNull();
    });

    it('follows band ORDER, not object-key order', () => {
        // Stable output keeps the request key (and so the quote cache) stable
        // regardless of the order counts were written in.
        const out = buildBookingSelection(PER_PERSON, { child: 1, adult: 2 });
        expect(out).toEqual({
            items: [
                { ageBandId: 'adult', quantity: 2 },
                { ageBandId: 'child', quantity: 1 },
            ],
        });
    });
});

describe('buildBookingSelection - UNIT', () => {
    it('sends a headcount rather than band lines', () => {
        expect(buildBookingSelection(UNIT, { 'unit-guests': 4 })).toEqual({
            guests: 4,
        });
    });

    it('does NOT reject the synthetic id here - no band id travels', () => {
        expect(SYNTHETIC_BAND_IDS.has('unit-guests')).toBe(true);
        expect(buildBookingSelection(UNIT, { 'unit-guests': 2 })).toEqual({
            guests: 2,
        });
    });

    it('excludes unknown ids from the headcount', () => {
        // REGRESSION, and the sharper half of it: summing the raw counts object
        // let a stale URL id INFLATE the headcount, so the traveller was quoted
        // and charged for more guests than the widget ever showed.
        expect(
            buildBookingSelection(UNIT, { 'unit-guests': 2, 'ghost-band': 3 }),
        ).toEqual({ guests: 2 });
    });

    it('returns null for an empty selection', () => {
        expect(buildBookingSelection(UNIT, {})).toBeNull();
        expect(buildBookingSelection(UNIT, { 'unit-guests': 0 })).toBeNull();
    });
});

describe('the quote/reserve agreement', () => {
    it('matches the widget headcount rule (sum over the tour\'s own bands)', () => {
        // `travelerCountOf` in the booking store sums `counts` over
        // `data.bands`. The UNIT payload must agree with it exactly, or the
        // card shows one party size and the server prices another.
        const counts = { adult: 2, child: 1, 'ghost-band': 9 };
        const travelerCount = PER_PERSON.bands.reduce(
            (n, b) => n + (counts[b.id as keyof typeof counts] ?? 0),
            0,
        );
        const unitTour = tour('UNIT', PER_PERSON.bands);

        expect(buildBookingSelection(unitTour, counts)).toEqual({
            guests: travelerCount,
        });
    });
});
