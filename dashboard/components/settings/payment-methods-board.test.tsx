import { TooltipProvider } from '@/components/ui/tooltip';
import type { PaymentConnectionStatus } from '@/types/settings';
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ImgHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
        createElement('img', props),
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const hooks = vi.hoisted(() => ({
    usePaymentConnectionStatus: vi.fn(),
    useTestPaymentConnection: vi.fn(),
}));
vi.mock('@/hooks/settings/use-payment-connection', () => hooks);

const settingsHooks = vi.hoisted(() => ({
    useStripeConfig: vi.fn(),
    useMollieConfig: vi.fn(),
    useUpdateStripeConfig: vi.fn(),
    useUpdateMollieConfig: vi.fn(),
}));
vi.mock('@/hooks/settings/use-settings', () => settingsHooks);

import {
    ConnectionTestStrip,
    ProviderMethodsSection,
} from './payment-methods-board';

const stripeMethods = [
    { key: 'visa', status: 'active', attention: null },
    { key: 'mastercard', status: 'active', attention: null },
    { key: 'amex', status: 'active', attention: null },
    { key: 'paypal', status: 'active', attention: null },
    { key: 'ideal', status: 'active', attention: null },
    { key: 'applepay', status: 'inactive', attention: null },
    { key: 'googlepay', status: 'inactive', attention: null },
    { key: 'klarna', status: 'inactive', attention: null },
] as const;

const mollieMethods = [
    { key: 'visa', status: 'active', attention: null },
    { key: 'mastercard', status: 'active', attention: null },
    { key: 'amex', status: 'active', attention: null },
    { key: 'paypal', status: 'inactive', attention: null },
    { key: 'ideal', status: 'active', attention: null },
    { key: 'applepay', status: 'inactive', attention: null },
    { key: 'googlepay', status: 'unsupported', attention: null },
    { key: 'klarna', status: 'inactive', attention: null },
] as const;

const board = (
    over: Partial<PaymentConnectionStatus> = {},
): PaymentConnectionStatus => ({
    activeProvider: 'STRIPE',
    checkedAt: '2026-08-16T12:00:00.000Z',
    stripe: {
        configured: true,
        missing: [],
        ok: true,
        mode: 'test',
        accountLabel: 'Island Tours BV',
        error: null,
        methods: stripeMethods.map(m => ({ ...m })),
    },
    mollie: {
        configured: true,
        missing: [],
        ok: true,
        mode: 'live',
        accountLabel: 'pfl_123',
        error: null,
        methods: mollieMethods.map(m => ({ ...m })),
    },
    ...over,
});

function mockQuery(data: PaymentConnectionStatus | undefined, over = {}) {
    hooks.usePaymentConnectionStatus.mockReturnValue({
        data,
        isLoading: false,
        isError: false,
        ...over,
    });
}

function mockTest(over = {}) {
    const mutate = vi.fn();
    hooks.useTestPaymentConnection.mockReturnValue({
        mutate,
        isPending: false,
        variables: undefined,
        ...over,
    });
    return mutate;
}

function mockConfigs(
    stripeMethodsList: string[] = [],
    mollieMethodsList: string[] = [],
) {
    settingsHooks.useStripeConfig.mockReturnValue({
        data: { paymentMethods: stripeMethodsList },
    });
    settingsHooks.useMollieConfig.mockReturnValue({
        data: { paymentMethods: mollieMethodsList },
    });
    const stripeUpdate = vi.fn();
    const mollieUpdate = vi.fn();
    settingsHooks.useUpdateStripeConfig.mockReturnValue({
        mutate: stripeUpdate,
        isPending: false,
    });
    settingsHooks.useUpdateMollieConfig.mockReturnValue({
        mutate: mollieUpdate,
        isPending: false,
    });
    return { stripeUpdate, mollieUpdate };
}

