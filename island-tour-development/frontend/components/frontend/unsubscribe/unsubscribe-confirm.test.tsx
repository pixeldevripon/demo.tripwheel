import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { confirmUnsubscribe } from '@/lib/api/unsubscribe-submit';
import {
    UnsubscribeConfirm,
    type UnsubscribeConfirmDict,
} from './unsubscribe-confirm';

vi.mock('@/lib/api/unsubscribe-submit', () => ({
    confirmUnsubscribe: vi.fn(),
}));

/**
 * The page has one job - an explicit, single-decision opt-out - and these
 * tests pin the behaviours that carry compliance weight: nothing is written
 * without the click, dead tokens share ONE state with no oracle, the done
 * states always carry the "booking emails still arrive" reassurance, and a
 * failed POST leaves the button in place as its own retry.
 */

const DICT: UnsubscribeConfirmDict = {
    invalidTitle: 'This link is no longer valid.',
    invalidBody: 'The unsubscribe link may be incomplete.',
    invalidBrowse: 'Browse tours',
    titleLifecycle: 'Unsubscribe from setup emails?',
    titleMarketing: 'Unsubscribe from travel ideas and offers?',
    bodyLifecycle: 'No more setup tips.',
    bodyMarketing: 'No more travel offers.',
    emailLine: 'This applies to {email}.',
    confirm: 'Unsubscribe',
    working: 'Unsubscribing...',
    alreadyTitle: "You're already unsubscribed.",
    alreadyBody: "We won't send these emails to this address.",
    successTitle: "You're unsubscribed.",
    successBody: "You won't get these emails anymore.",
    transactionalNote: 'Emails about your bookings always arrive.',
    error: "That didn't go through.",
    retry: 'Please try again.',
    browse: 'Browse tours',
};

const INFO = {
    email: 'j***@example.com',
    stream: 'MARKETING' as const,
    optedOut: false,
};

const base = {
    token: 'tok-1',
    info: INFO,
    browseHref: '/en',
    dict: DICT,
};

const confirmMock = vi.mocked(confirmUnsubscribe);

describe('UnsubscribeConfirm - the ask', () => {
    it('shows the MARKETING wording for a traveller-offers token', () => {
        render(<UnsubscribeConfirm {...base} />);
        expect(
            screen.getByRole('heading', { name: DICT.titleMarketing }),
        ).toBeInTheDocument();
        expect(screen.getByText(DICT.bodyMarketing)).toBeInTheDocument();
    });

    it('shows the LIFECYCLE wording for an operator-setup token', () => {
        render(
            <UnsubscribeConfirm
                {...base}
                info={{ ...INFO, stream: 'LIFECYCLE' }}
            />,
        );
        expect(
            screen.getByRole('heading', { name: DICT.titleLifecycle }),
        ).toBeInTheDocument();
        expect(screen.getByText(DICT.bodyLifecycle)).toBeInTheDocument();
    });

    it('names the masked address so the visitor knows WHICH inbox this is about', () => {
        render(<UnsubscribeConfirm {...base} />);
        expect(
            screen.getByText('This applies to j***@example.com.'),
        ).toBeInTheDocument();
    });

    it('writes NOTHING on render - only the click POSTs (scanners follow GETs)', () => {
        render(<UnsubscribeConfirm {...base} />);
        expect(confirmMock).not.toHaveBeenCalled();
    });
});

describe('UnsubscribeConfirm - the dead-link state', () => {
    it('renders the one shared invalid state with no confirm button', () => {
        render(<UnsubscribeConfirm {...base} info={null} />);
        expect(
            screen.getByRole('heading', { name: DICT.invalidTitle }),
        ).toBeInTheDocument();
        expect(screen.getByText(DICT.invalidBody)).toBeInTheDocument();
        // Somewhere to go instead of a dead end...
        expect(
            screen.getByRole('link', { name: DICT.invalidBrowse }),
        ).toHaveAttribute('href', '/en');
        // ...but never a button that could POST an unknown token.
        expect(
            screen.queryByRole('button', { name: DICT.confirm }),
        ).not.toBeInTheDocument();
    });
});

describe('UnsubscribeConfirm - confirm outcomes', () => {
    it('POSTs the token and lands on the success state with the booking-emails reassurance', async () => {
        const user = userEvent.setup();
        confirmMock.mockResolvedValueOnce({
            email: 'j***@example.com',
            audience: 'TRAVELLER',
            stream: 'MARKETING',
            optedOut: true,
        });
        render(<UnsubscribeConfirm {...base} />);

        await user.click(screen.getByRole('button', { name: DICT.confirm }));

        expect(confirmMock).toHaveBeenCalledWith('tok-1');
        expect(await screen.findByText(DICT.successTitle)).toBeInTheDocument();
        expect(screen.getByText(DICT.successBody)).toBeInTheDocument();
        // The line that must survive every redesign: opting out never touches
        // transactional email.
        expect(screen.getByText(DICT.transactionalNote)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: DICT.confirm }),
        ).not.toBeInTheDocument();
    });

    it('renders the already-unsubscribed state without asking again', () => {
        render(
            <UnsubscribeConfirm {...base} info={{ ...INFO, optedOut: true }} />,
        );
        expect(screen.getByText(DICT.alreadyTitle)).toBeInTheDocument();
        expect(screen.getByText(DICT.transactionalNote)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: DICT.confirm }),
        ).not.toBeInTheDocument();
    });

    it('keeps the button as the retry affordance after a failed POST', async () => {
        const user = userEvent.setup();
        confirmMock.mockRejectedValueOnce(new Error('Request failed (500)'));
        confirmMock.mockResolvedValueOnce({
            email: 'j***@example.com',
            audience: 'TRAVELLER',
            stream: 'MARKETING',
            optedOut: true,
        });
        render(<UnsubscribeConfirm {...base} />);

        const button = screen.getByRole('button', { name: DICT.confirm });
        await user.click(button);
        expect(
            await screen.findByText(`${DICT.error} ${DICT.retry}`),
        ).toBeInTheDocument();

        // Same tap, second try - the failure must not dead-end the page.
        await user.click(screen.getByRole('button', { name: DICT.confirm }));
        expect(await screen.findByText(DICT.successTitle)).toBeInTheDocument();
    });
});
