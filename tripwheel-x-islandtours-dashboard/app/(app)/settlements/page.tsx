import { SettlementsListView } from '@/components/settlements/settlements-list-view';

/**
 * Operator-payout ledger (master SETTLEMENT-AND-PAYOUTS §2; founder 2026-07-26).
 * One row per confirmed paid-in-full booking, in EUR: Island Tours collected the
 * total, keeps its commission, and owes the operator the rest. Payout is MANUAL -
 * an admin marks a row paid after the actual bank transfer. Static shell - the
 * list view fetches client-side via TanStack Query and words itself per role.
 * VIEW_PAYMENTS-gated in the nav; the backend scopes operators to their own rows.
 */
export default function SettlementsPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-semibold'>Settlements</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Payouts on paid-in-full bookings: the money Island Tours
                        collected at checkout and owes to the operator after its
                        commission. Deposit bookings settle themselves and never
                        appear here.
                    </p>
                </div>
            </div>
            <SettlementsListView />
        </div>
    );
}
