import { describe, expect, it } from 'vitest';

import { parseCheckoutSelection } from './checkout';

/**
 * The checkout page's entire input is a query string, so this parser is the
 * app's trust boundary for the booking selection. Everything it emits is
 * re-derived server-side against live tour data before it can affect a price -
 * but what it lets THROUGH still decides what the traveller is shown, and which
 * backend validator errors they end up reading.
 */

const parse = (qs: string) =>
    parseCheckoutSelection(
        Object.fromEntries(new URLSearchParams(qs).entries()),
    );

const UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('parseCheckoutSelection - party and add-on counts', () => {
    it('reads `id:count` pairs', () => {
        expect(parse('party=adult:2,child:1').counts).toEqual({
            adult: 2,
            child: 1,
        });
    });

    it('reads add-ons the same way', () => {
        expect(parse('addons=snorkel:2').addOns).toEqual({ snorkel: 2 });
    });

    it('drops zero and negative counts', () => {
        expect(parse('party=adult:0,child:-3').counts).toEqual({});
    });

    it('drops FRACTIONAL counts', () => {
        // REGRESSION. `Number.isFinite` accepted "2.5", which then reached the
        // backend's `@IsInt()` and came back as a validator string rendered
        // straight at a traveller on the page where they are about to pay.
        expect(parse('party=adult:2.5').counts).toEqual({});
    });

    it('drops non-numeric and malformed pairs', () => {
        expect(parse('party=adult:abc,child,:2,adult2:').counts).toEqual({});
    });

    it('keeps the good pairs alongside the bad', () => {
        expect(parse('party=adult:2,child:notanumber').counts).toEqual({
            adult: 2,
        });
    });

    it('returns an empty object when the param is absent', () => {
        expect(parse('').counts).toEqual({});
        expect(parse('').addOns).toEqual({});
    });
});

describe('parseCheckoutSelection - the UUID-shaped ids', () => {
    it('keeps a well-formed departure and quote id', () => {
        const out = parse(`departure=${UUID}&quote=${UUID}`);
        expect(out.departureId).toBe(UUID);
        expect(out.quoteId).toBe(UUID);
    });

    it.each([
        ['junk', 'junk'],
        ['a truncated uuid', '9b1deb4d-3b7d-4bad'],
        ['a path traversal attempt', '../../admin'],
        ['an empty value', ''],
    ])('drops %s rather than forwarding it', (_label, value) => {
        // REGRESSION. These were read raw, so a stale or hand-edited `?quote=`
        // failed at `@IsUUID()` on the backend and the checkout relayed that
        // message verbatim - "quoteId must be a UUID", shown to a traveller.
        // Both are optional to the flow (reserve recomputes regardless of
        // quoteId), so discarding a malformed one is strictly better.
        expect(parse(`quote=${encodeURIComponent(value)}`).quoteId).toBeNull();
        expect(
            parse(`departure=${encodeURIComponent(value)}`).departureId,
        ).toBeNull();
    });

    it('accepts a uuid of any VERSION, not just v4', () => {
        // Departure ids are backend-generated (Prisma `@default(uuid())`).
        // Version-pinning here would mean a future Prisma default silently
        // rejecting every real id - far worse than the input being filtered.
        const v7 = '018f5d5c-1b7a-7c3e-9c4b-2b0d7b3dcb6d';
        expect(parse(`departure=${v7}`).departureId).toBe(v7);
    });

    it('is case-insensitive', () => {
        const upper = UUID.toUpperCase();
        expect(parse(`quote=${upper}`).quoteId).toBe(upper);
    });
});

describe('parseCheckoutSelection - the pass-through fields', () => {
    it('reads date, time and currency', () => {
        const out = parse('date=2026-08-14&time=09:00&currency=EUR');
        expect(out.date).toBe('2026-08-14');
        expect(out.time).toBe('09:00');
        expect(out.currency).toBe('EUR');
    });

    it('returns null for absent fields rather than undefined', () => {
        const out = parse('');
        expect(out.date).toBeNull();
        expect(out.time).toBeNull();
        expect(out.departureId).toBeNull();
        expect(out.quoteId).toBeNull();
    });

    it('takes the FIRST value when a param is repeated', () => {
        expect(
            parseCheckoutSelection({ date: ['2026-08-14', '2026-09-01'] }).date,
        ).toBe('2026-08-14');
    });
});
