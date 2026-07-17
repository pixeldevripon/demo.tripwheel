import { BookingsListView } from '@/components/dashboard/bookings/bookings-list-view';

export default function BookingsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
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
