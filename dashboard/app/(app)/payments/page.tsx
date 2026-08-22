import { PaymentsPageView } from '@/components/common/payments-page-view';

/**
 * Synchronous shell - see `BookingsPage`. The role branch happens client-side
 * from `RoleProvider`, so no fetch blocks the navigation.
 */
/** Deliberately not opted into `unstable_instant` - see `bookings/page.tsx`. */
export default function PaymentsPage() {
    return <PaymentsPageView />;
}
