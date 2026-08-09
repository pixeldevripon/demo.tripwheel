import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/dictionaries/en.json';
import {
    DUMMY_BOOKING_DATA,
    type BookingBand,
    type TourBookingData,
    type TourBookingDict,
} from '@/lib/tours/booking';
import { addOnMaxOf, createBookingStore, deriveBooking } from './booking-store';

/**
 * Pastel #58 · the booking card as the client redrew it in mck-15.
 *
 * The real English dictionary, not a stub: half of what this issue asked for is
 * copy ("$150 per person", "2 adults × $150"), and a stub would let the wording
 * drift out from under the assertions that check it.
 */
const dict = en.destination.tour.booking as unknown as TourBookingDict;

function storeWith(over: Partial<TourBookingData> = {}) {
    return createBookingStore({
        dict,
        data: { ...DUMMY_BOOKING_DATA, ...over },
    });
}

/** The card's full read-only view for a given selection. */
function view(
    over: Partial<TourBookingData> = {},
    setup?: (s: ReturnType<typeof storeWith>) => void
) {
    const store = storeWith(over);
    setup?.(store);
    return deriveBooking(store.getState());
}

/** A complete selection - a date, a time and a party - so the price resolves. */
function selectAll(store: ReturnType<typeof storeWith>) {
    store.getState().pickDate(new Date(2030, 7, 14));
    store.getState().selectTime('08:00');
}

const bandOf = (data: TourBookingData, id: string): BookingBand =>
    data.bands.find(b => b.id === id)!;

describe('optional extras · the per-person pricing bug', () => {
    it('adds one open bar once, not once per traveller', () => {
        // The bug in the build: two adults adding one $22 open bar were charged
        // $44. The stepper counts UNITS and the unit is whatever the price line
        // says, so one step on a per-person extra is one person.
        const data: Partial<TourBookingData> = {
            addOns: [
                {
                    id: 'bar',
                    name: 'Open bar upgrade',
                    description: null,
                    price: 22,
                    unit: 'PER_PERSON',
                    maxQuantity: 10,
                },
            ],
        };
        const store = storeWith(data);
        selectAll(store);
        const adult = bandOf(store.getState().data, 'adult');
        store.getState().setBandCount(adult, 2);
        const before = deriveBooking(store.getState()).total;

        store.getState().setAddOnQty('bar', 1);
        const after = deriveBooking(store.getState()).total;

        expect(after - before).toBe(22);
    });

    it('scales with the quantity the traveller actually picked', () => {
        const store = storeWith({
            addOns: [
                {
                    id: 'bar',
                    name: 'Open bar upgrade',
                    description: null,
                    price: 22,
                    unit: 'PER_PERSON',
                    maxQuantity: 10,
                },
            ],
        });
        selectAll(store);
        store.getState().setBandCount(bandOf(store.getState().data, 'adult'), 2);
        const before = deriveBooking(store.getState()).total;

        // Two open bars for two adults is the traveller's choice to make.
        store.getState().setAddOnQty('bar', 2);
        expect(deriveBooking(store.getState()).total - before).toBe(44);
    });

    it('names the extra by quantity in the breakdown, not by party', () => {
        const store = storeWith({
            addOns: [
                {
                    id: 'bar',
                    name: 'Open bar',
                    description: null,
                    price: 22,
                    unit: 'PER_PERSON',
                    maxQuantity: 10,
                },
            ],
        });
        selectAll(store);
        store.getState().setBandCount(bandOf(store.getState().data, 'adult'), 2);
        store.getState().setAddOnQty('bar', 1);

        const row = deriveBooking(store.getState()).priceRows.find(
            r => r.id === 'addon-bar'
        );
        expect(row?.text).toBe('Open bar × 1');
        expect(row?.amount).toBe(22);
    });
});

describe('optional extras · the caps', () => {
    it('stops a per-person extra at the paying travellers', () => {
        expect(
            addOnMaxOf({ unit: 'PER_PERSON', maxQuantity: 10 }, 4)
        ).toBe(4);
    });

    it('lets the operator ceiling win when it is lower', () => {
        expect(addOnMaxOf({ unit: 'PER_PERSON', maxQuantity: 2 }, 6)).toBe(2);
    });

    it('stops a per-booking extra at one, whatever the operator set', () => {
        // A GoPro package cannot be bought twice for the same booking.
        expect(addOnMaxOf({ unit: 'FLAT', maxQuantity: 5 }, 6)).toBe(1);
    });

    it('does not count a free band as a paying traveller', () => {
        // Nobody buys an open bar for a two-year-old.
        const store = storeWith();
        store.getState().setBandCount(bandOf(store.getState().data, 'adult'), 2);
        store
            .getState()
            .setBandCount(bandOf(store.getState().data, 'infant'), 1);

        expect(deriveBooking(store.getState()).payingCount).toBe(2);
    });

    it('refuses a quantity above the cap at the store, not just in the UI', () => {
        const store = storeWith({
            addOns: [
                {
                    id: 'bar',
                    name: 'Open bar',
                    description: null,
                    price: 22,
                    unit: 'PER_PERSON',
                    maxQuantity: 10,
                },
            ],
        });
        store.getState().setBandCount(bandOf(store.getState().data, 'adult'), 2);

        store.getState().setAddOnQty('bar', 5);
        expect(store.getState().addOnQty.bar).toBe(2);
    });

    it('re-clamps the extras when the party shrinks under them', () => {
        const store = storeWith({
            addOns: [
                {
                    id: 'bar',
                    name: 'Open bar',
                    description: null,
                    price: 22,
                    unit: 'PER_PERSON',
                    maxQuantity: 10,
                },
            ],
        });
        const adult = bandOf(store.getState().data, 'adult');
        store.getState().setBandCount(adult, 4);
        store.getState().setAddOnQty('bar', 4);
        expect(store.getState().addOnQty.bar).toBe(4);

        store.getState().setBandCount(adult, 2);
        expect(store.getState().addOnQty.bar).toBe(2);
    });
});

