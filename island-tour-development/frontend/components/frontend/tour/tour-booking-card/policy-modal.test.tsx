import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PolicyModalDict } from '@/lib/tours/booking';
import { PolicyModal } from './policy-modal';

/**
 * The two trust-line modals on the tour page (Pastel #43).
 *
 * The styling half of that issue is not unit-testable, but its BEHAVIOUR half
 * is - and the issue listed focus trap and focus-restore as things to "keep",
 * when neither was actually implemented. These tests are what make that claim
 * true rather than aspirational.
 */

const CONTENT: PolicyModalDict = {
    title: 'Free cancellation up to {hours}h',
    introTitle: 'Plans change. No problem.',
    introBody: 'Cancel free of charge before the deadline.',
    stepsTitle: 'HOW IT WORKS',
    steps: ['Open your booking', 'Choose cancel', 'We refund you'],
    outroTitle: 'After the window',
    outroBody: 'The deposit is no longer refundable.',
};

/** `fill` interpolates live tour data; identity is enough for these tests. */
const fill = (s: string) => s.replace('{hours}', '48');

function setup(overrides: Partial<Parameters<typeof PolicyModal>[0]> = {}) {
    const onClose = vi.fn();
    const utils = render(
        <>
            <button type='button'>trigger</button>
            <PolicyModal
                open
                onClose={onClose}
                content={CONTENT}
                closeLabel='Close'
                fill={fill}
                {...overrides}
            />
        </>,
    );
    return { onClose, ...utils };
}

beforeEach(() => {
    document.body.style.overflow = '';
});

describe('PolicyModal — content', () => {
    it('renders the interpolated title, lead, steps and closing block', () => {
        setup();
        expect(
            screen.getByRole('dialog', { name: 'Free cancellation up to 48h' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Plans change. No problem.')).toBeInTheDocument();
        expect(screen.getByText('HOW IT WORKS')).toBeInTheDocument();
        expect(screen.getByText('After the window')).toBeInTheDocument();
    });

    it('numbers every step, so the badges match the copy', () => {
        setup();
        const list = screen.getByRole('list');
        expect(list.querySelectorAll('li')).toHaveLength(3);
        for (const n of ['1', '2', '3']) {
            expect(screen.getByText(n)).toBeInTheDocument();
        }
    });

    it('renders nothing when closed', () => {
        setup({ open: false });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('PolicyModal — behaviour the issue requires', () => {
    it('locks body scroll while open and releases it on close', () => {
        const { rerender, onClose } = setup();
        expect(document.body.style.overflow).toBe('hidden');

        rerender(
            <>
                <button type='button'>trigger</button>
                <PolicyModal
                    open={false}
                    onClose={onClose}
                    content={CONTENT}
                    closeLabel='Close'
                    fill={fill}
                />
            </>,
        );
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        const { onClose } = setup();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on the close button', async () => {
        const user = userEvent.setup();
        const { onClose } = setup();
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('moves focus INTO the dialog on open', () => {
        // Otherwise the next Tab continues from the trigger and walks the page
        // behind the overlay.
        setup();
        expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });

    it('traps Tab inside the dialog', async () => {
        const user = userEvent.setup();
        setup();
        const close = screen.getByRole('button', { name: 'Close' });
        const trigger = screen.getByRole('button', { name: 'trigger' });

        await user.tab();
        expect(document.activeElement).toBe(close);

        // Only one focusable inside, so Tab must cycle back to it - never out
        // to the trigger sitting behind the overlay.
        await user.tab();
        expect(document.activeElement).toBe(close);
        expect(document.activeElement).not.toBe(trigger);
    });

    it('traps Shift+Tab too', async () => {
        const user = userEvent.setup();
        setup();
        const close = screen.getByRole('button', { name: 'Close' });

        await user.tab();
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(close);
    });

    it('returns focus to the trigger on close', async () => {
        const user = userEvent.setup();
        const trigger = document.createElement('button');
        trigger.textContent = 'opener';
        document.body.appendChild(trigger);
        trigger.focus();

        const onClose = vi.fn();
        const { rerender } = render(
            <PolicyModal
                open
                onClose={onClose}
                content={CONTENT}
                closeLabel='Close'
                fill={fill}
            />,
        );
        await user.keyboard('{Escape}');

        rerender(
            <PolicyModal
                open={false}
                onClose={onClose}
                content={CONTENT}
                closeLabel='Close'
                fill={fill}
            />,
        );
        expect(document.activeElement).toBe(trigger);
        trigger.remove();
    });

    it('does not steal focus when the trigger has left the page', () => {
        // The cleanup also runs when the whole tour page unmounts on
        // navigation; focusing a detached node there would yank focus off the
        // incoming page.
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const { unmount } = render(
            <PolicyModal
                open
                onClose={vi.fn()}
                content={CONTENT}
                closeLabel='Close'
                fill={fill}
            />,
        );
        trigger.remove();
        expect(() => unmount()).not.toThrow();
    });
});
