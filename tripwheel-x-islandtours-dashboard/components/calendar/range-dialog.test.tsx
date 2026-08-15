/**
 * The range modal's consequence line (client review #5).
 *
 * Two halves: the pure sentence (number agreement - a wrong plural in a
 * destructive-action confirmation reads as sloppiness exactly where trust
 * matters most) and the render gating (an older backend or a kept-previous
 * number must hide ONLY the counts - the locked "Guests are not notified."
 * line renders on every close, and a stale-scope count must never pass as
 * the current one).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RangeDialog, impactSentence } from './range-dialog';
import { useRangeImpact } from '@/hooks/trips/use-trips';
import type { OverviewTour } from '@/types/trip';

vi.mock('@/hooks/trips/use-trips', () => ({
    useCloseRange: () => ({ mutate: vi.fn(), isPending: false }),
    useReopenRange: () => ({ mutate: vi.fn(), isPending: false }),
    useRangeImpact: vi.fn(),
}));

const mockedImpact = vi.mocked(useRangeImpact);

const TOURS = [
    { id: 't1', name: 'Sunset Sail' },
] as unknown as OverviewTour[];

function renderDialog() {
    render(
        <RangeDialog
            open
            onOpenChange={() => {}}
            tours={TOURS}
            defaultTourId='t1'
            defaultDate='2026-09-01'
        />,
    );
}

describe('impactSentence', () => {
    it('states the full blast radius across tours with guests', () => {
        expect(
            impactSentence({ departures: 14, tours: 3, bookedGuests: 46 }, true),
        ).toBe(
            'This closes 14 departures across 3 tours. 46 booked guests keep their bookings.',
        );
    });

    it('drops the tour clause for a single-tour scope', () => {
        expect(
            impactSentence({ departures: 5, tours: 1, bookedGuests: 0 }, false),
        ).toBe('This closes 5 departures.');
    });

    it('agrees in number for one departure and one guest', () => {
        expect(
            impactSentence({ departures: 1, tours: 1, bookedGuests: 1 }, false),
        ).toBe('This closes 1 departure. 1 booked guest keeps their booking.');
    });

    it('keeps a singular tour clause when the scope spans tours but only one is hit', () => {
        expect(
            impactSentence({ departures: 2, tours: 1, bookedGuests: 0 }, true),
        ).toBe('This closes 2 departures across 1 tour.');
    });

    it('says out loud when nothing is scheduled yet', () => {
        expect(
            impactSentence({ departures: 0, tours: 0, bookedGuests: 0 }, true),
        ).toBe(
            'No departures are scheduled in these days yet - the days still close.',
        );
    });

    it('omits the guest sentence when nobody is booked', () => {
        expect(
            impactSentence({ departures: 3, tours: 2, bookedGuests: 0 }, true),
        ).not.toContain('guest');
    });
});

describe('RangeDialog impact rendering', () => {
    beforeEach(() => {
        mockedImpact.mockReset();
    });

    it('renders the counts and the locked line when the preview is current', () => {
        mockedImpact.mockReturnValue({
            data: { departures: 3, tours: 1, bookedGuests: 7 },
            isError: false,
            isPlaceholderData: false,
        } as unknown as ReturnType<typeof useRangeImpact>);
        renderDialog();
        expect(screen.getByText(/This closes 3 departures/)).toBeTruthy();
        expect(screen.getByText('Guests are not notified.')).toBeTruthy();
    });

    it('hides ONLY the counts on an older backend (404) - the locked line stays', () => {
        mockedImpact.mockReturnValue({
            data: undefined,
            isError: true,
            isPlaceholderData: false,
        } as unknown as ReturnType<typeof useRangeImpact>);
        renderDialog();
        expect(screen.queryByText(/This closes/)).toBeNull();
        expect(screen.getByText('Guests are not notified.')).toBeTruthy();
    });

    it('never renders a kept-previous count as the current scope', () => {
        mockedImpact.mockReturnValue({
            data: { departures: 99, tours: 9, bookedGuests: 999 },
            isError: false,
            isPlaceholderData: true,
        } as unknown as ReturnType<typeof useRangeImpact>);
        renderDialog();
        expect(screen.queryByText(/This closes/)).toBeNull();
        expect(screen.getByText('Guests are not notified.')).toBeTruthy();
    });
});