const renderWithTooltips = (ui: React.ReactElement) =>
    render(<TooltipProvider>{ui}</TooltipProvider>);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ProviderMethodsSection - method rows per provider card', () => {
    it('renders METHOD-level rows: card carries all three card-brand chips', () => {
        mockQuery(board());
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        for (const label of [
            'Card',
            'iDEAL',
            'PayPal',
            'Klarna',
            'Apple Pay',
            'Google Pay',
        ]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        // Brand-level rows are gone - Visa/Mastercard/Amex ride the Card row.
        expect(screen.queryByText('Visa')).toBeNull();
        expect(screen.getAllByText('Configured')).toHaveLength(3);
        expect(screen.getAllByText('Not configured')).toHaveLength(3);
        expect(screen.getByText('test mode')).toBeInTheDocument();
    });

    it('every method row carries a Test action answering for the METHOD label', () => {
        mockQuery(board());
        const mutate = mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        const testButtons = screen.getAllByRole('button', { name: 'Test' });
        expect(testButtons).toHaveLength(6);

        fireEvent.click(testButtons[0]);
        expect(mutate).toHaveBeenCalledWith({
            provider: 'STRIPE',
            brand: 'visa',
            label: 'Card',
        });
    });

    it('switches exist wherever the provider can offer the method, wallets included', () => {
        mockQuery(board());
        mockTest();
        mockConfigs();
        const stripeView = renderWithTooltips(
            <ProviderMethodsSection provider='STRIPE' />,
        );
        // Stripe: card/ideal/paypal/klarna + the two wallet buttons (Express
        // Checkout Element at the traveller checkout).
        expect(screen.getAllByRole('switch')).toHaveLength(6);
        // Wallet rows carry their always-visible "how it works" guide - an
        // Active badge alone left admins asking what was still needed.
        expect(
            screen.getAllByText('How it works at checkout'),
        ).toHaveLength(2);
        stripeView.unmount();

        renderWithTooltips(<ProviderMethodsSection provider='MOLLIE' />);
        // Mollie: + applepay (hosted page renders it); googlepay unsupported.
        expect(screen.getAllByRole('switch')).toHaveLength(5);
        expect(
            screen.getByText(/Mollie does not offer Google Pay/i),
        ).toBeInTheDocument();
    });

    it('the Apple Pay guide names the one-time domain registration', () => {
        mockQuery(board());
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        fireEvent.click(screen.getAllByText('How it works at checkout')[0]);
        // Inactive-at-PSP wallet rows prepend the activation steps, so the
        // domain-registration line appears exactly twice (activation step +
        // the state-independent one-time-setup step).
        expect(screen.getAllByText(/Payment method domains/i)).toHaveLength(2);
        // The "already activated - nothing to buy" reassurance is for ACTIVE
        // rows only - printing it after activation steps contradicts them.
        expect(screen.queryByText(/nothing to buy or request/i)).toBeNull();
    });

    it('an empty stored list means every ACTIVE method is ON, and one flip materializes the full list', () => {
        mockQuery(board());
        mockTest();
        const { stripeUpdate } = mockConfigs([]);
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        const switches = screen.getAllByRole('switch');
        // card / ideal / paypal are active -> ON; klarna is not activated at
        // Stripe -> locked OFF regardless of the all-on default.
        expect(switches[0]).toHaveAttribute('aria-checked', 'true');
        expect(switches[1]).toHaveAttribute('aria-checked', 'true');
        expect(switches[2]).toHaveAttribute('aria-checked', 'true');
        expect(switches[3]).toHaveAttribute('aria-checked', 'false');

        // Turn Card off: the explicit list of everything-else is written
        // (wallets included - they have their own keys now).
        fireEvent.click(switches[0]);
        expect(stripeUpdate).toHaveBeenCalledWith({
            paymentMethods: ['ideal', 'paypal', 'klarna', 'applepay', 'googlepay'],
        });
    });

    it('an ACTIVE wallet alone never satisfies the zero-guard - part of the audience cannot see it', () => {
        // Wallets show only on devices that can pay; card is the sole
        // non-wallet ACTIVE method here, so switching it off would leave a
        // checkout that Firefox users experience as zero methods.
        mockQuery(
            board({
                stripe: {
                    configured: true,
                    missing: [],
                    ok: true,
                    mode: 'test',
                    accountLabel: 'Island Tours BV',
                    error: null,
                    methods: [
                        { key: 'visa', status: 'active', attention: null },
                        { key: 'mastercard', status: 'active', attention: null },
                        { key: 'amex', status: 'active', attention: null },
                        { key: 'paypal', status: 'inactive', attention: null },
                        { key: 'ideal', status: 'inactive', attention: null },
                        { key: 'applepay', status: 'active', attention: null },
                        { key: 'googlepay', status: 'active', attention: null },
                        { key: 'klarna', status: 'inactive', attention: null },
                    ],
                },
            }),
        );
        mockTest();
        const { stripeUpdate } = mockConfigs(['card', 'applepay', 'googlepay']);
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        fireEvent.click(screen.getAllByRole('switch')[0]); // card off

        expect(stripeUpdate).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(
            'At least one payment method must stay on - travellers need a way to pay.',
        );
    });

    it('a method not activated at the PSP cannot be switched on', () => {
        mockQuery(board());
        mockTest();
        const { stripeUpdate } = mockConfigs([]);
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        const klarnaSwitch = screen.getAllByRole('switch')[3];
        expect(klarnaSwitch).toBeDisabled();
        fireEvent.click(klarnaSwitch);
        expect(stripeUpdate).not.toHaveBeenCalled();
    });

    it('a stored list drives the switches and toggling an ACTIVE method on adds the key', () => {
        mockQuery(board());
        mockTest();
        const { mollieUpdate } = mockConfigs([], ['creditcard']);
        renderWithTooltips(<ProviderMethodsSection provider='MOLLIE' />);

        const switches = screen.getAllByRole('switch');
        expect(switches[0]).toHaveAttribute('aria-checked', 'true'); // creditcard
        expect(switches[1]).toHaveAttribute('aria-checked', 'false'); // ideal (active, off)

        fireEvent.click(switches[1]);
        expect(mollieUpdate).toHaveBeenCalledWith({
            paymentMethods: ['creditcard', 'ideal'],
        });
    });

    it('refuses to switch the LAST method off - zero methods would brick the checkout', () => {
        mockQuery(board());
        mockTest();
        const { stripeUpdate } = mockConfigs(['card']);
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        fireEvent.click(screen.getAllByRole('switch')[0]);

        expect(stripeUpdate).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(
            'At least one payment method must stay on - travellers need a way to pay.',
        );
    });

    it('refuses when only PSP-INACTIVE methods would survive - nominal is not real', () => {
        mockQuery(board());
        mockTest();
        // Klarna is switched on but NOT active at Stripe in this fixture:
        // turning card off would leave ['klarna'] - non-empty on paper, zero
        // methods at the actual checkout (the offer intersection drops it).
        const { stripeUpdate } = mockConfigs(['card', 'klarna']);
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        fireEvent.click(screen.getAllByRole('switch')[0]);

        expect(stripeUpdate).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(
            'At least one payment method must stay on - travellers need a way to pay.',
        );
    });

    it('an Active method that still owes the admin something shows "Action needed" with the reason', () => {
        // Apple Pay activated at Stripe but no payment-method domain
        // registered: the button can never appear, and the green Active badge
        // alone would read as "done".
        const reason =
            'Activated, but no site domain is registered with Stripe - the Apple Pay button cannot appear until one is added (Stripe -> Settings -> Payment method domains).';
        mockQuery(
            board({
                stripe: {
                    configured: true,
                    missing: [],
                    ok: true,
                    mode: 'test',
                    accountLabel: 'Island Tours BV',
                    error: null,
                    methods: stripeMethods.map(m =>
                        m.key === 'applepay'
                            ? { ...m, status: 'active' as const, attention: reason }
                            : { ...m },
                    ),
                },
            }),
        );
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        expect(screen.getByText('Action needed')).toBeInTheDocument();
        expect(screen.getByText(reason)).toBeInTheDocument();
    });

    it('shows skeleton rows while the live probe runs - never a bare loading sentence', () => {
        mockQuery(undefined, { isLoading: true });
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        expect(screen.getAllByTestId('method-row-skeleton')).toHaveLength(6);
        expect(screen.queryByText(/checking/i)).toBeNull();
    });

    it('an unconfigured provider explains itself instead of showing an empty list', () => {
        mockQuery(
            board({
                mollie: {
                    configured: false,
                    missing: ['API key'],
                    ok: false,
                    mode: null,
                    accountLabel: null,
                    error: null,
                    methods: [],
                },
            }),
        );
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='MOLLIE' />);

        expect(screen.getByText(/Configure Mollie above/i)).toBeInTheDocument();
        expect(screen.queryByText('Card')).toBeNull();
    });

    it('a failing connection surfaces the reason', () => {
        mockQuery(
            board({
                stripe: {
                    configured: true,
                    missing: [],
                    ok: false,
                    mode: null,
                    accountLabel: null,
                    error: 'Invalid API Key provided: ••••',
                    methods: [],
                },
            }),
        );
        mockTest();
        mockConfigs();
        renderWithTooltips(<ProviderMethodsSection provider='STRIPE' />);

        expect(
            screen.getByText(/Invalid API Key provided/i),
        ).toBeInTheDocument();
        expect(screen.queryByText('Card')).toBeNull();
    });
});

