import { describe, expect, it } from 'vitest';

import { edgeFadeMask, EDGE_FADE_PX } from './edge-fade';

/**
 * The scroll-edge fade (Pastel #56).
 *
 * The interesting assertions are not "does it return a string" but the two ways
 * this utility has already failed in the wild: a class assembled from a
 * template literal, which Tailwind never generates, and `calc(100%-40px)`,
 * which is invalid CSS because calc requires whitespace around the minus. Both
 * fail SILENTLY - the class renders, does nothing, and looks like a styling
 * disagreement rather than a bug.
 */

describe('edgeFadeMask — which end fades', () => {
    it('fades neither end when the content fits', () => {
        // Also what makes it safe to apply unconditionally on desktop.
        expect(edgeFadeMask(false, false)).toBe('');
    });

    it('fades only the right while there is more to reach', () => {
        expect(edgeFadeMask(false, true)).toContain('#000_calc(100%_-_40px)');
        expect(edgeFadeMask(false, true)).not.toContain('transparent,#000_40px');
    });

    it('fades only the left at the end of the row', () => {
        expect(edgeFadeMask(true, false)).toContain('transparent,#000_40px');
        expect(edgeFadeMask(true, false)).not.toContain(
            '#000_calc(100%_-_40px),transparent)',
        );
    });

    it('fades both ends mid-scroll', () => {
        const both = edgeFadeMask(true, true);
        expect(both).toContain('transparent,#000_40px');
        expect(both).toContain('#000_calc(100%_-_40px),transparent');
    });
});

describe('edgeFadeMask — the two silent failure modes', () => {
    const all = [
        edgeFadeMask(false, true),
        edgeFadeMask(true, false),
        edgeFadeMask(true, true),
    ];

    it('spaces the calc subtraction, which CSS requires', () => {
        // `calc(100%-40px)` is invalid and drops the whole declaration.
        for (const cls of all) {
            expect(cls).not.toMatch(/calc\(100%-/);
        }
    });

    it('ships the -webkit- prefix Safari still needs', () => {
        for (const cls of all) {
            expect(cls).toContain('[-webkit-mask-image:');
        }
    });

    it('uses underscores, so Tailwind sees one complete class', () => {
        // A space here would split the arbitrary value into two class names,
        // neither of which is a utility.
        for (const cls of all) {
            for (const token of cls.split(' ')) {
                expect(token).toMatch(/^\[-?[a-z-]+:.+\]$/);
            }
        }
    });
});

describe('EDGE_FADE_PX', () => {
    it('matches the width the mask actually fades', () => {
        // Callers inset their "fully visible" band by this, so a tab is never
        // parked half under the fade. Drift here reintroduces exactly that.
        expect(EDGE_FADE_PX).toBe(40);
        expect(edgeFadeMask(false, true)).toContain(`${EDGE_FADE_PX}px`);
    });
});
