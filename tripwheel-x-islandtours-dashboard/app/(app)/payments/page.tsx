import { getUserProfile } from '@/app/_actions/userActions';
import { CustomerPaymentsView } from '@/components/customer/customer-payments-view';
import { PaymentsListView } from '@/components/payments/payments-list-view';
import { headers } from 'next/headers';

export default async function PaymentsPage() {
  const cookie = (await headers()).get('cookie') ?? '';
  // Request-memoized (React cache()) - already resolved by the layout.
  const user = await getUserProfile(cookie);

  // Customers see their own charges/refunds; the backend scopes the same
  // GET /payments to booking.userId for the USER role.
  if (user?.role === 'USER') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every charge and refund on your bookings, with its current
              status.
            </p>
          </div>
        </div>
        <CustomerPaymentsView />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform charges per booking (deposits, full payments, refunds) with
            their provider status. Operators see payments on their own tours only.
          </p>
        </div>
      </div>
      <PaymentsListView />
    </div>
  );
}
