import { BookingsListView } from '@/components/bookings/bookings-list-view';

/**
 * Bookings page header + list.
 *
 * This used to branch on role to render a customer view beside the operator
 * one. Travellers now have their own account area on the public site
 * (`/{locale}/traveller`), so there is a single view again and this wrapper
 * needs neither the role context nor a client boundary.
 *
 * Backend scoping is unchanged: `GET /bookings` returns the caller's own tours
 * for operators and everything for platform roles.
 */
export function BookingsPageView() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Bookings</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Every reservation with guest, payment and commission
                        context. Operators see bookings on their own tours only.
                    </p>
                </div>
            </div>
            <BookingsListView />
        </div>
    );
}

