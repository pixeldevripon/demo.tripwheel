'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowTurnBackwardIcon,
    CheckmarkCircle02Icon,
    MoreHorizontalIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useRole } from '@/contexts/role-context';
import {
    useMarkSettlementPaid,
    useMarkSettlementUnpaid,
} from '@/hooks/settlements/use-settlements';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { SettlementListItem } from '@/types/booking';

/**
 * Payout actions (v1 payout is a MANUAL bank transfer) - ADMIN ONLY, both of
 * them (backend: MANAGE_PAYMENTS; the access-roles matrix keeps operators
 * strictly view-own on settlements):
 *  - "Mark as paid" appears only on an eligible row (server-computed
 *    `payoutEligible`) and asks for confirmation, AFTER the admin actually
 *    sent the transfer.
 *  - "Revert to due" undoes a mis-click on a paid row (ledger correction).
 * The backend re-checks eligibility on every call, so a stale row can never
 * be paid twice or paid while a cancellation request is pending.
 */
export function SettlementRowActions({ row }: { row: SettlementListItem }) {
    const { can } = useRole();
    const [payOpen, setPayOpen] = useState(false);
    const [revertOpen, setRevertOpen] = useState(false);
    const { mutate: markPaid, isPending: isPaying } = useMarkSettlementPaid();
    const { mutate: markUnpaid, isPending: isReverting } =
        useMarkSettlementUnpaid();

    // Both ledger flips are MANAGE_PAYMENTS on the backend (admin-only);
    // operators keep the page read-only for their own rows.
    const isAdmin = can('MANAGE_PAYMENTS');
    const canPay = isAdmin && row.status === 'RECORDED' && row.payoutEligible;
    const canRevert = isAdmin && row.status === 'PAID_OUT';
    if (!canPay && !canRevert) return null;

    const currency: Currency = isCurrency(row.currency) ? row.currency : 'EUR';
    const amount = formatPriceFrom(row.netPosition, currency, 'en');
    const operator = row.operatorName ?? 'the operator';

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label='Payout actions'
                    >
                        <HugeiconsIcon icon={MoreHorizontalIcon} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-52'>
                    {canPay && (
                        <DropdownMenuItem onClick={() => setPayOpen(true)}>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} /> Mark
                            as paid
                        </DropdownMenuItem>
                    )}
                    {canRevert && (
                        <DropdownMenuItem onClick={() => setRevertOpen(true)}>
                            <HugeiconsIcon icon={ArrowTurnBackwardIcon} />{' '}
                            Revert to due
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={payOpen}
                onOpenChange={setPayOpen}
                title={`Mark ${amount} as paid to ${operator}?`}
                description={`Booking ${row.displayRef}. Only confirm AFTER the bank transfer was actually made - this tells the operator the money is on its way.`}
                confirmLabel='Money was sent - mark paid'
                loading={isPaying}
                onConfirm={() =>
                    markPaid(row.id, { onSuccess: () => setPayOpen(false) })
                }
            />
            <ConfirmDialog
                open={revertOpen}
                onOpenChange={setRevertOpen}
                title={`Revert this payout to due?`}
                description={`Booking ${row.displayRef} (${amount} to ${operator}) will show as "Payout due" again. Use this only if it was marked paid by mistake.`}
                confirmLabel='Revert to due'
                destructive
                loading={isReverting}
                onConfirm={() =>
                    markUnpaid(row.id, {
                        onSuccess: () => setRevertOpen(false),
                    })
                }
            />
        </>
    );
}