describe('ConnectionTestStrip', () => {
    it('probes its own provider on click', () => {
        mockQuery(board());
        const mutate = mockTest();
        mockConfigs();
        renderWithTooltips(<ConnectionTestStrip provider='STRIPE' />);

        expect(
            screen.getByText(/Connected to Island Tours BV in test mode/i),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: /test connection/i }),
        );
        expect(mutate).toHaveBeenCalledWith({ provider: 'STRIPE' });
    });

    it('disables the button while unconfigured and says what is missing', () => {
        mockQuery(
            board({
                stripe: null,
                mollie: {
                    configured: false,
                    missing: ['API key'],
                    ok: false,
                    mode: null,
                    accountLabel: null,
                    error: null,
                    methods: [],
                },
            }),
        );
        mockTest();
        mockConfigs();
        renderWithTooltips(<ConnectionTestStrip provider='MOLLIE' />);

        expect(
            screen.getByRole('button', { name: /test connection/i }),
        ).toBeDisabled();
        expect(
            screen.getByText(/Save the API key above first/i),
        ).toBeInTheDocument();
    });

    it('shows the pending label only for its own provider-level probe, not row tests', () => {
        mockQuery(board());
        mockTest({
            isPending: true,
            variables: { provider: 'STRIPE', brand: 'visa', label: 'Card' },
        });
        mockConfigs();
        renderWithTooltips(<ConnectionTestStrip provider='STRIPE' />);

        // A per-method row test on the same provider must not flip the
        // strip's button into "Testing...".
        expect(screen.queryByText('Testing...')).toBeNull();
    });
});
