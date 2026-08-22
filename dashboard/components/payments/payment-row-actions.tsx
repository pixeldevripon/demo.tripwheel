'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Copy01Icon,
    LinkSquare02Icon,
    MoreHorizontalIcon,
    RefreshIcon,
    ViewIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useRole } from '@/contexts/role-context';
import { bookingsDashboardApi } from '@/lib/api/bookings-dashboard';
import { bookingKeys } from '@/hooks/bookings/use-bookings';
import { paymentKeys } from '@/hooks/payments/use-payments';
import type { PaymentListItem } from '@/types/booking';

/** Deep link into the PSP's own dashboard for this charge/refund (admin). */
function providerDashboardUrl(p: PaymentListItem): string | null {
    if (!p.intentId) return null;
    if (p.provider === 'STRIPE')
        return `https://dashboard.stripe.com/payments/${p.intentId}`;
    return `https://my.mollie.com/dashboard/payments/${p.intentId}`;
}

/**
 * Retry a FAILED refund: re-invoking the admin cancel action on the (already
 * cancelled) booking re-attempts the owed refund with a fresh idempotency key -
 * the documented retry path; it never double-refunds (executeRefund skips when
 * a settled/in-flight refund exists).
 */
function useRetryRefund() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (bookingId: string) =>
            bookingsDashboardApi.cancel(bookingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: paymentKeys.all });
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success(
                'Refund retried - the row updates once the provider answers.',
            );
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to retry the refund.',
            ),
    });
}

export function PaymentRowActions({ payment }: { payment: PaymentListItem }) {
    const { can } = useRole();
    const [retryOpen, setRetryOpen] = useState(false);
    const { mutate: retryRefund, isPending: isRetrying } = useRetryRefund();

    const psp = providerDashboardUrl(payment);
    // Admin-only: the PSP dashboard and the refund retry are platform-account
    // operations an operator has no access to.
    const isPlatformAdmin = can('MANAGE_BOOKINGS');
    const canRetryRefund =
        isPlatformAdmin &&
        payment.kind === 'REFUND' &&
        payment.status === 'FAILED';

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label='Payment actions'
                    >
                        <HugeiconsIcon icon={MoreHorizontalIcon} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                    <DropdownMenuItem asChild>
                        <Link href={`/bookings?q=${payment.bookingDisplayRef}`}>
                            <HugeiconsIcon icon={ViewIcon} /> View booking
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            void navigator.clipboard.writeText(
                                payment.bookingDisplayRef,
                            );
                            toast.success('Booking reference copied.');
                        }}
                    >
                        <HugeiconsIcon icon={Copy01Icon} /> Copy booking ref
                    </DropdownMenuItem>
                    {payment.intentId && (
                        <DropdownMenuItem
                            onClick={() => {
                                void navigator.clipboard.writeText(
                                    payment.intentId as string,
                                );
                                toast.success('Payment reference copied.');
                            }}
                        >
                            <HugeiconsIcon icon={Copy01Icon} /> Copy payment ref
                        </DropdownMenuItem>
                    )}
                    {isPlatformAdmin && psp && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <a
                                    href={psp}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <HugeiconsIcon icon={LinkSquare02Icon} />{' '}
                                    Open in{' '}
                                    {payment.provider === 'STRIPE'
                                        ? 'Stripe'
                                        : 'Mollie'}
                                </a>
                            </DropdownMenuItem>
                        </>
                    )}
                    {canRetryRefund && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setRetryOpen(true)}
                            >
                                <HugeiconsIcon icon={RefreshIcon} /> Retry
                                refund
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={retryOpen}
                onOpenChange={setRetryOpen}
                title={`Retry the refund for ${payment.bookingDisplayRef}?`}
                description='The previous refund attempt FAILED at the provider - the traveller has not received their money. This re-attempts it with a fresh idempotency key; it can never refund twice.'
                confirmLabel='Retry refund'
                loading={isRetrying}
                onConfirm={() =>
                    retryRefund(payment.bookingId, {
                        onSuccess: () => setRetryOpen(false),
                    })
                }
            />
        </>
    );
}
