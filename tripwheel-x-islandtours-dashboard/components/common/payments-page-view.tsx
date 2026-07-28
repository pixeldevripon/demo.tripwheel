import { PaymentsListView } from '@/components/payments/payments-list-view';

/**
 * Payments page header + list. Same story as `BookingsPageView`: the customer
 * branch moved to the public site's traveller account area, so this is a
 * single view with no role context and no client boundary.
 */
export function PaymentsPageView() {
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
