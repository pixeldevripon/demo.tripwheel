import { describe, expect, it } from 'vitest';
import { nearestStopIndex, resolveSnapStops } from './scroll-stops';

describe('resolveSnapStops', () => {
    it('clamps marks past the end of the scroll into one shared rest position', () => {
        // 3 compare columns on a 360px phone: columns at 0 / 99 / 198 but only
        // 71px of overflow - column 2 and 3 both come to rest at 71.
        expect(resolveSnapStops([0, 99, 198], 71)).toEqual([0, 71]);
    });

    it('keeps every distinct reachable stop (4-column table)', () => {
        expect(resolveSnapStops([0, 106.5, 213], 185)).toEqual([0, 106.5, 185]);
    });

    it('returns no stops when the row does not meaningfully scroll', () => {
        expect(resolveSnapStops([0, 99, 198], 0)).toEqual([]);
        expect(resolveSnapStops([0, 99, 198], 10)).toEqual([]);
    });

    it('returns no stops when everything collapses to one rest position', () => {
        expect(resolveSnapStops([0, 1, 2], 400)).toEqual([]);
    });

    it('treats sub-device-pixel differences as the same stop', () => {
        expect(resolveSnapStops([0, 100, 100.4], 300)).toEqual([0, 100]);
    });

    it('clamps negative marks to the start', () => {
        expect(resolveSnapStops([-30, 120], 200)).toEqual([0, 120]);
    });

    it('sorts unordered marks', () => {
        expect(resolveSnapStops([120, 0, 60], 200)).toEqual([0, 60, 120]);
    });
});

describe('nearestStopIndex', () => {
    const stops = [0, 106.5, 185];

    it('picks the stop nearest the current scroll position', () => {
        expect(nearestStopIndex(stops, 0)).toBe(0);
        expect(nearestStopIndex(stops, 40)).toBe(0);
        expect(nearestStopIndex(stops, 90)).toBe(1);
        expect(nearestStopIndex(stops, 184)).toBe(2);
    });

    it('handles positions past the last stop (rubber-banding)', () => {
        expect(nearestStopIndex(stops, 240)).toBe(2);
    });

    it('is safe on an empty list', () => {
        expect(nearestStopIndex([], 50)).toBe(0);
    });
});
