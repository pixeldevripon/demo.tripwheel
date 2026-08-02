import { describe, expect, it } from 'vitest';

import { travelerBookingPath } from './traveler-booking.shared';

describe('travelerBookingPath', () => {
    it('builds the locale-less TYP path the proxy rewrite expects', () => {
        expect(travelerBookingPath('curacao', 'BK-12345')).toBe(
            '/curacao/thank-you/BK-12345',
        );
    });

    it.each([
        ['null', null],
        ['an empty string', ''],
    ])(
        'never emits a protocol-relative URL when the slug is %s',
        (_label, slug) => {
            // REGRESSION. `destinationSlug` is `typ.island ?? ''` and `island`
            // is nullable, so an empty slug is reachable. Interpolated bare it
            // produced `//thank-you/{ref}`, which the browser reads as
            // protocol-relative and resolves to `http://thank-you/{ref}` -
            // navigating the traveller OFF-SITE rather than 404ing.
            const path = travelerBookingPath(slug, 'BK-12345');

            expect(path.startsWith('//')).toBe(false);
            expect(path).toBe('/curacao/thank-you/BK-12345');
        },
    );

    it('always returns a rooted, single-slash path', () => {
        for (const slug of ['curacao', 'aruba', '', null]) {
            const path = travelerBookingPath(slug, 'BK-1');
            expect(path).toMatch(/^\/[^/]/);
        }
    });
});
