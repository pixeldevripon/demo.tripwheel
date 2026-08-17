import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PaymentConnectionStatus } from '@/types/settings';

const toast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast }));

const api = vi.hoisted(() => ({ getPaymentConnectionStatus: vi.fn() }));
vi.mock('@/lib/api/settings', () => ({ settingsApi: api }));

import {
    paymentConnectionKey,
    useTestPaymentConnection,
} from './use-payment-connection';

function wrapper(client: QueryClient) {
    const Wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);
    Wrapper.displayName = 'TestQueryClientWrapper';
    return Wrapper;
}

const okStripeColumn = {
    configured: true,
    missing: [],
    ok: true,
    mode: 'test' as const,
    accountLabel: 'Island Tours BV',
    error: null,
    methods: [],
};

const board = (
    over: Partial<PaymentConnectionStatus> = {},
): PaymentConnectionStatus => ({
    activeProvider: 'STRIPE',
    checkedAt: '2026-08-16T12:00:00.000Z',
    stripe: okStripeColumn,
    mollie: {
        configured: true,
        missing: [],
        ok: true,
        mode: 'live',
        accountLabel: 'pfl_123',
        error: null,
        methods: [],
    },
    ...over,
});

/**
 * The mutation's whole job is a truthful merge: a single-provider probe
 * returns the OTHER column as null, and folding that null into the cache
 * would blank a board the admin is looking at.
 */
describe('useTestPaymentConnection', () => {
    it('folds the probed column into the cache without wiping the other provider', async () => {
        const client = new QueryClient();
        client.setQueryData(paymentConnectionKey(), board());
        api.getPaymentConnectionStatus.mockResolvedValue(
            board({
                checkedAt: '2026-08-16T13:00:00.000Z',
                stripe: { ...okStripeColumn, ok: false, error: 'Bad key' },
                mollie: null,
            }),
        );

        const { result } = renderHook(() => useTestPaymentConnection(), {
            wrapper: wrapper(client),
        });
        await act(async () => {
            await result.current.mutateAsync({ provider: 'STRIPE' });
        });

        expect(api.getPaymentConnectionStatus).toHaveBeenCalledWith('STRIPE');
        const cached = client.getQueryData<PaymentConnectionStatus>(
            paymentConnectionKey(),
        );
        expect(cached?.stripe?.error).toBe('Bad key');
        expect(cached?.checkedAt).toBe('2026-08-16T13:00:00.000Z');
        // The Mollie column survives the Stripe-only probe.
        expect(cached?.mollie?.accountLabel).toBe('pfl_123');
    });

    it('reports the three outcomes as the right toast flavours', async () => {
        const client = new QueryClient();
        const { result } = renderHook(() => useTestPaymentConnection(), {
            wrapper: wrapper(client),
        });

        api.getPaymentConnectionStatus.mockResolvedValueOnce(
            board({ mollie: null }),
        );
        await act(async () => {
            await result.current.mutateAsync({ provider: 'STRIPE' });
        });
        expect(toast.success).toHaveBeenCalledWith(
            'Stripe connection OK (test mode) - Island Tours BV',
        );

        api.getPaymentConnectionStatus.mockResolvedValueOnce(
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
        await act(async () => {
            await result.current.mutateAsync({ provider: 'MOLLIE' });
        });
        expect(toast.warning).toHaveBeenCalledWith(
            'Mollie is not configured yet - add the API key first.',
        );

        api.getPaymentConnectionStatus.mockResolvedValueOnce(
            board({
                mollie: null,
                stripe: {
                    ...okStripeColumn,
                    ok: false,
                    error: 'Invalid API Key provided: ••••',
                },
            }),
        );
        await act(async () => {
            await result.current.mutateAsync({ provider: 'STRIPE' });
        });
        expect(toast.error).toHaveBeenCalledWith(
            'Stripe connection failed: Invalid API Key provided: ••••',
        );
    });

    it('a per-method test answers for that ONE method, in all three states', async () => {
        const client = new QueryClient();
        const { result } = renderHook(() => useTestPaymentConnection(), {
            wrapper: wrapper(client),
        });

        const withMethods = board({
            mollie: null,
            stripe: {
                ...okStripeColumn,
                methods: [
                    { key: 'visa', status: 'active', attention: null },
                    { key: 'klarna', status: 'inactive', attention: null },
                ],
            },
        });

        api.getPaymentConnectionStatus.mockResolvedValueOnce(withMethods);
        await act(async () => {
            await result.current.mutateAsync({
                provider: 'STRIPE',
                brand: 'visa',
            });
        });
        expect(toast.success).toHaveBeenCalledWith(
            'Visa via Stripe: active (test mode)',
        );

        api.getPaymentConnectionStatus.mockResolvedValueOnce(withMethods);
        await act(async () => {
            await result.current.mutateAsync({
                provider: 'STRIPE',
                brand: 'klarna',
            });
        });
        expect(toast.warning).toHaveBeenCalledWith(
            'Klarna is not activated on the Stripe account - open "How to activate" for the steps.',
        );

        api.getPaymentConnectionStatus.mockResolvedValueOnce(
            board({
                stripe: null,
                mollie: {
                    ...okStripeColumn,
                    accountLabel: 'pfl_123',
                    methods: [{ key: 'googlepay', status: 'unsupported', attention: null }],
                },
            }),
        );
        await act(async () => {
            await result.current.mutateAsync({
                provider: 'MOLLIE',
                brand: 'googlepay',
            });
        });
        expect(toast.info).toHaveBeenCalledWith(
            'Mollie does not offer Google Pay at all.',
        );
    });

    it('translates the raw throttler rejection into a human sentence', async () => {
        const client = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        });
        api.getPaymentConnectionStatus.mockRejectedValueOnce(
            new Error('ThrottlerException: Too Many Requests'),
        );

        const { result } = renderHook(() => useTestPaymentConnection(), {
            wrapper: wrapper(client),
        });
        await act(async () => {
            await result.current
                .mutateAsync({ provider: 'STRIPE' })
                .catch(() => {});
        });

        expect(toast.error).toHaveBeenCalledWith(
            'Too many connection tests in a row - wait a minute and try again.',
        );
    });
});
