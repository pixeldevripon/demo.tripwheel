'use client';

import { CustomerPaymentsView } from '@/components/customer/customer-payments-view';
import { PaymentsListView } from '@/components/payments/payments-list-view';
import { useRole } from '@/contexts/role-context';

/**
 * Role branch for the Payments page. Same reasoning as `BookingsPageView`:
 * reading the role from `RoleProvider` keeps `page.tsx` a static shell, so the
 * navigation commits immediately instead of waiting on a profile fetch the
 * layout had already performed.
 *
 * Backend scoping is unchanged: `GET /payments` is scoped to `booking.userId`
 * for the USER role either way.
 */
export function PaymentsPageView() {
    const { role } = useRole();

    if (role === 'USER') {
        return (
            <div>
                <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                    <div>
                        <h1 className='text-2xl font-semibold'>Payments</h1>
                        <p className='text-sm text-muted-foreground mt-1'>
                            Every charge and refund on your bookings, with its
                            current status.
                        </p>
                    </div>
                </div>
                <CustomerPaymentsView />
            </div>
        );
    }

    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-semibold'>Payments</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Platform charges per booking (deposits, full payments,
                        refunds) with their provider status. Operators see
                        payments on their own tours only.
                    </p>
                </div>
            </div>
            <PaymentsListView />
        </div>
    );
}
