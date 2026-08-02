import { describe, expect, it } from 'vitest';

import { daysUntil, freeWindowOpen } from './traveller-groups';

/**
 * The two pure judgements behind the account area's copy. Both are fed the
 * SERVER's request instant rather than a live clock, so they are fully
 * deterministic - which is exactly why they belong in unit tests rather than
 * being re-derived inside three components.
 */

const NOW = Date.parse('2026-08-12T12:00:00Z');

describe('freeWindowOpen', () => {
    it('is open before the deadline', () => {
        expect(freeWindowOpen('2026-08-12T18:00:00Z', NOW)).toBe(true);
    });

    it('is closed after the deadline', () => {
        expect(freeWindowOpen('2026-08-12T06:00:00Z', NOW)).toBe(false);
    });

    it('is closed exactly ON the deadline', () => {
        // Strictly greater-than: the moment it arrives, the window is gone.
        expect(freeWindowOpen('2026-08-12T12:00:00Z', NOW)).toBe(false);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
    ])('treats %s as CLOSED, never open', (_label, deadline) => {
        // The rule that matters. Without a deadline the free window cannot be
        // evidenced, and we never promise a refund we cannot back. This used to
        // be re-derived in the payment box, the cancel panel and the next-trip
        // hero - all three render inside one expanded card, so softening it in
        // one place gave a card that contradicted itself.
        expect(freeWindowOpen(deadline, NOW)).toBe(false);
    });

    it('treats an unparseable deadline as closed rather than open', () => {
        expect(freeWindowOpen('not a date', NOW)).toBe(false);
    });
});

describe('daysUntil', () => {
    it('counts whole days to a future island date', () => {
        expect(daysUntil('2026-08-14', NOW)).toBe(2);
    });

    it('returns 1 for tomorrow and 0 for today', () => {
        expect(daysUntil('2026-08-13', NOW)).toBe(1);
        expect(daysUntil('2026-08-12', NOW)).toBe(0);
    });

    it('goes negative for a past date', () => {
        expect(daysUntil('2026-08-10', NOW)).toBe(-2);
    });

    it('is measured from the START of today, not the current time', () => {
        // Otherwise the kicker would flip from "in 2 days" to "in 1 day" partway
        // through an afternoon.
        const morning = Date.parse('2026-08-12T00:30:00Z');
        const evening = Date.parse('2026-08-12T23:30:00Z');
        expect(daysUntil('2026-08-14', morning)).toBe(
            daysUntil('2026-08-14', evening),
        );
    });

    it('returns 0 for an unparseable date rather than NaN', () => {
        expect(daysUntil('not a date', NOW)).toBe(0);
    });
});