describe('the price breakdown', () => {
    it('reads "2 adults × $120", not "Adult x 2 x $120"', () => {
        const store = storeWith();
        selectAll(store);
        store.getState().setBandCount(bandOf(store.getState().data, 'adult'), 2);

        const row = deriveBooking(store.getState()).priceRows.find(
            r => r.id === 'adult'
        );
        expect(row?.text).toBe('2 adults × $120');
    });

    it('declines the noun with the count', () => {
        const store = storeWith();
        selectAll(store);
        store.getState().setBandCount(bandOf(store.getState().data, 'child'), 1);

        const row = deriveBooking(store.getState()).priceRows.find(
            r => r.id === 'child'
        );
        expect(row?.text).toBe('1 child × $65');
    });

    it('states a free band as a fact, with no arithmetic about nothing', () => {
        const store = storeWith();
        selectAll(store);
        store
            .getState()
            .setBandCount(bandOf(store.getState().data, 'infant'), 1);

        const row = deriveBooking(store.getState()).priceRows.find(
            r => r.id === 'infant'
        );
        // The summary prints "Free" against a zero amount; the label carries no
        // "× $0" tail.
        expect(row?.text).toBe('1 infant');
        expect(row?.amount).toBe(0);
    });
});

describe('party rows', () => {
    it('puts "Age" inside the label', () => {
        const v = view();
        const adult = DUMMY_BOOKING_DATA.bands.find(b => b.id === 'adult')!;
        expect(v.bandLabel(adult)).toBe('Adult (Age 13+)');
    });

    it('renders a bounded band as a range', () => {
        const v = view();
        const child = DUMMY_BOOKING_DATA.bands.find(b => b.id === 'child')!;
        expect(v.bandLabel(child)).toBe('Child (Age 4-12)');
    });

    it('drops an operator-typed age qualifier in favour of the localized one', () => {
        // "Adult (13+)" as the operator typed it is English on all seven
        // locales; only the noun in front of the bracket is theirs to keep.
        const v = view();
        expect(
            v.bandLabel({
                ...DUMMY_BOOKING_DATA.bands[0],
                label: 'Adult (13+)',
            })
        ).toBe('Adult (Age 13+)');
    });

    it('keeps a noun the operator chose for itself', () => {
        const v = view();
        expect(
            v.bandLabel({
                ...DUMMY_BOOKING_DATA.bands[0],
                label: 'Student',
            })
        ).toBe('Student (Age 13+)');
    });

    it('keeps a band with no age bounds to its bare noun', () => {
        const v = view();
        expect(
            v.bandLabel({
                ...DUMMY_BOOKING_DATA.bands[0],
                minAge: null,
                maxAge: null,
                label: 'Guests',
            })
        ).toBe('Guests');
    });

    it('prices a row "$120 per person", not "$120/per person"', () => {
        const v = view();
        const adult = DUMMY_BOOKING_DATA.bands.find(b => b.id === 'adult')!;
        expect(v.bandPriceLabel(adult)).toBe('$120 per person');
    });
});

describe('a lone departure', () => {
    it('is selected without a chip to click', () => {
        // A tour with one departure shows no chip row at all, so nothing on
        // screen could make that choice.
        const store = storeWith({
            slots: [{ time: '09:00', status: 'available', remaining: null }],
        });
        expect(store.getState().selectedTime).toBe('09:00');
        // Still not ready - the date is the question that remains.
        expect(deriveBooking(store.getState()).ready).toBe(false);

        store.getState().pickDate(new Date(2030, 7, 14));
        expect(store.getState().selectedTime).toBe('09:00');
        expect(deriveBooking(store.getState()).ready).toBe(true);
    });

    it('leaves a real choice unmade', () => {
        const store = storeWith();
        store.getState().pickDate(new Date(2030, 7, 14));
        expect(store.getState().selectedTime).toBeNull();
        expect(deriveBooking(store.getState()).ready).toBe(false);
    });

    it('leaves the choice alone when a sold-out sibling puts a row on screen', () => {
        // Two departures means the chip row renders, so there IS a control to
        // click - picking for the traveller while it sits there would be the
        // widget answering a question it had not been asked.
        const store = storeWith({
            slots: [
                { time: '09:00', status: 'available', remaining: null },
                { time: '14:00', status: 'sold_out', remaining: 0 },
            ],
        });
        expect(store.getState().selectedTime).toBeNull();
    });

    it('picks nothing when the only departure is sold out', () => {
        const store = storeWith({
            slots: [{ time: '09:00', status: 'sold_out', remaining: 0 }],
        });
        expect(store.getState().selectedTime).toBeNull();
    });
});

describe('readiness', () => {
    it('waits for a date before showing any price', () => {
        const store = storeWith();
        expect(deriveBooking(store.getState()).ready).toBe(false);
    });

    it('is ready the moment the selection is complete - no second click', () => {
        const store = storeWith();
        selectAll(store);
        expect(deriveBooking(store.getState()).ready).toBe(true);
    });

    it('keeps the party editable after it is ready', () => {
        const store = storeWith();
        selectAll(store);
        const v = deriveBooking(store.getState());
        expect(v.editingParty).toBe(true);
        expect(v.headerHasChevron).toBe(true);
    });
});
