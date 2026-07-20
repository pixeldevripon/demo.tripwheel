import { getUserProfile } from '@/app/_actions/userActions';
import { BookingsListView } from '@/components/bookings/bookings-list-view';
import { CustomerBookingsView } from '@/components/customer/customer-bookings-view';
import { headers } from 'next/headers';

export default async function BookingsPage() {
  const cookie = (await headers()).get('cookie') ?? '';
  // Request-memoized (React cache()) - already resolved by the layout, so this
  // reuses that result with no extra backend call.
  const user = await getUserProfile(cookie);

  // Customers get their own framing (stat row + own-bookings table + the
  // cancellation-request flow); the backend scopes the same GET /bookings to
  // booking.userId for the USER role either way.
  if (user?.role === 'USER') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">My Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every trip you have booked with Island Tours - status, payments
              and cancellation requests in one place.
            </p>
          </div>
        </div>
        <CustomerBookingsView />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Bookings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every reservation with guest, payment and commission context. Operators
            see bookings on their own tours only.
          </p>
        </div>
      </div>
      <BookingsListView />
    </div>
  );
}
