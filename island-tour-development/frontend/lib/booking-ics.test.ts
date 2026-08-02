import { describe, expect, it } from 'vitest';

import { bookingIcsUrl } from './booking-ics';

describe('bookingIcsUrl', () => {
    it('builds the backend calendar download path', () => {
        expect(bookingIcsUrl('BK-12345')).toMatch(
            /\/api\/v1\/bookings\/typ\/BK-12345\/calendar\.ics$/,
        );
    });

    it('encodes the ref', () => {
        // The hand-rolled copy in the next-trip hero did not, which is one of
        // the reasons this is shared rather than inlined.
        expect(bookingIcsUrl('a/b?c')).toContain('a%2Fb%3Fc');
        expect(bookingIcsUrl('a/b?c')).not.toContain('a/b?c');
    });

    it('is absolute, so it works from a client component', () => {
        expect(bookingIcsUrl('BK-1')).toMatch(/^https?:\/\//);
    });
});
