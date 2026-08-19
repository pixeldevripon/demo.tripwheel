/**
 * These two validators stand between a dashboard text field and an inline
 * `<script>`, so the cases that matter most are the malformed ones: anything
 * that is not a real Google ID must come back null (= not configured) rather
 * than be concatenated into executable JavaScript.
 */
import { describe, expect, it } from 'vitest';
import { validGa4Id, validGtmId } from './tag-ids';

describe('validGtmId', () => {
    it('accepts a real container ID and trims surrounding whitespace', () => {
        expect(validGtmId('GTM-ABC1234')).toBe('GTM-ABC1234');
        expect(validGtmId('  GTM-ABC1234  ')).toBe('GTM-ABC1234');
    });

    it('UPPERCASES a lowercase paste rather than passing it through', () => {
        // `gtm.js?id=` is fully case-sensitive: `gtm-abc1234` 404s. Returning it
        // as typed emitted a healthy-looking loader whose fetch failed, silently
        // killing the whole booking_complete fan-out. Verified against the real
        // endpoint: GTM-N5LT88 -> 200, gtm-n5lt88 -> 404, GTM-n5lt88 -> 404.
        expect(validGtmId('gtm-abc1234')).toBe('GTM-ABC1234');
        expect(validGtmId('GTM-abc1234')).toBe('GTM-ABC1234');
    });

    it.each([
        ['empty', ''],
        ['whitespace only', '   '],
        ['null', null],
        ['undefined', undefined],
        ['the GA4 prefix', 'G-ABC1234567'],
        ['no prefix', 'ABC1234'],
        ['too short', 'GTM-AB'],
        ['too long', 'GTM-ABCDEFGHIJKL'],
        ['a hyphen inside', 'GTM-ABC-123'],
        ['trailing junk', 'GTM-ABC1234x!'],
    ])('rejects %s', (_label, input) => {
        expect(validGtmId(input as string | null | undefined)).toBeNull();
    });

    it('rejects script-breaking and script-injecting values', () => {
        // The whole reason this function exists. A single quote would break every
        // page on the site; the rest would run.
        expect(validGtmId("GTM-ABC1234'")).toBeNull();
        expect(validGtmId("GTM-X');alert(1);//")).toBeNull();
        expect(validGtmId('GTM-ABC1234</script>')).toBeNull();
        expect(validGtmId('GTM-ABC\n1234')).toBeNull();
    });

    it('rejects Unicode look-alikes - pins the absence of the `u` flag', () => {
        // With `iu` instead of `i`, Unicode case-folding makes the Kelvin sign
        // fold to `k` and the long s to `s`, so these would pass `[A-Z0-9]` and
        // be interpolated into the loader. Adding `u` must break this test.
        expect(validGtmId('GTM-ABCD\u212A')).toBeNull(); // Kelvin sign
        expect(validGtmId('GTM-ABCD\u017F')).toBeNull(); // long s
        expect(validGtmId('GTM-\uFF21BC123')).toBeNull(); // fullwidth A
    });
});

describe('validGa4Id', () => {
    it('accepts a real measurement ID and trims it', () => {
        expect(validGa4Id('G-ABC1234567')).toBe('G-ABC1234567');
        expect(validGa4Id(' G-ABC1234567 ')).toBe('G-ABC1234567');
    });

    it.each([
        ['empty', ''],
        ['null', null],
        ['undefined', undefined],
        ['the GTM prefix', 'GTM-ABC1234'],
        ['the old UA prefix', 'UA-12345-1'],
        ['no prefix', 'ABC1234567'],
        ['too short', 'G-ABC12'],
        ['a hyphen inside', 'G-ABC-1234'],
        ['too long', 'G-ABCDEFGHIJKLMNOP'],
    ])('rejects %s', (_label, input) => {
        expect(validGa4Id(input as string | null | undefined)).toBeNull();
    });

    it('uppercases the prefix, which GA4 does require', () => {
        // `gtag/js?id=g-…` serves a different bundle with no GA4 measurement
        // runtime, so a lowercase prefix silently collects nothing.
        expect(validGa4Id('g-abc1234567')).toBe('G-ABC1234567');
    });

    it('rejects script-breaking and script-injecting values', () => {
        expect(validGa4Id("G-ABC1234567'")).toBeNull();
        expect(validGa4Id("G-X');alert(1);//")).toBeNull();
        expect(validGa4Id('G-ABC1234567</script>')).toBeNull();
    });
});
