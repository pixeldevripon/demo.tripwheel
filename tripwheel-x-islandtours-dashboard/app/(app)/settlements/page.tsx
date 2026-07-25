import { SettlementsListView } from '@/components/settlements/settlements-list-view';

/**
 * Settlements ledger (master SETTLEMENT-AND-PAYOUTS §2). The money-movement record:
 * one row per confirmed booking, in EUR. `net_position` + = Island Tours owes the
 * operator (paid_in_full payout, released after the cancellation window); - = the
 * operator owes IT. Static shell - the list view fetches client-side via TanStack
 * Query. VIEW_PAYMENTS-gated in the nav; the backend scopes operators to their own.
 */
export default function SettlementsPage() {
    return (
        <div>
            <div className='flex items-center justify-between mb-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>Settlements</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Per-booking money-movement ledger (EUR). Positive net is
                        owed to the operator; a paid-in-full payout is released
                        once its cancellation window closes.
                    </p>
                </div>
            </div>
            <SettlementsListView />
        </div>
    );
}
