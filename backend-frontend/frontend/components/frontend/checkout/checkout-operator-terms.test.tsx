import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';

/**
 * Pastel #80 / MCK-20: the operator-conditions gate at the checkout commit
 * step - one required checkbox, two renderings.
 *
 * The load-bearing behaviours: the ACKNOWLEDGMENT flavor lists the facts and
 * never offers a document link; the DOCUMENT flavor's "operator conditions"
 * words open the reading layer WITHOUT toggling the box; "Agree and continue"
 * inside the reader ticks it (reading is never punished with a second tap);
 * and the error line renders exactly when the checkout raises it.
 */

const fetchOperatorTerms = vi.fn();
vi.mock('@/lib/api/bookings', () => ({
    fetchOperatorTerms: (...a: unknown[]) => fetchOperatorTerms(...a),
}));

const { CheckoutOperatorTerms } = await import('./checkout-operator-terms');

const dict = en.checkout;

const ACK_ITEMS = [
    'Everyone in my group can swim.',
    'Nobody in the group is pregnant.',
];

function renderGate(
    over: Partial<Parameters<typeof CheckoutOperatorTerms>[0]> = {}
) {
    const onToggle = vi.fn();
    const utils = render(
        <CheckoutOperatorTerms
            dict={dict}
            locale='en'
            tourId='tour-1'
            kind='ACKNOWLEDGMENT'
            items={ACK_ITEMS}
            operatorName='Miss Ann Boat Trips'
            checked={false}
            busy={false}
            error={null}
            onToggle={onToggle}
            {...over}
        />
    );
    return { onToggle, ...utils };
}

beforeEach(() => {
    vi.clearAllMocks();
    fetchOperatorTerms.mockResolvedValue({
        kind: 'DOCUMENT',
        operatorName: 'Miss Ann Boat Trips',
        version: '1.0-placeholder',
        effectiveDate: null,
        items: [],
        document: '<h4>Safety</h4><p>Follow the crew at all times.</p>',
    });
});

describe('CheckoutOperatorTerms - acknowledgment flavor', () => {
    it('lists the facts above the box and offers no document link', () => {
        renderGate();

        expect(
            screen.getByText(dict.operatorTermsConfirmHeading)
        ).toBeInTheDocument();
        for (const item of ACK_ITEMS) {
            expect(screen.getByText(item)).toBeInTheDocument();
        }
        expect(
            screen.queryByText(dict.operatorTermsConditionsWord)
        ).toBeNull();
    });

    it('ticking calls onToggle(true); unticking calls onToggle(false)', () => {
        const { onToggle, rerender } = renderGate();

        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggle).toHaveBeenCalledWith(true);

        rerender(
            <CheckoutOperatorTerms
                dict={dict}
                locale='en'
                tourId='tour-1'
                kind='ACKNOWLEDGMENT'
                items={ACK_ITEMS}
                operatorName='Miss Ann Boat Trips'
                checked
                busy={false}
                error={null}
                onToggle={onToggle}
            />
        );
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggle).toHaveBeenLastCalledWith(false);
    });

    it('locks while the acceptance round-trip is in flight', () => {
        const { onToggle } = renderGate({ busy: true });
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('shows the one calm error line when the checkout raises it', () => {
        renderGate({
            error: "To book this trip, accept Miss Ann Boat Trips's conditions first.",
        });
        expect(screen.getByRole('alert')).toHaveTextContent(
            /accept Miss Ann Boat Trips/
        );
    });
});

describe('CheckoutOperatorTerms - document flavor', () => {
    it('names the operator in the label with the conditions words as a trigger', () => {
        renderGate({ kind: 'DOCUMENT', items: [] });

        expect(screen.getByText('Miss Ann Boat Trips')).toBeInTheDocument();
        expect(
            screen.getByText(dict.operatorTermsConditionsWord)
        ).toBeInTheDocument();
    });

    it('opening the reader does NOT toggle the box, and Agree inside ticks it', async () => {
        const { onToggle } = renderGate({ kind: 'DOCUMENT', items: [] });

        fireEvent.click(screen.getByText(dict.operatorTermsConditionsWord));
        expect(onToggle).not.toHaveBeenCalled();

        // The reader fetched the document body once.
        await waitFor(() =>
            expect(
                screen.getByText('Follow the crew at all times.')
            ).toBeInTheDocument()
        );
        expect(fetchOperatorTerms).toHaveBeenCalledWith('tour-1', 'en');

        fireEvent.click(
            screen.getByRole('button', { name: dict.operatorTermsReaderAgree })
        );
        expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('a failed fetch reads as unavailable, never as an empty document', async () => {
        fetchOperatorTerms.mockRejectedValue(new Error('boom'));
        renderGate({ kind: 'DOCUMENT', items: [] });

        fireEvent.click(screen.getByText(dict.operatorTermsConditionsWord));
        await waitFor(() =>
            expect(
                screen.getByText(dict.operatorTermsReaderUnavailable)
            ).toBeInTheDocument()
        );
    });
});
