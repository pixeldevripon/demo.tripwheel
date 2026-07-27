'use client';

import { BookingsListView } from '@/components/bookings/bookings-list-view';
import { CustomerBookingsView } from '@/components/customer/customer-bookings-view';
import { useRole } from '@/contexts/role-context';

/**
 * Role branch for the Bookings page, resolved from `RoleProvider` rather than
 * from a server fetch in `page.tsx`.
 *
 * The page used to `await getUserProfile()` purely to read `role`, which cost
 * 4-6 backend round trips on EVERY client navigation: layouts are preserved
 * across sibling navigations, so the layout's already-resolved profile is not
 * reused and React's `cache()` (per-request memoization) cannot dedupe it.
 * The router cannot commit until that RSC render finishes, so the sidebar
 * click looked frozen. The layout already put the role in context, so reading
 * it here keeps the page a static shell and the navigation instant.
 *
 * The role is server-rendered into the provider, so the correct branch is in
 * the first paint - there is no customer/admin flash.
 *
 * Backend scoping is unchanged: `GET /bookings` is scoped to `booking.userId`
 * for the USER role regardless of which view calls it.
 */
export function BookingsPageView() {
    const { role } = useRole();

    if (role === 'USER') {
        return (
            <div>
                <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                    <div>
                        <h1 className='text-2xl font-semibold'>My Bookings</h1>
                        <p className='text-sm text-muted-foreground mt-1'>
                            Every trip you have booked with Island Tours -
                            status, payments and cancellation requests in one
                            place.
                        </p>
                    </div>
                </div>
                <CustomerBookingsView />
            </div>
        );
    }

    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-semibold'>Bookings</h1>
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
